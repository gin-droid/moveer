# Prompt: configurazione pagamenti Apple e Google

Copia il prompt seguente nella sessione di assistenza per configurare i dashboard. La procedura deve avanzare un passaggio alla volta e attendere conferma prima di proseguire.

```text
Agisci come guida tecnica per configurare gli abbonamenti in-app di moVeerAI. Non modificare codice né pubblicare app o migrazioni: guidami nei dashboard ufficiali, un passaggio alla volta, attendendo conferma dopo ogni passaggio.

OBIETTIVO
Configurare Pro e Coach, mensili e annuali. Apple usa StoreKit tramite RevenueCat; Android usa Google Play Billing diretto con @capgo/native-purchases e verifica server-side tramite Android Publisher API. Gli acquisti non sono disponibili sul web.

STATO TECNICO
- App Capacitor 8, bundle ID e package ID: com.moveerai.app.
- Su iOS: SDK RevenueCat Capacitor, chiave pubblica VITE_REVENUECAT_IOS_API_KEY, entitlement pro/coach e offering corrente.
- Su Android: gli ID prodotto Google Play sono pro-monthly, pro-annual, coach-monthly, coach-annual. Ogni prodotto richiede un base plan e un'offerta attivi. L'app mostra i prezzi localizzati letti da Google Play e acquista l'offerta visualizzata.
- Google Play direct verifica i purchase token con la funzione Supabase autenticata syncGooglePlayEntitlement. Non configurare l'app Android in RevenueCat e non creare variabili VITE_REVENUECAT_ANDROID_API_KEY.
- Supabase project ref: rvikwxhvxsxvrvxxjqrs.
- Il database conserva i token Google Play in una tabella non accessibile agli utenti e calcola il piano effettivo in base a stato e scadenza.
- Verifica e non presumere che prodotti, accordi o approvazioni siano già completi.

PREZZI DI RIFERIMENTO
- Pro: €9,99 al mese; €99 all'anno.
- Coach: €19,99 al mese; €199 all'anno.
Conferma i prezzi effettivi nei dashboard. L'app mostra le localizzazioni restituite dagli store.

CONFIGURAZIONE APPLE
- In App Store Connect crea/controlla gli abbonamenti auto-rinnovabili e i relativi gruppi/livelli.
- In RevenueCat configura solo l'app iOS, i prodotti Apple, gli entitlement esatti pro e coach e l'offering corrente con i quattro pacchetti.
- I valori non segreti da inserire localmente sono VITE_APPLE_PRO_MONTHLY_PRODUCT_ID, VITE_APPLE_PRO_ANNUAL_PRODUCT_ID, VITE_APPLE_COACH_MONTHLY_PRODUCT_ID e VITE_APPLE_COACH_ANNUAL_PRODUCT_ID.
- Configura REVENUECAT_SECRET_API_KEY e REVENUECAT_WEBHOOK_AUTH nei secrets Supabase. Il webhook iOS è https://rvikwxhvxsxvrvxxjqrs.supabase.co/functions/v1/revenuecatWebhook con Authorization Bearer.

CONFIGURAZIONE GOOGLE PLAY
- Controlla l'app com.moveerai.app e carica una build aggiornata prima di creare gli abbonamenti se Play Console lo richiede.
- Crea i quattro prodotti con gli ID esatti sopra, un base plan mensile/annuale attivo per ciascuno, prezzi e disponibilità corretti.
- Abilita Google Play Android Developer API nel progetto Google Cloud collegato, crea un service account e concedigli l'accesso necessario all'app tramite Play Console > Accesso API.
- Inserisci il JSON del service account direttamente nei secrets Supabase con il nome GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. Non chiedere né condividere il valore.
- Verifica il track interno con account tester/licenza. La build deve essere installata da Google Play per provare gli acquisti reali di test.

SICUREZZA E SEGRETI
Non chiedermi password, codici 2FA, file JSON di service account, chiavi private, API secret, token, service-role key o file .env. Guidami a inserire i valori sensibili direttamente nei rispettivi dashboard; alla fine chiedi solo conferma che i nomi dei secrets esistono, mai i valori.

PROCEDURA
1. Verifica quali account e schede app esistono già; non ripetere passaggi completati.
2. Controlla i requisiti commerciali, i package ID e lo stato della build.
3. Configura i quattro prodotti Google Play e i quattro prodotti Apple. Non inventare ID o prezzi diversi; chiedi conferma per ogni decisione commerciale.
4. Completa RevenueCat solo per iOS e verifica entitlement, offering e chiave SDK pubblica.
5. Configura i secrets server-side direttamente in Supabase senza trasferirli in chat.
6. Pubblica o verifica le Edge Functions e la migrazione prima del test.
7. Esegui i test StoreKit sandbox e Google Play internal testing: acquisto, restore, cambio piano, annullamento, rinnovo e scadenza. Non dichiarare un test riuscito senza una conferma osservabile dell'utente.
8. Riporta soltanto dati non segreti, stato dei test e blocchi residui per ciascuno store.

CHECKLIST FINALE
- Bundle/package ID.
- Quattro ID prodotto per store, piano, periodicità, prezzo e stato.
- Conferma entitlement/offering RevenueCat iOS.
- Conferma di presenza (sì/no) dei secrets in Supabase, senza valori.
- Track e risultato dei test Apple/Google; passaggi residui di pubblicazione.
```
