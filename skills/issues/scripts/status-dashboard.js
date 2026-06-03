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
// like `Blockers / Dependencies` without worrying about the `/`.
function extractBodySection(body, heading) {
  if (!body) return '';
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('## ' + escaped + '([\\s\\S]*?)(?=\\n## |$)');
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

  let output = '';

  output += renderCurrentlyInFlightSection(issues);

  output += renderByStateSection({
    header: 'PRDs by state',
    states: PRD_STATES,
    matchesFor: (state) =>
      issues.filter((i) => hasLabel(i, 'prd') && hasLabel(i, state)),
    formatLine: (i) => `  #${i.number} ${i.title}`,
  });

  output += renderTasksByParentPrdSection(issues);

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
// `  #<number> [<state>] <title>` line per TASK whose labels include any of
// the three in-flight states (input order preserved) or a single `(none)`
// line when no TASK is in flight. A trailing blank line always closes the
// section. When a TASK carries multiple in-flight labels (shouldn't happen
// but defensive), the first match in IN_FLIGHT_STATES priority order wins.
function renderCurrentlyInFlightSection(issues) {
  const inFlight = issues.filter((i) =>
    IN_FLIGHT_STATES.some((s) => hasLabel(i, s)),
  );
  const body =
    inFlight.length > 0
      ? inFlight
          .map((i) => {
            const state = IN_FLIGHT_STATES.find((s) => hasLabel(i, s));
            return `  #${i.number} [${state}] ${i.title}\n`;
          })
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

// Renders the TASKs-by-parent-PRD section: groups every open TASK by its
// parent PRD (when present in the input) or as an "orphan" (no
// `## Parent PRD`, or parent not in the input), and emits one ASCII
// dependency subtree per PRD (sorted by ascending PRD number) followed by a
// dedicated `--- Unparented TASKs ---` subtree containing the orphans (when
// any). Each subtree is headed by `--- PRD #N: title ---` (or
// `--- Unparented TASKs ---` for orphans) and laid out using `├── `, `└── `,
// `│   `, and `    ` indentation, with per-node format `#N [state] title`.
//
// A TASK's parent in the tree is its first live blocker that is also in the
// same subtree's task set; TASKs with no in-subtree blocker are roots.
// Children are rendered in input order, which makes the snapshot
// deterministic. Cross-subtree blocker edges (orphan blocked by parented
// TASK, or vice-versa) are silently dropped at this stage — they will be
// addressed in a follow-up SUBTASK.
//
// Section is omitted entirely when there are no open TASKs at all. The
// Unparented subtree is itself omitted when there are no orphans.
function renderTasksByParentPrdSection(issues) {
  const { byNumber, liveBlockers } = buildDependencyGraph(issues);

  const tasks = issues.filter((i) => hasLabel(i, 'task'));
  if (tasks.length === 0) return '';

  const tasksByPrd = new Map();
  const orphans = [];
  for (const task of tasks) {
    const prdNumber = parentPrdNumber(task);
    if (prdNumber !== null && byNumber.has(prdNumber)) {
      if (!tasksByPrd.has(prdNumber)) tasksByPrd.set(prdNumber, []);
      tasksByPrd.get(prdNumber).push(task);
    } else {
      orphans.push(task);
    }
  }

  let out = '=== TASKs by parent PRD ===\n\n';

  const sortedPrdNumbers = [...tasksByPrd.keys()].sort((a, b) => a - b);
  for (const prdNumber of sortedPrdNumbers) {
    const prd = byNumber.get(prdNumber);
    const prdTasks = tasksByPrd.get(prdNumber);
    out += renderSubtree(`--- PRD #${prdNumber}: ${prd.title} ---`, prdTasks, liveBlockers);
  }

  if (orphans.length > 0) {
    out += renderSubtree('--- Unparented TASKs ---', orphans, liveBlockers);
  }

  return out;
}

// Renders one subtree block: a header line, an ASCII dependency tree over
// the given task set, and a trailing blank line. Each task's parent is its
// first live blocker that is also in this subtree's task set; tasks with no
// in-subtree blocker are roots. Children are appended in input order so the
// snapshot is deterministic. Used for both per-PRD subtrees and the
// `Unparented TASKs` subtree.
function renderSubtree(header, tasks, liveBlockers) {
  const taskNumbers = new Set(tasks.map((t) => t.number));
  const childrenOf = new Map(tasks.map((t) => [t.number, []]));
  const roots = [];

  for (const task of tasks) {
    const blockers = liveBlockers.get(task.number) || [];
    const inSubtreeParent = blockers.find((b) => taskNumbers.has(b));
    if (inSubtreeParent === undefined) {
      roots.push(task);
    } else {
      childrenOf.get(inSubtreeParent).push(task);
    }
  }

  let out = `${header}\n`;
  roots.forEach((root, i) => {
    out += renderTreeNode(root, childrenOf, '', i === roots.length - 1);
  });
  out += '\n';
  return out;
}

// Renders a single tree node (and recursively its children) as one or more
// lines. `prefix` is the indentation accumulated from ancestors; `isLast`
// controls whether this node uses `└── ` (last child) or `├── ` (sibling
// follows), and whether the continuation prefix for its children uses 4
// spaces (last) or `│   ` (sibling follows).
function renderTreeNode(task, childrenOf, prefix, isLast) {
  const connector = isLast ? '└── ' : '├── ';
  const state = taskState(task) || 'no-state';
  let out = `${prefix}${connector}#${task.number} [${state}] ${task.title}\n`;

  const children = childrenOf.get(task.number) || [];
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  children.forEach((child, i) => {
    out += renderTreeNode(
      child,
      childrenOf,
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
