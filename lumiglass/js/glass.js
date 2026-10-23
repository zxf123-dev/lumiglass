/* ============================================================
   Lumi Glass · glass.js  v1.2
   ------------------------------------------------------------
   可选脚本，做六件事：
   1. 注入 SVG 折射滤镜 #lg-lens，并做能力检测
   2. 指针追踪高光（写入 --mx / --my）
   3. 卡片液态悬停（.fx-lift）
   4. 吸顶容器滚动加厚（.is-scrolled）
   5. 明暗主题切换 + LiquidGlass.toast()
   6. 动态壁纸引擎：body[data-wallpaper] 时挂一张全屏
      canvas，画「底色 + 缓慢漂移的光斑」，让玻璃下面
      永远有活的内容可折射 —— 静态渐变看着假，就是
      因为光不动。30fps、半分辨率、无障碍降为静帧。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1. 折射透镜（真位移，不是 backdrop-filter url） ----------
     事实核对：`backdrop-filter: url(#f)` 只有极少数引擎认，Chromium /
     Safari 会把整条声明丢弃 —— 所以「CSS 折射」在 Chrome 里从来没生效，
     玻璃一直只是纯模糊。参考站是 JS 自己算像素，这里走等效但更稳的线路：

       ① 对普通元素，`filter: url(#lg-lens)` 是全网都支持的（不是 backdrop）；
       ② 把玻璃背后那块壁纸抓进一块小 canvas，中心掏空、只留最外一圈；
       ③ 这块 canvas 施加「透镜位移」再贴回盒内，并用 --lg-wash 补一层同款
          白洗 —— 边缘和中心的观感才像同一块玻璃。

     中心仍然交给真实 backdrop-filter（前面是什么就模糊什么），外圈则由
     透镜弯折背景：边缘更「实」并向内压缩，这就是镜片感。 */
  function lensMapURI(axis) {
    var isX = axis === 'x';
    var peak = isX ? '#ff0000' : '#00ff00';   /* 边缘：位移最大 */
    var mid = isX ? '#800000' : '#008000';    /* 中段：0.5 中性，不位移 */
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" preserveAspectRatio="none">' +
        '<defs><linearGradient id="g" gradientUnits="objectBoundingBox"' +
          (isX ? ' x1="0" y1="0" x2="1" y2="0"' : ' x1="0" y1="0" x2="0" y2="1"') + '>' +
          '<stop offset="0" stop-color="#000"/>' +
          '<stop offset=".18" stop-color="' + mid + '"/>' +
          '<stop offset=".82" stop-color="' + mid + '"/>' +
          '<stop offset="1" stop-color="' + peak + '"/>' +
        '</linearGradient></defs>' +
        '<rect width="64" height="64" fill="url(#g)"/></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function injectLens() {
    if (document.getElementById('lg-lens-svg')) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'lg-lens-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    svg.innerHTML =
      '<filter id="lg-lens" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
        '<feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" href="' + lensMapURI('x') + '" result="mx"/>' +
        '<feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" href="' + lensMapURI('y') + '" result="my"/>' +
        '<feBlend in="mx" in2="my" mode="screen" result="map"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="map" scale="30" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    document.body.appendChild(svg);
  }

  /* 只对 92px 以上的玻璃做（按钮 / 开关 / 标签做透镜看不出、还费性能） */
  var LENS_MIN = 92, LENS_PAD = 26, LENS_BAND = 22;
  var lensItems = [], lensFrame = 0;

  function lensSupported() {
    try {
      if (!(window.CSS && CSS.supports)) return false;
      return CSS.supports('filter', 'url(#lg-lens)') ||
             CSS.supports('-webkit-filter', 'url(#lg-lens)');
    } catch (e) { return false; }
  }

  function buildLens() {
    [].forEach.call(document.querySelectorAll('.lg-lens'), function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    lensItems = [];
    /* 默认关闭：实测参考站在 Chromium 上 backdrop-filter 是 none（折射是它
       家 WebGL 画在壁纸里的），Chrome 上照搬只会让边缘发灰。要试的话给
       body 加 data-lens="on" 才启用。 */
    if (document.body.getAttribute('data-lens') !== 'on' || !wpCanvas || !lensSupported()) {
      document.documentElement.classList.remove('has-lg-lens');
      return;
    }
    document.documentElement.classList.add('has-lg-lens');
    [].forEach.call(document.querySelectorAll('.glass'), function (el) {
      if (el.hasAttribute('data-no-lens')) return;
      var r = el.getBoundingClientRect();
      if (r.width < LENS_MIN || r.height < LENS_MIN) return;
      var wrap = document.createElement('span');
      wrap.className = 'lg-lens';
      wrap.setAttribute('aria-hidden', 'true');
      var cvs = document.createElement('canvas');
      cvs.className = 'lg-lens-c';
      wrap.appendChild(cvs);
      el.appendChild(wrap);
      lensItems.push({ el: el, cvs: cvs, ctx: cvs.getContext('2d'), w: 0, h: 0 });
    });
  }

  function lensDraw(it) {
    var el = it.el, r = el.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    if (r.width < LENS_MIN || r.height < LENS_MIN) return;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
    var W = Math.round(r.width), H = Math.round(r.height);
    var cw = W + LENS_PAD * 2, ch = H + LENS_PAD * 2;
    var cvs = it.cvs, ctx = it.ctx;
    if (it.w !== cw || it.h !== ch) {
      it.w = cw; it.h = ch;
      cvs.width = cw; cvs.height = ch;
      cvs.style.cssText = 'position:absolute;left:' + (-LENS_PAD) + 'px;top:' + (-LENS_PAD) +
        'px;width:' + cw + 'px;height:' + ch + 'px';
    }
    /* 壁纸是 position:fixed 且铺满视口，视口坐标 × 缩放比 = 壁纸位图坐标 */
    var kx = wpCanvas.width / vw, ky = wpCanvas.height / vh;
    var sx = (r.left - LENS_PAD) * kx, sy = (r.top - LENS_PAD) * ky;
    var sw = cw * kx, sh = ch * ky;
    var dx = 0, dy = 0;
    if (sx < 0) { dx = -sx / kx; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy / ky; sh += sy; sy = 0; }
    if (sx + sw > wpCanvas.width) sw = wpCanvas.width - sx;
    if (sy + sh > wpCanvas.height) sh = wpCanvas.height - sy;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, cw, ch);
    if (sw > 1 && sh > 1) ctx.drawImage(wpCanvas, sx, sy, sw, sh, dx, dy, cw - dx, ch - dy);
    /* 中心掏空，只留外圈一圈 —— 否则会和 backdrop-filter 糊成两层影子 */
    var bw = W - LENS_BAND * 2, bh = H - LENS_BAND * 2;
    if (bw > 0 && bh > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.filter = 'blur(' + Math.round(LENS_BAND * .6) + 'px)';
      ctx.fillStyle = '#000';
      ctx.fillRect(LENS_PAD + LENS_BAND, LENS_PAD + LENS_BAND, bw, bh);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* 壁纸 30fps → 透镜隔帧跟（15fps 足够，周期是 110 秒） */
  function lensSync() {
    if (!lensItems.length) return;
    lensFrame++;
    if (lensFrame % 2) return;
    for (var i = 0; i < lensItems.length; i++) lensDraw(lensItems[i]);
  }

  /* ---------- 2. 按压弹簧（对齐参考站实测曲线） ----------
     参考站实测（pointerdown→up 全程采样）：
       · 按下后 scale 从 1 弹到 ~1.11（约 170ms 达峰），按住期间在
         1.09 ~ 1.12 之间持续小幅振荡 —— 这是 JS 弹簧物理，纯 CSS
         transition 到达目标值就停，做不出「冲过头再荡回来」；
       · 松开后回落 1，下探到 ~0.989 再收敛。
     这里用阻尼弹簧（ωn≈26, ζ≈0.34）逐帧积分，目标值：按住 1.09、
     松开 1。接管期间挂 .lg-springing 关掉 CSS 的 :active 缩放，
     避免两个缩放打架。 */
  var SPRING_SEL = [
    '.btn', '.pressable', '.lg-control', '.fab', '.dapp',
    '.seg label', '.chip', '.tile .face', '.stepper button',
    '.sw .knob', '.check .box', '.cc-play', '.theme-toggle'
  ].join(', ');
  var SPRING_WN = 26, SPRING_ZETA = 0.28, SPRING_DOWN = 1.12;
  /* 对齐 WebGL knob preset grow 0.14 → 按住约 1.14 */
  var SPRING_KNOB = 1.14;
  /* 松开单独用大阻尼：参考站松开段只下探到 ~0.989（过冲 11%），
     与按下段的 40% 过冲不对称 —— 纯一组参数拟合不出两边。 */
  var SPRING_ZETA_UP = 0.55;
  var sprList = [], sprRaf = 0, sprLast = 0;

  function sprStart(el, target, zeta, releaseEl) {
    var sp = null;
    for (var i = 0; i < sprList.length; i++) if (sprList[i].el === el) { sp = sprList[i]; break; }
    if (!sp) { sp = { el: el, s: 1, v: 0, bound: false, zeta: SPRING_ZETA }; sprList.push(sp); }
    sp.target = target;
    if (zeta) sp.zeta = zeta;
    var rel = releaseEl || el;
    if (!sp.bound) {
      sp.bound = true;
      sp.releaseEl = rel;
      el.classList.add('lg-springing');
      var release = function () {
        rel.removeEventListener('pointerup', release);
        rel.removeEventListener('pointercancel', release);
        if (rel === el) rel.removeEventListener('pointerleave', release);
        sp.bound = false;
        sp.target = 1;          /* 松开：弹回 1，弹簧自己收敛 */
        sp.zeta = SPRING_ZETA_UP;
        if (!sprRaf) { sprLast = performance.now(); sprRaf = requestAnimationFrame(sprLoop); }
      };
      rel.addEventListener('pointerup', release);
      rel.addEventListener('pointercancel', release);
      if (rel === el) rel.addEventListener('pointerleave', release);
    }
    if (!sprRaf) { sprLast = performance.now(); sprRaf = requestAnimationFrame(sprLoop); }
  }

  function sprLoop(now) {
    sprRaf = requestAnimationFrame(sprLoop);
    var dt = Math.min(0.02, Math.max(0.001, (now - sprLast) / 1000));
    sprLast = now;
    var k = SPRING_WN * SPRING_WN;
    for (var i = sprList.length - 1; i >= 0; i--) {
      var sp = sprList[i];
      var c = 2 * (sp.zeta || SPRING_ZETA) * SPRING_WN;
      var a = k * (sp.target - sp.s) - c * sp.v;
      sp.v += a * dt;
      sp.s += sp.v * dt;
      if (Math.abs(sp.v) < 0.0008 && Math.abs(sp.target - sp.s) < 0.0008) {
        sp.el.style.removeProperty('scale');
        sp.el.classList.remove('lg-springing');
        sprList.splice(i, 1);
        continue;
      }
      sp.el.style.scale = sp.s.toFixed(4);
    }
    if (!sprList.length) { cancelAnimationFrame(sprRaf); sprRaf = 0; }
  }

  function bindSpring() {
    if (bindSpring._on) return;            /* 防止 refresh() 重复绑定全局监听 */
    if (!window.PointerEvent) return;
    bindSpring._on = true;
    document.addEventListener('pointerdown', function (e) {
      var el = e.target && e.target.closest ? e.target.closest(SPRING_SEL) : null;
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.hasAttribute('data-glass-live')) return;
      var target = el.classList.contains('knob') ? SPRING_KNOB : SPRING_DOWN;
      sprStart(el, target, SPRING_ZETA);
    }, true);
  }

  /* 旧版类名 → 标准控件（index 等内联 lg-*） */
  function normalizeLegacyControls(root) {
    var scope = root && root.querySelectorAll ? root : document;
    [].forEach.call(scope.querySelectorAll('.lg-switch'), function (el) {
      if (el.querySelector('.track') && el.querySelector('.knob')) el.classList.add('sw');
    });
    [].forEach.call(scope.querySelectorAll('.lg-segmented'), function (el) {
      if (el.querySelector('label')) el.classList.add('seg');
    });
    [].forEach.call(scope.querySelectorAll('.lg-tile'), function (el) {
      el.classList.add('tile');
      var inner = el.querySelector('.tile');
      if (inner && !el.querySelector('.face')) {
        inner.classList.add('face');
      }
    });
  }

  /* ---------- 3. 卡片液态悬停：给常见卡片组件加 .fx-lift ---------- */
  var FX_SELECTORS = '.card.glass, .tpl-card.glass, .feature.glass, .bc.glass, .pricecard.glass, .prod-card.glass, .cover.glass';
  function bindFx() {
    [].forEach.call(document.querySelectorAll(FX_SELECTORS), function (el) {
      el.classList.add('fx-lift');
    });
  }

  /* ---------- 指针追光（仅 .lg-sheen，写在 --lg-mx / --lg-my） ---------- */
  var SHEEN_SEL = '.glass.lg-sheen, .lg.lg-sheen';
  var sheenRaf = 0;

  function bindSheen() {
    if (bindSheen._on) return;             /* 防止重复绑定全局监听 */
    if (!window.PointerEvent) return;
    bindSheen._on = true;
    document.addEventListener('pointermove', function (e) {
      if (sheenRaf) return;
      sheenRaf = requestAnimationFrame(function () {
        sheenRaf = 0;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        [].forEach.call(document.querySelectorAll(SHEEN_SEL), function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
          var w = r.width || 1;
          var h = r.height || 1;
          el.style.setProperty('--lg-mx', ((e.clientX - r.left) / w * 100).toFixed(1) + '%');
          el.style.setProperty('--lg-my', ((e.clientY - r.top) / h * 100).toFixed(1) + '%');
        });
      });
    }, { passive: true });
  }

  /* ---------- 3. 吸顶滚动加厚 ---------- */
  var stickyBars = [];
  function stickyUpdate() {
    stickyBars.forEach(function (bar) {
      bar.classList.toggle('is-scrolled', window.scrollY > 8);
    });
  }
  function bindSticky() {
    stickyBars = [].slice.call(document.querySelectorAll('.topbar-web, [data-sticky-glass]'));
    if (!stickyBars.length) return;
    if (!bindSticky._on) {                 /* 滚动监听只绑一次，bars 列表可随 refresh() 更新 */
      bindSticky._on = true;
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () {
            stickyUpdate();
            ticking = false;
          });
        }
      }, { passive: true });
    }
    stickyUpdate();
  }

  /* ---------- 4. 主题切换 ---------- */
  var THEME_KEY = 'lg-theme';

  /* 太阳 / 月亮 SVG：字符 ☾ 在部分平台会落到 emoji 字体，粗黑不协调 */
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.6 13.1A8.1 8.1 0 1 1 10.9 3.4a6.4 6.4 0 0 0 9.7 9.7z"/></svg>';

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    [].forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (btn) {
      btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    });
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved) applyTheme(saved);
    else {
      var preset = document.documentElement.getAttribute('data-theme');
      if (preset === 'light' || preset === 'dark') applyTheme(preset);
      else applyTheme(null);
    }
    [].forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (btn) {
      btn.addEventListener('click', function () {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var next = isDark ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      });
    });
    repaintWallpaper();
  }

  /* ---------- 6. 动态壁纸引擎 ----------
     同类产品的公开做法：全屏 canvas，底层一道三段式的
     「同明度」线性底色（亮色几乎单色，不发彩虹），上面
     4 个 radial 光斑用 sin/cos 慢速漂移（周期以分钟计），
     玻璃折射的正是这些移动的光。半分辨率渲染 + 30fps 节流，
     prefers-reduced-motion 时只画一帧静态。 */
  var WALLPAPERS = {
    lumi: {
      /* 灰白，但明度差拉够 —— 明度差小于 10% 时光斑等于不存在，
         玻璃压上去什么都折射不出来，「材质感」就没了。
         这里保持几乎无彩（用户要的灰白），靠明暗起伏撑起层次。 */
      light: { base: ['#f7f8fb', '#eef1f7', '#e6eaf2'], shapes: ['#c8d2e2', '#d9e0ec', '#bcc8db', '#d2dae8'] },
      dark:  { base: ['#151a23', '#191f2a', '#111520'], shapes: ['#3d5070', '#2f3f5c', '#4d6288', '#33415e'] }
    },
    sonoma: {
      light: { base: ['#f2efe9', '#efeae2', '#ece5dc'], shapes: ['#ded0bc', '#e6dac8', '#d3c2ab', '#ece0d0'] },
      dark:  { base: ['#131109', '#181410', '#0d0c08'], shapes: ['#3d3527', '#4c4130', '#2e2a1f', '#463d2e'] }
    },
    tahoe: {
      light: { base: ['#ebf0f1', '#e7edee', '#e3eaeb'], shapes: ['#c2d3d6', '#d0dee0', '#b5c9cd', '#dde5e6'] },
      dark:  { base: ['#0b1012', '#10191c', '#080c0e'], shapes: ['#23333a', '#2c434b', '#1e2d33', '#33474e'] }
    },
    graphite: {
      light: { base: ['#f2f3f5', '#e4e6ea', '#d8dbe2'], shapes: ['#c3c8d2', '#a8aeba', '#95a0b4', '#d0d4dc'] },
      dark:  { base: ['#15161a', '#1e2026', '#0f1013'], shapes: ['#43464f', '#565c6b', '#3d4a63', '#666c78'] }
    },
    /* Glass UI 同名：低饱和紫雾（非彩虹渐变） */
    aurora: {
      light: { base: ['#ebe8f0', '#e8e5ee', '#e3e0ea'], shapes: ['#c8bdd6', '#bfb5d0', '#d2c8de', '#b5aac8'] },
      dark:  { base: ['#141018', '#1a1420', '#121018'], shapes: ['#7c3754', '#50327e', '#463b80', '#60255b'] }
    }
  };
  var wpCanvas = null, wpCtx = null, wpRaf = 0, wpStart = 0, wpLast = 0, wpName = null;

  /* 壁纸饱和度：1 = 预设原色，0 = 完全去色，2 = 加倍浓郁。
     页面可用 <body data-wallpaper-sat="1.4"> 指定，也可运行时调
     LiquidGlass.setWallpaperSaturation(1.4)，会记进 localStorage。 */
  var SAT_KEY = 'lg-wp-sat', wpSat = 1;
  (function () {
    var v = parseFloat(document.body && document.body.getAttribute('data-wallpaper-sat'));
    if (!isNaN(v)) wpSat = v;
    try {
      var s = parseFloat(localStorage.getItem(SAT_KEY));
      if (!isNaN(s)) wpSat = s;
    } catch (e) {}
    wpSat = Math.min(2, Math.max(0, wpSat));
  })();

  function LiquidGlass_setWallpaperSaturation(v) {
    v = parseFloat(v);
    if (isNaN(v)) return wpSat;
    wpSat = Math.min(2, Math.max(0, v));
    try { localStorage.setItem(SAT_KEY, String(wpSat)); } catch (e) {}
    repaintWallpaper();
    for (var i = 0; i < lensItems.length; i++) lensDraw(lensItems[i]);
    return wpSat;
  }

  function wpPreset() {
    var name = document.body.getAttribute('data-wallpaper');
    if (!name) return null;
    var p = WALLPAPERS[name] ? name : 'lumi';
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return { id: p, mode: dark ? 'dark' : 'light', pal: WALLPAPERS[p][dark ? 'dark' : 'light'] };
  }

  function wpPaint(t) {
    if (!wpCtx) return;
    var cfg = wpPreset();
    if (!cfg) return;
    var w = wpCanvas.width, h = wpCanvas.height;
    if (!w || !h) return;
    var pal = cfg.pal, ctx = wpCtx;
    /* 饱和度直接画进位图（而不是给 canvas 挂 CSS filter）——
       这样透镜层 drawImage 抓到的是同一份色彩的像素，边缘和中心不会脱节 */
    ctx.filter = wpSat === 1 ? 'none' : 'saturate(' + wpSat.toFixed(2) + ')';
    /* 半分辨率画布，样式上铺满 —— 玻璃模糊后根本看不出锯齿 */
    /* 主周期 46 秒：110 秒时一分钟才动一点，肉眼等同于静止壁纸，
       玻璃边缘永远折射同一个相位 —— 这是「毫无感觉」的主因之一 */
    var T = t / 1000 / 46 * Math.PI * 2;
    /* 底：三段同明度线性渐变 */
    var base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, pal.base[0]);
    base.addColorStop(.55, pal.base[1]);
    base.addColorStop(1, pal.base[2]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    /* 光斑：4 个 radial，中心慢速漂移，径向渐变天然柔边 */
    var R = Math.max(w, h);
    for (var i = 0; i < pal.shapes.length; i++) {
      var a = T + 1.9 * i;
      /* 每个光斑走不同频率，避免四个一起晃 —— 同频会像整体在呼吸，
         异频才有「云在飘」的错落感 */
      var x = w * (.5 + .36 * Math.sin(a * (i % 2 ? 1.13 : -0.87) + i * .6));
      var y = h * (.5 + .31 * Math.cos(.72 * a + i * 1.1));
      var r = R * (.25 + .07 * i);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, pal.shapes[i]);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = cfg.mode === 'light' ? .32 : .38;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }

  function wpLoop(now) {
    wpRaf = requestAnimationFrame(wpLoop);
    if (document.hidden || now - wpLast < 33.4) return;  /* 30fps 节流 */
    wpLast = now;
    wpPaint(now);
    lensSync();
  }

  function wpSize() {
    if (!wpCanvas) return;
    wpCanvas.width = Math.max(2, Math.round(window.innerWidth / 2));
    wpCanvas.height = Math.max(2, Math.round(window.innerHeight / 2));
  }

  function initWallpaper() {
    var name = document.body.getAttribute('data-wallpaper');
    if (!name) {
      name = 'aurora';
      document.body.setAttribute('data-wallpaper', name);
    }
    if (wpCanvas) return;
    var still = window.matchMedia &&
      matchMedia('(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce)').matches;
    wpCanvas = document.createElement('canvas');
    wpCanvas.className = 'glass-wallpaper';
    wpCanvas.setAttribute('data-glass-backdrop', 'true');
    wpCanvas.setAttribute('aria-hidden', 'true');
    wpCanvas.style.cssText =
      'position:fixed;inset:0;z-index:-1;width:100vw;height:100vh;pointer-events:none';
    document.body.insertBefore(wpCanvas, document.body.firstChild);
    wpCtx = wpCanvas.getContext('2d');
    wpSize();
    wpStart = wpLast = performance.now();
    wpPaint(wpStart);
    buildLens();
    lensRedrawAll();
    if (!still) wpRaf = requestAnimationFrame(wpLoop);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        wpSize(); wpPaint(performance.now());
        buildLens(); lensRedrawAll();
      }, 150);
    });
    /* 静帧模式（reduced-motion）下壁纸不动，滚动时需要手动重抓位置 */
    var sT = 0;
    window.addEventListener('scroll', function () {
      if (wpRaf) return;
      if (sT) return;
      sT = requestAnimationFrame(function () { sT = 0; lensRedrawAll(); });
    }, { passive: true });
  }

  function lensRedrawAll() {
    for (var i = 0; i < lensItems.length; i++) lensDraw(lensItems[i]);
  }

  /* 主题切换时壁纸换色重画一帧 */
  function repaintWallpaper() {
    if (wpCanvas) wpPaint(performance.now());
  }

  function LiquidGlass_setWallpaper(name) {
    if (!name) {
      document.body.removeAttribute('data-wallpaper');
      if (wpCanvas) wpCanvas.style.display = 'none';
      return;
    }
    document.body.setAttribute('data-wallpaper', name);
    if (!wpCanvas) initWallpaper();
    else { wpCanvas.style.display = ''; wpPaint(performance.now()); }
  }

  /* ---------- 5. Toast ---------- */
  function toast(message, options) {
    var opts = options || {};
    var zone = document.querySelector('.toast-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'toast-zone';
      document.body.appendChild(zone);
    }
    var el = document.createElement('div');
    el.className = 'toast glass';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="ti">' + (opts.icon || '✓') + '</span><span></span>';
    el.lastElementChild.textContent = message;
    zone.appendChild(el);
    var life = opts.duration || 2400;
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 380);
    }, life);
    return el;
  }

  /* ---------- 滑块：DOM 拇指跟随 range（对齐 Glass UI knob 层） ---------- */
  function syncSliderEl(slider) {
    if (!slider || (!slider.classList.contains('slider') && !slider.classList.contains('lg-slider'))) return;
    var input = slider.querySelector('input[type="range"]');
    var rail = slider.querySelector('.rail');
    if (!input || !rail) return;
    var fill = slider.querySelector('.fill');
    if (!fill && !slider.classList.contains('rainbow')) {
      fill = document.createElement('div');
      fill.className = 'fill';
      rail.appendChild(fill);
    } else if (fill && fill.parentElement !== rail) {
      rail.appendChild(fill);
    }
    var thumb = slider.querySelector('.thumb');
    if (!thumb) {
      thumb = document.createElement('span');
      thumb.className = 'thumb';
      thumb.setAttribute('aria-hidden', 'true');
      slider.appendChild(thumb);
    } else if (slider.lastElementChild !== thumb) {
      slider.appendChild(thumb);
    }
    var thumbW = 44;
    function pct() {
      var min = parseFloat(input.min) || 0;
      var max = parseFloat(input.max) || 100;
      var val = parseFloat(input.value);
      return Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
    }
    function layout() {
      var w = slider.clientWidth || 0;
      if (w < 8) return;
      var p = pct();
      var travel = Math.max(0, w - thumbW);
      var thumbLeft = p * travel;
      thumb.style.left = thumbLeft + 'px';
      if (fill) fill.style.width = Math.max(0, Math.min(100, p * 100)) + '%';
      if (slider.classList.contains('rainbow') && thumb.classList.contains('thumb-rainbow')) {
        thumb.style.setProperty('--rainbow-w', w + 'px');
        thumb.style.setProperty('--rainbow-x', (-thumbLeft) + 'px');
      }
    }
    if (!slider.dataset.lgSliderBound) {
      slider.dataset.lgSliderBound = '1';
      input.addEventListener('input', layout);
      input.addEventListener('change', layout);
      function knobPress(on) {
        var rt = window.LiquidGlassRuntime;
        if (rt && rt.engine && thumb.hasAttribute('data-glass')) rt.engine.press(thumb, on);
      }
      input.addEventListener('pointerdown', function () {
        slider.classList.add('is-dragging');
        knobPress(true);
        if (!thumb.hasAttribute('data-glass')) {
          sprStart(thumb, SPRING_KNOB, SPRING_ZETA, input);
        }
      });
      input.addEventListener('pointerup', function () {
        slider.classList.remove('is-dragging');
        knobPress(false);
      });
      input.addEventListener('pointercancel', function () {
        slider.classList.remove('is-dragging');
        knobPress(false);
      });
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(layout);
        ro.observe(slider);
      } else {
        window.addEventListener('resize', layout);
      }
    }
    layout();
  }

  function syncSliders(root) {
    var scope = root && root.querySelectorAll ? root : document;
    [].forEach.call(scope.querySelectorAll('.slider, .lg-slider'), syncSliderEl);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    injectLens();
    bindSpring();
    bindFx();
    bindSheen();
    bindSticky();
    initWallpaper();
    initTheme();
    normalizeLegacyControls(document);
    syncSliders(document);
    /* 字体 / 图片落地后尺寸会变，透镜层重新量一次 */
    window.addEventListener('load', function () {
      buildLens();
      lensRedrawAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.LiquidGlass = {
    toast: toast,
    setTheme: applyTheme,
    setWallpaper: LiquidGlass_setWallpaper,
    setWallpaperSaturation: LiquidGlass_setWallpaperSaturation,
    getWallpaperSaturation: function () { return wpSat; },
    getWallpaperCanvas: function () { return wpCanvas; },
    wallpapers: WALLPAPERS,
    syncSliders: syncSliders,
    refresh: function () {
      injectLens(); bindFx(); bindSticky(); initWallpaper(); bindSpring();
      buildLens(); lensRedrawAll();
      normalizeLegacyControls(document);
      syncSliders(document);
    },
    normalizeLegacyControls: normalizeLegacyControls
  };
})();
