/**
 * Implementazione web (fallback) del plugin depth-scanner.
 *
 * Sul browser non è disponibile alcun sensore di profondità, quindi
 * isAvailable() restituisce sempre false. La pagina Analizza ricade
 * sul CameraRecorder RGB ad alta risoluzione.
 */
import { registerPlugin } from "@capacitor/core";
import type { DepthScannerPlugin } from "./definitions";

const DepthScannerWeb = registerPlugin<DepthScannerPlugin>("DepthScanner", {
  web: () => Promise.resolve({
    isAvailable: async () => ({ available: false, sensorType: "none" }),
    startRecording: async () => {
      throw new Error("Depth scanning non disponibile sul web. Usa CameraRecorder.");
    },
    stopRecording: async () => {
      throw new Error("Depth scanning non disponibile sul web.");
    },
    cancelRecording: async () => {},
  }),
});

export * from "./definitions";
export default DepthScannerWeb;