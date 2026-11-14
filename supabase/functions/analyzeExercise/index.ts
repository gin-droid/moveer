import { adminClient, authenticate, consumeQuota, enforceRateLimit, fetchWithTimeout, generateGeminiText, handle, HttpError, isUuid, json, parseGeminiJson, readJson } from '../_shared/runtime.ts';
import { computeJointStress, getPatternCheckpoints } from '../_shared/biomechanics.ts';
import { analyzeDepthData, projectDepthFrameToBodyDiagram, summarizeDepthAngles, type DepthData } from '../_shared/depth3d.ts';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

const viewResponseSchema = {
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
        },
        required: ['id', 'x', 'y'],
      },
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          misaligned: { type: 'boolean' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['joints', 'segments'],
};

const responseSchema = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    summary: { type: 'string' },
    issues_detected: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['Lievo', 'Moderato', 'Grave'] },
          description: { type: 'string' },
        },
        required: ['title', 'severity', 'description'],
        additionalProperties: false,
      },
    },
    corrections: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          correction: { type: 'string' },
          cue: { type: 'string' },
        },
        required: ['issue', 'correction', 'cue'],
        additionalProperties: false,
      },
    },
    corrective_exercises: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          target: { type: 'string' },
          sets_reps: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['name', 'target', 'sets_reps', 'why'],
        additionalProperties: false,
      },
    },
    recommendations: { type: 'array', items: { type: 'string' } },
    body_diagram: {
      type: 'object',
      properties: {
        front: viewResponseSchema,
        side: viewResponseSchema,
      },
      required: ['front', 'side'],
    },
  },
  required: [
    'score',
    'summary',
    'issues_detected',
    'corrections',
    'corrective_exercises',
    'recommendations',
    'body_diagram',
  ],
};

Deno.serve(handle('analyzeExercise', async (req) => {
  const auth = await authenticate(req);
  if (!auth) throw new HttpError(401, 'Accesso richiesto');
  await enforceRateLimit(`analyzeExercise:${auth.user.id}`, 10, 10 * 60);

  let quotaConsumed = false;
  try {
    const body = await readJson(req);
    const cleanLabel = (value: unknown, maxLength: number) => String(value || '')
      .replace(/[\x00-\x1f\x7f`]/g, '').trim().slice(0, maxLength);
    const exerciseName = cleanLabel(body.exerciseName, 160);
    const macroCategory = cleanLabel(body.macroCategory, 80);
    const subcategory = cleanLabel(body.subcategory, 80);
    const notes = String(body.notes || '').trim().slice(0, 2000);
    const frameUrls: string[] = Array.isArray(body.frameUrls) ? body.frameUrls.filter(Boolean).slice(0, 6) : [];
    const depthInput = body.depthData && typeof body.depthData === 'object' && !Array.isArray(body.depthData)
      ? body.depthData as Record<string, unknown>
      : null;
    const depthFrames = Array.isArray(depthInput?.frames) ? depthInput.frames : [];
    const depthData: DepthData | null = depthFrames.length
      ? { ...depthInput, frames: depthFrames.slice(0, 900) } as unknown as DepthData
      : null;
    const wearableData = body.wearableData || null;
    if (wearableData && new TextEncoder().encode(JSON.stringify(wearableData)).byteLength > 20_000) {
      throw new HttpError(400, 'I dati wearable superano il limite consentito');
    }
    const athleteId = String(body.athleteId || '').trim();

    if (!exerciseName) throw new HttpError(400, 'Nome esercizio obbligatorio');
    if (athleteId && !isUuid(athleteId)) throw new HttpError(400, 'Identificativo atleta non valido');

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
Genera un report JSON in italiano: score intero 0-100, summary di 2-3 frasi, issues_detected (title, severity Lievo/Moderato/Grave, description), corrections (issue, correction, cue), corrective_exercises (name, target, sets_reps, why), recommendations (3-5 stringhe) e body_diagram front/side. Valuta esplicitamente ciascun checkpoint e indica i difetti tecnici effettivamente visibili, specificando fase e articolazione. Per ogni difetto rilevato fornisci almeno una correzione concreta e un esercizio correttivo pertinente; non restituire oggetti vuoti. Se non osservi difetti chiari, non inventarli: spiega il limite nella summary e lascia vuote le sole liste che non hanno elementi pertinenti.
Ogni vista del body_diagram include joints (id, label, x, y) e segments (from, to, misaligned). Coordinate normalizzate 0-100. Usa soltanto giunzioni coerenti con l'anatomia e con i frame. Se i frame non sono leggibili, dichiara il limite nella sintesi e non inventare osservazioni certe. Questo report non sostituisce una valutazione clinica.`;

    const imageParts = [];
    const appOrigin = new URL(Deno.env.get('SUPABASE_URL')!).origin;
    for (const frameUrl of frameUrls) {
      const parsedUrl = new URL(frameUrl);
      if (parsedUrl.origin !== appOrigin || !parsedUrl.pathname.includes('/storage/v1/object/sign/analysis-media/')) {
        return json({ error: 'URL frame non valido' }, 400);
      }
      const response = await fetchWithTimeout(parsedUrl, { redirect: 'error' }, 20_000);
      if (!response.ok) throw new Error('Impossibile leggere un frame caricato');
      const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(contentType)) {
        throw new HttpError(400, 'Formato frame non supportato');
      }
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > 8 * 1024 * 1024) throw new HttpError(413, 'Un frame supera il limite di 8 MB');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) throw new HttpError(413, 'Un frame supera il limite di 8 MB');
      imageParts.push({ inlineData: { mimeType: contentType, data: toBase64(bytes) } });
    }

    const quota = await consumeQuota(auth.client, 'analysis');
    if (quota.blocked) return json({ error: 'Account bloccato' }, 403);
    if (!quota.allowed) {
      return json({ error: 'Limite mensile di analisi raggiunto', code: 'quota_exceeded', used: quota.used, limit: quota.limit }, 429);
    }
    quotaConsumed = true;

    const generated = await generateGeminiText(
      [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
      undefined,
      true,
      responseSchema,
    );
    const analysis = parseGeminiJson(generated);
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      throw new HttpError(502, 'Risposta non valida dal motore di analisi.');
    }
    const diagram = analysis.body_diagram;
    const isValidView = (view: unknown): view is { joints: Array<{ id: string; x: number; y: number }>; segments: unknown[] } => {
      if (!view || typeof view !== 'object') return false;
      const candidate = view as { joints?: unknown; segments?: unknown };
      return Array.isArray(candidate.joints) && candidate.joints.length > 0 &&
        candidate.joints.every((joint) =>
          typeof joint === 'object' && joint !== null && !Array.isArray(joint) &&
          'id' in joint && typeof joint.id === 'string' &&
          'x' in joint && typeof joint.x === 'number' && Number.isFinite(joint.x) &&
          'y' in joint && typeof joint.y === 'number' && Number.isFinite(joint.y)
        ) &&
        Array.isArray(candidate.segments);
    };
    if (!Number.isFinite(Number(analysis.score)) || typeof analysis.summary !== 'string' || !analysis.summary ||
      !diagram || !isValidView(diagram.front) || !isValidView(diagram.side)) {
      throw new HttpError(502, 'Analisi biomeccanica incompleta: impossibile calcolare lo stress articolare.');
    }
    const hasRequiredText = (value: unknown, fields: string[]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      return fields.every((field) => typeof record[field] === 'string' && record[field].trim().length > 0);
    };
    const validIssues = Array.isArray(analysis.issues_detected) &&
      analysis.issues_detected.every((issue: unknown) => {
        if (!hasRequiredText(issue, ['title', 'severity', 'description'])) return false;
        const severity = (issue as Record<string, unknown>).severity;
        return typeof severity === 'string' && ['Lievo', 'Moderato', 'Grave'].includes(severity);
      });
    const validCorrections = Array.isArray(analysis.corrections) &&
      analysis.corrections.every((correction: unknown) =>
        hasRequiredText(correction, ['issue', 'correction', 'cue'])
      );
    const validCorrectiveExercises = Array.isArray(analysis.corrective_exercises) &&
      analysis.corrective_exercises.every((exercise: unknown) =>
        hasRequiredText(exercise, ['name', 'target', 'sets_reps', 'why'])
      );
    if (!validIssues || !validCorrections || !validCorrectiveExercises ||
      (analysis.issues_detected.length > 0 &&
        (!analysis.corrections.length || !analysis.corrective_exercises.length))) {
      throw new HttpError(502, 'Report incompleto: problemi, correzioni o esercizi correttivi non validi.');
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
      issues_detected: Array.isArray(analysis.issues_detected) ? analysis.issues_detected.slice(0, 20) : [],
      corrections: Array.isArray(analysis.corrections) ? analysis.corrections.slice(0, 20) : [],
      corrective_exercises: Array.isArray(analysis.corrective_exercises) ? analysis.corrective_exercises.slice(0, 10) : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations.slice(0, 10) : [],
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

    const { data: report, error } = await adminClient.from('analysis_reports')
      .insert(reportPayload).select('*').single();
    if (error) throw error;
    return json({ report: { ...report, created_date: report.created_at, created_by_id: report.user_id } });
  } catch (error) {
    if (quotaConsumed) {
      const { error: releaseError } = await adminClient.rpc('release_monthly_quota_for_user', {
        p_user_id: auth.user.id,
        p_kind: 'analysis',
      });
      if (releaseError) console.error('analyzeExercise quota release:', releaseError);
    }
    throw error;
  }
}));