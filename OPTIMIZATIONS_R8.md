# Ottimizzazioni R8 per moVeerAI Android

Questo documento descrive le ottimizzazioni R8 configurate per massimizzare le prestazioni e ridurre la dimensione dell'app Android.

## 📊 Obiettivi

1. **Ridurre la dimensione dell'AAB** (attualmente 34MB)
2. **Mantenere le funzionalità ARCore/Depth API**
3. **Preservare le funzionalità di acquisto RevenueCat**
4. **Mantenere la compatibilità con Capacitor**

## 🔧 Configurazioni Applyate

### 1. gradle.properties
File: `gradle.properties`

```properties
android.enableR8=true
android.optimizeR8=true
android.enableD8HybridDexing=true
android.enableIncrementalDesugaring=true
android.enableResourceProcessing=true
android.resources.shrink=true
android.debuggable=false
android.enableAapt2=true
android.enableR8.fullMode=true
```

### 2. build.gradle (app)
File: `android/app/build.gradle`

```gradle
buildTypes {
    release {
        minifyEnabled true              // Abilita R8
        shrinkResources true            // Rimuove risorse non utilizzate
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 3. proguard-rules.pro
File: `android/app/proguard-rules.pro`

Regole per mantenere classi critiche:
- Capacitor framework
- RevenueCat Purchases
- ARCore/Sceneform
- Three.js (visualizzazioni 3D)
- ML Kit (analisi video)
- Depth Scanner plugin

## 📈 Risultati Attesi

### Dimensione
- **Riduzione stimata**: 10-15% della dimensione dell'app
- **AAB risultante**: ~30MB (prima: 34MB)

### Prestazioni
- **Startup time**: Miglioramento grazie a code optimization
- **Memoria runtime**: Minimizzazione del footprint
- **DVM/ART**: Ottimizzazione del bytecode

## 🔍 Verifica Build

Dopo le modifiche, ricostruisci l'app:

```bash
npm run build
npm run cap:sync:android
cd android
./gradlew bundleRelease
```

Controlla la dimensione dell'AAB:
```
ls -lh android/app/build/outputs/bundle/release/app-release.aab
```

## ⚠️ Note Importanti

1. **Test obbligatorio**: Dopo ogni ottimizzazione, testa l'app su:
   - Dispositivo reale con ARCore
   - Funzionalità di acquisto (RevenueCat)
   - Analisi video e postura

2. **Se trovi problemi**: Aggiungi regole `-keep` nel proguard-rules.pro

3. **VersionCode**: Ricorda di incrementare versionCode per ogni nuovo upload

## 🛠️ Troubleshooting

### App si chiude inaspettatamente
Aggiungi regole per la classe specifica:
```proguard
-keep class com.tuo.package.** { *; }
```

### ARCore non funziona
Verifica che queste regole siano presenti:
```proguard
-keep class com.google.ar.** { *; }
-keep class com.google.ar.sceneform.** { *; }
```

### Acquisti non funzionano
Verifica RevenueCat rules:
```proguard
-keep class com.revenuecat.purchases.** { *; }
```

## 📚 Riferimenti

- [R8 Optimization Guide](https://developer.android.com/studio/build/shrink-code)
- [ProGuard Manual](https://www.guardsquare.com/en/manual)
- [Capacitor Android](https://capacitorjs.com/docs/android)

---
*Last updated: November 2026*
*Versione corrente: 1.8 (versionCode 10)*
*Versione precedente: 1.7 (versionCode 9)*

## 🔄 Aggiornamento Versione

**Nuove versioni impostate**:
- Versione: 1.8
- versionCode: 10