import java.util.Properties

plugins {
    id("com.android.application")
}

val adsConfig = Properties().apply {
    val configFile = rootProject.file("android/ads.properties")
    if (configFile.exists()) configFile.inputStream().use { load(it) }
}
fun adsValue(envName: String, propertyName: String, fallback: String = ""): String {
    val fromEnvironment = System.getenv(envName)?.trim().orEmpty()
    if (fromEnvironment.isNotEmpty()) return fromEnvironment
    return adsConfig.getProperty(propertyName, fallback).trim()
}

val testAdMobAppId = adsValue("DALILNA_TEST_ADMOB_APP_ID", "test.appId", "ca-app-pub-3940256099942544~3347511713")
val testBannerAdUnitId = adsValue("DALILNA_TEST_ADMOB_BANNER_AD_UNIT_ID", "test.bannerAdUnitId", "ca-app-pub-3940256099942544/9214589741")
val releaseAdMobAppId = adsValue("ADMOB_APP_ID", "release.appId")
val releaseBannerAdUnitId = adsValue("ADMOB_BANNER_AD_UNIT_ID", "release.bannerAdUnitId")

android {
    namespace = "ye.dalilna.app"
    compileSdk = 36

    val workflowRunNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 0
    val workflowAttempt = System.getenv("GITHUB_RUN_ATTEMPT")?.toIntOrNull() ?: 1
    val versionCodeForBuild = 3_100_000 + (workflowRunNumber * 100) + workflowAttempt
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
        targetSdk = 36
        versionCode = versionCodeForBuild
        versionName = "3.1.0"
        manifestPlaceholders["adMobAppId"] = testAdMobAppId
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            manifestPlaceholders["adMobAppId"] = testAdMobAppId
            buildConfigField("String", "ADMOB_APP_ID", "\"$testAdMobAppId\"")
            buildConfigField("String", "ADMOB_BANNER_AD_UNIT_ID", "\"$testBannerAdUnitId\"")
            if (persistentSigning != null) signingConfig = persistentSigning
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            manifestPlaceholders["adMobAppId"] = releaseAdMobAppId.ifBlank { testAdMobAppId }
            buildConfigField("String", "ADMOB_APP_ID", "\"\${releaseAdMobAppId.ifBlank { testAdMobAppId }}\"")
            buildConfigField("String", "ADMOB_BANNER_AD_UNIT_ID", "\"\${releaseBannerAdUnitId.ifBlank { testBannerAdUnitId }}\"")
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

tasks.configureEach {
    if (name == "preReleaseBuild") {
        doFirst {
            check(releaseAdMobAppId.matches(Regex("ca-app-pub-[0-9]{16}~[0-9]{10}"))) {
                "A real ADMOB_APP_ID must be configured before building a release."
            }
            check(releaseBannerAdUnitId.matches(Regex("ca-app-pub-[0-9]{16}/[0-9]{10}"))) {
                "A real ADMOB_BANNER_AD_UNIT_ID must be configured before building a release."
            }
            check(persistentSigning != null) {
                "The persistent Android release keystore is required for a signed release."
            }
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.15.0")
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:3.2.0")
}
