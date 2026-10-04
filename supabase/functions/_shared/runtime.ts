import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function authenticate(req: Request): Promise<{
  client: SupabaseClient;
  user: User;
} | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { client, user };
}

export async function consumeQuota(client: SupabaseClient, kind: 'analysis' | 'mentor') {
  const { data, error } = await client.rpc('consume_monthly_quota', { p_kind: kind });
  if (error) throw error;
  return data as { allowed: boolean; blocked: boolean; used: number; limit: number; plan: string };
}

export async function generateGeminiText(contents: unknown[], systemInstruction?: string, jsonResponse = true) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata nei secrets Supabase');
  const configuredModel = (Deno.env.get('GEMINI_MODEL') || '').trim().replace(/^models\//, '');
  const model = !configuredModel || configuredModel === 'gemini-2.5-flash'
    ? 'gemini-3.8-flash'
    : configuredModel;
  type GeminiPart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; mimeType?: string; data?: string };
  };
  type GeminiTurn = { role?: string; parts?: GeminiPart[] };
  const turns = contents as GeminiTurn[];
  const toInteractionContent = (parts: GeminiPart[] = []) => parts.flatMap((part) => {
    if (typeof part.text === 'string') return [{ type: 'text', text: part.text }];
    const image = part.inlineData || part.inline_data;
    if (image?.data) {
      return [{
        type: 'image',
        mime_type: ('mimeType' in image ? image.mimeType : undefined) ||
          ('mime_type' in image ? image.mime_type : undefined) || 'image/jpeg',
        data: image.data,
      }];
    }
    return [];
  });
  const input = turns.length === 1 && turns[0].role !== 'model'
    ? toInteractionContent(turns[0].parts)
    : turns.map((turn) => ({
      type: turn.role === 'model' ? 'model_output' : 'user_input',
      content: toInteractionContent(turn.parts),
    }));
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input,
      store: false,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      generation_config: { temperature: 0.35 },
      ...(jsonResponse ? { response_format: [{ type: 'text', mime_type: 'application/json' }] } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Errore Interactions API HTTP ${response.status}`);
  const text = typeof result.output_text === 'string'
    ? result.output_text
    : (Array.isArray(result.steps) ? result.steps : [])
      .filter((step: { type?: string }) => step.type === 'model_output')
      .flatMap((step: { content?: Array<{ type?: string; text?: string }> }) => step.content || [])
      .filter((item: { type?: string; text?: string }) => item.type === 'text' && typeof item.text === 'string')
      .map((item: { text: string }) => item.text)
      .join('');
  if (!text) throw new Error('Risposta Gemini vuota');
  return text;
}

export function parseGeminiJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

export async function sendBrevoEmail(to: string | string[], subject: string, text: string) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) throw new Error('BREVO_API_KEY ed EMAIL_FROM devono essere configurate nei secrets Supabase');
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('EMAIL_FROM_NAME') || 'moVeerAI', email: from },
      to: recipients,
      subject,
      textContent: text,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Brevo email API HTTP ${response.status}`);
  return result;
}