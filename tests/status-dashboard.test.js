'use strict';

// Tests for `suggestNext`. Each test loads a fixture (a small array of
// `gh issue list --json ...`-shaped objects), reconstructs the same
// `graph` object that `runDashboard` builds, and asserts the suggestion
// cascade picks the right candidate with the right rule and meta.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  suggestNext,
  buildGraph,
  runDashboard,
  renderSuggestionSentence,
  renderStaleWorktreesSection,
  parseWorktreePorcelain,
} = require('../skills/issues/scripts/status-dashboard.js');

function run(fixturePath) {
  const issues = require(fixturePath);
  return suggestNext(issues, buildGraph(issues));
}

test('R1 picks the lowest-numbered in-flight TASK over any ready TASK', () => {
  const result = run('./fixtures/suggester-r1-resume.js');
  assert.equal(result.rule, 'R1');
  assert.equal(result.candidate.number, 20);
  assert.equal(result.meta.state, 'ai-in-progress');
});

test('R1 treats in-code-review as in-flight', () => {
  const result = run('./fixtures/suggester-r1-code-review.js');
  assert.equal(result.rule, 'R1');
  assert.equal(result.candidate.number, 40);
  assert.equal(result.meta.state, 'in-code-review');
});

test('R1 still fires when the in-flight TASK is also `blocked`-labeled', () => {
  const result = run('./fixtures/suggester-r1-in-flight-blocked.js');
  assert.equal(result.rule, 'R1');
  assert.equal(result.candidate.number, 60);
  assert.equal(result.meta.state, 'ai-in-progress');
});

test('R2 picks a ready TASK over any PRD candidate', () => {
  const result = run('./fixtures/suggester-r2-ready-over-prd.js');
  assert.equal(result.rule, 'R2');
  assert.equal(result.candidate.number, 80);
  assert.equal(result.meta.parentPrd, 70);
  assert.equal(result.meta.downstreamCount, 0);
});

test('R2 does not consider TASKs with live blockers; falls through to R4', () => {
  const result = run('./fixtures/suggester-r2-blockers-disqualify.js');
  assert.equal(result.rule, 'R4');
  assert.equal(result.candidate.number, 90);
  assert.equal(result.meta.state, 'in-backlog');
});

test('R2 tie-break by lowest issue number when no ready TASK has downstream', () => {
  const result = run('./fixtures/suggester-r2-tie-break.js');
  assert.equal(result.rule, 'R2');
  assert.equal(result.candidate.number, 400);
  assert.equal(result.meta.parentPrd, 200);
  assert.equal(result.meta.downstreamCount, 0);
});

test('R3 picks the ready TASK that transitively unblocks the most downstream TASKs', () => {
  const result = run('./fixtures/suggester-r3-most-unblocks.js');
  assert.equal(result.rule, 'R3');
  assert.equal(result.candidate.number, 200);
  assert.equal(result.meta.parentPrd, 100);
  assert.equal(result.meta.downstreamCount, 3);
});

test('R3 tie-break by lowest issue number when downstream counts are equal', () => {
  const result = run('./fixtures/suggester-r3-tie-break.js');
  assert.equal(result.rule, 'R3');
  assert.equal(result.candidate.number, 300);
  assert.equal(result.meta.parentPrd, 150);
  assert.equal(result.meta.downstreamCount, 1);
});

test('R4 prefers an in-backlog PRD over a needs-triage PRD', () => {
  const result = run('./fixtures/suggester-r4-in-backlog-priority.js');
  assert.equal(result.rule, 'R4');
  assert.equal(result.candidate.number, 401);
  assert.equal(result.meta.state, 'in-backlog');
});

test('R4 tie-break by lowest issue number among in-backlog PRDs', () => {
  const result = run('./fixtures/suggester-r4-tie-break.js');
  assert.equal(result.rule, 'R4');
  assert.equal(result.candidate.number, 500);
  assert.equal(result.meta.state, 'in-backlog');
});

test('R4 falls back to lowest-numbered needs-triage PRD when no in-backlog exists', () => {
  const result = run('./fixtures/suggester-r4-needs-triage-only.js');
  assert.equal(result.rule, 'R4');
  assert.equal(result.candidate.number, 600);
  assert.equal(result.meta.state, 'needs-triage');
});

test('blocked-labeled TASKs are never proposed by R2/R3 (falls through to R4)', () => {
  const result = run('./fixtures/suggester-blocked-skip.js');
  assert.equal(result.rule, 'R4');
  assert.equal(result.candidate.number, 700);
  assert.equal(result.meta.state, 'needs-triage');
});

test('empty state: no candidate from any rule returns nulls', () => {
  const result = run('./fixtures/suggester-empty.js');
  assert.deepEqual(result, { rule: null, candidate: null, meta: null });
});

// Tests for the dashboard's trailing one-line suggestion sentence. Each
// case loads a fixture, runs the full dashboard with the fixture as the
// fetcher's output, and asserts a snapshot of the full rendered string
// (with the trailing sentence appended after the existing sections). For
// the R1/R2/R3/R4 paths we assert the FULL dashboard string so the
// section-spacing contract (one blank line between the last section and
// the suggestion sentence, no trailing blank after) is verified
// observationally. We also assert the renderer's output in isolation for
// each rule to lock the action-token + rationale format.

function dashboardOf(fixturePath) {
  const issues = require(fixturePath);
  // Inject an empty worktree seam so these snapshots stay deterministic: the
  // default `defaultWorktreeFetcher` shells out to the real `git worktree
  // list`, which in the test repo would surface the active `118-...` worktree
  // (its number not in any fixture's open set) as stale and break every
  // snapshot. An empty list keeps the stale section omitted.
  return runDashboard({ fetcher: () => issues, worktreeFetcher: () => [] });
}

test('dashboard trailing suggestion: R1 ai-in-progress emits /implement #N — resume', () => {
  const out = dashboardOf('./fixtures/suggester-r1-resume.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '  #20 [ai-in-progress] TASK: do the thing\n' +
    '  #22 [human-in-progress] TASK: also in progress\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'in-backlog:\n' +
    '  #10 PRD: alpha\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #10: PRD: alpha ---\n' +
    '├── #20 [ai-in-progress] TASK: do the thing\n' +
    '├── #21 [ai-ready] TASK: ready candidate\n' +
    '└── #22 [human-in-progress] TASK: also in progress\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    'Suggested next: /implement #20 — resume\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: R1 in-code-review emits bare #N — check review on', () => {
  const out = dashboardOf('./fixtures/suggester-r1-code-review.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '  #40 [in-code-review] TASK: awaiting review\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'in-backlog:\n' +
    '  #30 PRD: beta\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #30: PRD: beta ---\n' +
    '├── #40 [in-code-review] TASK: awaiting review\n' +
    '└── #41 [ai-ready] TASK: ready\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    'Suggested next: #40 — check review on\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: R2 ai-ready leaf emits /implement #N — unblocks 0 downstream TASKs', () => {
  const out = dashboardOf('./fixtures/suggester-r2-ready-over-prd.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'needs-triage:\n' +
    '  #71 PRD: epsilon\n' +
    '\n' +
    'in-backlog:\n' +
    '  #70 PRD: delta\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #70: PRD: delta ---\n' +
    '└── #80 [ai-ready] TASK: ready and unblocked\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    'Suggested next: /implement #80 — unblocks 0 downstream TASKs\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: R3 ai-ready with downstream emits /implement #N — root of PRD #X, unblocks N downstream TASKs', () => {
  const out = dashboardOf('./fixtures/suggester-r3-most-unblocks.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'in-backlog:\n' +
    '  #100 PRD: eta\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #100: PRD: eta ---\n' +
    '├── #200 [ai-ready] TASK: high-leverage\n' +
    '│   ├── #201 [ai-ready, blocked] TASK: depends on #200\n' +
    '│   │   └── #202 [ai-ready, blocked] TASK: depends on #201\n' +
    '│   └── #203 [ai-ready, blocked] TASK: depends on #200\n' +
    '└── #210 [ai-ready] TASK: ready leaf\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '  #201 TASK: depends on #200\n' +
    '  #202 TASK: depends on #201\n' +
    '  #203 TASK: depends on #200\n' +
    '\n' +
    'Suggested next: /implement #200 — root of PRD #100, unblocks 3 downstream TASKs\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: R4 in-backlog emits /decompose #N — ready for /decompose', () => {
  const out = dashboardOf('./fixtures/suggester-r4-in-backlog-priority.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'needs-triage:\n' +
    '  #400 PRD: needs triage\n' +
    '\n' +
    'in-backlog:\n' +
    '  #401 PRD: in backlog\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    'Suggested next: /decompose #401 — ready for /decompose\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: R4 needs-triage emits /interview #N — ready for /interview', () => {
  const out = dashboardOf('./fixtures/suggester-r4-needs-triage-only.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'needs-triage:\n' +
    '  #600 PRD: needs triage A\n' +
    '  #610 PRD: needs triage B\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    'Suggested next: /interview #600 — ready for /interview\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: empty state emits the No actionable work fallback', () => {
  const out = dashboardOf('./fixtures/suggester-empty.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #800: PRD: already in progress ---\n' +
    '└── #810 [no-state, blocked] TASK: blocked, no state\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '  #810 TASK: blocked, no state\n' +
    '\n' +
    'No actionable work — every PRD is in flight and every TASK is blocked or in progress.\n';
  assert.equal(out, expected);
});

test('dashboard trailing suggestion: blocked-skip fixture falls through to R4 needs-triage and emits /interview #N — ready for /interview', () => {
  const out = dashboardOf('./fixtures/suggester-blocked-skip.js');
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'needs-triage:\n' +
    '  #700 PRD: needs triage\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #700: PRD: needs triage ---\n' +
    '└── #710 [ai-ready, blocked] TASK: blocked ready\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '  #710 TASK: blocked ready\n' +
    '\n' +
    'Suggested next: /interview #700 — ready for /interview\n';
  assert.equal(out, expected);
});

test('renderSuggestionSentence: R1 human-in-progress omits the slash command and uses resume', () => {
  const candidate = {
    number: 99,
    title: 'TASK: human in progress',
    labels: [{ name: 'task' }, { name: 'human-in-progress' }],
  };
  const suggestion = {
    rule: 'R1',
    candidate,
    meta: { state: 'human-in-progress' },
  };
  assert.equal(
    renderSuggestionSentence(suggestion),
    'Suggested next: #99 — resume\n',
  );
});

test('renderSuggestionSentence: R2 human-ready omits the slash command', () => {
  const candidate = {
    number: 88,
    title: 'TASK: human ready',
    labels: [{ name: 'task' }, { name: 'human-ready' }],
  };
  const suggestion = {
    rule: 'R2',
    candidate,
    meta: { parentPrd: 80, downstreamCount: 0 },
  };
  assert.equal(
    renderSuggestionSentence(suggestion),
    'Suggested next: #88 — unblocks 0 downstream TASKs\n',
  );
});

test('renderSuggestionSentence: R3 with null parentPrd omits the root-of-PRD clause', () => {
  const candidate = {
    number: 77,
    title: 'TASK: orphan',
    labels: [{ name: 'task' }, { name: 'ai-ready' }],
  };
  const suggestion = {
    rule: 'R3',
    candidate,
    meta: { parentPrd: null, downstreamCount: 4 },
  };
  assert.equal(
    renderSuggestionSentence(suggestion),
    'Suggested next: /implement #77 — unblocks 4 downstream TASKs\n',
  );
});

test('renderStaleWorktreesSection: surfaces a worktree whose branch maps to a closed issue', () => {
  const worktrees = [{ path: '/tmp/wt-118', branch: '118-some-slug' }];
  const openNumbers = new Set([42, 119]); // 118 is NOT open → stale
  assert.equal(
    renderStaleWorktreesSection(worktrees, openNumbers),
    '=== Stale worktrees ===\n\n  #118 118-some-slug\n    git worktree remove /tmp/wt-118\n\n',
  );
});

test('renderStaleWorktreesSection: surfaces every stale worktree, one block each', () => {
  const worktrees = [
    { path: '/tmp/wt-118', branch: '118-some-slug' },
    { path: '/tmp/wt-7', branch: '7-other-slug' },
  ];
  const openNumbers = new Set([42]); // neither 118 nor 7 is open → both stale
  assert.equal(
    renderStaleWorktreesSection(worktrees, openNumbers),
    '=== Stale worktrees ===\n\n' +
      '  #118 118-some-slug\n    git worktree remove /tmp/wt-118\n\n' +
      '  #7 7-other-slug\n    git worktree remove /tmp/wt-7\n\n',
  );
});

// Locking/characterization tests (SUBTASKs 2–4). The behaviors below are
// already implemented by `renderStaleWorktreesSection`; these tests pin them
// against regression. They are expected to pass on arrival.

test('renderStaleWorktreesSection: omits an active worktree whose number is still open', () => {
  // Branch matches `<N>-<slug>` but `118` IS open → worktree is still active,
  // so it is omitted and the section produces no header (empty string).
  const worktrees = [{ path: '/tmp/wt-118', branch: '118-some-slug' }];
  const openNumbers = new Set([118, 42]);
  assert.equal(renderStaleWorktreesSection(worktrees, openNumbers), '');
});

test('renderStaleWorktreesSection: ignores a branch with no leading-number pattern', () => {
  const worktrees = [{ path: '/tmp/wt-main', branch: 'main' }];
  const openNumbers = new Set([]);
  assert.equal(renderStaleWorktreesSection(worktrees, openNumbers), '');
});

test('renderStaleWorktreesSection: ignores a detached worktree with a null branch', () => {
  // `RegExp.exec(null)` coerces `null` to the string `"null"`, which has no
  // leading digit and therefore fails the `^(\d+)-.+` pattern — so a detached
  // (null-branch) worktree is correctly ignored.
  const worktrees = [{ path: '/tmp/wt-detached', branch: null }];
  const openNumbers = new Set([]);
  assert.equal(renderStaleWorktreesSection(worktrees, openNumbers), '');
});

test('renderStaleWorktreesSection: ignores a bare `<N>-` branch with an empty slug (ADV-2)', () => {
  // The `^(\d+)-.+` regex requires a non-empty slug via `.+`, so `42-` with
  // nothing after the dash does not qualify even though `42` is not open.
  const worktrees = [{ path: '/tmp/wt-42', branch: '42-' }];
  const openNumbers = new Set([]);
  assert.equal(renderStaleWorktreesSection(worktrees, openNumbers), '');
});

test('renderStaleWorktreesSection: returns empty string for an empty worktree list', () => {
  assert.equal(renderStaleWorktreesSection([], new Set([42, 118])), '');
});

test('renderStaleWorktreesSection: returns empty string when only active and non-matching worktrees are present', () => {
  // One active (`118` open), one non-matching (`main`) → zero stale → no header.
  const worktrees = [
    { path: '/tmp/wt-118', branch: '118-some-slug' },
    { path: '/tmp/wt-main', branch: 'main' },
  ];
  const openNumbers = new Set([118]);
  assert.equal(renderStaleWorktreesSection(worktrees, openNumbers), '');
});

test('renderStaleWorktreesSection: in a mixed list, surfaces only the stale worktree block', () => {
  // `7` is stale (not open, matching slug); `118` is active (open); `main`
  // is non-matching. Only the `7` block is emitted, proving the filter selects
  // correctly and the spacing contract (header + two-line block + trailing
  // blank) holds.
  const worktrees = [
    { path: '/tmp/wt-118', branch: '118-active-slug' },
    { path: '/tmp/wt-7', branch: '7-stale-slug' },
    { path: '/tmp/wt-main', branch: 'main' },
  ];
  const openNumbers = new Set([118]);
  assert.equal(
    renderStaleWorktreesSection(worktrees, openNumbers),
    '=== Stale worktrees ===\n\n  #7 7-stale-slug\n    git worktree remove /tmp/wt-7\n\n',
  );
});

// Unit tests for `parseWorktreePorcelain` (SUBTASK 5). The pure parser turns
// `git worktree list --porcelain` stdout into `{ path, branch }` records; these
// pin its block-splitting, `refs/heads/` stripping, detached-HEAD null branch,
// ordering, and trailing-blank-line tolerance.

test('parseWorktreePorcelain: parses a single branch worktree, stripping refs/heads/', () => {
  const stdout =
    'worktree /repo/wt-118\n' +
    'HEAD 1111111111111111111111111111111111111111\n' +
    'branch refs/heads/118-some-slug\n';
  assert.deepEqual(parseWorktreePorcelain(stdout), [
    { path: '/repo/wt-118', branch: '118-some-slug' },
  ]);
});

test('parseWorktreePorcelain: maps a detached worktree (no branch line) to branch null', () => {
  const stdout =
    'worktree /repo/wt-detached\n' +
    'HEAD 2222222222222222222222222222222222222222\n' +
    'detached\n';
  assert.deepEqual(parseWorktreePorcelain(stdout), [
    { path: '/repo/wt-detached', branch: null },
  ]);
});

test('parseWorktreePorcelain: parses multiple blocks in input order', () => {
  const stdout =
    'worktree /repo/main\n' +
    'HEAD 3333333333333333333333333333333333333333\n' +
    'branch refs/heads/main\n' +
    '\n' +
    'worktree /repo/wt-7\n' +
    'HEAD 4444444444444444444444444444444444444444\n' +
    'branch refs/heads/7-other-slug\n' +
    '\n' +
    'worktree /repo/wt-detached\n' +
    'HEAD 5555555555555555555555555555555555555555\n' +
    'detached\n';
  assert.deepEqual(parseWorktreePorcelain(stdout), [
    { path: '/repo/main', branch: 'main' },
    { path: '/repo/wt-7', branch: '7-other-slug' },
    { path: '/repo/wt-detached', branch: null },
  ]);
});

test('parseWorktreePorcelain: tolerates a trailing blank line (no empty record)', () => {
  const stdout =
    'worktree /repo/main\n' +
    'HEAD 6666666666666666666666666666666666666666\n' +
    'branch refs/heads/main\n' +
    '\n';
  assert.deepEqual(parseWorktreePorcelain(stdout), [
    { path: '/repo/main', branch: 'main' },
  ]);
});

test('parseWorktreePorcelain: drops a non-empty block that lacks a worktree line (ADV-4)', () => {
  // A malformed block with no `worktree <path>` line (e.g. a stray HEAD/branch
  // pair with no preceding `worktree` line) carries no real worktree path, so
  // the parser must drop it entirely rather than emit a `{ path: null, ... }`
  // record. The contract is "one record per REAL worktree".
  const stdout =
    'worktree /repo/wt-118\n' +
    'HEAD 7777777777777777777777777777777777777777\n' +
    'branch refs/heads/118-some-slug\n' +
    '\n' +
    'HEAD 8888888888888888888888888888888888888888\n' +
    'branch refs/heads/foo\n';
  assert.deepEqual(parseWorktreePorcelain(stdout), [
    { path: '/repo/wt-118', branch: '118-some-slug' },
  ]);
});

// Full-dashboard wiring snapshot (SUBTASK 5). Proves `runDashboard` calls the
// injected `worktreeFetcher` seam and inserts the stale section AFTER `Blocked`
// and BEFORE `Suggested next:`. Reuses the R2 fixture (open numbers 70, 71, 80)
// with an injected worktree on `999-orphan-task` (999 ∉ open) so it surfaces.
test('dashboard wiring: injected stale worktree appears after Blocked and before Suggested next', () => {
  const issues = require('./fixtures/suggester-r2-ready-over-prd.js');
  const out = runDashboard({
    fetcher: () => issues,
    worktreeFetcher: () => [{ path: '/tmp/wt-999', branch: '999-orphan-task' }],
  });
  const expected =
    '=== Currently in flight ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== PRDs by state ===\n' +
    '\n' +
    'needs-triage:\n' +
    '  #71 PRD: epsilon\n' +
    '\n' +
    'in-backlog:\n' +
    '  #70 PRD: delta\n' +
    '\n' +
    '=== TASKs by parent PRD ===\n' +
    '\n' +
    '--- PRD #70: PRD: delta ---\n' +
    '└── #80 [ai-ready] TASK: ready and unblocked\n' +
    '\n' +
    '=== Blocked ===\n' +
    '\n' +
    '(none)\n' +
    '\n' +
    '=== Stale worktrees ===\n' +
    '\n' +
    '  #999 999-orphan-task\n' +
    '    git worktree remove /tmp/wt-999\n' +
    '\n' +
    'Suggested next: /implement #80 — unblocks 0 downstream TASKs\n';
  assert.equal(out, expected);
});
