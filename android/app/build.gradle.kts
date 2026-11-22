plugins {
    id("com.android.application")
}

android {
    namespace = "ye.dalilna.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ye.dalilna.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 270
        versionName = "2.7.0"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
            // Release signing is intentionally not configured here.
            // Use a private keystore and GitHub Secrets before public release.
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
