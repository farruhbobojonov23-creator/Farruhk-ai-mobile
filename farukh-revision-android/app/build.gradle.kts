plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.farukh.revision"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.farukh.revision"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.6.8"
    }
    signingConfigs {
        create("releasePermanent") {
            val signingPath = System.getenv("REVISION_KEYSTORE_PATH")
            if (!signingPath.isNullOrBlank()) {
                storeFile = file(signingPath)
                storePassword = System.getenv("REVISION_STORE_PASS")
                keyAlias = System.getenv("REVISION_KEY_ALIAS")
                keyPassword = System.getenv("REVISION_KEY_PASS")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // Release APK is only distributable when the ORIGINAL certificate
            // is available. Never silently replace the signing identity.
            if (!System.getenv("REVISION_KEYSTORE_PATH").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("releasePermanent")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { jvmToolchain(17) }
