# moVeerAI

Applicazione React/Vite con backend Supabase: Auth, PostgreSQL con Row Level Security, Storage e Edge Functions. Il frontend non richiede Base44.

## Avvio locale

1. Installa Node.js 22 o successivo e le dipendenze con `npm install`.
2. Crea un progetto gratuito su Supabase e copia `.env.example` in `.env.local`.
3. Inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` dal pannello API del progetto. `VITE_SITE_URL` deve essere l'URL del dominio usato in produzione.
4. Applica la migrazione SQL dal Supabase SQL Editor oppure collega il progetto con `npx supabase link --project-ref <project-ref>` e lancia `npm run supabase:db:push`.
5. Avvia il frontend con `npm run dev`.

Le chiavi `service_role`, AI, Stripe e provider email sono segreti server-side: non inserirle in variabili `VITE_*` né nel repository. Configurale nei secrets delle Edge Functions Supabase.

Secrets necessari per le funzioni:

- `GEMINI_API_KEY` per analisi video, mentore e suggerimenti correttivi; `GEMINI_MODEL` è opzionale e predefinito a `gemini-3.8-flash`, con fallback a `gemini-3.7-flash`, `gemini-3.5-flash` e `gemini-2.5-flash` in caso di sovraccarico temporaneo.
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

## App Android e iOS

Le shell native `android/` e `ios/` sono incluse. Dopo le modifiche web o al plugin, esegui `npm run cap:sync:android` oppure `npm run cap:sync:ios`; apri i progetti con `npx cap open android` e `npx cap open ios`. Android richiede Android Studio, JDK e Android SDK; iOS richiede Xcode completo.

Il video RGB resta la funzione principale e viene registrato per primo con REC, pausa, ripresa e stop. Dopo averlo salvato, nell'app nativa è disponibile una scansione depth facoltativa di 10 secondi: il flusso RGB viene chiuso prima di avviare ARKit o ARCore, che usano la camera. Android usa ARCore Depth API e ML Kit; iOS usa ARKit `sceneDepth` LiDAR e Vision per le pose 3D. La scansione è separata e non sincronizzata col video; se fallisce, il video resta utilizzabile. La PWA/browser non espone i sensori LiDAR/ToF.

Le verifiche locali coprono build web e sync Capacitor, non la compilazione Xcode/Gradle né l'acquisizione su hardware. Testa su iPhone/iPad con LiDAR o dispositivo Android compatibile con ARCore Depth; emulatore e browser non forniscono misure 3D reali.

Importa il catalogo e gli eventuali dati precedenti dopo aver applicato lo schema. Per importare gli esercizi dal vecchio progetto, usa `npm run catalog:import-base44`; per trasferire in Supabase Storage le immagini legacy già presenti in `exercises.image_url` e `profiles.logo_url`, configura temporaneamente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nell'ambiente locale e lancia `npm run catalog:migrate-base44-media`. Non impostare la service-role key in variabili `VITE_*` e non inserirla nel repository. Dopo la migrazione l'app usa soltanto gli URL Supabase per tali immagini. I file `base44/` e lo script di import rimangono strumenti di migrazione/archivio: non sono dipendenze di build o deploy.

## Comandi

- `npm run dev`: server Vite.
- `npm run build`: build di produzione.
- `npm run lint`: lint.
- `npm run typecheck`: controllo TypeScript.
- `npm run supabase:db:push`: applica migrazioni al progetto collegato.
- `npm run supabase:functions:deploy`: deploy delle Edge Functions.
