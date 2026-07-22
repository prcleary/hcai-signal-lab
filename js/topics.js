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
//   device-days          Weekly device-associated infections with a
//                        device-days denominator (catheter-days for
//                        CAUTI, central-line-days for CLABSI). Rate is
//                        expressed per 1,000 device-days per the ECDC /
//                        NHSN convention. Device utilisation ratio is
//                        applied to the trust's bed-days to produce a
//                        realistic denominator.
//   procedure-cohort     Weekly SSI count with a procedures-performed
//                        denominator. Rate is a percentage of
//                        procedures. Suits mandatory surgical-site
//                        infection surveillance (colorectal, cardiac).
//
// Rates are per rateMultiplier units of the denominator (so 10,000
// bed-days for bacteraemia, 1,000 device-days for CAUTI / CLABSI, and
// per 100 screened patients / percentage positive for screening and
// SSI).
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
    baselineRate: 0.0007,
    // NHS / UKHSA mandatory-surveillance apportionment categories,
    // shared with MRSA, MSSA, E. coli, Klebsiella spp. and
    // P. aeruginosa bacteraemia. Definitions per the UKHSA data
    // dashboard metrics documentation and the mandatory HCAI
    // surveillance protocol:
    //
    //   HOHA  Hospital Onset, Healthcare Associated.
    //         Specimen date the same or more than 3 days after the
    //         current admission date (day of admission = day 1).
    //   COHA  Community Onset, Healthcare Associated.
    //         Not HOHA, and the patient was most recently discharged
    //         from the same reporting trust in the 28 days prior to
    //         the specimen date (day 1 = specimen date).
    //   COCA  Community Onset, Community Associated.
    //         Not HOHA and no discharge from the same reporting
    //         organisation in the 28 days prior to the specimen date.
    //
    // Total healthcare-associated (used for the NHS mandatory
    // trust-level objective) = HOHA + COHA (still often referred to
    // colloquially as "trust-apportioned"). Two further administrative
    // categories (unknown / no information) exist in UKHSA data but
    // are not modelled here.
    //
    // Baseline weights below reflect broadly typical UK acute-trust
    // distributions per UKHSA annual data. Scenario templates may tilt
    // them (e.g. an outbreak amplifies HOHA; a care-bundle intervention
    // reduces HOHA + COHA share).
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.30,
      COHA: 0.25,
      COCA: 0.45
    }
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
    baselineRate: 0.00005,
    // Same NHS onset apportionment framework as CDI (see the CDI
    // header comment). UKHSA reports MRSA bacteraemia by these three
    // onset types. Baseline weights roughly reflect the ~30 %
    // hospital-onset share seen in recent UKHSA annual data.
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.30,
      COHA: 0.25,
      COCA: 0.45
    }
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
    baselineRate: 0.00020,
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.30,
      COHA: 0.25,
      COCA: 0.45
    }
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
    baselineRate: 0.00015,
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.30,
      COHA: 0.25,
      COCA: 0.45
    }
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
    baselineRate: 0.00008,
    // P. aeruginosa bacteraemia is more heavily hospital-onset than
    // the other mandatory bacteraemia organisms.
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.40,
      COHA: 0.20,
      COCA: 0.40
    }
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
    baselineRate: 0.0003,
    // E. coli bacteraemia is predominantly community-onset in the
    // UKHSA mandatory data.
    apportionmentCategories: [
      { code: "HOHA", label: "Hospital onset, healthcare associated" },
      { code: "COHA", label: "Community onset, healthcare associated" },
      { code: "COCA", label: "Community onset, community associated" }
    ],
    apportionmentWeights: {
      HOHA: 0.20,
      COHA: 0.20,
      COCA: 0.60
    }
  },

  // -------------------------------------------------------------------
  // Respiratory nosocomial infection topics (surveillance kind
  // "respiratory-hai"). Observations carry a `numerator` (total weekly
  // detections) alongside `onsetBins` broken down by day-of-onset
  // relative to admission. The bin cutoffs match the NHS England
  // healthcare-associated COVID-19 classification (Aug 2020 letter,
  // updated Oct 2020, still in use for nosocomial respiratory-virus
  // surveillance):
  //
  //   community         Community-Onset (CO): first positive on day 1
  //                     or day 2 of admission -- treated as likely
  //                     community-acquired.
  //   indeterminate     Hospital-Onset Indeterminate Healthcare
  //                     Associated (HOIHA): first positive on day 3-7.
  //   probableHAI       Hospital-Onset Probable Healthcare Associated
  //                     (HOPHA): first positive on day 8-14.
  //   definiteHAI       Hospital-Onset Definite Healthcare Associated
  //                     (HODHA): first positive on day 15 or later.
  //
  // The display-time cutoff selector chooses which bins are summed for
  // the plotted metric:
  //
  //   all                    all onset bins (community + HOIHA + HOPHA + HODHA)
  //   excluding-community    HOIHA + HOPHA + HODHA (any hospital onset)
  //   probable-and-definite  HOPHA + HODHA (default; the cohort most
  //                          NHS trusts report as "healthcare-associated")
  //   definite-only          HODHA only
  //
  // The framework was defined by NHS England for SARS-CoV-2 and is
  // applied here to influenza and RSV as an analogous local convention
  // -- these are not UKHSA-defined categories for those organisms.
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
  },

  // -------------------------------------------------------------------
  // Device-associated infection topics (surveillance kind
  // "device-days"). Denominator is the number of device-days -- the
  // number of days each catheter or central line was in place, summed
  // across all patients over the reporting period. Rate is per 1,000
  // device-days per NHSN / ECDC convention.
  //
  // `deviceUtilisationRatio` is the average fraction of bed-days on
  // which the device is in place. The generator multiplies the trust's
  // bed-days by this ratio to produce weekly device-days.
  // -------------------------------------------------------------------

  CAUTI: {
    code: "CAUTI",
    surveillanceKind: "device-days",
    organism: "Catheter-associated urinary tract infection",
    shortName: "CAUTI",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "CAUTI cases",
    denominatorLabel: "Catheter-days",
    rateMultiplier: 1000,
    recommendedChart: "u",
    // Roughly 3 CAUTI per 1,000 catheter-days at baseline.
    baselineRate: 0.003,
    deviceUtilisationRatio: 0.22
  },

  CLABSI: {
    code: "CLABSI",
    surveillanceKind: "device-days",
    organism: "Central-line-associated bloodstream infection",
    shortName: "CLABSI",
    availableMeasures: ["count", "rate"],
    defaultMeasure: "rate",
    numeratorLabel: "CLABSI cases",
    denominatorLabel: "Central-line-days",
    rateMultiplier: 1000,
    recommendedChart: "u",
    // Roughly 1.5 CLABSI per 1,000 line-days at baseline.
    baselineRate: 0.0015,
    deviceUtilisationRatio: 0.13
  },

  // -------------------------------------------------------------------
  // Surgical-site infection topics (surveillance kind
  // "procedure-cohort"). Denominator is the number of index procedures
  // performed in the period; numerator is the number of those
  // procedures followed by an SSI within the surveillance window
  // (typically 30 days, 90 for implant surgery). Rate is a percentage
  // of procedures.
  //
  // `proceduresPerWeek` is the typical weekly volume across the trust,
  // used to seed the denominator.
  // -------------------------------------------------------------------

  SSICOLO: {
    code: "SSICOLO",
    surveillanceKind: "procedure-cohort",
    organism: "SSI following colorectal surgery",
    shortName: "SSI (colorectal)",
    availableMeasures: ["count", "proportion"],
    defaultMeasure: "proportion",
    numeratorLabel: "SSI cases",
    denominatorLabel: "Colorectal procedures",
    rateMultiplier: 100,
    recommendedChart: "p",
    // ~8 % of colorectal procedures develop an SSI at baseline.
    baselineRate: 0.08,
    proceduresPerWeek: 22
  },

  SSICARD: {
    code: "SSICARD",
    surveillanceKind: "procedure-cohort",
    organism: "SSI following cardiac surgery",
    shortName: "SSI (cardiac)",
    availableMeasures: ["count", "proportion"],
    defaultMeasure: "proportion",
    numeratorLabel: "SSI cases",
    denominatorLabel: "Cardiac procedures",
    rateMultiplier: 100,
    recommendedChart: "p",
    // ~3 % of cardiac procedures develop an SSI at baseline.
    baselineRate: 0.03,
    proceduresPerWeek: 14
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
  { value: "excluding-community",    label: "Any hospital onset (HOIHA + HOPHA + HODHA, \u22653 days)", days: 3 },
  { value: "probable-and-definite",  label: "Probable + definite HAI (HOPHA + HODHA, \u22658 days)",   days: 8 },
  { value: "definite-only",          label: "Definite HAI only (HODHA, \u226515 days)",   days: 15 }
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
 * Display-time filter options for the onset-apportionment selector,
 * available on any topic with `apportionmentCategories` (CDI plus every
 * mandatory bacteraemia topic). Mirrors the NHS / UKHSA mandatory-
 * surveillance categorisation:
 *
 *   all                          Every case regardless of onset / origin.
 *   trust-apportioned            HOHA + COHA -- the total
 *                                healthcare-associated cohort used in
 *                                the NHS mandatory trust-level objective
 *                                (also referred to as "trust-
 *                                apportioned").
 *   hospital-onset               HOHA only -- specimen taken on day 3
 *                                or later of the current admission.
 *   community-onset-hcai         COHA only -- community-onset cases in
 *                                patients discharged from the same
 *                                trust in the previous 28 days.
 *   community-onset-community    COCA only -- no recent same-trust
 *                                admission.
 */
export const APPORTIONMENT_OPTIONS = [
  { value: "all",                       label: "All cases" },
  { value: "trust-apportioned",         label: "Total healthcare-associated (HOHA + COHA)" },
  { value: "hospital-onset",            label: "Hospital onset (HOHA)" },
  { value: "community-onset-hcai",      label: "Community onset, healthcare associated (COHA)" },
  { value: "community-onset-community", label: "Community onset, community associated (COCA)" }
];

export const APPORTIONMENT_BINS = {
  "all":                       ["HOHA", "COHA", "COCA"],
  "trust-apportioned":         ["HOHA", "COHA"],
  "hospital-onset":            ["HOHA"],
  "community-onset-hcai":      ["COHA"],
  "community-onset-community": ["COCA"]
};

export const APPORTIONMENT_DEFAULT = "trust-apportioned";

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

  // Device-associated infection topics.
  DEVICE_DAYS: ["CAUTI", "CLABSI"],

  // Procedure-cohort SSI topics.
  PROCEDURE_COHORT: ["SSICOLO", "SSICARD"],

  // Topics that carry a `subtypes` list (used by the subtype-emergence
  // and subtype-displacement templates and by the UI subtype filter).
  WITH_SUBTYPES: ["CPE", "COVID", "INFA"]
};
