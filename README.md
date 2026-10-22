# eph-service

Node.js / Express API that returns a birth chart from the [Swiss Ephemeris](https://www.astro.com/swisseph/):
planet positions, Rahu/Ketu, ascendant and house cusps, sunrise/sunset, moon phase, sidereal time
and ayanamsa.

- **Sidereal (Vedic, Lahiri ayanamsa) by default**; tropical (Western) on request
- **Rahu/Ketu use the Mean Node**, matching AstroSage
- **Timezone** auto-detected from latitude/longitude, or passed explicitly (e.g. `+0530`)
- **Client ID + secret** authentication

## Requirements

- Node.js **20.x** (`swisseph` is a native addon compiled for the installed Node version)
- C/C++ build tools: `make`, `g++`/`clang`, and Python 3 (used by `node-gyp` during `npm install`)

## Setup

```bash
npm install
cp clients.example.json clients.json   # then fill in real secrets
npm run check                          # smoke test: prints positions and "OK"
npm run dev                            # http://localhost:3000, restarts on file changes
```

| Script | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with `--watch` |
| `npm run check` | Verify `swisseph` loads and calculates correctly (no `clients.json` needed) |
| `npm run build` | Create `dist/eph-service-<version>.zip` for deployment |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `CLIENTS_FILE` | `./clients.json` | Path to the clients file |

## Authentication

Allowed clients live in `clients.json` (gitignored), loaded once at startup:

```json
[
  { "clientId": "mobile-app", "clientSecret": "6f1c2a9e-3b7d-4e8a-9c21-5d4f0b7a1e33" }
]
```

Generate a secret with:

```bash
node -e "console.log(crypto.randomUUID())"
```

Send both headers on every `/api` request:

```
x-client-id: mobile-app
x-client-secret: 6f1c2a9e-3b7d-4e8a-9c21-5d4f0b7a1e33
```

Missing or wrong credentials return `401 {"error":"Unauthorized"}`. The server refuses to start if
the clients file is missing, invalid, or has duplicate IDs. Restart after editing it.

## API

### `GET /health`

Public. Returns `{ "status": "ok", "timestamp": "..." }`.

### `POST /api/ephemeris`

**Request body**

| Field | Required | Format | Example |
|---|---|---|---|
| `date` | yes | `YYYY-MM-DD` (local date of birth) | `"1988-03-03"` |
| `time` | yes | `HH:MM`, 24-hour, local time of birth | `"23:42"` |
| `lat` | yes | -90 to 90 | `6.85` |
| `lon` | yes | -180 to 180 | `79.8667` |
| `zodiac` | no | `"sidereal"` (default) or `"tropical"` | `"tropical"` |
| `timezone` | no | UTC offset `±HHMM` (`±HH:MM` and `±HH` also accepted). Overrides auto-detection | `"+0530"` |

**Example**

```bash
curl -X POST https://astro-service.york.lk/api/ephemeris \
  -H "Content-Type: application/json" \
  -H "x-client-id: mobile-app" \
  -H "x-client-secret: <secret>" \
  -d '{"date":"1988-03-03","time":"23:42","lat":6.85,"lon":79.8667,"timezone":"+0530"}'
```

**Response** (shortened)

```json
{
  "input": { "date": "1988-03-03", "time": "23:42", "lat": 6.85, "lon": 79.8667, "zodiac": "sidereal", "timezone": "+0530" },
  "timezone": { "utcOffset": 5.5, "source": "input", "utcDate": "1988-03-03", "utcTime": "18:12" },
  "julianDay": 2447224.2583,
  "planets": {
    "Sun":  { "longitude": 319.6984, "dms": "19°41'54\"", "sign": "Aquarius", "signDegree": 19.6984,
              "latitude": 0.000078, "distance": 0.991547, "speed": 1.001925, "isRetrograde": false },
    "Moon": { "longitude": 140.6892, "dms": "20°41'21\"", "sign": "Leo", "signDegree": 20.6892, "...": "..." },
    "Rahu": { "longitude": 330.153, "dms": "0°09'11\"", "sign": "Pisces", "signDegree": 0.153, "isRetrograde": true, "...": "..." },
    "Ketu": { "longitude": 150.153, "dms": "0°09'11\"", "sign": "Virgo", "signDegree": 0.153, "isRetrograde": true, "...": "..." }
  },
  "houses": {
    "system": "Placidus",
    "ascendant": { "longitude": 220.2709, "dms": "10°16'15\"", "sign": "Scorpio", "signDegree": 10.2709 },
    "midheaven": { "longitude": 128.9444, "dms": "8°56'40\"", "sign": "Leo", "signDegree": 8.9444 },
    "cusps": [ { "house": 1, "longitude": 220.2709, "dms": "10°16'15\"", "sign": "Scorpio", "signDegree": 10.2709 } ]
  },
  "sunTimes": {
    "sunrise": "06:22:27", "sunset": "18:22:37", "solarNoon": "12:22:29",
    "civilDawn": "06:01:30", "civilDusk": "18:43:33",
    "nauticalDawn": "05:37:12", "nauticalDusk": "19:07:51",
    "astronomicalDawn": "05:12:56", "astronomicalDusk": "19:32:07"
  },
  "moonPhase": { "phase": 0.5027, "phaseName": "Full Moon", "illumination": 0.9999, "angle": 73.735 },
  "siderealTime": "04:58:56",
  "ayanamsa": { "lahiri": 23.691851, "raman": 22.24555 }
}
```

**Notes**

- **Planets:** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Rahu, Ketu, Chiron.
- **Positions:** `longitude` is 0–360° in the requested zodiac. `dms` and `signDegree` are the position within the sign.
- **Sun times:** given in the birth place's local time, using the given or detected offset.
- **`timezone.source`:** `"input"` if you sent a `timezone`, `"detected"` if it came from lat/lon.
- **Errors:** validation errors return `400 {"error": "..."}`.

## Deployment (cPanel, Setup Node.js App)

1. `npm run build`, then upload `dist/eph-service-<version>.zip` to the app folder and extract it.
   Do not upload `node_modules`.
2. In **Setup Node.js App**, use Node **20.x**, startup file `src/index.js`, mode Production.
3. Upload `clients.json` outside `public_html` (e.g. `/home/<user>/eph-secrets/clients.json`) and
   set `CLIENTS_FILE` to that path in the app's environment variables.
4. Click **Run NPM Install**. It compiles `swisseph` on the server. Look for no `gyp ERR!` lines.
5. **Run JS script → `check`**. You should see `OK`.
6. Restart the app and open `/health`.

Re-run **Run NPM Install** whenever the host's Node version changes.

### node-gyp and Python

`swisseph` compiles with `node-gyp`, and which version works depends on the machine's Python:

- **Local (Python 3.12+):** `package.json` overrides `node-gyp` to `^11.5.0`, because the default 8.4.1
  needs Python's `distutils`, which was removed in 3.12.
- **Server (Python 3.6):** newer `node-gyp` can't run there, so `npm run build` removes the override and
  the server uses `swisseph`'s own `node-gyp` 8.4.1.

### Cloudflare

If the domain uses Cloudflare **Under Attack mode** or a challenge rule, API clients get a
`403` challenge page and never reach the app. Add a WAF custom rule to exempt only the API host:

- **If** Hostname equals `astro-service.york.lk`
- **Then** Skip: **Security Level**, **Browser Integrity Check** (and Super Bot Fight Mode, if listed)

Keep rate limiting and managed rules enabled.

## Data and licensing

- **Ephemeris files:** `sepl_18.se1`, `semo_18.se1` and `seas_18.se1` ship with the `swisseph` package and cover 1800–2400 AD.
- **Licensing:** the Swiss Ephemeris is dual-licensed by Astrodienst, under AGPL or a commercial licence. Check which applies before offering this API publicly or commercially.
