import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeFrontStress, getStressBearingJoints } from "./stressAnalysis.js";
import { alignFrontDiagram } from "./bodyDiagramLayout.js";

const labels = {
  neck: "Collo",
  knee_l: "Ginocchio sinistro",
  knee_r: "Ginocchio destro",
};

const diagramWithStress = (stresses) => ({
  front: {
    joints: Object.entries(stresses).map(([id, stress]) => ({ id, label: labels[id], stress })),
  },
});

test("reports equal leg stress without defaulting to the left leg", () => {
  const result = analyzeFrontStress(diagramWithStress({ knee_l: 42, knee_r: 42 }));
  assert.equal(result.limb?.label, "Gambe (pari stress)");
  assert.deepEqual(result.limb?.ids, ["gamba_sx", "gamba_dx"]);
});

test("selects the right leg when its stress is higher", () => {
  const result = analyzeFrontStress(diagramWithStress({ knee_l: 35, knee_r: 48 }));
  assert.equal(result.limb?.label, "Gamba destra");
});

test("reports tied joints instead of choosing the first joint in the array", () => {
  const result = analyzeFrontStress(diagramWithStress({ neck: 90, knee_l: 90 }));
  assert.equal(result.joint?.label, "Collo / Ginocchio sinistro (pari stress)");
  assert.deepEqual(result.joint?.ids, ["neck", "knee_l"]);
});

test("does not report the head landmark as the most stressed articulation", () => {
  const result = analyzeFrontStress(diagramWithStress({ head: 100, knee_l: 35 }));
  assert.equal(result.joint?.id, "knee_l");
});

test("excludes head stress from diagram joint gauges, including older reports", () => {
  const view = { joints: [{ id: "head", stress: 100 }, { id: "neck", stress: 35 }] };
  assert.deepEqual(getStressBearingJoints(view).map((joint) => joint.id), ["neck"]);
});

test("centers front joints without changing their relative posture", () => {
  const view = {
    joints: [
      { id: "head", x: 70, y: 18 },
      { id: "neck", x: 70, y: 26 },
      { id: "shoulder_l", x: 54, y: 34 },
      { id: "shoulder_r", x: 86, y: 34 },
      { id: "hip_l", x: 62, y: 64 },
      { id: "hip_r", x: 78, y: 64 },
    ],
  };
  const aligned = alignFrontDiagram(view);
  const byId = Object.fromEntries(aligned.joints.map((joint) => [joint.id, joint]));
  assert.equal(byId.shoulder_l.x, 34);
  assert.equal(byId.shoulder_r.x, 66);
  assert.equal(byId.head.y, 6);
  assert.equal(byId.neck.x - byId.head.x, view.joints[1].x - view.joints[0].x);
});

test("recalculates saved neck stress after removing a global frame offset", () => {
  const view = {
    joints: [
      { id: "head", x: 70, y: 18, stress: 0 },
      { id: "neck", x: 70, y: 26, stress: 100 },
      { id: "shoulder_l", x: 54, y: 34, stress: 0 },
      { id: "shoulder_r", x: 86, y: 34, stress: 0 },
      { id: "hip_l", x: 62, y: 64, stress: 0 },
      { id: "hip_r", x: 78, y: 64, stress: 0 },
    ],
    segments: [],
  };
  const aligned = alignFrontDiagram(view, { exerciseName: "Squat" });
  assert.equal(aligned.joints.find((joint) => joint.id === "neck").stress, 0);
});

test("does not classify the cervical spine as a limb", () => {
  const result = analyzeFrontStress(diagramWithStress({ neck: 90, knee_l: 35 }));
  assert.equal(result.limb?.label, "Gamba sinistra");
});