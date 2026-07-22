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
 *   case-definition-change    Tightened definition removes ~45 % of
 *                             cases (binomial thinning at p=0.55).
 *                             Sustained step-down in count and rate.
 *   diagnostic-method-change  New method adds ~55 % more cases on top
 *                             (Poisson-distributed extras). Sustained
 *                             step-up in count and rate.
 *
 * We use stochastic thinning / inflation rather than a straight
 * multiply-and-round so that the effective post-change ratio matches
 * the intended multiplier even at the low per-ward weekly counts of
 * the bacteraemia topics. Rounding 1 * 0.55 always yields 1, which
 * biases the observed ratio upward toward 0.75 - 0.80 and hides the
 * step; binomial thinning yields the true 0.55 on average.
 */
function applyGamingNumeratorArtefact(
  numerator,
  template,
  weekIndex,
  changePoint,
  random
) {
  if (changePoint == null || weekIndex < changePoint) {
    return numerator;
  }

  if (template.id === "case-definition-change") {
    return randomBinomial(random, numerator, 0.55);
  }

  if (template.id === "diagnostic-method-change") {
    return numerator + randomPoisson(random, numerator * 0.55);
  }

  return numerator;
}

/**
 * ISO-ish week-of-year for the seasonal helper. Returned as an integer
 * 0..52; leap-year drift is fine at this level (seasonality is smooth).
 */
function getWeekOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const diffDays = Math.floor(
    (date.getTime() - start) / (24 * 3600 * 1000)
  );
  return Math.floor(diffDays / 7);
}

/**
 * Multiplicative seasonal factor for respiratory-hai topics. Reads
 * `topic.seasonality.{amplitude, peakWeek}` and returns a factor
 * bounded below at 0.1 so summer troughs do not produce zero-rate
 * weeks (which would give a completely flat trough on the chart).
 */
function getRespiratorySeasonality(topic, weekOfYear) {
  const s = topic.seasonality;
  if (!s) return 1;

  const factor =
    1 +
    s.amplitude *
      Math.cos(((weekOfYear - s.peakWeek) / 52) * Math.PI * 2);

  return Math.max(0.1, factor);
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

    case "care-bundle-intervention": {
      // Bundle takes ~4 weeks to reach full effect, then rate stays at
      // roughly half the baseline. Modelled as an exponential decay
      // toward the target 0.5x.
      if (weekIndex < changePoint) return 1;

      const weeksSince = weekIndex - changePoint;
      const rampProgress = Math.min(1, weeksSince / 4);
      // Linearly interpolate from 1 down to 0.5.
      return 1 - 0.5 * rampProgress;
    }

    case "procedure-mix-shift": {
      // Case-mix shifts toward higher-risk procedures over ~6 weeks,
      // lifting the SSI risk to roughly 2x baseline and staying there.
      if (weekIndex < changePoint) return 1;

      const weeksSince = weekIndex - changePoint;
      const rampProgress = Math.min(1, weeksSince / 6);
      return 1 + rampProgress; // ramp from 1 up to 2
    }

    default:
      return 1;
  }
}

/**
 * Respiratory-HAI observation generator. Produces a per-week record
 * with a total `numerator` (all detections) and an `onsetBins`
 * breakdown by day-of-onset relative to admission. Downstream code
 * (statistics.js -> applyHaiCutoff) sums the appropriate bins based on
 * the learner's display-time cutoff selection.
 *
 * Baseline rate is scaled by:
 *   - topic seasonality (winter peak, summer trough)
 *   - ward.risk
 *   - the generic scenarioMultiplier (step, trend, single-extreme,
 *     local-outbreak, seasonality-template, common-cause)
 *
 * Respiratory-specific templates then rescale individual bins:
 *   respiratory-community-surge      community bin surges immediately;
 *                                    HAI bins ramp up over 1-3 weeks.
 *   respiratory-ward-cluster         definite-HAI bin surges on the
 *                                    affected ward only.
 *   respiratory-definition-cutoff    community and indeterminate bins
 *                                    are dampened post-change (mimics
 *                                    a tightening of what counts as
 *                                    reportable HAI).
 *
 * Reporting-artefact and denominator-change apply as they do for
 * count-per-bed-days topics; ward-closure collapses the denominator on
 * the affected ward.
 */
function generateRespiratoryObservation({
  random,
  topic,
  template,
  ward,
  wardBedDays,
  weekIndex,
  totalWeeks,
  changePoint,
  afterChange,
  date,
  affectedWard,
  scenarioMultiplier
}) {
  let denominator = wardBedDays;

  if (template.id === "denominator-change" && afterChange) {
    denominator = Math.max(1, Math.round(denominator * 0.55));
  }

  if (
    template.id === "ward-closure" &&
    afterChange &&
    ward.name === affectedWard
  ) {
    denominator = Math.max(1, Math.round(denominator * 0.05));
  }

  const weekOfYear = getWeekOfYear(date);
  const seasonalFactor = getRespiratorySeasonality(topic, weekOfYear);

  const baseRate =
    topic.baselineRate *
    seasonalFactor *
    ward.risk *
    scenarioMultiplier;

  const totalExpected = baseRate * denominator;
  const weights = topic.onsetBinWeights;

  const binMultipliers = {
    community: 1,
    indeterminate: 1,
    probableHAI: 1,
    definiteHAI: 1
  };

  if (template.id === "respiratory-community-surge" && afterChange) {
    // Community wave hits admissions immediately; HAI bins ramp up as
    // admitted patients incubate and staff-to-patient transmission
    // steps up. The lag is what distinguishes this template from a
    // pure nosocomial cluster.
    const weeksSinceChange = weekIndex - changePoint;
    binMultipliers.community = 3.0;
    binMultipliers.indeterminate = weeksSinceChange >= 1 ? 1.8 : 1.0;
    binMultipliers.probableHAI = weeksSinceChange >= 2 ? 1.6 : 1.0;
    binMultipliers.definiteHAI = weeksSinceChange >= 3 ? 1.4 : 1.0;
  }

  if (
    template.id === "respiratory-ward-cluster" &&
    afterChange &&
    weekIndex <= changePoint + 6 &&
    ward.name === affectedWard
  ) {
    // Ward-level nosocomial cluster: predominantly definite HAI, some
    // probable HAI, community and indeterminate untouched.
    binMultipliers.definiteHAI = 12;
    binMultipliers.probableHAI = 3;
  }

  if (template.id === "respiratory-definition-cutoff" && afterChange) {
    // Tightened case definition: community and indeterminate bins no
    // longer count as HAI. Probable and definite are unchanged. Total
    // detections appear to fall; a learner switching cutoff to
    // "Definite HAI only" sees no change.
    binMultipliers.community = 0.35;
    binMultipliers.indeterminate = 0.35;
  }

  const rawBins = {
    community: randomPoisson(
      random,
      totalExpected * weights.community * binMultipliers.community
    ),
    indeterminate: randomPoisson(
      random,
      totalExpected * weights.indeterminate * binMultipliers.indeterminate
    ),
    probableHAI: randomPoisson(
      random,
      totalExpected * weights.probableHAI * binMultipliers.probableHAI
    ),
    definiteHAI: randomPoisson(
      random,
      totalExpected * weights.definiteHAI * binMultipliers.definiteHAI
    )
  };

  const rawTotal =
    rawBins.community +
    rawBins.indeterminate +
    rawBins.probableHAI +
    rawBins.definiteHAI;

  // Apply reporting artefact to the total, then distribute the scaled
  // total back across bins proportionally so composition is preserved.
  const afterReporting = applyReportingArtefact(
    rawTotal,
    template,
    weekIndex,
    totalWeeks
  );

  let onsetBins;

  if (rawTotal === 0) {
    onsetBins = {
      community: 0,
      indeterminate: 0,
      probableHAI: 0,
      definiteHAI: 0
    };
  } else if (afterReporting === rawTotal) {
    onsetBins = { ...rawBins };
  } else {
    const ratio = afterReporting / rawTotal;
    onsetBins = {
      community: Math.round(rawBins.community * ratio),
      indeterminate: Math.round(rawBins.indeterminate * ratio),
      probableHAI: Math.round(rawBins.probableHAI * ratio),
      definiteHAI: Math.round(rawBins.definiteHAI * ratio)
    };
  }

  const numerator =
    onsetBins.community +
    onsetBins.indeterminate +
    onsetBins.probableHAI +
    onsetBins.definiteHAI;

  const numeratorBySubtype = partitionBySubtype({
    random,
    total: numerator,
    topic,
    template,
    weekIndex,
    changePoint,
    afterChange
  });

  return {
    date: formatDate(date),
    site: ward.site,
    ward: ward.name,
    numerator,
    denominator,
    bedDays: denominator,
    onsetBins,
    numeratorBySubtype
  };
}

/**
 * For topics with a `subtypes` list, decide how the total weekly
 * numerator splits across subtypes for a given (week, template)
 * combination.
 *
 * Templates that manipulate subtype composition:
 *   subtype-emergence     A previously-rare subtype (last entry in the
 *                         topic's subtypes list) grows to ~40% share
 *                         over ~12 weeks after the change point. Total
 *                         numerator is unchanged.
 *   subtype-displacement  The dominant subtype (first entry) is
 *                         gradually displaced by the challenger (second
 *                         entry). Total numerator is unchanged.
 *
 * Returns a normalised weights map { subtypeCode: fraction }.
 */
function computeSubtypeWeights(topic, template, weekIndex, changePoint, afterChange) {
  const base = { ...topic.subtypeWeights };
  const codes = topic.subtypes.map(subtype => subtype.code);

  if (template.id === "subtype-emergence" && afterChange) {
    const emerging = codes[codes.length - 1];
    const weeksSince = weekIndex - changePoint;

    // Emerging fraction climbs from baseline to ~40% over ~12 weeks.
    const targetFraction = Math.min(
      0.4,
      (topic.subtypeWeights[emerging] || 0) + 0.035 * weeksSince
    );

    const others = codes.filter(code => code !== emerging);
    const othersSum = others.reduce(
      (sum, code) => sum + (topic.subtypeWeights[code] || 0),
      0
    ) || 1;

    const remaining = 1 - targetFraction;

    for (const code of others) {
      base[code] =
        ((topic.subtypeWeights[code] || 0) / othersSum) * remaining;
    }
    base[emerging] = targetFraction;
  }

  if (template.id === "subtype-displacement" && afterChange) {
    const dominant = codes[0];
    const challenger = codes[1];
    const weeksSince = weekIndex - changePoint;

    const initialDominant = topic.subtypeWeights[dominant] || 0;
    const transfer = Math.min(initialDominant * 0.85, 0.03 * weeksSince);

    base[dominant] = Math.max(0.02, initialDominant - transfer);
    base[challenger] =
      (topic.subtypeWeights[challenger] || 0) + transfer;

    const total = codes.reduce(
      (sum, code) => sum + (base[code] || 0),
      0
    ) || 1;

    for (const code of codes) {
      base[code] = base[code] / total;
    }
  }

  return base;
}

/**
 * Partition `total` weekly numerator into per-subtype counts by drawing
 * independently from the (possibly template-warped) subtype
 * distribution. Returns null for topics without subtype metadata.
 */
function partitionBySubtype({
  random,
  total,
  topic,
  template,
  weekIndex,
  changePoint,
  afterChange
}) {
  if (!topic.subtypes || !topic.subtypes.length) return null;

  const codes = topic.subtypes.map(subtype => subtype.code);
  const weights = computeSubtypeWeights(
    topic,
    template,
    weekIndex,
    changePoint,
    afterChange
  );

  const counts = {};
  for (const code of codes) counts[code] = 0;

  const cumulative = [];
  let acc = 0;
  for (const code of codes) {
    acc += weights[code] || 0;
    cumulative.push([code, acc]);
  }
  const totalWeight = acc || 1;

  for (let index = 0; index < total; index += 1) {
    const draw = random() * totalWeight;
    for (const [code, cum] of cumulative) {
      if (draw <= cum) {
        counts[code] += 1;
        break;
      }
    }
  }

  return counts;
}

/**
 * Device-associated infection generator (CAUTI, CLABSI).
 *
 * Denominator = deviceUtilisationRatio * wardBedDays, with mild noise.
 * A denominator-change template halves the denominator; a ward-closure
 * template collapses the denominator on the affected ward. The
 * numerator is Poisson-distributed around baselineRate * denominator *
 * ward.risk * scenarioMultiplier, then subjected to the usual
 * reporting-artefact treatment.
 */
function generateDeviceDaysObservation({
  random,
  topic,
  template,
  ward,
  wardBedDays,
  weekIndex,
  totalWeeks,
  afterChange,
  date,
  affectedWard,
  scenarioMultiplier
}) {
  // Base device-days = utilisation ratio * bed-days, with +/- 15 %
  // noise so the denominator is not constant.
  const utilisationRatio = topic.deviceUtilisationRatio || 0.2;
  const noiseFactor = 0.85 + random() * 0.3;
  let deviceDays = Math.max(
    1,
    Math.round(wardBedDays * utilisationRatio * noiseFactor)
  );

  if (template.id === "denominator-change" && afterChange) {
    deviceDays = Math.max(1, Math.round(deviceDays * 0.55));
  }

  if (
    template.id === "ward-closure" &&
    afterChange &&
    ward.name === affectedWard
  ) {
    deviceDays = Math.max(1, Math.round(deviceDays * 0.05));
  }

  const expectedCases =
    topic.baselineRate *
    deviceDays *
    ward.risk *
    scenarioMultiplier;

  const rawNumerator = randomPoisson(random, expectedCases);

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
    denominator: deviceDays,
    bedDays: wardBedDays
  };
}

/**
 * Procedure-cohort SSI generator (SSICOLO, SSICARD).
 *
 * Denominator = number of index procedures performed on that ward in
 * the week (Poisson around the topic's proceduresPerWeek / ward count).
 * Numerator = binomial (procedures, baselineRate * ward.risk *
 * scenarioMultiplier). Only wards that actually do this kind of
 * surgery contribute non-zero procedures; the generator uses a simple
 * name-based heuristic (Surgery / Cardiac / Orthopaedics) to keep the
 * scenario realistic.
 */
function generateProcedureCohortObservation({
  random,
  topic,
  template,
  ward,
  wardBedDays,
  weekIndex,
  totalWeeks,
  afterChange,
  date,
  scenarioMultiplier
}) {
  const wardName = ward.name.toLowerCase();
  const doesSurgery =
    wardName.includes("surger") ||
    wardName.includes("orthop") ||
    wardName.includes("cardiac") ||
    wardName.includes("critical");

  if (!doesSurgery) {
    return {
      date: formatDate(date),
      site: ward.site,
      ward: ward.name,
      numerator: 0,
      denominator: 0,
      bedDays: wardBedDays
    };
  }

  const perWardMean =
    (topic.proceduresPerWeek || 10) / 3; // three surgical wards
  let procedures = randomPoisson(random, perWardMean);

  if (template.id === "denominator-change" && afterChange) {
    procedures = Math.max(0, Math.round(procedures * 0.55));
  }

  let infectionRisk =
    topic.baselineRate * ward.risk * scenarioMultiplier;
  infectionRisk = Math.min(0.6, infectionRisk);

  const rawNumerator = randomBinomial(
    random,
    procedures,
    infectionRisk
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
    denominator: procedures,
    bedDays: wardBedDays
  };
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

  if (topic.surveillanceKind === "respiratory-hai") {
    return generateRespiratoryObservation({
      random,
      topic,
      template,
      ward,
      wardBedDays,
      weekIndex,
      totalWeeks,
      changePoint,
      afterChange,
      date,
      affectedWard,
      scenarioMultiplier
    });
  }

  if (topic.surveillanceKind === "device-days") {
    return generateDeviceDaysObservation({
      random,
      topic,
      template,
      ward,
      wardBedDays,
      weekIndex,
      totalWeeks,
      afterChange,
      date,
      affectedWard,
      scenarioMultiplier
    });
  }

  if (topic.surveillanceKind === "procedure-cohort") {
    return generateProcedureCohortObservation({
      random,
      topic,
      template,
      ward,
      wardBedDays,
      weekIndex,
      totalWeeks,
      afterChange,
      date,
      scenarioMultiplier
    });
  }

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

    const numeratorBySubtype = partitionBySubtype({
      random,
      total: numerator,
      topic,
      template,
      weekIndex,
      changePoint,
      afterChange
    });

    return {
      date: formatDate(date),
      site: ward.site,
      ward: ward.name,
      numerator,
      denominator: screened,
      bedDays: wardBedDays,
      numeratorBySubtype
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
    changePoint,
    random
  );

  const apportionmentBins = partitionApportionmentBins({
    random,
    total: numerator,
    topic,
    template,
    afterChange,
    isAffectedWard: ward.name === affectedWard
  });

  return {
    date: formatDate(date),
    site: ward.site,
    ward: ward.name,
    numerator,
    denominator,
    bedDays: denominator,
    apportionmentBins
  };
}

/**
 * Partition a weekly numerator into the NHS onset-apportionment bins
 * (HOHA, COHA, COCA) using a multinomial draw with weights from
 * `topic.apportionmentWeights`. Applies to CDI and every mandatory
 * bacteraemia topic (MRSA, MSSA, E. coli, Klebsiella, P. aeruginosa),
 * all of which share the same three-category framework in current NHS /
 * UKHSA mandatory surveillance.
 *
 * Templates whose mechanism concentrates in specific bins tilt the
 * weights before the draw:
 *
 *   local-outbreak (on the affected ward, after change)
 *       Ward-based transmission produces predominantly hospital-onset
 *       cases; tilt weights heavily toward HOHA.
 *
 *   care-bundle-intervention (after change)
 *       Interventions that reduce hospital transmission act on the
 *       healthcare-associated cohort. The template already reduces the
 *       total numerator; tilting weights toward COCA localises the
 *       drop in the HOHA + COHA cohort, so a learner filtering to
 *       "Total healthcare-associated" sees a sharper reduction.
 *
 * All other templates use the topic's baseline weights unchanged.
 * Returns null for topics without apportionment metadata so downstream
 * code can treat the field as optional.
 */
function partitionApportionmentBins({
  random,
  total,
  topic,
  template,
  afterChange,
  isAffectedWard
}) {
  if (!topic.apportionmentCategories || !topic.apportionmentWeights) {
    return null;
  }

  const codes = topic.apportionmentCategories.map(entry => entry.code);
  const weights = { ...topic.apportionmentWeights };

  if (
    template.id === "local-outbreak" &&
    afterChange &&
    isAffectedWard
  ) {
    weights.HOHA = 0.75;
    weights.COHA = 0.15;
    weights.COCA = 0.10;
  } else if (template.id === "care-bundle-intervention" && afterChange) {
    weights.HOHA = 0.20;
    weights.COHA = 0.15;
    weights.COCA = 0.65;
  }

  const bins = {};
  for (const code of codes) bins[code] = 0;

  if (total <= 0) return bins;

  // Multinomial draw via successive binomials conditioned on the
  // remaining count and remaining weight mass.
  let remaining = total;
  let remainingWeight = codes.reduce(
    (sum, code) => sum + (weights[code] || 0),
    0
  ) || 1;

  for (let index = 0; index < codes.length - 1; index += 1) {
    if (remaining <= 0) break;

    const code = codes[index];
    const probability = Math.min(
      1,
      Math.max(0, (weights[code] || 0) / remainingWeight)
    );

    const draw = randomBinomial(random, remaining, probability);

    bins[code] = draw;
    remaining -= draw;
    remainingWeight -= (weights[code] || 0);
  }

  bins[codes[codes.length - 1]] = remaining;

  return bins;
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
    schemaVersion: 4,
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
        template.id === "ward-closure" ||
        template.id === "respiratory-ward-cluster"
          ? affectedWard
          : null,
      explanation: createExplanation(template, {
        affectedWard
      })
    },

    learnerState: {
      filters: {
        site: "all",
        ward: "all",
        subtype:
          topic.subtypes && topic.subtypes.length ? "all" : null
      },
      display: {
        measure: topic.defaultMeasure,
        timeWindow: 52,
        aggregation: 1,
        smoothing: 0,
        spcType: "auto",
        showTwoSd: true,
        showThreeSd: true,
        showSignals: true,
        haiCutoff:
          topic.surveillanceKind === "respiratory-hai"
            ? "probable-and-definite"
            : null,
        apportionment:
          topic.apportionmentCategories ? "trust-apportioned" : null
      },
      investigate: "",
      notes: "",
      annotations: [],
      actionLog: [],
      revealed: false
    }
  };
}
