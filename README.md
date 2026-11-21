# دليلنا | Dalilna

دليل محلي للخدمات والمحلات والوظائف وسوق البيع والشراء في اليمن، مع تغطية مديرية حبيش وعزلها، وبيانات المديريات والمحافظات المرجعية.

## الإصدار

- Version: 1.5.7
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

## البحث المباشر عن الأماكن — الإصدار 1.5.7

يستخدم دليلنا خادم البحث على Render: `https://dalilna-live.onrender.com`.

- عند تفعيل Google Places في الخادم، يعرض البحث الاسم والعنوان والتقييم وعدد التقييمات ورقم الهاتف والموقع الإلكتروني وساعات العمل ومستوى السعر وحالة النشاط، إذا كانت Google توفر هذه البيانات للمكان.
- زر «التفاصيل والصور وآراء الزوار» يجلب الصور ومراجعات العملاء عند طلب المستخدم، ويعرض إسناد أصحاب الصور والمراجعات. لا تُحفظ هذه البيانات في قوائم دليلنا أو في التخزين المؤقت.
- OpenStreetMap وOverpass يبقيان مصدراً بديلاً عندما لا يكون Google مفعّلاً أو لا يعيد نتائج.
- Google Places معطّل افتراضياً. يتطلب `GOOGLE_PLACES_API_KEY` كمتغير Sensitive و`GOOGLE_PLACES_ENABLED=true` على خدمة Render. لا تضع المفتاح في HTML أو Android أو GitHub.
- قبل التفعيل، فعّل Places API (New) في Google Cloud، وقيّد المفتاح إلى Places API، واضبط الحصص والتنبيهات والميزانية. حقول التقييم والهاتف والموقع وساعات العمل من فئة Text Search Enterprise؛ نصوص المراجعات والصور الإضافية قد ترفع تكلفة طلب التفاصيل.
- تتوفر صفحتا `privacy.html` و`terms.html` داخل الموقع والتطبيق.

مصادر Google الرسمية:
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/billing-and-pricing/pricing

راجع `SECURITY_LIMITATIONS.txt` قبل الإطلاق العام.
