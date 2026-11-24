# Play Console Upload Checklist

> **File di riferimento per upload su Google Play Console** - Aggiornato per la versione corrente

## 📱 Dati Applicazione

| Campo | Valore |
|-------|--------|
| **Nome App** | moVeerAI |
| **Package Name (Android)** | `com.moveer.myapp` |
| **Bundle ID (iOS)** | `com.moveerai.app` |
| **Versione Corrente** | 1.9.0 |
| **Version Code (Android)** | 11 (pronto per upload) |
| **Versione Precedente** | 1.8.0 (versionCode 10) |

---

## 🔧 Configurazione Build Android

### 1. Aggiorna versionCode
Il `versionCode` deve essere **maggiore** del precedente upload. 

**ATTENZIONE**: versionCode 7 è già stato usato per upload precedente. Usa un valore non ancora utilizzato (es. 9).

Aggiorna in `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "com.moveer.myapp"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 9        // ← Usa un valore non ancora utilizzato
    versionName "1.7"   // ← Nuova versione
}
```

### 2. Verifica applicationId
Conferma che in `android/app/build.gradle` sia impostato:
```gradle
applicationId "com.moveer.myapp"
```

### 3. Genera AAB (Android App Bundle)
```bash
# 1. Assicurati che .env.local sia configurato correttamente
npm run build

# 2. Sinchronizza Capacitor
npm run cap:sync:android

# 3. Genera AAB
cd android
./gradlew bundleRelease
```

Il file AAB sarà in: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 🔐 Firma dell'App

### Requisiti
- Keystore: `moveerai-upload-2026.p12` (o nuovo keystore registato in Play Console)
- Alias: `moveer-upload`
- Password: controlla `android/keystore.properties`

### Verifica firma
```bash
# Verifica certificato hash
keytool -list -v -keystore ~/.android/moveerai-upload-2026.p12 -alias moveer-upload
```

---

## 💰 Prodotti Google Play (Abilita in Play Console)

Gli stessi prodotti configurati in RevenueCat per iOS devono essere attivi in Google Play:

| Prodotto | ID Prodotto | Tipo |
|----------|-------------|------|
| Pro Mensile | `pro-monthly` | Abbonamento |
| Pro Annuale | `pro-annual` | Abbonamento |
| Coach Mensile | `coach-monthly` | Abbonamento |
| Coach Annuale | `coach-annual` | Abbonamento |

### Passi in Play Console
1. **Products** → ** Subscriptions** → Aggiungi tutti e 4 i prodotti
2. Ogni prodotto deve avere:
   - Base plan attivo
   - Offerte attive con prezzi localizzati
3. **Setup** → **Billing** → Verifica che il billing sia attivo

---

## 📋 Checklist Upload Play Console

### Prima dell'upload
- [ ] versionCode incrementato (`android/app/build.gradle`)
- [ ] versionName aggiornato (se necessario)
- [ ] AAB generato con successo
- [ ] Keystore configurato in `android/keystore.properties`
- [ ] Build testata su dispositivo reale con ARCore support
- [ ] Tutti i prodotti abbonamento creati in Play Console

### Durante l'upload
- [ ] Carica il file AAB
- [ ] Seleziona la **chiave di firma upload** corretta (stellata)
- [ ] Completa il processo di revisione

### Dopo l'upload (Internal Test Track)
- [ ] Test su dispositivo reale con:
  - [ ] Installazione dall'Internal Test Track
  - [ ] Accesso all'app
  - [ ] Verifica dei prodotti in App Signing
  - [ ] Funzionalità di postura e analisi video
  - [ ] Acquisto test di abbonamento (se possibile)

---

## 🔧 Configurazione Richiesta

### Variabili d'ambiente (`.env.local`)
Assicurati che siano impostate:

```env
VITE_SUPABASE_URL=https://rvikwxhvxsxvrvxxjqrs.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SITE_URL=https://app.moveer.eu
VITE_REVENUECAT_IOS_API_KEY=...
VITE_APPLE_PRO_MONTHLY_PRODUCT_ID=pro-monthly
VITE_APPLE_PRO_ANNUAL_PRODUCT_ID=pro-annual
VITE_APPLE_COACH_MONTHLY_PRODUCT_ID=coach-monthly
VITE_APPLE_COACH_ANNUAL_PRODUCT_ID=coach-annual
```

---

## 🚨 Note Importanti

1. **Application ID**: Android usa `com.moveer.myapp`, iOS usa `com.moveerai.app` - **NON CAMBIARE**
2. **Service Account**: La chiave `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` deve essere nei secrets Supabase (non nel repository)
3. **Prodotto Bundle ID**: Deve corrispondere esattamente a `com.moveer.myapp` in tutti i prodotti Play Console
4. **ARCore Depth API**: L'app richiede dispositivi Android compatibili con ARCore Depth

---

## 📞 Supporto Tecnico

- **Repository**: [gin-droid/moveer](https://github.com/gin-droid/moveer)
- **Supabase Project**: rvikwxhvxsxvrvxxjqrs
- **Dominio**: app.moveer.eu

---

*Last updated: November 2026*
*Versione corrente: 1.9.0 (versionCode 11)*
*Versione precedente: 1.8.0 (versionCode 10)*

## ⚠️ ATTENZIONE - Version Code

**versionCode 10** è già stato utilizzato per upload precedente. 

Il prossimo upload deve usare **versionCode 11 o superiore**.

Aggiorna in `android/app/build.gradle`:
```gradle
versionCode 11        // ← Usa un valore non ancora utilizzato
versionName "1.9"    // ← Nuova versione
```

---

## ⚙️ Ottimizzazioni R8 per Dimensione Massima

Sono state applicate le seguenti ottimizzazioni per ridurre al massimo la dimensione dell'app:

### Configurazioni Aggiunte

1. **`gradle.properties`**: Aggiunte ottimizzazioni R8, shrinkResources, e caching
2. **`android/app/build.gradle`**: Configurazione R8 standard
3. **`android/app/proguard-rules.pro`**: Aggiornate regole per mantenere solo classi necessarie

### File di Riferimento
- **`r8-optimization.properties`**: Configurazioni R8 dedicate
- **`OPTIMIZATIONS_R8.md`**: Documentazione completa ottimizzazioni

### Risultati Attesi
- **Dimensione AAB**: ~30MB
- **Version**: 1.9 (versionCode 11)

### Verifica Build
```bash
npm run build
npm run cap:sync:android
cd android
./gradlew bundleRelease
```