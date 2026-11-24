/**
 * wearableSensors.js
 * Integrazione con wearable esterni (fascia cardio / smartwatch) via Web Bluetooth
 * per arricchire l'analisi biomeccanica con la frequenza cardiaca reale.
 *
 * Il telefono resta dedicato alla registrazione video: i dati provengono
 * esclusivamente da dispositivi esterni collegati via Bluetooth LE.
 *
 * Web Bluetooth funziona su Chrome/Edge Android e desktop. NON è supportato su
 * iOS Safari (richiede il plugin Capacitor nativo per iOS).
 */

const HR_SERVICE = 0x180d;
const HR_MEASUREMENT = 0x2a37;

// Servizio IMU custom (accelerometro + giroscopio) per sensori di movimento BLE.
// Frame: 12 byte = 6 int16 little-endian (ax, ay, az, gx, gy, gz).
// Accel in milli-g, giro in milli-°/s.
const IMU_SERVICE = "cc26a010-6b75-4c8e-8d9f-4a3d5c2e1b0a";
const IMU_DATA_CHAR = "cc26a011-6b75-4c8e-8d9f-4a3d5c2e1b0a";

// Running Speed and Cadence (standard GATT 0x1814) — fallback per la cadenza.
const RSC_SERVICE = 0x1814;
const RSC_MEASUREMENT = 0x2a53;

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth?.requestDevice;
}

/**
 * Connette a un monitor cardiaco BLE (Heart Rate Service standard).
 * @param {(hr: number, rr: number[]) => void} onData callback per ogni misurazione
 * @param {() => void} onDisconnect callback quando il dispositivo si disconnette
 * @returns {Promise<{ disconnect: () => void, deviceName: string }>}
 */
export async function connectHeartRate(onData, onDisconnect) {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth non è supportato su questo browser. Su iOS usa l'app nativa.");
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [HR_SERVICE] }],
    optionalServices: [HR_SERVICE],
  });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HR_SERVICE);
  const char = await service.getCharacteristic(HR_MEASUREMENT);
  await char.startNotifications();
  char.addEventListener("characteristicvaluechanged", (e) => {
    const parsed = parseHeartRate(e.target.value);
    onData(parsed.hr, parsed.rrIntervals);
  });
  return {
    deviceName: device.name || "Monitor cardiaco",
    disconnect: () => {
      try {
        if (device.gatt?.connected) device.gatt.disconnect();
      } catch { /* ignore */ }
    },
  };
}

// Parse Heart Rate Measurement characteristic (GATT 0x2A37)
function parseHeartRate(dataView) {
  const flags = dataView.getUint8(0);
  const is16bit = flags & 0x01;
  let hr;
  let offset = 1;
  if (is16bit) {
    hr = dataView.getUint16(offset, true);
    offset += 2;
  } else {
    hr = dataView.getUint8(offset);
    offset += 1;
  }
  const rrIntervals = [];
  if (flags & 0x10) {
    for (let i = offset; i + 1 < dataView.byteLength; i += 2) {
      rrIntervals.push(dataView.getUint16(i, true) / 1024);
    }
  }
  return { hr, rrIntervals };
}

/**
 * Connette a un sensore di movimento BLE (IMU custom o RSC standard).
 * @param {(sample: {accel?: {x,y,z}, gyro?: {x,y,z}, cadence?: number}) => void} onData
 * @param {() => void} onDisconnect
 * @returns {Promise<{ disconnect: () => void, deviceName: string, mode: string }>}
 */
export async function connectIMU(onData, onDisconnect) {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth non è supportato su questo browser. Su iOS usa l'app nativa.");
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [IMU_SERVICE, RSC_SERVICE],
  });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();

  // 1. Try raw IMU service (accel + gyro)
  try {
    const service = await server.getPrimaryService(IMU_SERVICE);
    const char = await service.getCharacteristic(IMU_DATA_CHAR);
    await char.startNotifications();
    char.addEventListener("characteristicvaluechanged", (e) => {
      const parsed = parseIMUFrame(e.target.value);
      if (parsed) onData(parsed);
    });
    return {
      deviceName: device.name || "Sensore IMU",
      mode: "imu",
      disconnect: () => { try { if (device.gatt?.connected) device.gatt.disconnect(); } catch { /* ignore */ } },
    };
  } catch { /* IMU service not available — try RSC fallback */ }

  // 2. Fallback: Running Speed and Cadence (cadence only)
  try {
    const service = await server.getPrimaryService(RSC_SERVICE);
    const char = await service.getCharacteristic(RSC_MEASUREMENT);
    await char.startNotifications();
    char.addEventListener("characteristicvaluechanged", (e) => {
      const parsed = parseRSC(e.target.value);
      if (parsed) onData({ cadence: parsed.cadence });
    });
    return {
      deviceName: device.name || "Sensore cadenza",
      mode: "rsc",
      disconnect: () => { try { if (device.gatt?.connected) device.gatt.disconnect(); } catch { /* ignore */ } },
    };
  } catch { /* RSC not available either */ }

  throw new Error("Nessun servizio IMU o cadenza trovato sul dispositivo selezionato.");
}

// Parse IMU frame: 12 byte = 6 int16 LE (ax, ay, az, gx, gy, gz)
function parseIMUFrame(dataView) {
  if (dataView.byteLength < 12) return null;
  return {
    accel: {
      x: dataView.getInt16(0, true),
      y: dataView.getInt16(2, true),
      z: dataView.getInt16(4, true),
    },
    gyro: {
      x: dataView.getInt16(6, true),
      y: dataView.getInt16(8, true),
      z: dataView.getInt16(10, true),
    },
  };
}

// Parse RSC Measurement (GATT 0x2A53): flags, speed (uint16 m/s*256), cadence (uint8 spm)
function parseRSC(dataView) {
  if (dataView.byteLength < 4) return null;
  const speed = dataView.getUint16(1, true) / 256;
  const cadence = dataView.getUint8(3);
  return { speed, cadence };
}

/**
 * Calcola le metriche di movimento da campioni IMU o RSC.
 * @param {Array} samples campioni {accel, gyro} o {cadence}
 * @param {number} durationMs durata della sessione
 */
function computeMotionMetrics(samples, durationMs) {
  if (!samples || samples.length === 0) return null;
  const durationS = durationMs / 1000;

  const imuSamples = samples.filter((s) => s.accel || s.gyro);
  const cadenceSamples = samples.filter((s) => s.cadence != null);

  let avgAccel = 0, peakAccel = 0, avgRot = 0, cadence = 0;

  if (imuSamples.length > 0) {
    const accelMags = [];
    const gyroMags = [];
    for (const s of imuSamples) {
      if (s.accel) {
        // milli-g → m/s²: (raw / 1000) * 9.81
        const ax = (s.accel.x / 1000) * 9.81;
        const ay = (s.accel.y / 1000) * 9.81;
        const az = (s.accel.z / 1000) * 9.81;
        // accelerazione dinamica = |modulo - gravità|
        accelMags.push(Math.abs(Math.sqrt(ax * ax + ay * ay + az * az) - 9.81));
      }
      if (s.gyro) {
        // milli-°/s → °/s: raw / 1000
        const gx = s.gyro.x / 1000;
        const gy = s.gyro.y / 1000;
        const gz = s.gyro.z / 1000;
        gyroMags.push(Math.sqrt(gx * gx + gy * gy + gz * gz));
      }
    }
    if (accelMags.length) {
      avgAccel = accelMags.reduce((a, b) => a + b, 0) / accelMags.length;
      peakAccel = Math.max(...accelMags);
    }
    if (gyroMags.length) {
      avgRot = gyroMags.reduce((a, b) => a + b, 0) / gyroMags.length;
    }
    if (accelMags.length > 10 && durationS > 0) {
      cadence = estimateCadenceFromAccel(accelMags, durationS);
    }
  }

  // RSC fornisce la cadenza direttamente (passi/min)
  if (cadenceSamples.length > 0) {
    cadence = Math.round(cadenceSamples.reduce((a, s) => a + s.cadence, 0) / cadenceSamples.length);
  }

  return {
    avg_accel: Math.round(avgAccel * 100) / 100,
    peak_accel: Math.round(peakAccel * 100) / 100,
    avg_rot: Math.round(avgRot * 100) / 100,
    cadence,
    duration_s: Math.round(durationS * 10) / 10,
    samples_count: samples.length,
  };
}

// Stima la cadenza (rip/min) dalla periodicità dell'accelerazione dinamica.
function estimateCadenceFromAccel(accelMags, durationS) {
  const threshold = 1.5; // m/s² sopra la gravità
  const minSpacing = Math.max(1, Math.floor(accelMags.length / Math.max(durationS * 2, 1)));
  let peaks = 0;
  let lastPeakIdx = -minSpacing - 1;
  for (let i = 1; i < accelMags.length - 1; i++) {
    if (
      accelMags[i] > threshold &&
      accelMags[i] >= accelMags[i - 1] &&
      accelMags[i] >= accelMags[i + 1] &&
      i - lastPeakIdx > minSpacing
    ) {
      peaks++;
      lastPeakIdx = i;
    }
  }
  const durationMin = durationS / 60;
  return durationMin > 0 ? Math.round(peaks / durationMin) : 0;
}

/**
 * Aggrega i campioni di frequenza cardiaca e movimento in un riepilogo per il backend.
 * @param {{ hrSamples?: number[], motionSamples?: Array, durationMs: number, deviceName?: string }} input
 */
export function aggregateWearableData({ hrSamples, motionSamples, durationMs, deviceName }) {
  const out = { device_type: deviceName || "ble_wearable", heart_rate: null, motion: null };
  const hrs = (hrSamples || []).filter((h) => h > 0);
  if (hrs.length) {
    out.heart_rate = {
      avg: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
      min: Math.min(...hrs),
      max: Math.max(...hrs),
      samples_count: hrs.length,
    };
  }
  const motion = computeMotionMetrics(motionSamples, durationMs);
  if (motion) out.motion = motion;
  return out;
}