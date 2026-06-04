'use strict';

// R1 variant: in-code-review counts as in-flight.
// - #30 PRD in-backlog (would be R4)
// - #40 TASK in-code-review (R1 winner)
// - #41 TASK ai-ready (R2 candidate)

module.exports = [
  {
    number: 30,
    title: 'PRD: beta',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 40,
    title: 'TASK: awaiting review',
    labels: [{ name: 'task' }, { name: 'in-code-review' }],
    comments: [],
    body: '## Parent PRD\n\n#30\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 41,
    title: 'TASK: ready',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#30\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
