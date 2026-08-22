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

    const prompt = `Sei un coach esperto di biomeccanica, postura e tecnica di allenamento.
Analizza l'esecuzione dell'esercizio "${exerciseName}" (macro-categoria: ${macroCategory}, sottocategoria: ${subcategory}).
${hasFrames
  ? `Sono stati estratti ${frameUrls.length} frame dal video dell'esecuzione dell'utente. Analizza attentamente postura, allineamento, ROM, controllo, simmetria e timing osservando i frame forniti (rappresentano momenti successivi del movimento).`
  : 'Nessun materiale fornito: basa l\'analisi sugli errori più comuni e frequenti per questo esercizio.'}
${notes ? `\nNote dell'utente: ${notes}` : ''}

Restituisci un report strutturato in italiano con:
- score: punteggio esecuzione 0-100 (più alto = esecuzione migliore)
- summary: sintesi generale (2-3 frasi)
- issues_detected: lista dei problemi rilevati (postura, allineamento, ROM, controllo, respirazione, simmetria), ognuno con title, severity (Lievo/Moderato/Grave) e description
- corrections: per ogni problema, una correzione concreta con issue, correction (cosa fare) e cue (un cue mentale breve per ricordarlo)
- corrective_exercises: esercizi specifici per correggere le posture/errore rilevati, ognuno con name, target (cosa allena/mobilizza), sets_reps (es. "3x10"), why (perché aiuta)
- recommendations: 3-5 raccomandazioni pratiche per migliorare nel tempo

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