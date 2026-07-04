# CanSat Ground Control Station (GCS)
### Student Project — Real-Time Telemetry Dashboard

A fully functional ground control station dashboard for monitoring CanSat flight missions in real time. Built as part of a CanSat internship project. The dashboard simulates a complete flight lifecycle from pre-launch to landing, displays live sensor data across multiple panels, and uses AI to automatically analyse post-flight telemetry data.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI | HTML5 + CSS3 + Vanilla JavaScript | Frontend dashboard |
| Charts | Chart.js v4.x (CDN) | Real-time line charts |
| Map | Leaflet.js v1.9.x (CDN) | Live GPS tracking |
| Desktop Wrapper | Electron v28+ | Makes it a desktop app |
| Runtime | Node.js v18+ | Backend engine |
| IPC Bridge | Electron ipcMain/ipcRenderer | Communication between backend and frontend |
| AI Analysis | Groq API (LLaMA 3.3 70B) | Post-flight data analysis |
| Packaging | electron-builder | Builds installer for Windows/Mac/Linux |

---

## File Structure

```
cansat-gcs/
├── package.json          — Project config and dependencies
├── main.js               — Electron main process (backend)
├── preload.js            — Security bridge between backend and frontend
├── src/
│   └── telemetry.js      — Flight data simulator (5-phase flight model)
├── renderer/
│   ├── index.html        — Main dashboard layout
│   ├── style.css         — All styling (terminal dark theme)
│   └── renderer.js       — All dashboard logic, charts, map, AI
└── assets/
    └── icon.png          — App icon
```

---

## How to Run

### Requirements
- Node.js v18 or higher — download from https://nodejs.org
- Internet connection (for map tiles and AI analysis)

### Steps

**Step 1 — Extract the zip file**
Right click the downloaded zip → Extract All → choose Desktop → Extract

**Step 2 — Open terminal inside the project folder**
Open the `cansat-gcs` folder → click the address bar at top → type `cmd` → press Enter
OR open VS Code → File → Open Folder → select cansat-gcs → press Ctrl+` to open terminal

**Step 3 — Install dependencies (only needed once)**
```
npm install
```
This downloads Electron (~150MB). Takes 1-3 minutes. You will see some warnings — that is normal.

**Step 4 — Start the application**
```
npm start
```
The dashboard window opens. Press ▶ START to begin the simulation.

---

## How to Build an Installer

```
npm run build
```

Output files appear in the `dist/` folder:
- **Windows** → `.exe` installer (NSIS)
- **macOS** → `.dmg` disk image
- **Linux** → `.AppImage`

---

## Dashboard Panels — Full Explanation

### Header Bar (Top)
The top bar shows the mission identity and live status at all times.

- **CANSAT-2025 | MISSION ALPHA** — Mission name in green monospace font
- **Phase Badge (center)** — Shows the current flight phase. Changes automatically based on time:
  - `PRE-LAUNCH` (gray) — satellite on ground, sensors idle
  - `ASCENDING` (green, blinking) — satellite rising into the air
  - `APOGEE` (yellow) — reached maximum height
  - `DESCENDING` (orange) — falling back down with parachute
  - `LANDED` (red) — safely on the ground
- **MET (top right)** — Mission Elapsed Time. Counts up from 00:00 when you press START
- **PACKET counter** — Shows how many data packets have been received so far

---

### GPS Track Map (Left Panel)
Shows the real-time position of the CanSat on an actual map.

- Map is centered on the launch coordinates you set (currently set to your specified location)
- A **glowing dot** moves across the map every second as new GPS coordinates arrive
- A **blinking colored trail** follows behind the dot showing the full flight path
- Click the dot to see a popup with exact Latitude, Longitude, Altitude, and Packet number
- **RSSI signal bars** (top right of map) show radio signal strength:
  - Green bars = strong signal (above -80 dBm)
  - Yellow bars = weak signal (-80 to -90 dBm)
  - Red bars = very weak signal (below -90 dBm)
- After landing, the dot stops moving completely (GPS drift is frozen at t=110s)

**To change the launch location:**
Open `renderer.js` and change the coordinates in `center: [LAT, LON]`
Open `telemetry.js` and change the base latitude and longitude values

---

### Altitude & Descent Rate Chart (Top Right)
A dual-axis real-time line chart updating every second.

- **Cyan line** — Altitude in metres (left Y axis, 0 to 600m)
- **Orange dashed line** — Descent rate in m/s (right Y axis, -15 to +15)
  - Positive value = rising
  - Negative value = falling (parachute working)
  - Near zero = at apogee (peak)
- Shows a **60-second scrolling window** — always displays the last 1 minute of data
- Old data scrolls off the left, new data appears on the right (like a hospital ECG monitor)

---

### Temperature & Pressure Chart (Middle Right)
A second dual-axis real-time chart.

- **Orange line** — Temperature in °C (left Y axis, 0 to 40°C)
  - Temperature drops as altitude increases — real atmospheric physics
  - Formula: temp = 28 - (altitude / 50)
- **Purple line** — Atmospheric pressure in hPa (right Y axis, 900 to 1020 hPa)
  - Pressure also drops with altitude — real physics
  - Formula: pressure = 1013 - (altitude / 8.4)
- Both sensors independently confirm altitude — if all three agree, data is trustworthy
- Same 60-second scrolling window as Chart 1

---

### Stat Cards (Bottom Right — 4 Cards)
Four large number displays showing the most critical values at a glance. Designed to be visible from across the room on a projector.

- **ALTITUDE** (cyan) — Current height above ground in metres. Trend arrow shows if rising or falling
- **TEMPERATURE** (orange) — Current onboard temperature in °C
- **DESCENT RATE** (green/orange) — How fast the satellite is moving in m/s. Green = descending (good), orange = ascending
- **BATTERY** (cyan/red) — Current battery voltage. Starts at 8.4V and drains slowly:
  - Green bar = healthy
  - Yellow = getting low
  - Red = critical (below 6.5V)
  - Bar below the number shows visual battery level

Each card has a trend arrow (↑ rising, ↓ falling, → stable) based on last two readings.

---

### Packet Log (Footer Terminal)
A scrolling terminal at the bottom showing every data packet received.

Each line looks like:
```
[00:42] PKT#0042 | ALT: 312.4m | TEMP: 24.1°C | PRESS: 984.2hPa | LAT: 17.4953 | LON: 78.3929 | BATT: 8.1V
```

- Newest packets are bright green
- Older packets fade to darker green
- Very old packets become nearly invisible
- Auto-scrolls to always show the latest packet
- Stores up to 200 packets before clearing old ones

---

### Control Buttons
Located above the packet log.

| Button | Color | Function |
|---|---|---|
| ▶ START | Green | Begins the flight simulation. Disabled once started |
| ⏸ PAUSE / ▶ RESUME | Yellow | Freezes all data updates. Click again to resume |
| ↺ RESET | Red | Clears everything and returns to t=0 ready for new flight |
| ⬇ Export CSV | Gray | Downloads all telemetry packets as a .csv file with timestamp in filename |
| 🤖 AI Analysis | Purple | Opens AI post-flight analysis panel |

---

### AI Post-Flight Analysis Panel
Opens as a side panel on the right side of the screen after the flight.

**How it works:**
1. After simulation completes (LANDED phase), click 🤖 AI Analysis
2. The dashboard calculates a statistical summary of the entire flight
3. Summary is sent to Groq API (LLaMA 3.3 70B model)
4. AI returns a structured 7-section analysis in 3-5 seconds
5. Results display in the purple panel with formatted sections

**What the AI analyses:**
1. Mission Summary — overall success or failure verdict
2. Altitude Profile — peak altitude and ascent performance
3. Anomalies Detected — any unusual readings
4. Temperature & Pressure — atmospheric observations
5. Battery Health — drain rate and end voltage assessment
6. Parachute Performance — descent rate analysis
7. Recommendations — what to improve for next flight

**Token efficiency:**
Instead of sending all 120 raw data rows (~6000 tokens), the dashboard sends a pre-calculated statistical summary (~400 tokens). This means you can run AI analysis many times without hitting API rate limits.

---

## Flight Profile — How the Simulation Works

The flight is simulated in `src/telemetry.js` with a predefined 5-phase profile:

| Phase | Time | What Happens |
|---|---|---|
| PRE-LAUNCH | 0 — 30s | Satellite on ground, all sensors at baseline |
| ASCENDING | 30 — 60s | Altitude rises from 0 to 500m using sine curve |
| APOGEE | 60 — 65s | Holds near 500m with small random jitter |
| DESCENDING | 65 — 110s | Falls from 500m to 0m at ~10 m/s |
| LANDED | 110s+ | All values stable, GPS frozen |

Every second one data packet is generated containing:
- Packet number and timestamp
- Altitude (metres)
- Temperature (°C) — decreases with altitude
- Pressure (hPa) — decreases with altitude
- Descent rate (m/s) — derivative of altitude
- GPS latitude and longitude — small random drift during flight, frozen after landing
- RSSI signal strength (dBm) — random fluctuation
- Battery voltage — starts 8.4V, drains 0.008V per second
- Flight phase label

---

## Setting Up the Groq AI API Key

1. Go to https://console.groq.com
2. Sign up for free (no credit card needed)
3. Click API Keys → Create API Key
4. Copy the key (starts with gsk_...)
5. Open `renderer.js`
6. Find this line at the very top:
   ```javascript
   const GROQ_API_KEY = 'YOUR_GROQ_KEY_HERE';
   ```
7. Replace `YOUR_GROQ_KEY_HERE` with your actual key
8. Save the file

**Rate limits on free tier:**
- ~30 requests per minute
- Resets every 60 seconds
- With the summary-based approach we use, each analysis costs only ~400 tokens
- You can safely run analysis 10+ times per minute

---

## Changing the Launch Location

To set a different GPS starting point:

**In `renderer.js`** find and change:
```javascript
center: [17.4953, 78.3929],   // map center
marker at [17.4953, 78.3929]  // starting marker position
```

**In `telemetry.js`** find and change:
```javascript
latitude:  parseFloat((17.4953 + this.latDrift).toFixed(6)),
longitude: parseFloat((78.3929 + this.lonDrift).toFixed(6)),
```

To convert DMS coordinates (degrees minutes seconds) to decimal:
- Degrees + (Minutes / 60) + (Seconds / 3600)
- Example: 17°29'43.0"N = 17 + (29/60) + (43/3600) = 17.4953

---

## Integrating Real Hardware (Future)

In the current version, data comes from the simulator in `telemetry.js`.
To connect a real CanSat sending data via radio and USB serial port,
replace the simulation interval in `main.js` with serial port reading:

```javascript
const SerialPort = require('serialport');
const port = new SerialPort({ path: 'COM3', baudRate: 9600 });

port.on('data', (rawData) => {
  const packet = parseRealSensorData(rawData);
  mainWindow.webContents.send('telemetry-data', packet);
});
```

The entire dashboard — charts, map, cards, AI analysis, CSV export —
works identically with real data. Only the data source changes.

Real hardware needed onboard the CanSat:
- GPS module (NEO-6M or similar) → latitude, longitude
- Barometric sensor (BMP280) → altitude, pressure
- Temperature sensor (DHT22 or BMP280 built-in) → temperature
- Voltage divider circuit → battery level
- Radio transmitter (LoRa SX1278 or NRF24L01) → sends data to ground
- Microcontroller (Arduino Nano / STM32) → reads sensors, formats and transmits packet

---

## Demo Day Checklist

- [ ] Run `npm install` at least once before demo day
- [ ] Add your Groq API key to `renderer.js`
- [ ] Test full simulation once — START → wait 2 mins → LANDED → AI Analysis
- [ ] Connect to projector and check all text is visible
- [ ] Keep laptop plugged in (Electron uses battery)
- [ ] On demo day: hit RESET first, then START when HOD is watching
- [ ] After LANDED, click AI Analysis to show the automated report
- [ ] Use Export CSV to show the raw data file if asked

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `Cannot find module './src/telemetry'` | `src` folder missing | Create `src` folder, put `telemetry.js` inside it |
| `EPERM mkdir C:\` | Wrong folder in terminal | Open terminal from inside the project folder |
| `npm warn deprecated` | Old packages | Normal, ignore — app works fine |
| `429 Too Many Requests` | Groq rate limit hit | Wait 60 seconds and try again |
| Map not loading | No internet | Check connection, map needs internet for tiles |
| AI panel shows error | Wrong API key | Check Groq key is correctly pasted in renderer.js |

---

*Built as part of INDIA SPACE LAB Internship Program*
*Dashboard architecture inspired by professional aerospace ground station software*