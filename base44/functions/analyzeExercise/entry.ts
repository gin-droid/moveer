import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeJointStress, classifyPattern, getPatternCheckpoints } from './biomechanics.ts';
import { summarizeDepthAngles, type DepthData } from './depth3d.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const exerciseName = (body.exerciseName || '').trim();
    const macroCategory = (body.macroCategory || '').trim();
    const subcategory = (body.subcategory || '').trim();
    const frameUrls: string[] = Array.isArray(body.frameUrls) ? body.frameUrls.filter(Boolean) : [];
    const notes = (body.notes || '').trim();
    const depthData: DepthData | null = body.depthData && Array.isArray(body.depthData.frames) && body.depthData.frames.length > 0
      ? body.depthData
      : null;
    const wearableData: any = body.wearableData || null;
    const athleteId: string = (body.athleteId || '').trim();

    // Quando sono disponibili dati di profondità (LiDAR/ToF), calcola angoli
    // articolari 3D reali per un'analisi più precisa.
    const depthSummary = depthData ? summarizeDepthAngles(depthData) : '';
    const depthBlock = depthSummary
      ? `\n\n${depthSummary}\nUsa questi angoli MISURATI come riferimento primario per giudicare l'esecuzione e per posizionare le giunzioni del body_diagram. Se un angolo misurato differisce da quanto sembri vedere nel frame RGB, fidati del dato misurato (più preciso).`
      : '';

    // Riepilogo dati wearable (frequenza cardiaca + movimento) per arricchire
    // l'analisi con segnali fisiologici e cinematici reali.
    const wearableBlock = wearableData
      ? `\n\nDATI WEARABLE MISURATI (dispositivo: ${wearableData.device_type || 'n/d'}):${
          wearableData.heart_rate
            ? `\n- Frequenza cardiaca: media ${wearableData.heart_rate.avg} bpm (min ${wearableData.heart_rate.min}, max ${wearableData.heart_rate.max}), ${wearableData.heart_rate.samples_count} campioni.`
            : ''
        }${
          wearableData.motion
            ? `\n- Movimento: accelerazione media ${wearableData.motion.avg_accel} m/s² (picco ${wearableData.motion.peak_accel} m/s²), rotazione media ${wearableData.motion.avg_rot} °/s, cadenza stimata ${wearableData.motion.cadence} rip/min, durata ${wearableData.motion.duration_s}s.`
            : ''
        }\nUsa questi dati per valutare l'intensità dello sforzo, la stabilità del ritmo e la coerenza tra cadenza e controllo tecnico. Una frequenza cardiaca molto alta o un'accelerazione irregolare possono indicare compensazione o affaticamento.`
      : '';

    if (!exerciseName) {
      return Response.json({ error: 'Nome esercizio obbligatorio' }, { status: 400 });
    }

    const hasFrames = frameUrls.length > 0;

    // Fetch the reference technique model for this exercise to ground the analysis
    // in the correct biomechanical checkpoints rather than generic advice.
    let reference: any = null;
    try {
      const matches = await base44.entities.Exercise.filter({ name: exerciseName }, '-created_date', 1);
      reference = Array.isArray(matches) && matches.length ? matches[0] : null;
    } catch (e) {
      /* non-blocking: fall back to generic analysis */
    }

    const refBlock = reference
      ? `

MODELLO TECNICO DI RIFERIMENTO (usa questi criteri per giudicare l'esecuzione):
- Gruppi muscolari target: ${(reference.muscle_groups || []).join(', ') || 'n/d'}
- Setup corretto: ${reference.setup_instructions || 'n/d'}
- Errori comuni da sorvegliare: ${(reference.common_mistakes || []).join('; ') || 'n/d'}
- Difficoltà attesa: ${reference.difficulty || 'n/d'}`
      : '';

    // Pattern di movimento e checkpoint biomeccanici specifici dell'esercizio
    const cp = getPatternCheckpoints(exerciseName, macroCategory, subcategory);
    const checkpointBlock = `
PROFILO BIOMECCANICO DELL'ESERCIZIO (pattern: ${cp.pattern.toUpperCase()})
${cp.description}
ANGOLI ARTICOLARI OTTIMI nella fase critica (usali come riferimento per posizionare le giunzioni):
- Flessione ginocchio: ${cp.optimalAngles.kneeFlex}° (180 = esteso)
- Flessione anca: ${cp.optimalAngles.hipFlex}° (180 = esteso)
- Inclinazione tronco da verticale: ${cp.optimalAngles.trunkLean}°
- Flessione gomito: ${cp.optimalAngles.elbowFlex}° (180 = esteso)
- Flessione spalla: ${cp.optimalAngles.shoulderFlex}° (180 = braccio lungo il corpo)
CHECKPOINT TECNICI DA VALUTARE:
${cp.keyCheckpoints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    const frameGuidance = hasFrames
      ? `Sono stati estratti ${frameUrls.length} frame dal video, in ordine cronologico (coprono setup → fase eccentrica → punto di massima escursione → fase concentrica → lockout). Analizza OGNI fase separatamente valutando: allineamento articolare (caviglia/ginocchio/anca/colonna/spalla/gomito), angoli di ROM, baricentro e traiettoria del carico, controllo eccentrico, simmetria destra-sinistra, timing e respirazione. Confronta quanto osservi con il modello tecnico di riferimento. Per il body_diagram, POSIZIONA le giunzioni per riflettere la postura osservata NELLA FASE PIÙ CRITICA del movimento (tipicamente il punto di massima escursione o dove si rileva il difetto principale): misura con precisione gli angoli articolari reali (flessione ginocchio, inclinazione tronco, Q-angle, antiversione bacino) e traducili in coordinate normalizzate. Se il ginocchio è valgo, avvicina le knee alla linea mediana; se il tronco si inclina in avanti, sposta shoulder e hip in avanti nella vista laterale; se c'è antiversione del bacino, sposta l'hip in avanti; se c'è forward head, sposta la head in avanti. Più le posizioni sono precise e fedeli alla postura reale, più lo stress articolare calcolato sarà accurato.`
      : 'Nessun materiale fornito: basa l\'analisi sugli errori più comuni e frequenti per questo esercizio. Per il body_diagram, posiziona le giunzioni per riflettere la postura tipica di chi commette gli errori più probabili per questo esercizio.';

    const diagramBlock = `

Genera anche un body_diagram: rappresentazione scheletrica del corpo in DUE viste (front e side) che sintetizza visivamente la postura osservata nella fase più critica del movimento.
Per ogni vista fornisci:
- joints: lista di giunzioni articolari. Vista FRONTALE usa id: head, neck, shoulder_l, shoulder_r, elbow_l, elbow_r, wrist_l, wrist_r, hip_l, hip_r, knee_l, knee_r, ankle_l, ankle_r. Vista LATERALE usa id: head, neck, shoulder, elbow, wrist, hip, knee, ankle. Per ognuna: label (nome italiano), x e y (coordinate normalizzate 0-100, dove 0,0 è in alto a sinistra e 100,100 in basso a destra), stress (valore iniziale 0 — lo stress articolare è calcolato deterministicamente dal motore biomeccanico in base alle posizioni reali, non va stimato soggettivamente). POSIZIONA le giunzioni con la MASSIMA PRECISIONE per riflettere la postura reale osservata nella fase critica del movimento. IMPORTANTE: usa come riferimento di esecuzione OTTIMA gli ANGOLI OTTIMI del pattern indicato sopra (non la posizione neutra in piedi). Ad esempio, per uno squat corretto il ginocchio è flesso ~90-110° (non esteso), quindi nella vista laterale knee è molto più in alto rispetto alla anca; questo NON è un errore. Lo stress viene calcolato come deviazione dall'angolo ottimo del pattern, non dalla posizione neutra. Misura gli angoli articolari reali e traducili in coordinate. Esempi: ginocchio valgo → knee_l.x > 46 e knee_r.x < 54 (avvicinate alla linea mediana); tronco inclinato in avanti → shoulder.x e hip.x più vicini nella vista laterale; antiversione bacino → hip.x > 46 nella vista laterale; forward head → head.x > 44; spalle asimmetriche → shoulder_l.y ≠ shoulder_r.y; anche non orizzontali → hip_l.y ≠ hip_r.y; colonna non verticale → head.x e neck.x lontani da 50 nella vista frontale. La precisione delle posizioni determina l'accuratezza dell'analisi biomeccanica.
- segments: collegamenti tra giunzioni (from id, to id). Imposta misaligned=true per i segmenti che presentano disallineamento rispetto alla posizione neutra (es. linea delle anche non orizzontale, linea delle spalle inclinata, ginocchia non allineati alle anche, colonna non verticale, tronco inclinato). I segmenti del tronco vanno: neck→head, neck→shoulder_l/r, shoulder_l→shoulder_r, shoulder_l/r→elbow_l/r, elbow_l/r→wrist_l/r, shoulder_l/r→hip_l/r, hip_l→hip_r, hip_l/r→knee_l/r, knee_l/r→ankle_l/r. Vista laterale: head→neck, neck→shoulder, shoulder→elbow, elbow→wrist, shoulder→hip, hip→knee, knee→ankle.`;

    const prompt = `Sei un coach esperto di biomeccanica, postura e tecnica di allenamento.
Analizza l'esecuzione dell'esercizio "${exerciseName}" (macro-categoria: ${macroCategory}, sottocategoria: ${subcategory}).
${frameGuidance}${refBlock}${checkpointBlock}${diagramBlock}${depthBlock}${wearableBlock}
    ${notes ? `\nNote dell'utente: ${notes}` : ''}

Restituisci un report strutturato in italiano con:
- score: punteggio esecuzione 0-100 (più alto = esecuzione migliore). Calibra confrontando l'esecuzione osservata con gli ANGOLI OTTIMI e i CHECKPOINT del pattern indicato sopra: 90-100 esecuzione tecnica esemplare (tutti i checkpoint rispettati, angoli entro ±5° dagli ottimi), 75-89 buona con lievi difetti (1-2 checkpoint non perfetti, angoli entro ±15°), 60-74 accettabile con difetti moderati (2-3 checkpoint violati, angoli entro ±25°), <60 esecuzione carente con difetti gravi (più checkpoint violati, angoli oltre ±25°).
- summary: sintesi generale (2-3 frasi) che indichi il difetto principale e il punto di forza.
- issues_detected: lista dei problemi rilevati, ognuno con title, severity (Lievo/Moderato/Grave) e description (specifica la fase del movimento e l'articolazione coinvolta).
- corrections: per ogni problema, una correzione concreta con issue, correction (cosa fare) e cue (un cue mentale breve per ricordarlo).
- corrective_exercises: esercizi specifici per correggere i difetti rilevati, ognuno con name, target (cosa allena/mobilizza), sets_reps (es. "3x10"), why (perché aiuta).
- recommendations: 3-5 raccomandazioni pratiche per migliorare nel tempo.
- body_diagram: come specificato sopra.

Sii preciso, pratico e basato sull'evidenza. Se i frame non sono interpretabili, fornisci comunque indicazioni utili sugli errori tipici di questo esercizio e genera un body_diagram coerente con i difetti più probabili.`;

    // Use extracted frames (images) for LLM vision — video files are not supported by vision models.
    const fileUrls = hasFrames ? frameUrls : null;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: fileUrls,
      response_json_schema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          summary: { type: 'string' },
          issues_detected: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                severity: { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          corrections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                issue: { type: 'string' },
                correction: { type: 'string' },
                cue: { type: 'string' }
              }
            }
          },
          corrective_exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                target: { type: 'string' },
                sets_reps: { type: 'string' },
                why: { type: 'string' }
              }
            }
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' }
          },
          body_diagram: {
            type: 'object',
            properties: {
              front: {
                type: 'object',
                properties: {
                  joints: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        stress: { type: 'number' }
                      }
                    }
                  },
                  segments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        from: { type: 'string' },
                        to: { type: 'string' },
                        misaligned: { type: 'boolean' }
                      }
                    }
                  }
                }
              },
              side: {
                type: 'object',
                properties: {
                  joints: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        stress: { type: 'number' }
                      }
                    }
                  },
                  segments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        from: { type: 'string' },
                        to: { type: 'string' },
                        misaligned: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        required: ['score', 'summary', 'issues_detected', 'corrections', 'corrective_exercises', 'recommendations', 'body_diagram']
      }
    });

    const report = await base44.entities.AnalysisReport.create({
      exercise_name: exerciseName,
      macro_category: macroCategory,
      subcategory: subcategory,
      athlete_id: athleteId || null,
      video_url: null,
      gender: user.gender || "maschio",
      score: llmRes.score,
      summary: llmRes.summary,
      issues_detected: llmRes.issues_detected || [],
      corrections: llmRes.corrections || [],
      corrective_exercises: llmRes.corrective_exercises || [],
      recommendations: llmRes.recommendations || [],
      body_diagram: computeJointStress(llmRes.body_diagram, exerciseName, macroCategory, subcategory) || null,
      depth_metadata: depthData ? {
        sensor_type: depthData.sensorType,
        frame_count: depthData.frames.length,
        accuracy: depthData.sensorType === "lidar" ? "alta" : "media",
      } : null,
      wearable_data: wearableData || null
    });

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}