// Motore biomeccanico deterministico per il calcolo dello stress articolare.
// Calcola lo stress di ogni giunzione a partire dalla postura osservata
// (posizioni normalizzate 0-100) confrontandola con l'esecuzione ottima/neutra.
//
// Sostituisce le stime soggettive del modello LLM con un punteggio riproducibile
// basato su:
//  1. Angoli articolari reali (flessione ginocchio, inclinazione tronco, Q-angle)
//  2. Deviazione dalla posizione neutra
//  3. Asimmetrie bilaterali (solo vista frontale)
//  4. Disallineamento dei segmenti
//  5. Leva / momento (braccio di resistenza sulle articolazioni portanti)
//  6. Peso di importanza differenziato per articolazione
//  7. Curvatura e inclinazione della colonna

interface Point { x: number; y: number; }
interface Joint { id: string; label?: string; x: number; y: number; stress?: number; }
interface Segment { from: string; to: string; misaligned?: boolean; }
interface View { joints?: Joint[]; segments?: Segment[]; }

// --- Posizioni neutre di riferimento ---
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

// --- Pesi di importanza articolare ---
// Articolazioni critiche (ginocchia, anche, colonna) pesano di più.
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

// --- Costanti di calibrazione ---
const W = {
  misalign: 18,        // contributo per segmento disallineato
  deviation: 2.8,      // per unità di scostamento dalla neutra
  asymmetryY: 3.5,     // per unità di differenza di y tra coppie (front)
  asymmetryX: 2.5,     // per unità di differenza di x tra coppie (front)
  valgus: 5.5,         // ginocchio valgo (avvicinamento alla linea mediana)
  lateralSpine: 2.2,   // deviazione laterale colonna (front)
  trunkLean: 4.0,      // inclinazione del tronco rispetto alla verticale (side)
  kneeFlex: 0.15,      // per grado di deviazione dalla flessione ottima ginocchio (side)
  hipFlex: 0.12,      // per grado di deviazione dall'angolo ottimo anca (side)
  forwardHead: 2.5,    // forward head posture (side)
  anteriorPelvis: 3.0, // antiversione bacino (side)
  stack: 2.5,          // disallineamento catena inferiore (side)
  qAngle: 0.2,         // per grado di deviazione del Q-angle (front)
  spineCurvature: 3.0,// curvatura della colonna (deviazione dalla retta neck-hip)
  momentArm: 1.8,      // leva: distanza orizzontale anca-ginocchio (side)
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

function computeFront(view: View | undefined): View | undefined {
  if (!view || !Array.isArray(view.joints)) return view;
  const joints: Joint[] = (view.joints as Joint[]).map((j) => ({ ...j, stress: 0 }));
  const map: Record<string, Joint> = {};
  joints.forEach((j) => { map[j.id] = j; });

  // 1. Contributo disallineamento segmenti
  (view.segments || []).forEach((s) => {
    if (!s.misaligned) return;
    [s.from, s.to].forEach((id) => {
      if (map[id]) map[id].stress = (map[id].stress || 0) + W.misalign;
    });
  });

  // 2. Scostamento dalla posizione neutra (pesato per importanza)
  joints.forEach((j) => {
    const n = NEUTRAL_FRONT[j.id];
    if (!n) return;
    const w = JOINT_WEIGHT[j.id] || 1.0;
    j.stress = (j.stress || 0) + dist(j, n) * W.deviation * w;
  });

  // 3. Asimmetria bilaterale (spalle, anche, ginocchia, caviglie) — sia y che x
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
    a.stress = (a.stress || 0) + dy * W.asymmetryY + dx * W.asymmetryX * 0.5;
    b.stress = (b.stress || 0) + dy * W.asymmetryY + dx * W.asymmetryX * 0.5;
  });

  // 4. Ginocchio valgo/varo: ginocchia che si avvicinano (valgo) o
  //    si allontanano (varo) dalla linea mediana (x=50)
  if (map.knee_l) map.knee_l.stress = (map.knee_l.stress || 0) + Math.max(0, map.knee_l.x - 46) * W.valgus;
  if (map.knee_r) map.knee_r.stress = (map.knee_r.stress || 0) + Math.max(0, 54 - map.knee_r.x) * W.valgus;

  // 5. Q-angle: allineamento anca→ginocchio→caviglia. Il Q-angle neutro è ~0°
  //    (ginocchio sulla linea retta anca-caviglia). Deviazioni = stress.
  ['l', 'r'].forEach((side) => {
    const hip = map[`hip_${side}`], knee = map[`knee_${side}`], ankle = map[`ankle_${side}`];
    const qAng = angleAt(hip, knee, ankle);
    if (qAng !== null && knee) {
      // Q-angle ideale ~175-180° (quasi dritto). Deviazione = stress.
      const dev = Math.abs(180 - qAng);
      knee.stress = (knee.stress || 0) + dev * W.qAngle;
    }
  });

  // 6. Deviazione laterale della colonna (head/neck lontani da x=50)
  ['head', 'neck'].forEach((id) => {
    const j = map[id];
    if (j) j.stress = (j.stress || 0) + Math.abs(j.x - 50) * W.lateralSpine;
  });

  // 7. Curvatura della colonna: deviazione del collo dalla linea spalla-anca
  ['l', 'r'].forEach((side) => {
    const shoulder = map[`shoulder_${side}`], hip = map[`hip_${side}`], neck = map.neck;
    if (!shoulder || !hip || !neck) return;
    // proietta neck sulla linea shoulder-hip e misura la deviazione
    const dx = hip.x - shoulder.x;
    const dy = hip.y - shoulder.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.01) return;
    const t = ((neck.x - shoulder.x) * dx + (neck.y - shoulder.y) * dy) / len2;
    const projX = shoulder.x + t * dx;
    const projY = shoulder.y + t * dy;
    const dev = dist({ x: neck.x, y: neck.y }, { x: projX, y: projY });
    neck.stress = (neck.stress || 0) + dev * W.spineCurvature;
  });

  joints.forEach((j) => { j.stress = Math.round(clamp(j.stress || 0)); });
  return { ...view, joints };
}

function computeSide(view: View | undefined): View | undefined {
  if (!view || !Array.isArray(view.joints)) return view;
  const joints: Joint[] = (view.joints as Joint[]).map((j) => ({ ...j, stress: 0 }));
  const map: Record<string, Joint> = {};
  joints.forEach((j) => { map[j.id] = j; });

  // 1. Contributo disallineamento segmenti
  (view.segments || []).forEach((s) => {
    if (!s.misaligned) return;
    [s.from, s.to].forEach((id) => {
      if (map[id]) map[id].stress = (map[id].stress || 0) + W.misalign;
    });
  });

  // 2. Scostamento dalla posizione neutra (pesato)
  joints.forEach((j) => {
    const n = NEUTRAL_SIDE[j.id];
    if (!n) return;
    const w = JOINT_WEIGHT[j.id] || 1.0;
    j.stress = (j.stress || 0) + dist(j, n) * W.deviation * w;
  });

  // 3. Stacking verticale catena inferiore (anca-ginocchio-caviglia)
  const hip = map.hip, knee = map.knee, ankle = map.ankle;
  if (hip && knee) {
    const d = Math.abs(hip.x - knee.x);
    hip.stress = (hip.stress || 0) + d * W.stack;
    knee.stress = (knee.stress || 0) + d * W.stack;
  }
  if (knee && ankle) {
    const d = Math.abs(knee.x - ankle.x);
    knee.stress = (knee.stress || 0) + d * W.stack;
    ankle.stress = (ankle.stress || 0) + d * W.stack;
  }

  // 4. Inclinazione del tronco (spalla→anca rispetto alla verticale)
  //    Tronco neutro = verticale (0°). Inclinazione = stress su anca e colonna.
  if (map.shoulder && hip) {
    const trunkTilt = Math.abs(tiltFromVertical(map.shoulder, hip));
    if (trunkTilt > 5) {
      const excess = trunkTilt - 5;
      hip.stress = (hip.stress || 0) + excess * W.trunkLean;
      map.shoulder.stress = (map.shoulder.stress || 0) + excess * W.trunkLean * 0.6;
      if (map.neck) map.neck.stress = (map.neck.stress || 0) + excess * W.trunkLean * 0.4;
    }
  }

  // 5. Flessione del ginocchio (angolo anca-ginocchio-caviglia)
  //    Ginocchio esteso ≈ 180°. Flessione eccessiva o insufficiente = stress.
  if (hip && knee && ankle) {
    const kneeAng = angleAt(hip, knee, ankle);
    if (kneeAng !== null) {
      // Stress per deviazione dall'angolo neutro di riferimento (in piedi)
      const neutralKneeAng = angleAt(NEUTRAL_SIDE.hip, NEUTRAL_SIDE.knee, NEUTRAL_SIDE.ankle);
      if (neutralKneeAng !== null) {
        const angDev = Math.abs(kneeAng - neutralKneeAng);
        knee.stress = (knee.stress || 0) + angDev * W.kneeFlex;
      }
    }
  }

  // 6. Flessione dell'anca (angolo spalla-anca-ginocchio)
  if (map.shoulder && hip && knee) {
    const hipAng = angleAt(map.shoulder, hip, knee);
    if (hipAng !== null) {
      const neutralHipAng = angleAt(NEUTRAL_SIDE.shoulder, NEUTRAL_SIDE.hip, NEUTRAL_SIDE.knee);
      if (neutralHipAng !== null) {
        const angDev = Math.abs(hipAng - neutralHipAng);
        hip.stress = (hip.stress || 0) + angDev * W.hipFlex;
      }
    }
  }

  // 7. Antiversione del bacino (hip spostato in avanti = x maggiore)
  if (hip) hip.stress = (hip.stress || 0) + Math.max(0, hip.x - 46) * W.anteriorPelvis;

  // 8. Forward head (head spostato in avanti = x maggiore)
  if (map.head) map.head.stress = (map.head.stress || 0) + Math.max(0, map.head.x - 44) * W.forwardHead;

  // 9. Leva / momento: distanza orizzontale tra anca e ginocchio
  //    (maggiore = maggiore momento flettente sull'anca)
  if (hip && knee) {
    const momentArm = Math.abs(hip.x - knee.x);
    if (momentArm > 4) {
      hip.stress = (hip.stress || 0) + (momentArm - 4) * W.momentArm;
      knee.stress = (knee.stress || 0) + (momentArm - 4) * W.momentArm * 0.5;
    }
  }

  joints.forEach((j) => { j.stress = Math.round(clamp(j.stress || 0)); });
  return { ...view, joints };
}

export function computeJointStress(body_diagram: any): any {
  if (!body_diagram) return body_diagram;
  return {
    ...body_diagram,
    front: computeFront(body_diagram.front),
    side: computeSide(body_diagram.side),
  };
}