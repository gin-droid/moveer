/**
 * wearableSensors.js
 * Integrazione con wearable e sensori del dispositivo per l'analisi biomeccanica.
 *
 * Fonti dati supportate (web):
 *  1. Web Bluetooth — fascia cardio / smartwatch con GATT Heart Rate Service (0x180D).
 *     Funziona su Chrome/Edge Android e desktop. NON supportato su iOS Safari
 *     (richiede il plugin Capacitor nativo per iOS).
 *  2. DeviceMotion / DeviceOrientation — accelerometro e giroscopio del telefono.
 *     Universale (iOS Safari 13+ richiede permission request). Usato sia come
 *     sensore primario (telefono indossato sul corpo) sia come fallback quando
 *     non è disponibile un wearable BLE.
 *
 * I dati raccolti (frequenza cardiaca, intensità del movimento, cadenza) vengono
 * aggregati in un riepilogo utilizzabile dalla funzione di analisi backend per
 * arricchire il contesto biomeccanico.
 */

const HR_SERVICE = 0x180d;
const HR_MEASUREMENT = 0x2a37;

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth?.requestDevice;
}

export function isDeviceMotionSupported() {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window;
}

// iOS 13+ richiede una richiesta esplicita di permesso per i sensori movimento.
export async function requestDeviceMotionPermission() {
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true;
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
 * Avvia la cattura dei sensori di movimento del telefono.
 * @param {(sample: { accelMag: number, rotMag: number, t: number }) => void} onSample
 * @returns {() => void} stop function
 */
export function startMotionCapture(onSample) {
  const handler = (e) => {
    const a = e.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
    const r = e.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
    // Rimuovi ~g (9.81) dalla componente dominante per approssimare l'accelerazione lineare
    const ax = a.x ?? 0, ay = a.y ?? 0, az = a.z ?? 0;
    const linearZ = az > 9 ? az - 9.81 : az < -9 ? az + 9.81 : az;
    const accelMag = Math.sqrt(ax * ax + ay * ay + linearZ * linearZ);
    const rotMag = Math.sqrt((r.alpha || 0) ** 2 + (r.beta || 0) ** 2 + (r.gamma || 0) ** 2);
    onSample({ accelMag, rotMag, t: Date.now() });
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Aggrega i campioni raccolti in un riepilogo utilizzabile dal backend.
 * @param {{ hrSamples: number[], motionSamples: { accelMag: number, rotMag: number }[], durationMs: number, deviceName?: string }} input
 */
export function aggregateWearableData({ hrSamples, motionSamples, durationMs, deviceName }) {
  const out = { device_type: deviceName || "phone_imu", heart_rate: null, motion: null };

  if (hrSamples.length > 0) {
    const hrs = hrSamples.filter((h) => h > 0);
    if (hrs.length) {
      out.heart_rate = {
        avg: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
        min: Math.min(...hrs),
        max: Math.max(...hrs),
        samples_count: hrs.length,
      };
    }
  }

  if (motionSamples.length > 0) {
    const mags = motionSamples.map((s) => s.accelMag);
    const rotMags = motionSamples.map((s) => s.rotMag);
    const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
    const peak = Math.max(...mags);
    // Cadence: conta i picchi di accelerazione sopra una soglia dinamica
    const threshold = avg + 1.5;
    let peaks = 0;
    for (let i = 1; i < mags.length - 1; i++) {
      if (mags[i] > threshold && mags[i] > mags[i - 1] && mags[i] > mags[i + 1]) peaks++;
    }
    const durationS = durationMs / 1000;
    const cadence = durationS > 0 ? Math.round((peaks / durationS) * 60) : 0;
    out.motion = {
      avg_accel: round1(avg),
      peak_accel: round1(peak),
      avg_rot: round1(rotMags.reduce((a, b) => a + b, 0) / rotMags.length),
      cadence,
      duration_s: Math.round(durationS),
      samples_count: motionSamples.length,
    };
  }

  return out;
}