// js/chart.js

const COLOURS = {
  data: "#005eb8",
  smooth: "#330072",
  centre: "#007f3b",
  // Chart 2-SD warning line. Original NHS "warm yellow" #ed8b00 only
  // reaches ~2.3:1 contrast on a white background, well below the WCAG
  // 1.4.11 minimum of 3:1 for meaningful graphical objects. The darker
  // amber below sits at ~5.2:1 while remaining clearly distinct from
  // the blue data series and the red control-limit lines. The lighter
  // orange is retained for button backgrounds (which pair with dark
  // text) via the CSS variable and is unaffected by this change.
  warning: "#b45c00",
  control: "#d5281b",
  signal: "#d5281b",
  grid: "#d8dde0",
  text: "#231f20",
  background: "#ffffff"
};

export function renderChart(
  canvas,
  points,
  options = {}
) {
  const context = canvas.getContext("2d");

  const width = canvas.width;
  const height = canvas.height;

  const padding = {
    top: 55,
    right: 55,
    bottom: 80,
    left: 85
  };

  context.clearRect(0, 0, width, height);

  context.fillStyle = COLOURS.background;
  context.fillRect(0, 0, width, height);

  if (!points.length) {
    drawNoDataMessage(context, width, height);
    return;
  }

  const allValues = collectChartValues(
    points,
    options
  );

  let minimum = Math.min(0, ...allValues);
  let maximum = Math.max(...allValues);

  if (minimum === maximum) {
    maximum = minimum + 1;
  }

  const { ticks, minimum: gridMin, maximum: gridMax, step: gridStep } =
    computeYAxisTicks(
      minimum,
      maximum,
      options.integerYAxis === true
    );

  minimum = gridMin;
  maximum = gridMax;

  const chartWidth =
    width - padding.left - padding.right;

  const chartHeight =
    height - padding.top - padding.bottom;

  const xForIndex = index => {
    if (points.length === 1) {
      return padding.left + chartWidth / 2;
    }

    return padding.left +
      (index / (points.length - 1)) *
      chartWidth;
  };

  const yForValue = value => {
    const proportion =
      (value - minimum) / (maximum - minimum);

    return padding.top +
      chartHeight -
      proportion * chartHeight;
  };

  drawGrid({
    context,
    width,
    padding,
    ticks,
    yForValue,
    integerOnly: options.integerYAxis === true,
    step: gridStep
  });

  if (options.showThreeSd) {
    drawSeries(
      context,
      points,
      "upper3",
      xForIndex,
      yForValue,
      COLOURS.control,
      [8, 5]
    );

    drawSeries(
      context,
      points,
      "lower3",
      xForIndex,
      yForValue,
      COLOURS.control,
      [8, 5]
    );
  }

  if (options.showTwoSd) {
    drawSeries(
      context,
      points,
      "upper2",
      xForIndex,
      yForValue,
      COLOURS.warning,
      [4, 4]
    );

    drawSeries(
      context,
      points,
      "lower2",
      xForIndex,
      yForValue,
      COLOURS.warning,
      [4, 4]
    );
  }

  drawSeries(
    context,
    points,
    "centre",
    xForIndex,
    yForValue,
    COLOURS.centre,
    [10, 4]
  );

  drawSeries(
    context,
    points,
    "value",
    xForIndex,
    yForValue,
    COLOURS.data
  );

  if (options.smoothing > 0) {
    drawSeries(
      context,
      points,
      "smoothedValue",
      xForIndex,
      yForValue,
      COLOURS.smooth,
      [],
      3
    );
  }

  drawPoints({
    context,
    points,
    xForIndex,
    yForValue,
    showSignals: options.showSignals
  });

  if (options.changePointDate) {
    drawChangePointMarker({
      context,
      points,
      xForIndex,
      padding,
      chartHeight,
      changePointDate: options.changePointDate
    });
  }

  drawXAxisLabels({
    context,
    points,
    xForIndex,
    height,
    padding
  });

  drawAxisTitles({
    context,
    width,
    height,
    padding,
    yAxisTitle: options.yAxisTitle
  });

  /*
   * Permanent synthetic-data label included in PNG export.
   */
  context.save();
  context.fillStyle = "#425563";
  context.font = "14px Arial";
  context.textAlign = "right";
  context.fillText(
    "Synthetic educational data",
    width - padding.right,
    24
  );
  context.restore();

  /*
   * Chart-type label so the learner can see at a glance which SPC
   * chart is currently plotted (c-, u-, p- or none) without having
   * to cross-refer to the control panel.
   */
  if (options.spcLabel) {
    context.save();
    context.fillStyle = "#231f20";
    context.font = "bold 14px Arial";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(
      options.spcLabel,
      padding.left,
      24
    );

    if (options.denominatorLabel) {
      context.fillStyle = "#425563";
      context.font = "13px Arial";
      context.fillText(
        options.denominatorLabel,
        padding.left,
        40
      );
    }

    context.restore();
  }
}

function collectChartValues(points, options) {
  const fields = ["value", "centre"];

  if (options.showTwoSd) {
    fields.push("lower2", "upper2");
  }

  if (options.showThreeSd) {
    fields.push("lower3", "upper3");
  }

  if (options.smoothing > 0) {
    fields.push("smoothedValue");
  }

  return points.flatMap(point =>
    fields
      .map(field => point[field])
      .filter(value => Number.isFinite(value))
  );
}

function drawGrid({
  context,
  width,
  padding,
  ticks,
  yForValue,
  integerOnly,
  step
}) {
  context.save();
  context.font = "14px Arial";

  for (const value of ticks) {
    const y = yForValue(value);

    context.strokeStyle = COLOURS.grid;
    context.lineWidth = 1;
    context.setLineDash([]);

    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();

    context.fillStyle = COLOURS.text;
    context.textAlign = "right";
    context.textBaseline = "middle";

    context.fillText(
      integerOnly
        ? Math.round(value).toString()
        : formatAxisLabel(value, step),
      padding.left - 12,
      y
    );
  }

  context.restore();
}

/**
 * Chooses grid tick values.
 *
 * We always snap to a "nice" step from the 1/2/2.5/5 x 10^n family so
 * that rate axes read as round numbers (e.g. 0, 5, 10, 15) and are
 * directly comparable to similar SPC and epidemiology plots. For count
 * charts we additionally clamp the step to be >= 1 so that every label
 * is a whole number matching the underlying discrete counts.
 *
 * The min/max are extended outwards to the nearest step so no data
 * point falls outside the drawn grid and every gridline sits on a
 * pleasing round value.
 */
function computeYAxisTicks(minimum, maximum, integerOnly) {
  const targetTickCount = 6;
  const range = Math.max(maximum - minimum, Number.EPSILON);
  const rawStep = range / targetTickCount;

  const step = integerOnly
    ? Math.max(1, niceStep(rawStep))
    : niceStep(rawStep);

  const niceMin = Math.floor(minimum / step) * step;
  const niceMax = Math.ceil(maximum / step) * step;

  const ticks = [];

  for (
    let value = niceMin;
    value <= niceMax + step * 1e-9;
    value += step
  ) {
    const snapped = Math.round(value / step) * step;
    ticks.push(integerOnly ? Math.round(snapped) : snapped);
  }

  return {
    ticks,
    minimum: niceMin,
    maximum: niceMax === niceMin ? niceMin + step : niceMax,
    step
  };
}

/**
 * Returns a "nice" step from the 1, 2, 2.5, 5, 10 x 10^n family, which
 * are the choices that produce human-friendly axis labels (0, 5, 10,
 * 15; 0, 2.5, 5, 7.5; 0, 20, 40, 60; etc.).
 */
function niceStep(rawStep) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;

  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(rawStep))
  );

  const normalised = rawStep / magnitude;

  let niceNormalised;

  if (normalised <= 1) niceNormalised = 1;
  else if (normalised <= 2) niceNormalised = 2;
  else if (normalised <= 2.5) niceNormalised = 2.5;
  else if (normalised <= 5) niceNormalised = 5;
  else niceNormalised = 10;

  return niceNormalised * magnitude;
}

/**
 * Formats a numeric axis tick using a precision derived from the step
 * so that adjacent labels always differ visibly but no false precision
 * is introduced (e.g. step 5 -> "10", step 0.5 -> "1.5", step 0.05 ->
 * "0.15"). Trailing zeros after the decimal point are dropped for a
 * cleaner appearance.
 */
function formatAxisLabel(value, step) {
  if (!Number.isFinite(value)) return "";

  const safeStep = Number.isFinite(step) && step > 0
    ? step
    : Math.abs(value) || 1;

  const decimals = Math.max(
    0,
    -Math.floor(Math.log10(safeStep) + 1e-9)
  );

  return value.toFixed(decimals);
}

function drawSeries(
  context,
  points,
  property,
  xForIndex,
  yForValue,
  colour,
  dash = [],
  lineWidth = 2
) {
  context.save();

  context.strokeStyle = colour;
  context.lineWidth = lineWidth;
  context.setLineDash(dash);

  context.beginPath();

  let lineStarted = false;

  points.forEach((point, index) => {
    const value = point[property];

    if (!Number.isFinite(value)) {
      lineStarted = false;
      return;
    }

    const x = xForIndex(index);
    const y = yForValue(value);

    if (!lineStarted) {
      context.moveTo(x, y);
      lineStarted = true;
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
  context.restore();
}

function drawPoints({
  context,
  points,
  xForIndex,
  yForValue,
  showSignals
}) {
  points.forEach((point, index) => {
    if (!Number.isFinite(point.value)) return;

    const isSignal =
      showSignals && point.isSignal;

    context.save();

    context.fillStyle = isSignal
      ? COLOURS.signal
      : COLOURS.data;

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;

    context.beginPath();
    context.arc(
      xForIndex(index),
      yForValue(point.value),
      isSignal ? 7 : 4,
      0,
      Math.PI * 2
    );

    context.fill();
    context.stroke();
    context.restore();
  });
}

/**
 * Draws a subtle vertical dashed line at the aggregated data point
 * whose date is nearest the ground-truth change-point date, plus a
 * small "Change point" label at the top of the chart. Only rendered
 * after the learner reveals the scenario (guarded by the caller).
 *
 * The nearest-point search uses ISO date comparison; the aggregated
 * chart may not have a point exactly on the change-point week, so we
 * pick the point with the smallest absolute date difference.
 */
function drawChangePointMarker({
  context,
  points,
  xForIndex,
  padding,
  chartHeight,
  changePointDate
}) {
  if (!points.length) return;

  const target = new Date(changePointDate).getTime();
  if (!Number.isFinite(target)) return;

  let bestIndex = 0;
  let bestDelta = Infinity;

  for (let index = 0; index < points.length; index += 1) {
    const dateString = points[index].date;
    if (!dateString) continue;

    const delta = Math.abs(
      new Date(dateString).getTime() - target
    );

    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  const x = xForIndex(bestIndex);

  context.save();
  context.strokeStyle = "#8c6d1f";
  context.lineWidth = 1.5;
  context.setLineDash([6, 4]);

  context.beginPath();
  context.moveTo(x, padding.top);
  context.lineTo(x, padding.top + chartHeight);
  context.stroke();

  context.setLineDash([]);
  context.fillStyle = "#8c6d1f";
  context.font = "bold 12px Arial";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText("Change point", x, padding.top - 6);

  context.restore();
}

function drawXAxisLabels({
  context,
  points,
  xForIndex,
  height,
  padding
}) {
  const maximumLabels = 8;

  const interval = Math.max(
    1,
    Math.ceil(points.length / maximumLabels)
  );

  context.save();
  context.font = "13px Arial";
  context.fillStyle = COLOURS.text;
  context.textAlign = "center";

  points.forEach((point, index) => {
    if (
      index % interval !== 0 &&
      index !== points.length - 1
    ) {
      return;
    }

    const label = new Date(
      `${point.date}T00:00:00Z`
    ).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC"
    });

    context.fillText(
      label,
      xForIndex(index),
      height - padding.bottom + 28
    );
  });

  context.restore();
}

function drawAxisTitles({
  context,
  width,
  height,
  padding,
  yAxisTitle
}) {
  context.save();

  context.fillStyle = COLOURS.text;
  context.font = "bold 15px Arial";

  context.textAlign = "center";
  context.fillText(
    "Observation period",
    padding.left +
      (width - padding.left - padding.right) / 2,
    height - 15
  );

  context.translate(
    20,
    padding.top +
      (height - padding.top - padding.bottom) / 2
  );

  context.rotate(-Math.PI / 2);

  context.fillText(
    yAxisTitle || "Value",
    0,
    0
  );

  context.restore();
}

function drawNoDataMessage(context, width, height) {
  context.save();
  context.fillStyle = COLOURS.text;
  context.font = "18px Arial";
  context.textAlign = "center";
  context.fillText(
    "No observations are available for this selection.",
    width / 2,
    height / 2
  );
  context.restore();
}

export function createChartSummary(
  points,
  chartType
) {
  if (!points.length) {
    return "No data are available for the current selection.";
  }

  const signals = points.filter(
    point => point.isSignal
  );

  const first = points[0];
  const last = points[points.length - 1];

  return [
    `The chart contains ${points.length} observations`,
    `from ${formatAccessibleDate(first.date)}`,
    `to ${formatAccessibleDate(last.date)}.`,
    chartType === "none"
      ? "No control limits are displayed."
      : `${signals.length} observations have an SPC signal.`
  ].join(" ");
}

function formatAccessibleDate(dateString) {
  return new Date(
    `${dateString}T00:00:00Z`
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}
