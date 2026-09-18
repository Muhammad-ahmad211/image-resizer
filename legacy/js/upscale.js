/* =========================================================
   Rescale — on-device upscaler.
   Lanczos-3 separable resampling + unsharp mask + optional
   3x3 median denoise. No models, no downloads.
   ========================================================= */
window.IR = window.IR || {};

window.IR.Upscale = (function () {
  "use strict";

  var A = 3; // Lanczos lobes

  function sinc(x) {
    if (x === 0) return 1;
    var p = Math.PI * x;
    return Math.sin(p) / p;
  }
  function lanczos(x) {
    if (x <= -A || x >= A) return 0;
    return sinc(x) * sinc(x / A);
  }

  // Precompute contributor indices + weights for one axis.
  function buildTaps(srcLen, dstLen) {
    var scale = dstLen / srcLen;
    var support = scale < 1 ? A / scale : A; // low-pass when shrinking
    var winRadius = Math.ceil(support);
    var taps = winRadius * 2 + 1;
    var idx = new Int32Array(dstLen * taps);
    var wgt = new Float32Array(dstLen * taps);

    for (var d = 0; d < dstLen; d++) {
      var center = (d + 0.5) / scale - 0.5;
      var start = Math.floor(center - support + 0.5);
      var sum = 0;
      var base = d * taps;
      for (var t = 0; t < taps; t++) {
        var s = start + t;
        var dist = (center - s) * (scale < 1 ? scale : 1);
        var w = lanczos(dist);
        var cs = s < 0 ? 0 : s >= srcLen ? srcLen - 1 : s; // clamp edges
        idx[base + t] = cs;
        wgt[base + t] = w;
        sum += w;
      }
      if (sum !== 0) {
        for (var k = 0; k < taps; k++) wgt[base + k] /= sum;
      }
    }
    return { idx: idx, wgt: wgt, taps: taps };
  }

  // src: ImageData-like {data:Uint8ClampedArray, width, height}
  function resample(src, dstW, dstH) {
    var sw = src.width, sh = src.height;
    var sd = src.data;

    var hx = buildTaps(sw, dstW);
    var vy = buildTaps(sh, dstH);

    // Horizontal pass -> Float32 buffer (dstW x sh x 4)
    var mid = new Float32Array(dstW * sh * 4);
    var x, y, t, c;
    for (y = 0; y < sh; y++) {
      var srow = y * sw * 4;
      var mrow = y * dstW * 4;
      for (x = 0; x < dstW; x++) {
        var hb = x * hx.taps;
        var r = 0, g = 0, b = 0, a = 0;
        for (t = 0; t < hx.taps; t++) {
          var w = hx.wgt[hb + t];
          if (w === 0) continue;
          var si = srow + hx.idx[hb + t] * 4;
          r += sd[si] * w;
          g += sd[si + 1] * w;
          b += sd[si + 2] * w;
          a += sd[si + 3] * w;
        }
        var mi = mrow + x * 4;
        mid[mi] = r; mid[mi + 1] = g; mid[mi + 2] = b; mid[mi + 3] = a;
      }
    }

    // Vertical pass -> Uint8ClampedArray (dstW x dstH x 4)
    var out = new Uint8ClampedArray(dstW * dstH * 4);
    for (y = 0; y < dstH; y++) {
      var vb = y * vy.taps;
      var orow = y * dstW * 4;
      for (x = 0; x < dstW; x++) {
        var rr = 0, gg = 0, bb = 0, aa = 0;
        var col = x * 4;
        for (t = 0; t < vy.taps; t++) {
          var wv = vy.wgt[vb + t];
          if (wv === 0) continue;
          var mi2 = vy.idx[vb + t] * dstW * 4 + col;
          rr += mid[mi2] * wv;
          gg += mid[mi2 + 1] * wv;
          bb += mid[mi2 + 2] * wv;
          aa += mid[mi2 + 3] * wv;
        }
        var oi = orow + col;
        out[oi] = rr; out[oi + 1] = gg; out[oi + 2] = bb; out[oi + 3] = aa;
      }
    }
    return { data: out, width: dstW, height: dstH };
  }

  /* ---- 3x3 median denoise (per channel, RGB) ---- */
  function median3(img) {
    var w = img.width, h = img.height, d = img.data;
    var out = new Uint8ClampedArray(d.length);
    out.set(d);
    var win = new Uint8Array(9);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var o = (y * w + x) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var n = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              win[n++] = d[((y + dy) * w + (x + dx)) * 4 + ch];
            }
          }
          // insertion sort of 9
          for (var i = 1; i < 9; i++) {
            var v = win[i], j = i - 1;
            while (j >= 0 && win[j] > v) { win[j + 1] = win[j]; j--; }
            win[j + 1] = v;
          }
          out[o + ch] = win[4];
        }
      }
    }
    return { data: out, width: w, height: h };
  }

  /* ---- Unsharp mask ---- */
  function boxBlur(src, radius) {
    // separable box blur on RGB, alpha copied
    var w = src.width, h = src.height, d = src.data;
    var tmp = new Float32Array(w * h * 3);
    var out = new Uint8ClampedArray(d.length);
    var r = radius, norm = 1 / (2 * r + 1);
    var x, y, ch, acc, i;

    for (y = 0; y < h; y++) {
      for (ch = 0; ch < 3; ch++) {
        acc = 0;
        for (i = -r; i <= r; i++) acc += d[(y * w + clamp(i, 0, w - 1)) * 4 + ch];
        for (x = 0; x < w; x++) {
          tmp[(y * w + x) * 3 + ch] = acc * norm;
          var add = d[(y * w + clamp(x + r + 1, 0, w - 1)) * 4 + ch];
          var sub = d[(y * w + clamp(x - r, 0, w - 1)) * 4 + ch];
          acc += add - sub;
        }
      }
    }
    for (x = 0; x < w; x++) {
      for (ch = 0; ch < 3; ch++) {
        acc = 0;
        for (i = -r; i <= r; i++) acc += tmp[(clamp(i, 0, h - 1) * w + x) * 3 + ch];
        for (y = 0; y < h; y++) {
          out[(y * w + x) * 4 + ch] = acc * norm;
          var add2 = tmp[(clamp(y + r + 1, 0, h - 1) * w + x) * 3 + ch];
          var sub2 = tmp[(clamp(y - r, 0, h - 1) * w + x) * 3 + ch];
          acc += add2 - sub2;
        }
      }
    }
    for (i = 3; i < d.length; i += 4) out[i] = d[i];
    return { data: out, width: w, height: h };
  }

  function unsharp(img, amount, radius) {
    if (amount <= 0) return img;
    var blur = boxBlur(img, radius || 2);
    var d = img.data, b = blur.data;
    var out = new Uint8ClampedArray(d.length);
    for (var i = 0; i < d.length; i += 4) {
      out[i]     = d[i]     + amount * (d[i]     - b[i]);
      out[i + 1] = d[i + 1] + amount * (d[i + 1] - b[i + 1]);
      out[i + 2] = d[i + 2] + amount * (d[i + 2] - b[i + 2]);
      out[i + 3] = d[i + 3];
    }
    return { data: out, width: img.width, height: img.height };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---- Public: run the full upscale pipeline ---- */
  // source: {el,width,height}. opts: {scale, sharpen(0..100), denoise(bool)}
  function run(source, opts) {
    var scale = opts.scale || 2;
    var dstW = Math.round(source.width * scale);
    var dstH = Math.round(source.height * scale);

    var pre = document.createElement("canvas");
    pre.width = source.width;
    pre.height = source.height;
    var pctx = pre.getContext("2d");
    pctx.drawImage(source.el, 0, 0);
    var img = pctx.getImageData(0, 0, source.width, source.height);
    img = { data: img.data, width: img.width, height: img.height };

    if (opts.denoise) img = median3(img);

    var big = resample(img, dstW, dstH);

    var amount = (opts.sharpen || 0) / 100 * 1.4;
    if (amount > 0) {
      var rad = dstW * dstH > 6000000 ? 2 : 1;
      big = unsharp(big, amount, rad);
    }

    var canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    canvas.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(big.data), dstW, dstH), 0, 0
    );
    return canvas;
  }

  return { run: run, resample: resample, unsharp: unsharp };
})();
