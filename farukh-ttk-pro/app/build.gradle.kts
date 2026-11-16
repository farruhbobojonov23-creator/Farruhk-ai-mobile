plugins { id("com.android.application") }
android {
    namespace = "com.farukh.ttkpro"
    compileSdk = 35
    defaultConfig {
        applicationId = if (project.hasProperty("qaPreview")) "com.farukh.ttkpro.premium.qa" else "com.farukh.ttkpro.premium"
        manifestPlaceholders["appLabel"] = if (project.hasProperty("qaPreview")) "FARUKH TTK PRO TEST" else "FARUKH TTK PRO"
        minSdk = 26
        targetSdk = 34
        versionCode = 6
        versionName = "0.6-regulatory-beta"
    }
}
