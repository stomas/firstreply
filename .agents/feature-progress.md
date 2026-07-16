# Feature progress

## Feature request

Sukurti atskirą testinio el. laiško puslapį, kurį būtų galima deployinti į
Railway ir patikrinti realų siuntimą per jau sukonfigūruotą kliento domeną.

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

- Šaka: `codex/PLT-10212-test-email-page`, sukurta nuo švaraus naujausio
  `main`.
- Testas turi naudoti esamą autentifikaciją, dabartinio kliento kontekstą ir
  patvirtintą numatytąjį siuntėją; jokių API raktų ar providerio pavadinimo UI.
- Tyrimo išvados, sprendimai ir patvirtintas planas bus pildomi žemiau.

## Research

- Esamas realus siuntimas yra susietas su `Lead`, `Conversation`, aktyvia
  `LeadResponse` revizija ir `OutboundDispatch`; jo negalima tiesiogiai
  panaudoti savarankiškai testinei formai be dirbtinio pokalbio kūrimo.
- Dabartinis rollout smoke testas reikalauja per pasirašytą Web formos webhooką
  sukurti leadą, tada siųsti iš lead detail. Tai pilnas E2E testas, bet
  nepatogus greitam Railway konfigūracijos patikrinimui.
- Greitam testui galima sukurti atskirą autentifikuotą formą, kuri serverio
  pusėje pasirenka dabartinio kliento aktyvų, `verified`, numatytąjį siuntėją,
  gerbia `EMAIL_SENDING_ENABLED`, validuoja gavėją/temą/tekstą ir siunčia su
  vienkartiniu idempotency raktu.
- Toks greitas testas patvirtins API raktą, domeną, From/Reply-To ir faktinį
  gavimą, tačiau be DB `OutboundDispatch` negalės rodyti webhook delivery
  būsenos FirstReply timeline. Pilnam E2E ir toliau reikalingas Web formos
  lead smoke testas.
- UI turi aiškiai įspėti, kad laiškas bus realiai išsiųstas, prieš siuntimą
  paprašyti patvirtinimo ir po atsakymo parodyti programiškai atpažįstamą
  success/error statusą.
- Oficialus siuntimo API palaiko iki 24 val. galiojantį idempotency raktą;
  saugiam pakartotiniam submit būtinas unikalus request ID.

## Open questions

- Kas gali naudoti testinį puslapį: tik Super Admin ar visi autentifikuoti
  kliento vartotojai?
- Ar reikalingas tik greitas realaus gavimo testas, ar pilnas DB/timeline bei
  webhook delivery E2E?
- Ar gavėjo adresas laisvai įvedamas, ar ribojamas saugiais testiniais adresais?
