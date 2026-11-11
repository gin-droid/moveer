import { requireSupabase, supabase } from '@/api/supabaseClient';
import { appPath } from '@/lib/appPath';
import { clearReportCache } from '@/lib/reportCache';

export async function functionErrorMessage(error, fallback = 'Operazione non riuscita.') {
  try {
    const body = await error?.context?.clone?.().json();
    if (typeof body?.error === 'string' && body.error) return body.error;
  } catch {
    // Fall back to the SDK error when the response has no JSON body.
  }
  return error?.message || fallback;
}

const authRedirectUrl = (path) => {
  const hostname = window.location.hostname;
  const isMoveerDomain = hostname === 'moveer.eu' || hostname.endsWith('.moveer.eu');
  const origin = !import.meta.env.DEV && isMoveerDomain
    ? 'https://app.moveer.eu'
    : window.location.origin;
  return `${origin}${appPath(path)}`;
};

const safeFileName = (name = 'file') => {
  const clean = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-80);
  return clean || 'file';
};

const entityTables = {
  AnalysisReport: 'analysis_reports',
  Athlete: 'athletes',
  Exercise: 'exercises',
  User: 'profiles',
  UserEntitlement: 'user_entitlements',
};

const columnName = (column) => {
  if (column === 'created_date') return 'created_at';
  if (column === 'created_by_id') return 'user_id';
  return column;
};

const normalizeRow = (row) => row && ({
  ...row,
  created_date: row.created_at,
  created_by_id: row.user_id,
});

const normalizePayload = (entity, payload) => {
  const result = { ...payload };
  delete result.created_date;
  delete result.created_by_id;
  if (entity === 'AnalysisReport' || entity === 'Athlete') delete result.user_id;
  return result;
};

const applySort = (query, sort) => {
  const value = sort || '-created_date';
  const descending = value.startsWith('-');
  return query.order(columnName(descending ? value.slice(1) : value), { ascending: !descending });
};

const applyFilters = (query, filters = {}) => {
  for (const [rawColumn, value] of Object.entries(filters)) {
    const column = columnName(rawColumn);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Array.isArray(value.$in)) query = query.in(column, value.$in);
      else if ('$eq' in value) query = query.eq(column, value.$eq);
    } else if (value !== undefined && value !== null) {
      query = query.eq(column, value);
    }
  }
  return query;
};

const createEntityApi = (entity) => {
  const table = entityTables[entity];
  if (!table) throw new Error(`Entità non supportata: ${entity}`);

  return {
    async list(sort, limit = 100) {
      const { data, error } = await applySort(requireSupabase().from(table).select('*'), sort).limit(limit);
      if (error) throw error;
      return (data || []).map(normalizeRow);
    },
    async filter(filters, sort, limit = 100) {
      const query = applyFilters(requireSupabase().from(table).select('*'), filters);
      const { data, error } = await applySort(query, sort).limit(limit);
      if (error) throw error;
      return (data || []).map(normalizeRow);
    },
    async get(id) {
      const { data, error } = await requireSupabase().from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return normalizeRow(data);
    },
    async create(payload) {
      const { data, error } = await requireSupabase()
        .from(table)
        .insert(normalizePayload(entity, payload))
        .select('*')
        .single();
      if (error) throw error;
      return normalizeRow(data);
    },
    async update(id, payload) {
      const { data, error } = await requireSupabase()
        .from(table)
        .update(normalizePayload(entity, payload))
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return normalizeRow(data);
    },
    async delete(id) {
      if (entity === 'User') {
        const { data, error } = await requireSupabase().functions.invoke('adminManageUsers', { body: { action: 'delete', userId: id } });
        if (error) throw error;
        return data;
      }
      if (entity === 'AnalysisReport') {
        const { data: report, error: readError } = await requireSupabase().from(table)
          .select('video_uri').eq('id', id).maybeSingle();
        if (readError) throw readError;
        if (report?.video_uri) await removePrivateFiles([report.video_uri]);
      }
      const { error } = await requireSupabase().from(table).delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
  };
};

/** @type {Record<string, ReturnType<typeof createEntityApi>>} */
const entityTarget = {};
const entities = new Proxy(entityTarget, {
  get: (_target, entity) => createEntityApi(String(entity)),
});

const auth = {
  async me() {
    const client = requireSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) return null;
    const { data: profile, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return normalizeRow({ ...profile, id: user.id, email: user.email, banned_until: user.banned_until });
  },
  async loginViaEmailPassword(email, password) {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async register({ email, password, captchaToken }) {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) throw error;
    return data;
  },
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await requireSupabase().auth.verifyOtp({ email, token: otpCode, type: 'email' });
    if (error) throw error;
    return { ...data, access_token: data.session?.access_token };
  },
  async resendOtp(email) {
    const { error } = await requireSupabase().auth.resend({ type: 'signup', email });
    if (error) throw error;
  },
  async updateMe(values) {
    const client = requireSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Sessione non valida');
    const profileValues = normalizePayload('User', values);
    const { error } = await client.from('profiles').update(profileValues).eq('id', user.id);
    if (error) throw error;
    return this.me();
  },
  async logout(redirectTo) {
    clearReportCache();
    if (supabase) await supabase.auth.signOut();
    if (typeof redirectTo === 'string' && redirectTo !== window.location.href) {
      const target = redirectTo.startsWith('/') ? appPath(redirectTo) : redirectTo;
      window.location.assign(target);
    }
  },
  redirectToLogin(returnTo = '/') {
    window.location.assign(`${appPath('/login')}?returnTo=${encodeURIComponent(returnTo)}`);
  },
  async loginWithProvider(provider, returnTo = '/') {
    const { error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl(returnTo) },
    });
    if (error) throw error;
  },
  async resetPasswordRequest(email, captchaToken) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/reset-password'),
      captchaToken,
    });
    if (error) throw error;
  },
  async resetPassword({ newPassword }) {
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};

async function removePrivateFiles(fileUris) {
  const paths = fileUris.map((fileUri) => {
    try {
      const url = new URL(fileUri);
      const marker = '/object/sign/analysis-media/';
      const offset = url.pathname.indexOf(marker);
      return offset >= 0 ? decodeURIComponent(url.pathname.slice(offset + marker.length)) : fileUri;
    } catch {
      return fileUri;
    }
  }).filter(Boolean);
  if (!paths.length) return;
  const { error } = await requireSupabase().storage.from('analysis-media').remove(paths);
  if (error) throw error;
}

async function removePublicFile(fileUrl) {
  let path = fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = '/object/public/public-assets/';
    const offset = url.pathname.indexOf(marker);
    if (offset >= 0) path = decodeURIComponent(url.pathname.slice(offset + marker.length));
  } catch {
    // Accept a storage object path as well as a public URL.
  }
  if (!path) return;
  const { error } = await requireSupabase().storage.from('public-assets').remove([path]);
  if (error) throw error;
}

const integrations = {
  Core: {
    async UploadPrivateFile({ file }) {
      const { data: { user }, error: authError } = await requireSupabase().auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Sessione non valida');
      const path = `${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error } = await requireSupabase().storage.from('analysis-media').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (error) throw error;
      return { file_uri: path };
    },
    async CreateFileSignedUrl({ file_uri, expires_in = 600 }) {
      const { data, error } = await requireSupabase()
        .storage.from('analysis-media').createSignedUrl(file_uri, expires_in);
      if (error) throw error;
      return { signed_url: data.signedUrl };
    },
    async UploadPublicFile({ file }) {
      const { data: { user }, error: authError } = await requireSupabase().auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Sessione non valida');
      const path = `${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const storage = requireSupabase().storage.from('public-assets');
      const { error } = await storage.upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      return { file_url: storage.getPublicUrl(path).data.publicUrl };
    },
    async RemovePrivateFiles({ file_uris }) {
      await removePrivateFiles(Array.isArray(file_uris) ? file_uris : [file_uris]);
    },
    async RemovePublicFile({ file_url }) {
      await removePublicFile(file_url);
    },
  },
};

const agents = {
  /** @param {{agent_name?: string}} [_options] */
  async listConversations(_options = {}) {
    const { data, error } = await requireSupabase()
      .from('mentor_conversations').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getConversation(id) {
    const client = requireSupabase();
    const { data: conversation, error } = await client.from('mentor_conversations').select('*').eq('id', id).single();
    if (error) throw error;
    const { data: messages, error: messagesError } = await client
      .from('mentor_messages').select('*').eq('conversation_id', id).order('created_at');
    if (messagesError) throw messagesError;
    return { ...conversation, messages: messages || [] };
  },
  /** @param {{agent_name?: string, metadata?: {name?: string, description?: string}}} options */
  async createConversation({ metadata } = {}) {
    const { data: { user }, error: authError } = await requireSupabase().auth.getUser();
    if (authError) throw authError;
    const { data, error } = await requireSupabase().from('mentor_conversations')
      .insert({ user_id: user.id, title: metadata?.name || 'Mentore' }).select('*').single();
    if (error) throw error;
    return { ...data, messages: [] };
  },
  subscribeToConversation(id, callback) {
    const channel = requireSupabase().channel(`mentor-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mentor_messages', filter: `conversation_id=eq.${id}`,
      }, async () => callback(await agents.getConversation(id)))
      .subscribe();
    return () => { if (supabase) supabase.removeChannel(channel); };
  },
};

export const appApi = {
  auth,
  entities,
  integrations,
  agents,
  functionErrorMessage,
  functions: {
    invoke: (name, body) => requireSupabase().functions.invoke(name, { body }),
  },
};
