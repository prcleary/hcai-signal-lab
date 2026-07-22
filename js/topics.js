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
//   respiratory-hai      Weekly detections classified by day-of-onset
//                        into community / indeterminate / probable HAI /
//                        definite HAI bins per the UKHSA / ECDC
//                        healthcare-associated respiratory infection
//                        definitions. Denominator is occupied bed-days.
//                        Observations carry an `onsetBins` object as
//                        well as the total `numerator`; the display-time
//                        HAI cutoff selector decides which bins are
//                        summed for the plotted metric.
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
    baselineRate: 0.025,
    // Carbapenemase gene distribution amongst screen-positive isolates.
    // Weights sum to 1; the generator draws each isolate's gene from
    // this distribution unless a scenario template overrides it. UK
    // distribution roughly follows OXA-48-like dominant, KPC and NDM
    // substantial, VIM and IMP rare (see UKHSA CPE surveillance).
    subtypes: [
      { code: "KPC",   label: "KPC" },
      { code: "OXA48", label: "OXA-48-like" },
      { code: "NDM",   label: "NDM" },
      { code: "VIM",   label: "VIM" },
      { code: "IMP",   label: "IMP" }
    ],
    subtypeWeights: {
      KPC:   0.30,
      OXA48: 0.40,
      NDM:   0.20,
      VIM:   0.07,
      IMP:   0.03
    }
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
  },

  // -------------------------------------------------------------------
  // Respiratory nosocomial infection topics (surveillance kind
  // "respiratory-hai"). Observations carry a `numerator` (total weekly
  // detections) alongside `onsetBins` broken down by day-of-onset
  // relative to admission. The display-time cutoff selector chooses
  // which bins are summed for the plotted metric:
  //
  //   all                    all onset bins
  //   excluding-community    indeterminate + probable + definite
  //   probable-and-definite  probable + definite (default; matches
  //                          UK reportable HAI)
  //   definite-only          definite only
  //
  // Baseline rates apply to the TOTAL of all bins (all detections). The
  // seasonality helper in js/generator.js multiplies this base rate by
  // an organism-specific seasonal factor. Bin proportions are held in
  // `onsetBinWeights` and are perturbed by scenario templates.
  // -------------------------------------------------------------------

  COVID: {
    code: "COVID",
    surveillanceKind: "respiratory-hai",
    organism: "SARS-CoV-2 (nosocomial classification)",
    shortName: "SARS-CoV-2",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Detections",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    // Total detections (all bins) per occupied bed-day, before
    // seasonal scaling. Set for a mid-sized trust to give roughly
    // 25-40 total detections per week in mid-winter, tailing to
    // 5-10 in high summer.
    baselineRate: 0.0009,
    seasonality: {
      // Peak in early January (week 2), amplitude 0.7 -> factor 0.3 to 1.7.
      amplitude: 0.7,
      peakWeek: 2
    },
    onsetBinWeights: {
      community: 0.55,
      indeterminate: 0.20,
      probableHAI: 0.15,
      definiteHAI: 0.10
    },
    // Dominant lineage first; last entry is treated as the "emerging"
    // candidate for the emergence-of-new-subtype template.
    subtypes: [
      { code: "JN1", label: "JN.1" },
      { code: "XBB", label: "XBB.1.5" },
      { code: "BA5", label: "BA.5" }
    ],
    subtypeWeights: {
      JN1: 0.75,
      XBB: 0.20,
      BA5: 0.05
    }
  },

  INFA: {
    code: "INFA",
    surveillanceKind: "respiratory-hai",
    organism: "Influenza (nosocomial classification)",
    shortName: "Influenza",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Detections",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.0006,
    seasonality: {
      // Peak week 5 (early February), strong amplitude -> near-zero summer.
      amplitude: 0.95,
      peakWeek: 5
    },
    onsetBinWeights: {
      community: 0.70,
      indeterminate: 0.15,
      probableHAI: 0.10,
      definiteHAI: 0.05
    },
    subtypes: [
      { code: "H3N2", label: "A(H3N2)" },
      { code: "H1N1", label: "A(H1N1)pdm09" },
      { code: "B",    label: "B/Victoria" }
    ],
    subtypeWeights: {
      H3N2: 0.55,
      H1N1: 0.30,
      B:    0.15
    }
  },

  RSV: {
    code: "RSV",
    surveillanceKind: "respiratory-hai",
    organism: "RSV (nosocomial classification)",
    shortName: "RSV",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "Detections",
    denominatorLabel: "Bed-days",
    rateMultiplier: 10000,
    recommendedChart: "u",
    baselineRate: 0.0004,
    seasonality: {
      // Peak week 51 (mid-December), strong amplitude.
      amplitude: 0.95,
      peakWeek: 51
    },
    onsetBinWeights: {
      community: 0.75,
      indeterminate: 0.13,
      probableHAI: 0.08,
      definiteHAI: 0.04
    }
  }
};

/**
 * Available HAI cutoff options for the respiratory-hai display selector.
 * The value is the identifier stored in learnerState.display.haiCutoff;
 * the label is what appears in the UI; days is the day-of-admission
 * cutoff used for the label subtitle.
 */
export const HAI_CUTOFF_OPTIONS = [
  { value: "all",                    label: "All detections (any onset day)",             days: 0 },
  { value: "excluding-community",    label: "Excluding community onset (\u22653 days)",   days: 3 },
  { value: "probable-and-definite",  label: "Probable + definite HAI (\u22658 days)",     days: 8 },
  { value: "definite-only",          label: "Definite HAI only (\u226515 days)",          days: 15 }
];

/**
 * Which onset bins are summed for each cutoff option.
 */
export const HAI_CUTOFF_BINS = {
  "all":                   ["community", "indeterminate", "probableHAI", "definiteHAI"],
  "excluding-community":   ["indeterminate", "probableHAI", "definiteHAI"],
  "probable-and-definite": ["probableHAI", "definiteHAI"],
  "definite-only":         ["definiteHAI"]
};

export const HAI_DEFAULT_CUTOFF = "probable-and-definite";

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
  SCREENING: ["CPE"],

  // Respiratory nosocomial-classification topics.
  RESPIRATORY: ["COVID", "INFA", "RSV"],

  // Topics that carry a `subtypes` list (used by the subtype-emergence
  // and subtype-displacement templates and by the UI subtype filter).
  WITH_SUBTYPES: ["CPE", "COVID", "INFA"]
};
