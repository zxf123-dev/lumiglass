/* ============================================================
   Lumi Glass · glass-webgl.js
   全站默认：引本文件 + glass-liquid-engine.js 即启用液态引擎
   关闭：body data-lg-engine="off"
   光效档位：body data-lg-profile=
     app（业务模板，面板略克制，控件仍 WebGL 液态）|
     studio（折中光效）|
     showcase（文档/演示，默认）
   ============================================================ */
(function () {
  'use strict';

  /* studio 档：在 app 与 showcase 之间，便于产品站自定义 */
  var LG_PROFILE_STUDIO = {
    refraction: 15,
    dispersion: 0.035,
    frost: 10,
    bezel: 12,
    mergeK: 30,
    rim: 0.48
  };

  function lgProfile() {
    var p = document.body && document.body.getAttribute('data-lg-profile');
    if (p === 'app' || p === 'calm' || p === 'product') return 'app';
    if (p === 'studio' || p === 'pro' || p === 'product-plus') return 'studio';
    return 'showcase';
  }

  function controlsWebGL() {
    if (document.body && document.body.getAttribute('data-lg-controls') === 'off') return false;
    return true;
  }

  function lgEngineOpts(dark, reduceMotion) {
    var p = lgProfile();
    if (p === 'app') {
      /* 与 studio 同档液态参数：控件 WebGL 已全开，引擎不再「发灰」 */
      return {
        refraction: LG_PROFILE_STUDIO.refraction,
        dispersion: LG_PROFILE_STUDIO.dispersion,
        frost: LG_PROFILE_STUDIO.frost,
        bezel: LG_PROFILE_STUDIO.bezel,
        mergeK: LG_PROFILE_STUDIO.mergeK,
        rim: LG_PROFILE_STUDIO.rim,
        mode: dark ? 'dark' : 'light',
        liquid: !reduceMotion
      };
    }
    if (p === 'studio') {
      return {
        refraction: LG_PROFILE_STUDIO.refraction,
        dispersion: LG_PROFILE_STUDIO.dispersion,
        frost: LG_PROFILE_STUDIO.frost,
        bezel: LG_PROFILE_STUDIO.bezel,
        mergeK: LG_PROFILE_STUDIO.mergeK,
        rim: LG_PROFILE_STUDIO.rim,
        mode: dark ? 'dark' : 'light',
        liquid: !reduceMotion
      };
    }
    return {
      refraction: 20,
      dispersion: 0.06,
      frost: 12,
      bezel: 16,
      mergeK: 34,
      rim: 0.62,
      mode: dark ? 'dark' : 'light',
      liquid: !reduceMotion
    };
  }

  var LG_CSS = [
    'html.lg-on [data-glass-live]{background:transparent!important;backdrop-filter:none!important;',
    '-webkit-backdrop-filter:none!important;border-color:transparent!important;box-shadow:none!important}',
    'html.lg-on .lg-control[data-glass-live]:active{scale:none}',
    'html.lg-ready [data-glass-backdrop]{visibility:hidden}',
    'html.lg-on body{background:transparent!important}'
  ].join('');

  function engineEnabled() {
    var v = document.body && document.body.getAttribute('data-lg-engine');
    return v !== 'off' && v !== 'false';
  }

  function ramp(dir, channel) {
    var x2 = dir === 'x' ? '1' : '0';
    var y2 = dir === 'y' ? '1' : '0';
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none">' +
      '<defs><linearGradient id="g" x2="' + x2 + '" y2="' + y2 + '">' +
      '<stop offset="0" stop-color="' + channel + '" stop-opacity="1"/>' +
      '<stop offset=".14" stop-color="' + channel + '" stop-opacity=".5"/>' +
      '<stop offset=".86" stop-color="' + channel + '" stop-opacity=".5"/>' +
      '<stop offset="1" stop-color="' + channel + '" stop-opacity="0"/>' +
      '</linearGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function injectFilters() {
    if (document.getElementById('lg-lens')) return;
    if (!/Chrome\//.test(navigator.userAgent)) return;
    document.documentElement.classList.add('lg-lens');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute';
    svg.innerHTML =
      '<filter id="lg-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feImage href="' + ramp('x', '#f00') + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="rx"/>' +
      '<feImage href="' + ramp('y', '#0f0') + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="gy"/>' +
      '<feComposite in="rx" in2="gy" operator="arithmetic" k2="1" k3="1" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="14" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    document.body.appendChild(svg);
  }

  function tag(el, preset, classes, frost, tint) {
    if (!el || el.hasAttribute('data-glass') || el.hasAttribute('data-lg-skip')) return;
    if (el.closest('.dapp, .cc-ico, .dock-item')) return;
    el.classList.add('lg');
    classes.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    el.setAttribute('data-glass', preset);
    el.setAttribute('data-frost', String(frost));
    el.setAttribute('data-tint', String(tint));
  }

  function syncSwitchGlass(sw) {
    if (!sw) return;
    var inp = sw.querySelector('input');
    if (!inp) return;
    var knob = sw.querySelector('.knob');
    var on = inp.checked;
    var blue = sw.classList.contains('blue');
    if (!knob || !knob.hasAttribute('data-glass')) return;
    if (on) {
      knob.style.setProperty('--lg-tint', blue ? '#0a84ff' : '#22c55e');
      knob.setAttribute('data-tint', '0.55');
    } else {
      knob.style.removeProperty('--lg-tint');
      knob.setAttribute('data-tint', '0');
    }
  }

  function tagKnob(el) {
    if (!el || el.hasAttribute('data-glass')) return;
    el.classList.add('lg', 'lg-clear', 'lg-knob');
    el.setAttribute('data-glass', 'knob');
    el.setAttribute('data-layer', '1');
    el.setAttribute('data-frost', '0.06');
    el.setAttribute('data-tint', '0');
    el.setAttribute('data-grow', '0.14');
  }

  function stripGlassEl(el) {
    if (!el) return;
    el.removeAttribute('data-glass');
    el.removeAttribute('data-glass-solid');
    el.removeAttribute('data-glass-live');
    el.removeAttribute('data-frost');
    el.removeAttribute('data-tint');
    el.removeAttribute('data-layer');
    el.removeAttribute('data-grow');
    el.removeAttribute('data-solid-color');
    el.classList.remove('lg', 'lg-regular', 'lg-tinted', 'lg-control', 'lg-bar', 'lg-clear', 'lg-knob');
    el.style.removeProperty('--lg-tint');
  }

  function syncChipGlass(chip) {
    if (!chip || !chip.hasAttribute('data-glass')) return;
    if (chip.classList.contains('on')) {
      chip.classList.add('lg-tinted');
      chip.style.setProperty('--lg-tint', '#0a84ff');
      chip.setAttribute('data-tint', '0.68');
    } else {
      chip.classList.remove('lg-tinted');
      chip.style.removeProperty('--lg-tint');
      chip.setAttribute('data-tint', '0');
    }
  }

  function resolvedBlue() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--lg-blue').trim();
    return v || '#0a84ff';
  }

  function syncBtnGlass(el) {
    if (!el || !el.classList.contains('btn') || el.closest('.dapp, .cc-ico, .dock-item')) return;
    el.classList.add('lg', 'lg-control');
    el.setAttribute('data-glass', 'button');
    if (el.classList.contains('primary')) {
      el.classList.add('lg-tinted');
      el.setAttribute('data-frost', '0.1');
      el.setAttribute('data-tint', '0.88');
      el.style.setProperty('--lg-tint', '#0a84ff');
      return;
    }
    if (el.classList.contains('danger')) {
      el.classList.add('lg-tinted');
      el.setAttribute('data-frost', '0.1');
      el.setAttribute('data-tint', '0.85');
      el.style.setProperty('--lg-tint', '#ff3b30');
      return;
    }
    if (el.classList.contains('tinted')) {
      el.classList.add('lg-tinted');
      el.setAttribute('data-frost', '0.14');
      el.setAttribute('data-tint', '0.55');
      el.style.setProperty('--lg-tint', resolvedBlue());
      return;
    }
    el.classList.remove('lg-tinted');
    el.classList.add('lg-regular');
    el.setAttribute('data-frost', '0.15');
    el.setAttribute('data-tint', '0');
    el.style.removeProperty('--lg-tint');
  }

  function clearSliderWebGL(root) {
    [].forEach.call(root.querySelectorAll('.slider, .lg-slider'), function (slider) {
      slider.removeAttribute('data-glass');
      slider.removeAttribute('data-frost');
      slider.removeAttribute('data-tint');
      [].forEach.call(slider.querySelectorAll('.rail, .fill, .thumb'), function (el) {
        el.removeAttribute('data-glass');
        el.removeAttribute('data-glass-solid');
        el.removeAttribute('data-frost');
        el.removeAttribute('data-tint');
        el.removeAttribute('data-layer');
        el.classList.remove('lg', 'lg-regular', 'lg-tinted', 'lg-control', 'lg-clear', 'lg-knob');
      });
    });
  }

  function sliderSolidColors(slider) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var rail = dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.12)';
    if (slider.classList.contains('blue')) rail = 'rgba(120,120,128,0.28)';
    return { rail: rail, fill: '#0a84ff' };
  }

  function tagSliders(root) {
    if (!document.documentElement.classList.contains('lg-on')) return;
    if (window.LiquidGlass && LiquidGlass.syncSliders) LiquidGlass.syncSliders(root);
    [].forEach.call(root.querySelectorAll('.slider, .lg-slider'), function (slider) {
      slider.removeAttribute('data-glass');
      var rail = slider.querySelector('.rail');
      var fill = slider.querySelector('.fill');
      var thumb = slider.querySelector('.thumb');
      var colors = sliderSolidColors(slider);
      var rainbow = slider.classList.contains('rainbow');
      if (rail && !rainbow) {
        rail.setAttribute('data-glass-solid', '');
        rail.setAttribute('data-solid-color', colors.rail);
        rail.setAttribute('data-layer', '1');
      } else if (rail) {
        rail.removeAttribute('data-glass-solid');
        rail.removeAttribute('data-solid-color');
        rail.removeAttribute('data-layer');
      }
      if (fill && !rainbow) {
        fill.setAttribute('data-glass-solid', '');
        fill.setAttribute('data-solid-color', colors.fill);
        fill.setAttribute('data-layer', '1');
      } else if (fill) {
        fill.removeAttribute('data-glass-solid');
        fill.removeAttribute('data-solid-color');
        fill.removeAttribute('data-layer');
      }
      if (thumb) {
        thumb.classList.add('lg-knob');
        thumb.classList.remove('lg', 'lg-clear', 'lg-regular', 'lg-tinted');
        thumb.removeAttribute('data-layer');
        thumb.removeAttribute('data-grow');
        if (rainbow) {
          thumb.classList.add('thumb-rainbow');
          thumb.removeAttribute('data-glass');
          thumb.removeAttribute('data-frost');
          thumb.removeAttribute('data-tint');
          thumb.removeAttribute('data-glass-live');
        } else {
          thumb.classList.remove('thumb-rainbow');
          thumb.classList.add('lg', 'lg-clear');
          thumb.setAttribute('data-glass', 'knob');
          thumb.setAttribute('data-layer', '1');
          thumb.setAttribute('data-frost', '0.06');
          thumb.setAttribute('data-tint', '0');
          thumb.setAttribute('data-grow', '0.14');
        }
      }
    });
  }

  function tagOverlays(root) {
    [].forEach.call(root.querySelectorAll('.dd .menu.glass, .menu.glass, .menu-panel.glass, .suggest.glass, .cmdk.glass'), function (el) {
      el.classList.add('lg', 'lg-regular', 'lg-overlay');
      el.setAttribute('data-lg-skip', '');
      el.removeAttribute('data-glass');
      el.removeAttribute('data-frost');
      el.removeAttribute('data-tint');
      el.removeAttribute('data-glass-live');
    });
  }

  function stripControlGlass(root) {
    var sel = '.sw, .sw .knob, .seg, .chip, .tile, .tile .face, .fab, .cc-play, .theme-toggle, .searchbar, .field, .ta, .selectbox select, .btn, .stepper, .stepper button, .progress .bar, .progress .fill, .ring, .check .box';
    [].forEach.call(root.querySelectorAll(sel), stripGlassEl);
    [].forEach.call(root.querySelectorAll('.sw, .seg label, .tile .face, .stepper button, .chip, .check .box'), function (el) {
      el.classList.remove('lg-control');
    });
  }

  function frostFor(preset, value) {
    var p = lgProfile();
    if (p === 'app') return Math.min(value * 0.72, 0.85);
    if (p === 'studio') return Math.min(value * 0.88, 0.92);
    return value;
  }

  function tagSwitches(root) {
    [].forEach.call(root.querySelectorAll('.sw'), function (sw) {
      sw.classList.add('lg-control');
      var knob = sw.querySelector('.knob');
      /* 开关旋钮不交给 WebGL 引擎：引擎画布在 DOM 之下（z-index 0），
         checked 的不透明轨道会把引擎画的旋钮完全挡住，表现为「绿胶囊没有旋钮」。
         保留原生白色胶囊旋钮，开 / 关两种状态都可见。 */
      if (knob) stripGlassEl(knob);
    });
    [].forEach.call(root.querySelectorAll('.sw'), syncSwitchGlass);
  }

  function tagProgressRings(root) {
    if (!controlsWebGL()) return;
    [].forEach.call(root.querySelectorAll('.progress .bar'), function (bar) {
      tag(bar, 'bar', 'lg-regular lg-bar', frostFor('bar', 0.28), 0);
    });
    [].forEach.call(root.querySelectorAll('.progress .fill.solid, .progress .fill.ok, .progress .fill.warn'), function (fill) {
      var color = '#0a84ff';
      if (fill.classList.contains('ok')) color = '#34c759';
      if (fill.classList.contains('warn')) color = '#ff9f0a';
      fill.setAttribute('data-glass-solid', '');
      fill.setAttribute('data-solid-color', color);
      fill.setAttribute('data-layer', '1');
    });
    [].forEach.call(root.querySelectorAll('.ring'), function (ring) {
      tag(ring, 'button', 'lg-regular lg-control', frostFor('button', 0.18), 0.04);
    });
  }

  function tagSteppers(root) {
    [].forEach.call(root.querySelectorAll('.stepper'), function (step) {
      step.classList.add('lg-control');
      if (controlsWebGL()) {
        tag(step, 'bar', 'lg-regular lg-bar', frostFor('bar', 0.26), 0);
      }
      [].forEach.call(step.querySelectorAll('button'), function (btn) {
        btn.classList.add('lg-control');
        if (controlsWebGL()) tag(btn, 'button', 'lg-clear lg-control', frostFor('button', 0.08), 0);
      });
    });
  }

  function tagChecks(root) {
    [].forEach.call(root.querySelectorAll('.check .box'), function (box) {
      box.classList.add('lg-control');
      if (controlsWebGL()) tag(box, 'button', 'lg-regular lg-control', frostFor('button', 0.12), 0);
    });
  }

  /* 面板内控件：壳 CSS + 局部 WebGL（旋钮 / 滑块 thumb / 进度 solid） */
  function tagControls(root) {
    var ctrls = [
      ['.seg', 'button', 'lg-regular lg-control', 0.18, 0],
      ['.chip', 'button', 'lg-regular lg-control', 0.14, 0],
      ['.tile', 'button', 'lg-regular lg-control', 0.1, 0],
      ['.fab', 'button', 'lg-regular lg-control', 0.12, 0],
      ['.cc-play', 'button', 'lg-regular lg-control', 0.08, 0],
      ['.theme-toggle', 'button', 'lg-regular lg-control', 0.1, 0],
      ['.searchbar', 'bar', 'lg-regular lg-bar', 0.35, 0],
      ['.field', 'button', 'lg-regular lg-control', 0.22, 0],
      ['.ta', 'button', 'lg-regular lg-control', 0.25, 0],
      ['.selectbox select', 'button', 'lg-regular lg-control', 0.2, 0]
    ];
    ctrls.forEach(function (r) {
      [].forEach.call(root.querySelectorAll(r[0]), function (el) {
        tag(el, r[1], r[2], frostFor(r[1], r[3]), r[4]);
      });
    });
    [].forEach.call(root.querySelectorAll('.tile .face'), function (face) {
      face.classList.add('lg-control');
    });
    tagSwitches(root);
    tagSteppers(root);
    tagProgressRings(root);
    tagChecks(root);
    [].forEach.call(root.querySelectorAll('.btn'), syncBtnGlass);
    [].forEach.call(root.querySelectorAll('.chip'), syncChipGlass);
  }

  function bindSemanticGlass() {
    if (bindSemanticGlass._on) return;
    bindSemanticGlass._on = true;
    document.addEventListener('change', function (e) {
      if (e.target && e.target.closest) syncSwitchGlass(e.target.closest('.sw'));
    });
    document.addEventListener('click', function (e) {
      var chip = e.target && e.target.closest ? e.target.closest('.chip') : null;
      if (chip) requestAnimationFrame(function () { syncChipGlass(chip); });
    });
  }

  /* 全站 .glass / 顶栏 / 控制中心 自动挂 data-glass（无需手抄） */
  function autoGlass(root) {
    var app = lgProfile() === 'app';
    var rules = [
      ['.topbar-web', 'bar', 'lg-regular lg-bar', 0.45, 0],
      ['.navbar.glass', 'bar', 'lg-regular lg-bar', 0.45, 0],
      ['.cc-card', 'card', 'lg-regular lg-surface', 1, 0.2],
      ['.hero-dock', 'sheet', 'lg-regular lg-sheet', 1, 0.28],
      ['.sidebar.glass', 'sheet', 'lg-regular lg-sheet', 1, 0.28],
      ['.tabbar.glass', 'sheet', 'lg-regular lg-sheet', 1, 0.25],
      ['.tablecard.glass, .tpl-card.glass', 'card', 'lg-regular lg-surface', 1, 0.2]
    ];
    if (!app) {
      rules.push(
        ['.metric.glass, .stat.glass', 'card', 'lg-regular lg-surface', 0.9, 0.18],
        ['.control-center .glass, .hero-cc .glass', 'card', 'lg-regular lg-surface', 1, 0.2]
      );
    }
    rules.forEach(function (r) {
      [].forEach.call(root.querySelectorAll(r[0]), function (el) {
        tag(el, r[1], r[2], frostFor(r[1], r[3]), r[4]);
      });
    });
    [].forEach.call(root.querySelectorAll('.glass'), function (el) {
      if (el.hasAttribute('data-glass') || el.hasAttribute('data-lg-skip')) return;
      if (el.closest('.dapp, .cc-ico, dialog, .toast, .dd')) return;
      if (el.matches('.menu, .suggest')) return;
      if (app && el.matches('.glass.clear, .glass.thin, .chip, .banner.glass, .metric, .stat')) return;
      if (el.matches('.glass.thin')) {
        tag(el, 'button', 'lg-clear lg-control', 0.1, 0);
        return;
      }
      tag(el, 'card', 'lg-regular lg-surface', frostFor('card', 1), 0.2);
    });
    tagOverlays(root);
    tagSliders(root);
    tagControls(root);
    if (!controlsWebGL()) {
      [].forEach.call(root.querySelectorAll('.sw .knob'), stripGlassEl);
    }
  }

  function getEngineClass() {
    var m = window.LiquidGlassEngine;
    if (!m) return null;
    return m.LiquidGlass || m.default;
  }

  function wallpaperCanvas() {
    if (window.LiquidGlass && LiquidGlass.getWallpaperCanvas) {
      return LiquidGlass.getWallpaperCanvas();
    }
    return document.querySelector('canvas[data-glass-backdrop]');
  }

  var engineInst = null;

  function rescan() {
    if (!engineInst) return;
    autoGlass(document.body);
    engineInst.scan(document.body);
  }

  function boot() {
    if (!engineEnabled()) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-transparency: reduce)').matches) return;

    var LiquidGlass = getEngineClass();
    if (!LiquidGlass) {
      console.warn('Lumi Glass: 缺少 glass-liquid-engine.js');
      return;
    }

    var style = document.createElement('style');
    style.setAttribute('data-lg-provider', '');
    style.textContent = LG_CSS;
    document.head.appendChild(style);
    injectFilters();

    var cv = document.createElement('canvas');
    cv.className = 'lg-engine-canvas';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);

    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var prof = lgProfile();
    document.documentElement.classList.add('lg-profile-' + prof);
    engineInst = new LiquidGlass(cv, lgEngineOpts(dark, reduceMotion));
    if (engineInst.failed) return;

    document.documentElement.classList.add('lg-on');

    function bindSource() {
      var wp = wallpaperCanvas();
      if (wp) engineInst.setSource(wp, { live: true });
    }

    autoGlass(document.body);
    bindSemanticGlass();
    bindSource();
    rescan();

    var mo = new MutationObserver(function () {
      if (mo._q) return;
      mo._q = true;
      requestAnimationFrame(function () {
        mo._q = false;
        bindSource();
        rescan();
      });
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-glass', 'data-glass-solid', 'data-theme']
    });

    var themeObs = new MutationObserver(function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      engineInst.set({ mode: isDark ? 'dark' : 'light' });
      bindSource();
      rescan();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('load', function () {
      bindSource();
      rescan();
    });

    window.LiquidGlassRuntime = {
      engine: engineInst,
      profile: lgProfile,
      studioDefaults: LG_PROFILE_STUDIO,
      refresh: function () { bindSource(); rescan(); },
      autoGlass: function () { autoGlass(document.body); rescan(); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
