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
užklausų atsakoma automatiškai ir tuo mažiau patenka į rankinę peržiūrą.

## Meniu apžvalga

| Skiltis                                                    | Kam skirta                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| **Užklausos**                                              | Visos gautos užklausos ir jų būsenos.                        |
| **Testavimas**                                             | Saugi vieta išbandyti, kaip sistema atsakytų į užklausą.     |
| **Paslaugos**                                              | Jūsų paslaugų sąrašas ir jų paruošimas atsakymams.           |
| **Taisyklės**                                              | Kainodara ir klausimai klientams.                            |
| **Užimtumas**                                              | Kada ir kuriuose regionuose priimate užsakymus.              |
| **Super Admin**                                            | Testinė techninė konfigūracija, matoma tik dev/admin režimu. |
| Atsakymai, Follow-up, Ataskaitos, Integracijos, Nustatymai | Pažymėta „GREIT“ — dar kuriama.                              |

---

## Užklausos

Sąraše matote visas užklausas su būsena:

- **response_ready** — atsakymo juodraštis parengtas.
- **manual_review** — sistemai pritrūko informacijos ar tikrumo; užklausą
  reikia peržiūrėti pačiam (priežastis nurodyta prie užklausos).

Paspaudę užklausą pamatysite: originalų kliento tekstą, ką sistema suprato
(paslauga, išmatavimai, miestas), kokios taisyklės pritaikytos ir parengtą
atsakymo tekstą.

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
- **Tik kainos rėžiai** — klientui rodomi rėžiai „nuo–iki“, o galutinę kainą
  patvirtinate patys.

Ką galite keisti: pavadinimą, kainos rėžius, vieneto kainą, pastabą prie
kainos (disclaimer), ar taisyklė aktyvi ir ar leidžiamas **auto-send**
(atsakymas gali išeiti be jūsų peržiūros).

Bloke „Kaip skaičiuojama“ matote skaičiavimo struktūrą — ji keičiama tik
kartu su FirstReply komanda, kad atsakymai liktų teisingi.

### Klausimai klientui

Klausimai — tai informacija, kurios sistemai reikia kainai paskaičiuoti
(pvz. „Tvoros ilgis“). Jei klientas jos nenurodė, sistema paklausia jūsų
suformuluotu tekstu.

- **Būtinas** klausimas stabdo automatinį atsakymą, kol negautas atsakymas.
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
- **Auto-send** — jei įrašui neleidžiamas, atsakymai su šiuo terminu visada
  eina per jūsų peržiūrą.

Nebereikalingą įrašą galite **ištrinti** redagavimo puslapyje (su
patvirtinimu). Laikinam paslėpimui užtenka praėjusios galiojimo datos.

## Super Admin

Super Admin yra techninis System Config puslapis testavimui ir vidiniam
administravimui. Jis matomas lokaliai/dev aplinkoje; produkcijoje pasirodo tik
tada, kai sąmoningai įjungtas `SUPER_ADMIN_ENABLED=true`.

Puslapis suskirstytas pagal paslaugas, o paslaugų blokai iš pradžių
suskleisti. Ant kiekvieno bloko matote paslaugos ID, temų, requirements ir
pricing skaičius bei įspėjimus, jei yra nepalaikomas JSON ar nutrūkusios
nuorodos. Atidarykite tik tą paslaugą, kurią norite taisyti.

Ką galima keisti MVP 1:

- **Temos** — techniniai `subjectKey`, lietuviški pavadinimai, aprašymai ir
  sinonimai, pagal kuriuos sistema pririša faktus prie paslaugos temos.
- **Advanced requirements** — `requirementKey`, klausimo tekstas,
  `expectedFact` matavimas (tema, dimensija, vienetai), validacijos ribos,
  prioritetas ir aktyvumo žymės.
- **Pricing builder** — palaikomos `per_unit` ir `range_estimate` taisyklės,
  pagrindinis `requirementKey`, `requires`, vieneto kaina, valiuta ir iki
  5 `gte` modifierių.

Sistema saugo nuo pavojingų pakeitimų: neleis ištrinti temos, kurią naudoja
aktyvus requirement, ir neleis sugadinti aktyvios kainodaros nuorodų į
requirements. Nepalaikomas `rule` JSON rodomas peržiūrai; jį pakeisti galima
tik išsaugojant palaikomą builder formą.

Po pakeitimų visada pasitikrinkite **Testavime**. Jei paleidžiate
`npm run db:seed`, DEV kliento konfigūracija gali būti atstatyta pagal seed
duomenis, todėl Super Admin pakeitimus verta patikrinti iš naujo.

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
2. **Auto-send įjunkite tik toms taisyklėms, kuriomis pasitikite** — visos
   kitos užklausos vis tiek gaus parengtą juodraštį, tik su jūsų peržiūra.
3. **Atnaujinkite užimtumo galiojimo datas** — pasibaigę įrašai pažymimi
   „Nebegalioja“ ir laukia jūsų.
4. **Raktažodžius rašykite įvairiomis formomis** — „vartai, vartų, vartus“ —
   lietuvių kalbos linksniai svarbūs atpažinimui.
