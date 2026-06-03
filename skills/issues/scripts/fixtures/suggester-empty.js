'use strict';

// Empty-state fixture: nothing R1/R2/R3/R4 can match.
// - #800 PRD in-progress (not a R4 state: only needs-triage / in-backlog
//        are candidates).
// - #810 TASK blocked (no in-flight state; blocked label disqualifies R2/R3).

module.exports = [
  {
    number: 800,
    title: 'PRD: already in progress',
    labels: [{ name: 'prd' }, { name: 'in-progress' }],
    comments: [],
    body: '',
  },
  {
    number: 810,
    title: 'TASK: blocked, no state',
    labels: [{ name: 'task' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#800\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
