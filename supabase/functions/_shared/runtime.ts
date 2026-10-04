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
      'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
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
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
        generationConfig: {
          temperature: 0.35,
          ...(jsonResponse ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Errore del servizio Gemini');
  const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
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