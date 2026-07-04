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
  required?: boolean;
  affectsPrice?: boolean;
  expectedFact?: RuleJson;
  validation?: RuleJson;
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
  parseResult: Record<string, unknown> | null;
  asksPrice: boolean | null;
  asksAvailability: boolean | null;
  isUrgent: boolean | null;
  hasAttachments: boolean | null;
};

export type ResolvedRequirementValue = {
  value: unknown;
  valueMin?: number | null;
  valueMax?: number | null;
  unit: string | null;
  factRef: string | null;
  source: string;
  subjectSource: string | null;
  confidence: number;
  validationPassed?: boolean;
};

export type UnresolvedRequirementStatus =
  | "unresolved"
  | "pending_binding"
  | "conflict";

export type UnresolvedRequirement = {
  requirementKey: string;
  label: string;
  question: string;
  required: boolean;
  affectsPrice: boolean;
  status: UnresolvedRequirementStatus;
  candidateFactRefs: string[];
};

export type RequirementConflictReason =
  | "MULTIPLE_FACTS_FOR_REQUIREMENT"
  | "VALUE_OUT_OF_RANGE"
  | "VALUE_NOT_ALLOWED";

export type RequirementConflict = {
  requirementKey: string;
  factRefs: string[];
  reason: RequirementConflictReason;
};

export type RequirementResolutionResult = {
  resolvedRequirements: Record<string, ResolvedRequirementValue | null>;
  unresolvedRequirements: UnresolvedRequirement[];
  conflicts: RequirementConflict[];
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
