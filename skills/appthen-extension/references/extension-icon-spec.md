# 扩展 Icon 规范

> 适用范围：所有 AppThen 扩展的 `manifest.json` `icon` 字段。
> 平台在 `extension-cli build` 时会**自动规范化** icon（见下文"平台自动处理"），
> 扩展方按本规范产出源码可以零修正通过；不按规范也能构建，但会得到警告。

## 规范要求

| 项 | 要求 |
|---|---|
| 格式 | `data:image/svg+xml,<url-encoded>` 或 `data:image/svg+xml;base64,<b64>`（两种都支持，构建产物统一为 url-encoded） |
| 画布 | `viewBox="0 0 24 24"`（正方形） |
| 图形占比 | 图形 bounding box 占画布 **≥ 75%**（不要大画布小图形——与内置图标并排会显小） |
| 颜色 | 描边/填充用 **`currentColor`**（图标随主题与 active 态变色）；`white`、`#fff`、中性灰（`#7D8590` 等）会被平台自动转换 |
| 背景 | **不带背景色块**（全画布 rect 会被平台移除——背景由宿主控制） |
| 线宽 | 线框图标 `stroke-width="2"`（24 画布口径） |

## 反例（平台会自动修正，但别再这么写）

```xml
<!-- ✗ 大画布小图形（viewBox 32，图形只占中间 18×14） -->
<svg viewBox='0 0 32 32'><path d='M11 10 ...'/></svg>

<!-- ✗ 自带品牌背景块 -->
<svg viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#185FA5'/><path .../></svg>

<!-- ✗ 硬编码白色（深色画布假设） -->
<path stroke='white' .../>
```

## 推荐模板

```xml
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
  <path fill='none' stroke='currentColor' stroke-width='2'
        stroke-linecap='round' stroke-linejoin='round' d='...' />
</svg>
```

## 平台自动处理（extension-cli build）

构建时对 `icon` 执行规范化管线（`extension-dev/iconPipeline.ts`），扩展方源码**零改动**：

1. 两种 data URI 编码统一解码，产物统一输出 url-encoded
2. 删除「全画布背景色块」rect（宽高 ≥ viewBox×75% 且带 hex fill）
3. `white` / `#fff` / 中性灰 → `currentColor`
4. viewBox 收紧到图形 bbox + 10% 留白（小图形自动放大到与内置图标视觉等重）

无法解析或清洗后无图形元素 → 保留原值并输出构建警告；运行时另有安全兜底
（解码失败回落 `<img>` 原样渲染，绝不会把原始串注入页面）。

## 生成 icon 的推荐做法

用任意矢量工具画 24×24 线框图（2px 线宽），导出 SVG 后：

```js
// Node 一行把 svg 文件转成 manifest.icon 值
'data:image/svg+xml,' + encodeURIComponent(require('fs').readFileSync('icon.svg', 'utf8'))
```
