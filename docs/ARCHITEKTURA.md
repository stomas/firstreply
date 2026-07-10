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
| `lib/leads/llm-first-parse.ts`                              | Eksperimentinis `/dashboard/test` LLM-first parseris už `LLM_FIRST_PARSE=true`; schemą kuria iš `ClientRules`, faktus verifikuoja kode.         |
| `lib/requirements/fact-validation.ts`                       | Bendri `expectedFact` ir `validation` helperiai, naudojami resolver'io ir LLM-first post-validation.                                            |
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
| `lib/dashboard/super-admin*.ts`                             | Test/dev System Config sluoksnis: feature flag'as, core + operational read modeliai, builderių parseriai, JSON generavimas ir guard'ai.         |

## 4. Lead pipeline

`runTestLeadPipeline` (`lib/leads/test-pipeline.ts`) vykdo visus žingsnius ir
kiekvienam prideda `trace.stages` įrašą (matomas lead detail „Decision JSON“).
Pagal nutylėjimą naudojamas deterministinis parse kelias:

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

`LLM_FIRST_PARSE=true` įjungia eksperimentinį kelią tik `/dashboard/test`
srautui: `parse` stage kviečia LLM-first parserį, kuris schemą susikuria iš
aktyvių `ClientRules` (paslaugos, temos, requirements, validation,
location_zones). Priimti AI faktai konvertuojami į įprastus `ExtractedFact`
įrašus (`source: "ai"`, `evidenceVerified: true`), tada naudojamas tas pats
`resolveRequirements`, `decideLeadResponse` ir `composeResponseDraft`.
Šiame kelyje `ai_gap_filler` sąmoningai praleidžiamas: trūkstami ar atmesti
laukeliai tampa `ASK_MISSING_INFO` / `MANUAL_REVIEW`, o ne antru AI
gelbėjimo bandymu. Public landing lead forma šio flag'o nenaudoja.

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

**Termino tekstas šablone** (`composer.ts`): trumpa frazė („3-5 sav.",
„po 2 savaičių") įstatoma po šablono etikete (`Terminas: {{leadTimeWeeks}}.`),
o sakinio formos reikšmė (prasideda didžiąja raide, pvz. „Terminą reikia
tikslinti individualiai") pakeičia **visą** etiketės sakinį — kitaip gautųsi
robotiškas „Preliminarus terminas: Terminą reikia tikslinti...". Atsitiktinis
dvigubas taškas po reikšmės su tašku gale sulipdomas į vieną.

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

**Skuba** (`isUrgent`): kainos draft'as paruošiamas įprastai, bet pridedamas
`URGENT` autosend blokeris — siunčia žmogus, nes skuba gali reikšti kitą
kainodarą ar terminų derinimą.

**Žmogaus peržiūros signalai** (`ReviewSignal`, universalūs — ne domeno):

| Signalas                  | Kada                                                            | Poveikis                                                            |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `site_visit_requested`    | Klientas prašo atvykti įvertinti / apžiūrėti vietoje.            | `MANUAL_REVIEW / REVIEW_SIGNALS` — kaina be įvertinimo nepagrįsta.   |
| `unknown_site_conditions` | Esama/sena konstrukcija ar nežinoma būklė, galinti keisti apimtį. | `MANUAL_REVIEW / REVIEW_SIGNALS`.                                    |
| `competitor_price`        | Klientas lygina gautą/konkurento pasiūlymą.                      | Draft'as paruošiamas, bet blokeris `REVIEW_SIGNAL:competitor_price`. |

Signalų šaltiniai: LLM-first parse grąžina `reviewSignals` su pažodiniu
evidence (verifikuojamu per `verifyAiEvidence`; nepatvirtintas signalas →
`rejectedFindings`), plius deterministinis saugiklis
(`extractReviewSignals` — tik universalios frazės: „gavau pasiūlymą",
„pasiūlyti pigiau/geriau", „įvertinti vietoje"). Abu keliai OR'inami,
vienam tipui — vienas signalas. Signalai matomi parse trace stage'e ir
persistuojasi `parse_result` JSON'e.

## 6. AI integracija — keturi kvietimai, viena taisyklė

Visi AI kvietimai eina per `lib/ai/openai-client.ts` (`temperature: 0`, JSON
atsakymas, 1 retry po parse klaidos). **Kertinis invariantas: AI niekada
tiesiogiai nerašo sprendimo — kiekvienas AI radinys verifikuojamas kodu.**

### 6.0 LLM-first parse (eksperimentinis dashboard test kelias)

`LLM_FIRST_PARSE=true` veikia tik `runTestLeadPipeline` / `/dashboard/test`.
LLM gauna iš DB užkrautą aktyvių paslaugų, `ServiceSubject`,
`DecisionRequirement.expectedFact`, `DecisionRequirement.validation` ir
`LocationZone` santrauką. Jis gali grąžinti tik JSON su `serviceId`, intentais,
lokacijos tekstu ir faktais; nežinomos reikšmės turi būti `null`.

Intentai (`asksPrice` / `asksAvailability` / `isUrgent`) OR'inami iš trijų
šaltinių: formos laukų, LLM atsakymo ir deterministinės raktažodžių
atpažinties (`extractIntents` iš `lib/extractor/deterministic.ts`) — LLM gali
praleisti intentą (pvz. „ar galėtumėte ... dar šį mėnesį“, „labai svarbu
terminas“), o raktažodžiai yra patikimas saugiklis.

Post-validation taisyklės:

- `serviceId` turi būti aktyvi paslauga arba formos pasirinkta paslauga;
- kiekvienas `requirementKey` turi priklausyti pasirinktai paslaugai;
- `subject`, `kind`, `dimension` ir `unit` turi sutapti su DB
  `expectedFact`;
- kiekvienas AI faktas turi pažodinį `evidence`, tikrinamą per
  `verifyAiEvidence`;
- `allowedValues` turi pirmenybę prieš `min/max`; ribas tikrina tas pats
  resolver'is, todėl out-of-range faktai tampa `VALUE_OUT_OF_RANGE` konfliktais;
- lokacija visada resolver'inama per `resolveLocationText`; modelio
  `adminUnitCode` nelaikomas autoritetingu;
- kainos, terminai, availability, auto-send ir atsakymo tekstas iš LLM
  ignoruojami.

Neteikiamos konkrečios rūšies atpažinimas: kai LLM parinktos paslaugos
evidence nėra pakankamai specifinis (arba LLM iš viso negrąžina paslaugos),
`findUnsupportedOfferingEvidence` tikrina **visą užklausos tekstą** (ne tik
LLM evidence iškarpą, nes ji gali būti vien bendrinis žodis, pvz. „tvoros“).
Jei tekste įvardinta konkreti pasiūlos rūšis (pvz. „metalinę horizontalią“),
kurios nepadengia nė vienos aktyvios paslaugos terminai, klasifikacija tampa
`unsupported_specific_service` → decision engine grąžina `MANUAL_REVIEW /
SERVICE_UNSUPPORTED` su draft'u „tokios paslaugos neteikiame“ vietoj
patikslinančio klausimo. Jei rūšies terminas atitinka bent vieną aktyvią
paslaugą — lieka `ambiguous` (sprendžia klasifikacija / patikslinimas).

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

### 6.4 Offering pasiūlymas (konfigūravimo metu, ne pipeline)

`lib/ai/offering-suggestion.ts` + `POST
/api/dashboard/services/offering-suggestion` — „Sugeneruoti su AI“ mygtukas
paslaugos redagavimo formoje. AI iš paslaugos duomenų (pavadinimas, temos,
raktažodžiai, kainodaros vienetai, klausimų label'iai) parašo offering
atsakymą pasirinktu tonu (dalykiškas/draugiškas) ir tik užpildo formos
laukus. **Invariantas nekinta**: klientams tekstas išeina tik savininkui
peržiūrėjus ir išsaugojus; runtime atsakymai lieka deterministiniai iš DB.
Promptas draudžia išgalvoti kainas/terminus/garantijas, kurių nėra
duomenyse. AI nesukonfigūruotas → aiški klaida formoje, laukai lieka
redaguojami ranka.

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

| Puslapis                                                 | Kas jame                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                             | Užklausų sąrašas.                                                                                                                                                                                                                                                                                                                                                   |
| `/dashboard/leads/[id]`                                  | Lead detail: parse result, decision JSON, taisyklės, atsakymai.                                                                                                                                                                                                                                                                                                     |
| `/dashboard/test`                                        | Testavimo įrankis — pilnas pipeline be siuntimo.                                                                                                                                                                                                                                                                                                                    |
| `/dashboard/services` (+`/[id]`)                         | Paslaugų parengtis ir redagavimas (pavadinimai, raktažodžiai, temos, pasiūlos aprašymas).                                                                                                                                                                                                                                                                           |
| `/dashboard/rules` (+pricing/requirements `[id]`, `new`) | Kainodara ir klausimai: peržiūra, redagavimas, kūrimas, trynimas (su patvirtinimu; klausimo, kurį naudoja aktyvi kainodara — `requirementKey`/`requires`/`modifiers` — ištrinti neleidžiama). Įprastame rules UI struktūriniai engine laukai (`rule` JSON raktai, `expectedFact`) nekaitaliojami ranka — kūrimo formos generuoja struktūrą kode iš select reikšmių. |
| `/dashboard/availability` (+`[id]`, `new`)               | Užimtumo įrašai: peržiūra, redagavimas, kūrimas, trynimas. Laikinas paslėpimas — per `valid_until` (schema neturi `active`).                                                                                                                                                                                                                                        |
| `/dashboard/super-admin`                                 | Super Admin / System Config: techninis dabartinio kliento core decision config ir tenant-level operational config redagavimas. Matomas lokaliai/dev arba produkcijoje tik su `SUPER_ADMIN_ENABLED=true`.                                                                                                                                                            |

### 8.1 Super Admin / System Config

Super Admin yra testavimo ir vidinio konfigūravimo įrankis, ne galutinio
kliento admin produktas. Route'as ir navigacijos punktas įjungti, kai
`NODE_ENV !== "production"` arba `SUPER_ADMIN_ENABLED=true`; produkcijoje be
flag'o route'as grąžina `notFound()`.

Puslapis dirba tik su dabartiniu klientu iš `getCurrentClient()` ir jo
`tenantId` — nėra cross-client ar cross-tenant selektoriaus. Core read modelis
(`getSuperAdminConfig`) sugrupuoja `Service`, `ServiceSubject`,
`DecisionRequirement` ir `PricingRule` pagal paslaugas; UI paslaugų blokus rodo
suskleistus per `SuperAdminServiceDetails`, kad būtų matomas bendras config
vaizdas. Operational read modelis (`getSuperAdminOperationalConfig`) rodo
tenant-level `LocationZone`, `ScheduleRule`, pirmą `AutosendPolicy` ir
`ResponseTemplate` įrašus atskirame suskleidžiamame bloke.

Core decision config leidžia:

- kurti, redaguoti ir trinti `ServiceSubject` temas (`subjectKey`, label,
  aprašymas, sinonimai);
- redaguoti advanced `DecisionRequirement` laukus:
  `requirementKey`, `expectedFact` (`measurement` + subject/dimension/units),
  `validation` (`min`/`max`), `required`, `affectsPrice`, `active`, `priority`;
- kurti ir redaguoti pricing builderį dabartinio engine palaikomoms
  `pricing_rules.rule` formoms: `per_unit` ir `range_estimate`, įskaitant
  `requirementKey`, `requires` ir `gte` modifierius.

Operational config leidžia:

- kurti, redaguoti ir trinti `LocationZone` įrašus (`adminUnitCode`, `zone`,
  `travelFeeEur`, `served`);
- kurti, redaguoti ir trinti palaikomus `ScheduleRule.rule` JSON įrašus:
  `{ type: "lead_time_weeks", min, max }`;
- kurti arba redaguoti pirmą tenant `AutosendPolicy.policy` per saugų builderį
  su `enabled=false` default'u, kai policy trūksta;
- kurti, redaguoti ir deaktyvuoti `ResponseTemplate` įrašus, su placeholder
  užuominomis žinomiems template key.

Reference guard'ai saugo runtime konfigūraciją: temos trynimas blokuojamas, jei
ją naudoja aktyvus requirement; requirement key/service/active pakeitimai
blokuojami, jei aktyvi kainodara remiasi tuo key; aktyvios kainodaros
reference'ai turi rodyti į aktyvius tos pačios paslaugos requirements.
Nepalaikomas core ar operational JSON rodomas kaip read-only preview ir gali
būti pakeistas tik išsaugant palaikomą builder shape. Jei klientas neturi
`tenantId`, operational config rodomas kaip neredaguojamas.

## 9. Žinomos ribos (svarbu testuojant)

1. **`range_estimate` kainodara neskaičiuoja sumos** — tokie lead'ai eina į
   manual review su kainos rėžiais.
2. **Rėžinis atsakymas į kainą veikiantį klausimą** (pvz. aukštis „1.5–1.7“)
   → `per_unit` skaičiavimas reikalauja skaliaro → `NO_PRICING_RULE` /
   manual review. Tai sąmoninga saugi elgsena.
3. **Auth nėra** — vienas klientas per env kintamąjį.
4. **Realaus siuntimo nėra** — `autoSendAllowed` tik žymi, kad politika
   leistų; siuntimo integracija dar nepadaryta.
5. **Super Admin yra techninis įrankis** — seed'as gali perrašyti DEV kliento
   core ir operational konfigūraciją, todėl po `npm run db:seed` patikrinkite
   `/dashboard/test`.

## 10. Testai ir kokybės vartai

```bash
npm test            # node:test, visi tests/*.test.ts (šiuo metu 213)
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
```

Testų žemėlapis: deterministinis extractor'ius + 100 atvejų korpusas
(`random-inquiries`), evidence/computation verifier'iai, gap filler, service
classifier (+AI fallback), decision engine, golden pipeline (end-to-end su
mock AI), derived facts, shadow parse, dashboard formų parseriai.
`tests/realistic-cases.test.ts` — 12 realistiškų klientų užklausų scenarijų
end-to-end (aiški / neaiški / dalinė / skubi / konkurento kaina / premium /
apžiūra vietoje / nežinomas kiekis / struktūruota / nežinoma būklė / dalinė
paslauga / trumpa social žinutė): kiekvienam matosi atpažinti faktai,
trūkstama informacija, sprendimas, klausimai, blokeriai ir draft'as.

Konvencija: kiekvienas pakeitimas turi praeiti visus keturis vartus prieš
commit. AI kvietimai testuose visada mock'inami per `aiOptions.callModel`.
