// Check and build the catalog.
//   node tools/build.ts --check   check only (pull requests)
//   node tools/build.ts           check and generate _site/: index.json, objekte/, modelle/, vorschau/, index.html
// No dependencies; needs Node ≥ 22.18 (runs TypeScript directly).

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { korpusLayout, objectCompartments, OBJECT_FORMAT, validateObjectType, type ObjectType } from './objects.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, '_site');
const CHECK = process.argv.includes('--check');
const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0'];
const MAX_MODEL = 50 * 1024 * 1024;

const errors: string[] = [];
const entries: { t: ObjectType; file: string; slug: string; places: number }[] = [];
const seen = new Map<string, string>();

for (const name of readdirSync(join(ROOT, 'objekte')).filter((f) => f.endsWith('.json')).sort()) {
  const file = `objekte/${name}`;
  const slug = name.replace(/\.json$/, '');
  const err = (m: string) => errors.push(`${file}: ${m}`);
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  } catch (e) {
    err(`not valid JSON (${(e as Error).message})`);
    continue;
  }
  let t: ObjectType;
  try {
    t = validateObjectType(raw);
  } catch (e) {
    err((e as Error).message);
    continue;
  }
  if (raw.format !== OBJECT_FORMAT) err(`"format" must be "${OBJECT_FORMAT}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err('file name: only lowercase letters, digits and hyphens');
  if (t.id !== `community.${slug}`) err(`"id" must be "community.${slug}" (matching the file name)`);
  if (seen.has(t.id)) err(`duplicate identifier (also in ${seen.get(t.id)})`);
  seen.set(t.id, file);
  if (!t.author?.trim()) err('"author" is missing');
  if (!t.license || !LICENSES.includes(t.license)) err(`"license" must be a free license: ${LICENSES.join(', ')}`);
  if (t.build.type === 'modell') {
    const m = t.build.model;
    if (m.url) err('"model.url" is a local address – please remove it and specify "model.file"');
    if (!m.file) err('"model.file" is missing (path to the .glb in modelle/)');
    else if (!/^modelle\/[\w.-]+\.glb$/.test(m.file)) err('"model.file" must be in modelle/ and end with .glb');
    else if (!existsSync(join(ROOT, m.file))) err(`${m.file} does not exist`);
    else if (statSync(join(ROOT, m.file)).size > MAX_MODEL) err(`${m.file} is larger than 50 MB`);
  }
  entries.push({ t, file, slug, places: objectCompartments(t, t.size.width, t.size.depth, t.size.height).length });
}

if (errors.length) {
  console.error(`✗ ${errors.length} error(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓ ${entries.length} furniture types checked`);
if (CHECK) process.exit(0);

entries.sort((a, b) => a.t.group.localeCompare(b.t.group, 'de') || a.t.name.localeCompare(b.t.name, 'de'));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'vorschau'), { recursive: true });
cpSync(join(ROOT, 'objekte'), join(OUT, 'objekte'), { recursive: true });
cpSync(join(ROOT, 'modelle'), join(OUT, 'modelle'), { recursive: true, filter: (f) => !f.endsWith('.gitkeep') });
writeFileSync(join(OUT, '.nojekyll'), '');

for (const e of entries) writeFileSync(join(OUT, 'vorschau', `${e.slug}.svg`), preview(e.t));
writeFileSync(join(OUT, 'index.json'), JSON.stringify({
  format: 'zuhause-katalog/1',
  name: 'Homemgmt Object Library',
  updated: new Date().toISOString().slice(0, 10),
  objects: entries.map(({ t, file, slug, places }) => ({
    id: t.id, name: t.name, group: t.group, version: t.version, author: t.author, license: t.license,
    description: t.description ?? '', file, preview: `vorschau/${slug}.svg`,
    size: [t.size.width, t.size.depth, t.size.height], places, model: t.build.type === 'modell',
  })),
}, null, 2) + '\n');
writeFileSync(join(OUT, 'index.html'), gallery());
console.log(`✓ _site/ built (${entries.length} furniture types)`);

/** Front view as SVG (like the icon in the app, larger) */
function preview(t: ObjectType) {
  const w = 240;
  const h = 180;
  const st = (width = 1.6) => `stroke="#3d3a35" fill="none" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;
  const s = st();
  if (t.build.type === 'modell') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="M120 30 170 58v64l-50 28-50-28V58z M70 58l50 28 50-28M120 86v64" ${s}/></svg>`;
  }
  const W = t.size.width;
  const H = t.size.height;
  const k = Math.min((w - 20) / W, (h - 20) / H);
  const ox = (w - W * k) / 2;
  const oy = (h - H * k) / 2;
  const X = (x: number) => (ox + (x + W / 2) * k).toFixed(1);
  const Y = (y: number) => (oy + (H - y) * k).toFixed(1);
  let d = `<rect x="${X(-W / 2)}" y="${Y(H)}" width="${(W * k).toFixed(1)}" height="${(H * k).toFixed(1)}" fill="#efe9df" stroke="#3d3a35" stroke-width="1.6"/>`;
  const ct = t.build.countertop;
  if (ct) d += `<rect x="${X(-W / 2)}" y="${Y(H)}" width="${(W * k).toFixed(1)}" height="${(ct.thickness * k).toFixed(1)}" fill="#b89a74" stroke="#3d3a35" stroke-width="1.6"/>`;
  for (const col of korpusLayout(t.build, W, H)) {
    for (const { el, y0, y1 } of col.elements) {
      const fill = el.kind === 'open' ? '#d9d1c4' : el.kind === 'cold' || el.kind === 'freezer' ? '#e4ecf2' : '#fbf8f3';
      d += `<rect x="${X(col.x0)}" y="${Y(y1)}" width="${((col.x1 - col.x0) * k).toFixed(1)}" height="${((y1 - y0) * k).toFixed(1)}" fill="${fill}" stroke="#3d3a35" stroke-width="1.6"/>`;
      const cx = (col.x0 + col.x1) / 2;
      const gw = Math.min(16, (col.x1 - col.x0) * 0.4);
      if (el.kind === 'drawer' || el.kind === 'flap' || el.kind === 'freezer') d += `<path d="M${X(cx - gw / 2)} ${Y(y1 - Math.min(6, (y1 - y0) * 0.25))}H${X(cx + gw / 2)}" ${st(2.4)}/>`;
      if (el.kind === 'open') for (let i = 1; i < (el.shelves ?? 1); i++) d += `<path d="M${X(col.x0)} ${Y(y1 - ((y1 - y0) * i) / (el.shelves ?? 1))}H${X(col.x1)}" ${s} stroke-dasharray="4 3"/>`;
      if (el.kind === 'washer' || el.kind === 'dryer') {
        const r = Math.min((col.x1 - col.x0) * 0.32, (y1 - y0) * 0.3) * k;
        d += `<path d="M${X(col.x0)} ${Y(y1 - Math.min(13, (y1 - y0) * 0.3))}H${X(col.x1)}" ${s}/><circle cx="${X(cx)}" cy="${Y(y0 + (y1 - y0) * 0.42)}" r="${r.toFixed(1)}" fill="#cfd6db" ${st(2.4).replace('fill="none" ', '')}/>`;
      }
      if (el.kind === 'door' || el.kind === 'cold') d += `<path d="M${X(col.x1 - 4)} ${Y((y0 + y1) / 2 + 6)}V${Y((y0 + y1) / 2 - 6)}" ${st(2.4)}/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${d}</svg>`;
}

/** English labels for the gallery only; `group` in the data stays as the app uses it */
function groupLabel(g: string) {
  const labels: Record<string, string> = {
    Arbeitszimmer: 'Study', Bad: 'Bathroom', Diele: 'Hallway', 'Garten & Garage': 'Garden & garage',
    'Keller & Hauswirtschaft': 'Basement & utility room', Kinderzimmer: "Children's room", Küche: 'Kitchen',
    Schlafzimmer: 'Bedroom', 'Schränke & Regale': 'Cabinets & shelf units', Werkstatt: 'Workshop', Wohnzimmer: 'Living room',
  };
  return labels[g] ?? g;
}

function gallery() {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const groups = [...new Set(entries.map((e) => e.t.group))];
  const cards = entries.map(({ t, file, slug, places }) => `
      <article class="card" data-group="${esc(t.group)}" data-q="${esc(`${t.name} ${t.group} ${groupLabel(t.group)} ${t.description ?? ''} ${t.author}`.toLowerCase())}">
        <img src="vorschau/${slug}.svg" alt="" loading="lazy" />
        <h3>${esc(t.name)}</h3>
        <p class="meta">${esc(groupLabel(t.group))} · ${t.size.width} × ${t.size.depth} × ${t.size.height} cm · <b>${places} compartments</b></p>
        ${t.description ? `<p>${esc(t.description)}</p>` : ''}
        <p class="meta">Version ${esc(t.version)} · ${esc(t.author)} · ${esc(t.license)}${t.build.type === 'modell' ? ' · 3D model' : ''}</p>
        <a href="${file}" download>Download JSON</a>
      </article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Homemgmt Object Library</title>
<meta name="description" content="Community catalog of furniture types for homemgmt-ng: cabinets, shelf units, chests of drawers – every compartment becomes a location." />
<style>
  :root { --bg: #f6f3ee; --panel: #fff; --ink: #24221f; --soft: #6b665e; --line: #e2ddd4; --accent: #c8582a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1b1a18; --panel: #252321; --ink: #eeeae4; --soft: #a7a197; --line: #3a3733; --accent: #e9814f; } .card img { background: #efe9df; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px 16px 60px; }
  h1 { margin: 0 0 4px; font-size: 28px; }
  .lead { color: var(--soft); max-width: 720px; }
  a { color: var(--accent); }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 14px; }
  .bar input { flex: 1 1 220px; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: inherit; }
  .chip { padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; font: inherit; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
  .card[hidden] { display: none; }
  .card img { width: 100%; aspect-ratio: 4 / 3; border-radius: 9px; }
  .card h3 { margin: 6px 0 0; font-size: 17px; }
  .card p { margin: 0; }
  .meta { color: var(--soft); font-size: 13px; }
  .card a { margin-top: auto; padding-top: 6px; font-size: 14px; }
  section.how { margin-top: 40px; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 6px 20px 16px; }
  code { background: var(--bg); padding: 1px 5px; border-radius: 5px; }
  footer { margin-top: 30px; color: var(--soft); font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>Homemgmt Object Library</h1>
  <p class="lead">Furniture types for <a href="https://github.com/mupf-dev/Homemgmt">homemgmt-ng</a> – cabinets, shelf units, chests of drawers. Every compartment becomes a location in the house plan. Install them in the app under <b>More → Object library → Community</b>.</p>
  <div class="bar">
    <input id="q" type="search" placeholder="Search …" aria-label="Search furniture types" />
    <button class="chip on" data-g="">All (${entries.length})</button>
    ${groups.map((g) => `<button class="chip" data-g="${esc(g)}">${esc(groupLabel(g))}</button>`).join('')}
  </div>
  <div class="grid" id="grid">${cards}</div>
  <section class="how">
    <h2>Contribute your own furniture type</h2>
    <ol>
      <li>In homemgmt-ng, build a furniture type under <b>More → Object library</b> and <b>Export</b> it.</li>
      <li>Save the file as <code>objekte/&lt;name&gt;.json</code>, set <code>"id": "community.&lt;name&gt;"</code> and specify a free license.</li>
      <li>Open a <a href="https://github.com/mupf-dev/homemgmt-object-library">pull request</a> – the check runs automatically; after the merge, the furniture type appears here and in all installations.</li>
    </ol>
    <p class="meta">For programs: <a href="index.json">index.json</a> (format <code>zuhause-katalog/1</code>).</p>
  </section>
  <footer>Updated ${new Date().toISOString().slice(0, 10)} · Content available under the free license stated for each item.</footer>
</main>
<script>
  const q = document.getElementById('q');
  let group = '';
  const apply = () => {
    const s = q.value.trim().toLowerCase();
    document.querySelectorAll('.card').forEach((c) => { c.hidden = (group && c.dataset.group !== group) || (s && !c.dataset.q.includes(s)); });
  };
  q.addEventListener('input', apply);
  document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    group = b.dataset.g;
    document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
    apply();
  }));
</script>
</body>
</html>
`;
}
