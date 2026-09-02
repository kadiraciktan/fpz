import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSIONS,
  OBJECTIVE_TYPES,
  INTERACT_RADIUS,
  getMission,
  missionIndex,
  nextMission,
  missionUnlocked,
  firstUnfinishedMission,
  createMissionRun,
  currentObjective,
  isMissionDone,
  objectiveHudText,
  objectiveProgressText,
  noteKill,
  noteRoundCleared,
  noteHold,
  noteInteract,
} from '../src/game/missions.js';

const KNOWN_MAPS = new Set([
  'street',
  'factory',
  'bunker',
  'nacht',
  'konvoy',
  'montaj',
  'reaktor',
  'sunak',
]);

test('campaign data is valid', () => {
  assert.equal(MISSIONS.length, 4);
  const ids = new Set();
  for (const m of MISSIONS) {
    assert.ok(!ids.has(m.id), `unique id: ${m.id}`);
    ids.add(m.id);
    assert.ok(m.name && m.brief.length && m.outro.length, `${m.id}: story text present`);
    assert.ok(KNOWN_MAPS.has(m.mapId), `${m.id}: known map`);
    assert.ok(m.rewardXp > 0);
    assert.ok(m.objectives.length >= 3, `${m.id}: at least 3 objectives`);
    for (const obj of m.objectives) {
      assert.ok(OBJECTIVE_TYPES.includes(obj.type), `${m.id}: type ${obj.type}`);
      if (obj.type === 'kill') assert.ok(obj.count > 0);
      if (obj.type === 'survive') assert.ok(obj.rounds > 0);
      if (obj.type === 'hold') assert.ok(obj.seconds > 0 && obj.radius > 0 && obj.marker);
      if (obj.type === 'interact') {
        assert.ok(obj.marker && obj.marker.title, `${m.id}: interact needs a marker`);
      }
    }
  }
});

test('getMission / missionIndex / nextMission chain the campaign', () => {
  assert.equal(getMission('nope'), null);
  assert.equal(missionIndex(MISSIONS[0].id), 0);
  for (let i = 0; i < MISSIONS.length - 1; i++) {
    assert.equal(nextMission(MISSIONS[i].id).id, MISSIONS[i + 1].id);
  }
  assert.equal(nextMission(MISSIONS[MISSIONS.length - 1].id), null, 'finale has no next');
});

test('sequential gate: only the next bölüm is unlockable', () => {
  assert.equal(missionUnlocked(0, []), true);
  assert.equal(missionUnlocked(1, []), false);
  assert.equal(missionUnlocked(1, [MISSIONS[0].id]), true);
  assert.equal(missionUnlocked(2, [MISSIONS[0].id]), false);
});

test('firstUnfinishedMission returns the campaign entry point', () => {
  assert.equal(firstUnfinishedMission([]).id, MISSIONS[0].id);
  assert.equal(firstUnfinishedMission([MISSIONS[0].id]).id, MISSIONS[1].id);
  assert.equal(firstUnfinishedMission(MISSIONS.map((m) => m.id)), null, 'all done: no entry');
});

test('kill objective counts kills and completes exactly at the threshold', () => {
  const m = { objectives: [{ type: 'kill', count: 2 }] };
  const run = createMissionRun(m);
  assert.equal(noteKill(m, run, 'normal'), null);
  assert.equal(run.progress, 1);
  const done = noteKill(m, run, 'normal');
  assert.equal(done.type, 'kill');
  assert.equal(run.step, 1);
  assert.equal(isMissionDone(run), true);
});

test('killBoss objective only accepts boss kills', () => {
  const m = { objectives: [{ type: 'killBoss' }] };
  const run = createMissionRun(m);
  for (let i = 0; i < 5; i++) assert.equal(noteKill(m, run, 'brute'), null);
  assert.equal(run.progress, 0);
  assert.ok(noteKill(m, run, 'boss'));
  assert.equal(isMissionDone(run), true);
});

test('survive objective counts cleared waves', () => {
  const m = { objectives: [{ type: 'survive', rounds: 2 }] };
  const run = createMissionRun(m);
  assert.equal(noteKill(m, run, 'normal'), null, 'kills do not feed survive');
  assert.equal(noteRoundCleared(m, run), null);
  assert.equal(run.progress, 1);
  assert.ok(noteRoundCleared(m, run));
  assert.equal(isMissionDone(run), true);
});

test('hold objective ticks only while the player is inside the ring', () => {
  const m = { objectives: [{ type: 'hold', seconds: 3, radius: 8, marker: { x: 0, z: 0, title: 'X' } }] };
  const run = createMissionRun(m);
  noteHold(m, run, 1, false);
  assert.equal(run.progress, 0, 'outside the ring: no tick');
  noteHold(m, run, 2, true);
  assert.equal(run.progress, 2);
  assert.ok(noteHold(m, run, 1.5, true));
  assert.equal(isMissionDone(run), true);
});

test('interact completes once and moves to the next objective', () => {
  const m = { objectives: [{ type: 'interact', marker: { x: 1, z: 2, title: 'TELSIZ' } }, { type: 'kill', count: 1 }] };
  const run = createMissionRun(m);
  const done = noteInteract(m, run);
  assert.equal(done.type, 'interact');
  assert.equal(currentObjective(m, run).type, 'kill');
  assert.equal(noteInteract(m, run), null, 'E no longer feeds a kill objective');
  assert.ok(noteKill(m, run, 'normal'));
  assert.equal(isMissionDone(run), true);
});

test('a completed objective advances multi-objective runs step by step', () => {
  const m = { objectives: [{ type: 'kill', count: 1 }, { type: 'survive', rounds: 1 }] };
  const run = createMissionRun(m);
  assert.ok(noteKill(m, run, 'sprinter'));
  assert.equal(run.step, 1);
  assert.equal(run.progress, 0, 'progress resets per objective');
  assert.ok(noteRoundCleared(m, run), 'one wave is enough for rounds:1');
  assert.equal(isMissionDone(run), true);
  assert.equal(currentObjective(m, run), null, 'no objective after the finale');
});

test('HUD strip renders label + progress', () => {
  const mission = getMission('kayip-sinyal');
  const run = createMissionRun(mission);
  const line = objectiveHudText(mission, run);
  assert.ok(line.startsWith('◎ HEDEF 1/4'), line);
  assert.ok(line.includes('25'), line);
  assert.equal(objectiveProgressText(mission, run), '0/25');
  noteKill(mission, run, 'normal');
  assert.equal(objectiveProgressText(mission, run), '1/25');
});

test('INTERACT_RADIUS is a sane interaction distance', () => {
  assert.ok(INTERACT_RADIUS >= 1.5 && INTERACT_RADIUS <= 3.5);
});

test('every bölüm carries a kill or survive objective early on', () => {
  for (const m of MISSIONS) {
    const early = m.objectives.slice(0, 2).some((o) => o.type === 'kill' || o.type === 'survive');
    assert.ok(early, `${m.id}: combat first`);
  }
});
