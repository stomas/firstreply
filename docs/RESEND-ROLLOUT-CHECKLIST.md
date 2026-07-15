# Resend/Railway paleidimo ir smoke testų checklist

Šis dokumentas yra pažodinis 0–3 outbound etapų paleidimo gidas. Žingsnius
atlikite iš eilės. Jei konkretus patikrinimas nepavyksta, neikite toliau ir
naudokite skyriaus **Gedimo atveju** veiksmus.

Niekada nekelkite API raktų, webhook secretų ar `DATABASE_URL` į Git ir
nesiųskite jų į chatą. Reikšmes įveskite tik Railway/Resend UI arba savo
lokalioje terminalo sesijoje.

## A. Prieš deploy

1. Įsitikinkite, kad turite prieigą prie FirstReply Railway projekto, Resend
   paskyros ir siuntėjo domeno DNS.
2. Railway atsidarykite **App service → Variables**.
3. Nustatykite `EMAIL_SENDING_ENABLED=false`.
4. Patikrinkite, kad app servisas turi `DATABASE_URL` reference į teisingą
   PostgreSQL servisą.
5. Railway PostgreSQL servise sukurkite snapshot/backup arba patikrinkite, kad
   veikia jūsų įprastas atkūrimo mechanizmas.
6. App servise atsidarykite **Settings → Deploy → Custom Pre-Deploy Command**.
7. Įrašykite `npm run db:migrate` ir išsaugokite.
8. Dar nedarykite deploy, kol neužpildytas B skyrius.

## B. Railway kintamieji

1. **App service → Variables** patikrinkite šiuos kintamuosius:
   - `INBOUND_SIGNING_MASTER_SECRET` — bent 32 atsitiktiniai baitai;
   - `RESEND_API_KEY` — serverio Resend API raktas;
   - `RESEND_WEBHOOK_SECRET` — aktyvaus Resend webhooko `whsec_…` secretas;
   - `RESEND_INBOUND_DOMAIN` — receiving domenas be `@`;
   - `NEXT_PUBLIC_SITE_URL` — viešas FirstReply URL be `/` gale;
   - `EMAIL_SENDING_ENABLED=false`.
2. Jei Resend webhookas jau sukurtas, jo secretas turi būti nustatytas dabar.
   Jei diegiate nuo nulio ir webhooko dar nėra, šį vieną kintamąjį palikite
   nebaigtą ir tiksliai atlikite D.6 žingsnį prieš bet kokį smoke testą.
3. Jei trūksta master secreto, lokaliai paleiskite `openssl rand -base64 48` ir
   rezultatą įveskite tiesiai į Railway.
4. Išsaugokite kintamuosius. Secretų reikšmių nekopijuokite į šį dokumentą.

## C. Deploy ir migracijos

1. Merge’inkite/deployinkite release, kuriame yra ši Stage 3 migracija.
2. Railway atsidarykite naujausią deploy ir stebėkite **Pre-deploy logs**.
3. Turi matytis sėkmingas `prisma migrate deploy`; klaidos neturi būti.
4. Atidarykite `https://<jūsų-domenas>/` — puslapis turi atsakyti `200`.
5. Prisijunkite ir atidarykite `/dashboard` bei `/dashboard/integrations`.
6. Jei matote klaidą apie neegzistuojančią DB koloną ar lentelę, sustokite:
   migracija nepritaikyta.

## D. Vienas Resend webhookas

1. Resend atsidarykite **Webhooks**.
2. Naudokite tik vieną FirstReply produkcinį webhooką. Nepalikite seno ir naujo
   webhookų aktyvių vienu metu.
3. Esamo webhooko URL pakeiskite į:

   ```text
   https://<jūsų-domenas>/api/integrations/resend
   ```

4. Pažymėkite eventus:
   - `email.received`;
   - `email.sent`;
   - `email.delivered`;
   - `email.delivery_delayed`;
   - `email.bounced`;
   - `email.failed`;
   - `email.complained`;
   - `email.suppressed`.
5. Patikrinkite, kad to webhooko signing secretas tiksliai sutampa su Railway
   `RESEND_WEBHOOK_SECRET`.
6. Jei webhooko dar nėra arba Resend neleidžia redaguoti esamo, sukurkite
   naują. Jo secretą įrašykite į Railway `RESEND_WEBHOOK_SECRET`, išjunkite
   seną webhooką, jei toks buvo, ir iškart redeployinkite. Palaukite sėkmingo
   healthcheck prieš eidami į E skyrių.
7. Resend webhookų sąraše dar kartą patikrinkite, kad aktyvus tik vienas
   FirstReply endpointas.

## E. Receiving ir outbound domenai

1. Resend **Domains** patikrinkite, kad `RESEND_INBOUND_DOMAIN` receiving
   domenas yra aktyvus.
2. FirstReply `/dashboard/integrations` sukurkite arba atsidarykite
   **Paslaugos.lt** integraciją ir pasižymėkite jos `p-…@…` adresą.
3. Kliento pašto taisyklė turi persiųsti į tą adresą tik Paslaugos.lt laiškus.
   Visos pašto dėžutės neforwardinkite.
4. `/dashboard/integrations` skiltyje **Atsakymų siuntimas** pridėkite siuntėjo
   vardą, įmonės el. pašto adresą ir `Reply-To`.
5. Į kliento DNS valdymą tiksliai nukopijuokite visus FirstReply/Resend parodytus
   įrašus, įskaitant jų tipą, vardą, reikšmę ir MX prioritetą, kai jis rodomas.
6. FirstReply spauskite **Tikrinti DNS**, kol būsena taps `verified` / aktyvi.
7. Pažymėkite šį siuntėją numatytuoju.

## F. Sukurkite testinį Web formos leadą

1. FirstReply `/dashboard/integrations` sukurkite atskirą Web formos
   integraciją pavadinimu, pvz., `Resend smoke`.
2. Nukopijuokite jos webhook URL ir signing secretą.
3. Lokaliame terminale, repo kataloge, paleiskite (reikšmes įveskite tik savo
   terminale):

   ```bash
   WEB_FORM_WEBHOOK_URL='https://<...>' \
   WEB_FORM_SIGNING_SECRET='<...>' \
   SMOKE_CUSTOMER_EMAIL='delivered@resend.dev' \
   npm run smoke:web-form
   ```

4. Turi būti parodytas `HTTP 200` ir `completed` rezultatas.
5. Dashboarde raskite naują leadą pagal tekstą `Resend delivery smoke testas`.
6. Atidarykite leadą ir patikrinkite, kad source yra Web forma, yra vienas
   inbound message ir atsakymo juodraštis.

## G. Įjunkite realų siuntimą tik smoke testui

1. Railway **App service → Variables** pakeiskite
   `EMAIL_SENDING_ENABLED=true`.
2. Paleiskite redeploy ir palaukite sėkmingo healthcheck.
3. Grįžkite į F skyriuje sukurtą leadą ir atnaujinkite puslapį.
4. Formoje patikrinkite `From`, `To=delivered@resend.dev` ir `Reply-To`.
5. Paspauskite **Siųsti klientui** ir patvirtinkite.
6. Timeline gal trumpam rodys `Priimtas siųsti`, bet greitas webhookas gali būti
   apdorotas iki pirmo atnaujinimo. Galutinis rezultatas turi būti
   `Pristatytas` su laiku.
7. Resend **Emails** patikrinkite tą patį message ID ir `Delivered` būseną.

## H. Bounce, complaint ir suppression testai

Kiekvienai eilutei pakartokite F skyriaus komandą su nauju adresu. Kiekvienas
komandos paleidimas sukuria naują event ID ir naują leadą. Tada tame leade
paspauskite **Siųsti klientui**.

| `SMOKE_CUSTOMER_EMAIL`  | Tikėtina timeline būsena        | Papildomas tikrinimas                                        |
| ----------------------- | ------------------------------- | ------------------------------------------------------------ |
| `bounced@resend.dev`    | `Atmestas gavėjo`               | Pokalbis tampa `Reikia peržiūros`, activity rodo bounce      |
| `complained@resend.dev` | `Pažymėtas kaip spam`           | Pokalbis tampa `Reikia peržiūros`, activity rodo complaint   |
| `suppressed@resend.dev` | `Nesiųsta — adresas slopinamas` | Pokalbis tampa `Reikia peržiūros`, activity rodo suppression |

Po kiekvieno testo:

1. Resend webhook loge raskite eventą ir patikrinkite HTTP `200`.
2. FirstReply timeline patikrinkite tik vieną atitinkamą sistemos activity.
3. Resend eventą paspauskite **Replay** vieną kartą.
4. Atnaujinkite FirstReply leadą — antro activity neturi atsirasti, būsena
   neturi pasikeisti į blogesnę.
5. Bounce/complaint/suppression siuntimui neturi būti rodomas saugaus retry
   mygtukas.

Šie yra oficialūs Resend testiniai gavėjai; nenaudokite atsitiktinių svetimų
adresų neigiamų scenarijų testams.

## I. Paslaugos.lt inbound smoke

1. Palikite tą patį neutralų `/api/integrations/resend` webhooką.
2. Iš kliento pašto persiųskite vieną tikrą Paslaugos.lt pranešimą per tikslią
   taisyklę į E skyriuje pasižymėtą `p-…@…` adresą.
3. Resend webhook loge `email.received` turi gauti HTTP `200`.
4. FirstReply turi atsirasti vienas `PASLAUGOS_LT` lead/message.
5. Resend eventą replayinkite vieną kartą — antro lead/message neturi būti.
6. Išsiųskite paprastą nesusijusį laišką į kliento dėžutę ir patikrinkite, kad
   pašto taisyklė jo nepersiuntė į FirstReply.

## J. Užbaikite saugiai

1. Railway grąžinkite `EMAIL_SENDING_ENABLED=false`.
2. Redeployinkite ir palaukite sėkmingo healthcheck.
3. Patikrinkite, kad lead puslapyje realaus siuntimo forma nebeaktyvi.
4. Pasižymėkite testų datą, deploy ID ir keturių Resend message/event ID savo
   vidiniame release įraše; secretų nefiksuokite.
5. Tik po sėkmingo piloto sąmoningai vėl įjunkite kill switch produkciniam
   naudojimui.

## Gedimo atveju

1. Iškart nustatykite `EMAIL_SENDING_ENABLED=false` ir redeployinkite.
2. Resend webhooke laikinai nuimkite visus outbound eventus ir palikite tik
   `email.received`. Tai sustabdo naujus delivery callbackus; vien kill switch
   jų nesustabdo.
3. Jei gedimas yra pačiame neutraliame endpoint’e ir neveikia net inbound,
   webhooko URL laikinai grąžinkite į
   `https://<jūsų-domenas>/api/integrations/inbound/resend`. Palikite tik
   `email.received`. Šis compatibility route delivery eventų neapdoroja.
4. Jei webhookai gauna `401`, sutikrinkite aktyvaus webhooko secretą su
   Railway `RESEND_WEBHOOK_SECRET`; nekeiskite payload rankomis.
5. Jei webhookas gauna `500`, išsaugokite tik deploy ID, `svix-id`, event tipą
   ir loguose matomą klaidos pavadinimą. Secretų ir pilno kliento laiško
   nekopijuokite.
6. Jei nėra DB lentelės/kolonos, patikrinkite pre-deploy migracijos logą ir
   nepaleiskite siuntimo iki sėkmingo `npm run db:migrate`.
7. Jei būsena lieka `Priimtas siųsti`, patikrinkite, ar webhooke pažymėti
   delivery eventai ir naudojamas neutralus endpointas.
8. Jei sukuriami dublikatai, išjunkite papildomą Resend webhooką ir palikite
   tik vieną produkcinį endpointą.
9. Pranešdami klaidą pateikite: žingsnio raidę/numerį, deploy ID, laiką,
   `svix-id`, Resend message ID ir ekrane matomą būseną.
