// Optional cloud assistant for Vercel / Node-compatible serverless hosts.
// Set OPENAI_API_KEY in the hosting provider's server environment. Never put it in index.html.
const WINDOW_MS = 60_000;
const RATE_LIMIT = 15;
const buckets = new Map();

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function extractOutput(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const pieces = [];
  for (const item of data.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) {
      if ((part.type === 'output_text' || part.type === 'text') && typeof part.text === 'string') pieces.push(part.text);
    }
  }
  return pieces.join('\n').trim();
}

async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return send(res, 503, { error: 'cloud_ai_not_configured', answer: null });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const bucket = buckets.get(ip) || { start: now, count: 0 };
  if (now - bucket.start > WINDOW_MS) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  buckets.set(ip, bucket);
  if (bucket.count > RATE_LIMIT) return send(res, 429, { error: 'rate_limited' });

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const question = String(body.question || '').trim().slice(0, 1200);
  if (!question) return send(res, 400, { error: 'question_required' });
  const context = JSON.stringify(body.context || {}).slice(0, 9000);

  const instructions = [
    'أنت مساعد دليلنا لخدمات ومحلات ووظائف وسوق البيع والشراء في اليمن، وتحدث بالعربية الواضحة ما لم يطلب المستخدم الإنجليزية.',
    'اعتمد على بيانات الدليل المحلية المرفقة فقط عند ذكر أسماء محلات أو أرقام هواتف أو أسعار أو ساعات عمل أو حالة توثيق.',
    'لا تخترع نشاطاً أو رقماً أو عنواناً أو سعراً. إذا لم توجد نتيجة في البيانات فقل إنها غير مسجلة في الدليل حالياً.',
    'فرّق دائماً بين إدراج مجتمعي وبين إدراج موثّق. لا تصف الفحص الآلي بأنه تحقق بشري.',
    'لا تطلب كلمات مرور أو رموز OTP أو بيانات بطاقات. لا تساعد على الاحتيال أو انتحال الحسابات.',
    'عند أسئلة الطوارئ، أظهر الأرقام المخزنة على أنها أرقام مدخلة في الدليل واطلب التأكد محلياً؛ لا تدّع أنها مؤكدة رسمياً.',
    'إذا كان السؤال خارج دليلنا، قدّم إرشاداً عاماً موجزاً وميّز أنه ليس مستنداً إلى سجلات الدليل.'
  ].join('\n');

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.5',
        instructions,
        input: `بيانات الدليل المحلية (قد تكون من إدخالات المستخدمين وغير موثقة):\n${context}\n\nسؤال المستخدم:\n${question}`,
        max_output_tokens: 650,
        store: false
      })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return send(res, upstream.status === 429 ? 429 : 502, { error: 'upstream_error' });
    const answer = extractOutput(data);
    if (!answer) return send(res, 502, { error: 'empty_ai_response' });
    return send(res, 200, { answer, mode: 'cloud' });
  } catch (_) {
    return send(res, 502, { error: 'assistant_unavailable' });
  }
}

module.exports = handler;
