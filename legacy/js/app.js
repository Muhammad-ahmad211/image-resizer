/* =========================================================
   Rescale app controller — wires the UI to the engine.
   ========================================================= */
(function () {
  "use strict";

  var Engine = window.IR.Engine;
  var Upscale = window.IR.Upscale;
  var BgRemove = window.IR.BgRemove;
  var PRESETS = window.IR.PRESETS || [];

  var $ = function (id) { return document.getElementById(id); };

  /* ---- Elements ------------------------------------------- */
  var el = {
    dropzone: $("dropzone"),
    workspace: $("workspace"),
    browseBtn: $("browseBtn"),
    sampleBtn: $("sampleBtn"),
    fileInput: $("fileInput"),

    stageCanvas: $("stageCanvas"),
    preview: $("preview"),
    badgeW: $("badgeW"),
    badgeH: $("badgeH"),
    stageBusy: $("stageBusy"),
    actualSize: $("actualSize"),
    scaleHint: $("scaleHint"),

    fileName: $("fileName"),
    replaceBtn: $("replaceBtn"),
    removeBtn: $("removeBtn"),

    toolBtns: document.querySelectorAll(".tool-btn[data-tool]"),
    toolPanels: document.querySelectorAll(".tool-panel[data-tool]"),

    segBtns: document.querySelectorAll(".seg-btn[data-mode]"),
    modePanels: document.querySelectorAll(".mode-panel"),

    scaleSeg: $("scaleSeg"),
    sharpRange: $("sharpRange"),
    sharpVal: $("sharpVal"),
    denoiseChk: $("denoiseChk"),
    upResult: $("upResult"),

    keySeg: $("keySeg"),
    keySwatch: $("keySwatch"),
    keyHint: $("keyHint"),
    tolRange: $("tolRange"),
    tolVal: $("tolVal"),
    softRange: $("softRange"),
    softVal: $("softVal"),
    connChk: $("connChk"),
    despillChk: $("despillChk"),
    fillSel: $("fillSel"),
    fillColor: $("fillColor"),

    inpW: $("inpW"),
    inpH: $("inpH"),
    lockBtn: $("lockBtn"),
    origDims: $("origDims"),

    pctRange: $("pctRange"),
    pctInp: $("pctInp"),
    pctChips: $("pctChips"),
    pctResult: $("pctResult"),

    presetGroups: $("presetGroups"),

    fitBlock: $("fitBlock"),
    fitSeg: $("fitSeg"),

    fmtSel: $("fmtSel"),
    qualityField: $("qualityField"),
    qualityRange: $("qualityRange"),
    qualityVal: $("qualityVal"),

    roOrigDims: $("roOrigDims"),
    roOrigSize: $("roOrigSize"),
    roNewDims: $("roNewDims"),
    roNewSize: $("roNewSize"),
    roDelta: $("roDelta"),

    downloadBtn: $("downloadBtn"),
    copyBtn: $("copyBtn"),
    resetBtn: $("resetBtn"),

    dragOverlay: $("dragOverlay"),
    toast: $("toast"),
    themeToggle: $("themeToggle")
  };

  /* ---- State --------------------------------------------- */
  var state = {
    source: null,
    tool: "resize",
    mode: "dimensions",
    width: 0,
    height: 0,
    lockAspect: true,
    percent: 100,
    presetIndex: -1,
    fit: "contain",
    format: "image/jpeg",
    quality: 0.85,
    up: { scale: 2, sharpen: 40, denoise: false },
    bg: {
      keyMode: "auto", key: null, tolerance: 30, softness: 2,
      connected: true, despill: true, fill: "transparent"
    },
    outputBlob: null,
    outputUrl: null
  };

  var UP_DEFAULTS = { scale: 2, sharpen: 40, denoise: false };
  var BG_DEFAULTS = {
    keyMode: "auto", key: null, tolerance: 30, softness: 2,
    connected: true, despill: true, fill: "transparent"
  };

  var renderTimer = null;
  var busyTimer = null;
  var pendingTool = null; // tool chosen from a landing-screen card, applied on load

  /* ---- Theme --------------------------------------------- */
  (function initTheme() {
    try {
      var saved = localStorage.getItem("rescale-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch (e) {}
  })();

  // Keep the footer copyright year current.
  (function setYear() {
    var y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());
  })();

  el.themeToggle.addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next;
    if (cur === "dark") next = "light";
    else if (cur === "light") next = "dark";
    else next = prefersDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rescale-theme", next); } catch (e) {}
  });

  /* ---- Presets UI --------------------------------------- */
  (function buildPresets() {
    var groups = {};
    var order = [];
    PRESETS.forEach(function (p, i) {
      if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); }
      groups[p.group].push({ p: p, i: i });
    });
    order.forEach(function (name) {
      var wrap = document.createElement("div");
      wrap.className = "preset-group";
      var h = document.createElement("div");
      h.className = "preset-group-label";
      h.textContent = name;
      wrap.appendChild(h);
      var grid = document.createElement("div");
      grid.className = "preset-grid";
      groups[name].forEach(function (entry) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "preset-btn";
        b.dataset.index = entry.i;
        b.innerHTML = "<b>" + entry.p.label + "</b><i>" + entry.p.w + " × " + entry.p.h + "</i>";
        b.addEventListener("click", function () { applyPreset(entry.i); });
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
      el.presetGroups.appendChild(wrap);
    });
  })();

  /* ---- Loading ----------------------------------------- */

  function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var file = null;
    for (var i = 0; i < fileList.length; i++) {
      if (fileList[i].type && fileList[i].type.indexOf("image/") === 0) { file = fileList[i]; break; }
    }
    if (!file) { toast("That doesn't look like an image."); return; }
    Engine.loadFile(file).then(onSourceLoaded).catch(function (err) { toast(err.message); });
  }

  function onSourceLoaded(record) {
    if (state.source && state.source.url) { try { URL.revokeObjectURL(state.source.url); } catch (e) {} }
    state.source = record;
    state.tool = "resize";
    state.mode = "dimensions";
    state.width = record.width;
    state.height = record.height;
    state.lockAspect = true;
    state.percent = 100;
    state.presetIndex = -1;
    state.fit = "contain";
    state.up = Object.assign({}, UP_DEFAULTS);
    state.bg = Object.assign({}, BG_DEFAULTS);

    el.dropzone.hidden = true;
    el.workspace.hidden = false;
    document.body.classList.add("has-image"); // hides the ad rails

    el.fileName.textContent = record.name;
    el.fileName.title = record.name;
    el.origDims.textContent = record.width + " × " + record.height + " px";
    el.roOrigDims.textContent = record.width + " × " + record.height;
    el.roOrigSize.textContent = record.size ? Engine.formatBytes(record.size) : "generated";

    el.lockBtn.classList.add("is-locked");
    el.lockBtn.setAttribute("aria-pressed", "true");
    syncToolControls();
    setTool(pendingTool || "resize");
    pendingTool = null;
    setMode("dimensions");
    syncInputs();
    scheduleRender();
  }

  // Push state.up / state.bg values into their DOM controls.
  function syncToolControls() {
    el.scaleSeg.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("is-active", parseInt(b.dataset.scale, 10) === state.up.scale);
    });
    el.sharpRange.value = state.up.sharpen;
    el.sharpVal.textContent = String(state.up.sharpen);
    el.denoiseChk.checked = state.up.denoise;

    el.keySeg.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.key === state.bg.keyMode);
    });
    el.keyHint.textContent = state.bg.keyMode === "pick"
      ? "click the image to sample a colour"
      : "sampled from the image edges";
    el.tolRange.value = state.bg.tolerance;
    el.tolVal.textContent = String(state.bg.tolerance);
    el.softRange.value = state.bg.softness;
    el.softVal.textContent = String(state.bg.softness);
    el.connChk.checked = state.bg.connected;
    el.despillChk.checked = state.bg.despill;
    el.fillSel.value = state.bg.fill === "transparent" || state.bg.fill === "#ffffff" || state.bg.fill === "#000000"
      ? state.bg.fill : "custom";
    el.fillColor.hidden = el.fillSel.value !== "custom";
    updateKeySwatch(state.bg.key);
  }

  function clearSource() {
    if (renderTimer) clearTimeout(renderTimer);
    if (state.outputUrl) { try { URL.revokeObjectURL(state.outputUrl); } catch (e) {} }
    if (state.source && state.source.url) { try { URL.revokeObjectURL(state.source.url); } catch (e) {} }
    state.source = null;
    state.outputBlob = null;
    state.outputUrl = null;
    el.preview.removeAttribute("src");
    el.workspace.hidden = true;
    el.dropzone.hidden = false;
    el.downloadBtn.disabled = true;
    document.body.classList.remove("has-image"); // restores the ad rails
  }

  /* ---- Tool switching (Resize / Upscale / Cut out) --- */

  function setTool(tool) {
    state.tool = tool;
    el.toolBtns.forEach(function (b) { b.classList.toggle("is-active", b.dataset.tool === tool); });
    el.toolPanels.forEach(function (p) { p.hidden = p.dataset.tool !== tool; });
    el.stageCanvas.classList.toggle("picking", tool === "removebg" && state.bg.keyMode === "pick");
    updateFormatConstraints();
  }

  // Remove-bg with a transparent fill needs an alpha format.
  function updateFormatConstraints() {
    var jpg = el.fmtSel.querySelector('option[value="image/jpeg"]');
    var needAlpha = state.tool === "removebg" && state.bg.fill === "transparent";
    if (jpg) jpg.disabled = needAlpha;
    if (needAlpha && state.format === "image/jpeg") {
      state.format = "image/png";
      el.fmtSel.value = "image/png";
      el.qualityField.hidden = true;
    }
  }

  el.toolBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      setTool(b.dataset.tool);
      scheduleRender();
    });
  });

  /* ---- Upscale controls ----------------------------- */

  el.scaleSeg.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn[data-scale]");
    if (!btn) return;
    state.up.scale = parseInt(btn.dataset.scale, 10);
    el.scaleSeg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.toggle("is-active", x === btn); });
    scheduleRender();
  });

  el.sharpRange.addEventListener("input", function () {
    state.up.sharpen = parseInt(el.sharpRange.value, 10);
    el.sharpVal.textContent = el.sharpRange.value;
    scheduleRender();
  });

  el.denoiseChk.addEventListener("change", function () {
    state.up.denoise = el.denoiseChk.checked;
    scheduleRender();
  });

  /* ---- Remove-background controls ------------------- */

  el.keySeg.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn[data-key]");
    if (!btn) return;
    state.bg.keyMode = btn.dataset.key;
    el.keySeg.querySelectorAll(".seg-btn").forEach(function (x) { x.classList.toggle("is-active", x === btn); });
    if (state.bg.keyMode === "auto") {
      state.bg.key = null;
      el.keyHint.textContent = "sampled from the image edges";
    } else {
      el.keyHint.textContent = "click the image to sample a colour";
    }
    el.stageCanvas.classList.toggle("picking", state.bg.keyMode === "pick");
    scheduleRender();
  });

  el.tolRange.addEventListener("input", function () {
    state.bg.tolerance = parseInt(el.tolRange.value, 10);
    el.tolVal.textContent = el.tolRange.value;
    scheduleRender();
  });

  el.softRange.addEventListener("input", function () {
    state.bg.softness = parseInt(el.softRange.value, 10);
    el.softVal.textContent = el.softRange.value;
    scheduleRender();
  });

  el.connChk.addEventListener("change", function () {
    state.bg.connected = el.connChk.checked;
    scheduleRender();
  });

  el.despillChk.addEventListener("change", function () {
    state.bg.despill = el.despillChk.checked;
    scheduleRender();
  });

  el.fillSel.addEventListener("change", function () {
    var v = el.fillSel.value;
    if (v === "custom") {
      el.fillColor.hidden = false;
      state.bg.fill = el.fillColor.value;
    } else {
      el.fillColor.hidden = true;
      state.bg.fill = v;
    }
    updateFormatConstraints();
    scheduleRender();
  });

  el.fillColor.addEventListener("input", function () {
    state.bg.fill = el.fillColor.value;
    updateFormatConstraints();
    scheduleRender();
  });

  // Eyedropper: sample the source pixel under the click. #preview shrink-wraps
  // the visible image, so its rect maps straight to source coordinates.
  el.stageCanvas.addEventListener("click", function (e) {
    if (state.tool !== "removebg" || state.bg.keyMode !== "pick" || !state.source) return;
    var box = el.preview.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) return;
    var sx = (e.clientX - box.left) / box.width * state.source.width;
    var sy = (e.clientY - box.top) / box.height * state.source.height;
    state.bg.key = BgRemove.pickColor(state.source, sx, sy);
    updateKeySwatch(state.bg.key);
    scheduleRender();
  });

  function updateKeySwatch(rgb) {
    if (rgb) el.keySwatch.style.background = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
    else el.keySwatch.style.background = "";
  }

  /* ---- Mode switching -------------------------------- */

  function setMode(mode) {
    state.mode = mode;
    el.segBtns.forEach(function (b) { b.classList.toggle("is-active", b.dataset.mode === mode); });
    el.modePanels.forEach(function (p) { p.hidden = p.dataset.mode !== mode; });

    if (mode === "percent" && state.source) {
      state.percent = Engine.clamp(
        Math.round((state.width / state.source.width) * 100), 1, 400
      );
      el.pctRange.value = state.percent;
      el.pctInp.value = state.percent;
      updatePctChips();
    }
  }

  el.segBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      setMode(b.dataset.mode);
      scheduleRender();
    });
  });

  /* ---- Dimensions inputs ---------------------------- */

  function readDim(input) {
    var v = parseInt(input.value, 10);
    if (isNaN(v) || v < 1) return null;
    return Math.min(v, 20000);
  }

  el.inpW.addEventListener("input", function () {
    var w = readDim(el.inpW);
    if (w == null) return;
    state.width = w;
    if (state.lockAspect && state.source) {
      state.height = Math.max(1, Math.round(w * state.source.height / state.source.width));
      el.inpH.value = state.height;
    } else {
      state.height = readDim(el.inpH) || state.height;
    }
    state.presetIndex = -1;
    scheduleRender();
  });

  el.inpH.addEventListener("input", function () {
    var h = readDim(el.inpH);
    if (h == null) return;
    state.height = h;
    if (state.lockAspect && state.source) {
      state.width = Math.max(1, Math.round(h * state.source.width / state.source.height));
      el.inpW.value = state.width;
    } else {
      state.width = readDim(el.inpW) || state.width;
    }
    state.presetIndex = -1;
    scheduleRender();
  });

  [el.inpW, el.inpH].forEach(function (inp) {
    inp.addEventListener("blur", function () { syncInputs(); });
  });

  el.lockBtn.addEventListener("click", function () {
    state.lockAspect = !state.lockAspect;
    el.lockBtn.classList.toggle("is-locked", state.lockAspect);
    el.lockBtn.setAttribute("aria-pressed", String(state.lockAspect));
    if (state.lockAspect && state.source) {
      state.height = Math.max(1, Math.round(state.width * state.source.height / state.source.width));
      syncInputs();
      scheduleRender();
    }
  });

  /* ---- Percent ------------------------------------- */

  function setPercent(p) {
    state.percent = Engine.clamp(Math.round(p), 1, 400);
    el.pctRange.value = state.percent;
    el.pctInp.value = state.percent;
    updatePctChips();
    scheduleRender();
  }

  el.pctRange.addEventListener("input", function () { setPercent(el.pctRange.value); });
  el.pctInp.addEventListener("input", function () {
    var v = parseInt(el.pctInp.value, 10);
    if (isNaN(v)) return;
    setPercent(v);
  });
  el.pctChips.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-pct]");
    if (btn) setPercent(parseInt(btn.dataset.pct, 10));
  });

  function updatePctChips() {
    el.pctChips.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("is-active", parseInt(b.dataset.pct, 10) === state.percent);
    });
  }

  /* ---- Presets ------------------------------------- */

  function applyPreset(index) {
    var p = PRESETS[index];
    if (!p) return;
    state.presetIndex = index;
    state.width = p.w;
    state.height = p.h;
    el.presetGroups.querySelectorAll(".preset-btn").forEach(function (b) {
      b.classList.toggle("is-active", parseInt(b.dataset.index, 10) === index);
    });
    syncInputs();
    scheduleRender();
  }

  /* ---- Fit ---------------------------------------- */

  el.fitSeg.addEventListener("click", function (e) {
    var btn = e.target.closest(".seg-btn[data-fit]");
    if (!btn) return;
    state.fit = btn.dataset.fit;
    el.fitSeg.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    scheduleRender();
  });

  /* ---- Output format / quality ------------------- */

  el.fmtSel.addEventListener("change", function () {
    state.format = el.fmtSel.value;
    el.qualityField.hidden = state.format === "image/png";
    scheduleRender();
  });

  el.qualityRange.addEventListener("input", function () {
    state.quality = parseInt(el.qualityRange.value, 10) / 100;
    el.qualityVal.textContent = el.qualityRange.value;
    scheduleRender();
  });

  /* ---- Actual-size toggle ------------------------ */

  el.actualSize.addEventListener("change", function () {
    el.stageCanvas.classList.toggle("actual", el.actualSize.checked);
    updateScaleHint();
  });

  /* ---- Buttons ---------------------------------- */

  el.browseBtn.addEventListener("click", function () { el.fileInput.click(); });
  el.dropzone.addEventListener("click", function (e) {
    if (e.target.closest("button, a")) return; // let nested controls handle themselves
    el.fileInput.click();
  });
  el.dropzone.addEventListener("keydown", function (e) {
    if (e.target === el.dropzone && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      el.fileInput.click();
    }
  });

  // Landing-screen tool cards: open the picker, then jump to that tool.
  document.querySelectorAll(".dz-tool").forEach(function (b) {
    b.addEventListener("click", function () {
      pendingTool = b.dataset.tool;
      el.fileInput.click();
    });
  });
  el.replaceBtn.addEventListener("click", function () { el.fileInput.click(); });
  el.removeBtn.addEventListener("click", clearSource);
  el.fileInput.addEventListener("change", function () {
    handleFiles(el.fileInput.files);
    el.fileInput.value = "";
  });

  el.sampleBtn.addEventListener("click", function () {
    var canvas = Engine.makeSample(1600, 1000);
    canvas.toBlob(function (blob) {
      Engine.loadBlob(blob, "rescale-sample.png").then(onSourceLoaded).catch(function (err) {
        toast(err.message);
      });
    }, "image/png");
  });

  el.resetBtn.addEventListener("click", function () {
    if (!state.source) return;
    state.width = state.source.width;
    state.height = state.source.height;
    state.lockAspect = true;
    state.percent = 100;
    state.presetIndex = -1;
    state.fit = "contain";
    state.format = "image/jpeg";
    state.quality = 0.85;
    state.up = Object.assign({}, UP_DEFAULTS);
    state.bg = Object.assign({}, BG_DEFAULTS);
    el.fmtSel.value = "image/jpeg";
    el.qualityRange.value = 85;
    el.qualityVal.textContent = "85";
    el.qualityField.hidden = false;
    el.lockBtn.classList.add("is-locked");
    el.lockBtn.setAttribute("aria-pressed", "true");
    el.fitSeg.querySelectorAll(".seg-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.fit === "contain");
    });
    el.presetGroups.querySelectorAll(".preset-btn").forEach(function (b) { b.classList.remove("is-active"); });
    syncToolControls();
    setTool("resize");
    setMode("dimensions");
    syncInputs();
    scheduleRender();
  });

  el.downloadBtn.addEventListener("click", function () {
    if (!state.outputBlob) return;
    var a = document.createElement("a");
    a.href = state.outputUrl;
    a.download = outputFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  el.copyBtn.addEventListener("click", function () {
    if (!state.outputBlob) return;
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
      toast("Clipboard copy isn't supported in this browser.");
      return;
    }
    var item = {};
    item[state.outputBlob.type] = state.outputBlob;
    navigator.clipboard.write([new window.ClipboardItem(item)]).then(function () {
      toast("Copied image to clipboard.");
    }).catch(function () {
      toast("Couldn't copy — try downloading instead.");
    });
  });

  /* ---- Drag & drop / paste --------------------- */

  var dragDepth = 0;
  window.addEventListener("dragenter", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    el.dragOverlay.hidden = false;
  });
  window.addEventListener("dragover", function (e) {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener("dragleave", function (e) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) el.dragOverlay.hidden = true;
  });
  window.addEventListener("drop", function (e) {
    if (!e.dataTransfer) return;
    e.preventDefault();
    dragDepth = 0;
    el.dragOverlay.hidden = true;
    handleFiles(e.dataTransfer.files);
  });

  window.addEventListener("paste", function (e) {
    if (!e.clipboardData) return;
    var items = e.clipboardData.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf("image/") === 0) {
        var f = items[i].getAsFile();
        if (f) { handleFiles([f]); e.preventDefault(); }
        return;
      }
    }
  });

  function hasFiles(e) {
    if (!e.dataTransfer) return false;
    var types = e.dataTransfer.types || [];
    for (var i = 0; i < types.length; i++) if (types[i] === "Files") return true;
    return false;
  }

  /* ---- Render pipeline ------------------------- */

  function scheduleRender() {
    if (!state.source) return;
    if (renderTimer) clearTimeout(renderTimer);
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(function () { el.stageBusy.hidden = false; }, 170);
    renderTimer = setTimeout(runRender, 110);
  }

  function runRender() {
    if (!state.source) return;
    var src = state.source;

    if (state.tool === "resize") {
      var target = Engine.computeTarget(state, src);
      if (target.width * target.height > 120000000) {
        finishBusy();
        toast("That target size is too large to render.");
        return;
      }
      var differ = Engine.aspectsDiffer(target.width, target.height, src.width, src.height);
      el.fitBlock.hidden = !differ;
      var bg = state.format === "image/jpeg" ? "#ffffff" : null;
      var fit = differ ? state.fit : "stretch";
      var canvas;
      try {
        canvas = Engine.render(src, target.width, target.height, fit, bg);
      } catch (err) {
        finishBusy();
        toast("Rendering failed: " + err.message);
        return;
      }
      encodeAndShow(canvas, target);
      return;
    }

    // Upscale / Remove-bg can block for a while — paint the spinner first.
    el.fitBlock.hidden = true;
    el.stageBusy.hidden = false;
    requestAnimationFrame(function () {
      setTimeout(function () { runHeavyTool(src); }, 0);
    });
  }

  function runHeavyTool(src) {
    var canvas, target;
    try {
      if (state.tool === "upscale") {
        target = {
          width: Math.round(src.width * state.up.scale),
          height: Math.round(src.height * state.up.scale)
        };
        if (target.width * target.height > 40000000) {
          finishBusy();
          toast("Upscaled size would exceed 40 MP — try a smaller factor.");
          return;
        }
        canvas = Upscale.run(src, {
          scale: state.up.scale,
          sharpen: state.up.sharpen,
          denoise: state.up.denoise
        });
      } else {
        // removebg — output keeps the source dimensions
        target = { width: src.width, height: src.height };
        canvas = BgRemove.run(src, {
          key: state.bg.key,
          tolerance: state.bg.tolerance,
          softness: state.bg.softness,
          connected: state.bg.connected,
          despill: state.bg.despill,
          fill: state.bg.fill
        });
        if (canvas._key && state.bg.keyMode === "auto") updateKeySwatch(canvas._key);
      }
    } catch (err) {
      finishBusy();
      toast("Processing failed: " + err.message);
      return;
    }
    encodeAndShow(canvas, target);
  }

  function encodeAndShow(canvas, target) {
    Engine.encode(canvas, state.format, state.quality).then(function (blob) {
      if (state.outputUrl) { try { URL.revokeObjectURL(state.outputUrl); } catch (e) {} }
      state.outputBlob = blob;
      state.outputUrl = URL.createObjectURL(blob);
      el.preview.src = state.outputUrl;

      if (state.format === "image/webp" && blob.type !== "image/webp") {
        toast("WebP export isn't available here — saved as " + shortType(blob.type) + ".");
      }

      updateReadout(target, blob);
      el.downloadBtn.disabled = false;
      finishBusy();
    }).catch(function (err) {
      finishBusy();
      toast("Encoding failed: " + err.message);
    });
  }

  function finishBusy() {
    if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
    el.stageBusy.hidden = true;
  }

  /* ---- Readout / sync ------------------------- */

  function syncInputs() {
    var focused = document.activeElement;
    if (focused !== el.inpW) el.inpW.value = state.width;
    if (focused !== el.inpH) el.inpH.value = state.height;
    el.pctRange.value = state.percent;
    el.pctInp.value = state.percent;
  }

  function updateReadout(target, blob) {
    var src = state.source;
    el.badgeW.textContent = target.width + " px";
    el.badgeH.textContent = target.height + " px";

    el.roNewDims.textContent = target.width + " × " + target.height;
    el.roNewSize.textContent = Engine.formatBytes(blob.size);
    el.origDims.textContent = src.width + " × " + src.height + " px";
    el.pctResult.textContent = target.width + " × " + target.height + " px";
    el.upResult.textContent = target.width + " × " + target.height + " px";

    if (src.size) {
      var diff = (blob.size - src.size) / src.size * 100;
      var rounded = Math.round(Math.abs(diff));
      if (rounded <= 0) {
        el.roDelta.textContent = "about the same file size";
        el.roDelta.className = "ro-delta";
      } else if (diff < 0) {
        el.roDelta.textContent = "−" + rounded + "% smaller · saves " +
          Engine.formatBytes(src.size - blob.size);
        el.roDelta.className = "ro-delta is-down";
      } else {
        el.roDelta.textContent = "+" + rounded + "% larger · " +
          Engine.formatBytes(blob.size - src.size) + " more";
        el.roDelta.className = "ro-delta is-up";
      }
    } else {
      el.roDelta.textContent = "output " + Engine.formatBytes(blob.size);
      el.roDelta.className = "ro-delta";
    }

    if (state.mode !== "dimensions") syncInputs();
    else { el.pctRange.value = state.percent; el.pctInp.value = state.percent; }

    updateScaleHint();
  }

  function updateScaleHint() {
    if (!state.source || !state.outputBlob) return;
    if (el.actualSize.checked) { el.scaleHint.textContent = "100% · actual pixels"; return; }
    // #preview shrink-wraps the visible image
    var box = el.preview.getBoundingClientRect();
    var natW = el.preview.naturalWidth || parseInt(el.badgeW.textContent, 10) || 1;
    var pct = Math.round((box.width / natW) * 100);
    if (isFinite(pct) && pct > 0) el.scaleHint.textContent = "preview ≈ " + pct + "%";
    else el.scaleHint.textContent = "fit to view";
  }

  window.addEventListener("resize", updateScaleHint);
  el.preview.addEventListener("load", updateScaleHint);

  /* ---- Filenames / misc ---------------------- */

  function outputFilename() {
    var name = state.source ? state.source.name : "image";
    var base = name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
    var ext = extFor(state.outputBlob ? state.outputBlob.type : state.format);
    var w = parseInt(el.badgeW.textContent, 10) || state.width;
    var h = parseInt(el.badgeH.textContent, 10) || state.height;
    var suffix = state.tool === "upscale" ? "-upscaled-" + state.up.scale + "x"
      : state.tool === "removebg" ? "-nobg"
      : "";
    return base + "-" + w + "x" + h + suffix + "." + ext;
  }

  function extFor(type) {
    if (type === "image/jpeg") return "jpg";
    if (type === "image/webp") return "webp";
    if (type === "image/png") return "png";
    return (type && type.split("/")[1]) || "png";
  }

  function shortType(type) {
    return (type && type.split("/")[1] || "png").toUpperCase();
  }

  /* ---- Toast -------------------------------- */
  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    // force reflow so the transition runs
    void el.toast.offsetWidth;
    el.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("show");
      setTimeout(function () { el.toast.hidden = true; }, 250);
    }, 3200);
  }
})();
