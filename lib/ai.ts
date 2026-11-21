// Server-only LLM calls. With no key, callers fall back to the offline code paths.
import OpenAI from "openai";
import type { Answers, Evidence } from "./types";
import type { Extraction } from "./extract";
import { AI_ALLOWED } from "./demo";

type ProviderConfig = { id: string; label: string; apiKey: string; baseURL?: string; model: string; jsonMode?: boolean };

/** Select exactly one OpenAI-compatible provider; never fan out health text to several APIs. */
function selectProvider(): ProviderConfig | null {
  if (!AI_ALLOWED) return null;
  const choice = process.env.AI_PROVIDER?.toLowerCase();
  if (choice === "typhoon") return process.env.TYPHOON_API_KEY ? { id: "typhoon", label: "Typhoon", apiKey: process.env.TYPHOON_API_KEY, baseURL: "https://api.opentyphoon.ai/v1", model: process.env.TYPHOON_MODEL || "typhoon-v2.5-30b-a3b-instruct" } : null;
  if (choice === "openai") return process.env.OPENAI_API_KEY ? { id: "openai", label: "OpenAI", apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5-mini", jsonMode: true } : null;
  if (choice === "custom") return process.env.AI_API_KEY && process.env.AI_BASE_URL ? { id: "custom", label: "OpenAI-compatible API", apiKey: process.env.AI_API_KEY, baseURL: process.env.AI_BASE_URL, model: process.env.AI_MODEL || "default" } : null;
  if (process.env.TYPHOON_API_KEY) return { id: "typhoon", label: "Typhoon", apiKey: process.env.TYPHOON_API_KEY, baseURL: "https://api.opentyphoon.ai/v1", model: process.env.TYPHOON_MODEL || "typhoon-v2.5-30b-a3b-instruct" };
  if (process.env.OPENAI_API_KEY) return { id: "openai", label: "OpenAI", apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5-mini", jsonMode: true };
  if (process.env.AI_API_KEY && process.env.AI_BASE_URL) return { id: "custom", label: "OpenAI-compatible API", apiKey: process.env.AI_API_KEY, baseURL: process.env.AI_BASE_URL, model: process.env.AI_MODEL || "default" };
  return null;
}

const PROVIDER = selectProvider();

export function aiEnabled(): boolean {
  return PROVIDER !== null;
}

export function aiProvider(): string {
  return PROVIDER ? `${PROVIDER.label} (${PROVIDER.model})` : "ไม่ได้เปิดใช้ API ภายนอก";
}

function client() {
  if (!PROVIDER) throw new Error("No AI provider configured");
  return new OpenAI({ apiKey: PROVIDER.apiKey, baseURL: PROVIDER.baseURL });
}

function requestOptions(json: boolean) {
  const jsonFormat = json && PROVIDER?.jsonMode ? { response_format: { type: "json_object" as const } } : {};
  // OpenAI reasoning models (gpt-5*, o*) reject max_tokens and custom temperature.
  if (PROVIDER?.id === "openai" && /^(gpt-5|o\d)/.test(PROVIDER.model)) {
    return { max_completion_tokens: 4096, reasoning_effort: "minimal" as const, ...jsonFormat };
  }
  return { max_tokens: 2048, temperature: json ? 0.1 : 0.4, ...jsonFormat };
}

/** Pulls the first JSON object out of a reply that may be wrapped in ``` fences or prose. */
function parseJson(text: string): Record<string, unknown> {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return {};
  }
}

const EXTRACT_SYSTEM = `คุณคือผู้ช่วยดึงข้อมูลสำหรับคัดกรองไข้หวัดใหญ่ อุจจาระร่วงเฉียบพลัน และอาหารเป็นพิษ
หน้าที่: อ่านข้อความภาษาไทยที่ประชาชนพิมพ์ แล้วดึงเฉพาะข้อมูลที่ "ระบุไว้ชัดเจน" เป็น JSON
ห้ามเดา ห้ามอนุมาน ห้ามวินิจฉัย ถ้าไม่ได้พูดถึง ให้ไม่ใส่ field นั้นเลย

กฎเรื่อง "ผู้ป่วย":
- ผู้ป่วย คือคนที่กำลังถูกประเมินอาการ (ปกติคือคนพิมพ์ ยกเว้นพิมพ์แทนคนอื่นชัดเจน เช่น "แม่ผมไข้")
- ถ้าข้อความพูดถึงคนอื่นที่ป่วยด้วย (เช่น "ลูกก็เป็นเหมือนกัน") ห้ามเอาอายุ/เพศ/อาการของคนนั้นมาใส่เป็นของผู้ป่วย ให้ใส่เป็น sickContact แทน
- ถ้าคนที่ป่วยด้วยเป็นคนในบ้าน (ลูก พ่อ แม่ สามี ภรรยา) sickContact = "household" และ placeName/placeSickCount ให้ใช้สถานที่ที่มีคนป่วยหลายคน (เช่น โรงเรียนของลูก) ถ้ามีระบุ
- placeName ให้คัดลอกชื่อเต็มตามที่พิมพ์ เช่น "อนุบาลวัดป่า" ไม่ใช่ "วัดป่า"
- ความดันโลหิตสูง ไม่ใช่โรคหัวใจ ห้าม map เป็น "heart" (ไม่มีค่าสำหรับความดันในรายการ ให้ข้ามไป)

field ที่อนุญาต (ใส่เฉพาะที่มีหลักฐาน):
- symptoms: array ของ "fever","cough","sore_throat","runny_nose","myalgia","headache","fatigue","chills","sputum","diarrhea","vomiting","abdominal_pain","bloody_stool"
- diseaseFocus: "flu" | "acute_diarrhea" | "food_poisoning" | "unknown" (ใส่เฉพาะเมื่อผู้ใช้ระบุโรคที่ต้องการคัดกรองชัดเจน ห้ามอนุมานจากอาการ)
- stoolCount: number (จำนวนครั้งที่ถ่ายใน 24 ชั่วโมง ต้องมีตัวเลขในคำพูด)
- sharedMeal: boolean (รับประทานอาหารมื้อเดียวกันกับผู้ป่วยอื่นที่มีอาการคล้ายกัน)
- feverTemp: number (องศาเซลเซียส)
- onsetDate: "YYYY-MM-DD" (คำนวณจากวันนี้ที่ให้มา เช่น "เมื่อวาน")
- status: "sick" | "better" | "recovered"
- redFlags: array ของ "dyspnea","chest_pain","confusion","cyanosis","cannot_drink","seizure","worse_again","high_fever_3d","severe_dehydration"
- age: number (ปี ของผู้ป่วย ถ้าผู้พิมพ์ตอบแทนคนอื่น ให้ใช้อายุผู้ป่วย)
- sex: "M" | "F"
- pregnant: boolean
- chronic: array ของ "lung","heart","kidney","liver","diabetes","immuno","cancer","obesity","neuro" (ใช้ [] ถ้าบอกว่าไม่มีโรคประจำตัว)
- sickContact: "household" | "school" | "work" | "other" | "none"
- placeName: string (ชื่อโรงเรียน/ที่ทำงาน ตามที่พิมพ์)
- placeSickCount: number
- poultry: boolean (สัมผัสสัตว์ปีกป่วย/ตายใน 14 วัน)
- travel: boolean
- hcw: boolean
- vaccinated: "yes_1y" | "yes_old" | "no"
- test: "none" | "rapid_pos_a" | "rapid_pos_b" | "pcr_pos" | "neg"
- province: string, district: string

ตอบเป็น JSON รูปแบบ {"answers": {...}, "evidence": {"<field>": "<ข้อความที่คัดลอกมาตรงตัวจากข้อความผู้ใช้>"}}
ทุก field ใน answers ต้องมี evidence ที่เป็นข้อความคัดลอกตรงตัว (substring) จากข้อความผู้ใช้
ตอบเป็น JSON อย่างเดียว ไม่ต้องมีคำอธิบายอื่น`;

const CHRONIC_KEYWORD: Record<string, RegExp> = {
  heart: /หัวใจ/,
  kidney: /ไต/,
  liver: /ตับ/,
  diabetes: /เบาหวาน/,
  lung: /ปอด|หอบหืด|หืด|ถุงลม|copd/i,
  cancer: /มะเร็ง|เคมี/,
  immuno: /ภูมิ|hiv|เอชไอวี|สเตียรอยด์/i,
  obesity: /อ้วน/,
  neuro: /สมอง|ติดเตียง|พิการ/,
};

const norm = (s: string) => s.replace(/\s+/g, "").replace(/ํา/g, "ำ");

/** AI extraction with a grounding check: any field whose quote is not literally in the user's text is dropped. */
export async function aiExtract(text: string, today: string, context?: string): Promise<Extraction & { dropped: string[] }> {
  const res = await client().chat.completions.create({
    model: PROVIDER!.model,
    ...requestOptions(true),
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      {
        role: "user",
        content: `วันนี้คือ ${today}\n${context ? `คำถามล่าสุดที่ระบบถาม: ${context}\n` : ""}ข้อความผู้ใช้:\n"""${text}"""`,
      },
    ],
  });
  const raw = parseJson(res.choices[0]?.message?.content || "") as {
    answers?: Record<string, unknown>;
    evidence?: Record<string, string>;
  };
  const answers: Record<string, unknown> = {};
  const evidence: Evidence = {};
  const dropped: string[] = [];
  const hay = norm(text);
  for (const [k, v] of Object.entries(raw.answers ?? {})) {
    const q = raw.evidence?.[k];
    if (v === null || v === undefined) continue;
    if (!q || !hay.includes(norm(q))) {
      dropped.push(k);
      continue;
    }
    answers[k] = v;
    (evidence as Record<string, unknown>)[k] = { quote: q, via: "ai" };
  }
  // Second check: a quote existing is not enough for chronic disease; each code needs its own keyword in the text.
  if (Array.isArray(answers.chronic)) {
    const kept = (answers.chronic as string[]).filter((c) => !CHRONIC_KEYWORD[c] || CHRONIC_KEYWORD[c].test(text));
    if (kept.length !== (answers.chronic as string[]).length) dropped.push("chronic(บางรายการ)");
    answers.chronic = kept;
  }
  return { answers: answers as Partial<Answers>, evidence, dropped };
}

export async function aiReport(facts: string): Promise<string> {
  const res = await client().chat.completions.create({
    model: PROVIDER!.model,
    ...requestOptions(false),
    messages: [
      {
        role: "system",
        content:
          "คุณคือนักระบาดวิทยาที่ช่วยร่างรายงานเบื้องต้น (ร่างเพื่อให้เจ้าหน้าที่ตรวจแก้) ใช้เฉพาะข้อเท็จจริงที่ให้มา ห้ามเพิ่มตัวเลขหรือข้อมูลที่ไม่มี ถ้าข้อมูลไม่พอให้เขียนว่า 'ยังไม่มีข้อมูล' เขียนเป็นภาษาไทยแบบรายงานราชการ กระชับ ใช้หัวข้อ: สรุปเหตุการณ์, ลักษณะทางระบาดวิทยา (บุคคล เวลา สถานที่), การประเมินความเสี่ยง, ข้อเสนอแนะการควบคุมโรค (อ้างอิงแนวทางกรมควบคุมโรค เช่น เก็บตัวอย่าง NPS/Throat swab ส่งตรวจ RT-PCR ในผู้ป่วยระยะแรก ค้นหาผู้ป่วยเพิ่มเติม คัดกรองหน้าโรงเรียน/ที่ทำงาน ให้สุขศึกษา แยกผู้ป่วย) ตอบเป็น Markdown",
      },
      { role: "user", content: facts },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
