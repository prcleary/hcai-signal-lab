// js/chart.js

const COLOURS = {
  data: "#005eb8",
  smooth: "#330072",
  centre: "#007f3b",
  warning: "#ed8b00",
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
    top: 45,
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
    minimum,
    maximum,
    yForValue
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
  minimum,
  maximum,
  yForValue
}) {
  const tickCount = 5;

  context.save();
  context.font = "14px Arial";

  for (
    let tick = 0;
    tick <= tickCount;
    tick += 1
  ) {
    const value =
      minimum +
      ((maximum - minimum) * tick) /
      tickCount;

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
      formatNumber(value),
      padding.left - 12,
      y
    );
  }

  context.restore();
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

function formatNumber(value) {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
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
