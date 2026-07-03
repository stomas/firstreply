/**
 * Central content + configuration for the landing page.
 * Keeping copy here makes it easy to tweak wording without hunting through
 * components. All user-facing text is Lithuanian.
 */

export const SITE = {
  name: "Užklausų atsakytojas",
  shortDescription:
    "Atsakykite į web formos ir Paslaugos.lt užklausas greičiau — su orientacine kaina, trūkstama informacija ir preliminariu darbų pradžios langu.",
  email: "labas@uzklausu-atsakytojas.lt",
} as const;

export const NAV_ITEMS = [
  { href: "#kaip-veikia", label: "Kaip veikia" },
  { href: "#kam-skirta", label: "Kam skirta" },
  { href: "#kaina", label: "Kaina" },
  { href: "#demo", label: "Demo" },
  { href: "#duk", label: "DUK" },
] as const;

export const HERO = {
  headline: "Atsakykite į web formos ir Paslaugos.lt užklausas greičiau",
  subheadline:
    "Klientas greitai gauna orientacinę kainą, sužino, ko trūksta tikslesniam pasiūlymui ir kada preliminariai galėtumėte pradėti.",
  primaryCta: "Gauti demo",
  secondaryCta: "Žiūrėti pavyzdžius",
  riskReversal: "Galutinę sąmatą ir terminą visada tvirtinate jūs.",
  salesAngle:
    "Nepraraskite užklausų vien todėl, kad nespėjote atrašyti tą pačią dieną.",
} as const;

export const PROBLEMS = [
  {
    title: "Klientas rašo ne vienam",
    text: "Ta pati užklausa dažniausiai išsiunčiama keliems rangovams vienu metu. Laimi tas, kuris atsako pirmas ir konkrečiai.",
  },
  {
    title: "Atsakote tik vakare",
    text: "Kol baigiate darbus objekte ir grįžtate prie telefono, klientas jau gali būti pasirinkęs kitą.",
  },
  {
    title: "Rašote tą patį iš naujo",
    text: "Kiekvienai užklausai ranka aiškinate tuos pačius dalykus: kaina priklauso nuo…, dar reikia sužinoti…, galėtume pradėti…",
  },
  {
    title: "Klausimai kartojasi",
    text: "Kaina, trūkstama informacija ir laisvi terminai — tie patys klausimai sukasi ratu kiekvieną savaitę.",
  },
] as const;

export const SOLUTION = {
  title: "Sistema paruošia arba išsiunčia atsakymą už jus",
  intro:
    "Kai ateina užklausa, sistema pagal jūsų taisykles paruošia aiškų, dalykišką atsakymą. Saugiais atvejais gali išsiųsti automatiškai, rizikingus — palieka jums patvirtinti.",
  points: [
    {
      title: "Orientacinė kaina",
      text: "Kainos rėžis pagal jūsų patvirtintas taisykles — ne prasimanytas skaičius.",
    },
    {
      title: "Trūkstami klausimai",
      text: "Sistema paklausia to, ko trūksta tikslesniam pasiūlymui: matmenų, pagrindo, nuotraukų.",
    },
    {
      title: "Preliminarus terminas",
      text: "„Galime nuo…“ tekstas pagal jūsų užimtumo lentą, be įsipareigojančios datos.",
    },
    {
      title: "Follow-up",
      text: "Jei klientas neatsako, sistema mandagiai primena vieną kartą.",
    },
    {
      title: "Rankinis patikrinimas",
      text: "Skubios, nestandartinės ar didelės užklausos keliauja jums peržiūrėti.",
    },
  ],
} as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Ateina užklausa",
    text: "Užklausa ateina iš web formos arba Paslaugos.lt.",
  },
  {
    step: 2,
    title: "Suprantama esmė",
    text: "Sistema supranta, ko klientas klausia.",
  },
  {
    step: 3,
    title: "Nustatomas kainos rėžis",
    text: "Pagal jūsų taisykles nustato kainos rėžį.",
  },
  {
    step: 4,
    title: "Patikrinama, ko trūksta",
    text: "Patikrina, kokios informacijos trūksta pasiūlymui.",
  },
  {
    step: 5,
    title: "Patikrinama užimtumo lenta",
    text: "Patikrina užimtumo lentą ir preliminarų laisvą langą.",
  },
  {
    step: 6,
    title: "Paruošiamas atsakymas",
    text: "Paruošia arba išsiunčia saugų atsakymą.",
  },
  {
    step: 7,
    title: "Padaromas follow-up",
    text: "Jei klientas neatsako, sistema padaro follow-up.",
  },
] as const;

export const SEGMENTS = [
  {
    title: "Terasos",
    text: "Termo mediena, kompozitas, pagrindas ir poliai — kainos rėžis pagal jūsų taisykles.",
  },
  {
    title: "Tvoros",
    text: "Segmentinės, dažytos ar medinės tvoros, stulpai, varteliai — su trūkstamais klausimais.",
  },
  {
    title: "Stoginės",
    text: "Automobilių stoginės ir pavėsinės — greitas orientacinis atsakymas.",
  },
  {
    title: "Vartai",
    text: "Kiemo ir įvažiavimo vartai, automatika — su preliminariu terminu.",
  },
  {
    title: "Standartiniai montavimo darbai",
    text: "Pasikartojantys montavimo darbai, kur klausimai ir kaina panašūs kiekvieną kartą.",
  },
] as const;

export type DemoStatus = "auto" | "review";

export const DEMOS: Array<{
  id: string;
  service: string;
  status: DemoStatus;
  statusLabel: string;
  inquiry: string;
  reply: string[];
}> = [
  {
    id: "demo-terasa",
    service: "Terasa",
    status: "auto",
    statusLabel: "Saugus automatinis atsakymas",
    inquiry:
      "Sveiki, domina 30 m² terasa iš termo medienos prie namo Vilniaus rajone. Kiek maždaug kainuotų ir kada galėtumėt pradėti?",
    reply: [
      "Sveiki, ačiū už užklausą!",
      "30 m² terasos iš termo medienos orientacinė kaina priklauso nuo pagrindo (ar reikia polių / rėmo), papildomų elementų ir objekto vietos. Preliminariai tokio ploto terasos kaina būtų nuo … iki … Eur, tačiau tikslią sumą pateiksime turėdami daugiau informacijos.",
      "Kad pasiūlymas būtų tikslesnis, praverstų sužinoti: ar reikia įrengti pagrindą / polius? Ar bus laiptų, turėklų? Ar yra aukščių skirtumų sklype? Jei galite, atsiųskite kelias vietos nuotraukas.",
      "Pagal esamą užimtumą tokius darbus preliminariai galėtume pradėti nuo artimiausių kelių savaičių — tikslų langą suderinsime atskirai.",
      "Tai orientacinis atsakymas, o ne galutinė sąmata. Galutinę kainą ir terminą patvirtinsime įvertinę detales.",
    ],
  },
  {
    id: "demo-tvora",
    service: "Tvora",
    status: "auto",
    statusLabel: "Saugus automatinis atsakymas",
    inquiry:
      "Reikia apie 45 m segmentinės tvoros Kaune. Domina montavimas su medžiagomis. Sklypas lygus, bet nežinau, kokių stulpų reikia. Kokia būtų kaina?",
    reply: [
      "Sveiki, ačiū, kad kreipėtės!",
      "45 m segmentinės tvoros kaina priklauso nuo ilgio, aukščio, stulpų tipo, ar reikės vartų / vartelių ir objekto sąlygų. Preliminariai su medžiagomis ir montavimu tokio ilgio tvora kainuotų nuo … iki … Eur.",
      "Kad pasiūlymas būtų tikslesnis, paklausime: kokio aukščio tvorą norite? Ar reikės vartų ir vartelių, kiek? Ar yra pageidavimų dėl spalvos / segmentų tipo? Dėl stulpų pasiūlysime tinkamą variantą — čia rūpintis nereikia.",
      "Preliminariai darbus galėtume suplanuoti artimiausiu metu pagal užimtumą — konkretų laiką suderinsime papildomai.",
      "Tai orientacinis įvertinimas, ne galutinė sąmata ir ne garantuotas terminas.",
    ],
  },
  {
    id: "demo-stogine",
    service: "Stoginė",
    status: "review",
    statusLabel: "Rankinis patikrinimas",
    inquiry:
      "Sveiki, norime stoginės dviem automobiliams, apie 6x6 m. Reikia kuo greičiau, geriausia per artimiausias 2 savaites. Ar galite padaryti ir kiek kainuotų?",
    reply: [
      "Ši užklausa pažymėta kaip reikalaujanti rankinio patikrinimo — sistema jos automatiškai neatsako.",
      "Kodėl: klientas prašo konkretaus, skubaus termino (2 savaitės), tai didesnis, individualus darbas (6×6 m stoginė), o toks atvejis neturi būti patvirtinamas automatiškai.",
      "Sistema paruošia atsakymo juodraštį su orientaciniu kainos rėžiu ir trūkstamais klausimais, bet galutinį atsakymą, kainą ir terminą patvirtinate jūs.",
      "Taip išvengiama automatinio pažado dėl skubaus termino, kurio galbūt negalėsite įvykdyti.",
    ],
  },
];

export const PRICING = {
  starter: {
    name: "Starter",
    badge: "Aktyvus",
    setup: "149 €",
    monthly: "99 €",
    monthlyNote: "/mėn.",
    setupNote: "vienkartinis paleidimas",
    highlight:
      "Iki 50 užklausų/mėn. įskaičiuota. Papildomos užklausos — €1/vnt.",
    cta: "Gauti demo",
    features: [
      "Web forma + Paslaugos.lt",
      "Iki 50 užklausų/mėn. įskaičiuota",
      "Papildomos užklausos — €1/vnt.",
      "Iki 2 paslaugų tipų",
      "Neribotai kainodaros taisyklių įtrauktoms paslaugoms",
      "Neribotai sprendimų taisyklių įtrauktoms paslaugoms",
      "AI paruoštas atsakymas",
      "Saugus automatinis siuntimas tik mažos rizikos atvejais",
      "Rankinis patikrinimas rizikingiems atvejams",
      "Užimtumo lenta",
      "Preliminarus „galime nuo“ tekstas",
      "1 follow-up seka",
      "Paprasta užklausų lenta",
      "Mėnesio suvestinė",
      "Iki 30 min. pakeitimų per mėnesį",
    ],
  },
  pro: {
    name: "Pro",
    badge: "Greit bus",
    monthly: "nuo 199 €",
    monthlyNote: "/mėn.",
    positioning:
      "Augančioms įmonėms, kurios gauna daugiau užklausų, turi kelias paslaugų kryptis ir nori daugiau automatizacijos.",
    features: [
      "Daugiau užklausų šaltinių",
      "Daugiau paslaugų tipų",
      "Daugiau užklausų per mėnesį",
      "Kelios follow-up sekos",
      "CRM integracijos",
      "Gmail / Microsoft pašto integracija",
      "Keli naudotojai",
      "Išplėstinės ataskaitos",
      "Pažangesnė užimtumo logika",
    ],
  },
} as const;

export const SAFETY = {
  title: "Kur sistemos ribos — ir kodėl tai gerai",
  intro:
    "Sistema sukurta taip, kad padėtų greičiau atsakyti, bet neprisiimtų įsipareigojimų už jus.",
  points: [
    {
      title: "AI nesugalvoja kainų",
      text: "Kainos neprasimanomos — jos skaičiuojamos tik pagal jūsų patvirtintas taisykles.",
    },
    {
      title: "Kainos iš patvirtintų taisyklių",
      text: "Jūs nustatote kainodaros ir sprendimų taisykles; sistema jų laikosi.",
    },
    {
      title: "Galutinę sąmatą tvirtina savininkas",
      text: "Klientui siunčiamas orientacinis atsakymas, o galutinį pasiūlymą tvirtinate jūs.",
    },
    {
      title: "Datos negarantuojamos automatiškai",
      text: "Siunčiamas tik preliminarus „galime nuo“ langas — jokių automatinių garantuotų terminų.",
    },
    {
      title: "Rizikingi atvejai — rankiniam patikrinimui",
      text: "Skubios, nestandartinės ar didelės individualios užklausos visada keliauja jums peržiūrėti.",
    },
  ],
} as const;

export const FAQ = [
  {
    q: "Ar sistema pati siunčia galutinę sąmatą?",
    a: "Ne. Sistema siunčia tik orientacinį atsakymą su kainos rėžiu, trūkstamais klausimais ir preliminariu terminu. Galutinę sąmatą visada tvirtinate ir siunčiate jūs.",
  },
  {
    q: "Ar AI pats sugalvoja kainas?",
    a: "Ne. Kainos skaičiuojamos tik pagal jūsų patvirtintas kainodaros taisykles. Sistema nieko neprasimano — jei taisyklės nepadengia atvejo, užklausa keliauja rankiniam patikrinimui.",
  },
  {
    q: "Kas nutinka, jei užklausa nestandartinė?",
    a: "Skubios, didelės, individualios ar neaiškios užklausos pažymimos kaip „rankinis patikrinimas“. Sistema paruošia juodraštį, bet galutinį atsakymą tvirtinate jūs.",
  },
  {
    q: "Ar veikia su Paslaugos.lt?",
    a: "Taip. Starter plane įtrauktos ir web formos, ir Paslaugos.lt užklausos. Abu šaltiniai patenka į tą pačią užklausų lentą.",
  },
  {
    q: "Kas, jei viršysiu 50 užklausų per mėnesį?",
    a: "Iki 50 užklausų/mėn. įskaičiuota. Papildomos užklausos kainuoja €1/vnt. — nieko nereikia keisti, tiesiog matysite tai mėnesio suvestinėje.",
  },
  {
    q: "Ar reikia CRM?",
    a: "Ne. Starter plane yra paprasta užklausų lenta, kurios pakanka pradžiai. CRM integracijos numatytos Pro plane, kai jų prireiks.",
  },
  {
    q: "Ar galima pradėti tik su viena paslauga?",
    a: "Taip. Starter palaiko iki 2 paslaugų tipų, bet galite pradėti ir nuo vienos — pavyzdžiui, vien terasų ar vien tvorų.",
  },
  {
    q: "Kiek laiko trunka setup?",
    a: "Paleidimas apima jūsų kainodaros ir sprendimų taisyklių bei užimtumo lentos suderinimą. Paprastai tai užtrunka kelias dienas — konkretų laiką suderiname per demo.",
  },
] as const;

export const FINAL_CTA = {
  headline: "Norite pamatyti, kaip tai atrodytų su jūsų užklausomis?",
  cta: "Gauti demo",
  subtext:
    "Per demo pereisime jūsų tipinę užklausą ir parodysime, koks atsakymas būtų paruoštas.",
} as const;

export const FOOTER = {
  description:
    "Starter sistema mažoms Lietuvos paslaugų ir montavimo įmonėms — greitesni atsakymai į web formos ir Paslaugos.lt užklausas.",
  links: [
    { href: "/privatumas", label: "Privatumo politika" },
    { href: "/salygos", label: "Naudojimosi sąlygos" },
  ],
} as const;
