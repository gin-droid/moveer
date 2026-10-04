/**
 * Calcolo angoli articolari 3D reali dai dati del sensore di profondità.
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
  confidence?: number;
}

interface DepthFrame {
  timestamp: number;
  joints3D?: Joint3D[];
  depthRangeMm?: { min: number; max: number; median: number };
}

export interface DepthData {
  sensorType: "lidar" | "tof";
  coordinateSystem?: "right_handed_y_up_meters" | "right_handed_y_down_meters";
  frames: DepthFrame[];
}

type Vec3 = { x: number; y: number; z: number };
const MIN_CONFIDENCE = 0.35;
const EPSILON = 1e-8;

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vectorAngle(a: Vec3, b: Vec3): number | null {
  const m1 = Math.hypot(a.x, a.y, a.z);
  const m2 = Math.hypot(b.x, b.y, b.z);
  if (m1 < EPSILON || m2 < EPSILON) return null;
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function angleBetween(p: Vec3 | undefined, vertex: Vec3 | undefined, q: Vec3 | undefined): number | null {
  if (!p || !vertex || !q) return null;
  const v1 = sub(p, vertex);
  const v2 = sub(q, vertex);
  return vectorAngle(v1, v2);
}

function canonicalJointId(id: string): string {
  const key = id.toLowerCase().replace(/[\s_-]/g, '');
  const aliases: Record<string, string> = {
    head: 'head', neck: 'neck', neck1: 'neck',
    spine3: 'spine_base', spinebase: 'spine_base', midhip: 'spine_base',
    spine7: 'spine_chest', spinechest: 'spine_chest', spineshoulder: 'spine_chest',
    leftshoulder: 'shoulder_l', shoulderleft: 'shoulder_l', shoulderl: 'shoulder_l',
    rightshoulder: 'shoulder_r', shoulderright: 'shoulder_r', shoulderr: 'shoulder_r',
    leftelbow: 'elbow_l', elbowleft: 'elbow_l', elbowl: 'elbow_l',
    rightelbow: 'elbow_r', elbowright: 'elbow_r', elbowr: 'elbow_r',
    leftwrist: 'wrist_l', wristleft: 'wrist_l', wristl: 'wrist_l',
    rightwrist: 'wrist_r', wristright: 'wrist_r', wristr: 'wrist_r',
    lefthip: 'hip_l', hipleft: 'hip_l', hipl: 'hip_l',
    righthip: 'hip_r', hipright: 'hip_r', hipr: 'hip_r',
    leftknee: 'knee_l', kneeleft: 'knee_l', kneel: 'knee_l',
    rightknee: 'knee_r', kneeright: 'knee_r', kneer: 'knee_r',
    leftankle: 'ankle_l', ankleleft: 'ankle_l', anklel: 'ankle_l',
    rightankle: 'ankle_r', ankleright: 'ankle_r', ankler: 'ankle_r',
  };
  return aliases[key] || id.toLowerCase().replace(/[\s-]/g, '_');
}

function jointsById(frame: DepthFrame): Record<string, Joint3D> {
  const joints: Record<string, Joint3D> = {};
  for (const joint of Array.isArray(frame.joints3D) ? frame.joints3D : []) {
    if (!joint?.id || ![joint.x, joint.y, joint.z].every(Number.isFinite)) continue;
    const confidence = Number.isFinite(joint.confidence) ? Number(joint.confidence) : undefined;
    if (confidence != null && confidence < MIN_CONFIDENCE) continue;
    const id = canonicalJointId(joint.id);
    if (!joints[id] || (confidence ?? -1) > (joints[id].confidence ?? -1)) {
      joints[id] = { ...joint, id, confidence };
    }
  }
  return joints;
}

function midpoint(a?: Vec3, b?: Vec3): Vec3 | undefined {
  if (!a || !b) return a || b;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function trunkLeanAngle(joints: Record<string, Vec3>, coordinateSystem: DepthData['coordinateSystem']): number | null {
  const base = joints.spine_base || midpoint(joints.hip_l, joints.hip_r);
  const neck = joints.neck || joints.spine_chest;
  if (!base || !neck) return null;
  const up = { x: 0, y: coordinateSystem === 'right_handed_y_down_meters' ? -1 : 1, z: 0 };
  return vectorAngle(sub(neck, base), up);
}

export interface FrameAngles {
  timestamp: number;
  jointCount: number;
  confidence: number | null;
  kneeAngleDeg: number | null;
  kneeFlexionDeg: number | null;
  kneeLeftAngleDeg: number | null;
  kneeRightAngleDeg: number | null;
  kneeAsymmetryDeg: number | null;
  hipAngleDeg: number | null;
  hipFlexionDeg: number | null;
  elbowAngleDeg: number | null;
  elbowFlexionDeg: number | null;
  shoulderAngleDeg: number | null;
  shoulderFlexionDeg: number | null;
  trunkLeanDeg: number | null;
}

const average = (...values: (number | null)[]) => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

function includedAngle(joints: Record<string, Joint3D>, proximal: string, vertex: string, distal: string) {
  return angleBetween(joints[proximal], joints[vertex], joints[distal]);
}

/** Angoli articolari 3D; gli angoli inclusi valgono 180° a arto esteso. */
export function computeFrameAngles(frame: DepthFrame, coordinateSystem: DepthData['coordinateSystem'] = 'right_handed_y_up_meters'): FrameAngles {
  const joints = jointsById(frame);
  const vectors = Object.fromEntries(Object.entries(joints).map(([id, joint]) => [id, joint])) as Record<string, Vec3>;
  const base = vectors.spine_base || midpoint(vectors.hip_l, vectors.hip_r) || vectors.spine_chest;
  const kneeLeft = includedAngle(joints, 'hip_l', 'knee_l', 'ankle_l');
  const kneeRight = includedAngle(joints, 'hip_r', 'knee_r', 'ankle_r');
  const kneeAngle = average(kneeLeft, kneeRight) ?? includedAngle(joints, 'hip_l', 'knee_l', 'ankle_l');
  const hipLeft = angleBetween(base, joints.hip_l, joints.knee_l);
  const hipRight = angleBetween(base, joints.hip_r, joints.knee_r);
  const elbowLeft = includedAngle(joints, 'shoulder_l', 'elbow_l', 'wrist_l');
  const elbowRight = includedAngle(joints, 'shoulder_r', 'elbow_r', 'wrist_r');
  const shoulderAngles = (['l', 'r'] as const).map((side) => {
    const shoulder = vectors[`shoulder_${side}`];
    const elbow = vectors[`elbow_${side}`];
    if (!base || !shoulder || !elbow) return null;
    const trunkAxis = sub(shoulder, base);
    const armAxis = sub(elbow, shoulder);
    const included = vectorAngle(trunkAxis, armAxis);
    return included == null ? null : 180 - included;
  });
  const shoulderFlexion = average(...shoulderAngles);

  return {
    timestamp: Number.isFinite(frame.timestamp) ? frame.timestamp : 0,
    jointCount: Object.keys(joints).length,
    confidence: average(...Object.values(joints).map((joint) => joint.confidence ?? null)),
    kneeAngleDeg: kneeAngle,
    kneeFlexionDeg: kneeAngle == null ? null : 180 - kneeAngle,
    kneeLeftAngleDeg: kneeLeft,
    kneeRightAngleDeg: kneeRight,
    kneeAsymmetryDeg: kneeLeft == null || kneeRight == null ? null : Math.abs(kneeLeft - kneeRight),
    hipAngleDeg: average(hipLeft, hipRight),
    hipFlexionDeg: average(hipLeft, hipRight) == null ? null : 180 - average(hipLeft, hipRight)!,
    elbowAngleDeg: average(elbowLeft, elbowRight),
    elbowFlexionDeg: average(elbowLeft, elbowRight) == null ? null : 180 - average(elbowLeft, elbowRight)!,
    shoulderAngleDeg: shoulderFlexion == null ? null : 180 - shoulderFlexion,
    shoulderFlexionDeg: shoulderFlexion,
    trunkLeanDeg: trunkLeanAngle(vectors, coordinateSystem),
  };
}

export interface DepthMeasureStats {
  mean: number;
  min: number;
  max: number;
}

export interface DepthAnalysis {
  sensorType: DepthData['sensorType'];
  coordinateSystem: NonNullable<DepthData['coordinateSystem']>;
  units: 'meters';
  sourceFrameCount: number;
  validFrameCount: number;
  maxJointCount: number;
  meanConfidence: number | null;
  measurements: Partial<Record<'kneeAngleDeg' | 'kneeFlexionDeg' | 'hipAngleDeg' | 'hipFlexionDeg' | 'elbowAngleDeg' | 'elbowFlexionDeg' | 'shoulderAngleDeg' | 'shoulderFlexionDeg' | 'trunkLeanDeg' | 'kneeAsymmetryDeg', DepthMeasureStats>>;
  keyFrames: Array<{ timestamp: number; joints3D: Joint3D[]; angles: FrameAngles }>;
}

const ANGLE_KEYS: (keyof FrameAngles)[] = [
  'kneeAngleDeg', 'kneeFlexionDeg', 'hipAngleDeg', 'hipFlexionDeg',
  'elbowAngleDeg', 'elbowFlexionDeg', 'shoulderAngleDeg', 'shoulderFlexionDeg', 'trunkLeanDeg', 'kneeAsymmetryDeg',
];

function getStats(frames: FrameAngles[], key: keyof FrameAngles): DepthMeasureStats | undefined {
  const values = frames.map((frame) => frame[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return undefined;
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function pelvisOrigin(joints: Record<string, Joint3D>): Vec3 {
  return joints.spine_base || midpoint(joints.hip_l, joints.hip_r) || { x: 0, y: 0, z: 0 };
}

/** Produce metriche aggregate e pochi frame rappresentativi con punti 3D relativi al bacino. */
export function analyzeDepthData(depth: DepthData): DepthAnalysis {
  const coordinateSystem = depth.coordinateSystem || 'right_handed_y_up_meters';
  const frames = (Array.isArray(depth.frames) ? depth.frames : [])
    .map((frame) => ({ frame, joints: jointsById(frame) }))
    .filter(({ joints }) => Object.keys(joints).length >= 3);
  const angles = frames.map(({ frame }) => computeFrameAngles(frame, coordinateSystem));
  const measurements: DepthAnalysis['measurements'] = {};
  for (const key of ANGLE_KEYS) {
    const stats = getStats(angles, key);
    if (stats) measurements[key as keyof DepthAnalysis['measurements']] = stats;
  }

  const selectedIndices = new Set<number>();
  if (frames.length) {
    selectedIndices.add(0);
    selectedIndices.add(frames.length - 1);
    for (const key of ['kneeAngleDeg', 'hipAngleDeg', 'trunkLeanDeg'] as const) {
      const validIndices = angles.map((frame, index) => typeof frame[key] === 'number' ? index : -1).filter((index) => index >= 0);
      if (validIndices.length) {
        selectedIndices.add(validIndices.reduce((best, index) => angles[index][key]! < angles[best][key]! ? index : best));
        selectedIndices.add(validIndices.reduce((best, index) => angles[index][key]! > angles[best][key]! ? index : best));
      }
    }
  }

  const maxJointCount = frames.reduce((max, { joints }) => Math.max(max, Object.keys(joints).length), 0);
  const meanConfidence = average(...frames.flatMap(({ joints }) => Object.values(joints).map((joint) => joint.confidence ?? null)));
  return {
    sensorType: depth.sensorType,
    coordinateSystem,
    units: 'meters',
    sourceFrameCount: Array.isArray(depth.frames) ? depth.frames.length : 0,
    validFrameCount: frames.length,
    maxJointCount,
    meanConfidence,
    measurements,
    keyFrames: [...selectedIndices].sort((a, b) => a - b).slice(0, 8).map((index) => {
      const { frame, joints } = frames[index];
      const origin = pelvisOrigin(joints);
      return {
        timestamp: frame.timestamp,
        joints3D: Object.values(joints).map((joint) => ({
          id: joint.id,
          x: joint.x - origin.x,
          y: joint.y - origin.y,
          z: joint.z - origin.z,
          confidence: joint.confidence,
        })),
        angles: angles[index],
      };
    }),
  };
}

const diagramLabels: Record<string, string> = {
  head: 'Testa', neck: 'Collo', shoulder_l: 'Spalla sinistra', shoulder_r: 'Spalla destra',
  elbow_l: 'Gomito sinistro', elbow_r: 'Gomito destro', wrist_l: 'Polso sinistro', wrist_r: 'Polso destro',
  hip_l: 'Anca sinistra', hip_r: 'Anca destra', knee_l: 'Ginocchio sinistro', knee_r: 'Ginocchio destro',
  ankle_l: 'Caviglia sinistra', ankle_r: 'Caviglia destra',
};

const diagramBones = [
  ['neck', 'head'], ['neck', 'shoulder_l'], ['neck', 'shoulder_r'], ['shoulder_l', 'shoulder_r'],
  ['shoulder_l', 'elbow_l'], ['elbow_l', 'wrist_l'], ['shoulder_r', 'elbow_r'], ['elbow_r', 'wrist_r'],
  ['shoulder_l', 'hip_l'], ['shoulder_r', 'hip_r'], ['hip_l', 'hip_r'],
  ['hip_l', 'knee_l'], ['knee_l', 'ankle_l'], ['hip_r', 'knee_r'], ['knee_r', 'ankle_r'],
];

/** Projects measured 3D landmarks into front (x/y) and side (z/y) report views. */
export function projectDepthFrameToBodyDiagram(
  frame: { joints3D?: Joint3D[] },
  template?: Record<string, any> | null,
) {
  const joints = Object.values(jointsById(frame as DepthFrame)).filter((joint) => diagramLabels[joint.id]);
  if (joints.length < 8) return template || null;

  const project = (axis: 'x' | 'z', viewTemplate?: Record<string, any>) => {
    const horizontal = joints.map((joint) => joint[axis]);
    const vertical = joints.map((joint) => joint.y);
    const minX = Math.min(...horizontal), maxX = Math.max(...horizontal);
    const minY = Math.min(...vertical), maxY = Math.max(...vertical);
    const height = maxY - minY;
    if (height < 0.3 || maxX - minX < 0.03) return null;
    const scale = 78 / height;
    return {
      ...(viewTemplate || {}),
      joints: joints.map((joint) => ({
        id: joint.id,
        label: diagramLabels[joint.id],
        x: Math.max(4, Math.min(96, 50 + (joint[axis] - (minX + maxX) / 2) * scale)),
        y: Math.max(5, Math.min(95, 92 - (joint.y - minY) * scale)),
        stress: 0,
      })),
      segments: Array.isArray(viewTemplate?.segments) && viewTemplate.segments.length
        ? viewTemplate.segments
        : diagramBones.map(([from, to]) => ({ from, to, misaligned: false })),
    };
  };

  const front = project('x', template?.front);
  const side = project('z', template?.side);
  if (!front && !side) return template || null;
  return { ...(template || {}), front: front || template?.front, side: side || template?.side };
}

/** Riepilogo leggibile dei valori misurati; gli angoli inclusi valgono 180° a arto esteso. */
export function summarizeDepthAngles(depth: DepthData): string {
  const analysis = analyzeDepthData(depth);
  if (!analysis.validFrameCount) return 'Dati 3D non sufficienti: non sono state rilevate almeno tre giunzioni affidabili.';
  const format = (key: keyof DepthAnalysis['measurements'], suffix = '°') => {
    const stats = analysis.measurements[key];
    return stats ? `media ${stats.mean.toFixed(1)}${suffix}, range ${stats.min.toFixed(1)}-${stats.max.toFixed(1)}${suffix}` : 'n/d';
  };
  return [
    `DATI 3D MISURATI: sensore ${analysis.sensorType.toUpperCase()}, ${analysis.validFrameCount}/${analysis.sourceFrameCount} frame validi, fino a ${analysis.maxJointCount} giunzioni, confidenza media ${analysis.meanConfidence == null ? 'n/d' : analysis.meanConfidence.toFixed(2)}.`,
    `Coordinate ${analysis.coordinateSystem}, metri; punti dei frame chiave relativi al centro del bacino.`,
    `Angolo interno ginocchio (180° = esteso): ${format('kneeAngleDeg')}; flessione (0° = esteso): ${format('kneeFlexionDeg')}.`,
    `Angolo interno anca (180° = estesa): ${format('hipAngleDeg')}; flessione (0° = estesa): ${format('hipFlexionDeg')}.`,
    `Angolo interno gomito (180° = esteso): ${format('elbowAngleDeg')}; flessione (0° = esteso): ${format('elbowFlexionDeg')}.`,
    `Flessione spalla (0° = braccio lungo il tronco): ${format('shoulderFlexionDeg')}.`,
    `Inclinazione 3D del tronco dalla verticale: ${format('trunkLeanDeg')}; asimmetria angolare ginocchia: ${format('kneeAsymmetryDeg')}.`,
    'Il Q-angle non è stimabile con precisione senza reperi anatomici ASIS/patella: non inferirlo da anca-ginocchio-caviglia.',
  ].join('\n');
}