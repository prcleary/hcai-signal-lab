# AGENTS.md

Guidance for AI coding agents (and human contributors) working on
**HCAI Signal Lab**. Read this before making changes.

---

## 1. What this app is

HCAI Signal Lab is a browser-based training tool for **healthcare-
associated infection (HCAI) surveillance**. It generates synthetic
weekly time-series data from a fictional NHS trust and asks the
learner to decide whether the pattern they see warrants investigation.
When the learner commits to an answer, the app reveals the underlying
epidemiological or surveillance story that generated the data.

Audience: infection prevention and control (IPC) nurses,
microbiologists, epidemiologists, health-protection consultants,
public-health trainees and quality improvement teams — mostly UK NHS.

Canonical deployment:
[https://prcleary.github.io/hcai-signal-lab/](https://prcleary.github.io/hcai-signal-lab/).

## 2. Core design principles

Preserve these unless the user explicitly overrides them.

1. **Static, zero-dependency, offline-first.** No build step, no
   bundler, no package.json for the client. Pure ES modules loaded
   directly by the browser. No CDNs, no external fonts, no
   analytics, no telemetry, no `fetch`/`XMLHttpRequest` to third
   parties. The app must run identically from `file://`, a USB
   stick, GitHub Pages and an internal SharePoint / IIS.
2. **Deterministic, seeded synthesis.** Every scenario is regenerated
   from a seed via `mulberry32(seed)` in `js/generator.js`. Same
   seed + same code = same series on any device forever. Never
   introduce non-determinism (Date.now(), Math.random(), timers)
   into the generator or statistics pipeline.
3. **Teaching-first fidelity.** Baseline rates and template effects
   are chosen so that signals are pedagogically clean on a
   mid-sized trust (~4,500 bed-days/week). They are not intended
   to be an epidemiological simulator — do not chase perfect
   real-world calibration at the expense of teachability.
4. **UK / NHS terminology and definitions.** All classifications,
   apportionments and cutoffs must match published NHS mandatory
   HCAI surveillance definitions or the UKHSA / ECDC HAI
   definitions. Do not invent categories.
5. **Synthetic data, always.** Never load, ship or reference real
   patient, trust or organisational data. Hospital and ward names
   are randomly generated. The banner "*Fictional hospital —
   synthetic educational data. Do not use this application for
   clinical decision-making.*" must remain prominent.
6. **Client-only persistence.** Learner interpretation notes,
   answers, and past scenarios go in `localStorage` on the user's
   own device. Never introduce any code path that transmits learner
   input off the device.
7. **Accessibility as a first-class concern.** Keyboard-navigable,
   skip-link present, canvas chart described by a screen-reader
   summary, signal markers distinguishable by shape as well as
   colour, WCAG 1.4.11 non-text contrast met.
8. **Reveal only after commitment.** The scenario explanation is
   gated behind a learner answer and a short free-text note. Do
   not remove or weaken this gate — it is the whole pedagogical
   loop.

## 3. Hard constraints (do not break)

- No new runtime dependencies. Anything the browser doesn't ship
  with is a dependency.
- No build tooling on the client path. The repo may add pure
  Node-only tools (tests, static analysis) but they must not be
  required to serve the app.
- Preserve service-worker cache correctness. If you add or rename a
  file that must be available offline, add it to `PRECACHE_URLS` in
  `service-worker.js` **and** bump `CACHE_VERSION`. Failing to bump
  the version leaves returning users on stale caches.
- Preserve SPC pipeline invariants. The full-series analysis in
  `prepareAnalysis` computes centre and limits from the baseline
  slice regardless of the user's display window. Do not compute
  limits from the currently-visible window.
- Never send user text or scenario details off-device. No
  auto-updates, no error-reporting endpoints, no analytics.
- Never commit real names, organisations, patient details, or
  anything resembling real surveillance data.

## 4. Repository layout

```
index.html               App shell. Loads css/app.css and js/app.js as an ES module.
favicon.svg              Also the PWA icon (any + maskable).
manifest.webmanifest     PWA manifest. Clinical-blue theme, en-GB, standalone display.
service-worker.js        Cache-first SW. PRECACHE_URLS + CACHE_VERSION must be kept in sync.
css/app.css              All styling. NHS-inspired palette. No preprocessor.
js/app.js                UI controller. Wires DOM to the analysis and export pipeline.
js/topics.js             Surveillance topics (organism, denominator, baseline rate,
                         recommended chart, subtypes, seasonality, HAI onset bin
                         weights, onset-apportionment weights). Data-only module.
js/templates.js          Scenario templates (id, name, difficulty, category, applies-to).
                         Data-only module.
js/generator.js          Deterministic scenario generator. Uses mulberry32.
js/statistics.js         Aggregation, HAI-cutoff filter, onset-apportionment filter,
                         SPC (c/u/p chart), Nelson rules 1 & 4, signal detection.
js/chart.js              Canvas renderer. Handles smoothing overlay, limits, signals,
                         axis labelling.
js/export.js             PNG / CSV / learning-record HTML exports.
js/storage.js            localStorage schema v4. Keys:
                            hcai-signal-lab.current.v1
                            hcai-signal-lab.history.v1
js/tips.js               Investigation tips shown on the reveal panel.
tests/scenarios.smoke.mjs Node smoke test. No test framework, plain assertions.
.nojekyll                Tell GitHub Pages to serve files literally.
LICENSE                  MIT licence.
README.md                Learner / organiser documentation and glossary.
AGENTS.md                This file.
```

## 5. Domain model (essential vocabulary)

Every change touching data or UI needs these concepts. See the
glossary in `README.md` for definitions.

- **Surveillance kinds** in `topics.js`:
  - `count-per-bed-days` — bacteraemia, CDI.
  - `screening-proportion` — CPE screening.
  - `respiratory-hai` — SARS-CoV-2, influenza, RSV; carries
    `onsetBins` (community / indeterminate / probableHAI /
    definiteHAI). Day cutoffs (1–2 / 3–7 / 8–14 / ≥15) match the
    NHS England healthcare-associated COVID-19 classification
    (CO / HOIHA / HOPHA / HODHA); applied here by analogy to
    influenza and RSV.
  - `device-days` — CAUTI, CLABSI. Rate per 1,000 device-days.
  - `procedure-cohort` — SSI (colorectal, cardiac). Rate as a
    percentage of index procedures.
- **Onset apportionment** (`apportionmentCategories` /
  `apportionmentBins`): HOHA, COHA, COCA. Total healthcare-associated
  (used for the NHS mandatory trust objective) = HOHA + COHA. Applies
  to CDI **and** every mandatory bacteraemia topic (MRSA, MSSA,
  *E. coli*, *Klebsiella*, *P. aeruginosa*). Definitions in the header
  comment of `js/topics.js` and the README glossary; matches the
  UKHSA mandatory-surveillance framework as documented on the
  UKHSA data dashboard metrics documentation. Note: earlier UK
  frameworks used a fourth category COIA — this is not part of the
  current UKHSA framework and is not modelled.
- **HAI onset cutoffs**: `all`, `excluding-community`,
  `probable-and-definite` (default), `definite-only`.
- **SPC charts**: `c` (Poisson count, constant area of opportunity),
  `u` (Poisson rate, varying denominator per period), `p` (binomial
  proportion, varying denominator per period). Auto-select follows
  the plotted measure: proportion→p, count→c, rate→u.
- **Nelson rules used**: rule 1 (any point beyond 3-SD) and rule 4
  as commonly adopted in NHS reporting (eight consecutive points on
  the same side of the centre line). No other rules are implemented;
  adding more should be an explicit user request.
- **Template categories**: `epidemiology` (real disease change) vs.
  `surveillance-behaviour` (change in how data are generated /
  counted). Keeping this distinction visible is a core pedagogical
  point.

## 6. Local development workflow

The user is on **Windows PowerShell 5.1**.

- Chain commands with `;`. Do **not** use `&&`.
- CRLF warnings on `git add` are expected and harmless.
- To serve the app locally for service-worker testing (SW is skipped
  under `file://`), any static server on the repo root works. A
  one-liner Node server is fine.
- Run the smoke test with:
  ```powershell
  node tests/scenarios.smoke.mjs
  ```
  It should print `56916/56916 checks passed` (numbers may grow as
  topics or templates are added — never shrink without justification).
- When editing a file that must be available offline, remember to
  update `PRECACHE_URLS` and bump `CACHE_VERSION` in
  `service-worker.js`.

## 7. Deployment

- Hosted on GitHub Pages at
  [https://prcleary.github.io/hcai-signal-lab/](https://prcleary.github.io/hcai-signal-lab/)
  from the `main` branch of `https://github.com/prcleary/hcai-signal-lab`.
- `.nojekyll` disables Jekyll processing so files are served as-is.
- No CI/CD pipeline; deployment is a plain `git push origin main`.

## 8. Adding new content safely

**New surveillance topic**
1. Add an entry to `SURVEILLANCE_TOPICS` in `js/topics.js` with the
   correct `surveillanceKind`, `baselineRate`, `rateMultiplier` and
   `recommendedChart`. Cite the UK / UKHSA / NHS definition in a
   header comment.
2. Add the topic code to the relevant `TOPIC_GROUPS` array so
   templates pick it up via `appliesTo`.
3. Confirm the generator supports the kind (see
   `js/generator.js`). New kinds require generator work.
4. Update the README glossary if it introduces new terminology.
5. Re-run the smoke test; it should still pass.

**New scenario template**
1. Add an entry to `SCENARIO_TEMPLATES` in `js/templates.js` with
   `id`, `name`, `difficulty`, `category`, `appliesTo`.
2. Implement the template's effect in `js/generator.js` (usually a
   perturbation of the underlying series).
3. Add an entry to `INVESTIGATION_TIPS` in `js/tips.js` with the
   practical questions an IPC team would ask.
4. Add a reveal-narrative branch in the explanation builder.
5. Re-run the smoke test.

**New UI control**
1. Add the element to `index.html` under the correct control group.
2. Wire it up in `js/app.js` (`elements` map, event listener,
   `logAction` call, `updateActionLog`).
3. Make sure it appears in the "Current view" description so
   learners understand what filter is applied.
4. If it filters the numerator, add it to the pipeline in
   `prepareAnalysis` (`js/statistics.js`) — do not filter inside
   the renderer.
5. Preserve keyboard accessibility (native `<select>` / `<input>`
   preferred over ARIA-heavy custom controls).

## 9. Testing and verification

- **Smoke test** — `node tests/scenarios.smoke.mjs`. Iterates every
  topic × every applicable template × several seeds, asserting the
  full pipeline produces a valid, plottable series with matching
  numerators, denominators and signal detection.
- **Manual browser verification** — for any UI change, open the
  hosted or local app, load a scenario, exercise the affected
  control, and confirm the chart summary text updates. Use the
  provided browser-page tooling when available.
- **Offline verification** — start a local static server, load
  the app, confirm SW activation and precache contents, kill the
  server, hard-reload, and confirm the app still runs.

## 10. Style conventions

- Vanilla JavaScript, ES modules, no TypeScript.
- Camel-case for JS identifiers; kebab-case for CSS classes.
- British English in all UI copy and documentation
  ("surveillance", "organisation", "colour", "recognise").
- Prefer named exports over default exports.
- Prefer readable multi-line function calls with argument names in
  comments over long single-line calls with cryptic literals.
- Comments explain **why** and cite NHS / UKHSA / ECDC definitions
  where relevant, not **what** the code does.
- Keep functions single-purpose; the statistics pipeline is a chain
  of small filter steps for a reason.

## 11. Commit conventions

- One logical change per commit. No mixed refactors and feature
  changes.
- Subject line ≤ 72 characters, imperative mood
  ("Add onset-apportionment selector", not "Added" or "Adds").
- Body describes rationale, cites NHS / UKHSA definitions where
  relevant, and lists any verification (smoke test, browser
  behaviour observed).
- Never commit generated exports (learning records, PNGs, CSVs) or
  editor state.

## 12. Things that are out of scope

Reject or push back on requests to:

- Add user accounts, sign-in, or any server-side component.
- Add analytics, telemetry, feature flags, or A/B testing.
- Load fonts, icons, JS or CSS from a CDN.
- Add npm / build tooling to the client.
- Ship real patient or organisational data of any kind.
- Weaken the reveal gate (e.g. show the explanation before the
  learner answers).
- Fabricate NHS classifications not published by UKHSA / NHS.
- Introduce non-determinism into the generator.

If in doubt, ask the user before doing any of the above.

## 13. Interacting with the user

- Windows / PowerShell environment — see §6.
- The user is domain-expert. Prefer concise technical answers to
  hand-holding.
- When making non-trivial changes, verify with the smoke test and
  (where possible) the live browser page before committing.
- Keep commit messages substantive: they are the project changelog.
