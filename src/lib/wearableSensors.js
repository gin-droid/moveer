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
 * Aggrega i campioni di frequenza cardiaca in un riepilogo utilizzabile dal backend.
 * @param {{ hrSamples: number[], durationMs: number, deviceName?: string }} input
 */
export function aggregateWearableData({ hrSamples, durationMs, deviceName }) {
  const out = { device_type: deviceName || "ble_hrm", heart_rate: null, motion: null };
  const hrs = hrSamples.filter((h) => h > 0);
  if (hrs.length) {
    out.heart_rate = {
      avg: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
      min: Math.min(...hrs),
      max: Math.max(...hrs),
      samples_count: hrs.length,
    };
  }
  return out;
}