# دليلنا | Dalilna

دليل محلي للخدمات والمحلات والوظائف وسوق البيع والشراء في اليمن، مع تغطية مديرية حبيش وعزلها، وبيانات المديريات والمحافظات المرجعية.

## الإصدار

- Version: 1.6.2
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

## البحث المباشر عن الأماكن — الإصدار 1.6.2

يعتمد دليلنا على Geoapify Places كواجهة مجانية منظمة لبيانات الأماكن المبنية على OpenStreetMap، مع الرجوع إلى OpenStreetMap مباشرة إذا لم يتم إعداد المفتاح أو توقف الخدمة.

- خطة Geoapify المجانية توفر 3,000 رصيد يومياً، ولا تتطلب بطاقة بنكية، وتسمح باستخدام التطبيق التجاري ضمن الحصة مع إظهار الإسناد.
- البحث حسب الفئة والمنطقة يتم عبر Geoapify Places API. تُجلب تفاصيل الهاتف وساعات العمل والموقع الإلكتروني للبطاقات المعروضة فقط عبر Place Details API.
- يظهر رقم الهاتف عندما يكون مسجلاً في بيانات المكان. لا يضمن المصدر وجود رقم لكل نشاط.
- يستخدم الخادم متغير البيئة السري `GEOAPIFY_API_KEY`. لا تضف المفتاح إلى GitHub أو ملفات الواجهة أو APK.
- يُحفظ مفتاح Geoapify في Render فقط ضمن Environment. عند عدم ضبطه، يستخدم التطبيق OpenStreetMap كبديل.
- يجب إظهار عبارة Powered by Geoapify وإسناد © OpenStreetMap contributors.
- البحث العادي يكلف رصيداً حسب عدد النتائج (كل 20 مكاناً = رصيد واحد). طلب تفاصيل المكان يكلف رصيداً واحداً. يحمّل التطبيق تفاصيل أول 8 بطاقات معروضة فقط، ويخزّنها مؤقتاً لتقليل الطلبات.
- لا يتصل التطبيق بـ Google Places API ولا يتطلب Google Cloud أو بطاقة بنكية.

المصادر الرسمية:
- Geoapify Pricing: https://www.geoapify.com/pricing/
- Geoapify Places API: https://apidocs.geoapify.com/docs/places/
- Geoapify Place Details API: https://apidocs.geoapify.com/docs/place-details/
- OpenStreetMap: https://www.openstreetmap.org/copyright
- Wikimedia Commons: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

راجع `SECURITY_LIMITATIONS.txt` قبل الإطلاق العام.

## دليل البداية والبيانات العامة — 1.6.2

- يتضمن الإصدار إدراجات بداية مستندة إلى صفحات متاجر ووكلاء يمنيين رسمية، وصفحات منتجات بأسعارها المنشورة، وإعلانات وظائف عامة مع مواعيد إغلاقها.
- تظهر لكل إدراج صفحة المصدر وتاريخ مراجعة المصدر وملاحظة بأن دليلنا لم يتحقق ميدانياً من حالة الفرع أو توفر المخزون.
- تُخفى الوظائف والعروض بعد تاريخ انتهاء الإعلان.
- تبقى نتائج البحث الجغرافي من Geoapify وOpenStreetMap منفصلة عن قاعدة الإضافات المحلية. لا ندمج نتيجة خريطة آلياً بوصفها إدراجاً موثقاً.
- يُحفظ حذف إدراج البداية الذي يجريه المشرف حتى لا يعود بعد إعادة فتح التطبيق، مع الإبقاء على إدراجات المستخدم السابقة.
- لا يزال نموذج الإضافة الحالي محلياً على الجهاز فقط؛ لا تظهر إدراجات المستخدم للعامة حتى يكتمل خادم قاعدة البيانات المشتركة ومراجعة الطلبات. لا تَعِد المستخدم بأن نشره عام قبل تفعيل هذه الخدمة.
- لا ننسخ إعلانات السوق أو أرقام البائعين من المواقع الخارجية؛ نوفر روابط للمصدر حتى يتواصل العميل مع المعلن مباشرة.

مصادر الدليل المبدئي: مواقع المتاجر والوكلاء الرسميين، Yemen HR، السجل الصحي لوزارة الصحة العامة والسكان، وGeoapify Places المبني على OpenStreetMap. بيانات الأماكن المفتوحة قد تكون ناقصة في بعض المحافظات والمديريات.
