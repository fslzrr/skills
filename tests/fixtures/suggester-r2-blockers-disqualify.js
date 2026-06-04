'use strict';

// R2 negative: a TASK with live blockers is NOT a ready candidate, even
// if labeled ai-ready. The fixture has no other R2 candidate so the
// suggester must fall through to R4 (the in-backlog PRD).
// - #90 PRD in-backlog (R4 winner)
// - #91 TASK ai-ready (the blocker — also ready, but counts as live
//        blocker for #92)
// Wait — if #91 is itself ready and has no blockers, R3 would pick the
// higher-unblocker. Instead make #91 an in-progress TASK so it doesn't
// satisfy R2 (it satisfies R1 in fact). That would make R1 fire, not R4.
// To force R4 to fire, the blocker must be live but not a R1/R2/R3
// candidate. Easiest: make the blocker itself blocked.
// Revised:
// - #90 PRD in-backlog (R4 winner)
// - #91 TASK ai-ready + blocked (NOT R2 candidate due to `blocked`
//        label; also blocks #92)
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
