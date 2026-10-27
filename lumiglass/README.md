# Lumi Glass · lumiglass

iOS 液态玻璃（Liquid Glass）风格的纯 CSS 组件库。零依赖、无构建要求，Vue / React / 原生页面都能直接用。

## 特性

- **三层配方**：磨砂（backdrop-filter）+ 边缘折射（SVG feDisplacementMap）+ 镜面高光，还原 iOS 26 Liquid Glass 质感
- **130+ 类名**：按钮、表单、控件、弹层、导航、图表、模板积木，9 大分组
- **明暗双主题**：`data-theme="dark"` 一键切换，或跟随系统 `prefers-color-scheme`
- **双端密度**：`body.mobile` 触控密度 / `body.web` 桌面密度，同一套 Token
- **零依赖**：纯 CSS + 一个可选 JS（折射滤镜注入、指针光斑、主题切换、Toast）

## 安装

```bash
npm install lumiglass
```

## 快速开始

```js
// Vite / Vue CLI / CRA / Next.js 通用
import 'lumiglass/css/glass-core.css';
import 'lumiglass/css/glass-web.css';   // 或 glass-mobile.css
import 'lumiglass/js/glass.js';         // 可选
```

```html
<body class="web">
  <div class="glass" style="padding:20px;border-radius:20px">
    <h3>我的第一块玻璃</h3>
    <p>把它放在有内容的背景上，折射才会出现。</p>
  </div>
</body>
```

## 包内文件

| 文件 | 内容 |
|---|---|
| `css/glass-core.css` | 通用层（必引）：Token、玻璃基类、按钮、表单、控件、反馈 |
| `css/glass-web.css` | 网页端：浮动顶栏、应用框架、Bento、表格、定价 |
| `css/glass-mobile.css` | 手机端：手机壳、Tab Bar、聊天、播放器、钱包、天气 |
| `css/glass-templates.css` | 模板扩展：管理台图表、官网 Hero、商品卡（按需引） |
| `css/glass-lg.css` | `.lg` 材质层：与 WebGL 液态引擎配套（案例页/需要折射时引入） |
| `css/glass-stage.css` | 展示台样式：仅文档/案例页使用，业务页面不需要 |
| `js/glass.js` | 可选增强：折射滤镜、指针光斑、滚动加厚、主题切换、Toast |
| `js/glass-liquid-engine.js` | WebGL 折射引擎（与 `glass-lg.css` 配套） |
| `js/glass-webgl.js` | 全站引导 + autoGlass（引即启用，关闭：`data-lg-engine="off"`） |

> 本包与项目根目录 `glass/` 保持同一份源码、同版本发布；请勿单独修改其中一个目录。

## 更新日志

**1.2.0**

- 自研 WebGL 液态引擎全站替换：SDF 圆角矩形 + 平滑并集 + 解析梯度折射 + RGB 色散，第三方代码清零
- 新增指针驱动的边框光效：指针所在边框一段被点亮，父/子组件同时响应，光斑半径随元素尺寸缩放
- 修复玻璃外扩（`grow`）时整体偏移，表现为「内容不居中 / 外圈偏心」
- 修复滑块轨道与进度条丢失（纯色件回归 DOM 绘制）
- 修复磁贴外层多余光环，组件恢复单圈玻璃

**1.1.1** — 首个公开版本

## Vue / React 注意事项

- 类名直接写 `class` / `className`，无任何包装组件
- 路由切换后调一次 `LiquidGlass.refresh()`
- 主题：`LiquidGlass.setTheme('dark')` 或按钮加 `data-theme-toggle`
- Toast：`LiquidGlass.toast('已保存')`
- SSR：CSS 正常引；`glass.js` 只在客户端引入

完整文档（组件 API、尺寸速查、无障碍、性能预算）：见项目仓库 `docs.html`。

## License

MIT © 2026 Zhao Xinfei (赵鑫飞)

> Lumi Glass is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Apple Inc. "Liquid Glass" refers to a visual style inspired by Apple's design language; all code is original.
