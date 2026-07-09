import type { PrimaryIntent } from "@/lib/extractor/types";

export type RuleJson = Record<string, unknown> | Array<unknown> | null;

export type ServiceRule = {
  id: string;
  name: string;
  label?: string | null;
  keywords?: string[];
  offeringDescription?: string | null;
  offeringFollowup?: string | null;
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
  rule?: RuleJson;
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
  serviceSubjects?: ServiceSubjectRule[];
  pricingRules: PricingRule[];
  decisionRequirements: DecisionRequirement[];
  availabilityRules: AvailabilityRule[];
  locationZones?: LocationZoneRule[];
  scheduleRules?: ScheduleRule[];
  autosendPolicies?: AutosendPolicyRule[];
  responseTemplates?: ResponseTemplateRule[];
};

export type ServiceSubjectRule = {
  serviceId: string;
  subjectKey: string;
  labelLt: string;
  descriptionLt: string;
  synonyms: string[];
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
  evidenceVerified?: boolean;
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
  | "VALUE_NOT_ALLOWED"
  | "AI_CONFLICT";

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

export type LocationZoneRule = {
  adminUnitCode: string;
  zone: string;
  travelFeeEur: number;
  served: boolean;
};

export type ScheduleRule = {
  rule: RuleJson;
};

export type AutosendPolicyRule = {
  policy: RuleJson;
};

export type ResponseTemplateRule = {
  templateKey: string;
  body: string;
  active: boolean;
};

export type DecisionServiceInput = {
  id: string | null;
  confidence: number;
  source?: "form_field" | "deterministic" | "ai";
  evidence?: string | null;
  evidenceVerified?: boolean;
  candidates?: Array<{ id: string; confidence: number }>;
};

export type DecisionLocationInput = {
  raw: string;
  adminUnit: {
    type: "municipality";
    code: string;
    label: string;
  };
  confidence: number;
  source: string;
} | null;

export type DecisionIntentsInput = {
  asksPrice: boolean;
  asksAvailability: boolean;
  isUrgent: boolean;
  primaryIntent?: PrimaryIntent | null;
};

export type DecisionEngineInput = RequirementResolutionResult & {
  service: DecisionServiceInput;
  location: DecisionLocationInput;
  city?: string | null;
  intents: DecisionIntentsInput;
  rules: ClientRules;
  now?: Date;
};

export type DecisionResultDecision =
  | "MANUAL_REVIEW"
  | "DECLINE_TEMPLATE"
  | "ASK_MISSING_INFO"
  | "PRICE_ESTIMATE"
  | "OFFERING_ANSWER";

export type OfferingAnswer = {
  description: string;
  followup: string | null;
};

export type PriceEstimate = {
  pricingRuleId: string;
  currency: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export type LeadTimeEstimate = {
  minWeeks: number | null;
  maxWeeks: number | null;
  text: string;
};

export type DecisionResult = {
  decision: DecisionResultDecision;
  reason: string;
  priceEstimate: PriceEstimate | null;
  leadTime: LeadTimeEstimate | null;
  questionsToAsk: string[];
  autoSend: boolean;
  autoSendBlockedBy: string[];
  offeringAnswer?: OfferingAnswer | null;
  matchedAvailabilityRule?: MatchedAvailabilityRule | null;
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
