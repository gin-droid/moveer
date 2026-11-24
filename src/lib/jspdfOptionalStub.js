// jsPDF lazily imports html2canvas, canvg and dompurify only for doc.html() and
// SVG images, which the app never uses. This stub keeps them out of the build.
const unavailable = () => {
  throw new Error("Funzionalità jsPDF non inclusa nel build (html/svg).");
};

export default unavailable;
export const Canvg = { fromString: unavailable };
export const sanitize = unavailable;
