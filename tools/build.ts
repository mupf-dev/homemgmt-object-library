// Katalog prüfen und bauen.
//   node tools/build.ts --check   nur prüfen (Pull Requests)
//   node tools/build.ts           prüfen und _site/ erzeugen: index.json, objekte/, modelle/, vorschau/, index.html
// Ohne Abhängigkeiten; braucht Node ≥ 22.18 (TypeScript direkt ausführbar).

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
    err(`kein gültiges JSON (${(e as Error).message})`);
    continue;
  }
  let t: ObjectType;
  try {
    t = validateObjectType(raw);
  } catch (e) {
    err((e as Error).message);
    continue;
  }
  if (raw.format !== OBJECT_FORMAT) err(`"format" muss "${OBJECT_FORMAT}" sein`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err('Dateiname: nur Kleinbuchstaben, Ziffern und Bindestriche');
  if (t.id !== `community.${slug}`) err(`"id" muss "community.${slug}" sein (passend zum Dateinamen)`);
  if (seen.has(t.id)) err(`Kennung doppelt (auch in ${seen.get(t.id)})`);
  seen.set(t.id, file);
  if (!t.author?.trim()) err('"author" fehlt');
  if (!t.license || !LICENSES.includes(t.license)) err(`"license" muss eine freie Lizenz sein: ${LICENSES.join(', ')}`);
  if (t.build.type === 'modell') {
    const m = t.build.model;
    if (m.url) err('"model.url" ist eine lokale Adresse – bitte entfernen und "model.file" angeben');
    if (!m.file) err('"model.file" fehlt (Pfad zum .glb unter modelle/)');
    else if (!/^modelle\/[\w.-]+\.glb$/.test(m.file)) err('"model.file" muss unter modelle/ liegen und auf .glb enden');
    else if (!existsSync(join(ROOT, m.file))) err(`${m.file} gibt es nicht`);
    else if (statSync(join(ROOT, m.file)).size > MAX_MODEL) err(`${m.file} ist größer als 50 MB`);
  }
  entries.push({ t, file, slug, places: objectCompartments(t, t.size.width, t.size.depth, t.size.height).length });
}

if (errors.length) {
  console.error(`✗ ${errors.length} Fehler:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓ ${entries.length} Möbelarten geprüft`);
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
console.log(`✓ _site/ gebaut (${entries.length} Möbelarten)`);

/** Vorderansicht als SVG (wie das Symbol in der App, größer) */
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

function gallery() {
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const groups = [...new Set(entries.map((e) => e.t.group))];
  const cards = entries.map(({ t, file, slug, places }) => `
      <article class="card" data-group="${esc(t.group)}" data-q="${esc(`${t.name} ${t.group} ${t.description ?? ''} ${t.author}`.toLowerCase())}">
        <img src="vorschau/${slug}.svg" alt="" loading="lazy" />
        <h3>${esc(t.name)}</h3>
        <p class="meta">${esc(t.group)} · ${t.size.width} × ${t.size.depth} × ${t.size.height} cm · <b>${places} Fächer</b></p>
        ${t.description ? `<p>${esc(t.description)}</p>` : ''}
        <p class="meta">Version ${esc(t.version)} · ${esc(t.author)} · ${esc(t.license)}${t.build.type === 'modell' ? ' · 3D-Modell' : ''}</p>
        <a href="${file}" download>JSON herunterladen</a>
      </article>`).join('');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Homemgmt Object Library</title>
<meta name="description" content="Community-Katalog mit Möbelarten für Zuhause (Homemgmt): Schränke, Regale, Kommoden – jedes Fach wird ein Lagerplatz." />
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
  <p class="lead">Möbelarten für <a href="https://github.com/mupf-dev/Homemgmt">Zuhause</a> – Schränke, Regale, Kommoden. Jedes Fach wird im Hausplan ein Lagerplatz. Installieren in der App unter <b>Mehr → Objektbibliothek → Community</b>.</p>
  <div class="bar">
    <input id="q" type="search" placeholder="Suchen …" aria-label="Möbelarten suchen" />
    <button class="chip on" data-g="">Alle (${entries.length})</button>
    ${groups.map((g) => `<button class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join('')}
  </div>
  <div class="grid" id="grid">${cards}</div>
  <section class="how">
    <h2>Eigene Möbelart beisteuern</h2>
    <ol>
      <li>In Zuhause unter <b>Mehr → Objektbibliothek</b> eine Möbelart bauen und <b>Exportieren</b>.</li>
      <li>Datei als <code>objekte/&lt;name&gt;.json</code> ablegen, <code>"id": "community.&lt;name&gt;"</code> setzen, freie Lizenz angeben.</li>
      <li><a href="https://github.com/mupf-dev/homemgmt-object-library">Pull Request</a> öffnen – die Prüfung läuft automatisch, nach dem Merge erscheint die Möbelart hier und in allen Installationen.</li>
    </ol>
    <p class="meta">Für Programme: <a href="index.json">index.json</a> (Format <code>zuhause-katalog/1</code>).</p>
  </section>
  <footer>Stand ${new Date().toISOString().slice(0, 10)} · Inhalte unter der jeweils angegebenen freien Lizenz.</footer>
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
