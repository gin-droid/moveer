import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    const frameGuidance = hasFrames
      ? `Sono stati estratti ${frameUrls.length} frame dal video, in ordine cronologico (coprono setup → fase eccentrica → punto di massima escursione → fase concentrica → lockout). Analizza OGNI fase separatamente valutando: allineamento articolare (caviglia/ginocchio/anca/colonna/spalla/gomito), angoli di ROM, baricentro e traiettoria del carico, controllo eccentrico, simmetria destra-sinistra, timing e respirazione. Confronta quanto osservi con il modello tecnico di riferimento.`
      : 'Nessun materiale fornito: basa l\'analisi sugli errori più comuni e frequenti per questo esercizio.';

    const prompt = `Sei un coach esperto di biomeccanica, postura e tecnica di allenamento.
Analizza l'esecuzione dell'esercizio "${exerciseName}" (macro-categoria: ${macroCategory}, sottocategoria: ${subcategory}).
${frameGuidance}${refBlock}
${notes ? `\nNote dell'utente: ${notes}` : ''}

Restituisci un report strutturato in italiano con:
- score: punteggio esecuzione 0-100 (più alto = esecuzione migliore). Calibra: 90-100 esecuzione tecnica esemplare, 75-89 buona con lievi difetti, 60-74 accettabile con difetti moderati, <60 esecuzione carente con difetti gravi.
- summary: sintesi generale (2-3 frasi) che indichi il difetto principale e il punto di forza.
- issues_detected: lista dei problemi rilevati, ognuno con title, severity (Lievo/Moderato/Grave) e description (specifica la fase del movimento e l'articolazione coinvolta).
- corrections: per ogni problema, una correzione concreta con issue, correction (cosa fare) e cue (un cue mentale breve per ricordarlo).
- corrective_exercises: esercizi specifici per correggere i difetti rilevati, ognuno con name, target (cosa allena/mobilizza), sets_reps (es. "3x10"), why (perché aiuta).
- recommendations: 3-5 raccomandazioni pratiche per migliorare nel tempo.

Sii preciso, pratico e basato sull'evidenza. Se i frame non sono interpretabili, fornisci comunque indicazioni utili sugli errori tipici di questo esercizio.`;

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
          }
        },
        required: ['score', 'summary', 'issues_detected', 'corrections', 'corrective_exercises', 'recommendations']
      }
    });

    const report = await base44.entities.AnalysisReport.create({
      exercise_name: exerciseName,
      macro_category: macroCategory,
      subcategory: subcategory,
      video_url: null,
      score: llmRes.score,
      summary: llmRes.summary,
      issues_detected: llmRes.issues_detected || [],
      corrections: llmRes.corrections || [],
      corrective_exercises: llmRes.corrective_exercises || [],
      recommendations: llmRes.recommendations || []
    });

    return Response.json({ report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}