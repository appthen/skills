#!/usr/bin/env node
/**
 * AppThen 扩展 UI 合规审计
 *
 * 分两级，区别是"会不会坏"而不是"我喜不喜欢"：
 *
 *   error  —— 会导致渲染错误 / 主题失效 / 内容被裁，必须修
 *   advice —— 规模与风格信号，默认不阻断，自己判断要不要处理（--strict 才算失败）
 *
 * 检查项：
 *   1. 字号 < 12px        —— 中文浏览器最小字号 12px，低于它会被强制放大但不撑容器
 *   2. 独立 CSS 体量超标   —— 手写样式是负债，超预算说明在重造宿主组件
 *   3. 自定义类名过多      —— 一次性选择器 = 没有设计语言
 *   4. 内联 style 过多     —— 换了个地方写 CSS，且不可复用
 *   5. 旧 token 引用       —— var(--vscode-*) / var(--ck-*) 不得出现在扩展里
 *   6. 自定义色源          —— 扩展不得定义任何主题 token
 *   7. 手搓宿主已有组件     —— <table> / role="tablist" 等
 *   8. 单文件超长          —— 结构红线
 *
 * 用法:
 *   node scripts/audit-ui.mjs                          # 扫 examples/extension-workspace/extensions/*
 *   node scripts/audit-ui.mjs ../my-workspace/extensions/acme.my-ext
 *   node scripts/audit-ui.mjs --json                   # 机器可读
 *   node scripts/audit-ui.mjs --css-budget=80          # 收紧 CSS 预算
 *   node scripts/audit-ui.mjs --strict                 # 警告也计为失败
 *
 * 退出码: 0 = 通过, 1 = 有失败项
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../examples/extension-workspace/extensions');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const strict = argv.includes('--strict');
const budgetArg = argv.find((a) => a.startsWith('--css-budget='));
const targets = argv.filter((a) => !a.startsWith('--'));

const LIMITS = {
  cssBudget: budgetArg ? Number(budgetArg.split('=')[1]) : 150,
  minFontPx: 12,
  inlineStyle: 10,
  customClasses: 15,
  fileLines: 300,
};

const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git', '.appthen']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Tailwind 前缀白名单：命中这些即视为原子类，不计入"自定义类"
const TW_PREFIX = new Set(`flex inline-block inline-flex grid block hidden contents table table-row table-cell
  gap gap-x gap-y space-x space-y divide-x divide-y
  p px py pt pb pl pr m mx my mt mb ml mr
  w h size min-w min-h max-w max-h basis
  items justify self place content flex- flex-grow flex-shrink grow shrink order col row
  text bg border border-t border-b border-l border-r border-x border-y rounded rounded-t rounded-b rounded-l rounded-r
  font font-sans font-mono leading tracking
  overflow overflow-x overflow-y truncate whitespace break
  absolute relative fixed sticky static z inset top right bottom left
  cursor select pointer-events resize appearance
  opacity shadow ring outline fill stroke
  transition duration delay ease animate
  translate scale rotate origin transform
  sr sr-only not-first first last odd even only
  hover focus focus-visible active disabled group peer dark
  sm md lg xl 2xl
  object aspect list align align-items align-self
  container cqi cqw cqh cqmin cqmax
  backdrop filter blur brightness contrast grayscale invert saturate sepia drop-shadow
  will-change content-auto
  tabular-nums antialiased subpixel-antialiased`.split(/\s+/).filter(Boolean));

const TW_EXACT = new Set(['flex-1', 'shrink-0', 'grow-0', 'border-0', 'p-0', 'm-0', 'w-full', 'h-full', 'min-w-0', 'min-h-0']);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const pxOf = (value, unit) => {
  const n = Number(value);
  if (unit === 'px') return n;
  if (unit === 'rem') return n * 16;
  if (unit === 'em') return NaN; // 相对父级，无法静态判定
  return NaN;
};

/** 把注释替换成等长空白，保留行号，避免注释里的示例代码被误报 */
function blankComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/** 提取 className 里的自定义类（非 Tailwind）：只认字面量，不认 {表达式} 里的变量名 */
function customClassesIn(text) {
  const found = new Set();
  const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
  let m;
  while ((m = re.exec(blankComments(text)))) {
    const raw = m[1] ?? m[2] ?? '';
    for (const tok of raw.split(/\s+/)) {
      if (!tok || tok.includes('$')) continue;
      if (tok.includes('[') || tok.includes(':')) continue; // arbitrary / 变体
      const base = tok.replace(/^!/, '');
      if (!/^[a-z]/.test(base)) continue;
      const head = base.split('-')[0];
      if (TW_PREFIX.has(base) || TW_PREFIX.has(head) || TW_EXACT.has(base)) continue;
      if (/^(bg|text|border|fill|stroke|ring|divide|placeholder|from|via|to)-/.test(base)) continue;
      found.add(base);
    }
  }
  return found;
}

function auditExtension(dir) {
  const files = walk(dir);
  const codeFiles = files.filter((f) => CODE_EXT.has(path.extname(f)));
  const cssFiles = files.filter((f) => path.extname(f) === '.css');

  const issues = [];
  const add = (level, code, msg, hint, sample) =>
    issues.push({ level, code, msg, hint, sample: sample ? sample.slice(0, 3) : [] });

  // --- 字号 < 12px -------------------------------------------------------
  const smallFonts = [];
  for (const f of [...codeFiles, ...cssFiles]) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(dir, f);
    const push = (raw, line) => smallFonts.push(`${rel}:${line} → ${raw.trim()}`);

    for (const re of [
      /font-size:\s*([\d.]+)(px|rem|em)\b/g,
      /text-\[([\d.]+)(px|rem)\]/g,
      /fontSize:\s*([\d.]+)(px)?/g,
      /text-\[([\d.]+)rem\]/g,
    ]) {
      let m;
      while ((m = re.exec(text))) {
        const px = pxOf(m[1], m[2] || 'px');
        if (Number.isFinite(px) && px < LIMITS.minFontPx) {
          push(m[0], text.slice(0, m.index).split('\n').length);
        }
      }
    }
    // <12px 的 em：0.6875rem 之类已由 rem 分支覆盖，em 只报明显小于 1 的绝对值
    const emRe = /font-size:\s*(0\.\d+)em/g;
    let em;
    while ((em = emRe.exec(text))) {
      push(em[0] + '（相对父级，需人工确认）', text.slice(0, em.index).split('\n').length);
    }
  }
  if (smallFonts.length) {
    add('error', 'FONT_TOO_SMALL', `字号小于 ${LIMITS.minFontPx}px：${smallFonts.length} 处`, '中文环境浏览器最小字号为 12px，低于它会被强制放大但不撑容器 → 溢出/裁切。层级靠跳跃建立（12/14/16/20），不要用 11 与 12 制造差异。', smallFonts);
  }

  // --- 独立 CSS 体量 -----------------------------------------------------
  const cssLines = cssFiles.map((f) => ({
    file: path.relative(dir, f),
    lines: fs.readFileSync(f, 'utf8').split('\n').length,
  }));
  const cssTotal = cssLines.reduce((s, x) => s + x.lines, 0);
  if (cssTotal > LIMITS.cssBudget) {
    const top = cssLines.sort((a, b) => b.lines - a.lines).map((x) => `${x.file}: ${x.lines} 行`);
    add('advice', 'CSS_BUDGET', `独立 CSS 共 ${cssTotal} 行，超出预算 ${LIMITS.cssBudget} 行`, '先问这行 CSS 在做什么：①重造宿主已有组件 → 换组件；②写死设计数值（字号/间距/圆角/宽高）→ 换原子类；③宿主能力缺口 → 收敛成一处补丁；④本业务特有视觉 → 才留下。前三类不该进 CSS。', top);
  }

  // --- 旧 token / 自定义色源 ---------------------------------------------
  const legacy = [];
  const ckTokens = [];
  const colorSource = [];
  for (const f of [...codeFiles, ...cssFiles]) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(dir, f);
    text.split('\n').forEach((line, i) => {
      // --vscode-* / --border-light / --text-primary 是从旧 IDE 主题继承来的，宿主保证不了。
      // --ck-* 是 coding-kit 的令牌，宿主会在运行时注入（2026-11 实测 39 处引用全部有值），
      // 所以只作提示：如果目标工作台没加载 coding-kit，它们会静默失效。
      if (/var\(--vscode-|var\(--border-light|var\(--text-primary/.test(line)) {
        legacy.push(`${rel}:${i + 1} → ${line.trim().slice(0, 70)}`);
      }
      if (/var\(--ck-/.test(line)) {
        ckTokens.push(`${rel}:${i + 1} → ${line.trim().slice(0, 70)}`);
      }
      if (/^\s*--[a-z][a-z0-9-]*\s*:\s*(#|rgba?\(|hsla?\()/i.test(line)) {
        colorSource.push(`${rel}:${i + 1} → ${line.trim().slice(0, 70)}`);
      }
    });
  }
  if (ckTokens.length) add('advice', 'CK_TOKENS', `引用 coding-kit 令牌 ${ckTokens.length} 处（var(--ck-*)）`, '这些值由宿主在运行时注入，本仓实测有值；但如果目标工作台没加载 coding-kit，它们会静默失效（属性取初始值）。要么确认宿主注入，要么换成 --portal-* / shadcn 语义 token。', ckTokens);
  if (legacy.length) add('error', 'LEGACY_TOKEN', `引用旧主题变量 ${legacy.length} 处`, '宿主已提供 shadcn 语义层与 --portal-* 调色板，改用 bg-card / text-muted-foreground / var(--portal-success) 这类消费方式。', legacy);
  if (colorSource.length) add('error', 'COLOR_SOURCE', `自定义色源 ${colorSource.length} 处`, '扩展不得定义任何主题 token（硬规则）。业务状态色要么映射到现有语义色，要么把需求上提 SDK。', colorSource);

  // --- 内联 style --------------------------------------------------------
  const inline = [];
  for (const f of codeFiles) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    const n = (text.match(/style=\{\{/g) || []).length;
    if (n) inline.push(`${path.relative(dir, f)}: ${n} 处`);
  }
  const inlineTotal = inline.reduce((s, x) => s + Number(x.split(': ')[1].replace(' 处', '')), 0);
  if (inlineTotal > LIMITS.inlineStyle) {
    add('advice', 'INLINE_STYLE', `内联 style ${inlineTotal} 处`, '内联样式等于不可复用的 CSS：不进主题、不可扫、不能响应断点。收敛到原子类或组件 variant。', inline);
  }

  // --- 自定义类名 --------------------------------------------------------
  const customAll = new Set();
  for (const f of codeFiles) {
    for (const c of customClassesIn(fs.readFileSync(f, 'utf8'))) customAll.add(c);
  }
  if (customAll.size > LIMITS.customClasses) {
    add('advice', 'CUSTOM_CLASSES', `自定义类名 ${customAll.size} 个（阈值 ${LIMITS.customClasses}）`, '同一个视觉出现第二次之前不要起名字：第一次直接写原子类，第二次才抽原语或组件。自造类名越多，改一处要动的地方越多。', [...customAll].slice(0, 8));
  }

  // --- 手搓宿主组件 ------------------------------------------------------
  const handmade = [];
  for (const f of codeFiles) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(dir, f);
    if (/<table\b/.test(text)) handmade.push(`${rel}: <table> 手写表格 → 用 Table/TableHeader/TableRow/TableCell`);
    if (/role=["']tablist["']/.test(text)) handmade.push(`${rel}: role="tablist" → 用 Tabs/TabsList/TabsTrigger`);
    if (/role=["']dialog["']|role=["']alertdialog["']/.test(text)) handmade.push(`${rel}: 自建 dialog → 用 WorkbenchDialog / WorkbenchDrawer`);
  }
  if (handmade.length) add('advice', 'HANDMADE', `手搓宿主已有组件 ${handmade.length} 处`, 'SDK 有就直接用，哪怕只差一个 className；缺能力就上提 SDK，不要在扩展里复制私有实现。', handmade);

  // --- 列表：表格必须有 card list 形态 -----------------------------------
  // 规范（UI-CONTRACT §12）：列表用 Table 时，窄容器必须退化为卡片列表。
  // 只判定"有没有 cardMode + Cell label"，不评判卡片视觉——长什么样由扩展决定。
  const listNoCard = [];
  for (const f of codeFiles) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    if (!/<Table\b/.test(text)) continue;
    const rel = path.relative(dir, f);
    const tables = text.match(/<Table\b[^>]*>/g) || [];
    const missingMode = tables.filter((tag) => !/\bcardMode\b/.test(tag)).length;
    if (missingMode) listNoCard.push(`${rel}: ${missingMode} 个 <Table> 未开 cardMode`);
    else if (!/\blabel=/.test(text)) listNoCard.push(`${rel}: 开了 cardMode 但没有 TableCell label，卡片里只有值没有字段名`);
  }
  if (listNoCard.length) add('advice', 'TABLE_NO_CARD_LIST', `列表缺少卡片列表形态：${listNoCard.length} 处`, '规范要求列表在窄容器里退化为 card list（不是横向滚动表格）。用 <Table cardMode> + <TableCell label="字段名" cardTitle cardHidden />，断点由 SDK 按表格可用宽度处理。', listNoCard);

  // --- 单文件超长 --------------------------------------------------------
  const long = [];
  for (const f of [...codeFiles, ...cssFiles]) {
    const n = fs.readFileSync(f, 'utf8').split('\n').length;
    if (n > LIMITS.fileLines) long.push(`${path.relative(dir, f)}: ${n} 行`);
  }
  if (long.length) add('advice', 'FILE_TOO_LONG', `单文件超过 ${LIMITS.fileLines} 行：${long.length} 个`, '按业务域拆文件；单组件 useState > 5 也要拆（Dialog 开关收敛成一个 dialog 状态）。', long);

  // --- 滚动契约 ----------------------------------------------------------
  // 宿主容器是「确定高度 + overflow:hidden」。min-h-full 在没有确定高度父级时解析为 auto
  // → 内容自然撑高后被裁掉，连滚动条都不出现；只加 overflow-y-auto 又会被 flex 压扁。
  const scrollRoots = [];
  for (const f of codeFiles) {
    const text = blankComments(fs.readFileSync(f, 'utf8'));
    const rel = path.relative(dir, f);
    text.split('\n').forEach((line, i) => {
      if (/\bmin-h-full\b/.test(line)) scrollRoots.push(`${rel}:${i + 1} → ${line.trim().slice(0, 70)}`);
    });
  }
  if (scrollRoots.length) {
    add('error', 'SCROLL_ROOT', `${scrollRoots.length} 处用了 min-h-full（在本宿主里无效）`, '宿主给的是确定高度 + overflow:hidden 容器，min-h-full 的 100% 解析为 auto → 内容被裁且没有滚动条。改用「flex h-full min-h-0 flex-col overflow-y-auto [&>*]:shrink-0」，并用 scrollHeight 验证。', scrollRoots);
  }

  return {
    ext: path.basename(dir),
    fileCount: { code: codeFiles.length, css: cssFiles.length },
    cssTotal,
    customClassCount: customAll.size,
    inlineTotal,
    issues,
  };
}

function resolveTargets() {
  if (targets.length) return targets.map((t) => path.resolve(t));
  if (!fs.existsSync(DEFAULT_ROOT)) {
    console.error(`找不到默认示例目录: ${DEFAULT_ROOT}`);
    process.exit(2);
  }
  return fs.readdirSync(DEFAULT_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(DEFAULT_ROOT, e.name));
}

const results = resolveTargets().filter((d) => fs.existsSync(d)).map(auditExtension);

if (asJson) {
  console.log(JSON.stringify({ limits: LIMITS, results }, null, 2));
} else {
  const ICON = { error: '✗', advice: '·' };
  let fails = 0;
  let warns = 0;
  for (const r of results) {
    const errs = r.issues.filter((i) => i.level === 'error');
    const advs = r.issues.filter((i) => i.level === 'advice');
    fails += errs.length;
    warns += advs.length;
    const verdict = errs.length ? 'FAIL' : 'PASS';
    console.log(`\n${verdict === 'PASS' ? '✓' : '✗'} ${r.ext}  [${verdict}]`);
    console.log(`  代码 ${r.fileCount.code} 个 / CSS ${r.fileCount.css} 个（${r.cssTotal} 行）/ 自定义类 ${r.customClassCount} 个 / 内联 style ${r.inlineTotal} 处`);
    if (!r.issues.length) console.log('  无问题');
    for (const i of r.issues) {
      console.log(`  ${ICON[i.level]} ${i.code}: ${i.msg}`);
      console.log(`     → ${i.hint}`);
      for (const s2 of i.sample) console.log(`       · ${s2}`);
    }
  }

  const failed = strict ? fails + warns : fails;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`合计：${results.length} 个扩展，必须修 ${fails} 项，建议 ${warns} 项${strict ? '（strict：建议也计入失败）' : ''}`);
  process.exit(failed > 0 ? 1 : 0);
}
