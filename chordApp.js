// chordApp.js

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM refs ----------
  const keySel = document.getElementById("key");
  const modeSel = document.getElementById("mode");
  const barsSel = document.getElementById("bars");
  const tempoInput = document.getElementById("tempo");
  const progList = document.querySelector("#progressions .prog-list");
  const guideResult = document.querySelector("#progressions .guide-result");
  const buildStarterBtn = document.getElementById("buildStarter");
  const starterSummary = document.getElementById("starterSummary");
  const paletteDiv = document.querySelector("#palette .chords");
  const paletteWhy = document.getElementById("paletteWhy");
  const paletteCurrent = document.getElementById("paletteCurrent");
  const paletteGuide = document.getElementById("paletteGuide");
  const gridDiv = document.querySelector("#timeline .grid");
  const timelineGuide = document.getElementById("timelineGuide");
  const eraseModeBtn = document.getElementById("eraseMode");
  const shapeProposal = document.getElementById("shapeProposal");
  const shapeButtons = Array.from(document.querySelectorAll(".shape-choices button"));
  const playBtn = document.getElementById("play");
  const stopBtn = document.getElementById("stop");
  const transportPanel = document.getElementById("transport");
  const undoBtn = document.getElementById("undo");
  const resetBtn = document.getElementById("resetGrid");
  const startOverBtn = document.getElementById("startOver");
  const metEnabled = document.getElementById("metEnabled");
  const copyLinkBtn = document.getElementById("copyLink");
  const exportMidiBtn = document.getElementById("exportMidi");
  const miniPlayer = document.getElementById("miniPlayer");
  const miniPlayBtn = document.getElementById("miniPlay");
  const miniStopBtn = document.getElementById("miniStop");
  const miniLoopBtn = document.getElementById("miniLoop");
  const miniStatus = document.getElementById("miniStatus");
  const miniChord = document.getElementById("miniChord");
  const miniMeta = document.getElementById("miniMeta");
  const melodyBarsDiv = document.getElementById("melodyBars");
  const melodyGuide = document.getElementById("melodyGuide");
  const buildMelodyBtn = document.getElementById("buildMelody");
  const clearMelodyBtn = document.getElementById("clearMelody");
  const bassBarsDiv = document.getElementById("bassBars");
  const bassGuide = document.getElementById("bassGuide");
  const buildBassBtn = document.getElementById("buildBass");
  const clearBassBtn = document.getElementById("clearBass");
  const bassStyleButtons = Array.from(document.querySelectorAll("[data-bass-style]"));
  const styleButtons = Array.from(document.querySelectorAll("[data-style]"));
  const setupCharacterTitle = document.getElementById("setupCharacterTitle");
  const setupCharacterDescription = document.getElementById("setupCharacterDescription");
  const setupHomeChord = document.getElementById("setupHomeChord");
  const setupHomeNotes = document.getElementById("setupHomeNotes");
  const hearHomeChordBtn = document.getElementById("hearHomeChord");

  // state
  let selectedChord = null;     // { id, roman, symbol, notes }
  let paletteMap = new Map();   // id -> chord
  let paletteByDegree = [];     // scale degree 1..7 in the active key/mode
  let isStarting = false;       // guard for rapid Play clicks
  let repeatId = null;          // schedule id for repeat loop
  let metronomeRepeatId = null; // quarter-note click schedule
  let endScheduleId = null;     // stop point when looping is disabled
  let melodyRepeatId = null;    // quarter-note melody schedule
  let songBassRepeatId = null;  // dedicated beginner bass-line schedule
  let undoStack = [];           // stack of reversible timeline changes
  let pendingSeqFromHash = null;
  let resetConfirmTimer = null;
  let startOverConfirmTimer = null;
  let activeStarterMood = null;
  let starterEnergy = "steady";
  let starterLength = 4;
  let starterRhythm = "pulsing";
  let starterStyle = "pop";
  let isEraseMode = false;
  let activeShapeIntent = null;
  let shapeAttempt = 0;
  let currentShapeProposal = null;
  let isLooping = true;
  let melodyBars = [];
  let selectedMelodyNote = null;
  let selectedMelodyBar = null;
  let pendingMelodyFromHash = null;
  let bassBars = [];
  let bassStyle = "pulse";
  let pendingBassFromHash = null;
  let transportInView = false;
  undoBtn.disabled = true;

  const initialState = readStateFromHash();
  if (initialState) {
    if (initialState.key) keySel.value = initialState.key;
    if (initialState.mode) modeSel.value = initialState.mode;
    if (initialState.tempo) tempoInput.value = initialState.tempo;
    if (initialState.style) starterStyle = initialState.style;
    if (initialState.rhythm) starterRhythm = initialState.rhythm;
    else starterRhythm = { pop: "pulsing", lofi: "flowing", cinematic: "flowing", arcade: "driving" }[starterStyle];
    barsSel.value = String(initialState.barCount);
    pendingSeqFromHash = initialState.sequence;
    pendingMelodyFromHash = initialState.melody;
    pendingBassFromHash = initialState.bass;
    if (initialState.bassStyle) bassStyle = initialState.bassStyle;
    else bassStyle = { pop: "pulse", lofi: "hold", cinematic: "hold", arcade: "motion" }[starterStyle];
    const initialBpm = parseInt(tempoInput.value, 10) || 90;
    starterEnergy = initialBpm <= 75 ? "calm" : initialBpm >= 110 ? "driving" : "steady";
  }
  document.querySelectorAll('.choice-row[data-choice="rhythm"] button').forEach(button =>
    button.classList.toggle("selected", button.dataset.value === starterRhythm)
  );
  document.querySelectorAll('.choice-row[data-choice="energy"] button').forEach(button =>
    button.classList.toggle("selected", button.dataset.value === starterEnergy)
  );
  bassStyleButtons.forEach(button => {
    const selected = button.dataset.bassStyle === bassStyle;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  styleButtons.forEach(button => {
    const selected = button.dataset.style === starterStyle;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  function updateSetupCharacter() {
    const key = keySel.value;
    const isMajor = modeSel.value === "major";
    const modeWord = isMajor ? "major" : "minor";
    const homeChord = paletteMap.get(isMajor ? "I" : "i") || paletteByDegree[0];
    const chordName = homeChord?.symbol || `${key} ${modeWord}`;
    const chordNotes = homeChord?.notes?.map(displayNote) || [key];
    setupCharacterTitle.textContent = `${key} is the home note`;
    setupHomeChord.textContent = chordName;
    setupHomeNotes.textContent = `Made from ${chordNotes.join(" · ")}`;
    hearHomeChordBtn.textContent = `Hear ${key} ${modeWord}`;
    setupCharacterDescription.textContent = `Because ${key} is home, every recommended chord is chosen by how it leads away from or back to ${key}. The melody and bass also draw their notes from this ${key} ${modeWord} family.`;
  }

  hearHomeChordBtn.addEventListener("click", async () => {
    const chord = paletteMap.get(modeSel.value === "major" ? "I" : "i") || paletteByDegree[0];
    if (!chord?.notes?.length) return;
    try { await Tone.start(); } catch (_) {}
    playCleanChord(chord.notes, "2n");
  });

  // ---------- Beginner starting guide ----------
  const STARTER_MOODS = [
    { id: "bright", name: "Bright & hopeful", description: "Open, optimistic, and ready to move.", cue: "Sunrise", mode: "major", sequence: ["I","V","vi","IV"], variation: ["vi","IV","I","V"], secondPhrase: "The second phrase begins more reflectively, then climbs back toward a confident restart.", next: "Replace the first chord with the third chord for a more reflective opening." },
    { id: "warm", name: "Warm & nostalgic", description: "Familiar, heartfelt, and gently reflective.", cue: "Old photo", mode: "major", sequence: ["I","vi","IV","V"], variation: ["IV","I","ii","V"], secondPhrase: "The answer starts somewhere familiar, briefly settles, then gently asks to begin again.", next: "Slow it down one energy level and notice how the same chords feel more personal." },
    { id: "uneasy", name: "Tense & uneasy", description: "Unsettled, watchful, and waiting for a release.", cue: "Footsteps", mode: "minor", sequence: ["i","♭VI","iiø","V"], variation: ["i","iv","iiø","V"], secondPhrase: "The second phrase tightens the same uneasy path and again stops just before full relief.", next: "Replace the final V with i when you want release instead of suspense." },
    { id: "dark", name: "Dark & determined", description: "Serious and heavy, but still moving forward.", cue: "Night road", mode: "minor", sequence: ["i","♭VII","♭VI","V"], variation: ["i","iv","♭VI","V"], secondPhrase: "The answer digs deeper before gathering enough force to drive back into the opening.", next: "Raise the energy one level to turn the weight into momentum." },
  ];

  const STYLE_PRESETS = {
    pop: { name: "Pop", energy: "steady", bpm: 90, rhythm: "pulsing", bass: "pulse" },
    lofi: { name: "Lo-fi", energy: "calm", bpm: 70, rhythm: "flowing", bass: "hold" },
    cinematic: { name: "Cinematic", energy: "steady", bpm: 80, rhythm: "flowing", bass: "hold" },
    arcade: { name: "Arcade", energy: "driving", bpm: 120, rhythm: "driving", bass: "motion" },
  };

  styleButtons.forEach(button => {
    button.addEventListener("click", () => selectStyle(button.dataset.style));
  });

  function selectStyle(style) {
    const preset = STYLE_PRESETS[style] || STYLE_PRESETS.pop;
    starterStyle = style in STYLE_PRESETS ? style : "pop";
    starterEnergy = preset.energy;
    starterRhythm = preset.rhythm;
    bassStyle = preset.bass;
    tempoInput.value = String(preset.bpm);

    styleButtons.forEach(button => {
      const selected = button.dataset.style === starterStyle;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll('.choice-row[data-choice="energy"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === starterEnergy)
    );
    document.querySelectorAll('.choice-row[data-choice="rhythm"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === starterRhythm)
    );
    bassStyleButtons.forEach(button => {
      const selected = button.dataset.bassStyle === bassStyle;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (typeof Tone !== "undefined" && Tone.Transport?.state !== "stopped") hardStop();
    applyStyleSound();
    renderBassHelper();
    if (melodyBars.some(bar => bar.beats.some(Boolean))) {
      melodyGuide.textContent = `${preset.name} selected. Keep your melody, or generate it again to use the ${preset.name} rhythm.`;
    }
    updateStarterSummary();
    updateMiniPlayerMeta();
    updateSetupCharacter();
    const guideSetupSummary = guideResult.querySelector(".guide-setup-summary");
    if (guideSetupSummary) guideSetupSummary.textContent = starterSetupExplanation();
    updateUrlHash();
  }

  function currentPopular() {
    return STARTER_MOODS;
  }

  function renderProgressions() {
    progList.innerHTML = "";
    const items = currentPopular();
    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "prog-card";
      card.dataset.mood = item.id;
      card.setAttribute("aria-pressed", String(activeStarterMood?.id === item.id));
      if (activeStarterMood?.id === item.id) card.classList.add("selected");

      const mood = document.createElement("span");
      mood.className = "mood-label";
      mood.textContent = item.cue;
      card.appendChild(mood);

      const title = document.createElement("div");
      title.className = "prog-name";
      title.textContent = item.name;
      card.appendChild(title);

      const summary = document.createElement("p");
      summary.className = "prog-description";
      summary.textContent = item.description;
      card.appendChild(summary);
      card.addEventListener("click", () => selectStarterMood(item));
      progList.appendChild(card);
    });
  }

  function selectStarterMood(item) {
    activeStarterMood = item;
    buildStarterBtn.disabled = false;
    renderProgressions();
    updateStarterSummary();
  }

  function updateStarterSummary() {
    if (!activeStarterMood) {
      starterSummary.textContent = "Choose a feeling to begin.";
      return;
    }
    const energyLabel = starterEnergy.charAt(0).toUpperCase() + starterEnergy.slice(1);
    const lengthLabel = starterLength === 4 ? "a short loop" : "a longer idea";
    starterSummary.innerHTML = `<strong>${activeStarterMood.name}</strong> in a ${STYLE_PRESETS[starterStyle].name} style, with ${energyLabel.toLowerCase()} energy, ${lengthLabel}, and ${starterRhythm} chords.`;
  }

  document.querySelectorAll(".choice-row button").forEach(button => {
    button.addEventListener("click", () => {
      const row = button.closest(".choice-row");
      row.querySelectorAll("button").forEach(choice => choice.classList.remove("selected"));
      button.classList.add("selected");
      if (row.dataset.choice === "energy") {
        starterEnergy = button.dataset.value;
        tempoInput.value = String({ calm: 70, steady: 90, driving: 120 }[starterEnergy]);
      }
      if (row.dataset.choice === "length") starterLength = Number(button.dataset.value);
      if (row.dataset.choice === "rhythm") {
        starterRhythm = button.dataset.value;
        if (Tone.Transport.state === "started") hardStop();
      }
      updateStarterSummary();
      updateMiniPlayerMeta();
      const guideSetupSummary = guideResult.querySelector(".guide-setup-summary");
      if (guideSetupSummary) guideSetupSummary.textContent = starterSetupExplanation();
      updateUrlHash();
    });
  });

  buildStarterBtn.addEventListener("click", () => {
    if (!activeStarterMood) return;
    modeSel.value = activeStarterMood.mode;
    tempoInput.value = String(clamp(parseInt(tempoInput.value, 10) || STYLE_PRESETS[starterStyle].bpm, 40, 200));
    barsSel.value = String(starterLength);
    generateGrid(starterLength);
    refreshPalette(false);
    fillStarterProgression(activeStarterMood.sequence, activeStarterMood.variation);
    updateSetupCharacter();
    const explainedSequence = starterLength >= 8
      ? [...activeStarterMood.sequence, ...activeStarterMood.variation]
      : activeStarterMood.sequence;
    showGuideResult(activeStarterMood, explainedSequence);
  });

  function fillStarterProgression(sequence, variation = sequence) {
    const allSlots = Array.from(gridDiv.querySelectorAll(".slot"));
    const changes = allSlots.map(snapshotSlot);
    allSlots.forEach((slot, index) => {
      const source = index < 4 ? sequence : variation;
      applyChordToSlot(slot, paletteMap.get(source[index % 4]));
    });
    pushUndo({ type: "place", changes });
    updateUrlHash();
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
    const existingSequence = collectChordIdsByBar();
    const previousBarCount = existingSequence.length;
    const nextBarCount = parseInt(barsSel.value, 10);
    const wouldRemoveChords = nextBarCount < previousBarCount
      && existingSequence.slice(nextBarCount).some(bar => bar.some(Boolean));

    if (wouldRemoveChords && !window.confirm("Reducing the bar count will remove chords from the end. Continue?")) {
      barsSel.value = String(previousBarCount);
      return;
    }

    generateGrid(nextBarCount);
    restoreSequenceToGrid(existingSequence);
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

      for (let s = 0; s < 1; s++) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "slot";
        slot.textContent = "—";
        slot.dataset.slot = String(s);
        slot.setAttribute("aria-label", `Bar ${b + 1}, empty`);

        // Tap/click: place the selected chord for this whole bar.
        slot.addEventListener("click", (e) => {
          if (isEraseMode) {
            if (!slot.dataset.chordId) return;
            const changes = [snapshotSlot(slot)];
            clearSlot(slot);
            pushUndo({ type: "place", changes });
            updateUrlHash();
            return;
          }

          if (!selectedChord) return;

          const changes = [snapshotSlot(slot)];
          applyChordToSlot(slot, selectedChord);
          pushUndo({ type: "place", changes });
          updateUrlHash();
        });

        // Keep right-click clear as an optional desktop shortcut.
        slot.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (!slot.dataset.chordId) return;
          const changes = [snapshotSlot(slot)];
          clearSlot(slot);
          pushUndo({ type: "place", changes });
          updateUrlHash();
        });

        bar.appendChild(slot);
      }

      wrap.appendChild(bar);
      gridDiv.appendChild(wrap);
    }

  }

  function applyChordToSlot(slot, chord) {
    slot.textContent = chord.symbol;
    slot.classList.add("filled");
    slot.dataset.chordId = chord.id;
    slot.dataset.notes = JSON.stringify(chord.notes);
    const barNumber = Number(slot.closest(".bar")?.dataset.barIndex || 0) + 1;
    slot.setAttribute("aria-label", `Bar ${barNumber}, ${chord.symbol}`);
  }

  function clearSlot(slot) {
    slot.textContent = "—";
    slot.classList.remove("filled", "playing");
    delete slot.dataset.chordId;
    delete slot.dataset.notes;
    const barNumber = Number(slot.closest(".bar")?.dataset.barIndex || 0) + 1;
    slot.setAttribute("aria-label", `Bar ${barNumber}, empty`);
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
    undoBtn.disabled = undoStack.length === 0;
  }

  undoBtn.addEventListener("click", () => {
    const op = undoStack.pop();
    if (!op) return;
    if (op.type === "place") {
      for (let i = op.changes.length - 1; i >= 0; i--) restoreSnapshot(op.changes[i]);
      updateUrlHash();
    }
    undoBtn.disabled = undoStack.length === 0;
  });
  // ---------- Reset Grid ----------
  resetBtn.addEventListener("click", () => {
    if (!resetBtn.dataset.armed) {
      resetBtn.dataset.armed = "true";
      resetBtn.textContent = "Confirm reset";
      clearTimeout(resetConfirmTimer);
      resetConfirmTimer = setTimeout(disarmReset, 3000);
      return;
    }

    const changes = Array.from(gridDiv.querySelectorAll(".slot")).map(snapshotSlot);
    gridDiv.querySelectorAll(".slot").forEach(clearSlot);
    pushUndo({ type: "place", changes });
    disarmReset();
    updateUrlHash();
    clearNowPlayingTile();
  });

  function disarmReset() {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
    delete resetBtn.dataset.armed;
    resetBtn.textContent = "Reset grid";
  }

  startOverBtn.addEventListener("click", () => {
    if (!startOverBtn.dataset.armed) {
      startOverBtn.dataset.armed = "true";
      startOverBtn.textContent = "Confirm start over";
      clearTimeout(startOverConfirmTimer);
      startOverConfirmTimer = setTimeout(disarmStartOver, 3000);
      return;
    }

    hardStop();
    activeStarterMood = null;
    activeShapeIntent = null;
    currentShapeProposal = null;
    shapeAttempt = 0;
    melodyBars = [];
    bassBars = [];
    bassStyle = "pulse";
    starterStyle = "pop";
    selectedMelodyNote = null;
    selectedMelodyBar = null;
    bassStyleButtons.forEach(button => {
      const selected = button.dataset.bassStyle === bassStyle;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    styleButtons.forEach(button => {
      const selected = button.dataset.style === starterStyle;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    isLooping = true;
    miniLoopBtn.setAttribute("aria-pressed", "true");
    miniLoopBtn.textContent = "Loop: On";
    starterEnergy = "steady";
    starterLength = 4;
    starterRhythm = "pulsing";
    selectedChord = null;
    keySel.value = "C";
    modeSel.value = "major";
    barsSel.value = "4";
    tempoInput.value = "90";
    applyStyleSound();

    document.querySelectorAll('.choice-row[data-choice="energy"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === "steady")
    );
    document.querySelectorAll('.choice-row[data-choice="length"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === "4")
    );
    document.querySelectorAll('.choice-row[data-choice="rhythm"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === "flowing")
    );

    generateGrid(4);
    refreshPalette(false);
    setEraseMode(false);
    guideResult.hidden = true;
    guideResult.innerHTML = "";
    shapeProposal.hidden = true;
    shapeProposal.innerHTML = "";
    shapeButtons.forEach(button => button.classList.remove("selected"));
    document.querySelector(".setup-details")?.removeAttribute("open");
    undoStack = [];
    undoBtn.disabled = true;
    updateStarterSummary();
    updateSetupCharacter();
    updatePaletteContext();
    updateUrlHash();
    disarmReset();
    disarmStartOver();
    document.getElementById("progressions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function disarmStartOver() {
    clearTimeout(startOverConfirmTimer);
    startOverConfirmTimer = null;
    delete startOverBtn.dataset.armed;
    startOverBtn.textContent = "Start over";
  }
  // ---------- PLAYBACK (Tone.js clean-keys synth) ----------
  // Bass and upper voices use separate signal paths. This keeps the low end
  // controlled while allowing the upper chord to stay soft and intelligible.
  const outputLimiter = new Tone.Limiter(-3).toDestination();
  const outputCompressor = new Tone.Compressor({
    threshold: -20,
    ratio: 2.5,
    attack: 0.02,
    release: 0.18,
  }).connect(outputLimiter);

  const smallRoom = new Tone.Reverb({
    decay: 1.15,
    preDelay: 0.012,
    wet: 0.065,
  }).connect(outputCompressor);

  const upperLowPass = new Tone.Filter({
    frequency: 2800,
    type: "lowpass",
    rolloff: -12,
  }).connect(smallRoom);
  const upperHighPass = new Tone.Filter({
    frequency: 145,
    type: "highpass",
    rolloff: -12,
  }).connect(upperLowPass);

  const upperSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0.018,
      decay: 0.22,
      sustain: 0.26,
      release: 0.5,
    },
  }).connect(upperHighPass);
  upperSynth.volume.value = -16.5;

  const bassLowPass = new Tone.Filter({
    frequency: 420,
    type: "lowpass",
    rolloff: -12,
  }).connect(outputCompressor);
  const bassSynth = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.012,
      decay: 0.16,
      sustain: 0.28,
      release: 0.42,
    },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.2,
      release: 0.3,
      baseFrequency: 120,
      octaves: 1.5,
    },
  }).connect(bassLowPass);
  bassSynth.volume.value = -19;

  const clickSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.02 }
  }).toDestination();
  clickSynth.volume.value = -27;

  const melodyLowPass = new Tone.Filter({
    frequency: 2400,
    type: "lowpass",
    rolloff: -24,
  }).connect(smallRoom);
  const melodySynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.045, decay: 0.18, sustain: 0.3, release: 0.55 }
  }).connect(melodyLowPass);
  melodySynth.volume.value = -14;

  const songBassSynth = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.18, sustain: 0.42, release: 0.5 },
    filterEnvelope: {
      attack: 0.01, decay: 0.15, sustain: 0.25, release: 0.4,
      baseFrequency: 70, octaves: 1.2,
    },
  }).connect(bassLowPass);
  songBassSynth.volume.value = -17.5;

  function styleMix(style = starterStyle) {
    return {
      pop: { chordDb: -16.5, melodyDb: -14, bassDb: -17.5, chordBassDb: -19, chordVelocity: 0.54, melodyVelocity: 0.65, bassVelocity: 0.62, midiChord: 75, midiMelody: 78, midiBass: 76 },
      lofi: { chordDb: -15.5, melodyDb: -13, bassDb: -16.5, chordBassDb: -18, chordVelocity: 0.48, melodyVelocity: 0.58, bassVelocity: 0.56, midiChord: 68, midiMelody: 72, midiBass: 70 },
      cinematic: { chordDb: -18, melodyDb: -13.5, bassDb: -17.5, chordBassDb: -20, chordVelocity: 0.46, melodyVelocity: 0.68, bassVelocity: 0.58, midiChord: 64, midiMelody: 82, midiBass: 70 },
      arcade: { chordDb: -18, melodyDb: -17.5, bassDb: -20, chordBassDb: -21, chordVelocity: 0.42, melodyVelocity: 0.44, bassVelocity: 0.46, midiChord: 68, midiMelody: 74, midiBass: 72 },
    }[style] || styleMix("pop");
  }

  function applyStyleSound() {
    const sounds = {
      pop: { chord: "triangle", melody: "sine", bass: "triangle", chordCutoff: 2800, melodyCutoff: 2400, bassCutoff: 420, room: 0.065 },
      lofi: { chord: "triangle", melody: "sine", bass: "sine", chordCutoff: 1750, melodyCutoff: 1550, bassCutoff: 330, room: 0.045 },
      cinematic: { chord: "sine", melody: "triangle", bass: "sine", chordCutoff: 2400, melodyCutoff: 1900, bassCutoff: 390, room: 0.14 },
      arcade: { chord: "triangle", melody: "square", bass: "square", chordCutoff: 2300, melodyCutoff: 2100, bassCutoff: 500, room: 0.025 },
    };
    const sound = sounds[starterStyle] || sounds.pop;
    const mix = styleMix();
    upperSynth.set({ oscillator: { type: sound.chord } });
    melodySynth.set({ oscillator: { type: sound.melody } });
    songBassSynth.set({ oscillator: { type: sound.bass } });
    upperLowPass.frequency.value = sound.chordCutoff;
    melodyLowPass.frequency.value = sound.melodyCutoff;
    bassLowPass.frequency.value = sound.bassCutoff;
    smallRoom.wet.value = sound.room;
    upperSynth.volume.value = mix.chordDb;
    melodySynth.volume.value = mix.melodyDb;
    songBassSynth.volume.value = mix.bassDb;
    bassSynth.volume.value = mix.chordBassDb;
  }

  applyStyleSound();

  tempoInput.addEventListener("change", () => {
    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    tempoInput.value = bpm;
    starterEnergy = bpm <= 75 ? "calm" : bpm >= 110 ? "driving" : "steady";
    document.querySelectorAll('.choice-row[data-choice="energy"] button').forEach(button =>
      button.classList.toggle("selected", button.dataset.value === starterEnergy)
    );
    if (Tone.Transport.state === "started") {
      Tone.Transport.bpm.rampTo(bpm, 0.1);
    }
    updateMiniPlayerMeta();
    updateStarterSummary();
    updateUrlHash();
  });

  function rhythmSettings(rhythm = starterRhythm) {
    if (rhythm === "pulsing") return { hits: 2, interval: "2n", duration: "4n", midiLength: 0.72 };
    if (rhythm === "driving") return { hits: 4, interval: "4n", duration: "8n", midiLength: 0.52 };
    return { hits: 1, interval: "1m", duration: "2n.", midiLength: 0.78 };
  }

  buildMelodyBtn.addEventListener("click", () => {
    syncMelodyWithTimeline();
    if (!melodyBars.some(bar => bar.chordId)) return;
    melodyBars.forEach((bar, index) => {
      if (!bar.chordId) return;
      const suggestions = melodySuggestions(bar.chordId);
      const patterns = {
        pop: index % 2 === 0 ? [1, 2, 1, 0] : [0, 1, 2, 1],
        lofi: index % 2 === 0 ? [1, null, 2, null] : [0, null, 1, null],
        cinematic: index % 2 === 0 ? [0, null, null, 2] : [null, 1, null, null],
        arcade: index % 2 === 0 ? [1, 2, 1, 2] : [0, 1, 2, 1],
      };
      bar.beats = (patterns[starterStyle] || patterns.pop).map(choice => choice === null ? null : suggestions[choice]?.note || null);
    });
    selectedMelodyNote = null;
    selectedMelodyBar = null;
    melodyGuide.textContent = `A ${STYLE_PRESETS[starterStyle].name} starting melody is ready. Change any note by choosing a suggestion inside that bar.`;
    renderMelodyHelper();
    updateUrlHash();
  });

  clearMelodyBtn.addEventListener("click", () => {
    melodyBars.forEach(bar => { bar.beats = [null, null, null, null]; });
    selectedMelodyNote = null;
    selectedMelodyBar = null;
    melodyGuide.textContent = "Melody cleared. Choose a suggested note, then place it on a beat.";
    renderMelodyHelper();
    updateUrlHash();
  });

  function syncMelodyWithTimeline() {
    const slots = Array.from(gridDiv.querySelectorAll(".slot"));
    melodyBars = slots.map((slot, index) => {
      const chordId = slot.dataset.chordId || null;
      const existing = melodyBars[index];
      if (existing?.chordId === chordId) return existing;
      return { chordId, beats: [null, null, null, null] };
    });
  }

  function melodySuggestions(chordId) {
    const chord = paletteMap.get(chordId);
    if (!chord) return [];
    const sourceNotes = [chord.notes[0], chord.notes[1], chord.notes[2]];
    const labels = ["Stable", "Best fit", "Open"];
    return sourceNotes.map((note, index) => {
      const midi = nameToMidi(note);
      const pitchClass = ((midi % 12) + 12) % 12;
      let melodyMidi = 60 + pitchClass;
      if (melodyMidi < 65) melodyMidi += 12;
      return { note: midiToName(melodyMidi), label: labels[index], recommended: index === 1 };
    });
  }

  function renderMelodyHelper() {
    syncMelodyWithTimeline();
    melodyBarsDiv.innerHTML = "";
    const hasChords = melodyBars.some(bar => bar.chordId);
    buildMelodyBtn.disabled = !hasChords;
    clearMelodyBtn.disabled = !hasChords || !melodyBars.some(bar => bar.beats.some(Boolean));

    if (!hasChords) {
      melodyGuide.textContent = "Build a chord progression first.";
      return;
    }
    if (!selectedMelodyNote && !melodyBars.some(bar => bar.beats.some(Boolean))) {
      melodyGuide.textContent = "Use the starting-melody button, or choose a note inside a bar and place it on a beat.";
    }

    melodyBars.forEach((bar, barIndex) => {
      if (!bar.chordId) return;
      const chord = paletteMap.get(bar.chordId);
      const suggestions = melodySuggestions(bar.chordId);
      const card = document.createElement("section");
      card.className = "melody-bar";
      card.dataset.barIndex = String(barIndex);
      card.innerHTML = `<div class="melody-bar-heading"><span>Bar ${barIndex + 1}</span><strong>${chord?.symbol || bar.chordId}</strong></div>`;

      const choices = document.createElement("div");
      choices.className = "melody-note-choices";
      suggestions.forEach(suggestion => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "melody-note-choice";
        button.dataset.note = suggestion.note;
        if (suggestion.recommended) button.classList.add("recommended");
        if (selectedMelodyBar === barIndex && selectedMelodyNote === suggestion.note) button.classList.add("selected");
        button.innerHTML = `<strong>${displayNote(suggestion.note)}</strong><small>${suggestion.label}</small>`;
        button.setAttribute("aria-label", `${displayNote(suggestion.note)}, ${suggestion.label}, choose for bar ${barIndex + 1}`);
        button.addEventListener("click", async () => {
          selectedMelodyNote = suggestion.note;
          selectedMelodyBar = barIndex;
          try { await Tone.start(); } catch (_) {}
          melodySynth.triggerAttackRelease(suggestion.note, "8n", undefined, styleMix().melodyVelocity);
          melodyGuide.innerHTML = `<strong>${displayNote(suggestion.note)} selected for bar ${barIndex + 1}.</strong> Tap any beat in this bar to place it.`;
          renderMelodyHelper();
        });
        choices.appendChild(button);
      });

      const beats = document.createElement("div");
      beats.className = "melody-beats";
      bar.beats.forEach((note, beatIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = note ? "melody-beat filled" : "melody-beat";
        button.dataset.barIndex = String(barIndex);
        button.dataset.beatIndex = String(beatIndex);
        if (note) button.dataset.note = note;
        button.innerHTML = `<small>${beatIndex + 1}</small><strong>${note ? displayNote(note) : "—"}</strong>`;
        button.setAttribute("aria-label", `Bar ${barIndex + 1}, beat ${beatIndex + 1}, ${note ? displayNote(note) : "empty"}`);
        button.addEventListener("click", () => {
          if (selectedMelodyBar !== barIndex || !selectedMelodyNote) {
            melodyGuide.textContent = `Choose one of the three notes in bar ${barIndex + 1} first.`;
            return;
          }
          bar.beats[beatIndex] = selectedMelodyNote;
          melodyGuide.textContent = `${displayNote(selectedMelodyNote)} placed on beat ${beatIndex + 1} of bar ${barIndex + 1}.`;
          renderMelodyHelper();
          updateUrlHash();
        });
        beats.appendChild(button);
      });

      card.appendChild(choices);
      card.appendChild(beats);
      melodyBarsDiv.appendChild(card);
    });
  }

  function displayNote(note) {
    return note ? note.replace(/-?\d+$/, "") : "—";
  }

  buildBassBtn.addEventListener("click", () => {
    syncBassWithTimeline();
    bassBars.forEach(bar => {
      bar.note = bar.chordId ? bassNoteForChord(bar.chordId) : null;
    });
    bassGuide.textContent = `${bassStyleLabel()} is ready. Play the song, then try another style to compare.`;
    renderBassHelper();
    updateUrlHash();
  });

  clearBassBtn.addEventListener("click", () => {
    bassBars.forEach(bar => { bar.note = null; });
    bassGuide.textContent = "Bass cleared. Add it again whenever the chords need more weight.";
    renderBassHelper();
    updateUrlHash();
  });

  bassStyleButtons.forEach(button => {
    button.addEventListener("click", () => {
      bassStyle = button.dataset.bassStyle;
      bassStyleButtons.forEach(choice => {
        const selected = choice === button;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      if (Tone.Transport.state !== "stopped") hardStop();
      bassGuide.textContent = bassBars.some(bar => bar.note)
        ? `${bassStyleLabel()} selected. Press Play to hear the difference.`
        : `${bassStyleLabel()} selected. Add the bass line when you are ready.`;
      renderBassHelper();
      updateUrlHash();
    });
  });

  function bassStyleLabel(style = bassStyle) {
    if (style === "pulse") return "Keep it moving";
    if (style === "motion") return "Add some motion";
    return "Hold it down";
  }

  function bassPatternForBar(barIndex, style = bassStyle) {
    const root = bassBars[barIndex]?.note;
    return bassPatternFromRoot(root, style);
  }

  function bassPatternFromRoot(root, style) {
    const rootMidi = nameToMidi(root);
    if (rootMidi === null) return [null, null, null, null];
    if (style === "pulse") return [root, root, root, root];
    if (style === "motion") {
      return [root, midiToName(rootMidi + 7), midiToName(rootMidi + 12), midiToName(rootMidi + 7)];
    }
    return [root, null, null, null];
  }

  function bassNoteForChord(chordId) {
    const chord = paletteMap.get(chordId);
    const root = chord?.notes?.[0];
    const midi = nameToMidi(root);
    if (midi === null) return null;
    return midiToName(36 + (((midi % 12) + 12) % 12));
  }

  function syncBassWithTimeline() {
    const slots = Array.from(gridDiv.querySelectorAll(".slot"));
    bassBars = slots.map((slot, index) => {
      const chordId = slot.dataset.chordId || null;
      const existing = bassBars[index];
      if (existing?.chordId === chordId) return existing;
      return { chordId, note: null };
    });
  }

  function renderBassHelper() {
    syncBassWithTimeline();
    bassBarsDiv.innerHTML = "";
    const hasChords = bassBars.some(bar => bar.chordId);
    const hasBass = bassBars.some(bar => bar.note);
    buildBassBtn.disabled = !hasChords;
    clearBassBtn.disabled = !hasBass;
    bassStyleButtons.forEach(button => { button.disabled = !hasChords; });

    if (!hasChords) {
      bassGuide.textContent = "Build a chord progression first.";
      return;
    }
    if (!hasBass) bassGuide.textContent = "Choose the starting-bass button and we will find every note for you.";

    bassBars.forEach((bar, index) => {
      if (!bar.chordId) return;
      const card = document.createElement("div");
      card.className = "bass-bar";
      card.dataset.barIndex = String(index);
      const chord = paletteMap.get(bar.chordId);
      const pattern = bassPatternForBar(index).filter(Boolean).map(displayNote).join(" · ");
      card.innerHTML = `<span>Bar ${index + 1}</span><strong>${bar.note ? displayNote(bar.note) : "—"}</strong><small>${bar.note ? `${pattern} · follows ${chord?.symbol || bar.chordId}` : "not added"}</small>`;
      bassBarsDiv.appendChild(card);
    });
  }

  miniPlayBtn.addEventListener("click", () => {
    if (Tone.Transport.state === "started") {
      Tone.Transport.pause();
      upperSynth.releaseAll();
      bassSynth.triggerRelease();
      melodySynth.triggerRelease();
      songBassSynth.triggerRelease();
      syncMiniPlayerState();
      return;
    }
    if (Tone.Transport.state === "paused") {
      Tone.Transport.start();
      syncMiniPlayerState();
      return;
    }
    playBtn.click();
  });

  miniStopBtn.addEventListener("click", hardStop);

  miniLoopBtn.addEventListener("click", () => {
    isLooping = !isLooping;
    miniLoopBtn.setAttribute("aria-pressed", String(isLooping));
    miniLoopBtn.textContent = `Loop: ${isLooping ? "On" : "Off"}`;
    if (Tone.Transport.state !== "stopped") hardStop();
  });

  function updateMiniPlayerVisibility() {
    const hasChords = Boolean(gridDiv.querySelector('.slot[data-chord-id]'));
    miniPlayer.hidden = !hasChords || transportInView;
    updateMiniPlayerMeta();
    if (!hasChords) {
      miniStatus.textContent = "Ready to play";
      miniChord.textContent = "Your progression";
    }
  }

  const transportVisibilityObserver = new IntersectionObserver(entries => {
    transportInView = entries.some(entry => entry.isIntersecting);
    updateMiniPlayerVisibility();
  }, { threshold: 0.12 });
  transportVisibilityObserver.observe(transportPanel);

  function updateMiniPlayerMeta() {
    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    const rhythmLabel = starterRhythm.charAt(0).toUpperCase() + starterRhythm.slice(1);
    miniMeta.textContent = `${STYLE_PRESETS[starterStyle].name} · ${bpm} BPM · ${rhythmLabel}`;
  }

  function syncMiniPlayerState() {
    if (Tone.Transport.state === "started") {
      miniPlayBtn.textContent = "Pause";
      miniStatus.textContent = "Playing";
    } else if (Tone.Transport.state === "paused") {
      miniPlayBtn.textContent = "Resume";
      miniStatus.textContent = "Paused";
    } else {
      miniPlayBtn.textContent = "Play";
      if (gridDiv.querySelector('.slot[data-chord-id]')) miniStatus.textContent = "Ready to play";
    }
  }

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
    Tone.Transport.loop = isLooping;
    Tone.Transport.loopEnd = `${bars}m`;
    Tone.Transport.position = "0:0:0";

    const { sequence, slotRefs } = collectSequence();
    seq = smoothVoiceLeading(sequence);
    slotsLinear = slotRefs;
    syncMelodyWithTimeline();
    syncBassWithTimeline();

    const rhythm = rhythmSettings();
    let chordHit = 0;
    const playDuration = isLooping ? undefined : `${bars}m`;
    repeatId = Tone.Transport.scheduleRepeat((time) => {
      const idx = Math.floor(chordHit / rhythm.hits) % seq.length;
      const notes = seq[idx];

      if (notes && notes.length) {
        playCleanChord(notes, rhythm.duration, time, !bassBars[idx]?.note);
      }

      if (chordHit % rhythm.hits === 0) updatePlayhead(idx);
      chordHit++;
    }, rhythm.interval, 0, playDuration);

    let clickBeat = 0;
    metronomeRepeatId = Tone.Transport.scheduleRepeat((time) => {
      if (metEnabled.checked) {
        const tick = clickBeat % 4 === 0 ? "C6" : "C5";
        clickSynth.triggerAttackRelease(tick, "16n", time);
      }
      clickBeat++;
    }, "4n", 0, playDuration);

    let melodyBeat = 0;
    melodyRepeatId = Tone.Transport.scheduleRepeat((time) => {
      const barIndex = Math.floor(melodyBeat / 4) % Math.max(1, melodyBars.length);
      const beatIndex = melodyBeat % 4;
      const note = melodyBars[barIndex]?.beats?.[beatIndex];
      if (note) melodySynth.triggerAttackRelease(note, "8n", time, styleMix().melodyVelocity);
      Tone.Draw.schedule(() => updateMelodyPlayhead(barIndex, beatIndex, note), time);
      melodyBeat++;
    }, "4n", 0, playDuration);

    let bassBeat = 0;
    songBassRepeatId = Tone.Transport.scheduleRepeat((time) => {
      const barIndex = Math.floor(bassBeat / 4) % Math.max(1, bassBars.length);
      const beatIndex = bassBeat % 4;
      const note = bassPatternForBar(barIndex)[beatIndex];
      const duration = bassStyle === "hold" ? "1m" : "8n";
      if (note) songBassSynth.triggerAttackRelease(note, duration, time, styleMix().bassVelocity);
      Tone.Draw.schedule(() => updateBassPlayhead(barIndex), time);
      bassBeat++;
    }, "4n", 0, playDuration);

    if (!isLooping) {
      endScheduleId = Tone.Transport.scheduleOnce((time) => {
        Tone.Draw.schedule(() => hardStop(), time);
      }, `${bars}m`);
    }

    await sleep(150);
    Tone.Transport.start();
    syncMiniPlayerState();
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
    if (metronomeRepeatId !== null) {
      Tone.Transport.clear(metronomeRepeatId);
      metronomeRepeatId = null;
    }
    if (endScheduleId !== null) {
      Tone.Transport.clear(endScheduleId);
      endScheduleId = null;
    }
    if (melodyRepeatId !== null) {
      Tone.Transport.clear(melodyRepeatId);
      melodyRepeatId = null;
    }
    if (songBassRepeatId !== null) {
      Tone.Transport.clear(songBassRepeatId);
      songBassRepeatId = null;
    }
    Tone.Transport.cancel();
    Tone.Transport.position = "0:0:0";
    upperSynth.cancel?.(0);
    bassSynth.cancel?.(0);
    clickSynth.cancel?.(0);
    melodySynth.cancel?.(0);
    songBassSynth.cancel?.(0);
    upperSynth.releaseAll();
    bassSynth.triggerRelease();
    clickSynth.releaseAll?.();
    melodySynth.triggerRelease();
    songBassSynth.triggerRelease();
    clearPlayhead();
    clearNowPlayingTile();
    clearMelodyPlayhead();
    clearBassPlayhead();
    syncMiniPlayerState();
    miniChord.textContent = "Your progression";
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

  function playCleanChord(notes, duration, time = Tone.now(), includeBass = true) {
    if (!notes || !notes.length) return;
    const [bass, ...upper] = notes;
    const mix = styleMix();
    if (includeBass && bass) bassSynth.triggerAttackRelease(bass, duration, time, mix.bassVelocity);
    if (upper.length) upperSynth.triggerAttackRelease(upper, duration, time, mix.chordVelocity);
  }

  // Choose comfortable inversions with minimal movement between upper voices.
  // When the timeline contains an exact repeating pattern, voice that pattern
  // once and reuse it so later repetitions cannot drift higher or lower.
  function smoothVoiceLeading(sequence) {
    const repeatLength = findRepeatingPatternLength(sequence);
    if (repeatLength < sequence.length) {
      const voicedPattern = voiceSequence(sequence.slice(0, repeatLength));
      return sequence.map((_, index) => {
        const notes = voicedPattern[index % repeatLength];
        return notes ? [...notes] : notes;
      });
    }
    return voiceSequence(sequence);
  }

  function voiceSequence(sequence) {
    let previousUpper = null;
    return sequence.map(notes => {
      if (!notes || notes.length < 2) return notes;

      const midiNotes = notes.map(nameToMidi).filter(n => n !== null);
      if (midiNotes.length < 2) return notes;

      const bass = midiNotes[0];
      const upperPitchClasses = midiNotes.slice(1).map(n => ((n % 12) + 12) % 12);
      const candidates = buildUpperVoicingCandidates(upperPitchClasses);
      const chosen = previousUpper
        ? candidates.reduce((best, candidate) =>
            voiceLeadingScore(candidate, previousUpper) < voiceLeadingScore(best, previousUpper) ? candidate : best
          )
        : candidates.reduce((best, candidate) =>
            voiceCenterDistance(candidate) < voiceCenterDistance(best) ? candidate : best
          );

      previousUpper = chosen;
      return [bass, ...chosen].map(midiToName);
    });
  }

  function findRepeatingPatternLength(sequence) {
    const signatures = sequence.map(notes => notes ? notes.join("|") : "_");
    for (let length = 1; length <= Math.floor(signatures.length / 2); length++) {
      if (signatures.length % length !== 0) continue;
      const repeats = signatures.every((signature, index) => signature === signatures[index % length]);
      if (repeats) return length;
    }
    return sequence.length;
  }

  function showGuideResult(item, sequence) {
    const describeRole = (roman, position, phraseNumber) => {
      if (position === 0) return phraseNumber === 1
        ? "establishes the musical home and sets the scene"
        : "opens the answer while keeping the original idea recognizable";
      if (position === 1) return "moves the emotion away from where the phrase began";
      if (position === 2) return "changes the pressure and prepares the phrase ending";
      if (["I", "i"].includes(roman)) return "returns home and lets the phrase settle";
      if (roman === "V") return "leaves a strong pull into the next phrase or repeat";
      return "turns your ear toward whatever comes next";
    };

    const renderPhrase = (phrase, phraseNumber) => phrase.map((roman, index) => {
      const chord = paletteMap.get(roman);
      const symbol = chord?.symbol || roman;
      const barNumber = ((phraseNumber - 1) * 4) + index + 1;
      return `<li><span class="story-bar-number">${barNumber}</span><strong>${symbol}</strong><span>${describeRole(roman, index, phraseNumber)}</span><small>Bar ${barNumber} · ${roman}</small></li>`;
    }).join("");

    const firstPhrase = sequence.slice(0, 4);
    const secondPhrase = sequence.slice(4, 8);
    const phraseMarkup = `
      <div class="phrase-block">
        <div class="phrase-heading"><strong>First phrase</strong><span>Bars 1–4 introduce the idea.</span></div>
        <ol class="chord-story">${renderPhrase(firstPhrase, 1)}</ol>
      </div>
      ${secondPhrase.length ? `
        <div class="phrase-block">
          <div class="phrase-heading"><strong>Second phrase</strong><span>${item.secondPhrase}</span></div>
          <ol class="chord-story">${renderPhrase(secondPhrase, 2)}</ol>
        </div>` : ""}`;

    guideResult.hidden = false;
    guideResult.innerHTML = `
      <div class="guide-result-heading">
        <div><span>Your starting point</span><h3>${item.name}</h3></div>
      </div>
      <p class="guide-setup-summary">${starterSetupExplanation()}</p>
      <div class="phrase-explanation">${phraseMarkup}</div>
      <div class="try-next"><strong>Try this next</strong><span>${item.next}</span></div>`;

    guideResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function starterSetupExplanation() {
    return `We chose ${keySel.value} ${modeSel.value}, ${tempoInput.value} BPM, ${starterLength} bars, and a ${starterRhythm} rhythm for your ${STYLE_PRESETS[starterStyle].name} style. You do not need to memorize the chords; listen for the job each one does.`;
  }

  function buildUpperVoicingCandidates(pitchClasses) {
    const candidates = [];
    for (let inversion = 0; inversion < pitchClasses.length; inversion++) {
      const rotated = [...pitchClasses.slice(inversion), ...pitchClasses.slice(0, inversion)];
      for (let startingOctave = 4; startingOctave <= 5; startingOctave++) {
        const voiced = [];
        for (const pitchClass of rotated) {
          let note = (startingOctave + 1) * 12 + pitchClass;
          while (voiced.length && note <= voiced[voiced.length - 1]) note += 12;
          voiced.push(note);
        }
        if (voiced.every(note => note >= 55 && note <= 79)) candidates.push(voiced);
      }
    }
    return candidates.length ? candidates : [pitchClasses.map(pc => 60 + pc).sort((a, b) => a - b)];
  }

  function voiceMovement(candidate, previous) {
    return candidate.reduce((total, note, index) => total + Math.abs(note - previous[index]), 0);
  }

  function voiceLeadingScore(candidate, previous) {
    return voiceMovement(candidate, previous) + (voiceCenterDistance(candidate) * 0.35);
  }

  function voiceCenterDistance(candidate) {
    const average = candidate.reduce((sum, note) => sum + note, 0) / candidate.length;
    return Math.abs(average - 65);
  }

  // --- Visual helpers
  function updatePlayhead(idx) {
    clearPlayhead();

    const slot = slotsLinear[idx];
    if (slot) slot.classList.add("playing");
    if (slot) {
      miniStatus.textContent = `Bar ${idx + 1} of ${slotsLinear.length}`;
      miniChord.textContent = slot.textContent || "Empty bar";
    }

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

  function updateMelodyPlayhead(barIndex, beatIndex, note) {
    clearMelodyPlayhead();
    const bar = melodyBarsDiv.querySelector(`.melody-bar[data-bar-index="${barIndex}"]`);
    const beat = bar?.querySelector(`.melody-beat[data-beat-index="${beatIndex}"]`);
    bar?.classList.add("playing");
    beat?.classList.add("playing");
    if (!note) beat?.classList.add("resting");
    if (note) {
      const choice = bar?.querySelector(`.melody-note-choice[data-note="${CSS.escape(note)}"]`);
      choice?.classList.add("now-playing");
    }
  }

  function clearMelodyPlayhead() {
    melodyBarsDiv.querySelectorAll(".playing, .resting, .now-playing").forEach(element =>
      element.classList.remove("playing", "resting", "now-playing")
    );
  }

  function updateBassPlayhead(barIndex) {
    clearBassPlayhead();
    bassBarsDiv.querySelector(`.bass-bar[data-bar-index="${barIndex}"]`)?.classList.add("playing");
  }

  function clearBassPlayhead() {
    bassBarsDiv.querySelectorAll(".bass-bar.playing").forEach(element => element.classList.remove("playing"));
  }

  // ---------- CHORD PALETTE ----------
  function refreshPalette(shouldUpdateHash = true) {
    try {
      const key = keySel.value;
      const mode = modeSel.value === "major" ? "major" : "natural_minor";
      const palette = buildDiatonicSeventhChords(key, mode);
      paletteByDegree = palette;
      paletteMap = new Map(palette.map(c => [c.id, c]));
      paintPalette(palette);
      refreshSlotsFromChordIds();
      renderProgressions();  // refresh progressions & chord-symbol lines
      updateSetupCharacter();
      if (shouldUpdateHash) updateUrlHash();
    } catch (err) {
      console.error("Chord palette generation failed; using C major fallback.", err);
      const fallback = [
        { id: "I",   roman: "I",   symbol: "Cmaj7", notes:["C2","E3","G3","B3"] },
        { id: "ii",  roman: "ii",  symbol: "Dm7",   notes:["D2","F3","A3","C4"] },
        { id: "iii", roman: "iii", symbol: "Em7",   notes:["E2","G3","B3","D4"] },
        { id: "IV",  roman: "IV",  symbol: "Fmaj7", notes:["F2","A3","C4","E4"] },
        { id: "V",   roman: "V",   symbol: "G7",    notes:["G2","B3","D4","F4"] },
        { id: "vi",  roman: "vi",  symbol: "Am7",   notes:["A2","C3","E3","G3"] },
        { id: "viiø",roman: "viiø",symbol: "Bm7♭5", notes:["B2","D3","F3","A3"] },
      ];
      paletteByDegree = fallback;
      paletteMap = new Map(fallback.map(c => [c.id, c]));
      paintPalette(fallback);
      refreshSlotsFromChordIds();
      renderProgressions();
      updateSetupCharacter();
      if (shouldUpdateHash) updateUrlHash();
    }
  }

  function paintPalette(palette) {
    paletteDiv.innerHTML = "";
    selectedChord = null;

    for (const c of palette) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.title = `${c.symbol} = ${c.notes.join(" ")}`;
      tile.dataset.chordId = c.id;
      tile.setAttribute("aria-label", `${c.roman}, ${c.symbol}. Select and preview chord`);

      const roman = document.createElement("div");
      roman.className = "roman";
      roman.textContent = c.roman;

      const symbol = document.createElement("div");
      symbol.className = "symbol";
      symbol.textContent = c.symbol;

      tile.appendChild(roman);
      tile.appendChild(symbol);

      const usedBadge = document.createElement("span");
      usedBadge.className = "used-badge";
      usedBadge.hidden = true;
      tile.appendChild(usedBadge);

      tile.addEventListener("click", async () => {
        const wasSelected = tile.classList.contains("selected");
        document.querySelectorAll("#palette .tile").forEach(el => el.classList.remove("selected"));

        if (wasSelected) {
          selectedChord = null;
          updatePaletteContext();
        } else {
          setEraseMode(false);
          tile.classList.add("selected");
          selectedChord = c;
          updatePaletteContext();
          try { await Tone.start(); } catch (_) {}
          playCleanChord(c.notes, "8n", Tone.now());
        }
      });

      paletteDiv.appendChild(tile);
    }
    updatePaletteContext();
  }

  eraseModeBtn.addEventListener("click", () => setEraseMode(!isEraseMode));

  function setEraseMode(enabled) {
    isEraseMode = enabled;
    eraseModeBtn.classList.toggle("active", enabled);
    eraseModeBtn.setAttribute("aria-pressed", String(enabled));
    eraseModeBtn.textContent = `Erase chords: ${enabled ? "On" : "Off"}`;
    if (enabled) {
      selectedChord = null;
      paletteDiv.querySelectorAll(".tile.selected").forEach(tile => tile.classList.remove("selected"));
      timelineGuide.innerHTML = "<strong>Erase is on.</strong> Tap any filled timeline position to clear it. Turn erase off when finished.";
    } else {
      timelineGuide.textContent = "Select a chord above, then tap a timeline position to replace it.";
    }
    updatePaletteContext();
  }

  shapeButtons.forEach(button => {
    button.addEventListener("click", () => {
      activeShapeIntent = button.dataset.intent;
      shapeAttempt = 0;
      shapeButtons.forEach(choice => choice.classList.toggle("selected", choice === button));
      createShapeProposal();
    });
  });

  function createShapeProposal() {
    const slots = Array.from(gridDiv.querySelectorAll(".slot"));
    const filledCount = slots.filter(slot => slot.dataset.chordId).length;
    if (!activeShapeIntent || filledCount < 2) {
      currentShapeProposal = null;
      shapeProposal.hidden = false;
      shapeProposal.innerHTML = "<p>Build or place at least two chords first, then come back here.</p>";
      return;
    }

    const lastIndex = slots.length - 1;
    let targetIndices = [Math.min(2, lastIndex)];
    let preferredIds = [];
    let reason = "This gives the progression a different emotional colour.";

    switch (activeShapeIntent) {
      case "brighter":
        targetIndices = slots.length >= 8 ? [2, 6] : [Math.min(2, lastIndex)];
        preferredIds = modeSel.value === "major" ? ["IV", "I", "V"] : ["♭III", "♭VI", "i"];
        reason = slots.length >= 8
          ? "Matching changes in both phrases open the sound without making the second half feel disconnected."
          : "This opens the sound and reduces some of the weight in the middle.";
        break;
      case "darker":
        targetIndices = slots.length >= 8 ? [2, 6] : [Math.min(2, lastIndex)];
        preferredIds = modeSel.value === "major" ? ["vi", "ii", "IV"] : ["♭VI", "iv", "i"];
        reason = slots.length >= 8
          ? "Adding shadow in the same place in both phrases keeps the eight-bar idea balanced."
          : "This adds more shadow without changing the whole idea.";
        break;
      case "tension":
        targetIndices = slots.length >= 8 ? [2, 6] : [Math.max(0, lastIndex - 1)];
        preferredIds = modeSel.value === "major" ? ["V", "ii", "viiø"] : ["V", "iiø", "♭VII"];
        reason = slots.length >= 8
          ? "Both phrases now build a stronger pull into their closing bars."
          : "This creates a stronger pull into the final bar.";
        break;
      case "ending":
        targetIndices = [lastIndex];
        preferredIds = [modeSel.value === "major" ? "I" : "i", "V"];
        reason = "Ending on the home chord makes the idea feel settled and complete.";
        break;
      case "variation":
        targetIndices = slots.length >= 8 ? [4, 5, 6, 7] : [Math.max(1, lastIndex - 1)];
        reason = slots.length >= 8
          ? "This makes the second half answer the first instead of simply repeating it."
          : "This changes the return while keeping the opening recognizable.";
        break;
      case "surprise":
        targetIndices = [shapeAttempt % slots.length];
        reason = "This is a safe unexpected turn using a chord that still belongs to the same key.";
        break;
    }

    const changes = targetIndices.map((index, position) => {
      const fromId = slots[index]?.dataset.chordId;
      let choices = preferredIds;
      if (activeShapeIntent === "variation") {
        const starterVariationId = activeStarterMood?.variation?.[position];
        choices = starterVariationId
          ? [starterVariationId, ...shiftedChordChoices(fromId, 2 + shapeAttempt + position)]
          : shiftedChordChoices(fromId, 2 + shapeAttempt + position);
      } else if (activeShapeIntent === "surprise") {
        choices = shiftedChordChoices(fromId, 3 + shapeAttempt);
      }
      const toChord = firstDifferentChord(choices, fromId);
      return fromId && toChord ? { index, fromId, toId: toChord.id } : null;
    }).filter(Boolean);

    if (!changes.length) {
      shapeAttempt++;
      if (shapeAttempt < 8) return createShapeProposal();
      shapeProposal.hidden = false;
      shapeProposal.innerHTML = "<p>There is not a useful alternative for this idea yet. Try another direction.</p>";
      return;
    }

    currentShapeProposal = { changes, reason };
    renderShapeProposal();
  }

  function shiftedChordChoices(currentId, shift) {
    const currentIndex = Math.max(0, chordDegreeIndex(currentId));
    return Array.from({ length: paletteByDegree.length }, (_, offset) =>
      paletteByDegree[(currentIndex + shift + offset) % paletteByDegree.length]?.id
    ).filter(Boolean);
  }

  function firstDifferentChord(ids, currentId) {
    for (let offset = 0; offset < ids.length; offset++) {
      const id = ids[(offset + shapeAttempt) % ids.length];
      const chord = paletteMap.get(id);
      if (chord && chord.id !== currentId) return chord;
    }
    return paletteByDegree.find(chord => chord.id !== currentId) || null;
  }

  function renderShapeProposal() {
    const proposal = currentShapeProposal;
    if (!proposal) return;
    const changeRows = proposal.changes.map(change => {
      const fromChord = paletteMap.get(change.fromId);
      const toChord = paletteMap.get(change.toId);
      return `<li><span>Bar ${change.index + 1}</span><strong>${fromChord?.symbol || change.fromId} → ${toChord?.symbol || change.toId}</strong></li>`;
    }).join("");
    const changeLabel = proposal.changes.length > 1 ? "Suggested changes" : "Suggested change";
    shapeProposal.hidden = false;
    shapeProposal.innerHTML = `
      <div class="proposal-copy">
        <span>${changeLabel}</span>
        <ul class="proposal-change-list">${changeRows}</ul>
        <p>${proposal.reason}</p>
      </div>
      <div class="proposal-actions">
        <button type="button" data-action="before">Hear current</button>
        <button type="button" data-action="after">Hear change</button>
        <button type="button" class="keep-change" data-action="keep">Keep change</button>
        <button type="button" data-action="another">Try another</button>
      </div>`;

    shapeProposal.querySelector('[data-action="before"]').addEventListener("click", () => previewShapeProposal(false));
    shapeProposal.querySelector('[data-action="after"]').addEventListener("click", () => previewShapeProposal(true));
    shapeProposal.querySelector('[data-action="keep"]').addEventListener("click", keepShapeProposal);
    shapeProposal.querySelector('[data-action="another"]').addEventListener("click", () => {
      shapeAttempt++;
      createShapeProposal();
    });
  }

  async function previewShapeProposal(useChange) {
    if (!currentShapeProposal) return;
    hardStop();
    try { await Tone.start(); } catch (_) {}
    const allSlots = Array.from(gridDiv.querySelectorAll(".slot"));
    const changedIndices = new Map(currentShapeProposal.changes.map(change => [change.index, change.toId]));
    const showFullIdea = allSlots.length >= 8 && currentShapeProposal.changes.length > 1;
    const firstChangeIndex = currentShapeProposal.changes[0].index;
    const groupStart = showFullIdea ? 0 : Math.floor(firstChangeIndex / 4) * 4;
    const groupLength = showFullIdea ? allSlots.length : 4;
    const previewNotes = allSlots.slice(groupStart, groupStart + groupLength).map((slot, offset) => {
      const absoluteIndex = groupStart + offset;
      const id = useChange && changedIndices.has(absoluteIndex)
        ? changedIndices.get(absoluteIndex)
        : slot.dataset.chordId;
      return paletteMap.get(id)?.notes || null;
    });
    const voiced = smoothVoiceLeading(previewNotes);
    const bpm = clamp(parseInt(tempoInput.value, 10) || 90, 40, 200);
    const stepSeconds = Math.max(0.65, Math.min(1.35, (60 / bpm) * 1.5));
    const startTime = Tone.now() + 0.05;
    const previewRhythm = rhythmSettings();
    const hitSpacing = stepSeconds / previewRhythm.hits;
    const hitDuration = hitSpacing * previewRhythm.midiLength;
    voiced.forEach((notes, index) => {
      if (!notes) return;
      for (let hit = 0; hit < previewRhythm.hits; hit++) {
        playCleanChord(notes, hitDuration, startTime + (index * stepSeconds) + (hit * hitSpacing));
      }
    });
  }

  function keepShapeProposal() {
    if (!currentShapeProposal) return;
    hardStop();
    const slots = gridDiv.querySelectorAll(".slot");
    const snapshots = [];
    const keptLabels = [];
    currentShapeProposal.changes.forEach(change => {
      const slot = slots[change.index];
      const chord = paletteMap.get(change.toId);
      if (!slot || !chord) return;
      snapshots.push(snapshotSlot(slot));
      applyChordToSlot(slot, chord);
      keptLabels.push(`bar ${change.index + 1} to ${chord.symbol}`);
    });
    if (!snapshots.length) return;
    pushUndo({ type: "place", changes: snapshots });
    updateUrlHash();
    shapeProposal.innerHTML = `<p class="proposal-kept"><strong>${snapshots.length > 1 ? "Changes" : "Change"} kept.</strong> Updated ${keptLabels.join(" and ")}. You can undo ${snapshots.length > 1 ? "them" : "it"} at any time.</p>`;
    currentShapeProposal = null;
  }

  function updatePaletteContext() {
    updateMiniPlayerVisibility();
    renderMelodyHelper();
    renderBassHelper();
    updateSetupCharacter();
    const firstCycle = Array.from(gridDiv.querySelectorAll(".slot")).slice(0, 4);
    const filledFirstCycle = firstCycle.filter(slot => slot.dataset.chordId);
    const positionMap = new Map();

    firstCycle.forEach((slot, index) => {
      const id = slot.dataset.chordId;
      if (!id) return;
      if (!positionMap.has(id)) positionMap.set(id, []);
      positionMap.get(id).push(index + 1);
    });

    paletteDiv.querySelectorAll(".tile").forEach(tile => {
      const badge = tile.querySelector(".used-badge");
      const positions = positionMap.get(tile.dataset.chordId) || [];
      tile.classList.toggle("used", positions.length > 0);
      if (badge) {
        badge.hidden = positions.length === 0;
        badge.textContent = positions.length ? `In bar${positions.length > 1 ? "s" : ""} ${positions.join(" & ")}` : "";
      }
    });

    if (!filledFirstCycle.length) {
      paletteWhy.textContent = "These are the chords that will naturally fit the musical starting point created above.";
      paletteCurrent.hidden = true;
      if (selectedChord) {
        paletteGuide.innerHTML = `<strong>${selectedChord.symbol} selected.</strong> Tap an empty timeline position to place it.`;
        timelineGuide.innerHTML = `<strong>${selectedChord.symbol} is ready.</strong> Tap an empty timeline position to place it.`;
      } else if (isEraseMode) {
        paletteGuide.innerHTML = "<strong>Erase is on.</strong> There are no chords to erase yet.";
        timelineGuide.innerHTML = "<strong>Erase is on.</strong> There are no chords to erase yet.";
      } else {
        paletteGuide.textContent = "Choose a feeling above and build your starting point first, or select a chord to begin manually.";
        timelineGuide.textContent = "Select a chord above, then tap a timeline position to place it.";
      }
      return;
    }

    const symbols = firstCycle.map(slot => paletteMap.get(slot.dataset.chordId)?.symbol || "—");
    paletteWhy.textContent = `Your starting point is in ${keySel.value} ${modeSel.value}. Every chord below belongs to that same musical family, so it is safe to experiment.`;
    paletteCurrent.hidden = false;
    paletteCurrent.innerHTML = `<span>Your loop</span><strong>${symbols.join(" → ")}</strong>`;

    if (selectedChord) {
      paletteGuide.innerHTML = `<strong>${selectedChord.symbol} selected.</strong> Now tap any chord in the timeline below to replace it. Tap ${selectedChord.symbol} again to cancel.`;
      timelineGuide.innerHTML = `<strong>${selectedChord.symbol} is ready.</strong> Tap a timeline position to replace its chord.`;
    } else if (isEraseMode) {
      paletteGuide.innerHTML = "<strong>Erase is on.</strong> Use the timeline below to remove chords, or turn erase off to continue choosing sounds.";
      timelineGuide.innerHTML = "<strong>Erase is on.</strong> Tap any filled timeline position to clear it. Turn erase off when finished.";
    } else {
      paletteGuide.innerHTML = "Tap a chord below to hear it and select it. Chords marked with a bar number are already part of your starting point.";
      timelineGuide.textContent = "Select a chord above, then tap a timeline position to replace it.";
    }
  }

  function refreshSlotsFromChordIds() {
    gridDiv.querySelectorAll(".slot").forEach(slot => {
      if (slot.dataset.chordId) {
        const exactChord = paletteMap.get(slot.dataset.chordId);
        const degreeIndex = chordDegreeIndex(slot.dataset.chordId);
        const chord = exactChord || (degreeIndex >= 0 ? paletteByDegree[degreeIndex] : null);
        if (chord) {
          applyChordToSlot(slot, chord);
        }
      }
    });
  }

  function chordDegreeIndex(id) {
    const degreeIds = [
      ["I", "i"],
      ["ii", "iiø"],
      ["iii", "♭III"],
      ["IV", "iv"],
      ["V", "v"],
      ["vi", "♭VI"],
      ["viiø", "♭VII"],
    ];
    return degreeIds.findIndex(ids => ids.includes(id));
  }
  keySel.addEventListener("change", () => {
    melodyBars = [];
    bassBars = [];
    refreshPalette();
    renderMelodyHelper();
  });
  modeSel.addEventListener("change", () => {
    melodyBars = [];
    bassBars = [];
    refreshPalette();
    renderMelodyHelper();
  });

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
    const melodyStr = state.melody
      .map(bar => bar.map(note => note ?? "_").join(","))
      .join("|");
    const bassStr = state.bass.map(note => note ?? "_").join(",");
    const params = new URLSearchParams({
      v: "0.7",
      k: state.key,
      mode: state.mode,
      bpm: String(state.tempoBPM),
      rhythm: state.rhythm,
      style: state.style,
      bars: String(state.bars.length),
      seq: seqStr,
      melody: melodyStr,
      bass: bassStr,
      bassStyle: state.bassStyle,
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
      rhythm: starterRhythm,
      style: starterStyle,
      melody: melodyBars.map(bar => [...bar.beats]),
      bass: bassBars.map(bar => bar.note),
      bassStyle,
      bars,
    };
  }

  function readStateFromHash() {
    if (!location.hash) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    const k = p.get("k");
    const m = p.get("mode");
    const bpm = p.get("bpm");
    const rhythm = p.get("rhythm");
    const styleParam = p.get("style");
    const barCount = parseInt(p.get("bars") || "4", 10);
    const seq = p.get("seq");
    const melodyParam = p.get("melody");
    const bassParam = p.get("bass");
    const bassStyleParam = p.get("bassStyle");

    const safeBarCount = [4, 8, 16].includes(barCount)
      ? barCount
      : barCount <= 4 ? 4 : barCount <= 8 ? 8 : 16;
    let sequence = seq
      ? seq
        .split("|")
        .map(bar => bar.split(",").map(tok => (tok === "_" ? null : tok)))
      : null;

    // Convert links from the earlier four-slots-per-bar prototype into the
    // simpler one-chord-per-bar timeline. Its first bar contained the loop.
    if (sequence?.some(bar => bar.length > 1)) {
      const oldLoop = sequence.find(bar => bar.some(Boolean)) || sequence[0] || [];
      sequence = Array.from({ length: safeBarCount }, (_, index) => [oldLoop[index % oldLoop.length] ?? null]);
    }
    const melody = melodyParam
      ? melodyParam.split("|").map(bar => bar.split(",").slice(0, 4).map(note => note === "_" ? null : note))
      : null;
    const bass = bassParam
      ? bassParam.split(",").map(note => note === "_" ? null : note)
      : null;

    return {
      key: k,
      mode: m,
      tempo: bpm ? clamp(parseInt(bpm, 10) || 90, 40, 200) : null,
      rhythm: ["flowing", "pulsing", "driving"].includes(rhythm) ? rhythm : null,
      style: ["pop", "lofi", "cinematic", "arcade"].includes(styleParam) ? styleParam : "pop",
      barCount: safeBarCount,
      sequence,
      melody,
      bass,
      bassStyle: ["hold", "pulse", "motion"].includes(bassStyleParam) ? bassStyleParam : null,
    };
  }

  function collectChordIdsByBar() {
    return Array.from(gridDiv.querySelectorAll(".bar"), bar =>
      Array.from(bar.querySelectorAll(".slot"), slot => slot.dataset.chordId ?? null)
    );
  }

  function restoreSequenceToGrid(barsIds) {
    const bars = gridDiv.querySelectorAll(".bar");
    const limit = Math.min(bars.length, barsIds.length);
    for (let b = 0; b < limit; b++) {
      const barIds = barsIds[b];
      const slots = bars[b].querySelectorAll(".slot");
      for (let s = 0; s < Math.min(slots.length, barIds.length); s++) {
        const id = barIds[s];
        const slot = slots[s];
        const degreeIndex = id ? chordDegreeIndex(id) : -1;
        const chord = id ? (paletteMap.get(id) || (degreeIndex >= 0 ? paletteByDegree[degreeIndex] : null)) : null;
        if (chord) {
          applyChordToSlot(slot, chord);
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
    const bytes = buildMIDI(smoothVoiceLeading(sequence), bpm, starterRhythm, melodyBars, bassBars, bassStyle, starterStyle);
    const k = keySel.value;
    const m = modeSel.value;
    const ts = timeStampString(); // YYYY-MM-DD_HHMM-SS
    const safeKey = k.replace("#", "sharp");
    const baseName = `EverElms_SongStarter_${starterStyle}_${safeKey}_${m}_${bpm}bpm_${ts}`;
    const readme = buildExportReadme(bpm);
    const zip = createStoredZip([
      { name: `${baseName}.mid`, data: new Uint8Array(bytes) },
      { name: "README.txt", data: new TextEncoder().encode(readme) },
    ]);
    const blob = new Blob([zip], { type: "application/zip" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  function buildExportReadme(bpm) {
    const chordNames = Array.from(gridDiv.querySelectorAll(".slot"), slot => slot.textContent.trim() || "—");
    const melodyLines = melodyBars
      .map((bar, index) => `Bar ${index + 1}: ${bar.beats.map(displayNote).join(" · ")}`)
      .join("\r\n");
    const hasMelody = melodyBars.some(bar => bar.beats.some(Boolean));
    const bassLines = bassBars
      .map((bar, index) => `Bar ${index + 1}: ${bassPatternFromRoot(bar.note, bassStyle).map(displayNote).join(" · ")}`)
      .join("\r\n");
    const hasBass = bassBars.some(bar => bar.note);

    return [
      "EVERELMS STUDIO — SONG STARTER BETA EXPORT",
      "=============================================",
      "",
      "BETA SOFTWARE",
      "If something looks or sounds wrong, contact info@everelmsstudio.com.",
      "",
      "YOUR IDEA",
      `Key: ${keySel.value} ${modeSel.value}`,
      `Tempo: ${bpm} BPM`,
      `Length: ${gridDiv.querySelectorAll(".bar").length} bars`,
      `Style: ${STYLE_PRESETS[starterStyle].name}`,
      `Chord rhythm: ${starterRhythm}`,
      `Bass style: ${bassStyleLabel()}`,
      `Progression: ${chordNames.join(" → ")}`,
      "",
      "MELODY",
      hasMelody ? melodyLines : "No melody was added. The melody channel is empty.",
      "",
      "BASS",
      hasBass ? bassLines : "No bass line was added.",
      "",
      "WHAT IS IN THE MIDI FILE?",
      "• MIDI channel 1 contains the chords.",
      `• MIDI channel 2 ${hasMelody ? "contains the melody" : "is empty because no melody was added"}.`,
      `• MIDI channel 3 ${hasBass ? "contains the bass line" : "is empty because no bass was added"}.`,
      "• The selected tempo and chord rhythm are included.",
      "• MIDI stores musical instructions, not recorded instrument sounds.",
      "",
      "HOW TO USE IT",
      "1. Unzip this folder.",
      "2. Open a music program that can import MIDI.",
      "3. Import the .mid file into your project.",
      "4. Choose your own instruments for the chord, melody, and bass channels.",
      "5. Edit, rearrange, or build on the notes as much as you like.",
      "",
      "If your program shows one combined MIDI clip, look for an option to separate or split it by MIDI channel.",
      "The sounds may differ from the browser because your music program supplies its own instruments.",
      "",
      "Return to EverElms Song Starter:",
      "https://www.everelmsstudio.com/chord-arranger.html",
      "Questions or problems: info@everelmsstudio.com",
      "",
      `Exported: ${new Date().toLocaleString()}`,
      "Made with EverElms Song Starter.",
      ""
    ].join("\r\n");
  }

  function createStoredZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const { time, date } = zipDateTime(new Date());

    files.forEach(file => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const localHeader = concatBytes(
        little32(0x04034b50), little16(20), little16(0), little16(0),
        little16(time), little16(date), little32(crc), little32(data.length),
        little32(data.length), little16(name.length), little16(0), name
      );
      localParts.push(localHeader, data);

      const centralHeader = concatBytes(
        little32(0x02014b50), little16(20), little16(20), little16(0), little16(0),
        little16(time), little16(date), little32(crc), little32(data.length),
        little32(data.length), little16(name.length), little16(0), little16(0),
        little16(0), little16(0), little32(0), little32(offset), name
      );
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    });

    const centralDirectory = concatBytes(...centralParts);
    const endRecord = concatBytes(
      little32(0x06054b50), little16(0), little16(0), little16(files.length),
      little16(files.length), little32(centralDirectory.length), little32(offset), little16(0)
    );
    return concatBytes(...localParts, centralDirectory, endRecord);
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function little16(value) {
    return Uint8Array.of(value & 255, (value >>> 8) & 255);
  }

  function little32(value) {
    return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  }

  function concatBytes(...parts) {
    const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let position = 0;
    parts.forEach(part => {
      output.set(part, position);
      position += part.length;
    });
    return output;
  }

  function zipDateTime(value) {
    const year = Math.max(1980, value.getFullYear());
    return {
      time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    };
  }

  function timeStampString() {
    const d = new Date();
    const pad = (n, l=2) => String(n).padStart(l, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  function buildMIDI(sequence, bpm, rhythmName, melody, bass, bassPatternName, styleName) {
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
    const programs = {
      pop: [0, 80, 33],
      lofi: [4, 80, 33],
      cinematic: [48, 73, 43],
      arcade: [81, 80, 38],
    }[styleName] || [0, 80, 33];
    pushEvent(0, 0xC0, programs[0]);
    pushEvent(0, 0xC1, programs[1]);
    pushEvent(0, 0xC2, programs[2]);

    const ticks = PPQ * 4; // one full 4/4 bar per timeline slot
    const rhythm = rhythmSettings(rhythmName);
    const mix = styleMix(styleName);
    const hitSpacing = ticks / rhythm.hits;
    const noteLength = Math.round(hitSpacing * rhythm.midiLength);
    const noteEvents = [];

    function addMidiNote(start, duration, note, channel, velocity) {
      noteEvents.push({ time: start, order: 1, bytes: [0x90 + channel, note, velocity] });
      noteEvents.push({ time: start + duration, order: 0, bytes: [0x80 + channel, note, 64] });
    }

    for (let i = 0; i < sequence.length; i++) {
      const notes = sequence[i];
      if (!notes || !notes.length) continue;
      const midis = notes.map(nameToMidi).filter(n => n !== null);
      const chordMidis = bass[i]?.note ? midis.slice(1) : midis;
      for (let hit = 0; hit < rhythm.hits; hit++) {
        const start = (i * ticks) + (hit * hitSpacing);
        chordMidis.forEach(note => addMidiNote(start, noteLength, note, 0, mix.midiChord));
      }
    }

    melody.forEach((bar, barIndex) => {
      bar.beats.forEach((noteName, beatIndex) => {
        const note = nameToMidi(noteName);
        if (note === null) return;
        addMidiNote((barIndex * ticks) + (beatIndex * PPQ), Math.round(PPQ * 0.72), note, 1, mix.midiMelody);
      });
    });

    bass.forEach((bar, barIndex) => {
      const pattern = bassPatternFromRoot(bar.note, bassPatternName);
      pattern.forEach((noteName, beatIndex) => {
        const note = nameToMidi(noteName);
        if (note === null) return;
        const duration = bassPatternName === "hold" ? Math.round(ticks * 0.9) : Math.round(PPQ * 0.72);
        addMidiNote((barIndex * ticks) + (beatIndex * PPQ), duration, note, 2, mix.midiBass);
      });
    });

    noteEvents.sort((a, b) => (a.time - b.time) || (a.order - b.order));
    let currentTick = 0;
    noteEvents.forEach(event => {
      pushEvent(Math.max(0, Math.round(event.time - currentTick)), ...event.bytes);
      currentTick = event.time;
    });

    const totalTicks = sequence.length * ticks;
    pushEvent(Math.max(0, Math.round(totalTicks - currentTick)), 0xff, 0x2f, 0x00);

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
    natural_minor:["m7","m7b5","maj7","m7","7","maj7","7"],
  };
  const ROMANS = {
    major:        ["I","ii","iii","IV","V","vi","viiø"],
    natural_minor:["i","iiø","♭III","iv","V","♭VI","♭VII"],
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
      const third = mode === "natural_minor" && i === 4
        ? raiseSemitone(scale[deg(i + 2)])
        : scale[deg(i + 2)];
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

  function raiseSemitone(note) {
    const raised = {
      C: "C#", "C#": "D", Db: "D", D: "D#", "D#": "E", Eb: "E",
      E: "F", F: "F#", "F#": "G", Gb: "G", G: "G#", "G#": "A",
      Ab: "A", A: "A#", "A#": "B", Bb: "B", B: "C", Cb: "C"
    };
    return raised[note] || note;
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

  // Initialize only after the theory tables above have been created.
  const paletteUsageObserver = new MutationObserver(updatePaletteContext);
  paletteUsageObserver.observe(gridDiv, { subtree: true, attributes: true, attributeFilter: ["data-chord-id"] });
  refreshPalette(false);
  if (pendingSeqFromHash) {
    restoreSequenceToGrid(pendingSeqFromHash);
    pendingSeqFromHash = null;
  }
  syncMelodyWithTimeline();
  if (pendingMelodyFromHash) {
    melodyBars = melodyBars.map((bar, index) => ({
      ...bar,
      beats: Array.from({ length: 4 }, (_, beat) => {
        const note = pendingMelodyFromHash[index]?.[beat] || null;
        return note && nameToMidi(note) !== null ? note : null;
      })
    }));
    pendingMelodyFromHash = null;
  }
  syncBassWithTimeline();
  if (pendingBassFromHash) {
    bassBars = bassBars.map((bar, index) => {
      const note = pendingBassFromHash[index] || null;
      const midi = nameToMidi(note);
      const balancedNote = midi === null ? null : midiToName(36 + (((midi % 12) + 12) % 12));
      return { ...bar, note: balancedNote };
    });
    pendingBassFromHash = null;
  }
  updatePaletteContext();
  updateUrlHash();
});
