'use strict';

// R2 fixture: a ready TASK wins over any PRD candidate.
// - #70 PRD in-backlog (R4 candidate; must NOT win)
// - #71 PRD needs-triage (R4 candidate; must NOT win)
// - #80 TASK ai-ready under PRD #70, no blockers (R2 winner)

module.exports = [
  {
    number: 70,
    title: 'PRD: delta',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 71,
    title: 'PRD: epsilon',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
  {
    number: 80,
    title: 'TASK: ready and unblocked',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#70\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
