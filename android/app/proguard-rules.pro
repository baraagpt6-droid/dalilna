# Keep the Android activity and the JavascriptInterface contract used by the WebView.
-keep class ye.dalilna.app.MainActivity { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve runtime annotations used by platform and SDK integrations.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Google Mobile Ads and UMP publish their own consumer keep rules. Do not
# blanket-keep all Google Play services packages; this keeps R8 effective.
