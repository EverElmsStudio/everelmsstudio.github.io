// chordApp.js

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM refs ----------
  const keySel = document.getElementById("key");
  const modeSel = document.getElementById("mode");
  const barsSel = document.getElementById("bars");
  const tempoInput = document.getElementById("tempo");
  const progList = document.querySelector("#progressions .prog-list");
  const paletteDiv = document.querySelector("#palette .chords");
  const gridDiv = document.querySelector("#timeline .grid");
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const undoBtn = document.getElementById("undo");
  const resetBtn = document.getElementById("resetGrid");
  const metEnabled = document.getElementById("metEnabled");
  const copyLinkBtn = document.getElementById("copyLink");
  const exportMidiBtn = document.getElementById("exportMidi");

  // state
  let selectedChord = null;     // { id, roman, symbol, notes }
  let paletteMap = new Map();   // id -> chord
  let isStarting = false;       // guard for rapid Play clicks
  let repeatId = null;          // schedule id for repeat loop
  let undoStack = [];           // stack of operations to undo (only "add/fill")
  let pendingSeqFromHash = null;

  // ---------- Popular progressions (emotion-based labels) ----------
  const POPULAR_MAJOR = [
    { name: "Uplifting / Triumphant",     a: ["I","V","vi","IV"],  b: ["vi","IV","I","V"] },
    { name: "Nostalgic / Heartfelt",      a: ["I","vi","IV","V"],  b: ["I","vi","ii","V"] },
    { name: "Tension → Resolution",       a: ["ii","V","I","vi"],  b: ["iii","vi","ii","V"] },
    { name: "Anthemic / Hopeful",         a: ["I","IV","V","IV"],  b: ["vi","IV","I","V"] },
  ];
  const POPULAR_MINOR = [
    { name: "Brooding / Heroic",          a: ["i","♭VII","♭VI","♭VII"], b: ["i","iv","♭VII","♭VI"] },
    { name: "Melancholic / Cinematic",    a: ["i","♭VI","♭VII","i"],    b: ["i","iv","♭VII","i"] },
    { name: "Smoky / Tense (Turnaround)", a: ["iiø","v","i","i"],       b: ["iv","♭VII","i","i"] },
    { name: "Dark Resolve / Descent",     a: ["i","♭VII","♭VI","v"],    b: ["i","iv","v","i"] },
  ];

  function currentPopular() {
    return modeSel.value === "major" ? POPULAR_MAJOR : POPULAR_MINOR;
  }

  function renderProgressions() {
    progList.innerHTML = "";
    const items = currentPopular();
    items.forEach(({ name, a, b }) => {
      const card = document.createElement("div");
      card.className = "prog-card";

      const title = document.createElement("div");
      title.className = "prog-name";
      title.textContent = name;
      card.appendChild(title);

      const makeRow = (label, seq) => {
        const row = document.createElement("div");
        row.className = "prog-row";
        const seqBox = document.createElement("div");
        seqBox.className = "seq";
        const roman = document.createElement("div");
        roman.className = "roman";
        roman.textContent = seq.join(" – ");
        const symbols = document.createElement("div");
        symbols.className = "symbols";
        symbols.textContent = seq.map(r => paletteMap.get(r)?.symbol || r).join(" · ");
        seqBox.appendChild(roman);
        seqBox.appendChild(symbols);

        const btn = document.createElement("button");
        btn.className = "btn-small";
        btn.textContent = `Place ${label}`;
        btn.addEventListener("click", () => {
          placeProgression(seq);
        });

        row.appendChild(seqBox);
        row.appendChild(btn);
        return row;
      };

      card.appendChild(makeRow("A", a));
      card.appendChild(makeRow("B", b));
      progList.appendChild(card);
    });
  }

  function placeProgression(seqRoman) {
    const allSlots = Array.from(gridDiv.querySelectorAll(".slot"));
    let startIdx = allSlots.findIndex(s => !s.dataset.chordId);
    if (startIdx === -1) startIdx = 0;

    const changes = [];
    for (let i = 0; i < seqRoman.length; i++) {
      const r = seqRoman[i];
      const chord = paletteMap.get(r);
      const slot = allSlots[startIdx + i];
      if (!slot || !chord) break;
      changes.push(snapshotSlot(slot));
      applyChordToSlot(slot, chord);
    }
    if (changes.length) {
      pushUndo({ type: "place", changes });
      updateUrlHash();
    }
  }

  // ---------- GRID ----------
  generateGrid(parseInt(barsSel.value, 10));
  barsSel.addEventListener("change", () => {
    generateGrid(parseInt(barsSel.value, 10));
    updateUrlHash();
  });

  function generateGrid(bars) {
    gridDiv.innerHTML = "";
    for (let b = 0; b < bars; b++) {
      const wrap = document.createElement("div");
      wrap.className = "bar-wrap";

      const header = document.createElement("div");
      header.className = "bar-header";

      const label = document.createElement("div");
      label.className = "bar-label";
      label.textContent = `Bar ${b + 1}`;
      header.appendChild(label);
      wrap.appendChild(header);

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.dataset.barIndex = String(b);

      for (let s = 0; s < 4; s++) {
        const slot = document.createElement("div");
        slot.className = "slot";
        slot.textContent = "—";
        slot.dataset.slot = String(s);

        // left-click: place selected chord (shift = fill to end of bar)
        slot.addEventListener("click", (e) => {
          if (!selectedChord) return;

          const fillCount = e.shiftKey ? (4 - s) : 1;
          const changes = [];
          for (let k = 0; k < fillCount; k++) {
            const target = bar.children[s + k];
            changes.push(snapshotSlot(target));
            applyChordToSlot(target, selectedChord);
          }
          pushUndo({ type: "place", changes });
          updateUrlHash();
        });

        // right-click: clear (not in undo stack by design)
        slot.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          clearSlot(slot);
          updateUrlHash();
        });

        bar.appendChild(slot);
      }

      wrap.appendChild(bar);
      gridDiv.appendChild(wrap);
    }

    if (pendingSeqFromHash) {
      restoreSequenceToGrid(pendingSeqFromHash);
      pendingSeqFromHash = null;
    }
  }

  function applyChordToSlot(slot, chord) {
    slot.textContent = chord.symbol;
    slot.classList.add("filled");
    slot.dataset.chordId = chord.id;
    slot.dataset.notes = JSON.stringify(chord.notes);
  }

  function clearSlot(slot) {
    slot.textContent = "—";
    slot.classList.remove("filled", "playing");
    delete slot.dataset.chordId;
    delete slot.dataset.notes;
  }

  function snapshotSlot(slot) {
    return {
      slot,
      text: slot.textContent,
      hadId: "chordId" in slot.dataset,
      id: slot.dataset.chordId ?? null,
      notes: slot.dataset.notes ?? null,
      filled: slot.classList.contains("filled"),
    };
  }

  function restoreSnapshot(snap) {
    if (!snap.hadId || !snap.id) {
      clearSlot(snap.slot);
      return;
    }
    const chord = paletteMap.get(snap.id);
    if (chord) {
      applyChordToSlot(snap.slot, chord);
    } else {
      snap.slot.textContent = snap.text;
      snap.slot.classList.toggle("filled", snap.filled);
      if (snap.id) snap.slot.dataset.chordId = snap.id; else delete snap.slot.dataset.chordId;
      if (snap.notes) snap.slot.dataset.notes = snap.notes; else delete snap.slot.dataset.notes;
    }
  }

  function pushUndo(op) {
    undoStack.push(op);
    if (undoStack.length > 100) undoStack.shift();
  }

  undoBtn.addEventListener("click", () => {
    const op = undoStack.pop();
    if (!op) return;
    if (op.type === "place") {
      for (let i = op.changes.length - 1; i >= 0; i--) restoreSnapshot(op.changes[i]);
      updateUrlHash();
    }
  });

  // ---------- Reset Grid ----------
  resetBtn.addEventListener("click", () => {
    gridDiv.querySelectorAll(".slot").forEach(clearSlot);
    undoStack = [];
    updateUrlHash();
    clearNowPlayingTile();
  });

  // ---------- PLAYBACK (Tone.js synths) ----------
  const synth = new Tone.PolySynth(Tone.Synth).toDestination();
  synth.volume.value = -12;

  const clickSynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
  }).toDestination();
  clickSynth.volume.value = -24;

  tempoInput.addEventListener("change", () => {
    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    tempoInput.value = bpm;
    if (Tone.Transport.state === "started") {
      Tone.Transport.bpm.rampTo(bpm, 0.1);
    }
    updateUrlHash();
  });

  playBtn.addEventListener("click", async () => {
    if (isStarting) return;
    isStarting = true;
    playBtn.disabled = true;

    try {
      await Tone.start();
      await Tone.loaded();

    } finally {
      isStarting = false;
      playBtn.disabled = false;
    }

    hardStop();

    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    tempoInput.value = bpm;
    Tone.Transport.bpm.value = bpm;

    const bars = gridDiv.querySelectorAll(".bar").length;
    Tone.Transport.loop = true;
    Tone.Transport.loopEnd = `${bars}m`;
    Tone.Transport.position = "0:0:0";

    const { sequence, slotRefs } = collectSequence();
    seq = sequence;
    slotsLinear = slotRefs;

    let i = 0;
    repeatId = Tone.Transport.scheduleRepeat((time) => {
      const idx = i % seq.length;
      const notes = seq[idx];
      const beatInBar = idx % 4;

      if (metEnabled.checked) {
        const tick = beatInBar === 0 ? "C6" : "C5";
        clickSynth.triggerAttackRelease(tick, "16n", time);
      }

      if (notes && notes.length) {
        synth.triggerAttackRelease(notes, "4n", time);
      }

      updatePlayhead(idx);
      i++;
    }, "4n");

    await sleep(150);
    Tone.Transport.start();
  });

  stopBtn.addEventListener("click", () => {
    hardStop();
  });

  function hardStop() {
    if (Tone.Transport.state !== "stopped") {
      Tone.Transport.stop();
    }
    if (repeatId !== null) {
      Tone.Transport.clear(repeatId);
      repeatId = null;
    }
    Tone.Transport.cancel();
    Tone.Transport.position = "0:0:0";
    synth.releaseAll();
    clickSynth.releaseAll?.();
    clearPlayhead();
    clearNowPlayingTile();
  }

  function collectSequence() {
    const slotRefs = [];
    const sequence = [];
    const bars = gridDiv.querySelectorAll(".bar");
    bars.forEach(bar => {
      const slots = bar.querySelectorAll(".slot");
      slots.forEach(slot => {
        slotRefs.push(slot);
        let notes = null;
        if (slot.dataset.notes) {
          try { notes = JSON.parse(slot.dataset.notes); } catch (_) {}
        }
        sequence.push(notes);
      });
    });
    if (sequence.length === 0) sequence.push(null, null, null, null);
    return { sequence, slotRefs };
  }

  // --- Visual helpers
  function updatePlayhead(idx) {
    clearPlayhead();

    const slot = slotsLinear[idx];
    if (slot) slot.classList.add("playing");

    clearNowPlayingTile();
    if (slot && slot.dataset.chordId) {
      const tile = paletteDiv.querySelector(`.tile[data-chord-id="${slot.dataset.chordId}"]`);
      if (tile) tile.classList.add("now-playing");
    }
  }
  function clearPlayhead() {
    document.querySelectorAll(".slot.playing").forEach(s => s.classList.remove("playing"));
  }
  function clearNowPlayingTile() {
    document.querySelectorAll(".tile.now-playing").forEach(t => t.classList.remove("now-playing"));
  }

  // ---------- CHORD PALETTE ----------
  function refreshPalette() {
    try {
      const key = keySel.value;
      const mode = modeSel.value === "major" ? "major" : "natural_minor";
      const palette = buildDiatonicSeventhChords(key, mode);
      paletteMap = new Map(palette.map(c => [c.id, c]));
      paintPalette(palette);
      refreshSlotsFromChordIds();
      renderProgressions();  // refresh progressions & chord-symbol lines
      updateUrlHash();
    } catch (err) {
      const fallback = [
        { id: "I",   roman: "I",   symbol: "Cmaj7", notes:["C2","E3","G3","B3"] },
        { id: "ii",  roman: "ii",  symbol: "Dm7",   notes:["D2","F3","A3","C4"] },
        { id: "iii", roman: "iii", symbol: "Em7",   notes:["E2","G3","B3","D4"] },
        { id: "IV",  roman: "IV",  symbol: "Fmaj7", notes:["F2","A3","C4","E4"] },
        { id: "V",   roman: "V",   symbol: "G7",    notes:["G2","B3","D4","F4"] },
        { id: "vi",  roman: "vi",  symbol: "Am7",   notes:["A2","C3","E3","G3"] },
        { id: "viiø",roman: "viiø",symbol: "Bm7♭5", notes:["B2","D3","F3","A3"] },
      ];
      paletteMap = new Map(fallback.map(c => [c.id, c]));
      paintPalette(fallback);
      refreshSlotsFromChordIds();
      renderProgressions();
      updateUrlHash();
    }
  }

  function paintPalette(palette) {
    paletteDiv.innerHTML = "";
    selectedChord = null;

    for (const c of palette) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.title = `${c.symbol} = ${c.notes.join(" ")}`;
      tile.dataset.chordId = c.id;

      const roman = document.createElement("div");
      roman.className = "roman";
      roman.textContent = c.roman;

      const symbol = document.createElement("div");
      symbol.className = "symbol";
      symbol.textContent = c.symbol;

      tile.appendChild(roman);
      tile.appendChild(symbol);

      tile.addEventListener("click", async () => {
        const wasSelected = tile.classList.contains("selected");
        document.querySelectorAll("#palette .tile").forEach(el => el.classList.remove("selected"));

        if (wasSelected) {
          selectedChord = null;
        } else {
          tile.classList.add("selected");
          selectedChord = c;
          try { await Tone.start(); } catch (_) {}
          synth.triggerAttackRelease(c.notes, "8n", Tone.now());
        }
      });

      paletteDiv.appendChild(tile);
    }
  }

  function refreshSlotsFromChordIds() {
    gridDiv.querySelectorAll(".slot").forEach(slot => {
      if (slot.dataset.chordId) {
        const chord = paletteMap.get(slot.dataset.chordId);
        if (chord) {
          slot.textContent = chord.symbol;
          slot.dataset.notes = JSON.stringify(chord.notes);
          slot.classList.add("filled");
        }
      }
    });
  }

  keySel.addEventListener("change", refreshPalette);
  modeSel.addEventListener("change", refreshPalette);
  refreshPalette(); // initial palette + progressions

  // ---------- URL share & restore ----------
  copyLinkBtn.addEventListener("click", async () => {
    const url = buildShareURL();
    try {
      await navigator.clipboard.writeText(url);
      copyLinkBtn.textContent = "Copied!";
      setTimeout(() => (copyLinkBtn.textContent = "Copy Link"), 900);
    } catch {
      prompt("Copy this URL:", url);
    }
  });

  function buildShareURL() {
    updateUrlHash();
    return location.href;
  }

  function updateUrlHash() {
    const state = collectState();
    const seqStr = state.bars
      .map(bar => bar.map(id => id ?? "_").join(","))
      .join("|");
    const params = new URLSearchParams({
      v: "0.1",
      k: state.key,
      mode: state.mode,
      bpm: String(state.tempoBPM),
      bars: String(state.bars.length),
      seq: seqStr,
    });
    location.hash = params.toString();
  }

  function collectState() {
    const bars = [];
    gridDiv.querySelectorAll(".bar").forEach(barEl => {
      const row = [];
      barEl.querySelectorAll(".slot").forEach(slot => {
        row.push(slot.dataset.chordId ?? null);
      });
      bars.push(row);
    });
    return {
      key: keySel.value,
      mode: modeSel.value,
      tempoBPM: clamp(parseInt(tempoInput.value, 10) || 90, 40, 200),
      bars,
    };
  }

  (function tryRestoreFromHash() {
    if (!location.hash) return;
    const p = new URLSearchParams(location.hash.slice(1));
    const k = p.get("k");
    const m = p.get("mode");
    const bpm = p.get("bpm");
    const barCount = parseInt(p.get("bars") || "4", 10);
    const seq = p.get("seq");

    if (k) keySel.value = k;
    if (m) modeSel.value = m;
    if (bpm) tempoInput.value = clamp(parseInt(bpm, 10) || 90, 40, 200);

    if ([4,8,16].includes(barCount)) {
      barsSel.value = String(barCount);
    } else {
      barsSel.value = barCount <= 4 ? "4" : barCount <= 8 ? "8" : "16";
    }
    generateGrid(barCount);

    if (seq) {
      pendingSeqFromHash = seq
        .split("|")
        .map(bar => bar.split(",").map(tok => (tok === "_" ? null : tok)));
    }
  })();

  function restoreSequenceToGrid(barsIds) {
    const bars = gridDiv.querySelectorAll(".bar");
    const limit = Math.min(bars.length, barsIds.length);
    for (let b = 0; b < limit; b++) {
      const barIds = barsIds[b];
      const slots = bars[b].querySelectorAll(".slot");
      for (let s = 0; s < Math.min(4, barIds.length); s++) {
        const id = barIds[s];
        const slot = slots[s];
        if (id && paletteMap.has(id)) {
          applyChordToSlot(slot, paletteMap.get(id));
        } else {
          clearSlot(slot);
        }
      }
    }
  }

  // ---------- MIDI export ----------
  exportMidiBtn.addEventListener("click", () => {
    const { sequence } = collectSequence();
    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    const bytes = buildMIDI(sequence, bpm);
    const blob = new Blob([new Uint8Array(bytes)], { type: "audio/midi" });

    const k = keySel.value;
    const m = modeSel.value;
    const ts = timeStampString(); // YYYY-MM-DD_HHMM-SS
    const fname = `ChordArranger_${k}_${m}_${bpm}bpm_${ts}.mid`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  function timeStampString() {
    const d = new Date();
    const pad = (n, l=2) => String(n).padStart(l, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  function buildMIDI(sequence, bpm) {
    const PPQ = 480;
    const data = [];

    function pushStr(s) { for (let i=0;i<s.length;i++) data.push(s.charCodeAt(i)); }
    function push32(n) { data.push((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255); }
    function push16(n) { data.push((n>>>8)&255,n&255); }
    function varLen(n) {
      let buffer = n & 0x7f;
      while ((n >>= 7)) { buffer <<= 8; buffer |= ((n & 0x7f) | 0x80); }
      while (true) { data.push(buffer & 0xff); if (buffer & 0x80) buffer >>= 8; else break; }
    }
    function pushEvent(delta, ...bytes) { varLen(delta); data.push(...bytes); }

    // Header chunk: format 0, 1 track, PPQ
    pushStr("MThd"); push32(6); push16(0); push16(1); push16(480);

    // Track start
    const trackStart = data.length;
    pushStr("MTrk"); push32(0);
    const trackLenIndex = data.length - 4;

    const mpqn = Math.round(60000000 / bpm);
    pushEvent(0, 0xff, 0x51, 0x03, (mpqn>>>16)&255, (mpqn>>>8)&255, mpqn&255);
    pushEvent(0, 0xff, 0x58, 0x04, 4, 2, 24, 8);
    pushEvent(0, 0xC0, 0x00);

    let runningDelta = 0;
    const ticks = 480; // one beat per slot
    for (let i = 0; i < sequence.length; i++) {
      const notes = sequence[i];
      const pre = (i === 0 ? 0 : ticks);

      if (!notes || !notes.length) {
        runningDelta += pre;
        continue;
      }

      const midis = notes.map(nameToMidi).filter(n => n !== null);

      let delta = runningDelta + pre;
      for (let j = 0; j < midis.length; j++) {
        pushEvent(delta, 0x90, midis[j], 90);
        delta = 0;
      }

      delta = ticks;
      for (let j = 0; j < midis.length; j++) {
        pushEvent(delta, 0x80, midis[j], 64);
        delta = 0;
      }

      runningDelta = 0;
    }

    pushEvent(runningDelta, 0xff, 0x2f, 0x00);

    const trackEnd = data.length;
    const len = trackEnd - (trackStart + 8);
    data[trackLenIndex]     = (len>>>24)&255;
    data[trackLenIndex + 1] = (len>>>16)&255;
    data[trackLenIndex + 2] = (len>>>8)&255;
    data[trackLenIndex + 3] = len&255;

    return data;
  }

  function nameToMidi(s) {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(s);
    if (!m) return null;
    const letter = m[1], acc = m[2], oct = parseInt(m[3], 10);
    const base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter];
    const off = acc === "#" ? 1 : acc === "b" ? -1 : 0;
    return (oct + 1) * 12 + base + off;
  }

  // utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ---------- THEORY / GENERATOR ----------
  const SHARP_ROW = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const FLAT_ROW  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
  const FLAT_KEYS = new Set(["F","Bb","Eb","Ab","Db","Gb","Cb"]);
  const MINOR_FLAT_KEYS = new Set(["D","G","C","F","Bb","Eb","Ab"]); // relative majors above

  const INTERVALS = { major: [2,2,1,2,2,2,1], natural_minor: [2,1,2,2,1,2,2] };
  const QUALITIES = {
    major:        ["maj7","m7","m7","maj7","7","m7","m7b5"],
    natural_minor:["m7","m7b5","maj7","m7","m7","maj7","7"],
  };
  const ROMANS = {
    major:        ["I","ii","iii","IV","V","vi","viiø"],
    natural_minor:["i","iiø","♭III","iv","v","♭VI","♭VII"],
  };

  function buildScale(key, mode) {
    const preferFlats = (mode === "major")
      ? FLAT_KEYS.has(key)
      : MINOR_FLAT_KEYS.has(key);
    const row = preferFlats ? FLAT_ROW : SHARP_ROW;

    let tonicIndex = row.indexOf(key);
    let rotatedRow;
    if (tonicIndex === -1) {
      const altRow = preferFlats ? SHARP_ROW : FLAT_ROW;
      tonicIndex = altRow.indexOf(key);
      rotatedRow = rotateArray(altRow, Math.max(0, tonicIndex));
    } else {
      rotatedRow = rotateArray(row, tonicIndex);
    }
    return takeScale(rotatedRow, INTERVALS[mode]);
  }

  function rotateArray(arr, start) { return [...arr.slice(start), ...arr.slice(0, start)]; }

  function takeScale(rowFromTonic, intervals) {
    const scale = [rowFromTonic[0]];
    let pos = 0;
    for (let i = 0; i < 6; i++) {
      pos = (pos + intervals[i]) % 12;
      scale.push(rowFromTonic[pos]);
    }
    return scale;
  }

  function buildDiatonicSeventhChords(key, mode) {
    const scale = buildScale(key, mode);
    const romans = ROMANS[mode];
    const qualities = QUALITIES[mode];
    const deg = (i) => ((i % 7) + 7) % 7;

    const chords = [];
    for (let i = 0; i < 7; i++) {
      const root = scale[deg(i)];
      const third = scale[deg(i + 2)];
      const fifth = scale[deg(i + 4)];
      const seventh = scale[deg(i + 6)];
      const symbol = symbolFromQuality(root, qualities[i]);
      chords.push({
        id: romans[i],
        roman: romans[i],
        symbol,
        notes: voiceCompactWithBass([root, third, fifth, seventh]), // NEW compact voicing
      });
    }
    return chords;
  }

  function symbolFromQuality(root, quality) {
    switch (quality) {
      case "maj7": return `${root}maj7`;
      case "m7":   return `${root}m7`;
      case "7":    return `${root}7`;
      case "m7b5": return `${root}m7♭5`;
      default:     return `${root}`;
    }
  }

  // === NEW: compact "piano" voicing ===
  // Root -> octave 2 (bass). Upper tones (3rd, 5th, 7th) packed tightly around octave 3.
  // If any upper tone is <= the previous, lift it by 12 semitones to keep a clean ascending stack.
  function voiceCompactWithBass(pitchesNoOctave) {
    const base3 = {
      "C":48,"C#":49,"Db":49,"D":50,"D#":51,"Eb":51,"E":52,"F":53,"F#":54,"Gb":54,
      "G":55,"G#":56,"Ab":56,"A":57,"A#":58,"Bb":58,"B":59
    }; // C3..B3
    const base2 = {
      "C":36,"C#":37,"Db":37,"D":38,"D#":39,"Eb":39,"E":40,"F":41,"F#":42,"Gb":42,
      "G":43,"G#":44,"Ab":44,"A":45,"A#":46,"Bb":46,"B":47
    }; // C2..B2

    const [root, third, fifth, seventh] = pitchesNoOctave;

    const bass = base2[root] ?? 36;

    // Start all upper voices in the same octave to sound compact
    const voices = [base3[third] ?? 60, base3[fifth] ?? 60, base3[seventh] ?? 60];

    // Ensure ascending order by lifting overlaps
    for (let i = 1; i < voices.length; i++) {
      while (voices[i] <= voices[i - 1]) voices[i] += 12;
    }

    const midi = [bass, ...voices];
    return midi.map(midiToName);
  }

  function midiToName(m) {
    const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const name = names[m % 12];
    const octave = Math.floor(m / 12) - 1;
    return `${name}${octave}`;
  }

  // temp holders for playback visuals
  let seq = [];
  let slotsLinear = [];
});
