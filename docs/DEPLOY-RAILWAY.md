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

| Kintamasis                     | Privalomas    | Reikšmė                                                                                                                                                                                 |
| ------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Taip          | Reference į Postgres servisą: `${{Postgres.DATABASE_URL}}`                                                                                                                              |
| `FIRSTREPLY_DEFAULT_CLIENT_ID` | Taip          | Kliento ID iš `clients` lentelės. Po seed — `1` (DEV klientas).                                                                                                                         |
| `NEXT_PUBLIC_SITE_URL`         | Taip          | Viešas URL be pasvirojo brūkšnio gale, pvz. `https://firstreply.lt` arba `https://<app>.up.railway.app`. Naudojamas SEO/sitemap — **pakeitus reikia redeploy** (build-time kintamasis). |
| `OPENAI_API_KEY`               | AI funkcijoms | OpenAI raktas.                                                                                                                                                                          |
| `OPENAI_MODEL`                 | AI funkcijoms | Modelio ID, pvz. `gpt-4.1-mini`.                                                                                                                                                        |
| `SHADOW_AI_PARSE`              | Ne            | `true` įjungia shadow AI matavimą (papildomi AI kvietimai kiekvienam lead'ui — kaštai!). Default `false`.                                                                               |
| `LEAD_WEBHOOK_URL`             | Ne            | Kur persiunčiamos landing formos užklausos (Make/Zapier/Slack webhook). Tuščias — tik logas.                                                                                            |

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

Švariai DB reikia bent vieno kliento su taisyklėmis — kitaip dashboard rodys
klaidą, o `FIRSTREPLY_DEFAULT_CLIENT_ID` neturės į ką rodyti.

```bash
railway run npm run db:seed
```

Seed yra **idempotentiškas** (upsert) ir sukuria DEV klientą (`id = "1"`,
„DEV Tvorų gamyba ir montavimas“) su 3 paslaugomis, kainodara, klausimais,
užimtumu, šablonais ir Lietuvos savivaldybių žemėlapiu. Realiam klientui:
paleiskite seed, tada per dashboard susiveskite tikrus pavadinimus/kainas,
arba sukurkite atskirą kliento eilutę DB ir atnaujinkite
`FIRSTREPLY_DEFAULT_CLIENT_ID`.

## 5. Patikrinimas po diegimo

Eilės tvarka — kiekvienas žingsnis tikrina vis gilesnį sluoksnį:

1. **`/`** atsidaro (healthcheck jau tikrina šitą) — landing veikia.
2. **`/dashboard`** rodo užklausų sąrašą (ne klaidą) — DB pasiekiama,
   migracijos pritaikytos, `FIRSTREPLY_DEFAULT_CLIENT_ID` teisingas.
3. **`/dashboard/test`** → pateikite testinę užklausą, pvz.
   „Sveiki, reikia skardinės tvoros 45 metrai ir 1.7 m aukščio Vilniuje.
   Kiek kainuotų?“ → turi grįžti parengtas atsakymas su kaina — veikia visas
   pipeline, įskaitant OpenAI.
4. Jei 3 žingsnis grąžina „AI generation is not configured“ — patikrinkite
   `OPENAI_API_KEY` / `OPENAI_MODEL`.

## 6. Domenas

**Settings → Networking → Generate Domain** (arba prijunkite savo domeną).
Nustačius galutinį domeną atnaujinkite `NEXT_PUBLIC_SITE_URL` ir **redeploy**
(kintamasis įkepamas build metu į metadata/robots/sitemap).

## Dažnos problemos

| Simptomas                                      | Priežastis / sprendimas                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dashboard: „The column … does not exist“       | Nepaleistos migracijos → `railway run npm run db:migrate` (arba sukonfigūruokite pre-deploy, žr. §3).            |
| Dashboard: kliento klaida / tuščia             | `FIRSTREPLY_DEFAULT_CLIENT_ID` nesutampa su `clients.id` DB → paleiskite seed arba pataisykite kintamąjį.        |
| Testavimas: „AI generation is not configured“  | Trūksta `OPENAI_API_KEY` arba `OPENAI_MODEL`.                                                                    |
| Testavimas: manual review su `AI_PARSE_FAILED` | Retas AI atsakymo formato nesutapimas — pasikartojantį atvejį praneškite su lead detail „Decision JSON“ turiniu. |
| SEO/sitemap rodo seną URL                      | `NEXT_PUBLIC_SITE_URL` pakeistas be redeploy → redeploy.                                                         |
| Padidėję OpenAI kaštai                         | Patikrinkite, ar `SHADOW_AI_PARSE` netyčia ne `true`.                                                            |

## Atnaujinimai

Deploy vyksta automatiškai push'inus į GitHub main šaką. Su sukonfigūruotu
pre-deploy (§3) naujos migracijos pritaikomos pačios. Seed'o kartoti
nereikia (nebent norite atstatyti DEV duomenis — jis saugus, nes upsert).
