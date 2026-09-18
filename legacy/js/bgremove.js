/* =========================================================
   Rescale — on-device background removal (color-based).
   Border auto-sampling or eyedropper key color, weighted
   color-distance matte, edge-connected flood fill, alpha
   feather, and color decontamination (despill).
   No models, no downloads.
   ========================================================= */
window.IR = window.IR || {};

window.IR.BgRemove = (function () {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function smoothstep(e0, e1, x) {
    if (e1 <= e0) return x < e0 ? 0 : 1;
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Perceptually weighted RGB distance, 0..~100.
  function dist(r, g, b, kr, kg, kb) {
    var dr = r - kr, dg = g - kg, db = b - kb;
    return Math.sqrt(0.30 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) / 2.55;
  }

  // Median colour of the image border (auto key).
  function sampleBorder(d, w, h) {
    var rs = [], gs = [], bs = [];
    var step = Math.max(1, Math.floor((2 * (w + h)) / 800));
    var push = function (i) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
    for (var x = 0; x < w; x += step) {
      push((x) * 4);
      push(((h - 1) * w + x) * 4);
    }
    for (var y = 0; y < h; y += step) {
      push((y * w) * 4);
      push((y * w + (w - 1)) * 4);
    }
    var med = function (arr) { arr.sort(function (a, b) { return a - b; }); return arr[arr.length >> 1]; };
    return [med(rs), med(gs), med(bs)];
  }

  // source: {el,width,height}
  // opts: { key:[r,g,b]|null, tolerance:0..100, softness:0..8,
  //         connected:bool, despill:bool, fill:'transparent'|'#rrggbb' }
  function run(source, opts) {
    var w = source.width, h = source.height, n = w * h;
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d");
    ctx.drawImage(source.el, 0, 0);
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;

    var key = opts.key || sampleBorder(d, w, h);
    var kr = key[0], kg = key[1], kb = key[2];

    var tol = opts.tolerance != null ? opts.tolerance : 30;
    var soft = opts.softness != null ? opts.softness : 2;
    var e0 = tol;                       // fully background at/below
    var e1 = tol + (soft + 1) * 4;      // fully foreground at/above

    // 1. Distance map + raw alpha from the matte.
    var dm = new Float32Array(n);
    var alpha = new Float32Array(n); // 0..1, 1 = keep
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      var dd = dist(d[p], d[p + 1], d[p + 2], kr, kg, kb);
      dm[i] = dd;
      alpha[i] = smoothstep(e0, e1, dd);
      if (d[p + 3] < 255) alpha[i] *= d[p + 3] / 255; // respect existing transparency
    }

    // 2. Edge-connected flood fill: only remove background reachable
    //    from the image border, so same-coloured regions inside the
    //    subject are preserved.
    if (opts.connected !== false) {
      var candidate = new Uint8Array(n);
      for (var c = 0; c < n; c++) candidate[c] = dm[c] <= e1 ? 1 : 0;

      var reach = new Uint8Array(n);
      var stack = [];
      var pushIf = function (idx) { if (candidate[idx] && !reach[idx]) { reach[idx] = 1; stack.push(idx); } };
      for (var bx = 0; bx < w; bx++) { pushIf(bx); pushIf((h - 1) * w + bx); }
      for (var by = 0; by < h; by++) { pushIf(by * w); pushIf(by * w + w - 1); }
      while (stack.length) {
        var idx2 = stack.pop();
        var yy = (idx2 / w) | 0, xx = idx2 - yy * w;
        if (xx > 0) pushIf(idx2 - 1);
        if (xx < w - 1) pushIf(idx2 + 1);
        if (yy > 0) pushIf(idx2 - w);
        if (yy < h - 1) pushIf(idx2 + w);
      }
      for (var m = 0; m < n; m++) if (!reach[m]) alpha[m] = 1; // not border-connected -> keep
    }

    // 3. Feather the alpha channel (small box blur) to kill jaggies.
    if (soft > 0) alpha = blurAlpha(alpha, w, h, Math.min(4, Math.round(soft)));

    // 4. Compose output with optional colour decontamination.
    var fill = opts.fill && opts.fill !== "transparent" ? hexToRgb(opts.fill) : null;
    var out = ctx.createImageData(w, h);
    var od = out.data;
    for (var q = 0, o = 0; q < n; q++, o += 4) {
      var a = alpha[q];
      var r = d[o], g = d[o + 1], bl = d[o + 2];

      if (opts.despill && a > 0.15 && a < 0.999) {
        // Un-mix: observed = a*fg + (1-a)*key  ->  fg = (observed - (1-a)*key) / a
        r = clamp((r - (1 - a) * kr) / a, 0, 255);
        g = clamp((g - (1 - a) * kg) / a, 0, 255);
        bl = clamp((bl - (1 - a) * kb) / a, 0, 255);
      }

      if (fill) {
        od[o]     = r * a + fill[0] * (1 - a);
        od[o + 1] = g * a + fill[1] * (1 - a);
        od[o + 2] = bl * a + fill[2] * (1 - a);
        od[o + 3] = 255;
      } else {
        od[o] = r; od[o + 1] = g; od[o + 2] = bl;
        od[o + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(out, 0, 0);
    cv._key = [Math.round(kr), Math.round(kg), Math.round(kb)];
    return cv;
  }

  function blurAlpha(alpha, w, h, r) {
    if (r < 1) return alpha;
    var tmp = new Float32Array(alpha.length);
    var out = new Float32Array(alpha.length);
    var norm = 1 / (2 * r + 1);
    var x, y, i, acc;
    for (y = 0; y < h; y++) {
      acc = 0;
      for (i = -r; i <= r; i++) acc += alpha[y * w + clamp(i, 0, w - 1)];
      for (x = 0; x < w; x++) {
        tmp[y * w + x] = acc * norm;
        acc += alpha[y * w + clamp(x + r + 1, 0, w - 1)] - alpha[y * w + clamp(x - r, 0, w - 1)];
      }
    }
    for (x = 0; x < w; x++) {
      acc = 0;
      for (i = -r; i <= r; i++) acc += tmp[clamp(i, 0, h - 1) * w + x];
      for (y = 0; y < h; y++) {
        out[y * w + x] = acc * norm;
        acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
      }
    }
    return out;
  }

  function hexToRgb(hex) {
    hex = String(hex).replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  // Read one pixel from the source (for the eyedropper).
  function pickColor(source, x, y) {
    var c = source._sampler;
    if (!c) {
      c = document.createElement("canvas");
      c.width = source.width;
      c.height = source.height;
      c.getContext("2d").drawImage(source.el, 0, 0);
      source._sampler = c;
    }
    x = clamp(Math.round(x), 0, source.width - 1);
    y = clamp(Math.round(y), 0, source.height - 1);
    var px = c.getContext("2d").getImageData(x, y, 1, 1).data;
    return [px[0], px[1], px[2]];
  }

  return { run: run, pickColor: pickColor, hexToRgb: hexToRgb };
})();
