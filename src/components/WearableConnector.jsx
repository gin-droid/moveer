import { useEffect, useRef, useState } from "react";
import { HeartPulse, Bluetooth, BluetoothOff, Loader2, X, Watch, Move } from "lucide-react";
import {
  isWebBluetoothSupported,
  connectHeartRate,
  connectIMU,
  aggregateWearableData,
} from "@/lib/wearableSensors";

export default function WearableConnector({ onWearableData }) {
  const [hrSupported] = useState(isWebBluetoothSupported());
  const [hrConnected, setHrConnected] = useState(false);
  const [hrConnecting, setHrConnecting] = useState(false);
  const [hrDevice, setHrDevice] = useState("");
  const [hr, setHr] = useState(0);
  const [imuConnected, setImuConnected] = useState(false);
  const [imuConnecting, setImuConnecting] = useState(false);
  const [imuDevice, setImuDevice] = useState("");
  const [imuMode, setImuMode] = useState("");
  const [motionMag, setMotionMag] = useState(0);

  const hrConnRef = useRef(null);
  const hrSamplesRef = useRef([]);
  const imuConnRef = useRef(null);
  const motionSamplesRef = useRef([]);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (hrSamplesRef.current.length === 0 && motionSamplesRef.current.length === 0) return;
      const data = aggregateWearableData({
        hrSamples: hrSamplesRef.current,
        motionSamples: motionSamplesRef.current,
        durationMs: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
        deviceName: imuDevice || hrDevice,
      });
      onWearableData?.(data);
    }, 1000);
    return () => clearInterval(id);
  }, [onWearableData, hrDevice, imuDevice]);

  useEffect(() => {
    return () => {
      try { hrConnRef.current?.disconnect(); } catch { /* ignore */ }
      try { imuConnRef.current?.disconnect(); } catch { /* ignore */ }
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

  const handleConnectIMU = async () => {
    setImuConnecting(true);
    try {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      const conn = await connectIMU(
        (sample) => {
          motionSamplesRef.current.push(sample);
          if (sample.accel) {
            const ax = (sample.accel.x / 1000) * 9.81;
            const ay = (sample.accel.y / 1000) * 9.81;
            const az = (sample.accel.z / 1000) * 9.81;
            setMotionMag(Math.abs(Math.sqrt(ax * ax + ay * ay + az * az) - 9.81));
          }
        },
        () => {
          setImuConnected(false);
          setMotionMag(0);
          imuConnRef.current = null;
        }
      );
      imuConnRef.current = conn;
      setImuDevice(conn.deviceName);
      setImuMode(conn.mode);
      setImuConnected(true);
    } catch (err) {
      if (err.name !== "NotFoundError") {
        console.error(err);
      }
    } finally {
      setImuConnecting(false);
    }
  };

  const disconnectIMU = () => {
    try { imuConnRef.current?.disconnect(); } catch { /* ignore */ }
    imuConnRef.current = null;
    setImuConnected(false);
    setMotionMag(0);
  };

  const reset = () => {
    hrSamplesRef.current = [];
    motionSamplesRef.current = [];
    startTimeRef.current = null;
    onWearableData?.(null);
  };

  return (
    <div className="space-y-3">
      {/* Heart Rate Monitor (BLE) */}
      <div className="rounded-xl border border-border bg-background/50 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hrConnected ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">Fascia cardio</div>
              <div className="text-[11px] text-muted-foreground truncate">{hrConnected ? hrDevice : "Bluetooth LE"}</div>
            </div>
          </div>
          {hrConnected ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-display font-semibold text-destructive tabular-nums">{hr}<span className="text-[10px] text-muted-foreground font-body ml-0.5">bpm</span></span>
              <button onClick={disconnectHR} className="w-9 h-9 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors" aria-label="Disconnetti">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : hrSupported ? (
            <button
              onClick={handleConnectHR}
              disabled={hrConnecting}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary border border-primary/30 transition-colors disabled:opacity-50 shrink-0 min-h-[40px]"
            >
              {hrConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
              {hrConnecting ? "…" : "Collega"}
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0"><BluetoothOff className="w-3.5 h-3.5" /> No BLE</span>
          )}
        </div>
      </div>

      {/* Motion Sensors (IMU) */}
      <div className="rounded-xl border border-border bg-background/50 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${imuConnected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Move className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">Sensori movimento</div>
              <div className="text-[11px] text-muted-foreground truncate">{imuConnected ? `${imuDevice} · ${imuMode === "imu" ? "IMU" : "cadenza"}` : "Accelerometro BLE"}</div>
            </div>
          </div>
          {imuConnected ? (
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right leading-none">
                <div className="text-sm font-display font-semibold text-primary tabular-nums">{motionMag.toFixed(1)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">m/s²</div>
              </div>
              <button onClick={disconnectIMU} className="w-9 h-9 rounded-lg bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors" aria-label="Disconnetti">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : hrSupported ? (
            <button
              onClick={handleConnectIMU}
              disabled={imuConnecting}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary border border-primary/30 transition-colors disabled:opacity-50 shrink-0 min-h-[40px]"
            >
              {imuConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bluetooth className="w-3.5 h-3.5" />}
              {imuConnecting ? "…" : "Collega"}
            </button>
          ) : null}
        </div>
      </div>

      {!hrSupported && (
        <div className="flex items-start gap-2 rounded-xl border border-secondary/20 bg-secondary/5 p-3 text-secondary text-xs leading-relaxed">
          <Watch className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Browser senza Web Bluetooth. Usa l'app nativa su iOS per collegare fascia cardio e smartwatch.
          </span>
        </div>
      )}

      {(hrSamplesRef.current.length > 0 || motionSamplesRef.current.length > 0) && (
        <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          Azzera dati raccolti
        </button>
      )}
    </div>
  );
}