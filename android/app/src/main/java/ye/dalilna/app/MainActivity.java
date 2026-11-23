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
    private boolean homeAdSlotVisible = false;
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
        public void updateHomeBannerPosition(double leftCss, double topCss, double widthCss,
                                             double heightCss, boolean visible) {
            runOnUiThread(() -> positionHomeBanner(leftCss, topCss, widthCss, heightCss, visible));
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

        // The native banner overlays the 320x50 slot at the end of the home view.
        // It remains hidden until that slot enters the visible viewport.
        adView = new AdView(this);
        adView.setAdUnitId(BuildConfig.ADMOB_BANNER_AD_UNIT_ID);
        adView.setAdSize(AdSize.BANNER);
        adView.setBackgroundColor(android.graphics.Color.rgb(24, 20, 17));
        adView.setVisibility(View.GONE);
        FrameLayout.LayoutParams adParams = new FrameLayout.LayoutParams(
                dp(320), dp(50), Gravity.TOP | Gravity.LEFT);
        rootLayout.addView(adView, adParams);
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
                    () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, formError -> {
                        updatePrivacyOptionsVisibility();
                        requestAdsIfAllowed();
                    }),
                    requestConsentError -> {
                        updatePrivacyOptionsVisibility();
                        // UMP may use a still-valid consent choice from an earlier session.
                        requestAdsIfAllowed();
                    }
            );
        } catch (RuntimeException error) {
            // Ads stay unavailable when consent cannot be established.
            updatePrivacyOptionsVisibility();
        }
    }

    private void updatePrivacyOptionsVisibility() {
        if (webView == null) return;
        boolean required = consentInformation != null
                && consentInformation.getPrivacyOptionsRequirementStatus()
                == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
        String script = "(function(){var button=document.getElementById('privacyOptionsEntry');"
                + "if(button)button.hidden=" + (!required) + ";})();";
        webView.evaluateJavascript(script, null);
    }

    private void openPrivacyOptionsForm() {
        if (consentInformation == null) return;
        UserMessagingPlatform.showPrivacyOptionsForm(this, formError -> {
            updatePrivacyOptionsVisibility();
            requestAdsIfAllowed();
        });
    }

    private void requestAdsIfAllowed() {
        if (adsInitialized || consentInformation == null || !consentInformation.canRequestAds()) return;
        adsInitialized = true;
        MobileAds.initialize(this, initializationStatus -> runOnUiThread(() -> {
            adsSdkReady = true;
            if (homeAdSlotVisible) loadBannerAd();
        }));
    }

    private void positionHomeBanner(double leftCss, double topCss, double widthCss,
                                    double heightCss, boolean visible) {
        if (rootLayout == null || webView == null || adView == null) return;
        homeAdSlotVisible = visible && heightCss >= 50.0;
        if (!homeAdSlotVisible || !adsSdkReady || isFinishing()) {
            adView.setVisibility(View.GONE);
            return;
        }

        float density = getResources().getDisplayMetrics().density;
        int bannerWidth = dp(320);
        int bannerHeight = dp(50);
        int slotLeft = webView.getLeft() + Math.round((float) leftCss * density);
        int slotWidth = Math.round((float) widthCss * density);
        int left = slotLeft + Math.max(0, (slotWidth - bannerWidth) / 2);
        int top = webView.getTop() + Math.round((float) topCss * density);
        int rootWidth = rootLayout.getWidth();
        if (rootWidth > 0) left = Math.max(0, Math.min(left, Math.max(0, rootWidth - bannerWidth)));
        else left = Math.max(0, left);

        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) adView.getLayoutParams();
        params.width = bannerWidth;
        params.height = bannerHeight;
        params.leftMargin = left;
        params.topMargin = top;
        params.gravity = Gravity.TOP | Gravity.LEFT;
        adView.setLayoutParams(params);

        if (adLoaded) {
            adView.setVisibility(View.VISIBLE);
        } else if (!adRequested) {
            loadBannerAd();
        }
    }

    private void loadBannerAd() {
        if (adView == null || isFinishing() || !adsSdkReady || !homeAdSlotVisible || adRequested) return;
        adRequested = true;
        adView.setAdSize(AdSize.BANNER);
        adView.setAdListener(new AdListener() {
            @Override
            public void onAdLoaded() {
                runOnUiThread(() -> {
                    if (adView == null) return;
                    adLoaded = true;
                    adView.setVisibility(homeAdSlotVisible ? View.VISIBLE : View.GONE);
                });
            }

            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                runOnUiThread(() -> {
                    if (adView == null) return;
                    adLoaded = false;
                    adRequested = false;
                    adView.setVisibility(View.GONE);
                });
            }
        });
        adView.loadAd(new AdRequest.Builder().build());
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
        if (adView != null) adView.pause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (adView != null) adView.resume();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (adView != null) {
            adView.destroy();
            adView = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
