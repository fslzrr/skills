'use strict';

// R3 tie-break: two ready TASKs each unblock exactly one downstream;
// lowest issue number wins (#300 over #310).
//
// Dep graph:
//   #301 → #300
//   #311 → #310
// Downstream of #300 = {#301}; downstream of #310 = {#311}. Tie. → #300.

module.exports = [
  {
    number: 150,
    title: 'PRD: theta',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 300,
    title: 'TASK: ready A',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#150\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 301,
    title: 'TASK: depends on #300',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#150\n\n## Blockers / Dependencies\n\n#300\n',
  },
  {
    number: 310,
    title: 'TASK: ready B',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#150\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 311,
    title: 'TASK: depends on #310',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#150\n\n## Blockers / Dependencies\n\n#310\n',
  },
];
