'use strict';

// R1 fixture: an in-flight TASK must win over any ready TASK.
// - #10 PRD in-backlog (would otherwise qualify for R4)
// - #20 TASK ai-in-progress under PRD #10 (R1 winner)
// - #21 TASK ai-ready under PRD #10 (R2 candidate; should NOT win)
// - #22 TASK human-in-progress under PRD #10 (lowest-number tie-breaker)
//        — wait, #20 is lower; #22 is here only to show multiple in-flight.
// Lowest issue number among in-flight wins → #20.

module.exports = [
  {
    number: 10,
    title: 'PRD: alpha',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 20,
    title: 'TASK: do the thing',
    labels: [{ name: 'task' }, { name: 'ai-in-progress' }],
    comments: [],
    body: '## Parent PRD\n\n#10\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 21,
    title: 'TASK: ready candidate',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#10\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 22,
    title: 'TASK: also in progress',
    labels: [{ name: 'task' }, { name: 'human-in-progress' }],
    comments: [],
    body: '## Parent PRD\n\n#10\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
