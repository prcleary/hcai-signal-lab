// js/generator.js

export const SCENARIO_TEMPLATES = [
  {
    id: "common-cause",
    name: "Stable common-cause variation",
    difficulty: 1,
    appliesTo: ["CDI", "MRSA", "CPE", "ECOLI"]
  },
  {
    id: "single-extreme",
    name: "Isolated extreme observation",
    difficulty: 1,
    appliesTo: ["CDI", "MRSA", "CPE", "ECOLI"]
  },
  {
    id: "step-increase",
    name: "Sustained step increase",
    difficulty: 1,
    appliesTo: ["CDI", "MRSA", "CPE", "ECOLI"]
  },
  {
    id: "gradual-trend",
    name: "Gradual underlying increase",
    difficulty: 2,
    appliesTo: ["CDI", "CPE", "ECOLI"]
  },
  {
    id: "local-outbreak",
    name: "Localised ward outbreak",
    difficulty: 2,
    appliesTo: ["CDI", "MRSA", "CPE", "ECOLI"]
  },
  {
    id: "seasonality",
    name: "Seasonal variation",
    difficulty: 2,
    appliesTo: ["CDI", "ECOLI"]
  },
  {
    id: "screening-expansion",
    name: "Expansion of screening",
    difficulty: 2,
    appliesTo: ["CPE"]
  },
  {
    id: "targeted-screening",
    name: "Change to targeted screening",
    difficulty: 3,
    appliesTo: ["CPE"]
  },
  {
    id: "denominator-change",
    name: "Changing denominator",
    difficulty: 3,
    appliesTo: ["CDI", "CPE", "ECOLI"]
  },
  {
    id: "reporting-artefact",
    name: "Reporting delay or batch reporting",
    difficulty: 3,
    appliesTo: ["CDI", "MRSA", "CPE", "ECOLI"]
  }
];

const HOSPITAL_PREFIXES = [
  "North Wessex",
  "West Mercia",
  "South Pennine",
  "Eastborough",
  "North Coast",
  "Central Vale",
  "Westbridge",
  "South Moor",
  "Riverside",
  "Northfield"
];

const HOSPITAL_SUFFIXES = [
  "University Hospitals",
  "General Hospital",
  "Teaching Hospitals",
  "District Hospital",
  "Healthcare Trust"
];

const HOSPITAL_TYPES = [
  "Teaching hospital",
  "District general hospital",
  "University hospital",
  "Multi-site acute hospital",
  "Specialist and acute hospital"
];

const SITES = [
  "Central Hospital",
  "Riverside Hospital",
  "Memorial Hospital"
];

const WARDS = [
  { name: "Critical Care", site: "Central Hospital", risk: 1.8 },
  { name: "Acute Medical Unit", site: "Central Hospital", risk: 1.4 },
  { name: "Older People's Medicine", site: "Central Hospital", risk: 1.5 },
  { name: "General Medicine", site: "Central Hospital", risk: 1.0 },
  { name: "General Surgery", site: "Riverside Hospital", risk: 0.9 },
  { name: "Trauma and Orthopaedics", site: "Riverside Hospital", risk: 1.0 },
  { name: "Renal Unit", site: "Memorial Hospital", risk: 1.6 },
  { name: "Haematology", site: "Memorial Hospital", risk: 1.7 }
];

export const SURVEILLANCE_TOPICS = {
  CDI: {
    code: "CDI",
    organism: "Clostridioides difficile infection",
    shortName: "C. difficile",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.0007
  },

  MRSA: {
    code: "MRSA",
    organism: "MRSA bacteraemia",
    shortName: "MRSA",
    availableMeasures: ["count"],
    defaultMeasure: "count",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "c",
    baselineRate: 0.00005
  },

  CPE: {
    code: "CPE",
    organism: "Carbapenemase-producing Enterobacterales",
    shortName: "CPE",
    availableMeasures: ["count", "proportion"],
    defaultMeasure: "proportion",
    numeratorLabel: "Screen-positive patients",
    denominatorLabel: "Patients screened",
    rateMultiplier: 100,
    recommendedChart: "p",
    baselineRate: 0.025
  },

  ECOLI: {
    code: "ECOLI",
    organism: "Escherichia coli bacteraemia",
    shortName: "E. coli",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.0003
  }
};

/**
 * Seeded random number generator.
 * The same seed produces the same scenario.
 */
export function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random, minimum, maximum) {
  return Math.floor(
    random() * (maximum - minimum + 1)
  ) + minimum;
}

function choose(random, values) {
  return values[
    Math.floor(random() * values.length)
  ];
}

function generateSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * Approximate Poisson generator.
 */
function randomPoisson(random, lambda) {
  if (lambda <= 0) return 0;

  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;

  do {
    count += 1;
    product *= random();
  } while (product > limit);

  return count - 1;
}

/**
 * Binomial generator suitable for the moderate denominators
 * used in these synthetic scenarios.
 */
function randomBinomial(random, trials, probability) {
  let successes = 0;

  for (let index = 0; index < trials; index += 1) {
    if (random() < probability) {
      successes += 1;
    }
  }

  return successes;
}

function addDays(date, numberOfDays) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + numberOfDays);
  return copy;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function generateHospital(random) {
  return {
    name: `${choose(random, HOSPITAL_PREFIXES)} ${
      choose(random, HOSPITAL_SUFFIXES)
    }`,
    type: choose(random, HOSPITAL_TYPES),
    beds: randomInteger(random, 450, 1100),
    sites: [...SITES],
    wards: WARDS.map(ward => ({ ...ward }))
  };
}

function chooseTopicAndTemplate(random) {
  const topicCodes = Object.keys(SURVEILLANCE_TOPICS);
  const topicCode = choose(random, topicCodes);

  const eligibleTemplates = SCENARIO_TEMPLATES.filter(
    template => template.appliesTo.includes(topicCode)
  );

  return {
    topic: SURVEILLANCE_TOPICS[topicCode],
    template: choose(random, eligibleTemplates)
  };
}

function getScenarioMultiplier({
  template,
  weekIndex,
  totalWeeks,
  wardName,
  affectedWard
}) {
  const changePoint = Math.floor(totalWeeks * 0.68);

  switch (template.id) {
    case "step-increase":
      return weekIndex >= changePoint ? 2.1 : 1;

    case "gradual-trend": {
      if (weekIndex < changePoint) return 1;

      const progress =
        (weekIndex - changePoint) /
        Math.max(1, totalWeeks - changePoint);

      return 1 + progress * 1.6;
    }

    case "local-outbreak": {
      const outbreakEnd = changePoint + 7;

      if (
        wardName === affectedWard &&
        weekIndex >= changePoint &&
        weekIndex <= outbreakEnd
      ) {
        return 4;
      }

      return 1;
    }

    case "single-extreme":
      return weekIndex === changePoint + 4 ? 5 : 1;

    case "seasonality": {
      const seasonalPosition = (weekIndex % 52) / 52;
      return 1 + 0.35 * Math.cos(seasonalPosition * Math.PI * 2);
    }

    default:
      return 1;
  }
}

function generateWeeklyObservation({
  random,
  topic,
  template,
  hospital,
  ward,
  weekIndex,
  totalWeeks,
  date,
  affectedWard
}) {
  const bedDays = randomInteger(
    random,
    Math.round(hospital.beds * 0.65),
    Math.round(hospital.beds * 0.9)
  );

  const wardShare = 1 / hospital.wards.length;
  const wardBedDays = Math.round(bedDays * wardShare);

  const scenarioMultiplier = getScenarioMultiplier({
    template,
    weekIndex,
    totalWeeks,
    wardName: ward.name,
    affectedWard
  });

  if (topic.code === "CPE") {
    let screened = randomInteger(random, 15, 55);
    let positivity = topic.baselineRate * ward.risk * scenarioMultiplier;

    const changePoint = Math.floor(totalWeeks * 0.68);

    if (
      template.id === "screening-expansion" &&
      weekIndex >= changePoint
    ) {
      screened = Math.round(screened * 2.5);
    }

    if (
      template.id === "targeted-screening" &&
      weekIndex >= changePoint
    ) {
      screened = Math.round(screened * 0.75);
      positivity *= 2.2;
    }

    positivity = Math.min(0.4, positivity);

    return {
      date: formatDate(date),
      site: ward.site,
      ward: ward.name,
      numerator: randomBinomial(random, screened, positivity),
      denominator: screened,
      bedDays: wardBedDays
    };
  }

  let denominator = wardBedDays;

  if (
    template.id === "denominator-change" &&
    weekIndex >= Math.floor(totalWeeks * 0.68)
  ) {
    denominator = Math.round(denominator * 0.55);
  }

  const expectedCases =
    topic.baselineRate *
    denominator *
    ward.risk *
    scenarioMultiplier;

  return {
    date: formatDate(date),
    site: ward.site,
    ward: ward.name,
    numerator: randomPoisson(random, expectedCases),
    denominator,
    bedDays: denominator
  };
}

function createExplanation(template, affectedWard) {
  const explanations = {
    "common-cause":
      "The process was stable. The apparent fluctuations were generated by ordinary random variation.",

    "single-extreme":
      "There was one unusually high observation. It warrants checking, but a single signal does not by itself prove an outbreak.",

    "step-increase":
      "A sustained increase in the underlying incidence began during the later part of the series.",

    "gradual-trend":
      "The underlying incidence increased gradually. A conventional control chart may detect this later than a sustained-shift method.",

    "local-outbreak":
      `A short outbreak occurred in ${affectedWard}. Hospital-level aggregation diluted the signal.`,

    "seasonality":
      "The underlying process contained a recurring seasonal pattern. Fixed control limits may repeatedly label predictable seasonal peaks as special-cause variation.",

    "screening-expansion":
      "The number of CPE screen-positive patients increased because substantially more patients were screened. Positivity remained broadly stable.",

    "targeted-screening":
      "Screening became more targeted towards patients at greater risk. Positivity increased even though this did not represent a hospital-wide increase in prevalence.",

    "denominator-change":
      "The activity denominator fell. Counts and rates therefore gave different impressions of the process.",

    "reporting-artefact":
      "Recent observations were affected by delayed or batch reporting. The apparent change did not fully represent when cases occurred."
  };

  return explanations[template.id];
}

/**
 * Public function used by app.js.
 */
export function generateScenario(seed = generateSeed()) {
  const random = mulberry32(seed);
  const hospital = generateHospital(random);

  const { topic, template } =
    chooseTopicAndTemplate(random);

  const totalWeeks = 156;
  const affectedWard = choose(
    random,
    hospital.wards
  ).name;

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(
    startDate.getUTCDate() - totalWeeks * 7
  );

  const observations = [];

  for (
    let weekIndex = 0;
    weekIndex < totalWeeks;
    weekIndex += 1
  ) {
    const date = addDays(startDate, weekIndex * 7);

    for (const ward of hospital.wards) {
      observations.push(
        generateWeeklyObservation({
          random,
          topic,
          template,
          hospital,
          ward,
          weekIndex,
          totalWeeks,
          date,
          affectedWard
        })
      );
    }
  }

  return {
    schemaVersion: 1,
    id: `scenario-${seed.toString(16)}`,
    seed,
    generatedAt: new Date().toISOString(),

    hospital,

    surveillance: {
      ...topic
    },

    observations,

    groundTruth: {
      templateId: template.id,
      templateName: template.name,
      affectedWard:
        template.id === "local-outbreak"
          ? affectedWard
          : null,
      explanation: createExplanation(
        template,
        affectedWard
      )
    },

    learnerState: {
      filters: {
        site: "all",
        ward: "all"
      },
      display: {
        measure: topic.defaultMeasure,
        timeWindow: 52,
        aggregation: 1,
        smoothing: 0,
        spcType: "auto",
        showTwoSd: true,
        showThreeSd: true,
        showSignals: true
      },
      investigate: "",
      notes: "",
      annotations: [],
      actionLog: [],
      revealed: false
    }
  };
}
