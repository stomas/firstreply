/**
 * Central content + configuration for the landing page.
 * Keeping copy here makes it easy to tweak wording without hunting through
 * components. All user-facing text is Lithuanian.
 */

export const SITE = {
  name: "FirstReply",
  domain: "firstreply.lt",
  shortDescription:
    "FirstReply padeda paslaugų įmonėms greičiau atsakyti į web formos ir Paslaugos.lt užklausas su orientacine kaina, trūkstama informacija ir preliminariu darbų pradžios langu.",
  email: "labas@firstreply.lt",
} as const;

export const NAV_ITEMS = [
  { href: "#kaip-veikia", label: "Kaip veikia" },
  { href: "#kam-skirta", label: "Kam skirta" },
  { href: "#kaina", label: "Kaina" },
  { href: "/demo", label: "Pavyzdžiai" },
  { href: "#duk", label: "DUK" },
] as const;

export const HERO = {
  badge:
    "Nepraraskite užklausų vien todėl, kad nespėjote atrašyti tą pačią dieną.",
  headline: "Pirmas atsakymas klientui — per kelias minutes",
  subheadline:
    "FirstReply padeda paslaugų įmonėms greičiau atsakyti į web formos ir Paslaugos.lt užklausas: klientas gauna orientacinę kainą, sužino, ko trūksta tikslesniam pasiūlymui, ir mato preliminarų darbų pradžios langą.",
  primaryCta: "Gauti pasiūlymą",
  secondaryCta: "Žiūrėti pavyzdžius",
  riskReversal:
    "Palikite kontaktą — susisieksime, užduosime kelis klausimus ir įvertinsime, ar Starter tinka jūsų įmonei.",
  priceLine: "Starter: €149 setup + €99/mėn. · iki 50 užklausų įskaičiuota",
  // Hero "mini UI" card.
  demoCard: {
    source: "Paslaugos.lt",
    title: "Nauja užklausa",
    inquiryLabel: "Kliento užklausa",
    inquiry:
      "„Domina 30 m² terasa iš termo medienos. Kiek kainuotų ir kada galėtumėte pradėti?“",
    replyLabel: "FirstReply atsakymas klientui",
    reply:
      "Sveiki! Ačiū už užklausą. 30 m² termo medienos terasa preliminariai kainuotų apie €90–130/m². Kad pateiktume tikslų pasiūlymą, atsiųskite kelias pagrindo nuotraukas. Preliminariai galėtume pradėti maždaug po 3 savaičių.",
    // The three things FirstReply figured out from the inquiry.
    outputs: [
      { label: "Orientacinė kaina", value: "€90–130 / m²" },
      { label: "Ko dar trūksta", value: "Pagrindo nuotraukų" },
      { label: "Galimas startas", value: "~3 savaitės" },
    ],
    statusPill: "Paruošta peržiūrai",
    statusNote: "Prieš išsiunčiant atsakymą patvirtinate jūs.",
  },
} as const;

export const PROBLEM = {
  eyebrow: "Problema",
  title: "Užklausas dažniausiai laimi tas, kuris atsako pirmas",
  items: [
    {
      title: "Klientas rašo ne vienam",
      text: "Klientas dažnai parašo keliems tiekėjams vienu metu. Laimi tas, kuris pirmas aiškiai atsako.",
    },
    {
      title: "Atsakote tik vakare",
      text: "Jei atsakote tik vakare, klientas jau gali būti pasirinkęs kitą tiekėją.",
    },
    {
      title: "Rašote tą patį iš naujo",
      text: "Kaina, trūkstama informacija ir terminai kartojasi, bet vis tiek rašomi ranka.",
    },
    {
      title: "Klausimai kartojasi",
      text: "Tie patys klausimai apie plotą, miestą, nuotraukas ir terminą kartojasi kiekvieną savaitę.",
    },
  ],
} as const;

export const SOLUTION = {
  eyebrow: "Sprendimas",
  title: "FirstReply paruošia arba išsiunčia atsakymą pagal jūsų taisykles",
  intro:
    "Saugiuose atvejuose atsakymas gali būti siunčiamas automatiškai. Rizikingi ar nestandartiniai atvejai paliekami jūsų peržiūrai.",
  items: [
    {
      title: "Orientacinė kaina",
      text: "Klientas iškart mato kainos rėžį pagal jūsų patvirtintas taisykles.",
    },
    {
      title: "Trūkstami klausimai",
      text: "Sistema paprašo informacijos, kurios reikia tikslesniam pasiūlymui.",
    },
    {
      title: "Preliminarus terminas",
      text: "Parodomas atsargus „galime nuo“ darbų pradžios langas.",
    },
    {
      title: "Follow-up",
      text: "Jei klientas neatsako, išsiunčiamas vienas mandagus priminimas.",
    },
    {
      title: "Rankinis patikrinimas",
      text: "Rizikingi ar nestandartiniai atvejai paliekami jūsų peržiūrai.",
    },
  ],
  // Product preview mock.
  preview: {
    label: "Valdymo sritis",
    title: "Jūsų valdymo sritis — viskas vienoje vietoje",
    intro:
      "Visos web formos ir Paslaugos.lt užklausos suplaukia į vieną lentą. Matote kiekvieną leadą su siūloma kaina ir laisvus užimtumo langus — jums lieka peržiūrėti paruoštus atsakymus ir patvirtinti, kas siunčiama.",
  },
  leads: [
    {
      name: "J. Petrauskas",
      service: "Terasa 30 m² · Vilnius",
      status: "Auto-send",
      price: "€90–130/m²",
      tone: "brand" as const,
    },
    {
      name: "UAB Statyba",
      service: "Tvora 45 m · Kaunas",
      status: "Auto-send",
      price: "€55–80/m",
      tone: "brand" as const,
    },
    {
      name: "M. Kazlauskas",
      service: "Stoginė 6×6 m · skubu",
      status: "Peržiūra",
      price: "Tikslinama",
      tone: "warn" as const,
    },
    {
      name: "R. Jonaitis",
      service: "Vartai · laukiam atsakymo",
      status: "Follow-up",
      price: "€—",
      tone: "neutral" as const,
    },
  ],
  weeks: [
    { label: "Sav. 1", state: "Užimta", free: false },
    { label: "Sav. 2", state: "Užimta", free: false },
    { label: "Sav. 3", state: "Laisva", free: true },
    { label: "Sav. 4", state: "Laisva", free: true },
  ],
} as const;

export const HOW_IT_WORKS = {
  eyebrow: "Kaip veikia",
  title: "Aiškus, nuspėjamas kelias — nuo užklausos iki follow-up",
  intro:
    "Aiškus, nuspėjamas kelias. Jūs matote kiekvieną etapą ir kontroliuojate, kas siunčiama automatiškai.",
  steps: [
    {
      num: 1,
      title: "Ateina užklausa",
      text: "Web forma arba Paslaugos.lt pranešimas patenka į vieną vietą.",
    },
    {
      num: 2,
      title: "Suprantama esmė",
      text: "Ištraukiama paslauga, plotas, miestas ir kiti svarbūs duomenys.",
    },
    {
      num: 3,
      title: "Nustatomas kainos rėžis",
      text: "Pagal jūsų patvirtintas taisykles priskiriamas orientacinis rėžis.",
    },
    {
      num: 4,
      title: "Patikrinama, ko trūksta",
      text: "Suformuluojami tikslūs klausimai tikslesniam pasiūlymui.",
    },
    {
      num: 5,
      title: "Patikrinama užimtumo lenta",
      text: "Nustatomas preliminarus „galime nuo“ langas.",
    },
    {
      num: 6,
      title: "Paruošiamas atsakymas",
      text: "Saugiais atvejais siunčiama automatiškai, kitaip — jūsų peržiūrai.",
    },
    {
      num: 7,
      title: "Padaromas follow-up",
      text: "Jei klientas neatsako, išsiunčiamas vienas priminimas.",
    },
  ],
} as const;

export const SEGMENTS = {
  eyebrow: "Kam skirta",
  title: "Sukurta paslaugų ir montavimo verslams",
  items: [
    {
      icon: "terrace" as const,
      name: "Terasos",
      question: "„Kiek kainuotų 30 m² terasa ir kada galėtumėte pradėti?“",
      help: "FirstReply gali paprašyti informacijos apie pagrindą, medieną, laiptus, turėklus, miestą ir nuotraukas.",
    },
    {
      icon: "fence" as const,
      name: "Tvoros",
      question: "„Kiek kainuotų 45 m segmentinės tvoros montavimas?“",
      help: "Pasitikslina tvoros tipą, stulpus, sklypo reljefą, vartų poreikį ir miestą.",
    },
    {
      icon: "carport" as const,
      name: "Stoginės",
      question: "„Ar galite pastatyti stoginę dviem automobiliams?“",
      help: "Pasitikslina matmenis, dangą, pagrindą ir pageidaujamą terminą.",
    },
    {
      icon: "gate" as const,
      name: "Vartai",
      question: "„Kiek kainuotų automatiniai kiemo vartai?“",
      help: "Paklausia apie plotį, automatiką, medžiagą ir įvažiavimo tipą.",
    },
    {
      icon: "tools" as const,
      name: "Standartiniai montavimo darbai",
      question: "„Ar imatės standartinių montavimo darbų?“",
      help: "Surenka pagrindinę informaciją ir priskiria kainos rėžį pagal jūsų taisykles.",
    },
  ],
} as const;

export type DemoStatus = "auto" | "review";

export const DEMOS = {
  eyebrow: "Pavyzdžiai",
  title: "Kaip atrodo pavyzdinis FirstReply atsakymas",
  items: [
    {
      id: "demo-terasa",
      label: "Terasa",
      status: "auto" as DemoStatus,
      statusLabel: "Auto-send saugu",
      inquiry:
        "Sveiki, domina 30 m² terasa iš termo medienos prie namo Vilniaus rajone. Kiek maždaug kainuotų ir kada galėtumėt pradėti?",
      reply:
        "Ačiū už užklausą! Orientacinė kaina termo medienos terasai priklauso nuo pagrindo ir polių tipo. Tikslesniam pasiūlymui reikėtų kelių nuotraukų pagrindo bei informacijos, ar reikia laiptų ir turėklų.",
      price: "Kaina: €90–130 / m²",
      availability: "Galime nuo ~3 sav.",
      note: "",
    },
    {
      id: "demo-tvora",
      label: "Tvora",
      status: "auto" as DemoStatus,
      statusLabel: "Auto-send saugu",
      inquiry:
        "Reikia apie 45 m segmentinės tvoros Kaune. Domina montavimas su medžiagomis. Sklypas lygus, bet nežinau, kokių stulpų reikia. Kokia būtų kaina?",
      reply:
        "Dėkojame! Orientacinę kainą galime pateikti iš karto. Kad pasiūlymas būtų tikslesnis, praverstų tvoros aukštis, ar reikia vartų, bei kelios sklypo nuotraukos — stulpų tipą parinksime patys.",
      price: "Kaina: €55–80 / m",
      availability: "Galime nuo ~2 sav.",
      note: "",
    },
    {
      id: "demo-stogine",
      label: "Stoginė",
      status: "review" as DemoStatus,
      statusLabel: "Manual review",
      inquiry:
        "Sveiki, norime stoginės dviem automobiliams, apie 6x6 m. Reikia kuo greičiau, geriausia per artimiausias 2 savaites. Ar galite padaryti ir kiek kainuotų?",
      reply:
        "Ačiū už užklausą! Paruošėme orientacinę kainą, tačiau prašomas konkretus greitas terminas — jį patvirtinsime individualiai. Susisieksime dėl matmenų, dangos ir pageidaujamos datos.",
      price: "Kaina: nuo €2 800",
      availability: "Terminas tikslinamas",
      note: "Ši užklausa keliauja žmogaus peržiūrai, nes prašomas konkretus terminas ir darbas nestandartinis.",
    },
  ],
} as const;

export const PRICING = {
  eyebrow: "Kaina",
  title: "Aiški kaina, matoma iš karto",
  starter: {
    name: "Starter",
    badge: "Aktyvus planas",
    monthly: "€99",
    monthlyNote: "/mėn.",
    setupNote: "+ €149 vienkartinis setup",
    highlight:
      "Starter kaina: €149 setup + €99/mėn. Iki 50 užklausų įskaičiuota, papildomos — €1/vnt. Galutinį pasiūlymą pateikiame įvertinę jūsų užklausų kanalus ir paslaugas.",
    cta: "Gauti pasiūlymą",
    features: [
      "Web forma + Paslaugos.lt",
      "Iki 2 paslaugų tipų",
      "Neribotos taisyklės įtrauktoms paslaugoms",
      "Užimtumo lenta",
      "AI paruoštas atsakymas",
      "Auto-send saugiais atvejais",
      "Manual review rizikingiems atvejams",
      "1 follow-up seka",
      "Paprasta leadų lenta",
      "Mėnesio suvestinė",
      "Iki 30 min. pakeitimų/mėn.",
    ],
  },
  pro: {
    name: "Pro",
    badge: "Greit bus",
    monthly: "nuo €199",
    monthlyNote: "/mėn.",
    subtitle: "Daugiau apimties ir integracijų",
    ctaLabel: "Netrukus",
    features: [
      "Daugiau source’ų",
      "Daugiau paslaugų tipų",
      "Daugiau užklausų",
      "Kelios follow-up sekos",
      "CRM integracijos",
      "Gmail / Microsoft integracija",
      "Keli vartotojai",
      "Išsamesnės ataskaitos",
    ],
  },
} as const;

export const SAFETY = {
  eyebrow: "Kontrolė",
  title: "AI nepriima komercinių sprendimų už jus",
  intro: "FirstReply padeda atsakyti greičiau, bet kontrolė lieka jums.",
  items: [
    {
      icon: "check" as const,
      tone: "brand" as const,
      title: "AI nesugalvoja kainų",
      text: "Kainos imamos tik iš jūsų patvirtintų taisyklių.",
    },
    {
      icon: "shield" as const,
      tone: "brand" as const,
      title: "Galutinė sąmata — su jūsų patvirtinimu",
      text: "Sistema gali pajudinti užklausą į priekį, bet nepriima galutinio įsipareigojimo.",
    },
    {
      icon: "clock" as const,
      tone: "warn" as const,
      title: "Terminai komunikuojami atsargiai",
      text: "Naudojamas preliminarus „galime nuo“, o ne konkretus pažadas.",
    },
    {
      icon: "pause" as const,
      tone: "warn" as const,
      title: "Rizikingi atvejai stabdomi",
      text: "Skubios, nestandartinės ar neaiškios užklausos keliauja į manual review.",
    },
  ],
} as const;

export const FAQ = {
  eyebrow: "DUK",
  title: "Dažniausiai užduodami klausimai",
  items: [
    {
      q: "Ar FirstReply pati siunčia galutinę sąmatą?",
      a: "Ne. FirstReply gali paruošti arba saugiais atvejais išsiųsti pirmą atsakymą su orientacine kaina ir trūkstamais klausimais. Galutinę sąmatą ir terminą visada tvirtinate jūs.",
    },
    {
      q: "Ar AI pats sugalvoja kainas?",
      a: "Ne. Kainos imamos tik iš jūsų patvirtintų taisyklių: kainų rėžių, „nuo“ kainų, išimčių ir saugių formuluočių.",
    },
    {
      q: "Kas nutinka, jei užklausa nestandartinė?",
      a: "Tokia užklausa keliauja į manual review. Sistema paruošia draftą, bet jo automatiškai nesiunčia.",
    },
    {
      q: "Ar veikia su Paslaugos.lt?",
      a: "Taip, Starter plane Paslaugos.lt yra vienas iš pagrindinių source’ų kartu su web forma.",
    },
    {
      q: "Kas, jei viršysiu 50 užklausų per mėnesį?",
      a: "Iki 50 užklausų per mėnesį įskaičiuota. Papildomos užklausos kainuoja €1/vnt. Jei stabiliai viršijate limitą, rekomenduosime Pro planą.",
    },
    {
      q: "Ar reikia CRM?",
      a: "Ne. Starter plane pakanka paprastos leadų lentos. CRM integracijos planuojamos Pro plane.",
    },
    {
      q: "Ar galima pradėti tik su viena paslauga?",
      a: "Taip. Dažnai net geriau pradėti nuo vienos paslaugos, pvz. terasų arba tvorų, ir tik tada plėsti taisykles.",
    },
    {
      q: "Kiek laiko trunka setup?",
      a: "Įprastai 3–5 darbo dienas po to, kai gauname kelias realias užklausas, kainų taisykles ir informaciją apie užimtumą.",
    },
  ],
} as const;

export const FINAL_CTA = {
  headline: "Norite sužinoti, ar FirstReply tinka jūsų įmonei?",
  subtext:
    "Palikite kontaktą — susisieksime, paklausime apie jūsų užklausų kanalus, paslaugas, kainų taisykles ir paruošime pasiūlymą.",
  cta: "Gauti pasiūlymą",
  secondaryCta: "Žiūrėti pavyzdžius",
  formTitle: "Gaukite pasiūlymą",
  formSubtitle:
    "Palikite kontaktą — susisieksime ir įvertinsime, kaip FirstReply galėtų veikti jūsų užklausoms.",
  disclaimer:
    "Be įsipareigojimo. Pasiūlymą pateiksime tik įvertinę jūsų situaciją.",
  successTitle: "Ačiū — gavome jūsų užklausą.",
  successText:
    "Susisieksime ir užduosime kelis klausimus, kad galėtume paruošti tinkamą pasiūlymą.",
  errorText:
    "Nepavyko išsiųsti formos. Bandykite dar kartą arba parašykite mums el. paštu.",
} as const;

export const FOOTER = {
  description:
    "FirstReply — pirmo atsakymo sistema web formos ir Paslaugos.lt užklausoms.",
  nav: [
    { href: "#kaip-veikia", label: "Kaip veikia" },
    { href: "#kaina", label: "Kaina" },
    { href: "/demo", label: "Pavyzdžiai" },
    { href: "#duk", label: "DUK" },
  ],
  legal: [
    { href: "/privatumas", label: "Privatumo politika" },
    { href: "/salygos", label: "Sąlygos" },
  ],
} as const;
