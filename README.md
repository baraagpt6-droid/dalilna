# دليلنا | Dalilna

دليل محلي للخدمات والمحلات والوظائف وسوق البيع والشراء في اليمن، مع تغطية مديرية حبيش وعزلها، وبيانات المديريات والمحافظات المرجعية.

## الإصدار

- Version: 1.5.3
- Web app: PWA (installable from supported browsers)
- Android: WebView application source included in `android/`
- Offline: cached application shell and local device storage

## تجربة التطبيق

افتح `index.html` عبر HTTPS أو عبر خادم محلي. تثبيت PWA يتطلب HTTPS (أو localhost للتطوير). GitHub Pages workflow publishes only the site files.

## دخول المشرف

افتح قائمة الحساب من أيقونة الشخص، ثم اختر «دخول المشرف». لم يعد الدخول يعتمد على الضغط المطوّل على الشعار.

## بناء Android APK

يعمل workflow `Build Dalilna Android APK` عند push أو يدوياً من Actions. ينشئ Debug-signed APK، ويحفظه كـ Artifact وينشره كـ GitHub pre-release. هذا APK للاختبار وليس إصدار متجر Google Play.

## النشر

فعّل GitHub Pages من Settings → Pages → Build and deployment → Source: GitHub Actions، ثم شغّل `Deploy Dalilna PWA` من Actions.

## مساعد الذكاء الاصطناعي السحابي

سؤال أسماء عزل حبيش يُجاب من قائمة مرجعية ثابتة داخل التطبيق حتى لا يخلط النموذج بين العزل والمديريات. عددها 22؛ بينما محافظة إب تضم 20 مديرية. المصدر الرسمي لعدد المديريات والعزل: https://www.yemen-nic.info/gover/ibb/classoff/index.php?print=Y، وقائمة الأسماء المحلية: https://www.khlaasa.net/1074197.html.\n\nتُظهر كل إجابة مصدرها بوضوح: Gemini، مرجع إداري ثابت، أو المساعد المحلي عند عدم الاتصال/فشل Gemini. هذا يمنع اعتبار إجابة محلية دليلاً على نجاح الاتصال السحابي.\n\nالمساعد المحلي يعمل دون مفتاح. لتشغيل المساعد السحابي، أضف `GEMINI_API_KEY` كمتغير بيئة من نوع Sensitive في Vercel (Production). النموذج الافتراضي `gemini-3.8-flash` عبر Gemini Interactions API. الخادم يدعم موقع Vercel وGitHub Pages وAndroid WebView. لا تضع المفتاح داخل ملفات الواجهة أو GitHub. الخطة المجانية لها حصص استخدام محددة وقد تستخدم Google المحتوى لتحسين منتجاتها؛ لا ترسل بيانات شخصية أو سرية. الخادم يرسل `store:false` لتجنب تخزين سجل Interactions. راجع `AI_SETUP.txt`.

## الأمان وحدود النسخة

الحسابات والأدوار والتخزين المحلي في هذه النسخة تجريبية ومحلية. لا تستخدم بوابة المشرف أو الحظر المحلي كحماية إنتاجية. النشر التجاري متعدد المستخدمين يحتاج خادماً مركزياً ومصادقة وصلاحيات وقاعدة بيانات ومراجعة خادمية.

راجع `SECURITY_LIMITATIONS.txt` و`AI_SETUP.txt` قبل النشر العام.


## دليل المناطق

ملف لكل محافظة ومديرية يتضمن نبذة جغرافية، معالم، وإسقاطات السكان للمحافظة لعام 2023. لا يعرض رقم سكان للمديرية إن لم يتوفر تقدير موثوق. روابط الخدمات تفتح بحث خرائط وليست قائمة مواقع مؤكدة. الصور والإعجابات والمساهمات في هذا الإصدار محلية على جهاز المستخدم ولا تتزامن بين الأجهزة دون قاعدة بيانات مركزية.

## Admin review queue

Pending shop submissions are shown in a prominent dashboard shortcut. Open it to inspect the request details and choose approve/publish or reject. In this offline-first release, pending requests remain local to the device until a shared backend is connected.

## البحث المباشر عن الأماكن

يعرض الإصدار 1.5.1 نتائج الأماكن من OpenStreetMap حسب المحافظة أو المديرية المحددة، أو حول موقع المستخدم بعد موافقته. تظهر نسبة المصدر وتاريخ جلب النتائج وروابط المصدر والخريطة. يمكن أن تكون البيانات غير مكتملة أو قديمة.

خدمة البحث API موجودة على Render بعنوان `https://dalilna-directory-api.onrender.com` وتعمل بالخطة المجانية للاختبار. خدمات Render المجانية قد تتوقف مؤقتاً عند عدم الاستخدام، وقد يتأخر أول اتصال بعد الاستيقاظ.

لا ينسخ التطبيق بيانات Google Places إلى قاعدة بياناته. Google Places غير مفعّل حتى يتم إعداد مشروع Google Cloud ومفتاح مقيد وفوترة مناسبة.

طلبات التجار والمراجعة ما زالت محلية على الجهاز في هذا الإصدار. ربطها بقاعدة بيانات مشتركة ودائمة مرحلة مستقلة قبل الاستخدام الإنتاجي.


ملاحظة الإصدارات: نسخة التطبيق والواجهة هي 1.5.1. رقم `package.json` و`server.js` يخص خدمة API الخلفية المستقلة، ولا يمثل إصدار تطبيق Android أو PWA.


## Faster live directory search

The primary OpenStreetMap endpoint is a Vercel Node Function at `/api/places/search`, avoiding Render free-service idle spin-down. Browser requests abort after 35 seconds and show retry and Google Maps fallback actions. OpenStreetMap/Nominatim can still be rate-limited and coverage in Yemen may be incomplete.


## Direct live place discovery

The PWA now queries Nominatim and Overpass directly from the browser instead of depending on the free Render API service. Nominatim requests are throttled to at most one per 1.1 seconds per app page and successful geocodes are cached for 12 hours. Overpass queries use a 12-second QL timeout and try a second public instance if the first is unavailable. The UI stops after 30 seconds and provides retry plus a Google Maps fallback. OSM results are attributed and may be incomplete in Yemen.
