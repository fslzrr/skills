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

  // Blocked (full implementation deferred to a later SUBTASK)
  output += '=== Blocked ===\n\n(none)\n\n';

  return output;
}

module.exports = { runDashboard, defaultFetcher };

if (require.main === module) {
  process.stdout.write(runDashboard());
}
