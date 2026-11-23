plugins {
    id("com.android.application")
}

android {
    namespace = "ye.dalilna.app"
    compileSdk = 35

    val workflowRunNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 0
    val persistentKeystorePath = System.getenv("ANDROID_KEYSTORE_FILE")
    val persistentSigning = if (!persistentKeystorePath.isNullOrBlank()) {
        signingConfigs.create("persistent") {
            storeFile = file(persistentKeystorePath)
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
        }
    } else null

    defaultConfig {
        applicationId = "ye.dalilna.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 3_000_000 + (workflowRunNumber * 100) + (System.getenv("GITHUB_RUN_ATTEMPT")?.toIntOrNull() ?: 1)
        versionName = "3.0.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            if (persistentSigning != null) signingConfig = persistentSigning
        }
        release {
            isMinifyEnabled = false
            if (persistentSigning != null) signingConfig = persistentSigning
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.15.0")
}
