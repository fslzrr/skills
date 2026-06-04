'use strict';

// R2 tie-break: two ready TASKs, both with zero downstream descendants.
// R2 fires (no candidate has any unblock leverage), and the
// lowest-numbered candidate wins (#400 over #410). The PRD candidate is
// present to confirm R2 wins over R4.
//
// Both #400 and #410 are leaves in the dependency graph (no other open
// TASK has them as a live blocker), so `downstreamCount === 0` for both.

module.exports = [
  {
    number: 200,
    title: 'PRD: kappa',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 400,
    title: 'TASK: ready leaf A',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#200\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 410,
    title: 'TASK: ready leaf B',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#200\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
