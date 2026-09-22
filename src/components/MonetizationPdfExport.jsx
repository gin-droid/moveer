import jsPDF from "jspdf";
import { PLANS, COSTS, TOTAL_BUILDER, TOTAL_PRO, BREAK_EVEN_SCENARIOS } from "@/lib/monetizationData";

export default function MonetizationPdfExport() {
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

    const addDivider = () => {
      ensureSpace(20);
      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + maxW, y);
      y += 16;
    };

    // ===== Title =====
    addText("moVeerAI — Piano di Monetizzazione", 20, { style: "bold", color: [20, 184, 166] });
    addText(`Documento generato il ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`, 10, { color: [100, 100, 100] });
    y += 8;
    addDivider();

    // ===== Costi annuali =====
    addText("1. Costi annuali da coprire", 14, { style: "bold", color: [20, 20, 20] });
    y += 6;
    Object.values(COSTS).forEach((c) => {
      addText(`• ${c.label}: €${c.value}/anno`, 11);
      addText(`  ${c.note}`, 9, { color: [120, 120, 120] });
    });
    y += 4;
    addText(`Totale minimo (Builder + Store): €${TOTAL_BUILDER}/anno`, 12, { style: "bold", color: [20, 184, 166] });
    addText(`Totale massimo (Pro + Store): €${TOTAL_PRO}/anno`, 12, { style: "bold", color: [217, 119, 6] });
    y += 8;
    addDivider();

    // ===== Piani =====
    addText("2. Piani di abbonamento", 14, { style: "bold", color: [20, 20, 20] });
    y += 6;

    PLANS.forEach((plan, i) => {
      ensureSpace(120);
      addText(`${plan.name} — ${plan.tagline}`, 13, { style: "bold", color: plan.id === "pro" ? [16, 185, 129] : plan.id === "coach" ? [217, 119, 6] : [80, 80, 80] });
      const priceStr = plan.priceMonthly === 0
        ? "Gratis"
        : `€${plan.priceMonthly}/mese (€${plan.priceYearly}/anno)`;
      addText(`Prezzo: ${priceStr}`, 11);
      addText(`Utenti: ${plan.limits.users}`, 11);
      addText(`Analisi/mese: ${plan.limits.analysesPerMonth}`, 11);
      addText(`Interrogazioni Mentore/mese: ${plan.limits.mentorQueriesPerMonth}`, 11);
      y += 4;
      addText("Funzionalità incluse:", 10, { style: "bold" });
      plan.features.forEach((f) => addText(`  ✓ ${f}`, 10, { color: [60, 60, 60] }));
      if (plan.limitations.length > 0) {
        y += 2;
        addText("Limitazioni:", 10, { style: "bold", color: [150, 50, 50] });
        plan.limitations.forEach((l) => addText(`  ✗ ${l}`, 10, { color: [150, 80, 80] }));
      }
      y += 10;
      if (i < PLANS.length - 1) addDivider();
    });

    // ===== Break-even =====
    ensureSpace(100);
    addText("3. Analisi di pareggio (break-even)", 14, { style: "bold", color: [20, 20, 20] });
    y += 6;

    BREAK_EVEN_SCENARIOS.forEach((s) => {
      addText(`Scenario: ${s.targetLabel} (€${s.target}/anno)`, 12, { style: "bold" });
      addText(`  • Solo Pro: ${s.proOnly} abbonati → €${s.proOnly * 99}/anno`, 11);
      addText(`  • Solo Coach: ${s.coachOnly} abbonati → €${s.coachOnly * 199}/anno`, 11);
      addText(`  • Misto (${s.mixed.pro} Pro + ${s.mixed.coach} Coach): €${s.mixedRevenue}/anno`, 11);
      y += 6;
    });

    addDivider();
    addText("4. Note e strategia", 14, { style: "bold", color: [20, 20, 20] });
    y += 4;
    addText("• Il piano Freemium serve come funnel: attira utenti senza costi e li converte verso Pro/Coach.", 11);
    addText("• Il piano Pro è il punto di equilibrio: prezzo accessibile che copre i costi con pochi abbonati.", 11);
    addText("• Il piano Coach è il margine: ogni abbonato Coach copre quasi interamente il costo annuale Builder.", 11);
    addText("• Con soli 7 abbonati Pro (oppure 4 Coach) si coprono i costi del piano Builder + store.", 11);
    addText("• Con 11 abbonati Pro (oppure 6 Coach) si passa al piano Pro di Base44 con margine.", 11);
    addText("• I prezzi possono essere registrati su Google Play e App Store Connect come abbonamenti in-app.", 11);
    y += 8;

    addText("moVeerAI — Analisi biomeccanica guidata dall'IA", 9, { color: [120, 120, 120], style: "italic" });

    const url = URL.createObjectURL(doc.output("blob"));
    const newTab = window.open(url, "_blank");
    if (!newTab) {
      doc.save("moVeerAI-Piano-Monetizzazione.pdf");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <button
      onClick={generate}
      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-5 py-3 rounded-xl transition-colors shadow-lg shadow-primary/20"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Scarica PDF offline
    </button>
  );
}