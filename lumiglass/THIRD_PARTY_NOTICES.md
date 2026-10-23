# 第三方组件与许可声明 / Third-Party Notices

本仓库除原创代码外，包含一份来自第三方的编译产物。按 MIT 许可证「保留版权声明与许可声明」的要求，特此列明来源、修改与许可状态。

---

## 1. `glass-liquid-engine.js`

| 项 | 内容 |
| --- | --- |
| 文件位置 | `glass/glass-liquid-engine.js`、`lumiglass/js/glass-liquid-engine.js` |
| 上游项目 | [crenspire/glass-ui](https://github.com/crenspire/glass-ui) |
| 上游源码路径 | `lib/liquid-glass/`（`engine.ts`、`budget.ts`、`occlusion.ts`、`material.ts`、`backdrop-stack.ts`） |
| 形态 | 上游 TypeScript 源码经 esbuild 打包为浏览器可直接 `<script>` 引入的 IIFE 单文件 |
| 上游许可声明 | 上游 README「📄 License — *This project is licensed under the MIT License.*」 |
| 标识比对 | `dispersion`、`bezel`、`mergeK`、`selectShapes`、`paintsOverBackdrop`、`effectiveOpacity`、`data-glass`、`data-glass-solid` 等特征串与上游一致 |
| 声明日期 | 2026-10-23 |

### 本项目的修改（derivative work）

本项目在上游产物基础上做了以下修改，这些修改部分归本项目所有：

1. **滚动帧零 DOM 读取**：元素位置缓存为文档坐标（`dl/dt/dw/dh`），滚动帧用 `坐标 − scrollX/Y` 纯算术平移，不再逐帧调用 `getBoundingClientRect` / `getComputedStyle`；修复滚动时整页强制 reflow 导致的掉帧（实测 5fps → 满帧）
2. **样式缓存**：`visibility` / 圆角 / `--lg-tint` / `opacity` / `offsetWidth` 同步缓存
3. **内部滚动容器识别**：向上查找 `overflow: auto|scroll` 祖先，独立缓存 `scrollTop/scrollLeft`，滚动期间冻结壁纸纹理上传
4. **新增 `tag*` 绑定 API**（如 `tagSwitches`），并调整开关旋钮策略：旋钮不再交给引擎绘制，保留原生 CSS 白色胶囊
5. 壁纸 live 纹理改为隔帧上传；页面隐藏时暂停渲染

### 许可状态（请务必阅读）

上游在 README 中以**文字**声明 MIT，但仓库内：

- ❌ 没有 `LICENSE` 文件
- ❌ `package.json` 中没有 `license` 字段
- → GitHub 因此将其识别为「无许可证」（`license: None`）

也就是说，上游的表达意图是 MIT，但**未附完整的 MIT 许可文本与版权行**，许可链条在形式上并不完整。本仓库的处理方式：

1. 如实保留来源与修改说明（本文件）；
2. 按上游 README 的声明，将上游部分视为 MIT 授权，并附 MIT 全文如下；
3. 不以本项目名义对上游部分主张额外权利。

> **建议**：向 [crenspire/glass-ui](https://github.com/crenspire/glass-ui/issues) 提交 issue，请其补充 `LICENSE` 文件。若本项目用于商业分发且对合规性要求严格，建议在取得上游明确书面确认前，替换 `glass-liquid-engine.js` 为自研实现，或仅使用不依赖该引擎的纯 CSS 玻璃效果（`glass-core.css` 本身不依赖它）。

---

## 2. MIT 许可证全文（适用于上述上游部分）

```
MIT License

Copyright (c) crenspire/glass-ui contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. 本项目原创部分

除上述文件外，`css/` 全部样式表、`js/glass.js`、`js/glass-webgl.js`、`js/site-topbar.js`、全部演示页面与文档，均为赵鑫飞（Zhao Xinfei）原创，以 MIT 许可发布，见根目录 [`LICENSE`](./LICENSE)。
