/**
 * Animation.js
 * Minimal keyframe animation system for box-model parts.
 *
 * A model definition may carry an `anims` object:
 *
 *   anims: {
 *     walk: {
 *       duration: 0.8,          // seconds for one full pass
 *       loop: true,             // default true; one-shot clips use loop:false
 *       tracks: {
 *         armL: [ { t: 0, rot: [0,0,0] }, { t: 0.5, rot: [1,0,0] }, ... ],
 *       },
 *     },
 *   }
 *
 * - Tracks are keyed by part name (the `name` on a model element) or the
 *   special name "root" (the model's Group itself).
 * - Each keyframe has a normalised time `t` in [0,1] and any of:
 *     pos: [x,y,z]   — offset added to the part's rest position
 *     rot: [x,y,z]   — Euler offset (radians) added to the part's rest rotation
 *     scale: [x,y,z] — absolute scale
 *   Values are applied relative to the part's rest pose captured at
 *   construction, so clips only need to describe *deltas* (e.g. a small
 *   recoil kick) rather than absolute transforms.
 * - Channels that a keyframe omits are held at rest.
 */

export class Animator {
  /**
   * @param {THREE.Object3D} root - the model group returned by buildModel().
   * @param {object} clips - { [name]: { duration, loop?, tracks } }
   */
  constructor(root, clips = {}) {
    this.root = root;
    this.clips = clips || {};
    this.active = null;
    this.time = 0;
    this._speed = 1;
    this._onEnd = null;

    // Snapshot rest pose for every referenced part so clips can be
    // expressed as small deltas and stop() can restore things cleanly.
    this._rest = new Map();
    this._partCache = new Map();
    const names = new Set(['root']);
    for (const clip of Object.values(this.clips)) {
      for (const part of Object.keys(clip.tracks || {})) names.add(part);
    }
    for (const name of names) {
      const obj = this._part(name);
      if (!obj) continue;
      this._rest.set(name, {
        pos: obj.position.clone(),
        rot: obj.rotation.clone(),
        scale: obj.scale.clone(),
      });
    }
    // Pre-split pos/rot/scale keyframes and pin part refs so update()
    // never filter()s or walks the tree (late-round horde cost).
    this._compiled = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const tracks = [];
      for (const [part, keys] of Object.entries(clip.tracks || {})) {
        const obj = this._part(part);
        if (!obj) continue;
        tracks.push({
          name: part,
          obj,
          pos: keys.filter((k) => Array.isArray(k.pos)),
          rot: keys.filter((k) => Array.isArray(k.rot)),
          scale: keys.filter((k) => Array.isArray(k.scale)),
        });
      }
      this._compiled[name] = { duration: clip.duration, tracks };
    }
    this._chPos = [0, 0, 0];
    this._chRot = [0, 0, 0];
    this._chScl = [0, 0, 0];
  }

  _part(name) {
    if (this._partCache.has(name)) return this._partCache.get(name);
    const obj = name === 'root' ? this.root : this.root.getObjectByName(name);
    this._partCache.set(name, obj || null);
    return obj;
  }

  /** Start (or restart) a named clip. No-op if the clip is unknown. */
  play(name, { loop, speed = 1, onEnd } = {}) {
    const clip = this.clips[name];
    if (!clip) return;
    if (this.active && this.active !== name) this._resetClip(this.clips[this.active]);
    this.active = name;
    this.time = 0;
    this._loop = loop !== undefined ? loop : clip.loop !== false;
    this._speed = speed;
    this._onEnd = onEnd || null;
    this._apply(0);
  }

  /** Stop the active clip and restore its parts to their rest pose. */
  stop() {
    if (this.active) this._resetClip(this.clips[this.active]);
    this.active = null;
    this.time = 0;
    this._onEnd = null;
  }

  /**
   * Re-snapshot the rest pose of given parts (or all tracked parts).
   * Call this when a part's transform changes outside of a clip — e.g. a
   * character that moved via AI before playing a clip that targets 'root'.
   */
  captureRest(...names) {
    const set = names.length ? new Set(names) : this._rest.keys();
    for (const name of set) {
      const obj = this._part(name);
      if (!obj) continue;
      this._rest.set(name, {
        pos: obj.position.clone(),
        rot: obj.rotation.clone(),
        scale: obj.scale.clone(),
      });
    }
  }

  get playing() {
    return this.active !== null;
  }

  /** Advance the active clip by dt seconds. No-op when idle. */
  update(dt) {
    if (!this.active) return;
    const clip = this.clips[this.active];
    if (!clip) {
      this.active = null;
      return;
    }
    this.time += dt * this._speed;

    if (this._loop) {
      const dur = clip.duration;
      this._apply(((this.time % dur) + dur) % dur / dur);
      return;
    }

    if (this.time >= clip.duration) {
      this._apply(1);
      const cb = this._onEnd;
      this.active = null;
      this._onEnd = null;
      if (cb) cb();
      return;
    }
    this._apply(this.time / clip.duration);
  }

  _resetClip(clip) {
    for (const name of Object.keys(clip.tracks || {})) {
      const obj = this._part(name);
      const rest = this._rest.get(name);
      if (!obj || !rest) continue;
      obj.position.copy(rest.pos);
      obj.rotation.copy(rest.rot);
      obj.scale.copy(rest.scale);
    }
  }

  _apply(tNorm) {
    const compiled = this._compiled[this.active];
    if (!compiled) return;
    for (const tr of compiled.tracks) {
      const rest = this._rest.get(tr.name);
      if (!tr.obj || !rest) continue;

      if (this._channel(tr.pos, 'pos', tNorm, this._chPos)) {
        tr.obj.position.set(rest.pos.x + this._chPos[0], rest.pos.y + this._chPos[1], rest.pos.z + this._chPos[2]);
      }
      if (this._channel(tr.rot, 'rot', tNorm, this._chRot)) {
        tr.obj.rotation.set(rest.rot.x + this._chRot[0], rest.rot.y + this._chRot[1], rest.rot.z + this._chRot[2]);
      }
      if (this._channel(tr.scale, 'scale', tNorm, this._chScl)) {
        tr.obj.scale.set(this._chScl[0], this._chScl[1], this._chScl[2]);
      }
    }
  }

  // Interpolate a pre-split channel at normalised time t into `out`.
  // Returns out, or null if the track has no keyframes for this channel.
  _channel(kfs, key, t, out) {
    if (!kfs || kfs.length === 0) return null;
    if (t <= kfs[0].t) {
      const v = kfs[0][key];
      out[0] = v[0]; out[1] = v[1]; out[2] = v[2];
      return out;
    }
    const last = kfs[kfs.length - 1];
    if (t >= last.t) {
      const v = last[key];
      out[0] = v[0]; out[1] = v[1]; out[2] = v[2];
      return out;
    }
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i];
      const b = kfs[i + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        const f = span > 1e-6 ? (t - a.t) / span : 1;
        const av = a[key];
        const bv = b[key];
        out[0] = av[0] + (bv[0] - av[0]) * f;
        out[1] = av[1] + (bv[1] - av[1]) * f;
        out[2] = av[2] + (bv[2] - av[2]) * f;
        return out;
      }
    }
    const v = last[key];
    out[0] = v[0]; out[1] = v[1]; out[2] = v[2];
    return out;
  }
}
