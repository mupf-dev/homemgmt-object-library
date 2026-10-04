# Homemgmt Object Library

Community-Katalog mit **Möbelarten** für [Zuhause (Homemgmt)](https://github.com/mupf-dev/Homemgmt): Schränke, Regale,
Kommoden, Werkstattwagen … Jedes Fach einer Möbelart wird im Hausplan ein Lagerplatz.

**Galerie:** https://mupf-dev.github.io/homemgmt-object-library/

Zuhause liest den Katalog ohne Konto oder Schlüssel von
`https://mupf-dev.github.io/homemgmt-object-library/index.json`. Installiert wird in der App unter
**Mehr → Objektbibliothek → Community**. Ein eigener Fork oder Spiegel lässt sich in Zuhause über
`OBJECT_CATALOG_URL` einstellen.

## Eine Möbelart beisteuern

1. In Zuhause unter **Mehr → Objektbibliothek** eine Möbelart anlegen (oder eine Vorlage kopieren) und im Editor mit
   der 3D-Vorschau fertigstellen.
2. **Exportieren** – die App speichert eine Datei `….zuhause-objekt.json`.
3. Datei als `objekte/<name>.json` ablegen (`<name>`: Kleinbuchstaben, Ziffern, Bindestriche) und die Kennung auf
   `"id": "community.<name>"` setzen. `author` und eine freie `license` angeben: `CC0-1.0` (empfohlen), `CC-BY-4.0`
   oder `CC-BY-SA-4.0`.
4. Pull Request öffnen. Die Prüfung läuft automatisch; nach dem Merge erscheint die Möbelart in der Galerie und in
   allen Zuhause-Installationen.

`index.json`, Vorschaubilder und Galerie entstehen beim Veröffentlichen von selbst – nicht von Hand pflegen.

Lokal prüfen und ansehen (Node ≥ 22.18, keine Abhängigkeiten):

```sh
npm run check   # nur prüfen
npm run build   # prüfen und _site/ erzeugen (index.html im Browser öffnen)
```

**Neue Version** einer Möbelart: `version` erhöhen (z. B. `1.0` → `1.1`). Installationen zeigen dann
„Aktualisieren“; bereits geplante Möbel behalten ihre Fächer, bis jemand sie im Hausplan bewusst auf die neue Version
bringt. Die Fächer einer veröffentlichten Möbelart möglichst nicht umsortieren – sie sind Lageradressen.

**3D-Modelle** (`"build": { "type": "modell" }`): das `.glb` nach `modelle/` legen und in der Möbelart als
`"model": { "file": "modelle/<name>.glb" }` eintragen (höchstens 50 MB, besser unter 5 MB). Nur Modelle mit eigenen
Rechten oder freier Lizenz. Beim Installieren lädt Zuhause das Modell herunter.

## Format `zuhause-objekt/1`

```json
{
  "format": "zuhause-objekt/1",
  "id": "community.schuhschrank-klappen",
  "name": "Schuhschrank mit 2 Klappen",
  "group": "Diele",
  "version": "1.0",
  "author": "…",
  "license": "CC0-1.0",
  "description": "…",
  "size": { "width": 80, "depth": 24, "height": 100, "elevation": 0, "widths": [50, 80] },
  "snapToWall": true,
  "materials": { "carcass": "lack-white", "front": "lack-white" },
  "build": {
    "type": "korpus",
    "plinth": 0,
    "board": 1.6,
    "back": true,
    "columns": [
      { "size": 1, "elements": [
        { "kind": "drawer", "size": 0.35, "label": "Schublade (Schlüssel)" },
        { "kind": "flap", "size": 1 },
        { "kind": "flap", "size": 1 }
      ] }
    ]
  }
}
```

| Feld | Bedeutung |
|------|-----------|
| `size` | Maße in cm; `elevation` = Abstand vom Boden (z. B. Hängeschrank), `widths` = Breiten-Vorschläge |
| `build.type` | `korpus` (aus Spalten und Elementen) oder `modell` (3D-Modell mit Fächern) |
| `plinth`, `board`, `back` | Sockelhöhe und Plattenstärke in cm, Rückwand ja/nein |
| `columns[].size` | relative Breite der Spalte (von links nach rechts) |
| `elements[].kind` | `drawer` Schublade, `door` Tür, `flap` Klappe, `open` offenes Fach, `cold` Kühlfach, `freezer` Gefrierfach |
| `elements[].size` | relative Höhe (von oben nach unten) |
| `elements[].shelves` | bei `door` und `open`: Anzahl Böden – jeder Boden ist ein eigener Lagerplatz |
| `elements[].label` | eigene Bezeichnung des Fachs (sonst „Schublade 2“, „Tür · Boden 1“ …) |
| `countertop` | optional: Arbeitsplatte oben, z. B. Waschmaschine unter Arbeitsplatte oder Hauswirtschaftszeile – `thickness` Stärke in cm (1–10, Standard 4), `overhang` Überstand vorne in cm (0–10, Standard 2), `join: true` = geht in angrenzende Küchen-Unterschränke über (durchgehende Platte). Die Platte ist kein Fach; `size.height` ist die Gesamthöhe inklusive Platte, der Korpus wird entsprechend niedriger. Material: `materials.countertop` |
| `materials` | Kennungen der Materialien (`front`, `carcass`, `handle`, `countertop` …), wie in der App |

Beispiel mit Arbeitsplatte (Waschmaschine unter Arbeitsplatte, Teil der Küchenzeile):

```json
"build": { "type": "korpus", "plinth": 0, "board": 1.8, "back": false,
  "countertop": { "thickness": 4, "overhang": 2, "join": true },
  "columns": [
    { "size": 1, "elements": [ { "kind": "open", "size": 1, "label": "Waschmaschine" } ] },
    { "size": 1, "elements": [ { "kind": "drawer", "size": 1 }, { "kind": "drawer", "size": 2 } ] }
  ] }
```

Bei `modell`:

```json
"build": { "type": "modell", "model": { "file": "modelle/truhe.glb" },
  "compartments": [ { "label": "Truhe", "kind": "shelf", "box": [0.05, 0.95, 0.1, 0.9, 0.05, 0.95] } ] }
```

`box` = Quader des Fachs als Anteile 0 … 1 von Breite (links → rechts), Höhe (unten → oben) und Tiefe
(hinten → vorne). Jedes Fach wird ein Lagerplatz (Reihenfolge = Fachnummer), höchstens 99 Fächer je Möbel.

## Aufbau

| Pfad | Inhalt |
|------|--------|
| `objekte/` | eine Datei je Möbelart |
| `modelle/` | 3D-Modelle (.glb) zu Möbelarten vom Typ `modell` |
| `tools/objects.ts` | Prüfung des Formats – Kopie aus Homemgmt (`web/app/src/model/objects.ts`), bei Formatänderungen übernehmen |
| `tools/build.ts` | prüft alles und erzeugt `_site/` (`index.json` im Format `zuhause-katalog/1`, Vorschaubilder, Galerie) |
| `.github/workflows/pages.yml` | Pull Requests prüfen, `main` auf GitHub Pages veröffentlichen |

## Lizenz

Jede Möbelart unter der in ihrer Datei angegebenen freien Lizenz, ohne Angabe CC0 1.0. Siehe [LICENSE](LICENSE).
