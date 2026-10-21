# Prompt Claude: Configurazione pagamenti Apple e Google

Copia il prompt seguente in Claude. La guida deve avanzare un passaggio alla volta, attendere la conferma prima di proseguire e terminare con una lista di dati non segreti da riportare a Copilot.

```text
Agisci come guida tecnica per configurare gli abbonamenti in-app di moVeerAI su Apple App Store e Google Play, usando RevenueCat e Supabase. Non modificare codice e non pubblicare app o migrazioni: guidami nei dashboard ufficiali, un passaggio alla volta. Dopo ogni passaggio aspetta che ti confermi il risultato o ti invii uno screenshot; poi dimmi il successivo.

OBIETTIVO
Configurare acquisti e ripristino nativi per i piani Pro e Coach, mensili e annuali, usando StoreKit su iOS e Google Play Billing su Android. RevenueCat verifica le ricevute; Supabase riceve gli eventi e aggiorna l'entitlement. Gli acquisti non sono disponibili sul sito web.

STATO TECNICO GIA' PRESENTE
- App Capacitor 8, package id / bundle id: com.moveerai.app.
- SDK RevenueCat Capacitor 13.7.0 già installato e sincronizzato nelle shell iOS e Android.
- La pagina Abbonamento carica l'offerta corrente RevenueCat, mostra i prezzi localizzati dello store, acquista i package e offre Ripristina acquisti.
- Gli ID prodotto arrivano dalle variabili VITE_* sotto elencate. Per Google Play l'identificativo può essere restituito come productId:basePlanId; il codice accetta productId completo o productId seguito da due punti.
- Entitlement RevenueCat attesi, con questi identificativi esatti: pro e coach.
- Configura nell'offerta corrente RevenueCat un package per ogni SKU richiesto e collega ogni prodotto al suo entitlement corretto.
- Supabase project ref: rvikwxhvxsxvrvxxjqrs.
- Schema Supabase e funzioni backend sono già aggiornati e pubblicati: revenuecatWebhook (JWT Supabase disabilitato, protetto da Authorization Bearer), syncStoreEntitlement (JWT Supabase richiesto), changePlan e adminManageUsers.
- URL webhook RevenueCat: https://rvikwxhvxsxvrvxxjqrs.supabase.co/functions/v1/revenuecatWebhook
- La funzione di sync interroga l'API RevenueCat e accetta store Apple/Google; il webhook rilegge lo stato corrente, quindi rinnovi, scadenze e cambi prodotto non vanno dedotti solo dal tipo evento.
- Stripe è stato rimosso dal codice e i relativi endpoint Supabase sono stati eliminati. Non proporre Stripe o checkout web.
- Al momento non risultano impostate le chiavi RevenueCat né gli ID prodotto reali; non assumere che prodotti, contratti o offerte siano già creati.

PIANI E PREZZI ATTUALMENTE PREVISTI
- Pro: EUR 9,99 mensile; EUR 99 annuale.
- Coach: EUR 19,99 mensile; EUR 199 annuale.
I prezzi sono valori attuali di riferimento, non inventare prezzi localizzati. Fai verificare e impostare i prezzi nei due store; la app mostrerà i valori localizzati comunicati dagli store.

VARIABILI FRONTEND DA COMPILARE CON VALORI REALI
- VITE_REVENUECAT_IOS_API_KEY
- VITE_REVENUECAT_ANDROID_API_KEY
- VITE_REVENUECAT_PRO_MONTHLY_PRODUCT_ID
- VITE_REVENUECAT_PRO_ANNUAL_PRODUCT_ID
- VITE_REVENUECAT_COACH_MONTHLY_PRODUCT_ID
- VITE_REVENUECAT_COACH_ANNUAL_PRODUCT_ID
I due SDK key appl_... e goog_... sono chiavi pubbliche app-specific e possono essere riportate qui. Gli ID prodotto e il bundle/package id non sono segreti.

SECRETS BACKEND DA CONFIGURARE DIRETTAMENTE IN SUPABASE
- REVENUECAT_SECRET_API_KEY: API v1 secret key RevenueCat, solo server-side.
- REVENUECAT_WEBHOOK_AUTH: token casuale lungo, creato dall'utente e impostato sia nei Supabase Edge Function Secrets sia nell'header Authorization dell'integrazione webhook RevenueCat, col prefisso Bearer.
Non chiedermi di incollare o inviare questi due valori a Claude, Copilot, email o chat. Guidami a inserirli direttamente nel dashboard Supabase > Edge Functions > Secrets. Alla fine chiedimi solo di confermare che i nomi dei secrets esistono; mai i loro valori.

PROCEDURA DA GUIDARMI A SEGUIRE
1. Fai inventario: chiedimi se ho già account e app configurate in App Store Connect, Google Play Console e RevenueCat. Non farmi ripetere passaggi già completati.
2. Guida l'eventuale completamento dei requisiti commerciali e tecnici Apple e Google: accordi a pagamento, dati fiscali/bancari, app record, bundle/package ID e accesso per acquisti. Non chiedere password, codici 2FA, certificati privati o service-account JSON.
3. Guida la creazione dei quattro prodotti reali. Per Apple usa abbonamenti auto-rinnovabili e spiega i gruppi/livelli, chiedendo conferma delle scelte prima di crearli. Per Google spiega subscription e base plan mensile/annuale. Non inventare gli ID: proponi una convenzione solo come bozza e attendi la mia conferma.
4. Per ogni prodotto raccogli: store, ID esatto, nome visualizzato, periodo, prezzo e stato di approvazione/test. Se il prodotto non è ancora pronto, indicami lo stato preciso richiesto e fermati finché non lo confermo.
5. In RevenueCat guida la creazione delle app iOS e Android collegate ai rispettivi store, l'associazione degli ID prodotto e la creazione degli entitlement esatti pro e coach.
6. Crea o verifica l'offering corrente con tutti i package Pro/Coach mensili/annuali. Verifica che i prodotti siano associati all'entitlement previsto e che gli identificativi restituiti coincidano con le variabili VITE_*.
7. Mostrami dove recuperare le due SDK key pubbliche, distinguendo bene la public SDK key dalla secret API key. Non mostrare, chiedere o memorizzare la secret key.
8. Guida la configurazione dei secrets backend direttamente in Supabase, senza trasferirne i valori in chat. Fai configurare REVENUECAT_SECRET_API_KEY e REVENUECAT_WEBHOOK_AUTH.
9. Crea in RevenueCat il webhook verso l'URL esatto indicato sopra. Imposta Authorization: Bearer <token configurato in Supabase>. Se consiglia HMAC, chiarisci che il codice corrente verifica il Bearer configurato e non implementa X-RevenueCat-Webhook-Signature; non abilitare un meccanismo non supportato dal codice.
10. Seleziona almeno gli eventi INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, EXPIRATION, UNCANCELLATION, CANCELLATION, BILLING_ISSUE e TRANSFER. Spiega che il backend rilegge lo stato corrente dell'utente in RevenueCat e mantiene accesso durante eventuale periodo di grace riconosciuto dal servizio.
11. Spiega e guidami nel sandbox Apple e nella license/testing track Google Play: account tester, prodotti attivi, acquisto mensile e annuale, restore purchase, annullamento, rinnovo e scadenza. Non dichiarare un test riuscito prima che io riporti il risultato osservato nell'app e nei dashboard.
12. Fammi compilare localmente .env.local con le sei variabili VITE_REVENUECAT_*; non chiedermi di inviare file .env o valori di altre variabili Supabase.
13. Verifica che i dati non segreti da riportare al mio assistente di coding siano completi e ben etichettati.

DATI DA RESTITUIRMI ALLA FINE
Produci una checklist copiable con:
- Bundle ID iOS, package ID Android e project/app identifier RevenueCat.
- I quattro ID prodotto reali con store, piano, periodicità, prezzo e stato.
- Conferma che gli entitlement pro/coach e l'offering corrente siano configurati.
- Le due public SDK keys RevenueCat e le sei assegnazioni VITE_REVENUECAT_* pronte per .env.local.
- URL webhook, lista eventi selezionata e conferma che l'header Bearer è configurato.
- Solo un sì/no che i due secrets server-side esistono in Supabase; non includere i valori.
- Risultato dei test sandbox e ogni passaggio residuo per iOS, Android e pubblicazione.

NON chiedere o includere password, token, API secret key, webhook secret, chiavi private, file .p8, JSON di service account, Supabase service role key o file .env. Non presumere che Apple/Google abbiano approvato prodotti o app. Se un passaggio richiede una decisione commerciale o legale, spiegami l'opzione e aspetta la mia conferma.
```