# localStorage-schema — `alvah-ef-v1`

Eén sleutel, één JSON-object, expliciete `schemaVersion`. Alles client-side, geen serverkoppeling. Max ~5 MB per browser; we blijven ruim daaronder met auto-prune.

## Sleutel

```
localStorage.getItem('alvah-ef-v1')
```

## Object

```json
{
  "schemaVersion": 1,
  "createdAt": "2026-04-22T10:00:00Z",
  "preferences": {
    "sound": true,
    "reducedMotion": false,
    "textSize": "large",
    "sparklineInEinde": true
  },
  "exercises": {
    "simon":    { "currentLevel": 2, "highestLevel": 3, "sessions": [] },
    "zoeken":   { "currentLevel": 4, "highestLevel": 8, "sessions": [] },
    "corsi":    { "currentLevel": 2, "highestLevel": 4, "sessions": [] },
    "day-night":{ "currentLevel": 1, "highestLevel": 1, "sessions": [] },
    "wisselen": { "currentLevel": 1, "highestLevel": 1, "sessions": [] }
  },
  "mijlpalen": {
    "bereikt": [],
    "cadeaus": []
  }
}
```

## Sessie-object

Elk element van `exercises[id].sessions`:

```json
{
  "id": "s_1713...",
  "date": "2026-04-22T16:12:00Z",
  "level": 3,
  "durationMs": 214000,
  "trials": [
    { "i": 1, "span": 3, "correct": true, "rt": 2100 }
  ],
  "summary": {
    "accuracy": 0.88,
    "meanRT": 2280,
    "sdRT": 340,
    "iivCV": 0.15,
    "trialsN": 12,
    "maxSpan": 4
  }
}
```

`trials` is per-spel qua velden (Simon logt `span`, Day-Night logt `stimulus`/`response`/`mode`, Zoeken logt `setSize`/`falseAlarms`, etc.). `summary` is de gemeenschappelijke laag die `src/scripts/scoring.js` altijd vult.

## Mijlpaal-objecten

```json
{
  "mijlpalen": {
    "bereikt": [
      { "spel": "corsi", "id": "span-5-x3", "datum": "2026-05-03T18:00:00Z" }
    ],
    "cadeaus": [
      { "id": "c_1", "spel": "corsi", "mijlpaalId": "span-5-x3", "beschrijving": "LEGO-set", "status": "open" }
    ]
  }
}
```

`bereikt` wordt gevuld door `src/scripts/mijlpalen.js` zodra een drempel is gehaald. `cadeaus` vult papa via `/spelen/admin`.

## Auto-prune (voorkomt overflow)

- Max 20 sessies per spel (FIFO).
- Volledige `trials`-array alleen voor laatste 10 sessies; oudere sessies behouden alleen `summary`.
- Wordt toegepast in `storage.js::saveSession` direct na append.

## Migraties

`storage.js::migrate(data)` checkt `schemaVersion` en upgrade stapsgewijs. Bij v1 is dit een no-op. Toekomstige versies:
- v1 → v2: pas trial-veld X aan, etc. Altijd destructie-vrij op legacy-data tenzij expliciet gedocumenteerd.

## Preferences-veld

| Key | Type | Default | Betekenis |
|---|---|---|---|
| `sound` | boolean | `true` | Web Audio tonen aan/uit |
| `reducedMotion` | boolean | `false` | Manual override; systeem `prefers-reduced-motion` heeft voorrang |
| `textSize` | `"normal" \| "large"` | `"large"` | Body-font schaalt van 18 naar 20 px |
| `sparklineInEinde` | boolean | `true` | Sparkline tonen in Alvah's einde-scherm |

## Geen tracking

Dit object verlaat nooit de browser. Geen server-sync, geen fetch, geen beacon. Enige exit-paden: JSON-export via knop in `/spelen/admin`, of browser-DevTools.
