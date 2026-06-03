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

const PRD_STATES = ['needs-triage', 'in-backlog'];

const TASK_STATES = [
  'ai-ready',
  'ai-in-progress',
  'human-ready',
  'human-in-progress',
  'in-code-review',
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
// like `Blockers / Dependencies` without worrying about the `/`. The heading
// match is anchored at a line boundary (start-of-body or immediately after a
// `\n`) so that inline occurrences inside backticked code spans — e.g. a
// bullet that mentions `` `## Parent PRD` `` literally — are NOT mistaken for
// a real section heading.
function extractBodySection(body, heading) {
  if (!body) return '';
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `(?:^|\n)` anchors the heading at a line boundary; this rejects inline
  // occurrences like `` `## Parent PRD` `` embedded in prose. The group is
  // non-capturing so `m[1]` still yields the section body.
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

function runDashboard({ fetcher = defaultFetcher } = {}) {
  const issues = fetcher();
  const { byNumber, liveBlockers } = buildDependencyGraph(issues);
  const cycles = detectCycles(liveBlockers);
  const cycleNodes = new Set(cycles.flat());

  let output = '';

  output += renderCurrentlyInFlightSection(issues);

  output += renderByStateSection({
    header: 'PRDs by state',
    states: PRD_STATES,
    matchesFor: (state) =>
      issues.filter((i) => hasLabel(i, 'prd') && hasLabel(i, state)),
    formatLine: (i) => `  #${i.number} ${i.title}`,
  });

  output += renderTasksByParentPrdSection(issues, {
    byNumber,
    liveBlockers,
    cycleNodes,
  });

  output += renderCyclesDetectedSection(cycles);

  output += renderBlockedSection(issues);

  output += renderPrdsReadyToCloseSection(issues);

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

// Renders the Currently in flight section: a header followed by either one
// `  #<number> [<label>] <title>` line per TASK whose labels include any of
// the three in-flight states (input order preserved) or a single `(none)`
// line when no TASK is in flight. A trailing blank line always closes the
// section. The bracket label is composed by `taskNodeLabel` — the TASK's
// state, plus `, blocked` when the cross-cutting `blocked` label is also
// present (consistent with the tree's per-node format).
function renderCurrentlyInFlightSection(issues) {
  const inFlight = issues.filter((i) =>
    IN_FLIGHT_STATES.some((s) => hasLabel(i, s)),
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
function renderTasksByParentPrdSection(issues, { byNumber, liveBlockers, cycleNodes }) {
  const tasks = issues.filter(
    (i) => hasLabel(i, 'task') && !cycleNodes.has(i.number),
  );
  if (tasks.length === 0) return '';

  const tasksByPrd = new Map();
  const orphans = [];
  const subtreeOf = new Map();
  for (const task of tasks) {
    const prdNumber = parentPrdNumber(task);
    if (prdNumber !== null && byNumber.has(prdNumber)) {
      if (!tasksByPrd.has(prdNumber)) tasksByPrd.set(prdNumber, []);
      tasksByPrd.get(prdNumber).push(task);
      subtreeOf.set(task.number, prdNumber);
    } else {
      orphans.push(task);
      subtreeOf.set(task.number, null);
    }
  }

  let out = '=== TASKs by parent PRD ===\n\n';

  const sortedPrdNumbers = [...tasksByPrd.keys()].sort((a, b) => a - b);
  for (const prdNumber of sortedPrdNumbers) {
    const prd = byNumber.get(prdNumber);
    const prdTasks = tasksByPrd.get(prdNumber);
    out += renderSubtree(
      `--- PRD #${prdNumber}: ${prd.title} ---`,
      prdTasks,
      liveBlockers,
      byNumber,
      subtreeOf,
      cycleNodes,
    );
  }

  if (orphans.length > 0) {
    out += renderSubtree(
      '--- Unparented TASKs ---',
      orphans,
      liveBlockers,
      byNumber,
      subtreeOf,
      cycleNodes,
    );
  }

  return out;
}

// Returns the in-subtree blocker numbers for a task, sorted ascending. A
// blocker is "in subtree" when it resolves to another task in the same
// subtree's task set; cross-subtree blocker edges (handled elsewhere) are
// filtered out here. Sorting ascending is what makes the diamond placement
// (lowest-numbered parent) and the annotation order (ascending) deterministic
// regardless of the order blockers appear in the issue body.
function sortedInSubtreeBlockers(blockers, taskNumbers) {
  return blockers.filter((b) => taskNumbers.has(b)).sort((a, b) => a - b);
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
// `taskNumbers` set identifies the dependent's own subtree's TASKs (so the
// in-subtree blockers can be filtered out). PRD blockers are filtered out —
// only TASK-to-TASK cross-subtree edges are surfaced. Cycle-member blockers
// are also filtered out: a cycle participant is broken and is treated like a
// closed/cancelled blocker (silently dropped), so non-cycle TASKs that depend
// on a cycle member do not surface a stale `(blocked by #M under PRD #X)`
// edge — they appear with no cycle-related annotation. Returns `''` when the
// task has no cross-subtree TASK blockers.
function crossSubtreeAnnotation(blockers, taskNumbers, byNumber, subtreeOf, cycleNodes) {
  const cross = blockers
    .filter((b) => {
      if (taskNumbers.has(b)) return false;
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
function renderSubtree(header, tasks, liveBlockers, byNumber, subtreeOf, cycleNodes) {
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const childrenOf = new Map(tasks.map((t) => [t.number, []]));
  const annotationOf = new Map();
  const roots = [];

  for (const task of tasks) {
    const blockers = liveBlockers.get(task.number) || [];
    const sorted = sortedInSubtreeBlockers(blockers, taskNumbers);
    if (sorted.length === 0) {
      roots.push(task);
    } else {
      childrenOf.get(sorted[0]).push(task);
    }
    const annotation =
      otherBlockersAnnotation(sorted) +
      crossSubtreeAnnotation(blockers, taskNumbers, byNumber, subtreeOf, cycleNodes);
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

module.exports = { runDashboard };

if (require.main === module) {
  process.stdout.write(runDashboard());
}
