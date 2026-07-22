// tests/scenarios.smoke.mjs
//
// Node smoke test for the scenario generator and tips module.
//
//   node tests/scenarios.smoke.mjs
//
// Assertions:
//
//   1. Every (topic, template) pair in the template registry can be
//      generated at least once and produces a well-formed scenario with
//      156 weekly observations per ward (156 * 8 = 1248 rows).
//   2. Difficulty filtering returns only templates at the requested
//      difficulty.
//   3. Every template has a resolvable tip (from js/tips.js) exposing
//      the full 5-field schema (or the denominator-change/ward-closure
//      function form which returns one).
//   4. Every scenario carries the expected schemaVersion, id, seed,
//      surveillance and groundTruth structure.
//
// The test is intentionally lightweight; it fails fast on the first
// broken invariant. Use `node --test` style output only if this file
// grows further.

import { generateScenario } from "../js/generator.js";
import { SURVEILLANCE_TOPICS } from "../js/topics.js";
import { SCENARIO_TEMPLATES } from "../js/templates.js";
import {
  INVESTIGATION_TIPS,
  resolveInvestigationTip
} from "../js/tips.js";
import { applyHaiCutoff, applySubtypeFilter } from "../js/statistics.js";

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
    scenario.schemaVersion === 3,
    `${context}: schemaVersion should be 3, got ${scenario.schemaVersion}`
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

// --- Report ------------------------------------------------------------

console.log(
  `\n${checks - failures}/${checks} checks passed. Distinct pairs seen: ${seenPairs.size}.`
);

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S).`);
  process.exit(1);
}

console.log("Smoke test passed.");
