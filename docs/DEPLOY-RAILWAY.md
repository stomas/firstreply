# FirstReply — diegimas į Railway

Žingsnis po žingsnio gidas, kaip įdiegti FirstReply (Next.js + PostgreSQL) į
[Railway](https://railway.com). Skirtas žmogui, kuris diegia produktą — su
minimaliomis DevOps žiniomis.

Susiję dokumentai: [Techninė dokumentacija](./ARCHITEKTURA.md) ·
[Inbound integracijos](./INBOUND-INTEGRATION.md) ·
[Resend paleidimo checklist](./RESEND-ROLLOUT-CHECKLIST.md) ·
[Naudotojo gidas](./NAUDOTOJO-GIDAS.md)

---

## Ko reikės

- GitHub repo su šiuo kodu (Railway diegia iš GitHub).
- Railway paskyros.
- OpenAI API rakto (be jo veiks landing ir dashboard peržiūra, tačiau kiekvienas
  produkto lead'as bus paliktas `MANUAL_REVIEW / AI_NOT_CONFIGURED`, nes
  LLM-first parseris yra privalomas).
- Resend paskyros ir inbound receiving domeno, jei jungiama Paslaugos.lt.

Build konfigūracija jau yra [`railway.json`](../railway.json): dabartinis
Railway `RAILPACK` builderis, Node `20.x`, `NODE_ENV=production npm run build` →
`NODE_ENV=production npm run start`, healthcheck `/`.

## 1. Sukurkite projektą ir PostgreSQL

1. Railway → **New Project** → **Deploy from GitHub repo** → pasirinkite repo.
2. Tame pačiame projekte: **+ New** → **Database** → **PostgreSQL**.
3. Railway automatiškai sukurs `DATABASE_URL` kintamąjį Postgres servise.
   App servise jį pasieksite per reference (žr. žemiau).

## 2. Aplinkos kintamieji

App serviso **Variables** skiltyje nustatykite (pilnas sąrašas su komentarais —
[`.env.example`](../.env.example)):

| Kintamasis                      | Privalomas    | Reikšmė                                                                                                                                                                                 |
| ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Taip          | Reference į Postgres servisą: `${{Postgres.DATABASE_URL}}`                                                                                                                              |
| `SUPER_ADMIN_SIGNUP_CODE`       | Admin setup   | Bent 24 atsitiktinių simbolių kodas, reikalingas `/super-admin/signup`; po pradinės registracijos jį pakeiskite arba pašalinkite.                                                       |
| `NEXT_PUBLIC_SITE_URL`          | Taip          | Viešas URL be pasvirojo brūkšnio gale, pvz. `https://firstreply.lt` arba `https://<app>.up.railway.app`. Naudojamas SEO/sitemap — **pakeitus reikia redeploy** (build-time kintamasis). |
| `OPENAI_API_KEY`                | Lead pipeline | OpenAI raktas. Privalomas, nes kiekvienas testinis ir produkto inbound lead'as pradedamas LLM-first parse. Be jo lead'as paliekamas manual review.                                      |
| `OPENAI_MODEL`                  | Lead pipeline | Tikslus OpenAI Responses API modelio ID. Aplikacija default modelio neturi.                                                                                                             |
| `SHADOW_AI_PARSE`               | Ne            | `true` tik `/dashboard/test` prideda dar vieną measurement-only AI kvietimą; sprendimų nekeičia. Produkto inbound šį flag'ą priverstinai išjungia. Default/rekomendacija `false`.       |
| `LEAD_WEBHOOK_URL`              | Ne            | Kur persiunčiamos landing formos užklausos (Make/Zapier/Slack webhook). Tuščias — tik logas.                                                                                            |
| `INBOUND_SIGNING_MASTER_SECRET` | Inbound       | Bent 32 atsitiktinių baitų serverio secret, iš kurio išvedami atskirų web formų HMAC raktai.                                                                                            |
| `RESEND_API_KEY`                | El. paštas    | Resend API raktas pilnam gautam laiškui paimti, outbound domenui valdyti ir žmogaus patvirtintam laiškui siųsti.                                                                        |
| `RESEND_WEBHOOK_SECRET`         | El. paštas    | Resend webhook signing secret (`whsec_…`), skirtas inbound ir delivery raw payload patikrai.                                                                                            |
| `RESEND_INBOUND_DOMAIN`         | Paslaugos.lt  | Resend sukonfigūruotas receiving domenas be `@`, pvz. `in.firstreply.lt`.                                                                                                               |
| `EMAIL_SENDING_ENABLED`         | Outbound      | Globalus realaus siuntimo kill switch. Po deploy laikyti `false`, kol patvirtintas siuntėjo domenas ir suplanuotas smoke testas.                                                        |

`NODE_ENV` ir `PORT` Railway Variables skiltyje kurti nereikia. Repo Railway
build/start komandos aiškiai nustato `NODE_ENV=production`, o `PORT` perduoda
Railway. Jei `NODE_ENV` buvo sukurtas ranka (ypač su `prod`, `staging` ar kita
nestandartine reikšme), pašalinkite jį, kad Railway aplinka neklaidintų kitų
komandų. Node versija užfiksuota kaip `20.x` ir `package.json`, ir `.nvmrc`.

`LEAD_WEBHOOK_URL` skirtas tik viešai FirstReply landing kontaktų formai. Tai
nėra produkto inbound integracija. Produkto source'ai kuriami
`/dashboard/integrations` ir aprašyti
[inbound runbooke](./INBOUND-INTEGRATION.md).

### Parserio režimai

| Srautas                                       | Faktinis režimas                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/dashboard/test`                             | Visada LLM-first parse → kodo validacija → resolver → deterministinis decision/composer.    |
| Produkto inbound (`WEB_FORM`, `PASLAUGOS_LT`) | Tas pats privalomas LLM-first kelias; tik measurement-only shadow kvietimas kode išjungtas. |
| Landing `POST /api/leads`                     | Produkto pipeline nevykdomas; tik logas ir pasirenkamas `LEAD_WEBHOOK_URL`.                 |

`LLM_FIRST_PARSE` kintamasis panaikintas ir kode nebeskaitomas. Jei jis likęs
Railway Variables skiltyje, pašalinkite: net `false` nebeįjungia seno
deterministinio-first runtime kelio.

`INBOUND_SIGNING_MASTER_SECRET` sugeneravimo pavyzdys:

```bash
openssl rand -base64 48
```

## 3. Duomenų bazės migracijos

Migracijos **nepaleidžiamos automatiškai** — jas reikia paleisti per deploy.
Rekomenduojamas būdas — **Pre-deploy command** (paleidžiama prieš kiekvieną
naują versiją, su serviso kintamaisiais):

1. App servisas → **Settings** → **Deploy** → **Custom Pre-Deploy Command**:

   ```
   npm run db:migrate
   ```

2. Redeploy. Nuo šiol kiekvienas deploy pirmiausia pritaikys naujas
   migracijas (`prisma migrate deploy` yra idempotentiškas — jau pritaikytų
   nekartoja).

Alternatyva vienkartiniam paleidimui iš savo kompiuterio
(reikia [Railway CLI](https://docs.railway.app/guides/cli)):

```bash
railway link          # susiekite katalogą su projektu/servisu
railway run npm run db:migrate
```

## 4. Pradinis duomenų užpildymas (seed)

Seed sukuria pradinį klientą su taisyklėmis, kurį gali pasirinkti Super Admin.

```bash
railway run npm run db:seed
```

Seed yra **idempotentiškas** (upsert) ir sukuria DEV klientą (`id = "1"`,
„DEV Tvorų gamyba ir montavimas“) su 3 paslaugomis, kainodara, klausimais,
užimtumu, šablonais ir Lietuvos savivaldybių žemėlapiu. Jis automatiškai
nepriskiriamas paprastam vartotojui. Prisiregistruokite per
`/super-admin/signup`, dashboarde pasirinkite klientą `id=1` ir tada
konfigūruokite jį. Nauji realūs klientai registruojasi per `/signup`.

Jei testavote techninę konfigūraciją per `/dashboard/super-admin`, po seed'o
patikrinkite ją dar kartą: DEV kliento paslaugos, temos, requirements ir
kainodara, taip pat tenant location zones, schedule rules, autosend policy ir
response templates gali būti perrašyti pagal seed duomenis.

## 5. Resend inbound paruošimas

Šis žingsnis reikalingas tik Paslaugos.lt integracijai.

1. Resend pridėkite ir DNS įrašais patvirtinkite receiving subdomeną, pvz.
   `in.firstreply.lt`.
2. Tą patį domeną įrašykite į Railway `RESEND_INBOUND_DOMAIN`.
3. Resend naudokite vieną webhooką į
   `https://<jūsų-domenas>/api/integrations/resend` ir pasirinkite inbound bei
   outbound eventus pagal [paleidimo checklist](./RESEND-ROLLOUT-CHECKLIST.md).
4. Webhook signing secret įrašykite į `RESEND_WEBHOOK_SECRET`, API raktą — į
   `RESEND_API_KEY`, tada redeploy.

### Outbound domenas ir saugus įjungimas

1. Railway pirmiausia nustatykite `EMAIL_SENDING_ENABLED=false` ir pritaikykite
   migracijas.
2. Dashboard **Integracijos → Atsakymų siuntimas** sukurkite atskirą kliento
   subdomeną, DNS tiekėjui nukopijuokite parodytus Resend įrašus.
3. Spauskite **Tikrinti DNS**. Siuntėją galima naudoti tik kai providerio
   būsena `verified`, integracija aktyvi ir pasirinkta numatytąja.
4. Greitam API rakto, domeno ir `From`/`Reply-To` patikrinimui nustatykite
   `EMAIL_SENDING_ENABLED=true`, redeploy, tada Super Admin meniu atidarykite
   **El. pašto testas** ir išsiųskite vieną laišką tik į savo arba saugų testinį
   adresą. Šis greitas testas DB/timeline įrašo nekuria.
5. Pilnam E2E sukurkite saugų testinį Web formos leadą ir iš jo išsiųskite vieną
   žmogaus patvirtintą atsakymą. Patikrinkite Resend žurnalą, gavėjo dėžutę,
   vieną `OUTBOUND` timeline įrašą,
   vieną `OutboundDispatch` ir jo `Pristatytas` būseną.
6. Kilus abejonei iš karto grąžinkite kill switch į `false`.

## 6. Patikrinimas po diegimo

Eilės tvarka — kiekvienas žingsnis tikrina vis gilesnį sluoksnį:

1. **`/`** atsidaro (healthcheck jau tikrina šitą) — landing veikia.
2. **`/super-admin/signup`** sukuria administratorių su nustatytu registracijos
   kodu, o dashboarde galima pasirinkti klientą `id=1`.
3. **`/dashboard`** rodo pasirinkto kliento užklausų sąrašą — DB ir sesija veikia.
4. Dashboarde sukurkite Paslaugos.lt integraciją ir kliento pašte taisyklę,
   kuri persiunčia tik Paslaugos.lt laiškus ir išsaugo originalų `From`
   (`redirect` arba atitinkamas automatinio forward režimas). Visos dėžutės
   persiųsti negalima.
5. **`/dashboard/test`** pateikite testinę užklausą, pvz.
   „Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje.
   Kiek kainuotų?“ → turi grįžti parengtas atsakymas su kaina — veikia visas
   pipeline, įskaitant OpenAI.
6. **`/dashboard/integrations`** → sukurkite web formos integraciją; URL ir
   signing secret turi būti matomi. Išsiųskite pasirašytą smoke eventą pagal
   [runbooką](./INBOUND-INTEGRATION.md) ir patikrinkite vieną realų leadą.
7. Jei testas grąžina `AI_NOT_CONFIGURED` ar kitą AI konfigūracijos klaidą —
   patikrinkite `OPENAI_API_KEY` / `OPENAI_MODEL`.
8. Jei sukonfigūruotas Resend, išbandykite tikslų Paslaugos.lt forwarding
   filtrą ir dashboarde patikrinkite source, timeline bei paskutinį eventą.
   Eventas neturi būti `SOURCE_FORMAT_UNRECOGNIZED`; jei yra, patikrinkite, ar
   pašto provideris neperrašė originalaus Paslaugos.lt `From`.

Providerio credentialų nėra CI, todėl web formos ir Resend/Railway smoke
testai yra privalomas operatoriaus žingsnis po deploy.
Tikslūs migration, webhook switch, delivery/bounce/complaint/suppression ir
rollback veiksmai pateikti
[Resend paleidimo checkliste](./RESEND-ROLLOUT-CHECKLIST.md).

## 7. Domenas

**Settings → Networking → Generate Domain** (arba prijunkite savo domeną).
Nustačius galutinį domeną atnaujinkite `NEXT_PUBLIC_SITE_URL` ir **redeploy**
(kintamasis įkepamas build metu į metadata/robots/sitemap).

## Dažnos problemos

| Simptomas                                                  | Priežastis / sprendimas                                                                                                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard: „The column … does not exist“                   | Nepaleistos migracijos → `railway run npm run db:migrate` (arba sukonfigūruokite pre-deploy, žr. §3).                                                                                                                         |
| Dashboard: kliento klaida / tuščia                         | Paskyra neturi aktyvaus kliento arba Super Admin dar nepasirinko kliento → patikrinkite paskyrą ir paleiskite seed.                                                                                                           |
| Testavimas: `AI_NOT_CONFIGURED` / AI konfigūracijos klaida | Trūksta `OPENAI_API_KEY` arba `OPENAI_MODEL`; privalomas LLM-first parseris be jų iš karto palieka manual review.                                                                                                             |
| Testavimas: manual review su `AI_PARSE_FAILED`             | Retas AI atsakymo formato nesutapimas — pasikartojantį atvejį praneškite su lead detail „Decision JSON“ turiniu.                                                                                                              |
| SEO/sitemap rodo seną URL                                  | `NEXT_PUBLIC_SITE_URL` pakeistas be redeploy → redeploy.                                                                                                                                                                      |
| Padidėję OpenAI kaštai                                     | Patikrinkite `/dashboard/test` naudojimą ir ar `SHADOW_AI_PARSE` netyčia ne `true`; shadow prideda atskirą AI kvietimą kiekvienam testiniam lead'ui.                                                                          |
| Super Admin nematomas                                      | Prisijungta ne su `SUPER_ADMIN` paskyra → sukurkite ją per `/super-admin/signup` su teisingu registracijos kodu.                                                                                                              |
| Web forma grąžina `INVALID_SIGNATURE`                      | Pasirašytas ne tikslus raw JSON arba neteisinga `${timestamp}.${eventId}.${rawBody}` eilutė; po rotacijos atnaujinkite secret.                                                                                                |
| Web forma grąžina `STALE_TIMESTAMP`                        | Siuntėjo serverio laikrodis skiriasi daugiau nei 5 min. arba retry naudoja seną timestamp; pasirašykite iš naujo, palikdami tą patį event ID.                                                                                 |
| Resend eventas ignoruojamas                                | Gavėjo adresas nesutampa su aktyvios Paslaugos.lt integracijos adresu arba pašto taisyklė vis dar naudoja seną adresą.                                                                                                        |
| `SOURCE_FORMAT_UNRECOGNIZED`                               | Trūksta žinomos temos/šablono arba originalaus Paslaugos.lt `From`; naudokite `redirect`/forward režimą, kuris jo neperrašo. Neatsakykite automatiškai, o naujo formato nuasmenintą pavyzdį pridėkite kaip regresinį fixture. |
| `UNAUTHENTICATED_THREAD_REFERENCES`                        | Paslaugos.lt laiškas turi thread headerius, bet Resend nepateikė patikimos siuntėjo tapatybės; V1 palieka atskirą rankinės peržiūros pokalbį.                                                                                 |

## 8. Atnaujinimai

Deploy vyksta automatiškai push'inus į GitHub main šaką. Su sukonfigūruotu
pre-deploy (§3) naujos migracijos pritaikomos pačios. Seed'o kartoti
nereikia (nebent norite atstatyti DEV duomenis — jis saugus, nes upsert).
