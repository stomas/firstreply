# FirstReply — diegimas į Railway

Žingsnis po žingsnio gidas, kaip įdiegti FirstReply (Next.js + PostgreSQL) į
[Railway](https://railway.app). Skirtas žmogui, kuris diegia produktą — su
minimaliomis DevOps žiniomis.

Susiję dokumentai: [Techninė dokumentacija](./ARCHITEKTURA.md) ·
[Inbound integracijos](./INBOUND-INTEGRATION.md) ·
[Naudotojo gidas](./NAUDOTOJO-GIDAS.md)

---

## Ko reikės

- GitHub repo su šiuo kodu (Railway diegia iš GitHub).
- Railway paskyros.
- OpenAI API rakto (be jo veiks landing ir dashboard peržiūra, bet atsakymų
  generavimas grąžins „AI generation is not configured“).
- Resend paskyros ir inbound receiving domeno, jei jungiama Paslaugos.lt.

Build konfigūracija jau yra [`railway.json`](../railway.json): Nixpacks,
`npm run build` → `npm run start`, healthcheck `/`.

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
| `OPENAI_API_KEY`                | AI funkcijoms | OpenAI raktas.                                                                                                                                                                          |
| `OPENAI_MODEL`                  | AI funkcijoms | Modelio ID, pvz. `gpt-4.1-mini`.                                                                                                                                                        |
| `LLM_FIRST_PARSE`               | Ne            | `true` įjungia eksperimentinį LLM-first parserį tik `/dashboard/test`. Default `false` palieka deterministinį parserį.                                                                  |
| `SHADOW_AI_PARSE`               | Ne            | `true` įjungia shadow AI matavimą (papildomi AI kvietimai kiekvienam lead'ui — kaštai!). Default `false`.                                                                               |
| `LEAD_WEBHOOK_URL`              | Ne            | Kur persiunčiamos landing formos užklausos (Make/Zapier/Slack webhook). Tuščias — tik logas.                                                                                            |
| `INBOUND_SIGNING_MASTER_SECRET` | Inbound       | Bent 32 atsitiktinių baitų serverio secret, iš kurio išvedami atskirų web formų HMAC raktai.                                                                                            |
| `RESEND_API_KEY`                | El. paštas    | Resend API raktas pilnam gautam laiškui paimti, outbound domenui valdyti ir žmogaus patvirtintam laiškui siųsti.                                                                        |
| `RESEND_WEBHOOK_SECRET`         | Paslaugos.lt  | Resend webhook signing secret (`whsec_…`), skirtas raw payload patikrai.                                                                                                                |
| `RESEND_INBOUND_DOMAIN`         | Paslaugos.lt  | Resend sukonfigūruotas receiving domenas be `@`, pvz. `in.firstreply.lt`.                                                                                                               |
| `EMAIL_SENDING_ENABLED`         | Outbound      | Globalus realaus siuntimo kill switch. Po deploy laikyti `false`, kol patvirtintas siuntėjo domenas ir suplanuotas smoke testas.                                                        |

`NODE_ENV=production` ir `PORT` Railway nustato pats — jų kurti nereikia.

`LEAD_WEBHOOK_URL` skirtas tik viešai FirstReply landing kontaktų formai. Tai
nėra produkto inbound integracija. Produkto source'ai kuriami
`/dashboard/integrations` ir aprašyti
[inbound runbooke](./INBOUND-INTEGRATION.md).

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
3. Resend sukurkite webhooką į
   `https://<jūsų-domenas>/api/integrations/inbound/resend` ir pasirinkite
   `email.received` eventą.
4. Webhook signing secret įrašykite į `RESEND_WEBHOOK_SECRET`, API raktą — į
   `RESEND_API_KEY`, tada redeploy.

### Outbound domenas ir saugus įjungimas

1. Railway pirmiausia nustatykite `EMAIL_SENDING_ENABLED=false` ir pritaikykite
   migracijas.
2. Dashboard **Integracijos → Atsakymų siuntimas** sukurkite atskirą kliento
   subdomeną, DNS tiekėjui nukopijuokite parodytus Resend įrašus.
3. Spauskite **Tikrinti DNS**. Siuntėją galima naudoti tik kai providerio
   būsena `verified`, integracija aktyvi ir pasirinkta numatytąja.
4. Tik su saugiu testiniu Web formos leadu nustatykite
   `EMAIL_SENDING_ENABLED=true`, redeploy ir išsiųskite vieną žmogaus patvirtintą
   atsakymą.
5. Patikrinkite Resend žurnalą, gavėjo dėžutę, vieną `OUTBOUND` timeline įrašą
   ir vieną `OutboundDispatch`. Šiame etape dashboard `SENT` reiškia Resend
   priėmimą; delivery/bounce webhookai dar neįgyvendinti.
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
5. **`/dashboard/test`** → pateikite testinę užklausą, pvz.
   „Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje.
   Kiek kainuotų?“ → turi grįžti parengtas atsakymas su kaina — veikia visas
   pipeline, įskaitant OpenAI.
6. **`/dashboard/integrations`** → sukurkite web formos integraciją; URL ir
   signing secret turi būti matomi. Išsiųskite pasirašytą smoke eventą pagal
   [runbooką](./INBOUND-INTEGRATION.md) ir patikrinkite vieną realų leadą.
7. Jei parengtas atsakymas grąžina „AI generation is not configured“ — patikrinkite
   `OPENAI_API_KEY` / `OPENAI_MODEL`.
8. Jei sukonfigūruotas Resend, išbandykite tikslų Paslaugos.lt forwarding
   filtrą ir dashboarde patikrinkite source, timeline bei paskutinį eventą.
   Eventas neturi būti `SOURCE_FORMAT_UNRECOGNIZED`; jei yra, patikrinkite, ar
   pašto provideris neperrašė originalaus Paslaugos.lt `From`.

Providerio credentialų nėra CI, todėl web formos ir Resend/Railway smoke
testai yra privalomas operatoriaus žingsnis po deploy.

## 7. Domenas

**Settings → Networking → Generate Domain** (arba prijunkite savo domeną).
Nustačius galutinį domeną atnaujinkite `NEXT_PUBLIC_SITE_URL` ir **redeploy**
(kintamasis įkepamas build metu į metadata/robots/sitemap).

## Dažnos problemos

| Simptomas                                      | Priežastis / sprendimas                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard: „The column … does not exist“       | Nepaleistos migracijos → `railway run npm run db:migrate` (arba sukonfigūruokite pre-deploy, žr. §3).                                                                                                                         |
| Dashboard: kliento klaida / tuščia             | Paskyra neturi aktyvaus kliento arba Super Admin dar nepasirinko kliento → patikrinkite paskyrą ir paleiskite seed.                                                                                                           |
| Testavimas: „AI generation is not configured“  | Trūksta `OPENAI_API_KEY` arba `OPENAI_MODEL`.                                                                                                                                                                                 |
| Testavimas: manual review su `AI_PARSE_FAILED` | Retas AI atsakymo formato nesutapimas — pasikartojantį atvejį praneškite su lead detail „Decision JSON“ turiniu.                                                                                                              |
| SEO/sitemap rodo seną URL                      | `NEXT_PUBLIC_SITE_URL` pakeistas be redeploy → redeploy.                                                                                                                                                                      |
| Padidėję OpenAI kaštai                         | Patikrinkite, ar `SHADOW_AI_PARSE` netyčia ne `true`.                                                                                                                                                                         |
| Super Admin nematomas                          | Prisijungta ne su `SUPER_ADMIN` paskyra → sukurkite ją per `/super-admin/signup` su teisingu registracijos kodu.                                                                                                              |
| Web forma grąžina `INVALID_SIGNATURE`          | Pasirašytas ne tikslus raw JSON arba neteisinga `${timestamp}.${eventId}.${rawBody}` eilutė; po rotacijos atnaujinkite secret.                                                                                                |
| Web forma grąžina `STALE_TIMESTAMP`            | Siuntėjo serverio laikrodis skiriasi daugiau nei 5 min. arba retry naudoja seną timestamp; pasirašykite iš naujo, palikdami tą patį event ID.                                                                                 |
| Resend eventas ignoruojamas                    | Gavėjo adresas nesutampa su aktyvios Paslaugos.lt integracijos adresu arba pašto taisyklė vis dar naudoja seną adresą.                                                                                                        |
| `SOURCE_FORMAT_UNRECOGNIZED`                   | Trūksta žinomos temos/šablono arba originalaus Paslaugos.lt `From`; naudokite `redirect`/forward režimą, kuris jo neperrašo. Neatsakykite automatiškai, o naujo formato nuasmenintą pavyzdį pridėkite kaip regresinį fixture. |
| `UNAUTHENTICATED_THREAD_REFERENCES`            | Paslaugos.lt laiškas turi thread headerius, bet Resend nepateikė patikimos siuntėjo tapatybės; V1 palieka atskirą rankinės peržiūros pokalbį.                                                                                 |

## 8. Atnaujinimai

Deploy vyksta automatiškai push'inus į GitHub main šaką. Su sukonfigūruotu
pre-deploy (§3) naujos migracijos pritaikomos pačios. Seed'o kartoti
nereikia (nebent norite atstatyti DEV duomenis — jis saugus, nes upsert).
