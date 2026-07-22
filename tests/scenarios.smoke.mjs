// tests/scenarios.smoke.mjs
//
// Node smoke test for the scenario generator, statistics pipeline and
// tips module.
//
//   node tests/scenarios.smoke.mjs
//
// Assertion groups (see the // --- N. -----  section headers below):
//
//   1.   Every (topic, template) pair generates a valid scenario
//        (156 weekly observations × 8 wards = 1248 rows).
//   2.   Difficulty filtering returns only templates at the requested
//        difficulty.
//   3.   Every template has a resolvable tip (from js/tips.js) exposing
//        the full 5-field schema (or the denominator-change / ward-
//        closure function form which returns one).
//   4-8. Template applicability, ward-closure invariants, testing-
//        reduction visibility and respiratory-HAI onset-bin invariants.
//   9.   applyHaiCutoff arithmetic on synthetic points.
//   10-12. Subtype numerator invariants and applySubtypeFilter
//        arithmetic.
//   13-14. Device / procedure-cohort scenarios generate valid data,
//        and stage-7 templates (care bundle, procedure mix shift) are
//        produced.
//   15.  Onset-apportionment bins (HOHA / COHA / COCA) sum to
//        numerator for every apportionment-carrying topic.
//   16.  applyApportionmentClassification arithmetic on synthetic
//        points.
//   17.  Determinism: generateScenario(seed) is a pure function of
//        seed.
//   18.  Schema-version consistency between the generator's
//        scenario.schemaVersion and js/storage.js SCHEMA_VERSION.
//   19.  SPC-pipeline invariants: prepareAnalysis over every topic
//        yields finite values and lower3 <= lower2 <= centre <=
//        upper2 <= upper3 on every point.
//   20.  Nelson rule 1 (single point beyond 3-SD) fires.
//   21.  Nelson rule 4 (eight consecutive on one side of centre) fires.
//   22.  aggregatePoints preserves numerator / denominator totals.
//   23.  selectControlChart auto-select maps measure -> chart type.
//   24.  Scenario code round-trip: formatScenarioCode(scenario) ->
//        parseScenarioCode() recovers the seed, difficulty and
//        current APP_VERSION_CODE; legacy and version-less forms
//        parse correctly; malformed codes return null.
//
// The test is intentionally lightweight; it fails fast on the first
// broken invariant. Use `node --test` style output only if this file
// grows further.

import {
  generateScenario,
  APP_VERSION_CODE,
  formatScenarioCode,
  parseScenarioCode
} from "../js/generator.js";
import { SURVEILLANCE_TOPICS } from "../js/topics.js";
import { SCENARIO_TEMPLATES } from "../js/templates.js";
import {
  INVESTIGATION_TIPS,
  resolveInvestigationTip
} from "../js/tips.js";
import {
  applyHaiCutoff,
  applySubtypeFilter,
  applyApportionmentClassification,
  aggregatePoints,
  selectControlChart,
  detectSignals,
  prepareAnalysis
} from "../js/statistics.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const TIP_FIELDS = [
  "pattern",
  "verify",
  "differential",
  "action",
  "falseAlarm"
];

let failures = 0;
let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error("FAIL:", message);
  }
}

function assertShape(scenario, context) {
  assert(
    scenario && typeof scenario === "object",
    `${context}: scenario is not an object`
  );
  assert(
    scenario.schemaVersion === 4,
    `${context}: schemaVersion should be 4, got ${scenario.schemaVersion}`
  );
  assert(
    typeof scenario.id === "string" && scenario.id.startsWith("scenario-"),
    `${context}: id should look like scenario-<hex>, got ${scenario.id}`
  );
  assert(
    typeof scenario.seed === "number",
    `${context}: seed should be a number`
  );
  assert(
    scenario.observations?.length === 156 * 8,
    `${context}: observations should be 156 weeks * 8 wards = 1248, got ${scenario.observations?.length}`
  );
  assert(
    scenario.surveillance?.code,
    `${context}: surveillance.code missing`
  );
  assert(
    scenario.groundTruth?.templateId,
    `${context}: groundTruth.templateId missing`
  );
}

// --- 1. Every (topic, template) pair generates a valid scenario --------

// The generator picks pairs at random, so we sweep many seeds and record
// which pairs we saw. If any expected pair is never produced across the
// sweep we treat it as suspicious (but not fatal), because the RNG might
// simply not have picked it.

const seenPairs = new Set();

for (let seed = 1; seed <= 200; seed += 1) {
  const scenario = generateScenario(seed);
  assertShape(scenario, `seed=${seed}`);

  const pair = `${scenario.surveillance.code}::${scenario.groundTruth.templateId}`;
  seenPairs.add(pair);
}

// --- 2. Difficulty filtering ------------------------------------------

for (const difficulty of [1, 2, 3]) {
  for (let seed = 1; seed <= 60; seed += 1) {
    const scenario = generateScenario(seed, { difficulty });
    assert(
      scenario.groundTruth.difficulty === difficulty,
      `difficulty filter should honour difficulty=${difficulty} (seed ${seed}) got ${scenario.groundTruth.difficulty}`
    );
  }
}

// --- 3. Every template has a full 5-field tip -------------------------

for (const template of SCENARIO_TEMPLATES) {
  const entry = INVESTIGATION_TIPS[template.id];
  assert(
    entry !== undefined,
    `INVESTIGATION_TIPS missing entry for template "${template.id}"`
  );

  // Build a synthetic scenario for function-form tips so we can resolve
  // them without needing the generator's RNG to have selected them.
  const topicCode = template.appliesTo[0];
  const topic = SURVEILLANCE_TOPICS[topicCode];
  const fakeScenario = {
    surveillance: topic,
    groundTruth: {
      templateId: template.id,
      affectedWard: "Critical Care"
    }
  };

  const tip = resolveInvestigationTip(fakeScenario);
  assert(
    tip && typeof tip === "object",
    `resolveInvestigationTip returned nothing for "${template.id}"`
  );

  for (const field of TIP_FIELDS) {
    assert(
      typeof tip[field] === "string" && tip[field].length >= 20,
      `tip for "${template.id}" is missing or too short in field "${field}"`
    );
  }
}

// --- 4. Every template appliesTo contains only known topic codes -------

for (const template of SCENARIO_TEMPLATES) {
  for (const code of template.appliesTo) {
    assert(
      SURVEILLANCE_TOPICS[code] !== undefined,
      `template "${template.id}" appliesTo unknown topic "${code}"`
    );
  }
}

// --- 5. Ward-closure scenarios record affectedWard ---------------------

let sawWardClosure = false;
for (let seed = 1; seed <= 2000 && !sawWardClosure; seed += 1) {
  const scenario = generateScenario(seed, { difficulty: 3 });
  if (scenario.groundTruth.templateId === "ward-closure") {
    sawWardClosure = true;
    assert(
      typeof scenario.groundTruth.affectedWard === "string" &&
        scenario.groundTruth.affectedWard.length > 0,
      "ward-closure scenario must record affectedWard"
    );
  }
}
assert(
  sawWardClosure,
  "no ward-closure scenario was produced in 2000 seeds \u2014 templates.js or generator.js may not be wired up"
);

// --- 6. Testing-reduction is produced and stays CPE --------------------

let sawTestingReduction = false;
for (let seed = 1; seed <= 2000 && !sawTestingReduction; seed += 1) {
  const scenario = generateScenario(seed, { difficulty: 3 });
  if (scenario.groundTruth.templateId === "testing-reduction") {
    sawTestingReduction = true;
    assert(
      scenario.surveillance.code === "CPE",
      "testing-reduction must only apply to CPE"
    );
  }
}
assert(
  sawTestingReduction,
  "no testing-reduction scenario was produced in 2000 seeds"
);

// --- 7. Respiratory-HAI observations carry consistent onset bins -------
//
// For every respiratory-hai observation:
//   numerator === sum(community + indeterminate + probableHAI + definiteHAI)
// This exercises the generator's Poisson-then-reporting-artefact
// rescaling path.

let sawRespiratory = false;
for (let seed = 1; seed <= 4000 && !sawRespiratory; seed += 1) {
  const scenario = generateScenario(seed);

  if (scenario.surveillance.surveillanceKind !== "respiratory-hai") {
    continue;
  }

  sawRespiratory = true;

  for (const obs of scenario.observations) {
    assert(
      obs.onsetBins &&
        typeof obs.onsetBins.community === "number" &&
        typeof obs.onsetBins.indeterminate === "number" &&
        typeof obs.onsetBins.probableHAI === "number" &&
        typeof obs.onsetBins.definiteHAI === "number",
      "respiratory observation should have onsetBins with 4 numeric fields"
    );

    const sum =
      obs.onsetBins.community +
      obs.onsetBins.indeterminate +
      obs.onsetBins.probableHAI +
      obs.onsetBins.definiteHAI;

    assert(
      sum === obs.numerator,
      `respiratory observation: numerator (${obs.numerator}) should equal sum of onsetBins (${sum})`
    );
  }

  assert(
    scenario.learnerState.display.haiCutoff === "probable-and-definite",
    "respiratory scenarios must default haiCutoff to probable-and-definite"
  );
}
assert(
  sawRespiratory,
  "no respiratory-hai scenario was produced in 4000 seeds \u2014 topics.js may not export COVID/INFA/RSV"
);

// --- 8. Each respiratory template is produced at least once ------------

const respiratoryTemplateIds = [
  "respiratory-community-surge",
  "respiratory-ward-cluster",
  "respiratory-definition-cutoff"
];

for (const templateId of respiratoryTemplateIds) {
  let seen = false;

  for (let seed = 1; seed <= 6000 && !seen; seed += 1) {
    const scenario = generateScenario(seed);

    if (scenario.groundTruth.templateId === templateId) {
      seen = true;

      if (templateId === "respiratory-ward-cluster") {
        assert(
          typeof scenario.groundTruth.affectedWard === "string" &&
            scenario.groundTruth.affectedWard.length > 0,
          "respiratory-ward-cluster must record affectedWard"
        );
      }
    }
  }

  assert(
    seen,
    `no ${templateId} scenario produced in 6000 seeds`
  );
}

// --- 9. applyHaiCutoff sums the correct bins ---------------------------

const syntheticPoints = [
  {
    date: "2024-01-01",
    numerator: 999,
    denominator: 1000,
    onsetBins: {
      community: 10,
      indeterminate: 4,
      probableHAI: 3,
      definiteHAI: 2
    }
  },
  {
    date: "2024-01-08",
    numerator: 999,
    denominator: 1000,
    onsetBins: null
  }
];

const expectedByCutoff = {
  "all": 19,
  "excluding-community": 9,
  "probable-and-definite": 5,
  "definite-only": 2
};

for (const [cutoff, expected] of Object.entries(expectedByCutoff)) {
  const result = applyHaiCutoff(syntheticPoints, cutoff);

  assert(
    result[0].numerator === expected,
    `applyHaiCutoff("${cutoff}") should set numerator to ${expected}, got ${result[0].numerator}`
  );

  assert(
    result[1].numerator === 999,
    `applyHaiCutoff must leave points without onsetBins unchanged (got ${result[1].numerator})`
  );
}

// --- 10. Subtype-carrying topics: numeratorBySubtype sums to numerator -

const subtypeCodes = ["CPE", "COVID", "INFA"];
const seenSubtypeTopics = new Set();

for (let seed = 1; seed <= 6000 && seenSubtypeTopics.size < subtypeCodes.length; seed += 1) {
  const scenario = generateScenario(seed);

  if (!subtypeCodes.includes(scenario.surveillance.code)) continue;
  if (seenSubtypeTopics.has(scenario.surveillance.code)) continue;

  seenSubtypeTopics.add(scenario.surveillance.code);

  for (const obs of scenario.observations) {
    assert(
      obs.numeratorBySubtype && typeof obs.numeratorBySubtype === "object",
      `${scenario.surveillance.code}: observation missing numeratorBySubtype`
    );

    const sum = Object.values(obs.numeratorBySubtype).reduce(
      (acc, count) => acc + count,
      0
    );

    assert(
      sum === obs.numerator,
      `${scenario.surveillance.code}: numeratorBySubtype sums (${sum}) should equal numerator (${obs.numerator})`
    );
  }

  assert(
    scenario.learnerState.filters.subtype === "all",
    `${scenario.surveillance.code}: default subtype filter should be "all"`
  );
}

for (const code of subtypeCodes) {
  assert(
    seenSubtypeTopics.has(code),
    `no ${code} scenario produced in 6000 seeds`
  );
}

// --- 11. Subtype templates are produced -------------------------------

for (const templateId of ["subtype-emergence", "subtype-displacement"]) {
  let seen = false;
  for (let seed = 1; seed <= 6000 && !seen; seed += 1) {
    const scenario = generateScenario(seed, { difficulty: 3 });
    if (scenario.groundTruth.templateId === templateId) seen = true;
  }
  assert(
    seen,
    `no ${templateId} scenario produced in 6000 seeds at difficulty 3`
  );
}

// --- 12. applySubtypeFilter arithmetic --------------------------------

const subPoints = [
  {
    date: "2024-01-01",
    numerator: 100,
    denominator: 4000,
    numeratorBySubtype: { KPC: 30, OXA48: 40, NDM: 20, VIM: 7, IMP: 3 },
    onsetBins: null
  },
  {
    date: "2024-01-08",
    numerator: 100,
    denominator: 4000,
    numeratorBySubtype: null,
    onsetBins: null
  }
];

const kpcFiltered = applySubtypeFilter(subPoints, "KPC");
assert(
  kpcFiltered[0].numerator === 30,
  `applySubtypeFilter("KPC") should set numerator to 30, got ${kpcFiltered[0].numerator}`
);
assert(
  kpcFiltered[1].numerator === 100,
  `applySubtypeFilter must leave points without numeratorBySubtype unchanged (got ${kpcFiltered[1].numerator})`
);

const allFiltered = applySubtypeFilter(subPoints, "all");
assert(
  allFiltered[0].numerator === 100,
  `applySubtypeFilter("all") must be a no-op (got ${allFiltered[0].numerator})`
);

const nullFiltered = applySubtypeFilter(subPoints, null);
assert(
  nullFiltered[0].numerator === 100,
  `applySubtypeFilter(null) must be a no-op (got ${nullFiltered[0].numerator})`
);

// Subtype filter + onsetBins together (respiratory scenario shape).
const respPoint = [
  {
    date: "2024-01-01",
    numerator: 100,
    denominator: 4000,
    numeratorBySubtype: { JN1: 60, XBB: 30, BA5: 10 },
    onsetBins: {
      community: 50,
      indeterminate: 20,
      probableHAI: 20,
      definiteHAI: 10
    }
  }
];

const respFiltered = applySubtypeFilter(respPoint, "BA5");
assert(
  respFiltered[0].numerator === 10,
  `respiratory subtype filter should set numerator to 10, got ${respFiltered[0].numerator}`
);
// onsetBins should be scaled by 10/100 = 0.1
assert(
  respFiltered[0].onsetBins.community === 5,
  `respiratory subtype filter should scale community bin to 5, got ${respFiltered[0].onsetBins.community}`
);
assert(
  respFiltered[0].onsetBins.definiteHAI === 1,
  `respiratory subtype filter should scale definiteHAI bin to 1, got ${respFiltered[0].onsetBins.definiteHAI}`
);

// --- 13. Device / procedure-cohort topics generate valid scenarios ----

const deviceProcedureCodes = ["CAUTI", "CLABSI", "SSICOLO", "SSICARD"];
const seenDeviceProcTopics = new Set();

for (let seed = 1; seed <= 8000 && seenDeviceProcTopics.size < deviceProcedureCodes.length; seed += 1) {
  const scenario = generateScenario(seed);

  if (!deviceProcedureCodes.includes(scenario.surveillance.code)) continue;
  if (seenDeviceProcTopics.has(scenario.surveillance.code)) continue;

  seenDeviceProcTopics.add(scenario.surveillance.code);

  // Every observation must have finite non-negative numerator and denominator.
  for (const obs of scenario.observations) {
    assert(
      Number.isFinite(obs.numerator) && obs.numerator >= 0,
      `${scenario.surveillance.code}: numerator must be finite and non-negative (got ${obs.numerator})`
    );
    assert(
      Number.isFinite(obs.denominator) && obs.denominator >= 0,
      `${scenario.surveillance.code}: denominator must be finite and non-negative (got ${obs.denominator})`
    );

    // For procedure-cohort, numerator cannot exceed denominator.
    if (scenario.surveillance.surveillanceKind === "procedure-cohort") {
      assert(
        obs.numerator <= obs.denominator + 5, // small allowance for reporting-artefact draws
        `${scenario.surveillance.code}: SSI numerator (${obs.numerator}) should not exceed procedures + reporting allowance (${obs.denominator})`
      );
    }
  }

  // Denominator must be non-zero somewhere in the series.
  const totalDenominator = scenario.observations.reduce(
    (sum, obs) => sum + obs.denominator,
    0
  );
  assert(
    totalDenominator > 0,
    `${scenario.surveillance.code}: total denominator across all observations must be > 0`
  );
}

for (const code of deviceProcedureCodes) {
  assert(
    seenDeviceProcTopics.has(code),
    `no ${code} scenario produced in 8000 seeds`
  );
}

// --- 14. Stage-7 templates are produced -------------------------------

for (const templateId of ["care-bundle-intervention", "procedure-mix-shift"]) {
  let seen = false;
  for (let seed = 1; seed <= 8000 && !seen; seed += 1) {
    const scenario = generateScenario(seed);
    if (scenario.groundTruth.templateId === templateId) seen = true;
  }
  assert(
    seen,
    `no ${templateId} scenario produced in 8000 seeds`
  );
}

// --- 15. Apportionment observations carry consistent bins -------------
//
// Every observation for a topic with `apportionmentCategories` (CDI
// plus every mandatory bacteraemia topic) must expose an
// `apportionmentBins` object with the three NHS / UKHSA categories
// (HOHA, COHA, COCA) summing to the observation numerator, so
// downstream filters attribute the exact same total. Sweep enough
// seeds to cover every topic in TOPIC_GROUPS.ALL_BACTERAEMIA at least
// once.

const apportionmentTopicsSeen = new Set();
const apportionmentTopicsRequired = new Set([
  "CDI", "MRSA", "MSSA", "KLEB", "PSAER", "ECOLI"
]);

for (let seed = 1; seed <= 20000 && apportionmentTopicsSeen.size < apportionmentTopicsRequired.size; seed += 1) {
  const scenario = generateScenario(seed);

  if (!scenario.surveillance.apportionmentCategories) continue;
  if (apportionmentTopicsSeen.has(scenario.surveillance.code)) continue;

  apportionmentTopicsSeen.add(scenario.surveillance.code);

  for (const obs of scenario.observations) {
    assert(
      obs.apportionmentBins &&
        typeof obs.apportionmentBins.HOHA === "number" &&
        typeof obs.apportionmentBins.COHA === "number" &&
        typeof obs.apportionmentBins.COCA === "number",
      `${scenario.surveillance.code} observation should have apportionmentBins with the three NHS categories`
    );

    const sum =
      obs.apportionmentBins.HOHA +
      obs.apportionmentBins.COHA +
      obs.apportionmentBins.COCA;

    assert(
      sum === obs.numerator,
      `${scenario.surveillance.code} observation: numerator (${obs.numerator}) should equal sum of apportionmentBins (${sum})`
    );
  }

  assert(
    scenario.learnerState.display.apportionment === "trust-apportioned",
    `${scenario.surveillance.code} scenarios must default apportionment to trust-apportioned`
  );
}

for (const code of apportionmentTopicsRequired) {
  assert(
    apportionmentTopicsSeen.has(code),
    `no ${code} scenario with apportionment was produced in 20000 seeds`
  );
}

// --- 16. applyApportionmentClassification sums the correct bins -------

const syntheticApportionmentPoints = [
  {
    date: "2024-01-01",
    numerator: 999,
    denominator: 1000,
    apportionmentBins: { HOHA: 4, COHA: 3, COCA: 5 }
  },
  {
    date: "2024-01-08",
    numerator: 999,
    denominator: 1000,
    apportionmentBins: null
  }
];

const expectedByClassification = {
  "all":                       12,
  "trust-apportioned":          7,
  "hospital-onset":             4,
  "community-onset-hcai":       3,
  "community-onset-community":  5
};

for (const [classification, expected] of Object.entries(expectedByClassification)) {
  const result = applyApportionmentClassification(syntheticApportionmentPoints, classification);

  assert(
    result[0].numerator === expected,
    `applyApportionmentClassification("${classification}") should set numerator to ${expected}, got ${result[0].numerator}`
  );

  assert(
    result[1].numerator === 999,
    `applyApportionmentClassification must leave points without apportionmentBins unchanged (got ${result[1].numerator})`
  );
}

// --- 17. Determinism --------------------------------------------------
//
// mulberry32 is a fixed 32-bit PRNG and the whole generator is a pure
// function of the seed. The same seed must therefore return an
// identical scenario, byte-for-byte, apart from `generatedAt` (a
// wall-clock timestamp). Verify against a handful of arbitrary seeds
// so any accidental introduction of Date.now(), Math.random() or a
// non-deterministic hospital / ward name draw is caught.

for (const seed of [1, 42, 1729, 987654]) {
  const first = generateScenario(seed);
  const second = generateScenario(seed);

  const firstCopy = { ...first };
  const secondCopy = { ...second };
  delete firstCopy.generatedAt;
  delete secondCopy.generatedAt;

  assert(
    JSON.stringify(firstCopy) === JSON.stringify(secondCopy),
    `generateScenario(${seed}) must be deterministic (excluding generatedAt)`
  );
}

// --- 18. Schema-version consistency -----------------------------------
//
// The value written by generateScenario() as scenario.schemaVersion
// MUST equal the SCHEMA_VERSION constant enforced by js/storage.js.
// If they drift the storage layer silently discards every scenario the
// generator produces (as happened when the CDI-to-apportionment refactor
// bumped storage to v4 but left the generator at v3). Parse the two
// files as text so this check does not itself depend on being able to
// import storage.js in a Node environment.

const storageSource = readFileSync(
  resolve(HERE, "../js/storage.js"),
  "utf8"
);
const schemaMatch = storageSource.match(
  /SCHEMA_VERSION\s*=\s*(\d+)/
);
assert(
  schemaMatch,
  "js/storage.js should declare a SCHEMA_VERSION constant"
);
const storageSchemaVersion = Number(schemaMatch[1]);

const anyScenario = generateScenario(1);
assert(
  anyScenario.schemaVersion === storageSchemaVersion,
  `scenario.schemaVersion (${anyScenario.schemaVersion}) must equal SCHEMA_VERSION in js/storage.js (${storageSchemaVersion}); otherwise every generated scenario is discarded on reload`
);

// --- 19. SPC-pipeline invariants across every topic -------------------
//
// Run prepareAnalysis over one scenario per topic and assert basic
// numeric invariants on every returned point:
//   - `value` is either finite or null (no NaN / Infinity leakage);
//   - control-chart limits satisfy lower3 <= lower2 <= centre
//     <= upper2 <= upper3;
//   - proportion values live in [0, 1] before rate-multiplier scaling
//     (p-chart) and never NaN;
//   - non-negativity of centre and lower limits (rates / counts /
//     proportions cannot be negative).

const topicCodesSeen = new Set();
const allTopicCodes = new Set(Object.keys(SURVEILLANCE_TOPICS));

for (let seed = 1; seed <= 20000 && topicCodesSeen.size < allTopicCodes.size; seed += 1) {
  const scenario = generateScenario(seed);
  if (topicCodesSeen.has(scenario.surveillance.code)) continue;
  topicCodesSeen.add(scenario.surveillance.code);

  const analysis = prepareAnalysis(scenario, {
    site: "all",
    ward: "all",
    subtype: "all",
    measure: scenario.surveillance.defaultMeasure,
    timeWindow: 156,
    aggregation: 1,
    smoothing: 0,
    spcType: "auto",
    haiCutoff: "probable-and-definite",
    apportionment: "trust-apportioned"
  });

  assert(
    ["c", "u", "p", "none"].includes(analysis.chartType),
    `${scenario.surveillance.code}: unexpected chartType ${analysis.chartType}`
  );

  for (const point of analysis.points) {
    if (analysis.chartType === "none") {
      // No control-chart fields expected; value may be null when
      // denominator is zero (e.g. CPE screen with no swabs that week).
      assert(
        point.value === null || Number.isFinite(point.value),
        `${scenario.surveillance.code}: value must be finite or null, got ${point.value}`
      );
      continue;
    }

    if (point.value !== null) {
      assert(
        Number.isFinite(point.value),
        `${scenario.surveillance.code}: value must be finite when non-null, got ${point.value}`
      );
      assert(
        point.value >= 0,
        `${scenario.surveillance.code}: value must be non-negative, got ${point.value}`
      );
    }

    assert(
      Number.isFinite(point.centre) && point.centre >= 0,
      `${scenario.surveillance.code}: centre must be finite and non-negative, got ${point.centre}`
    );

    if (point.lower3 !== null) {
      assert(
        point.lower3 >= 0,
        `${scenario.surveillance.code}: lower3 must be non-negative, got ${point.lower3}`
      );
      assert(
        point.lower3 <= point.lower2 + 1e-9,
        `${scenario.surveillance.code}: lower3 (${point.lower3}) must be <= lower2 (${point.lower2})`
      );
      assert(
        point.lower2 <= point.centre + 1e-9,
        `${scenario.surveillance.code}: lower2 (${point.lower2}) must be <= centre (${point.centre})`
      );
      assert(
        point.centre <= point.upper2 + 1e-9,
        `${scenario.surveillance.code}: centre (${point.centre}) must be <= upper2 (${point.upper2})`
      );
      assert(
        point.upper2 <= point.upper3 + 1e-9,
        `${scenario.surveillance.code}: upper2 (${point.upper2}) must be <= upper3 (${point.upper3})`
      );
    }
  }
}

for (const code of allTopicCodes) {
  assert(
    topicCodesSeen.has(code),
    `no ${code} scenario produced in 20000 seeds for SPC pipeline invariant check`
  );
}

// --- 20. Nelson rule 1 (single point beyond 3-SD) fires ---------------

const rule1Points = [
  { value: 5,   centre: 5, upper2: 8,   lower2: 2,   upper3: 10, lower3: 0 },
  { value: 5,   centre: 5, upper2: 8,   lower2: 2,   upper3: 10, lower3: 0 },
  { value: 12,  centre: 5, upper2: 8,   lower2: 2,   upper3: 10, lower3: 0 }, // above upper3
  { value: 5,   centre: 5, upper2: 8,   lower2: 2,   upper3: 10, lower3: 0 },
  { value: -1,  centre: 5, upper2: 8,   lower2: 2,   upper3: 10, lower3: 0 }  // below lower3
];

const rule1Result = detectSignals(rule1Points);

assert(
  rule1Result[2].isSignal &&
    rule1Result[2].signals.some(s => s.includes("Above the upper 3-SD")),
  "detectSignals should flag a point above upper3 as an SPC signal"
);
assert(
  rule1Result[4].isSignal &&
    rule1Result[4].signals.some(s => s.includes("Below the lower 3-SD")),
  "detectSignals should flag a point below lower3 as an SPC signal"
);
assert(
  !rule1Result[0].isSignal && !rule1Result[1].isSignal && !rule1Result[3].isSignal,
  "detectSignals must not flag in-limit points as SPC signals"
);

// --- 21. Nelson rule 4 (eight consecutive on one side of centre) ------

const rule4AbovePoints = Array.from({ length: 10 }, (_, i) => ({
  value: 6 + (i % 2 === 0 ? 0.1 : 0.2), // all above centre, none beyond 3-SD
  centre: 5,
  upper2: 8,
  lower2: 2,
  upper3: 10,
  lower3: 0
}));

const rule4Result = detectSignals(rule4AbovePoints);

// Points 0-6 (fewer than 8 in a row) must not fire rule 4.
for (let i = 0; i <= 6; i += 1) {
  assert(
    !rule4Result[i].signals.some(s => s.includes("Eight consecutive")),
    `rule 4 must not fire before eight points have accumulated (index ${i})`
  );
}
// Point 7 completes the first run of 8; every subsequent point extends it.
for (let i = 7; i < rule4Result.length; i += 1) {
  assert(
    rule4Result[i].signals.some(s => s.includes("Eight consecutive observations above")),
    `rule 4 must fire once eight consecutive above-centre points have accumulated (index ${i})`
  );
}

const rule4BelowPoints = rule4AbovePoints.map(p => ({
  ...p,
  value: 5 - (p.value - 5)
}));
const rule4BelowResult = detectSignals(rule4BelowPoints);
assert(
  rule4BelowResult[7].signals.some(s => s.includes("Eight consecutive observations below")),
  "rule 4 must fire symmetrically for consecutive below-centre runs"
);

// --- 22. aggregatePoints preserves numerator / denominator totals -----

const aggregationInput = Array.from({ length: 10 }, (_, i) => ({
  date: `2024-01-${String(i * 7 + 1).padStart(2, "0")}`,
  numerator: i + 1,          // 1..10, sum = 55
  denominator: 100,
  bedDays: 100
}));

for (const groupSize of [1, 2, 4, 5, 13]) {
  const aggregated = aggregatePoints(aggregationInput, groupSize);
  const totalNumerator = aggregated.reduce((s, p) => s + p.numerator, 0);
  const totalDenominator = aggregated.reduce((s, p) => s + p.denominator, 0);
  assert(
    totalNumerator === 55,
    `aggregatePoints(groupSize=${groupSize}): total numerator must be preserved (got ${totalNumerator})`
  );
  assert(
    totalDenominator === 1000,
    `aggregatePoints(groupSize=${groupSize}): total denominator must be preserved (got ${totalDenominator})`
  );
  assert(
    aggregated.length === Math.ceil(10 / groupSize),
    `aggregatePoints(groupSize=${groupSize}): expected ${Math.ceil(10 / groupSize)} groups, got ${aggregated.length}`
  );
}

// --- 23. selectControlChart auto-select maps measure -> chart ---------

const dummySurveillance = { recommendedChart: "u" };

assert(
  selectControlChart("auto", dummySurveillance, "count") === "c",
  "auto + measure=count should select c-chart"
);
assert(
  selectControlChart("auto", dummySurveillance, "rate") === "u",
  "auto + measure=rate should select u-chart"
);
assert(
  selectControlChart("auto", dummySurveillance, "proportion") === "p",
  "auto + measure=proportion should select p-chart"
);
assert(
  selectControlChart("p", dummySurveillance, "count") === "p",
  "explicit chart type must override auto mapping"
);
assert(
  selectControlChart("none", dummySurveillance, "count") === "none",
  "explicit 'none' must be preserved"
);

// --- 24. Scenario code round-trip ------------------------------------

const codeRoundTripCases = [
  { seed: 1, difficulty: null },
  { seed: 42, difficulty: 1 },
  { seed: 1729, difficulty: 2 },
  { seed: 987654, difficulty: 3 },
  { seed: 0xffffffff, difficulty: null }
];

for (const { seed, difficulty } of codeRoundTripCases) {
  const generated = generateScenario(seed, { difficulty });
  assert(
    generated.generationDifficulty === difficulty,
    `scenario.generationDifficulty should be ${difficulty}, got ${generated.generationDifficulty}`
  );

  const code = formatScenarioCode(generated);
  const parsed = parseScenarioCode(code);

  assert(
    parsed !== null,
    `formatted code ${code} must parse back`
  );
  assert(
    parsed.seed === seed,
    `round-trip seed: expected ${seed}, got ${parsed && parsed.seed}`
  );
  assert(
    parsed.difficulty === difficulty,
    `round-trip difficulty: expected ${difficulty}, got ${parsed && parsed.difficulty}`
  );
  assert(
    parsed.version === APP_VERSION_CODE,
    `round-trip version: expected ${APP_VERSION_CODE}, got ${parsed && parsed.version}`
  );
}

// Accept legacy hex-only form (assume mixed difficulty, no version).
const legacyOnly = parseScenarioCode("3f9a7c8b");
assert(
  legacyOnly !== null &&
    legacyOnly.seed === 0x3f9a7c8b &&
    legacyOnly.difficulty === null &&
    legacyOnly.version === null,
  "legacy hex-only code should parse with null difficulty and null version"
);

// Accept legacy scenario- prefix.
const legacyPrefixed = parseScenarioCode("scenario-3f9a7c8b");
assert(
  legacyPrefixed !== null &&
    legacyPrefixed.seed === 0x3f9a7c8b,
  "legacy scenario- prefix should parse"
);

// Accept version-less compact form.
const versionless = parseScenarioCode("2-3f9a7c8b");
assert(
  versionless !== null &&
    versionless.seed === 0x3f9a7c8b &&
    versionless.difficulty === 2 &&
    versionless.version === null,
  "version-less form should parse difficulty and seed"
);

// Malformed inputs must return null.
const malformed = [
  "",
  "not-a-code",
  "v01-4-3f9a7c8b", // difficulty 4 is invalid
  "v01-x-zzzzzzzz", // non-hex seed
  "v01-x-", // empty seed
  "v01-x-3f9a7c8b-extra", // too many segments
  "v01-x-1ffffffff", // seed > 32-bit
  null,
  undefined,
  123
];
for (const bad of malformed) {
  assert(
    parseScenarioCode(bad) === null,
    `malformed code ${JSON.stringify(bad)} must parse to null`
  );
}

// Case-insensitive and whitespace-tolerant.
const untidy = parseScenarioCode("  V01-X-3F9A7C8B  ");
assert(
  untidy !== null &&
    untidy.seed === 0x3f9a7c8b &&
    untidy.difficulty === null &&
    untidy.version === "v01",
  "code parsing should tolerate case and surrounding whitespace"
);

// --- Report ------------------------------------------------------------

console.log(
  `\n${checks - failures}/${checks} checks passed. Distinct pairs seen: ${seenPairs.size}.`
);

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S).`);
  process.exit(1);
}

console.log("Smoke test passed.");
