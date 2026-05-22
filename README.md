# VideoGrab — محمّل فيديو متعدد المنصات

موقع ويب كامل لتحميل الفيديوهات من TikTok، Pinterest، X (Twitter)، Instagram، YouTube، و Facebook.

## البنية

```
video-downloader/
├── frontend/          # واجهة المستخدم (HTML + CSS + JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── backend/           # خادم Express + API
    ├── server.js
    ├── services/
    │   ├── downloader.js       # موجّه المزودين
    │   ├── cobaltProvider.js   # Cobalt API (موصى به)
    │   ├── ytdlpProvider.js    # yt-dlp CLI
    │   ├── rapidApiProvider.js # RapidAPI
    │   └── mockProvider.js     # بيانات تجريبية
    └── .env.example
```

## التشغيل السريع

```bash
cd video-downloader/backend
npm install
cp .env.example .env
npm start
```

افتح **http://localhost:3001**

---

## أفضل طرق ربط API — مقارنة

| الطريقة | التكلفة | الصعوبة | المنصات | التوصية |
|---------|---------|---------|---------|---------|
| **Cobalt API** | مجاني | سهل | TikTok, X, Pinterest, IG, YT+ | ⭐ الأفضل |
| **yt-dlp** | مجاني | متوسط | 1000+ موقع | ⭐ للإنتاج |
| **RapidAPI** | مدفوع | سهل | متعدد | للمشاريع التجارية |
| **Scraping يدوي** | مجاني | صعب | محدود | ❌ غير مستقر |

---

### 1. Cobalt API — الخيار الموصى به ⭐

[Cobalt](https://github.com/imputnet/cobalt) مشروع مفتوح المصدر يدعم TikTok و Pinterest و X و Instagram و YouTube.

**المزايا:**
- مجاني بالكامل (يمكن استضافته ذاتياً)
- واجهة REST بسيطة
- لا يحتاج مفاتيح API
- محدّث باستمرار من المجتمع

**الإعداد:**

```bash
# في ملف .env
API_PROVIDER=cobalt
COBALT_API_URL=https://api.cobalt.tools
```

**استضافة ذاتية (Docker):**

```bash
git clone https://github.com/imputnet/cobalt
cd cobalt
docker compose up -d
# ثم غيّر COBALT_API_URL=http://localhost:9000
```

**شكل الطلب:**

```http
POST https://api.cobalt.tools/
Content-Type: application/json

{ "url": "https://www.tiktok.com/@user/video/123", "videoQuality": "1080" }
```

**الاستجابة:**

```json
{
  "status": "redirect",
  "url": "https://direct-video-cdn.example/video.mp4",
  "filename": "tiktok_video.mp4"
}
```

---

### 2. yt-dlp — الأقوى للإنتاج ⭐

[yt-dlp](https://github.com/yt-dlp/yt-dlp) أداة سطر أوامر Python تدعم أكثر من 1000 موقع.

**المزايا:**
- الأوسع تغطيةً
- مجاني ومفتوح المصدر
- يدعم اختيار الجودة بدقة

**العيوب:**
- يحتاج Python + yt-dlp على السيرفر
- أبطأ من Cobalt (يحلل الصفحة مباشرة)
- قد يحتاج cookies لبعض المنصات

**الإعداد:**

```bash
pip install yt-dlp

# في .env
API_PROVIDER=ytdlp
YTDLP_PATH=yt-dlp
```

---

### 3. RapidAPI — للمشاريع التجارية

خدمات جاهزة على [RapidAPI Hub](https://rapidapi.com/hub) مثل:
- Social Media Video Downloader
- All-in-One Downloader API

**المزايا:** موثوق، SLA، دعم فني
**العيوب:** مدفوع بعد 100-500 طلب/شهر

```bash
# في .env
API_PROVIDER=rapidapi
RAPIDAPI_KEY=your_key
RAPIDAPI_HOST=social-media-video-downloader.p.rapidapi.com
```

---

### 4. بنية API موحّدة (موجودة في المشروع)

المشروع يستخدم **Provider Pattern** — يمكنك التبديل بين المزودين بتغيير متغير واحد:

```
Frontend → POST /api/download { url, platform }
                ↓
         platformDetector.js  (كشف المنصة)
                ↓
         downloader.js         (اختيار المزود)
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
 cobalt     yt-dlp      rapidapi
```

---

## تدفق الواجهة

1. المستخدم يلصق الرابط
2. الكشف التلقائي يحدّد المنصة (TikTok / Pinterest / X...)
3. زر **تحميل الفيديو** (أحمر) يرسل الطلب للـ API
4. تظهر النتيجة: صورة مصغرة + عنوان + قائمة جودات + أزرار تحميل

---

## النشر (Deploy)

| المنصة | Frontend | Backend |
|--------|----------|---------|
| Vercel / Netlify | ✅ Static | ❌ |
| Railway / Render | ✅ | ✅ Express |
| VPS + Docker | ✅ | ✅ + Cobalt self-hosted |

---

## ملاحظات قانونية

- للاستخدام الشخصي فقط
- احترم حقوق النشر وشروط استخدام كل منصة
- لا تخزّن أو تعيد توزيع المحتوى بدون إذن
