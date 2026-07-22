// js/export.js

function sanitiseFilename(value) {
  return String(value ?? "download")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "download";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function exportChartAsPng(canvas, scenario) {
  const filename = `${sanitiseFilename(scenario.id)}-chart.png`;

  canvas.toBlob(blob => {
    if (!blob) {
      console.error("The chart image could not be created.");
      return;
    }

    downloadBlob(blob, filename);
  }, "image/png");
}

export function exportScenarioAsJson(scenario) {
  const json = JSON.stringify(scenario, null, 2);

  const blob = new Blob(
    [json],
    { type: "application/json;charset=utf-8" }
  );

  downloadBlob(
    blob,
    `${sanitiseFilename(scenario.id)}.json`
  );
}

export function exportPointsAsCsv(points, scenario) {
  const headers = [
    "start_date",
    "end_date",
    "numerator",
    "denominator",
    "displayed_value",
    "centre_line",
    "lower_2sd",
    "upper_2sd",
    "lower_3sd",
    "upper_3sd",
    "spc_signal",
    "signal_rules"
  ];

  const rows = points.map(point => [
    point.date,
    point.endDate || point.date,
    point.numerator,
    point.denominator,
    formatCsvNumber(point.value),
    formatCsvNumber(point.centre),
    formatCsvNumber(point.lower2),
    formatCsvNumber(point.upper2),
    formatCsvNumber(point.lower3),
    formatCsvNumber(point.upper3),
    point.isSignal ? "Yes" : "No",
    (point.signals || []).join("; ")
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const blob = new Blob(
    [csv],
    { type: "text/csv;charset=utf-8" }
  );

  downloadBlob(
    blob,
    `${sanitiseFilename(scenario.id)}-data.csv`
  );
}

function formatCsvNumber(value) {
  return Number.isFinite(value) ? value : "";
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}

/**
 * Portable, human-readable snapshot of the current scenario, the current
 * chart view and the learner's interpretation. Opens in any browser and
 * can be printed to PDF for a training record.
 */
export function exportLearningRecordAsHtml({
  scenario,
  canvas,
  currentAnalysis,
  displayOptions,
  spcLabel,
  denominatorLabel,
  yAxisTitle,
  investigationTip
}) {
  const chartDataUri = canvas
    ? canvas.toDataURL("image/png")
    : "";

  const html = buildLearningRecordHtml({
    scenario,
    chartDataUri,
    currentAnalysis,
    displayOptions,
    spcLabel,
    denominatorLabel,
    yAxisTitle,
    investigationTip
  });

  const blob = new Blob(
    [html],
    { type: "text/html;charset=utf-8" }
  );

  downloadBlob(
    blob,
    `${sanitiseFilename(scenario.id)}-learning-record.html`
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatIsoDateShort(dateString) {
  if (!dateString) return "";

  const parsed = new Date(`${dateString}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) return dateString;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatReadableNumber(value) {
  if (!Number.isFinite(value)) return "";

  return value.toLocaleString("en-GB", {
    maximumFractionDigits: 3
  });
}

function difficultyLabel(difficulty) {
  return (
    {
      1: "Introductory",
      2: "Intermediate",
      3: "Advanced"
    }[difficulty] || "Not recorded"
  );
}

function investigateLabel(value) {
  return (
    {
      yes: "Yes — I would investigate now",
      no: "No — I would not investigate at this stage",
      uncertain:
        "Uncertain — I would seek more information first"
    }[value] || "Not yet answered"
  );
}

function aggregationLabel(aggregation) {
  return (
    {
      1: "Weekly",
      4: "Four-weekly",
      13: "Quarterly"
    }[Number(aggregation)] || "Weekly"
  );
}

function timeWindowLabel(timeWindow) {
  return (
    {
      26: "Most recent 6 months",
      52: "Most recent 12 months",
      104: "Most recent 2 years",
      156: "All available data"
    }[Number(timeWindow)] ||
    `${timeWindow} weeks`
  );
}

function measureLabel(measure, surveillance) {
  if (measure === "count") {
    return "Count";
  }

  if (measure === "proportion") {
    return "Percentage positive";
  }

  const multiplier = surveillance?.rateMultiplier;

  return multiplier
    ? `Rate per ${multiplier.toLocaleString("en-GB")}`
    : "Rate";
}

function smoothingLabel(smoothing) {
  const value = Number(smoothing);

  if (!value) return "None";

  return `${value}-period moving mean`;
}

function buildLearningRecordHtml({
  scenario,
  chartDataUri,
  currentAnalysis,
  displayOptions,
  spcLabel,
  denominatorLabel,
  yAxisTitle,
  investigationTip
}) {
  const surveillance = scenario.surveillance || {};
  const groundTruth = scenario.groundTruth || {};
  const learnerState = scenario.learnerState || {};
  const points = currentAnalysis?.points || [];
  const signals = points.filter(point => point.isSignal);

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const seriesRange =
    firstPoint && lastPoint
      ? `${formatIsoDateShort(firstPoint.date)} \u2013 ${formatIsoDateShort(
          lastPoint.endDate || lastPoint.date
        )}`
      : "Not available";

  const notes = (learnerState.notes || "").trim();
  const revealed = Boolean(learnerState.revealed);

  const chartFragment = chartDataUri
    ? `<img class="chart" src="${chartDataUri}" alt="Surveillance control chart">`
    : `<p><em>Chart image not available.</em></p>`;

  const signalsFragment = signals.length
    ? `
      <table class="signals">
        <thead>
          <tr>
            <th>Period starting</th>
            <th>Value</th>
            <th>Rule(s) triggered</th>
          </tr>
        </thead>
        <tbody>
          ${signals
            .map(
              point => `
            <tr>
              <td>${escapeHtml(formatIsoDateShort(point.date))}</td>
              <td>${escapeHtml(formatReadableNumber(point.value))}</td>
              <td>${escapeHtml((point.signals || []).join("; "))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : `<p>No SPC signals were detected in the current view.</p>`;

  const revealFragment = revealed
    ? `
      <h2>Scenario explanation (revealed)</h2>
      <h3>${escapeHtml(groundTruth.templateName || "")}</h3>
      <p>${escapeHtml(groundTruth.explanation || "")}</p>
      <dl class="meta">
        <dt>Difficulty</dt>
        <dd>${escapeHtml(difficultyLabel(groundTruth.difficulty))}</dd>
        <dt>Change point</dt>
        <dd>${escapeHtml(
          formatIsoDateShort(groundTruth.changePointDate) ||
            "None (common-cause variation)"
        )}</dd>
        ${
          groundTruth.affectedWard
            ? `<dt>Affected location</dt><dd>${escapeHtml(groundTruth.affectedWard)}</dd>`
            : ""
        }
      </dl>
      ${
        investigationTip
          ? `
        <h3>What the intended pattern should look like</h3>
        <p>${escapeHtml(investigationTip.lookFor)}</p>
        <h3>How to check it with the tools available</h3>
        <p>${escapeHtml(investigationTip.verify)}</p>`
          : ""
      }`
    : `
      <h2>Scenario explanation</h2>
      <p><em>Not revealed at the time this record was saved.</em></p>`;

  const generatedAt = new Date().toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short"
  });

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>HCAI Signal Lab \u2014 learning record \u2014 ${escapeHtml(scenario.id)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; max-width: 900px; margin: 24px auto; padding: 0 24px 48px; color: #231f20; line-height: 1.5; }
  h1 { color: #005eb8; margin: 0 0 4px; }
  h2 { color: #005eb8; margin-top: 36px; border-bottom: 2px solid #005eb8; padding-bottom: 4px; }
  h3 { margin-top: 20px; color: #425563; }
  p { margin: 8px 0; }
  .synthetic { background: #ffe4a3; padding: 12px 16px; border-left: 4px solid #ed8b00; margin: 16px 0; }
  .subtitle { color: #425563; margin-top: 0; }
  dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 4px 20px; margin: 8px 0; }
  dl.meta dt { font-weight: 600; color: #425563; }
  dl.meta dd { margin: 0; }
  img.chart { max-width: 100%; height: auto; border: 1px solid #d8dde0; margin: 12px 0; background: #fff; }
  .learner-note { background: #f0f4f5; padding: 12px 16px; border-radius: 4px; white-space: pre-wrap; margin: 8px 0; }
  table.signals { border-collapse: collapse; width: 100%; margin: 12px 0; }
  table.signals th, table.signals td { border: 1px solid #d8dde0; padding: 6px 8px; text-align: left; font-size: 0.95rem; }
  table.signals th { background: #f0f4f5; }
  footer { margin-top: 40px; font-size: 0.85rem; color: #425563; border-top: 1px solid #d8dde0; padding-top: 12px; }
  @media print {
    body { margin: 0; padding: 0 12mm; }
    .synthetic { background: transparent; border-left-width: 2px; }
  }
</style>
</head>
<body>
  <h1>HCAI Signal Lab \u2014 learning record</h1>
  <p class="subtitle">Generated ${escapeHtml(generatedAt)}</p>

  <div class="synthetic">
    <strong>Fictional hospital \u2014 synthetic educational data.</strong>
    Not for clinical use.
  </div>

  <h2>Scenario</h2>
  <dl class="meta">
    <dt>Scenario code</dt><dd>${escapeHtml(scenario.id)}</dd>
    <dt>Organism / topic</dt><dd>${escapeHtml(surveillance.organism || "")}</dd>
    <dt>Hospital</dt><dd>${escapeHtml(scenario.hospital?.name || "")} (${escapeHtml(scenario.hospital?.type || "")})</dd>
    <dt>Series period</dt><dd>${escapeHtml(seriesRange)}</dd>
    <dt>Generated at</dt><dd>${escapeHtml(scenario.generatedAt || "")}</dd>
  </dl>

  <h2>Current view</h2>
  <dl class="meta">
    <dt>Measure</dt><dd>${escapeHtml(measureLabel(displayOptions?.measure, surveillance))}</dd>
    <dt>Aggregation</dt><dd>${escapeHtml(aggregationLabel(displayOptions?.aggregation))}</dd>
    <dt>Time window</dt><dd>${escapeHtml(timeWindowLabel(displayOptions?.timeWindow))}</dd>
    <dt>Site / ward</dt><dd>${escapeHtml(displayOptions?.site || "all")} / ${escapeHtml(displayOptions?.ward || "all")}</dd>
    <dt>Smoothing</dt><dd>${escapeHtml(smoothingLabel(displayOptions?.smoothing))}</dd>
    <dt>Control chart</dt><dd>${escapeHtml(spcLabel || "None")}</dd>
    <dt>Y-axis</dt><dd>${escapeHtml(yAxisTitle || "")}</dd>
    <dt>Denominator</dt><dd>${escapeHtml(denominatorLabel || "Not applicable")}</dd>
    <dt>Signals detected</dt><dd>${signals.length}</dd>
  </dl>

  ${chartFragment}

  <h3>Signals in this view</h3>
  ${signalsFragment}

  <h2>Your interpretation</h2>
  <dl class="meta">
    <dt>Investigate now?</dt>
    <dd>${escapeHtml(investigateLabel(learnerState.investigate))}</dd>
  </dl>
  <h3>Notes</h3>
  <div class="learner-note">${
    notes ? escapeHtml(notes) : "<em>No notes recorded.</em>"
  }</div>

  ${revealFragment}

  <footer>
    HCAI Signal Lab \u2014 synthetic educational data. Not linked to any real hospital, patient or trust.
  </footer>
</body>
</html>`;
}
