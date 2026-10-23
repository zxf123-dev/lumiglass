/* ============================================================
   Lumi Glass · glass-liquid-engine.js  (自研实现)
   ------------------------------------------------------------
   本文件为完全自研的 WebGL 液态玻璃渲染引擎，不包含任何第三方代码。
   对外契约：
     window.LiquidGlassEngine = { LiquidGlass, default }
     new LiquidGlass(canvas, opts)
       opts: { refraction, dispersion, frost, bezel, mergeK, rim, mode, liquid }
     实例: .failed / .scan(root) / .set(opts) / .setSource(src,{live}) / .destroy()
     静态: LiquidGlass.PRESETS
   DOM 契约（与 glass-webgl.js 的标记约定一致）：
     [data-glass=preset] [data-frost] [data-tint] [data-layer] [data-grow] [data-merge]
     [data-glass-solid]（v2 仅收集不动样式，solid 仍由 DOM 自绘）
   渲染思路（自研）：
     1. 壁纸 canvas 作为纹理上传；CPU 侧 drawImage+filter 生成 1/4 分辨率模糊图
     2. 片元着色器对每个玻璃形状求圆角矩形 SDF，min / 平滑并集合成场
     3. 场梯度作折射法线：近边缘按指数衰减位移采样背景，RGB 三通道位移量
        不同产生色散；霜化 = 锐利图与模糊图按形状 frost 插值
     4. 边缘高光：SDF 等值带 × (法线·光向)，暗色模式换冷色并减半
     5. 两层合成：layer0（面板）先压在壁纸上，layer1（控件）再压在其上
     6. 滚动帧零 DOM 读取：元素位置缓存文档坐标，滚动帧纯算术平移
   已知限制（相对 v1）：
     - data-glass-solid 不入 shader 折射，仍由 DOM 自绘（视觉差异极小）
     - 无按压弹簧/形变动画（liquid 参数暂未消费）
   ============================================================ */
(function () {
  'use strict';

  var MAXG = 32;

  /* 形状预设。键名与 data-glass 值对应，数值为自研调校。 */
  var PRESETS = {
    button: { grow: 0.14, frost: 0.15, tint: 0, merge: 0, layer: 0 },
    bar:    { grow: 0.03, frost: 0.45, tint: 0, merge: 0, layer: 0 },
    card:   { grow: 0,    frost: 1,    tint: 0.2, merge: 0, layer: 0 },
    sheet:  { grow: 0,    frost: 1,    tint: 0.28, merge: 1, layer: 0 },
    knob:   { grow: 0.22, frost: 0.06, tint: 0, merge: 0, layer: 1 },
    blob:   { grow: 0.1,  frost: 0.1,  tint: 0, merge: 1, layer: 0 }
  };

  var VS =
    'attribute vec2 p;varying vec2 vUv;' +
    'void main(){vUv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';

  var FS = [
    'precision highp float;',
    '#define MAXG ' + MAXG,
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',   // 壁纸原图
    'uniform sampler2D uBlur;',  // 壁纸模糊图
    'uniform vec2 uRes;',        // 画布 CSS 尺寸
    'uniform vec4 uFit;',        // 纹理 UV = vUv * uFit.xy + uFit.zw
    'uniform vec4 uG[' + MAXG + '];', // cx, cy, hw, hh（px，y 向下）
    'uniform vec4 uA[' + MAXG + '];', // radius, layer, frost, tintAmt
    'uniform vec4 uB[' + MAXG + '];', // merge, tintR, tintG, tintB
    'uniform int uGN;',
    'uniform float uBezel;',
    'uniform float uStrength;',
    'uniform float uDisp;',
    'uniform float uMergeK;',
    'uniform float uDark;',
    'uniform float uRim;',
    'uniform vec2 uPtr;',      // 指针位置（画布 px）
    'uniform float uPtrOn;',   // 指针是否在页面上

    /* 圆角矩形 SDF（经典公式，公有数学） */
    'float sdRR(vec2 p, vec2 h, float r){',
    '  r = min(r, min(h.x, h.y));',
    '  vec2 q = abs(p) - h + r;',
    '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
    '}',

    /* SDF 解析梯度：指向最近表面的单位向量 */
    'vec2 sdGrad(vec2 pw, vec2 h, float r){',
    '  r = min(r, min(h.x, h.y));',
    '  vec2 q = abs(pw) - h + r;',
    '  vec2 s = vec2(pw.x >= 0.0 ? 1.0 : -1.0, pw.y >= 0.0 ? 1.0 : -1.0);',
    '  if (q.x > 0.0 && q.y > 0.0) return normalize(max(q, 0.0) * s);',
    '  if (q.x > 0.0) return vec2(s.x, 0.0);',
    '  if (q.y > 0.0) return vec2(0.0, s.y);',
    '  return (q.x > q.y) ? vec2(s.x, 0.0) : vec2(0.0, s.y);',
    '}',

    /* 多项式平滑并集（公有数学） */
    'float smin(float a, float b, float k){',
    '  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);',
    '  return mix(b, a, h) - k * h * (1.0 - h);',
    '}',

    /* 场求值：返回带符号距离；带出最近形状的 frost/tint 与法线。
       merge 形状彼此平滑并集（距离小于 uMergeK 时），其余取硬 min。
       同时带出指针在该形状边框上的最近点 ptrPt 与该形状的指针接近度 ptrK，
       供 surf() 在边框上画跟随光。 */
    'float field(vec2 p, float layer, out vec2 grad, out float frost, out vec3 tintC, out float tintA,',
    '            out vec2 ptrPt, out float ptrK){',
    '  float dHard = 1e4; float dMerge = 1e4;',
    '  vec2 gHard = vec2(0.0); vec2 gMerge = vec2(0.0);',
    '  float fH = 0.5; vec3 tH = vec3(0.5); float aH = 0.0;',
    '  float fM = 0.5; vec3 tM = vec3(0.5); float aM = 0.0;',
    '  vec4 gH = vec4(0.0); vec4 gM = vec4(0.0);',
    '  float rH = 0.0; float rM = 0.0;',
    '  vec4 gS = vec4(0.0); float rS = 0.0; float dS = 1e4;',
    '  for (int i = 0; i < MAXG; i++){',
    '    if (i >= uGN) break;',
    '    if (abs(uA[i].y - layer) > 0.5) continue;',
    '    vec2 pw = p - uG[i].xy;',
    '    float di = sdRR(pw, uG[i].zw, uA[i].x);',
    '    vec2  gi = sdGrad(pw, uG[i].zw, uA[i].x);',
    '    if (uB[i].x > 0.5) {',
    '      if (dMerge > 9e3) {',
    '        dMerge = di; gMerge = gi; fM = uA[i].z; tM = uB[i].yzw; aM = uA[i].w;',
    '        gM = uG[i]; rM = uA[i].x;',
    '      } else if (di < uMergeK) {',
    '        float h = clamp(0.5 + 0.5 * (di - dMerge) / uMergeK, 0.0, 1.0);',
    '        gMerge = mix(gMerge, gi, h);',
    '        dMerge = mix(dMerge, di, h) - uMergeK * h * (1.0 - h);',
    '        fM = mix(fM, uA[i].z, h); tM = mix(tM, uB[i].yzw, h); aM = mix(aM, uA[i].w, h);',
    '      } else if (di < dHard) {',
    '        dHard = di; gHard = gi; fH = uA[i].z; tH = uB[i].yzw; aH = uA[i].w;',
    '        gH = uG[i]; rH = uA[i].x;',
    '      }',
    '    } else if (di < dHard) {',
    '      dHard = di; gHard = gi; fH = uA[i].z; tH = uB[i].yzw; aH = uA[i].w;',
    '      gH = uG[i]; rH = uA[i].x;',
    '    }',
    '  }',
    '  if (dMerge < dHard) { grad = gMerge; frost = fM; tintC = tM; tintA = aM; dS = dMerge; gS = gM; rS = rM; }',
    '  else { grad = gHard; frost = fH; tintC = tH; tintA = aH; dS = dHard; gS = gH; rS = rH; }',
    /* 指针 → 该形状边框最近点：沿指针处法线走 |d| 即落在框上 */
    '  ptrPt = p; ptrK = 0.0;',
    '  if (uPtrOn > 0.5 && dS < 9e3) {',
    '    vec2 pl = uPtr - gS.xy;',
    '    float dp = sdRR(pl, gS.zw, rS);',
    '    vec2 gp = sdGrad(pl, gS.zw, rS);',
    '    ptrPt = uPtr - gp * dp;',
    '    float reach = clamp(min(gS.z, gS.w) * 1.6, 72.0, 280.0);',
    '    ptrK = 1.0 - smoothstep(reach, reach * 2.5, max(dp, 0.0));',
    '  }',
    '  return dS;',
    '}',

    /* 单层玻璃面：输入该像素的场参数，输出 premultiplied 前的 (rgb, a)
       px2uv: 屏幕 px → 源图 UV 的换算（cover 映射下 = uFit.xy / uRes） */
    'vec4 surf(float d, vec2 n, float fr, vec3 tc, float ta, vec2 uv, vec2 suv,',
    '          vec2 p, vec2 ptrPt, float ptrK){',
    '  float hot = 0.0;',
    '  float a = 1.0 - smoothstep(-0.75, 0.0, d);',
    /* 折射：边缘位移最大，向内部指数衰减；RGB 位移不同 → 色散 */
    '  float k = exp(d / max(uBezel, 1.0));',
    '  float str = k * uStrength;',
    '  vec2 px2uv = vec2(uFit.x / uRes.x, uFit.y / uRes.y);',
    '  vec2 offR = n * str * (1.0 + uDisp) * px2uv;',
    '  vec2 offG = n * str * px2uv;',
    '  vec2 offB = n * str * (1.0 - uDisp) * px2uv;',
    '  vec3 sharp;',
    '  sharp.r = texture2D(uTex, clamp(uv + offR, 0.001, 0.999)).r;',
    '  sharp.g = texture2D(uTex, clamp(uv + offG, 0.001, 0.999)).g;',
    '  sharp.b = texture2D(uTex, clamp(uv + offB, 0.001, 0.999)).b;',
    /* 模糊图与屏幕 1:1 对应，位移按屏幕 UV 计 */
    '  vec3 bl = texture2D(uBlur, clamp(suv + n * str / uRes, 0.001, 0.999)).rgb;',
    '  vec3 col = mix(sharp, bl, clamp(fr, 0.0, 1.0));',
    /* 调色：增饱和 → 暗/亮模式各自的亮度曲线 → 着色 */
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(lum), col, 1.2);',
    '  col = mix(col * 1.02 + 0.03, col * 0.78 + 0.015, uDark);',
    '  col = mix(col, tc, clamp(ta, 0.0, 1.0));',
    /* 边缘高光：等值带 × 光向（左上来光）。亮色主题底色已亮，
       高光减半防止粗白边；暗色保持全强度冷光 */
    '  float band = exp(-abs(d) / max(uBezel * 0.25, 1.0));',
    '  vec2 L = normalize(vec2(-0.55, -0.83));',
    '  float lit = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 rimCol = mix(vec3(1.0), vec3(0.75, 0.85, 1.0), uDark);',
    /* 指针跟光：指针投影到本形状边框上的那个点，周围一段边框被点亮。
       只加到边框带 band / 轮廓线 line 上，玻璃内部不铺光。 */
    '  if (uPtrOn > 0.5 && ptrK > 0.001) {',
    '    float rp = clamp(min(uRes.x, uRes.y) * 0.15, 90.0, 260.0);',
    '    float dd = length(p - ptrPt) / rp;',
    '    hot = exp(-dd * dd) * ptrK;',
    '    band = max(band, hot * 0.95 * exp(-abs(d) / 2.2));',
    '  }',
    '  float rimI = uRim * mix(0.45, 1.0, uDark) * (1.0 + 2.6 * hot);',
    '  col += rimCol * (rimI * band * (0.22 + 0.55 * lit));',
    '  col -= rimCol * (rimI * 0.25 * band * (1.0 - lit));',
    /* 外沿 1px 亮线，托出轮廓；靠近指针处一起变亮 */
    '  float line = 1.0 - smoothstep(0.0, 1.2, abs(d + 0.6));',
    '  col += rimCol * line * mix(0.05, 0.12, uDark) * (1.0 + 2.0 * hot);',
    '  return vec4(col, a);',
    '}',

    'void main(){',
    '  vec2 p = vUv * uRes;',
    '  vec2 uv = vUv * uFit.xy + uFit.zw;',
    '  vec3 col = texture2D(uTex, uv).rgb;',   // 底：壁纸
    '  float d0; vec2 n0; float fr0; vec3 tc0; float ta0; vec2 pt0; float pk0;',
    '  d0 = field(p, 0.0, n0, fr0, tc0, ta0, pt0, pk0);',
    '  float d1; vec2 n1; float fr1; vec3 tc1; float ta1; vec2 pt1; float pk1;',
    '  d1 = field(p, 1.0, n1, fr1, tc1, ta1, pt1, pk1);',
    '  if (d0 < 0.0) { vec4 s = surf(d0, n0, fr0, tc0, ta0, uv, vUv, p, pt0, pk0); col = mix(col, s.rgb, s.a); }',
    '  if (d1 < 0.0) { vec4 s = surf(d1, n1, fr1, tc1, ta1, uv, vUv, p, pt1, pk1); col = mix(col, s.rgb, s.a); }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function parseRadius(cs) {
    var v = cs.borderTopLeftRadius || '0';
    var m = String(v).match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function alphaOf(color) {
    if (!color || color === 'transparent') return 0;
    var m = String(color).match(/rgba?\([^)]*,\s*([\d.]+)\s*\)$/);
    if (m) return parseFloat(m[1]);
    if (String(color).indexOf('#') === 0 && color.length >= 8) {
      return parseInt(color.slice(7, 9), 16) / 255;
    }
    return 1;
  }

  /* 遮挡判定：祖先有不透明底 / 背景图 / 自带磨砂 → 该玻璃不渲染 */
  function blockedByAncestor(el) {
    var p = el.parentElement;
    while (p && p !== document.body) {
      var cs = getComputedStyle(p);
      var bf = cs.backdropFilter || cs.webkitBackdropFilter;
      if ((bf && bf !== 'none') ||
          (cs.backgroundImage && cs.backgroundImage !== 'none') ||
          alphaOf(cs.backgroundColor) > 0.05) return true;
      p = p.parentElement;
    }
    return false;
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var s = m[1];
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return [parseInt(s.slice(0, 2), 16) / 255,
            parseInt(s.slice(2, 4), 16) / 255,
            parseInt(s.slice(4, 6), 16) / 255];
  }

  function cssColorToRgb(v) {
    if (!v || v === 'none') return null;
    var m = String(v).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    return hexToRgb(v);
  }

  function LiquidGlass(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.o = {
      refraction: opts.refraction != null ? opts.refraction : 18,
      dispersion: opts.dispersion != null ? opts.dispersion : 0.05,
      frost: opts.frost != null ? opts.frost : 12,
      bezel: opts.bezel != null ? opts.bezel : 14,
      mergeK: opts.mergeK != null ? opts.mergeK : 30,
      rim: opts.rim != null ? opts.rim : 0.55,
      mode: opts.mode || 'light',
      liquid: !!opts.liquid
    };
    this.items = [];
    this.solids = [];
    this.src = null;
    this.live = false;
    this.dirty = true;
    this.ready = false;
    this.failed = false;
    this.size = { w: 0, h: 0 };
    this._sx = 0; this._sy = 0; this._fc = 0;
    this._fit = [1, 1, 0, 0];
    /* 指针：ptr = 目标位置，ptrS = 平滑后位置（制造跟随的拖尾感） */
    this.ptr = { x: -9999, y: -9999, on: false };
    this.ptrS = { x: -9999, y: -9999, on: false };
    this._rc = null; this._rct = 0;
    this.u = {};
    this._gBuf = new Float32Array(MAXG * 4);
    this._aBuf = new Float32Array(MAXG * 4);
    this._bBuf = new Float32Array(MAXG * 4);

    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false })
          || canvas.getContext('experimental-webgl', { alpha: false });
    if (!gl) { this.failed = true; return; }
    this.gl = gl;

    var pr = gl.createProgram();
    var mk = function (type, srcText) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, srcText);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('LiquidGlassNext shader:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    var vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { this.failed = true; return; }
    gl.attachShader(pr, vs); gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      console.warn('LiquidGlassNext link:', gl.getProgramInfoLog(pr));
      this.failed = true; return;
    }
    this.program = pr;
    gl.useProgram(pr);

    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var self = this;
    ['uTex', 'uBlur', 'uRes', 'uFit', 'uGN', 'uBezel', 'uStrength', 'uDisp', 'uMergeK', 'uDark', 'uRim', 'uPtr', 'uPtrOn']
      .forEach(function (n) { self.u[n] = gl.getUniformLocation(pr, n); });
    ['uG', 'uA', 'uB'].forEach(function (n) { self.u[n] = gl.getUniformLocation(pr, n + '[0]'); });

    /* ---- 指针监听：只登记坐标，重活留到渲染帧，不在事件里读布局 ---- */
    this._onMove = function (e) {
      var t = (window.performance && performance.now) ? performance.now() : Date.now();
      if (!self._rc || t - self._rct > 300) {
        self._rc = canvas.getBoundingClientRect(); self._rct = t;
      }
      self.ptr.x = e.clientX - self._rc.left;
      self.ptr.y = e.clientY - self._rc.top;
      self.ptr.on = true;
    };
    this._onLeave = function () { self.ptr.on = false; };
    this._onUp = function (e) {
      if (e && e.pointerType && e.pointerType !== 'mouse') self.ptr.on = false;
    };
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerdown', this._onMove, { passive: true });
    window.addEventListener('pointerup', this._onUp, { passive: true });
    document.addEventListener('pointerleave', this._onLeave);
    window.addEventListener('blur', this._onLeave);

    this.tex = this._tex(0);
    this.blurTex = this._tex(1);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform1i(this.u.uBlur, 1);

    this.blurC = document.createElement('canvas');

    this._raf = requestAnimationFrame(function loop() {
      if (!self._dead) { self._frame(); self._raf = requestAnimationFrame(loop); }
    });
  }

  LiquidGlass.prototype._tex = function (unit) {
    var gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255]));
    return t;
  };

  LiquidGlass.prototype.set = function (o) {
    for (var k in (o || {})) this.o[k] = o[k];
    this.dirty = true;
  };

  LiquidGlass.prototype.setSource = function (src, opt) {
    opt = opt || {};
    this.src = src;
    this.live = opt.live != null ? !!opt.live
      : (typeof HTMLVideoElement !== 'undefined' && src instanceof HTMLVideoElement);
    this.dirty = true;
  };

  LiquidGlass.prototype.invalidate = function () { this.dirty = true; };

  LiquidGlass.prototype.add = function (el, opts) {
    for (var i = 0; i < this.items.length; i++) if (this.items[i].el === el) return this.items[i];
    var d = el.dataset, pre = PRESETS[(opts && opts.preset) || d.glass] || PRESETS.bar;
    var it = {
      el: el,
      grow: pre.grow, frost: pre.frost, tint: pre.tint, merge: pre.merge, layer: pre.layer,
      dl: 0, dt: 0, dw: 0, dh: 0, rad: 0,
      tintC: [1, 1, 1], hidden: false, blocked: false, parent: null, live: false
    };
    this.items.push(it);
    return it;
  };

  LiquidGlass.prototype.remove = function (el) {
    el.removeAttribute('data-glass-live');
    this.items = this.items.filter(function (i) { return i.el !== el; });
    this.solids = this.solids.filter(function (s) { return s.el !== el; });
  };

  /* 每帧打标：shader 本帧实际绘制的元素才挂 data-glass-live，
     其余退回 CSS 自绘玻璃（backdrop-filter 直接糊引擎画布） */
  LiquidGlass.prototype._syncLive = function () {
    var items = this.items;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], want = !it.blocked && !it.hidden && it._drawn === true;
      if (it.live === want) continue;
      it.live = want;
      if (want) it.el.setAttribute('data-glass-live', '');
      else it.el.removeAttribute('data-glass-live');
    }
  };

    LiquidGlass.prototype.scan = function (root) {
    root = root || document;
    var self = this;
    var seen = [];
    Array.prototype.forEach.call(root.querySelectorAll('[data-glass]'), function (el) {
      seen.push(el);
      for (var i = 0; i < self.items.length; i++) if (self.items[i].el === el) return;
      self.add(el);
    });
    /* 父子关系：最近的带 data-glass 祖先。子元素画在 layer 1，叠在父层玻璃之上 */
    this.items.forEach(function (it) {
      var p = it.el.parentElement, found = null;
      while (p && p !== document.body) {
        if (p.hasAttribute && p.hasAttribute('data-glass')) {
          for (var k = 0; k < self.items.length; k++) if (self.items[k].el === p) { found = self.items[k]; break; }
          if (found) break;
        }
        p = p.parentElement;
      }
      it.parent = found;
    });
    this.items = this.items.filter(function (i) {
      if (i.el.isConnected && seen.indexOf(i.el) >= 0) return true;
      i.el.removeAttribute('data-glass-live');
      return false;
    });
    this.solids = this.solids.filter(function (s) {
      return s.el.isConnected && s.el.hasAttribute('data-glass-solid');
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-glass-solid]'), function (el) {
      for (var i = 0; i < self.solids.length; i++) if (self.solids[i].el === el) return;
      self.solids.push({ el: el, layer: parseFloat(el.dataset.layer || '0') });
    });
    this._occl();
    this.dirty = true;
  };

  LiquidGlass.prototype._occl = function () {
    this.items.forEach(function (it) {
      it.blocked = it.el.isConnected ? blockedByAncestor(it.el) : true;
    });
  };

  LiquidGlass.prototype.destroy = function () {
    this._dead = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._onMove) {
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerdown', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      document.removeEventListener('pointerleave', this._onLeave);
      window.removeEventListener('blur', this._onLeave);
    }
    document.documentElement.classList.remove('lg-ready');
    this.items.forEach(function (i) { i.el.removeAttribute('data-glass-live'); });
    var gl = this.gl;
    if (gl) {
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.blurTex) gl.deleteTexture(this.blurTex);
      if (this.program) gl.deleteProgram(this.program);
    }
  };

  LiquidGlass.prototype._frame = function () {
    var gl = this.gl, cv = this.canvas;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H || document.hidden) return;

    /* ---- 滚动帧零 DOM 读取：位置 = 文档坐标缓存 − scroll ---- */
    var sx = window.scrollX, sy = window.scrollY;
    var scrolling = sx !== this._sx || sy !== this._sy;
    this._sx = sx; this._sy = sy;

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; this.dirty = true; }
    gl.viewport(0, 0, bw, bh);
    if (W !== this.size.w || H !== this.size.h) { this.size = { w: W, h: H }; this.dirty = true; }

    /* ---- 采集几何 → uniform 缓冲 ---- */
    var gN = 0;
    var gB = this._gBuf, aB = this._aBuf, bB = this._bBuf;
    var items = this.items;
    for (var i = 0; i < items.length; i++) items[i]._drawn = false;
    for (var i = 0; i < items.length && gN < MAXG; i++) {
      var it = items[i], el = it.el;
      if (!scrolling) it.blocked = blockedByAncestor(el);
      if (it.blocked) continue;
      if (!scrolling || !it.dw) {
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
          it.hidden = true; continue;
        }
        it.hidden = false;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) { it.hidden = true; continue; }
        it.dl = r.left + sx; it.dt = r.top + sy;
        it.dw = r.width; it.dh = r.height;
        it.rad = parseRadius(cs);
        /* data-* 覆盖每帧重读（glass-webgl 可能在 scan 后打标/改标） */
        var dset = el.dataset;
        ['tint', 'frost', 'layer', 'merge', 'grow'].forEach(function (k) {
          if (dset[k] !== undefined) { var v = parseFloat(dset[k]); if (!isNaN(v)) it[k] = v; }
        });
        /* 着色解析：保留 CSS 颜色的 alpha（transparent → 不着色，由 DOM wash 兜底） */
        var dark = this.o.mode === 'dark';
        var tv = cs.getPropertyValue('--lg-tint').trim();
        var tc = null, taMul = 0;
        if (tv && tv !== 'transparent' && tv !== 'none') {
          tc = cssColorToRgb(tv);
          if (tc) taMul = alphaOf(tv);
        }
        if (!tc) {
          var bgv = cs.backgroundColor;
          tc = cssColorToRgb(bgv);
          if (tc) taMul = alphaOf(bgv);
        }
        if (!tc) tc = dark ? [0.09, 0.09, 0.11] : [1, 1, 1];
        it.tintC = tc;
        it.tintA = taMul;
      }
      if (it.hidden) continue;

      var hw = it.dw / 2, hh = it.dh / 2;
      var grow = it.grow || 0;
      if (grow > 0) {
        var pad = grow * Math.min(hw, hh);
        hw += pad; hh += pad;
      }
      var x = it.dl - sx + hw, y = it.dt - sy + hh;
      if (x + hw < 0 || x - hw > W || y + hh < 0 || y - hh > H) continue;

      var o4 = gN * 4;
      /* 嵌套深度：子元素（父链上有其他玻璃）画在 layer 1，叠在父层之上 */
      var depth = 0, anc = it.parent;
      while (anc) { depth++; anc = anc.parent; }
      if (depth > 1) continue;
      gB[o4] = x; gB[o4 + 1] = y; gB[o4 + 2] = hw; gB[o4 + 3] = hh;
      aB[o4] = Math.min(it.rad, Math.min(hw, hh));
      aB[o4 + 1] = (depth >= 1 || it.layer >= 1) ? 1 : 0;
      aB[o4 + 2] = clamp(it.frost, 0, 1);
      aB[o4 + 3] = clamp(it.tint * (it.tintA != null ? it.tintA : 1), 0, 1);
      bB[o4] = it.merge ? 1 : 0;
      bB[o4 + 1] = it.tintC[0]; bB[o4 + 2] = it.tintC[1]; bB[o4 + 3] = it.tintC[2];
      it._drawn = true;
      gN++;
    }
    this._syncLive();

    /* ---- 纹理上传（live 隔帧；脏时必传） ---- */
    if (this.src && (this.dirty || (this.live && (this._fc % 2 === 0)))) this._upload();

    gl.useProgram(this.program);
    var f = this._fit;
    gl.uniform4f(this.u.uFit, f[0], f[1], f[2], f[3]);
    gl.uniform2f(this.u.uRes, W, H);
    gl.uniform1i(this.u.uGN, gN);
    gl.uniform1f(this.u.uBezel, this.o.bezel);
    gl.uniform1f(this.u.uStrength, this.o.refraction);
    gl.uniform1f(this.u.uDisp, this.o.dispersion);
    gl.uniform1f(this.u.uMergeK, this.o.mergeK);
    gl.uniform1f(this.u.uDark, this.o.mode === 'dark' ? 1 : 0);
    gl.uniform1f(this.u.uRim, this.o.rim);

    /* 指针平滑：进入页面时直接就位，移动时带一点跟手延迟 → 光沿边框滑动 */
    var tp = this.ptr, sp = this.ptrS;
    if (tp.on) {
      if (!sp.on) { sp.x = tp.x; sp.y = tp.y; sp.on = true; }
      else {
        sp.x += (tp.x - sp.x) * 0.22;
        sp.y += (tp.y - sp.y) * 0.22;
        if (Math.abs(tp.x - sp.x) < 0.4 && Math.abs(tp.y - sp.y) < 0.4) { sp.x = tp.x; sp.y = tp.y; }
      }
    } else {
      sp.on = false;
    }
    gl.uniform2f(this.u.uPtr, sp.x, sp.y);
    gl.uniform1f(this.u.uPtrOn, sp.on ? 1 : 0);
    if (gN) {
      gl.uniform4fv(this.u.uG, gB);
      gl.uniform4fv(this.u.uA, aB);
      gl.uniform4fv(this.u.uB, bB);
    }

    this._fc++;
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.dirty = false;
  };

  /* 上传壁纸原图 + CPU 模糊图（cover 铺满，uFit 记录屏幕→纹理映射） */
  LiquidGlass.prototype._upload = function () {
    var gl = this.gl, s = this.src;
    try {
      /* 源尺寸用位图尺寸（纹理 0-1 UV 对应位图；CSS 尺寸由 uFit 换算承担） */
      var sw = s.videoWidth || s.width, sh = s.videoHeight || s.height;
      if (!sw || !sh) return;
      var W = this.size.w, H = this.size.h;
      var sc = Math.max(W / sw, H / sh);
      var dw = sw * sc, dh = sh * sc;
      var dx = (W - dw) / 2, dy = (H - dh) / 2;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);

      /* 壁纸 1/4 分辨率 + CPU blur —— 玻璃霜化只看这张 */
      var bc = this.blurC, bw = Math.max(2, Math.round(W / 4)), bh = Math.max(2, Math.round(H / 4));
      if (bc.width !== bw) bc.width = bw;
      if (bc.height !== bh) bc.height = bh;
      var x = bc.getContext('2d');
      x.filter = 'blur(' + Math.max(this.o.frost / 4, 0.5).toFixed(2) + 'px)';
      x.clearRect(0, 0, bw, bh);
      x.drawImage(s, 0, 0, sw, sh, dx / 4, dy / 4, dw / 4, dh / 4);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);

      this._fit = [W / dw, H / dh, -dx / dw, -dy / dh];
      this.ready = true;
      document.documentElement.classList.add('lg-ready');
    } catch (e) {
      console.warn('LiquidGlassNext: source upload failed', e);
    }
    this.dirty = false;
  };

  LiquidGlass.PRESETS = PRESETS;
  window.LiquidGlassEngine = { LiquidGlass: LiquidGlass, default: LiquidGlass };
})();
