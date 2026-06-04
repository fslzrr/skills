'use strict';

// R2 negative: a TASK with live blockers is NOT a ready candidate, even
// if labeled ai-ready. The fixture has no other R2 candidate so the
// suggester must fall through to R4 (the in-backlog PRD).
// - #90 PRD in-backlog (R4 winner)
// - #91 TASK ai-ready + blocked (NOT R2 candidate due to `blocked` label;
//        also serves as the live blocker for #92)
// - #92 TASK ai-ready with live blocker #91 (NOT R2 candidate due to
//        live blocker)

module.exports = [
  {
    number: 90,
    title: 'PRD: zeta',
    labels: [{ name: 'prd' }, { name: 'in-backlog' }],
    comments: [],
    body: '',
  },
  {
    number: 91,
    title: 'TASK: blocked ready',
    labels: [{ name: 'task' }, { name: 'ai-ready' }, { name: 'blocked' }],
    comments: [],
    body: '## Parent PRD\n\n#90\n\n## Blockers / Dependencies\n\nNone.\n',
  },
  {
    number: 92,
    title: 'TASK: ready with live blocker',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
    comments: [],
    body: '## Parent PRD\n\n#90\n\n## Blockers / Dependencies\n\n#91\n',
  },
];
