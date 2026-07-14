# FirstReply inbound integracijos

Šis dokumentas aprašo V1 source-specific inbound integracijas: pasirašytą
svetainės formos webhooką ir Paslaugos.lt laiškų priėmimą per Resend.

> **Svarbiausia taisyklė:** į FirstReply nereikia ir nerekomenduojama
> persiųsti visos kliento pašto dėžutės. Kiekvienas šaltinis aktyvuojamas
> atskirai. Paslaugos.lt integracijai pašto taisyklė turi persiųsti tik
> Paslaugos.lt pranešimus.

Susiję dokumentai: [Architektūra](./ARCHITEKTURA.md) ·
[Outbound ir atsakymų roadmap](./OUTBOUND-EMAIL-ROADMAP.md) ·
[Naudotojo gidas](./NAUDOTOJO-GIDAS.md) ·
[Railway diegimas](./DEPLOY-RAILWAY.md)

## Palaikomi šaltiniai

| Šaltinis       | Transportas              | Routing                                                            |
| -------------- | ------------------------ | ------------------------------------------------------------------ |
| `WEB_FORM`     | Pasirašytas HTTP webhook | Integracijos ID URL ir iš jo versijos išvestas HMAC signing secret |
| `PASLAUGOS_LT` | Resend inbound email     | Unikalus `p-<random>@<RESEND_INBOUND_DOMAIN>` gavėjo adresas       |

Integracijų skaičius dabar neribojamas. Kiekviena integracija atskirai kaupia
eventų ir žinučių skaičių, todėl kainodara vėliau gali remtis faktiniu
naudojimu. `GENERIC_EMAIL` ir Gmail Inbox/Sent sync V1
nepalaikomi.

## Duomenų srautas

1. Transporto route patikrina raw request parašą.
2. Klientas ir source nustatomi tik pagal `SourceIntegration`: URL esantį
   integracijos ID arba tikslų Resend gavėjo adresą. Payload tekstas negali
   pakeisti source ar kliento.
3. `InboundEvent` rezervuoja išorinį event ID ir gauna vienam bandymui skirtą
   lease token. Užbaigtas ID yra replay; `FAILED` arba ilgiau nei 10 min.
   užstrigęs `PROCESSING` eventas gauna naują tokeną ir gali būti saugiai
   kartojamas. Seno workerio complete/fail write'ai tada nebegalioja.
4. Adapteris sukuria neutralų inbound message, kuris išsaugomas
   `ConversationMessage`.
5. Naujas pokalbis sukuria vieną `Lead`. Bendras modelis paruoštas patikimo
   transporto tęsiniui pagal žinomą `In-Reply-To` arba `References`: tuomet tas
   pats leadas būtų perleidžiamas per pipeline ir gautų naują atsakymo
   reviziją. Tačiau nė vienas V1 adapteris tokio automatinio tęsinio dar
   neįjungia: web forma thread ID neturi, o Paslaugos.lt forwardinimo `From`
   nėra autentifikuota SMTP tapatybė. Jo thread headeriai saugomi auditui, bet
   automatiškai nejungiami. Vienoda tema pokalbių niekada nesujungia.
6. Kiekviena inbound žinutė pakelia pokalbio generaciją. Draftas išsaugomas
   tik tai pačiai naujausiai generacijai, todėl lėtesnis paralelus pipeline
   negali perrašyti naujesnio rezultato. Ankstesnis aktyvus juodraštis tampa
   `superseded`. Sistema V1 juodraščio klientui nesiunčia.

## Svetainės forma

### Sukūrimas

1. Atidarykite `/dashboard/integrations`.
2. Sukurkite **Svetainės formos** integraciją. Galima turėti kelias formas.
3. Nukopijuokite webhook URL ir signing secret į kliento backendą, Make,
   Zapier ar kitą server-side automatizaciją.
4. Signing secret laikykite tik serveryje. Jo negalima įrašyti į viešą
   browser JavaScript, nes lankytojas galėtų pasirašyti netikras užklausas.

Endpointas:

```text
POST /api/integrations/inbound/web-form/{integrationId}
```

Privalomos antraštės:

```text
Content-Type: application/json
X-FirstReply-Timestamp: <Unix timestamp sekundėmis>
X-FirstReply-Event-Id: <unikalus siuntėjo event ID>
X-FirstReply-Signature: v1=<HMAC-SHA256 hex>
```

Pasirašoma tiksli eilutė `${timestamp}.${eventId}.${rawBody}`. Event ID yra
parašo dalis, todėl per replay jo negalima pakeisti nauju. Leidžiamas laiko
nuokrypis yra 5 minutės. `X-FirstReply-Event-Id` turi būti stabilus per retry;
naujas ID reiškia naują užklausą.

Node.js pasirašymo pavyzdys:

```ts
import { createHmac } from "node:crypto";

const body = JSON.stringify({
  name: "Jonas",
  email: "jonas@example.com",
  phone: "+37060000000",
  city: "Vilnius",
  message: "Reikia 20 m² terasos. Kiek kainuotų?",
  pageUrl: "https://example.com/kontaktai",
  submittedAt: new Date().toISOString(),
});
const timestamp = Math.floor(Date.now() / 1000).toString();
const eventId = crypto.randomUUID();
const signature = `v1=${createHmac("sha256", signingSecret)
  .update(`${timestamp}.${eventId}.${body}`)
  .digest("hex")}`;

await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-firstreply-timestamp": timestamp,
    "x-firstreply-event-id": eventId,
    "x-firstreply-signature": signature,
  },
  body,
});
```

Payload schema:

| Laukas        | Tipas                     | Riba / pastaba                        |
| ------------- | ------------------------- | ------------------------------------- |
| `message`     | string, privalomas        | 1–20 000 simbolių                     |
| `name`        | string arba null          | iki 200                               |
| `email`       | validus email arba null   | —                                     |
| `phone`       | string arba null          | iki 100                               |
| `city`        | string arba null          | iki 200                               |
| `pageUrl`     | URL arba null             | iki 2 000                             |
| `submittedAt` | ISO 8601 data su timezone | nepateikus naudojamas priėmimo laikas |

Visa raw webhook užklausa ribojama iki 64 KiB. Secret rotacija iš karto
anuliuoja seną secret; prieš patvirtinant rotaciją UI apie tai įspėja.

## Paslaugos.lt per Resend

### Operatoriaus paruošimas

1. Resend sukonfigūruokite inbound priėmimo domeną, pvz.
   `in.firstreply.lt`, ir nustatykite jį kaip `RESEND_INBOUND_DOMAIN`.
2. Resend webhooke įjunkite `email.received` įvykį į:

   ```text
   POST https://<FirstReply domenas>/api/integrations/inbound/resend
   ```

3. `RESEND_API_KEY` naudojamas pilnam laiškui paimti, o
   `RESEND_WEBHOOK_SECRET` — raw webhook parašui patikrinti.

### Kliento paruošimas

1. `/dashboard/integrations` sukurkite **Paslaugos.lt** integraciją.
2. Nukopijuokite sugeneruotą `p-<random>@...` adresą.
3. Kliento pašte sukurkite taisyklę pagal tikslų Paslaugos.lt siuntėją ir,
   jei reikia, temos požymį. Veiksmas — persiųsti į sugeneruotą adresą.
4. Patikrinkite su vienu tikru Paslaugos.lt pranešimu ir įsitikinkite, kad
   kiti laiškai nepersiunčiami.

Resend webhooko parašas tikrinamas prieš JSON interpretavimą. Integracija
parenkama pagal tikslų gavėjo adresą ir aktyvų `PASLAUGOS_LT` įrašą. Laiško
body esantis `source`, `clientId` ar panašus tekstas routing nekeičia.

Adapteris renkasi plain text, o jo nesant HTML konvertuoja į tekstą, pašalina
dažniausią forwarding boilerplate ir perduoda kontaktų, vietos, paslaugos bei
matmenų ištraukimą bendram FirstReply pipeline. Transporto siuntėjo adresas
nesaugomas kaip kliento kontaktas, nes persiunčiant tai dažniausiai yra pačios
įmonės pašto dėžutė.

Kol nėra realių nuasmenintų Paslaugos.lt fixture'ų, veikia bendras plain-text
fallback. Neatpažintas formatas lieka `MANUAL_REVIEW` su
`SOURCE_FORMAT_UNRECOGNIZED`; jis niekada neperklasifikuojamas kaip kitas
source ir automatinis atsakymas neruošiamas.

Adreso rotacija iš karto anuliuoja seną routing adresą. Po rotacijos būtina
atnaujinti kliento pašto taisyklę.

## Pokalbiai ir būsenos

| Būsena             | Reikšmė                                                        |
| ------------------ | -------------------------------------------------------------- |
| `NEEDS_REPLY`      | Yra nauja kliento žinutė ir paruoštas arba ruošiamas atsakymas |
| `WAITING_CUSTOMER` | Pažymėta, kad atsakyta kitur, ir laukiama kliento              |
| `MANUAL_REVIEW`    | Reikia žmogaus sprendimo                                       |
| `CLOSED`           | Pokalbis uždarytas                                             |

Lead detail timeline rodo tik realiai priimtas inbound žinutes ir audituotus
rankinius veiksmus. Jei darbuotojas atsakė telefonu, iš savo pašto ar kitu
kanalu, jis spaudžia **Atsakyta kitur** ir gali palikti pastabą. Tai pakeičia
būseną į `WAITING_CUSTOMER`, pažymi aktyvų juodraštį `superseded`, bet
nesukuria fiktyvaus outbound message. Web formos pokalbiui dabar galima
žmogaus patvirtinta siunta per Resend; ji sukuria tikrą `OUTBOUND` message.
Paslaugos.lt direct reply ir išoriniai atsakymai automatiškai
nesinchronizuoja; uždarytą pokalbį prieš tokį veiksmą reikia atidaryti iš naujo.

Priedų turinys V1 neanalizuojamas. Saugoma tik metadata, o visas pokalbis
pažymimas `MANUAL_REVIEW / INBOUND_ATTACHMENTS_UNPROCESSED`. Didesnis nei
20 000 simbolių bendras pokalbio kontekstas taip pat perduodamas rankinei
peržiūrai, kad pipeline nedarytų sprendimo iš nukirpto konteksto.

Source-scoped `Message-ID` turi būti unikalus. Kolizija
(`MESSAGE_ID_COLLISION`) arba `References` reikšmės, rodančios į kelis
pokalbius (`THREAD_REFERENCES_AMBIGUOUS`), nesujungiamos spėjimo būdu: žinutė
paliekama naujame rankinės peržiūros pokalbyje.

Resend Receiving API V1 nepateikia programai patikimos autentifikuoto SMTP
forwarder tapatybės. Dėl to Paslaugos.lt laiškas su `In-Reply-To` ar
`References` išsaugomas naujame `MANUAL_REVIEW` pokalbyje su priežastimi
`UNAUTHENTICATED_THREAD_REFERENCES`. Tai neleidžia trečiajai šaliai,
sužinojusiai routing adresą ir ankstesnį `Message-ID`, įterpti žinutės į esamą
pokalbį. Automatinį email threading galima įjungti tik pridėjus patikimą
envelope/SPF/DKIM/DMARC tapatybės signalą ir regresinius realių laiškų testus.

## Eventų rezultatai ir retry

| HTTP / būsena    | Reikšmė                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `200 completed`  | Lead/message išsaugotas ir pipeline užbaigtas                            |
| `200 duplicate`  | Event ID jau saugiai užbaigtas                                           |
| `401`            | Blogas arba pasenęs parašas                                              |
| `404`            | Web formos integracija neegzistuoja arba išjungta                        |
| `413`            | Raw webhook payload per didelis                                          |
| `422`            | Bloga web formos schema                                                  |
| `500`            | Apdorojimas nepavyko; eventas pažymėtas `FAILED` ir gali būti kartojamas |
| `503 processing` | Tas pats eventas dar apdorojamas; kartoti po `Retry-After`               |
| `503`            | Trūksta serverio inbound / Resend konfigūracijos                         |

`InboundEvent.errorCode` ir paskutinio evento būsena matomi Integracijų
puslapyje. `PROCESSING` dublikatas nepatvirtinamas kaip galutinai pristatytas:
route grąžina retryable `503` ir `Retry-After: 30`, kad provideris ar web
formos siuntėjas eventą pakartotų, jei pirmas workeris nutrūktų. Loguose
nefiksuojamas visas laiško ar formos turinys.

## Smoke testai

- Web forma: pasirašyti tą patį raw JSON, išsiųsti ir patikrinti, kad
  dashboarde atsirado vienas lead/message. Pakartojus tą patį event ID neturi
  atsirasti dublikato. Pakeistas body su senu parašu turi grąžinti `401`.
- Paslaugos.lt: išsiųsti vieną nuasmenintą realaus formato laišką per tikslią
  pašto taisyklę. Patikrinti source žymą, timeline ir paskutinio evento būseną.
  Tada išsiųsti nesusijusį laišką tiesiai į routing adresą — jis turi likti
  `SOURCE_FORMAT_UNRECOGNIZED`, be automatinio drafto.
- Rotacija: patvirtinti, kad senas secret arba adresas nebeveikia, o naujas
  veikia tik atnaujinus siuntėją / taisyklę.

Providerio credentialų neturinčioje CI aplinkoje atliekami unit, schema,
typecheck, lint, Prisma validate ir build testai; realūs Resend/Railway smoke
testai atliekami po deploy.
