// js/export.js

function sanitiseFilename(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

export function exportChartAsPng(
  canvas,
  scenario
) {
  const filename = `${sanitiseFilename(
    scenario.id
  )}-chart.png`;

  canvas.toBlob(blob => {
    if (!blob) {
      throw new Error(
        "The chart image could not be created."
      );
    }

    downloadBlob(blob, filename);
  }, "image/png");
}

export function exportScenarioAsJson(scenario) {
  const json = JSON.stringify(
    scenario,
    null,
    2
  );

  const blob = new Blob(
    [json],
    { type: "application/json;charset=utf-8" }
  );

  downloadBlob(
    blob,
    `${sanitiseFilename(scenario.id)}.json`
  );
}

export function exportPointsAsCsv(
  points,
  scenario
) {
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

  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row.map(escapeCsvValue).join(",")
    )
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
  return Number.isFinite(value)
    ? value
    : "";
}

function escapeCsvValue(value) {
  const stringValue = String(
    value ?? ""
  );

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
// js/export.js

function sanitiseFilename(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

export function exportChartAsPng(
  canvas,
  scenario
) {
  const filename = `${sanitiseFilename(
    scenario.id
  )}-chart.png`;

  canvas.toBlob(blob => {
    if (!blob) {
      throw new Error(
        "The chart image could not be created."
      );
    }

    downloadBlob(blob, filename);
  }, "image/png");
}

export function exportScenarioAsJson(scenario) {
  const json = JSON.stringify(
    scenario,
    null,
    2
  );

  const blob = new Blob(
    [json],
    { type: "application/json;charset=utf-8" }
  );

  downloadBlob(
    blob,
    `${sanitiseFilename(scenario.id)}.json`
  );
}

export function exportPointsAsCsv(
  points,
  scenario
) {
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

  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row.map(escapeCsvValue).join(",")
    )
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
  return Number.isFinite(value)
    ? value
    : "";
}

function escapeCsvValue(value) {
  const stringValue = String(
    value ?? ""
  );

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }

  return stringValue;
}}
