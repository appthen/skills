#!/usr/bin/env node
/**
 * 技能分发完整性自检（发布前 / 安装后必跑）。
 *
 * 背景（2026-11-05 真实事故）：某落地器对"含子目录的技能"与"只有 SKILL.md 的
 * 技能"走了不同分支——前者 symlink 完整树，后者只落地 SKILL.md，docs/references/
 * scripts/examples 整树静默丢失，消费方 agent 的 11 条引用全部断链且无任何报错。
 *
 * 三条规则：
 *   R1 技能内每条相对链接（markdown link + inline code 路径）必须能从所在文件解析到
 *      技能根内的真实文件；
 *   R2 禁止跨技能相对引用（../<其他技能>/…）——单一技能分发场景必断，需要共享
 *      内容就拷贝进本技能（ui-design-quality.md 是先例）；
 *   R3 （可选，--manifest <清单文件>）实际文件集合必须与清单一致——抓"落地丢树"。
 *
 * 用法：
 *   node verify-skill.mjs                    # 在技能根目录内运行
 *   node verify-skill.mjs --manifest m.json  # 额外校验文件清单
 *   node verify-skill.mjs --root <技能目录>  # 指定技能根（默认脚本所在目录的上一级）
 *
 * 退出码：0 = 通过；1 = 发现断链/跨技能引用/清单不一致（任何一项都报错，不静默降级）。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// --root 显式指定时直接使用；未指定时从脚本位置推导（脚本位于 <技能根>/scripts/）。
// 不要对显式 root 再做「上一级」处理——曾因此把 .qoder/skills/appthen-extension
// 解析成 .qoder/skills，误扫相邻技能。
const explicitRoot = flag('--root');
const skillRoot = explicitRoot
  ? path.resolve(explicitRoot)
  : path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = flag('--manifest');
const problems = [];
const checkedLinks = [];

/** 递归收集技能根内所有文本文件 */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(skillRoot);
const relOf = (p) => path.relative(skillRoot, p).split(path.sep).join('/');

/** 从一行文本提取相对路径引用（markdown link + 反引号内路径） */
function extractRefs(line) {
  const refs = [];
  // markdown 链接：[text](path)
  for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) refs.push({ raw: m[1], kind: 'link' });
  // inline code 中的技能内路径：`docs/...` `references/...` `scripts/...` `examples/...`
  for (const m of line.matchAll(/`((?:docs|references|scripts|examples|agents)\/[A-Za-z0-9][A-Za-z0-9/._-]+)`/g)) {
    refs.push({ raw: m[1], kind: 'code' });
  }
  return refs;
}

for (const file of allFiles) {
  if (!/\.(md|yaml|yml|json)$/.test(file)) continue;
  const relFile = relOf(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    for (const { raw, kind } of extractRefs(line)) {
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      const anchorless = raw.split('#')[0];
      if (!anchorless) continue;

      // R2：跨技能相对引用，硬禁
      const crossSkill = anchorless.match(/^\.\.\/(?!\/)([\w.-]+)\//);
      if (crossSkill && fs.existsSync(path.dirname(anchorless)) === false) {
        // ../appthen-application/... 形态：目标在技能根之外 → 一律报错
      }
      if (/^\.\.\//.test(anchorless)) {
        const resolved = path.resolve(path.dirname(file), anchorless);
        if (!resolved.startsWith(skillRoot + path.sep) && resolved !== skillRoot) {
          problems.push(
            `R2 跨技能引用（硬禁，需拷贝进本技能）: ${relFile}:${idx + 1} → ${anchorless}`,
          );
          continue;
        }
      }

      // R1：技能内相对引用必须可解析
      if (!path.isAbsolute(anchorless) && !/^[a-z]+:/.test(anchorless)) {
        const resolved = path.resolve(path.dirname(file), anchorless);
        if (!resolved.startsWith(skillRoot)) continue; // 超出技能根的已在 R2 处理
        if (!fs.existsSync(resolved)) {
          problems.push(`R1 断链: ${relFile}:${idx + 1} → ${anchorless}`);
        } else {
          checkedLinks.push(`${relFile} → ${anchorless}`);
        }
      }
    }
  });
}

// R3：文件清单比对（抓"落地丢树"——SKILL.md 在但子目录整树丢失）
if (manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = (manifest.files || []).map((f) => f.replace(/^\.\//, '')).sort();
  const actual = allFiles.map(relOf).sort();
  const missing = expected.filter((f) => !actual.includes(f));
  const extra = actual.filter((f) => !expected.includes(f));
  if (missing.length) problems.push(`R3 清单缺失 ${missing.length} 文件（落地丢树）:\n  ` + missing.join('\n  '));
  if (extra.length) problems.push(`R3 清单外多出 ${extra.length} 文件:\n  ` + extra.join('\n  '));
} else if (fs.existsSync(path.join(skillRoot, 'package.json'))) {
  // 无清单时至少验证：SKILL.md 存在 + 除 SKILL.md 外还有其他文件（抓"只落地了 SKILL.md"）
  const hasSkillMd = fs.existsSync(path.join(skillRoot, 'SKILL.md'));
  const others = allFiles.filter((f) => relOf(f) !== 'SKILL.md' && relOf(f) !== '.npmignore');
  if (!hasSkillMd) problems.push('R3 SKILL.md 缺失');
  if (hasSkillMd && others.length === 0) {
    problems.push('R3 整树丢失：技能根除 SKILL.md 外没有任何文件（典型落地器丢树症状）');
  }
}

if (problems.length) {
  console.error(`✗ verify-skill: ${problems.length} 个问题（技能根: ${skillRoot}）\n`);
  for (const p of problems) console.error('  · ' + p);
  console.error(`\n  已校验 ${checkedLinks.length} 条技能内链接。`);
  process.exit(1);
}
console.log(`✓ verify-skill: 通过（${checkedLinks.length} 条链接全部可解析，无跨技能引用${manifestPath ? '，清单一致' : ''}）`);
