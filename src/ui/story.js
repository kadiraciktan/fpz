/**
 * ui/story.js
 * Mission-mode story screens: the pre-deployment briefing and the mission
 * outro. Radio-transcript style: lines type in one by one, then the action
 * button lights up. Pure DOM — callers pass mission data + callbacks.
 */

import { MISSIONS, missionIndex } from '../game/missions.js';

export function createStoryScreen() {
  const screenEl = document.getElementById('storyScreen');
  const kickerEl = document.getElementById('storyKicker');
  const titleEl = document.getElementById('storyTitle');
  const linesEl = document.getElementById('storyLines');
  const objectivesEl = document.getElementById('storyObjectives');
  const goBtn = document.getElementById('storyGoBtn');
  const menuBtn = document.getElementById('storyMenuBtn');

  let timers = [];
  let onGo = null;
  let onMenu = null;

  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers = []; };

  /** Radio transcript: reveal one line every ~380 ms. */
  function typewrite(lines) {
    linesEl.textContent = '';
    lines.forEach((line, i) => {
      timers.push(setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'storyLine';
        p.textContent = line;
        linesEl.appendChild(p);
      }, 220 + i * 380));
    });
  }

  function show({ kicker, title, lines, objectives, goLabel, onGo: go, onMenu: back }) {
    clearTimers();
    onGo = go;
    onMenu = back;
    kickerEl.textContent = kicker;
    titleEl.textContent = title;
    titleEl.classList.remove('storyDone');
    typewrite(lines);
    objectivesEl.innerHTML = objectives && objectives.length
      ? `<div class="storyObjHead">📋 HEDEFLER</div>${objectives.map((o) => `<div class="storyObjLine">${o}</div>`).join('')}`
      : '';
    goBtn.textContent = goLabel || '▶ GÖREVE BAŞLA';
    menuBtn.classList.toggle('hidden', !back);
    screenEl.classList.remove('hidden');
  }

  /** Pre-deployment briefing for a bölüm. */
  function showBrief(mission, go) {
    const i = missionIndex(mission.id);
    show({
      kicker: `OPERASYON: SON NEFES · BÖLÜM ${i + 1}/${MISSIONS.length}`,
      title: mission.name,
      lines: mission.brief,
      objectives: mission.objectives.map((o, k) => `${k + 1}. ${objectiveBlurb(o)}`),
      goLabel: '▶ GÖREVE BAŞLA',
      onGo: go,
      onMenu: () => close(),
    });
  }

  /** Post-mission transcript. nextMissionLabel lights the go button. */
  function showOutro(mission, { goLabel, onGo: go, onMenu: back, done = true }) {
    const i = missionIndex(mission.id);
    show({
      kicker: done ? `BÖLÜM ${i + 1}/${MISSIONS.length} · TAMAMLANDI ✔` : 'BÖLÜM RAPORU',
      title: mission.name,
      lines: mission.outro,
      objectives: [],
      goLabel,
      onGo: go,
      onMenu: back,
    });
    if (done) titleEl.classList.add('storyDone');
  }

  function objectiveBlurb(obj) {
    switch (obj.type) {
      case 'kill': return `${obj.count} zombi temizle`;
      case 'survive': return `${obj.rounds} dalga katlan`;
      case 'interact': return `${obj.marker.title} — yaklaşıp E`;
      case 'hold': return `${obj.marker.title}: ${obj.seconds} sn bölgede kal`;
      case 'killBoss': return 'Patronu öldür';
      default: return obj.type;
    }
  }

  function close() {
    clearTimers();
    screenEl.classList.add('hidden');
    onGo = null;
    onMenu = null;
  }

  goBtn?.addEventListener('click', () => {
    const cb = onGo;
    close();
    if (cb) cb();
  });
  menuBtn?.addEventListener('click', () => {
    const cb = onMenu;
    close();
    if (cb) cb();
  });

  return { showBrief, showOutro, close, isVisible: () => !screenEl.classList.contains('hidden') };
}
