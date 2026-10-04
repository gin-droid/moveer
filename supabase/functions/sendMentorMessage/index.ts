import { authenticate, consumeQuota, generateGeminiText, json } from '../_shared/runtime.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const auth = await authenticate(req);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let quotaConsumed = false;
  let userMessageId: string | null = null;
  try {
    const body = await req.json();
    const conversationId = String(body.conversationId || '').trim();
    const text = String(body.text || '').trim().slice(0, 4000);
    if (!conversationId || !text) return json({ error: 'conversationId e text sono obbligatori' }, 400);

    const { data: conversation, error: conversationError } = await auth.client
      .from('mentor_conversations').select('id').eq('id', conversationId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return json({ error: 'Conversazione non trovata' }, 404);

    const quota = await consumeQuota(auth.client, 'mentor');
    if (quota.blocked) return json({ error: 'Account bloccato' }, 403);
    if (!quota.allowed) {
      return json({ allowed: false, used: quota.used, limit: quota.limit, plan: quota.plan }, 429);
    }
    quotaConsumed = true;

    const { data: userMessage, error: insertError } = await auth.client.from('mentor_messages')
      .insert({ conversation_id: conversationId, role: 'user', content: text })
      .select('id').single();
    if (insertError) throw insertError;
    userMessageId = userMessage.id;

    const [{ data: history, error: historyError }, { data: exercises }, { data: reports }] = await Promise.all([
      auth.client.from('mentor_messages').select('role, content').eq('conversation_id', conversationId)
        .order('created_at', { ascending: false }).limit(20),
      auth.client.from('exercises').select('name, macro_category, subcategory, setup_instructions').limit(40),
      auth.client.from('analysis_reports').select('exercise_name, score, summary, issues_detected')
        .order('created_at', { ascending: false }).limit(5),
    ]);
    if (historyError) throw historyError;

    const systemInstruction = `Sei moVeerAI Mentor, un coach esperto di esercizio fisico e biomeccanica. Rispondi in italiano, in modo pratico e conciso. Non formulare diagnosi mediche e invita a consultare un professionista in caso di dolore o infortunio. Personalizza usando il catalogo e i report recenti dell'utente quando pertinenti.
Catalogo disponibile: ${JSON.stringify(exercises || [])}
Report recenti dell'utente: ${JSON.stringify(reports || [])}`;
    const contents = (history || []).reverse().map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const answer = await generateGeminiText(contents, systemInstruction, false);

    const { error: answerError } = await auth.client.from('mentor_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: answer.slice(0, 12000),
    });
    if (answerError) throw answerError;
    await auth.client.from('mentor_conversations').update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return json({ allowed: true, used: quota.used, limit: quota.limit, plan: quota.plan });
  } catch (error) {
    if (userMessageId) await auth.client.from('mentor_messages').delete().eq('id', userMessageId);
    if (quotaConsumed) await auth.client.rpc('release_monthly_quota', { p_kind: 'mentor' });
    console.error('sendMentorMessage:', error);
    return json({ error: error instanceof Error ? error.message : 'Errore del mentore' }, 500);
  }
});