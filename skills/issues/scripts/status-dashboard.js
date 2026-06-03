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

function hasLabel(issue, name) {
  return issue.labels.some((l) => l.name === name);
}

// Renders a "by state" section: a header followed by, for each state that has
// any matching issue, a `state:` line, one formatted line per match, and a
// trailing blank line. States with no matches are silently skipped.
function renderByStateSection({ header, states, matchOf, formatLine }) {
  let out = `=== ${header} ===\n\n`;
  for (const state of states) {
    const matches = matchOf(state);
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
    matchOf: (state) =>
      issues.filter((i) => hasLabel(i, 'prd') && hasLabel(i, state)),
    formatLine: (i) => `  #${i.number} ${i.title}`,
  });

  // TASKs by state (full implementation deferred to a later SUBTASK)
  output += '=== TASKs by state ===\n\n';

  // Blocked (full implementation deferred to a later SUBTASK)
  output += '=== Blocked ===\n\n(none)\n\n';

  return output;
}

module.exports = { runDashboard, defaultFetcher };

if (require.main === module) {
  process.stdout.write(runDashboard());
}
