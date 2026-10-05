import { authenticate, consumeQuota, generateGeminiText, json, parseGeminiJson } from '../_shared/runtime.ts';
import { computeJointStress, getPatternCheckpoints } from '../_shared/biomechanics.ts';
import { analyzeDepthData, projectDepthFrameToBodyDiagram, summarizeDepthAngles } from '../_shared/depth3d.ts';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let quotaConsumed = false;
  try {
    const body = await req.json();
    const exerciseName = String(body.exerciseName || '').trim();
    const macroCategory = String(body.macroCategory || '').trim();
    const subcategory = String(body.subcategory || '').trim();
    const notes = String(body.notes || '').trim().slice(0, 2000);
    const frameUrls: string[] = Array.isArray(body.frameUrls) ? body.frameUrls.filter(Boolean).slice(0, 6) : [];
    const depthData = body.depthData?.frames?.length ? body.depthData : null;
    const wearableData = body.wearableData || null;
    const athleteId = String(body.athleteId || '').trim();

    if (!exerciseName) return json({ error: 'Nome esercizio obbligatorio' }, 400);

    if (athleteId) {
      const { data: athlete, error } = await auth.client.from('athletes')
        .select('id').eq('id', athleteId).maybeSingle();
      if (error) throw error;
      if (!athlete) return json({ error: 'Atleta non trovato' }, 404);
    }

    const [{ data: reference }, { data: profile }] = await Promise.all([
      auth.client.from('exercises').select('muscle_groups, setup_instructions, common_mistakes, difficulty')
        .eq('name', exerciseName).limit(1).maybeSingle(),
      auth.client.from('profiles').select('gender').eq('id', auth.user.id).maybeSingle(),
    ]);

    const checkpoints = getPatternCheckpoints(exerciseName, macroCategory, subcategory);
    const depthAnalysis = depthData ? analyzeDepthData(depthData) : null;
    const depthSummary = depthData ? summarizeDepthAngles(depthData) : '';
    const depthPoints = depthAnalysis?.keyFrames.map((frame) => ({
      timestamp: frame.timestamp,
      angles: frame.angles,
      joints3D: frame.joints3D,
    })) || [];
    const prompt = `Sei un coach esperto di biomeccanica e tecnica sportiva. Analizza l'esercizio "${exerciseName}" (${macroCategory}, ${subcategory}). Valuta la tecnica osservata nei frame allegati e confrontala con il profilo del movimento.
Pattern ${checkpoints.pattern}: ${checkpoints.description}
Angoli ottimali: ${JSON.stringify(checkpoints.optimalAngles)}
Checkpoint: ${checkpoints.keyCheckpoints.join('; ')}
${reference ? `Modello esercizio: muscoli ${(reference.muscle_groups || []).join(', ')}; setup ${reference.setup_instructions || 'n/d'}; errori comuni ${(reference.common_mistakes || []).join('; ')}; difficoltà ${reference.difficulty || 'n/d'}.` : ''}
${depthSummary ? `Dati LiDAR/ToF misurati: ${depthSummary}. Dai priorità a questi dati.` : ''}
${depthPoints.length ? `PUNTI ARTICOLARI 3D MISURATI (metri, origine al bacino; proiezione frontale x/y e laterale z/y). Usa questi punti dei frame chiave per posizionare le giunzioni del diagramma e considera gli angoli misurati come riferimento, non come stime: ${JSON.stringify(depthPoints)}` : ''}
${wearableData ? `Dati wearable misurati: ${JSON.stringify(wearableData)}. Usali solo per contestualizzare intensità e stabilità.` : ''}
${notes ? `Note dell'utente: ${notes}` : ''}
Genera un JSON in italiano con score intero 0-100, summary (2-3 frasi), issues_detected (title, severity Lievo/Moderato/Grave, description), corrections (issue, correction, cue), corrective_exercises (name, target, sets_reps, why), recommendations (3-5 stringhe) e body_diagram con viste front e side. Ogni vista include joints (id, label, x, y) e segments (from, to, misaligned). Coordinate normalizzate 0-100. Usa soltanto giunzioni coerenti con l'anatomia e con i frame. Se i frame non sono leggibili, dichiara il limite nella sintesi e non inventare osservazioni certe. Questo report non sostituisce una valutazione clinica.`;

    const imageParts = [];
    const appOrigin = new URL(Deno.env.get('SUPABASE_URL')!).origin;
    for (const frameUrl of frameUrls) {
      const parsedUrl = new URL(frameUrl);
      if (parsedUrl.origin !== appOrigin || !parsedUrl.pathname.includes('/storage/v1/object/sign/analysis-media/')) {
        return json({ error: 'URL frame non valido' }, 400);
      }
      const response = await fetch(parsedUrl);
      if (!response.ok) throw new Error('Impossibile leggere un frame caricato');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) return json({ error: 'I frame devono essere immagini' }, 400);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) return json({ error: 'Un frame supera il limite di 8 MB' }, 413);
      imageParts.push({ inlineData: { mimeType: contentType, data: toBase64(bytes) } });
    }

    const quota = await consumeQuota(auth.client, 'analysis');
    if (quota.blocked) return json({ error: 'Account bloccato' }, 403);
    if (!quota.allowed) {
      return json({ error: 'Limite mensile di analisi raggiunto', code: 'quota_exceeded', used: quota.used, limit: quota.limit }, 429);
    }
    quotaConsumed = true;

    const generated = await generateGeminiText([{ role: 'user', parts: [{ text: prompt }, ...imageParts] }]);
    const analysis = parseGeminiJson(generated);
    if (!Number.isFinite(Number(analysis.score)) || !analysis.summary) {
      throw new Error('Risposta Gemini incompleta');
    }

    type DepthKeyFrame = NonNullable<typeof depthAnalysis>['keyFrames'][number];
    const criticalDepthFrame = depthAnalysis?.keyFrames.reduce<{
      frame: DepthKeyFrame;
      deviation: number;
    } | null>((best, candidate) => {
      const pairs = [
        [candidate.angles.kneeAngleDeg, checkpoints.optimalAngles.kneeFlex],
        [candidate.angles.hipAngleDeg, checkpoints.optimalAngles.hipFlex],
        [candidate.angles.elbowAngleDeg, checkpoints.optimalAngles.elbowFlex],
        [candidate.angles.shoulderAngleDeg, checkpoints.optimalAngles.shoulderFlex],
        [candidate.angles.trunkLeanDeg, checkpoints.optimalAngles.trunkLean],
      ].filter(([actual, target]) => actual != null && target != null);
      const deviation = pairs.length
        ? pairs.reduce((sum, [actual, target]) => sum + Math.abs(Number(actual) - Number(target)), 0) / pairs.length
        : -1;
      return !best || deviation > best.deviation ? { frame: candidate, deviation } : best;
    }, null)?.frame;
    const measuredDiagram = criticalDepthFrame
      ? projectDepthFrameToBodyDiagram(criticalDepthFrame, analysis.body_diagram)
      : analysis.body_diagram;

    const reportPayload = {
      user_id: auth.user.id,
      athlete_id: athleteId || null,
      exercise_name: exerciseName,
      macro_category: macroCategory,
      subcategory,
      gender: profile?.gender || 'maschio',
      score: Math.max(0, Math.min(100, Number(analysis.score))),
      summary: String(analysis.summary).slice(0, 3000),
      issues_detected: Array.isArray(analysis.issues_detected) ? analysis.issues_detected : [],
      corrections: Array.isArray(analysis.corrections) ? analysis.corrections : [],
      corrective_exercises: Array.isArray(analysis.corrective_exercises) ? analysis.corrective_exercises : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      body_diagram: computeJointStress(measuredDiagram, exerciseName, macroCategory, subcategory) || null,
      depth_analysis: depthAnalysis,
      depth_metadata: depthData ? {
        sensor_type: depthData.sensorType,
        frame_count: depthData.frames.length,
        valid_frame_count: depthAnalysis?.validFrameCount || 0,
        joint_count: depthAnalysis?.maxJointCount || 0,
        mean_confidence: depthAnalysis?.meanConfidence,
        coordinate_system: depthAnalysis?.coordinateSystem,
        units: depthAnalysis?.units,
        accuracy: depthData.sensorType === 'lidar' && (depthAnalysis?.meanConfidence || 0) >= 0.7 ? 'alta' : 'media',
      } : null,
      wearable_data: wearableData,
    };

    const { data: report, error } = await auth.client.from('analysis_reports')
      .insert(reportPayload).select('*').single();
    if (error) throw error;
    return json({ report: { ...report, created_date: report.created_at, created_by_id: report.user_id } });
  } catch (error) {
    if (quotaConsumed) await auth.client.rpc('release_monthly_quota', { p_kind: 'analysis' });
    console.error('analyzeExercise:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore durante l’analisi' }, 500);
  }
});