import { useEffect, useRef, useState } from "react";
import { HeartPulse, Bluetooth, BluetoothOff, Loader2, X, Watch } from "lucide-react";
import {
  isWebBluetoothSupported,
  connectHeartRate,
  aggregateWearableData,
} from "@/lib/wearableSensors";

/**
 * WearableConnector
 * Permette di collegare una fascia cardio / smartwatch esterno via Bluetooth LE
 * per arricchire l'analisi con la frequenza cardiaca reale.
 *
 * Il telefono resta libero di registrare il video: i dati provengono
 * esclusivamente da dispositivi esterni (wearable BLE).
 */
export default function WearableConnector({ onWearableData }) {
  const [hrSupported] = useState(isWebBluetoothSupported());
  const [hrConnected, setHrConnected] = useState(false);
  const [hrConnecting, setHrConnecting] = useState(false);
  const [hrDevice, setHrDevice] = useState("");
  const [hr, setHr] = useState(0);

  const hrConnRef = useRef(null);
  const hrSamplesRef = useRef([]);
  const startTimeRef = useRef(null);

  // Aggrega e notifica il parent ogni secondo
  useEffect(() => {
    const id = setInterval(() => {
      if (hrSamplesRef.current.length === 0) return;
      const data = aggregateWearableData({
        hrSamples: hrSamplesRef.current,
        durationMs: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
        deviceName: hrDevice,
      });
      onWearableData?.(data);
    }, 1000);
    return () => clearInterval(id);
  }, [onWearableData, hrDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { hrConnRef.current?.disconnect(); } catch { /* ignore */ }
    };
  }, []);

  const handleConnectHR = async () => {
    setHrConnecting(true);
    try {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      const conn = await connectHeartRate(
        (value) => {
          setHr(value);
          hrSamplesRef.current.push(value);
        },
        () => {
          setHrConnected(false);
          setHr(0);
          hrConnRef.current = null;
        }
      );
      hrConnRef.current = conn;
      setHrDevice(conn.deviceName);
      setHrConnected(true);
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.error(err);
      }
    } finally {
      setHrConnecting(false);
    }
  };

  const disconnectHR = () => {
    try { hrConnRef.current?.disconnect(); } catch { /* ignore */ }
    hrConnRef.current = null;
    setHrConnected(false);
    setHr(0);
  };

  const reset = () => {
    hrSamplesRef.current = [];
    startTimeRef.current = null;
    onWearableData?.(null);
  };

  return (
    <div className="space-y-3">
      {/* Heart Rate Monitor (BLE) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hrConnected ? "bg-rose-500/15 text-rose-400" : "bg-zinc-800 text-zinc-500"}`}>
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Fascia cardio / smartwatch</div>
              <div className="text-[11px] text-zinc-500">{hrConnected ? hrDevice : "Bluetooth LE esterno"}</div>
            </div>
          </div>
          {hrConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-display font-semibold text-rose-400 tabular-nums">{hr}<span className="text-xs text-zinc-500 font-body ml-1">bpm</span></span>
              <button onClick={disconnectHR} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center" aria-label="Disconnetti">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : hrSupported ? (
            <button
              onClick={handleConnectHR}
              disabled={hrConnecting}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
            >
              {hrConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
              {hrConnecting ? "Connessione…" : "Collega"}
            </button>
          ) : (
            <span className="text-[11px] text-zinc-600 flex items-center gap-1"><BluetoothOff className="w-3.5 h-3.5" /> Non supportato</span>
          )}
        </div>
        <p className="mt-2.5 text-[11px] text-zinc-500 leading-relaxed">
          Collega una fascia toracica o uno smartwatch compatibile Bluetooth. Il telefono resta libero
          di registrare il video, mentre il wearable misura la frequenza cardiaca durante l'esecuzione.
        </p>
      </div>

      {!hrSupported && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-amber-300/90 text-xs leading-relaxed">
          <Watch className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Il tuo browser non supporta Web Bluetooth. Su iOS usa l'app nativa per collegare
            fascia cardio e smartwatch esterni.
          </span>
        </div>
      )}

      {hrSamplesRef.current.length > 0 && (
        <button onClick={reset} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          Azzera dati raccolti
        </button>
      )}
    </div>
  );
}