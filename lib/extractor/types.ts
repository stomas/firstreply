export type FactKind =
  | "measurement"
  | "quantity"
  | "date"
  | "location"
  | "contact"
  | "selection"
  | "freeform";

export type MeasurementDimension =
  | "length"
  | "width"
  | "height"
  | "area"
  | "volume"
  | "count"
  | "weight"
  | "duration";

export type ExtractedUnit =
  | "m"
  | "m2"
  | "m3"
  | "cm"
  | "mm"
  | "km"
  | "vnt"
  | "kg"
  | "val"
  | "d";

export type FactSource = "deterministic" | "ai" | "form_field";
export type SubjectSource = FactSource | null;

export type FactComputation = {
  op: "multiply" | "add";
  inputs: string[];
};

export type ExtractedFact = {
  id: string;
  requirementKey?: string | null;
  kind: FactKind;
  subject: string | null;
  subjectSource: SubjectSource;
  dimension: MeasurementDimension | null;
  value: number | string | boolean | null;
  valueMin: number | null;
  valueMax: number | null;
  unit: ExtractedUnit | null;
  rawText: string;
  evidenceVerified: true;
  source: FactSource;
  confidence: number;
  negated: boolean;
  derived?: boolean;
  computation?: FactComputation | null;
};

export type ExtractedContact = {
  raw: string;
  normalized: string;
  valid: boolean;
};

export type ExtractedContacts = {
  phone: ExtractedContact | null;
  email: ExtractedContact | null;
};

export type AdminUnitLocation = {
  raw: string;
  adminUnit: {
    type: "municipality";
    code: string;
    label: string;
  };
  confidence: number;
  source: "deterministic";
};

export type PrimaryIntent =
  | "requests_quote"
  | "asks_offering"
  | "asks_availability"
  | "asks_process"
  | "provides_info"
  | "other";

export type ExtractedIntents = {
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
  primaryIntent: PrimaryIntent | null;
};

// Universalūs (ne domeno) žmogaus peržiūros signalai: klientas lygina gautą
// pasiūlymą, prašo įvertinimo vietoje arba mini esamą konstrukciją / nežinomą
// būklę, kuri gali keisti darbų apimtį. Signalas niekada nekeičia faktų —
// jis tik nukreipia sprendimą į manual review / blokuoja auto-send.
export type ReviewSignalType =
  | "competitor_price"
  | "site_visit_requested"
  | "unknown_site_conditions";

export type ReviewSignal = {
  type: ReviewSignalType;
  evidence: string;
  source: "deterministic" | "ai";
};

export type DeterministicExtractionResult = {
  schemaVersion: "lead_parse_v2";
  location: AdminUnitLocation | null;
  intents: ExtractedIntents;
  contacts: ExtractedContacts;
  facts: ExtractedFact[];
  meta: {
    parserVersion: string;
    aiCalled: false;
    processedAt: string;
  };
};
