# FirstReply — naudotojo gidas

Šis gidas skirtas verslo savininkui ar administratoriui, dirbančiam su
FirstReply valdymo aplinka (`/dashboard`). Techninių žinių nereikia.

---

## Kas yra FirstReply

FirstReply iš rašytinės kliento užklausos („Sveiki, kiek kainuotų 45 m
tvoros?“) automatiškai parengia pirmą atsakymą: orientacinę kainą, trūkstamus
klausimus ir darbų terminą. Jūs visada matote, ką sistema parengė, ir
kontroliuojate, kas išeina klientui.

Sistema atsakymą parengia tik tada, kai turi iš ko: jūsų suvestos paslaugos,
kainodara, klausimai ir terminai. Kuo tvarkingesnė konfigūracija — tuo daugiau
užklausų gauna parengtą juodraštį ir tuo mažiau patenka į rankinę peržiūrą.
Automatinio siuntimo šiuo metu nėra.

## Registracija ir prisijungimas

Nauja įmonė registruojama per `/signup`. Registracija sukuria atskirą įmonės
klientą ir savininko paskyrą. Vėliau jungiamasi per `/login`; dashboarde
apačioje yra atsijungimo mygtukas. Kiekvienas įprastas vartotojas mato tik savo
įmonės duomenis.

## Meniu apžvalga

| Skiltis                                      | Kam skirta                                               |
| -------------------------------------------- | -------------------------------------------------------- |
| **Užklausos**                                | Visos gautos užklausos ir jų būsenos.                    |
| **Testavimas**                               | Saugi vieta išbandyti, kaip sistema atsakytų į užklausą. |
| **Paslaugos**                                | Jūsų paslaugų sąrašas ir jų paruošimas atsakymams.       |
| **Taisyklės**                                | Kainodara ir klausimai klientams.                        |
| **Užimtumas**                                | Kada ir kuriuose regionuose priimate užsakymus.          |
| **Integracijos**                             | Atskirai prijungiamos svetainės formos ir Paslaugos.lt.  |
| **Super Admin**                              | Techninė konfigūracija, matoma tik Super Admin paskyrai. |
| Atsakymai, Follow-up, Ataskaitos, Nustatymai | Pažymėta „GREIT“ — dar kuriama.                          |

---

## Užklausos

Sąraše matote visas užklausas su būsena:

- **response_ready** — atsakymo juodraštis parengtas.
- **manual_review** — sistemai pritrūko informacijos ar tikrumo; užklausą
  reikia peržiūrėti pačiam (priežastis nurodyta prie užklausos).

Paspaudę užklausą pamatysite: originalų kliento tekstą, source žymą, ką
sistema suprato (paslauga, išmatavimai, miestas), kokios taisyklės pritaikytos
ir visas atsakymo revizijas. Iš integracijos gautos užklausos papildomai turi
pokalbio timeline su kiekviena realia kliento žinute ir rankiniais veiksmais.

Pokalbio būsenos:

- **NEEDS_REPLY** — klientas parašė ir reikia atsakyti.
- **WAITING_CUSTOMER** — atsakėte kitame kanale ir laukiate kliento.
- **MANUAL_REVIEW** — būtina jūsų peržiūra.
- **CLOSED** — pokalbis uždarytas.

Jei atsakėte telefonu, iš savo pašto ar kitu kanalu, spauskite
**„Pažymėti, kad atsakyta kitur“**. Galite palikti pastabą. FirstReply įrašo
laiką ir vartotoją, pakeičia būseną į `WAITING_CUSTOMER` ir seną juodraštį
pažymi nebeaktualiu. Sistema nesukuria netikros išsiųstos žinutės.

Pokalbio modelis paruoštas ateities patikimai identifikuotam email thread:
tuomet FirstReply galės peržiūrėti bendrą kontekstą, parengti naują atsakymo
reviziją, o ankstesnę palikti istorijoje kaip `superseded`. V1 web forma thread
ID neturi, o Paslaugos.lt forwardinimo headeriai nėra pakankamas siuntėjo
tapatybės įrodymas. Todėl V1 kliento atsakymai automatiškai nepapildo esamo
pokalbio: Paslaugos.lt tęsinys rodomas kaip atskiras `MANUAL_REVIEW` pokalbis,
o atsakymas telefonu ar savo paštu fiksuojamas rankiniu veiksmu „Atsakyta
kitur“.

### Atsakymas iš FirstReply

Web formos užklausai, kuri turi kliento el. paštą ir aktyvų juodraštį, lead
detail rodo **Atsakyti klientui** formą. Joje matysite serverio parinktus `From`,
`To` ir `Reply-To`, galėsite pakeisti temą bei tekstą ir tik tada paspausti
**Siųsti klientui**. Laiškas siunčiamas iš jūsų patvirtinto siuntimo domeno ir
įrašomas kaip tikra outbound žinutė timeline.

Paslaugos.lt užklausoms šis mygtukas sąmoningai nerodomas, kol nepatvirtintas
platformos atsakymo mechanizmas. Naudokite Paslaugos.lt kanalą ir **Atsakyta
kitur**. FirstReply dar automatiškai neįkelia gavėjo atsakymo, tačiau timeline
rodo laiško pristatymo rezultatą: `Priimtas siųsti`, `Pristatytas`, `Pristatymas
vėluoja`, `Atmestas gavėjo`, `Pažymėtas kaip spam` arba slopinimo/klaidos
būseną. Nepristatytas laiškas dar nepasikeitusį, kliento atsakymo laukiantį
pokalbį perkelia į **Reikia peržiūros**; patikrinkite gavėjo adresą ir
nesiųskite pakartotinai aklai.

## Integracijos

Integracijų puslapyje kiekvienas šaltinis kuriamas atskirai. Integracijų
skaičius dabar neribojamas. Kortelėje matysite būseną, eventų ir žinučių
skaičius, paskutinio evento rezultatą bei prijungimo duomenis.

### Svetainės forma

Sukurkite atskirą integraciją kiekvienai norimai formai. Webhook URL ir HMAC
signing secret perduokite svetainės programuotojui arba įveskite į Make/Zapier
server-side automatizaciją. Signing secret negalima dėti į viešą formos
JavaScript — jį matytų visi svetainės lankytojai.

### Paslaugos.lt

Sukūrus integraciją gausite unikalų `p-…@…` adresą. Savo el. pašte sukurkite
automatinę taisyklę, kuri į šį adresą persiunčia **tik Paslaugos.lt
pranešimus** (pagal siuntėją ir, jei reikia, temos požymį). Rinkitės
`redirect` arba automatinio persiuntimo variantą, kuris išsaugo originalų
Paslaugos.lt `From`; paprastas rankinis `Fwd:` tam netinka.

**Visos pašto dėžutės persiųsti nereikia ir nerekomenduojama.** Kiti jūsų
laiškai lieka dabartiniuose kanaluose ir FirstReply jų negauna. Jei norite
prijungti kitą source, palaukite, kol jam bus palaikomas atskiras adapteris.

Pirmiausia išbandykite taisyklę su vienu Paslaugos.lt laišku. Jei į specialų
adresą pateks neatpažintas laiškas, sistema jo nelaikys kitu source ir
automatiškai neatsakys — jis bus pažymėtas `SOURCE_FORMAT_UNRECOGNIZED`.
Po pirmo testo būtinai patikrinkite, kad šios žymos nėra. Jei ji atsirado,
pašto provideris galėjo perrašyti `From`: pakeiskite taisyklę į originalų
siuntėją išsaugantį `redirect`/forward režimą arba palikite laišką rankinei
peržiūrai.
Laiškai su priedais taip pat lieka rankinėje peržiūroje, nes V1 analizuoja tik
priedų metadata, ne jų turinį.

Išjungus integraciją nauji eventai nepriimami. Rotuojant web formos raktą ar
Paslaugos.lt adresą senoji reikšmė iš karto nustoja veikti, todėl ją būtina
atnaujinti siuntėjo serveryje arba pašto taisyklėje.

## Testavimas

Prieš keisdami konfigūraciją ar norėdami patikrinti, kaip sistema elgiasi:

1. Atidarykite **Testavimas**.
2. Įrašykite užklausą taip, kaip ją parašytų klientas (galite palikti
   „Auto-detect“ — sistema pati atpažins paslaugą). Kainos ar termino
   klausimai ir skuba taip pat atpažįstami automatiškai iš teksto — nieko
   papildomai žymėti nereikia.
3. Spauskite pateikti ir peržiūrėkite rezultatą: parengtą atsakymą arba
   priežastį, kodėl atsakymas keliauja į peržiūrą.

Testinės užklausos niekada nesiunčiamos klientams — jos pažymimos kaip
testinės ir skirtos tik patikrinimui.

Testavimo įrankis ir realios Web formos bei Paslaugos.lt užklausos naudoja tą
patį privalomą LLM-first parserį. Tai nėra naudotojo pasirenkamas nustatymas
dashboarde; jei OpenAI nesukonfigūruotas, užklausa saugiai paliekama rankinei
peržiūrai.

## Paslaugos

Kiekviena paslauga turi kortelę su parengties būsena:

- **Paruošta** — paslauga turi viską, ko reikia atsakymams.
- **Reikia papildyti** — trūksta kažko iš sąrašo (pvz. kainodaros ar
  aprašymo); kortelė parodo, ko būtent.
- **Neaktyvi** — paslauga nenaudojama atsakymuose.

Redaguodami paslaugą galite keisti:

- **Pavadinimus** — vidinį ir trumpą, rodomą klientui.
- **Raktažodžius ir temas** — žodžius, pagal kuriuos sistema supranta, kad
  klientas kalba apie šią paslaugą (pvz. „tvora, tvoros, segmentinė“). Kuo
  daugiau natūralių formų, tuo geriau atpažįstama.
- **Atsakymą į klausimą „ar tai darote?“** — kai klientas paklausia
  „Ar darote segmentines tvoras?“ (neklausdamas kainos), sistema iš karto
  atsako jūsų įrašytu tekstu (pvz. „Taip, montuojame segmentines tvoras…“)
  ir tęsiniu, kviečiančiu tęsti pokalbį (pvz. „Jei atsiųsite tvoros ilgį ir
  aukštį, paskaičiuosiu orientacinę kainą.“). Rašyti ranka nebūtina —
  pasirinkite toną (dalykiškas / draugiškas) ir spauskite **„Sugeneruoti su
  AI“**: tekstas parašomas iš paslaugos duomenų ir užpildo laukus. Formoje
  matote gyvą pokalbio peržiūrą — kaip žinutė atrodys klientui; galite
  taisyti ir tik tada išsaugoti. Klientams visada siunčiamas tik jūsų
  patvirtintas tekstas. Kol atsakymo nėra, tokie klausimai eina į rankinę
  peržiūrą.

## Taisyklės

Puslapis suskirstytas pagal paslaugas. Kiekviena paslauga turi dvi dalis:

### Kainodara

Kainodaros taisyklė nurodo, kaip skaičiuojama orientacinė kaina:

- **Kiekis × vieneto kaina** — kaina paskaičiuojama automatiškai
  (pvz. 45 m × 38 €/m). Reikia nurodyti, iš kurio klausimo imamas kiekis.
- **Tik kainos rėžiai** — taisyklė saugo rėžius peržiūrai, tačiau dabartinis
  sprendimų variklis iš `range_estimate` automatiškai kainos drafto nekuria;
  užklausa paliekama rankinei peržiūrai.

Ką galite keisti: pavadinimą, kainos rėžius, vieneto kainą, pastabą prie
kainos (disclaimer), ar taisyklė aktyvi ir ar ji atitinka **auto-send
eligibility**. Ši žymė dabar naudojama tik sprendimo saugumui įvertinti ir
rodoma diagnostikoje — ji pati laiško neišsiunčia.

Bloke „Kaip skaičiuojama“ matote skaičiavimo struktūrą — ji keičiama tik
kartu su FirstReply komanda, kad atsakymai liktų teisingi.

### Klausimai klientui

Klausimai — tai informacija, kurios sistemai reikia kainai paskaičiuoti
(pvz. „Tvoros ilgis“). Jei klientas jos nenurodė, sistema paklausia jūsų
suformuluotu tekstu.

- **Būtinas** klausimas stabdo pilno kainos juodraščio parengimą, kol negautas
  atsakymas; sistema vietoj to gali parengti patikslinantį klausimą.
- **Papildomas** — paklausiama, bet kainos skaičiavimo nestabdo.
- **Priimamos reikšmės** (nuo–iki) apsaugo nuo nesąmonių — pvz. tvoros
  aukštis 25 m būtų atmestas ir paklausta dar kartą.

Kurdami naują klausimą nurodykite temą (pvz. Tvora) ir matmenį (ilgis,
aukštis, plotis ar plotas) — pagal tai sistema pati atpažins atsakymą
kliento tekste.

> **Patarimas:** nauja kainodaros taisyklė remiasi klausimu (iš jo imamas
> kiekis), todėl pirmiausia sukurkite klausimą, tada kainodarą. Jei paslauga
> klausimų dar neturi, vedlys pats jus nukreips.

Nebereikalingą taisyklę ar klausimą galite **ištrinti** redagavimo puslapio
apačioje (su patvirtinimu). Trynimas negrįžtamas — laikinam išjungimui
naudokite „aktyvi/aktyvus“ žymę. Klausimo, kurį naudoja aktyvi kainodaros
taisyklė, sistema ištrinti neleis — pirmiausia pakeiskite ar deaktyvuokite
tą taisyklę.

## Užimtumas

Užimtumo įrašai nurodo, kada ir kur galite priimti naujus užsakymus. Jie
tiesiogiai veikia atsakymus: kliento regiono terminas įrašomas į atsakymą
vietoj bendrojo termino.

- **Regionas** — pvz. „Vilnius“. Palikus tuščią, įrašas galioja visiems
  kitiems regionams („Kiti regionai“). Kliento regionas atpažįstamas iš
  užklausos teksto arba formos miesto laukelio.
- **Būsena** — _Priimame užsakymus_ (terminas siunčiamas), _Ribotos
  galimybės_ (terminas rodomas, bet atsakymas eina per jūsų peržiūrą) arba
  _Nepriimame_ (užklausa atiduodama jums — sistema pati neatsisako kliento).
- **Anksčiausias terminas** — tekstas klientui, pvz. „Per 3-5 savaites“.
  Būtent šis tekstas patenka į atsakymą.
- **Galioja iki** — pasibaigus datai įrašas pažymimas **Nebegalioja**,
  nebenaudojamas atsakymuose ir laukia atnaujinimo. Taip seni terminai
  niekada nepateikiami kaip aktualūs.
- **Auto-send eligibility** — jei įrašui neleidžiama, diagnostikoje bus
  blokeris. Net ir leidžiant, dabartinėje versijoje laišką vis tiek siunčia
  žmogus.

Nebereikalingą įrašą galite **ištrinti** redagavimo puslapyje (su
patvirtinimu). Laikinam paslėpimui užtenka praėjusios galiojimo datos.

## Super Admin

Super Admin yra techninis System Config puslapis testavimui ir vidiniam
administravimui. Jis matomas tik `SUPER_ADMIN` paskyrai, kuri sukuriama per
`/super-admin/signup` su serverio `SUPER_ADMIN_SIGNUP_CODE` reikšme. Šoninėje
juostoje Super Admin pasirenka aktyvų klientą; visas dashboardas ir System
Config tada rodo būtent to kliento duomenis.

Puslapis turi dvi dalis. Viršuje yra **Operational Config** — tenant-level
nustatymai, kurie galioja visam dabartiniam klientui. Žemiau yra pagal
paslaugas suskleisti core config blokai. Ant kiekvieno paslaugos bloko matote
paslaugos ID, temų, requirements ir pricing skaičius bei įspėjimus, jei yra
nepalaikomas JSON ar nutrūkusios nuorodos. Atidarykite tik tą dalį, kurią
norite taisyti.

Core config dalyje galima keisti:

- **Temos** — techniniai `subjectKey`, lietuviški pavadinimai, aprašymai ir
  sinonimai, pagal kuriuos sistema pririša faktus prie paslaugos temos.
- **Advanced requirements** — `requirementKey`, klausimo tekstas,
  `expectedFact` matavimas (tema, dimensija, vienetai), validacijos ribos,
  prioritetas ir aktyvumo žymės.
- **Pricing builder** — palaikomos `per_unit` ir `range_estimate` taisyklės,
  pagrindinis `requirementKey`, `requires`, vieneto kaina, valiuta ir iki
  5 `gte` modifierių.

Operational Config dalyje galima keisti:

- **Location zones** — administracinį kodą, zonos pavadinimą, kelionės mokestį
  ir ar vietovė aptarnaujama.
- **Schedule rules** — bendrą terminą savaitėmis (`lead_time_weeks`), kai
  nėra tikslesnio užimtumo įrašo.
- **Autosend policy** — saugos vartus `autoSendAllowed` įvertinimui. Jei policy
  dar nėra, naujas sukuriamas išjungtas (`enabled=false`). Automatinio siuntimo
  workerio dabartinėje versijoje nėra.
- **Response templates** — atsakymų šablonus su placeholder užuominomis, pvz.
  `{{priceAmount}}`, `{{currency}}`, `{{questions}}`.

Sistema saugo nuo pavojingų pakeitimų: neleis ištrinti temos, kurią naudoja
aktyvus requirement, ir neleis sugadinti aktyvios kainodaros nuorodų į
requirements. Nepalaikomas core ar operational JSON rodomas peržiūrai; jį
pakeisti galima tik išsaugojant palaikomą builder formą.

Po pakeitimų visada pasitikrinkite **Testavime**. Jei paleidžiate
`npm run db:seed`, DEV kliento konfigūracija gali būti atstatyta pagal seed
duomenis, įskaitant operational config, todėl Super Admin pakeitimus verta
patikrinti iš naujo.

## Kada užklausa patenka į rankinę peržiūrą

Sistema sąmoningai neatspėja — jei kažko trūksta ar neaišku, užklausa
atiduodama jums su priežastimi:

| Priežastis                   | Ką reiškia / ką daryti                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Paslauga dviprasmiška        | Klientas parašė tik „tvora“, o jūs turite kelias tvorų paslaugas — patikslinkite su klientu.                          |
| Nėra kainodaros taisyklės    | Paslauga neturi aktyvios kainodaros arba atsakymas gautas rėžiu (pvz. „aukštis 1.5–1.7“) — kainą patvirtinkite patys. |
| Trūksta informacijos         | Sistema parengė klausimus klientui — peržiūrėkite ir išsiųskite.                                                      |
| Regione nepriimami užsakymai | Užimtumo įraše kliento regionui pažymėta „Nepriimame“ — atsakykite pats arba atnaujinkite užimtumą.                   |
| Nėra atsakymo į „ar darote?“ | Klientas klausė „ar darote X?“, bet paslauga neturi atsakymo teksto — įrašykite jį Paslaugų puslapyje.                |

## Geros praktikos

1. **Po kiekvieno konfigūracijos pakeitimo pasitestuokite** — Testavimo
   įrankis parodo rezultatą iš karto.
2. **Auto-send eligibility įjunkite tik toms taisyklėms, kuriomis pasitikite**
   — dabar tai diagnostinis pasirengimo signalas; realų laišką vis tiek
   patvirtina ir siunčia žmogus.
3. **Atnaujinkite užimtumo galiojimo datas** — pasibaigę įrašai pažymimi
   „Nebegalioja“ ir laukia jūsų.
4. **Raktažodžius rašykite įvairiomis formomis** — „vartai, vartų, vartus“ —
   lietuvių kalbos linksniai svarbūs atpažinimui.
