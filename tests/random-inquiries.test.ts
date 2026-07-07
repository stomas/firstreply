import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDeterministicFacts } from "../lib/extractor/deterministic";
import type {
  DeterministicExtractionResult,
  MeasurementDimension,
} from "../lib/extractor/types";

type InquiryCase = {
  label: string;
  text: string;
  length?: number;
  lengthRange?: [number, number];
  width?: number;
  height?: number;
  area?: number;
  noMeasurements?: boolean;
  quantities?: number[];
  asksPrice?: boolean;
  asksAvailability?: boolean;
  urgent?: boolean;
  locationCode?: string;
  phone?: string;
  email?: string;
  dateValues?: string[];
  hasNegatedSelection?: boolean;
};

const inquiryCases: InquiryCase[] = [
  {
    label: "formal complete fence request in Vilnius",
    text: "Sveiki, domina skardinė tvora Vilniuje, ilgis 45 m, aukštis 1,7 m. Kiek kainuotų ir kada galėtumėte montuoti?",
    length: 45,
    height: 1.7,
    asksPrice: true,
    asksAvailability: true,
    locationCode: "vilniaus_m_sav",
  },
  {
    label: "formal rural municipality request",
    text: "Laba diena, Vilniaus rajone reikėtų apie 40 metrų segmentinės tvoros, aukštis 1,5 m.",
    length: 40,
    height: 1.5,
    locationCode: "vilniaus_r_sav",
  },
  {
    label: "clear skardine request with price",
    text: "Reikia skardinės tvoros 30 m ir 1.8 m aukščio, prašau kainos.",
    length: 30,
    height: 1.8,
    asksPrice: true,
  },
  {
    label: "segment count before per item length",
    text: "Hey, reikia 2 segmentu po 2m ir 1.5m aukščio. Kiek kainuos?",
    length: 4,
    height: 1.5,
    asksPrice: true,
  },
  {
    label: "per item length before segment count",
    text: "Hey, ždž reikia 2m segmento kokius 2 vienetus ir 1.5m aukščio. Kiek kainuos?",
    length: 4,
    height: 1.5,
    asksPrice: true,
  },
  {
    label: "multiplier segment syntax",
    text: "Reikia 2x2m segmentų, aukštis 1.5m.",
    length: 4,
    height: 1.5,
  },
  {
    label: "word count with dalys",
    text: "Reikia dvi dalys po 2m ir 1.5m aukščio.",
    length: 4,
    height: 1.5,
  },
  {
    label: "three longer segments",
    text: "Reikėtų 3 segmentai po 2.5m, aukštis 1.7m.",
    length: 7.5,
    height: 1.7,
  },
  {
    label: "four skydai per item",
    text: "Domina 4 skydai po 2m, aukštis 1.5m.",
    length: 8,
    height: 1.5,
  },
  {
    label: "range with urgent intent",
    text: "Tvora apie 40-50 metru, aukštis 1.7 m, skubiai.",
    lengthRange: [40, 50],
    height: 1.7,
    urgent: true,
  },
  {
    label: "approximate single length",
    text: "Sveiki, apie 35 m tvoros, aukštis 1.6m, kokia kaina?",
    length: 35,
    height: 1.6,
    asksPrice: true,
  },
  {
    label: "area plus height",
    text: "Objektas 120 kv.m, tvoros aukštis 1,5 m.",
    area: 120,
    height: 1.5,
  },
  {
    label: "gate width and height",
    text: "Vartai 4 m pločio ir 1.6m aukščio, ar galite pagaminti?",
    width: 4,
    height: 1.6,
  },
  {
    label: "explicit width and height",
    text: "Plotis 3,5 m, aukštis 1,5 m, reikia vartų pasiūlymo.",
    width: 3.5,
    height: 1.5,
    asksPrice: true,
  },
  {
    label: "accusative meters wording",
    text: "Reikėtų 55 metrus tvoros, aukštis 1.8m.",
    length: 55,
    height: 1.8,
  },
  {
    label: "compact segmentine request",
    text: "Segmentinės tvoros 65 m, 1,7 m aukščio.",
    length: 65,
    height: 1.7,
  },
  {
    label: "casual approximate fence",
    text: "Gal kokių 22 metru tvora, 1.5m aukščio?",
    length: 22,
    height: 1.5,
  },
  {
    label: "centimeter height",
    text: "Reikia tvoros 18 m, aukštis 150 cm.",
    length: 18,
    height: 150,
  },
  {
    label: "millimeter height and length",
    text: "Aukštis 1800 mm, ilgis 20 m, domina segmentinė tvora.",
    height: 1800,
    length: 20,
  },
  {
    label: "from to range",
    text: "Nuo 30 iki 35 m tvoros, aukštis 1,6 m.",
    lengthRange: [30, 35],
    height: 1.6,
  },
  {
    label: "about seventy meters",
    text: "Segmentinė tvora apie 70m, 1.5m aukštis.",
    length: 70,
    height: 1.5,
  },
  {
    label: "ten numeric segments",
    text: "Reikia 10 segmentu po 2m, 1.7m aukščio.",
    length: 20,
    height: 1.7,
  },
  {
    label: "ten word segments",
    text: "Reik dešimt segmentų po 2m, aukštis 1.7m.",
    length: 20,
    height: 1.7,
  },
  {
    label: "noun first with item unit",
    text: "Segmentų 5 vnt po 2.5m, aukštis 1.5m.",
    length: 12.5,
    height: 1.5,
  },
  {
    label: "spaced multiplier syntax",
    text: "Reikia 5 x 2 m segmentų, 1.5m aukščio.",
    length: 10,
    height: 1.5,
  },
  {
    label: "reversed skydai count",
    text: "Reikia 2 metrų skydų 6 vienetus, 1.5m aukščio.",
    length: 12,
    height: 1.5,
  },
  {
    label: "skydai noun first",
    text: "Skydai 6 vnt po 2m, aukštis 1.7m.",
    length: 12,
    height: 1.7,
  },
  {
    label: "no spaces around units",
    text: "Reikia tvoros 45metrai ir 1,7metro aukščio.",
    length: 45,
    height: 1.7,
  },
  {
    label: "gate quantity with fence measurements",
    text: "45m tvora, 1,7m aukščio, 2 vartai.",
    length: 45,
    height: 1.7,
    quantities: [2],
  },
  {
    label: "negated gate with fence measurements",
    text: "45 m tvora, vartų nereikia, 1.7 m aukščio.",
    length: 45,
    height: 1.7,
    hasNegatedSelection: true,
  },
  {
    label: "decimal length and height",
    text: "Tvoros 33.5 m, aukštis 1.53 m.",
    length: 33.5,
    height: 1.53,
  },
  {
    label: "comma decimal length",
    text: "Tvoros apie 12,5 metro, aukštis 1,2 m.",
    length: 12.5,
    height: 1.2,
  },
  {
    label: "height before length",
    text: "Reikia segmentinės tvoros 0.8 m aukščio ir 14 m ilgio.",
    height: 0.8,
    length: 14,
  },
  {
    label: "gate opening width",
    text: "Vartų anga 4 m pločio, vartai 1.7 m aukščio.",
    width: 4,
    height: 1.7,
  },
  {
    label: "urgent high fence",
    text: "Tvora 80 m, aukštis 2 m, skubiai.",
    length: 80,
    height: 2,
    urgent: true,
  },
  {
    label: "partial length only",
    text: "Reikia tvoros 45m.",
    length: 45,
  },
  {
    label: "related price question without variables",
    text: "Kiek kainuos tvora?",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "related service question with city",
    text: "Ar montuojate segmentines tvoras Vilniuje?",
    noMeasurements: true,
    locationCode: "vilniaus_m_sav",
  },
  {
    label: "repair question without variables",
    text: "Turim skardinę tvorą, reikia remonto.",
    noMeasurements: true,
  },
  {
    label: "deadline question without variables",
    text: "Koks terminas tvoros montavimui?",
    noMeasurements: true,
    asksAvailability: true,
  },
  {
    label: "warranty question without variables",
    text: "Ar duodate garantiją segmentinei tvorai?",
    noMeasurements: true,
  },
  {
    label: "gate automation price without variables",
    text: "Reikia vartų automatikos, kaina?",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "phone contact without variables",
    text: "Skambinkit +370 612 34567 dėl tvoros.",
    noMeasurements: true,
    phone: "+37061234567",
  },
  {
    label: "email contact without variables",
    text: "El. paštas jonas@example.com, reikia tvoros pasiūlymo.",
    noMeasurements: true,
    email: "jonas@example.com",
    asksPrice: true,
  },
  {
    label: "municipality without variables",
    text: "Vilniaus rajone reikia tvoros.",
    noMeasurements: true,
    locationCode: "vilniaus_r_sav",
  },
  {
    label: "kaunas with length only",
    text: "Kaune reikėtų tvoros 60 m.",
    length: 60,
    locationCode: "kauno_m_sav",
  },
  {
    label: "trakai length only",
    text: "Trakai, domina tvora 25 m.",
    length: 25,
  },
  {
    label: "numeric quantities without measurements",
    text: "Reikia 2 vartai ir 1 varteliai.",
    noMeasurements: true,
    quantities: [2, 1],
  },
  {
    label: "word and numeric quantities",
    text: "Reikia trys varteliai ir 2 vartai.",
    noMeasurements: true,
    quantities: [3, 2],
  },
  {
    label: "negated gate with length",
    text: "Vartų nereikia, tik tvora 30 m.",
    length: 30,
    hasNegatedSelection: true,
  },
  {
    label: "without gates with length",
    text: "Be vartų, tvora 20 m.",
    length: 20,
    hasNegatedSelection: true,
  },
  {
    label: "height only related",
    text: "Tvoros aukštis 1.5m, ilgis dar neaiškus.",
    height: 1.5,
  },
  {
    label: "length range only",
    text: "Tvoros ilgis apie 45-55 m.",
    lengthRange: [45, 55],
  },
  {
    label: "area and height related",
    text: "Plotas 90 kv m, tvoros aukštis 1.5 m.",
    area: 90,
    height: 1.5,
  },
  {
    label: "site visit availability question",
    text: "Galit atvykti apžiūrai?",
    noMeasurements: true,
    asksAvailability: true,
  },
  {
    label: "very informal complete request",
    text: "Yo, reik tvoros 45m, aukstis 1.7m, kiek?",
    length: 45,
    height: 1.7,
  },
  {
    label: "slang segment request",
    text: "Sveiki, ždž segmentai 2 vnt po 2m, hmmm 1.5m aukscio.",
    length: 4,
    height: 1.5,
  },
  {
    label: "typo-ish fence length",
    text: "Twr reik 35 m 1.6 m aukščio.",
    length: 35,
    height: 1.6,
  },
  {
    label: "casual skardine price",
    text: "Man reik skardines tvoros 18 m; 1.8m aukscio; kaina pls.",
    length: 18,
    height: 1.8,
    asksPrice: true,
  },
  {
    label: "reversed three segments",
    text: "Reikėtų 2m segmento 3 vnt, aukstis 1.5m.",
    length: 6,
    height: 1.5,
  },
  {
    label: "plus separated segments",
    text: "3 segmentus po 2 m + aukstis 1.5m.",
    length: 6,
    height: 1.5,
  },
  {
    label: "word count noun first",
    text: "Segmentai: trys po 2m, aukstis 1.5m.",
    length: 6,
    height: 1.5,
  },
  {
    label: "two parts decimal",
    text: "Dvi dalys po 2,5m, aukštis 1,5m.",
    length: 5,
    height: 1.5,
  },
  {
    label: "four skydai informal",
    text: "Keturi skydai po 2m ir 1.7m aukscio.",
    length: 8,
    height: 1.7,
  },
  {
    label: "compact multiplier plus height",
    text: "2x2m segmentu + dar 1.5m aukstis.",
    length: 4,
    height: 1.5,
  },
  {
    label: "spaced multiplier dalys",
    text: "2 x 2 m dalys, aukstis 1.5m.",
    length: 4,
    height: 1.5,
  },
  {
    label: "length and centimeter height",
    text: "Tvoros reik: ilgis 52 m, aukstis 170 cm.",
    length: 52,
    height: 170,
  },
  {
    label: "approximate short range",
    text: "Apie 15-18 m tvoros, aukstis 1.5 m.",
    lengthRange: [15, 18],
    height: 1.5,
  },
  {
    label: "without gates informal",
    text: "Tvoros 16 m be vartų, 1.5m aukščio.",
    length: 16,
    height: 1.5,
    hasNegatedSelection: true,
  },
  {
    label: "unrelated work hours question",
    text: "Kada šiandien dirbate?",
    noMeasurements: true,
    asksAvailability: true,
  },
  {
    label: "unrelated website question",
    text: "Ar kuriate interneto svetaines?",
    noMeasurements: true,
  },
  {
    label: "unrelated price question",
    text: "Kiek kainuoja konsultacija dėl marketingo?",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "unrelated accounting help",
    text: "Reikia pagalbos su buhalterija, ar galit?",
    noMeasurements: true,
  },
  {
    label: "weather question",
    text: "Sveiki, kokios oro sąlygos rytoj?",
    noMeasurements: true,
  },
  {
    label: "warehouse question",
    text: "Ar turite sandėlyje varžtų?",
    noMeasurements: true,
  },
  {
    label: "project without details",
    text: "Noriu pasikalbėti apie projektą be detalių.",
    noMeasurements: true,
  },
  {
    label: "email address question",
    text: "Koks jūsų el. paštas?",
    noMeasurements: true,
  },
  {
    label: "weekend work question",
    text: "Ar dirbate savaitgaliais?",
    noMeasurements: true,
  },
  {
    label: "noise words",
    text: "Testas testas vienas du trys.",
    noMeasurements: true,
  },
  {
    label: "form smoke message",
    text: "Labas, tiesiog tikrinu formą.",
    noMeasurements: true,
  },
  {
    label: "callback request",
    text: "Gal galite paskambinti?",
    noMeasurements: true,
  },
  {
    label: "delivery price question without variables",
    text: "Kiek kainuoja pristatymas?",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "free time question",
    text: "Ar turite laisvų laikų šiandien?",
    noMeasurements: true,
    asksAvailability: true,
  },
  {
    label: "warranty generic",
    text: "Noriu paklausti apie garantiją.",
    noMeasurements: true,
  },
  {
    label: "delivery to nida without variables",
    text: "Ar vežate į Nidą?",
    noMeasurements: true,
  },
  {
    label: "coastal suitability question",
    text: "Ar skardinė tvora tinka prie jūros?",
    noMeasurements: true,
  },
  {
    label: "fence color question",
    text: "Kokia spalva populiariausia tvorai?",
    noMeasurements: true,
  },
  {
    label: "without foundation question",
    text: "Ar galite padaryti be pamato?",
    noMeasurements: true,
    hasNegatedSelection: true,
  },
  {
    label: "warranty years question",
    text: "Kiek metų garantija tvorai?",
    noMeasurements: true,
  },
  {
    label: "after hours question",
    text: "Ar atsakote po darbo valandų?",
    noMeasurements: true,
  },
  {
    label: "promotion question",
    text: "Ar yra akcija segmentinei tvorai?",
    noMeasurements: true,
  },
  {
    label: "price but data later",
    text: "Kiek kainuos montavimas, jei duomenis atsiųsiu vėliau?",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "fence with unknown length",
    text: "Reikia tvoros, bet ilgio dar nematavau.",
    noMeasurements: true,
  },
  {
    label: "proposal with unknown height",
    text: "Reikia pasiūlymo tvorai, aukštis nežinomas.",
    noMeasurements: true,
    asksPrice: true,
  },
  {
    label: "next week without measurements",
    text: "Ar galit sumontuoti kitą savaitę?",
    noMeasurements: true,
    asksAvailability: true,
    dateValues: ["next_week"],
  },
  {
    label: "by august without dimensions",
    text: "Tvoros noriu iki rugpjucio, matmenų dar nėra.",
    noMeasurements: true,
    dateValues: ["by_august"],
  },
  {
    label: "klaipeda related without variables",
    text: "Klaipėdoje domina tvora.",
    noMeasurements: true,
    locationCode: "klaipedos_m_sav",
  },
  {
    label: "panevezys consultation without variables",
    text: "Panevėžyje reikia konsultacijos dėl tvoros.",
    noMeasurements: true,
    locationCode: "panevezio_m_sav",
  },
  {
    label: "general catalog question without variables",
    text: "Ar galite atsiųsti tvorų katalogą?",
    noMeasurements: true,
  },
  {
    label: "photo based estimate question",
    text: "Atsiųsiu nuotraukas, galite preliminariai įvertinti?",
    noMeasurements: true,
  },
];

describe("random inquiry syntax corpus", () => {
  it("keeps the corpus at 100 stable unique inquiries", () => {
    assert.equal(inquiryCases.length, 100);
    assert.equal(
      new Set(inquiryCases.map((testCase) => testCase.text)).size,
      100,
    );
  });

  it("parses 100 mixed inquiries without inventing or losing expected signals", () => {
    for (const testCase of inquiryCases) {
      const result = extractDeterministicFacts(testCase.text);

      assert.equal(result.schemaVersion, "lead_parse_v2", testCase.label);

      if (testCase.noMeasurements) {
        assert.equal(
          hasMeasurement(result),
          false,
          `${testCase.label}: expected no measurement facts`,
        );
      }

      assertMeasurementValue(result, "length", testCase.length, testCase.label);
      assertMeasurementValue(result, "width", testCase.width, testCase.label);
      assertMeasurementValue(result, "height", testCase.height, testCase.label);
      assertMeasurementValue(result, "area", testCase.area, testCase.label);
      assertMeasurementRange(
        result,
        "length",
        testCase.lengthRange,
        testCase.label,
      );

      if (testCase.quantities) {
        assert.deepEqual(
          result.facts
            .filter((fact) => fact.kind === "quantity")
            .map((fact) => fact.value),
          testCase.quantities,
          `${testCase.label}: quantity values`,
        );
      }

      if (testCase.asksPrice !== undefined) {
        assert.equal(
          result.intents.asksPrice,
          testCase.asksPrice,
          `${testCase.label}: price intent`,
        );
      }

      if (testCase.asksAvailability !== undefined) {
        assert.equal(
          result.intents.asksAvailability,
          testCase.asksAvailability,
          `${testCase.label}: availability intent`,
        );
      }

      if (testCase.urgent !== undefined) {
        assert.equal(
          result.intents.isUrgent,
          testCase.urgent,
          `${testCase.label}: urgent intent`,
        );
      }

      if (testCase.locationCode) {
        assert.equal(
          result.location?.adminUnit.code,
          testCase.locationCode,
          `${testCase.label}: location`,
        );
      }

      if (testCase.phone) {
        assert.equal(
          result.contacts.phone?.normalized,
          testCase.phone,
          `${testCase.label}: phone`,
        );
      }

      if (testCase.email) {
        assert.equal(
          result.contacts.email?.normalized,
          testCase.email,
          `${testCase.label}: email`,
        );
      }

      if (testCase.dateValues) {
        assert.deepEqual(
          result.facts
            .filter((fact) => fact.kind === "date")
            .map((fact) => fact.value),
          testCase.dateValues,
          `${testCase.label}: date facts`,
        );
      }

      if (testCase.hasNegatedSelection) {
        assert.equal(
          result.facts.some(
            (fact) => fact.kind === "selection" && fact.negated,
          ),
          true,
          `${testCase.label}: negated selection`,
        );
      }
    }
  });
});

function hasMeasurement(result: DeterministicExtractionResult): boolean {
  return result.facts.some((fact) => fact.kind === "measurement");
}

function assertMeasurementValue(
  result: DeterministicExtractionResult,
  dimension: MeasurementDimension,
  expected: number | undefined,
  label: string,
) {
  if (expected === undefined) {
    return;
  }

  assert.ok(
    result.facts.some(
      (fact) =>
        fact.kind === "measurement" &&
        fact.dimension === dimension &&
        fact.value === expected,
    ),
    `${label}: expected ${dimension} measurement ${expected}`,
  );
}

function assertMeasurementRange(
  result: DeterministicExtractionResult,
  dimension: MeasurementDimension,
  expected: [number, number] | undefined,
  label: string,
) {
  if (!expected) {
    return;
  }

  const [valueMin, valueMax] = expected;

  assert.ok(
    result.facts.some(
      (fact) =>
        fact.kind === "measurement" &&
        fact.dimension === dimension &&
        fact.valueMin === valueMin &&
        fact.valueMax === valueMax,
    ),
    `${label}: expected ${dimension} range ${valueMin}-${valueMax}`,
  );
}
