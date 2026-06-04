'use strict';

// R3 fixture: two ready TASKs; #200 transitively unblocks #201, #202,
// #203 (three downstream). #210 is also ready but unblocks nothing
// downstream. R3 picks #200.
//
// Dep graph (edges = `dependent → blocker`):
//   #201 → #200
//   #202 → #201 (so #202 transitively depends on #200)
//   #203 → #200
//   #210 (no descendants)
// Downstream of #200 = {#201, #202, #203} = 3.
// Downstream of #210 = {} = 0.

module.exports = [
  {
    number: 100,
    title: 'PRD: eta',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 200,
    title: 'TASK: high-leverage',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#100\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 201,
    title: 'TASK: depends on #200',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#100\n\n## Blockers / Dependencies\n\n#200\n',
  },
  {
    number: 202,
    title: 'TASK: depends on #201',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#100\n\n## Blockers / Dependencies\n\n#201\n',
  },
  {
    number: 203,
    title: 'TASK: depends on #200',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#100\n\n## Blockers / Dependencies\n\n#200\n',
  },
  {
    number: 210,
    title: 'TASK: ready leaf',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#100\n\n## Blockers / Dependencies\n\nNone.\n',
  },
];
