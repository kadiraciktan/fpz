/**
 * game/missions.js
 * Mission mode: story campaign data + a PURE objective state machine.
 * No THREE / DOM here — the run state is a plain object mutated by the
 * note* functions; main.js feeds kills / rounds / hold ticks / interacts
 * in and gets the completed objective (or null) back. Unit-tested.
 */

export const OBJECTIVE_TYPES = ['survive', 'kill', 'interact', 'hold', 'killBoss'];
export const INTERACT_RADIUS = 2.4;

/** Story campaign — "OPERASYON: SON NEFES". Sequential: each bölüm bir
 *  önceki görevin sonunda açılır, haritayı da birlikte getirir. */
export const MISSIONS = [
  {
    id: 'kayip-sinyal',
    name: 'KAYIP SİNYAL',
    mapId: 'konvoy',
    color: '#ff8a65',
    brief: [
      '> MERKEZ // TACİZ RAPORU: Sokağın kuzeyi 36 saattir sessiz.',
      '> Senin tim telsiz menzilinin dışında. İleri üs: terk edilmiş hat.',
      '> Görev: Seyyar vericiyi kur, frekansı yakala, yayını 45 sn canlı tut.',
      '> Önce sokak temizlenecek — onlar seni bekliyor.',
    ],
    objectives: [
      { type: 'kill', count: 25, intro: 'Sokağı temizle — 25 zombi.' },
      {
        type: 'interact',
        intro: 'Telsiz vericisi kuzey meydanında — kapıları kır, git ve kur.',
        marker: { x: 0, z: 56, title: 'TELSİZ VERİCİSİ', sub: 'E · KUR' },
      },
      {
        type: 'hold',
        seconds: 45, radius: 8,
        intro: 'Verici eleniyor! Yayın bitene kadar antenin yanında kal.',
        marker: { x: 0, z: 56, title: 'VERİCİ', sub: 'ALANDA KAL' },
      },
      { type: 'survive', rounds: 2, intro: 'Yayın merkezi ulaştı — onlar da duydu. 2 dalgaya katlan.' },
    ],
    outro: [
      '> MERKEZ: Yayın alındı... iyi ki açtınız.',
      '> Frekanstaki otomatik tekrar: Fabrika jeneratörü hâlâ çalışıyor.',
      '> Bir şey, fabrikayı kendi kendine çalıştırıyor gibi görünüyor.',
      '> Yeni hedef: TERK EDİLMİŞ FABRİKA — kontrol odası.',
    ],
    rewardXp: 100,
  },
  {
    id: 'uretim-hatti',
    name: 'ÜRETİM HATTI',
    mapId: 'montaj',
    color: '#ffb74d',
    brief: [
      '> FABRİKA // OTOMATİK YAYIN: "ÜRETİM... SÜRÜYOR... ÜRETİM... SÜRÜYOR..."',
      '> Hat boş çalışıyor. Bantların üstünde taşıdıkları şey cephane değil.',
      '> Görev: Redaktör reaktörünün anahtarını kontrol odasından al.',
      '> Anahtar olmadan sığınak kapısı açılmaz — ve artık hepimiz için geç.',
    ],
    objectives: [
      { type: 'kill', count: 30, intro: 'Hangarı temizle — 30 zombi.' },
      { type: 'survive', rounds: 2, intro: 'Hat onları çekiyor. 2 dalga daha.' },
      { type: 'killBoss', intro: 'Hattan çıkan şey normalden farklı — PATRON geliyor!' },
      {
        type: 'hold',
        seconds: 30, radius: 7,
        intro: 'Kuzeydeki kontrol odasında anahtarı al — 30 sn savun, sistem kilitlensin.',
        marker: { x: 0, z: 90, title: 'KONTROL ODASI', sub: 'ALANDA KAL' },
      },
    ],
    outro: [
      '> ANAHTAR ALINDI. Sığınak kapı kodları değişmiş — manuel gerekiyor.',
      '> Merdivenler aşağı iniyor. Aşağısı karanlık.',
      '> Yeni hedef: YERALTI SIĞINAĞI.',
    ],
    rewardXp: 150,
  },
  {
    id: 'karanlikta-inis',
    name: 'KARANLIKTA İNİŞ',
    mapId: 'reaktor',
    color: '#4fc3f7',
    brief: [
      '> SIĞINAK // ACİL DURUM PROTOKOLÜ: Reaktör odası çevresinde hareket.',
      '> Işıklar gitmiş. Jeneratör dizel için ölüyor, karanlıkta görüş sıfır.',
      '> Görev: Reaktörü yeniden döndür, lambaları geri getir.',
      '> Sonra içeridekilere gösterme — kapıyı kapat, onları dışarıda beklet.',
    ],
    objectives: [
      { type: 'survive', rounds: 2, intro: 'Karanlıkta 2 dalga — lambalara sıkı tutun.' },
      { type: 'kill', count: 35, intro: 'Koridoru temizle — 35 zombi.' },
      {
        type: 'hold',
        seconds: 40, radius: 7,
        intro: 'Reaktör çevresinde 40 sn — döngü haneleri tamamlasın.',
        marker: { x: 0, z: 79, title: 'REAKTÖR', sub: 'ALANDA KAL' },
      },
      { type: 'killBoss', intro: 'Reaktörün ısısı onları çağırdı. Patron içeride.' },
    ],
    outro: [
      '> LAMBALAR YANDI. Ve ışıkta görmek istemeyeceğin şeyleri gördün.',
      '> Sıhınak dip merdiveni nefes alıyor — soğuk, rutubetli bir nefes.',
      '> Bu merdiven aşağı inmiyor. YUKARI çıkıyor.',
      '> Yeni hedef: NACHT DER UNTOTEN.',
    ],
    rewardXp: 200,
  },
  {
    id: 'nacht-der-untoten',
    name: 'NACHT DER UNTOTEN',
    mapId: 'sunak',
    color: '#b39ddb',
    brief: [
      '> KAYIT DIŞI // GÜNLÜKTEN: "Bizi karanlıkta çağıran bir ses var."',
      '> Odalar onları besliyor. Ses kesilmezse bu ev kimseyi bırakmaz.',
      '> Görev: Sunağı sustur. Patronu sustur. Sesı kes.',
      '> Bu, operasyonun son bölümü. Dönüş yok.',
    ],
    objectives: [
      { type: 'kill', count: 30, intro: 'Bahçeyi temizle — 30 zombi.' },
      {
        type: 'interact',
        intro: 'Şapeldeki sunağı bul ve mühürle.',
        marker: { x: 0, z: 60, title: 'SUNAK', sub: 'E · MÜHÜRLE' },
      },
      { type: 'killBoss', intro: 'Sunağın öcüsü uyandı — PATRON içeride.' },
      { type: 'hold', seconds: 50, radius: 8, intro: 'Mühür haneleri 50 sn. Kriptada, sunağın altında tut.', marker: { x: 0, z: 80, title: 'MÜHÜR', sub: 'ALANDA KAL' } },
      { type: 'survive', rounds: 2, intro: 'Son dalga. İki dalga. Ses kesilmeden.' },
    ],
    outro: [
      '> SES... kesildi.',
      '> Sokağın kuzeyi sessiz. Ama bu seferki dolu bir sessizlik.',
      '> OPERASYON: SON NEFES — TAMAMLANDI.',
      '> Hayatta kalan tek kişisin. Merkez bunu kayıtlara geçti.',
    ],
    rewardXp: 300,
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function missionIndex(id) {
  return MISSIONS.findIndex((m) => m.id === id);
}

/** The next bölüm, or null after the finale. */
export function nextMission(id) {
  const i = missionIndex(id);
  return i === -1 || i + 1 >= MISSIONS.length ? null : MISSIONS[i + 1];
}

/** Sequential gate: bölüm 0 is always open, the rest need the previous done. */
export function missionUnlocked(index, completedIds) {
  if (index <= 0) return true;
  const prev = MISSIONS[index - 1];
  return !!prev && completedIds.includes(prev.id);
}

/** First (sequential) unfinished bölüm — the natural campaign entry point. */
export function firstUnfinishedMission(completedIds) {
  return MISSIONS.find((m) => !completedIds.includes(m.id)) || null;
}

// ── Objective state machine ───────────────────────────────────────────
// run = { missionId, step, progress, done }. All note* functions return
// the objective that just COMPLETED (already advanced), else null.

export function createMissionRun(mission) {
  return { missionId: mission.id, step: 0, progress: 0, done: false };
}

export function isMissionDone(run) {
  return !!run && run.done;
}

export function currentObjective(mission, run) {
  if (!mission || !run || run.done) return null;
  return mission.objectives[run.step] || null;
}

function objectiveLabel(obj) {
  switch (obj.type) {
    case 'survive': return `${obj.rounds} dalga katlan`;
    case 'kill': return `${obj.count} zombi temizle`;
    case 'interact': return `${obj.marker.title} kur`;
    case 'hold': return `${obj.seconds} sn bölgeyi koru`;
    case 'killBoss': return 'PATRONU ÖLDÜR';
    default: return obj.type;
  }
}

/** Plain-text progress counter for the HUD ("30/45 sn", "12/25", ...). */
export function objectiveProgressText(mission, run) {
  const obj = currentObjective(mission, run);
  if (!obj) return '';
  switch (obj.type) {
    case 'survive': return `${Math.min(run.progress, obj.rounds)}/${obj.rounds} dalga`;
    case 'kill': return `${Math.min(run.progress, obj.count)}/${obj.count}`;
    case 'interact': return 'E ile kur';
    case 'hold': return `${Math.floor(Math.min(run.progress, obj.seconds))}/${obj.seconds} sn`;
    case 'killBoss': return run.progress > 0 ? 'öldürüldü' : 'avlanacak';
    default: return '';
  }
}

/** One-line HUD strip: '◎ HEDEF 2/4 · <label> — <progress>'. */
export function objectiveHudText(mission, run) {
  const obj = currentObjective(mission, run);
  if (!obj) return '';
  const n = Math.min(run.step + 1, mission.objectives.length);
  return `◎ HEDEF ${n}/${mission.objectives.length} · ${objectiveLabel(obj)} — ${objectiveProgressText(mission, run)}`;
}

/** Advance past the completed objective; flips done on the last one. */
function completeObjective(mission, run) {
  const obj = currentObjective(mission, run);
  if (!obj) return null;
  run.step++;
  run.progress = 0;
  if (run.step >= mission.objectives.length) run.done = true;
  return obj;
}

/** Kill credit: 'kill' objectives count anything, 'killBoss' only bosses. */
export function noteKill(mission, run, enemyType) {
  const obj = currentObjective(mission, run);
  if (!obj) return null;
  if (obj.type === 'kill') {
    run.progress++;
    if (run.progress >= obj.count) return completeObjective(mission, run);
  } else if (obj.type === 'killBoss' && enemyType === 'boss') {
    run.progress++;
    return completeObjective(mission, run);
  }
  return null;
}

/** Wave-clear credit for 'survive' objectives. */
export function noteRoundCleared(mission, run) {
  const obj = currentObjective(mission, run);
  if (!obj || obj.type !== 'survive') return null;
  run.progress++;
  if (run.progress >= obj.rounds) return completeObjective(mission, run);
  return null;
}

/** One frame of a 'hold' objective: within = player inside the zone ring. */
export function noteHold(mission, run, dt, within) {
  const obj = currentObjective(mission, run);
  if (!obj || obj.type !== 'hold' || !within) return null;
  run.progress += dt;
  if (run.progress >= obj.seconds) return completeObjective(mission, run);
  return null;
}

/** E on an 'interact' marker (caller checked INTERACT_RADIUS proximity). */
export function noteInteract(mission, run) {
  const obj = currentObjective(mission, run);
  if (!obj || obj.type !== 'interact') return null;
  return completeObjective(mission, run);
}
