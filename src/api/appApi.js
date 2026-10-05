import { requireSupabase, supabase } from '@/api/supabaseClient';
import { appPath } from '@/lib/appPath';

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
        const { data, error } = await requireSupabase().functions.invoke('adminDeleteUser', { body: { userId: id } });
        if (error) throw error;
        return data;
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
    return normalizeRow({ ...profile, id: user.id, email: user.email });
  },
  async loginViaEmailPassword(email, password) {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async register({ email, password }) {
    const { data, error } = await requireSupabase().auth.signUp({ email, password });
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
  async setToken(_accessToken) {},
  async updateMe(values) {
    const client = requireSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Sessione non valida');
    const profileValues = normalizePayload('User', values);
    const { error } = await client.from('profiles').update(profileValues).eq('id', user.id);
    if (error) throw error;
    const { error: metadataError } = await client.auth.updateUser({ data: values });
    if (metadataError) throw metadataError;
    return this.me();
  },
  async logout(redirectTo) {
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
  async resetPasswordRequest(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl('/reset-password'),
    });
    if (error) throw error;
  },
  async resetPassword({ newPassword }) {
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};

const integrations = {
  Core: {
    async UploadPrivateFile({ file }) {
      const path = `${crypto.randomUUID()}-${safeFileName(file.name)}`;
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
      const path = `${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const storage = requireSupabase().storage.from('public-assets');
      const { error } = await storage.upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      return { file_url: storage.getPublicUrl(path).data.publicUrl };
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
  functions: {
    invoke: (name, body) => requireSupabase().functions.invoke(name, { body }),
  },
};
