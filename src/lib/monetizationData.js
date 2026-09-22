/**
 * Dati di monetizzazione moVeerAI — piano a 3 livelli con analisi di pareggio.
 * Usato sia dalla pagina Monetizzazione sia dal export PDF.
 */

// Costi annuali della piattaforma e degli store
export const COSTS = {
  base44_builder_annual: { label: "Base44 Builder (annuale)", value: 480, note: "Piano attuale — 250 crediti messaggio/mese" },
  base44_pro_annual: { label: "Base44 Pro (annuale)", value: 960, note: "Piano superiore — 500 crediti messaggio/mese" },
  google_play: { label: "Google Play Console", value: 25, note: "Account sviluppatore Android (una tantum, ammortizzato)" },
  apple_store: { label: "Apple Developer Program", value: 100, note: "Account sviluppatore iOS (rinnovo annuale)" },
};

export const TOTAL_BUILDER = COSTS.base44_builder_annual.value + COSTS.google_play.value + COSTS.apple_store.value; // 605
export const TOTAL_PRO = COSTS.base44_pro_annual.value + COSTS.google_play.value + COSTS.apple_store.value; // 1085

// Funzione helper: numero minimo di abbonati per pareggiare un target
export const breakEven = (annualPrice, target) => Math.ceil(target / annualPrice);

export const PLANS = [
  {
    id: "freemium",
    name: "Freemium",
    tagline: "Inizia gratis",
    priceMonthly: 0,
    priceYearly: 0,
    color: "zinc",
    accent: "bg-zinc-700",
    badge: "Gratis",
    limits: {
      users: "1 utente",
      athletes: "Nessun atleta",
      analysesPerMonth: 3,
      mentorQueriesPerMonth: 5,
    },
    features: [
      "Analisi biomeccanica di base (video/immagini)",
      "Catalogo esercizi completo (solo lettura)",
      "Report di analisi con punteggio e sintesi",
      "Diagramma posturale semplificato",
      "Storico ultimi 3 report",
    ],
    limitations: [
      "Nessun dato wearable (Bluetooth)",
      "Nessun dato profondità LiDAR/ToF",
      "Nessun export PDF dei report",
      "Nessuna gestione atleti/clienti",
      "Nessun confronto progressi nel tempo",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Per l'atleta serio",
    priceMonthly: 9.99,
    priceYearly: 99,
    color: "emerald",
    accent: "bg-emerald-500",
    badge: "Consigliato",
    limits: {
      users: "1 account + 2 atleti",
      athletes: 2,
      analysesPerMonth: 30,
      mentorQueriesPerMonth: 50,
    },
    features: [
      "Tutto il piano Freemium",
      "Dati wearable Bluetooth (frequenza cardiaca + movimento)",
      "Export PDF dei report di analisi",
      "Gestione atleti/clienti (fino a 2)",
      "Confronto progressi nel tempo",
      "Storico report illimitato",
      "Diagramma posturale avanzato con stress articolare",
      "Esercizi correttivi mirati nei report",
    ],
    limitations: [
      "Nessun dato profondità LiDAR/ToF",
      "Massimo 2 atleti gestibili",
      "Supporto standard",
    ],
  },
  {
    id: "coach",
    name: "Coach",
    tagline: "Per professionisti e team",
    priceMonthly: 19.99,
    priceYearly: 199,
    color: "amber",
    accent: "bg-amber-500",
    badge: "Massimo",
    limits: {
      users: "1 account + atleti illimitati",
      athletes: Infinity,
      analysesPerMonth: "Illimitate",
      mentorQueriesPerMonth: "Illimitate",
    },
    features: [
      "Tutto il piano Pro",
      "Dati profondità LiDAR/ToF (angoli 3D reali)",
      "Atleti/clienti illimitati",
      "Analisi illimitate al mese",
      "Interrogazioni Mentore illimitate",
      "Creazione utenti secondari (team/staff)",
      "Gestione team e report condivisi",
      "Supporto prioritario",
      "Accesso anticipato alle nuove funzioni",
    ],
    limitations: [],
  },
];

// Scenari di pareggio
export const BREAK_EVEN_SCENARIOS = [
  {
    target: TOTAL_BUILDER,
    targetLabel: "Builder + Store (minimo)",
    proOnly: breakEven(99, TOTAL_BUILDER),
    coachOnly: breakEven(199, TOTAL_BUILDER),
    mixed: { pro: 3, coach: 2 },
    mixedRevenue: 3 * 99 + 2 * 199,
  },
  {
    target: TOTAL_PRO,
    targetLabel: "Pro + Store (massimo)",
    proOnly: breakEven(99, TOTAL_PRO),
    coachOnly: breakEven(199, TOTAL_PRO),
    mixed: { pro: 6, coach: 3 },
    mixedRevenue: 6 * 99 + 3 * 199,
  },
];