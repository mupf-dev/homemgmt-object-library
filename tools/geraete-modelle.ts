// Erzeugt einfache 3D-Modelle (.glb) für Haushaltsgeräte, die ein Korpus nicht darstellen kann (rundes Bullauge,
// Bedienblende). Ohne Abhängigkeiten: Quader und Zylinder werden direkt als glTF-Binärdatei geschrieben.
//   node tools/geraete-modelle.ts   → modelle/waschmaschine.glb, modelle/trockner.glb
// Einheiten Meter, Ursprung Mitte unten, Front zeigt nach +Z (wie Korpus-Möbel in Zuhause).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

interface Mat { name: string; color: [number, number, number]; metallic?: number; roughness?: number; alpha?: number }
interface Geo { pos: number[]; nrm: number[]; idx: number[] }

class Model {
  parts = new Map<Mat, Geo>();
  private geo(m: Mat) {
    let g = this.parts.get(m);
    if (!g) this.parts.set(m, (g = { pos: [], nrm: [], idx: [] }));
    return g;
  }
  private quad(m: Mat, a: number[], b: number[], c: number[], d: number[], n: number[]) {
    const g = this.geo(m);
    const i = g.pos.length / 3;
    g.pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) g.nrm.push(...n);
    g.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  /** Quader von x0..x1, y0..y1, z0..z1 */
  box(m: Mat, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    this.quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    this.quad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    this.quad(m, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    this.quad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    this.quad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    this.quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }
  /** Ring (rIn = 0: Scheibe) um die Achse z bei (cx, cy), Tiefe z0..z1 */
  ring(m: Mat, cx: number, cy: number, rIn: number, rOut: number, z0: number, z1: number, seg = 48) {
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2;
      const a1 = ((s + 1) / seg) * Math.PI * 2;
      const p = (r: number, a: number, z: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
      // Außenmantel
      this.quad(m, p(rOut, a0, z1), p(rOut, a0, z0), p(rOut, a1, z0), p(rOut, a1, z1), [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
      if (rIn > 0) {
        this.quad(m, p(rIn, a1, z1), p(rIn, a1, z0), p(rIn, a0, z0), p(rIn, a0, z1), [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0]);
        this.quad(m, p(rIn, a0, z1), p(rOut, a0, z1), p(rOut, a1, z1), p(rIn, a1, z1), [0, 0, 1]);
        this.quad(m, p(rOut, a0, z0), p(rIn, a0, z0), p(rIn, a1, z0), p(rOut, a1, z0), [0, 0, -1]);
      } else {
        this.quad(m, [cx, cy, z1], p(rOut, a0, z1), p(rOut, a1, z1), [cx, cy, z1], [0, 0, 1]);
        this.quad(m, [cx, cy, z0], p(rOut, a1, z0), p(rOut, a0, z0), [cx, cy, z0], [0, 0, -1]);
      }
    }
  }

  glb(name: string) {
    const bins: Buffer[] = [];
    let offset = 0;
    const bufferViews: any[] = [];
    const accessors: any[] = [];
    const add = (data: Buffer, target: number) => {
      const pad = (4 - (data.length % 4)) % 4;
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, target });
      bins.push(data, Buffer.alloc(pad));
      offset += data.length + pad;
      return bufferViews.length - 1;
    };
    const materials: any[] = [];
    const meshes: any[] = [];
    for (const [m, g] of this.parts) {
      const pos = Float32Array.from(g.pos);
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i++) {
        min[i % 3] = Math.min(min[i % 3], pos[i]);
        max[i % 3] = Math.max(max[i % 3], pos[i]);
      }
      const n = pos.length / 3;
      accessors.push({ bufferView: add(Buffer.from(pos.buffer), 34962), componentType: 5126, count: n, type: 'VEC3', min, max });
      accessors.push({ bufferView: add(Buffer.from(Float32Array.from(g.nrm).buffer), 34962), componentType: 5126, count: n, type: 'VEC3' });
      accessors.push({ bufferView: add(Buffer.from(Uint32Array.from(g.idx).buffer), 34963), componentType: 5125, count: g.idx.length, type: 'SCALAR' });
      materials.push({
        name: m.name,
        doubleSided: true,
        pbrMetallicRoughness: { baseColorFactor: [...m.color, m.alpha ?? 1], metallicFactor: m.metallic ?? 0, roughnessFactor: m.roughness ?? 0.5 },
        ...(m.alpha != null && m.alpha < 1 ? { alphaMode: 'BLEND' } : {}),
      });
      const a = accessors.length - 3;
      meshes.push({ name: m.name, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: materials.length - 1 }] });
    }
    const json = {
      asset: { version: '2.0', generator: 'homemgmt-object-library/tools/geraete-modelle.ts' },
      scene: 0,
      scenes: [{ name, nodes: meshes.map((_, i) => i) }],
      nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
      meshes, materials, accessors, bufferViews,
      buffers: [{ byteLength: offset }],
    };
    const bin = Buffer.concat(bins);
    let js = Buffer.from(JSON.stringify(json));
    js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
    const chunk = (type: number, data: Buffer) => {
      const h = Buffer.alloc(8);
      h.writeUInt32LE(data.length, 0);
      h.writeUInt32LE(type, 4);
      return Buffer.concat([h, data]);
    };
    return Buffer.concat([header, chunk(0x4e4f534a, js), chunk(0x004e4942, bin)]);
  }
}

const WHITE: Mat = { name: 'Gehäuse', color: [0.93, 0.93, 0.92], roughness: 0.35 };
const PANEL: Mat = { name: 'Bedienblende', color: [0.78, 0.79, 0.8], roughness: 0.3 };
const SEAM: Mat = { name: 'Fuge', color: [0.35, 0.36, 0.38], roughness: 0.6 };
const DARK: Mat = { name: 'Display', color: [0.04, 0.05, 0.06], roughness: 0.15 };
const GRAPHITE: Mat = { name: 'Graphit', color: [0.22, 0.23, 0.25], roughness: 0.4 };
const CHROME: Mat = { name: 'Chrom', color: [0.8, 0.81, 0.83], metallic: 1, roughness: 0.22 };
const STEEL: Mat = { name: 'Trommel', color: [0.55, 0.56, 0.58], metallic: 1, roughness: 0.45 };
const GLASS: Mat = { name: 'Glas', color: [0.25, 0.3, 0.35], roughness: 0.05, alpha: 0.4 };
const FEET: Mat = { name: 'Füße', color: [0.12, 0.12, 0.12], roughness: 0.8 };

/** Frontlader-Grundkörper: W × D × H in m, Front bei z = +D/2 */
function frontloader(W: number, D: number, H: number, ring: Mat, drawerW: number) {
  const m = new Model();
  const x0 = -W / 2, x1 = W / 2, zb = -D / 2, zf = D / 2 - 0.035;
  const feet = 0.012;
  for (const [fx, fz] of [[x0 + 0.04, zb + 0.04], [x1 - 0.07, zb + 0.04], [x0 + 0.04, zf - 0.07], [x1 - 0.07, zf - 0.07]]) m.box(FEET, fx, fx + 0.03, 0, feet, fz, fz + 0.03);
  m.box(WHITE, x0, x1, feet, H, zb, zf);
  // Bedienblende oben
  const pTop = H - 0.004, pBot = H - 0.135;
  m.box(PANEL, x0 + 0.002, x1 - 0.002, pBot, pTop, zf, zf + 0.012);
  m.box(SEAM, x0 + 0.002, x1 - 0.002, pBot - 0.006, pBot, zf, zf + 0.006); // Fuge unter der Blende
  m.box(SEAM, x0 + 0.012, x0 + 0.018 + drawerW, pBot + 0.015, pTop - 0.015, zf + 0.012, zf + 0.013); // Fuge um die Schublade
  m.box(WHITE, x0 + 0.015, x0 + 0.015 + drawerW, pBot + 0.018, pTop - 0.018, zf + 0.013, zf + 0.019); // Schublade
  m.box(GRAPHITE, x0 + 0.03, x0 + 0.03 + Math.min(0.08, drawerW - 0.03), pBot + 0.024, pBot + 0.034, zf + 0.019, zf + 0.022); // Griffmulde
  m.box(DARK, x0 + drawerW + 0.06, x0 + drawerW + 0.2, pBot + 0.04, pTop - 0.04, zf + 0.012, zf + 0.016); // Display
  m.ring(CHROME, x1 - 0.085, (pBot + pTop) / 2, 0, 0.034, zf + 0.012, zf + 0.032); // Drehknopf
  m.box(DARK, x1 - 0.088, x1 - 0.082, (pBot + pTop) / 2 + 0.012, (pBot + pTop) / 2 + 0.03, zf + 0.032, zf + 0.034);
  // Front unten mit Bullauge
  m.box(WHITE, x0 + 0.002, x1 - 0.002, feet + 0.03, pBot - 0.004, zf, zf + 0.008);
  const cy = (feet + 0.03 + pBot) / 2 + 0.01;
  const rOut = Math.min(W * 0.36, (pBot - feet) * 0.42);
  m.ring(STEEL, 0, cy, 0, rOut * 0.72, zf + 0.008, zf + 0.009); // Trommel dahinter
  m.ring(ring, 0, cy, rOut * 0.74, rOut, zf + 0.008, zf + 0.035); // Türring
  m.ring(GLASS, 0, cy, 0, rOut * 0.74, zf + 0.012, zf + 0.03); // Glas
  m.box(ring, rOut * 0.78, rOut * 0.98, cy - 0.045, cy + 0.045, zf + 0.035, zf + 0.045); // Türgriff
  // Serviceklappe (Flusensieb/Pumpe)
  m.box(PANEL, x1 - 0.13, x1 - 0.03, feet + 0.04, feet + 0.1, zf + 0.008, zf + 0.011);
  return m;
}

const washer = frontloader(0.6, 0.6, 0.85, CHROME, 0.17);
writeFileSync(join(ROOT, 'modelle/waschmaschine.glb'), washer.glb('Waschmaschine'));

const DRYER_RING: Mat = { name: 'Türring', color: [0.14, 0.15, 0.17], roughness: 0.35 };
const dryer = frontloader(0.6, 0.65, 0.85, DRYER_RING, 0.24);
// Lüftungsgitter unten links (Wärmepumpe)
for (let i = 0; i < 5; i++) dryer.box(GRAPHITE, -0.27, -0.13, 0.055 + i * 0.014, 0.062 + i * 0.014, 0.65 / 2 - 0.027, 0.65 / 2 - 0.024);
writeFileSync(join(ROOT, 'modelle/trockner.glb'), dryer.glb('Trockner'));

console.log('✓ modelle/waschmaschine.glb, modelle/trockner.glb');
