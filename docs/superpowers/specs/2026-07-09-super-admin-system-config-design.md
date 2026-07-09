# Super Admin System Config Design

## Context

The dashboard already lets a regular client configure the safer business-facing
parts of the system: services, basic pricing fields, customer questions, and
availability. Some important system behavior is still seeded in
`prisma/seed.ts` and can only be changed by editing data or code directly:

- `service_subjects` for subject recognition such as fence, gate, and wicket.
- `decision_requirements.expected_fact` and validation details.
- `pricing_rules.rule`, including `requirementKey`, `requires`, and modifiers.
- Tenant-level operational rules: `location_zones`, `schedule_rules`,
  `autosend_policies`, and `response_templates`.

The user wants a test/admin panel for changing these initially generated values,
adding new ones, and deleting existing ones in order to evaluate how well the
system works with different configurations.

## Goal

Add a Super Admin / System Config dashboard area for editing the technical
configuration that regular clients should not manage directly.

The first version should be structured and validated, not a raw JSON editor. It
should make the current rule shapes editable without allowing malformed JSON
that the decision engine or response composer cannot understand.

## Non-Goals

- No multi-tenant user authentication or permissions overhaul.
- No database schema migration unless implementation discovers an unavoidable
  missing field. The required tables and JSON columns already exist.
- No generic JSON schema editor.
- No support for arbitrary pricing formulas beyond what the engine currently
  evaluates.
- No automatic migration of seed data. Running `npm run db:seed` remains a
  reset-to-default operation and may overwrite test values.

## Access Model

Create a new dashboard route:

`/dashboard/super-admin`

The page is available only when one of these is true:

- `NODE_ENV !== "production"`
- `SUPER_ADMIN_ENABLED=true`

If disabled, the route should return `notFound()`.

Navigation should add a live `Super Admin` item under configuration only when
the feature is enabled, so production users do not see hidden tools.

## MVP Scope

### 1. Subjects

Manage `ServiceSubject` rows scoped to the current client through service
ownership:

- list grouped by service
- create subject
- edit subject
- delete subject

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

### 2. Requirements Advanced

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

Supported `expectedFact` shape in MVP:

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

### 3. Pricing Builder

Manage the full supported `pricing_rules.rule` structure using form fields and
repeatable modifier rows.

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

### 4. Operational Rules

Manage tenant-level records for the current client's tenant.

Location zones:

- list/create/edit/delete `LocationZone`
- fields: admin unit code, zone, travel fee EUR, served
- validation: admin unit code required; unique per tenant

Schedule rules:

- MVP supports one or more `lead_time_weeks` rules
- fields: min weeks, max weeks
- validation: min and max are positive numbers and min <= max

Autosend policy:

- edit the first tenant autosend policy, creating one if missing
- structured fields for the current policy shape:
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

Response templates:

- list/create/edit/delete `ResponseTemplate`
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
- deleting or deactivating a template used by a current decision type is allowed
  but the UI must warn that response generation can fail with a config error.

## Architecture

Add a new `lib/dashboard/super-admin.ts` module containing:

- read helpers for all Super Admin sections
- form parsers
- validation helpers
- create/update/delete functions
- shape builders for supported JSON fields

Add `app/dashboard/super-admin` routes:

- index page with grouped sections and links
- edit/create pages where forms would become too large for the index
- server actions in `app/dashboard/super-admin/actions.ts`

The implementation should reuse existing dashboard patterns:

- server components for page loading
- server actions for mutations
- redirects with `?updated=1`, `?deleted=1`, and `?error=...`
- `DashboardError`
- `DeleteButton`
- existing Tailwind card/form styling

## Data Flow

1. Page loads the current client with `getCurrentClient()`.
2. Helper resolves the client tenant when tenant-level tables are needed.
3. Forms submit to server actions.
4. Parsers normalize comma-separated lists and Lithuanian decimal commas.
5. Validators check references against service-scoped requirements and subjects.
6. Builders produce Prisma-safe JSON objects.
7. Actions write to the database, revalidate dashboard paths, and redirect.
8. The existing test page can then be used to evaluate the new configuration.

## Error Handling

All invalid user input returns a Lithuanian error message through redirect query
params, matching the current dashboard pattern.

Reference-breaking operations are blocked when they would leave active pricing
rules pointing at missing requirements or subjects.

Malformed existing JSON should not crash the page. It should be shown as
"unsupported structure" with a read-only preview and a path to replace it using
the supported builder.

## Testing

Add focused `node:test` coverage for:

- subject form parsing and delete guards
- advanced requirement parsing and requirement key reference guards
- pricing builder JSON generation, including modifiers
- operational rule parsers for schedule, autosend policy, location zones, and
  response templates
- dashboard navigation visibility for Super Admin

Run the existing full gates after implementation:

- `npm test`
- `npm run typecheck`
- `NEXT_DIST_DIR=.next-build npm run build`

## Acceptance Criteria

- A developer/tester can open `/dashboard/super-admin` in local dev.
- The page is hidden when Super Admin is disabled.
- Seed-created subjects, advanced requirements, pricing JSON, location zones,
  schedule rules, autosend policy, and response templates are editable through
  structured forms.
- New records can be created and existing records can be deleted where safe.
- Pricing builder can represent the current seeded examples, including
  `fence_height >= 1.7 -> +6 €/m`.
- The generated configuration is immediately used by the existing dashboard test
  flow without restarting the app.
- Existing tests, typecheck, and isolated build pass.
