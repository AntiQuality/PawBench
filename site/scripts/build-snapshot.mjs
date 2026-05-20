// Bundles the React snapshot app into a single self-contained HTML file.
// Output: ../pawbench-snapshot.html (project root)
//
// Usage:
//   node scripts/build-snapshot.mjs
//
// Strategy:
//   1. esbuild bundles src/snapshot/entry.tsx → IIFE JS (React + components + JSX inlined)
//   2. tailwindcss CLI compiles src/styles + src/components → minified CSS
//   3. Reads the three data JSONs and zh/en i18n strings
//   4. Templates everything into scripts/snapshot-template.html

import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..');
const ROOT = resolve(SITE, '..');

const TEMPLATE = resolve(SITE, 'scripts/snapshot-template.html');
const CSS_INPUT = resolve(SITE, 'scripts/snapshot-input.css');
const JS_ENTRY = resolve(SITE, 'src/snapshot/entry.tsx');
const TMP_DIR = resolve(SITE, '.snapshot-tmp');
const OUT = resolve(ROOT, 'pawbench-snapshot.html');

await mkdir(TMP_DIR, { recursive: true });

console.log('[snapshot] bundling JS with esbuild…');
const jsResult = await build({
  entryPoints: [JS_ENTRY],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  treeShaking: true,
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  alias: { '@': resolve(SITE, 'src') },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.BASE_URL': '"/"',
  },
  legalComments: 'none',
  write: false,
});
const js = jsResult.outputFiles[0].text;
console.log(`[snapshot]   → JS ${(js.length / 1024).toFixed(1)} KB`);

console.log('[snapshot] compiling Tailwind CSS…');
const cssOut = resolve(TMP_DIR, 'snapshot.css');
await execFileP(
  resolve(SITE, 'node_modules/.bin/tailwindcss'),
  ['-i', CSS_INPUT, '-o', cssOut, '--minify', '--config', resolve(SITE, 'tailwind.config.mjs')],
  { cwd: SITE }
);
const css = await readFile(cssOut, 'utf8');
console.log(`[snapshot]   → CSS ${(css.length / 1024).toFixed(1)} KB`);

console.log('[snapshot] loading data + i18n…');
const [stats, leaderboard, rawTasks, zh, en] = await Promise.all([
  readJson(resolve(SITE, 'src/data/stats.json')),
  readJson(resolve(SITE, 'src/data/leaderboard.json')),
  readJson(resolve(SITE, 'src/data/tasks.json')),
  readJson(resolve(SITE, 'src/i18n/zh.json')),
  readJson(resolve(SITE, 'src/i18n/en.json')),
]);

// Trim per-task fields that the snapshot UI never reads, to keep file size reasonable.
// Removed: automated_checks (large Python source), rubric (long text), workspace_files,
// and a handful of metadata fields that aren't surfaced in TaskExplorer / TaskModal.
const tasks = rawTasks.map((t) => {
  const { sections = {}, labels: lab = {}, ...rest } = t;
  const trimmedSections = {
    prompt:           sections.prompt           ?? null,
    expected:         sections.expected         ?? null,
    grading_criteria: sections.grading_criteria ?? null,
  };
  return {
    t_id:           rest.t_id,
    task_id:        rest.task_id ?? null,
    name:           rest.name,
    source_dataset: rest.source_dataset ?? null,
    source_path:    rest.source_path ?? null,
    grading_type:   rest.grading_type ?? null,
    labels: {
      complexity:   lab.complexity   ?? null,
      capabilities: lab.capabilities ?? [],
      modality:     lab.modality     ?? { type: 'text', channels: [] },
    },
    sections: trimmedSections,
  };
});
const rawSize  = JSON.stringify(rawTasks).length;
const trimSize = JSON.stringify(tasks).length;
console.log(`[snapshot]   trimmed tasks ${(rawSize / 1024).toFixed(1)} → ${(trimSize / 1024).toFixed(1)} KB`);

const blog = {
  zh: await loadBlog(resolve(SITE, 'src/content/blog/zh')),
  en: await loadBlog(resolve(SITE, 'src/content/blog/en')),
};
console.log(`[snapshot]   loaded ${blog.zh.length} zh + ${blog.en.length} en blog post(s)`);

const labels = {
  zh: { ...zh, 'tab.leaderboard': 'Leaderboard', 'tab.slice': 'Slice', 'tab.tasks': 'Tasks', 'tab.blog': 'Blog', 'snapshot.badge': '快照' },
  en: { ...en, 'tab.leaderboard': 'Leaderboard', 'tab.slice': 'Slice', 'tab.tasks': 'Tasks', 'tab.blog': 'Blog', 'snapshot.badge': 'Snapshot' },
};

const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  stats,
  leaderboard,
  tasks,
  blog,
  labels,
};
const dataJson = JSON.stringify(data);
console.log(`[snapshot]   → DATA ${(dataJson.length / 1024).toFixed(1)} KB`);

console.log('[snapshot] templating HTML…');
let html = await readFile(TEMPLATE, 'utf8');
html = html
  .replace('__CSS__',  () => css)
  .replace('__DATA__', () => dataJson)
  .replace('__JS__',   () => js);

await writeFile(OUT, html, 'utf8');
const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`[snapshot] wrote ${OUT}`);
console.log(`[snapshot]   total ${sizeKB} KB`);

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function loadBlog(dir) {
  let entries = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const posts = [];
  for (const f of entries) {
    if (!f.endsWith('.md')) continue;
    const raw = await readFile(resolve(dir, f), 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    posts.push({
      slug: basename(f, '.md'),
      title: String(frontmatter.title ?? f),
      description: String(frontmatter.description ?? ''),
      pubDate: String(frontmatter.pubDate ?? ''),
      author: String(frontmatter.author ?? ''),
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      body,
    });
  }
  posts.sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
  return posts;
}

// Tiny YAML-ish frontmatter parser (only what we need: scalars + simple [a, b] lists).
function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(src);
  if (!m) return { frontmatter: {}, body: src };
  const fm = {};
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"'))      val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      fm[key] = val;
    }
  }
  return { frontmatter: fm, body: m[2] };
}
