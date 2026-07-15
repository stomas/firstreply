/**
 * Minimized and anonymized from a real Paslaugos.lt multipart email received
 * on 2026-07-14. It intentionally preserves the production-relevant behavior:
 * the plain-text alternative only links to the web version, while the inquiry
 * itself and its field labels are present in HTML.
 */
export const realPaslaugosLtExcelAutomationFixture = {
  input: {
    subject: "Nauja: Excel automatizacija",
    from: "Paslaugos.lt <uzklausos@paslaugos.lt>",
    headers: {
      From: "Paslaugos.lt <uzklausos@paslaugos.lt>",
      "Return-Path": "<pranesimai@paslaugos.lt>",
    },
    text: "Nematote turinio? Žiūrėkite internete - https://paslaugos.lt/uzklausos/gautos/000000",
    html: `
      <!doctype html>
      <html lang="lt">
        <body>
          <table>
            <tr><td><p>Sveiki,</p></td></tr>
            <tr><td><p>Nauja bendra užklausa Nr. 000000</p></td></tr>
            <tr><td><p>Gavėjas: Testinė įmonė</p></td></tr>
            <tr><td><span>Puslapis aktyvuotas. Iškelti puslapiai gauna daugiau peržiūrų.</span></td></tr>
            <tr>
              <td>
                <p><strong>Excel automatizacija</strong></p>
                <p>Sveiki,</p>
                <p>Reikia automatizuoti Excel duomenų pertvarkymą ir sinchronizavimą.</p>
                <p>Ateityje būtų daugiau panašių darbų.</p>
                <p><strong>Terminas:</strong><br>1 mėn.</p>
                <p><strong>Biudžetas:</strong><br>Pagal susitarimą</p>
                <p><strong>Vieta:</strong> Vilnius</p>
                <a href="https://paslaugos.lt/uzklausos/gautos/000000">Peržiūrėti užklausą</a>
              </td>
            </tr>
            <tr><td>Turite klausimų? Ieškokite atsakymų pagalbos puslapyje.</td></tr>
          </table>
        </body>
      </html>
    `,
  },
  expectedText: [
    "Excel automatizacija",
    "Sveiki,",
    "Reikia automatizuoti Excel duomenų pertvarkymą ir sinchronizavimą.",
    "Ateityje būtų daugiau panašių darbų.",
    "Terminas:",
    "1 mėn.",
    "Biudžetas:",
    "Pagal susitarimą",
    "Vieta: Vilnius",
  ].join("\n"),
} as const;
