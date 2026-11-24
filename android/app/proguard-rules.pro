# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# =============================================================================
# OTTIMIZZAZIONI R8 AGGIORNATATE PER moVeerAI
# Versione 1.8 con versionCode 10
# =============================================================================

# Mantieni annotazioni necessarie per Capacitor e plugin
-keepattributes *Annotation*
-keep class com.getcapacitor.** { *; }

# RevenueCat Purchases - necessario per funzionalità acquisti
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecat.purchases.hybridcommon.** { *; }
-keep interface com.revenuecat.purchases.** { *; }

# JavascriptInterface per WebView (necessario per Capacitor)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# =============================================================================
# Ottimizzazioni specifiche per moVeerAI
# =============================================================================

# Mantieni classi necessarie per l'analisi video e posa 3D
-keep class com.moveerai.** { *; }

# Mantieni classi per ARCore
-keep class com.google.ar.** { *; }
-keep class com.google.ar.sceneform.** { *; }
-keep class com.google.ar.sceneform.rendering.** { *; }
-keep class com.google.ar.sceneform.math.** { *; }
-keep class com.google.ar.core.** { *; }

# Mantieni classi per depth scanner plugin
-keep class com.moveeraidepthscanner.** { *; }
-keep class com.getcapacitor.plugin.moveeraidepthscanner.** { *; }

# Mantieni classi per Capacitor Camera e Filesystem
-keep class com.getcapacitor.camera.** { *; }
-keep class com.getcapacitor.filesystem.** { *; }
-keep class com.getcapacitor.share.** { *; }

# Mantieni classi per Three.js (necessario per visualizzazioni 3D)
-keep class THREE.** { *; }
-keep class org.json.** { *; }

# Mantieni classi per analisi video ML Kit
-keep class com.google.mlkit.** { *; }
-keep class com.google.mlkit.vision.** { *; }

# Mantieni classi per ARCore Depth API
-keep class com.google.ar.core.CameraConfig.** { *; }
-keep class com.google.ar.core.Anchor.** { *; }

# Mantieni metodi per reflection necessari a React e Capacitor
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Mantieni classi per Gson serializzazione (se usato)
-keep class com.google.gson.** { *; }

# Mantieni WebView - necessario per Capacitor
-keep class android.webkit.WebView { *; }
