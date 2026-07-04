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

export type ExtractedFact = {
  id: string;
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

export type ExtractedIntents = {
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
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
