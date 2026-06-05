'use strict';

// status-dashboard.js
// Displays the current software factory state by fetching all open issues once
// and deriving PRD/TASK/Blocked sections from label names.
//
// Usage: node status-dashboard.js

const { execFileSync } = require('node:child_process');

function defaultFetcher() {
  const stdout = execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--state',
      'open',
      '--json',
      'number,title,labels,comments,body',
      '--limit',
      '200',
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(stdout);
}

// Returns the remainder of `line` after `prefix` (trimmed), or `null` when
// `line` does not start with `prefix`. Centralises the "match-and-strip" step
// the porcelain parser applies to each known key line, so the prefix string is
// stated once per key and the parse loop reads as a sequence of declarations.
function stripPrefix(line, prefix) {
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : null;
}

// Parses the stdout of `git worktree list --porcelain` into an array of
// `{ path, branch }` records, one per worktree block. Porcelain blocks are
// separated by a blank line; each block carries a `worktree <path>` line, a
// `HEAD <sha>` line, and EITHER a `branch refs/heads/<name>` line OR a
// `detached` line. `path` is the value after `worktree `; `branch` is the
// `<name>` after `branch refs/heads/` (the `refs/heads/` prefix stripped), or
// `null` for a detached HEAD (no `branch` line). Pure: no I/O. Leading/
// trailing whitespace and a trailing blank line (git emits one) are tolerated
// by splitting on blank-line boundaries and dropping empty blocks. A non-empty
// block that carries no `worktree <path>` line is also dropped (it is not a
// real worktree), so the contract is one record per REAL worktree — every
// returned record has a non-null `path`.
function parseWorktreePorcelain(stdout) {
  return stdout
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => block.trim() !== '')
    .map((block) => {
      // Local named `worktreePath` rather than the bare `path` so the variable
      // is self-describing and matches the file's descriptive naming (and would
      // not collide with a future `require('node:path')` — not imported today).
      // The RECORD KEY stays `path` — the public contract consumed by
      // `renderStaleWorktreesSection` and the injected fetcher seam.
      let worktreePath = null;
      let branch = null;
      for (const line of block.split('\n')) {
        const linePath = stripPrefix(line, 'worktree ');
        if (linePath !== null) worktreePath = linePath;
        const lineBranch = stripPrefix(line, 'branch refs/heads/');
        if (lineBranch !== null) branch = lineBranch;
      }
      return { path: worktreePath, branch };
    })
    // Drop path-less blocks: a non-empty block with no `worktree <path>` line
    // is not a real worktree (malformed/stray porcelain), so its `path` stays
    // null. The parser's contract is "one record per REAL worktree", so these
    // are filtered out rather than surfaced as `{ path: null, ... }`.
    .filter((record) => record.path !== null);
}

// I/O seam mirroring `defaultFetcher`: shells out to git for the porcelain
// worktree listing and hands the raw stdout to the pure parser. Like
// `defaultFetcher` this performs I/O and is not unit-tested directly — the
// testable logic lives in `parseWorktreePorcelain` (pure) and the renderer
// reached via the injected seam in `runDashboard`.
function defaultWorktreeFetcher() {
  const stdout = execFileSync(
    'git',
    ['worktree', 'list', '--porcelain'],
    { encoding: 'utf8' },
  );
  return parseWorktreePorcelain(stdout);
}

const PRD_STATES = ['needs-triage', 'in-backlog'];

// In-flight states come FIRST so that, in defensive multi-label cases (a TASK
// accidentally carrying both an in-flight and a ready label), `taskState` —
// which returns the first match — resolves to the in-flight state. This keeps
// the `Currently in flight` pin's per-line label and the `TASKs by parent PRD`
// tree's per-node label agreeing on the same state for the same TASK. In
// well-formed data (single state label per TASK) the order is observationally
// inert.
const TASK_STATES = [
  'ai-in-progress',
  'human-in-progress',
  'in-code-review',
  'ai-ready',
  'human-ready',
];

const IN_FLIGHT_STATES = ['ai-in-progress', 'human-in-progress', 'in-code-review'];

function hasLabel(issue, name) {
  return issue.labels.some((l) => l.name === name);
}

// Returns every `#N` integer mentioned in free prose, in input order. Shared
// across the parent-PRD lookup, the blocker-dependency lookup, and the
// `Created child TASKs:` comment parser — all three answer "what `#N`
// references appear in this string?". Returns `[]` for empty or null input.
function parseHashRefs(text) {
  if (!text) return [];
  return [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

// Returns the prose under a `## <heading>` section of an issue body, stopping
// at the next `## ` heading or end-of-body. Returns `''` when the heading is
// absent. The heading argument is interpolated into a regex; any regex
// metacharacters in it are escaped defensively so callers can pass headings
// like `Blockers / Dependencies` without worrying about the `/`. See the
// inline note below for the line-boundary anchoring detail.
function extractBodySection(body, heading) {
  if (!body) return '';
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `(?:^|\n)` anchors the heading at a line boundary (start-of-body or
  // immediately after a `\n`); this rejects inline occurrences like
  // `` `## Parent PRD` `` embedded in prose. The group is non-capturing so
  // `m[1]` still yields the section body.
  const re = new RegExp('(?:^|\\n)## ' + escaped + '([\\s\\S]*?)(?=\\n## |$)');
  const m = body.match(re);
  return m ? m[1] : '';
}

// Returns the parent PRD number declared in the issue body's `## Parent PRD`
// section, or `null` when the section is missing or contains no `#N`.
function parentPrdNumber(issue) {
  const refs = parseHashRefs(extractBodySection(issue.body, 'Parent PRD'));
  return refs.length > 0 ? refs[0] : null;
}

// Returns every `#N` blocker number declared in the issue body's
// `## Blockers / Dependencies` section, in input order. Returns `[]` when the
// section is missing or contains no `#N` references.
function blockerNumbers(issue) {
  return parseHashRefs(extractBodySection(issue.body, 'Blockers / Dependencies'));
}

// Returns the first TASK state label found on the issue, in TASK_STATES
// priority order, or `null` when no TASK state label is present.
function taskState(issue) {
  return TASK_STATES.find((s) => hasLabel(issue, s)) || null;
}

// Returns the per-node bracket label used inside `[...]` when rendering a TASK
// as `#N [<label>] <title>` in the `Currently in flight` pin and the
// `TASKs by parent PRD` tree. Composes the TASK's state with the cross-cutting
// `blocked` label: a `blocked`-labeled TASK appends `, blocked` after its
// state (e.g. `ai-ready, blocked`). When no TASK state label is present the
// state falls back to `no-state`, matching the previous tree behaviour. The
// `Blocked` section intentionally does NOT use this helper — it lists blocked
// issues without state annotation.
//
// The `'no-state'` fallback is reachable only from `renderTreeNode` — the
// tree section iterates ALL parented/orphan TASKs regardless of whether they
// carry a state label, so a TASK with no state label still needs a printable
// bracket. It is NOT reachable from `renderCurrentlyInFlightSection`, which
// filters upstream to TASKs that carry at least one in-flight state label
// (so `taskState` always resolves to a real state for those callers). The
// asymmetry is intentional defensive scaffolding for the tree path.
function taskNodeLabel(issue) {
  const state = taskState(issue) || 'no-state';
  return hasLabel(issue, 'blocked') ? `${state}, blocked` : state;
}

// Builds the dependency graph over the open-issues input.
//
// `byNumber` is a Map from issue number to the issue object (covers every
// issue in the input, PRDs and TASKs alike).
//
// `liveBlockers` is a Map from a TASK's number to an array of its LIVE
// blocker numbers, in input order. A blocker is "live" when the referenced
// `#N` resolves to an open issue that is not labeled `cancelled`:
// - Closed targets (not in `byNumber`) → silently ignored.
// - Open targets labeled `cancelled` → silently ignored (treated as closed).
// - Unresolvable `#N` (same as closed) → silently ignored.
// - Open PRD target → live blocker.
// - Open TASK target → live blocker.
//
// Only TASKs (issues with the `task` label) get an entry in `liveBlockers`.
// TASKs with no live blockers map to an empty array.
function buildDependencyGraph(issues) {
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  const liveBlockers = new Map();

  for (const issue of issues) {
    if (!hasLabel(issue, 'task')) continue;
    const live = [];
    for (const ref of blockerNumbers(issue)) {
      const target = byNumber.get(ref);
      if (!target) continue;
      if (hasLabel(target, 'cancelled')) continue;
      live.push(ref);
    }
    liveBlockers.set(issue.number, live);
  }

  return { byNumber, liveBlockers };
}

// Renders a "by state" section: a header followed by, for each state that has
// any matching issue, a `state:` line, one formatted line per match, and a
// trailing blank line. States with no matches are silently skipped.
//
// Cross-section spacing contract: this function emits only the per-state
// trailing `\n` — no extra footer after the last block. The next section's
// header begins with `=== ... ===\n\n`, so the visible blank line between
// sections is the previous section's trailing `\n` plus the next header's
// own blank. Adding an extra `\n` here would double-space adjacent sections.
function renderByStateSection({ header, states, matchesFor, formatLine }) {
  let out = `=== ${header} ===\n\n`;
  for (const state of states) {
    const matches = matchesFor(state);
    if (matches.length === 0) continue;
    out += `${state}:\n`;
    for (const m of matches) {
      out += `${formatLine(m)}\n`;
    }
    out += '\n';
  }
  return out;
}

// Bundles the cross-cutting graph context the dashboard renderers and the
// `suggestNext` cascade all need: issue lookup, live-blocker adjacency,
// per-TASK subtree containment, and the set of cycle participants. `cycles`
// is the raw output of `detectCycles` (an array of cycle arrays) because the
// `Cycles detected` section renders them directly; everything else consumes
// the derived `cycleNodes` set. Frozen so callers cannot mutate the shared
// context — strict-mode mutation attempts throw `TypeError`.
function buildGraph(issues) {
  const { byNumber, liveBlockers } = buildDependencyGraph(issues);
  const cycles = detectCycles(liveBlockers);
  const cycleNodes = new Set(cycles.flat());
  const subtreeOf = buildSubtreeOf(issues, byNumber, cycleNodes);
  return Object.freeze({ byNumber, liveBlockers, subtreeOf, cycleNodes, cycles });
}

function runDashboard({
  fetcher = defaultFetcher,
  worktreeFetcher = defaultWorktreeFetcher,
} = {}) {
  const issues = fetcher();
  const graph = buildGraph(issues);
  const { cycles } = graph;

  // The open-issue number set is the authoritative liveness signal for stale
  // worktrees (per ADR-011: a worktree branch's `<N>` absent from the open set
  // ⇒ the issue is closed/merged ⇒ the worktree is stale). Computed once from
  // the already-fetched issues — no extra `gh` call.
  const openNumbers = new Set(issues.map((i) => i.number));

  let output = '';

  output += renderCurrentlyInFlightSection(issues);

  output += renderByStateSection({
    header: 'PRDs by state',
    states: PRD_STATES,
    matchesFor: (state) =>
      issues.filter((i) => hasLabel(i, 'prd') && hasLabel(i, state)),
    formatLine: (i) => `  #${i.number} ${i.title}`,
  });

  output += renderTasksByParentPrdSection(issues, graph);

  output += renderCyclesDetectedSection(cycles);

  output += renderBlockedSection(issues);

  output += renderPrdsReadyToCloseSection(issues);

  // Stale worktrees go here — AFTER `renderPrdsReadyToCloseSection` and BEFORE
  // the trailing suggestion — so the suggestion's "free blank line" invariant
  // holds either way: when this section is non-empty it ends in `\n\n` (its
  // per-item trailing blank), supplying the blank line above the suggestion;
  // when it is empty (`''`) the always-emitted `renderBlockedSection` above
  // still guarantees the `\n\n`. The spacing contract is preserved in both
  // cases.
  output += renderStaleWorktreesSection(worktreeFetcher(), openNumbers);

  // Trailing one-line suggestion. The last NON-EMPTY preceding section
  // ends in `\n\n` (its per-row `\n` plus a blank-line `\n`) — so the
  // blank line above the suggestion is provided "for free" and no leading
  // `\n` is needed here. `renderBlockedSection` always emits, which keeps
  // the invariant intact even when `renderCyclesDetectedSection` /
  // `renderPrdsReadyToCloseSection` return `''`. The sentence itself
  // ends in a single `\n`.
  output += renderSuggestionSentence(suggestNext(issues, graph));

  return output;
}

// Renders the PRDs-ready-to-close section: for each in-progress PRD whose
// "Created child TASKs:" comment lists only TASK numbers that are no longer
// present in the open-issues input (i.e. all closed), emits a qualifying
// block. The header is printed once, before the first qualifier; if no PRD
// qualifies the section is omitted entirely (no header, no trailing blank
// line). PRDs missing the comment, or with a comment containing no `#N`
// references, are silently skipped.
function renderPrdsReadyToCloseSection(issues) {
  const inProgressPrds = issues.filter(
    (i) => hasLabel(i, 'prd') && hasLabel(i, 'in-progress'),
  );
  if (inProgressPrds.length === 0) return '';

  const openNumbers = new Set(issues.map((i) => i.number));

  let out = '';
  let headerPrinted = false;

  for (const prd of inProgressPrds) {
    const comment = (prd.comments || []).find((c) =>
      c.body.startsWith('Created child TASKs:'),
    );
    if (!comment) continue;

    const childNumbers = parseHashRefs(comment.body);
    if (childNumbers.length === 0) continue;

    const allClosed = childNumbers.every((n) => !openNumbers.has(n));
    if (!allClosed) continue;

    if (!headerPrinted) {
      out += '=== PRDs ready to close ===\n\n';
      headerPrinted = true;
    }
    out += `  #${prd.number} ${prd.title}\n`;
    out += '    ✓ all TASKs closed — ready to close\n';
    out += '\n';
  }

  return out;
}

// Renders the Stale worktrees section: surfaces git worktrees whose branch
// follows the `<N>-<slug>` naming convention but whose `<N>` is NOT among the
// currently-open issue numbers — i.e. the issue the worktree was created for
// has since been closed/merged, leaving the worktree orphaned on disk. The
// header is printed once, before the first stale worktree; if none qualifies
// the section is omitted entirely (no header, no trailing blank line). For
// each stale worktree a two-line block is emitted (`  #<N> <branch>` then the
// indented `git worktree remove <path>` cleanup command), followed by a blank
// line — mirroring `renderPrdsReadyToCloseSection`'s spacing contract.
//
// DETECT-AND-SURFACE ONLY: this is a pure function. It returns the
// `git worktree remove` command as text for the operator to run; it never
// spawns git, removes anything, or performs any I/O. Per ADR-010 the actual
// removal stays a human-gated step.
function renderStaleWorktreesSection(worktrees, openNumbers) {
  let out = '';
  let headerPrinted = false;

  for (const { path: worktreePath, branch } of worktrees) {
    const match = /^(\d+)-.+/.exec(branch);
    if (!match) continue;

    const number = Number(match[1]);
    if (openNumbers.has(number)) continue;

    if (!headerPrinted) {
      out += '=== Stale worktrees ===\n\n';
      headerPrinted = true;
    }
    out += `  #${number} ${branch}\n`;
    out += `    git worktree remove ${worktreePath}\n`;
    out += '\n';
  }

  return out;
}

// Renders the Currently in flight section: a header followed by either one
// `  #<number> [<label>] <title>` line per TASK whose labels include any of
// the three in-flight states (input order preserved) or a single `(none)`
// line when no TASK is in flight. A trailing blank line always closes the
// section. The bracket label is produced by `taskNodeLabel(issue)` — the
// TASK's state, plus `, blocked` when the cross-cutting `blocked` label is
// also present (consistent with the tree's per-node format).
//
// In well-formed data every in-flight TASK carries exactly one state label,
// so the per-node label resolution is unambiguous and the `TASK_STATES`
// priority order is observationally inert. For the defensive multi-label
// case (a TASK accidentally carrying more than one state label) the
// resolution rule is `TASK_STATES` priority order — and because in-flight
// states are listed first in `TASK_STATES`, an in-flight label wins over a
// concurrent ready label, matching what users would expect from a TASK that
// is visibly here in the in-flight pin.
function renderCurrentlyInFlightSection(issues) {
  const inFlight = issues.filter(
    (i) => hasLabel(i, 'task') && IN_FLIGHT_STATES.some((s) => hasLabel(i, s)),
  );
  const body =
    inFlight.length > 0
      ? inFlight
          .map((i) => `  #${i.number} [${taskNodeLabel(i)}] ${i.title}\n`)
          .join('')
      : '(none)\n';
  return `=== Currently in flight ===\n\n${body}\n`;
}

// Renders the Blocked section: a header followed by either one indented
// `  #<number> <title>` line per blocked issue (input order preserved) or a
// single `(none)` line when no issue carries the `blocked` label. A trailing
// blank line always closes the section. The `blocked` filter is intentionally
// kind-agnostic — both PRDs and TASKs can be blocked simultaneously.
function renderBlockedSection(issues) {
  const blocked = issues.filter((i) => hasLabel(i, 'blocked'));
  const body =
    blocked.length > 0
      ? blocked.map((i) => `  #${i.number} ${i.title}\n`).join('')
      : '(none)\n';
  return `=== Blocked ===\n\n${body}\n`;
}

// Detects every elementary cycle in the TASK-to-TASK dependency graph
// derived from `liveBlockers`. Edges point in the dependency direction
// (dependent → blocker): TASK A's entry in `liveBlockers` lists the
// blockers A waits on, so for each live blocker B we follow A → B. The set
// of TASK nodes is `liveBlockers.keys()` — every TASK has an entry there
// (possibly empty). Blocker references to non-TASK nodes (PRDs, closed
// issues) are filtered out: cycles can only form among TASKs.
//
// Returns an array of cycles. Each cycle is itself an array of TASK numbers
// in dependency-traversal order, rotated to start at the lowest-numbered
// node in the cycle and CLOSED by repeating the start node at the end
// (e.g. `[50, 51, 50]` for a 2-node cycle, `[50, 50]` for a self-loop).
// Cycles are sorted by their starting (lowest) node ascending so the output
// is deterministic.
//
// Algorithm: a DFS from every candidate start node `s` that follows edges
// in the dependency direction; when the DFS re-encounters `s` via a
// back-edge it records the path. Each distinct cycle is canonicalized
// (rotated to start at its lowest member) before being added to a dedupe
// map keyed by the canonical sequence. Fine for the dashboard's
// tens-of-TASKs scale.
function detectCycles(liveBlockers) {
  const taskNodes = new Set(liveBlockers.keys());
  const canonical = new Map(); // key -> cycle array (rotated + closed)
  const path = [];
  const onPath = new Set();

  function dfs(start, current) {
    path.push(current);
    onPath.add(current);
    for (const next of liveBlockers.get(current) || []) {
      if (!taskNodes.has(next)) continue;
      if (next === start) {
        // Canonicalize the path (rotate so it starts at its lowest member,
        // append start to close the chain) and store it keyed by its
        // stringified form, deduping equivalent rotations of the same
        // elementary cycle.
        let minIdx = 0;
        for (let i = 1; i < path.length; i++) {
          if (path[i] < path[minIdx]) minIdx = i;
        }
        const rotated = [...path.slice(minIdx), ...path.slice(0, minIdx)];
        rotated.push(rotated[0]);
        const key = rotated.join(',');
        if (!canonical.has(key)) canonical.set(key, rotated);
        continue;
      }
      if (onPath.has(next)) continue;
      dfs(start, next);
    }
    path.pop();
    onPath.delete(current);
  }

  for (const start of taskNodes) {
    dfs(start, start);
  }

  return [...canonical.values()].sort((a, b) => a[0] - b[0]);
}

// Renders the `Cycles detected` section: a header followed by one
// `  #A → #B → ... → #A\n` line per elementary cycle (in the order returned
// by `detectCycles` — lowest start-node ascending). The arrow is the Unicode
// right-arrow (U+2192). A trailing blank line closes the section. Returns
// `''` (no header, no blank line) when there are no cycles, which omits the
// section entirely from the dashboard.
function renderCyclesDetectedSection(cycles) {
  if (cycles.length === 0) return '';
  let out = '=== Cycles detected ===\n\n';
  for (const cycle of cycles) {
    out += '  ' + cycle.map((n) => `#${n}`).join(' → ') + '\n';
  }
  out += '\n';
  return out;
}

// Renders the TASKs-by-parent-PRD section: groups every open TASK by its
// parent PRD (when present in the input) or as an "orphan" (no
// `## Parent PRD`, or parent not in the input), and emits one ASCII
// dependency subtree per PRD (sorted by ascending PRD number) followed by a
// dedicated `--- Unparented TASKs ---` subtree containing the orphans (when
// any). Each subtree is headed by `--- PRD #N: title ---` (or
// `--- Unparented TASKs ---` for orphans) and laid out using `├── `, `└── `,
// `│   `, and `    ` indentation, with per-node format
// `#N [<label>] title` where `<label>` is the state, optionally suffixed by
// `, blocked` when the cross-cutting `blocked` label is present.
//
// A TASK's parent in the tree is its LOWEST-numbered live blocker that is
// also in the same subtree's task set; TASKs with no in-subtree blocker are
// roots. Diamonds (multi-blocked TASKs) appear exactly once with the other
// in-subtree blockers surfaced via an `(also blocked by ...)` annotation.
// Children are rendered in input order, which makes the snapshot
// deterministic. Cross-subtree blocker edges (one TASK blocked by another
// TASK in a different subtree — parented-vs-parented, or parented-vs-orphan)
// contribute no tree edge; instead they are surfaced via a per-node
// `(blocked by #M under PRD #X)` annotation (or `(blocked by #M, unparented)`
// when the blocker itself is an orphan). PRD blockers are not surfaced in
// the tree.
//
// TASKs that participate in ANY cycle (per `cycleNodes`) are excluded from
// the section entirely — they are neither roots, nor children, nor surfaced
// via annotations. They only appear in the `Cycles detected` section. This
// exclusion also makes `renderTreeNode`'s recursion safe by construction
// (the remaining graph is acyclic).
//
// Section is omitted entirely when there are no open TASKs at all (after
// excluding cycle participants). The Unparented subtree is itself omitted
// when there are no orphans.
function renderTasksByParentPrdSection(issues, graph) {
  const { byNumber, subtreeOf, cycleNodes } = graph;
  const tasks = issues.filter(
    (i) => hasLabel(i, 'task') && !cycleNodes.has(i.number),
  );
  if (tasks.length === 0) return '';

  // Bucketing consults `subtreeOf` directly so the parented-vs-orphan
  // predicate lives in exactly one place (`buildSubtreeOf`). Every task in
  // `tasks` has an entry in `subtreeOf` by construction: both are derived
  // from the same `hasLabel(i, 'task') && !cycleNodes.has(i.number)` filter.
  const tasksByPrd = new Map();
  const orphans = [];
  for (const task of tasks) {
    const prdNumber = subtreeOf.get(task.number);
    if (prdNumber === null) {
      orphans.push(task);
    } else {
      if (!tasksByPrd.has(prdNumber)) tasksByPrd.set(prdNumber, []);
      tasksByPrd.get(prdNumber).push(task);
    }
  }

  let out = '=== TASKs by parent PRD ===\n\n';

  const sortedPrdNumbers = [...tasksByPrd.keys()].sort((a, b) => a - b);
  for (const prdNumber of sortedPrdNumbers) {
    const prd = byNumber.get(prdNumber);
    const prdTasks = tasksByPrd.get(prdNumber);
    out += renderSubtree(`--- PRD #${prdNumber}: ${prd.title} ---`, prdTasks, graph);
  }

  if (orphans.length > 0) {
    out += renderSubtree('--- Unparented TASKs ---', orphans, graph);
  }

  return out;
}

// Builds the `subtreeOf` map: for every non-cycle open TASK, records its
// containing subtree as either a PRD number (when the task declares a parent
// PRD that exists in the input) or `null` (orphan — no `## Parent PRD` body
// section, or parent not in the input). Cycle participants are excluded from
// the map because `renderTasksByParentPrdSection` excludes them from the tree
// entirely; nothing downstream looks them up. Pure: no I/O, no mutation of
// inputs.
function buildSubtreeOf(issues, byNumber, cycleNodes) {
  const subtreeOf = new Map();
  for (const issue of issues) {
    if (!hasLabel(issue, 'task')) continue;
    if (cycleNodes.has(issue.number)) continue;
    const prdNumber = parentPrdNumber(issue);
    const containing =
      prdNumber !== null && byNumber.has(prdNumber) ? prdNumber : null;
    subtreeOf.set(issue.number, containing);
  }
  return subtreeOf;
}

// Splits a task's blocker list into two mutually exclusive buckets keyed by
// `taskNumbers` membership, walking the blocker list exactly once. Pure: no
// I/O, no mutation of inputs. Bucket order is input order — callers that need
// a specific sort apply it themselves (e.g. `sortedInSubtreeBlockers` sorts
// `inSubtree` ascending; `crossSubtreeAnnotation` does its own further
// filtering + sort on `crossSubtree`). Centralises the `taskNumbers.has(b)`
// decision so the two consumers cannot drift in semantics.
function partitionBlockers(blockers, taskNumbers) {
  const inSubtree = [];
  const crossSubtree = [];
  for (const b of blockers) {
    if (taskNumbers.has(b)) {
      inSubtree.push(b);
    } else {
      crossSubtree.push(b);
    }
  }
  return { inSubtree, crossSubtree };
}

// Sorts the already-partitioned in-subtree blockers ascending; this ordering
// is what makes the diamond-placement (lowest-numbered parent) and the
// annotation-order (ascending) steps deterministic, regardless of the order
// the blockers appear in the issue body. The cross-subtree partitioning is
// done upstream by `partitionBlockers`.
function sortedInSubtreeBlockers(inSubtree) {
  return [...inSubtree].sort((a, b) => a - b);
}

// Returns the `(also blocked by #M[, #L]...)` annotation suffix (with leading
// space) when a task has more than one in-subtree blocker, listing the
// blockers that are NOT the chosen tree parent in ascending order. Returns
// `''` when the task has zero or one in-subtree blocker.
function otherBlockersAnnotation(sortedBlockers) {
  if (sortedBlockers.length <= 1) return '';
  const others = sortedBlockers.slice(1);
  return ` (also blocked by ${others.map((n) => `#${n}`).join(', ')})`;
}

// Returns the cross-subtree annotation suffix (with leading space) for a task,
// composed of one ` (blocked by #M under PRD #X)` (or
// ` (blocked by #M, unparented)` when the blocker is itself an orphan) phrase
// per cross-subtree TASK blocker, listed in ascending blocker number. The
// `crossSubtree` list (from `partitionBlockers`) contains blockers that are
// NOT in the dependent's own subtree's task set. PRD blockers are filtered out
// here — only TASK-to-TASK cross-subtree edges are surfaced. Cycle-member
// blockers are also filtered out: a cycle participant is broken and is treated
// like a closed/cancelled blocker (silently dropped), so non-cycle TASKs that
// depend on a cycle member do not surface a stale `(blocked by #M under
// PRD #X)` edge — they appear with no cycle-related annotation. Returns `''`
// when the task has no cross-subtree TASK blockers.
function crossSubtreeAnnotation(crossSubtree, graph) {
  const { byNumber, subtreeOf, cycleNodes } = graph;
  const cross = crossSubtree
    .filter((b) => {
      if (cycleNodes.has(b)) return false;
      const target = byNumber.get(b);
      return target !== undefined && hasLabel(target, 'task');
    })
    .sort((a, b) => a - b);
  return cross
    .map((b) => {
      const prdNumber = subtreeOf.get(b);
      return prdNumber === null
        ? ` (blocked by #${b}, unparented)`
        : ` (blocked by #${b} under PRD #${prdNumber})`;
    })
    .join('');
}

// Renders one subtree block: a header line, an ASCII dependency tree over
// the given task set, and a trailing blank line. A task with at least one
// in-subtree blocker is placed under its LOWEST-numbered in-subtree blocker
// (so a "diamond" — a task with multiple in-subtree blockers — appears
// exactly once in the tree); any other in-subtree blockers are surfaced via
// an `(also blocked by #M[, #L]...)` annotation appended to the task's line.
// Tasks with no in-subtree blocker are roots. Cross-subtree TASK blockers
// (one TASK blocked by another TASK in a different subtree) contribute no
// tree edge here — they are surfaced via a per-node
// `(blocked by #M under PRD #X)` (or `(blocked by #M, unparented)`)
// annotation appended AFTER any same-subtree `(also blocked by ...)`
// annotation. Children are appended in input order so the snapshot is
// deterministic. Used for both per-PRD subtrees and the `Unparented TASKs`
// subtree.
function renderSubtree(header, tasks, graph) {
  const { liveBlockers } = graph;
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const childrenOf = new Map(tasks.map((t) => [t.number, []]));
  const annotationOf = new Map();
  const roots = [];

  for (const task of tasks) {
    const blockers = liveBlockers.get(task.number) || [];
    const { inSubtree, crossSubtree } = partitionBlockers(blockers, taskNumbers);
    const sorted = sortedInSubtreeBlockers(inSubtree);
    if (sorted.length === 0) {
      roots.push(task);
    } else {
      childrenOf.get(sorted[0]).push(task);
    }
    const annotation =
      otherBlockersAnnotation(sorted) + crossSubtreeAnnotation(crossSubtree, graph);
    if (annotation !== '') annotationOf.set(task.number, annotation);
  }

  let out = `${header}\n`;
  roots.forEach((root, i) => {
    out += renderTreeNode(root, childrenOf, annotationOf, '', i === roots.length - 1);
  });
  out += '\n';
  return out;
}

// Renders a single tree node (and recursively its children) as one or more
// lines. `prefix` is the indentation accumulated from ancestors; `isLast`
// controls whether this node uses `└── ` (last child) or `├── ` (sibling
// follows), and whether the continuation prefix for its children uses 4
// spaces (last) or `│   ` (sibling follows).
function renderTreeNode(task, childrenOf, annotationOf, prefix, isLast) {
  const connector = isLast ? '└── ' : '├── ';
  const annotation = annotationOf.get(task.number) || '';
  let out = `${prefix}${connector}#${task.number} [${taskNodeLabel(task)}] ${task.title}${annotation}\n`;

  const children = childrenOf.get(task.number) || [];
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  children.forEach((child, i) => {
    out += renderTreeNode(
      child,
      childrenOf,
      annotationOf,
      childPrefix,
      i === children.length - 1,
    );
  });
  return out;
}

// Inverts the dependency graph: for each TASK `Y` with `b` in
// `liveBlockers.get(Y)`, records edge `b → Y` so callers can answer
// "what depends on `b`?" in one map lookup. Built once per R3 ranking
// pass and shared across all candidate counts.
function buildReverseDependencyGraph(liveBlockers) {
  const reverse = new Map();
  for (const [dependent, blockers] of liveBlockers) {
    for (const b of blockers) {
      if (!reverse.has(b)) reverse.set(b, []);
      reverse.get(b).push(dependent);
    }
  }
  return reverse;
}

// Counts the distinct open TASKs whose live-blocker chain transitively
// includes `taskNumber` — i.e. how many downstream TASKs the given TASK
// would unblock if it were completed. The visited set both keeps the
// walk O(V+E) and defends against any residual cycle the upstream
// cycle filter may have missed.
function countDownstreamTasks(taskNumber, reverseGraph) {
  const visited = new Set();
  const stack = [taskNumber];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const next of reverseGraph.get(cur) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      stack.push(next);
    }
  }
  return visited.size;
}

// Pure suggester: applies the R1 → R2 → R3 → R4 cascade and returns a
// structured suggestion the renderer can format without recomputing
// graph facts. Returns `{ rule: null, candidate: null, meta: null }`
// when no rule matches.
//
// Cascade summary (first match wins):
// - R1: any in-flight TASK (lowest issue number among them).
// - R2: prefer a ready TASK (task + ai-ready/human-ready, no live
//       blockers, not `blocked`-labeled) over any PRD. R3 picks the
//       single ready TASK among R2's candidates.
// - R3: within ready TASKs, the one whose completion unblocks the most
//       downstream open TASKs (transitive). Lowest issue number breaks
//       ties.
// - R4: when no ready TASK exists, the lowest-numbered PRD in the
//       highest-priority candidate state (`in-backlog` over
//       `needs-triage`).
// In-flight TASKs win regardless of any other label (including `blocked`).
// Lowest issue number among in-flight is the resume target. Returns `null`
// when no TASK is in flight so the cascade can fall through to R2/R3.
function applyR1(issues) {
  const inFlight = issues
    .filter(
      (i) => hasLabel(i, 'task') && IN_FLIGHT_STATES.some((s) => hasLabel(i, s)),
    )
    .sort((a, b) => a.number - b.number);
  if (inFlight.length === 0) return null;
  const candidate = inFlight[0];
  return { rule: 'R1', candidate, meta: { state: taskState(candidate) } };
}

// A ready TASK requires the `task` label, a ready state label, the absence
// of `blocked`, and zero live blockers. Within qualifying candidates R3's
// leverage metric (transitive downstream count) ranks ties; the rule tag
// distinguishes the "ready TASK over PRD" framing (R2, zero leverage) from
// the "unblocks N downstream" framing (R3, non-zero leverage). The
// renderer uses the tag to pick its message; the candidate is the same
// either way. Returns `null` when no ready TASK qualifies.
function applyR2R3(issues, graph) {
  const { liveBlockers, subtreeOf } = graph;
  const readyTasks = issues.filter(
    (i) =>
      hasLabel(i, 'task') &&
      !hasLabel(i, 'blocked') &&
      (hasLabel(i, 'ai-ready') || hasLabel(i, 'human-ready')) &&
      (liveBlockers.get(i.number) || []).length === 0,
  );
  if (readyTasks.length === 0) return null;
  const reverseGraph = buildReverseDependencyGraph(liveBlockers);
  const ranked = readyTasks
    .map((task) => ({
      task,
      downstreamCount: countDownstreamTasks(task.number, reverseGraph),
    }))
    .sort((a, b) => {
      if (b.downstreamCount !== a.downstreamCount) {
        return b.downstreamCount - a.downstreamCount;
      }
      return a.task.number - b.task.number;
    });
  const winner = ranked[0];
  return {
    rule: winner.downstreamCount > 0 ? 'R3' : 'R2',
    candidate: winner.task,
    meta: {
      parentPrd: subtreeOf.get(winner.task.number),
      downstreamCount: winner.downstreamCount,
    },
  };
}

// Fall back to triage/decompose work on PRDs. `in-backlog` outranks
// `needs-triage`; within a state, lowest issue number wins. Returns `null`
// when no PRD qualifies, leaving the cascade to emit the empty state.
function applyR4(issues) {
  for (const state of ['in-backlog', 'needs-triage']) {
    const matches = issues
      .filter((i) => hasLabel(i, 'prd') && hasLabel(i, state))
      .sort((a, b) => a.number - b.number);
    if (matches.length > 0) {
      return { rule: 'R4', candidate: matches[0], meta: { state } };
    }
  }
  return null;
}

// Cascade dispatch: each rule helper returns either a suggestion object or
// `null` to fall through to the next rule. `null` from all four means the
// empty state — every PRD is in flight and every TASK is blocked or in
// progress.
function suggestNext(issues, graph) {
  return (
    applyR1(issues) ||
    applyR2R3(issues, graph) ||
    applyR4(issues) || { rule: null, candidate: null, meta: null }
  );
}

// Formats the trailing one-line suggestion sentence. Takes the
// `suggestNext` return value and returns the line plus its terminating
// `\n`. When `suggestion.rule` is `null` (the empty state — no R1/R2/R3/R4
// candidate), returns the fixed `No actionable work …` fallback.
//
// Action token (the bit before `#N`): a slash command when the work is
// dispatchable to an automated agent, omitted otherwise.
//   - R1 ai-in-progress → /implement   (resume the AI implementer)
//   - R1 in-code-review / human-in-progress → no command (human action)
//   - R2/R3 ai-ready → /implement
//   - R2/R3 human-ready → no command (handoff to a human, ref alone)
//   - R4 in-backlog → /decompose
//   - R4 needs-triage → /interview
//
// Rationale (the bit after `— `): explains why the candidate is the
// suggested next action.
//   - R1 ai-in-progress / human-in-progress → resume
//   - R1 in-code-review → check review on
//   - R2/R3 downstreamCount > 0, parentPrd !== null →
//       `root of PRD #X, unblocks N downstream TASKs`
//   - R2/R3 downstreamCount > 0, parentPrd === null →
//       `unblocks N downstream TASKs` (the root-of-PRD clause is omitted
//       when the TASK has no parent PRD in the input)
//   - R2/R3 downstreamCount === 0 → `unblocks 0 downstream TASKs`
//   - R4 in-backlog → `ready for /decompose`
//   - R4 needs-triage → `ready for /interview`
function renderSuggestionSentence(suggestion) {
  if (suggestion.rule === null) {
    return 'No actionable work — every PRD is in flight and every TASK is blocked or in progress.\n';
  }
  const { rule, candidate, meta } = suggestion;
  const ref = `#${candidate.number}`;
  const action = suggestionActionToken(rule, candidate, meta);
  const lead = action === '' ? ref : `${action} ${ref}`;
  const rationale = suggestionRationale(rule, meta);
  return `Suggested next: ${lead} — ${rationale}\n`;
}

// Returns the slash-command token (e.g. `/implement`) or `''` when the
// suggestion's action is the bare `#N` reference (human-driven work).
function suggestionActionToken(rule, candidate, meta) {
  if (rule === 'R1') {
    return meta.state === 'ai-in-progress' ? '/implement' : '';
  }
  if (rule === 'R2' || rule === 'R3') {
    return hasLabel(candidate, 'ai-ready') ? '/implement' : '';
  }
  // R4
  return meta.state === 'in-backlog' ? '/decompose' : '/interview';
}

// Returns the rationale clause that follows `— ` in the trailing sentence.
function suggestionRationale(rule, meta) {
  if (rule === 'R1') {
    return meta.state === 'in-code-review' ? 'check review on' : 'resume';
  }
  if (rule === 'R2' || rule === 'R3') {
    const tail = `unblocks ${meta.downstreamCount} downstream TASKs`;
    if (meta.downstreamCount > 0 && meta.parentPrd !== null) {
      return `root of PRD #${meta.parentPrd}, ${tail}`;
    }
    return tail;
  }
  // R4
  return meta.state === 'in-backlog' ? 'ready for /decompose' : 'ready for /interview';
}

module.exports = {
  runDashboard,
  suggestNext,
  renderSuggestionSentence,
  renderStaleWorktreesSection,
  parseWorktreePorcelain,
  buildGraph,
};

if (require.main === module) {
  process.stdout.write(runDashboard());
}
