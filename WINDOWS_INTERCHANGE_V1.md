# AimRoutine Tracker — Interchange format v1

**Status:** Web export and web import implemented. **Windows desktop importer NOT implemented**. The file is NOT a verified Windows application backup and cannot currently be assumed to import into Windows 2.9. There is no cloud sync or live Riot connection.

## Purpose / Objectif

Carry self-entered training data between browsers without a server, with a documented schema that a future desktop importer can adopt after compatibility testing. / Transporter les données d'entraînement saisies entre navigateurs sans serveur, et documenter leur future intégration Windows.

Export in the **Sauvegardes** tab → **Exporter les données portables**. On another web browser use **Importer un échange web**. The user confirms separately before replacing the local profile/program; sessions are merged by unique ID.

The export is UTF-8 JSON. Root object:

```json
{
  "format": "aimroutine-interchange-v1",
  "createdAt": "2026-11-06T03:00:00.000Z",
  "origin": "aimroutine-web",
  "disclaimer": "Portable web export. Windows desktop importer is not implemented yet.",
  "profile": {
    "nickname": "ExamplePlayer", "avatar": "crosshair", "rank": "silver",
    "dpi": 1600, "sensitivity": 0.2, "mouse": "", "goal": "",
    "tool": "VALORANT"
  },
  "sessions": [{
    "id":"unique-id", "date":"2026-11-06T03:00:00.000Z",
    "rank":"silver", "focus":"flick", "tool":"VALORANT",
    "scenario":"Stand de tir", "minutes":20, "accuracy":76.5,
    "feeling":"good", "notes":"", "breakSeconds":30
  }],
  "presets": [{
    "id":"preset-id", "name":"Routine", "rank":"silver", "focus":"flick",
    "breakSeconds":30,
    "exercises":[{"name":"Stand de tir", "tool":"VALORANT", "minutes":10, "tip":"Vise la précision"}]
  }],
  "weeklyGoal":3,
  "program":{"days":7,"startedAt":"2026-11-06T03:00:00.000Z","rank":"silver","tool":"VALORANT"}
}
```

## Field rules

- `format` must equal `aimroutine-interchange-v1`.
- `sessions`: maximum 1,000; IDs unique after merge; ISO timestamps; `accuracy` may be `null`, or a finite number from 0 to 100; `minutes` integer 1–120. `focus`: `flick`, `micro`, `tracking`, `control`.
- `presets`: maximum 25; 1–10 exercises each; each duration integer 1–45 minutes; total duration maximum 120 minutes.
- `rank`: `iron`, `silver`, `diamond`, `immortal`. This is a category, not an official rank claim.
- `tool`: `VALORANT`, `Aim Lab`, `KovaaK’s`, `Oblivity`. Migrated unknown legacy sessions are labelled `Non précisé` and must not be reinterpreted as VALORANT results.
- `weeklyGoal`: integer 1–14.
- `profile`: all attributes optional to the user's intent; nickname ≤24 characters, mouse ≤70, goal ≤140, DPI 100–32,000, sensitivity 0.001–10 (or `null`).
- `program`: `null` or a valid 7/14/30-day plan with explicit start date, rank and tool.
- Import: reject invalid data, never execute strings or HTML; merge sessions and presets by ID; import the profile/program only after user confirmation.

## Desktop integration requirements — not yet implemented

1. Add a Windows-side importer that explicitly recognizes this version, validates every field and creates an isolated transaction/backup before changing local data.
2. Decide exact mapping between web `focus` names, desktop training scenarios and genuine app IDs. Do not invent Riot match IDs.
3. Preserve unknown scenario names as plain text and identify discrepancies instead of guessing.
4. Add a roundtrip test: Windows export → Web import → Web export → Windows import, with rollback on failure.
5. Only later consider user-authenticated cloud sync with an explicit privacy policy and secure backend. Never embed Riot API secrets in a static GitHub Pages site.
