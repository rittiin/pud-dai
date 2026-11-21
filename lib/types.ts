export type Sym =
  | "fever"
  | "cough"
  | "sore_throat"
  | "runny_nose"
  | "myalgia"
  | "headache"
  | "fatigue"
  | "chills"
  | "sputum"
  | "diarrhea"
  | "vomiting"
  | "abdominal_pain"
  | "bloody_stool";

export type RedFlag =
  | "dyspnea"
  | "chest_pain"
  | "confusion"
  | "cyanosis"
  | "cannot_drink"
  | "seizure"
  | "worse_again"
  | "high_fever_3d"
  | "severe_dehydration";

export type Chronic =
  | "lung"
  | "heart"
  | "kidney"
  | "liver"
  | "diabetes"
  | "immuno"
  | "cancer"
  | "obesity"
  | "neuro";

export type ContactKind = "household" | "school" | "work" | "other" | "none" | "unknown";
export type TestResult =
  | "none"
  | "rapid_pos_a"
  | "rapid_pos_b"
  | "pcr_pos"
  | "neg";
export type DiseaseFocus = "flu" | "acute_diarrhea" | "food_poisoning" | "unknown";
export type Vaccine = "yes_1y" | "yes_old" | "no" | "unknown";

/** Answers collected from a citizen. undefined = not asked yet. */
export interface Answers {
  consent?: boolean;
  symptoms?: Sym[];
  feverTemp?: number;
  onsetDate?: string; // YYYY-MM-DD
  status?: "sick" | "better" | "recovered";
  redFlags?: RedFlag[];
  age?: number;
  sex?: "M" | "F";
  pregnant?: boolean;
  chronic?: Chronic[];
  sickContact?: ContactKind;
  placeName?: string;
  placeSickCount?: number | null; // null = unknown
  poultry?: boolean;
  travel?: boolean;
  hcw?: boolean;
  vaccinated?: Vaccine;
  test?: TestResult;
  diseaseFocus?: DiseaseFocus;
  stoolCount?: number;
  sharedMeal?: boolean | null;
  district?: string;
  province?: string;
  phone?: string | null; // null = declined
}

export type AnswerKey = keyof Answers;

/** Where each value came from — every value must be traceable to something the person said or tapped. */
export interface EvidenceItem {
  quote: string;
  via: "button" | "text" | "ai";
}
export type Evidence = Partial<Record<AnswerKey, EvidenceItem>>;

export interface ChatTurn {
  role: "bot" | "user";
  text: string;
}

export type Classification = "not_case" | "suspected" | "probable" | "confirmed";
export type Urgency = "emergency" | "urgent" | "soon" | "selfcare" | "recovered";

export interface Alert {
  level: "red" | "amber";
  code: string;
  text: string;
}

export interface Assessment {
  disease: DiseaseFocus;
  surveillanceCode: string;
  meetsClinical: boolean;
  clinicalReason: string;
  classification: Classification;
  urgency: Urgency;
  highRisk: string[];
  alerts: Alert[];
  contagiousUntil?: string;
  hoursSinceOnset?: number;
}

export interface CaseRecord {
  id: string;
  createdAt: string;
  demo?: boolean;
  answers: Answers;
  evidence: Evidence;
  transcript: ChatTurn[];
  assessment: Assessment;
  /** Explicit opt-in before stored facts are sent to an external AI for reports. */
  aiConsent?: boolean;
  review?: "pending" | "verified" | "dismissed";
}
