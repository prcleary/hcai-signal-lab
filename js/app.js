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
      )
    }
  );

  elements.chartSummary.textContent =
    createChartSummary(
      currentAnalysis.points,
      currentAnalysis.chartType
    );
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

  const heading =
    document.createElement("h3");

  heading.textContent =
    scenario.groundTruth.templateName;

  const explanation =
    document.createElement("p");

  explanation.textContent =
    scenario.groundTruth.explanation;

  const warning =
    document.createElement("p");

  warning.innerHTML =
    "<strong>Learning point:</strong> An SPC signal supports investigation; it does not by itself prove an outbreak.";

  elements.revealContent.append(
    heading,
    explanation,
    warning
  );
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
