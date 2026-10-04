# moVeerAI

Applicazione React/Vite con backend Supabase: Auth, PostgreSQL con Row Level Security, Storage e Edge Functions. Il frontend non richiede Base44.

## Avvio locale

1. Installa Node.js 20 o successivo e le dipendenze con `npm install`.
2. Crea un progetto gratuito su Supabase e copia `.env.example` in `.env.local`.
3. Inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` dal pannello API del progetto. `VITE_SITE_URL` deve essere l'URL del dominio usato in produzione.
4. Applica la migrazione SQL dal Supabase SQL Editor oppure collega il progetto con `npx supabase link --project-ref <project-ref>` e lancia `npm run supabase:db:push`.
5. Avvia il frontend con `npm run dev`.

Le chiavi `service_role`, AI, Stripe e provider email sono segreti server-side: non inserirle in variabili `VITE_*` né nel repository. Configurale nei secrets delle Edge Functions Supabase.

Secrets necessari per le funzioni:

- `GEMINI_API_KEY` per analisi video, mentore e suggerimenti correttivi; `GEMINI_MODEL` è opzionale e predefinito a `gemini-2.5-flash`.
- `APP_ORIGIN` per i redirect del checkout e l'origine web consentita.
- `BREVO_API_KEY` e `EMAIL_FROM` per notifiche atleta e segnalazioni inviate dalle Edge Functions; `EMAIL_FROM_NAME` è opzionale e predefinito a `moVeerAI`.
- `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID` e `STRIPE_WEBHOOK_SECRET` per gli abbonamenti Pro.

Imposta i valori nel progetto collegato dalle impostazioni Secrets Supabase o con `npx supabase secrets set`. Supabase Auth SMTP usa la SMTP key Brevo nel dashboard Auth; le Edge Functions usano invece la API key Brevo (`BREVO_API_KEY`). Non usare placeholder nel deployment.

Per promuovere il primo account ad amministratore, registra prima l'utente e poi esegui dal SQL Editor Supabase, sostituendo l'indirizzo:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@your-domain.example';
```

## Supabase

La migrazione iniziale crea profili, entitlements, esercizi, atleti, report, conversazioni e bucket Storage con policy RLS. Per usare email OTP e reset password configura URL di redirect e template in Authentication > URL Configuration. Per Google OAuth configura il provider sia in Supabase sia nel relativo pannello Google.

Dopo aver collegato il progetto, pubblica le funzioni con `npm run supabase:functions:deploy`; configura il webhook Stripe sull'endpoint `handleStripeWebhook` e seleziona almeno gli eventi checkout completato e cancellazione subscription.

Per SMTP Auth con Brevo usa `smtp-relay.brevo.com`, porta `587`, lo SMTP login mostrato in Brevo e la SMTP key come password. Verifica prima il dominio mittente e usa un mittente autorizzato in `EMAIL_FROM`.

## App Android

Dopo `npm install`, genera la shell Android una sola volta con `npm run cap:add:android`; poi sincronizza dipendenze e plugin con `npm run cap:sync:android` e apri il progetto con `npx cap open android`. Servono Android Studio, JDK e Android SDK installati. Prova il plugin su un dispositivo fisico compatibile con ARCore: l'emulatore e i dispositivi senza depth supportato non restituiscono misure 3D affidabili.

Il plugin campiona pose/depth a 5 Hz. I frame restituiti includono punti world-space in metri con asse y-up e confidenza ML Kit. La UI React continua a richiedere un video separato o un JSON `DepthData`; la sincronizzazione in tempo reale tra video web e ARCore non è ancora implementata.

Importa il catalogo e gli eventuali dati precedenti dopo aver applicato lo schema. Per importare gli esercizi dal vecchio progetto, usa `npm run catalog:import-base44`; per trasferire in Supabase Storage le immagini legacy già presenti in `exercises.image_url` e `profiles.logo_url`, configura temporaneamente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nell'ambiente locale e lancia `npm run catalog:migrate-base44-media`. Non impostare la service-role key in variabili `VITE_*` e non inserirla nel repository. Dopo la migrazione l'app usa soltanto gli URL Supabase per tali immagini. I file `base44/` e lo script di import rimangono strumenti di migrazione/archivio: non sono dipendenze di build o deploy.

## Comandi

- `npm run dev`: server Vite.
- `npm run build`: build di produzione.
- `npm run lint`: lint.
- `npm run typecheck`: controllo TypeScript.
- `npm run supabase:db:push`: applica migrazioni al progetto collegato.
- `npm run supabase:functions:deploy`: deploy delle Edge Functions.
