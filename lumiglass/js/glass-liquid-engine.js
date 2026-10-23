var LiquidGlassEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    LiquidGlass: () => LiquidGlass,
    default: () => engine_default
  });

  // budget.ts
  function selectShapes(cands, max) {
    const byId = new Map(cands.map((c) => [c.id, c]));
    const depth = (c) => {
      let d = 0;
      for (let p = c.parent; p !== null && byId.has(p); p = byId.get(p).parent) d++;
      return d;
    };
    const enriched = cands.map((c) => ({ c, d: depth(c) })).filter((x) => x.d <= 1);
    const out = /* @__PURE__ */ new Map();
    const reserveChild = Math.min(14, Math.floor(max * 0.45));
    const cap0 = Math.max(6, max - reserveChild);
    const d0 = enriched.filter((x) => x.d === 0).sort((a, b) => (b.c.knob || 0) - (a.c.knob || 0) || b.c.area - a.c.area);
    for (const { c, d } of d0) {
      if (out.size >= cap0) break;
      out.set(c.id, d);
    }
    const d1 = enriched.filter((x) => x.d === 1 && out.has(x.c.parent)).sort((a, b) => (b.c.knob || 0) - (a.c.knob || 0) || b.c.area - a.c.area);
    for (const { c, d } of d1) {
      if (out.size >= max) break;
      out.set(c.id, d);
    }
    for (const { c, d } of d0) {
      if (out.size >= max) break;
      if (out.has(c.id)) continue;
      out.set(c.id, d);
    }
    return out;
  }

  // occlusion.ts
  var MIN_ALPHA = 0.05;
  function alpha(color) {
    if (!color || color === "transparent") return 0;
    const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)$/);
    if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
    if (rgba) return parseFloat(rgba[1]);
    return 1;
  }
  function paintsOverBackdrop(s) {
    return s.backdropFilter !== "" && s.backdropFilter !== "none" || s.backgroundImage !== "" && s.backgroundImage !== "none" || alpha(s.backgroundColor) > MIN_ALPHA;
  }
  function effectiveOpacity(el) {
    let o = 1;
    for (let p = el; p && p !== document.body && o > 0; p = p.parentElement) {
      const v = parseFloat(getComputedStyle(p).opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return o;
  }

  // engine.ts
  var MAXG = 32;
  var MAXS = 16;
  var PRESETS = {
    button: { grow: 0.14, squash: 1, frost: 0.15, tint: 0, merge: 0, layer: 0 },
    bar: { grow: 0.03, squash: 0.4, frost: 0.45, tint: 0, merge: 0, layer: 0 },
    card: { grow: 0, squash: 0, frost: 1, tint: 0.2, merge: 0, layer: 0 },
    sheet: { grow: 0, squash: 0, frost: 1, tint: 0.28, merge: 1, layer: 0 },
    knob: { grow: 0.22, squash: 0.6, frost: 0.06, tint: 0, tintPressed: 0.06, tintColor: [1, 1, 1], merge: 0, layer: 1 },
    blob: { grow: 0.1, squash: 1.6, frost: 0.1, tint: 0, merge: 1, layer: 0 }
  };
  var VS = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;vUv.y=1.-vUv.y;gl_Position=vec4(p,0.,1.);}";
  var FS = `precision highp float;
#define MAXG ${MAXG}
#define MAXS ${MAXS}
varying vec2 vUv;
uniform sampler2D uTex;uniform sampler2D uBlur;uniform vec2 uRes;uniform vec4 uFit;
uniform vec4 uG[MAXG];uniform vec4 uGP[MAXG];uniform vec4 uGT[MAXG];uniform int uGN;
uniform vec4 uS[MAXS];uniform vec4 uSC[MAXS];uniform vec4 uSP[MAXS];uniform int uSN;
uniform float uBezel;uniform float uStrength;uniform float uDisp;uniform float uMergeK;uniform float uDark;uniform float uRim;uniform vec2 uPtr;
float sdRR(vec2 p,vec2 b,float r){r=min(r,min(b.x,b.y));vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float lay(vec4 q){return q.y>1.5?1.:0.;}
float field(vec2 p,float L){
 float dm=1e4;float dh=1e4;
 for(int i=0;i<MAXG;i++){if(i>=uGN)break;
if(uGT[i].w<.002||abs(lay(uGP[i])-L)>.5)continue;
float d=sdRR(p-uG[i].xy,uG[i].zw,uGP[i].x);
if(uGP[i].y>.5&&uGP[i].y<1.5)dm=smin(dm,d,uMergeK);else dh=min(dh,d);}
 return min(dm,dh);}
void nearest(vec2 p,float L,out vec4 P,out vec4 T,out float hm){
 float best=1e4;P=vec4(0.);T=vec4(0.);hm=1.;
 for(int i=0;i<MAXG;i++){if(i>=uGN)break;
if(uGT[i].w<.002||abs(lay(uGP[i])-L)>.5)continue;
float d=sdRR(p-uG[i].xy,uG[i].zw,uGP[i].x);
if(d<best){best=d;P=uGP[i];T=uGT[i];hm=min(uG[i].z,uG[i].w);}}}
vec3 bg(vec2 px,float fr){vec2 u=clamp(px/uRes,0.,1.);vec3 c=texture2D(uTex,u*uFit.xy+uFit.zw).rgb;
 if(fr>.001)c=mix(c,texture2D(uBlur,u).rgb,fr);return c;}
vec3 solids(vec2 px,vec3 c,float L){
 for(int i=0;i<MAXS;i++){if(i>=uSN)break;if(abs(uSP[i].y-L)>.5)continue;
float d=sdRR(px-uS[i].xy,uS[i].zw,uSP[i].x);c=mix(c,uSC[i].rgb,clamp(.5-d,0.,1.)*uSC[i].a);}
 return c;}
vec3 scene(vec2 px,float fr){return solids(px,bg(px,fr),0.);}
vec3 finish(vec3 col,vec2 px,vec2 g,float x,float inside,vec4 P,vec4 T){
 float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,1.2);
 col=uDark>.5?col*.78+.015:col*1.02+.03;
 col=mix(col,T.rgb,P.z);
 vec2 Ld=normalize(uPtr-px+vec2(.001));float fc=dot(g,Ld);float rim=pow(1.-x,6.);
 float hi=rim*(max(fc,0.)*.85+max(-fc,0.)*.3)+(1.-smoothstep(0.,1.5,inside))*.22;
 return col+vec3(hi*(uDark>.5?.6:1.)*uRim);}
float shadow(vec2 px,float L){return 1.-smoothstep(-16.,34.,field(px-vec2(0.,10.),L));}
vec3 shade0(vec2 px){
 float d=field(px,0.);vec3 base=scene(px,0.);
 if(d<60.)base*=1.-shadow(px,0.)*(uDark>.5?.32:.16)*smoothstep(0.,2.,d);
 if(d>=.5)return base;
 vec4 P;vec4 T;float hm;nearest(px,0.,P,T,hm);
 float bez=min(uBezel,hm*.85);float inside=max(-d,0.);float x=clamp(inside/bez,0.,1.);
 vec2 e=vec2(.75,0.);
 vec2 g=vec2(field(px+e.xy,0.)-field(px-e.xy,0.),field(px+e.yx,0.)-field(px-e.yx,0.));g/=max(length(g),1e-4);
 vec2 off=-g*uStrength*min(1.,hm/40.)*pow(1.-x,2.2);
 float fr=P.w;vec3 col;
 col.r=scene(px+off*(1.+uDisp),fr).r;col.g=scene(px+off,fr).g;col.b=scene(px+off*(1.-uDisp),fr).b;
 col=finish(col,px,g,x,inside,P,T);
 return mix(base,col,clamp(.5-d,0.,1.)*T.w);}
vec3 top0(vec2 px){return solids(px,shade0(px),1.);}
void main(){
 vec2 px=vUv*uRes;float d=field(px,1.);vec3 base=top0(px);
 if(d<60.)base*=1.-shadow(px,1.)*(uDark>.5?.3:.14)*smoothstep(0.,2.,d);
 if(d>=.5){gl_FragColor=vec4(base,1.);return;}
 vec4 P;vec4 T;float hm;nearest(px,1.,P,T,hm);
 float bez=min(uBezel,hm*.85);float inside=max(-d,0.);float x=clamp(inside/bez,0.,1.);
 vec2 e=vec2(.75,0.);
 vec2 g=vec2(field(px+e.xy,1.)-field(px-e.xy,1.),field(px+e.yx,1.)-field(px-e.yx,1.));g/=max(length(g),1e-4);
 vec2 off=-g*uStrength*min(1.,hm/40.)*pow(1.-x,2.2);
 vec3 col;col.r=top0(px+off*(1.+uDisp)).r;col.g=top0(px+off).g;col.b=top0(px+off*(1.-uDisp)).b;
 col=finish(col,px,g,x,inside,P,T);
 gl_FragColor=vec4(mix(base,col,clamp(.5-d,0.,1.)*T.w),1.);}`;
  var colorCache = /* @__PURE__ */ new Map();
  var colorCtx = null;
  function parseColor(s) {
    const hit = colorCache.get(s);
    if (hit) return hit;
    let out = [0, 0, 0, 0];
    if (s && s !== "transparent") {
      colorCtx != null ? colorCtx : colorCtx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
      if (colorCtx) {
        colorCtx.clearRect(0, 0, 1, 1);
        colorCtx.fillStyle = s;
        colorCtx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = colorCtx.getImageData(0, 0, 1, 1).data;
        out = a ? [r / 255, g / 255, b / 255, a / 255] : [0, 0, 0, 0];
      }
    }
    if (colorCache.size > 256) colorCache.clear();
    colorCache.set(s, out);
    return out;
  }
  var len = (v, ref) => !v ? 0 : v.trim().endsWith("%") ? parseFloat(v) / 100 * ref : parseFloat(v) || 0;
  /* 最近的「可滚动祖先」：内部滚动区（侧栏/表格/手机屏幕）滚动时 window.scrollY 不变，
     靠它把滚动量也纳入缓存平移，否则这类容器只能逐帧重读布局 */
  var scrollParentOf = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      const scrollable = /^(auto|scroll)$/.test(s.overflowY) || /^(auto|scroll)$/.test(s.overflowX);
      if (scrollable && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return p;
    }
    return null;
  };
  var LiquidGlass = class {
    constructor(canvas, opts = {}) {
      __publicField(this, "canvas");
      __publicField(this, "failed", false);
      __publicField(this, "o");
      __publicField(this, "gl");
      __publicField(this, "program");
      __publicField(this, "buffer");
      __publicField(this, "u", {});
      __publicField(this, "tex");
      __publicField(this, "blurTex");
      __publicField(this, "blurC");
      __publicField(this, "items", []);
      __publicField(this, "solids", []);
      __publicField(this, "ptr", null);
      __publicField(this, "tilt", null);
      __publicField(this, "lastPtr", 0);
      __publicField(this, "light", { x: -400, y: -600 });
      __publicField(this, "fit", [1, 1, 0, 0]);
      __publicField(this, "size", { w: 0, h: 0 });
      __publicField(this, "src", null);
      __publicField(this, "live", false);
      __publicField(this, "dirty", false);
      __publicField(this, "ready", false);
      __publicField(this, "raf", 0);
      __publicField(this, "frames", 0);
      __publicField(this, "nextId", 1);
      __publicField(this, "bG", new Float32Array(MAXG * 4));
      __publicField(this, "bGP", new Float32Array(MAXG * 4));
      __publicField(this, "bGT", new Float32Array(MAXG * 4));
      __publicField(this, "bS", new Float32Array(MAXS * 4));
      __publicField(this, "bSC", new Float32Array(MAXS * 4));
      __publicField(this, "bSP", new Float32Array(MAXS * 4));
      __publicField(this, "_onPtr", (e) => {
        this.ptr = { x: e.clientX, y: e.clientY };
        this.lastPtr = performance.now();
      });
      __publicField(this, "_onUp", () => this.items.forEach((i) => {
        if (!i.held) i.pressed = false;
      }));
      __publicField(this, "_onTilt", (e) => {
        if (e.gamma != null && e.beta != null && performance.now() - this.lastPtr > 3e3) {
          this.tilt = { g: e.gamma, b: e.beta };
          this.ptr = null;
        }
      });
      __publicField(this, "_loop", () => {
        /* 页面不可见时不绘制（纯省电，不影响观感） */
        if (document.hidden) { this.raf = requestAnimationFrame(this._loop); return; }
        this._frame();
        this.raf = requestAnimationFrame(this._loop);
      });
      this.canvas = canvas;
      this.o = { refraction: 28, dispersion: 0.1, frost: 14, bezel: 26, mergeK: 40, rim: 0.75, mode: "light", liquid: true, ...opts };
      const gl = canvas.getContext("webgl", { antialias: false });
      if (!gl || gl.isContextLost()) {
        this.failed = true;
        console.warn("LiquidGlass: WebGL unavailable");
        return;
      }
      this.gl = gl;
      const sh = (t, s) => {
        const o = gl.createShader(t);
        gl.shaderSource(o, s);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o));
        return o;
      };
      const pr = gl.createProgram();
      const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
      gl.attachShader(pr, vs);
      gl.attachShader(pr, fs);
      gl.linkProgram(pr);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
        console.error("LiquidGlass:", gl.getProgramInfoLog(pr));
        gl.deleteProgram(pr);
        this.failed = true;
        return;
      }
      gl.useProgram(pr);
      this.program = pr;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      this.buffer = b;
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ["uTex", "uBlur", "uRes", "uFit", "uGN", "uSN", "uBezel", "uStrength", "uDisp", "uMergeK", "uDark", "uRim", "uPtr"].forEach((n) => this.u[n] = gl.getUniformLocation(pr, n));
      ["uG", "uGP", "uGT", "uS", "uSC", "uSP"].forEach((n) => this.u[n] = gl.getUniformLocation(pr, n + "[0]"));
      this.tex = this._tex(0);
      this.blurTex = this._tex(1);
      gl.uniform1i(this.u.uTex, 0);
      gl.uniform1i(this.u.uBlur, 1);
      this.blurC = document.createElement("canvas");
      window.addEventListener("pointermove", this._onPtr);
      window.addEventListener("pointerup", this._onUp);
      window.addEventListener("pointercancel", this._onUp);
      window.addEventListener("deviceorientation", this._onTilt);
      this.raf = requestAnimationFrame(this._loop);
    }
    _tex(unit) {
      const gl = this.gl, t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    set(o) {
      const f = this.o.frost;
      Object.assign(this.o, o);
      if (o.frost !== void 0 && o.frost !== f) this.dirty = true;
    }
    setSource(src, { live } = {}) {
      this.src = src;
      this.live = live != null ? live : typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement;
      this.dirty = true;
    }
    invalidate() {
      this.dirty = true;
    }
    scan(rootEl) {
      const keep = (el, attr) => el.isConnected && el.hasAttribute(attr);
      this.items.filter((i) => !keep(i.el, "data-glass")).forEach((i) => this._detach(i));
      this.items = this.items.filter((i) => keep(i.el, "data-glass"));
      this.solids.filter((s) => s.live && !keep(s.el, "data-glass-solid")).forEach((s) => {
        s.el.style.opacity = s.opacity;
      });
      this.solids = this.solids.filter((s) => keep(s.el, "data-glass-solid"));
      rootEl.querySelectorAll("[data-glass]").forEach((el) => this.add(el));
      rootEl.querySelectorAll("[data-glass-solid]").forEach((el) => this.addSolid(el));
      this.refreshOcclusion();
    }
    /** Links each item to its closest glass ancestor (nested glass is drawn on the top layer) and
        blocks items under any other ancestor that paints: the canvas is behind it. Backgrounds
        change with state and theme, so the frame loop calls this periodically too. */
    refreshOcclusion() {
      const byEl = new Map(this.items.map((i) => [i.el, i]));
      const link = (x) => {
        var _a;
        x.parent = null;
        x.blocked = false;
        for (let p = x.el.parentElement; p && p !== document.body; p = p.parentElement) {
          const g = byEl.get(p);
          if (g) {
            (_a = x.parent) != null ? _a : x.parent = g;
            continue;
          }
          if (paintsOverBackdrop(getComputedStyle(p))) {
            x.blocked = true;
            break;
          }
        }
      };
      this.items.forEach(link);
      this.solids.forEach(link);
      this.solids.forEach((s) => {
        if (s.el.closest(".slider, .lg-slider")) {
          s.blocked = false;
          s.parent = null;
        }
      });
      this.items.forEach((it) => {
        const el = it.el;
        if (el.dataset.glass === "knob" && el.closest(".slider, .lg-slider, .sw")) {
          it.blocked = false;
          it.parent = null;
        }
      });
    }
    add(el, opts = {}) {
      const existing = this.items.find((i) => i.el === el);
      if (existing) return existing;
      const d = el.dataset, pre = PRESETS[opts.preset || d.glass] || PRESETS.bar;
      const ov = {};
      ["tint", "frost", "layer", "merge", "grow", "squash"].forEach((k) => {
        if (d[k] !== void 0) ov[k] = parseFloat(d[k]);
      });
      const it = {
        ...pre,
        ...ov,
        ...opts,
        el,
        sx: 1,
        sy: 1,
        vx: 0,
        vy: 0,
        v: { x: 0, y: 0 },
        last: null,
        pressed: false,
        held: false,
        scs: "",
        t: 0,
        id: this.nextId++,
        parent: null,
        blocked: false,
        live: false,
        down: () => {
          it.pressed = true;
        }
      };
      it.t = it.tint;
      el.addEventListener("pointerdown", it.down);
      this.items.push(it);
      return it;
    }
    addSolid(el) {
      if (this.solids.some((s) => s.el === el)) return;
      this.solids.push({ el, layer: parseFloat(el.dataset.layer || "0"), opacity: el.style.opacity, live: false, parent: null, blocked: false });
    }
    press(el, on) {
      const it = this.items.find((i) => i.el === el);
      if (it) {
        it.pressed = on;
        it.held = on;
      }
    }
    remove(el) {
      const it = this.items.find((i) => i.el === el);
      if (it) this._detach(it);
      const s = this.solids.find((s2) => s2.el === el);
      if (s == null ? void 0 : s.live) el.style.opacity = s.opacity;
      this.items = this.items.filter((i) => i.el !== el);
      this.solids = this.solids.filter((s2) => s2.el !== el);
    }
    /** Stops rendering and releases GL resources. The canvas stays usable, so a remount
        (React strict mode, HMR) can create a new engine on the same element. */
    destroy() {
      cancelAnimationFrame(this.raf);
      document.documentElement.classList.remove("lg-ready");
      window.removeEventListener("pointermove", this._onPtr);
      window.removeEventListener("pointerup", this._onUp);
      window.removeEventListener("pointercancel", this._onUp);
      window.removeEventListener("deviceorientation", this._onTilt);
      this.items.forEach((i) => this._detach(i));
      this.solids.forEach((s) => {
        if (s.live) s.el.style.opacity = s.opacity;
      });
      this.items = [];
      this.solids = [];
      const gl = this.gl;
      if (gl && !this.failed) {
        gl.deleteTexture(this.tex);
        gl.deleteTexture(this.blurTex);
        gl.deleteBuffer(this.buffer);
        gl.deleteProgram(this.program);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    _detach(it) {
      it.el.removeEventListener("pointerdown", it.down);
      this._setLive(it, false);
    }
    /* data-glass-live marks elements the shader draws this frame; only those drop their CSS glass. */
    _setLive(it, live) {
      if (it.live === live) return;
      it.live = live;
      if (live) it.el.setAttribute("data-glass-live", "");
      else {
        it.el.removeAttribute("data-glass-live");
        it.el.style.scale = "";
        it.scs = "";
        it.sx = it.sy = 1;
        it.vx = it.vy = 0;
      }
    }
    _upload(W, H) {
      const gl = this.gl, s = this.src;
      if (s instanceof HTMLVideoElement && s.readyState < 2) return;
      const sw = s.videoWidth || s.naturalWidth || s.width;
      const sh = s.videoHeight || s.naturalHeight || s.height;
      if (!sw || !sh) return;
      const A = W / H, B = sw / sh;
      let fx = 1, fy = 1, ox = 0, oy = 0;
      if (B > A) {
        fx = A / B;
        ox = (1 - fx) / 2;
      } else {
        fy = B / A;
        oy = (1 - fy) / 2;
      }
      this.fit = [fx, fy, ox, oy];
      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
        const bc = this.blurC, bw = Math.max(2, Math.round(W / 4)), bh = Math.max(2, Math.round(H / 4));
        if (bc.width !== bw) bc.width = bw;
        if (bc.height !== bh) bc.height = bh;
        const x = bc.getContext("2d"), br = Math.max(this.o.frost / 4, 0.01), pad = br * 3;
        x.filter = `blur(${br}px)`;
        x.drawImage(s, ox * sw, oy * sh, fx * sw, fy * sh, -pad, -pad, bw + 2 * pad, bh + 2 * pad);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);
        this.ready = true;
        document.documentElement.classList.add("lg-ready");
      } catch (e) {
        console.warn("LiquidGlass: source not usable (CORS?)", e);
      }
      this.dirty = false;
    }
    _frame() {
      var _a, _b;
      const gl = this.gl, cv = this.canvas;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      /* 滚动帧零布局读取：整页滚动时元素视口位置 = 文档坐标缓存 − scroll，
         纯算术平移完全精确；非滚动帧（指针/动画）才读真实 DOM 并回写缓存。
         内部滚动容器场景 scrollX/Y 不变 → 自动退回逐帧读取，行为同旧版 */
      const sx = window.scrollX, sy = window.scrollY;
      const scrolling = sx !== this._sx || sy !== this._sy;
      this._sx = sx; this._sy = sy;
      const cr = scrolling && this._cr ? this._cr : (this._cr = cv.getBoundingClientRect()), k = W / cr.width;
      /* 大片视口按 1× 渲染：这层本来就是模糊的折射/磨砂，放大后肉眼看不出，
         但 DPR1.5 意味着 2.25 倍像素 —— 视网膜屏上这是最大的单项开销 */
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5), bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw;
        cv.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      if (W !== this.size.w || H !== this.size.h) {
        this.size = { w: W, h: H };
        this.dirty = true;
      }
      /* 滚动期间冻结壁纸纹理：纹理喂的是 fixed 壁纸，不随页面/容器滚动移动，
         冻结不改变画面；省掉滚动中每帧的「全屏 2D blur + 全尺寸纹理上传」——这是滚动掉帧的主因。
         非滚动帧仍隔帧更新（壁纸缓慢漂移，30fps 更新肉眼无差） */
      let anyScroll = scrolling;
      if (!anyScroll) {
        for (const it of this.items) {
          if (it.sco && it.dl !== void 0 && (it.sco.scrollTop !== it.sTop || it.sco.scrollLeft !== it.sLeft)) { anyScroll = true; break; }
        }
      }
      if (this.src && (this.dirty || (!anyScroll && this.live && this.frames % 2 === 0))) this._upload(W, H);
      if (!this.ready) return;
      if (++this.frames % 30 === 0) this.refreshOcclusion();
      let tx = -W * 0.2, ty = -H * 0.6;
      if (this.ptr) {
        tx = (this.ptr.x - cr.left) * k;
        ty = (this.ptr.y - cr.top) * k;
      } else if (this.tilt) {
        tx = W / 2 + this.tilt.g / 30 * W;
        ty = H / 2 + (this.tilt.b - 45) / 30 * H;
      }
      this.light.x += (tx - this.light.x) * 0.12;
      this.light.y += (ty - this.light.y) * 0.12;
      const dark = this.o.mode === "dark", liquid = this.o.liquid;
      const vis = /* @__PURE__ */ new Map();
      const cands = [];
      for (const it of this.items) {
        const el = it.el;
        if (!el.isConnected || it.blocked) continue;
        let r;
        if (it.sco === void 0) it.sco = scrollParentOf(el);
        const sdY = it.sco ? it.sco.scrollTop - it.sTop : 0;
        const sdX = it.sco ? it.sco.scrollLeft - it.sLeft : 0;
        if (it.dl !== void 0 && (scrolling || sdY || sdX)) {
          r = { left: it.dl - sx - sdX, top: it.dt - sy - sdY, right: it.dl - sx - sdX + it.dw, bottom: it.dt - sy - sdY + it.dh, width: it.dw, height: it.dh };
        } else {
          r = el.getBoundingClientRect();
          it.dl = r.left + sx; it.dt = r.top + sy; it.dw = r.width; it.dh = r.height;
          if (it.sco) { it.sTop = it.sco.scrollTop; it.sLeft = it.sco.scrollLeft; }
          it.ow = el.offsetWidth || r.width;
          const cs0 = getComputedStyle(el);
          it.vis = cs0.visibility === "hidden";
          it.rad0 = len(cs0.borderTopLeftRadius, it.ow);
          it.tv = cs0.getPropertyValue("--lg-tint").trim();
          it.op = effectiveOpacity(el);
        }
        if (r.width < 1 || r.height < 1) continue;
        if (r.bottom < cr.top - 40 || r.top > cr.bottom + 40 || r.right < cr.left - 40 || r.left > cr.right + 40) continue;
        if (it.vis) continue;
        vis.set(it.id, { it, r });
        cands.push({ id: it.id, parent: (_b = (_a = it.parent) == null ? void 0 : _a.id) != null ? _b : null, area: r.width * r.height, knob: it.el.dataset.glass === "knob" ? 1 : 0 });
      }
      const chosen = selectShapes(cands, MAXG);
      for (const it of this.items) this._setLive(it, chosen.has(it.id));
      let n = 0;
      for (const [id, depth] of chosen) {
        const { it, r } = vis.get(id);
        const el = it.el;
        const op = it.op;
        const cx = (r.left + r.width / 2 - cr.left) * k, cy = (r.top + r.height / 2 - cr.top) * k;
        const hx = r.width / 2 * k / it.sx, hy = r.height / 2 * k / it.sy;
        if (it.last) {
          it.v.x = it.v.x * 0.6 + (cx - it.last.x) * 0.4;
          it.v.y = it.v.y * 0.6 + (cy - it.last.y) * 0.4;
        }
        it.last = { x: cx, y: cy };
        const g = it.pressed && liquid ? 1 + it.grow : 1, sq = liquid ? it.squash : 0;
        const ax = Math.abs(it.v.x), ay = Math.abs(it.v.y);
        const tX = g * (1 + Math.min(ax * 0.018 * sq, 0.35) - Math.min(ay * 9e-3 * sq, 0.18));
        const tY = g * (1 + Math.min(ay * 0.018 * sq, 0.35) - Math.min(ax * 9e-3 * sq, 0.18));
        if (liquid) {
          it.vx = (it.vx + (tX - it.sx) * 0.22) * 0.7;
          it.sx += it.vx;
          it.vy = (it.vy + (tY - it.sy) * 0.22) * 0.7;
          it.sy += it.vy;
        } else {
          it.sx = tX;
          it.sy = tY;
          it.vx = it.vy = 0;
        }
        const scs = Math.abs(it.sx - 1) < 2e-3 && Math.abs(it.sy - 1) < 2e-3 ? "" : `${it.sx.toFixed(4)} ${it.sy.toFixed(4)}`;
        if (scs !== it.scs) {
          el.style.scale = scs;
          it.scs = scs;
        }
        const Hx = hx * it.sx, Hy = hy * it.sy, ow = it.ow || r.width;
        const rad = Math.min(it.rad0 * (hx * 2 / ow) * Math.min(it.sx, it.sy), Hx, Hy);
        const ds = el.dataset;
        if (ds.tint !== void 0) it.tint = parseFloat(ds.tint);
        if (ds.grow !== void 0) it.grow = parseFloat(ds.grow);
        const tt = it.pressed && it.tintPressed !== void 0 ? it.tintPressed : it.tint;
        it.t += (tt - it.t) * 0.2;
        const tv = it.tv;
        const custom = tv && tv !== "transparent" ? parseColor(tv) : null;
        const tc = it.tintColor || (custom ? [custom[0], custom[1], custom[2]] : dark ? [0.07, 0.07, 0.09] : [1, 1, 1]);
        const layer = Math.max(depth, it.layer >= 1 ? 1 : 0);
        this.bG.set([cx, cy, Hx, Hy], n * 4);
        this.bGP.set([rad, layer >= 1 ? 2 : it.merge ? 1 : 0, it.t, it.frost], n * 4);
        this.bGT.set([tc[0], tc[1], tc[2], op], n * 4);
        n++;
      }
      let m = 0;
      for (const s of this.solids) {
        const el = s.el;
        let r;
        if (scrolling && s.dl !== void 0) {
          r = { left: s.dl - sx, top: s.dt - sy, width: s.dw, height: s.dh };
        } else if (el.isConnected) {
          r = el.getBoundingClientRect();
          s.dl = r.left + sx; s.dt = r.top + sy; s.dw = r.width; s.dh = r.height;
          s.ow = el.offsetWidth || r.width;
          const cs0 = getComputedStyle(el);
          s.solidSrc = el.dataset.solidColor || cs0.getPropertyValue("--lg-solid").trim() || cs0.backgroundColor;
          s.rad0 = len(cs0.borderTopLeftRadius, s.ow);
        } else {
          r = null;
        }
        const draw = m < MAXS && !s.blocked && (!s.parent || s.parent.live) && !!r && r.width >= 1 && r.height >= 1;
        if (draw !== s.live) {
          s.live = draw;
          el.style.opacity = draw ? "0" : s.opacity;
        }
        if (!draw) continue;
        const hx = r.width / 2 * k, hy = r.height / 2 * k;
        this.bS.set([(r.left + r.width / 2 - cr.left) * k, (r.top + r.height / 2 - cr.top) * k, hx, hy], m * 4);
        this.bSC.set(parseColor(s.solidSrc), m * 4);
        this.bSP.set([Math.min(s.rad0 * (hx * 2 / s.ow), hx, hy), s.layer, 0, 0], m * 4);
        m++;
      }
      const u = this.u, o = this.o;
      gl.uniform2f(u.uRes, W, H);
      gl.uniform4fv(u.uFit, this.fit);
      gl.uniform4fv(u.uG, this.bG);
      gl.uniform4fv(u.uGP, this.bGP);
      gl.uniform4fv(u.uGT, this.bGT);
      gl.uniform1i(u.uGN, n);
      gl.uniform4fv(u.uS, this.bS);
      gl.uniform4fv(u.uSC, this.bSC);
      gl.uniform4fv(u.uSP, this.bSP);
      gl.uniform1i(u.uSN, m);
      gl.uniform1f(u.uBezel, o.bezel);
      gl.uniform1f(u.uStrength, o.refraction);
      gl.uniform1f(u.uDisp, o.dispersion);
      gl.uniform1f(u.uMergeK, Math.max(o.mergeK, 1e-3));
      gl.uniform1f(u.uDark, dark ? 1 : 0);
      gl.uniform1f(u.uRim, o.rim != null ? o.rim : 0.75);
      gl.uniform2f(u.uPtr, this.light.x, this.light.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
  __publicField(LiquidGlass, "PRESETS", PRESETS);
  var engine_default = LiquidGlass;
  return __toCommonJS(engine_exports);
})();
