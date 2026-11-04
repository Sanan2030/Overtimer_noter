# Overtime

Azərbaycan dilində əlavə iş saatları və məbləğlərin uçotu. Next.js / React / TypeScript ilə hazırlanıb; Vercel-də işləyir. Backend, hesabla giriş, xarici verilənlər bazası və API açarı tələb etmir.

## Başlatmaq

Node.js 22 və ya 24 LTS, npm istifadə edin.

```sh
cd /workspace/Overtimer_noter
npm ci
npm run dev
```

Production rejimi:

```sh
npm run build
npm run start
```

## İmkanlar

- Hər ay üçün əl ilə net maaş və norma iş saatı.
- Tarix, başlanma, bitmə, fasilə; standart 1x və seçilə bilən 2x / 3x.
- Əməkdaş, şöbə müdiri, müştəri, layihə, icra günü statusu, iş mühiti, mövzu və səbəb.
- Son istifadə edilən əməkdaş və layihə məlumatlarının növbəti qeyd üçün yadda saxlanması.
- Qeydləri dəyişmək, kopyalamaq, təsdiqlə silmək; tarix, mətn, layihə və əmsal filtrləri.
- Gecəni keçən işlər və eyni əməkdaşın vaxt aralıqlarının toqquşmasına xəbərdarlıq.
- Aylıq saat, məbləğ, overtime günləri, gündəlik orta müddət; 6 aylıq trend; əmsal, layihə, müştəri, səbəb, iş mühiti və həftə günləri üzrə analiz; əvvəlki ayla müqayisə.
- JSON tam ehtiyat nüsxə və bərpa; XLSX idxal və formatlanmış ixrac.
- Mobil və masaüstü interfeys. Nümunə məlumatlar avtomatik əlavə edilmir.

## Hesablama qaydaları

```text
saatlıq tarif = aylıq net maaş / ayın norma iş saatı
faktiki müddət = bitmə - başlanma - fasilə
məbləğ = faktiki dəqiqə / 60 × saatlıq tarif × əmsal
```

1 200 AZN maaş və 160 norma saatı üçün tarif 7,50 AZN-dir. 18:00–20:00 qeydi 1x ilə 15,00 AZN, 2x ilə 30,00 AZN, 3x ilə 45,00 AZN edir. Məbləğ hər qeydin sonunda qəpiyə yuvarlaqlaşdırılır; yekun həmin məbləğlərin cəmidir. Faktiki iş saatı əmsala vurulmur.

Bitmə başlanmadan erkəndirsə, növbəti günə aiddir. Eyni başlanma/bitmə qəbul edilmir, bir qeyd 24 saatdan qısadır. Gecəni keçən iş başlanma tarixinin ayına və gününə hesablanır. Fasilə ödənişsizdir və intervaldan kiçik tam dəqiqə olmalıdır. Üst-üstə düşmə xəbərdarlığı fasilənin dəqiq mövqeyi məlum olmadığı üçün bütün vaxt aralığını müqayisə edir.

Qeydin tarifi saxlanarkən qeydə bağlanır. Maaş ayarının sonradan dəyişməsi əvvəlcədən tarifi olan qeydləri dəyişmir. Həmin ayın bütün qeydlərini yenidən hesablamaq üçün maaş pəncərəsində ayrıca seçim var. Digər aylar dəyişmir. Tarifi olmayan qeydlər saat analizinə daxildir; məbləğləri tarif daxil edilənədək boş göstərilir.

Təsdiq / ödəniş statusu yoxdur. Excel-dəki “İcra günü statusu” işin növüdür: qeyri-iş saatı, istirahət günü, bayram günü.

## Saxlama və ehtiyat nüsxə

Məlumat `localStorage`-da `overtime-noter:v1` açarı ilə, hər dəyişiklikdə saxlanır. Səhifəni yeniləmək və brauzeri bağlamaq məlumatı silmir. Yazılma uğursuz olarsa, interfeysdə xəbərdarlıq görünür və məlumatı JSON kimi endirmək mümkündür. Oxunmayan əvvəlki yaddaş avtomatik əvəz edilmir; orijinalı endirmək və təsdiqlə JSON-dan bərpa etmək olar.

Hər brauzer profili və domen ayrıca yaddaşdır. Eyni profil və domeni paylaşan şəxslər eyni məlumatları görə bilər: bu versiya hesabla giriş və giriş nəzarəti təqdim etmir. Anonim rejim, brauzer yaddaşının silinməsi və cihazın dəyişməsi üçün müntəzəm JSON nüsxəsi saxlayın. Vercel preview və production domenləri arasında da nüsxəni əl ilə köçürmək lazımdır.

**Məlumatlar → JSON endir** bütün qeydləri, aylıq maaşları və profil sahələrini saxlayır. **Fayl seç** ilə nüsxəni başqa brauzerə gətirin. İdxaldan əvvəl icmal göstərilir. Əlavə etmə rejimi mövcud ayarları qoruyur, idxal edilən məlum tarifləri saxlayır və təkrarlanan iş qeydlərini ötürür. Eyni qeydə sonradan tarif verilməsi onu yeni qeyd etmir. Tam əvəz etmə ayrıca təsdiq tələb edir.

JSON və XLSX faylları brauzerdə emal edilir; tətbiq qeydləri serverə göndərmir. JSON faylında maaş və şəxsi məlumatlar açıq mətnlə olur.

## Excel formatı

İlk 14 sütun bu ardıcıllıqdadır:

| İl  | Ay  | Əməkdaş | Şöbə müdiri | Müştəri | Layihə | Tarix | Başlanma | Bitmə | İcra günü statusu | İş mühiti | Müddət (saat: dəqiqə) | Mövzu | Səbəb |
| --- | --- | ------- | ----------- | ------- | ------ | ----- | -------- | ----- | ----------------- | --------- | --------------------- | ----- | ----- |

Sonda **Əmsal**, **Saatlıq tarif (AZN)** və **Məbləğ (AZN)** əlavə edilir. “Aylıq yekun” vərəqində ay, qeyd sayı, faktiki müddət, məbləğ və tarifsiz qeydlərin sayı var. Filtr seçilibsə ixraca seçilmiş qeydlər daxildir. JSON həmişə bütün məlumatları ixrac edir.

İdxalda `.xlsx` və `.json`, ən çox 10 MB və 50 000 qeyd dəstəklənir. Köhnə `.xls` faylını əvvəlcə Excel-də `.xlsx` kimi saxlayın. Excel-də **Tarix**, **Başlanma**, **Bitmə** başlıqları lazımdır; başlıq ilk 30 sətirdə axtarılır. Digər sahələr boş qala bilər. Mətn və real Excel tarix/saat hüceyrələri, 1900/1904 təqvimləri, zəngin mətn başlıqları dəstəklənir. Formullar icra edilmir, varsa əvvəlcədən saxlanmış nəticəsi oxunur.

Maaş məlumatı olmayan orijinal cədvəl saat analizində dərhal görünür. Maaş ayarı daxil ediləndə məbləğlər hesablanır. Yalnız məbləği olan sətirlərdən tarif bərpa olunur. Göstərilən müddət başlanma–bitmə aralığından qısadırsa fərq fasilə kimi saxlanır. Səhv sətir aşkarlanarsa bütün idxal dayandırılır və sətir nömrəsi göstərilir.

## Yoxlamalar

```sh
npm test
npm run typecheck
npm run build
```

Brauzer testləri production build istifadə edir və serveri özü başladır:

```sh
npx playwright install chromium
npm run test:e2e
```

Sistemdə Chromium varsa:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

Testlər maaş və əmsalları, fasilə/gecə işini, JSON/XLSX dövrəsini, orijinal Excel formatını, təkrar idxalı, brauzerdə saxlama/bərpanı, filtr və redaktəni, aylıq tariflərin qorunmasını və mobil interfeysi yoxlayır.

## Vercel

1. Layihəni GitHub repozitoriyasına göndərin və Vercel-də həmin repozitoriyanı import edin.
2. Framework: **Next.js**; build: `npm run build`; install: `npm ci`. Output Directory üçün Next.js standartını saxlayın.
3. Node.js **24.x** seçin. Environment variable və database tələb olunmur.
4. Deploy-dan sonra bir qeyd yaradın, səhifəni yeniləyin və JSON/Excel ixracını yoxlayın.

Bu repozitoriya üçün deploy və ya GitHub-a push avtomatik edilmir.
