# 发布 lumiglass 到 npm —— 操作步骤（已按 2026-10 实际流程校准）

> 现状：`lumiglass@1.1.1` 已于 2026-10-23 发布上线。
> 页面：https://www.npmjs.com/package/lumiglass
> 本文件记录的是**实际跑通的流程**，不是 2024 年的老教程。

## 为什么不能直接 `npm publish`

npm 从 2026 年起逐步限制「bypass 2FA」的 granular token 直发：

- 这类 token 现在只能**暂存发布**（stage），不能直接上线
- 直发会报：`E403 ... this token can only publish to a staging area`
- 批准（approve）必须由**带 2FA 的交互会话**完成 —— CLI 里带 `--otp` 也不行，
  `npm stage approve` 会一直返回 `404 staged version not found`（别在这上面浪费时间）

所以流程是：**CLI 暂存 → 网页批准**。

## 0. 发布前检查清单

- [ ] `package.json` 的 `homepage` / `repository.url` 换成真实仓库地址
- [ ] `npm pack` 检查包内容：应只含 `css/ js/ README.md LICENSE package.json`（13 个文件）
- [ ] 空目录实装 `.tgz` 试一次
- [ ] LICENSE 版权人为 赵鑫飞 (Zhao Xinfei)

## 1. 环境准备

```bash
# 必须是 npm CLI >= 11.15.0（stage 子命令从这版才有）
npx npm@11 --version

# 认证：在包目录放一个临时 .npmrc（发完立刻删）
printf 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=npm_xxxxx\n' > .npmrc
chmod 600 .npmrc
```

账号 `zhaoxinfei` 已开启 2FA（Touch ID 安全钥匙）。

> 注意：默认源常被指到淘宝镜像，所有命令都要显式带 `--registry=https://registry.npmjs.org/`。

## 2. 暂存发布（不需要 2FA，可脚本化）

```bash
cd lumiglass
npx npm@11 stage publish --registry=https://registry.npmjs.org/
```

输出里会给出 `staged with id <uuid>`，记下这个 id。

**首次发布会自动创建一个 `0.0.0-stage` 占位版**，此时 `latest` 指向占位版 ——
也就是说批准之前别人 `npm i lumiglass` 装到的是空壳包，别长时间挂着不管。

查看暂存状态：

```bash
npx npm@11 stage list --registry=https://registry.npmjs.org/
# status 从 validating → staged 需要几十秒，validating 期间 approve 会 404
```

## 3. 网页批准（唯一可行路径）

1. 打开 https://www.npmjs.com/package/lumiglass 的 **Staged** 标签
   （或头像菜单 → **Staged Packages**）
2. 核对 shasum 与本地 `npm pack` 一致
3. 点 **✓ Approve** → Touch ID 按一下
4. `latest` 才会真正指向新版本

## 4. 发布后验证

```bash
# 注册表侧（可靠）
curl -s https://registry.npmjs.org/lumiglass | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['dist-tags'], list(d['versions']))"

# 真实安装
mkdir -p /tmp/lg-verify && cd /tmp/lg-verify && npm i lumiglass --registry=https://registry.npmjs.org/
ls node_modules/lumiglass/css
```

npmjs.com 的网页有 Cloudflare 防护，`curl` 一律 403，这是正常的，不代表包没上线。

## 5. 以后发新版本

```bash
npm version patch   # 1.1.1 → 1.1.2（小修）
npm version minor   # 1.1.1 → 1.2.0（新组件）
npm version major   # 2.0.0（破坏性变更）
npx npm@11 stage publish --registry=https://registry.npmjs.org/
# → 再去网页点 Approve
```

## 6. 首发记录（2026-10-23）

| 项 | 值 |
| --- | --- |
| 版本 | 1.1.1 |
| shasum | c5bba150c2b0e857b96d8147e2f3628cffb55c4e |
| 包体 | 63.7 kB / 解包 259.4 kB / 13 文件 |
| stage id | e2544c6d-be8a-4eb1-bb33-7ad4a5cebb81 |
| dist-tags | latest → 1.1.1（另有 0.0.0-stage 占位版，无害） |

## 提示

- **真名发布前建议先做同类产品检索与商标自查**（见项目根目录《同类产品与侵权评估.md》）。
- 首次发布后 72 小时内不可撤下（npm 政策），发布前务必 `npm pack` 验收。
- 临时 `.npmrc` 用完即删；token 一旦出现在聊天/日志里，去 https://www.npmjs.com/settings/zhaoxinfei/tokens 吊销重建。
- 想彻底摆脱 2FA 交互，可改用 **trusted publishing (OIDC)**，在 GitHub Actions 里发版。
