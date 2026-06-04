'use strict';

// Blocked-label TASKs must NEVER satisfy R2/R3 even when they have no
// live blockers. The suggester must fall through to R4 (the
// needs-triage PRD).
// - #700 PRD needs-triage (R4 winner)
// - #710 TASK ai-ready + blocked, no live blockers (NOT a candidate)

module.exports = [
  {
    number: 700,
    title: 'PRD: needs triage',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
  {
    number: 710,
    title: 'TASK: blocked ready',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#700\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
