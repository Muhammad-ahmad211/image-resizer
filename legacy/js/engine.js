/* =========================================================
   Rescale engine — image loading, resizing, encoding.
   Pure functions, no DOM wiring. Everything is client-side.
   ========================================================= */
window.IR = window.IR || {};

window.IR.Engine = (function () {
  "use strict";

  var ACCEPTED = /^image\/(jpeg|png|webp|gif|bmp|avif)$/i;

  /* ---- Loading ------------------------------------------------ */

  function loadFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || !ACCEPTED.test(file.type)) {
        reject(new Error("Unsupported file type."));
        return;
      }
      _decode(URL.createObjectURL(file), file.name, file.type, file.size, resolve, reject);
    });
  }

  function loadBlob(blob, name) {
    return new Promise(function (resolve, reject) {
      _decode(
        URL.createObjectURL(blob),
        name || "pasted-image.png",
        blob.type || "image/png",
        blob.size || 0,
        resolve,
        reject
      );
    });
  }

  function _decode(url, name, type, size, resolve, reject) {
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      resolve({
        el: img,
        url: url,
        name: name,
        type: type,
        size: size,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode this image."));
    };
    img.src = url;
  }

  /* ---- Target computation ------------------------------------ */

  // Returns {width, height} for the given state + source.
  function computeTarget(state, source) {
    var w, h;
    if (state.mode === "percent") {
      var p = clamp(state.percent, 1, 1000) / 100;
      w = Math.round(source.width * p);
      h = Math.round(source.height * p);
    } else {
      // dimensions & presets both carry explicit w/h on state
      w = Math.round(state.width || source.width);
      h = Math.round(state.height || source.height);
    }
    return { width: Math.max(1, w), height: Math.max(1, h) };
  }

  function aspectsDiffer(tw, th, sw, sh) {
    if (!tw || !th || !sw || !sh) return false;
    return Math.abs(tw / th - sw / sh) > 0.01;
  }

  /* ---- Rendering ------------------------------------------- */

  // Draw source into a canvas of exactly targetW x targetH using fit mode.
  // fit: "contain" (letterbox) | "cover" (crop) | "stretch" (distort)
  function render(source, targetW, targetH, fit, bgColor) {
    targetW = Math.max(1, Math.round(targetW));
    targetH = Math.max(1, Math.round(targetH));

    var sw = source.width;
    var sh = source.height;

    // 1. Optionally crop the source (cover mode) into a work canvas.
    var work = source.el;
    var workW = sw;
    var workH = sh;

    if (fit === "cover" && aspectsDiffer(targetW, targetH, sw, sh)) {
      var scale = Math.max(targetW / sw, targetH / sh);
      var cropW = Math.round(targetW / scale);
      var cropH = Math.round(targetH / scale);
      var cropX = Math.round((sw - cropW) / 2);
      var cropY = Math.round((sh - cropH) / 2);
      var cc = document.createElement("canvas");
      cc.width = cropW;
      cc.height = cropH;
      cc.getContext("2d").drawImage(source.el, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      work = cc;
      workW = cropW;
      workH = cropH;
    }

    // 2. Decide where the content sits inside the target canvas.
    var drawW, drawH, offX, offY;
    if (fit === "contain") {
      var s = Math.min(targetW / workW, targetH / workH);
      drawW = Math.round(workW * s);
      drawH = Math.round(workH * s);
      offX = Math.round((targetW - drawW) / 2);
      offY = Math.round((targetH - drawH) / 2);
    } else {
      // cover (already cropped to aspect) and stretch both fill fully
      drawW = targetW;
      drawH = targetH;
      offX = 0;
      offY = 0;
    }

    // 3. Progressive halving for large downscales — much cleaner result.
    work = _steppedDownscale(work, workW, workH, drawW, drawH);

    // 4. Compose final canvas.
    var canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(work, 0, 0, work.width, work.height, offX, offY, drawW, drawH);
    return canvas;
  }

  function _steppedDownscale(src, sw, sh, dw, dh) {
    var curW = sw;
    var curH = sh;
    var cur = src;
    // Only step while we are still more than 2x larger than the target.
    while (curW > dw * 2 && curH > dh * 2) {
      var nextW = Math.max(Math.round(curW / 2), dw);
      var nextH = Math.max(Math.round(curH / 2), dh);
      var c = document.createElement("canvas");
      c.width = nextW;
      c.height = nextH;
      var cx = c.getContext("2d");
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = "high";
      cx.drawImage(cur, 0, 0, curW, curH, 0, 0, nextW, nextH);
      cur = c;
      curW = nextW;
      curH = nextH;
    }
    return cur;
  }

  /* ---- Encoding ----------------------------------------------- */

  // Returns Promise<Blob>. Falls back to PNG if the format is unsupported.
  function encode(canvas, format, quality) {
    return new Promise(function (resolve, reject) {
      var q = format === "image/png" ? undefined : clamp(quality, 0.05, 1);
      canvas.toBlob(function (blob) {
        if (blob && blob.type === format) {
          resolve(blob);
        } else if (blob) {
          // Browser silently produced a different type (e.g. no WebP encoder).
          resolve(blob);
        } else {
          canvas.toBlob(function (png) {
            png ? resolve(png) : reject(new Error("Encoding failed."));
          }, "image/png");
        }
      }, format, q);
    });
  }

  /* ---- Helpers ---------------------------------------------- */

  function clamp(n, lo, hi) {
    n = Number(n);
    if (isNaN(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return bytes + " B";
    var kb = bytes / 1024;
    if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : Math.round(kb)) + " KB";
    var mb = kb / 1024;
    return (mb < 10 ? mb.toFixed(2) : mb.toFixed(1)) + " MB";
  }

  // A self-contained demo image so "Try a sample" needs no network.
  function makeSample(w, h) {
    w = w || 1600;
    h = h || 1000;
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var x = c.getContext("2d");

    var g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f2683c");
    g.addColorStop(0.55, "#c8407a");
    g.addColorStop(1, "#3b2a8c");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    x.globalAlpha = 0.14;
    x.strokeStyle = "#fff";
    x.lineWidth = 2;
    for (var i = -h; i < w; i += 46) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + h, h);
      x.stroke();
    }
    x.globalAlpha = 1;

    x.fillStyle = "rgba(255,255,255,0.92)";
    for (var j = 0; j < 5; j++) {
      x.beginPath();
      x.arc(w * (0.12 + j * 0.19), h * (0.3 + (j % 2) * 0.34), 34 + j * 10, 0, Math.PI * 2);
      x.fill();
    }

    x.fillStyle = "#fff";
    x.font = "700 " + Math.round(h * 0.11) + "px 'Space Grotesk', sans-serif";
    x.textBaseline = "middle";
    x.fillText("RESCALE", w * 0.08, h * 0.82);
    x.font = "500 " + Math.round(h * 0.038) + "px Inter, sans-serif";
    x.fillText(w + " × " + h + "  sample", w * 0.08, h * 0.92);

    return c;
  }

  return {
    loadFile: loadFile,
    loadBlob: loadBlob,
    computeTarget: computeTarget,
    aspectsDiffer: aspectsDiffer,
    render: render,
    encode: encode,
    formatBytes: formatBytes,
    makeSample: makeSample,
    clamp: clamp
  };
})();
