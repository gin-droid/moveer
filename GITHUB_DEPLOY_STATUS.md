# moVeerAI - GitHub Actions Deploy Status

## 🚀 Stato Deploy

**Versione App**: 1.9
**Version Code**: 11

## 📱 File Build Generati

### Web App (GitHub Pages)
- **Build**: ✅ Pronta per deploy
- **Comando**: `npm run build`
- **Output**: `dist/`
- **URL**: https://app.moveer.eu

### Android App
- **AAB**: ✅ Generato
- **File**: `android/app/build/outputs/bundle/release/app-release.aab`
- **Version**: 1.9 (versionCode 11)
- **Dimensione**: ~34MB

## 🔄 GitHub Actions Workflows

### Deploy Frontend (deploy.yml)
- **Trigger**: Push su branch `main`
- **Build**: Verifica variabili ambiente
- **Output**: GitHub Pages automatico

### CI Workflow (ci.yml)
- **Lint**: ✅ Eseguito
- **Typecheck**: ✅ Passato
- **Test**: ✅ Passati
- **Audit**: ✅ Dipendenze verificate

## 📋 Passi per Deploy su GitHub

1. **Commit e push su main branch**:
   ```bash
   git add .
   git commit -m "Release v1.9 - versionName 1.9, versionCode 11"
   git push origin main
   ```

2. **Workflow si attiverà automaticamente**:
   - CI verificherà il codice
   - Build genererà assets in `dist/`
   - Deploy pubblicherà su GitHub Pages

## 🔧 Configurazione Richiesta

Assicurati che queste variabili siano impostate in GitHub:

| Variabile | Valore |
|-----------|--------|
| `VITE_SUPABASE_URL` | https://rvikwxhvxsxvrvxxjqrs.supabase.co |
| `VITE_SUPABASE_ANON_KEY` | [Chiave anon] |
| `VITE_SITE_URL` | https://app.moveer.eu |
| `VITE_TURNSTILE_SITE_KEY` | [Chiave Turnstile, opzionale] |

## 📊 Verifica Post-Deploy

1. **Verifica URL**: https://app.moveer.eu
2. **Verifica Service Worker**: https://app.moveer.eu/sw.js
3. **Verifica Manifest**: https://app.moveer.eu/manifest.json

---
*File generato: Novembre 2026*
*Versione corrente: 1.9 (versionCode 11)*