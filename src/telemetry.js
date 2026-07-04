'use strict';

class TelemetryGenerator {
  constructor() {
    this.reset();
  }

  reset() {
    this.t = 0;
    this.packetNo = 0;
    this.prevAltitude = 0;
    this.latDrift = 0;
    this.lonDrift = 0;
  }

  computeAltitude(t) {
    if (t < 30) {
      // PRE-LAUNCH
      return 0;
    } else if (t < 60) {
      // ASCENDING: 0 → 500m
      const progress = (t - 30) / 30;
      return 500 * Math.pow(Math.sin(Math.PI * progress / 2), 0.5);
    } else if (t < 65) {
      // APOGEE: hold near 500m
      return 500 + (Math.random() * 10 - 5);
    } else if (t < 110) {
      // DESCENDING: 500 → 0m
      const progress = (t - 65) / 45;
      return 500 * (1 - progress);
    } else {
      // LANDED
      return 0;
    }
  }

  random(min, max) {
    return min + Math.random() * (max - min);
  }

  tick() {
    this.t += 1;
    this.packetNo += 1;

    const t = this.t;
    const altitude = Math.max(0, this.computeAltitude(t) + this.random(-1.5, 1.5));
    const descentRate = parseFloat((altitude - this.prevAltitude).toFixed(1));
    this.prevAltitude = altitude;

    // GPS drift: simulate slight wind/drift
    // this.latDrift += this.random(-0.00003, 0.00005);
    // this.lonDrift += this.random(-0.00002, 0.00006);

    // GPS drift: stop moving after landing
    if (t < 110) {
      this.latDrift += this.random(-0.00003, 0.00005);
      this.lonDrift += this.random(-0.00002, 0.00006);
    }

    const temperature = parseFloat((28 - (altitude / 50) + this.random(-0.5, 0.5)).toFixed(1));
    const pressure = parseFloat((1013 - (altitude / 8.4) + this.random(-0.5, 0.5)).toFixed(1));
    const rssi = Math.round(-72 + this.random(-8, 8));
    const batteryVoltage = parseFloat((8.4 - (t * 0.008)).toFixed(2));

    // Determine phase
    let phase;
    if (t < 30) {
      phase = 'PRE-LAUNCH';
    } else if (t < 60) {
      phase = 'ASCENDING';
    } else if (t < 65) {
      phase = 'APOGEE';
    } else if (t < 110) {
      phase = 'DESCENDING';
    } else {
      phase = 'LANDED';
    }

    const packet = {
      packetNo: this.packetNo,
      timestamp: t,
      altitude: parseFloat(altitude.toFixed(1)),
      temperature,
      pressure,
      descentRate,
      latitude: parseFloat((17.4953 + this.latDrift).toFixed(6)), 
      longitude: parseFloat(( 78.3929 + this.lonDrift).toFixed(6)),
      rssi,
      batteryVoltage: Math.max(6.0, batteryVoltage),
      phase,
    };

    return packet;
  }
}

module.exports = TelemetryGenerator;
