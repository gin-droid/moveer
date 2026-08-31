import { useEffect, useRef, useState } from "react";
import { HeartPulse, Watch, Activity, Bluetooth, BluetoothOff, Smartphone, Loader2, X } from "lucide-react";
import {
  isWebBluetoothSupported,
  isDeviceMotionSupported,
  requestDeviceMotionPermission,
  connectHeartRate,
  startMotionCapture,
  aggregateWearableData,
} from "@/lib/wearableSensors";

/**
 * WearableConnector
 * Permette di collegare una fascia cardio (BLE) e/o i sensori di movimento
 * del telefono per arricchire l'analisi biomeccanica con dati reali:
 * frequenza cardiaca, intensità e cadenza del movimento.
 *
 * Notifica i dati aggregati al parent tramite onWearableData(payload).
 */
export default function WearableConnector({ onWearableData }) {
  const [hrSupported] = useState(isWebBluetoothSupported());
  const [motionSupported] = useState(isDeviceMotionSupported());

  const [hrConnected, setHrConnected] = useState(false);
  const [hrConnecting, setHrConnecting] = useState(false);
  const [hrDevice, setHrDevice] = useState("");
  const [hr, setHr] = useState(0);

  const [motionActive, setMotionActive] = useState(false);
  const [motionStarting, setMotionStarting] = useState(false);
  const [liveAccel, setLiveAccel] = useState(0);

  const hrConnRef = useRef(null);
  const stopMotionRef = useRef(null);
  const hrSamplesRef = useRef([]);
  const motionSamplesRef = useRef([]);
  const startTimeRef = useRef(null);

  // Aggrega e notifica il parent ogni secondo
  useEffect(() => {
    const id = setInterval(() => {
      if (hrSamplesRef.current.length === 0 && motionSamplesRef.current.length === 0) return;
      const data = aggregateWearableData({
        hrSamples: hrSamplesRef.current,
        motionSamples: motionSamplesRef.current,
        durationMs: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
        deviceName: hrDevice || "phone_imu",
      });
      onWearableData?.(data);
    }, 1000);
    return () => clearInterval(id);
  }, [onWearableData, hrDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { hrConnRef.current?.disconnect(); } catch { /* ignore */ }
      stopMotionRef.current?.();
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

  const handleStartMotion = async () => {
    setMotionStarting(true);
    try {
      const granted = await requestDeviceMotionPermission();
      if (!granted) return;
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      stopMotionRef.current = startMotionCapture((sample) => {
        motionSamplesRef.current.push(sample);
        setLiveAccel(sample.accelMag);
      });
      setMotionActive(true);
    } catch (err) {
      console.error(err);
    } finally {
      setMotionStarting(false);
    }
  };

  const stopMotion = () => {
    stopMotionRef.current?.();
    stopMotionRef.current = null;
    setMotionActive(false);
    setLiveAccel(0);
  };

  const reset = () => {
    hrSamplesRef.current = [];
    motionSamplesRef.current = [];
    startTimeRef.current = null;
    onWearableData?.(null);
  };

  const hasData = hrSamplesRef.current.length > 0 || motionSamplesRef.current.length > 0;

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
              <div className="text-sm font-medium text-white">Fascia cardio</div>
              <div className="text-[11px] text-zinc-500">{hrConnected ? hrDevice : "Bluetooth LE"}</div>
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
      </div>

      {/* Phone motion sensors */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${motionActive ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Sensori movimento</div>
              <div className="text-[11px] text-zinc-500">Accelerometro + giroscopio</div>
            </div>
          </div>
          {motionActive ? (
            <div className="flex items-center gap-2">
              <span className="text-xl font-display font-semibold text-emerald-400 tabular-nums">{liveAccel.toFixed(1)}<span className="text-xs text-zinc-500 font-body ml-1">m/s²</span></span>
              <button onClick={stopMotion} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center" aria-label="Ferma">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : motionSupported ? (
            <button
              onClick={handleStartMotion}
              disabled={motionStarting}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50"
            >
              {motionStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              {motionStarting ? "Avvio…" : "Attiva"}
            </button>
          ) : (
            <span className="text-[11px] text-zinc-600">Non supportato</span>
          )}
        </div>
        <p className="mt-2.5 text-[11px] text-zinc-500 leading-relaxed">
          Tieni il telefono in tasca o fissato al corpo durante la registrazione per catturare
          accelerazione e cadenza del movimento reali.
        </p>
      </div>

      {hasData && (
        <button onClick={reset} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          Azzera dati raccolti
        </button>
      )}
    </div>
  );
}