# Feature progress

## Feature request

Nerodyti klientui naudojamo el. pašto providerio pavadinimo (šiuo metu „Resend“).

## Workflow

1. Prepare git
2. Research
3. Ask questions
4. Propose a plan
5. Implement
6. Self-review (round 1)
7. Get CI to pass
8. Self-review (round 2)
9. Final CI check
10. Commit/Push/MR

## Notes

- Sukurta `codex/PLT-10212-hide-email-provider` šaka nuo švaraus naujausio
  `main`.
- Klientui matomas providerio vardas yra integracijų UI, lead detail būsenose,
  server action klaidose ir naudotojo gide.
- Operatoriams ir programuotojams skirtuose runbookuose, env pavadinimuose,
  webhook route bei vidiniame DB/kode providerio vardas reikalingas faktinei
  integracijai eksploatuoti.
- Privatumo puslapyje provideris įvardytas kaip el. pašto duomenų tvarkytojas;
  jo šalinimas yra ne vien UX, bet ir teisinio atskleidimo sprendimas.
- Klientui rodomų DNS įrašų reikšmės gali techniškai atskleisti providerį net
  neutralizavus visus FirstReply tekstus. Visiškam slėpimui domeno/DNS onboarding
  turėtų būti Super Admin/operatoriaus valdomas.
- Laukiama vartotojo sprendimo dėl scope; patvirtintas planas bus pridėtas po jo.

## Sprendimas

- Klientas gali pats valdyti domeną ir kopijuoti DNS įrašus.
- FirstReply klientui matomuose tekstuose providerio vardas nerašomas; naudojami
  neutralūs terminai, pvz. „siuntimo domenas“, „DNS įrašai“, „el. pašto
  siuntimo paslauga“.
- Techninės DNS reikšmės gali atskleisti infrastruktūros tiekėją ir tai priimta.
- Operatoriniai/developer dokumentai, env, webhook route, vidinis kodas ir
  privatumo atskleidimas lieka techniškai tikslūs.

## Siūlomas planas

1. Neutralizuoti `/dashboard/integrations` antraštes, veiksmų tekstus ir domeno
   būseną, nekeičiant kliento teisių ar DNS funkcionalumo.
2. Neutralizuoti klientui matomas outbound klaidas bei lead detail pristatymo,
   retry ir manual-review žinutes. Tikslūs providerio atsakymai lieka serverio
   loguose, o klientui grąžinama saugi bendrinė klaida.
3. Atnaujinti `docs/NAUDOTOJO-GIDAS.md`; operatorinius runbookus,
   architektūrą, privatumo puslapį, env ir vidinius identifikatorius palikti.
4. Pridėti regresinę patikrą, kad pasirinktuose klientų UI ir naudotojo gido
   paviršiuose neatsirastų providerio vardas.
5. Paleisti targeted testą, visus testus, typecheck, lint, Prisma validate,
   Prettier ir production build; atlikti dvi galutinio diff peržiūras.

DB migracijų nereikia.
