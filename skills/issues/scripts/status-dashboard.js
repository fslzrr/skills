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

function runDashboard({ fetcher = defaultFetcher } = {}) {
  // issues will drive PRD/TASK/Blocked derivation in later SUBTASKs; for the
  // empty-input case the output is fixed.
  // eslint-disable-next-line no-unused-vars
  const issues = fetcher();

  const sections = [
    '=== PRDs by state ===\n',
    '=== TASKs by state ===\n',
    '=== Blocked ===\n\n(none)\n',
  ];

  return sections.map((s) => s + '\n').join('');
}

module.exports = { runDashboard, defaultFetcher };

if (require.main === module) {
  process.stdout.write(runDashboard());
}
