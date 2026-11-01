# AppThen Skills

AppThen 平台的 Agent 技能集合（SKILL.md 标准）：

- **appthen-extension** — 在 AppThen 工作台里开发、调试、发布可安装的扩展/功能
- **appthen-application** — 在现有系统里直接做页面/组件/内容页（不新建项目）
- **appthen-resource-picker** — 资源选择器（抽屉/字段/适配器模板）的接入范式

> **把技能交给第三方团队时，让他们从 [`skills/appthen-extension/docs/INDEX.md`](skills/appthen-extension/docs/INDEX.md) 进。** 我们不提供对外开放的文档系统，所以场景索引、用法文档与平台契约只读快照都内联在技能目录里，离线可达形成闭环。

## 分发方式

**本仓库的 `main` 分支就是唯一真源，技能按 git 分发，不走 npm。** 仓库公开只读，`npx skills add` 会直接 clone 并 symlink 到各 Agent 的技能目录。

因此对维护者只有一条动作：改完 `commit` + `push` 到 `main`（不需要 bump 版本、不需要 `npm publish`）。使用方重跑 `npx skills update` 即拿到最新内容。

## 安装

需要 Node.js 18+，使用 Vercel 的 `skills` CLI（技能生态标准工具）：

```bash
# 装全部技能（全局，--all = --skill '*' --agent '*' -y）
npx skills add appthen/skills -g -y --all

# 或只装某一个
npx skills add appthen/skills --skill appthen-extension -g -y
npx skills add appthen/skills --skill appthen-application -g -y
npx skills add appthen/skills --skill appthen-resource-picker -g -y

# 只列出仓库里有哪些技能，不安装
npx skills add appthen/skills -l
```

装完**重开**你的 Agent 会话，然后直接说需求即可：

> "帮我在工作台里加个客户管理功能"
> "系统里做个产品介绍页，不要重新搭项目"

更新技能：

```bash
npx skills update
```

## 国内网络

如果 GitHub 访问不稳定，把本仓库同步一份镜像到 Gitee / cnb.cool，再用镜像地址（`<镜像站>` 按实际填）：

```bash
npx skills add https://<镜像站>/appthen-skills.git -g -y --all
```

## 仓库结构

```
skills/
├── appthen-extension/       # 工作台扩展开发技能（docs/INDEX.md 是唯一文档入口）
├── appthen-application/     # VFS 页面/组件开发技能
└── appthen-resource-picker/ # 资源选择器接入（模板 + 范式）
```

每个技能目录内含 `SKILL.md`（frontmatter 为触发描述 + 正文为工作流程），以及 `agents/`、`docs/`、`references/`、`examples/` 等配套资源。
