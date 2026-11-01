<!-- 平台契约快照：只读，不要在此处直接改内容 -->
> **来源**：`nest-server/docs/identity-tenant-contract.md` ｜ **快照基线** `95fc4a8`（2026-09-09）｜ **同步日期** 2026-11-01
> **权威版本以平台仓库为准**。发现与本快照不一致时：先以平台代码为准，再回来更新本快照与 [INDEX.md](../INDEX.md)。
> 本文件为什么内联在技能里：我们**不提供对外开放的文档系统**，第三方按技能目录离线阅读即可，不假设能访问平台仓库。

---
# Identity and Tenant Contract

Status: frozen for the current Hub / Workspace Agent / CLI integration round.

Updated: 2026-06-15

Related decisions:

- `docs/adr/0001-tenant-is-team-authority.md`
- `docs/adr/0002-subject-compat-user-team-role.md`
- `docs/adr/0003-client-header-is-legacy-hint.md`

## 1. Contract Goal

New AppThen code must share one identity contract across Web, CLI, Socket Gateway, Workspace Agent, Conversation Hub, and tenant SDK calls.

The stable business boundary is `tenantId`. `Project` and `Workspace` are execution resources and must not replace tenant ownership.

## 2. Standard IdentityContext

```ts
type IdentityContext = {
  authType: 'user' | 'tenant_app' | 'agent_node';
  source: 'web' | 'cli' | 'sdk' | 'agent';
  tenantId?: string;
  subjectId?: string;
  principalId?: string;
  user?: {
    userId?: string;
    name?: string;
    phone?: string;
    avatar?: string;
    identityProvider?: string;
    casdoorUserId?: string;
  };
  app?: {
    appId: string;
    scopes: string[];
    actingSubjectId?: string | null;
    actingMode?: 'self' | 'subject' | string;
  };
  roles?: string[];
  permissions?: string[];
  compat?: {
    userId?: number;
    teamId?: number;
    roleId?: number;
  };
};
```

Rules:

1. New code reads `tenantId`, not `teamId`.
2. `subjectId` is a first-class field when the current action is performed by, for, or as a Subject.
3. `compat` exists only for legacy modules that still require numeric `userId / teamId / roleId`.
4. `principalId` is the audit principal. Examples: `user:100001`, `tenant_app:tenant_app_xxx`, future `agent_node:node_xxx`.

Tenant identity has two explicit levels:

```ts
type TenantIdentityContext = IdentityContext & {
  tenantId: string;
};

type TenantScopedIdentityContext = TenantIdentityContext & {
  subjectId: string;
};
```

`TenantIdentityContext` means the request has selected a tenant. `TenantScopedIdentityContext` means the request also has a concrete Subject inside that tenant.

## 3. Tenant-Scoped Token

There are two user token states:

1. Login token: created after Casdoor login. It may not contain `tenantId` or `subjectId`.
2. Tenant-scoped token: created after selecting a tenant/team. It must contain:
   - `sub`
   - `tenantId`
   - `subjectId`
   - legacy-compatible numeric ids in response payload: `default_team_id`, `default_role_id`

Workbench, CLI, Socket Gateway, Workspace Agent registration, and Conversation Hub runtime calls must use a tenant-scoped token.

Initial login token is only allowed to:

- call `GET /identity/tenants`
- call `POST /identity/switch-tenant`
- inspect `GET /identity/me`

## 4. Subject Mapping

For a user token, default `subjectId` is resolved through `SubjectAccount` in the selected tenant.

Supported account providers include:

- `mt_user`
- `compat_user`
- `phone`
- `casdoor`

The selected tenant flow looks up the current login identity in `subject_directory_accounts`, chooses the primary account if available, and returns its `subjectId` in the tenant-scoped token.

`GET /subject-directory/me` returns the subject context for the current tenant-scoped token.

## 5. TenantId Authority

Authority order:

1. Tenant-scoped JWT payload.
2. Server-side `/identity/me` token verification.
3. Explicit route/query/body tenant only after it has been checked against token tenant.

`Client` header and legacy `team_id` are not authoritative for new code.

## 6. Client Header Policy

Existing requests may still send:

```http
Client: worktop-user-61-117987
```

Policy:

1. It is a legacy compatibility hint only.
2. It must not authorize new Conversation Hub, Workspace Agent, CLI, SDK, or Workbench runtime code.
3. New guards and services must use `IdentityContext.tenantId`.
4. Legacy code may read `Client` until the old MySQL team/role surface is retired.

## 7. Compat Field Boundary

`compat.userId / compat.teamId / compat.roleId` exist to keep old modules working while MySQL user/team/role is phased out.

Rules:

1. New domain models must not store `teamId` as business ownership.
2. New APIs must not require `roleId` from `Client`.
3. Conversion Hub, Subject Directory, Workbench runtime, and Workspace Agent should only persist `tenantId` and `subjectId`.
4. Numeric compat ids may be generated from Subject/Tenant identity and stored in Subject metadata or SubjectAccount metadata.

## 8. Minimal API Surface

### `GET /identity/me`

Returns:

```ts
{
  identity: IdentityContext;
  tenantScoped: boolean;
  subjectContext?: {
    subject: unknown;
    subjectClass: unknown;
    memberships: unknown[];
    organizationNodeIds: string[];
  } | null;
}
```

### `GET /identity/tenants`

Returns the current user's available tenants/teams.

Requires user token. Tenant-scoped token also works.

### `POST /identity/switch-tenant`

Body:

```ts
{ tenantId: string }
```

Returns tenant-scoped token and selected tenant metadata.

### `GET /subject-directory/me`

Returns subject context for the current tenant-scoped token.

Requires `tenantId` and `subjectId` in token.

## 9. Shared Backend Entry Points

`IdentityService` is the shared backend identity entry point:

```ts
verifyIdentityToken(token): VerifiedIdentityToken
resolveIdentityContext(req): IdentityContext
buildIdentityContextFromClaims(payload): IdentityContext
requireTenantIdentity(context): TenantIdentityContext
requireTenantScopedIdentity(context): TenantScopedIdentityContext
assertTenantIdentity(context): asserts context is TenantIdentityContext
assertTenantScopedIdentity(context): asserts context is TenantScopedIdentityContext
verifyTenantScopedIdentityToken(token): VerifiedIdentityToken & {
  context: TenantScopedIdentityContext
}
```

Usage:

- HTTP guards can verify bearer token and attach `IdentityContext`.
- Socket Gateway can verify token without relying on frontend localStorage.
- CLI and Workspace Agent registration can verify tenant ownership from token.
- SDK app tokens can be normalized into the same audit shape.

`agent_node` token payloads are explicitly unsupported in the current phase. They must be rejected until the Phase B `WorkspaceAgentNode` registration model becomes the authority source.

## 10. Multi-Tenant Switching

Rules:

1. Web must switch tenant through `POST /identity/switch-tenant`.
2. Workbench URLs may include `tenantId`, but server authorization must use token tenant.
   - Client URL-authority convention (workbench, per tab): when the URL carries
     `/t/{tenantId}`, the workbench treats that tenant as authoritative for the tab and
     reconciles the stored tenant context through `POST /identity/switch-tenant`
     (followed by a full-page reload) before loading tenant resources. URLs without
     `/t/{tenantId}` fall back to the tab's stored tenant context. Team switching and
     root-path entry therefore always produce `/t/{tenantId}/w/{ref}` links, so each
     browser tab can hold a different team.
   - Per-tab identity storage: `sessionStorage` holds the tab-locked identity
     (access token + role), while `localStorage` mirrors the most recent explicit
     login/switch so new tabs inherit it. Reads prefer `sessionStorage` and fall back
     to `localStorage`; writes go to both layers; sign-out clears both layers
     (see `vibe-workspace/src/services/authStorage.ts`).
3. CLI must store selected tenant and use a tenant-scoped token.
4. Workspace Agent `nodeId` should be scoped by tenant and machine identity.
5. Existing WorkspaceSession remains bound to its original `tenantId / projectId / workspaceId`.

## 11. Tenant / Project / Workspace Permissions

Minimum rules:

1. Project should belong to a tenant.
2. Workspace should belong to a project and carry `tenantId`.
3. Having tenant membership does not automatically mean full access to every project forever; project/workspace-level permissions can narrow access.
4. Conversation may reference a workspace only if the workspace belongs to the same tenant, unless an explicit cross-tenant trust model is introduced later.
5. Newly created or cloned Project resources should record `ownerSubjectId` and default to `visibility = private`.
6. Newly created Workspace resources should record `ownerSubjectId` and default to `visibility = private` unless explicitly created as a team/shared runtime.
7. The owner Subject has implicit access to its own private Project/Workspace; other Subjects need explicit grants, such as `scope.kind = project` or `scope.kind = workspace`.
8. UI may describe this as “项目空间分享 / 运行环境分享”, but the backend authority is still `tenantId + subjectId + PermissionGrant.scope`.

## 12. Workspace Agent Registration

Registration must validate:

1. token is tenant-scoped;
2. token `tenantId` matches WorkspaceSession `tenantId`;
3. token subject/user is allowed to register or attach that workspace;
4. `projectId + workspaceId` belongs to the same tenant;
5. `nodeId` is owned by the same `tenantId + ownerUserId/ownerSubjectId + machineId` once WorkspaceAgentNode exists.

Current phase:

- `WorkspaceSession.nodeId` is the authority for node-session association.
- `WorkspaceAgentNode` collection is not yet the authority source.

## 13. External SDK Identity

Third-party SDK calls use tenant app tokens:

```ts
{
  tokenType: 'tenant_app';
  tenantId: string;
  appId: string;
  scopes: string[];
  actingSubjectId?: string;
  actingMode?: 'self' | 'subject';
}
```

When an SDK acts as a participant, it should map to either:

- app principal only;
- service account subject;
- external subject;
- explicitly allowed `actingSubjectId`.

## 14. Agent Subject and Principal

Agent is a Subject in Conversation Hub. Runtime or Workspace Agent execution also needs a Principal for audit.

Recommended audit shape:

```ts
{
  tenantId: string;
  actorUserId?: string;
  actorSubjectId?: string;
  actorPrincipalId: string;
  source: 'web' | 'cli' | 'agent' | 'sdk';
}
```

Required fields:

- `tenantId`
- `actorPrincipalId`
- `source`

Add `actorUserId` when a human user initiates the action.
Add `actorSubjectId` when the action is performed as, by, or for a Subject.
