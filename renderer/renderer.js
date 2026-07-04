/* global Chart, L, electronAPI */
'use strict';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
const MAX_WINDOW = 60;

const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

const state = {
  running: false,
  paused: false,
  packets: [],
  altHistory: [],
  descentHistory: [],
  tempHistory: [],
  pressHistory: [],
  timeLabels: [],
  missionSeconds: 0,
  timerHandle: null,
  lastAlt: 0,
  lastTemp: 0,
  lastDescent: 0,
  lastBatt: 8.4,
  trail: [],
  markerPos: [17.3850, 78.4867],
};

// ═══════════════════════════════════════════════════════════════
// CHART DEFAULTS
// ═══════════════════════════════════════════════════════════════
Chart.defaults.color = '#8b949e';
Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.font.size = 10;

const GRID_COLOR = 'rgba(255,255,255,0.04)';
const TICK_COLOR = '#5ae936';

// ═══════════════════════════════════════════════════════════════
// CHART 1 — ALTITUDE + DESCENT RATE
// ═══════════════════════════════════════════════════════════════
const ctxAlt = document.getElementById('chart-altitude').getContext('2d');
const chartAlt = new Chart(ctxAlt, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Altitude (m)',
        data: [],
        borderColor: '#00b4d8',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        yAxisID: 'yAlt',
      },
      {
        label: 'Descent Rate (m/s)',
        data: [],
        borderColor: '#f77f00',
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        yAxisID: 'yRate',
      },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'none' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        ticks: { color: TICK_COLOR, maxTicksLimit: 8, maxRotation: 0 },
        grid: { color: GRID_COLOR },
        border: { color: 'transparent' },
      },
      yAlt: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 600,
        ticks: { color: '#00b4d8', stepSize: 150 },
        grid: { color: GRID_COLOR },
        border: { color: 'transparent' },
      },
      yRate: {
        type: 'linear',
        position: 'right',
        min: -15,
        max: 15,
        ticks: { color: '#f77f00', stepSize: 5 },
        grid: { display: false },
        border: { color: 'transparent' },
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// CHART 2 — TEMP + PRESSURE
// ═══════════════════════════════════════════════════════════════
const ctxEnv = document.getElementById('chart-env').getContext('2d');
const chartEnv = new Chart(ctxEnv, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Temperature (°C)',
        data: [],
        borderColor: '#f77f00',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        yAxisID: 'yTemp',
      },
      {
        label: 'Pressure (hPa)',
        data: [],
        borderColor: '#9d4edd',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        yAxisID: 'yPress',
      },
    ],
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'none' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        ticks: { color: TICK_COLOR, maxTicksLimit: 8, maxRotation: 0 },
        grid: { color: GRID_COLOR },
        border: { color: 'transparent' },
      },
      yTemp: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 40,
        ticks: { color: '#f77f00', stepSize: 10 },
        grid: { color: GRID_COLOR },
        border: { color: 'transparent' },
      },
      yPress: {
        type: 'linear',
        position: 'right',
        min: 900,
        max: 1020,
        ticks: { color: '#9d4edd', stepSize: 30 },
        grid: { display: false },
        border: { color: 'transparent' },
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// LEAFLET MAP
// ═══════════════════════════════════════════════════════════════
let map, marker, polyline, markerPopup;

function initMap() {
  try {
    map = L.map('map', {
      center:[17.4953, 78.3929],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    const tileLayer =L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 18,
      errorTileUrl: '',
    });

    tileLayer.on('tileerror', () => {
      document.getElementById('map-fallback').classList.add('show');
    });

    tileLayer.addTo(map);

    // Custom pulsing marker icon
    const markerIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:16px;height:16px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:#00b4d8;opacity:0.3;animation:markerPulse 1.5s infinite;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;background:#00b4d8;"></div>
        </div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10],
    });

    // Inject animation into document
    if (!document.getElementById('marker-style')) {
      const s = document.createElement('style');
      s.id = 'marker-style';
      s.textContent = `
        @keyframes markerPulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          50%  { transform: scale(2.5); opacity: 0;   }
          100% { transform: scale(1);   opacity: 0.4; }
        }`;
      document.head.appendChild(s);
    }

    marker = L.marker([17.4953, 78.3929], { icon: markerIcon });
    marker.bindPopup('', { maxWidth: 220, className: 'dark-popup' });
    marker.addTo(map);

    polyline = L.polyline([], { color: '#0080ff', weight: 6, opacity: 1 }).addTo(map);

  } catch (err) {
    console.error('Map init error:', err);
    document.getElementById('map-fallback').classList.add('show');
  }
}

function updateMap(packet) {
  if (!map) return;
  const latlng = [packet.latitude, packet.longitude];
  state.trail.push(latlng);
  marker.setLatLng(latlng);
  polyline.setLatLngs(state.trail);
  marker.setPopupContent(
    `<b style="color:#00b4d8">LAT:</b> ${packet.latitude.toFixed(6)}<br>` +
    `<b style="color:#00b4d8">LON:</b> ${packet.longitude.toFixed(6)}<br>` +
    `<b style="color:#00b4d8">ALT:</b> ${packet.altitude} m<br>` +
    `<b style="color:#00b4d8">PKT:</b> #${String(packet.packetNo).padStart(4, '0')}`
  );
}

// ═══════════════════════════════════════════════════════════════
// PHASE BADGE
// ═══════════════════════════════════════════════════════════════
const PHASE_CLASSES = ['pre-launch', 'ascending', 'apogee', 'descending', 'landed'];
const PHASE_LABELS  = {
  'PRE-LAUNCH': 'PRE-LAUNCH',
  'ASCENDING':  'ASCENDING',
  'APOGEE':     'APOGEE',
  'DESCENDING': 'DESCENDING',
  'LANDED':     'LANDED',
};

function updatePhase(phase) {
  const badge = document.getElementById('phase-badge');
  const text  = document.getElementById('phase-text');
  PHASE_CLASSES.forEach(c => badge.classList.remove(c));
  badge.classList.add(phase.toLowerCase().replace('-', '-'));
  text.textContent = PHASE_LABELS[phase] || phase;

  // Status indicator
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  dot.className = 'status-dot';
  if (phase === 'ASCENDING' || phase === 'DESCENDING' || phase === 'APOGEE') {
    dot.classList.add('running');
    label.textContent = 'ACTIVE';
  } else if (phase === 'LANDED') {
    dot.classList.add('landed');
    label.textContent = 'LANDED';
  } else {
    label.textContent = 'STANDBY';
  }
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL STRENGTH
// ═══════════════════════════════════════════════════════════════
function updateSignal(rssi) {
  const text  = document.getElementById('rssi-val');
  const bars  = [
    document.getElementById('bar1'),
    document.getElementById('bar2'),
    document.getElementById('bar3'),
    document.getElementById('bar4'),
  ];
  text.textContent = `RSSI: ${rssi} dBm`;

  let color, count;
  if (rssi > -80)        { color = '#3fb950'; count = 4; }
  else if (rssi > -90)   { color = '#d29922'; count = 2; }
  else                   { color = '#f85149'; count = 1; }

  bars.forEach((b, i) => {
    b.style.background = i < count ? color : '#30363d';
  });

  text.style.color = color;
}

// ═══════════════════════════════════════════════════════════════
// STAT CARDS
// ═══════════════════════════════════════════════════════════════
function trend(history) {
  if (history.length < 2) return '';
  const delta = history[history.length - 1] - history[history.length - 2];
  return delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→';
}

function trendColor(history) {
  if (history.length < 2) return '';
  const delta = history[history.length - 1] - history[history.length - 2];
  return delta > 0.05 ? '#3fb950' : delta < -0.05 ? '#f85149' : '#8b949e';
}

function updateStatCards(packet) {
  // Altitude
  document.getElementById('stat-alt').textContent = packet.altitude.toFixed(1);
  const tAlt = document.getElementById('trend-alt');
  tAlt.textContent = trend(state.altHistory);
  tAlt.style.color = trendColor(state.altHistory);

  // Temperature
  document.getElementById('stat-temp').textContent = packet.temperature.toFixed(1);
  const tTemp = document.getElementById('trend-temp');
  tTemp.textContent = trend(state.tempHistory);
  tTemp.style.color = trendColor(state.tempHistory);

  // Descent Rate
  const dVal = document.getElementById('stat-descent');
  dVal.textContent = packet.descentRate.toFixed(1);
  // green if negative (descending is expected), orange if positive (ascending), muted at 0
  dVal.className = 'stat-value ' + (packet.descentRate < 0 ? 'green' : packet.descentRate > 0 ? 'orange' : 'cyan');
  const tDesc = document.getElementById('trend-descent');
  tDesc.textContent = trend(state.descentHistory);
  tDesc.style.color = trendColor(state.descentHistory);

  // Battery
  const batt  = packet.batteryVoltage;
  const battEl = document.getElementById('stat-batt');
  battEl.textContent = batt.toFixed(2);
  battEl.className = 'stat-value ' + (batt < 6.5 ? 'red' : 'cyan');

  // Battery bar: 6.0V → 0%, 8.4V → 100%
  const pct = Math.max(0, Math.min(100, ((batt - 6.0) / 2.4) * 100));
  const fill = document.getElementById('batt-bar');
  fill.style.width = pct + '%';
  fill.style.background = batt < 6.5 ? '#f85149' : batt < 7.2 ? '#d29922' : '#3fb950';

  const tBatt = document.getElementById('trend-batt');
  tBatt.textContent = '↓';
  tBatt.style.color = batt < 6.5 ? '#f85149' : '#8b949e';
}

// ═══════════════════════════════════════════════════════════════
// PACKET LOG
// ═══════════════════════════════════════════════════════════════
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function appendPacketLog(packet) {
  const log = document.getElementById('packet-log');
  const pktNum = String(packet.packetNo).padStart(4, '0');
  const t = formatTime(packet.timestamp);

  // Fade older lines
  const lines = log.querySelectorAll('.log-line:not(.muted)');
  lines.forEach((l, i) => {
    l.className = 'log-line';
    const age = lines.length - i;
    if (age >= 3) l.classList.add('old-3');
    else if (age >= 2) l.classList.add('old-2');
    else if (age >= 1) l.classList.add('old-1');
  });

  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent =
    `[${t}] PKT#${pktNum} | ALT: ${packet.altitude.toFixed(1)}m | ` +
    `TEMP: ${packet.temperature.toFixed(1)}°C | PRESS: ${packet.pressure.toFixed(1)}hPa | ` +
    `LAT: ${packet.latitude.toFixed(6)} | LON: ${packet.longitude.toFixed(6)} | ` +
    `BATT: ${packet.batteryVoltage.toFixed(2)}V`;

  log.appendChild(line);
  log.scrollTop = log.scrollHeight;

  // Keep log manageable (max 200 entries)
  while (log.children.length > 200) {
    log.removeChild(log.firstChild);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHARTS UPDATE
// ═══════════════════════════════════════════════════════════════
function updateCharts(packet) {
  const label = `${packet.timestamp}s`;

  // Push data
  state.timeLabels.push(label);
  state.altHistory.push(packet.altitude);
  state.descentHistory.push(packet.descentRate);
  state.tempHistory.push(packet.temperature);
  state.pressHistory.push(packet.pressure);

  // Sliding window
  if (state.timeLabels.length > MAX_WINDOW) {
    state.timeLabels.shift();
    state.altHistory.shift();
    state.descentHistory.shift();
    state.tempHistory.shift();
    state.pressHistory.shift();
  }

  // Chart 1
  chartAlt.data.labels = [...state.timeLabels];
  chartAlt.data.datasets[0].data = [...state.altHistory];
  chartAlt.data.datasets[1].data = [...state.descentHistory];
  chartAlt.update('none');

  // Chart 2
  chartEnv.data.labels = [...state.timeLabels];
  chartEnv.data.datasets[0].data = [...state.tempHistory];
  chartEnv.data.datasets[1].data = [...state.pressHistory];
  chartEnv.update('none');
}

// ═══════════════════════════════════════════════════════════════
// MISSION TIMER
// ═══════════════════════════════════════════════════════════════
function startTimer() {
  if (state.timerHandle) return;
  state.timerHandle = setInterval(() => {
    state.missionSeconds++;
    document.getElementById('mission-timer').textContent = formatTime(state.missionSeconds);
  }, 1000);
}

function stopTimer() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function resetTimer() {
  stopTimer();
  state.missionSeconds = 0;
  document.getElementById('mission-timer').textContent = '00:00';
}

// ═══════════════════════════════════════════════════════════════
// TELEMETRY PACKET HANDLER
// ═══════════════════════════════════════════════════════════════
function handlePacket(packet) {
  state.packets.push(packet);
  document.getElementById('pkt-counter').textContent = `PKT #${String(packet.packetNo).padStart(4, '0')}`;

  updateCharts(packet);
  updateStatCards(packet);
  updateMap(packet);
  updateSignal(packet.rssi);
  updatePhase(packet.phase);
  appendPacketLog(packet);
}

// ═══════════════════════════════════════════════════════════════
// FULL RESET
// ═══════════════════════════════════════════════════════════════
function doReset() {
  state.packets = [];
  state.altHistory = [];
  state.descentHistory = [];
  state.tempHistory = [];
  state.pressHistory = [];
  state.timeLabels = [];
  state.trail = [];
  state.running = false;
  state.paused = false;

  resetTimer();

  // Charts
  chartAlt.data.labels = [];
  chartAlt.data.datasets[0].data = [];
  chartAlt.data.datasets[1].data = [];
  chartAlt.update('none');

  chartEnv.data.labels = [];
  chartEnv.data.datasets[0].data = [];
  chartEnv.data.datasets[1].data = [];
  chartEnv.update('none');

  // Map
  if (polyline) polyline.setLatLngs([]);
  if (marker) marker.setLatLng([17.3850, 78.4867]);

  // Stat cards
  document.getElementById('stat-alt').textContent = '0.0';
  document.getElementById('stat-temp').textContent = '28.0';
  document.getElementById('stat-descent').textContent = '0.0';
  document.getElementById('stat-batt').textContent = '8.40';
  document.getElementById('batt-bar').style.width = '100%';
  document.getElementById('pkt-counter').textContent = 'PKT #0000';

  ['trend-alt','trend-temp','trend-descent','trend-batt'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  // Phase
  updatePhase('PRE-LAUNCH');

  // Signal
  updateSignal(-72);

  // Log
  const log = document.getElementById('packet-log');
  log.innerHTML = '<div class="log-line muted">[00:00] — System reset. Ready for new simulation.</div>';

  // Buttons
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('status-dot').className = 'status-dot';
  document.getElementById('status-label').textContent = 'STANDBY';
}

// ═══════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════
function exportCSV() {
  if (state.packets.length === 0) {
    alert('No telemetry data to export. Run a simulation first.');
    return;
  }

  const header = 'PacketNo,Timestamp,Altitude_m,Temperature_C,Pressure_hPa,DescentRate_ms,Latitude,Longitude,RSSI_dBm,Battery_V,Phase';
  const rows = state.packets.map(p =>
    [p.packetNo, p.timestamp, p.altitude, p.temperature, p.pressure,
     p.descentRate, p.latitude, p.longitude, p.rssi, p.batteryVoltage, p.phase].join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cansat-telemetry-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════════════
document.getElementById('btn-start').addEventListener('click', () => {
  if (state.running) return;
  state.running = true;
  state.paused  = false;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('status-dot').className = 'status-dot running';
  document.getElementById('status-label').textContent = 'RUNNING';
  startTimer();
  electronAPI.startSim();
});

document.getElementById('btn-pause').addEventListener('click', () => {
  if (!state.running) return;
  if (!state.paused) {
    state.paused = true;
    stopTimer();
    document.getElementById('btn-pause').textContent = '▶ RESUME';
    document.getElementById('status-dot').className = 'status-dot paused';
    document.getElementById('status-label').textContent = 'PAUSED';
    electronAPI.pauseSim();
  } else {
    state.paused = false;
    startTimer();
    document.getElementById('btn-pause').textContent = '⏸ PAUSE';
    document.getElementById('status-dot').className = 'status-dot running';
    document.getElementById('status-label').textContent = 'RUNNING';
    electronAPI.startSim();
  }
});

document.getElementById('btn-reset').addEventListener('click', () => {
  electronAPI.resetSim();
  doReset();
  document.getElementById('btn-pause').textContent = '⏸ PAUSE';
});

document.getElementById('btn-export').addEventListener('click', exportCSV);

// ═══════════════════════════════════════════════════════════════
// IPC BRIDGE LISTENERS
// ═══════════════════════════════════════════════════════════════
electronAPI.onTelemetry(handlePacket);
electronAPI.onReset(() => doReset());

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
initMap();
updatePhase('PRE-LAUNCH');
updateSignal(-72);


async function runAIAnalysis() {
  if (state.packets.length === 0) {
    alert('No flight data yet. Run a simulation first.');
    return;
  }

  document.getElementById('ai-panel').classList.add('show');
  document.getElementById('ai-loading').classList.add('show');
  document.getElementById('ai-result').innerHTML = '';

  const altValues = state.packets.map(p => p.altitude);
  const tempValues = state.packets.map(p => p.temperature);
  const pressValues = state.packets.map(p => p.pressure);
  const descentValues = state.packets.map(p => p.descentRate);

  const summary = {
    totalPackets: state.packets.length,
    flightDuration: state.packets[state.packets.length - 1].timestamp + 's',
    altitude: {
      max: Math.max(...altValues).toFixed(1),
      min: Math.min(...altValues).toFixed(1),
      atLanding: altValues[altValues.length - 1].toFixed(1)
    },
    temperature: {
      max: Math.max(...tempValues).toFixed(1),
      min: Math.min(...tempValues).toFixed(1),
      atLanding: tempValues[tempValues.length - 1].toFixed(1)
    },
    pressure: {
      max: Math.max(...pressValues).toFixed(1),
      min: Math.min(...pressValues).toFixed(1)
    },
    descentRate: {
      max: Math.max(...descentValues).toFixed(1),
      min: Math.min(...descentValues).toFixed(1),
      avg: (descentValues.reduce((a,b) => a+b,0) / descentValues.length).toFixed(1)
    },
    battery: {
      start: state.packets[0].batteryVoltage.toFixed(2),
      end: state.packets[state.packets.length - 1].batteryVoltage.toFixed(2),
      drain: (state.packets[0].batteryVoltage - state.packets[state.packets.length - 1].batteryVoltage).toFixed(2)
    },
    phases: [...new Set(state.packets.map(p => p.phase))].join(' → ')
  };

  const prompt = `You are an aerospace flight data analyst. Analyse this CanSat flight summary and give a post-flight report.

FLIGHT SUMMARY:
- Total Packets: ${summary.totalPackets}
- Flight Duration: ${summary.flightDuration}
- Phases: ${summary.phases}

ALTITUDE: Max=${summary.altitude.max}m, Min=${summary.altitude.min}m, At Landing=${summary.altitude.atLanding}m
TEMPERATURE: Max=${summary.temperature.max}°C, Min=${summary.temperature.min}°C, At Landing=${summary.temperature.atLanding}°C
PRESSURE: Max=${summary.pressure.max}hPa, Min=${summary.pressure.min}hPa
DESCENT RATE: Max=${summary.descentRate.max}m/s, Min=${summary.descentRate.min}m/s, Avg=${summary.descentRate.avg}m/s
BATTERY: Start=${summary.battery.start}V, End=${summary.battery.end}V, Total Drain=${summary.battery.drain}V

Provide analysis in these sections:
1. MISSION SUMMARY - success or failure and why
2. ALTITUDE PROFILE - peak altitude and ascent performance
3. ANOMALIES DETECTED - anything unusual
4. TEMPERATURE & PRESSURE - atmospheric observations
5. BATTERY HEALTH - drain rate assessment
6. PARACHUTE PERFORMANCE - descent rate analysis
7. RECOMMENDATIONS - improvements for next flight

Keep it concise and technical.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.choices[0].message.content;

    document.getElementById('ai-loading').classList.remove('show');

const formatted = text
  .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#9d4edd">$1</strong>')
  .replace(/\*(.*?)\*/g, '<em style="color:#00b4d8">$1</em>')
  .replace(/^(\d+)\.\s+/gm, '<br><strong style="color:#9d4edd;font-family:JetBrains Mono,monospace;font-size:11px;letter-spacing:0.1em">$1.</strong> ')
  .replace(/#{1,3}\s+(.*?)(\n|$)/g, '<strong style="color:#9d4edd">$1</strong><br>')
  .replace(/\n\n/g, '<br><br>')
  .replace(/\n/g, '<br>');

  document.getElementById('ai-result').innerHTML = `
    <div class="ai-section">
      <h4>📊 POST FLIGHT AI ANALYSIS</h4>
      <p>${formatted}</p>
    </div>`;

  } catch (err) {
    document.getElementById('ai-loading').classList.remove('show');
    document.getElementById('ai-result').innerHTML =
      `<div class="ai-section" style="border-color:#f85149">
        <h4>ERROR</h4>
        <p>Could not connect to Groq. Check your API key and internet connection.</p>
        <p style="color:#f85149;margin-top:8px">${err.message}</p>
      </div>`;
  }
}

document.getElementById('btn-ai').addEventListener('click', runAIAnalysis);
document.getElementById('ai-close').addEventListener('click', () => {
  document.getElementById('ai-panel').classList.remove('show');
});

// Button listeners
document.getElementById('btn-ai').addEventListener('click', runAIAnalysis);
document.getElementById('ai-close').addEventListener('click', () => {
  document.getElementById('ai-panel').classList.remove('show');
});