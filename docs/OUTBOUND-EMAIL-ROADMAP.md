# FirstReply outbound el. pašto ir atsakymų sekimo planas

Šis dokumentas yra implementation-ready roadmap po source-specific inbound V1.
Jis skirtas būsimam įgyvendinimui, kai FirstReply turės ne tik parengti
juodraštį, bet ir žmogui patvirtinus išsiųsti atsakymą, rodyti pristatymo būseną
bei priimti kliento tęsinį į tą patį pokalbį.

Susiję dokumentai: [Inbound integracija](./INBOUND-INTEGRATION.md) ·
[Architektūra](./ARCHITEKTURA.md) ·
[Railway diegimas](./DEPLOY-RAILWAY.md) ·
[Naudotojo gidas](./NAUDOTOJO-GIDAS.md)

## Įgyvendinimo būsena

**2026-07-14 įgyvendinti 1 ir 2 etapai bei anksčiau rekomenduotas artimiausias
ticket:** Resend outbound siuntėjo tapatybė, DNS verification UI ir žmogaus
patvirtintas idempotentinis siuntimas. 3–7 etapai lieka roadmap.

Realiam produkciniam įjungimui dar būtini migracijos pritaikymas, patvirtintas
kliento domenas ir kontroliuojamas Resend/Railway smoke testas. Globalus
`EMAIL_SENDING_ENABLED` po deploy pagal nutylėjimą lieka `false`.

Šiame etape `Reply-To` yra kliento sukonfigūruota įmonės pašto dėžutė. Unikalus
pokalbio reply routing adresas ir automatinis atsakymo įkėlimas yra 4 etapas.

## 1. Dabartinė bazė

Jau įgyvendinta:

- `WEB_FORM` ir `PASLAUGOS_LT` source-specific inbound integracijos;
- `SourceIntegration → InboundEvent → ConversationMessage → Conversation → Lead`;
- draftų revizijos, `superseded` būsena ir pokalbio generacijų apsauga;
- `NEEDS_REPLY`, `WAITING_CUSTOMER`, `MANUAL_REVIEW`, `CLOSED`;
- rankinis audituojamas veiksmas **Atsakyta kitur**;
- Resend webhooko raw-body parašo tikrinimas ir tikslus gavėjo routing;
- jokio visos kliento pašto dėžutės ingest.

Dabartinė riba: FirstReply žmogui patvirtinus gali siųsti atsakymą Web formos
užklausai iš aktyvaus Resend patvirtinto kliento domeno. Delivery webhookai ir
išoriniai atsakymai dar automatiškai nesinchronizuojami. Paslaugos.lt
forwardinimo thread headeriai nėra
laikomi patikima siuntėjo tapatybe, todėl automatiškai pokalbių nesujungia.

## 2. Tikslinis naudotojo srautas

```text
Inbound užklausa
  → FirstReply parengia juodraštį
  → darbuotojas peržiūri / redaguoja
  → paspaudžia „Siųsti klientui“
  → klientas gauna laišką iš paslaugų teikėjo adreso
  → pristatymo būsena rodoma timeline
  → klientas atsako
  → patikimai routinamas atsakymas atsiranda tame pačiame pokalbyje
  → ankstesnis draftas tampa superseded
  → FirstReply parengia naują reviziją
```

Klientas neturi matyti techninio FirstReply siuntėjo kaip verslo tapatybės.
Rekomenduojamas laiškas:

```text
From: Įmonės pavadinimas <info@kliento-imone.lt>
To: užklausą pateikęs klientas
Reply-To: unikalus pokalbio atsakymo adresas
```

## 3. Patvirtinti produkto sprendimai

- Pirmas outbound provideris — **Resend**, nes jis jau naudojamas inbound.
- Produkcijoje siunčiama tik iš Resend patvirtinto kliento domeno/adreso.
- V1 siuntimas tik žmogui paspaudus **Siųsti klientui**; auto-send neįjungiamas.
- Siunčiamas redaguotas aktyvios atsakymo revizijos tekstas, o ne tyliai iš
  naujo sugeneruotas turinys.
- Kiekvienas išsiuntimas tampa tikru `OUTBOUND` conversation message.
- Dvigubas paspaudimas, request retry ar workerio restartas negali išsiųsti
  antro laiško.
- Delivery webhookai turi keisti būseną monotoniškai ir būti idempotentiški.
- Atsakymas, išsiųstas ne per FirstReply, ir toliau fiksuojamas **Atsakyta
  kitur**; fiktyvus outbound message nekuriamas.
- Gmail/Microsoft mailbox sync ir automatinis siuntimas paliekami vėlesniems
  etapams.
- Paslaugos.lt tiesioginis atsakymas neįjungiamas, kol realūs nuasmeninti
  laiškai neparodo patikimo `Reply-To` arba platformos atsakymo mechanizmo.
- Kliento bendros Inbox/Sent dėžutės FirstReply nepriima ir neprašo forwardinti.

## 4. Įgyvendinimo etapai

### Etapas 0 — inbound paleidimo užbaigimas

Prieš outbound:

1. Pritaikyti esamą Prisma migraciją produkcijoje.
2. Sukonfigūruoti `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
   `RESEND_INBOUND_DOMAIN` ir `INBOUND_SIGNING_MASTER_SECRET`.
3. Atlikti realius Web formos bei Resend/Railway smoke testus.
4. ✅ Įgyvendinta 2026-07-14 — pridėtas pirmas realiu laišku paremtas,
   nuasmenintas Paslaugos.lt fixture'as; adapteris teisingai pasirenka HTML,
   kai plain-text tėra web nuoroda, izoliuoja užklausą ir nepasitiki vien body
   įrašytu source pavadinimu. Kitų formatų fixture'ai bus kaupiami iteratyviai.
5. Užpildyti realius privatumo politikos valdytojo, saugojimo, teisinio pagrindo
   ir tarptautinių perdavimų duomenis bei atlikti teisinę peržiūrą.

**Done:** bent vienas realus kiekvieno palaikomo source eventas patikimai
sukuria vieną message/lead, retry nesukuria dublikato, o operatorius mato
diagnozuojamą rezultatą.

### Etapas 1 — outbound siuntėjo tapatybė ✅ Įgyvendinta 2026-07-14

Pridėti atskirą `OutboundIntegration`, neperkraunant inbound
`SourceIntegration` semantikos.

Siūlomi laukai:

```text
OutboundIntegration
- id
- clientId
- provider: RESEND
- status: PENDING_VERIFICATION | ACTIVE | DISABLED | FAILED
- name
- fromName
- fromEmail
- replyDomain
- providerDomainId (nullable)
- providerStatus / lastError
- createdAt / updatedAt / verifiedAt
```

Providerio API raktas lieka serverio env ir nėra saugomas kiekvieno kliento DB.
DB saugoma tik kliento tapatybė bei providerio domeno ID/būsena.

Dashboard `/dashboard/integrations` turi leisti:

- pridėti siuntėjo vardą ir adresą;
- matyti DNS patvirtinimo instrukcijas bei būseną;
- atlikti verification refresh;
- pasirinkti numatytą aktyvų siuntėją;
- išjungti siuntimą nepašalinant istorijos.

**Done:** nepatvirtintas arba svetimam klientui priklausantis siuntėjas negali
būti naudojamas; aktyvus siuntėjas aiškiai rodomas UI.

### Etapas 2 — žmogaus patvirtintas siuntimas ✅ Įgyvendinta 2026-07-14

Lead detail pridėti redaguojamą atsakymo formą:

- `From` — aktyvi kliento outbound integracija;
- `To` — serverio nustatytas ir UI rodomas kliento kontaktas;
- `Subject` — pokalbio tema su saugiu `Re:` formavimu;
- redaguojamas aktyvaus drafto tekstas;
- aiškus patvirtinimas prieš siuntimą;
- klaidos būsena ir saugus retry.

Vieša serverio sąsaja turėtų būti autentifikuotas dashboard action arba route,
pvz.:

```text
POST /api/dashboard/conversations/{conversationId}/send
```

Request turi turėti kliento sugeneruotą vienkartinį `sendRequestId`. Serveris
visada pats nustato `clientId`, conversation, gavėją ir aktyvų siuntėją; šių
tenant ribų negalima pasitikėti iš browser payload.

Siūlomas persistencijos modelis:

```text
OutboundDispatch
- id
- clientId
- conversationId
- conversationMessageId (unique)
- outboundIntegrationId
- responseRevisionId
- sendRequestId (unique per client)
- idempotencyKey (globally unique)
- status: QUEUED | SENDING | SENT | DELIVERED | BOUNCED | FAILED | COMPLAINED
- fromEmail / toEmail / replyTo / subject
- providerMessageId (unique, nullable until accepted)
- attemptCount / processingToken / lastError
- sentAt / deliveredAt / failedAt / createdAt / updatedAt
```

Siuntimo algoritmas:

1. Autorizuoti vartotoją ir tenantą.
2. Transakcijoje užrakinti lead/conversation.
3. Patikrinti, kad conversation nėra `CLOSED`, draftas vis dar aktyvus, yra
   validus gavėjas ir aktyvi patvirtinta outbound integracija.
4. Pagal `sendRequestId` atominiu būdu rezervuoti `OutboundDispatch` ir sukurti
   `OUTBOUND` `ConversationMessage` su galutiniu redaguotu tekstu.
5. Resend kviesti už DB transakcijos ribų, perduodant tą patį providerio
   idempotency key per kiekvieną retry.
6. Provideriui priėmus laišką, CAS būdu nustatyti `SENT`, provider message ID,
   `sentAt`, conversation `WAITING_CUSTOMER`, `firstResponseAt` ir lead būseną.
7. Jei procesas nutrūksta po providerio priėmimo, retry su tuo pačiu
   idempotency key turi grąžinti tą patį rezultatą, o ne siųsti dar kartą.

Negalima DB transakcijos laikyti atidarytos per tinklo kvietimą.

Įgyvendinta kaip autentifikuotas Next.js server action lead detail puslapyje.
`clientId`, gavėjas, source, aktyvi revizija ir siuntėjas nustatomi iš serverio
sesijos bei DB. V1 siuntimas leidžiamas tik `WEB_FORM`; `PASLAUGOS_LT` palieka
„Atsakyta kitur“. Prieš Resend kvietimą sukuriama nekintama message/dispatch
rezervacija, o retry naudoja tą patį raktą tik Resend 24 val. lango saugioje
23 val. riboje. Neaiškus pasenęs siuntimas pažymimas `UNKNOWN`.

**Kodas įgyvendintas:** DB rezervacija ir vienodas providerio idempotency raktas
projektuoti taip, kad dvigubas paspaudimas, paralelūs requestai ir crash/retry
sukurtų vieną outbound message bei vieną realų laišką. Disposable PostgreSQL
concurrency ir realus Resend/Railway smoke acceptance dar lieka rollout vartai.

### Etapas 3 — delivery ir bounce tracking

Resend webhooko įėjimą rekomenduojama perkelti į neutralų endpointą:

```text
POST /api/integrations/resend
```

Jis vieną kartą tikrina raw-body parašą ir dispatchina:

- `email.received` → inbound adapteriui;
- `email.sent` / `email.delivered` → outbound delivery būsenai;
- `email.bounced` / `email.failed` / `email.complained` → klaidos būsenai.

Esamą `/api/integrations/inbound/resend` laikinai palikti suderinamumui arba
per vieną release pakeisti Resend webhook URL. Negalima abiem endpointams
vienu metu apdoroti to paties event be bendros event ID deduplikacijos.

Delivery eventai saugomi su unikaliu providerio event ID. Būsenos monotoniškos:
vėliau atėjęs senesnis `sent` negali perrašyti `delivered`, o pakartotas bounce
negali sukurti antro activity.

Timeline rodo:

- „Siunčiama“;
- „Išsiųsta“;
- „Pristatyta“;
- „Nepristatyta“ su saugia diagnostika;
- „Skundas dėl spam“ ir operatoriaus veiksmą.

**Done:** webhook retry ir eventų atėjimas ne eilės tvarka nekeičia galutinės
būsenos klaidingai; bounce matomas dashboarde ir nepalieka pokalbio kaip
sėkmingai laukiančio kliento.

### Etapas 4 — kliento atsakymo routing

Kiekvienam pokalbiui sukurti unikalų atsakymo adresą, pvz.:

```text
r-<128-bit-random-token>@<reply-domain>
```

Siūlomas modelis:

```text
ConversationReplyAddress
- id
- conversationId (unique)
- clientId
- routingAddress (globally unique)
- status: ACTIVE | DISABLED
- expectedSenderEmail (nullable)
- createdAt / disabledAt
```

Adresas yra routing capability, todėl:

- naudojamas bent 128 bitų nenuspėjamas tokenas;
- niekada negaunamas iš laiško body;
- conversation ir tenant nustatomi tik pagal tikslų gavėją;
- `From`, subject, `In-Reply-To` ar `References` vieni patys negali pasirinkti
  conversation;
- uždaryto pokalbio tikras atsakymas jį vėl perkelia į `NEEDS_REPLY`;
- priedai lieka metadata-only ir verčia `MANUAL_REVIEW`.

Prieš automatinį žinutės prijungimą būtinas techninis spike: patikrinti, ar
pasirinktas inbound provideris pateikia patikimą SMTP envelope ir/arba
SPF/DKIM/DMARC rezultatą, kurio negali suklastoti pats laiškas. Kol tokio
signalo nėra:

- tikslus unikalus reply adresas leidžia rasti kandidatinį pokalbį;
- neatitinkantis laukiamo kliento adresas ar įtartina autentifikacija negali
  tyliai papildyti pokalbio;
- toks eventas keliauja į karantiną / `MANUAL_REVIEW` su aiškia priežastimi;
- raw `From + In-Reply-To` nėra pakankamas threading įrodymas.

Patikimai priėmus tęsinį:

1. Sukurti vieną `INBOUND` conversation message.
2. Pakelti `inboundVersion`.
3. Pakeisti conversation į `NEEDS_REPLY`.
4. Perleisti visą ribotą conversation kontekstą per pipeline.
5. Sukurti naują response reviziją, ankstesnę pažymėti `superseded`.

**Done:** teisėtas atsakymas atsiduria teisingame timeline, cross-tenant ir
atspėtas/spoofintas routing bandymas negali papildyti svetimo pokalbio.

### Etapas 5 — Paslaugos.lt atsakymo mechanizmas

Šis etapas pradedamas tik turint realius nuasmenintus laiškus ir atsakymų
taisykles. Reikia nustatyti:

- ar laiškas turi tikrą kliento adresą;
- ar `Reply-To` yra klientas, Paslaugos.lt relay ar no-reply;
- ar atsakymas el. paštu pasiekia klientą;
- ar būtina Paslaugos.lt platformos/API integracija;
- ar jų taisyklės leidžia automatizuotą atsakymų siuntimą.

Iki tol Paslaugos.lt lead detail rodo juodraštį ir **Atsakyta kitur**, bet
nerodo klaidinančio **Siųsti klientui** mygtuko be patikimo gavėjo.

**Done:** regresiniais fixture'ais ir realiu smoke testu įrodyta, kad pasirinktas
atsakymo kanalas pasiekia konkretų klientą ir neišsiunčia duomenų neteisingam
gavėjui.

### Etapas 6 — Gmail / Microsoft mailbox sync

Vėlesnis atskiras projektas, reikalingas tik jei darbuotojai atsakinėja už
FirstReply ribų ir tikisi automatinio Inbox/Sent timeline.

Scope:

- OAuth authorization code + PKCE;
- užšifruoti refresh tokenai ir rotacija;
- minimalūs Gmail/Microsoft scopes;
- Inbox/Sent delta sync su checkpointais;
- providerio message/thread ID deduplikacija;
- klientų ir tenantų izoliacija;
- token revoke, reconnect ir duomenų šalinimas;
- backfill ribos ir aiški retention politika.

Tai negali būti pakeista visos dėžutės forwardinimu. Pirmiausia reikia atskiro
threat model, privatumo peržiūros ir providerio app verification.

### Etapas 7 — pasirenkamas auto-send

Svarstyti tik sukaupus rankinio siuntimo statistiką. Reikalinga:

- per-client feature flag ir kill switch;
- griežta taisyklių bei confidence politika;
- draudimas siųsti esant attachments, urgency, konfliktams ar manual reason;
- rate limit, dienos limitas ir anomaly alertai;
- pilnas sprendimo, drafto, taisyklių versijos ir providerio rezultato auditas;
- canary rollout ir momentinis grįžimas prie žmogaus patvirtinimo.

## 5. Viešos sąsajos ir konfigūracija

Planuojamos sąsajos:

```text
POST /api/dashboard/conversations/{conversationId}/send
POST /api/integrations/resend
```

Esami inbound endpointai išlieka suderinami migracijos metu.

Planuojami serverio kintamieji:

```text
EMAIL_SENDING_ENABLED=false
RESEND_API_KEY=...
RESEND_WEBHOOK_SECRET=...
RESEND_INBOUND_DOMAIN=in.firstreply.lt
```

`EMAIL_SENDING_ENABLED` yra globalus avarinis kill switch. Kliento domenai ir
adresai saugomi DB kaip konfigūracija, bet providerio API secretai — tik
serverio secret store.

## 6. Saugumo ir patikimumo invariantai

- Visi dashboard send veiksmai autorizuojami pagal serverio sesiją ir aktyvų
  `Client`; browser pateiktas `clientId` ignoruojamas.
- Gavėjas nustatomas iš serverio conversation/lead duomenų. Rankinis gavėjo
  pakeitimas, jei kada nors leidžiamas, turi būti atskiras audituojamas veiksmas.
- `From` leidžiamas tik iš aktyvios tam pačiam klientui priklausančios ir
  providerio patvirtintos integracijos.
- Subject, display name ir custom headeriai validuojami nuo CR/LF header
  injection.
- Tas pats `sendRequestId` ir providerio idempotency key visada reiškia tą patį
  loginį siuntimą.
- Providerio webhooko parašas tikrinamas iš tikslaus raw body prieš JSON parse.
- Webhook event ID yra unikalus; paralelūs retry sukuria vieną būsenos pokytį.
- Būsenos gali judėti tik pirmyn pagal aiškų transition graph.
- Pilnas laiško tekstas, API raktai ir routing tokenai neloginami.
- Outbound message po siuntimo yra nekintama audito kopija; vėlesnis drafto
  redagavimas jo nepakeičia.
- Priedų turinys neanalizuojamas, kol nėra atskiro antivirusinio, dydžio ir
  privatumo sprendimo.
- Uždarymas, **Atsakyta kitur**, naujas inbound ir outbound commit naudoja lead
  lock bei conversation versijas, kad pasenęs workeris neperrašytų būsenos.

## 7. Testavimo matrica

### Siuntėjo integracija

- verified / pending / disabled / failed būsenos;
- svetimo tenant siuntėjo naudojimo blokavimas;
- keli siuntėjai vienam klientui ir tik vienas numatytasis;
- neteisingas domenas, header injection ir providerio klaida.

### Siuntimas

- validus draftas ir gavėjas;
- nėra email, draftas superseded, conversation closed;
- dvigubas paspaudimas ir tie patys/skirtingi `sendRequestId`;
- du paralelūs requestai;
- crash prieš providerį, po providerio priėmimo ir prieš DB update;
- provider timeout bei retry su tuo pačiu idempotency key;
- vienintelis outbound message / dispatch / realus laiškas invariantas.

### Delivery webhookai

- teisingas ir blogas raw-body parašas;
- dubliuotas event ID;
- delivered prieš sent ir vėlyvas sent po delivered;
- bounce, complaint, nežinomas provider message ID;
- tenant/source spoof per payload laukus.

### Kliento atsakymai

- tikslus reply routing adresas;
- nežinomas, išjungtas ar kito tenant adresas;
- expected sender match/mismatch ir nepatikima autentifikacija;
- suklastotas `From`, `In-Reply-To`, `References` ir vienoda tema;
- reply į uždarytą pokalbį;
- dublikatai, paralelūs follow-up ir stale pipeline;
- attachments bei per didelis conversation kontekstas;
- nauja response revizija ir seno drafto `superseded`.

### UI ir prieinamumas

- domeno setup ir verification būsenos;
- send confirmation, loading, klaida ir saugus retry;
- lokalizuotos delivery būsenos bei `Europe/Vilnius` laikas;
- screen reader statusai ir keyboard flow;
- Paslaugos.lt be patikimo gavėjo nerodo send veiksmo;
- **Atsakyta kitur** išlieka atskiras audituotas kelias.

### Kokybės vartai

- unit/service/route testai;
- DB concurrency testai su disposable PostgreSQL;
- typecheck, lint, format check, Prisma validate ir production build;
- Resend sandbox smoke;
- patvirtinto kliento domeno realus send/delivery/reply smoke Railway aplinkoje;
- nepriklausomas security/idempotency review;
- nepriklausomas UX/dokumentacijos review.

## 8. Rollout ir observability

1. `EMAIL_SENDING_ENABLED=false` produkcijoje po deploy.
2. Įjungti vienam vidiniam/testiniam klientui.
3. Patikrinti vieną send, delivery, bounce ir reply srautą.
4. Pilotas su 1–2 klientais, tik žmogaus patvirtintas siuntimas.
5. Stebėti duplicate prevention, provider failures, bounce rate, delivery
   laiką, reply routing klaidas ir manual-review priežastis.
6. Tik po stabilaus piloto įjungti platesniam klientų ratui.

Minimalios metrikos per klientą/integraciją:

- send attempts, accepted, delivered, bounced, complained, failed;
- laikas nuo inbound iki pirmo outbound;
- laikas nuo outbound iki kliento reply;
- idempotency duplicates ir stale retry;
- reply routing mismatch / manual review;
- pranešimų kiekis, kad vėlesnė kainodara remtųsi naudojimu.

## 9. Priimti sprendimai 1–2 etapams ir likę klausimai

Pirmiems keturiems klausimams pritaikytos rekomenduotos V1 reikšmės:

1. Ar kiekvienas klientas tvirtina savo domeną Resend? Rekomendacija — **taip**.
2. Ar vienas klientas gali turėti kelis siuntėjo adresus? Rekomendacija — modelis
   palaiko kelis, V1 UI leidžia vieną numatytąjį.
3. Ar leidžiama ranka pakeisti gavėją prieš siuntimą? Rekomendacija — V1 ne;
   pirmiausia pataisyti lead kontaktą atskiru audituojamu veiksmu.
4. Ar HTML laiškai reikalingi V1? Rekomendacija — saugus plain text su minimaliu
   serverio sugeneruotu HTML ekvivalentu, be laisvo HTML redaktoriaus.
5. Ar Resend pateikia pakankamai patikimą inbound sender auth signalą reply
   auto-attach? Jei ne, įvertinti kitą inbound providerį arba palikti karantiną.
6. Koks tikras Paslaugos.lt reply mechanizmas? Spręsti tik iš fixture'ų ir jų
   taisyklių, ne iš spėjimo.
7. Kokie konkretūs message/delivery eventų saugojimo terminai? Suderinti su
   privatumo politika prieš public rollout.

## 10. Įgyvendintas ticket ir rekomenduojamas kitas žingsnis

**✅ Įgyvendinta 2026-07-14:** Resend outbound identity ir žmogaus patvirtintas
siuntimas.

**Scope:**

- `OutboundIntegration` ir `OutboundDispatch` Prisma modeliai bei migracija;
- kliento siuntėjo/DNS verification UI;
- redaguojamas aktyvus draftas;
- autentifikuotas idempotentinis **Siųsti klientui** veiksmas;
- tikras `OUTBOUND` timeline message;
- Resend accepted/failed persistencija;
- globalus kill switch;
- testai, deployment ir naudotojo dokumentacija.

**Out of scope tam ticket:** delivery webhookų pilna būsenų matrica, inbound
reply routing, Paslaugos.lt direct reply, Gmail/Microsoft sync ir auto-send.

Tokiu skaidymu pirmas ticket saugiai pristato realų siuntimą, o delivery bei
reply tracking lieka atskiri, lengviau peržiūrimi etapai.

**Kitas rekomenduojamas ticket:** 3 etapas — idempotentinis Resend delivery,
bounce ir complaint webhookų sekimas. Reply routing ir Paslaugos.lt direct
reply į šį kitą ticket neįtraukiami.
