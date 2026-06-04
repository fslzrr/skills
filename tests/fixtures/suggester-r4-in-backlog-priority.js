'use strict';

// R4 fixture: no ready TASKs anywhere; one in-backlog PRD and one
// needs-triage PRD. R4 prefers in-backlog. → #401.

module.exports = [
  {
    number: 400,
    title: 'PRD: needs triage',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
  {
    number: 401,
    title: 'PRD: in backlog',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
];
