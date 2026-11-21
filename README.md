# دليلنا | Dalilna

دليل محلي للخدمات والمحلات والوظائف وسوق البيع والشراء في اليمن، مع تغطية مديرية حبيش وعزلها، وبيانات المديريات والمحافظات المرجعية.

## الإصدار

- Version: 1.5.9
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

## البحث المباشر عن الأماكن — الإصدار 1.5.9

يستخدم دليلنا مصادر مفتوحة ولا يحتاج مفتاح Google Places أو بطاقة بنكية أو حساب فوترة.

- تحديد حدود المحافظة أو المديرية عبر OpenStreetMap Nominatim.
- البحث عن الأماكن عبر OpenStreetMap Overpass مع التبديل بين FOSSGIS وPrivate.coffee وVK Maps عند التعطل أو الاستجابة غير المكتملة.
- عرض الاسم والعنوان والهاتف والموقع الإلكتروني وساعات العمل والوصف ونوع النشاط عندما تكون هذه البيانات مسجلة في الخريطة.
- البحث الاختياري عن صور مرتبطة باسم المكان والمنطقة عبر Wikimedia Commons. يعرض التطبيق صفحة الملف واسم صاحب الصورة والترخيص عند توفر البيانات.
- التقييمات والصور التي يضيفها المستخدم محفوظة على جهازه فقط ولا تتم مشاركتها أو مزامنتها في هذا الإصدار.
- أزيلت طلبات Google Places المدفوعة من الخادم والواجهة.
- مصادر الخرائط العامة تخضع لسياسات استخدام وحدود طلبات وقد تتوقف مؤقتاً. لا يوجد ضمان لاستخدام غير محدود أو توفر دائم.
- صفر نتائج يعني عدم وجود عناصر مطابقة في بيانات الخريطة الحالية، ولا يثبت عدم وجود المكان على أرض الواقع.

المصادر:
- OpenStreetMap: https://www.openstreetmap.org/copyright
- Wikimedia Commons: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

راجع `SECURITY_LIMITATIONS.txt` قبل الإطلاق العام.
