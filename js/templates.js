// js/templates.js
//
// Scenario templates for HCAI Signal Lab.
//
// A template describes the shape of an underlying epidemiological or
// surveillance behaviour that the learner is asked to identify. The
// generator (js/generator.js) turns a template + a topic into a weekly
// observation series.
//
// Each template declares:
//   id            Stable machine identifier used everywhere.
//   name          Human-facing title shown on the reveal.
//   difficulty    1 = introductory, 2 = intermediate, 3 = advanced.
//   category      Editorial grouping. "epidemiology" describes real
//                 changes in disease; "surveillance-behaviour" describes
//                 changes in how the data are generated or counted.
//   appliesTo     List of topic codes this template can be paired with.
//
// The change-point positions dictionary and the explanation-builder are
// kept alongside the template list because they are template-shaped
// data, not simulation logic.

import { TOPIC_GROUPS } from "./topics.js";

const { ALL_BACTERAEMIA, COMMON_BACTERAEMIA, SCREENING, RESPIRATORY } =
  TOPIC_GROUPS;

export const SCENARIO_TEMPLATES = [
  {
    id: "common-cause",
    name: "Stable common-cause variation",
    difficulty: 1,
    category: "epidemiology",
    appliesTo: [...ALL_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "single-extreme",
    name: "Isolated extreme observation",
    difficulty: 1,
    category: "epidemiology",
    appliesTo: [...COMMON_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "step-increase",
    name: "Sustained step increase",
    difficulty: 1,
    category: "epidemiology",
    appliesTo: [...COMMON_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "gradual-trend",
    name: "Gradual underlying increase",
    difficulty: 2,
    category: "epidemiology",
    appliesTo: [...COMMON_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "local-outbreak",
    name: "Localised ward outbreak",
    difficulty: 2,
    category: "epidemiology",
    // Kept broad because the generator boosts the multiplier for
    // low-baseline organisms so the outbreak remains visible.
    appliesTo: [...ALL_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "seasonality",
    name: "Seasonal variation",
    difficulty: 2,
    category: "epidemiology",
    // Seasonality is most defensible for CDI (winter norovirus /
    // antibiotic-prescribing cycle) and E. coli (summer dehydration and
    // urinary-tract seasonality). Respiratory topics carry seasonality
    // as a topic-level baseline effect (see topics.js), so this template
    // is not used for them; a "seasonality template" over an already
    // seasonal baseline would double the signal.
    appliesTo: ["CDI", "ECOLI"]
  },
  {
    id: "screening-expansion",
    name: "Expansion of screening",
    difficulty: 2,
    category: "surveillance-behaviour",
    appliesTo: [...SCREENING]
  },
  {
    id: "targeted-screening",
    name: "Change to targeted screening",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...SCREENING]
  },
  {
    id: "denominator-change",
    name: "Changing denominator",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...COMMON_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },
  {
    id: "reporting-artefact",
    name: "Reporting delay or batch reporting",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...COMMON_BACTERAEMIA, ...SCREENING, ...RESPIRATORY]
  },

  // --- Surveillance-behaviour / data-quality templates ---------------

  {
    id: "testing-reduction",
    name: "Reduced testing (denominator gaming)",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...SCREENING]
  },
  {
    id: "case-definition-change",
    name: "Case-definition change",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...COMMON_BACTERAEMIA]
  },
  {
    id: "diagnostic-method-change",
    name: "Diagnostic method change",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...COMMON_BACTERAEMIA]
  },
  {
    id: "ward-closure",
    name: "Ward closure or decant",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...COMMON_BACTERAEMIA, ...RESPIRATORY]
  },

  // --- Respiratory-HAI-specific templates ---------------------------

  {
    id: "respiratory-community-surge",
    name: "Community surge with hospital spill-over",
    difficulty: 2,
    category: "epidemiology",
    appliesTo: [...RESPIRATORY]
  },
  {
    id: "respiratory-ward-cluster",
    name: "Nosocomial ward cluster (definite HAI)",
    difficulty: 2,
    category: "epidemiology",
    appliesTo: [...RESPIRATORY]
  },
  {
    id: "respiratory-definition-cutoff",
    name: "HAI definition cutoff change",
    difficulty: 3,
    category: "surveillance-behaviour",
    appliesTo: [...RESPIRATORY]
  }
];

/**
 * Nominal change-point positions expressed as a fraction of the total
 * observation window. The generator adds a small random jitter and
 * clamps to sensible bounds (see js/generator.js).
 */
export const CHANGE_POINT_POSITIONS = {
  "common-cause": null,
  "single-extreme": 0.65,
  "step-increase": 0.55,
  "gradual-trend": 0.50,
  "local-outbreak": 0.60,
  "seasonality": null,
  "screening-expansion": 0.55,
  "targeted-screening": 0.55,
  "denominator-change": 0.55,
  "reporting-artefact": 0.95,
  "testing-reduction": 0.55,
  "case-definition-change": 0.55,
  "diagnostic-method-change": 0.55,
  "ward-closure": 0.55,
  "respiratory-community-surge": 0.55,
  "respiratory-ward-cluster": 0.60,
  "respiratory-definition-cutoff": 0.55
};

/**
 * Build the plain-text explanation shown at the top of the reveal
 * panel. `context.affectedWard` is provided for templates that pick a
 * specific ward. All other context is intentionally omitted from the
 * explanation itself so the learner cannot infer the parameters used
 * to generate the series.
 */
export function createExplanation(template, context = {}) {
  const affectedWard = context.affectedWard || "one ward";

  switch (template.id) {
    case "common-cause":
      return "No change was made to the underlying process. Any signals seen here are the expected common-cause variation of a stable Poisson or binomial process.";

    case "single-extreme":
      return "A single week was inflated to produce one extreme observation. The rest of the series was left unchanged.";

    case "step-increase":
      return "The underlying rate was stepped up by roughly a factor of two after the change point. The step is sustained.";

    case "gradual-trend":
      return "The underlying rate drifts slowly upward from the change point, reaching about 1.6\u00d7 baseline by the end of the window.";

    case "local-outbreak":
      return `A short cluster of unusually high weeks was seeded on ${affectedWard}. Other wards were left unchanged, so the whole-hospital view dilutes the signal.`;

    case "seasonality":
      return "A repeating annual cycle (\u00b135 % of baseline) was added. Fixed control limits derived from a whole-year baseline will flag every predictable peak as a signal.";

    case "screening-expansion":
      return "The number of patients screened was expanded by roughly 2.5\u00d7 after the change point. True positivity was unchanged, so the count of positives rises while the percentage positive is unchanged.";

    case "targeted-screening":
      return "Screening was narrowed to a higher-risk cohort at the change point. Fewer patients were screened but the ones who were are more likely to be positive, so the percentage positive rises even without a change in the underlying prevalence.";

    case "denominator-change":
      return "The denominator (bed-days or patients screened) was reduced by roughly 45 % after the change point. The numerator falls in proportion, so a count-based view suggests improvement while the rate is unchanged.";

    case "reporting-artefact":
      return "A reporting delay was applied to recent weeks and an earlier week received a batch of overdue reports. The underlying rate did not change; the pattern is entirely an artefact of when reports were received.";

    case "testing-reduction":
      return "The number of patients screened was cut by roughly 60 % after the change point. True positivity was unchanged; the fall in positive cases reflects reduced ascertainment, not less colonisation.";

    case "case-definition-change":
      return "The case definition was tightened at the change point. Cases that would previously have counted no longer meet the definition, producing a step-down in both count and rate without any underlying epidemiological change.";

    case "diagnostic-method-change":
      return "The laboratory switched to a more sensitive diagnostic method at the change point. The step-up in cases reflects better ascertainment, not a rise in transmission.";

    case "ward-closure":
      return `${affectedWard} was closed for the remainder of the window. Its bed-days and cases both fell to near zero at the change point; the trust-wide rate was largely unchanged.`;

    case "respiratory-community-surge":
      return "A large community wave began at the change point. Community-onset detections rose sharply; hospital-onset detections rose more gradually a week or two later as admitted patients incubated and as staff-to-patient transmission stepped up. The trust-wide totals track the community surge more than in-hospital IPC.";

    case "respiratory-ward-cluster":
      return `A nosocomial cluster occurred on ${affectedWard}. Definite-HAI (onset \u226515 days from admission) dominated the affected weeks on that ward. At trust level the signal is diluted; at the affected ward with the cutoff set to \"Definite HAI only\" it becomes obvious.`;

    case "respiratory-definition-cutoff":
      return "The surveillance case definition was tightened at the change point. Detections in the community and indeterminate bins are still occurring but are no longer being reported as HAI. Total detections appear to fall; restricting the cutoff to \"Definite HAI only\" shows no change.";

    default:
      return "The change is described by the template metadata; explore the ward and time-window controls to characterise it.";
  }
}
