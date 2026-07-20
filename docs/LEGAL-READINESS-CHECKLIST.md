# FirstReply legal readiness checklist

> **VIEŠAS PALEIDIMAS BLOKUOJAMAS**, kol šiame dokumente nurodytus faktus ir
> galutinį turinį raštu patvirtina teisininkas arba produkto savininkas.

Šis failas yra įvesties, peržiūros ir release kontrolinis sąrašas, o ne teisinė
konsultacija ar galutinė privatumo politika. Implementuotojas negali išgalvoti
juridinio asmens, teisinio pagrindo, retention, SLA, atsakomybės ribų ar
tarptautinių perdavimų sąlygų. Dabartiniai `/privatumas` ir `/salygos` puslapiai
lieka `noindex` projektai, kol gaunamas patvirtintas turinys.

## 1. Pateikiamas patvirtintas įvesties paketas

Produkto savininkas arba teisininkas pateikia vieną versijuotą dokumentą su:

### Privatumo informacija

- juridinio asmens pilnu pavadinimu, kodu, adresu ir kontaktu;
- duomenų apsaugos kontaktu arba DPO, jei taikoma;
- aiškiu FirstReply valdytojo/tvarkytojo vaidmenų aprašymu skirtinguose
  srautuose;
- duomenų kategorijomis ir subjektais;
- kiekvienu tvarkymo tikslu bei jo teisiniu pagrindu;
- konkrečiais saugojimo terminais arba objektyviais jų nustatymo kriterijais;
- gavėjų ir subprocesorių kategorijomis;
- tarptautinių perdavimų šalimis, mechanizmais ir papildomomis apsaugomis;
- duomenų subjekto teisėmis, jų įgyvendinimo kontaktu ir tapatybės patikra;
- kompetentinga priežiūros institucija ir patvirtinta VDAI formuluote;
- incidentų bei duomenų pažeidimų pranešimo atsakomybe.

### Naudojimosi sąlygos ir piloto sutartis

- tikslia paslaugos apimtimi ir aiškiomis out-of-scope ribomis;
- žmogaus atsakomybe peržiūrėti draftą prieš siuntimą;
- paaiškinimu, kad orientacinė kaina ar terminas nėra automatinė garantija;
- piloto trukme, support kanalu, reagavimo laiku ir pilotiniu SLA;
- kainodara, billing tvarka ir mokesčiais;
- atsakomybės apribojimais bei draudžiamu naudojimu;
- sutarties terminu, sustabdymu, nutraukimu, eksportu ir ištrynimu;
- taikytina teise, ginčų tvarka ir pranešimų kontaktais;
- aiškia pirmojo piloto reply-sync, Paslaugos.lt, auto-send ir mailbox sync
  funkcijų riba.

### DPA ir subprocesoriai

- valdytojo nurodymų bei tvarkytojo įsipareigojimų apimtimi;
- konfidencialumu, saugumo priemonėmis ir prieigos valdymu;
- duomenų subjektų užklausų, incidentų, auditų ir ištrynimo tvarka;
- subprocesorių pakeitimo/pranešimo mechanizmu;
- patvirtintu Railway, Resend, OpenAI ir kitų faktiškai naudojamų subprocesorių
  sąrašu: paslauga, juridinis tiekėjas, vieta, paskirtis, perduodami duomenys,
  perdavimo mechanizmas ir nuoroda į DPA;
- sutarties pabaigos grąžinimo/ištrynimo terminu ir backup išnykimo taisykle.

### AI ir žmogaus priežiūra

- AI paskirtimi: struktūrizavimas ir drafto rengimas;
- patvirtinta formuluote, kad piloto laišką prieš siuntimą peržiūri žmogus;
- sprendimais, kokie duomenys gali būti siunčiami AI tiekėjui;
- draudžiamomis duomenų kategorijomis ir manual-review procedūra;
- paaiškinimu klientui bei duomenų subjektui apie ribas, klaidų galimybę ir
  žmogaus kontrolę;
- sprendimu, ar ir kaip tiekėjas gali naudoti duomenis modelių mokymui, su
  sutartiniu įrodymu.

## 2. Implementavimo checklist gavus turinį

1. Įrašyti patvirtintą versiją, datą ir patvirtintoją release įraše.
2. Pakeisti `/privatumas` projektinį perspėjimą tikslia patvirtinta privatumo
   informacija.
3. Pakeisti `/salygos` placeholderį patvirtintomis sąlygomis.
4. Publikuoti patvirtintą DPA arba aiškų B2B gavimo/pasirašymo procesą.
5. Pridėti patvirtintą subprocesorių sąrašą ir jo atnaujinimo datą.
6. Sutikrinti produktinę telemetriją, logus, backup ir faktinį duomenų srautą su
   aprašytu retention bei perdavimais.
7. Atnaujinti onboarding, piloto pasiūlymą, sutartį ir support atsakymus.
8. Pašalinti projektines/placeholder formuluotes ir tik tada svarstyti `noindex`
   pakeitimą; indeksavimas nėra būtina piloto sąlyga.
9. Paleisti testą, kuris nebeleidžia grąžinti placeholderių į patvirtintus
   puslapius.
10. Gauti galutinį rašytinį legal/product go prieš viešą paleidimą.

## 3. Faktinio produkto sutikrinimas

Patvirtintojas turi žinoti šias dabartinės versijos ribas:

- priimamos source-specific Web formos ir Paslaugos.lt integracijos, ne visa
  kliento pašto dėžutė;
- priedų metadata gali būti saugoma, bet priedų turinys V1 neanalizuojamas;
- AI naudojamas lead parsing ir drafto rengimui;
- Web formos outbound siunčiamas tik žmogui patvirtinus;
- siuntimo ir delivery eventų metadata saugoma audito/idempotency tikslais;
- kliento reply keliauja į kliento `Reply-To` ir automatiškai negrįžta į
  FirstReply;
- Paslaugos.lt direct send, auto-send ir Gmail/Microsoft sync neįgyvendinti;
- eksportas/ištrynimas pirmam pilotui yra rankinė audituojama procedūra pagal
  [piloto runbook](./PILOT-OPERATIONS-RUNBOOK.md).

Jei patvirtintas tekstas teigia kitaip nei faktinis produktas, keičiamas tekstas
arba atskiru feature PR keičiamas produktas; neatitikimas negali būti paliktas
kaip žodinis pažadas.

## 4. Dabartinė būsena

- ✅ Reikalaujama legal įvestis ir release gate dokumentuoti 2026-07-20.
- ✅ Dabartiniai projektiniai puslapiai yra `noindex`.
- ⛔ Patvirtintas juridinis asmuo, retention, teisiniai pagrindai, perdavimai,
  sąlygos ir DPA šiame repo nepateikti.
- ⛔ A3 legal turinio integravimas **neįgyvendintas**, kol negaunamas aukščiau
  aprašytas patvirtintas paketas.
- ⛔ Viešas paleidimas ir pirmo mokamo piloto go lieka blokuojami iki rašytinio
  patvirtinimo.
