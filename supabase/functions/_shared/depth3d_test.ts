import { analyzeDepthData, computeFrameAngles, projectDepthFrameToBodyDiagram } from './depth3d.ts';

const assertNear = (actual: number | null, expected: number, tolerance = 0.1) => {
  if (actual == null || Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected ${expected} ± ${tolerance}, received ${actual}`);
  }
};

const uprightFrame = {
  timestamp: 0.4,
  joints3D: [
    { id: 'spine_base', x: 0, y: 1, z: 0 },
    { id: 'spine_chest', x: 0, y: 1.35, z: 0 },
    { id: 'neck_1', x: 0, y: 1.55, z: 0 },
    { id: 'head', x: 0, y: 1.8, z: 0 },
    { id: 'leftShoulder', x: -0.2, y: 1.35, z: 0 },
    { id: 'rightShoulder', x: 0.2, y: 1.35, z: 0 },
    { id: 'leftElbow', x: -0.2, y: 1.05, z: 0 },
    { id: 'rightElbow', x: 0.2, y: 1.05, z: 0 },
    { id: 'leftWrist', x: -0.2, y: 0.75, z: 0 },
    { id: 'rightWrist', x: 0.2, y: 0.75, z: 0 },
    { id: 'leftHip', x: -0.12, y: 0.95, z: 0 },
    { id: 'rightHip', x: 0.12, y: 0.95, z: 0 },
    { id: 'leftKnee', x: -0.12, y: 0.5, z: 0 },
    { id: 'rightKnee', x: 0.12, y: 0.5, z: 0 },
    { id: 'leftAnkle', x: -0.12, y: 0.05, z: 0 },
    { id: 'rightAnkle', x: 0.12, y: 0.05, z: 0 },
  ],
};

Deno.test('upright pose reports zero trunk lean and straight joint angles', () => {
  const result = computeFrameAngles(uprightFrame);
  assertNear(result.trunkLeanDeg, 0);
  assertNear(result.kneeAngleDeg, 180);
  assertNear(result.hipAngleDeg, 180);
  assertNear(result.shoulderAngleDeg, 180);
  assertNear(result.shoulderFlexionDeg, 0);
  assertNear(result.kneeAsymmetryDeg, 0);
});

Deno.test('missing or low-confidence joints are ignored without throwing', () => {
  const result = computeFrameAngles({
    timestamp: 0,
    joints3D: [
      { id: 'leftKnee', x: 0, y: 0, z: 0, confidence: 0.2 },
      { id: 'rightKnee', x: 0, y: 0, z: 0 },
    ],
  });
  if (result.jointCount !== 1 || result.kneeAngleDeg !== null || result.trunkLeanDeg !== null) {
    throw new Error('Incomplete pose should return null measurements for unavailable angles.');
  }
});

Deno.test('depth analysis stores bounded keyframes in pelvis-relative meters', () => {
  const analysis = analyzeDepthData({ sensorType: 'lidar', frames: [uprightFrame] });
  if (analysis.validFrameCount !== 1 || analysis.keyFrames.length !== 1) {
    throw new Error('Expected one valid representative depth frame.');
  }
  const pelvis = analysis.keyFrames[0].joints3D.find((joint) => joint.id === 'spine_base');
  assertNear(pelvis?.x ?? null, 0);
  assertNear(pelvis?.y ?? null, 0);
  assertNear(pelvis?.z ?? null, 0);
  const diagram = projectDepthFrameToBodyDiagram(analysis.keyFrames[0]);
  if (!diagram?.front?.joints?.some((joint: { id: string }) => joint.id === 'knee_l')) {
    throw new Error('Measured 3D landmarks should project into the front body diagram.');
  }
});