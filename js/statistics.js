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
 * Combines all ward records that share the same week. Respiratory-HAI
 * observations carry an `onsetBins` object (community / indeterminate /
 * probableHAI / definiteHAI); these are summed into the combined point
 * so a downstream cutoff step can restrict the reported numerator to a
 * subset of bins without losing the underlying breakdown.
 */
export function combineByDate(observations) {
  const groups = new Map();

  for (const observation of observations) {
    if (!groups.has(observation.date)) {
      groups.set(observation.date, {
        date: observation.date,
        numerator: 0,
        denominator: 0,
        bedDays: 0,
        onsetBins: null,
        apportionmentBins: null,
        numeratorBySubtype: null
      });
    }

    const group = groups.get(observation.date);

    group.numerator += observation.numerator;
    group.denominator += observation.denominator;
    group.bedDays += observation.bedDays ?? 0;

    if (observation.onsetBins) {
      if (!group.onsetBins) {
        group.onsetBins = {
          community: 0,
          indeterminate: 0,
          probableHAI: 0,
          definiteHAI: 0
        };
      }
      group.onsetBins.community += observation.onsetBins.community || 0;
      group.onsetBins.indeterminate +=
        observation.onsetBins.indeterminate || 0;
      group.onsetBins.probableHAI +=
        observation.onsetBins.probableHAI || 0;
      group.onsetBins.definiteHAI +=
        observation.onsetBins.definiteHAI || 0;
    }

    if (observation.apportionmentBins) {
      if (!group.apportionmentBins) {
        group.apportionmentBins = { HOHA: 0, COHA: 0, COCA: 0 };
      }
      group.apportionmentBins.HOHA += observation.apportionmentBins.HOHA || 0;
      group.apportionmentBins.COHA += observation.apportionmentBins.COHA || 0;
      group.apportionmentBins.COCA += observation.apportionmentBins.COCA || 0;
    }

    if (observation.numeratorBySubtype) {
      if (!group.numeratorBySubtype) {
        group.numeratorBySubtype = {};
      }
      for (const [code, count] of Object.entries(
        observation.numeratorBySubtype
      )) {
        group.numeratorBySubtype[code] =
          (group.numeratorBySubtype[code] || 0) + (count || 0);
      }
    }
  }

  return [...groups.values()].sort(
    (first, second) =>
      first.date.localeCompare(second.date)
  );
}

/**
 * For respiratory-HAI series, rewrite each combined point's numerator
 * so it counts only the bins allowed by the chosen cutoff. Non-
 * respiratory series (no `onsetBins`) are returned unchanged.
 *
 * Cutoff values match HAI_CUTOFF_BINS in js/topics.js.
 */
export function applyHaiCutoff(points, cutoff) {
  const binsByCutoff = {
    "all": ["community", "indeterminate", "probableHAI", "definiteHAI"],
    "excluding-community": ["indeterminate", "probableHAI", "definiteHAI"],
    "probable-and-definite": ["probableHAI", "definiteHAI"],
    "definite-only": ["definiteHAI"]
  };

  const bins = binsByCutoff[cutoff] || binsByCutoff["probable-and-definite"];

  return points.map(point => {
    if (!point.onsetBins) return point;

    const numerator = bins.reduce(
      (sum, key) => sum + (point.onsetBins[key] || 0),
      0
    );

    return { ...point, numerator };
  });
}

/**
 * For any topic carrying an `apportionmentBins` breakdown (CDI plus
 * every mandatory bacteraemia topic), rewrite each combined point's
 * numerator so it counts only the apportionment bins allowed by the
 * chosen classification filter -- per the NHS / UKHSA mandatory-
 * surveillance categorisation (HOHA / COHA / COCA). Points without an
 * `apportionmentBins` object are returned unchanged.
 *
 * Classification values match APPORTIONMENT_BINS in js/topics.js.
 */
export function applyApportionmentClassification(points, classification) {
  const binsByClassification = {
    "all":                       ["HOHA", "COHA", "COCA"],
    "trust-apportioned":         ["HOHA", "COHA"],
    "hospital-onset":            ["HOHA"],
    "community-onset-hcai":      ["COHA"],
    "community-onset-community": ["COCA"]
  };

  const bins =
    binsByClassification[classification] ||
    binsByClassification["trust-apportioned"];

  return points.map(point => {
    if (!point.apportionmentBins) return point;

    const numerator = bins.reduce(
      (sum, key) => sum + (point.apportionmentBins[key] || 0),
      0
    );

    return { ...point, numerator };
  });
}

/**
 * Filter each combined point down to a single subtype. When `subtype`
 * is null / "all" / missing, points pass through unchanged. When a
 * specific subtype is chosen, the point's numerator is replaced by the
 * count for that subtype; onsetBins are scaled proportionally so a
 * downstream HAI cutoff continues to make sense.
 *
 * This runs BEFORE applyHaiCutoff so the cutoff step operates on the
 * already-subtype-filtered onsetBins.
 */
export function applySubtypeFilter(points, subtype) {
  if (!subtype || subtype === "all") return points;

  return points.map(point => {
    if (!point.numeratorBySubtype) return point;

    const subtypeCount = point.numeratorBySubtype[subtype] || 0;
    const originalTotal = point.numerator || 0;

    const next = { ...point, numerator: subtypeCount };

    if (point.onsetBins && originalTotal > 0) {
      const ratio = subtypeCount / originalTotal;
      next.onsetBins = {
        community: Math.round(point.onsetBins.community * ratio),
        indeterminate: Math.round(point.onsetBins.indeterminate * ratio),
        probableHAI: Math.round(point.onsetBins.probableHAI * ratio),
        definiteHAI: Math.round(point.onsetBins.definiteHAI * ratio)
      };
    } else if (point.onsetBins) {
      next.onsetBins = {
        community: 0,
        indeterminate: 0,
        probableHAI: 0,
        definiteHAI: 0
      };
    }

    return next;
  });
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

/**
 * Computes an SPC centre line from a baseline period.
 * The same centre is extended forward across every displayed point,
 * so that shifts occurring after the baseline can be detected as
 * departures from a stable phase-1 estimate.
 */
export function computeBaselineCentre(baselinePoints, chartType) {
  if (!baselinePoints || !baselinePoints.length) return 0;

  if (chartType === "p" || chartType === "u") {
    const totalEvents = baselinePoints.reduce(
      (sum, point) => sum + point.numerator,
      0
    );

    const totalOpportunities = baselinePoints.reduce(
      (sum, point) => sum + point.denominator,
      0
    );

    return totalOpportunities > 0
      ? totalEvents / totalOpportunities
      : 0;
  }

  if (chartType === "c") {
    return mean(
      baselinePoints.map(point => point.numerator)
    );
  }

  return 0;
}

/**
 * Applies a fixed baseline centre and per-point control limits to every
 * observation. The centre line is constant; individual limits vary with
 * each point's own denominator (so, for example, a quieter week has
 * wider limits on a p- or u-chart).
 */
export function applyBaselineControlChart(
  points,
  chartType,
  baselineCentre,
  rateMultiplier = 1
) {
  const scale =
    chartType === "p" || chartType === "u"
      ? rateMultiplier
      : 1;

  return points.map(point => {
    const denominator = point.denominator;
    let value = null;
    let lower2 = null;
    let upper2 = null;
    let lower3 = null;
    let upper3 = null;

    if (chartType === "p") {
      if (denominator > 0) {
        const se = Math.sqrt(
          baselineCentre * (1 - baselineCentre) / denominator
        );

        value = point.numerator / denominator;
        lower2 = Math.max(0, baselineCentre - 2 * se);
        upper2 = Math.min(1, baselineCentre + 2 * se);
        lower3 = Math.max(0, baselineCentre - 3 * se);
        upper3 = Math.min(1, baselineCentre + 3 * se);
      }
    } else if (chartType === "u") {
      if (denominator > 0) {
        const se = Math.sqrt(baselineCentre / denominator);

        value = point.numerator / denominator;
        lower2 = Math.max(0, baselineCentre - 2 * se);
        upper2 = baselineCentre + 2 * se;
        lower3 = Math.max(0, baselineCentre - 3 * se);
        upper3 = baselineCentre + 3 * se;
      }
    } else if (chartType === "c") {
      const sd = Math.sqrt(Math.max(0, baselineCentre));

      value = point.numerator;
      lower2 = Math.max(0, baselineCentre - 2 * sd);
      upper2 = baselineCentre + 2 * sd;
      lower3 = Math.max(0, baselineCentre - 3 * sd);
      upper3 = baselineCentre + 3 * sd;
    }

    return {
      ...point,
      value: value !== null ? value * scale : null,
      centre: baselineCentre * scale,
      lower2: lower2 !== null ? lower2 * scale : null,
      upper2: upper2 !== null ? upper2 * scale : null,
      lower3: lower3 !== null ? lower3 * scale : null,
      upper3: upper3 !== null ? upper3 * scale : null
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

  // The SPC chart matches the units the learner has chosen to view,
  // otherwise the plotted values will not change when they switch
  // between count / rate / proportion.
  if (measure === "proportion") return "p";
  if (measure === "count") return "c";
  if (measure === "rate") return "u";

  return surveillance.recommendedChart || "u";
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
 *
 * The pipeline is run over the FULL series so that:
 *   - SPC centre and limits come from a phase-1 baseline slice, not
 *     from whatever window the learner is currently looking at;
 *   - moving-average smoothing has proper lead-in from pre-window data;
 *   - signal-run rules (e.g. eight in a row) reflect the true series.
 *
 * The user's time-window selection only slices the returned series at
 * the very end, once all statistics have been computed.
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

  const combined = combineByDate(filtered);

  const withSubtype = applySubtypeFilter(
    combined,
    displayOptions.subtype
  );

  const withCutoff =
    scenario.surveillance.surveillanceKind === "respiratory-hai"
      ? applyHaiCutoff(
          withSubtype,
          displayOptions.haiCutoff || "probable-and-definite"
        )
      : withSubtype;

  const withClassification =
    scenario.surveillance.apportionmentCategories
      ? applyApportionmentClassification(
          withCutoff,
          displayOptions.apportionment || "trust-apportioned"
        )
      : withCutoff;

  const aggregation = Math.max(
    1,
    Number(displayOptions.aggregation) || 1
  );

  const aggregated = aggregatePoints(withClassification, aggregation);

  const chartType = selectControlChart(
    displayOptions.spcType,
    scenario.surveillance,
    displayOptions.measure
  );

  const rateMultiplier = scenario.surveillance.rateMultiplier;

  // Phase-1 baseline slice: take the earliest N aggregated groups whose
  // total covers roughly the scenario's baseline window in weeks.
  const baselineWeeks =
    scenario.baselineWeeks ||
    Math.floor(combined.length * 0.75);

  const baselineGroupCount = Math.min(
    aggregated.length,
    Math.max(6, Math.floor(baselineWeeks / aggregation))
  );

  const baselinePoints = aggregated.slice(0, baselineGroupCount);

  let processed;

  if (chartType === "none") {
    processed = addDisplayedValues(
      aggregated,
      displayOptions.measure,
      rateMultiplier
    );
  } else {
    const centre = computeBaselineCentre(
      baselinePoints,
      chartType
    );

    processed = applyBaselineControlChart(
      aggregated,
      chartType,
      centre,
      rateMultiplier
    );

    processed = detectSignals(processed);
  }

  processed = addMovingAverage(
    processed,
    displayOptions.smoothing
  );

  // Time window is expressed in weeks; convert to aggregated groups.
  const visibleGroupCount = Math.max(
    1,
    Math.ceil(
      Number(displayOptions.timeWindow) / aggregation
    )
  );

  const visible = limitTimeWindow(processed, visibleGroupCount);

  const lastBaselinePoint =
    baselinePoints[baselinePoints.length - 1];

  return {
    points: visible,
    chartType,
    signalCount: visible.filter(
      point => point.isSignal
    ).length,
    baselineGroupCount,
    baselineEndDate: lastBaselinePoint
      ? lastBaselinePoint.endDate || lastBaselinePoint.date
      : null
  };
}
