pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

rootProject.name = "moveer-ai"
include ":app"
include ":capacitor-cordova-android-plugins"
project(":capacitor-cordova-android-plugins").projectDir = file("./android/capacitor-cordova-android-plugins/")

// Java toolchain configuration
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}
