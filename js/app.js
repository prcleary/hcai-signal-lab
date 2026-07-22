// js/app.js

import {
  generateScenario
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
  startNewStoredScenario,
  restorePreviousScenario
} from "./storage.js";

import {
  exportChartAsPng,
  exportScenarioAsJson,
  exportPointsAsCsv
} from "./export.js";

/**
 * Per-template investigation guidance shown in the reveal panel.
 * `lookFor` describes what the intended pattern should look like on the
 * chart. `verify` describes how the learner can check it using the tools
 * available in the app.
 */
const INVESTIGATION_TIPS = {
  "common-cause": {
    lookFor:
      "There is no underlying shift. Points wander either side of the centre line within the control limits. Occasional excursions beyond \u00b13\u03c3 can still happen by chance, especially at low counts.",
    verify:
      "Try longer aggregation (four-weekly or quarterly) and different ward filters. If nothing consistent appears, the process is behaving as a stable one."
  },
  "single-extreme": {
    lookFor:
      "One isolated point above the upper 3-SD limit. All other observations sit comfortably inside the limits.",
    verify:
      "Look at the weeks either side of the outlier; a genuine change would usually persist. Consider known events (audits, ward moves, mass screening) that could explain a single spike."
  },
  "step-increase": {
    lookFor:
      "A sustained shift upward in the recent part of the series. Look for eight consecutive points on one side of the centre line as well as individual points beyond \u00b13\u03c3.",
    verify:
      "Compare the mean of the last ~10 weeks against the baseline. Switch to a longer time period (2 years or all data) to see the full step clearly."
  },
  "gradual-trend": {
    lookFor:
      "A slow upward drift rather than a step. The eight-in-a-row rule tends to trigger before individual points cross the 3-SD limits.",
    verify:
      "Apply moving-mean smoothing and view the longest time period. A CUSUM or EWMA chart would detect a drift earlier than a Shewhart chart."
  },
  "local-outbreak": {
    lookFor:
      "At hospital level the signal is diluted across many wards. Filtering to the affected ward should reveal a short run of unusually high weeks.",
    verify:
      "Change the Ward filter one ward at a time. A funnel plot or league table across wards for the affected period would highlight the outlier ward directly."
  },
  "seasonality": {
    lookFor:
      "A repeating pattern of higher and lower periods across the year. Fixed limits derived from a whole-year baseline may flag predictable peaks as 'signals'.",
    verify:
      "Aggregate to quarterly and view the longest time period. Compare the same weeks in successive years to see whether peaks recur at the same time."
  },
  "screening-expansion": {
    lookFor:
      "The count of positives rises after the change point, but the proportion positive stays broadly stable.",
    verify:
      "Switch the Measure between 'Count' and 'Percentage positive'. If count rises while proportion stays flat, more testing \u2014 not more disease \u2014 is driving the change."
  },
  "targeted-screening": {
    lookFor:
      "Proportion positive rises after the change point, even though the number of patients screened has fallen.",
    verify:
      "Compare Count and Percentage positive side by side. A rise in positivity without an increase in cases often reflects a change in who is being screened rather than a rise in prevalence."
  },
  "denominator-change": {
    lookFor:
      "The number of cases falls after the change point, but so does the underlying activity (bed-days or screened patients). Rates stay broadly stable.",
    verify:
      "Switch the Measure between 'Count' and 'Rate' / 'Percentage positive'. If the count moves but the rate does not, the change is in the denominator."
  },
  "reporting-artefact": {
    lookFor:
      "The most recent 2\u20133 weeks look unusually LOW, and there is often a lone unusually HIGH week roughly five weeks earlier (a batch of overdue reports arriving together).",
    verify:
      "Do not treat the recent dip as an improvement. Wait for reporting to catch up before drawing conclusions, and where possible check the raw report-received dates rather than the specimen dates."
  }
};

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
    scenario = generateScenario();

    if (storedScenario) {
      startNewStoredScenario(scenario);
    } else {
      saveCurrentScenario(scenario);
    }
  } else if (storedScenario) {
    scenario = storedScenario;
  } else {
    scenario = generateScenario();
    saveCurrentScenario(scenario);
  }

  populateLocationControls();
  populateMeasureControl();
  applyScenarioStateToControls();
  addEventListeners();
  renderApplication();
}

function collectElements() {
  const ids = [
    "hospitalName",
    "scenarioTitle",
    "scenarioDescription",
    "scenarioCode",
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

    "mainChart",
    "chartSubtitle",
    "chartSummary",
    "legend",
    "signalSummary",

    "investigateSelect",
    "learnerNotes",
    "actionLog",

    "newScenarioButton",
    "restoreButton",
    "downloadPngButton",
    "downloadCsvButton",
    "downloadJsonButton",
    "saveNotesButton",
    "revealButton",
    "revealContent"
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
    "showSignals"
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

  elements.restoreButton.addEventListener(
    "click",
    handleRestorePrevious
  );

  elements.saveNotesButton.addEventListener(
    "click",
    saveInterpretation
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

  elements.downloadJsonButton.addEventListener(
    "click",
    () => {
      logAction("exported-json");
      exportScenarioAsJson(scenario);
    }
  );
}

function populateMeasureControl() {
  const surveillance = scenario.surveillance;

  elements.measureSelect.replaceChildren();

  const labels = {
    count: "Count",
    rate:
      `Rate per ${surveillance.rateMultiplier.toLocaleString("en-GB")}`,
    proportion: "Percentage positive"
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
  scenario.learnerState.filters = {
    site: elements.siteSelect.value,
    ward: elements.wardSelect.value
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
      elements.showSignals.checked
  };

  saveCurrentScenario(scenario);
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
        options.measure
      ),
      integerYAxis: options.measure === "count",
      spcLabel: getSpcLabel(
        currentAnalysis.chartType,
        scenario.surveillance
      )
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
    return "No control limits";
  }

  const label = `${chartType}-chart`;

  if (
    surveillance &&
    surveillance.recommendedChart === chartType
  ) {
    return `${label} \u2014 recommended for this topic`;
  }

  return label;
}

function updateScenarioHeader() {
  elements.hospitalName.textContent =
    scenario.hospital.name;

  elements.scenarioTitle.textContent =
    scenario.surveillance.organism;

  elements.scenarioDescription.textContent =
    `${scenario.surveillance.numeratorLabel} monitored using synthetic weekly hospital surveillance data.`;

  elements.scenarioCode.textContent =
    scenario.id;

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
  const signalPoints =
    currentAnalysis.points.filter(
      point => point.isSignal
    );

  elements.signalSummary.replaceChildren();

  if (
    currentAnalysis.chartType === "none"
  ) {
    const paragraph =
      document.createElement("p");

    paragraph.textContent =
      "No control chart is currently selected.";

    elements.signalSummary.appendChild(paragraph);
    return;
  }

  if (!signalPoints.length) {
    const paragraph =
      document.createElement("p");

    paragraph.textContent =
      "No SPC rule included in this version was triggered.";

    elements.signalSummary.appendChild(paragraph);
    return;
  }

  const list = document.createElement("ul");

  for (const point of signalPoints) {
    const item =
      document.createElement("li");

    item.textContent =
      `${formatDate(point.date)}: ${
        point.signals.join("; ")
      }`;

    list.appendChild(item);
  }

  elements.signalSummary.appendChild(list);
}

function saveInterpretation() {
  scenario.learnerState.investigate =
    elements.investigateSelect.value;

  scenario.learnerState.notes =
    elements.learnerNotes.value.trim();

  logAction("saved-interpretation", {
    investigate:
      scenario.learnerState.investigate
  });

  saveCurrentScenario(scenario);
  renderApplication();
}

function revealExplanation() {
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
  const tips =
    INVESTIGATION_TIPS[truth.templateId] || {
      lookFor:
        "No specific pattern is described for this template.",
      verify:
        "Explore the data using the ward filter, aggregation and measure controls."
    };

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

  appendRevealSection(
    "What the intended pattern should look like",
    createParagraph(tips.lookFor)
  );

  appendRevealSection(
    "How to check it with the tools available",
    createParagraph(tips.verify)
  );

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

  const learning = document.createElement("p");

  const label = document.createElement("strong");
  label.textContent = "Learning point: ";

  learning.append(
    label,
    document.createTextNode(
      "A control-chart signal supports investigation; it does not by itself prove an outbreak. Equally, the absence of a signal does not prove that nothing has happened \u2014 particularly when counts are small."
    )
  );

  elements.revealContent.append(learning);
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

  if (surveillance.code === "MRSA") {
    notes.push(
      "MRSA bacteraemia is a rare event in UK hospitals \u2014 even a large trust typically reports only a handful of cases per year. Weekly SPC charts have very limited statistical power for organisms this rare; in practice, monthly per-trust reporting and case-level review are usually more informative than trend charts."
    );
  }

  if (surveillance.code !== "MRSA" && totalEvents < 20) {
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
    "reporting-artefact"
  ].includes(templateId);
}

function startNewScenario() {
  scenario = generateScenario();

  startNewStoredScenario(scenario);

  populateMeasureControl();
  populateLocationControls();
  applyScenarioStateToControls();
  renderApplication();
}

function handleRestorePrevious() {
  const restored =
    restorePreviousScenario();

  if (!restored) {
    window.alert(
      "There is no previous scenario to restore."
    );

    return;
  }

  scenario = restored;

  populateMeasureControl();
  populateLocationControls();
  applyScenarioStateToControls();
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
    "exported-json":
      "Exported scenario as JSON"
  };

  return labels[action.type] || action.type;
}

function getYAxisTitle(measure) {
  if (measure === "count") {
    return scenario.surveillance.numeratorLabel;
  }

  if (measure === "proportion") {
    return "Screen-positive patients (%)";
  }

  return `Cases per ${
    scenario.surveillance.rateMultiplier.toLocaleString("en-GB")
  } ${scenario.surveillance.denominatorLabel.toLowerCase()}`;
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
