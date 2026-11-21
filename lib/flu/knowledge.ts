// Knowledge base for influenza, taken from Department of Disease Control (DDC) sources.
// Every rule in rules.ts points back to one of these references.
import type { Chronic, RedFlag, Sym } from "../types";

export const SOURCES = {
  caseDef: {
    label: "นิยามโรคและแนวทางการรายงานโรคติดต่อฯ กรมควบคุมโรค — ไข้หวัดใหญ่ (ICD-10 J10-J11) หน้า 73–74",
    url: "https://ddc.moph.go.th/uploads/publish/1142920210518092542.pdf",
  },
  form: {
    label: "แบบสอบสวนโรคติดเชื้อระบบทางเดินหายใจเฉียบพลัน [SARI_AI 2] หน้า 298–305",
    url: "https://ddc.moph.go.th/uploads/publish/1142920210518092542.pdf",
  },
  disease: {
    label: "ความรู้เรื่องโรคไข้หวัดใหญ่ กรมควบคุมโรค",
    url: "https://ddc.moph.go.th/disease_detail.php?d=13",
  },
  novel: {
    label: "ไข้หวัดใหญ่สายพันธุ์ใหม่ชนิด A กรมควบคุมโรค",
    url: "https://ddc.moph.go.th/disease_detail.php?d=20",
  },
  childEmergency: {
    label: "CDC: Emergency Warning Signs of Flu in Children",
    url: "https://www.cdc.gov/flu/signs-symptoms/index.html",
  },
} as const;

export const CASE_DEFINITION = {
  clinical:
    "มีไข้ ไอ ร่วมกับมีอาการอย่างใดอย่างหนึ่ง ได้แก่ เจ็บคอ มีน้ำมูก ปวดเมื่อยตามตัว ปวดศีรษะ หรืออ่อนเพลีย",
  suspected: "ผู้ที่มีอาการตามเกณฑ์ทางคลินิก",
  probable:
    "มีอาการตามเกณฑ์ทางคลินิก และมีประวัติเชื่อมโยงทางระบาดวิทยากับผู้ป่วยยืนยัน หรือผลบวกจากการตรวจทั่วไป (Rapid test)",
  confirmed: "มีอาการตามเกณฑ์ทางคลินิก และผลบวกจากการตรวจจำเพาะ เช่น RT-PCR",
  report: "รายงานตั้งแต่ผู้ป่วยสงสัยในระบบ รง.506 รหัสโรค 15",
  outbreak:
    "ผู้ป่วยสงสัยเป็นกลุ่มก้อน ตั้งแต่ 5 รายขึ้นไป ภายใน 1 สัปดาห์ ในสถานที่เดียวกัน เช่น ที่ทำงาน โรงเรียน เรือนจำ → ดำเนินการสอบสวนการระบาด (ข้อ 5.2)",
  incubation: "ระยะฟักตัว 1–4 วัน",
  contagious:
    "แพร่เชื้อได้ตั้งแต่ 1 วันก่อนมีอาการ ถึง 3–5 วันหลังมีอาการในผู้ใหญ่ ส่วนในเด็กอาจนานกว่า 7 วัน",
};

/** Official disease-code references used in this demo. */
export const DISEASE_SOURCES = {
  definitions: {
    label: "กรมควบคุมโรค: นิยามโรคและแนวทางการรายงานโรค (รหัส 506)",
    url: "https://ddc.moph.go.th/uploads/publish/1142920210518092542.pdf",
  },
  diarrhea: {
    label: "กรมควบคุมโรค: แนวทางเฝ้าระวังโรคอุจจาระร่วง",
    url: "https://ddc.moph.go.th/uploads/ckeditor2/files/หนังสือเรียนสำนักอนามัยส่งแนวทาง_09012568.pdf",
  },
} as const;

export const DISEASE_CATALOG = {
  flu: { label: "ไข้หวัดใหญ่", code: "506 15", clinical: CASE_DEFINITION.clinical },
  // Wording follows the DDC case-definition book (2563), pp. 143 and 145.
  acute_diarrhea: {
    label: "อุจจาระร่วงเฉียบพลัน",
    code: "506 02",
    clinical: "ถ่ายเหลวหรือถ่ายเป็นน้ำอย่างน้อย 3 ครั้ง หรือถ่ายเป็นมูกเลือดอย่างน้อย 1 ครั้ง ภายใน 24 ชั่วโมง อาจมีอาเจียนหรือขาดน้ำร่วมด้วย",
  },
  food_poisoning: {
    label: "อาหารเป็นพิษ",
    code: "506 03",
    clinical: "คลื่นไส้ อาเจียน ปวดท้อง อาจมีถ่ายเหลว เกิดแบบเฉียบพลันหลังกินอาหารที่สงสัยว่าปนเปื้อน (ผู้ป่วยสงสัย = มีอาการนี้ และมีประวัติกินอาหารที่สงสัยปนเปื้อน)",
  },
  unknown: { label: "ยังไม่แน่ใจ", code: "—", clinical: "ยังระบุโรคจากข้อมูลที่ให้ไม่ได้" },
} as const;

/** Symptoms that may accompany fever + cough for the clinical criterion. */
export const COMPANION_SYMS: Sym[] = ["sore_throat", "runny_nose", "myalgia", "headache", "fatigue"];

export const SYM_LABEL: Record<Sym, string> = {
  fever: "ไข้",
  cough: "ไอ",
  sore_throat: "เจ็บคอ",
  runny_nose: "มีน้ำมูก/คัดจมูก",
  myalgia: "ปวดเมื่อยตามตัว",
  headache: "ปวดศีรษะ",
  fatigue: "อ่อนเพลีย",
  chills: "หนาวสั่น",
  sputum: "มีเสมหะ",
  diarrhea: "ถ่ายเหลว",
  vomiting: "อาเจียน",
  abdominal_pain: "ปวดท้อง",
  bloody_stool: "ถ่ายมีมูกเลือด",
};

export const RED_FLAG_LABEL: Record<RedFlag, string> = {
  dyspnea: "หายใจลำบาก หอบเหนื่อย",
  chest_pain: "เจ็บหรือแน่นหน้าอก",
  confusion: "ซึม สับสน ปลุกตื่นยาก",
  cyanosis: "ริมฝีปากหรือปลายมือเขียว",
  cannot_drink: "กินหรือดื่มน้ำไม่ได้ ปัสสาวะน้อยมาก",
  seizure: "ชัก",
  worse_again: "อาการดีขึ้นแล้วกลับแย่ลงใหม่ ไข้กลับมา ไอหนักขึ้น",
  high_fever_3d: "ไข้สูงไม่ลดเกิน 3 วัน",
  severe_dehydration: "มีอาการขาดน้ำรุนแรง เช่น ซึมมาก ปากแห้งมาก ปัสสาวะน้อยมาก",
  child_fast_breathing: "เด็กหายใจเร็วหรือหายใจลำบาก",
  child_ribs: "เด็กมีซี่โครงบุ๋มเวลาหายใจ",
  child_no_urine: "เด็กไม่ปัสสาวะ 8 ชั่วโมง ปากแห้ง หรือร้องไห้ไม่มีน้ำตา",
  child_not_alert: "เด็กไม่ค่อยรู้สึกตัวหรือไม่ตอบสนองตามปกติ",
  child_severe_muscle_pain: "เด็กปวดกล้ามเนื้อรุนแรงหรือไม่ยอมเดิน",
  infant_fever: "ทารกอายุต่ำกว่า 3 เดือนมีไข้",
};

/** Outbreak-investigation thresholds from section 5.2 of each case definition. */
export const OUTBREAK_RULE: Partial<Record<keyof typeof DISEASE_CATALOG, { min: number; days: number; text: string }>> = {
  flu: { min: 5, days: 7, text: "ผู้ป่วยสงสัย ≥ 5 รายใน 1 สัปดาห์ ในสถานที่เดียวกัน" },
  acute_diarrhea: { min: 10, days: 2, text: "ผู้ป่วย ≥ 10 รายภายใน 2 วัน ในชุมชนหรือสถานที่เดียวกัน" },
};

/** Which danger signs to show for each kind of illness. */
export const CHILD_FLAGS: RedFlag[] = ["child_fast_breathing", "child_ribs", "child_no_urine", "child_not_alert", "child_severe_muscle_pain", "infant_fever"];
export const RESP_FLAGS: RedFlag[] = ["dyspnea", "chest_pain", "confusion", "cyanosis", "seizure", "cannot_drink", "worse_again", "high_fever_3d"];
export const GI_FLAGS: RedFlag[] = ["severe_dehydration", "cannot_drink", "confusion", "seizure", "high_fever_3d"];

/** Red flags requiring emergency care right away (vs. "see a doctor today"). */
export const EMERGENCY_FLAGS: RedFlag[] = ["dyspnea", "chest_pain", "confusion", "cyanosis", "seizure", "cannot_drink", "severe_dehydration", ...CHILD_FLAGS.filter((f) => f !== "infant_fever")];

export const CHRONIC_LABEL: Record<Chronic, string> = {
  lung: "โรคปอดเรื้อรัง/หอบหืด",
  heart: "โรคหัวใจ",
  kidney: "โรคไต",
  liver: "โรคตับเรื้อรัง",
  diabetes: "เบาหวาน",
  immuno: "ภูมิคุ้มกันบกพร่อง",
  cancer: "มะเร็งที่กำลังรักษา",
  obesity: "อ้วนมาก",
  neuro: "พิการทางสมอง ช่วยเหลือตัวเองไม่ได้",
};

/** Practical advice for the public. Plain language, no drug doses. */
export const ADVICE = {
  selfCare: [
    "พักผ่อนให้มาก และดื่มน้ำบ่อย ๆ ครั้งละน้อย ถ้ากินได้น้อยให้จิบน้ำเกลือแร่ (ORS)",
    "ถ้ามีไข้ ให้เช็ดตัวด้วยน้ำอุณหภูมิห้อง และกินยาพาราเซตามอลตามขนาดที่เขียนบนฉลากเท่านั้น ห่างกันอย่างน้อย 4–6 ชั่วโมง",
    "ห้ามให้ยาแอสไพรินกับเด็กและวัยรุ่น เพราะเสี่ยงต่อกลุ่มอาการราย (Reye's syndrome)",
    "ไข้หวัดใหญ่เกิดจากไวรัส ยาปฏิชีวนะ (ยาฆ่าเชื้อ) ไม่ช่วยให้หายเร็วขึ้น ไม่ต้องซื้อมากินเอง",
    "กินอาหารอ่อน ๆ ย่อยง่าย เช่น ข้าวต้ม โจ๊ก",
  ],
  protectOthers: [
    "สวมหน้ากากอนามัยเมื่ออยู่ใกล้คนอื่น แม้แต่คนในบ้าน",
    "ไอหรือจามใส่ทิชชูหรือข้อพับแขน แล้วทิ้งทิชชูลงถังที่มีฝาปิด",
    "ล้างมือด้วยสบู่อย่างน้อย 20 วินาที หรือใช้เจลแอลกอฮอล์ โดยเฉพาะหลังไอจามและก่อนจับอาหาร",
    "แยกแก้วน้ำ ช้อน ผ้าเช็ดหน้า และถ้าทำได้ให้นอนแยกห้อง เปิดหน้าต่างให้อากาศถ่ายเท",
    "เลี่ยงการอยู่ใกล้ผู้สูงอายุ เด็กเล็ก หญิงตั้งครรภ์ และผู้มีโรคประจำตัวในบ้าน ถ้าคนกลุ่มนี้เริ่มมีไข้ ควรพาไปพบแพทย์เร็ว",
  ],
  /** Acute diarrhea: replace lost fluid, keep eating, no anti-diarrhoeals. */
  diarrheaSelfCare: [
    "ดื่มสารละลายเกลือแร่ ORS ที่ผสมตามฉลาก จิบบ่อย ๆ และดื่มเพิ่มหลังถ่ายเหลวทุกครั้ง ห้ามใช้เครื่องดื่มเกลือแร่สำหรับนักกีฬาหรือน้ำอัดลมแทน",
    "กินอาหารต่อได้ เลือกอาหารอ่อนย่อยง่าย เช่น ข้าวต้ม โจ๊ก ไม่ต้องงดอาหาร เด็กเล็กให้กินนมแม่หรือนมตามปกติ",
    "ไม่ควรซื้อยาหยุดถ่ายหรือยาปฏิชีวนะกินเอง ยาหยุดถ่ายอาจทำให้เชื้อค้างในลำไส้ โดยเฉพาะเมื่อมีไข้หรือถ่ายเป็นมูกเลือด",
    "ถ่ายเป็นมูกเลือด ไข้สูง หรือถ่ายเป็นน้ำมากจนอ่อนเพลีย ควรไปพบแพทย์",
  ],
  /** Food poisoning: vomiting first, keep the evidence for investigators. */
  foodPoisoningSelfCare: [
    "ถ้าอาเจียน ให้พักกระเพาะสักครู่ แล้วค่อย ๆ จิบ ORS ครั้งละน้อยแต่บ่อย ๆ เมื่ออาเจียนลดลงจึงเริ่มกินอาหารอ่อน",
    "อย่าล้วงคอหรือพยายามทำให้อาเจียนเอง และไม่ควรซื้อยาหยุดถ่ายหรือยาปฏิชีวนะกินเอง",
    "ถ้ามีอาหารที่สงสัยเหลืออยู่ ให้เก็บใส่ถุงหรือกล่องปิดแช่ตู้เย็นไว้ อย่าเพิ่งทิ้ง เพื่อให้เจ้าหน้าที่นำไปตรวจหาเชื้อ",
    "จดว่ากินอะไร ที่ไหน กี่โมง และเริ่มมีอาการกี่โมง ข้อมูลนี้ช่วยให้เจ้าหน้าที่หาต้นเหตุได้เร็ว",
  ],
  giProtect: [
    "ล้างมือด้วยสบู่หลังเข้าห้องน้ำ หลังเปลี่ยนผ้าอ้อม และก่อนเตรียมหรือกินอาหาร เจลแอลกอฮอล์ใช้แทนสบู่ได้ไม่ดีนักกับเชื้อท้องร่วงบางชนิด",
    "งดทำอาหารให้คนอื่นจนกว่าจะหายอย่างน้อย 2 วัน และใช้ช้อนกลาง",
    "ทำความสะอาดห้องน้ำและจุดที่เปื้อนอาเจียนหรืออุจจาระด้วยน้ำยาฟอกขาว (โซเดียมไฮโปคลอไรต์) ที่ผสมตามฉลาก",
    "กินอาหารปรุงสุกใหม่ ดื่มน้ำสะอาด แยกเขียงและมีดของอาหารดิบกับอาหารสุก",
  ],
  recovered: [
    "ถ้าไม่มีไข้มาแล้วอย่างน้อย 24 ชั่วโมงโดยไม่ได้กินยาลดไข้ กลับไปทำงานหรือเรียนได้ แต่ควรสวมหน้ากากต่ออีก 2–3 วันถ้ายังไอ",
    "อาการไออาจหลงเหลือได้ 1–2 สัปดาห์หลังหาย ถือว่าปกติ แต่ถ้าไอหนักขึ้น หอบ หรือไข้กลับมาใหม่ ให้ไปพบแพทย์ เพราะอาจเกิดปอดอักเสบแทรกซ้อน",
    "สังเกตอาการคนในบ้านอีก 4 วัน (ระยะฟักตัว 1–4 วัน) ถ้ามีใครเริ่มมีไข้และไอ ให้เขาประเมินอาการผ่านพูดได้ได้เช่นกัน",
  ],
  vaccine: [
    "ฉีดวัคซีนไข้หวัดใหญ่ปีละ 1 ครั้ง เพราะเชื้อเปลี่ยนสายพันธุ์ได้ทุกปี",
    "กลุ่มเสี่ยง เช่น ผู้สูงอายุ 65 ปีขึ้นไป เด็กเล็ก หญิงตั้งครรภ์ และผู้มีโรคเรื้อรัง ฉีดฟรีตามสิทธิ์ที่ รพ.สต. หรือโรงพยาบาลใกล้บ้าน",
  ],
  hotline: "สายด่วนกรมควบคุมโรค 1422 · เจ็บป่วยฉุกเฉิน 1669",
};

/** Antiviral facts for the public. No doses — prescription only. */
export const ANTIVIRAL = {
  name: "โอเซลทามิเวียร์ (Oseltamivir)",
  facts: [
    "เป็นยาต้านไวรัสไข้หวัดใหญ่ ใช้ได้ทั้งสายพันธุ์ A และ B",
    "ต้องให้แพทย์ตรวจและสั่งจ่ายเท่านั้น ห้ามซื้อมากินเอง และห้ามกินยาของคนอื่น",
    "ได้ผลดีที่สุดถ้าเริ่มกินภายใน 48 ชั่วโมงหลังเริ่มมีอาการ ช่วยให้หายเร็วขึ้นและลดโอกาสเกิดภาวะแทรกซ้อน เช่น ปอดอักเสบ",
    "แพทย์จะพิจารณาให้ยาก่อนในกลุ่มเสี่ยงและคนที่มีอาการรุนแรง ถึงจะเกิน 48 ชั่วโมงแล้วก็ยังอาจได้รับยา",
    "ถ้าได้รับยา ให้กินจนครบตามที่แพทย์สั่ง ถ้าคลื่นไส้ให้กินพร้อมอาหาร",
  ],
  source: { label: "CDC: Influenza Antiviral Medications", url: "https://www.cdc.gov/flu/treatment/" },
};
