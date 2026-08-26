---
name: appthen-extension
description: 当用户想在 AppThen 工作台里"加一个功能、工具、面板、小插件"，或想把已有界面/能力打包成可安装、可发布的扩展时，使用本技能。典型用户说法："帮我在工作台里加个 XX 功能""做一个侧边栏工具""把这个功能做成能安装的扩展"。用户不需要懂代码或文件结构，交付即可安装、可发布的功能。
---

# AppThen Extension Development

Use this skill to take an AppThen Workbench extension from local development through a verifiable package and deployment flow. The canonical detailed specification is [PLUGIN_DEV.md](docs/PLUGIN_DEV.md); the runnable reference workspace is [examples/extension-workspace](examples/extension-workspace).

## First Decision

Determine the ownership boundary before editing:

- External extension work: modify the extension workspace, its manifest, themes, and extension docs.
- Workbench host bug: modify `src/workbench`, `src/core`, shared UI, or host services only when the task explicitly concerns the platform.
- AppThen VFS application work: use `skills/appthen-application` or `skills/skill-cli-app-dev`; do not use this skill.

- 扩展 UI 应复用宿主 shadcn 语义系统（使用 `bg-popover` / `text-foreground` / `border-border` 等语义类，而非硬编码色值或 `vscode-*` 词汇），视觉质量基线对齐 `skills/appthen-application/references/ui-design-quality.md`，避免外部扩展风格漂移。

Read these files when needed:

- [PLUGIN_DEV.md](docs/PLUGIN_DEV.md): stable v1 contract and release rules.
- [examples/extension-workspace/AGENTS.md](examples/extension-workspace/AGENTS.md): agent-specific guardrails.
- [examples/extension-workspace/README.md](examples/extension-workspace/README.md): local workspace usage.
- `src/extension-dev`: workspace discovery, validation, build, pack, and publish behavior.
- `src/extension-cli`: CLI command behavior and flags.
- `src/extension-dev-workbench`: offline Workbench host behavior.

## Standard Workflow

### 1. Prepare the workspace

Use the existing workspace when possible. A workspace can contain multiple independent extensions:

```text
extension-workspace/
├── appthen-extension-workspace.json
├── extensions/<extension-id>/manifest.json
├── extensions/<extension-id>/src/index.tsx
└── themes/*.json
```

Run the standard checks from the extension workspace:

```bash
pnpm install
pnpm doctor
pnpm dev
```

The dev Workbench is offline. It loads every `extensions/*/manifest.json`, watches manifest changes, and uses Vite HMR for source changes. If the SDK itself is being changed, build the SDK first and use its local package root:

```bash
pnpm run build:lib
pnpm dev -- --package-root /path/to/vibe-workspace
```

The SDK build produces both the runtime modules and `dist/vibe-workspace.css`.
Keep them from different builds out of the same local or published package;
otherwise responsive overlay classes can be present in JavaScript but missing
from CSS. Extensions must use `WorkbenchDrawerContent` for drawer positioning
and must not add custom `fixed`, `bottom-*`, `right-*`, `translate-*`, or
similar positioning classes to it.

Use the actual port printed by Vite when the default port is occupied.

### 2. Check the manifest

The stable manifest baseline is:

```json
{
  "id": "acme.example",
  "name": "Example Extension",
  "version": "0.1.0",
  "manifestVersion": 1,
  "apiVersion": "1",
  "main": "./src/index.tsx",
  "sourceType": "umd",
  "runtime": {
    "sidebarViewId": "sidebar.acme.example"
  }
}
```

Rules:

- Use a globally stable reverse-domain ID.
- Export `activate(ctx)` from the entry module.
- Return cleanup functions from registrations and subscriptions.
- Use small SVG data URLs or HTTPS image URLs for icons; do not assume relative package assets are available at runtime.
- Keep `runtime.autoActivate` off unless the extension must register a startup capability.
- Treat `manifestVersion: 1`, `apiVersion: "1"`, and `sourceType: "umd"` as the current stable contract.

### 3. Register capabilities

Use public APIs only:

- `ctx.capabilities.registerSidebarView`
- `ctx.capabilities.registerEditorView`
- `ctx.capabilities.registerContribution`
- `ctx.capabilities.registerFrontendToolHandler`
- `ctx.views.openEditor` / `ctx.views.closeEditor`
- `ctx.links.create` / `ctx.links.open`
- `ctx.runtime` and `ctx.auth`

Do not use these host internals from an external extension:

- `extensionRegistry`
- `eventBus`
- `workspaceEditorService`
- manual view ID prefix inference
- the legacy `open` query parameter
- `registerMainView` or `mainView.open`

Complete business surfaces belong in Editor views. Use a Sidebar for navigation, compact status, or entry actions rather than putting a full business page into it.

### 4. Make views routeable

Every Editor view needs a stable `routeKey`. Props used for restoration must be primitive or otherwise explicitly serializable. Use a stable `key` for one logical resource so repeated clicks do not create duplicate tabs:

```tsx
ctx.capabilities.registerEditorView({
  id: 'editor.acme.example.members',
  routeKey: 'members',
  title: 'Members',
  component: MembersView,
});

ctx.views.openEditor({
  viewId: 'editor.acme.example.members',
  title: 'Members',
  key: `members:${teamId}`,
  props: { teamId, filter: 'active' },
});
```

Use `ctx.links` to create and open shareable links. Do not hand-build tenant, workbench, extension, or query segments. Verify that a copied URL restores the extension, view, resource, and selected project/space after a hard refresh.

### 5. Apply UI and mobile rules

- Use shared dialogs and drawers from `@appthen/vibe-workspace/overlay`.
- Give field groups and action groups explicit `gap-2`, `gap-3`, or `gap-4`; adjacent elements do not get reliable spacing automatically.
- Use `min-width: 0` and `max-width: 100%` on inputs and flexible columns.
- On mobile (`<768px`), use navigation drawer -> list -> full-screen detail. Do not simply stack a desktop multi-column layout vertically.
- Mobile drawers should open from the bottom; full pages should use Editor tabs or full-screen detail.
- Hide mobile floating panels without unmounting the view when state continuity matters.
- Do not record scroll position with a high-frequency `scroll` listener; preserve mounted component state instead.
- Validate desktop, narrow tablet, and phone widths. Check loading, empty, error, overflow, and long-label states.

Themes belong to Workbench configuration. For offline development, define them in `themes/*.json` and select the default in `appthen-extension-workspace.json`; do not change the theme as an activation side effect.

### 6. Validate the full lifecycle

Run the local checks before packaging:

```bash
pnpm validate
pnpm test
pnpm build
pnpm pack
```

For a focused extension, pass its ID where supported. Treat these as separate evidence levels:

1. Manifest validation succeeds.
2. Local offline Workbench loads the extension and its views.
3. Source changes hot-update and manifest changes reload the entry.
4. Build output contains the declared runtime entry.
5. Package contains manifest, bundle, and integrity metadata.
6. The packaged extension can be installed and mounted in a real Workbench.
7. A real browser refresh restores the shared route and resource state.

Do not treat a successful TypeScript compile, static screenshot, or package creation alone as end-to-end success.

### 7. Publish, install, and mount separately

Keep these operations distinct:

1. **Publish** uploads the artifact and updates the tenant extension record.
2. **Install** adds a version to the tenant extension pool.
3. **Mount** enables the extension in a specific Workbench and configures availability and permissions.

Default publishing must not silently install or mount an extension. Online publishing requires a server, tenant context, and short-lived token. Never print tokens in source, logs, commits, or final responses.

## Debugging Order

When an extension appears but does not work, inspect in this order:

1. Manifest discovery: was the extension found and is its ID stable?
2. Runtime load: is `activate(ctx)` called exactly once for the current Workbench scope?
3. Registration: are Sidebar/Editor contributions registered under the expected IDs?
4. Route restore: does the URL contain stable `routeKey`, `key`, and serializable props?
5. Context: are `ctx.runtime.tenantId`, workbench identity, actor, and access token available?
6. Data request: did the view mount, or did it return early because project/space context was missing?
7. UI contract: are gaps, overflow, mobile transitions, empty states, and errors handled?
8. Deployment: was the artifact published, installed, and mounted separately?

Use host logs such as activation, registration, route restoration, and runtime-context logs to distinguish “component did not mount” from “component mounted but skipped its request”.

## Completion Checklist

Before declaring an extension complete, confirm:

- `pnpm doctor`, `pnpm validate`, `pnpm test`, `pnpm build`, and `pnpm pack` pass.
- The extension runs in the offline Workbench with HMR.
- Public APIs are used and all registrations have cleanup functions.
- Reopening the same resource does not create duplicate tabs.
- Copied URLs restore the extension and resource after refresh.
- Desktop, narrow tablet, and phone layouts were checked.
- Dialogs, drawers, forms, icons, themes, loading, empty, and error states follow the host contract.
- Publish, install, and Workbench mounting were verified as separate steps.
