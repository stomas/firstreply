export type RuleJson = Record<string, unknown> | Array<unknown> | null;

export type ServiceRule = {
  id: string;
  name: string;
  active: boolean;
};

export type PricingRule = {
  id: string;
  serviceId: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
  conditions: RuleJson;
  exclusions: RuleJson;
  disclaimerText: string | null;
  autoSendAllowed: boolean;
  active: boolean;
};

export type DecisionRequirement = {
  id: string;
  serviceId: string;
  requirementKey: string;
  label: string;
  requiredFor: string;
  questionTextIfMissing: string;
  blocksAutoSend: boolean;
  priority: number;
  active: boolean;
};

export type AvailabilityRule = {
  id: string;
  serviceId: string;
  location: string | null;
  status: string;
  earliestStartText: string | null;
  noteForCustomer: string | null;
  validUntil: Date | string | null;
  autoSendAllowed: boolean;
};

export type ClientRules = {
  services: ServiceRule[];
  pricingRules: PricingRule[];
  decisionRequirements: DecisionRequirement[];
  availabilityRules: AvailabilityRule[];
};

export type EvaluationLead = {
  id: string;
  serviceId: string | null;
  city: string | null;
  originalMessage: string;
  parsedJson: Record<string, unknown> | null;
  asksPrice: boolean | null;
  asksAvailability: boolean | null;
  isUrgent: boolean | null;
  hasAttachments: boolean | null;
};

export type MissingRequirement = {
  key: string;
  label: string;
  question: string;
};

export type MatchedPricingRule = {
  id: string;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  unit: string | null;
};

export type MatchedAvailabilityRule = {
  id: string;
  earliestStartText: string | null;
  validUntil: string | null;
};

export type ResponseType =
  | "price_availability"
  | "missing_info"
  | "manual_review";

export type LeadEvaluationResult = {
  leadId: string;
  serviceId: string | null;
  canGenerateResponse: boolean;
  autoSendAllowed: boolean;
  responseType: ResponseType;
  missingRequirements: MissingRequirement[];
  matchedPricingRules: MatchedPricingRule[];
  matchedAvailabilityRule: MatchedAvailabilityRule | null;
  manualReviewReasons: string[];
  draftText: string | null;
};

export type DraftGenerationInput = Omit<
  LeadEvaluationResult,
  "draftText" | "canGenerateResponse"
> & {
  lead: EvaluationLead;
};
