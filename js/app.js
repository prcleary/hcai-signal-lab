// js/app.js

import {
  generateScenario,
  APP_VERSION_CODE,
  formatScenarioCode,
  parseScenarioCode
} from "./generator.js";

import {
  prepareAnalysis
} from "./statistics.js";

import {
  renderChart,
  createChartSummary
} from "./chart.js";

import {
  wasBrowserReload,
  saveCurrentScenario,
  loadCurrentScenario,
  loadScenarioHistory,
  startNewStoredScenario,
  restoreScenarioFromHistory
} from "./storage.js";

import {
  exportChartAsPng,
  exportPointsAsCsv,
  exportLearningRecordAsHtml
} from "./export.js";

import {
  resolveInvestigationTip
} from "./tips.js";

/**
 * Per-template investigation guidance is defined in js/tips.js as a
 * five-field schema (pattern, verify, differential, action, falseAlarm)
 * so the reveal panel and the exported learning-record HTML can render
 * consistent structured learning points for every template.
 */

let scenario;
let currentAnalysis;

const elements = {};

document.addEventListener(
  "DOMContentLoaded",
  initialiseApp
);

function initialiseApp() {
  collectElements();

  const storedScenario =
    loadCurrentScenario();

  if (wasBrowserReload()) {
    scenario = generateScenario(
      undefined,
      { difficulty: readSelectedDifficulty() }
    );

    if (storedScenario) {
      startNewStoredScenario(scenario);
    } else {
      saveCurrentScenario(scenario);
    }
  } else if (storedScenario) {
    scenario = storedScenario;
  } else {
    scenario = generateScenario(
      undefined,
      { difficulty: readSelectedDifficulty() }
    );
    saveCurrentScenario(scenario);
  }

  populateLocationControls();
  populateMeasureControl();
  applyScenarioStateToControls();
  addEventListeners();
  refreshHistoryDropdown();
  renderApplication();
}

function collectElements() {
  const ids = [
    "hospitalName",
    "scenarioTitle",
    "scenarioDescription",
    "scenarioCode",
    "scenarioCodeCopyButton",
    "hospitalType",
    "currentViewDescription",

    "measureSelect",
    "timeWindowSelect",
    "aggregationSelect",
    "siteSelect",
    "wardSelect",
    "smoothingSelect",
    "smoothingWarning",
    "spcSelect",
    "spcCaveat",
    "showTwoSd",
    "showThreeSd",
    "showSignals",
    "haiCutoffSelect",
    "haiCutoffField",
    "apportionmentSelect",
    "apportionmentField",
    "subtypeSelect",
    "subtypeField",
    "mainChart",
    "chartSubtitle",
    "chartSummary",
    "legend",
    "signalSummary",
    "signalSummaryCount",

    "investigateSelect",
    "learnerNotes",
    "actionLog",

    "newScenarioButton",
    "scenarioHistorySelect",
    "difficultySelect",
    "loadCodeInput",
    "loadCodeButton",
    "downloadPngButton",
    "downloadCsvButton",
    "downloadRecordButton",
    "revealButton",
    "revealContent",
    "revealGate"
  ];

  for (const id of ids) {
    elements[id] = document.getElementById(id);
  }
}

function addEventListeners() {
  const displayControls = [
    "measureSelect",
    "timeWindowSelect",
    "aggregationSelect",
    "siteSelect",
    "wardSelect",
    "smoothingSelect",
    "spcSelect",
    "showTwoSd",
    "showThreeSd",
    "showSignals",
    "haiCutoffSelect",
    "apportionmentSelect",
    "subtypeSelect"
  ];

  for (const id of displayControls) {
    elements[id].addEventListener(
      "change",
      handleDisplayChange
    );
  }

  elements.newScenarioButton.addEventListener(
    "click",
    startNewScenario
  );

  elements.loadCodeButton.addEventListener(
    "click",
    handleLoadByCode
  );

  elements.loadCodeInput.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleLoadByCode();
      }
    }
  );

  elements.loadCodeInput.addEventListener(
    "input",
    () => {
      elements.loadCodeInput.classList.remove("is-invalid");
    }
  );

  elements.scenarioCodeCopyButton.addEventListener(
    "click",
    copyScenarioCode
  );

  elements.scenarioHistorySelect.addEventListener(
    "change",
    handleHistorySelect
  );

  elements.investigateSelect.addEventListener(
    "change",
    handleInterpretationChange
  );

  elements.learnerNotes.addEventListener(
    "input",
    handleInterpretationChange
  );

  elements.learnerNotes.addEventListener(
    "blur",
    persistInterpretation
  );

  elements.revealButton.addEventListener(
    "click",
    revealExplanation
  );

  elements.downloadPngButton.addEventListener(
    "click",
    () => {
      logAction("exported-png");
      exportChartAsPng(
        elements.mainChart,
        scenario
      );
    }
  );

  elements.downloadCsvButton.addEventListener(
    "click",
    () => {
      logAction("exported-csv");
      exportPointsAsCsv(
        currentAnalysis.points,
        scenario
      );
    }
  );

  elements.downloadRecordButton.addEventListener(
    "click",
    () => {
      logAction("exported-record");
      exportLearningRecordAsHtml({
        scenario,
        canvas: elements.mainChart,
        currentAnalysis,
        displayOptions: getDisplayOptions(),
        spcLabel: getSpcLabel(
          currentAnalysis.chartType,
          scenario.surveillance
        ),
        denominatorLabel: getDenominatorLabel(
          currentAnalysis.points,
          scenario.surveillance,
          scenario.learnerState.display.aggregation
        ),
        yAxisTitle: getYAxisTitle(
          scenario.learnerState.display.measure,
          scenario.learnerState.display.aggregation
        ),
        investigationTip: resolveInvestigationTip(scenario)
      });
    }
  );
}

function populateMeasureControl() {
  const surveillance = scenario.surveillance;

  elements.measureSelect.replaceChildren();

  // For procedure-cohort SSI topics "Percentage positive" reads as a
  // microbiology screen result rather than a surgical outcome, so use
  // "Proportion with SSI" instead. Other topics use the historical
  // labels.
  const proportionLabel =
    surveillance.surveillanceKind === "procedure-cohort"
      ? "Proportion with SSI"
      : "Percentage positive";

  const labels = {
    count: "Count",
    rate:
      `Rate per ${surveillance.rateMultiplier.toLocaleString("en-GB")}`,
    proportion: proportionLabel
  };

  for (
    const measure of surveillance.availableMeasures
  ) {
    const option =
      document.createElement("option");

    option.value = measure;
    option.textContent =
      labels[measure] || measure;

    elements.measureSelect.appendChild(option);
  }
}

function populateLocationControls() {
  const siteNames = [
    ...new Set(
      scenario.hospital.wards.map(
        ward => ward.site
      )
    )
  ];

  elements.siteSelect.replaceChildren(
    createOption("all", "All sites"),
    ...siteNames.map(site =>
      createOption(site, site)
    )
  );

  updateWardControl();
  updateSubtypeControl();
}

function updateSubtypeControl() {
  if (!elements.subtypeSelect || !elements.subtypeField) return;

  const subtypes = scenario.surveillance.subtypes;

  if (!subtypes || !subtypes.length) {
    elements.subtypeField.hidden = true;
    return;
  }

  elements.subtypeField.hidden = false;

  elements.subtypeSelect.replaceChildren(
    createOption("all", "All subtypes"),
    ...subtypes.map(subtype =>
      createOption(subtype.code, subtype.label)
    )
  );

  const stored = scenario.learnerState.filters.subtype;

  if (
    stored &&
    stored !== "all" &&
    subtypes.some(subtype => subtype.code === stored)
  ) {
    elements.subtypeSelect.value = stored;
  } else {
    elements.subtypeSelect.value = "all";
  }
}

function updateWardControl() {
  const selectedSite =
    elements.siteSelect.value ||
    scenario.learnerState.filters.site ||
    "all";

  const wards = scenario.hospital.wards.filter(
    ward =>
      selectedSite === "all" ||
      ward.site === selectedSite
  );

  elements.wardSelect.replaceChildren(
    createOption("all", "All wards and services"),
    ...wards.map(ward =>
      createOption(ward.name, ward.name)
    )
  );

  const storedWard =
    scenario.learnerState.filters.ward;

  if (
    wards.some(
      ward => ward.name === storedWard
    )
  ) {
    elements.wardSelect.value = storedWard;
  } else {
    elements.wardSelect.value = "all";
  }
}

function createOption(value, label) {
  const option =
    document.createElement("option");

  option.value = value;
  option.textContent = label;

  return option;
}

function applyScenarioStateToControls() {
  const { filters, display } =
    scenario.learnerState;

  elements.siteSelect.value =
    filters.site || "all";

  updateWardControl();

  elements.wardSelect.value =
    filters.ward || "all";

  elements.measureSelect.value =
    display.measure;

  elements.timeWindowSelect.value =
    String(display.timeWindow);

  elements.aggregationSelect.value =
    String(display.aggregation);

  elements.smoothingSelect.value =
    String(display.smoothing);

  elements.spcSelect.value =
    display.spcType;

  elements.showTwoSd.checked =
    display.showTwoSd;

  elements.showThreeSd.checked =
    display.showThreeSd;

  elements.showSignals.checked =
    display.showSignals;

  updateHaiCutoffControl(display.haiCutoff);
  updateApportionmentControl(display.apportionment);

  elements.investigateSelect.value =
    scenario.learnerState.investigate || "";

  elements.learnerNotes.value =
    scenario.learnerState.notes || "";
}

function handleDisplayChange(event) {
  if (event.target === elements.siteSelect) {
    updateWardControl();
  }

  syncMeasureAndSpcControls(event.target);

  updateStateFromControls();

  logAction("changed-display", {
    control: event.target.id,
    value:
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value
  });

  renderApplication();
}

/**
 * The Measure and Control chart selectors are conceptually the same
 * choice (count / rate / proportion). Under the covers the plotted value
 * follows the chart type, so if the two selectors disagree the y-axis
 * silently rescales without any visible signal to the learner. Keep
 * them in step so the UI reflects what the chart actually shows.
 */
function syncMeasureAndSpcControls(source) {
  const chartToMeasure = {
    c: "count",
    u: "rate",
    p: "proportion"
  };

  const measureToChart = {
    count: "c",
    rate: "u",
    proportion: "p"
  };

  const available =
    scenario.surveillance.availableMeasures || [];

  if (source === elements.spcSelect) {
    const targetMeasure =
      chartToMeasure[elements.spcSelect.value];

    if (
      targetMeasure &&
      available.includes(targetMeasure) &&
      elements.measureSelect.value !== targetMeasure
    ) {
      elements.measureSelect.value = targetMeasure;
    }

    return;
  }

  if (source === elements.measureSelect) {
    const targetChart =
      measureToChart[elements.measureSelect.value];

    const currentSpc = elements.spcSelect.value;

    // Only realign the SPC selector when it currently points at a
    // specific chart family; leave "auto" and "none" alone so the
    // learner keeps their higher-level choice.
    if (
      targetChart &&
      ["p", "c", "u"].includes(currentSpc) &&
      currentSpc !== targetChart
    ) {
      elements.spcSelect.value = targetChart;
    }
  }
}

function updateStateFromControls() {
  const hasSubtypes = Boolean(
    scenario.surveillance.subtypes &&
      scenario.surveillance.subtypes.length
  );

  scenario.learnerState.filters = {
    site: elements.siteSelect.value,
    ward: elements.wardSelect.value,
    subtype: hasSubtypes
      ? elements.subtypeSelect.value
      : null
  };

  scenario.learnerState.display = {
    measure: elements.measureSelect.value,
    timeWindow: Number(
      elements.timeWindowSelect.value
    ),
    aggregation: Number(
      elements.aggregationSelect.value
    ),
    smoothing: Number(
      elements.smoothingSelect.value
    ),
    spcType: elements.spcSelect.value,
    showTwoSd: elements.showTwoSd.checked,
    showThreeSd:
      elements.showThreeSd.checked,
    showSignals:
      elements.showSignals.checked,
    haiCutoff:
      scenario.surveillance.surveillanceKind === "respiratory-hai"
        ? elements.haiCutoffSelect.value
        : null,
    apportionment:
      scenario.surveillance.apportionmentCategories
        ? elements.apportionmentSelect.value
        : null
  };

  saveCurrentScenario(scenario);
}

/**
 * The HAI cutoff selector applies only to respiratory-hai topics.
 * Hide the containing field entirely for other topics; when shown,
 * seed it from the stored display state (falling back to the default
 * cutoff when the stored scenario predates this feature).
 */
function updateHaiCutoffControl(storedCutoff) {
  if (!elements.haiCutoffField || !elements.haiCutoffSelect) return;

  const isRespiratory =
    scenario.surveillance.surveillanceKind === "respiratory-hai";

  elements.haiCutoffField.hidden = !isRespiratory;

  if (isRespiratory) {
    elements.haiCutoffSelect.value =
      storedCutoff || "probable-and-definite";
  }
}

/**
 * The onset-apportionment selector applies to any topic carrying
 * `apportionmentCategories` (CDI plus every mandatory bacteraemia
 * topic). Hide the containing field entirely for other topics; when
 * shown, seed it from the stored display state (falling back to the
 * total healthcare-associated default when the stored scenario predates
 * this feature).
 */
function updateApportionmentControl(storedClassification) {
  if (
    !elements.apportionmentField ||
    !elements.apportionmentSelect
  ) return;

  const hasApportionment = Boolean(
    scenario.surveillance.apportionmentCategories
  );

  elements.apportionmentField.hidden = !hasApportionment;

  if (hasApportionment) {
    elements.apportionmentSelect.value =
      storedClassification || "trust-apportioned";
  }
}

function getDisplayOptions() {
  return {
    ...scenario.learnerState.display,
    ...scenario.learnerState.filters
  };
}

function renderApplication() {
  const options = getDisplayOptions();

  currentAnalysis = prepareAnalysis(
    scenario,
    options
  );

  updateScenarioHeader();
  updateChartText(options);
  updateSignalSummary();
  updateActionLog();
  updateRevealPanel();
  updateRevealGate();

  elements.smoothingWarning.hidden =
    Number(options.smoothing) === 0;

  updateSpcCaveat(currentAnalysis.chartType);

  renderChart(
    elements.mainChart,
    currentAnalysis.points,
    {
      showTwoSd: options.showTwoSd,
      showThreeSd: options.showThreeSd,
      showSignals: options.showSignals,
      smoothing: options.smoothing,
      yAxisTitle: getYAxisTitle(
        options.measure,
        options.aggregation
      ),
      integerYAxis: options.measure === "count",
      spcLabel: getSpcLabel(
        currentAnalysis.chartType,
        scenario.surveillance
      ),
      denominatorLabel: getDenominatorLabel(
        currentAnalysis.points,
        scenario.surveillance,
        options.aggregation
      ),
      // Only surface the ground-truth change-point after the learner
      // has revealed the scenario. Small-amplitude changes (e.g. a
      // 55 % diagnostic-method step against Poisson noise on a
      // low-baseline organism) are hard to locate by eye; drawing a
      // vertical marker at reveal time keeps the pre-reveal experience
      // honest while giving the learner an unambiguous anchor after.
      changePointDate:
        scenario.learnerState.revealed
          ? scenario.groundTruth.changePointDate
          : null
    }
  );

  elements.chartSummary.textContent =
    createChartSummary(
      currentAnalysis.points,
      currentAnalysis.chartType
    );
}

function updateSpcCaveat(chartType) {
  const surveillance = scenario.surveillance;
  const recommended = surveillance.recommendedChart;
  const supportsProportion =
    surveillance.availableMeasures &&
    surveillance.availableMeasures.includes("proportion");

  const messages = [];

  if (
    chartType === "c" &&
    recommended &&
    recommended !== "c"
  ) {
    messages.push(
      `A c-chart assumes a constant area of opportunity each period. For this topic the denominator varies (e.g. patients screened or bed-days), so c-chart limits can be misleading. The recommended chart for this topic is a ${recommended}-chart.`
    );
  }

  if (
    chartType === "p" &&
    !supportsProportion
  ) {
    messages.push(
      `A p-chart treats each unit of the denominator as an independent yes/no trial (e.g. one screened patient). For this topic the denominator is person-time (bed-days), which is not a count of Bernoulli trials \u2014 the theoretical basis of a p-chart does not apply. In practice, when the event rate is very low, p-chart and u-chart limits are numerically almost identical. The recommended chart for this topic is a ${recommended}-chart.`
    );
  }

  if (chartType === "u") {
    messages.push(
      "A u-chart plots the rate and computes limits per period, so weeks with fewer patients at risk get wider limits. When the denominator is stable from week to week, the u-chart and c-chart show the same relative shape but with different y-axis units."
    );
  }

  if (messages.length) {
    elements.spcCaveat.textContent = messages.join(" ");
    elements.spcCaveat.hidden = false;
  } else {
    elements.spcCaveat.textContent = "";
    elements.spcCaveat.hidden = true;
  }
}

function getSpcLabel(chartType, surveillance) {
  if (chartType === "none") {
    return withSubtypeSuffix(
      withApportionmentSuffix(
        withHaiCutoffSuffix("No control limits", surveillance),
        surveillance
      ),
      surveillance
    );
  }

  const base = `${chartType}-chart`;

  const label =
    surveillance && surveillance.recommendedChart === chartType
      ? `${base} \u2014 recommended for this topic`
      : base;

  return withSubtypeSuffix(
    withApportionmentSuffix(
      withHaiCutoffSuffix(label, surveillance),
      surveillance
    ),
    surveillance
  );
}

/**
 * For respiratory-hai topics, append the currently selected onset
 * cutoff to the SPC label so learners immediately see which
 * definition of "HAI" the chart is plotting.
 */
function withHaiCutoffSuffix(label, surveillance) {
  if (
    !surveillance ||
    surveillance.surveillanceKind !== "respiratory-hai"
  ) {
    return label;
  }

  const cutoff =
    scenario?.learnerState?.display?.haiCutoff ||
    "probable-and-definite";

  const cutoffLabels = {
    "all": "all detections",
    "excluding-community": "\u22653 days onset",
    "probable-and-definite": "\u22658 days onset",
    "definite-only": "\u226515 days onset"
  };

  const suffix = cutoffLabels[cutoff] || cutoff;

  return `${label} \u00b7 ${suffix}`;
}

/**
 * For any topic carrying apportionment metadata (CDI + every mandatory
 * bacteraemia topic), append the currently selected onset-apportionment
 * filter to the SPC label so the learner sees which cohort of cases
 * (HOHA / COHA / COCA and combinations thereof) the chart is plotting.
 */
function withApportionmentSuffix(label, surveillance) {
  if (!surveillance || !surveillance.apportionmentCategories) {
    return label;
  }

  const classification =
    scenario?.learnerState?.display?.apportionment ||
    "trust-apportioned";

  const suffixByClassification = {
    "all": "all cases",
    "trust-apportioned": "HOHA + COHA",
    "hospital-onset": "HOHA only",
    "community-onset-hcai": "COHA only",
    "community-onset-community": "COCA only"
  };

  const suffix = suffixByClassification[classification];

  if (!suffix) return label;

  return `${label} \u00b7 ${suffix}`;
}

/**
 * For topics with subtypes, append the currently selected subtype
 * label (or nothing if "all") to the SPC label.
 */
function withSubtypeSuffix(label, surveillance) {
  if (
    !surveillance ||
    !surveillance.subtypes ||
    !surveillance.subtypes.length
  ) {
    return label;
  }

  const filter = scenario?.learnerState?.filters?.subtype;

  if (!filter || filter === "all") return label;

  const match = surveillance.subtypes.find(
    subtype => subtype.code === filter
  );

  const subtypeLabel = match ? match.label : filter;

  return `${label} \u00b7 ${subtypeLabel}`;
}

function updateScenarioHeader() {
  elements.hospitalName.textContent =
    scenario.hospital.name;

  elements.scenarioTitle.textContent =
    scenario.surveillance.organism;

  elements.scenarioDescription.textContent =
    `${scenario.surveillance.numeratorLabel} monitored using synthetic weekly hospital surveillance data.`;

  elements.scenarioCode.textContent =
    formatScenarioCode(scenario);

  elements.hospitalType.textContent =
    scenario.hospital.type;
}

function updateChartText(options) {
  const aggregationLabels = {
    1: "Weekly",
    4: "Four-weekly",
    13: "Quarterly"
  };

  const location =
    options.ward !== "all"
      ? options.ward
      : options.site !== "all"
        ? options.site
        : "All hospital locations";

  elements.chartSubtitle.textContent =
    `${location} · ${
      aggregationLabels[options.aggregation]
    } observations`;

  elements.currentViewDescription.textContent =
    `${location}; ${options.measure}`;
}

function updateSignalSummary() {
  elements.signalSummary.replaceChildren();
  setSignalSummaryCount(0);

  if (currentAnalysis.chartType === "none") {
    const paragraph = document.createElement("p");

    paragraph.textContent =
      "No control chart is currently selected.";

    elements.signalSummary.appendChild(paragraph);
    return;
  }

  const grouped = groupSignalsByRule(
    currentAnalysis.points
  );

  const totalMatched = grouped.reduce(
    (sum, group) => sum + group.entries.length,
    0
  );

  setSignalSummaryCount(totalMatched);

  if (!totalMatched) {
    const paragraph = document.createElement("p");

    paragraph.textContent =
      "No SPC rule included in this version was triggered.";

    elements.signalSummary.appendChild(paragraph);
    return;
  }

  for (const group of grouped) {
    if (!group.entries.length) continue;

    const section = document.createElement("section");
    section.className = "signal-group";

    const heading = document.createElement("h4");
    heading.textContent =
      `${group.label} — ${
        group.entries.length
      } ${
        group.entries.length === 1 ? "signal" : "signals"
      }`;
    section.appendChild(heading);

    const description = document.createElement("p");
    description.className = "signal-group-description";
    description.textContent = group.explanation;
    section.appendChild(description);

    const list = document.createElement("ul");

    for (const entry of group.entries) {
      const item = document.createElement("li");

      const direction = entry.direction
        ? ` (${entry.direction})`
        : "";

      const value = Number.isFinite(entry.point.value)
        ? entry.point.value.toLocaleString("en-GB", {
            maximumFractionDigits: 3
          })
        : "";

      item.textContent =
        `${formatDate(entry.point.date)}${direction}: ${value}`;

      list.appendChild(item);
    }

    section.appendChild(list);
    elements.signalSummary.appendChild(section);
  }
}

const SIGNAL_RULE_GROUPS = [
  {
    key: "beyond3sd",
    label: "Beyond 3-SD control limits (Nelson rule 1)",
    explanation:
      "A single point outside the ±3σ limits is unlikely to arise from common-cause variation alone. Look for a specific cause on or around this period.",
    matches(signal) {
      return /3-SD control limit/.test(signal);
    },
    direction(signal) {
      if (/Above/i.test(signal)) return "above";
      if (/Below/i.test(signal)) return "below";
      return "";
    }
  },
  {
    key: "runOfEight",
    label: "Run of eight on one side of the centre line (Nelson rule 4)",
    explanation:
      "Eight consecutive points on the same side of the mean indicate a sustained shift smaller than a 3σ excursion — often the earliest signal of a real change in the process.",
    matches(signal) {
      return /Eight consecutive/.test(signal);
    },
    direction(signal) {
      if (/above/i.test(signal)) return "above";
      if (/below/i.test(signal)) return "below";
      return "";
    }
  }
];

function groupSignalsByRule(points) {
  const grouped = SIGNAL_RULE_GROUPS.map(rule => ({
    ...rule,
    entries: []
  }));

  for (const point of points) {
    if (!point.isSignal) continue;

    for (const signal of point.signals || []) {
      for (const group of grouped) {
        if (group.matches(signal)) {
          group.entries.push({
            point,
            direction: group.direction(signal)
          });
          break;
        }
      }
    }
  }

  return grouped;
}

function setSignalSummaryCount(total) {
  if (!elements.signalSummaryCount) return;

  if (!total) {
    elements.signalSummaryCount.textContent = "";
    return;
  }

  elements.signalSummaryCount.textContent =
    `\u2014 ${total} ${total === 1 ? "signal" : "signals"}`;
}

function handleInterpretationChange(event) {
  // Update in-memory state on every change so the reveal-gate reflects
  // the current answer + notes length, but only persist on change (for
  // the select) or on blur (for the textarea) to avoid a localStorage
  // write for every keystroke.
  scenario.learnerState.investigate =
    elements.investigateSelect.value;

  scenario.learnerState.notes =
    elements.learnerNotes.value;

  updateRevealGate();

  if (event && event.target === elements.investigateSelect) {
    saveCurrentScenario(scenario);
  }
}

function persistInterpretation() {
  scenario.learnerState.investigate =
    elements.investigateSelect.value;

  scenario.learnerState.notes =
    elements.learnerNotes.value;

  saveCurrentScenario(scenario);
}

/**
 * Reveal is gated behind a completed interpretation. The learner must
 * (a) choose an investigate answer and (b) write a short note (at least
 * ~20 characters) before the reveal button becomes clickable.
 */
function updateRevealGate() {
  const answered =
    (elements.investigateSelect.value || "") !== "";
  const noteLength =
    (elements.learnerNotes.value || "").trim().length;
  const enough = answered && noteLength >= 20;
  const revealed = scenario.learnerState.revealed;

  if (revealed) {
    elements.revealButton.disabled = false;
    elements.revealGate.hidden = true;
    elements.revealGate.textContent = "";
    return;
  }

  elements.revealButton.disabled = !enough;

  if (enough) {
    elements.revealGate.hidden = true;
    elements.revealGate.textContent = "";
    return;
  }

  const missing = [];
  if (!answered) {
    missing.push("choose an investigate answer");
  }
  if (noteLength < 20) {
    missing.push(
      "write a short interpretation (at least 20 characters)"
    );
  }

  elements.revealGate.hidden = false;
  elements.revealGate.textContent =
    `To unlock the reveal, ${missing.join(" and ")}.`;
}

function revealExplanation() {
  // Belt-and-braces: the button should already be disabled if the gate
  // is not satisfied, but re-check in case a listener misfired.
  const answered =
    (elements.investigateSelect.value || "") !== "";
  const noteLength =
    (elements.learnerNotes.value || "").trim().length;

  if (!answered || noteLength < 20) {
    updateRevealGate();
    return;
  }

  // Make sure the current interpretation is saved before we reveal.
  persistInterpretation();

  scenario.learnerState.revealed = true;

  logAction("revealed-explanation");
  saveCurrentScenario(scenario);

  renderApplication();
}

function updateRevealPanel() {
  const revealed =
    scenario.learnerState.revealed;

  elements.revealContent.hidden =
    !revealed;

  elements.revealButton.hidden =
    revealed;

  if (!revealed) return;

  elements.revealContent.replaceChildren();

  const truth = scenario.groundTruth;
  const tips = resolveInvestigationTip(scenario);

  const heading = document.createElement("h3");
  heading.textContent = truth.templateName;
  elements.revealContent.append(heading);

  const explanation = document.createElement("p");
  explanation.textContent = truth.explanation;
  elements.revealContent.append(explanation);

  appendRevealSection(
    "Ground truth",
    buildGroundTruthList(truth, scenario)
  );

  if (tips) {
    appendRevealSection(
      "Pattern to look for",
      createParagraph(tips.pattern)
    );

    appendRevealSection(
      "How to verify",
      createParagraph(tips.verify)
    );

    appendRevealSection(
      "What could look similar",
      createParagraph(tips.differential)
    );

    appendRevealSection(
      "Appropriate action",
      createParagraph(tips.action)
    );

    appendRevealSection(
      "Common false-alarm cause",
      createParagraph(tips.falseAlarm)
    );
  }

  const limitations = collectLimitations();

  if (limitations.length) {
    const list = document.createElement("ul");

    for (const note of limitations) {
      const item = document.createElement("li");
      item.textContent = note;
      list.append(item);
    }

    appendRevealSection(
      "Limitations and honest caveats",
      list
    );
  }
}

function appendRevealSection(title, contentElement) {
  const heading = document.createElement("h4");
  heading.textContent = title;

  elements.revealContent.append(heading, contentElement);
}

function createParagraph(text) {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  return paragraph;
}

function buildGroundTruthList(truth, currentScenario) {
  const list = document.createElement("dl");

  addDefinition(
    list,
    "Change point",
    truth.changePointDate
      ? `Week beginning ${formatDate(truth.changePointDate)}`
      : "None \u2014 the underlying process was not modified."
  );

  addDefinition(
    list,
    "Affected location",
    truth.affectedWard
      ? `${truth.affectedWard} (other wards were unaffected)`
      : "Hospital-wide (no ward-specific effect)"
  );

  if (currentScenario.baselineEndDate) {
    addDefinition(
      list,
      "SPC baseline period",
      `First ${currentScenario.baselineWeeks} weeks, up to and including ${formatDate(currentScenario.baselineEndDate)}. Control limits are derived from this period and extended forward.`
    );
  }

  return list;
}

function addDefinition(dl, term, definition) {
  const dt = document.createElement("dt");
  dt.textContent = term;

  const dd = document.createElement("dd");
  dd.textContent = definition;

  dl.append(dt, dd);
}

function collectLimitations() {
  const notes = [];
  const surveillance = scenario.surveillance;
  const points = currentAnalysis?.points || [];

  const totalEvents = points.reduce(
    (sum, point) => sum + (point.numerator || 0),
    0
  );

  const rareOrganismCodes = ["MRSA", "PSAER"];
  const isRareOrganism =
    rareOrganismCodes.includes(surveillance.code);

  if (surveillance.code === "MRSA") {
    notes.push(
      "MRSA bacteraemia is a rare event in UK hospitals \u2014 even a large trust typically reports only a handful of cases per year. Weekly SPC charts have very limited statistical power for organisms this rare; in practice, monthly per-trust reporting and case-level review are usually more informative than trend charts."
    );
  }

  if (surveillance.code === "PSAER") {
    notes.push(
      "Pseudomonas aeruginosa bacteraemia is a rare event at trust level (typically a handful of cases per month, not per week). Weekly SPC charts have limited statistical power at this baseline; monthly aggregation and case-level review are usually more informative than weekly trend charts."
    );
  }

  if (!isRareOrganism && totalEvents < 20) {
    notes.push(
      `The visible window contains only ${totalEvents} events. At counts this low, Poisson variability dominates and \u00b13\u03c3 limits behave more loosely than the nominal 0.27 % false-alarm rate would suggest. Treat any single signal with corresponding caution.`
    );
  }

  const signalCount = points.filter(
    point => point.isSignal
  ).length;

  if (
    truthHasIntendedSignal(scenario.groundTruth.templateId) &&
    signalCount === 0
  ) {
    notes.push(
      "The template describes a change that should produce a signal, but no SPC signal has fired in the current view. This can happen when counts are low, the change is small, or the current time-window / aggregation is hiding it. Try a longer time period or a different ward filter."
    );
  }

  return notes;
}

function truthHasIntendedSignal(templateId) {
  return [
    "single-extreme",
    "step-increase",
    "gradual-trend",
    "local-outbreak",
    "targeted-screening",
    "reporting-artefact",
    "diagnostic-method-change"
  ].includes(templateId);
}

function startNewScenario() {
  scenario = generateScenario(
    undefined,
    { difficulty: readSelectedDifficulty() }
  );

  startNewStoredScenario(scenario);

  populateMeasureControl();
  populateLocationControls();
  applyScenarioStateToControls();
  refreshHistoryDropdown();
  renderApplication();
}

function handleLoadByCode() {
  const raw = elements.loadCodeInput.value;
  const parsed = parseScenarioCode(raw);

  if (!parsed) {
    elements.loadCodeInput.classList.add("is-invalid");
    elements.loadCodeInput.focus();
    elements.loadCodeInput.select();
    return;
  }

  elements.loadCodeInput.classList.remove("is-invalid");

  if (parsed.version && parsed.version !== APP_VERSION_CODE) {
    logAction("scenario-code-version-mismatch", {
      entered: parsed.version,
      current: APP_VERSION_CODE
    });
  }

  scenario = generateScenario(
    parsed.seed,
    { difficulty: parsed.difficulty }
  );

  startNewStoredScenario(scenario);

  logAction("loaded-scenario-code", {
    code: formatScenarioCode(scenario)
  });

  populateMeasureControl();
  populateLocationControls();
  applyScenarioStateToControls();
  refreshHistoryDropdown();
  renderApplication();

  elements.loadCodeInput.value = "";
}

function readSelectedDifficulty() {
  const value = elements.difficultySelect?.value;

  if (!value || value === "mixed") return null;

  const asNumber = Number(value);
  return Number.isInteger(asNumber) ? asNumber : null;
}

let copyResetTimeout = null;

async function copyScenarioCode() {
  const code = elements.scenarioCode.textContent;
  if (!code) return;

  const ok = await writeToClipboard(code);

  if (!ok) {
    flashCopyState("Copy failed", false);
    return;
  }

  logAction("copied-scenario-code", { code });
  flashCopyState("Copied", true);
}

async function writeToClipboard(text) {
  // Primary path: navigator.clipboard is available on http(s) and works
  // on localhost. Falls back to a hidden textarea + execCommand for
  // file:// and older browsers, which some workshop deployments still
  // use.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

function flashCopyState(label, success) {
  const button = elements.scenarioCodeCopyButton;
  if (!button) return;

  if (copyResetTimeout != null) {
    clearTimeout(copyResetTimeout);
  }

  button.textContent = label;
  button.classList.toggle("is-copied", success);

  copyResetTimeout = setTimeout(() => {
    button.textContent = "Copy";
    button.classList.remove("is-copied");
    copyResetTimeout = null;
  }, 1500);
}

function refreshHistoryDropdown() {
  const select = elements.scenarioHistorySelect;
  if (!select) return;

  const history = loadScenarioHistory();

  select.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = history.length
    ? "Past scenarios…"
    : "No past scenarios yet";
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  if (!history.length) {
    select.disabled = true;
    return;
  }

  select.disabled = false;

  for (const past of history) {
    const option = document.createElement("option");
    option.value = past.id;
    const templateName =
      past.groundTruth?.templateName || "Unknown pattern";
    const organism = past.surveillance?.organism || "";
    const revealedMarker = past.learnerState?.revealed
      ? " (revealed)"
      : "";
    option.textContent =
      `${organism} · ${templateName}${revealedMarker}`;
    select.appendChild(option);
  }
}

function handleHistorySelect(event) {
  const value = event.target.value;
  if (!value) return;

  const restored = restoreScenarioFromHistory(value);

  // Reset the select so choosing the same entry twice still works.
  event.target.value = "";

  if (!restored) {
    window.alert(
      "The chosen scenario could not be restored."
    );
    refreshHistoryDropdown();
    return;
  }

  scenario = restored;

  populateMeasureControl();
  populateLocationControls();
  applyScenarioStateToControls();
  refreshHistoryDropdown();
  renderApplication();
}

function logAction(type, details = {}) {
  scenario.learnerState.actionLog.push({
    time: new Date().toISOString(),
    type,
    details
  });

  saveCurrentScenario(scenario);
}

function updateActionLog() {
  elements.actionLog.replaceChildren();

  const actions =
    scenario.learnerState.actionLog;

  if (!actions.length) {
    const item =
      document.createElement("li");

    item.textContent =
      "No analysis actions have been recorded yet.";

    elements.actionLog.appendChild(item);
    return;
  }

  for (
    const action of actions.slice(-20).reverse()
  ) {
    const item =
      document.createElement("li");

    item.textContent =
      `${formatDateTime(action.time)} — ${
        formatAction(action)
      }`;

    elements.actionLog.appendChild(item);
  }
}

function formatAction(action) {
  const labels = {
    "changed-display":
      `Changed ${action.details.control}`,
    "saved-interpretation":
      "Saved interpretation",
    "revealed-explanation":
      "Revealed scenario explanation",
    "exported-png":
      "Exported chart as PNG",
    "exported-csv":
      "Exported displayed data as CSV",
    "exported-record":
      "Saved learning record (HTML)"
  };

  return labels[action.type] || action.type;
}

function getYAxisTitle(measure, aggregation) {
  const surveillance = scenario.surveillance;
  const period = getPeriodLabel(aggregation);

  if (measure === "count") {
    return `${surveillance.numeratorLabel} per ${period}`;
  }

  if (measure === "proportion") {
    if (surveillance.surveillanceKind === "procedure-cohort") {
      return `Percentage of ${surveillance.denominatorLabel.toLowerCase()} developing SSI`;
    }
    return `Percentage positive of ${surveillance.denominatorLabel.toLowerCase()}`;
  }

  return `Cases per ${
    surveillance.rateMultiplier.toLocaleString("en-GB")
  } ${surveillance.denominatorLabel.toLowerCase()}`;
}

function getPeriodLabel(aggregation) {
  const labels = {
    1: "week",
    4: "four weeks",
    13: "quarter"
  };

  return labels[Number(aggregation)] || "period";
}

/**
 * Short line drawn below the SPC label describing the underlying
 * denominator so the learner can interpret both counts and rates in
 * context (e.g. "5 cases per week over about 4,500 bed-days").
 */
function getDenominatorLabel(points, surveillance, aggregation) {
  if (!surveillance || !surveillance.denominatorLabel) {
    return "";
  }

  const denominators = (points || [])
    .map(point => point.denominator)
    .filter(value => Number.isFinite(value) && value > 0);

  if (!denominators.length) {
    return `Denominator: ${surveillance.denominatorLabel.toLowerCase()}`;
  }

  const sorted = [...denominators].sort(
    (first, second) => first - second
  );

  const median = sorted[Math.floor(sorted.length / 2)];
  const period = getPeriodLabel(aggregation);

  return `Denominator: ${
    surveillance.denominatorLabel.toLowerCase()
  } \u00b7 median ${
    Math.round(median).toLocaleString("en-GB")
  } per ${period}`;
}

function formatDate(dateString) {
  return new Date(
    `${dateString}T00:00:00Z`
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString(
    "en-GB",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );
}
