# ArtıSaat — dizayn tapşırığı

ArtıSaat əməkdaşın əlavə iş saatlarını qeyd etməsi və qarşılığındakı məbləği görməsi üçün sadə Azərbaycan dilli tətbiqdir. Əsas istifadəçi texniki bilik olmadan bir neçə saniyəyə qeyd əlavə edə bilməlidir.

## Tətbiqin etdiyi işlər

1. Hər ayın net maaşını saxlayır; norma iş saatını ƏƏSMN-nin rəsmi təqvimindən tarixə görə avtomatik seçir və saatlıq tarifi hesablayır.
2. Tarix, başlanma və bitmə saatından əlavə iş müddətini çıxarır. Yeni formada fasilə seçimi yoxdur; gecəni keçən qeydləri qəbul edir.
3. Standart 2x, seçilə bilən 2x və 3x əmsalla hər qeydin məbləğini hesablayır.
4. Qeydləri brauzerdə avtomatik saxlayır; redaktə, kopyalama, silmə, ay/mətn/layihə/əmsal filtrləri var.
5. Saat və məbləğlərin aylıq yekununu, aylıq trendi, layihə/müştəri/səbəb/iş mühiti/həftə günləri/əmsal bölgüsünü və əvvəlki ayla müqayisəni göstərir.
6. JSON ilə bütün məlumatların ehtiyat nüsxəsini çıxarır və bərpa edir; əvvəlki Excel fayllarını idxal edib analizə daxil edir, şirkət formatında Excel ixrac edir.

Bu versiyada giriş, ortaq hesab, rəhbər paneli, təsdiq və ödəniş statusu yoxdur. Hər kəs öz brauzerində işləyir. Eyni brauzer profilində məlumatlar ortaq görünür; başqa cihazla avtomatik sinxronizasiya yoxdur. Saxlanmış məlumat sxemi və `overtime-noter:v1` yaddaş açarı dəyişdirilməməlidir.

## Məlumat xanaları

| Bölmə         | İstifadəçinin daxil etdiyi                                                 | Avtomatik hesablanan           |
| ------------- | -------------------------------------------------------------------------- | ------------------------------ |
| Aylıq maaş    | Ay/il, net maaş (AZN)                                                      | Saatlıq tarif                  |
| Əsas qeyd     | Tarix, başlanma saatı, bitmə saatı, əmsal (1x/2x/3x), istəyə görə mövzu    | İl, ay, faktiki müddət, məbləğ |
| Əlavə məlumat | Əməkdaş, şöbə müdiri, müştəri, layihə, icra günü statusu, iş mühiti, səbəb | —                              |

“İcra günü statusu” işin qeyri-iş saatı, istirahət günü və ya bayram günü olmasını bildirir. Təsdiq və ödəniş statusu deyil. Bütün məlumat xanaları bir pəncərədə açıq olmalıdır; onları ayrıca açılan bölmədə gizlətməyin. Əməkdaş, rəhbər, müştəri, layihə və iş mühiti növbəti qeyd üçün yadda saxlanıla bilər.

## Hesablama

```text
Saatlıq tarif = net maaş / ayın norma iş saatı
Məbləğ = iş dəqiqəsi / 60 × saatlıq tarif × əmsal
```

Məsələn, 1 200 AZN / 160 saat = 7,50 AZN/saat. 18:00–20:00 aralığı 1x üçün 15,00 AZN, 2x üçün 30,00 AZN, 3x üçün 45,00 AZN edir. Faktiki saat əmsaldan asılı olaraq artmır. Hər ayın maaşı ayrıdır; həmin ayın qeydləri maaş və rəsmi normaya görə yenidən hesablanır.

## Sadə ekran quruluşu

- Üstdə ArtıSaat adı, mərkəzdə menyu, avtomatik saxlama göstəricisi və açıq/tünd rejim düyməsi.
- Üç tab: **Qeydlərim**, **Analiz**, **Fayllar**. Yan menyu yoxdur.
- Qeydlərim: ay seçimi, Aylıq maaş düyməsi, cəmi saat və cəmi məbləğ, Yeni qeyd düyməsi və qeydlər. Əsas ekranda qrafik yoxdur.
- Yeni qeyd: tarix, iki saat, əmsal, mövzu; müddət və məbləğ dərhal görünür. Digər məlumat xanaları da eyni pəncərədə açıq görünür.
- Qeydlər masaüstündə sadə cədvəl, telefonda asan oxunan kartlardır.
- Analiz: son Stitch HTML əsasında dörd göstərici (saat, məbləğ, gündəlik orta, əsas əmsal payı), altı aylıq sütun qrafiki, layihə və əmsal dairələri, təqvim həftələri üzrə yük və aylararası müqayisə. Əlavə bölgülər “Daha ətraflı analiz” altında qalır. Açıq/tünd rejim və mobil quruluş dəstəklənir. Nümunə rəqəmlər yerinə real qeydlər istifadə olunur; süni overtime limiti yoxdur.
- Fayllar: JSON endir, Excel endir, Fayl seç. İdxalın əvvəlcədən icmalı və təsdiqi saxlanılır.

Excel-də yalnız bu 14 sütun var: İl, Ay, Əməkdaş, Şöbə müdiri, Müştəri, Layihə, Tarix, Başlanma, Bitmə, İcra günü statusu, İş mühiti, Müddət (saat: dəqiqə), Mövzu, Səbəb. Bir vərəq, açıq yaşıl başlıq və incə yaşıl çərçivə (seçilmiş 2-ci variant). Əlavə sütun, başlıq və yekun sətri yoxdur. Maaş və əmsal daxil bütün məlumatları saxlamaq üçün JSON istifadə edilir.

## Başqa AI-yə veriləcək prompt

```text
Design a minimal, easy-to-understand responsive web app called “ArtıSaat”.
It helps employees record overtime and calculate its value in AZN.
All interface text must be in Azerbaijani.

The main goal is to add an overtime record in a few seconds. Use a calm white
background, thin gray borders, one muted green accent, readable 14–16 px body
text, clear labels, and generous spacing. Avoid decorative dashboards,
gradients, large slogans, sidebars, and repeated action buttons.

Use three simple top tabs: “Qeydlərim”, “Analiz”, and “Fayllar”.

1. Qeydlərim (the default screen): month selector, “Aylıq maaş” settings,
   only two summary values (total actual hours and total amount), one prominent
   “Yeni qeyd” button, and a clean records list. No charts on this screen.
   Desktop columns: date/time, subject/project, duration, multiplier, amount,
   and edit/copy/delete actions. Use readable cards on phones. Keep search
   visible and project/multiplier filters behind a small expandable control.
2. New-record form: date, start time, end time, multiplier segmented control
   (1x, 2x default, 3x), optional subject. There is no break field.
   Display calculated duration and amount immediately. Show employee, manager, customer, project, day type, work environment, and reason in the same form, always expanded. Provide clear “Qeydi saxla” and “Ləğv et” buttons.
3. Monthly salary settings: month/year, monthly net salary in AZN, a read-only official monthly norm from the Azerbaijan Ministry of Labour production calendar, and a read-only hourly rate. The user cannot enter the monthly hours.
   Amount = worked hours × (net salary / monthly normal hours)
   × multiplier. Two actual hours at 3x remain two hours in time summaries.
4. Analiz: four live metrics, a six-month bar chart, project and multiplier donuts, calendar-week workload, and a previous-month comparison. Use real records, net salary and 1x/2x/3x only; no invented overtime limit.
   Put customer, reason, environment, weekday, multiplier, and previous-month
   comparison behind “Daha ətraflı analiz”.
5. Fayllar: download a complete JSON backup, restore/merge JSON, export XLSX,
   and import an existing XLSX. Show an import preview before confirmation.

Include empty, populated, validation-error, missing-salary, and import-preview
states. Support overnight shifts with no break selector. Show a small auto-save
indicator. No login, subscription, team management, approval, or payment
status: each person's data stays in their own browser. Device-to-device
transfer uses JSON. Do not add features outside this scope.

For an existing-code redesign: preserve all calculation, import/export,
validation, and localStorage behavior, including the existing storage key and
backup schema. Change presentation only. Use Next.js, React, and TypeScript.

Deliver desktop and mobile screens with a consistent, restrained design.
```

Vizual ekranlar üçün Google Stitch, işlək Next.js/React interfeysi üçün v0, dizaynı Figma daxilində davam etdirmək üçün Figma Make istifadə edilə bilər. Mövcud funksiyaları saxlayan işlək kod istənilirsə bu promptu v0-da mövcud layihə ilə birlikdə istifadə etmək uyğundur.

## Son təsdiqlənmiş dizayn

İlk yüklənmiş Stitch ZIP dizaynı əsasdır: mərkəzdə menyu, açıq bənövşəyi fon, ağ kartlar, yaşıl vurğu; açıq/tünd rejim. Dizayndakı fasilə sütunu və 1.5x nümunələri tətbiq edilmir: istifadəçinin tələbi 1x/2x/3x və fasiləsiz yeni qeyddir.

Hesablama yeniləməsi: gecəni keçən qeyd günlərə bölünür, hər gün öz ayının maaşı və rəsmi normasından istifadə edir. Gecə əlavəsi yoxdur. Formada hər günün müddəti, net maaşa uyğun tarifi və məbləği göstərilir. Əvvəlki net maaşlar qorunur. Brutto kimi saxlanmış ay üçün istifadəçi net maaşını daxil edir; avtomatik vergi çevirməsi aparılmır.
