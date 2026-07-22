// js/tips.js
//
// Investigation tips are the structured "learning points" shown on the
// reveal panel and included in the exported learning-record HTML.
//
// Every entry has five fields, deliberately short so they read on a
// single reveal panel:
//
//   pattern      What the pattern looks like on the chart.
//   verify       How to verify it using the controls available.
//   differential What else could look similar; how to distinguish them.
//   action       What a competent responder would do (or explicitly
//                not do).
//   falseAlarm   The most common misinterpretation and how to avoid it.
//
// An entry may be either a plain object (fixed text) or a function
// `(scenario) => tipObject` when the wording depends on the topic or
// scenario state (e.g. denominator-change, which reads differently for
// a rate-based topic vs a proportion-based topic).

export const INVESTIGATION_TIPS = {
  "common-cause": {
    pattern:
      "Points scatter randomly on both sides of the centre line, mostly inside the 2-SD limits. Occasional excursions beyond \u00b13\u03c3 do occur by chance, especially at low counts.",
    verify:
      "Try longer aggregation (four-weekly or quarterly) and every ward filter. If no shift appears in any view, the process is stable.",
    differential:
      "A small, sustained real shift can look like common-cause noise on a short series. A run of eight consecutive points on one side of the centre line would flag it before individual points reach \u00b13\u03c3.",
    action:
      "Do not act on isolated points from a stable process. Concentrate on system-level improvement rather than case-by-case chase.",
    falseAlarm:
      "Chasing every point that crosses \u00b12\u03c3. A stable process is expected to breach \u00b12\u03c3 roughly 5 % of the time \u2014 that is not a signal."
  },

  "single-extreme": {
    pattern:
      "One isolated point above the upper 3-SD limit. Other observations sit comfortably inside the limits before and after.",
    verify:
      "Look at the weeks either side of the peak. A genuine change would persist. Filter by ward \u2014 a real cluster usually concentrates in one location.",
    differential:
      "The start of a genuine step or trend. The next few weeks distinguish them: a real shift persists; an artefact resolves.",
    action:
      "Investigate contributory factors for that specific week (audit, ward move, mass screening, a linked group of patients). Do not change the process on the strength of one point.",
    falseAlarm:
      "A single point above +3\u03c3 is expected roughly once in every 370 observations from a stable process even without any change. Weekly charts of common organisms cross that threshold by chance more often than intuition suggests."
  },

  "step-increase": {
    pattern:
      "A sustained upward shift. Look for eight consecutive points on one side of the centre line, and individual excursions beyond \u00b13\u03c3 in the post-change period.",
    verify:
      "Compare the mean of the last ~10 weeks with the baseline period. View the longest available time window so both regimes are visible on the same axis.",
    differential:
      "A gradual trend can look step-like on a short window. Widen the time window to distinguish a sharp shift from a slow drift.",
    action:
      "Investigate what changed around the change point (staffing, admissions, case-mix, IPC practice, procurement). Once the new level is confirmed, recompute limits for the post-change period so future signals are meaningful.",
    falseAlarm:
      "A change in the denominator can mimic a step in counts. Always compare the count and rate views before concluding a real rise has occurred."
  },

  "gradual-trend": {
    pattern:
      "A slow upward drift rather than a step. The run-of-eight rule usually triggers before any individual point breaches \u00b13\u03c3.",
    verify:
      "Apply moving-mean smoothing and view the longest time period. A CUSUM or EWMA chart would detect a drift earlier than a Shewhart chart.",
    differential:
      "Seasonality can produce a gradual-looking rise across half a year. Aggregate to quarterly and compare year-on-year to distinguish drift from a repeating cycle.",
    action:
      "Act before individual points breach \u00b13\u03c3 \u2014 the drift indicates a process moving away from stability. Investigate slow-onset causes (case-mix drift, environmental change, gradual procedural change).",
    falseAlarm:
      "A single very high recent point can pull the eye to a \u201ctrend\u201d that is not really there. Check for a genuine run of consecutive same-side points before calling it."
  },

  "local-outbreak": {
    pattern:
      "At hospital level the signal is diluted across many wards. Filter to the affected ward to reveal a short cluster of unusually high weeks.",
    verify:
      "Change the ward filter one ward at a time. A funnel plot or league table across wards would highlight the outlier directly and is often more informative than trend charts here.",
    differential:
      "Simultaneous clusters across multiple wards imply a trust-wide problem rather than a single-ward outbreak; the whole-hospital chart would then also show a rise.",
    action:
      "Ward-level IPC response \u2014 targeted screening, environmental audit, cohorting review, staff and patient movement review.",
    falseAlarm:
      "A single high week in a ward with a low baseline can look like an outbreak on that ward's chart. Sustained elevation over several weeks is more diagnostic than one point."
  },

  "seasonality": {
    pattern:
      "A repeating higher-and-lower cycle across the year. Fixed limits derived from a whole-year baseline flag predictable peaks as \u201csignals\u201d every year.",
    verify:
      "Aggregate to four-weekly or quarterly and view the longest time period. Compare the same weeks in successive years rather than to a whole-year mean.",
    differential:
      "A single large peak is easy to confuse with an outbreak; a peak in the same season next year distinguishes seasonality from a one-off event.",
    action:
      "Use season-adjusted expectations, or compare to the same period last year rather than to a whole-year mean. Communicate the expected seasonal pattern to non-specialist audiences.",
    falseAlarm:
      "Treating every winter peak as a special-cause signal produces cycles of over-investigation and \u201cimprovement\u201d against expected variation."
  },

  "screening-expansion": {
    pattern:
      "Count of positives rises after the change point, but percentage positive stays broadly stable.",
    verify:
      "Switch Measure between Count and Percentage positive. If count rises while proportion stays flat, more testing \u2014 not more disease \u2014 is driving the change.",
    differential:
      "A genuine rise in prevalence would raise both count and proportion together.",
    action:
      "Do not interpret an increase in cases as an IPC deterioration when it is testing-driven. Once the new testing volume stabilises, recompute limits for the post-change period.",
    falseAlarm:
      "Reporting screening counts alone (without a denominator) makes an ascertainment change indistinguishable from a real rise. This is the single most common misinterpretation of screening data."
  },

  "targeted-screening": {
    pattern:
      "Percentage positive rises after the change point even though the number of patients screened has fallen.",
    verify:
      "Compare Count and Percentage positive side by side. A rise in positivity without an increase in cases usually reflects who is being screened, not how many are colonised.",
    differential:
      "A genuine rise in prevalence among the underlying population would raise both count and proportion.",
    action:
      "Interpret positivity in the context of the screening policy in force. Document the policy change alongside the trend so downstream readers do not misinterpret it.",
    falseAlarm:
      "Percentage-positive reported without an accompanying policy or denominator narrative can be misread as an outbreak signal."
  },

  "denominator-change": scenario => {
    const measures = scenario.surveillance.availableMeasures;
    const isProportion = measures.includes("proportion");
    const rateName = isProportion ? "Percentage positive" : "Rate";
    const denominatorLabel = scenario.surveillance.denominatorLabel;

    return {
      pattern: `Cases fall after the change point, but so does the underlying activity (${denominatorLabel.toLowerCase()}). The ${rateName.toLowerCase()} stays broadly stable.`,
      verify: `Switch Measure between Count and ${rateName}. The denominator subtitle on the chart shows total ${denominatorLabel.toLowerCase()} for the visible period \u2014 look for a step-down aligned with the change point.`,
      differential:
        "A real IPC improvement would reduce the rate as well as the count. A denominator artefact does not.",
      action: `Establish whether the activity change is temporary (winter escalation, ward decant, service transfer) or permanent, and adjust interpretation accordingly. Where possible present cases and ${denominatorLabel.toLowerCase()} together.`,
      falseAlarm: `Publishing a count-based trend without ${denominatorLabel.toLowerCase()} context routinely misclassifies denominator-driven falls as improvements.`
    };
  },

  "reporting-artefact": {
    pattern:
      "The most recent 2\u20133 weeks look unusually low, often with a single unusually high week ~5 weeks earlier where a batch of overdue reports has arrived.",
    verify:
      "Do not treat the recent dip as improvement. Wait for reporting to catch up and, where possible, use report-received dates rather than specimen dates.",
    differential:
      "A genuine sustained improvement would persist as more reports arrive. A batch-report artefact resolves as the data mature.",
    action:
      "Treat the most recent 2\u20133 weeks as provisional. Re-plot the series in a month to see the true level before drawing conclusions.",
    falseAlarm:
      "Announcing a rapid improvement based on the most recent incomplete weeks is a common trap and undermines credibility when the data mature."
  },

  // --- Surveillance-behaviour templates ------------------------------

  "testing-reduction": {
    pattern:
      "Number of patients screened falls at the change point. Count of positives falls in step; percentage positive stays broadly the same or drifts slightly upward.",
    verify:
      "Switch Measure between Count and Percentage positive. Read the denominator subtitle for the drop in patients screened. A rate that is unchanged despite a falling count is the tell.",
    differential:
      "A genuine reduction in transmission would reduce both count and percentage positive together, and would not be accompanied by a fall in screening activity.",
    action:
      "Establish why screening dropped (staffing, resource, policy change, informal practice change). A drop in count without a drop in proportion should not be reported as an IPC success.",
    falseAlarm:
      "Reporting fewer positive screens as a success without noting the fall in denominator masks whether prevalence has changed at all. This is the mechanism behind most \u201cgaming\u201d critiques of screening surveillance."
  },

  "case-definition-change": {
    pattern:
      "A step-down in both count and rate at a discrete point, without any change in underlying activity or denominator.",
    verify:
      "Check the metadata for a case-definition update at the change point. Compare with adjacent trusts or the pre-change trajectory; a step confined to your trust and aligned with a definition change is diagnostic.",
    differential:
      "A real intervention effect would also step down, but usually with a plausible clinical mechanism (bundle introduction, staffing change, environmental improvement).",
    action:
      "Annotate the chart at the definition-change point. Where possible, re-run the pre-change data under the new definition to allow like-for-like comparison. Do not report the step-down as an intervention success.",
    falseAlarm:
      "Reporting a definition-driven step-down as an intervention success is a routine trap when performance data are shared without methodological footnotes."
  },

  "diagnostic-method-change": {
    pattern:
      "A step-up in both count and rate at a discrete date, sustained afterwards. The magnitude is roughly proportional to the sensitivity gain of the new method.",
    verify:
      "Check the microbiology laboratory's method-change log at the change-point date. Compare with historical parallel-testing data if available; ratio of new to old is a direct measure of the artefact.",
    differential:
      "A real outbreak or true step-increase in transmission would usually show clinical correlates (linked cases, ward clustering, common exposures).",
    action:
      "Reset control limits for the post-change period so future signals are meaningful. Do not report the rise as an epidemiological change; describe it as a change in ascertainment.",
    falseAlarm:
      "A switch from culture to PCR typically increases sensitivity by 20\u201340 %. Attributing this to a real rise leads to unnecessary IPC investigation and misdirected effort."
  },

  "ward-closure": scenario => {
    const affected =
      scenario.groundTruth?.affectedWard || "the affected ward";

    return {
      pattern: `Total bed-days fall at the change point (visible in the denominator subtitle). Case counts fall roughly in proportion. Rate stays broadly flat.`,
      verify: `Switch Measure between Count and Rate. Filter by ward \u2014 ${affected}'s activity should go to near zero after the change while other wards look unchanged.`,
      differential:
        "A real IPC improvement would reduce the rate; a ward closure reduces cases only because it reduces exposure and does not change the underlying risk per bed-day.",
      action: `Filter out ${affected} for baseline recalculation, or note the closure period explicitly in reports. Restore ${affected} to the baseline only once activity returns to normal.`,
      falseAlarm:
        "Attributing a trust-level drop in cases to a real reduction when a whole ward is out of service. Denominator context prevents this every time."
    };
  },

  // --- Respiratory-HAI templates ------------------------------------

  "respiratory-community-surge": {
    pattern:
      "Total detections rise sharply at the change point. When the cutoff is set to \u201cAll detections\u201d the surge dominates; switching to \u201cProbable + definite HAI\u201d shows a smaller and slightly-lagged rise as community-acquired admissions incubate on the wards.",
    verify:
      "Switch the HAI cutoff selector between \u201cAll detections\u201d, \u201cExcluding community onset\u201d and \u201cDefinite HAI only\u201d. If the surge is present in \u201cAll detections\u201d but attenuated in \u201cDefinite HAI only\u201d, the driver is community pressure with hospital spill-over rather than in-hospital transmission.",
    differential:
      "A pure nosocomial cluster would show up mainly in the probable and definite HAI bins with little community-onset change. A definition-cutoff artefact would show as a step-change in totals but no change in the underlying bin distribution.",
    action:
      "Coordinate with public-health and community-testing colleagues; response is triaged case-by-case rather than as an in-hospital outbreak. Reinforce admission testing, isolation and staff sickness policies but do not implement a whole-trust IPC response on the strength of community spill-over.",
    falseAlarm:
      "Reading a large \u201cAll detections\u201d peak as evidence of failing hospital IPC when it is really the community wave arriving in hospital. The bin breakdown is the diagnostic tool."
  },

  "respiratory-ward-cluster": scenario => {
    const affected =
      scenario.groundTruth?.affectedWard || "the affected ward";

    return {
      pattern: `At trust level the definite-HAI signal is diluted across many wards. Filter to ${affected} and set the cutoff to \u201cDefinite HAI only\u201d to see the cluster clearly.`,
      verify: `Switch the ward filter through each ward with the cutoff at \u201cDefinite HAI only\u201d. The cluster concentrates on ${affected}. Then switch to \u201cAll detections\u201d \u2014 the ward is no longer distinctive because community-onset cases dilute it.`,
      differential:
        "A community surge would show similar rises in the community-onset bin across all wards. A definition-cutoff artefact would be trust-wide, not ward-specific.",
      action:
        "Ward-level nosocomial outbreak response: environmental audit, staff cohort review, source and contact tracing, admission/transfer restriction as required. Definite-HAI clustering on a single ward is a strong nosocomial signal.",
      falseAlarm:
        "Ruling out a nosocomial cluster from the trust-wide \u201cAll detections\u201d view. Community-onset cases will always dominate; the definite-HAI bins are where the nosocomial signal lives."
    };
  },

  "respiratory-definition-cutoff": {
    pattern:
      "Total detections (\u201cAll detections\u201d cutoff) step down at the change point. Restricting to \u201cDefinite HAI only\u201d shows no change; the probable + definite bins are unchanged. The apparent fall is entirely in the community and indeterminate bins.",
    verify:
      "Cycle the HAI cutoff selector through all four options. A drop that vanishes as you tighten the cutoff \u2014 particularly one that disappears completely at \u201cDefinite HAI only\u201d \u2014 is diagnostic of a definition change rather than a change in transmission.",
    differential:
      "A real reduction in transmission would also reduce the probable and definite bins. A community wave receding would reduce community-onset detections but usually with a lag in the HAI bins too, not a clean step.",
    action:
      "Annotate the chart at the definition-change point. Report both the pre- and post-change definitions and the trend under each. Do not claim an IPC improvement from a definition-driven step-down.",
    falseAlarm:
      "Reporting a definition-driven step-down as an intervention success \u2014 the classic surveillance-behaviour artefact when performance indicators change definition without a methodological footnote."
  }
};

/**
 * Resolve the tip for the current scenario, evaluating any topic-aware
 * function-form entries. Returns null when the template id is not known.
 */
export function resolveInvestigationTip(scenario) {
  const templateId = scenario?.groundTruth?.templateId;
  if (!templateId) return null;

  const entry = INVESTIGATION_TIPS[templateId];
  if (!entry) return null;

  if (typeof entry === "function") {
    return entry(scenario);
  }

  return entry;
}
