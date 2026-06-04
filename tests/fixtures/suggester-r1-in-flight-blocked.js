'use strict';

// R1 still considers in-flight TASKs that carry the `blocked` label —
// per AC, R1 is about resuming work already in flight; "blocked" is a
// review signal, not an exclusion from R1.
// - #50 PRD in-backlog (R4 candidate)
// - #60 TASK ai-in-progress + blocked (R1 winner)
// - #61 TASK ai-ready (R2 candidate)

module.exports = [
  {
    number: 50,
    title: 'PRD: gamma',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 60,
    title: 'TASK: in flight but blocked',
    labels: [
      { name: 'task' },
      { name: 'ai-in-progress' },
      { name: 'blocked' },
    ],
    comments: [],
    body: '## Parent PRD\n\n#50\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 61,
    title: 'TASK: ready',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#50\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
