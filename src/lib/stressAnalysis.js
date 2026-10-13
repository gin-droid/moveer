// Analisi dello stress articolare: identifica l'articolazione e l'arto
// più sollecitati a partire dalla vista frontale del body_diagram.

// Mapping giunzioni -> arto (vista frontale)
const LIMB_GROUPS = [
  { id: "braccio_sx", label: "Braccio sinistro", joints: ["shoulder_l", "elbow_l", "wrist_l"] },
  { id: "braccio_dx", label: "Braccio destro", joints: ["shoulder_r", "elbow_r", "wrist_r"] },
  { id: "gamba_sx", label: "Gamba sinistra", joints: ["hip_l", "knee_l", "ankle_l"] },
  { id: "gamba_dx", label: "Gamba destra", joints: ["hip_r", "knee_r", "ankle_r"] },
];

const BILATERAL_JOINTS = [
  { ids: ["knee_l", "knee_r"], label: "Ginocchia (pari stress)" },
  { ids: ["hip_l", "hip_r"], label: "Anche (pari stress)" },
  { ids: ["ankle_l", "ankle_r"], label: "Caviglie (pari stress)" },
  { ids: ["shoulder_l", "shoulder_r"], label: "Spalle (pari stress)" },
  { ids: ["elbow_l", "elbow_r"], label: "Gomiti (pari stress)" },
  { ids: ["wrist_l", "wrist_r"], label: "Polsi (pari stress)" },
];

function describeJointTie(joints) {
  const jointIds = new Set(joints.map((joint) => joint.id));
  const bilateralPair = BILATERAL_JOINTS.find(
    (pair) => pair.ids.length === joints.length && pair.ids.every((id) => jointIds.has(id))
  );
  if (bilateralPair) return bilateralPair.label;
  if (joints.length === 2) {
    return `${joints.map((joint) => joint.label || joint.id).join(" / ")} (pari stress)`;
  }
  return `Più articolazioni (${joints.length}) (pari stress)`;
}

function describeLimbTie(limbs) {
  const groupIds = new Set(limbs.map((limb) => limb.id.replace(/_(sx|dx)$/, "")));
  if (groupIds.size === 1 && groupIds.has("gamba")) return "Gambe (pari stress)";
  if (groupIds.size === 1 && groupIds.has("braccio")) return "Braccia (pari stress)";
  return "Arti diversi (pari stress)";
}

/**
 * Restituisce l'articolazione con stress massimo nella vista fornita.
 * @param {object} view - vista del body_diagram (front o side)
 * @returns {object|null} { id, label, stress } o null
 */
export function getMostStressedJoint(view) {
  if (!view || !Array.isArray(view.joints)) return null;
  const joints = view.joints.filter((j) => (j.stress || 0) > 0);
  if (!joints.length) return null;
  const maxStress = Math.max(...joints.map((joint) => joint.stress || 0));
  const topJoints = joints.filter((joint) => (joint.stress || 0) === maxStress);
  if (topJoints.length === 1) return topJoints[0];
  return {
    ...topJoints[0],
    ids: topJoints.map((joint) => joint.id),
    label: describeJointTie(topJoints),
  };
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

  if (!ranked.length) return null;
  const maxStress = ranked[0].totalStress;
  const topLimbs = ranked.filter((limb) => limb.totalStress === maxStress);
  if (topLimbs.length === 1) return topLimbs[0];
  return {
    ...topLimbs[0],
    ids: topLimbs.map((limb) => limb.id),
    label: describeLimbTie(topLimbs),
  };
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