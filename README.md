# Homemgmt Object Library

Community catalog of **furniture types** for [homemgmt-ng](https://github.com/mupf-dev/Homemgmt): cabinets, shelf units,
chests of drawers, workshop trolleys … Every compartment of a furniture type becomes a location in the house plan.

**Gallery:** https://mupf-dev.github.io/homemgmt-object-library/

homemgmt-ng reads the catalog without an account or key from
`https://mupf-dev.github.io/homemgmt-object-library/index.json`. Furniture types are installed in the app under
**More → Object library → Community**. To use your own fork or mirror, set `OBJECT_CATALOG_URL` in homemgmt-ng.

## Contributing a furniture type

1. In homemgmt-ng, go to **More → Object library**, create a furniture type (or copy a template) and finish it in the
   editor with the 3D preview.
2. **Export** – the app saves a file `….zuhause-objekt.json`.
3. Save the file as `objekte/<name>.json` (`<name>`: lowercase letters, digits, hyphens) and set the identifier to
   `"id": "community.<name>"`. Provide an `author` and a free `license`: `CC0-1.0` (recommended), `CC-BY-4.0`
   or `CC-BY-SA-4.0`.
4. Open a pull request. The check runs automatically; after the merge, the furniture type appears in the gallery and in
   all homemgmt-ng installations.

`index.json`, preview images and the gallery are generated automatically on publishing – do not edit them by hand.

Check and view locally (Node ≥ 22.18, no dependencies):

```sh
npm run check   # check only
npm run build   # check and generate _site/ (open index.html in the browser)
```

**New version** of a furniture type: increase `version` (e.g. `1.0` → `1.1`). Installations then show
"Update to …"; furniture already placed keeps its compartments until someone deliberately switches it to the new version in
the house plan ("Apply version …"). Avoid reordering the compartments of a published furniture type – they are location codes.

**3D models** (`"build": { "type": "modell" }`): put the `.glb` into `modelle/` and reference it in the furniture type as
`"model": { "file": "modelle/<name>.glb" }` (at most 50 MB, preferably under 5 MB). Only models you hold the rights to
or that have a free license. homemgmt-ng downloads the model on installation.

**Categories (`group`):** use one of the existing category names. They are stored in German (the app and the gallery
show them translated), so contributions end up next to the matching furniture types:

| `group` | Meaning |
|---|---|
| `Küche` | Kitchen |
| `Keller & Hauswirtschaft` | Basement & utility room |
| `Schlafzimmer` | Bedroom |
| `Wohnzimmer` | Living room |
| `Bad` | Bathroom |
| `Schränke & Regale` | Cabinets & shelf units |
| `Diele` | Hallway |
| `Arbeitszimmer` | Study |
| `Werkstatt` | Workshop |
| `Kinderzimmer` | Children's room |
| `Garten & Garage` | Garden & garage |

## Format `zuhause-objekt/1`

```json
{
  "format": "zuhause-objekt/1",
  "id": "community.schuhschrank-klappen",
  "name": "Shoe cabinet with 2 flaps",
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
        { "kind": "drawer", "size": 0.35, "label": "Drawer (keys)" },
        { "kind": "flap", "size": 1 },
        { "kind": "flap", "size": 1 }
      ] }
    ]
  }
}
```

| Field | Meaning |
|-------|---------|
| `size` | Dimensions in cm; `elevation` = distance from the floor (e.g. wall cabinet), `widths` = suggested widths |
| `build.type` | `korpus` (carcass built from columns and elements) or `modell` (3D model with compartments) |
| `plinth`, `board`, `back` | Plinth height and board thickness in cm, back panel yes/no |
| `columns[].size` | Relative width of the column (left to right) |
| `elements[].kind` | `drawer` drawer, `door` door, `flap` flap, `open` open compartment, `cold` fridge compartment, `freezer` freezer compartment, `washer` washing machine, `dryer` dryer – appliances with their own appliance front (control panel, porthole) instead of a furniture front and two compartments each: at the top the detergent drawer or condensate container, below it the drum (`label` names the drum; no `shelves`) |
| `elements[].size` | Relative height (top to bottom) |
| `elements[].shelves` | For `door` and `open`: number of shelves – each shelf is a separate location |
| `elements[].label` | Custom name of the compartment (otherwise "Drawer 2", "Door · Shelf 1" …) |
| `countertop` | Optional: worktop on top, e.g. washing machine under a worktop or a utility room unit – `thickness` thickness in cm (1–10, default 4), `overhang` front overhang in cm (0–10, default 2), `join: true` = merges into adjacent kitchen base cabinets (continuous worktop). The worktop is not a compartment; `size.height` is the total height including the worktop, the carcass gets correspondingly lower. Material: `materials.countertop` |
| `materials` | Material identifiers (`front`, `carcass`, `handle`, `countertop` …), as in the app |
| `materials.appliance` | Appliance color of washing machine and dryer (`washer`, `dryer`), a material identifier such as `lack-white`, `lack-black`, `lack-anthracite` or `metal-steel`. With dark and metallic colors, the control panel becomes black glass and the door ring chrome. If omitted, the appliance front is white. Can be changed per piece of furniture in the house plan. |

Example with a worktop (washing machine under a worktop, part of the kitchen run):

```json
"build": { "type": "korpus", "plinth": 0, "board": 1.8, "back": false,
  "countertop": { "thickness": 4, "overhang": 2, "join": true },
  "columns": [
    { "size": 1, "elements": [ { "kind": "open", "size": 1, "label": "Washing machine" } ] },
    { "size": 1, "elements": [ { "kind": "drawer", "size": 1 }, { "kind": "drawer", "size": 2 } ] }
  ] }
```

With `modell`:

```json
"build": { "type": "modell", "model": { "file": "modelle/truhe.glb" },
  "compartments": [ { "label": "Chest", "kind": "shelf", "box": [0.05, 0.95, 0.1, 0.9, 0.05, 0.95] } ] }
```

`box` = cuboid of the compartment as fractions 0 … 1 of width (left → right), height (bottom → top) and depth
(back → front). Each compartment becomes a location (order = compartment number), at most 99 compartments per piece of
furniture.

## Structure

| Path | Contents |
|------|----------|
| `objekte/` | One file per furniture type |
| `modelle/` | 3D models (.glb) for furniture types of type `modell` |
| `tools/geraete-modelle.ts` | Generates the appliance models in `modelle/` (washing machine, dryer): `node tools/geraete-modelle.ts` |
| `tools/objects.ts` | Format validation – copy from Homemgmt (`web/app/src/model/objects.ts`); adopt changes whenever the format changes |
| `tools/build.ts` | Checks everything and generates `_site/` (`index.json` in format `zuhause-katalog/1`, preview images, gallery) |
| `.github/workflows/pages.yml` | Checks pull requests, publishes `main` to GitHub Pages |

## License

Each furniture type is available under the free license stated in its file; if none is stated, CC0 1.0. See
[LICENSE](LICENSE).
