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

const PRD_STATES = ['needs-triage', 'in-backlog', 'in-progress'];
const TASK_STATES = [
  'human-ready',
  'human-in-progress',
  'ai-ready',
  'ai-in-progress',
  'in-code-review',
];

const PARENT_PRD_RE = /## Parent PRD[^#]*?#(\d+)/;

function hasLabel(issue, name) {
  return issue.labels.some((l) => l.name === name);
}

function parentPrdAnnotation(issue) {
  const body = issue.body || '';
  const m = body.match(PARENT_PRD_RE);
  return m ? `[PRD #${m[1]}]` : '[no PRD]';
}

// Renders a "by state" section: a header followed by, for each state that has
// any matching issue, a `state:` line, one formatted line per match, and a
// trailing blank line. States with no matches are silently skipped. No
// additional trailing newline is appended after the last state block — the
// per-state trailing `\n` is the only separator.
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

  output += renderByStateSection({
    header: 'PRDs by state',
    states: PRD_STATES,
    matchesFor: (state) =>
      issues.filter((i) => hasLabel(i, 'prd') && hasLabel(i, state)),
    formatLine: (i) => `  #${i.number} ${i.title}`,
  });

  output += renderByStateSection({
    header: 'TASKs by state',
    states: TASK_STATES,
    matchesFor: (state) =>
      issues.filter((i) => hasLabel(i, 'task') && hasLabel(i, state)),
    formatLine: (i) =>
      `  #${i.number} ${i.title} ${parentPrdAnnotation(i)}`,
  });

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

    const matches = comment.body.match(/#(\d+)/g);
    if (!matches || matches.length === 0) continue;

    const childNumbers = matches.map((m) => Number(m.slice(1)));
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

// Renders the Blocked section: a header followed by either one indented
// `  #<number> <title>` line per blocked issue (input order preserved) or a
// single `(none)` line when no issue carries the `blocked` label. A trailing
// blank line always closes the section. The `blocked` filter is intentionally
// kind-agnostic — both PRDs and TASKs can be blocked simultaneously.
function renderBlockedSection(issues) {
  let out = '=== Blocked ===\n\n';
  const blocked = issues.filter((i) => hasLabel(i, 'blocked'));
  if (blocked.length > 0) {
    for (const i of blocked) {
      out += `  #${i.number} ${i.title}\n`;
    }
  } else {
    out += '(none)\n';
  }
  out += '\n';
  return out;
}

module.exports = { runDashboard };

if (require.main === module) {
  process.stdout.write(runDashboard());
}
