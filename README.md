# moVeerAI

Applicazione React/Vite con backend Supabase: Auth, PostgreSQL con Row Level Security, Storage e Edge Functions. Il frontend non richiede Base44.

## Avvio locale

1. Installa Node.js 22 o successivo e le dipendenze con `npm install`.
2. Crea un progetto gratuito su Supabase e copia `.env.example` in `.env.local`.
3. Inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` dal pannello API del progetto. `VITE_SITE_URL` deve essere l'URL del dominio usato in produzione.
4. Applica la migrazione SQL dal Supabase SQL Editor oppure collega il progetto con `npx supabase link --project-ref <project-ref>` e lancia `npm run supabase:db:push`.
5. Avvia il frontend con `npm run dev`.

Le chiavi `service_role`, AI, RevenueCat, Google Play e provider email sono segreti server-side: non inserirle in variabili `VITE_*` né nel repository. Configurale nei secrets delle Edge Functions Supabase. La chiave SDK RevenueCat iOS `appl_...` è pubblica e va configurata solo nell'ambiente di build.

Secrets necessari per le funzioni:

- `GEMINI_API_KEY` per analisi video, mentore e suggerimenti correttivi; `GEMINI_MODEL` è opzionale e predefinito a `gemini-3.8-flash`, con fallback a `gemini-3.7-flash` e `gemini-3.5-flash` in caso di sovraccarico temporaneo.
- `APP_ORIGIN` per i redirect del checkout e l'origine web consentita.
- `BREVO_API_KEY` e `EMAIL_FROM` per notifiche atleta e segnalazioni inviate dalle Edge Functions; `EMAIL_FROM_NAME` è opzionale e predefinito a `moVeerAI`.
- `REVENUECAT_SECRET_API_KEY` per la verifica server-side degli acquisti Apple e `REVENUECAT_WEBHOOK_AUTH` per autenticare i webhook RevenueCat iOS.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` per verificare lato server i token Google Play tramite Android Publisher API.

Variabili frontend per gli acquisti nativi, da inserire in `.env.local` (non sono segreti):

- `VITE_REVENUECAT_IOS_API_KEY`: chiave SDK pubblica dell'app iOS configurata in RevenueCat.
- `VITE_APPLE_PRO_MONTHLY_PRODUCT_ID`, `VITE_APPLE_PRO_ANNUAL_PRODUCT_ID`, `VITE_APPLE_COACH_MONTHLY_PRODUCT_ID` e `VITE_APPLE_COACH_ANNUAL_PRODUCT_ID`: identificativi Apple collegati all'offerta RevenueCat iOS.
- `VITE_TURNSTILE_SITE_KEY`: chiave pubblica opzionale Cloudflare Turnstile per CAPTCHA su registrazione e richiesta reset password.

## Sicurezza Auth in produzione

Nel Supabase Dashboard, in Authentication > Providers > Email, imposta la lunghezza minima password a 10 e richiedi lettere maiuscole, minuscole e numeri, in linea con i controlli di registrazione e reset dell'app. Attiva Leaked password protection se il piano Supabase lo consente. In Authentication > Bot and Abuse Protection abilita CAPTCHA con Cloudflare Turnstile, configura il secret direttamente nel Dashboard e passa al frontend solo la site key pubblica `VITE_TURNSTILE_SITE_KEY`.

In Authentication > URL Configuration usa `https://app.moveer.eu` come Site URL e limita gli URL di redirect di produzione a `https://app.moveer.eu/**`. Il `supabase/config.toml` locale mantiene `localhost` per lo sviluppo. Abilita l'enrollment e la verifica TOTP MFA nel Dashboard per consentire agli amministratori di attivarla facoltativamente; non rendere obbligatoria la MFA finché l'onboarding amministrativo non è stato verificato.

Imposta i valori nel progetto collegato dalle impostazioni Secrets Supabase o con `npx supabase secrets set`. Supabase Auth SMTP usa la SMTP key Brevo nel dashboard Auth; le Edge Functions usano invece la API key Brevo (`BREVO_API_KEY`). Non usare placeholder nel deployment.

Per promuovere il primo account ad amministratore, registra prima l'utente e poi esegui dal SQL Editor Supabase, sostituendo l'indirizzo:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@your-domain.example';
```

## Supabase

La migrazione iniziale crea profili, entitlements, esercizi, atleti, report, conversazioni e bucket Storage con policy RLS. Per usare email OTP e reset password configura URL di redirect e template in Authentication > URL Configuration. Per Google OAuth configura il provider sia in Supabase sia nel relativo pannello Google.

Gli acquisti iOS usano StoreKit tramite RevenueCat; Android usa direttamente Google Play Billing con `@capgo/native-purchases`. Per Apple, crea in RevenueCat l'app iOS, gli entitlement `pro` e `coach` e l'offerta con i quattro prodotti indicati in `.env.example`. Imposta la chiave SDK pubblica e gli ID Apple nell'ambiente frontend, e configura `REVENUECAT_SECRET_API_KEY` e `REVENUECAT_WEBHOOK_AUTH` nei secrets Supabase.

Per Google Play, configura gli abbonamenti con questi ID prodotto esatti: `pro-monthly`, `pro-annual`, `coach-monthly`, `coach-annual`. Ogni prodotto deve avere un base plan e un'offerta attivi con i prezzi scelti in Play Console; l'app mostra i prezzi localizzati restituiti da Google Play e acquista l'offerta mostrata. Non occorre configurare l'app Android in RevenueCat né impostare una chiave SDK RevenueCat Android.

La verifica Play avviene solo sul server. Abilita la Google Play Android Developer API nel progetto Google Cloud collegato, crea un service account e autorizzalo alla gestione dell'app `com.moveerai.app` dalla sezione Accesso API di Play Console. Configura l'intero JSON del service account come secret Supabase `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; non inserirlo nel repository, in `.env.local` o nella chat. Il backend usa il token d'acquisto e l'API Publisher per verificare prodotto, stato, scadenza e associazione all'account. Il database conserva i token in una tabella non accessibile agli utenti e riduce i piani scaduti a Freemium anche se l'app non si è ancora risincronizzata.

Applica la migrazione con `npm run supabase:db:push` e pubblica le Edge Functions con `npm run supabase:functions:deploy`. In RevenueCat configura un webhook POST a `https://<project-ref>.supabase.co/functions/v1/revenuecatWebhook` e imposta l'header Authorization a `Bearer <REVENUECAT_WEBHOOK_AUTH>`; invia gli eventi di acquisto, rinnovo, cambio prodotto e scadenza. `revenuecatWebhook` ha la verifica JWT Supabase disabilitata e verifica il token RevenueCat; `syncStoreEntitlement` e `syncGooglePlayEntitlement` richiedono invece una sessione utente. Google Play viene verificato durante acquisto, ripristino e sincronizzazione dalla pagina Abbonamento.

Le vecchie Edge Functions non più usate dall'app devono essere rimosse anche dai progetti Supabase collegati:

```sh
npx supabase functions delete adminDeleteUser
npx supabase functions delete changePlan
npx supabase functions delete consumeMentorQuery
npx supabase functions delete createCheckoutSession
npx supabase functions delete createPortalSession
npx supabase functions delete handleStripeWebhook
```

La pagina Abbonamento vende e ripristina gli acquisti nativamente tramite StoreKit/RevenueCat su iOS e Google Play Billing diretto su Android. La gestione e la cancellazione dei rinnovi avvengono nelle impostazioni dell'App Store o di Google Play; sul web l'acquisto non è disponibile. Non sono richiesti checkout, customer portal o credenziali Stripe.

Per SMTP Auth con Brevo usa `smtp-relay.brevo.com`, porta `587`, lo SMTP login mostrato in Brevo e la SMTP key come password. Verifica prima il dominio mittente e usa un mittente autorizzato in `EMAIL_FROM`.

## App Android e iOS

Le shell native `android/` e `ios/` sono incluse. Dopo le modifiche web o al plugin, esegui `npm run cap:sync:android` oppure `npm run cap:sync:ios`; apri i progetti con `npx cap open android` e `npx cap open ios`. Android richiede Android Studio, JDK 21 e Android SDK; iOS richiede Xcode completo.

Le icone dell'app web/PWA e delle app Android e iOS usano l'immagine sorgente `assets/app-icon-source.jpg`.

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
