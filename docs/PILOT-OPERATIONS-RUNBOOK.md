# FirstReply pirmojo piloto operavimo runbookas

Šis dokumentas apibrėžia pirmojo asistuojamo B2B piloto ribas ir operatoriaus
veiksmus nuo paruošimo iki uždarymo. Techniniai Resend/Railway smoke žingsniai
atliekami pažodžiui pagal
[Resend paleidimo checklist](./RESEND-ROLLOUT-CHECKLIST.md). Čia nefiksuojami
secretai, pilni klientų laiškai ar `DATABASE_URL`.

## 1. Piloto ribos

- Pagrindinis source yra `WEB_FORM`.
- `PASLAUGOS_LT` gali priimti tik tikslia pašto taisykle persiųstus
  Paslaugos.lt pranešimus; atsakoma platformoje ar kitame išoriniame kanale.
- Web formos laišką FirstReply siunčia tik žmogui peržiūrėjus ir patvirtinus.
- Kliento reply pristatomas į įmonės sukonfigūruotą `Reply-To`. Iki reply
  routing etapo jis automatiškai nepatenka į FirstReply timeline.
- Išorinis atsakymas fiksuojamas veiksmu **Atsakyta kitur**. Fiktyvus outbound
  message nekuriamas.
- Billing, support, eksportas ir ištrynimas pilote vykdomi rankine audituojama
  procedūra.
- Gmail/Microsoft sync, auto-send, priedų analizė ir Paslaugos.lt direct send į
  pilotą neįeina.

Šios ribos turi būti pažodžiui suderintos piloto pasiūlyme ir sutartyje.

## 2. Atsakomybės ir kontaktai

Prieš onboarding užpildykite vidiniame piloto įraše (ne šiame Git faile):

| Atsakomybė               | Privalomas įrašas                              |
| ------------------------ | ---------------------------------------------- |
| Produkto savininkas      | vardas, telefonas ir el. paštas                |
| Techninis budėtojas      | vardas, telefonas, reagavimo valandos          |
| Kliento atsakingas asmuo | vardas ir patvirtintas kontaktas               |
| Legal patvirtintojas     | vardas, dokumento versija ir patvirtinimo data |
| Produkcinė aplinka       | Railway projektas, servisas ir viešas URL      |
| Release įrašas           | deploy ID, commit SHA ir acceptance data       |

Incidento ar duomenų subjekto užklausos negalima vykdyti vien pagal laisvos
formos laišką. Pirmiausia patvirtinama prašytojo tapatybė ir jo teisė veikti
konkretaus kliento vardu.

## 3. Preflight prieš saugų kliento setup

Kliento setup nepradedamas, kol visi punktai nėra pažymėti vidiniame release
įraše:

1. Patvirtintos piloto ribos, kaina, support kanalas ir pilotinis SLA.
2. Teisininkas arba produkto savininkas patvirtino galutinę privatumo politiką,
   sąlygas, DPA ir subprocesorių sąrašą pagal
   [legal readiness checklist](./LEGAL-READINESS-CHECKLIST.md).
3. Railway produkcijoje nustatyta `EMAIL_SENDING_ENABLED=false`.
4. Patikrintas `DATABASE_URL`, sėkmingas `npm run db:migrate` pre-deploy ir
   užfiksuotas paskutinis sėkmingas backup.
5. Sukonfigūruoti inbound/Resend kintamieji, bet jų reikšmės nepateiktos
   ticketuose, chatuose ar release įraše.
6. Resend turi vieną aktyvų `/api/integrations/resend` webhooką su inbound ir
   visais palaikomais delivery eventais.
7. Patikrinta backup ir restore procedūra iš šio dokumento 4 skyriaus.

Bet kuris nepažymėtas punktas yra **no-go saugiam setup**. Tai dar nėra leidimas
įjungti realų siuntimą; go-live sprendimas priimamas tik 10 skyriuje.

## 4. Backup ir restore

### Backup ir restore — prieš deploy

1. Railway PostgreSQL servise patikrinkite paskutinio automatinio backup arba
   snapshot laiką.
2. Jei jo nėra arba jis senesnis už jūsų organizacijos patvirtintą RPO,
   sukurkite naują backup prieš migraciją.
3. Vidiniame release įraše užrašykite backup ID/laiką ir atsakingą žmogų, bet ne
   prisijungimo duomenis.
4. Patikrinkite, kad turite dokumentuotą būdą atkurti backup į **atskirą**
   PostgreSQL servisą. Produkcinės DB neperrašykite vien tam, kad patikrintumėte
   backup.
5. Su atkurtos DB `DATABASE_URL` paleiskite `npx prisma migrate status` ir
   patikrinkite `_prisma_migrations`: neturi būti failed ar nepritaikytų
   produkcijoje jau buvusių migracijų. `npx prisma validate` tikrina tik schemos
   failą ir **nėra** restore įrodymas.
6. Prisijunkite read-only DB vartotoju, atlikite minimalų Prisma aplikacijos
   smoke query ir sutikrinkite bent klientų, leadų, pokalbių, messages bei
   dispatchų kontrolinius skaičius su produkcija. Smoke negali siųsti laiškų ar
   vykdyti pipeline.
7. Užfiksuokite restore bandymo datą, trukmę, backup ID, migracijų būseną,
   kontrolinių skaičių rezultatą ir vykdytoją.

### Restore — incidento metu

1. Nustatykite `EMAIL_SENDING_ENABLED=false` ir sustabdykite planuotus deploy.
2. Išsaugokite incidento laiką, deploy ID ir paveiktą tenantą; nekopijuokite
   pilno laiško turinio.
3. Jei įmanoma, palikite produkcinę DB nepakeistą tyrimui ir atkurkite pasirinktą
   backup į naują servisą.
4. Patikrinkite schemos migracijų būseną ir duomenų kontrolinius skaičius.
5. Produkcinį connection string keiskite tik gavus produkto savininko bei
   techninio atsakingo asmens patvirtinimą.
6. Po perjungimo pakartokite susijusius acceptance scenarijus, o siuntimą
   palikite išjungtą iki atskiro go sprendimo.

## 5. Incidento valdymas

### Pirmi 15 minučių

1. Jei galimas neteisingas ar dvigubas siuntimas, iškart nustatykite
   `EMAIL_SENDING_ENABLED=false` ir redeployinkite.
2. Jei incidentas webhooke, pagal rollout checklist palikite tik būtiną
   `email.received` kelią arba laikinai naudokite compatibility inbound route.
3. Užregistruokite pradžios laiką, tenantą, deploy ID, `svix-id`, Resend message
   ID ir klaidos kodą. Secretų bei pilno payload nefiksuokite.
4. Informuokite produkto savininką ir kliento kontaktą pagal sutartą SLA.

### Sunkumo lygiai

- **P1:** cross-tenant atvejis, neteisingas gavėjas, dvigubas siuntimas,
  neautorizuotas duomenų atskleidimas ar nekontroliuojamas siuntimas. Siuntimas
  lieka išjungtas, izoliuojamas incidentas ir pradedamas formalus vertinimas.
- **P2:** lead/message praradimas, sugadintas threading, neveikiantis delivery
  sekimas ar sistemingai klaidingi draftai. Naujas paveiktas flow stabdomas.
- **P3:** lokalus UX, dokumentacijos ar pavienis recoverable providerio gedimas.

### Uždarymas

1. Patvirtinkite priežastį ir paveiktų tenantų/eventų ribas.
2. Pataisą išleiskite atskiru mažu PR su regresiniu testu.
3. Pakartokite visą susijusį smoke scenarijų, įskaitant webhook replay.
4. Dokumentuokite sprendimą, prevencinį veiksmą ir kas leido vėl įjungti
   siuntimą.

### Support intake ir triage

1. Prieš pilotą vidiniame įraše nurodykite vieną oficialų support kanalą,
   darbo valandas, pilotinį SLA ir avarinį P1 kontaktą. Prašymai kitu kanalu
   perkeliami į oficialų kanalą ir gauna request ID.
2. Kiekvienam kreipiniui sukurkite request ID ir paprašykite tik saugių
   diagnostinių duomenų: kliento įmonė, laikas su laiko zona, ekrane matomas
   klaidos kodas, lead/event/message ID, deploy ID ir veiksmas prieš klaidą.
   Secretų, slaptažodžių, `DATABASE_URL`, pilno webhook payload ar pilno kliento
   laiško support kanale neprašykite.
3. Patvirtinkite prašytojo tapatybę ir jo ryšį su klientu, tada priskirkite P1,
   P2 arba P3 pagal šio skyriaus sunkumo lygius.
4. Paskirkite vieną atsakingą žmogų ir kitą peržiūrėtoją. Įraše turi būti būsena,
   kitas veiksmas, terminas ir paskutinio atnaujinimo laikas.
5. P1 nedelsiant eskaluojamas produkto savininkui bei techniniam budėtojui ir
   aktyvuoja kill switch/incidento procedūrą. P2 eskaluojamas, jei nepasiekiamas
   SLA arba galimas duomenų vientisumo poveikis. P3 sprendžiamas įprasta eile.
6. Uždarykite tik atkūrę paslaugą arba pateikę aiškų workaround, patikrinę
   rezultatą su klientu ir užfiksavę priežastį, sprendimą, prevenciją bei
   uždarymo laiką. Saugumo ar duomenų bugui būtinas atskiras regresinis PR.

## 6. Kill switch

- **Išjungimas:** Railway nustatyti `EMAIL_SENDING_ENABLED=false`, redeployinti,
  patikrinti healthcheck ir kad lead puslapyje siuntimo forma nebeaktyvi.
- **Svarbi riba:** kill switch sustabdo naujus siuntimus, bet delivery webhookai
  toliau turi sutikrinti jau priimtų laiškų būsenas.
- **Įjungimas:** leidžiamas tik vienam sutartam piloto klientui po sėkmingo
  acceptance, patvirtinto outbound domeno ir dviejų žmonių go sprendimo.
- **Incidento metu:** neįjungti vien todėl, kad klaida dingo iš UI; pirmiausia
  turi praeiti regresinis scenarijus ir webhook replay.

## 7. Secret rotacija

Kiekvieną rotaciją registruokite data, atsakingu asmeniu ir paveikta integracija,
bet nefiksuokite senos ar naujos reikšmės.

### Web formos integracijos secret

1. Suderinkite trumpą perjungimo langą su kliento programuotoju.
2. Dashboarde rotuokite tik konkrečią Web formos integraciją.
3. Naują secret saugiu kanalu perduokite tik server-side implementacijai.
4. Atnaujinkite siuntėją ir atlikite vieną signed smoke eventą.
5. Patikrinkite, kad senas parašas nebepriimamas, o naujas sukuria tik vieną
   event/message/lead.

### Serverio master ir Resend secretai

1. `INBOUND_SIGNING_MASTER_SECRET` keitimas pakeičia visų Web formų išvestus
   raktus, todėl tai planuojama kaip koordinuota visų aktyvių integracijų
   migracija, ne kaip įprastas vienos formos veiksmas.
2. `RESEND_WEBHOOK_SECRET` keiskite kartu su vieninteliu aktyviu Resend webhooku
   ir iškart patikrinkite signed eventą.
3. `RESEND_API_KEY` keiskite su `EMAIL_SENDING_ENABLED=false`; patikrinkite DNS
   refresh ir Super Admin testą prieš grąžindami siuntimą.
4. Įtarus kompromitavimą nelaukite planinio lango: revoke, pakeiskite reikšmę,
   redeployinkite ir pradėkite incidento procedūrą.

## 8. Duomenų eksportas ir ištrynimas

### Duomenų eksportas

1. Užregistruokite request ID, prašytoją, klientą/tenantą, apimtį, teisinį
   pagrindą ir terminą.
2. Patvirtinkite prašytojo tapatybę ir kliento įgaliojimą.
3. Iš `Client` įrašo vienareikšmiškai išspręskite ir audite užfiksuokite porą
   `{clientId, tenantId}`. Jei `tenantId` nėra arba mapping nevienareikšmis,
   operaciją sustabdykite, kol atskiras reviewintas sprendimas įrodo pilną
   scope; vien `clientId` tokiu atveju nėra pakankamas.
4. Pagal aktualią Prisma schemą paruoškite modelių inventorių: kuriuos modelius
   riboja `clientId`, kuriuos — `tenantId`, o kuriuos reikia pasiekti per
   patikrintą relation. Kiekvienai užklausai nurodykite vieną iš šių scope kelių.
5. Paruoškite konkrečiai porai apribotą read-only eksportą. Draudžiama
   eksportuoti „viską ir paskui atsirinkti“ arba manyti, kad visi modeliai turi
   `clientId`.
6. Įtraukite tik patvirtintą apimtį: konfigūraciją, integracijų metadata,
   inbound eventus, leadus, pokalbius/messages, response revizijas, activity ir
   outbound/delivery būsenas.
7. Antras žmogus peržiūri modelių inventorių, filtrus ir `{clientId, tenantId}`
   mapping įrodymą prieš vykdymą.
8. Failą šifruokite, perduokite sutartu saugiu kanalu ir nustatykite ištrynimo
   datą darbo kopijai.
9. Audite fiksuokite kas, kada, kokią apimtį ir kam perdavė, bet ne eksportuotų
   asmens duomenų turinį.

### Duomenų ištrynimas

1. Užregistruokite ir patvirtinkite request kaip eksporto atveju.
2. Patikrinkite sutartines, apskaitos, incidento ir teisines išsaugojimo išimtis;
   sprendimą turi patvirtinti duomenų valdytojas.
3. Pakartotinai išspręskite `{clientId, tenantId}` ir paruoškite pagal abu raktus
   apribotą modelių inventorių. Jei mapping nėra, operaciją sustabdykite. Jei
   leidžiama, sukurkite šifruotą backup su patvirtinta galiojimo data.
4. Ištrynimą įgyvendinkite vienkartiniu reviewintu scriptu/transakcija pagal
   aktualią Prisma schemą. Nenaudokite rankinių dalinių `DELETE`, kurių tvarka
   nepatikrinta su `Restrict` ir `Cascade` ryšiais.
5. Pirmiausia vykdykite staging arba atkurtame backup, tada kiekvienam
   inventoriaus modeliui atlikite nulinių likučių patikrą pagal `clientId`,
   `tenantId` arba dokumentuotą relation. Turi nelikti scope priklausančių
   eventų, messages, dispatchų, integracijų ar konfigūracijos.
6. Produkcijoje vykdykite su `EMAIL_SENDING_ENABLED=false`, išsaugokite tik
   request ID, `{clientId, tenantId}` identifikatorius, vykdytoją, laiką, script
   commit SHA ir eilučių skaičius.
7. Patvirtinkite užbaigimą prašytojui ir pašalinkite laikinas darbo kopijas.

Kol nėra produkto export/delete funkcijos, kiekvienam realiam prašymui turi
būti atskiras reviewintas operacinis pakeitimas; šis runbookas nėra leidimas
vykdyti neperžiūrėtą SQL produkcijoje.

## 9. Saugus kliento onboarding (siuntimas išjungtas)

1. Sukurkite klientą ir vieną kliento naudotoją.
2. Kartu užpildykite paslaugas, lokacijas, terminus, kainodarą, klausimus ir
   atsakymų šablonus.
3. Sukurkite vieną Web formos integraciją ir saugiai perduokite webhook URL bei
   secret kliento programuotojui; secret negali būti browser JavaScript.
4. Jei naudojamas Paslaugos.lt, sukurkite tikslų `redirect`/forward filtrą,
   išsaugantį originalų `From`, ir patikrinkite nesusijusį laišką.
5. Patvirtinkite outbound domeną, `From` ir tikrą įmonės `Reply-To` dėžutę.
6. Su `EMAIL_SENDING_ENABLED=false` atlikite signed inbound → draft → edit dry
   run ir patikrinkite, kad realaus siuntimo forma neaktyvi.
7. Paaiškinkite **Atsakyta kitur**, oficialų support kanalą, reply ribas ir kill
   switch. Tada pereikite į 10 skyriaus acceptance; siuntimo dar neįjunkite.

## 10. Produkcinis acceptance ir go-live

Atlikite visas `docs/RESEND-ROLLOUT-CHECKLIST.md` A–J dalis ir vidiniame
release įraše pažymėkite:

1. signed Web formos inbound sukūrė vieną event/message/lead/draft;
2. Super Admin testas pasiekė accepted ir delivered;
3. pilnas lead outbound sukūrė vieną `OUTBOUND` message ir dispatch;
4. delivered, bounced, complained ir suppressed teisingai matomi timeline;
5. webhook replay nesukūrė papildomo message/activity;
6. tikras Paslaugos.lt automatinis forward sukūrė vieną `PASLAUGOS_LT` lead;
7. nesusijęs kliento laiškas nebuvo persiųstas;
8. `EMAIL_SENDING_ENABLED=false` grąžintas po testų.

Gedimas taisomas atskiru mažu PR su regresiniu testu, tada kartojamas visas
susijęs scenarijus. Kai techninis acceptance žalias:

1. Su klientu atlikite vieną bendrą inbound → draft → edit → send → delivered
   scenarijų ir parodykite, kur atkeliauja kliento reply.
2. Dar kartą patvirtinkite piloto ribas, support kanalą ir incidento procedūrą.
3. Gaukite pasirašytą acceptance ir produkto savininko go-live sprendimą.
4. Tik tada palikite `EMAIL_SENDING_ENABLED=true` piloto laikotarpiui; kitu
   atveju jis lieka `false`.

## 11. 30 dienų piloto stebėjimas

- 1 savaitę Railway ir Resend tikrinami kasdien; vėliau — bent kartą per savaitę
  ir bendroje peržiūroje su klientu.
- Incidento atveju taikomas 5 skyrius ir siuntimas iškart išjungiamas.
- Fiksuojami inbound eventų, leadų/messages, dublikatų, manual-review,
  pipeline completion, laiko iki drafto/siuntimo, drafto pakeitimų, accepted,
  delivered, bounced, complained, support ir onboarding rodikliai.
- Paslaugos.lt atsakymai fiksuojami **Atsakyta kitur**; Web formos kliento reply
  vertinamas įmonės `Reply-To` dėžutėje.

Pilotas sėkmingas tik surinkus 20–50 realių in-scope užklausų, neturint
dvigubo siuntimo/cross-tenant/netaiklaus gavėjo incidentų, korektiškai matant
delivery eventus, bent 70 % draftų įvertinus kaip tinkamus su nedideliais
pakeitimais, neturint atvirų P1/P2 problemų ir praktiškai patikrinus backup,
restore, kill switch bei incidento procedūras.

## 12. Piloto uždarymas

1. Eksportuokite agreguotas metrikas be nereikalingų asmens duomenų.
2. Su klientu peržiūrėkite kriterijus, incidentus ir dažniausius draftų taisymus.
3. Priimkite dokumentuotą sprendimą: tęsti, pratęsti su pataisomis arba uždaryti.
4. Jei uždaroma, išjunkite integracijas ir siuntimą, tada vykdykite sutartą
   eksporto/ištrynimo procedūrą.
5. Auto-send nepradėkite vien dėl piloto pabaigos. Jis turi atskirą metrikomis
   pagrįstą go/no-go ir canary etapą roadmap dokumente.
