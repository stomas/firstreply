# FirstReply — diegimas į Railway

Žingsnis po žingsnio gidas, kaip įdiegti FirstReply (Next.js + PostgreSQL) į
[Railway](https://railway.app). Skirtas žmogui, kuris diegia produktą — su
minimaliomis DevOps žiniomis.

Susiję dokumentai: [Techninė dokumentacija](./ARCHITEKTURA.md) ·
[Naudotojo gidas](./NAUDOTOJO-GIDAS.md)

---

## Ko reikės

- GitHub repo su šiuo kodu (Railway diegia iš GitHub).
- Railway paskyros.
- OpenAI API rakto (be jo veiks landing ir dashboard peržiūra, bet atsakymų
  generavimas grąžins „AI generation is not configured“).

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

| Kintamasis                | Privalomas    | Reikšmė                                                                                                                                                                                 |
| ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Taip          | Reference į Postgres servisą: `${{Postgres.DATABASE_URL}}`                                                                                                                              |
| `SUPER_ADMIN_SIGNUP_CODE` | Admin setup   | Bent 24 atsitiktinių simbolių kodas, reikalingas `/super-admin/signup`; po pradinės registracijos jį pakeiskite arba pašalinkite.                                                       |
| `NEXT_PUBLIC_SITE_URL`    | Taip          | Viešas URL be pasvirojo brūkšnio gale, pvz. `https://firstreply.lt` arba `https://<app>.up.railway.app`. Naudojamas SEO/sitemap — **pakeitus reikia redeploy** (build-time kintamasis). |
| `OPENAI_API_KEY`          | AI funkcijoms | OpenAI raktas.                                                                                                                                                                          |
| `OPENAI_MODEL`            | AI funkcijoms | Modelio ID, pvz. `gpt-4.1-mini`.                                                                                                                                                        |
| `LLM_FIRST_PARSE`         | Ne            | `true` įjungia eksperimentinį LLM-first parserį tik `/dashboard/test`. Default `false` palieka deterministinį parserį.                                                                  |
| `SHADOW_AI_PARSE`         | Ne            | `true` įjungia shadow AI matavimą (papildomi AI kvietimai kiekvienam lead'ui — kaštai!). Default `false`.                                                                               |
| `LEAD_WEBHOOK_URL`        | Ne            | Kur persiunčiamos landing formos užklausos (Make/Zapier/Slack webhook). Tuščias — tik logas.                                                                                            |

`NODE_ENV=production` ir `PORT` Railway nustato pats — jų kurti nereikia.

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

## 5. Patikrinimas po diegimo

Eilės tvarka — kiekvienas žingsnis tikrina vis gilesnį sluoksnį:

1. **`/`** atsidaro (healthcheck jau tikrina šitą) — landing veikia.
2. **`/super-admin/signup`** sukuria administratorių su nustatytu registracijos
   kodu, o dashboarde galima pasirinkti klientą `id=1`.
3. **`/dashboard`** rodo pasirinkto kliento užklausų sąrašą — DB ir sesija veikia.
4. **`/dashboard/test`** → pateikite testinę užklausą, pvz.
   „Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje.
   Kiek kainuotų?“ → turi grįžti parengtas atsakymas su kaina — veikia visas
   pipeline, įskaitant OpenAI.
5. Jei 4 žingsnis grąžina „AI generation is not configured“ — patikrinkite
   `OPENAI_API_KEY` / `OPENAI_MODEL`.

## 6. Domenas

**Settings → Networking → Generate Domain** (arba prijunkite savo domeną).
Nustačius galutinį domeną atnaujinkite `NEXT_PUBLIC_SITE_URL` ir **redeploy**
(kintamasis įkepamas build metu į metadata/robots/sitemap).

## Dažnos problemos

| Simptomas                                      | Priežastis / sprendimas                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Dashboard: „The column … does not exist“       | Nepaleistos migracijos → `railway run npm run db:migrate` (arba sukonfigūruokite pre-deploy, žr. §3).               |
| Dashboard: kliento klaida / tuščia             | Paskyra neturi aktyvaus kliento arba Super Admin dar nepasirinko kliento → patikrinkite paskyrą ir paleiskite seed. |
| Testavimas: „AI generation is not configured“  | Trūksta `OPENAI_API_KEY` arba `OPENAI_MODEL`.                                                                       |
| Testavimas: manual review su `AI_PARSE_FAILED` | Retas AI atsakymo formato nesutapimas — pasikartojantį atvejį praneškite su lead detail „Decision JSON“ turiniu.    |
| SEO/sitemap rodo seną URL                      | `NEXT_PUBLIC_SITE_URL` pakeistas be redeploy → redeploy.                                                            |
| Padidėję OpenAI kaštai                         | Patikrinkite, ar `SHADOW_AI_PARSE` netyčia ne `true`.                                                               |
| Super Admin nematomas                          | Prisijungta ne su `SUPER_ADMIN` paskyra → sukurkite ją per `/super-admin/signup` su teisingu registracijos kodu.    |

## Atnaujinimai

Deploy vyksta automatiškai push'inus į GitHub main šaką. Su sukonfigūruotu
pre-deploy (§3) naujos migracijos pritaikomos pačios. Seed'o kartoti
nereikia (nebent norite atstatyti DEV duomenis — jis saugus, nes upsert).
