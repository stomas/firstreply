# FirstReply — techninė dokumentacija

Esamos sistemos būsenos aprašymas (2026-07). Auditorija — programuotojai,
dirbantys su šiuo repo.

Susiję dokumentai: [Naudotojo gidas](./NAUDOTOJO-GIDAS.md) ·
[Diegimas į Railway](./DEPLOY-RAILWAY.md) · [README](../README.md)

---

## 1. Kas tai per sistema

FirstReply — lietuviškas mikro-SaaS smulkiam paslaugų verslui (tvoros, vartai,
terasos): iš rašytinės kliento užklausos automatiškai parengia pirmą atsakymą
su orientacine kaina, trūkstamais klausimais ir terminu. Galutinis sprendimas
visada lieka savininkui — sistema arba paruošia juodraštį peržiūrai, arba
(kai politika leidžia) pažymi, kad atsakymą galima siųsti automatiškai.

Repo sudaro:

- **Landing puslapis** (`app/page.tsx` ir kt. vieši puslapiai) su demo lead
  forma (`app/api/leads`).
- **Dashboard** (`app/dashboard/*`) — kliento valdymo aplinka: užklausos,
  testavimo įrankis, paslaugų / taisyklių / užimtumo konfigūracija.
- **Lead pipeline** (`lib/*`) — deterministinis parseris + AI pagalbininkai +
  sprendimų variklis + atsakymo kompozitorius.

Auth, mokėjimų ir realių integracijų (Gmail, CRM) **nėra** — kliento kontekstas
imamas iš `FIRSTREPLY_DEFAULT_CLIENT_ID` env kintamojo
(`lib/client-context.ts`).

## 2. Tech stack

| Sritis     | Pasirinkimas                            |
| ---------- | --------------------------------------- |
| Framework  | Next.js 15 (App Router, server actions) |
| Kalba      | TypeScript (strict)                     |
| DB         | PostgreSQL + Prisma                     |
| Stiliai    | Tailwind CSS v3                         |
| Validacija | Zod                                     |
| AI         | OpenAI Responses API (`temperature: 0`) |
| Testai     | `node:test` per `tsx` (`npm test`)      |

## 3. Katalogų žemėlapis (lib)

| Modulis                                                     | Paskirtis                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/extractor/deterministic.ts`                            | Deterministinis faktų ištraukimas iš teksto (matavimai, kiekiai, miestas, intentai). Tik atominiai faktai — jokios aritmetikos.                 |
| `lib/extractor/types.ts`                                    | `ExtractedFact`, `PrimaryIntent`, `FactComputation` tipai.                                                                                      |
| `lib/leads/service-classifier.ts`                           | Paslaugos atpažinimas: keyword scoring (deterministinis) + AI fallback (`classifyLeadServiceWithFallback`).                                     |
| `lib/leads/parse-lead.ts`                                   | Lead parse orkestracija: faktai → klasifikacija → requirements.                                                                                 |
| `lib/requirements/resolve-requirements.ts`                  | Faktų priskyrimas requirement'ams pagal `expectedFact` (kind/subject/dimension/units) + `validation` ribos.                                     |
| `lib/ai/openai-client.ts`                                   | Bendras OpenAI wrapper: `callOpenAiResponsesApi`, `isAiConfigured`, `stripJsonFence`, `normalizeRangeFactValue`. Visi AI kvietimai eina per jį. |
| `lib/ai/gap-filler.ts`                                      | AI spragų pildymas: subject bindings + nauji/derived faktai su computation.                                                                     |
| `lib/ai/shadow-parse.ts`                                    | Shadow pilnas AI parse (tik matavimui, `SHADOW_AI_PARSE` flag).                                                                                 |
| `lib/verifier/evidence.ts`                                  | AI evidence patikra — cituojamas fragmentas privalo būti originale.                                                                             |
| `lib/verifier/computation.ts`                               | Derived faktų aritmetikos perskaičiavimas kode (multiply/add, unit suderinamumas).                                                              |
| `lib/decision/engine.ts`                                    | Deterministinis sprendimų variklis (žr. §5).                                                                                                    |
| `lib/response/composer.ts`                                  | Atsakymo juodraštis iš DB šablonų (`response_templates`).                                                                                       |
| `lib/leads/test-pipeline.ts`                                | Visas pipeline vienoje funkcijoje + `trace` (stage'ai debug'ui).                                                                                |
| `lib/leads/create-test-lead.ts`                             | Testavimo įrankio lead'o sukūrimas + persistencija.                                                                                             |
| `lib/rules/get-client-rules.ts`                             | Visų kliento taisyklių užkrovimas iš DB į `ClientRules`.                                                                                        |
| `lib/dashboard/{services,rules,availability,navigation}.ts` | Dashboard duomenų sluoksniai: užklausos, formų parsinimas (gryni, testuojami), atnaujinimai/kūrimas.                                            |

## 4. Lead pipeline

`runTestLeadPipeline` (`lib/leads/test-pipeline.ts`) vykdo visus žingsnius ir
kiekvienam prideda `trace.stages` įrašą (matomas lead detail „Decision JSON“):

```
parse                      deterministiniai faktai, intentai, miestas
service_classification     keyword scoring (form_field > matched_terms > ambiguous/no_match)
ai_service_classification  TIK kai deterministika nepataikė (žr. §6.2)
resolver_pass_1            faktai → requirements
ai_gap_filler              TIK kai yra neišspręstų requirements (žr. §6.1)
resolver_pass_2            po AI — pakartotinis priskyrimas
decision                   sprendimų variklis (žr. §5)
composer                   juodraštis iš šablonų + autosend vartai
shadow_parse               TIK kai SHADOW_AI_PARSE=true (žr. §6.3)
```

Testiniai lead'ai (`isTest: true`) eina **identišką** pipeline, tik visada
blokuojami nuo auto-send (`TEST_LEAD` blokeris).

## 5. Sprendimų variklis

`decideLeadResponse` (`lib/decision/engine.ts`) — grynai deterministinis.
Sprendimai (`DecisionResultDecision`):

| Sprendimas         | Kada                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `OFFERING_ANSWER`  | `primaryIntent === "asks_offering"` ir paslauga atpažinta — atsakoma DB aprašymu (`services.offering_description/followup`). |
| `PRICE_ESTIMATE`   | Visi būtini requirements išspręsti ir suveikė `per_unit` kainodaros taisyklė.                                                |
| `ASK_MISSING_INFO` | Trūksta būtinų atsakymų — klausimai iš `decision_requirements.question_text_if_missing`.                                     |
| `DECLINE_TEMPLATE` | Neaptarnaujama lokacija (pagal `location_zones`).                                                                            |
| `MANUAL_REVIEW`    | Visa kita: `SERVICE_AMBIGUOUS`, `NO_PRICING_RULE`, `AVAILABILITY_UNAVAILABLE`, `OFFERING_NOT_CONFIGURED` ir kt.              |

Kainos skaičiavimas: tik `rule.type === "per_unit"` —
`kiekis × (pricePerUnit + modifiers)`. `range_estimate` taisyklės kainos
neskaičiuoja (→ `NO_PRICING_RULE` / manual review su rėžiais).

**Užimtumo matchinimas** (`findAvailabilityMatch`): iš paslaugos
`availability_rules` atmetami pasibaigusio galiojimo įrašai
(`valid_until < input.now`), tikslus regiono atitikmuo (lead `location.raw`
arba formos `city`, normalizuota be diakritikų) turi pirmenybę prieš įrašą be
regiono („kitur“). Poveikis: `status: "unavailable"` → `MANUAL_REVIEW /
AVAILABILITY_UNAVAILABLE` (prieš klausimų uždavimą); matchintas
`earliestStartText` turi pirmenybę prieš `ScheduleRule` terminą
(`leadTime.text`; `minWeeks`/`maxWeeks` tada `null`); `status: "limited"` →
autosend blokeris `AVAILABILITY_LIMITED`; įrašo `autoSendAllowed: false` →
blokeris `AVAILABILITY_AUTOSEND_DISABLED`. Matchintas įrašas grąžinamas per
`DecisionResult.matchedAvailabilityRule` (matomas evaluation/trace). Be
match'o — elgsena kaip anksčiau (terminas iš `ScheduleRule`).

`rule` JSON pavyzdys (žr. `prisma/seed.ts`):

```json
{
  "type": "per_unit",
  "requirementKey": "fence_length",
  "unit": "m",
  "pricePerUnit": 38,
  "currency": "EUR",
  "requires": ["fence_length", "fence_height"],
  "modifiers": [
    {
      "if": { "requirementKey": "fence_height", "gte": 1.7 },
      "pricePerUnitDelta": 6
    }
  ]
}
```

**Autosend vartai** (`autosend_policies.policy` JSON): visų būtinų requirements
išsprendimas, kainą veikiančių requirements šaltinių sąrašas
(`allowSources` + `aiAllowedIf` su min confidence/evidence/validation),
confidence juostos, `SERVICE_AI_CLASSIFIED` blokeris (AI klasifikuota paslauga
→ default draft_for_review, atrakinama per
`policy.serviceClassification.aiAllowedForAutoSend: true`).

## 6. AI integracija — trys kvietimai, viena taisyklė

Visi AI kvietimai eina per `lib/ai/openai-client.ts` (`temperature: 0`, JSON
atsakymas, 1 retry po parse klaidos). **Kertinis invariantas: AI niekada
tiesiogiai nerašo sprendimo — kiekvienas AI radinys verifikuojamas kodu.**

### 6.1 Gap filler (privalomas, kai yra spragų)

Kai po pirmo resolver'io lieka neišspręstų requirements. AI grąžina:

- `bindings` — subject priskyrimas esamiems faktams (evidence tikrinama);
- `newFacts` — nauji faktai; **derived** faktai (pvz. „2 segmentai po 2m“ →
  4 m) privalo turėti `computation: {op, inputs}` — aritmetiką perskaičiuoja
  `lib/verifier/computation.ts`, o evidence tikrinama input span'ams;
- rėžinės reikšmės (`value: {min,max}`) normalizuojamos į
  `valueMin`/`valueMax` (`normalizeRangeFactValue`);
- `primaryIntent` klasifikacija.

AI nesukonfigūruotas → `AppConfigError` `AI_NOT_CONFIGURED` (lead'as gauna
manual review su aiškia žinute). Parse fail po retry → `MANUAL_REVIEW /
AI_PARSE_FAILED`.

### 6.2 Service classification fallback (optional)

Kviečiamas TIK kai deterministinis scoring grąžina `no_match` arba silpną
match'ą. **Tikros lygiosios** (≥2 stiprūs artimi kandidatai, pvz. dvi tvorų
rūšys, o tekste tik „tvora“) AI **nelaužo** — lieka `SERVICE_AMBIGUOUS`.
Priėmimo sąlygos: serviceId iš aktyvių sąrašo, `confidence ≥ 0.8`, evidence
randama tekste. Rezultatas žymimas `source: "ai"` ir pagal nutylėjimą blokuoja
auto-send. AI nesukonfigūruotas → jokios klaidos, lieka ambiguous.

### 6.3 Shadow parse (tik matavimui)

`SHADOW_AI_PARSE=true` → po pagrindinio pipeline paleidžiamas pilnas AI parse.
Rezultatas **niekur nenaudojamas sprendimams** — saugomas
`leads.shadow_parse_result` / `shadow_diff` (match / value_diff / ai_only /
ai_missing per requirement key). Ataskaita: `npm run db:shadow-report`.
Bet kokia shadow klaida ignoruojama — pagrindinis pipeline nenukenčia.

## 7. DB modeliai (prisma/schema.prisma)

| Modelis                 | Paskirtis                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Client`                | Klientas (verslas). Kontekstas per `FIRSTREPLY_DEFAULT_CLIENT_ID`.                                                       |
| `Service`               | Paslauga: `keywords` (JSON), `offering_description/followup` (pasiūlos atsakymams).                                      |
| `ServiceSubject`        | Atpažinimo temos (subject key, label, sinonimai) — naudoja resolver'is ir klasifikatorius.                               |
| `PricingRule`           | Kainodara: rėžiai rodymui + `rule` JSON skaičiavimui (§5).                                                               |
| `DecisionRequirement`   | Klausimas klientui: `requirement_key`, `expected_fact` JSON (kind/subject/dimension/units), `validation` {min,max}.      |
| `AvailabilityRule`      | Užimtumas pagal regioną: status, terminas, galiojimas. Naudojamas sprendimų variklyje terminui ir autosend vartams (§5). |
| `LocationZone`          | Aptarnaujamos savivaldybės (decline logika).                                                                             |
| `ScheduleRule`          | `lead_time_weeks` — terminas atsakymuose.                                                                                |
| `AutosendPolicy`        | Auto-send politikos JSON (§5).                                                                                           |
| `ResponseTemplate`      | Atsakymų šablonai: `price_estimate`, `ask_missing_info`, `decline_location`, `offering_answer` (su `{{placeholder}}`).   |
| `Lead` / `LeadResponse` | Užklausa + atsakymo įrašas (`decisionJson` su pilnu trace).                                                              |

Migracijos — `prisma/migrations` (deploy: `npm run db:migrate`), seed —
`prisma/seed.ts` (idempotentiškas upsert, DEV klientas su 3 paslaugomis).

## 8. Dashboard

Visi puslapiai — server komponentai su server actions; klaidos grąžinamos per
`?error=`, sėkmė per `?updated=1`. Duomenų sluoksniai `lib/dashboard/*` laiko
grynas (testuojamas) formų parsinimo funkcijas atskirai nuo Prisma užklausų.

| Puslapis                                                 | Kas jame                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                                             | Užklausų sąrašas.                                                                                                                                                                                                                                                                                                                                |
| `/dashboard/leads/[id]`                                  | Lead detail: parse result, decision JSON, taisyklės, atsakymai.                                                                                                                                                                                                                                                                                  |
| `/dashboard/test`                                        | Testavimo įrankis — pilnas pipeline be siuntimo.                                                                                                                                                                                                                                                                                                 |
| `/dashboard/services` (+`/[id]`)                         | Paslaugų parengtis ir redagavimas (pavadinimai, raktažodžiai, temos, pasiūlos aprašymas).                                                                                                                                                                                                                                                        |
| `/dashboard/rules` (+pricing/requirements `[id]`, `new`) | Kainodara ir klausimai: peržiūra, redagavimas, kūrimas, trynimas (su patvirtinimu; klausimo, kurį naudoja aktyvi kainodara — `requirementKey`/`requires`/`modifiers` — ištrinti neleidžiama). **Struktūriniai engine laukai (`rule` JSON raktai, `expectedFact`) iš UI nekeičiami** — kūrimo formos generuoja struktūrą kode iš select reikšmių. |
| `/dashboard/availability` (+`[id]`, `new`)               | Užimtumo įrašai: peržiūra, redagavimas, kūrimas, trynimas. Laikinas paslėpimas — per `valid_until` (schema neturi `active`).                                                                                                                                                                                                                     |

## 9. Žinomos ribos (svarbu testuojant)

1. **`range_estimate` kainodara neskaičiuoja sumos** — tokie lead'ai eina į
   manual review su kainos rėžiais.
2. **Rėžinis atsakymas į kainą veikiantį klausimą** (pvz. aukštis „1.5–1.7“)
   → `per_unit` skaičiavimas reikalauja skaliaro → `NO_PRICING_RULE` /
   manual review. Tai sąmoninga saugi elgsena.
3. **Auth nėra** — vienas klientas per env kintamąjį.
4. **Realaus siuntimo nėra** — `autoSendAllowed` tik žymi, kad politika
   leistų; siuntimo integracija dar nepadaryta.

## 10. Testai ir kokybės vartai

```bash
npm test            # node:test, visi tests/*.test.ts (šiuo metu 133)
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
```

Testų žemėlapis: deterministinis extractor'ius + 100 atvejų korpusas
(`random-inquiries`), evidence/computation verifier'iai, gap filler, service
classifier (+AI fallback), decision engine, golden pipeline (end-to-end su
mock AI), derived facts, shadow parse, dashboard formų parseriai.

Konvencija: kiekvienas pakeitimas turi praeiti visus keturis vartus prieš
commit. AI kvietimai testuose visada mock'inami per `aiOptions.callModel`.
