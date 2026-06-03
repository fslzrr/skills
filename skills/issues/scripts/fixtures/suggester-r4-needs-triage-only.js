'use strict';

// R4 fallback: no in-backlog PRDs; needs-triage wins; lowest number → #600.

module.exports = [
  {
    number: 600,
    title: 'PRD: needs triage A',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
  {
    number: 610,
    title: 'PRD: needs triage B',
    labels: [{ name: 'prd' }, { name: 'needs-triage' }],
    comments: [],
    body: '',
  },
];
