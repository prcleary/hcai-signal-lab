// js/generator.js

import {
  SCENARIO_TEMPLATES,
  CHANGE_POINT_POSITIONS,
  createExplanation
} from "./templates.js";

import { SURVEILLANCE_TOPICS } from "./topics.js";

// Re-export so existing consumers of ./generator.js keep working. New
// code should import these from the underlying modules directly.
export { SCENARIO_TEMPLATES, SURVEILLANCE_TOPICS };

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

function chooseTopicAndTemplate(random, difficulty) {
  const targetDifficulty = Number(difficulty);
  const applyFilter =
    Number.isInteger(targetDifficulty) &&
    targetDifficulty >= 1 &&
    targetDifficulty <= 3;

  // Build the full list of valid (topic, template) pairs, optionally
  // filtered by learner-selected difficulty. Filtering pairs (rather
  // than choosing a topic first, then a template) avoids the case
  // where the chosen topic has no template at the requested difficulty.
  const pairs = [];

  for (const [topicCode, topic] of Object.entries(SURVEILLANCE_TOPICS)) {
    for (const template of SCENARIO_TEMPLATES) {
      if (!template.appliesTo.includes(topicCode)) continue;
      if (applyFilter && template.difficulty !== targetDifficulty) continue;

      pairs.push({ topic, template });
    }
  }

  // Fall back to any difficulty if the filter matched nothing.
  if (!pairs.length) {
    return chooseTopicAndTemplate(random, null);
  }

  return choose(random, pairs);
}

/**
 * Change points are chosen so the shift sits comfortably inside the
 * default 52-week visible window (weeks 104..155 for a 156-week series).
 * Templates without a discrete change point return null.
 *
 * The positions used here take precedence over CHANGE_POINT_POSITIONS
 * exported from templates.js: the templates module knows only "roughly
 * where in the series"; this table knows the visible-window pedagogy
 * (must fall in the last third so post-change weeks are visible without
 * scrolling). New template ids not listed here fall through to the
 * imported table, so surveillance-behaviour templates land at ~0.55.
 */
function getChangePoint(random, template, totalWeeks) {
  const legacyPositions = {
    "step-increase": 0.80,
    "gradual-trend": 0.72,
    "local-outbreak": 0.85,
    "single-extreme": 0.80,
    "screening-expansion": 0.80,
    "targeted-screening": 0.80,
    "denominator-change": 0.80,
    "reporting-artefact": 0.80,
    "testing-reduction": 0.80,
    "case-definition-change": 0.80,
    "diagnostic-method-change": 0.80,
    "ward-closure": 0.80
  };

  const fraction =
    legacyPositions[template.id] ??
    CHANGE_POINT_POSITIONS[template.id];

  if (fraction == null) return null;

  // +/- 6 weeks of jitter so identical templates do not land on the same week.
  const jitter = Math.floor(random() * 13) - 6;
  let point = Math.floor(totalWeeks * fraction) + jitter;

  // The eight-week local outbreak must end inside the series.
  if (template.id === "local-outbreak") {
    point = Math.min(point, totalWeeks - 8);
  }

  // Always leave at least 20 weeks of pre-change baseline for SPC estimation.
  return Math.max(20, point);
}

/**
 * Number of leading weeks used as the SPC baseline. For change-point
 * templates the baseline ends four weeks before the change so limits are
 * derived from a clean "before" period.
 */
function getBaselineWeeks(template, changePoint, totalWeeks) {
  if (changePoint == null) {
    return Math.floor(totalWeeks * 0.77);
  }

  return Math.max(20, changePoint - 4);
}

/**
 * Simulates delayed / batch reporting. Recent weeks are under-reported
 * (results still pending) and a batch of overdue reports is filed a few
 * weeks earlier. Applied to the numerator only; denominators (bed-days or
 * screened patients) are unaffected because they reflect activity, not
 * result reporting.
 */
function applyReportingArtefact(
  numerator,
  template,
  weekIndex,
  totalWeeks
) {
  if (template.id !== "reporting-artefact") {
    return numerator;
  }

  const fromEnd = totalWeeks - 1 - weekIndex;

  if (fromEnd === 0) return Math.round(numerator * 0.10);
  if (fromEnd === 1) return Math.round(numerator * 0.40);
  if (fromEnd === 2) return Math.round(numerator * 0.75);
  if (fromEnd === 5) return Math.round(numerator * 2.4);

  return numerator;
}

/**
 * Case-definition and diagnostic-method changes are simulated by
 * rescaling the numerator on and after the change point. The
 * denominator (bed-days) is untouched because these represent changes
 * in how cases are counted, not changes in patient activity.
 *
 *   case-definition-change    Tightened definition removes ~35 % of
 *                             cases. Sustained step-down in count and
 *                             rate.
 *   diagnostic-method-change  New method has ~35 % higher sensitivity.
 *                             Sustained step-up in count and rate.
 */
function applyGamingNumeratorArtefact(
  numerator,
  template,
  weekIndex,
  changePoint
) {
  if (changePoint == null || weekIndex < changePoint) {
    return numerator;
  }

  if (template.id === "case-definition-change") {
    return Math.round(numerator * 0.65);
  }

  if (template.id === "diagnostic-method-change") {
    return Math.round(numerator * 1.35);
  }

  return numerator;
}

function getScenarioMultiplier({
  template,
  weekIndex,
  totalWeeks,
  changePoint,
  wardName,
  affectedWard,
  topic
}) {
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
        // Rare organisms need a much bigger multiplier or the outbreak
        // leaves no visible cases at all. Threshold of 0.0001 catches
        // MRSA (baseline 0.00005 per bed-day) but not CDI/ECOLI.
        return topic && topic.baselineRate < 0.0001 ? 15 : 4;
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
  changePoint,
  date,
  affectedWard
}) {
  const bedDays = randomInteger(
    random,
    Math.round(hospital.beds * 7 * 0.65),
    Math.round(hospital.beds * 7 * 0.90)
  );

  const wardShare = 1 / hospital.wards.length;
  const wardBedDays = Math.round(bedDays * wardShare);

  const scenarioMultiplier = getScenarioMultiplier({
    template,
    weekIndex,
    totalWeeks,
    changePoint,
    wardName: ward.name,
    affectedWard,
    topic
  });

  const afterChange =
    changePoint != null && weekIndex >= changePoint;

  if (topic.code === "CPE") {
    let screened = randomInteger(random, 15, 55);
    let positivity = topic.baselineRate * ward.risk * scenarioMultiplier;

    if (template.id === "screening-expansion" && afterChange) {
      screened = Math.round(screened * 2.5);
    }

    if (template.id === "targeted-screening" && afterChange) {
      screened = Math.round(screened * 0.75);
      positivity *= 2.2;
    }

    if (template.id === "denominator-change" && afterChange) {
      screened = Math.max(1, Math.round(screened * 0.55));
    }

    if (template.id === "testing-reduction" && afterChange) {
      // Ascertainment cut: fewer patients screened, true positivity
      // unchanged. Count of positives falls in step; proportion is
      // preserved (subject to small-numbers noise).
      screened = Math.max(1, Math.round(screened * 0.40));
    }

    positivity = Math.min(0.4, positivity);

    const rawNumerator = randomBinomial(
      random,
      screened,
      positivity
    );

    const numerator = applyReportingArtefact(
      rawNumerator,
      template,
      weekIndex,
      totalWeeks
    );

    return {
      date: formatDate(date),
      site: ward.site,
      ward: ward.name,
      numerator,
      denominator: screened,
      bedDays: wardBedDays
    };
  }

  let denominator = wardBedDays;

  if (template.id === "denominator-change" && afterChange) {
    denominator = Math.max(1, Math.round(denominator * 0.55));
  }

  if (
    template.id === "ward-closure" &&
    afterChange &&
    ward.name === affectedWard
  ) {
    // Ward is closed / decanted: bed-days collapse to a token value.
    // Cases fall in step because the Poisson intensity uses this
    // denominator, so the rate is broadly preserved.
    denominator = Math.max(1, Math.round(denominator * 0.05));
  }

  const expectedCases =
    topic.baselineRate *
    denominator *
    ward.risk *
    scenarioMultiplier;

  const rawNumerator = randomPoisson(random, expectedCases);

  const afterReportingArtefact = applyReportingArtefact(
    rawNumerator,
    template,
    weekIndex,
    totalWeeks
  );

  const numerator = applyGamingNumeratorArtefact(
    afterReportingArtefact,
    template,
    weekIndex,
    changePoint
  );

  return {
    date: formatDate(date),
    site: ward.site,
    ward: ward.name,
    numerator,
    denominator,
    bedDays: denominator
  };
}

/**
 * Public function used by app.js.
 */
export function generateScenario(seed = generateSeed(), options = {}) {
  const random = mulberry32(seed);
  const hospital = generateHospital(random);

  const { topic, template } =
    chooseTopicAndTemplate(random, options.difficulty);

  const totalWeeks = 156;
  const affectedWard = choose(random, hospital.wards).name;

  const changePoint = getChangePoint(random, template, totalWeeks);
  const baselineWeeks = getBaselineWeeks(
    template,
    changePoint,
    totalWeeks
  );

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
          changePoint,
          date,
          affectedWard
        })
      );
    }
  }

  const baselineEndDate = formatDate(
    addDays(startDate, Math.max(0, baselineWeeks - 1) * 7)
  );

  const changePointDate = changePoint != null
    ? formatDate(addDays(startDate, changePoint * 7))
    : null;

  return {
    schemaVersion: 3,
    id: `scenario-${seed.toString(16)}`,
    seed,
    generatedAt: new Date().toISOString(),

    hospital,

    surveillance: { ...topic },

    observations,
    baselineWeeks,
    baselineEndDate,

    groundTruth: {
      templateId: template.id,
      templateName: template.name,
      difficulty: template.difficulty,
      changePoint,
      changePointDate,
      affectedWard:
        template.id === "local-outbreak" ||
        template.id === "ward-closure"
          ? affectedWard
          : null,
      explanation: createExplanation(template, {
        affectedWard
      })
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
