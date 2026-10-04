import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BONES = [
  ["spine_base", "spine_chest"], ["spine_chest", "neck"], ["neck", "head"],
  ["spine_chest", "shoulder_l"], ["spine_chest", "shoulder_r"],
  ["shoulder_l", "elbow_l"], ["elbow_l", "wrist_l"],
  ["shoulder_r", "elbow_r"], ["elbow_r", "wrist_r"],
  ["spine_base", "hip_l"], ["spine_base", "hip_r"],
  ["hip_l", "knee_l"], ["knee_l", "ankle_l"],
  ["hip_r", "knee_r"], ["knee_r", "ankle_r"],
];

export default function DepthAnalysisPanel({ analysis }) {
  const mountRef = useRef(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [renderError, setRenderError] = useState(false);
  const frames = Array.isArray(analysis?.keyFrames) ? analysis.keyFrames : [];
  const frame = frames[Math.min(frameIndex, Math.max(0, frames.length - 1))];

  useEffect(() => {
    const mount = mountRef.current;
    const joints = frame?.joints3D || [];
    if (!mount || joints.length === 0) return undefined;

    let renderer;
    let controls;
    let animationId;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#09090b");
      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 30);
      camera.position.set(1.5, 1.15, 2.2);
      camera.lookAt(0, 0.45, 0);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.replaceChildren(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xddeee8, 0x27272a, 2.1));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(2, 3, 2);
      scene.add(keyLight);
      const grid = new THREE.GridHelper(2, 12, 0x3f4844, 0x25292a);
      grid.position.y = -0.92;
      scene.add(grid);

      const yDirection = analysis.coordinateSystem === "right_handed_y_down_meters" ? -1 : 1;
      const byId = new Map(joints.map((joint) => [joint.id, joint]));
      const toVector = (point) => new THREE.Vector3(point.x, point.y * yDirection, point.z);
      const skeleton = new THREE.Group();
      for (const [fromId, toId] of BONES) {
        const from = byId.get(fromId);
        const to = byId.get(toId);
        if (!from || !to) continue;
        const geometry = new THREE.BufferGeometry().setFromPoints([toVector(from), toVector(to)]);
        skeleton.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x45d6a0 })));
      }
      for (const joint of joints) {
        const point = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xffc56e, roughness: 0.55 }),
        );
        point.position.copy(toVector(joint));
        skeleton.add(point);
      }
      scene.add(skeleton);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0.42 * yDirection, 0);
      controls.update();
      const resizeObserver = new ResizeObserver(() => {
        if (!mount.clientWidth || !mount.clientHeight) return;
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      });
      resizeObserver.observe(mount);
      const render = () => {
        controls.update();
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(render);
      };
      render();
      setRenderError(false);

      return () => {
        cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        controls.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
            else object.material.dispose();
          }
        });
        renderer.dispose();
        mount.replaceChildren();
      };
    } catch {
      renderer?.dispose();
      setRenderError(true);
      return undefined;
    }
  }, [frame, analysis?.coordinateSystem]);

  if (!analysis) return null;

  const labels = [
    ["Angolo ginocchio", "kneeAngleDeg"],
    ["Flessione ginocchio", "kneeFlexionDeg"],
    ["Angolo anca", "hipAngleDeg"],
    ["Flessione spalla", "shoulderFlexionDeg"],
    ["Inclinazione tronco", "trunkLeanDeg"],
    ["Asimmetria ginocchia", "kneeAsymmetryDeg"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {labels.map(([label, key]) => {
          const value = analysis.measurements?.[key]?.mean;
          return (
            <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
              <div className="text-[11px] text-zinc-500">{label}</div>
              <div className="mt-1 font-medium text-zinc-100">
                {Number.isFinite(value) ? `${value.toFixed(1)}°` : "n/d"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div ref={mountRef} className="h-[280px] w-full" aria-label="Scheletro articolare 3D" />
        {renderError && <p className="px-4 pb-3 text-xs text-amber-300">Visualizzazione 3D non supportata da questo browser.</p>}
      </div>

      {frames.length > 1 && (
        <label className="block space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Frame 3D {frameIndex + 1}/{frames.length}</span>
            <span>{Number(frame?.timestamp || 0).toFixed(2)} s</span>
          </div>
          <input
            type="range"
            min="0"
            max={frames.length - 1}
            step="1"
            value={frameIndex}
            onChange={(event) => setFrameIndex(Number(event.target.value))}
            className="w-full accent-emerald-400"
            aria-label="Seleziona il frame 3D"
          />
        </label>
      )}

      <p className="text-xs text-zinc-500">
        {analysis.sensorType?.toUpperCase()} · {analysis.validFrameCount}/{analysis.sourceFrameCount} frame validi · {analysis.maxJointCount} punti max · confidenza {Number.isFinite(analysis.meanConfidence) ? analysis.meanConfidence.toFixed(2) : "n/d"}
      </p>
    </div>
  );
}