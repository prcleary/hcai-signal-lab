# HCAI Signal Lab

An interactive, browser-based training tool for **healthcare-associated
infection (HCAI)** surveillance. Learners are shown weekly time-series
data from a fictional NHS trust and asked to decide whether the pattern
they see warrants investigation. When they commit to an answer the app
reveals the underlying epidemiological or surveillance story that
generated the data.

All data are wholly synthetic. Hospital names, trusts and wards are
randomly generated. The app is intended for teaching only and must not
be used for clinical decision-making.

The application is a pure static site: no build step, no server, no
tracking, no external network calls. It also installs as a Progressive
Web App and works offline.

**Use it here:** [HCAI Signal Lab](https://prcleary.github.io/hcai-signal-lab/)

---

## Table of contents

1. [For learners: how to use the app](#for-learners-how-to-use-the-app)
2. [For workshop organisers](#for-workshop-organisers)
3. [Glossary](#glossary)

---

## For learners: how to use the app

This section walks through a single scenario from start to finish and
explains the epidemiological and NHS terms you will meet along the way.

### 1. Open the app

Open [HCAI Signal Lab](https://prcleary.github.io/hcai-signal-lab/) in
any modern browser (Chrome, Edge, Firefox or Safari). If your organiser
has hosted their own copy on a different web address, use that URL
instead. There is nothing to install and no account to create.

Once loaded, the app can be used entirely **offline** — you can install
it to your home screen or start menu from the browser's "Install app"
menu, or simply keep the tab open. On a return visit it will load from
your device even without a network.

Nothing you type is sent anywhere. Your interpretation notes and past
scenarios are saved in your browser's local storage on this device
only.

### 2. Read the scenario header

At the top of the page you will see:

- **Hospital name** — a fictional NHS trust or hospital, e.g. *South
  Moor District Hospital*.
- **Topic / organism** — the infection under surveillance, e.g. *MSSA
  bacteraemia* or *Clostridioides difficile infection*. This is the
  "what is being counted".
- **Hospital type** — e.g. *Multi-site acute hospital*, *Specialist and
  acute hospital*. Some scenarios rely on this — for example a
  multi-site trust will have several sites to compare.
- **Current view** — a plain-English summary of the location, measure
  and any filters currently applied.

> **HCAI** stands for **healthcare-associated infection** — an
> infection that a patient acquires as a consequence of receiving
> healthcare (see the Glossary).

### 3. Understand the chart

The chart is a **weekly time series**: each point is one week of
surveillance data. The x-axis is time; the y-axis is either a count of
cases or a rate.

Depending on the topic, the y-axis measure will be one of:

- **Count** — the raw number of cases that week.
- **Rate per 10,000 bed-days** — cases divided by the number of
  occupied bed-days that week, multiplied by 10,000. This adjusts for
  how busy the hospital is: two extra cases in a very quiet week means
  something different from two extra cases in a very busy week.
- **Rate per 1,000 device-days** — for device-associated infections
  (catheter-associated UTI, central-line-associated bloodstream
  infection). Denominator is the number of days each device was in
  place, summed across all patients.
- **Percentage of procedures** — for surgical-site infection
  surveillance, the proportion of index procedures followed by an SSI.
- **Percentage positive** — for CPE screening, the fraction of
  screened patients who were positive.

> **Bed-days** is the standard NHS denominator for hospital-onset
> infection: one bed occupied for one day is one bed-day. A ward with
> 20 beds occupied for a whole 7-day week contributes 140 bed-days.

The chart may also show:

- **Centre line** — the mean of the baseline period.
- **2-SD warning limits** — dashed lines two standard deviations from
  the centre. Around 1 in 20 points will land outside these by chance
  alone.
- **3-SD control limits** — dashed lines three standard deviations
  from the centre. Points outside are unlikely to be due to chance —
  they are **signals** worth investigating.
- **Highlighted signals** — coloured markers on points that meet a
  Statistical Process Control (SPC) rule.

### 4. Explore with the controls

The left-hand panel lets you re-slice the same underlying data. You
should treat this like you would a real surveillance dashboard — try
different views before deciding.

**Display**

- **Measure** — switch between count and rate (where both are
  meaningful). Rate is usually more informative when hospital activity
  is changing.
- **Time period** — 6 months, 12 months, 2 years or all data. Longer
  windows help you see trends and seasonality; shorter windows help
  you focus on recent change.
- **Aggregation** — weekly, four-weekly or quarterly. Aggregating
  reduces random noise but hides short bursts.
- **HAI onset cutoff** (respiratory topics only) — restricts the count
  to detections classified as probable / definite hospital-onset
  based on how long after admission the patient tested positive. See
  the Glossary entry for "onset day".
- **Onset apportionment** (CDI + mandatory bacteraemia topics:
  MRSA, MSSA, E. coli, Klebsiella, P. aeruginosa) — filters cases to
  the NHS / UKHSA mandatory onset categories: HOHA (hospital onset,
  healthcare associated), COHA (community onset, healthcare
  associated) or COCA (community onset, community associated). Total
  healthcare-associated (used for the NHS mandatory trust objective)
  = HOHA + COHA. Trying different views can reveal that a signal is
  (or is not) hospital-driven.

**Location**

- **Site** — for multi-site trusts, drill down to one site.
- **Ward or service** — drill down to a single ward. Signals sometimes
  become visible only at ward level.
- **Subtype / variant** — where relevant (SARS-CoV-2 lineage,
  influenza subtype, CPE gene family). Filtering to a single subtype
  can reveal displacement patterns hidden in the total.

**Presentation**

- **Smoothing** — a 3- or 5-period moving mean smooths out
  point-to-point noise. Useful for seeing trends but delays signals
  and can hide short outbreaks.

**Statistical process control (SPC)**

- **Control chart** — choose the chart type or let the app recommend
  one. See the Glossary for c, u and p charts.
- **Show 2-SD / 3-SD limits** — toggle the warning and control lines.
- **Highlight SPC signals** — toggle the coloured signal markers.

### 5. Read the signal summary

Below the chart, expand **Signal summary** to see a plain-English list
of every SPC signal in the current view — for example:

- *Week ending 12 May 2026: value 4.8 above the 3-SD upper limit of 3.6.*
- *Weeks ending 8 Feb – 22 Mar 2026: eight consecutive observations above the centre line.*

Two Nelson-family rules are used:

1. Any single point outside the 3-SD control limits.
2. Eight consecutive points on the same side of the centre line.

### 6. Write your interpretation

Fill in the **Your interpretation** card:

- **Would you investigate now?** — Yes, No, or Uncertain.
- **Interpretation and chart annotations** — a short free-text note
  describing what you noticed, plausible explanations and any
  additional information you would want to gather (e.g. denominator
  changes, testing changes, ward moves, staffing).

Both fields save automatically. The reveal button unlocks once you
have chosen an answer and written at least a short note.

> Good interpretations name the pattern (e.g. *"sustained step
> increase from mid-January"*), offer 2–3 competing explanations
> (real rise vs. denominator change vs. reporting artefact) and list
> the information needed to distinguish them.

### 7. Reveal and reflect

Click **Reveal explanation** to see what actually generated the data.
Each scenario is drawn from a set of templates covering both real
epidemiological change and pure surveillance artefacts:

- Stable common-cause variation (no real change — just noise).
- Isolated extreme observation.
- Sustained step increase.
- Gradual underlying increase.
- Localised ward outbreak.
- Seasonal variation.
- Expansion of screening / change to targeted screening.
- Changing denominator (bed-days or activity).
- Reporting delay or batch reporting.
- Reduced testing (denominator gaming).
- Case-definition or diagnostic-method change.
- Ward closure or decant.
- Community respiratory surge with hospital spill-over.
- Nosocomial respiratory ward cluster.
- HAI definition cutoff change.
- Emergence or displacement of a subtype / variant.
- Care-bundle intervention.
- Procedure case-mix shift (for SSI).

The reveal also includes **investigation tips** — the questions a
practising infection prevention team would ask about this pattern.

### 8. Save a learning record

Use **Save learning record (HTML)** to download a self-contained HTML
file with the chart image, your answer, your notes and the scenario
reveal. Open it in any browser or print to PDF for a portfolio or
supervisor discussion.

You can also save the chart alone as **PNG** or the underlying weekly
values as **CSV** from the chart toolbar.

### 9. Move on to the next scenario

Click **New scenario** (top right) to draw another. Use the
**Difficulty** selector to bias the draw towards *Introductory*,
*Intermediate* or *Advanced* templates, or leave it on *Mixed* for a
realistic mix.

Previously answered scenarios remain in the **Past scenarios** menu on
this device, so you can revisit your interpretation and the reveal at
any time.

### 10. Analysis trail

The collapsed **Analysis trail** at the bottom of the page records
every action you took (view changes, reveal, exports). Use it to
reflect on how many different views you tried before committing to an
answer, and to model rigorous, auditable practice.

---

## For workshop organisers

### Purpose

HCAI Signal Lab is a teaching tool for anyone who reads or produces
HCAI surveillance data: infection prevention and control (IPC) nurses,
consultants in health protection and communicable-disease control,
microbiologists, epidemiologists, public-health trainees, quality
improvement teams and Board-level reviewers.

The learning objectives are:

1. Recognise common-cause vs. special-cause variation on a weekly
   surveillance chart.
2. Distinguish a real epidemiological change from a surveillance
   artefact (denominator changes, case-definition changes, batching,
   testing changes).
3. Read and choose between c-, u- and p-charts, and understand why the
   SPC chart type must match the plotted measure.
4. Apply NHS mandatory HCAI definitions (onset apportionment for
   CDI and mandatory bacteraemia, HAI onset-day classification,
   CPE screening).
5. Practise writing a defensible, brief investigation note before
   revealing the underlying explanation.

### Deploying the app

The app is a static site with no build step. Any of the following
work:

- **Hosted copy**: the canonical build lives at
  [https://prcleary.github.io/hcai-signal-lab/](https://prcleary.github.io/hcai-signal-lab/)
  and is suitable for most workshops.
- **Local, single laptop**: clone or download this repository and open
  `index.html` directly in a browser. The app is fully self-contained.
- **Room without wifi**: put the folder on a USB stick or shared drive
  and open the file. No network required.
- **Self-hosted**: upload the whole folder (preserving structure) to
  any static host. GitHub Pages, Netlify, Cloudflare Pages and
  internal SharePoint / IIS all work. Serve from the folder root so
  that `service-worker.js` is at the origin scope.
- **Offline via a URL**: once a learner has loaded the hosted app
  once, the service worker caches it and it will load offline on
  subsequent visits until you deploy a new version.

The included [`.nojekyll`](.nojekyll) file makes GitHub Pages serve the
folder as-is.

### Running a workshop

Suggested structure for a 90-minute session:

1. **10 min — Framing.** Introduce SPC, the difference between common
   and special cause, and the workflow: *view → interpret → commit →
   reveal*.
2. **10 min — Guided example.** Do one scenario on the shared screen,
   thinking aloud through the controls.
3. **45 min — Individual or pair work.** Learners work through 5–8
   scenarios each. Ask them to write an interpretation *before*
   revealing. Recommend they leave *Difficulty* on *Mixed*.
4. **20 min — Debrief.** Ask each pair to present one scenario using
   their saved learning record (HTML) or a PNG of the chart. Group
   discussion focuses on the interpretation, the artefacts each
   learner considered and the questions they would ask next.
5. **5 min — Wrap-up.** Cover what artefacts look like vs. real
   outbreaks; when to escalate.

### Choosing difficulty

- **Introductory (level 1)** — stable common-cause, isolated extreme
  observations, sustained step increases. Good for first exposure to
  SPC charts.
- **Intermediate (level 2)** — gradual trends, localised outbreaks,
  seasonality, screening changes, denominator changes, reporting
  artefacts, testing reductions.
- **Advanced (level 3)** — case-definition changes, diagnostic method
  changes, ward decants, subtype emergence and displacement,
  respiratory-HAI definition cutoff changes, care-bundle
  interventions, procedure case-mix shifts.

### Facilitator notes on the reveals

Each reveal includes both the underlying template narrative and a
short list of **investigation tips** — the questions a practising IPC
team would ask about that pattern. These are deliberately practical
(not academic) and are a good spring-board for discussion. The
learning-record HTML file bundles them so learners can revisit them.

Templates cover both **epidemiology** (real disease change) and
**surveillance behaviour** (change in how the data are generated or
counted). A key teaching point is that a chart signal does **not**
distinguish these on its own — the interpretation and further
information must.

### Fidelity and limits of the synthetic data

- Baseline rates are broadly aligned with published UK figures but
  rounded to produce visible weekly signals on a mid-sized trust
  (~4,500 bed-days per week). They are illustrative, not
  authoritative.
- NHS mandatory definitions used are current as at the app's release
  date. Onset-apportionment categories (HOHA / COHA / COCA) follow
  the UKHSA data dashboard metrics documentation for MRSA, MSSA,
  *E. coli*, *Klebsiella* spp., *P. aeruginosa* bacteraemia and
  *C. difficile* infection.
- Bed-days, device-days, procedures, screening volumes and case
  counts are generated from a seeded pseudo-random number generator,
  so the same scenario always regenerates identically on any device.
- The scenarios are designed to be pedagogically clean: real
  surveillance data are messier. The app is a teaching aid, not a
  simulator of any real trust or dataset.

### Data protection and privacy

The app has no server. All data are synthetic. Learner interpretation
notes, answers and past scenarios are stored in `localStorage` on the
learner's own device and never transmitted. The app makes no external
network calls of any kind (no CDNs, fonts, analytics or telemetry).

Learners can wipe their own state from the browser's site data /
storage settings.

### Accessibility

- Keyboard navigable throughout, with a visible skip-link to the main
  content.
- The canvas chart is described by a screen-reader summary of the
  number of observations and signals.
- Signal markers use shape as well as colour so users with colour
  vision deficiency can still identify them.
- Colours meet WCAG 1.4.11 non-text contrast (≥3:1) against the
  background.

### Verification and testing

A Node smoke test at [`tests/scenarios.smoke.mjs`](tests/scenarios.smoke.mjs)
generates thousands of scenarios and asserts every one produces a
plottable series, consistent numerators and denominators, and that the
SPC pipeline runs without error.

```
node tests/scenarios.smoke.mjs
```

### Licence

See [`LICENSE`](LICENSE).

---

## Glossary

**Batch reporting** — Cases that occurred over several weeks all
entered into the surveillance system at once, usually because of a
backlog. Produces an artefactual peak on the week of entry.

**Baseline period** — The stable early portion of a series used to
compute the SPC centre line and control limits. The rest of the
series is judged against this baseline. Sometimes called *phase 1* in
SPC terminology.

**Bed-day** — One occupied bed for one day. Standard NHS denominator
for hospital-onset infection surveillance. A ward with 20 beds
occupied every day for a week contributes 140 bed-days.

**c-chart** — SPC chart for a **count** of events, assumed
Poisson-distributed, where the "area of opportunity" (denominator) is
approximately constant. Limits are the centre line ± 3√(centre).
Suits rare-count surveillance like MRSA bacteraemia.

**Case definition** — The formal criteria that decide whether a
patient episode is counted as a case (e.g. a positive stool toxin
plus symptoms for CDI). Changing the case definition changes the
count without any change in underlying disease.

**Case-mix** — The mix of patient or procedure types contributing to
the numerator. Shifting case-mix (e.g. more high-risk cardiac
procedures) can move an SSI rate without any change in surgical
practice.

**CAUTI** — Catheter-associated urinary tract infection. Numerator is
UTI cases in patients with an indwelling urinary catheter; denominator
is catheter-days. Rate reported per 1,000 catheter-days.

**CDI** — *Clostridioides difficile* infection. Reportable under the
NHS mandatory HCAI surveillance framework.

**Apportionment (HOHA / COHA / COCA)** — NHS / UKHSA mandatory
onset-attribution categories used for CDI **and** all mandatory
bacteraemia surveillance (MRSA, MSSA, *E. coli*, *Klebsiella* spp.,
*P. aeruginosa*). Definitions per the UKHSA data-dashboard metrics
documentation and the mandatory HCAI surveillance protocol:

- **HOHA** — Hospital Onset, Healthcare Associated. Specimen date
  the same or more than 3 days after the current admission date
  (day of admission = day 1).
- **COHA** — Community Onset, Healthcare Associated. Not HOHA, and
  the patient was most recently discharged from the same reporting
  trust in the 28 days prior to the specimen date (day 1 = specimen
  date).
- **COCA** — Community Onset, Community Associated. Not HOHA and no
  discharge from the same reporting organisation in the 28 days
  prior.

**Total healthcare-associated** (used for the NHS mandatory
trust-level objective, and still often referred to colloquially as
"trust-apportioned") = HOHA + COHA. Two further administrative
categories ("unknown" and "no information") exist in UKHSA data but
are not modelled here.

**Centre line** — The mean of the baseline period, plotted as a
horizontal line on an SPC chart.

**CLABSI** — Central-line-associated bloodstream infection. Numerator
is bloodstream infections in patients with a central venous line;
denominator is central-line-days. Rate per 1,000 line-days.

**Common-cause variation** — Random, expected week-to-week variation
in a stable process. Not a signal; does not warrant investigation.

**Control chart** — An SPC chart with a centre line and control
limits used to distinguish common-cause from special-cause variation.

**Control limits** — The 3-SD upper and lower lines on an SPC chart.
A point outside them is unlikely to be due to chance alone.

**CPE** — Carbapenemase-producing *Enterobacterales*. A group of
antibiotic-resistant gut bacteria producing enzymes (KPC, OXA-48-like,
NDM, VIM, IMP) that break down carbapenem antibiotics. Reportable and
subject to admission screening in high-risk pathways.

**Decant** — Temporarily moving a ward's patients to another location,
usually for building works or during an outbreak. Changes the
denominator and case-mix of both affected wards.

**Denominator** — The measure of exposure or activity that goes on the
bottom of a rate: bed-days, device-days, procedures or patients
screened.

**Denominator change** — A shift in the volume or definition of the
denominator. Can make a rate rise or fall with no change in the
numerator.

**Denominator gaming** — Reducing the numerator by reducing the
underlying activity (e.g. testing fewer patients) rather than
preventing infections. A pattern the surveillance chart alone cannot
distinguish from real improvement.

**Device-day** — One device (urinary catheter, central line) in place
for one day. Denominator for device-associated infection surveillance.

**Device utilisation ratio** — The fraction of bed-days on which a
device is in place. Used to derive device-days from bed-days.

**ECDC** — European Centre for Disease Prevention and Control.
Publishes the harmonised HAI surveillance definitions used across
Europe and adopted by UKHSA.

**HAI** — Hospital-acquired (or healthcare-associated) infection. In
this app, HAI is used with respiratory topics to mean an infection
first detected several days after admission (see "onset day").

**HCAI** — Healthcare-associated infection. Any infection a patient
acquires as a consequence of receiving healthcare. Includes but is
not limited to hospital-acquired infection.

**HOHA / COHA / COCA** — See *Apportionment*.

**Index procedure** — For SSI surveillance, the operation whose
outcome is being followed up (e.g. the colorectal resection or
cardiac bypass). Denominator for SSI rates is the count of index
procedures.

**IPC** — Infection Prevention and Control. The multidisciplinary
team responsible for HCAI surveillance and prevention in an NHS
trust.

**Local outbreak** — A cluster of cases concentrated in one ward or
service, above what would be expected. Distinguishable in the app by
drilling down to the affected ward — the whole-trust chart may not
show a clear signal.

**Moving mean** — A smoothing filter that averages the current point
with the previous *n*–1 points. Reduces noise but delays detection of
sudden changes.

**MRSA** — Methicillin-resistant *Staphylococcus aureus*. Bacteraemia
is reportable under NHS mandatory HCAI surveillance.

**MSSA** — Methicillin-sensitive *Staphylococcus aureus*. Bacteraemia
is reportable under NHS mandatory HCAI surveillance.

**Nelson rules** — A set of SPC signal rules widely used in
healthcare. This app applies rule 1 (any point outside 3-SD limits)
and rule 4 as commonly adopted in NHS reporting (eight consecutive
points on the same side of the centre line).

**Nosocomial** — Originating in hospital. A nosocomial respiratory
infection is one acquired during a hospital stay rather than in the
community.

**Numerator** — The count of events that goes on top of a rate:
cases, detections, positive screens or SSI events.

**Onset day** — The number of days between hospital admission and the
first positive specimen. For respiratory HAI surveillance the app
uses the NHS England healthcare-associated COVID-19 classification
(Aug 2020, updated Oct 2020), also applied here to influenza and
RSV by analogy:

- **CO — Community Onset** (day 1–2) — very likely acquired before
  admission.
- **HOIHA — Hospital-Onset Indeterminate Healthcare Associated**
  (day 3–7) — cannot confidently classify.
- **HOPHA — Hospital-Onset Probable Healthcare Associated**
  (day 8–14) — likely hospital-acquired.
- **HODHA — Hospital-Onset Definite Healthcare Associated**
  (day 15 or later) — hospital-acquired.

The *HAI onset cutoff* selector lets you choose which bins are
counted.

**p-chart** — SPC chart for a **proportion** (successes / trials),
assumed binomial. Limits vary with the denominator each period.
Suits SSI rates and CPE screening positivity.

**Poisson distribution** — The probability distribution of independent
counts of rare events per unit of opportunity. Basis of the c- and
u-chart limits.

**Procedure cohort** — SSI surveillance approach where the denominator
is the count of index procedures performed and cases are counted
within a follow-up window (30 days, or 90 for implant surgery).

**Progressive Web App (PWA)** — A website that a browser can install
to the device and run offline. HCAI Signal Lab is a PWA; look for
"Install app" in the browser menu.

**Rate** — Numerator ÷ denominator × multiplier (e.g. 10,000
bed-days). Adjusts for exposure.

**Reveal** — In this app, the button that discloses the underlying
generative story of the scenario after the learner has recorded an
interpretation.

**RSV** — Respiratory syncytial virus. A seasonal respiratory
pathogen with winter peaks; can cause nosocomial infection.

**SARS-CoV-2 nosocomial classification** — The NHS England scheme
(Aug 2020, updated Oct 2020) for classifying inpatient COVID-19
detections by onset day into CO / HOIHA / HOPHA / HODHA — see
*Onset day*. Applied here by analogy to influenza and RSV; not a
UKHSA-defined classification for those organisms.

**Screening proportion** — Positive screens ÷ patients screened,
expressed as a percentage. Used for CPE surveillance.

**Seasonality** — A repeating annual pattern (e.g. winter peaks for
respiratory viruses; a subtle winter CDI peak; summer *E. coli*
peak). The app models seasonality for respiratory topics and can
generate seasonal templates for CDI and *E. coli*.

**Signal** — A point (or run of points) that meets an SPC rule and is
therefore unlikely to be common-cause variation.

**Site** — A hospital site within an NHS trust (e.g. "Riverside
Hospital"). Some scenarios are multi-site.

**Smoothing** — Applying a moving mean to reduce noise. Trades
sensitivity to short signals for a clearer view of longer trends.

**Special-cause variation** — Variation caused by an identifiable
change (an outbreak, an intervention, a reporting shift). What SPC
rules are designed to detect.

**SPC** — Statistical Process Control. A family of methods for
distinguishing signal from noise in a time series of measurements
from a repeatable process.

**SSI** — Surgical-site infection. Reportable under NHS mandatory
surveillance for orthopaedic implant surgery, and locally common for
colorectal and cardiac surgery.

**Subtype / variant** — A finer classification within an organism:
CPE gene family (KPC, OXA-48-like, NDM, VIM, IMP), SARS-CoV-2
lineage, influenza subtype. Filtering to a single subtype can reveal
displacement patterns hidden in the total count.

**Trust** — An NHS body operating one or more hospitals. The
denominator context for most NHS mandatory HCAI reporting.

**Trust-apportioned** — See *Apportionment*. In the current UKHSA
framework this cohort is more precisely called *total
healthcare-associated* (HOHA + COHA); "trust-apportioned" remains in
common NHS usage.

**u-chart** — SPC chart for a **rate** (count per unit of opportunity)
assumed Poisson. Limits vary with the denominator each period,
widening in weeks with fewer patients at risk. Recommended default
for most bacteraemia and CDI rates.

**UKHSA** — UK Health Security Agency. Publishes the mandatory HCAI
surveillance definitions used by NHS trusts.

**Ward closure** — Temporarily closing a ward to admissions (often
during an outbreak). Reduces both the numerator and the denominator
for that ward.

**Warning limits** — The 2-SD upper and lower lines on an SPC chart.
About 5 % of points will fall outside them by chance alone; they are
advisory, not a signal on their own.

---

*HCAI Signal Lab uses wholly synthetic data and fictional
organisations. Do not use this application for clinical
decision-making.*
