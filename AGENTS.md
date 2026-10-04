# AGENTS.md

## Project Context

moVeerAI is a user-owned React/Vite application using Supabase Auth, PostgreSQL, Storage, and Edge Functions. Keep changes focused and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, Supabase migrations, and deployment.

## Key Files

- `src/`: frontend application source.
- `src/api/supabaseClient.js`: Supabase browser client.
- `src/api/appApi.js`: application API facade backed by Supabase.
- `supabase/migrations/`: active database schema and RLS policies.
- `supabase/functions/`: active backend functions; secrets stay server-side.
- `base44/`: legacy source/schema reference only; do not add runtime dependencies on it.
- `.env.local`: local-only public Supabase settings; never commit secrets.

## Working Notes

- Use `npm run dev` for the frontend and `npx supabase` for local database/function workflows.
- Keep ownership and authorization in RLS or Edge Functions; never trust client-supplied user IDs, plan, or blocked status.
- `VITE_*` variables are public. Keep service-role, Gemini, email, and Stripe keys in Supabase secrets.
- The exercise catalog data is not present in this repository; do not invent or fabricate imported records.
- Run the relevant checks from `package.json` before finishing code changes.
