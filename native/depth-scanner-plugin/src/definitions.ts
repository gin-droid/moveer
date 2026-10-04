/**
 * @moVeerAI/depth-scanner — definizioni plugin
 *
 * Espone un'API per registrare video sfruttando i sensori di profondità
 * (LiDAR su iPhone/iPad Pro, ToF su alcuni Android) e ottenere giunzioni
 * articolari 3D reali + statistiche di profondità per frame.
 */

export interface IsAvailableResult {
  /** true se un sensore di profondità è utilizzabile sul dispositivo */
  available: boolean;
  /** tipo di sensore: "lidar" | "tof" | "none" */
  sensorType: "lidar" | "tof" | "none";
}

export interface Joint3D {
  id: string;
  /** coordinate nello spazio del modello (metri) */
  x: number;
  y: number;
  z: number;
  /** confidenza 0-1 se fornita dal sensore */
  confidence?: number;
}

export interface DepthFrame {
  timestamp: number;
  joints3D: Joint3D[];
  /** profondità in mm: min, max, mediana */
  depthRangeMm?: { min: number; max: number; median: number };
}

export interface DepthData {
  sensorType: "lidar" | "tof";
  /** Coordinate del modello ARKit: metri, mano destra, asse Y verticale. */
  coordinateSystem: "right_handed_y_up_meters";
  frames: DepthFrame[];
}

export interface StartRecordingOptions {
  /** durata massima in secondi (default 30) */
  maxDurationSec?: number;
  /** fotocamera preferita: "back" (LiDAR) | "front" */
  facing?: "back" | "front";
}

export interface StopRecordingResult {
  /** URL dei frame RGB caricati (JPEG) */
  frameUrls: string[];
  /** dati di profondità e giunzioni 3D per frame */
  depthData: DepthData;
}

export interface DepthScannerPlugin {
  /**
   * Verifica la disponibilità del sensore di profondità sul dispositivo.
   * Sul web restituisce sempre { available: false, sensorType: "none" }.
   */
  isAvailable(): Promise<IsAvailableResult>;

  /** Avvia la sessione AR e la registrazione dei frame depth+RGB */
  startRecording(options: StartRecordingOptions): Promise<void>;

  /** Ferma la registrazione e restituisce frame RGB + dati di profondità */
  stopRecording(): Promise<StopRecordingResult>;

  /** Annulla la registrazione in corso senza restituire dati */
  cancelRecording(): Promise<void>;
}