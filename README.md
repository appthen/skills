# AppThen Skills

AppThen 平台的 Agent 技能集合（SKILL.md 标准）：

- **appthen-extension** — 在 AppThen 工作台里开发、调试、发布可安装的扩展/功能
- **appthen-application** — 在现有系统里直接做页面/组件/内容页（不新建项目）

## 安装

需要 Node.js 18+，使用 Vercel 的 `skills` CLI（技能生态标准工具）：

```bash
# 装全部技能（全局）
npx skills add <org>/appthen-skills -g -y --all

# 或只装某一个
npx skills add <org>/appthen-skills --skill appthen-extension -g -y
npx skills add <org>/appthen-skills --skill appthen-application -g -y
```

装完**重开**你的 Agent 会话，然后直接说需求即可：

> "帮我在工作台里加个客户管理功能"
> "系统里做个产品介绍页，不要重新搭项目"

更新技能：

```bash
npx skills update
```

## 国内网络

如果 GitHub 访问不稳定，本仓库可镜像到 Gitee / cnb.cool 后使用同一命令：

```bash
npx skills add https://gitee.com/<org>/appthen-skills.git --skill appthen-extension -g -y
```

## 仓库结构

```
skills/
├── appthen-extension/     # 工作台扩展开发技能
└── appthen-application/   # VFS 页面/组件开发技能
```

每个技能目录内含 `SKILL.md`（frontmatter 为触发描述 + 正文为工作流程），以及 `agents/`、`docs/`、`references/`、`examples/` 等配套资源。
