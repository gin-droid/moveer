// Sagome corporee normalizzate (coordinate 0-100) per la mappa posturale.
// Primitive:
//  - ellipse { cx, cy, rx, ry }
//  - capsule { x1, y1, x2, y2, w }  (linea spessa con estremita arrotondate)
// Usate sia dal BodyDiagram (SVG) sia dall'export PDF (jsPDF).

export const frontSilhouette = (gender) => {
  if (gender === "femmina") {
    return {
      ellipses: [
        { cx: 50, cy: 12, rx: 5.5, ry: 6.5 },
        { cx: 42, cy: 95.5, rx: 4.5, ry: 2.5 },
        { cx: 58, cy: 95.5, rx: 4.5, ry: 2.5 },
      ],
      capsules: [
        { x1: 50, y1: 18.5, x2: 50, y2: 22, w: 4 },
        { x1: 37, y1: 24, x2: 63, y2: 24, w: 7 },
        { x1: 50, y1: 26, x2: 50, y2: 52, w: 23 },
        { x1: 50, y1: 52, x2: 50, y2: 58, w: 30 },
        { x1: 37, y1: 25, x2: 39, y2: 66, w: 6.5 },
        { x1: 63, y1: 25, x2: 61, y2: 66, w: 6.5 },
        { x1: 43, y1: 57, x2: 42, y2: 95, w: 11 },
        { x1: 57, y1: 57, x2: 58, y2: 95, w: 11 },
      ],
    };
  }
  return {
    ellipses: [
      { cx: 50, cy: 12, rx: 6, ry: 6.5 },
      { cx: 41, cy: 95.5, rx: 4.5, ry: 2.5 },
      { cx: 59, cy: 95.5, rx: 4.5, ry: 2.5 },
    ],
    capsules: [
      { x1: 50, y1: 18.5, x2: 50, y2: 22, w: 4.5 },
      { x1: 33, y1: 24, x2: 67, y2: 24, w: 8 },
      { x1: 50, y1: 26, x2: 50, y2: 56, w: 30 },
      { x1: 50, y1: 54, x2: 50, y2: 58, w: 28 },
      { x1: 33, y1: 25, x2: 35, y2: 67, w: 7.5 },
      { x1: 67, y1: 25, x2: 65, y2: 67, w: 7.5 },
      { x1: 42, y1: 56, x2: 41, y2: 95, w: 12 },
      { x1: 58, y1: 56, x2: 59, y2: 95, w: 12 },
    ],
  };
};

export const sideSilhouette = (gender) => {
  const base = {
    ellipses: [
      { cx: 40, cy: 12, rx: 5.5, ry: 6.5 },
      { cx: 53, cy: 94, rx: 5.5, ry: 2.5 },
    ],
    capsules: [
      { x1: 40, y1: 18, x2: 40, y2: 22, w: 4 },
      { x1: 40, y1: 24, x2: 44, y2: 25, w: 6 },
      { x1: 44, y1: 26, x2: 44, y2: 56, w: 6 },
      { x1: 41, y1: 24, x2: 42, y2: 54, w: 20 },
      { x1: 42, y1: 54, x2: 42, y2: 58, w: 18 },
      { x1: 42, y1: 58, x2: 50, y2: 93, w: 11 },
    ],
  };
  if (gender === "femmina") {
    return {
      ellipses: base.ellipses,
      capsules: [
        ...base.capsules,
        { x1: 45, y1: 30, x2: 47, y2: 34, w: 6 },
        { x1: 37, y1: 48, x2: 35, y2: 56, w: 7 },
      ],
    };
  }
  return base;
};

export const silhouetteFor = (view, gender) =>
  view === "side" ? sideSilhouette(gender) : frontSilhouette(gender);