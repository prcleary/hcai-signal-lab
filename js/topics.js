// js/topics.js
//
// UK mandatory HCAI-surveillance topics used to seed scenarios.
//
// `surveillanceKind` is metadata that groups topics by the shape of
// their observation series so scenario templates can declare which
// families they operate against (see js/templates.js). Current kinds:
//
//   count-per-bed-days   Weekly case count with a bed-days denominator.
//                        Suits mandatory bacteraemia reporting and CDI.
//   screening-proportion Weekly positives among patients screened.
//                        Suits CPE-style screening surveillance.
//
// Rates are per rateMultiplier units of the denominator (so 10,000
// bed-days for bacteraemia, and per 100 screened patients / percentage
// positive for screening).
//
// Baseline rates are broadly aligned with published UK figures but have
// been rounded to give visible weekly signals on a mid-sized trust
// (~4,500 bed-days per week). They are illustrative, not authoritative.

export const SURVEILLANCE_TOPICS = {
  CDI: {
    code: "CDI",
    surveillanceKind: "count-per-bed-days",
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
    surveillanceKind: "count-per-bed-days",
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

  MSSA: {
    code: "MSSA",
    surveillanceKind: "count-per-bed-days",
    organism: "MSSA bacteraemia",
    shortName: "MSSA",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.00020
  },

  KLEB: {
    code: "KLEB",
    surveillanceKind: "count-per-bed-days",
    organism: "Klebsiella spp. bacteraemia",
    shortName: "Klebsiella",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.00015
  },

  PSAER: {
    code: "PSAER",
    surveillanceKind: "count-per-bed-days",
    organism: "Pseudomonas aeruginosa bacteraemia",
    shortName: "P. aeruginosa",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Cases",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    // Rare enough that a varying denominator makes little practical
    // difference to the limits; a c-chart matches the c-chart used for
    // MRSA and reads as "count with constant area of opportunity".
    recommendedChart: "c",
    baselineRate: 0.00008
  },

  CPE: {
    code: "CPE",
    surveillanceKind: "screening-proportion",
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
    surveillanceKind: "count-per-bed-days",
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
 * Convenience groupings for use by scenario templates when declaring the
 * organisms they apply to.
 */
export const TOPIC_GROUPS = {
  // Every count-per-bed-days topic including very rare ones.
  ALL_BACTERAEMIA: ["CDI", "MRSA", "MSSA", "KLEB", "PSAER", "ECOLI"],

  // Topics whose baseline weekly count is high enough that a x2 step or
  // a single x5 spike produces a visible, learner-usable pattern. MRSA
  // and PSAER are omitted because their baseline is so low that these
  // templates would resolve to no visible cases.
  COMMON_BACTERAEMIA: ["CDI", "MSSA", "KLEB", "ECOLI"],

  // Screening-proportion topics.
  SCREENING: ["CPE"]
};
