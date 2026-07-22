// js/statistics.js

export function mean(values) {
  const validValues = values.filter(
    value => Number.isFinite(value)
  );

  if (!validValues.length) return 0;

  return validValues.reduce(
    (sum, value) => sum + value,
    0
  ) / validValues.length;
}

export function filterObservations(
  observations,
  { site = "all", ward = "all" } = {}
) {
  return observations.filter(observation => {
    const siteMatches =
      site === "all" || observation.site === site;

    const wardMatches =
      ward === "all" || observation.ward === ward;

    return siteMatches && wardMatches;
  });
}

/**
 * Combines all ward records that share the same week.
 */
export function combineByDate(observations) {
  const groups = new Map();

  for (const observation of observations) {
    if (!groups.has(observation.date)) {
      groups.set(observation.date, {
        date: observation.date,
        numerator: 0,
        denominator: 0,
        bedDays: 0
      });
    }

    const group = groups.get(observation.date);

    group.numerator += observation.numerator;
    group.denominator += observation.denominator;
    group.bedDays += observation.bedDays ?? 0;
  }

  return [...groups.values()].sort(
    (first, second) =>
      first.date.localeCompare(second.date)
  );
}

export function limitTimeWindow(points, numberOfWeeks) {
  const windowSize = Number(numberOfWeeks);

  if (
    !Number.isFinite(windowSize) ||
    windowSize <= 0 ||
    windowSize >= points.length
  ) {
    return [...points];
  }

  return points.slice(-windowSize);
}

/**
 * Combines consecutive weekly observations.
 */
export function aggregatePoints(points, groupSize = 1) {
  const size = Math.max(1, Number(groupSize));

  if (size === 1) {
    return points.map(point => ({ ...point }));
  }

  const aggregated = [];

  for (
    let index = 0;
    index < points.length;
    index += size
  ) {
    const group = points.slice(index, index + size);

    if (!group.length) continue;

    aggregated.push({
      date: group[0].date,
      endDate: group[group.length - 1].date,
      numerator: group.reduce(
        (sum, point) => sum + point.numerator,
        0
      ),
      denominator: group.reduce(
        (sum, point) => sum + point.denominator,
        0
      ),
      bedDays: group.reduce(
        (sum, point) => sum + (point.bedDays ?? 0),
        0
      )
    });
  }

  return aggregated;
}

export function addDisplayedValues(
  points,
  measure,
  rateMultiplier = 1
) {
  return points.map(point => {
    let value;

    if (measure === "count") {
      value = point.numerator;
    } else {
      value = point.denominator > 0
        ? (
          point.numerator /
          point.denominator
        ) * rateMultiplier
        : null;
    }

    return {
      ...point,
      value
    };
  });
}

export function addMovingAverage(points, windowSize) {
  const size = Number(windowSize);

  if (!Number.isFinite(size) || size < 2) {
    return points.map(point => ({
      ...point,
      smoothedValue: null
    }));
  }

  return points.map((point, index) => {
    if (index < size - 1) {
      return {
        ...point,
        smoothedValue: null
      };
    }

    const values = points
      .slice(index - size + 1, index + 1)
      .map(item => item.value)
      .filter(value => Number.isFinite(value));

    return {
      ...point,
      smoothedValue:
        values.length === size
          ? mean(values)
          : null
    };
  });
}

export function calculatePChart(points) {
  const totalEvents = points.reduce(
    (sum, point) => sum + point.numerator,
    0
  );

  const totalOpportunities = points.reduce(
    (sum, point) => sum + point.denominator,
    0
  );

  const centre = totalOpportunities > 0
    ? totalEvents / totalOpportunities
    : 0;

  return points.map(point => {
    const denominator = point.denominator;

    if (!denominator) {
      return {
        ...point,
        centre: null,
        lower2: null,
        upper2: null,
        lower3: null,
        upper3: null
      };
    }

    const standardError = Math.sqrt(
      centre * (1 - centre) / denominator
    );

    return {
      ...point,
      value: point.numerator / denominator,
      centre,
      lower2: Math.max(
        0,
        centre - 2 * standardError
      ),
      upper2: Math.min(
        1,
        centre + 2 * standardError
      ),
      lower3: Math.max(
        0,
        centre - 3 * standardError
      ),
      upper3: Math.min(
        1,
        centre + 3 * standardError
      )
    };
  });
}

export function calculateCChart(points) {
  const centre = mean(
    points.map(point => point.numerator)
  );

  const standardDeviation = Math.sqrt(centre);

  return points.map(point => ({
    ...point,
    value: point.numerator,
    centre,
    lower2: Math.max(
      0,
      centre - 2 * standardDeviation
    ),
    upper2: centre + 2 * standardDeviation,
    lower3: Math.max(
      0,
      centre - 3 * standardDeviation
    ),
    upper3: centre + 3 * standardDeviation
  }));
}

export function calculateUChart(points) {
  const totalEvents = points.reduce(
    (sum, point) => sum + point.numerator,
    0
  );

  const totalExposure = points.reduce(
    (sum, point) => sum + point.denominator,
    0
  );

  const centre = totalExposure > 0
    ? totalEvents / totalExposure
    : 0;

  return points.map(point => {
    const exposure = point.denominator;

    if (!exposure) {
      return {
        ...point,
        centre: null,
        lower2: null,
        upper2: null,
        lower3: null,
        upper3: null
      };
    }

    const standardError = Math.sqrt(
      centre / exposure
    );

    return {
      ...point,
      value: point.numerator / exposure,
      centre,
      lower2: Math.max(
        0,
        centre - 2 * standardError
      ),
      upper2: centre + 2 * standardError,
      lower3: Math.max(
        0,
        centre - 3 * standardError
      ),
      upper3: centre + 3 * standardError
    };
  });
}

export function selectControlChart(
  requestedType,
  surveillance,
  measure
) {
  if (requestedType !== "auto") {
    return requestedType;
  }

  if (measure === "proportion") return "p";
  if (measure === "count") return "c";

  return surveillance.recommendedChart || "u";
}

/**
 * Applies the SPC calculation and converts results to the
 * units displayed on the chart.
 */
export function calculateControlChart(
  points,
  chartType,
  rateMultiplier = 1
) {
  let calculated;

  if (chartType === "p") {
    calculated = calculatePChart(points);
  } else if (chartType === "c") {
    calculated = calculateCChart(points);
  } else if (chartType === "u") {
    calculated = calculateUChart(points);
  } else {
    return points;
  }

  const multiplier =
    chartType === "p" || chartType === "u"
      ? rateMultiplier
      : 1;

  return calculated.map(point => ({
    ...point,
    value: multiplyNullable(
      point.value,
      multiplier
    ),
    centre: multiplyNullable(
      point.centre,
      multiplier
    ),
    lower2: multiplyNullable(
      point.lower2,
      multiplier
    ),
    upper2: multiplyNullable(
      point.upper2,
      multiplier
    ),
    lower3: multiplyNullable(
      point.lower3,
      multiplier
    ),
    upper3: multiplyNullable(
      point.upper3,
      multiplier
    )
  }));
}

function multiplyNullable(value, multiplier) {
  return Number.isFinite(value)
    ? value * multiplier
    : null;
}

export function detectSignals(points) {
  return points.map((point, index) => {
    const signals = [];

    if (
      Number.isFinite(point.value) &&
      Number.isFinite(point.upper3) &&
      point.value > point.upper3
    ) {
      signals.push("Above the upper 3-SD control limit");
    }

    if (
      Number.isFinite(point.value) &&
      Number.isFinite(point.lower3) &&
      point.value < point.lower3
    ) {
      signals.push("Below the lower 3-SD control limit");
    }

    /*
     * Detect eight consecutive observations on one side
     * of the centre line.
     */
    if (index >= 7) {
      const run = points.slice(index - 7, index + 1);

      const allAbove = run.every(item =>
        Number.isFinite(item.value) &&
        Number.isFinite(item.centre) &&
        item.value > item.centre
      );

      const allBelow = run.every(item =>
        Number.isFinite(item.value) &&
        Number.isFinite(item.centre) &&
        item.value < item.centre
      );

      if (allAbove) {
        signals.push(
          "Eight consecutive observations above the centre line"
        );
      }

      if (allBelow) {
        signals.push(
          "Eight consecutive observations below the centre line"
        );
      }
    }

    return {
      ...point,
      signals,
      isSignal: signals.length > 0
    };
  });
}

/**
 * Main analysis pipeline called by app.js.
 */
export function prepareAnalysis(
  scenario,
  displayOptions
) {
  const filtered = filterObservations(
    scenario.observations,
    {
      site: displayOptions.site,
      ward: displayOptions.ward
    }
  );

  let points = combineByDate(filtered);

  points = limitTimeWindow(
    points,
    displayOptions.timeWindow
  );

  points = aggregatePoints(
    points,
    displayOptions.aggregation
  );

  const chartType = selectControlChart(
    displayOptions.spcType,
    scenario.surveillance,
    displayOptions.measure
  );

  if (chartType === "none") {
    points = addDisplayedValues(
      points,
      displayOptions.measure,
      scenario.surveillance.rateMultiplier
    );
  } else {
    points = calculateControlChart(
      points,
      chartType,
      scenario.surveillance.rateMultiplier
    );

    points = detectSignals(points);
  }

  points = addMovingAverage(
    points,
    displayOptions.smoothing
  );

  return {
    points,
    chartType,
    signalCount: points.filter(
      point => point.isSignal
    ).length
  };
}
