'use strict';

// Tests for `suggestNext`. Each test loads a fixture (a small array of
// `gh issue list --json ...`-shaped objects), reconstructs the same
// `graph` object that `runDashboard` builds, and asserts the suggestion
// cascade picks the right candidate with the right rule and meta.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  suggestNext,
  buildDependencyGraph,
  detectCycles,
  buildSubtreeOf,
} = require('./status-dashboard.js');

// Mirrors the `graph` construction inside `runDashboard` so tests
// exercise `suggestNext` with the exact same context the production
// caller will pass.
function buildGraph(issues) {
  const { byNumber, liveBlockers } = buildDependencyGraph(issues);
  const cycles = detectCycles(liveBlockers);
  const cycleNodes = new Set(cycles.flat());
  const subtreeOf = buildSubtreeOf(issues, byNumber, cycleNodes);
  return { byNumber, liveBlockers, subtreeOf, cycleNodes };
}

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
