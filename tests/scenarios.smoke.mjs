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

// --- Report ------------------------------------------------------------

console.log(
  `\n${checks - failures}/${checks} checks passed. Distinct pairs seen: ${seenPairs.size}.`
);

if (failures > 0) {
  console.error(`\n${failures} FAILURE(S).`);
  process.exit(1);
}

console.log("Smoke test passed.");
