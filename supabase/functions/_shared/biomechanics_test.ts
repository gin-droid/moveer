import { computeJointStress } from './biomechanics.ts';

const neutralFront = () => ({
  segments: [],
  joints: [
    { id: 'head', x: 50, y: 6 },
    { id: 'neck', x: 50, y: 14 },
    { id: 'shoulder_l', x: 34, y: 22 },
    { id: 'shoulder_r', x: 66, y: 22 },
    { id: 'elbow_l', x: 30, y: 38 },
    { id: 'elbow_r', x: 70, y: 38 },
    { id: 'wrist_l', x: 28, y: 50 },
    { id: 'wrist_r', x: 72, y: 50 },
    { id: 'hip_l', x: 42, y: 52 },
    { id: 'hip_r', x: 58, y: 52 },
    { id: 'knee_l', x: 43, y: 74 },
    { id: 'knee_r', x: 57, y: 74 },
    { id: 'ankle_l', x: 44, y: 94 },
    { id: 'ankle_r', x: 56, y: 94 },
  ],
});

Deno.test('neutral front posture does not give the neck artificial stress', () => {
  const diagram = computeJointStress({ front: neutralFront() }, 'Posizione eretta', 'Postura');
  const neck = diagram.front.joints.find((joint: { id: string }) => joint.id === 'neck');
  if (neck?.stress !== 0) {
    throw new Error(`Expected neutral neck stress 0, received ${neck?.stress}`);
  }
});

Deno.test('front neck stress responds to head-to-neck lateral bend', () => {
  const front = neutralFront();
  front.joints.find((joint) => joint.id === 'head')!.x = 44;
  const diagram = computeJointStress({ front }, 'Posizione eretta', 'Postura');
  const neck = diagram.front.joints.find((joint: { id: string }) => joint.id === 'neck');
  if ((neck?.stress || 0) <= 0) {
    throw new Error('Expected lateral head-to-neck bend to increase neck stress.');
  }
});