// Motore condiviso per il calcolo biomeccanico deterministico dello stress articolare.
// Confronta la postura osservata con l'ESECUZIONE OTTIMA specifica del pattern
// di movimento (squat, hinge, push, pull, lunge, ecc.) — non con una generica
// posizione neutra in piedi. Questo evita di penalizzare esecuzioni corrette
// che coinvolgono grande escursione articolare (es. squat profondo).
//
// Calcolo basato su:
//  1. Angoli articolari reali vs angoli ottimi del pattern (flessione ginocchio,
//     flessione anca, inclinazione tronco, Q-angle, flessione gomito)
//  2. Deviazione dalla posizione ottima del pattern (non da neutra generica)
//  3. Asimmetrie bilaterali (vista frontale)
//  4. Disallineamento dei segmenti
//  5. Leva / momento (braccio di resistenza sulle articolazioni portanti)
//  6. Peso di importanza differenziato per articolazione
//  7. Curvatura e inclinazione della colonna
//  8. Pattern-specific checkpoints (valgo, forward head, antiversione bacino)

interface Point { x: number; y: number; }
interface Joint { id: string; label?: string; x: number; y: number; stress?: number; }
interface Segment { from: string; to: string; misaligned?: boolean; }
interface View { joints?: Joint[]; segments?: Segment[]; }

// --- Profili di esecuzione ottima per pattern di movimento ---
// Ogni pattern definisce la postura ottima NELLA FASE PIÙ CRITICA del movimento
// (es. squat = fondo, deadlift = setup con tronco inclinato, push-up = fondo).
// Le coordinate sono normalizzate 0-100.

type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'overhead' | 'core' | 'cycling' | 'static';

interface PatternProfile {
  // Posizioni ottime attese nella fase critica (front + side)
  optimalFront: Record<string, Point>;
  optimalSide: Record<string, Point>;
  // Angoli articolari ottimi (gradi) nella fase critica
  optimalAngles: {
    kneeFlex?: number;     // flessione ginocchio (180 = esteso)
    hipFlex?: number;      // flessione anca (180 = esteso)
    trunkLean?: number;    // inclinazione tronco da verticale (0 = verticale)
    elbowFlex?: number;    // flessione gomito (180 = esteso)
    shoulderFlex?: number; // flessione spalla (180 = braccio lungo il corpo)
  };
  // Pesi del pattern: quanto pesa ogni tipo di deviazione
  weights: {
    kneeFlexDev: number;
    hipFlexDev: number;
    trunkLeanDev: number;
    elbowFlexDev: number;
    shoulderFlexDev: number;
    positionDev: number;
  };
}

// Posizione neutra in piedi (usata per pattern 'static' e come fallback)
const NEUTRAL_FRONT: Record<string, Point> = {
  head: { x: 50, y: 6 },
  neck: { x: 50, y: 14 },
  shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
  elbow_l: { x: 30, y: 38 }, elbow_r: { x: 70, y: 38 },
  wrist_l: { x: 28, y: 50 }, wrist_r: { x: 72, y: 50 },
  hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
  knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
  ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
};

const NEUTRAL_SIDE: Record<string, Point> = {
  head: { x: 40, y: 6 },
  neck: { x: 42, y: 14 },
  shoulder: { x: 40, y: 22 },
  elbow: { x: 36, y: 38 },
  wrist: { x: 34, y: 50 },
  hip: { x: 42, y: 52 },
  knee: { x: 43, y: 74 },
  ankle: { x: 44, y: 94 },
};

// --- Profili per pattern ---
const PROFILES: Record<Pattern, PatternProfile> = {
  // Squat (back/front/goblet/overhead): fondo con cosce parallele o sotto parallele.
  // Ginocchia flesse ~90-110°, anca flessa ~90-100°, tronco inclinato ~30-45° in avanti.
  squat: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 24 }, shoulder_r: { x: 66, y: 24 },
      elbow_l: { x: 30, y: 40 }, elbow_r: { x: 70, y: 40 },
      wrist_l: { x: 28, y: 52 }, wrist_r: { x: 72, y: 52 },
      hip_l: { x: 41, y: 50 }, hip_r: { x: 59, y: 50 },
      knee_l: { x: 40, y: 64 }, knee_r: { x: 60, y: 64 },
      ankle_l: { x: 44, y: 92 }, ankle_r: { x: 56, y: 92 },
    },
    optimalSide: {
      head: { x: 42, y: 8 }, neck: { x: 44, y: 16 },
      shoulder: { x: 46, y: 24 }, elbow: { x: 42, y: 40 },
      wrist: { x: 40, y: 52 },
      hip: { x: 48, y: 48 }, knee: { x: 44, y: 66 }, ankle: { x: 44, y: 92 },
    },
    optimalAngles: { kneeFlex: 100, hipFlex: 95, trunkLean: 35, elbowFlex: 170, shoulderFlex: 175 },
    weights: { kneeFlexDev: 0.45, hipFlexDev: 0.35, trunkLeanDev: 0.30, elbowFlexDev: 0.08, shoulderFlexDev: 0.08, positionDev: 2.0 },
  },
  // Hinge (deadlift, RDL, good morning): setup con tronco inclinato ~45-60°,
  // ginocchia leggermente flesse (~140-160°), anca flessa ~70-90°.
  hinge: {
    optimalFront: {
      head: { x: 50, y: 8 }, neck: { x: 50, y: 16 },
      shoulder_l: { x: 34, y: 24 }, shoulder_r: { x: 66, y: 24 },
      elbow_l: { x: 30, y: 40 }, elbow_r: { x: 70, y: 40 },
      wrist_l: { x: 32, y: 56 }, wrist_r: { x: 68, y: 56 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
      ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
    },
    optimalSide: {
      head: { x: 44, y: 10 }, neck: { x: 46, y: 18 },
      shoulder: { x: 50, y: 26 }, elbow: { x: 48, y: 42 },
      wrist: { x: 48, y: 58 },
      hip: { x: 44, y: 52 }, knee: { x: 43, y: 74 }, ankle: { x: 44, y: 94 },
    },
    optimalAngles: { kneeFlex: 150, hipFlex: 80, trunkLean: 50, elbowFlex: 175, shoulderFlex: 178 },
    weights: { kneeFlexDev: 0.25, hipFlexDev: 0.40, trunkLeanDev: 0.35, elbowFlexDev: 0.06, shoulderFlexDev: 0.06, positionDev: 2.0 },
  },
  // Push (push-up, bench press, dip): fondo con gomiti flessi ~80-90°,
  // spalle flesse ~150-180°, corpo allineato (tronco neutro).
  push: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
      elbow_l: { x: 28, y: 36 }, elbow_r: { x: 72, y: 36 },
      wrist_l: { x: 30, y: 50 }, wrist_r: { x: 70, y: 50 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
      ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
    },
    optimalSide: {
      head: { x: 40, y: 8 }, neck: { x: 42, y: 16 },
      shoulder: { x: 42, y: 24 }, elbow: { x: 38, y: 38 },
      wrist: { x: 40, y: 50 },
      hip: { x: 42, y: 52 }, knee: { x: 43, y: 74 }, ankle: { x: 44, y: 94 },
    },
    optimalAngles: { kneeFlex: 175, hipFlex: 175, trunkLean: 5, elbowFlex: 90, shoulderFlex: 160 },
    weights: { kneeFlexDev: 0.10, hipFlexDev: 0.12, trunkLeanDev: 0.40, elbowFlexDev: 0.40, shoulderFlexDev: 0.25, positionDev: 2.0 },
  },
  // Pull (pull-up, row, lat pulldown): gomiti flessi ~90-100° nella fase di massima trazione,
  // spalle estese/abdotte, tronco verticale o leggermente inclinato.
  pull: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
      elbow_l: { x: 26, y: 30 }, elbow_r: { x: 74, y: 30 },
      wrist_l: { x: 30, y: 22 }, wrist_r: { x: 70, y: 22 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
      ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
    },
    optimalSide: {
      head: { x: 40, y: 6 }, neck: { x: 42, y: 14 },
      shoulder: { x: 40, y: 22 }, elbow: { x: 34, y: 30 },
      wrist: { x: 38, y: 22 },
      hip: { x: 42, y: 52 }, knee: { x: 43, y: 74 }, ankle: { x: 44, y: 94 },
    },
    optimalAngles: { kneeFlex: 170, hipFlex: 170, trunkLean: 10, elbowFlex: 95, shoulderFlex: 60 },
    weights: { kneeFlexDev: 0.08, hipFlexDev: 0.10, trunkLeanDev: 0.25, elbowFlexDev: 0.35, shoulderFlexDev: 0.35, positionDev: 2.0 },
  },
  // Lunge (affondo, split squat): gamba anteriore con ginocchio flesso ~90°,
  // gamba posteriore estesa, anca flessa ~90°, tronco verticale.
  lunge: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
      elbow_l: { x: 30, y: 38 }, elbow_r: { x: 70, y: 38 },
      wrist_l: { x: 28, y: 50 }, wrist_r: { x: 72, y: 50 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 38, y: 66 }, knee_r: { x: 62, y: 66 },
      ankle_l: { x: 40, y: 90 }, ankle_r: { x: 60, y: 90 },
    },
    optimalSide: {
      head: { x: 40, y: 6 }, neck: { x: 42, y: 14 },
      shoulder: { x: 40, y: 22 }, elbow: { x: 36, y: 38 },
      wrist: { x: 34, y: 50 },
      hip: { x: 42, y: 50 }, knee: { x: 40, y: 66 }, ankle: { x: 42, y: 90 },
    },
    optimalAngles: { kneeFlex: 95, hipFlex: 90, trunkLean: 10, elbowFlex: 170, shoulderFlex: 175 },
    weights: { kneeFlexDev: 0.40, hipFlexDev: 0.30, trunkLeanDev: 0.35, elbowFlexDev: 0.06, shoulderFlexDev: 0.06, positionDev: 2.0 },
  },
  // Overhead (military press, snatch, overhead squat): spalle flesse ~180°,
  // braccia sopra la testa, tronco verticale.
  overhead: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
      elbow_l: { x: 30, y: 14 }, elbow_r: { x: 70, y: 14 },
      wrist_l: { x: 28, y: 6 }, wrist_r: { x: 72, y: 6 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
      ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
    },
    optimalSide: {
      head: { x: 40, y: 6 }, neck: { x: 42, y: 14 },
      shoulder: { x: 40, y: 22 }, elbow: { x: 36, y: 14 },
      wrist: { x: 34, y: 6 },
      hip: { x: 42, y: 52 }, knee: { x: 43, y: 74 }, ankle: { x: 44, y: 94 },
    },
    optimalAngles: { kneeFlex: 170, hipFlex: 170, trunkLean: 5, elbowFlex: 170, shoulderFlex: 180 },
    weights: { kneeFlexDev: 0.12, hipFlexDev: 0.15, trunkLeanDev: 0.40, elbowFlexDev: 0.20, shoulderFlexDev: 0.45, positionDev: 2.0 },
  },
  // Core (plank, L-sit, ab wheel): corpo allineato o chiuso, tronco neutro o flesso.
  core: {
    optimalFront: {
      head: { x: 50, y: 6 }, neck: { x: 50, y: 14 },
      shoulder_l: { x: 34, y: 22 }, shoulder_r: { x: 66, y: 22 },
      elbow_l: { x: 30, y: 38 }, elbow_r: { x: 70, y: 38 },
      wrist_l: { x: 28, y: 50 }, wrist_r: { x: 72, y: 50 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 74 }, knee_r: { x: 57, y: 74 },
      ankle_l: { x: 44, y: 94 }, ankle_r: { x: 56, y: 94 },
    },
    optimalSide: {
      head: { x: 40, y: 6 }, neck: { x: 42, y: 14 },
      shoulder: { x: 40, y: 22 }, elbow: { x: 36, y: 38 },
      wrist: { x: 34, y: 50 },
      hip: { x: 42, y: 52 }, knee: { x: 43, y: 74 }, ankle: { x: 44, y: 94 },
    },
    optimalAngles: { kneeFlex: 175, hipFlex: 175, trunkLean: 0, elbowFlex: 90, shoulderFlex: 90 },
    weights: { kneeFlexDev: 0.15, hipFlexDev: 0.20, trunkLeanDev: 0.40, elbowFlexDev: 0.30, shoulderFlexDev: 0.20, positionDev: 2.0 },
  },
  // Static (posturali, mobilità, stance neutra): posizione neutra in piedi.
  static: {
    optimalFront: NEUTRAL_FRONT,
    optimalSide: NEUTRAL_SIDE,
    optimalAngles: { kneeFlex: 178, hipFlex: 178, trunkLean: 2, elbowFlex: 178, shoulderFlex: 178 },
    weights: { kneeFlexDev: 0.20, hipFlexDev: 0.20, trunkLeanDev: 0.30, elbowFlexDev: 0.15, shoulderFlexDev: 0.15, positionDev: 2.8 },
  },
  // Cycling (road, MTB, indoor): pedalata ciclica. Fase critica: punto più basso
  // del pedale (bottom dead center). Ginocchio leggermente flesso ~150-160°,
  // anca flessa ~100-110°, tronco inclinato in avanti ~20-35°, core stabile.
  cycling: {
    optimalFront: {
      head: { x: 50, y: 10 }, neck: { x: 50, y: 18 },
      shoulder_l: { x: 34, y: 28 }, shoulder_r: { x: 66, y: 28 },
      elbow_l: { x: 32, y: 40 }, elbow_r: { x: 68, y: 40 },
      wrist_l: { x: 34, y: 48 }, wrist_r: { x: 66, y: 48 },
      hip_l: { x: 42, y: 52 }, hip_r: { x: 58, y: 52 },
      knee_l: { x: 43, y: 70 }, knee_r: { x: 57, y: 70 },
      ankle_l: { x: 44, y: 88 }, ankle_r: { x: 56, y: 88 },
    },
    optimalSide: {
      head: { x: 44, y: 12 }, neck: { x: 46, y: 20 },
      shoulder: { x: 50, y: 28 }, elbow: { x: 48, y: 40 },
      wrist: { x: 46, y: 48 },
      hip: { x: 44, y: 52 }, knee: { x: 42, y: 68 }, ankle: { x: 46, y: 88 },
    },
    optimalAngles: { kneeFlex: 155, hipFlex: 105, trunkLean: 25, elbowFlex: 165, shoulderFlex: 120 },
    weights: { kneeFlexDev: 0.40, hipFlexDev: 0.30, trunkLeanDev: 0.25, elbowFlexDev: 0.08, shoulderFlexDev: 0.10, positionDev: 2.0 },
  },
};

// --- Classificazione del pattern a partire da esercizio/categoria ---
function classifyPattern(name: string, macro: string, sub: string): Pattern {
  const n = (name || '').toLowerCase();
  const m = (macro || '').toLowerCase();
  const s = (sub || '').toLowerCase();
  const all = `${n} ${s}`;

  // Overhead ha priorità alta (contiene "press overhead", "military", "snatch", "overhead")
  if (/overhead|military press|snatch|jerky|press sopra|push press/.test(all)) return 'overhead';

  // Cycling / ciclismo (road, MTB, indoor, sprint, salita)
  if (/ciclismo|cycling|bike|bici|pedal|road bike|mountain bike|spin|cyclocross|cronometro|time trial/.test(all)) return 'cycling';

  // Hinge (deadlift, RDL, good morning, kettlebell swing)
  if (/deadlift|stacco|rdl|good morning|swing|hip thrust|pull through|romanian/.test(all)) return 'hinge';

  // Lunge / affondi
  if (/lunge|affondo|split|step up|bulgarian|affondi/.test(all)) return 'lunge';

  // Pull (pull-up, row, lat pulldown, chin-up)
  if (/pull|pull-up|row|rematore|pulldown|chin|lat|trazione/.test(all)) return 'pull';

  // Push (push-up, bench press, dip, pectoral)
  if (/push|push-up|panca|bench|dip|push up|piegamento|press\b/.test(all)) return 'push';

  // Squat (squat, pistol, goblet, front squat, hack)
  if (/squat|pistol|goblet|hack|pistol squat|accovacciata/.test(all)) return 'squat';

  // Core (plank, L-sit, ab, crunch, hollow)
  if (/plank|l-sit|ab|crunch|hollow|core|addome|sit-up|leg raise|hanging/.test(all)) return 'core';

  // Macro-categoria fallback
  if (/postur|mobilit/.test(m)) return 'static';
  if (/calisthenics|corpo libero/.test(m)) {
    if (/pull|trazione|row/.test(all)) return 'pull';
    if (/push|dip|piegamento|handstand|hspu/.test(all)) return 'push';
    if (/squat|pistol/.test(all)) return 'squat';
    if (/plank|l-sit|core|hollow|lever|planche/.test(all)) return 'core';
    return 'static';
  }
  if (/powerlifting|forza/.test(m)) {
    if (/squat/.test(all)) return 'squat';
    if (/deadlift|stacco/.test(all)) return 'hinge';
    if (/bench|panca|press/.test(all)) return 'push';
    return 'static';
  }
  if (/body building/.test(m)) {
    if (/press|panca|push/.test(all)) return 'push';
    if (/row|pull|rematore/.test(all)) return 'pull';
    if (/squat/.test(all)) return 'squat';
    if (/curl|biceps|tricep/.test(all)) return 'pull';
    return 'static';
  }

  return 'static';
}

// --- Pesi di importanza articolare ---
const JOINT_WEIGHT: Record<string, number> = {
  knee_l: 1.3, knee_r: 1.3, knee: 1.3,
  hip_l: 1.25, hip_r: 1.25, hip: 1.25,
  ankle_l: 1.1, ankle_r: 1.1, ankle: 1.1,
  neck: 1.2,
  shoulder_l: 1.0, shoulder_r: 1.0, shoulder: 1.0,
  head: 0.9,
  elbow_l: 0.7, elbow_r: 0.7, elbow: 0.7,
  wrist_l: 0.5, wrist_r: 0.5, wrist: 0.5,
};

// --- Costanti di calibrazione globali (contributi indipendenti dal pattern) ---
const G = {
  misalign: 18,        // contributo per segmento disallineato
  asymmetryY: 3.5,     // per unità di differenza di y tra coppie (front)
  asymmetryX: 2.5,     // per unità di differenza di x tra coppie (front)
  valgus: 5.5,         // ginocchio valgo (avvicinamento alla linea mediana)
  lateralSpine: 2.2,   // deviazione laterale colonna (front)
  forwardHead: 2.5,    // forward head posture (side)
  anteriorPelvis: 3.0, // antiversione bacino (side)
  spineCurvature: 3.0, // curvatura della colonna (deviazione dalla retta neck-hip)
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// Angolo al vertice B formato dai punti A-B-C (gradi, 0-180)
function angleAt(a: Point | null, b: Point | null, c: Point | null): number | null {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 < 0.01 || mag2 < 0.01) return null;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Inclinazione di un segmento rispetto alla verticale (gradi, -90 a +90)
function tiltFromVertical(from: Point, to: Point): number {
  return (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
}

function computeFront(view: View | undefined, profile: PatternProfile): View | undefined {
  if (!view || !Array.isArray(view.joints)) return view;
  const joints: Joint[] = (view.joints as Joint[]).map((j) => ({ ...j, stress: 0 }));
  const map: Record<string, Joint> = {};
  joints.forEach((j) => { map[j.id] = j; });
  const opt = profile.optimalFront;

  // 1. Contributo disallineamento segmenti
  (view.segments || []).forEach((s) => {
    if (!s.misaligned) return;
    [s.from, s.to].forEach((id) => {
      if (map[id]) map[id].stress = (map[id].stress || 0) + G.misalign;
    });
  });

  // 2. Scostamento dalla posizione OTTIMA del pattern (pesato per importanza)
  joints.forEach((j) => {
    const n = opt[j.id];
    if (!n) return;
    const w = JOINT_WEIGHT[j.id] || 1.0;
    j.stress = (j.stress || 0) + dist(j, n) * profile.weights.positionDev * w;
  });

  // 3. Asimmetria bilaterale (spalle, anche, ginocchia, caviglie)
  const pairs = [
    ['shoulder_l', 'shoulder_r'],
    ['hip_l', 'hip_r'],
    ['knee_l', 'knee_r'],
    ['ankle_l', 'ankle_r'],
  ];
  pairs.forEach(([l, r]) => {
    const a = map[l], b = map[r];
    if (!a || !b) return;
    const dy = Math.abs(a.y - b.y);
    const dx = Math.abs(a.x - b.x);
    a.stress = (a.stress || 0) + dy * G.asymmetryY + dx * G.asymmetryX * 0.5;
    b.stress = (b.stress || 0) + dy * G.asymmetryY + dx * G.asymmetryX * 0.5;
  });

  // 4. Ginocchio valgo/varo: ginocchia che si avvicinano (valgo) alla linea mediana
  if (map.knee_l) map.knee_l.stress = (map.knee_l.stress || 0) + Math.max(0, map.knee_l.x - 46) * G.valgus;
  if (map.knee_r) map.knee_r.stress = (map.knee_r.stress || 0) + Math.max(0, 54 - map.knee_r.x) * G.valgus;

  // 5. Q-angle: allineamento anca→ginocchio→caviglia.
  ['l', 'r'].forEach((side) => {
    const hip = map[`hip_${side}`], knee = map[`knee_${side}`], ankle = map[`ankle_${side}`];
    const qAng = angleAt(hip, knee, ankle);
    if (qAng !== null && knee) {
      const dev = Math.abs(180 - qAng);
      knee.stress = (knee.stress || 0) + dev * 0.2;
    }
  });

  // 6. Deviazione laterale della colonna (head/neck lontani da x=50)
  ['head', 'neck'].forEach((id) => {
    const j = map[id];
    if (j) j.stress = (j.stress || 0) + Math.abs(j.x - 50) * G.lateralSpine;
  });

  // 7. Curvatura della colonna: deviazione del collo dalla linea spalla-anca
  ['l', 'r'].forEach((side) => {
    const shoulder = map[`shoulder_${side}`], hip = map[`hip_${side}`], neck = map.neck;
    if (!shoulder || !hip || !neck) return;
    const dx = hip.x - shoulder.x;
    const dy = hip.y - shoulder.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.01) return;
    const t = ((neck.x - shoulder.x) * dx + (neck.y - shoulder.y) * dy) / len2;
    const projX = shoulder.x + t * dx;
    const projY = shoulder.y + t * dy;
    const dev = dist({ x: neck.x, y: neck.y }, { x: projX, y: projY });
    neck.stress = (neck.stress || 0) + dev * G.spineCurvature;
  });

  joints.forEach((j) => { j.stress = Math.round(clamp(j.stress || 0)); });
  return { ...view, joints };
}

function computeSide(view: View | undefined, profile: PatternProfile): View | undefined {
  if (!view || !Array.isArray(view.joints)) return view;
  const joints: Joint[] = (view.joints as Joint[]).map((j) => ({ ...j, stress: 0 }));
  const map: Record<string, Joint> = {};
  joints.forEach((j) => { map[j.id] = j; });
  const opt = profile.optimalSide;
  const oa = profile.optimalAngles;
  const pw = profile.weights;

  // 1. Contributo disallineamento segmenti
  (view.segments || []).forEach((s) => {
    if (!s.misaligned) return;
    [s.from, s.to].forEach((id) => {
      if (map[id]) map[id].stress = (map[id].stress || 0) + G.misalign;
    });
  });

  // 2. Scostamento dalla posizione OTTIMA del pattern (pesato)
  joints.forEach((j) => {
    const n = opt[j.id];
    if (!n) return;
    const w = JOINT_WEIGHT[j.id] || 1.0;
    j.stress = (j.stress || 0) + dist(j, n) * pw.positionDev * w;
  });

  const hip = map.hip, knee = map.knee, ankle = map.ankle, shoulder = map.shoulder, elbow = map.elbow, wrist = map.wrist;

  // 3. Flessione del ginocchio (angolo anca-ginocchio-caviglia) vs angolo ottimo del pattern
  if (hip && knee && ankle && oa.kneeFlex !== undefined) {
    const kneeAng = angleAt(hip, knee, ankle);
    if (kneeAng !== null) {
      const dev = Math.abs(kneeAng - oa.kneeFlex);
      knee.stress = (knee.stress || 0) + dev * pw.kneeFlexDev;
      // Deviazione della flessione del ginocchio stressa anche l'anca (catena)
      hip.stress = (hip.stress || 0) + dev * pw.kneeFlexDev * 0.4;
    }
  }

  // 4. Flessione dell'anca (angolo spalla-anca-ginocchio) vs angolo ottimo
  if (shoulder && hip && knee && oa.hipFlex !== undefined) {
    const hipAng = angleAt(shoulder, hip, knee);
    if (hipAng !== null) {
      const dev = Math.abs(hipAng - oa.hipFlex);
      hip.stress = (hip.stress || 0) + dev * pw.hipFlexDev;
    }
  }

  // 5. Inclinazione del tronco (spalla→anca rispetto alla verticale) vs inclinazione ottima
  if (shoulder && hip && oa.trunkLean !== undefined) {
    const trunkTilt = Math.abs(tiltFromVertical(shoulder, hip));
    const dev = Math.abs(trunkTilt - oa.trunkLean);
    if (dev > 5) {
      const excess = dev - 5;
      hip.stress = (hip.stress || 0) + excess * pw.trunkLeanDev;
      shoulder.stress = (shoulder.stress || 0) + excess * pw.trunkLeanDev * 0.6;
      if (map.neck) map.neck.stress = (map.neck.stress || 0) + excess * pw.trunkLeanDev * 0.4;
    }
  }

  // 6. Flessione del gomito (angolo spalla-gomito-polso) vs angolo ottimo
  if (shoulder && elbow && wrist && oa.elbowFlex !== undefined) {
    const elbowAng = angleAt(shoulder, elbow, wrist);
    if (elbowAng !== null) {
      const dev = Math.abs(elbowAng - oa.elbowFlex);
      elbow.stress = (elbow.stress || 0) + dev * pw.elbowFlexDev;
      shoulder.stress = (shoulder.stress || 0) + dev * pw.elbowFlexDev * 0.5;
    }
  }

  // 7. Flessione della spalla (angolo anca-spalla-gomito) vs angolo ottimo
  if (hip && shoulder && elbow && oa.shoulderFlex !== undefined) {
    const shoulderAng = angleAt(hip, shoulder, elbow);
    if (shoulderAng !== null) {
      const dev = Math.abs(shoulderAng - oa.shoulderFlex);
      shoulder.stress = (shoulder.stress || 0) + dev * pw.shoulderFlexDev;
    }
  }

  // 8. Antiversione del bacino (hip spostato in avanti = x maggiore del previsto)
  if (hip && opt.hip) {
    const anteriorDev = Math.max(0, hip.x - opt.hip.x - 2);
    if (anteriorDev > 0) hip.stress = (hip.stress || 0) + anteriorDev * G.anteriorPelvis;
  }

  // 9. Forward head (head spostato in avanti rispetto al previsto)
  if (map.head && opt.head) {
    const fwdDev = Math.max(0, map.head.x - opt.head.x - 2);
    if (fwdDev > 0) map.head.stress = (map.head.stress || 0) + fwdDev * G.forwardHead;
  }

  // 10. Stacking verticale catena inferiore (anca-ginocchio-caviglia)
  //     Misurato come deviazione dall'allineamento ottimo del pattern
  if (hip && knee && opt.hip && opt.knee) {
    const observedOffset = Math.abs(hip.x - knee.x);
    const optimalOffset = Math.abs(opt.hip.x - opt.knee.x);
    const dev = Math.abs(observedOffset - optimalOffset);
    hip.stress = (hip.stress || 0) + dev * 2.5;
    knee.stress = (knee.stress || 0) + dev * 2.5;
  }
  if (knee && ankle && opt.knee && opt.ankle) {
    const observedOffset = Math.abs(knee.x - ankle.x);
    const optimalOffset = Math.abs(opt.knee.x - opt.ankle.x);
    const dev = Math.abs(observedOffset - optimalOffset);
    knee.stress = (knee.stress || 0) + dev * 2.5;
    ankle.stress = (ankle.stress || 0) + dev * 2.5;
  }

  joints.forEach((j) => { j.stress = Math.round(clamp(j.stress || 0)); });
  return { ...view, joints };
}

export function computeJointStress(body_diagram: any, exerciseName?: string, macroCategory?: string, subcategory?: string): any {
  if (!body_diagram) return body_diagram;
  const pattern = classifyPattern(exerciseName || '', macroCategory || '', subcategory || '');
  const profile = PROFILES[pattern];
  return {
    ...body_diagram,
    front: computeFront(body_diagram.front, profile),
    side: computeSide(body_diagram.side, profile),
  };
}

export { classifyPattern };

// Restituisce i checkpoint biomeccanici ottimi per il pattern dell'esercizio,
// da passare al LLM come riferimento per posizionare le giunzioni con precisione.
export function getPatternCheckpoints(exerciseName: string, macroCategory: string, subcategory: string): {
  pattern: Pattern;
  description: string;
  optimalAngles: PatternProfile['optimalAngles'];
  keyCheckpoints: string[];
} {
  const pattern = classifyPattern(exerciseName, macroCategory, subcategory);
  const profile = PROFILES[pattern];
  const descriptions: Record<Pattern, string> = {
    squat: 'Squat/accovacciata — fase critica: fondo (cosce parallele o sotto). Ginocchia flesse ~90-110°, anca flessa ~90-100°, tronco inclinato ~30-45° in avanti per mantenere il baricentro sopra la base.',
    hinge: 'Hinge/stacco — fase critica: setup con tronco inclinato. Ginocchia leggermente flesse (~140-160°), anca flessa ~70-90°, tronco inclinato ~45-60°, colonna neutra (non flessa).',
    push: 'Push/piegamento o panca — fase critica: fondo. Gomiti flessi ~80-90°, spalle flesse, corpo allineato (tronco neutro, anche non afflosciate).',
    pull: 'Pull/trazione o rematore — fase critica: massima trazione. Gomiti flessi ~90-100°, spalle in trazione, tronco verticale o leggermente inclinato.',
    lunge: 'Lunge/affondo — fase critica: fondo. Gamba anteriore ginocchio ~90°, gamba posteriore estesa, anca flessa ~90°, tronco verticale.',
    overhead: 'Overhead/press sopra la testa — fase critica: massima altezza. Spalle flesse ~180° (braccia sopra la testa), gomiti estesi o leggermente flessi, tronco verticale, core stabile.',
    core: 'Core/plank o L-sit — fase critica: tenuta isometrica. Corpo allineato o chiuso, tronco neutro o flesso, colonna stabile.',
    static: 'Posturale/statica — posizione neutra in piedi. Colonna verticale, anche e spalle orizzontali, arti estesi.',
    cycling: 'Ciclismo/pedalata — fase critica: punto più basso del pedale (bottom dead center). Ginocchio leggermente flesso ~150-160°, anca flessa ~100-110°, tronco inclinato in avanti ~20-35° (posizione aerodinamica su bici), core stabile per non dondolare il bacino.',
  };
  const checkpoints: Record<Pattern, string[]> = {
    squat: [
      'Ginocchia allineate alle punte dei piedi (non valgo = non verso la linea mediana)',
      'Profondità: cosce parallele o appena sotto',
      'Tronco inclinato in avanti ma colonna neutra (non flessa)',
      'Also orizzontali (no tilt pelvico)',
      'Peso sui talloni/avampiede, non sulle punte',
    ],
    hinge: [
      'Colonna neutra (nessuna flessione/estensione del rachide)',
      'Anca indietro (hip hinge, non squat)',
      'Ginocchia leggermente flesse ma non avanzate oltre le punte',
      'Spalle retratte, sguardo avanti non in basso',
      'Baricentro sopra il metatarso',
    ],
    push: [
      'Corpo allineato (teste-ginocchia-caviglie sulla stessa retta)',
      'Gomiti a ~45° dal tronco (non aperti a 90°)',
      'Anche non afflosciate (no tilt pelvico anteriore)',
      'Spalle lontane dalle orecchie (non alzate)',
      'Discesa controllata (fase eccentrica)',
    ],
    pull: [
      'Gomiti che seguono la traiettoria corretta (non svasati)',
      'Spalle depresse (non alzate verso le orecchie)',
      'Tronco stabile (non dondolante)',
      'Escursione completa (massima trazione/contrazione)',
      'Colonna neutra (non iperestesa)',
    ],
    lunge: [
      'Ginocchio anteriore allineato alla caviglia (non oltre le punte)',
      'Ginocchio posteriore verso il suolo (non tocca)',
      'Tronco verticale (non inclinato in avanti)',
      'Anche quadrate (no tilt)',
      'Passo sufficiente per stabilità',
    ],
    overhead: [
      'Braccia verticali sopra la testa (non in avanti)',
      'Tronco verticale (no iperestensione lombare)',
      'Core attivo per stabilizzare il bacino',
      'Spalle depresse e ruolate esternamente',
      'Colonna neutra (non inarcata)',
    ],
    core: [
      'Colonna neutra (nessuna flessione/estensione del rachide)',
      'Core attivo (ombelico verso colonna)',
      'Anche allineate alle spalle',
      'Niente afflosciamento dei fianchi',
      'Respirazione diaframmatica',
    ],
    static: [
      'Colonna verticale e neutra',
      'Spalle rilassate e simmetriche',
      'Anche orizzontali',
      'Testa allineata al tronco (non forward head)',
      'Distribuzione del peso simmetrica',
    ],
    cycling: [
      'Ginocchia allineate alle anche durante tutta la pedalata (nessun valgismo)',
      'Colonna neutra con inclinazione in avanti del tronco (non curvata a C)',
      'Bacino stabile (nessun dondolio laterale durante la pedalata)',
      'Caviglia in linea con il pedale (dorsiflessione/plantarflessione controllata)',
      'Spalle rilassate, gomiti leggermente flessi (non bloccati sulle mani)',
    ],
  };
  return {
    pattern,
    description: descriptions[pattern],
    optimalAngles: profile.optimalAngles,
    keyCheckpoints: checkpoints[pattern],
  };
}