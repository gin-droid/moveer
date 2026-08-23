// Calcolo deterministico dello stress articolare a riposo a partire dalla
// postura osservata (posizioni delle giunzioni normalizzate 0-100).
// Sostituisce le stime soggettive del modello LLM con un punteggio riproducibile
// basato su scostamento dalla posizione neutra, asimmetrie e disallineamenti.

interface Point { x: number; y: number; }
interface Joint { id: string; label?: string; x: number; y: number; stress?: number; }
interface Segment { from: string; to: string; misaligned?: boolean; }
interface View { joints?: Joint[]; segments?: Segment[]; }

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

const W = {
  misalign: 22,    // per segmento disallineato collegato alla giunzione
  deviation: 3.2,   // per unita' di scostamento dalla posizione neutra
  asymmetry: 4.0,   // per unita' di differenza di y tra giunzioni accoppiate (front)
  valgus: 6.0,      // ginocchio valgo (avvicinamento alla linea mediana)
  stack: 3.0,       // disallineamento verticale catena inferiore (side)
  lateralSpine: 2.0,  // deviazione laterale colonna (front)
  anteriorPelvis: 3.0, // antiversione bacino (side)
  forwardHead: 2.5,    // forward head (side)
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

function computeView(view: View | undefined, neutral: Record<string, Point>, isFront: boolean): View | undefined {
  if (!view || !Array.isArray(view.joints)) return view;
  const joints: Joint[] = (view.joints as Joint[]).map((j) => ({ ...j, stress: 0 }));
  const map: Record<string, Joint> = {};
  joints.forEach((j) => { map[j.id] = j; });

  // 1. contributo disallineamento segmenti
  (view.segments || []).forEach((s) => {
    if (!s.misaligned) return;
    [s.from, s.to].forEach((id) => {
      if (map[id]) map[id].stress = (map[id].stress || 0) + W.misalign;
    });
  });

  // 2. scostamento dalla posizione neutra
  joints.forEach((j) => {
    const n = neutral[j.id];
    if (!n) return;
    j.stress = (j.stress || 0) + dist(j, n) * W.deviation;
  });

  if (isFront) {
    // 3. asimmetria accoppiamenti (spalle, anche, ginocchia, caviglie)
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
      a.stress = (a.stress || 0) + dy * W.asymmetry;
      b.stress = (b.stress || 0) + dy * W.asymmetry;
    });

    // 4. ginocchio valgo: ginocchia che si avvicinano alla linea mediana (x=50)
    if (map.knee_l) map.knee_l.stress = (map.knee_l.stress || 0) + Math.max(0, map.knee_l.x - 46) * W.valgus;
    if (map.knee_r) map.knee_r.stress = (map.knee_r.stress || 0) + Math.max(0, 54 - map.knee_r.x) * W.valgus;

    // 5. deviazione laterale della colonna (head/neck lontani da x=50)
    ['head', 'neck'].forEach((id) => {
      const j = map[id];
      if (j) j.stress = (j.stress || 0) + Math.abs(j.x - 50) * W.lateralSpine;
    });
  } else {
    // 3. stacking verticale catena inferiore (anca-ginocchio-caviglia)
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
    // 4. antiversione del bacino (hip spostato in avanti = x maggiore)
    if (hip) hip.stress = (hip.stress || 0) + Math.max(0, hip.x - 46) * W.anteriorPelvis;
    // 5. forward head (head spostato in avanti)
    if (map.head) map.head.stress = (map.head.stress || 0) + Math.max(0, map.head.x - 44) * W.forwardHead;
  }

  joints.forEach((j) => { j.stress = Math.round(clamp(j.stress || 0)); });
  return { ...view, joints };
}

export function computeJointStress(body_diagram: any): any {
  if (!body_diagram) return body_diagram;
  return {
    ...body_diagram,
    front: computeView(body_diagram.front, NEUTRAL_FRONT, true),
    side: computeView(body_diagram.side, NEUTRAL_SIDE, false),
  };
}