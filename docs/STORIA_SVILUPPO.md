# moVeerAI — Cronologia dello sviluppo

Documento riassuntivo di tutti i passaggi compiuti per arrivare alla versione attuale dell'app.

---

## 1. Mission e obiettivo

**moVeerAI** (già FormPerfect/FormAI) è un'app mobile (iOS) di analisi del movimento basata sull'intelligenza artificiale.
Fornisce correzione posturale in tempo reale e feedback mirato sull'esecuzione degli esercizi.

**Obiettivi di progetto**
- Ottimizzare UX e rendering layout iOS-safe
- Mantenere una codebase snella
- Costruire un catalogo esercizi completo con nomenclatura professionale e anatomicamente accurata

---

## 2. Fondamenta dell'app

- **Stack**: React + Tailwind CSS + Vite (JSX), backend Base44 BaaS.
- **Autenticazione**: pagine boilerplate (`Login`, `Register`, `ForgotPassword`, `ResetPassword`) con Google OAuth, OTP e reset password.
- **Routing**: `src/App.jsx` con `AuthProvider`, `QueryClientProvider`, `BrowserRouter`, `ProtectedRoute` che racchiude le pagine autenticate sotto `AppLayout`.
- **Design system**: token HSL in `src/index.css` (tema dark, accento verde lime), font Oswald (display) + Inter (body), mappati in `tailwind.config.js`.

### Entità dati create
- **Exercise**: catalogo esercizi (nome, macro-categoria, sottocategoria, descrizione, gruppi muscolari, attrezzatura, difficoltà, istruzioni di setup, errori comuni, immagine, video).
- **AnalysisReport**: report di analisi generati dall'IA (esercizio, genere atleta, punteggio, sintesi, problemi rilevati, correzioni, esercizi correttivi, raccomandazioni, body_diagram con giunzioni/segmenti/stress articolare) con RLS che isola i report per utente (`created_by_id`).
- **User**: entità built-in con campo `gender` personalizzato (maschio/femmina) per la personalizzazione anatomica delle sagome.

### Funzioni backend
- **analyzeExercise**: analizza frame video estratti dall'upload e genera un report strutturato.
- **deleteOwnAccount**: cancellazione account da parte dell'utente.

---

## 3. Decisioni architetturali e di design

- **Dialog nativi custom**: adottati `AlertDialog`/`Dialog` (Radix/Shadcn) al posto di `window.alert`/`window.confirm` per coerenza visiva su iOS.
- **useAuth hook**: stato utente centralizzato per ridurre chiamate API ridondanti e flickering UI.
- **Safe-area iOS**: classi utility `pt-safe`/`pb-safe`/`pl-safe`/`pr-safe` basate su `env(safe-area-inset-*)` per notch e home indicator.
- **PullToRefresh**: componente standardizzato per le pagine a lista pesante.
- **JSX runtime automatico**: eliminazione degli `import React` espliciti (Vite).
- **Entità Exercise centralizzata**: categorizzazione per macro-categoria e sottocategoria.
- **Nomenclatura bilingue**: formato standardizzato `Nome italiano (English Standard Nomenclature)`.
- **Descrizioni tecniche**: terminologia anatomica e cue biomeccanici precisi.

---

## 4. Layout e navigazione

- **AppLayout** (`src/components/AppLayout.jsx`): shell responsive con sidebar desktop e top-bar + bottom-tab-bar mobile, gestione history, animazioni transizione via framer-motion.
- **Componenti di sistema creati**:
  - `MoreMenuSheet` — sheet per sezioni secondarie.
  - `SettingsDrawer` — profilo utente, ruolo, logout, zona "danger" con conferma email.
  - `LogoutButton` — logout con redirect.
  - `ConfirmDialog` / `InfoDialog` — wrapper standard per conferme e avvisi.
  - `DemoModal` — player video dimostrativi (YouTube/embed o HTML5).
  - `ExercisePicker` — ricerca e selezione esercizi con filtri per categoria.
  - `BottomSelectDrawer` — drawer mobile per selezioni a lista.
  - `PullToRefresh` — refresh a trascinamento per le liste.
  - `ScrollToTop` — reset scroll al cambio route.

---

## 5. Pagine principali

- **Home**: dashboard con statistiche (score medio, categorie), report recenti, CTA.
- **Exercises**: catalogo ricercabile con filtri macro/sottocategoria/difficoltà + pull-to-refresh.
- **ExerciseDetail**: dettaglio completo di un esercizio.
- **Demos**: catalogo video tutorial con ricerca, filtri e modal di riproduzione.
- **Analyze**: upload video → estrazione frame → analisi IA → report.
- **Reports**: storico report con eliminazione (optimistic UI) e pull-to-refresh.
- **ReportDetail**: dettaglio report, score ring, problemi/correzioni/correttivi, export PDF.
- **Compare**: confronto di due report dello stesso esercizio con grafico trend (recharts).
- **Users**: gestione utenti (admin).

---

## 6. Catalogo esercizi

### Fase 1 — Nomenclatura
- Standardizzazione dei nomi di tutti gli esercizi al formato bilingue `Nome italiano (English Standard Nomenclature)`.
- Aggiornamento di tutti gli esercizi di Calisthenics e non-Calisthenics.

### Fase 2 — Descrizioni tecniche
- Aggiornamento batch di 169 record esercizi con descrizioni in terminologia anatomica e biomeccanica.
- Deduplicazione degli ID durante il bulk update per evitare conflitti.

### Fase 3 — Espansione Calisthenics
- Aggiunta di 34 esercizi: propedeutiche di trazione (negative, jumping, scapolari, sospensioni attiva/passiva/flessa, typewriter), propedeutiche di spinta (wall/knee push-up, pike, pseudo planche, bench/negative dip, wall handstand, HSPU negativa), propedeutiche di core (tuck L-sit, knee raise, compressione), skill semplici (pullover, elbow lever, posa del corvo, tuck/advanced tuck planche e front/back lever, headstand, skin the cat, german hang) ed esercizi sugli anelli (support, RTO, ring dip, ring L-sit, ring pull-up).

---

## 7. Ottimizzazione dell'analisi video

Interventi sulla pipeline di analisi per renderla più efficace:

1. **Estrazione frame**: da 3 a 6 frame per catturare tutte le fasi del movimento (setup → eccentrica → fondo → concentrica → lockout).
2. **Qualità frame**: qualità JPEG aumentata da 0.72 a 0.85 per leggere meglio gli angoli articolari.
3. **Modello tecnico di riferimento**: la funzione `analyzeExercise` ora recupera il record dell'esercizio (setup, errori comuni, gruppi muscolari) e lo passa al modello come criterio di giudizio, invece di un'analisi generica.
4. **Prompt strutturato**: analisi fase-per-fase con scala di punteggio calibrata (90-100 esemplare, 75-89 buona, 60-74 accettabile, <60 carente) e descrizioni che specificano fase del movimento e articolazione coinvolta.

### Flusso tecnico dell'analisi (`src/pages/Analyze.jsx`)
1. Selezione esercizio (con preselezione via query param `?exercise=`).
2. Upload video/immagine con validazione (`videoFrames.js`: formati, dimensioni, esclusione HEIC).
3. Estrazione frame lato client via `<canvas>` con gestione robusta di seek timeout, durata Infinity, Safari/iOS detached-element.
4. Upload dei frame JPEG (piccoli) per l'analisi; upload del video originale in background (cap 50MB) senza bloccare l'analisi.
5. Invocazione della funzione backend `analyzeExercise` con i frame.
6. Salvataggio del report in `AnalysisReport` e attach del video originale se l'upload è riuscito.
7. Redirect a `/report/:id`.

---

## 8. Preferenze di progetto

- Priorità alla rimozione di codice morto e dipendenze inutilizzate in ogni refactoring.
- Modifiche minime e mirate; niente funzionalità extra non richieste.
- Preferenza per `find_replace` sulle modifiche a file esistenti.
- Componenti piccoli e focalizzati (file separati, <50 righe dove possibile).

---

## 9. Diagramma corporeo e sagome anatomiche

- **Campo gender**: aggiunto a `User` e `AnalysisReport` per personalizzare la sagoma anatomica (maschio/femmina).
- **Sagome realistiche** (`src/lib/bodySilhouette.js`): contorni corporei definiti come punti di ancoraggio (coordinate 0-100) smussati da una spline Catmull-Rom chiusa; sorgente unica per SVG (schermo) e jsPDF (export).
- **Quattro sagome**: vista frontale e laterale, ciascuna con variante maschile (spalle larghe, vita a V) e femminile (spalle strette, anche larghe, curve).
- **BodyDiagram** (`src/components/BodyDiagram.jsx`): render SVG con sagoma di sfondo a linea sottile, linee di riferimento orizzontali (spalle/bacino/ginocchia/caviglie) e asse verticale, segmenti scheletrici, gauge di stress esterni e giunzioni colorate; toggle singola vista frontale/laterale.
- **Onboarding genere**: selezione obbligatoria in `Register` per i nuovi utenti; componente `GenderOnboarding` per prompt a richiesta agli utenti esistenti; selezione persistente in `SettingsDrawer`.
- **Integrazione**: `BodyDiagram` integrato in `ReportDetail`; il campo `gender` viene propagato dal profilo utente al report durante l'analisi.

## 10. Calcolo biomeccanico dello stress articolare

- **Modulo** (`base44/functions/analyzeExercise/biomechanics.ts`): calcolo deterministico dello stress articolare a partire dalla postura osservata, in sostituzione delle stime soggettive del modello LLM.
- **Profili biomeccanici per pattern**: il motore classifica l'esercizio in uno dei pattern di movimento (squat, hinge, push, pull, lunge, overhead, core, static) e confronta la postura con l'esecuzione ottima *specifica del pattern*, non più con una generica posizione neutra in piedi.
- **Angoli ottimi per pattern**: ogni pattern definisce angoli articolari target nella fase critica (es. squat: ginocchio ~100°, anca ~90°; hinge: ginocchio ~150°, anca ~45°; push: gomito ~90°, spalla ~90°) e priorità pesate per ogni giunzione.
- **Contributi di stress**:
  - Disallineamento segmenti: ogni segmento `misaligned` collegato a una giunzione aggiunge stress.
  - Scostamento dall'angolo ottimo del pattern: deviazione angolare pesata per priorità.
  - Asimmetria (front): differenza di y tra giunzioni accoppiate (spalle, anche, ginocchia, caviglie).
  - Ginocchio valgo (front): avvicinamento delle ginocchia alla linea mediana.
  - Deviazione laterale colonna (front): head/neck lontani da x=50.
  - Stacking verticale (side): disallineamento anca-ginocchio-caviglia.
  - Antiversione bacino (side) e forward head (side).
- **Output**: stress 0-100 per ogni giunzione, clamped e arrotondato; salvato nel `body_diagram` del report e visualizzato automaticamente da schermo e PDF.

## 11. Export PDF

- **ReportPdfExport** (`src/components/ReportPdfExport.jsx`): generazione PDF via jsPDF con header, score box, mappa posturale, sintesi, problemi, correzioni, esercizi correttivi, raccomandazioni e footer numerato.
- **Mappa posturale PDF**: singolo corpo (vista frontale, fallback laterale) più grande e centrato, con sagoma a linea sottile, linee di riferimento, segmenti, gauge di stress e legenda; coerente con la visualizzazione a schermo.

## 12. Stato attuale

- App funzionante con autenticazione, catalogo esercizi esteso, analisi video IA, storico report, confronto e gestione utenti.
- Catalogo esercizi completo con nomenclatura e descrizioni professionali.
- Pipeline di analisi ottimizzata con modello tecnico di riferimento, analisi fase-per-fase e profili biomeccanici pattern-specifici.
- Sagome anatomiche realistiche gender-specific (frontale/laterale, maschile/femminile) con diagramma corporeo interattivo.
- Calcolo biomeccanico deterministico dello stress articolare basato su profili di movimento pattern-specifici, integrato nel report e nell'export PDF.
- Export PDF con mappa posturale a corpo singolo centrato.

---

## 13. Rebranding e affinamenti UX (25 agosto 2026)

- **Rebranding**: app rinominata da FormPerfect/FormAI a **moVeerAI**; nome aggiornato in sidebar desktop, top-bar mobile e documentazione (`SCHEDA_SOFTWARE.txt`).
- **Home semplificata**: rimosso lo strip "Esercizi in evidenza" e la CTA del catalogo dalla home; titolo hero aggiornato a "Allenati meglio."
- **Navigazione**: link "Esercizi" spostato dalla navigazione primaria al menu "Altro" (secondary items) per decluttering.
- **SettingsDrawer**: aggiunto pulsante indietro (ArrowLeft) nell'header con spaziatura safe-area iOS.
- **Ottimizzazioni mobile**: padding e gap ridotti per leggibilità su schermi piccoli; hero header, blocchi statistiche e liste report/utenti ottimizzati per rendering mobile-first.
- **SCHEDA_SOFTWARE.txt**: creato documento identificativo del software con descrizione, linguaggio di programmazione e dati di pubblicazione.
- **Sicurezza (RLS)**: applicate regole di row-level security alle entità `Exercise` (lettura pubblica, scrittura solo admin) e `AnalysisReport` (lettura/scrittura limitate a proprietario o admin).

---

## 14. Motore biomeccanico pattern-specifico (25 agosto 2026)

- **Classificazione del pattern**: il motore biomeccanico (`biomechanics.ts`) identifica il pattern di movimento dell'esercizio (squat, hinge, push, pull, lunge, overhead, core, static) a partire dai metadati dell'esercizio (nome, macro-categoria, sottocategoria).
- **Profili di riferimento**: ogni pattern definisce coordinate articolari ottimali, angoli target e priorità pesate per giunzione nella fase critica del movimento.
- **Calcolo dello stress pattern-specifico**: lo stress articolare è ora calcolato come deviazione dall'esecuzione ottima del pattern, non più dalla posizione neutra in piedi. Questo elimina la falsa penalizzazione di esecuzioni corrette con grande escursione articolare (es. squat profondo con ginocchia flesse ~100° non viene più considerato un errore).
- **Checkpoint tecnici nel prompt**: la funzione `analyzeExercise` recupera i checkpoint biomeccanici specifici del pattern e li passa al LLM come blocco di istruzioni, includendo angoli ottimi e checkpoint tecnici da valutare.
- **Posizionamento giunzioni LLM**: il prompt istruisce il modello di posizionare le giunzioni confrontandole con l'esecuzione ottima del pattern (non la stazione eretta), migliorando la precisione delle coordinate e quindi l'accuratezza del calcolo dello stress.
- **Calibrazione del punteggio**: il punteggio 0-100 è ora calibrato sui checkpoint del pattern: 90-100 (tutti i checkpoint rispettati, angoli entro ±5°), 75-89 (1-2 checkpoint non perfetti, ±15°), 60-74 (2-3 checkpoint violati, ±25°), <60 (più checkpoint violati, oltre ±25°).

---

*Documento aggiornato il 25 agosto 2026.*