# moVeerAI - Play Console Upload Status
# File: UPLOAD_STATUS.md
# Aggiornamento automatico dello stato dell'upload

## 📱 Versione Corrente

| Campo | Valore |
|-------|--------|
| **Nome App** | moVeerAI |
| **Package Name (Android)** | com.moveer.myapp |
| **Versione** | 1.9 |
| **Version Code** | 11 |
| **Build Type** | Release |
| **Data Build** | 2024-11-24 |
| **AAB Generato** | ✅ Sì |

## 📦 File AAB per Upload

**Percorso**: `android/app/build/outputs/bundle/release/app-release.aab`

**Dimensione**: 34MB

**Prima dell'upload verifica**:
- [x] ✅ AAB generato con versionCode 11
- [ ] Test su dispositivo Android con ARCore
- [ ] Funzionalità acquisto RevenueCat testate
- [ ] Analisi video e postura funzionanti

## 🚀 Comandi Build

```bash
npm run build
npm run cap:sync:android
cd android
./gradlew bundleRelease
```

## 📋 Prossimi Passi per Play Console

1. **Accedi a Google Play Console**
2. **Vai a Internal testing o Production**
3. **Crea nuova release**
4. **Carica AAB da**: `android/app/build/outputs/bundle/release/app-release.aab`
5. **Seleziona chiave di firma upload**
6. **Completa notes e sottometti per revisione**

## 🔗 Link Utili

- Play Console: https://play.google.com/console
- App: com.moveer.myapp
- Supabase: rvikwxhvxsxvrvxxjqrs

---
*File generato automaticamente - Non modificare manualmente*