package ye.dalilna.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.Toast;

import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import androidx.webkit.WebViewAssetLoader;
import androidx.core.view.WindowCompat;

public class MainActivity extends Activity {
    private static final int REQ_AUDIO = 301;
    private static final int REQ_LOCATION = 302;
    private static final int REQ_FILE = 303;
    private static final String REMOTE_APP_URL = "https://baraagpt6-droid.github.io/dalilna/";
    private static final String LEGACY_NETLIFY_APP_URL = "https://dalilna-ftny.netlify.app/";
    private static final String LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/index.html";
    private static final String PREFS = "dalilna_web_runtime";
    private static final String KEY_STORAGE = "local_storage_snapshot";
    private static final String KEY_REMOTE_READY = "remote_content_ready";
    private static final String KEY_ORIGIN_MIGRATION_DONE = "official_origin_migration_done";
    private static final String KEY_LAST_REMOTE_ATTEMPT = "last_remote_attempt_ms";
    private static final int MAX_STORAGE_BYTES = 4 * 1024 * 1024;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private FrameLayout rootLayout;
    private AdView adView;
    private ConsentInformation consentInformation;
    private boolean adsInitialized = false;
    private boolean adsSdkReady = false;
    private boolean adRequested = false;
    private boolean adLoaded = false;
    private boolean detailScreenVisible = false;
    private boolean adsDestroyed = false;
    private boolean adViewPaused = true;
    private android.content.SharedPreferences preferences;
    private boolean fallbackLoading = false;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private ValueCallback<Uri[]> fileChooserCallback;

    private final class DalilnaNativeBridge {
        @JavascriptInterface
        public int getVersionCode() {
            return BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public String getVersionName() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public String loadLocalStorage() {
            return preferences.getString(KEY_STORAGE, "{}");
        }

        @JavascriptInterface
        public void saveLocalStorage(String snapshot) {
            if (snapshot == null || snapshot.length() > MAX_STORAGE_BYTES) return;
            try {
                preferences.edit().putString(KEY_STORAGE, snapshot).apply();
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void markRemoteReady() {
            preferences.edit().putBoolean(KEY_REMOTE_READY, true).apply();
        }

        @JavascriptInterface
        public void switchToRemote() {
            runOnUiThread(() -> {
                if (webView == null) return;
                String current = webView.getUrl();
                if (current == null || !current.startsWith("https://appassets.androidplatform.net/")) return;
                long last = preferences.getLong(KEY_LAST_REMOTE_ATTEMPT, 0L);
                long now = System.currentTimeMillis();
                if (now - last < 30000L) return;
                preferences.edit().putLong(KEY_LAST_REMOTE_ATTEMPT, now).apply();
                fallbackLoading = false;
                webView.loadUrl(REMOTE_APP_URL);
            });
        }

        @JavascriptInterface
        public void setDetailBannerVisible(boolean visible) {
            runOnUiThread(() -> setDetailBannerVisibleOnUi(visible));
        }

        @JavascriptInterface
        public void showPrivacyOptionsForm() {
            runOnUiThread(MainActivity.this::openPrivacyOptionsForm);
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(24, 20, 17));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(18, 14, 12));

        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(android.graphics.Color.rgb(24, 20, 17));

        webView = new WebView(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Standard banner: bottom-center, shown only while the details dialog is open.
        try {
            adView = new AdView(this);
            adView.setAdUnitId(BuildConfig.ADMOB_BANNER_AD_UNIT_ID);
            adView.setAdSize(AdSize.BANNER);
            adView.setBackgroundColor(android.graphics.Color.rgb(24, 20, 17));
            adView.setVisibility(View.GONE);
            FrameLayout.LayoutParams adParams = new FrameLayout.LayoutParams(
                    dp(320), dp(50), Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
            rootLayout.addView(adView, adParams);
        } catch (RuntimeException ignored) {
            adView = null;
        }
        setContentView(rootLayout);
        beginAdsConsentFlow();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
        }

        webView.addJavascriptInterface(new DalilnaNativeBridge(), "DalilnaNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isTrustedAppUrl(uri)) return false;
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
                if ("https".equals(scheme) || "http".equals(scheme) || "tel".equals(scheme) || "mailto".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "لا يوجد تطبيق مناسب لفتح الرابط", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame() && isLegacyNetlifyAppUrl(request.getUrl())
                        && !preferences.getBoolean(KEY_ORIGIN_MIGRATION_DONE, false)) {
                    preferences.edit().putBoolean(KEY_ORIGIN_MIGRATION_DONE, true).apply();
                    view.loadUrl(REMOTE_APP_URL);
                } else if (request.isForMainFrame() && isRemoteAppUrl(request.getUrl())) {
                    loadLocalFallback();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
                super.onReceivedHttpError(view, request, response);
                if (request.isForMainFrame() && response.getStatusCode() >= 400
                        && isLegacyNetlifyAppUrl(request.getUrl())
                        && !preferences.getBoolean(KEY_ORIGIN_MIGRATION_DONE, false)) {
                    preferences.edit().putBoolean(KEY_ORIGIN_MIGRATION_DONE, true).apply();
                    view.loadUrl(REMOTE_APP_URL);
                } else if (request.isForMainFrame() && response.getStatusCode() >= 400 && isRemoteAppUrl(request.getUrl())) {
                    loadLocalFallback();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Uri finishedUri = Uri.parse(url);
                if (isLegacyNetlifyAppUrl(finishedUri)
                        && !preferences.getBoolean(KEY_ORIGIN_MIGRATION_DONE, false)) {
                    captureLegacyStorageAndOpenOfficial(view);
                } else if (isRemoteAppUrl(finishedUri)) {
                    fallbackLoading = false;
                    preferences.edit().putBoolean(KEY_REMOTE_READY, true)
                            .putBoolean(KEY_ORIGIN_MIGRATION_DONE, true).apply();
                } else if (url.startsWith("https://appassets.androidplatform.net/assets/")) {
                    fallbackLoading = false;
                }
                updatePrivacyOptionsVisibility();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean onlyAudio = request.getResources().length > 0;
                    for (String resource : request.getResources()) {
                        if (!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) onlyAudio = false;
                    }
                    if (!onlyAudio) {
                        request.deny();
                    } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_AUDIO);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "اختر صورة"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
            }
        });

        boolean migrated = preferences.getBoolean(KEY_REMOTE_READY, false);
        boolean originMigrationDone = preferences.getBoolean(KEY_ORIGIN_MIGRATION_DONE, false);
        if (migrated && !originMigrationDone) {
            preferences.edit().putLong(KEY_LAST_REMOTE_ATTEMPT, System.currentTimeMillis()).apply();
            // Visit the previous Netlify origin once to copy its WebView localStorage into native storage.
            webView.loadUrl(LEGACY_NETLIFY_APP_URL);
        } else if (migrated) {
            preferences.edit().putLong(KEY_LAST_REMOTE_ATTEMPT, System.currentTimeMillis()).apply();
            webView.loadUrl(REMOTE_APP_URL);
        } else {
            // Load the bundled origin once so its localStorage can be copied before switching to GitHub Pages.
            webView.loadUrl(LOCAL_APP_URL);
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void beginAdsConsentFlow() {
        try {
            consentInformation = UserMessagingPlatform.getConsentInformation(this);
            ConsentRequestParameters parameters = new ConsentRequestParameters.Builder().build();
            consentInformation.requestConsentInfoUpdate(
                    this,
                    parameters,
                    () -> {
                        // This callback is asynchronous, so guard UMP calls inside the callback too.
                        try {
                            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                                try {
                                    updatePrivacyOptionsVisibility();
                                    if (detailScreenVisible) requestAdsIfAllowed();
                                } catch (RuntimeException ignored) { }
                            });
                        } catch (RuntimeException ignored) {
                            updatePrivacyOptionsVisibility();
                            if (detailScreenVisible) requestAdsIfAllowed();
                        }
                    },
                    requestConsentError -> {
                        try {
                            updatePrivacyOptionsVisibility();
                            if (detailScreenVisible) requestAdsIfAllowed();
                        } catch (RuntimeException ignored) { }
                    }
            );
        } catch (RuntimeException error) {
            // Consent failure disables ads only; the directory remains usable.
            try { updatePrivacyOptionsVisibility(); } catch (RuntimeException ignored) { }
        }
    }

    private void updatePrivacyOptionsVisibility() {
        try {
            if (webView == null || adsDestroyed) return;
            boolean required = consentInformation != null
                    && consentInformation.getPrivacyOptionsRequirementStatus()
                    == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
            String script = "(function(){var button=document.getElementById('privacyOptionsEntry');"
                    + "if(button)button.hidden=" + (!required) + ";})();";
            webView.evaluateJavascript(script, null);
        } catch (RuntimeException ignored) { }
    }

    private void openPrivacyOptionsForm() {
        try {
            if (consentInformation == null || adsDestroyed || isFinishing()) return;
            UserMessagingPlatform.showPrivacyOptionsForm(this, formError -> {
                try {
                    updatePrivacyOptionsVisibility();
                    if (detailScreenVisible) requestAdsIfAllowed();
                } catch (RuntimeException ignored) { }
            });
        } catch (RuntimeException ignored) { }
    }

    private void requestAdsIfAllowed() {
        try {
            if (!detailScreenVisible || adsInitialized || consentInformation == null || adsDestroyed
                    || isFinishing() || !consentInformation.canRequestAds()) return;
            adsInitialized = true;
            MobileAds.initialize(this, initializationStatus -> {
                try {
                    runOnUiThread(() -> {
                        try {
                            if (adsDestroyed || isFinishing()) return;
                            adsSdkReady = true;
                            if (detailScreenVisible) loadBannerAd();
                        } catch (RuntimeException ignored) { }
                    });
                } catch (RuntimeException ignored) { }
            });
        } catch (RuntimeException ignored) {
            adsInitialized = false;
            adsSdkReady = false;
        }
    }

    private void setDetailBannerVisibleOnUi(boolean visible) {
        detailScreenVisible = visible;
        try {
            if (adView == null || adsDestroyed || isFinishing()) return;
            if (!visible) {
                adView.setVisibility(View.GONE);
                pauseDetailBanner();
                return;
            }

            resumeDetailBanner();
            if (adLoaded) {
                adView.setVisibility(View.VISIBLE);
            } else {
                adView.setVisibility(View.INVISIBLE);
                if (adsSdkReady) loadBannerAd();
                else requestAdsIfAllowed();
            }
        } catch (RuntimeException ignored) {
            try { if (adView != null) adView.setVisibility(View.GONE); }
            catch (RuntimeException ignoredAgain) { }
        }
    }

    private void pauseDetailBanner() {
        if (adView == null || adsDestroyed || adViewPaused) return;
        try {
            adView.pause();
            adViewPaused = true;
        } catch (RuntimeException ignored) {
            // Keep the banner hidden even when the SDK cannot pause cleanly.
            adViewPaused = true;
        }
    }

    private void resumeDetailBanner() {
        if (adView == null || adsDestroyed || !adViewPaused) return;
        try {
            adView.resume();
            adViewPaused = false;
        } catch (RuntimeException ignored) {
            adViewPaused = true;
        }
    }

    private void loadBannerAd() {
        try {
            if (adView == null || adsDestroyed || isFinishing() || !adsSdkReady
                    || !detailScreenVisible || adRequested) return;
            adRequested = true;
            adView.setAdListener(new AdListener() {
                @Override
                public void onAdLoaded() {
                    try {
                        runOnUiThread(() -> {
                            try {
                                if (adView == null || adsDestroyed) return;
                                adLoaded = true;
                                adView.setVisibility(detailScreenVisible ? View.VISIBLE : View.GONE);
                            } catch (RuntimeException ignored) { }
                        });
                    } catch (RuntimeException ignored) { }
                }

                @Override
                public void onAdFailedToLoad(LoadAdError error) {
                    try {
                        runOnUiThread(() -> {
                            try {
                                if (adView == null || adsDestroyed) return;
                                adLoaded = false;
                                adRequested = false;
                                adView.setVisibility(View.GONE);
                            } catch (RuntimeException ignored) { }
                        });
                    } catch (RuntimeException ignored) { }
                }
            });
            adView.loadAd(new AdRequest.Builder().build());
        } catch (RuntimeException ignored) {
            adRequested = false;
            adLoaded = false;
            try { if (adView != null) adView.setVisibility(View.GONE); }
            catch (RuntimeException ignoredAgain) { }
        }
    }

    private void captureLegacyStorageAndOpenOfficial(WebView view) {
        String script = "(function(){try{"
                + "var snapshot={};"
                + "for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);if(key!==null)snapshot[key]=localStorage.getItem(key);}"
                + "var json=JSON.stringify(snapshot);"
                + "if(json.length>4194304)return false;"
                + "window.DalilnaNative.saveLocalStorage(json);return true;"
                + "}catch(_){return false;}})()";
        view.evaluateJavascript(script, result -> {
            preferences.edit().putBoolean(KEY_ORIGIN_MIGRATION_DONE, true).apply();
            if (webView != null) webView.postDelayed(() -> webView.loadUrl(REMOTE_APP_URL), 250L);
        });
    }

    private boolean isRemoteAppUrl(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())
                || !"baraagpt6-droid.github.io".equalsIgnoreCase(uri.getHost())) return false;
        String path = uri.getPath();
        return path != null && ("/dalilna".equals(path) || "/dalilna/".equals(path) || path.startsWith("/dalilna/"));
    }

    private boolean isLegacyNetlifyAppUrl(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && "dalilna-ftny.netlify.app".equalsIgnoreCase(uri.getHost());
    }

    private boolean isTrustedAppUrl(Uri uri) {
        return uri != null && ("appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
                || isRemoteAppUrl(uri) || isLegacyNetlifyAppUrl(uri));
    }

    private void loadLocalFallback() {
        if (webView == null || fallbackLoading) return;
        fallbackLoading = true;
        webView.post(() -> {
            if (webView != null) webView.loadUrl(LOCAL_APP_URL);
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_AUDIO && pendingWebPermission != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) pendingWebPermission.grant(pendingWebPermission.getResources());
            else pendingWebPermission.deny();
            pendingWebPermission = null;
        } else if (requestCode == REQ_LOCATION && pendingGeoCallback != null) {
            boolean granted = false;
            for (int result : grantResults) if (result == PackageManager.PERMISSION_GRANTED) granted = true;
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileChooserCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
        }
    }

    @Override
    protected void onPause() {
        if (detailScreenVisible) pauseDetailBanner();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (detailScreenVisible) {
            resumeDetailBanner();
            try {
                if (adView != null && !adsDestroyed) {
                    if (adLoaded) adView.setVisibility(View.VISIBLE);
                    else if (adsSdkReady) loadBannerAd();
                }
            } catch (RuntimeException ignored) { }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        adsDestroyed = true;
        detailScreenVisible = false;
        adViewPaused = true;
        try {
            if (adView != null) {
                adView.setVisibility(View.GONE);
                adView.destroy();
                adView = null;
            }
        } catch (RuntimeException ignored) { }
        try {
            if (webView != null) {
                webView.stopLoading();
                webView.loadUrl("about:blank");
                webView.destroy();
                webView = null;
            }
        } catch (RuntimeException ignored) { }
        super.onDestroy();
    }
}
