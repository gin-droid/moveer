import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { silhouettePoints } from "@/lib/bodySilhouette";
import { analyzeFrontStress } from "@/lib/stressAnalysis";

const sevColors = {
  Lievo: [251, 191, 36],
  Moderato: [249, 115, 22],
  Grave: [251, 113, 133],
};

export default function ReportPdfExport({ report }) {
  const generate = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (h) => {
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addText = (text, size, opts = {}) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", opts.style || "normal");
      const color = opts.color || [39, 39, 42];
      doc.setTextColor(color[0], color[1], color[2]);
      const lines = doc.splitTextToSize(text, maxW);
      const lineH = size * 1.45;
      lines.forEach((line) => {
        ensureSpace(lineH);
        doc.text(line, margin, y);
        y += lineH;
      });
    };

    const addSectionTitle = (title) => {
      y += 18;
      // Keep title with at least its first line of content
      ensureSpace(48);
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y - 12, 4, 18, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      doc.text(title, margin + 14, y + 2);
      // subtle divider
      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 12, margin + maxW, y + 12);
      y += 24;
    };

    const drawDiagram = (view, viewName, ox, oy, size, gender, highlightJointId) => {
      if (!view) return;
      const joints = view.joints || [];
      const segments = view.segments || [];
      const jointMap = {};
      joints.forEach((j) => (jointMap[j.id] = j));
      const mx = (x) => ox + (x / 100) * size;
      const my = (yv) => oy + (yv / 100) * size;
      const L = (v) => (v / 100) * size;
      const sc = (s) => (s >= 61 ? [251, 113, 133] : s >= 31 ? [251, 191, 36] : [16, 185, 129]);

      // sagoma corporea: contorno a linea sottile con riempimento tenue
      const silPts = silhouettePoints(viewName, gender);
      doc.setFillColor(240, 240, 245);
      doc.setDrawColor(180, 180, 190);
      doc.setLineWidth(0.5);
      doc.moveTo(mx(silPts[0][0]), my(silPts[0][1]));
      for (let i = 1; i < silPts.length; i++) {
        doc.lineTo(mx(silPts[i][0]), my(silPts[i][1]));
      }
      doc.close();
      doc.fill();
      doc.stroke();

      // linee di riferimento orizzontali (spalle, bacino, ginocchia, caviglie) + asse verticale
      const refYs = [
        jointMap["shoulder_l"] || jointMap["shoulder"],
        jointMap["hip_l"] || jointMap["hip"],
        jointMap["knee_l"] || jointMap["knee"],
        jointMap["ankle_l"] || jointMap["ankle"],
      ].filter(Boolean).map((j) => j.y);
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 1.2], 0);
      refYs.forEach((yv) => doc.line(mx(2), my(yv), mx(98), my(yv)));
      doc.line(mx(50), my(2), mx(50), my(98));
      doc.setLineDashPattern([], 0);

      // segments
      segments.forEach((s) => {
        const a = jointMap[s.from];
        const b = jointMap[s.to];
        if (!a || !b) return;
        const col = s.misaligned ? [251, 113, 133] : [113, 113, 122];
        doc.setDrawColor(col[0], col[1], col[2]);
        doc.setLineWidth(s.misaligned ? 1.1 : 0.8);
        doc.line(mx(a.x), my(a.y), mx(b.x), my(b.y));
      });

      // stress gauges (collegamenti esterni)
      joints
        .filter((j) => (j.stress || 0) > 0)
        .forEach((j) => {
          const left = j.x < 50;
          const ex = left ? Math.max(4, j.x - 10) : Math.min(96, j.x + 10);
          const ey = j.y;
          const col = sc(j.stress);
          const barW = 7;
          const bx = left ? ex - barW : ex;
          doc.setDrawColor(col[0], col[1], col[2]);
          doc.setLineWidth(0.25);
          doc.setLineDashPattern([0.4, 0.4], 0);
          doc.line(mx(j.x), my(j.y), mx(ex), my(ey));
          doc.setLineDashPattern([], 0);
          doc.setFillColor(240, 240, 240);
          doc.rect(mx(bx), my(ey) - L(1.4), L(barW), L(2.8), "F");
          doc.setFillColor(col[0], col[1], col[2]);
          doc.rect(mx(bx), my(ey) - L(1.4), L((barW * j.stress) / 100), L(2.8), "F");
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(col[0], col[1], col[2]);
          const tx = left ? mx(bx) - 1 : mx(bx) + L(barW) + 1;
          doc.text(`${j.stress}%`, tx, my(ey) + 1.5, { align: left ? "right" : "left" });
        });

      // joints
      joints.forEach((j) => {
        const col = sc(j.stress || 0);
        const isTop = highlightJointId && j.id === highlightJointId;
        if (isTop) {
          // anello di evidenziazione attorno all'articolazione più sollecitata
          doc.setDrawColor(251, 113, 133);
          doc.setLineWidth(0.6);
          doc.circle(mx(j.x), my(j.y), L(3.4), "S");
          doc.setLineWidth(0.35);
          doc.circle(mx(j.x), my(j.y), L(2.5), "S");
        }
        doc.setFillColor(col[0], col[1], col[2]);
        doc.circle(mx(j.x), my(j.y), L(1.6), "F");
        if (isTop) {
          // etichetta sopra la giunzione
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(251, 113, 133);
          doc.text(j.label || j.id, mx(j.x), my(j.y) - L(4), { align: "center" });
        }
      });
    };

    // ---- Header bar ----
    doc.setFillColor(9, 9, 11);
    doc.rect(0, 0, pageW, 78, "F");
    doc.setTextColor(52, 211, 153);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("moVeerAI", margin, 32);
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("REPORT DI ANALISI", margin + 66, 32);
    const date = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(9);
    doc.text(`Generato il ${date}`, margin, 52);
    y = 110;

    // ---- Title ----
    addText(report.exercise_name || "Esercizio", 22, { style: "bold", color: [24, 24, 27] });
    if (report.macro_category || report.subcategory) {
      addText(
        `${report.macro_category || ""}${report.macro_category && report.subcategory ? " / " : ""}${report.subcategory || ""}`,
        11,
        { color: [16, 185, 129], style: "bold" }
      );
    }

    // ---- Score box ----
    y += 12;
    ensureSpace(60);
    const score = report.score ?? 0;
    const scoreColor = score >= 75 ? [16, 185, 129] : score >= 50 ? [251, 191, 36] : [251, 113, 133];
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(margin, y, maxW, 56, 10, 10, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(82, 82, 91);
    doc.text("PUNTEGGIO ESECUZIONE", margin + 18, y + 22);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${score}/100`, margin + 18, y + 46);
    // qualitative label on the right
    const ql = score >= 75 ? "Ottima" : score >= 50 ? "Da migliorare" : "Critica";
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(82, 82, 91);
    doc.text(ql, margin + maxW - 18, y + 46, { align: "right" });
    y += 76;

    // ---- Mappa posturale & stress articolare (singolo corpo) ----
    if (report.body_diagram) {
      const dSize = 170;
      ensureSpace(dSize + 44);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      doc.text("Mappa posturale & stress articolare", margin, y);
      y += 12;
      const g = report.gender || "maschio";
      const useFront = !!report.body_diagram.front;
      const viewData = useFront ? report.body_diagram.front : report.body_diagram.side;
      const viewName = useFront ? "front" : "side";
      // Analisi stress sulla vista frontale
      const { joint: topJoint, limb: topLimb } = analyzeFrontStress(report.body_diagram);
      const highlightId = useFront && topJoint ? topJoint.id : null;
      const dStartX = margin + (maxW - dSize) / 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(82, 82, 91);
      doc.text(useFront ? "VISTA FRONTALE" : "VISTA LATERALE", dStartX + dSize / 2, y, { align: "center" });
      y += 6;
      drawDiagram(viewData, viewName, dStartX, y, dSize, g, highlightId);
      y += dSize + 10;
      // legenda
      const legY = y;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const legs = [
        { c: [16, 185, 129], t: "Basso (0-30%)" },
        { c: [251, 191, 36], t: "Moderato (31-60%)" },
        { c: [251, 113, 133], t: "Alto (61-100%)" },
      ];
      let lx = dStartX;
      legs.forEach((lg) => {
        doc.setFillColor(lg.c[0], lg.c[1], lg.c[2]);
        doc.circle(lx, legY, 2, "F");
        doc.setTextColor(82, 82, 91);
        doc.text(lg.t, lx + 5, legY + 1.8);
        lx += doc.getTextWidth(lg.t) + 24;
      });
      y = legY + 16;

      // Indicazione articolazione / arto più sollecitato (vista frontale)
      if (topJoint || topLimb) {
        const boxH = 78;
        ensureSpace(boxH + 8);
        // sfondo
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(margin, y, maxW, boxH, 8, 8, "F");
        // bordo sinistro spesso
        doc.setFillColor(251, 113, 133);
        doc.roundedRect(margin, y, 5, boxH, 2.5, 2.5, "F");
        // bordo sottile attorno
        doc.setDrawColor(251, 113, 133);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, maxW, boxH, 8, 8, "S");

        const padX = 20;
        const innerW = maxW - padX * 2;
        const colW = innerW / 2;
        const col1X = margin + padX;
        const col2X = margin + padX + colW;

        // Titolo sezione
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(251, 113, 133);
        doc.text("FOCUS STRESS ARTICOLARE", col1X, y + 18);

        // separatore verticale tra le due colonne
        doc.setDrawColor(251, 113, 133);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(col2X, y + 28, col2X, y + boxH - 10);
        doc.setLineDashPattern([], 0);

        // Colonna 1 — Articolazione più sollecitata
        if (topJoint) {
          // pallino
          doc.setFillColor(251, 113, 133);
          doc.circle(col1X + 2, y + 40, 2.6, "F");
          // etichetta
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(153, 27, 27);
          doc.text("ARTICOLAZIONE PIÙ SOLLECITATA", col1X + 10, y + 41);
          // valore
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(24, 24, 27);
          doc.text(`${topJoint.label || topJoint.id}`, col1X, y + 58);
          // percentuale
          const stressCol = topJoint.stress >= 61 ? [251, 113, 133] : topJoint.stress >= 31 ? [251, 191, 36] : [16, 185, 129];
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(stressCol[0], stressCol[1], stressCol[2]);
          doc.text(`${topJoint.stress}% di stress`, col1X, y + 72);
        }

        // Colonna 2 — Arto più sollecitato
        if (topLimb) {
          doc.setFillColor(251, 113, 133);
          doc.circle(col2X + 2, y + 40, 2.6, "F");
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(153, 27, 27);
          doc.text("ARTO PIÙ SOLLECITATO", col2X + 10, y + 41);
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(24, 24, 27);
          doc.text(topLimb.label, col2X, y + 58);
          // indicatore cumulativo
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120, 120, 130);
          doc.text("Stress cumulativo massimo", col2X, y + 72);
        }

        y += boxH + 12;
      }
    }

    // ---- Summary ----
    if (report.summary) {
      addSectionTitle("Sintesi");
      addText(report.summary, 11, { color: [63, 63, 70] });
    }

    // ---- Issues ----
    if ((report.issues_detected || []).length > 0) {
      addSectionTitle("Problemi rilevati");
      report.issues_detected.forEach((iss, i) => {
        ensureSpace(60);
        // number + title
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(24, 24, 27);
        const titleLines = doc.splitTextToSize(`${i + 1}. ${iss.title}`, maxW - 70);
        titleLines.forEach((line, idx) => {
          ensureSpace(18);
          doc.text(line, margin, y);
          if (idx === 0) {
            // severity badge aligned to first line
            const sev = iss.severity || "";
            const sc = sevColors[iss.severity] || [161, 161, 170];
            if (sev) {
              const sevW = doc.getTextWidth(sev) + 18;
              doc.setFillColor(sc[0], sc[1], sc[2]);
              doc.roundedRect(pageW - margin - sevW, y - 11, sevW, 16, 8, 8, "F");
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(8);
              doc.setFont("helvetica", "bold");
              doc.text(sev, pageW - margin - sevW / 2, y, { align: "center" });
            }
          }
          y += 18;
        });
        if (iss.description) {
          addText(iss.description, 10, { color: [82, 82, 91] });
        }
        y += 10;
      });
    }

    // ---- Corrections ----
    if ((report.corrections || []).length > 0) {
      addSectionTitle("Correzioni");
      report.corrections.forEach((c, i) => {
        if (c.issue) addText(`${i + 1}. ${c.issue}`, 12, { style: "bold", color: [24, 24, 27] });
        if (c.correction) addText(c.correction, 11, { color: [63, 63, 70] });
        if (c.cue) {
          ensureSpace(28);
          doc.setFillColor(236, 253, 245);
          doc.roundedRect(margin, y, maxW, 24, 6, 6, "F");
          doc.setFontSize(10);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(16, 185, 129);
          const cueLines = doc.splitTextToSize(`Cue: ${c.cue}`, maxW - 20);
          doc.text(cueLines, margin + 12, y + 16);
          y += 24 + cueLines.length * 4;
        }
        y += 8;
      });
    }

    // ---- Corrective exercises ----
    if ((report.corrective_exercises || []).length > 0) {
      addSectionTitle("Esercizi correttivi");
      report.corrective_exercises.forEach((ex, i) => {
        addText(
          `${i + 1}. ${ex.name}${ex.target ? " — " + ex.target : ""}${ex.sets_reps ? " (" + ex.sets_reps + ")" : ""}`,
          11,
          { style: "bold", color: [24, 24, 27] }
        );
        if (ex.why) addText(ex.why, 10, { color: [82, 82, 91] });
        y += 6;
      });
    }

    // ---- Recommendations ----
    if ((report.recommendations || []).length > 0) {
      addSectionTitle("Raccomandazioni");
      report.recommendations.forEach((r) => {
        const lines = doc.splitTextToSize(r, maxW - 16);
        lines.forEach((line, idx) => {
          ensureSpace(16);
          if (idx === 0) {
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(16, 185, 129);
            doc.text("•", margin, y);
          }
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(63, 63, 70);
          doc.text(line, margin + 16, y);
          y += 16;
        });
        y += 4;
      });
    }

    // ---- Footer page numbers ----
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(161, 161, 170);
      doc.text(`moVeerAI — Report di analisi`, margin, pageH - 20);
      doc.text(`Pagina ${p}/${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
    }

    const fn = `report_${(report.exercise_name || "esercizio").toLowerCase().replace(/\s+/g, "_")}.pdf`;
    doc.save(fn);
  };

  return (
    <button
      onClick={generate}
      className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors border border-zinc-700"
    >
      <FileDown className="w-4 h-4" /> Esporta PDF
    </button>
  );
}