export function alignFrontDiagram(view, { exerciseName = "", macroCategory = "", subcategory = "" } = {}) {
  if (!view || !Array.isArray(view.joints)) return view;

  const jointsById = Object.fromEntries(view.joints.map((joint) => [joint.id, joint]));
  const torsoCenters = [
    ["shoulder_l", "shoulder_r"],
    ["hip_l", "hip_r"],
  ]
    .map(([leftId, rightId]) => {
      const left = jointsById[leftId];
      const right = jointsById[rightId];
      return left && right ? (left.x + right.x) / 2 : null;
    })
    .filter((center) => center != null && Number.isFinite(center));
  const centerX = torsoCenters.length
    ? torsoCenters.reduce((sum, center) => sum + center, 0) / torsoCenters.length
    : jointsById.neck?.x;
  const xOffset = Number.isFinite(centerX) ? 50 - centerX : 0;
  const yOffset = Number.isFinite(jointsById.head?.y) ? 6 - jointsById.head.y : 0;

  const aligned = {
    ...view,
    joints: view.joints.map((joint) => ({
      ...joint,
      x: Number.isFinite(joint.x) ? joint.x + xOffset : joint.x,
      y: Number.isFinite(joint.y) ? joint.y + yOffset : joint.y,
    })),
  };
  const alignedById = Object.fromEntries(aligned.joints.map((joint) => [joint.id, joint]));
  const neck = alignedById.neck;
  const head = alignedById.head;
  if (neck) {
    const movement = `${exerciseName} ${subcategory}`.toLowerCase();
    const neckY = /ciclismo|cycling|bike|bici|pedal/.test(movement)
      ? 18
      : /deadlift|stacco|rdl|good morning|swing|hip thrust|pull through|romanian/.test(movement)
        ? 16
        : 14;
    const positionWeight = /postur|mobilit/i.test(macroCategory) ? 2.8 : 2;
    const segmentStress = (view.segments || []).reduce((stress, segment) => {
      if (!segment.misaligned) return stress;
      return stress + [segment.from, segment.to].filter((id) => id === "head" || id === "neck").length * 18;
    }, 0);
    const positionStress = Math.hypot(neck.x - 50, neck.y - neckY) * positionWeight * 1.2;
    const lateralStress = Math.abs(neck.x - 50) * 2.2;
    const curvatureStress = head ? Math.abs(head.x - neck.x) * 3 : 0;
    neck.stress = Math.round(Math.min(100, segmentStress + positionStress + lateralStress + curvatureStress));
  }
  return aligned;
}
