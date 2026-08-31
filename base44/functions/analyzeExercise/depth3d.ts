/**
 * depth3d.ts — calcolo angoli articolari 3D reali dai dati del sensore di profondità.
 *
 * Quando il plugin nativo fornisce giunzioni 3D (LiDAR/ToF), questo modulo
 * calcola angoli articolari VERI (flessione ginocchio, anca, inclinazione tronco,
 * Q-angle, flessione gomito/spalla) nello spazio 3D, invece di stimarli dal 2D.
 * I risultati vengono iniettati nel prompt dell'LLM per un'analisi più precisa.
 */

interface Joint3D {
  id: string;
  x: number;
  y: number;
  z: number;
  confidence: number;
}

interface DepthFrame {
  timestamp: number;
  joints3D: Joint3D[];
  depthRangeMm?: { min: number; max: number; median: number };
}

export interface DepthData {
  sensorType: "lidar" | "tof";
  frames: DepthFrame[];
}

type Vec3 = { x: number; y: number; z: number };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function angleBetween(p: Vec3, vertex: Vec3, q: Vec3): number | null {
  const v1 = sub(p, vertex);
  const v2 = sub(q, vertex);
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m1 = Math.hypot(v1.x, v1.y, v1.z);
  const m2 = Math.hypot(v2.x, v2.y, v2.z);
  if (m1 === 0 || m2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function trunkLeanAngle(j: Record<string, Vec3>): number | null {
  // angolo tra verticale (down) e asse busto (spine_base → neck)
  const base = j["spine_base"] || j["hip_l"] || j["hip_r"];
  const neck = j["neck"] || j["spine_chest"];
  if (!base || !neck) return null;
  const vertical = { x: base.x, y: base.y - 1, z: base.z }; // verticale verso il basso
  const torso = sub(neck, base);
  const dot = vertical.x * torso.x + vertical.y * torso.y + vertical.z * torso.z;
  const mv = Math.hypot(sub(vertical, base).x, sub(vertical, base).y, sub(vertical, base).z) || 1;
  const mt = Math.hypot(torso.x, torso.y, torso.z);
  if (mt === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (mv * mt)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function qAngle(j: Record<string, Vec3>): number | null {
  // Q-angle: anca → ginocchio → caviglia (lato sinistro se disponibile)
  const hip = j["hip_l"] || j["hip_r"];
  const knee = j["knee_l"] || j["knee_r"];
  const ankle = j["ankle_l"] || j["ankle_r"];
  if (!hip || !knee || !ankle) return null;
  return angleBetween(hip, knee, ankle);
}

export interface FrameAngles {
  timestamp: number;
  kneeFlexion: number | null;
  hipFlexion: number | null;
  trunkLean: number | null;
  qAngle: number | null;
  elbowFlexion: number | null;
  shoulderFlexion: number | null;
  symmetry: number | null;
}

/** Calcola gli angoli 3D per un singolo frame. */
export function computeFrameAngles(frame: DepthFrame): FrameAngles {
  const map: Record<string, Vec3> = {};
  for (const jt of frame.joints3D) {
    map[jt.id] = { x: jt.x, y: jt.y, z: jt.z };
  }

  const kneeFlexion = angleBetween(
    map["hip_l"] || map["hip_r"], map["knee_l"] || map["knee_r"], map["ankle_l"] || map["ankle_r"]
  );
  const hipFlexion = angleBetween(
    map["spine_base"] || map["spine_chest"], map["hip_l"] || map["hip_r"], map["knee_l"] || map["knee_r"]
  );
  const elbowFlexion = angleBetween(
    map["shoulder_l"] || map["shoulder_r"], map["elbow_l"] || map["elbow_r"], map["wrist_l"] || map["wrist_r"]
  );
  const shoulderFlexion = angleBetween(
    map["spine_base"] || map["spine_chest"], map["shoulder_l"] || map["shoulder_r"], map["elbow_l"] || map["elbow_r"]
  );

  // simmetria: differenza angolo ginocchio L vs R
  let symmetry: number | null = null;
  if (map["hip_l"] && map["knee_l"] && map["ankle_l"] && map["hip_r"] && map["knee_r"] && map["ankle_r"]) {
    const l = angleBetween(map["hip_l"], map["knee_l"], map["ankle_l"]);
    const r = angleBetween(map["hip_r"], map["knee_r"], map["ankle_r"]);
    if (l != null && r != null) symmetry = Math.abs(l - r);
  }

  return {
    timestamp: frame.timestamp,
    kneeFlexion,
    hipFlexion,
    trunkLean: trunkLeanAngle(map),
    qAngle: qAngle(map),
    elbowFlexion,
    shoulderFlexion,
    symmetry,
  };
}

/** Calcola gli angoli per tutti i frame e restituisce un riepilogo testuale. */
export function summarizeDepthAngles(depth: DepthData): string {
  const angles = depth.frames
    .map(computeFrameAngles)
    .filter((a) => a.kneeFlexion != null || a.hipFlexion != null || a.trunkLean != null);

  if (angles.length === 0) return "";

  const avg = (sel: (a: FrameAngles) => number | null) => {
    const vals = angles.map(sel).filter((v): v is number => v != null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  const min = (sel: (a: FrameAngles) => number | null) => {
    const vals = angles.map(sel).filter((v): v is number => v != null);
    return vals.length ? Math.round(Math.min(...vals)) : null;
  };

  const fmt = (v: number | null, suffix = "°") => (v == null ? "n/d" : `${v}${suffix}`);

  return [
    `DATI DI PROFONDITÀ REALE (sensore: ${depth.sensorType.toUpperCase()}, ${angles.length} frame analizzati)`,
    `Questi angoli sono MISURATI in 3D reale dal sensore di profondità, non stimati dal 2D. Usali come riferimento primario.`,
    `- Flessione ginocchio: media ${fmt(avg((a) => a.kneeFlexion))}, min ${fmt(min((a) => a.kneeFlexion))} (180 = esteso)`,
    `- Flessione anca: media ${fmt(avg((a) => a.hipFlexion))} (180 = esteso)`,
    `- Inclinazione tronco da verticale: media ${fmt(avg((a) => a.trunkLean))}`,
    `- Q-angle (anca-ginocchio-caviglia): ${fmt(avg((a) => a.qAngle))}`,
    `- Flessione gomito: ${fmt(avg((a) => a.elbowFlexion))} (180 = esteso)`,
    `- Flessione spalla: ${fmt(avg((a) => a.shoulderFlexion))} (180 = braccio lungo il corpo)`,
    `- Asimmetria L/R ginocchio: ${fmt(avg((a) => a.symmetry))} (0 = perfettamente simmetrico)`,
  ].join("\n");
}