'use strict';

// R4 tie-break: two in-backlog PRDs; lowest issue number wins (#500).

module.exports = [
  {
    number: 500,
    title: 'PRD: in backlog A',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 510,
    title: 'PRD: in backlog B',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 520,
    title: 'PRD: needs triage',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
];
