// Analisi dello stress articolare: identifica l'articolazione e l'arto
// più sollecitati a partire dalla vista frontale del body_diagram.

// Mapping giunzioni -> arto (vista frontale)
const LIMB_GROUPS = [
  { id: "braccio_sx", label: "Braccio sinistro", joints: ["shoulder_l", "elbow_l", "wrist_l"] },
  { id: "braccio_dx", label: "Braccio destro", joints: ["shoulder_r", "elbow_r", "wrist_r"] },
  { id: "gamba_sx", label: "Gamba sinistra", joints: ["hip_l", "knee_l", "ankle_l"] },
  { id: "gamba_dx", label: "Gamba destra", joints: ["hip_r", "knee_r", "ankle_r"] },
  { id: "colonna", label: "Colonna cervicale", joints: ["head", "neck"] },
];

/**
 * Restituisce l'articolazione con stress massimo nella vista fornita.
 * @param {object} view - vista del body_diagram (front o side)
 * @returns {object|null} { id, label, stress } o null
 */
export function getMostStressedJoint(view) {
  if (!view || !Array.isArray(view.joints)) return null;
  const joints = view.joints.filter((j) => (j.stress || 0) > 0);
  if (!joints.length) return null;
  return joints.reduce((max, j) =>
    (j.stress || 0) > (max.stress || 0) ? j : max
  );
}

/**
 * Restituisce l'arto con stress cumulato massimo nella vista frontale.
 * @param {object} view - vista frontale del body_diagram
 * @returns {object|null} { id, label, totalStress, joints } o null
 */
export function getMostStressedLimb(view) {
  if (!view || !Array.isArray(view.joints)) return null;
  const map = {};
  view.joints.forEach((j) => { map[j.id] = j; });

  const ranked = LIMB_GROUPS.map((limb) => {
    const limbJoints = limb.joints
      .map((id) => map[id])
      .filter(Boolean);
    const totalStress = limbJoints.reduce((s, j) => s + (j.stress || 0), 0);
    return { ...limb, totalStress, joints: limbJoints };
  })
    .filter((l) => l.totalStress > 0)
    .sort((a, b) => b.totalStress - a.totalStress);

  return ranked.length ? ranked[0] : null;
}

/**
 * Analisi completa della vista frontale: articolazione e arto più sollecitati.
 * @param {object} bodyDiagram - body_diagram completo
 * @returns {object} { joint, limb } (valori null se non disponibili)
 */
export function analyzeFrontStress(bodyDiagram) {
  if (!bodyDiagram || !bodyDiagram.front) return { joint: null, limb: null };
  const front = bodyDiagram.front;
  return {
    joint: getMostStressedJoint(front),
    limb: getMostStressedLimb(front),
  };
}