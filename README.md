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

Analiz səhifəsi son təqdim edilmiş Stitch HTML dizaynına uyğunlaşdırılıb: dörd göstərici kartı, son altı ayın sütun qrafiki, layihə və əmsal dairələri, təqvim həftələri üzrə yük və əvvəlki ayla müqayisə cədvəli. Əmsal bölgüsündə saat/məbləğ seçimi, aylıq qrafikdən aya keçid, maaşı tamamlama və boş vəziyyətdən yeni qeyd əlavə etmə işləyir. Müştəri, səbəb, iş mühiti və həftə günləri üzrə əlavə bölgülər açılan bölmədə qalır.

Bütün rəqəmlər mövcud qeydlərdən hesablanır. Əsas əmsal payı faktiki vaxta əsaslanır. Həftələr bazar ertəsi–bazar aralıqları üzrə ayın ilk/son günündə bölünür; istirahət/bayram bölgüsü qeyddəki statusa əsaslanır. Dizayndakı nümunəvi 20 saat limiti tətbiq edilmir; rəsmi aylıq norma məlumat kimi göstərilir. Tarifsiz qeydlər saatlardan çıxarılmır, natamam məbləğlər işarələnir. Ümumi tarixlər seçiləndə aylıq müqayisə göstərilmir. Analiz səhifəsinin rəngləri ayrıca tərtib edilib və mövcud açıq/tünd rejim seçiminə tabedir.

Yeni qeyd formasında bütün xanalar bir pəncərədə açıqdır. Fasilə sahəsi və norma saatını əl ilə dəyişmək imkanı yoxdur. İl/ay tarixdən, norma saatı rəsmi təqvimdən gəlir. Qeyd üçün başlanma və bitmə saatlarını istifadəçi daxil edir.

## Rəsmi aylıq norma

ƏƏSMN-nin rəsmi istehsalat təqvimlərindən yoxlanmış **2023–2026** aylıq normları `src/lib/work-calendar.ts` faylındadır. Standart rejim: **beşgünlük, həftədə 40 saat**. Hər ilin rəsmi səhifə və təqvim şəkli linki məlumatla birlikdə saxlanır. 2026 mart norması **111 saat**, 2025 mart norması **110 saatdır**. Aylıq rəqəmlərin cəmi illik norma ilə test olunur.

Tətbiq rəsmi təqvimin yoxlanmış yerli nüsxəsindən istifadə etdiyinə görə internet olmadan da ayı seçdikdə norma avtomatik gəlir. Yeni ilin və ya yenilənmiş təqvimin rəqəmləri rəsmi sənədlə yoxlanıb bu cədvələ əlavə edilməlidir. Təsdiqlənmiş məlumatı olmayan il üçün norma təxmin edilmir və maaş ayarının saxlanması bağlıdır; qeydləri tarifsiz saxlamaq olar.

Rəsmi mənbə: <https://sosial.gov.az/az/faydali/istehsalat-teqvimi>

## Hesablama

```text
Saatlıq tarif = həmin ayın net maaşı / həmin ayın rəsmi norma saatı
Məbləğ = həmin gün işlənmiş saat × saatlıq tarif × seçilən əmsal
```

Yeni qeyddə **2x** seçilir; 1x/2x/3x əmsalı dəyişdirilə bilər. Gecə əlavəsi formadan, hesablamadan və hesabatdan çıxarılıb. Əvvəlki qeyddə saxlanmış gecə faizi də məbləğə təsir etmir. Hər günün məbləği qəpiyə yuvarlaqlaşdırılır, yekun bu məbləğlərin cəmidir.

**31.10.2026 19:00 → 01.11.2026 02:00** qeydi: oktyabrda 5 saat, noyabrda 2 saat. Oktyabr norması 176, noyabr norması 152 saatdır. Hər iki ayın net maaşı 1320 AZN və əmsal 2x olarsa: oktyabr **75,00 AZN**, noyabr **34,74 AZN**, cəmi **109,74 AZN**. Növbəti ayın maaşı yoxdursa əvvəlki ayın tarifi ona tətbiq edilmir; həmin hissə tarifsiz görünür.

Qeyd JSON-da bir bütöv vaxt aralığı kimi saxlanır. İnterfeys, aylıq analiz və Excel onu təqvim günlərinə bölür. İstənilən hissədən redaktə/silmə ilkin qeydə tətbiq edilir. Excel gündəlik hissələri idxal edir və mövcud bütöv qeydin təkrar hissələrini ötürür.

Əmək Məcəlləsinin 164-cü maddəsinə görə aylıq maaş alanların istirahət/bayram günündə norma daxilində işi üçün maaşdan əlavə minimum 1x, normadan artıq işi üçün minimum 2x ödənilir. Adi iş günündə overtime üçün 165-ci maddə minimum 2x müəyyən edir. Tətbiq normal iş qrafikini və bütün adi iş saatlarını saxlamadığı üçün norma daxilində/üstündə olmasını özü müəyyən etmir; əmsalı istifadəçi seçir. Mənbə: <https://e-qanun.az/framework/46943> (164–165). İstifadəçinin seçiminə əsasən tətbiq məbləğləri daxil edilmiş net maaşla hesablayır; brutto-net vergi çevirməsi aparmır.

Hər ayın maaşı ayrıca saxlanır. Maaş dəyişəndə yalnız həmin ayın hissələri yenidən hesablanır. Əvvəlki JSON-dakı əl ilə daxil edilmiş norma rəsmi norma ilə yenilənir. Əvvəlki net maaşlar istifadəyə davam edir. Brutto kimi saxlanmış maaş netə avtomatik çevrilmir və hesablama üçün istifadə edilmir; həmin ayın net maaşı formaya daxil edilməlidir. Net maaş yadda saxlananda ayın hissələri yenidən hesablanır. Köhnə fasiləli qeydlərdə fasilənin vaxtı məlum olmadığı üçün günlər üzrə dəqiqələr proporsional bölünür.

Eyni başlanma/bitmə qəbul edilmir. Eyni əməkdaşın üst-üstə düşən qeydlərinə xəbərdarlıq göstərilir.

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

Seçilmiş **2-ci variant**: açıq yaşıl başlıq, ağ sətirlər, incə yaşıl çərçivə və bir `Overtime` vərəqi. İlk sətirdən yalnız bu 14 sütun verilir:

İl, Ay, Əməkdaş, Şöbə müdiri, Müştəri, Layihə, Tarix, Başlanma, Bitmə, İcra günü statusu, İş mühiti, Müddət (saat: dəqiqə), Mövzu, Səbəb.

Əlavə başlıq, yekun sətri, maaş/əmsal/məbləğ sütunu və hesabat vərəqi yoxdur. Tarix `02.10.2026`, vaxt `18:00`, müddət `03:00` formatındadır. Uzun mətnlər sətirə bölünür; başlıq sabitlənir, A3 üfüqi çapda təkrarlanır. Excel iş qeydlərini daşıyır; maliyyə və profil ayarları daxil olmaqla tam ehtiyat nüsxəsi üçün JSON istifadə edilir.

Excel təkrar idxal ediləndə uyğun iş qeydləri ötürülür və mövcud qeydlərin əmsalı/məbləği qorunur. Başqa brauzerdə idxal zamanı əmsal sütunu olmayan Excel qeydləri əvvəlki kimi 1x və tarifsiz açılır; maaş və əmsal tətbiqdə təyin edilir. Əvvəlki əlavə maliyyə sütunları olan Excel fayllarının idxalı da dəstəklənir.

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
