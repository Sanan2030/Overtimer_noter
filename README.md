# ArtıSaat

Azərbaycan dilində əlavə iş saatları və məbləğlərin uçotu. Next.js / React / TypeScript; Vercel üçün hazırdır. Hesabla giriş, database və tətbiq API açarı tələb olunmur.

## Başlatmaq

Node.js 24 LTS və npm:

```sh
cd /workspace/Overtimer_noter
npm ci
npm run dev
```

Production:

```sh
npm run build
npm run start
```

## İnterfeys

Birinci təqdim edilmiş Stitch dizaynı əsas götürülür: mərkəzləşdirilmiş üç menyu (**Qeydlərim**, **Analiz**, **Fayllar**), açıq bənövşəyi fon, ağ kartlar və yaşıl vurğu. Açıq/tünd rejim seçimi brauzerdə `artisaat:theme` açarı ilə saxlanır; ilk açılışda sistemin rəng rejimi nəzərə alınır. Inter şrifti lisenziyası ilə birlikdə lokal verilir.

Yeni qeyd formasında bütün xanalar bir pəncərədə açıqdır. Fasilə sahəsi və norma saatını əl ilə dəyişmək imkanı yoxdur. İl/ay tarixdən, norma saatı rəsmi təqvimdən gəlir. Qeyd üçün başlanma və bitmə saatlarını istifadəçi daxil edir.

## Rəsmi aylıq norma

ƏƏSMN-nin rəsmi istehsalat təqvimlərindən yoxlanmış **2023–2026** aylıq normları `src/lib/work-calendar.ts` faylındadır. Standart rejim: **beşgünlük, həftədə 40 saat**. Hər ilin rəsmi səhifə və təqvim şəkli linki məlumatla birlikdə saxlanır. 2026 mart norması **111 saat**, 2025 mart norması **110 saatdır**. Aylıq rəqəmlərin cəmi illik norma ilə test olunur.

Tətbiq rəsmi təqvimin yoxlanmış yerli nüsxəsindən istifadə etdiyinə görə internet olmadan da ayı seçdikdə norma avtomatik gəlir. Yeni ilin və ya yenilənmiş təqvimin rəqəmləri rəsmi sənədlə yoxlanıb bu cədvələ əlavə edilməlidir. Təsdiqlənmiş məlumatı olmayan il üçün norma təxmin edilmir və maaş ayarının saxlanması bağlıdır; qeydləri tarifsiz saxlamaq olar.

Rəsmi mənbə: <https://sosial.gov.az/az/faydali/istehsalat-teqvimi>

## Hesablama

```text
Saatlıq tarif = ayın net maaşı / həmin ayın rəsmi norma saatı
Məbləğ = əlavə iş dəqiqəsi / 60 × saatlıq tarif × əmsal
```

Əmsal standart **1x**, seçimlər **2x** və **3x**. Faktiki iş müddəti əmsala vurulmur. 2026 martda 1 200 AZN maaş və 2 saat overtime: `1200 / 111 × 2 = 21,62 AZN`; 2x ilə 43,24 AZN. Məbləğ hər qeyddə qəpiyə yuvarlaqlaşdırılır, yekun həmin məbləğlərin cəmidir.

Hər ayın maaşı ayrıca saxlanır. Ayın maaşı dəyişəndə həmin ayın qeydləri rəsmi norma ilə yenidən hesablanır; digər aylar dəyişmir. Əvvəlki JSON-dakı əl ilə daxil edilmiş norma təsdiqlənmiş rəsmi norma ilə yenilənir. Aylıq maaş məlumdursa köhnə saxlanmış tarif rəsmi hesablamanı əvəz etmir. Maaş olmayan idxal qeydlərinin məlum tarifi qorunur.

Bitmə saatı başlanmadan erkəndirsə növbəti günə aiddir; qeyd başlanma tarixinin ayına hesablanır. Eyni başlanma/bitmə qəbul edilmir. Eyni əməkdaşın üst-üstə düşən qeydlərinə xəbərdarlıq göstərilir.

Köhnə JSON/Excel-dəki fasilə məlumatı idxalda qorunur. Yeni forma fasiləsiz qeyd yaradır; köhnə qeyd bu formada redaktə edilərsə saxlayanda müddət tam başlanma–bitmə aralığına görə hesablanır.

## Funksiyalar və məlumatlar

- Tarix, başlanma, bitmə, əmsal, mövzu, əməkdaş, şöbə müdiri, müştəri, layihə, icra günü statusu, iş mühiti, səbəb.
- Əməkdaş və layihə məlumatlarını növbəti qeyd üçün yadda saxlamaq.
- Redaktə, kopyalama, təsdiqlə silmə; ay, mətn, layihə və əmsal filtrləri.
- Ümumi saat/məbləğ, aylıq trend, layihə/müştəri/səbəb/iş mühiti/həftə günü/əmsal bölgüsü, əvvəlki ayla müqayisə, gün sayı və gündəlik orta müddət.
- JSON tam ehtiyat nüsxəsi və bərpa, XLSX idxal/ixracı. İdxaldan əvvəl icmal, təkrarların ötürülməsi və tam əvəz etməyə ayrıca təsdiq.
- Təsdiq/ödəniş statusu yoxdur. “İcra günü statusu” qeyri-iş saatı, istirahət və ya bayram gününü bildirir.

## Saxlama

Qeydlər `localStorage`-da `overtime-noter:v1` açarı ilə hər dəyişiklikdə saxlanır. Yeniləmə və bağlanmadan sonra qalır. Yaddaş dolu və ya bağlıdırsa xəbərdarlıq göstərilir; saxlanmamış məlumatı JSON ilə endirmək olar. Oxunmayan əvvəlki yaddaş avtomatik əvəz edilmir.

Hər domen və brauzer profili ayrıca yaddaşdır. Eyni profili paylaşan şəxslər eyni məlumatları görür. Cihazlar arasında keçid və məlumatı qorumaq üçün JSON nüsxəsi istifadə edin. Brauzer yaddaşını silmək qeydləri də silir. JSON şəxsi məlumatları və maaşı açıq mətnlə daşıyır.

## Excel hesabatı

Fayl **Aylıq yekun** vərəqi ilə açılır: ay, maaş, rəsmi norma, saatlıq tarif, overtime müddəti, qeyd sayı, məbləğ və tarifsiz qeydlər. Sonda cəmi və rəsmi mənbə linki var.

**Overtime qeydləri** vərəqində ilk 14 sütun şirkət formatına uyğundur:

İl, Ay, Əməkdaş, Şöbə müdiri, Müştəri, Layihə, Tarix, Başlanma, Bitmə, İcra günü statusu, İş mühiti, Müddət (saat: dəqiqə), Mövzu, Səbəb.

Sonda Əmsal, Saatlıq tarif (AZN), Məbləğ (AZN) gəlir. Qruplaşdırılmış başlıqlar, mətnə uyğun sətir hündürlüyü, incə xətlər, növbələnən sətir rəngi, cəmi sətri, filtr, sabit başlıq və pul/tarix/saat formatları tətbiq olunur. Aylıq yekun A4, detallı cədvəl A3 üfüqi çap üçün qurulub; hər səhifədə başlıq təkrarlanır.

İdxal `.xlsx` və `.json` üçün ən çox 10 MB / 50 000 qeyddir. Excel-də Tarix, Başlanma və Bitmə başlıqları ilk 30 sətirdə olmalıdır. Köhnə 14 sütunlu və yeni format idxal olunur. Səhv sətir varsa bütün idxal dayandırılır. Köhnə `.xls` faylını əvvəlcə `.xlsx` kimi saxlayın.

## Yoxlamalar

```sh
npm test
npm run typecheck
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

Sistem Chromium-u yoxdursa `npx playwright install chromium` və `npm run test:e2e` istifadə edin. Brauzer testləri production build tələb edir, serveri özü başladır.

## Vercel

GitHub-dan layihəni import edin. `vercel.json` **Next.js**, `npm ci`, `npm run build` və `.next` çıxış qovluğunu təyin edir. Node.js **24.x** seçin. Environment variable və database tələb olunmur. GitHub inteqrasiyası aktivdirsə `main`-ə push yeni deploy başlada bilər.

`STATIC_BUILD_NO_OUT_DIR` / `public` xətası olarsa `vercel.json` olan son commitdən deploy edin, framework **Next.js** olsun.
