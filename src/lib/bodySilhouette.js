// Sagome corporee realistiche per la mappa posturale.
// Ogni sagoma e' definita come una sequenza di punti di ancoraggio (coordinate 0-100)
// disposti attorno al perimetro del corpo; una spline Catmull-Rom chiusa le smussa
// in un contorno organico. Stessa sorgente per SVG (schermo) e jsPDF (export).

const catmullRomClosed = (pts, perSegment = 8) => {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let t = 0; t < perSegment; t++) {
      const s = t / perSegment;
      const s2 = s * s;
      const s3 = s2 * s;
      const x = 0.5 * (
        2 * p1[0] +
        (-p0[0] + p2[0]) * s +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3
      );
      const y = 0.5 * (
        2 * p1[1] +
        (-p0[1] + p2[1]) * s +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3
      );
      out.push([x, y]);
    }
  }
  return out;
};

// Vista frontale — atleta maschio (spalle larghe, vita a V stretta, anche modeste)
const frontMale = [
  [50, 5], [57, 8], [58, 13], [55, 17], [53, 20],
  [68, 23], [65, 32], [60, 42], [57, 50], [58, 57],
  [57, 64], [55, 76], [54, 83], [53, 93], [53, 96],
  [57, 97.5], [52, 98.5], [50, 56], [48, 98.5], [43, 97.5],
  [47, 96], [47, 93], [46, 83], [45, 76], [43, 64],
  [42, 57], [43, 50], [40, 42], [35, 32], [32, 23],
  [47, 20], [45, 17], [42, 13], [43, 8],
];

// Vista frontale — atleta femmina (spalle piu' strette, vita stretta, anche larghe, seno)
const frontFemale = [
  [50, 5], [56, 8], [57, 13], [54, 17], [52, 20],
  [62, 23], [63, 28], [59, 34], [57, 42], [58, 50],
  [62, 57], [60, 64], [57, 76], [56, 83], [54, 93],
  [54, 96], [58, 97.5], [52, 98.5], [50, 56], [48, 98.5],
  [42, 97.5], [46, 96], [46, 93], [44, 83], [43, 76],
  [40, 64], [38, 57], [42, 50], [43, 42], [41, 34],
  [37, 28], [38, 23], [48, 20], [46, 17], [43, 13],
  [44, 8],
];

// Vista laterale — maschio (profilo piuttosto dritto, schiena piatta)
const sideMale = [
  [40, 5], [45, 8], [46, 13], [45, 17], [43, 20],
  [45, 24], [46, 30], [45, 40], [44, 48], [45, 54],
  [44, 58], [50, 62], [52, 70], [53, 78], [54, 90],
  [58, 94], [58, 97], [48, 97], [42, 95], [42, 90],
  [40, 78], [38, 70], [37, 60], [36, 52], [37, 46],
  [36, 38], [35, 30], [35, 24], [35, 18], [37, 12],
];

// Vista laterale — femmina (curve: seno, vita, glutei, schiena arcuata)
const sideFemale = [
  [40, 5], [45, 8], [46, 13], [45, 17], [43, 20],
  [46, 24], [48, 28], [46, 34], [45, 42], [44, 50],
  [45, 55], [44, 58], [50, 62], [52, 70], [53, 78],
  [54, 90], [58, 94], [58, 97], [48, 97], [41, 95],
  [41, 90], [39, 78], [37, 70], [35, 60], [34, 52],
  [35, 46], [34, 38], [33, 30], [33, 24], [34, 18],
  [37, 12],
];

const outlineFor = (view, gender) => {
  const female = gender === "femmina";
  if (view === "side") return female ? sideFemale : sideMale;
  return female ? frontFemale : frontMale;
};

export const silhouettePoints = (view, gender) =>
  catmullRomClosed(outlineFor(view, gender), 8);

export const silhouettePath = (view, gender) => {
  const pts = silhouettePoints(view, gender);
  return (
    "M" + pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" L") + " Z"
  );
};