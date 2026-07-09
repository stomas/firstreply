# Super Admin System Config Design

## Context

The dashboard already lets a regular client configure the safer
business-facing parts of the system: services, basic pricing fields, customer
questions, and availability. Some important system behavior is still seeded in
`prisma/seed.ts` and can only be changed by editing data or code directly:

- `service_subjects` for subject recognition such as fence, gate, and wicket.
- `decision_requirements.expected_fact` and validation details.
- `pricing_rules.rule`, including `requirementKey`, `requires`, and modifiers.
- Tenant-level operational rules: `location_zones`, `schedule_rules`,
  `autosend_policies`, and `response_templates`.

The user wants a test/admin panel for changing these initially generated
values, adding new ones, and deleting or deactivating existing ones in order to
evaluate how well the system works with different configurations.

## Goal

Add a Super Admin / System Config dashboard area for editing technical
configuration that regular clients should not manage directly.

The work is split into two stages:

- **MVP 1 - Core Decision Config:** narrow, safe, and focused on request
  understanding plus pricing configuration.
- **MVP 2 - Operational Config:** later expansion for tenant-level operational
  settings such as location zones, lead time, autosend policy, and response
  templates.

The first implementation pass must build **MVP 1 only**.

## Non-Goals

- No multi-tenant user authentication or permissions overhaul.
- No cross-client / tenant selector in MVP 1.
- No database schema migration unless implementation discovers an unavoidable
  missing field. The required tables and JSON columns already exist.
- No generic raw JSON editor.
- No support for arbitrary pricing formulas beyond what the current engine
  evaluates.
- No decision engine or response composer behavior changes.
- No automatic migration of seed data. Running `npm run db:seed` remains a
  reset-to-default operation and may overwrite test values.

## Engine Compatibility Rules

The Super Admin UI must be a configuration builder for the engine that already
exists, not a way to introduce new runtime behavior.

- The implementation must not change the decision engine or response composer
  behavior.
- The UI must only create, update, validate, and preview configuration that the
  existing engine already supports.
- Do not introduce new rule fields unless they are already consumed by the
  current pricing / decision engine.
- If a requested or existing config shape is not supported by the current
  engine, show it as unsupported instead of extending the engine in this task.

## Access Model

Create a new dashboard route:

`/dashboard/super-admin`

The page is available only when one of these is true:

- `NODE_ENV !== "production"`
- `SUPER_ADMIN_ENABLED=true`

If disabled, the route should return `notFound()`.

Navigation should add a live `Super Admin` item under configuration only when
the feature is enabled, so production users do not see hidden tools.

MVP 1 uses only the current client resolved by `getCurrentClient()`. It edits
that client's services, subjects, requirements, pricing rules, and associated
tenant context where needed for display. It must not add a cross-client or
cross-tenant selector.

## Delete And Deactivation Strategy

Prefer deactivation over hard delete when an `active` field exists.

Hard delete is allowed only when both conditions are true:

- no active records reference the object or key being removed
- the table / record type does not have a safer `active=false` alternative

Deleting or changing keys must be blocked when active records still reference
the old key. This applies at least to:

- `ServiceSubject`
- `DecisionRequirement`
- `PricingRule`
- `ResponseTemplate` in MVP 2

If a DB model does not have an `active` field for a specific object, use delete
guards and show a clear warning before destructive actions.

## Seed Reset Warning

The Super Admin index page must show this warning prominently:

> Ši konfigūracija skirta testavimui. Paleidus `npm run db:seed`, dalis
> pakeitimų gali būti perrašyta.

## MVP 1 - Core Decision Config

MVP 1 contains only the pieces that directly affect request understanding and
pricing:

- `/dashboard/super-admin` route
- feature flag / access control
- navigation visibility
- configuration health / status summary
- Subjects management
- Requirements Advanced management
- Pricing Builder
- reference guards between subjects, requirements, and pricing rules
- read-only JSON preview
- unsupported / malformed JSON fallback
- tests for the core modules

MVP 1 must not include tenant operational rules.

### MVP 1 Index Status Summary

The Super Admin index page should include a simple configuration status block:

- services count
- subjects count
- active requirements count
- active pricing rules count
- unsupported JSON structures count
- broken references count, if this can be calculated without broad extra scope

If broken reference detection becomes too broad for MVP 1, the page must at
least show unsupported JSON count and the main record counts.

### MVP 1 Subjects

Manage `ServiceSubject` rows scoped to the current client through service
ownership:

- list grouped by service
- create subject
- edit subject
- delete subject only where safe

Fields:

- service
- `subjectKey`
- `labelLt`
- `descriptionLt`
- synonyms as comma-separated text

Validation:

- `subjectKey` is required and slug-like: lowercase letters, numbers, and
  underscores.
- `subjectKey` is unique per service.
- Delete is blocked when an active requirement for that service uses the subject
  in `expectedFact.subject`.

### MVP 1 Requirements Advanced

Extend requirement editing for technical fields that normal clients should not
touch:

- `requirementKey`
- `expectedFact.kind`
- `expectedFact.subject`
- `expectedFact.dimension`
- `expectedFact.units`
- `validation.min`
- `validation.max`
- `required`
- `affectsPrice`
- `priority`
- `active`

Supported `expectedFact` shape in MVP 1:

```json
{
  "kind": "measurement",
  "subject": "fence",
  "dimension": "length",
  "units": ["m"]
}
```

Validation:

- `kind` is `measurement`.
- `subject` is empty or one of the service subjects.
- `dimension` is one of `length`, `height`, `width`, `area`.
- `units` is non-empty and comma-separated.
- `requirementKey` cannot be changed to collide with another requirement on the
  same service.
- Changing or deleting a `requirementKey` is blocked when active pricing rules
  reference the old key via `rule.requirementKey`, `rule.requires`, or
  `rule.modifiers[].if.requirementKey`.
- Deactivation is preferred over hard delete because `DecisionRequirement` has
  an `active` field.

### MVP 1 Pricing Builder

Manage the supported `pricing_rules.rule` structure using form fields and
repeatable modifier rows.

The Pricing Builder must remain a limited builder for the rule types and fields
currently evaluated by the engine. It must not become a universal pricing
editor and must not add new pricing concepts or formula syntax.

Supported rule types:

- `per_unit`
- `range_estimate`

Common fields:

- service
- name
- active
- auto-send allowed
- price min
- price max
- customer-facing unit such as `€/m`
- disclaimer
- `rule.requirementKey`
- `rule.unit`
- `rule.currency`
- `rule.requires`

`per_unit` fields:

- `rule.pricePerUnit`
- modifiers:
  - condition requirement key
  - `gte` threshold
  - `pricePerUnitDelta`

Generated modifier shape:

```json
{
  "if": { "requirementKey": "fence_height", "gte": 1.7 },
  "pricePerUnitDelta": 6
}
```

Validation:

- All referenced requirement keys must exist on the selected service.
- `pricePerUnit` is required and positive for `per_unit`.
- `range_estimate` does not require `pricePerUnit`.
- `requires` always includes `rule.requirementKey`.
- Modifier threshold and delta must be finite numbers.
- The page shows a read-only JSON preview of the generated `rule`.
- The builder must not introduce fields ignored by the current pricing engine.

Unsupported existing rules:

- Existing unsupported JSON rules should be displayed read-only with an
  "unsupported structure" label and raw JSON preview.
- Unsupported existing rules may be replaced only through the supported builder
  shape.
- Unsupported JSON must not crash the page.

### MVP 1 Test Flow Shortcut

Where it is already easy to link into the dashboard test page, add a "Test this
configuration" shortcut near each service / pricing configuration.

If service preselection or query-param support would require larger test page
refactoring, keep this as an optional enhancement and do not treat it as an MVP
1 blocker.

## MVP 2 - Operational Config

MVP 2 is planned, but it is explicitly out of scope for the first
implementation pass.

MVP 2 includes:

- Location zones
- Schedule rules
- Autosend policy
- Response templates
- operational rule parsers
- autosend safety defaults
- template warning logic
- operational config tests

### MVP 2 Location Zones

Manage tenant-level `LocationZone` records for the current client's tenant:

- list/create/edit/delete
- fields: admin unit code, zone, travel fee EUR, served
- validation: admin unit code required; unique per tenant

### MVP 2 Schedule Rules

Manage tenant-level `ScheduleRule` records for the current client's tenant:

- support one or more `lead_time_weeks` rules
- fields: min weeks, max weeks
- validation: min and max are positive numbers and min <= max
- unsupported schedule JSON is displayed read-only without crashing the page

### MVP 2 Autosend Policy

Manage the first tenant autosend policy, creating one if missing.

Structured fields for the current policy shape:

- enabled
- require all required resolved
- allow deterministic source
- allow form field source
- AI evidence verified required
- AI min confidence
- AI validation passed required
- block if conflicts
- block if range
- auto-send confidence
- draft-for-review confidence
- AI-classified service allowed for auto-send

Safety rules:

- When creating a missing autosend policy, default `enabled` must be `false`.
- If existing autosend policy JSON is malformed or unsupported, UI must not
  crash and autosend should be treated as unsafe / disabled from the admin
  perspective.
- The UI should clearly warn that aggressive autosend settings may cause real
  responses to be sent without manual review.

### MVP 2 Response Templates

Manage tenant-level `ResponseTemplate` rows:

- list/create/edit/delete or deactivate
- fields: template key, body, active
- show allowed placeholders for known template keys:
  - `{{questions}}`
  - `{{priceAmount}}`
  - `{{currency}}`
  - `{{leadTimeWeeks}}`
  - `{{offeringDescription}}`
  - `{{offeringFollowup}}`

Validation:

- template key is slug-like and unique per tenant.
- body is required.
- deactivation is preferred over hard delete because `ResponseTemplate` has an
  `active` field.
- deleting or deactivating a template used by a current decision type is allowed
  only with a clear warning that response generation can fail with a config
  error.

## Architecture

Add a new `lib/dashboard/super-admin.ts` module containing MVP 1 helpers:

- read helpers for Super Admin core decision config
- form parsers
- validation helpers
- create/update/delete/deactivate functions
- supported JSON shape builders
- unsupported JSON detection helpers

Add `app/dashboard/super-admin` routes for MVP 1:

- index page with status summary, seed reset warning, and grouped sections
- edit/create pages where forms would become too large for the index
- server actions in `app/dashboard/super-admin/actions.ts`

The implementation should reuse existing dashboard patterns:

- server components for page loading
- server actions for mutations
- redirects with `?updated=1`, `?deleted=1`, and `?error=...`
- `DashboardError`
- `DeleteButton`
- existing Tailwind card/form styling

MVP 2 can extend the same module or split operational helpers into
`lib/dashboard/super-admin-operational.ts` if the module becomes too large.

## Data Flow

1. Page loads the current client with `getCurrentClient()`.
2. MVP 1 reads only services, subjects, requirements, and pricing rules scoped
   to that client.
3. Forms submit to server actions.
4. Parsers normalize comma-separated lists and Lithuanian decimal commas.
5. Validators check references against service-scoped requirements and subjects.
6. Builders produce Prisma-safe JSON objects that match existing engine
   support.
7. Actions write to the database, revalidate dashboard paths, and redirect.
8. The existing dashboard test page can then be used to evaluate the updated
   configuration without restarting the app.

MVP 2 adds tenant-level reads and writes for the current client's tenant, still
without cross-client selection.

## Error Handling

All invalid user input returns a Lithuanian error message through redirect query
params, matching the current dashboard pattern.

Reference-breaking operations are blocked when they would leave active pricing
rules pointing at missing requirements or subjects.

Malformed or unsupported existing JSON should not crash the page. It should be
shown as "unsupported structure" with a read-only preview and a path to replace
it using the supported builder.

## Testing

### MVP 1 Tests

Add focused `node:test` coverage for:

- subject form parsing
- subject uniqueness
- subject delete/deactivate guards
- advanced requirement parsing
- `requirementKey` collision validation
- `requirementKey` reference guards in pricing rules
- pricing builder JSON generation
- pricing modifiers generation
- unsupported JSON detection
- dashboard navigation visibility for Super Admin

Run the existing full gates after implementation:

- `npm test`
- `npm run typecheck`
- `NEXT_DIST_DIR=.next-build npm run build`

### MVP 2 Tests

Add separate operational config coverage for:

- location zone parsers
- schedule rule parsers
- autosend policy parser and safe defaults
- response template validation and warnings

## Acceptance Criteria

### MVP 1 Acceptance Criteria

- Developer/tester can open `/dashboard/super-admin` in local dev.
- The page is hidden when Super Admin is disabled.
- Navigation item appears only when Super Admin is enabled.
- Super Admin edits only the current client resolved by `getCurrentClient()`;
  there is no cross-client or tenant selector.
- The index page shows the seed reset warning text:
  "Ši konfigūracija skirta testavimui. Paleidus `npm run db:seed`, dalis
  pakeitimų gali būti perrašyta."
- The index page shows a configuration status summary with at least services
  count, subjects count, active requirements count, active pricing rules count,
  and unsupported JSON structures count.
- Seed-created subjects, advanced requirements, and pricing rules are editable
  through structured forms.
- New subjects, requirements, and pricing rules can be created.
- Existing records can be deactivated or deleted only where safe.
- Reference-breaking operations are blocked.
- Pricing builder can represent the current seeded examples, including
  `fence_height >= 1.7 -> +6 €/m`.
- The builder does not introduce fields ignored by the current pricing engine.
- Generated pricing JSON preview is shown read-only.
- Unsupported existing JSON does not crash the page and is shown as unsupported
  with read-only preview.
- Updated configuration is immediately used by the existing dashboard test flow
  without restarting the app.
- Existing tests, typecheck, and isolated build pass:
  - `npm test`
  - `npm run typecheck`
  - `NEXT_DIST_DIR=.next-build npm run build`

### MVP 2 Acceptance Criteria

- Location zones can be managed through structured forms.
- Schedule lead time rules can be managed through structured forms.
- Autosend policy can be edited safely, with `enabled=false` as the default for
  newly created policy.
- Response templates can be managed with placeholder hints and warnings.
- Malformed operational JSON does not crash the page.
- Operational config parser tests pass.
