"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import {
  amount,
  AppData,
  displayDate,
  durationMinutes,
  emptyData,
  Entry,
  entryRate,
  formatDuration,
  localDate,
  mergeData,
  money,
  monthLabel,
  newEntry,
  validateData,
} from "@/lib/model";
import {
  createWorkbook,
  downloadFile,
  jsonBackup,
  MAX_FILE_SIZE,
  parseBackup,
  parseWorkbook,
} from "@/lib/files";
import { STORAGE_KEY } from "@/lib/model";
import { EntryForm } from "./entry-form";
import {
  ActivitySummary,
  Breakdown,
  Multipliers,
  Stats,
  Trend,
  Weekdays,
} from "./analytics";
import { EmptyState, Field, Modal } from "./ui";

type Page = "records" | "analytics" | "data";
const NAV = [
  { id: "records", label: "Qeydlərim", icon: Clock3 },
  { id: "analytics", label: "Analiz", icon: BarChart3 },
  { id: "data", label: "Fayllar", icon: Database },
] as const;
const TITLES = {
  records: "Əlavə iş saatları",
  analytics: "Vaxt və gəlir analizi",
  data: "İdxal və ixrac",
};
const SUBTITLES = {
  records: "İş saatlarını qeyd et, məbləği avtomatik hesabla.",
  analytics: "Seçdiyin dövrün saat və məbləğlərinə bax.",
  data: "Excel hesabatı endir və ya əvvəlki qeydlərini yüklə.",
};

export default function OvertimeApp() {
  const [data, setData] = useState<AppData>(emptyData);
  const currentData = useRef(data);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [corruptRaw, setCorruptRaw] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const unsavedRef = useRef(false);
  const [page, setPage] = useState<Page>("records");
  const [period, setPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [multiplierFilter, setMultiplierFilter] = useState("");
  const [entryModal, setEntryModal] = useState<{
    entry: Entry;
    editing: boolean;
  } | null>(null);
  const [salaryMonth, setSalaryMonth] = useState<string | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: AppData;
    filename: string;
    mode: "json" | "excel";
  } | null>(null);
  const [help, setHelp] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 12000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPeriod(localDate().slice(0, 7));
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = parseBackup(raw);
        currentData.current = restored;
        setData(restored);
      }
    } catch {
      if (raw) {
        setCorruptRaw(raw);
        setStorageError(
          "Saxlanmış məlumat oxunmur. Orijinal nüsxə qorunur. Fayllar bölməsindən onu endir və ya düzgün JSON nüsxəsi ilə əvəz et.",
        );
      } else
        setStorageError(
          "Brauzer yaddaşı əlçatan deyil. Dəyişiklikləri itirməmək üçün JSON nüsxəsi endir və brauzerdə yaddaşa icazə ver.",
        );
    }
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (unsavedRef.current) {
        setStorageError(
          "Başqa vərəqdə dəyişiklik var. Bu vərəqdəki saxlanmamış məlumatları JSON kimi endir və səhifəni yenilə.",
        );
        return;
      }
      try {
        const updated = event.newValue
          ? parseBackup(event.newValue)
          : emptyData();
        currentData.current = updated;
        setData(updated);
        setCorruptRaw(null);
        setStorageError("");
      } catch {
        setStorageError(
          "Başqa vərəqdə saxlanmış məlumat oxunmur. JSON nüsxəsi ilə məlumatlarını qoru.",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsavedRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const commit = useCallback(
    (update: (old: AppData) => AppData, replace = false): boolean => {
      if (corruptRaw && !replace) {
        notify(
          "Əvvəlcə düzgün JSON nüsxəsi ilə bərpa et. Oxunmayan orijinal məlumat dəyişdirilmədi.",
          true,
        );
        return false;
      }
      let base = currentData.current;
      if (!replace && !unsavedRef.current) {
        let raw: string | null;
        try {
          raw = localStorage.getItem(STORAGE_KEY);
        } catch {
          raw = null;
        }
        if (raw) {
          try {
            base = parseBackup(raw);
          } catch {
            notify(
              "Brauzerdəki məlumat oxunmur. Yazılma dayandırıldı; əvvəlcə ehtiyat nüsxə yarat.",
              true,
            );
            return false;
          }
        }
      }
      const updated = update(base);
      try {
        validateData(updated);
      } catch (err) {
        notify((err as Error).message, true);
        return false;
      }
      currentData.current = updated;
      setData(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setStorageError("");
        setCorruptRaw(null);
        setUnsaved(false);
        unsavedRef.current = false;
      } catch {
        setStorageError(
          "Dəyişiklik brauzerdə saxlanmadı: yaddaş dolu və ya bağlı ola bilər. Səhifədən çıxmazdan əvvəl JSON ehtiyat nüsxəsi endir.",
        );
        setUnsaved(true);
        unsavedRef.current = true;
      }
      return true;
    },
    [corruptRaw, notify],
  );
  const month = period && period !== "all" ? period : localDate().slice(0, 7);
  const months = useMemo(
    () =>
      [
        ...new Set([
          period === "all" ? localDate().slice(0, 7) : period,
          localDate().slice(0, 7),
          ...Object.keys(data.months),
          ...data.entries.map((e) => e.date.slice(0, 7)),
        ]),
      ]
        .filter(Boolean)
        .sort()
        .reverse(),
    [data, period],
  );
  const selectedEntries = useMemo(
    () =>
      data.entries
        .filter((entry) => period === "all" || entry.date.startsWith(period))
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.start.localeCompare(a.start),
        ),
    [data.entries, period],
  );
  const projects = [
    ...new Set(selectedEntries.map((e) => e.project).filter(Boolean)),
  ].sort();
  const filteredEntries = useMemo(
    () =>
      selectedEntries.filter((entry) => {
        const term = search.trim().toLocaleLowerCase("az");
        return (
          (!term ||
            [
              entry.employee,
              entry.customer,
              entry.project,
              entry.subject,
              entry.reason,
              displayDate(entry.date),
            ].some((v) => v.toLocaleLowerCase("az").includes(term))) &&
          (!project || entry.project === project) &&
          (!multiplierFilter || entry.multiplier === Number(multiplierFilter))
        );
      }),
    [selectedEntries, search, project, multiplierFilter],
  );
  useEffect(() => {
    setPageNumber(1);
  }, [period, search, project, multiplierFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / 15));
  const actualPage = Math.min(pageNumber, totalPages);
  const visibleEntries = filteredEntries.slice(
    (actualPage - 1) * 15,
    actualPage * 15,
  );
  const openNew = () => {
    const today = localDate();
    const date =
      period === "all" || today.startsWith(month) ? today : `${month}-01`;
    setEntryModal({ entry: newEntry(data.profile, date), editing: false });
  };
  const saveEntry = (entry: Entry, remember: boolean) => {
    const success = commit((old) => ({
      ...old,
      entries: old.entries.some((e) => e.id === entry.id)
        ? old.entries.map((e) => (e.id === entry.id ? entry : e))
        : [...old.entries, entry],
      profile: remember
        ? {
            employee: entry.employee,
            manager: entry.manager,
            customer: entry.customer,
            project: entry.project,
            environment: entry.environment,
          }
        : old.profile,
    }));
    if (success) {
      setPeriod(entry.date.slice(0, 7));
      setProject("");
      setSearch("");
      setMultiplierFilter("");
      notify("Qeyd əlavə olundu. Yaddaş vəziyyəti yuxarıda göstərilir.");
    }
    return success;
  };
  const exportJson = () => {
    downloadFile(
      jsonBackup(data),
      `artisaat-ehtiyat-${localDate()}.json`,
      "application/json;charset=utf-8",
    );
    notify(
      "JSON ehtiyat nüsxəsi hazırdır. Bütün aylar və maaş məlumatları daxildir.",
    );
  };
  const exportExcel = async () => {
    setBusy(true);
    try {
      const entries = page === "records" ? filteredEntries : selectedEntries;
      if (!entries.length)
        throw new Error("İxrac üçün seçilmiş dövrdə qeyd yoxdur.");
      const workbook = await createWorkbook(data, entries);
      downloadFile(
        workbook as BlobPart,
        `artisaat-${period}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      notify(`${entries.length} qeyd və aylıq yekun Excel faylına yazıldı.`);
    } catch (err) {
      notify((err as Error).message || "Excel faylı hazırlana bilmədi.", true);
    } finally {
      setBusy(false);
    }
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_FILE_SIZE)
        throw new Error("Fayl ən çox 10 MB ola bilər.");
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "json" && extension !== "xlsx")
        throw new Error(
          "Yalnız .json və .xlsx faylları dəstəklənir. Köhnə .xls faylını Excel-də .xlsx kimi saxla.",
        );
      const imported =
        extension === "json"
          ? parseBackup(await file.text())
          : await parseWorkbook(await file.arrayBuffer());
      setPendingImport({
        data: imported,
        filename: file.name,
        mode: extension === "json" ? "json" : "excel",
      });
    } catch (err) {
      notify(
        (err as Error).message ||
          "Fayl oxunmadı. Düzgün JSON və ya XLSX faylı seç.",
        true,
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const changeMonth = (direction: number) => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + direction);
    if (date.getFullYear() < 1900 || date.getFullYear() > 2200) return;
    setPeriod(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
    setProject("");
  };
  if (!ready)
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          <Clock3 size={26} />
        </div>
        <p>Məlumatların hazırlanır…</p>
        <LoaderCircle className="spin" size={20} />
      </main>
    );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a
            href="#"
            className="brand"
            onClick={(event) => {
              event.preventDefault();
              setPage("records");
            }}
          >
            <span className="brand-mark">
              <Clock3 size={22} />
            </span>
            <span>ArtıSaat</span>
          </a>
          <div className="header-actions">
            <div className={`save-status ${storageError ? "save-error" : ""}`}>
              {storageError ? (
                <CircleHelp size={15} />
              ) : (
                <CheckCircle2 size={15} />
              )}
              <span>
                {storageError
                  ? unsaved
                    ? "Saxlanmayıb"
                    : "Yaddaşı yoxla"
                  : "Bu brauzerdə saxlanılır"}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Necə işləyir?"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
      </header>
      <main className="main-content">
        {storageError && (
          <div className="storage-warning" role="alert">
            <CircleHelp size={20} />
            <p>{storageError}</p>
            <button
              className="button secondary small"
              onClick={() => {
                if (corruptRaw)
                  downloadFile(
                    corruptRaw,
                    "artisaat-orijinal.json",
                    "application/json",
                  );
                else exportJson();
              }}
            >
              JSON endir
            </button>
          </div>
        )}
        <nav className="page-tabs" aria-label="Əsas menyu">
          {NAV.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              aria-current={page === item.id ? "page" : undefined}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="page-heading">
          <div>
            <h1>{TITLES[page]}</h1>
            <p>{SUBTITLES[page]}</p>
          </div>
          {page === "records" && (
            <button
              className="button primary"
              onClick={openNew}
              disabled={Boolean(corruptRaw)}
            >
              <Plus size={18} />
              Yeni qeyd
            </button>
          )}
        </div>
        {page !== "data" && (
          <div className="period-toolbar">
            <div className="period-selector">
              <CalendarDays size={17} />
              <select
                aria-label="Hesabat dövrü"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  setProject("");
                }}
              >
                <option value="all">Bütün tarixlər</option>
                {months.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
              <div className="month-arrows">
                <button aria-label="Əvvəlki ay" onClick={() => changeMonth(-1)}>
                  <ChevronLeft size={17} />
                </button>
                <button aria-label="Növbəti ay" onClick={() => changeMonth(1)}>
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            <div className="salary-control">
              {period !== "all" && data.months[month] && (
                <span>
                  {money(data.months[month].salary / data.months[month].hours)}{" "}
                  ₼ / saat
                </span>
              )}
              <button
                className="button secondary small"
                onClick={() => setSalaryMonth(month)}
              >
                <Wallet size={16} />
                Aylıq maaş
              </button>
            </div>
          </div>
        )}
        {page === "records" && (
          <>
            <Stats entries={filteredEntries} data={data} compact />
            {!data.months[month] && period !== "all" && (
              <p className="setup-note">
                Məbləği hesablamaq üçün “Aylıq maaş” bölməsində net maaşını və
                norma saatını daxil et.
              </p>
            )}
            <section
              className="panel records-panel"
              aria-label="Əlavə iş qeydləri"
            >
              <div className="records-toolbar">
                <h2>
                  Qeydlər{" "}
                  <span className="count-badge">{filteredEntries.length}</span>
                </h2>
                {data.entries.length > 0 && (
                  <div className="record-tools">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Qeydlərdə axtar"
                        placeholder="Qeyd axtar…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary small"
                      onClick={exportExcel}
                      disabled={busy || filteredEntries.length === 0}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Download size={16} />
                      )}
                      <span>Excel ixrac et</span>
                    </button>
                  </div>
                )}
              </div>
              {data.entries.length > 0 && (
                <details className="record-filters">
                  <summary>
                    Layihə və əmsal üzrə filtr
                    {project || multiplierFilter ? " · aktiv" : ""}
                  </summary>
                  <div className="filters">
                    <select
                      aria-label="Layihəyə görə filtr"
                      value={project}
                      onChange={(event) => setProject(event.target.value)}
                    >
                      <option value="">Bütün layihələr</option>
                      {projects.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Əmsala görə filtr"
                      value={multiplierFilter}
                      onChange={(event) =>
                        setMultiplierFilter(event.target.value)
                      }
                    >
                      <option value="">Bütün əmsallar</option>
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                    </select>
                    {(search || project || multiplierFilter) && (
                      <button
                        className="text-link"
                        onClick={() => {
                          setSearch("");
                          setProject("");
                          setMultiplierFilter("");
                        }}
                      >
                        Təmizlə
                      </button>
                    )}
                  </div>
                </details>
              )}
              {visibleEntries.length > 0 ? (
                <>
                  <div className="table-scroll">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>Tarix / vaxt</th>
                          <th>Mövzu / layihə</th>
                          <th>Müddət</th>
                          <th>Əmsal</th>
                          <th className="amount-cell">Məbləğ</th>
                          <th>
                            <span className="sr-only">Əməliyyatlar</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <strong>{displayDate(entry.date)}</strong>
                              <small>
                                {entry.start} – {entry.end}
                                {entry.end < entry.start && " (+1 gün)"}
                              </small>
                            </td>
                            <td className="subject-cell">
                              <strong title={entry.subject}>
                                {entry.subject || "Mövzu qeyd edilməyib"}
                              </strong>
                              <small>
                                {entry.project || "Layihəsiz"}
                                {entry.customer ? ` · ${entry.customer}` : ""}
                              </small>
                            </td>
                            <td>
                              <strong>
                                {formatDuration(durationMinutes(entry))}
                              </strong>
                              <small>saat : dəqiqə</small>
                            </td>
                            <td>
                              <span className={`pill pill-${entry.multiplier}`}>
                                {entry.multiplier}x
                              </span>
                            </td>
                            <td className="amount-cell">
                              <strong>
                                {amount(entry, data.months) === null
                                  ? "—"
                                  : `${money(amount(entry, data.months)!)} ₼`}
                              </strong>
                              <small>
                                {entryRate(entry, data.months) === null
                                  ? "Tarif yoxdur"
                                  : `${money(entryRate(entry, data.months)!)} ₼ / saat`}
                              </small>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`${displayDate(entry.date)} qeydini redaktə et`}
                                  onClick={() =>
                                    setEntryModal({
                                      entry: { ...entry },
                                      editing: true,
                                    })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label="Qeydi kopyala"
                                  onClick={() =>
                                    setEntryModal({
                                      entry: {
                                        ...entry,
                                        id: crypto.randomUUID(),
                                      },
                                      editing: false,
                                    })
                                  }
                                >
                                  <Copy size={15} />
                                </button>
                                <button
                                  className="icon-button danger-icon"
                                  aria-label={`${displayDate(entry.date)} qeydini sil`}
                                  onClick={() => setDeleteEntry(entry)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination">
                    <span>
                      {filteredEntries.length} qeyddən{" "}
                      {(actualPage - 1) * 15 + 1}–
                      {Math.min(actualPage * 15, filteredEntries.length)}
                    </span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Əvvəlki səhifə"
                        disabled={actualPage === 1}
                        onClick={() => setPageNumber(actualPage - 1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span>
                        {actualPage} / {totalPages}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Növbəti səhifə"
                        disabled={actualPage === totalPages}
                        onClick={() => setPageNumber(actualPage + 1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Clock3 size={27} />}
                  title={
                    search || project || multiplierFilter
                      ? "Uyğun qeyd tapılmadı"
                      : "Hələ qeyd yoxdur"
                  }
                  description={
                    search || project || multiplierFilter
                      ? "Axtarışı və ya filtrləri dəyiş."
                      : "Yeni qeyd əlavə et və ya əvvəlki Excel faylını yüklə."
                  }
                  action={
                    !search && !project && !multiplierFilter ? (
                      <button
                        className="text-link"
                        onClick={() => fileInput.current?.click()}
                        disabled={busy}
                      >
                        <Upload size={16} />
                        Excel-dən idxal et
                      </button>
                    ) : undefined
                  }
                />
              )}
            </section>
          </>
        )}
        {page === "analytics" && (
          <>
            <Stats entries={selectedEntries} data={data} compact />
            <div className="analytics-grid">
              <Trend data={data} month={period} />
              <Breakdown
                entries={selectedEntries}
                field="project"
                title="Layihələr üzrə"
                subtitle="Layihələrə sərf olunan vaxt"
              />
            </div>
            <details className="analysis-details">
              <summary>Daha ətraflı analiz</summary>
              <ActivitySummary entries={selectedEntries} />
              <div className="analytics-grid">
                <Multipliers entries={selectedEntries} data={data} />
                <Breakdown
                  entries={selectedEntries}
                  field="customer"
                  title="Müştərilər üzrə"
                  subtitle="Müştərilərə sərf olunan vaxt"
                />
                <Weekdays entries={selectedEntries} />
                <Breakdown
                  entries={selectedEntries}
                  field="reason"
                  title="Səbəblər üzrə"
                  subtitle="Əlavə işin səbəbləri"
                />
                <Breakdown
                  entries={selectedEntries}
                  field="environment"
                  title="İş mühiti üzrə"
                  subtitle="Ofis və məsafədən iş"
                />
                <MonthComparison data={data} month={month} />
              </div>
            </details>
          </>
        )}
        {page === "data" && (
          <div className="data-page">
            <section
              className="panel file-actions"
              aria-label="Fayl əməliyyatları"
            >
              <div className="data-card file-row">
                <FileJson size={23} />
                <div>
                  <h2>JSON ehtiyat nüsxəsi</h2>
                  <p>
                    Bütün qeydlər və maaş ayarları. Başqa cihazda bərpa edə
                    bilərsən.
                  </p>
                  <small>
                    {data.entries.length} qeyd ·{" "}
                    {Object.keys(data.months).length} aylıq maaş ayarı
                  </small>
                </div>
                <button className="button secondary" onClick={exportJson}>
                  <Download size={16} />
                  JSON endir
                </button>
              </div>
              <div className="data-card file-row">
                <FileSpreadsheet size={23} />
                <div>
                  <h2>Excel hesabatı</h2>
                  <p>
                    Qeydlərin və aylıq yekun, şirkət cədvəlinə uyğun formatda.
                  </p>
                  <div className="data-period">
                    <label htmlFor="export-period">Dövr</label>
                    <select
                      id="export-period"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                    >
                      <option value="all">Bütün tarixlər</option>
                      {months.map((key) => (
                        <option key={key} value={key}>
                          {monthLabel(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  className="button secondary"
                  onClick={exportExcel}
                  disabled={busy || selectedEntries.length === 0}
                >
                  <Download size={16} />
                  Excel endir
                </button>
              </div>
              <div className="file-row">
                <Upload size={23} />
                <div>
                  <h2>Fayldan idxal et</h2>
                  <p>
                    Əvvəlki JSON və ya Excel faylını yüklə. Əlavə etməzdən əvvəl
                    yoxlayacaqsan.
                  </p>
                  <small>.json və .xlsx · ən çox 10 MB</small>
                </div>
                <button
                  className="button primary"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <FolderOpen size={16} />
                  )}
                  Fayl seç
                </button>
              </div>
            </section>
            <p className="local-note">
              <ShieldCheck size={16} />
              Qeydlər bu brauzerdə saxlanır. Cihazlar arasında köçürmək üçün
              JSON nüsxəsi istifadə et.
            </p>
            <details className="guide-details">
              <summary>İdxal qaydaları</summary>
              <ul>
                <li>Excel-də Tarix, Başlanma və Bitmə sütunları olmalıdır.</li>
                <li>
                  Tarifi olmayan köhnə qeydlər saat analizində görünür. Məbləğ
                  üçün aylıq maaş ayarını daxil et.
                </li>
                <li>
                  Müddət vaxt aralığından qısadırsa fərq fasilə kimi qəbul
                  edilir.
                </li>
                <li>
                  JSON tam ehtiyat nüsxəsidir; Excel profil və aylıq maaş
                  ayarlarını daşımır.
                </li>
                <li>
                  Təkrar qeydlər ötürülür. Səhv sətir varsa bütün idxal
                  dayandırılır.
                </li>
              </ul>
            </details>
          </div>
        )}
        <footer className="page-footer">
          <span>ArtıSaat</span>
          <span>Məlumatların bu cihazda qalır.</span>
        </footer>
      </main>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.xlsx"
        className="sr-only"
        aria-label="JSON və ya Excel faylı seç"
        onChange={(e) => void readFile(e.target.files?.[0])}
      />
      {entryModal && (
        <EntryForm
          key={entryModal.entry.id}
          initial={entryModal.entry}
          data={data}
          editing={entryModal.editing}
          close={() => setEntryModal(null)}
          save={saveEntry}
        />
      )}
      {salaryMonth && (
        <SalaryForm
          key={salaryMonth}
          initialMonth={salaryMonth}
          data={data}
          close={() => setSalaryMonth(null)}
          save={(key, salary, hours, apply) => {
            const success = commit((old) => ({
              ...old,
              months: { ...old.months, [key]: { salary, hours } },
              entries: old.entries.map((e) =>
                e.date.startsWith(key) && (apply || e.rate === null)
                  ? { ...e, rate: salary / hours }
                  : e,
              ),
            }));
            if (success) {
              setSalaryMonth(null);
              setPeriod(key);
              notify(
                "Aylıq maaş və norma saatı yadda saxlanıldı. Digər aylar dəyişmədi.",
              );
            }
          }}
        />
      )}
      {deleteEntry && (
        <Modal
          title="Qeydi silmək istəyirsən?"
          subtitle={`${displayDate(deleteEntry.date)} · ${deleteEntry.start}–${deleteEntry.end}`}
          close={() => setDeleteEntry(null)}
        >
          <div className="modal-body">
            <p>
              Bu qeyd silinəcək. Əvvəlki JSON ehtiyat nüsxəndən onu yenidən
              bərpa edə bilərsən.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setDeleteEntry(null)}
            >
              Ləğv et
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (
                  commit((old) => ({
                    ...old,
                    entries: old.entries.filter((e) => e.id !== deleteEntry.id),
                  }))
                ) {
                  setDeleteEntry(null);
                  notify("Qeyd silindi.");
                }
              }}
            >
              <Trash2 size={17} />
              Qeydi sil
            </button>
          </div>
        </Modal>
      )}
      {pendingImport && (
        <ImportPreview
          pending={pendingImport}
          current={data}
          corrupt={Boolean(corruptRaw)}
          close={() => setPendingImport(null)}
          apply={(replace) => {
            let added = 0,
              skipped = 0;
            const success = commit((old) => {
              if (replace) {
                added = pendingImport.data.entries.length;
                return pendingImport.data;
              }
              const result = mergeData(old, pendingImport.data);
              added = result.added;
              skipped = result.skipped;
              return result.data;
            }, replace);
            if (success) {
              setPendingImport(null);
              setPeriod("all");
              setPage("records");
              setSearch("");
              setProject("");
              setMultiplierFilter("");
              notify(
                `${added} qeyd idxal edildi${skipped ? `, ${skipped} təkrar ötürüldü` : ""}.`,
              );
            }
          }}
        />
      )}
      {help && (
        <Modal title="ArtıSaat necə işləyir?" close={() => setHelp(false)}>
          <div className="modal-body help-content">
            <div>
              <span>01</span>
              <h3>Aylıq maaşını daxil et</h3>
              <p>
                Saatlıq tarif = aylıq net maaş ÷ ayın norma iş saatı. Hər ayın
                ayarı ayrıca saxlanır.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Vaxtını və əmsalı seç</h3>
              <p>
                Məbləğ = faktiki saat × saatlıq tarif × əmsal. 1x standartdır;
                2x və 3x də seçilə bilər. Fasilə iş vaxtından çıxılır.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>Qeydlərini qoru</h3>
              <p>
                Qeydlər brauzerdə avtomatik saxlanır. Telefon və kompüter
                arasında keçmək üçün JSON endir və digər cihazda idxal et. Eyni
                brauzer profilini paylaşan şəxslər eyni məlumatları görür.
              </p>
            </div>
            <div>
              <span>04</span>
              <h3>Hesabatını hazırla</h3>
              <p>
                Excel ixracında ilk 14 sütun şirkət cədvəlinə uyğundur; əlavə
                sütunlarda əmsal, tarif və məbləğ görünür. Aylıq yekun ayrıca
                vərəqdədir.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setHelp(false)}>
              Aydındır <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          {toast.error ? <CircleHelp size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Bildirişi bağla"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function SalaryForm({
  initialMonth,
  data,
  close,
  save,
}: {
  initialMonth: string;
  data: AppData;
  close: () => void;
  save: (month: string, salary: number, hours: number, apply: boolean) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [salary, setSalary] = useState(
    String(data.months[initialMonth]?.salary ?? ""),
  );
  const [hours, setHours] = useState(
    String(data.months[initialMonth]?.hours ?? ""),
  );
  const [apply, setApply] = useState(false);
  const [error, setError] = useState("");
  const rate =
    salary !== "" && Number(hours) > 0 ? Number(salary) / Number(hours) : null;
  const existing = data.entries.filter(
    (e) => e.date.startsWith(month) && e.rate !== null,
  ).length;
  return (
    <Modal
      title="Aylıq maaş ayarları"
      subtitle="Hər ayın maaşı və norma saatı ayrıca saxlanır."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !/^\d{4}-\d{2}$/.test(month) ||
            !salary ||
            !hours ||
            !Number.isFinite(Number(salary)) ||
            Number(salary) < 0 ||
            Number(hours) <= 0 ||
            Number(hours) > 744
          ) {
            setError("Ayı, net maaşı və düzgün norma saatını daxil et.");
            return;
          }
          save(month, Number(salary), Number(hours), apply);
        }}
      >
        <div className="modal-body">
          <Field label="Ay">
            <input
              type="month"
              required
              min="1900-01"
              max="2200-12"
              value={month}
              onChange={(e) => {
                const key = e.target.value;
                setMonth(key);
                setSalary(String(data.months[key]?.salary ?? ""));
                setHours(String(data.months[key]?.hours ?? ""));
                setApply(false);
              }}
            />
          </Field>
          <div className="form-grid two">
            <Field label="Net maaş (AZN)">
              <input
                type="number"
                required
                placeholder="Məsələn, 1200"
                min="0"
                max="1000000000"
                step="0.01"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </Field>
            <Field label="Norma iş saatı" hint="Ayın adi iş saatlarının cəmi">
              <input
                type="number"
                required
                placeholder="Məsələn, 160"
                min="0.01"
                max="744"
                step="0.01"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </Field>
          </div>
          <div className="rate-preview">
            <span>Saatlıq tarif</span>
            <strong>
              {rate === null || !Number.isFinite(rate) ? "—" : money(rate)}{" "}
              <small>AZN / saat</small>
            </strong>
          </div>
          <p className="muted small-copy">
            Tarifsiz qeydlər bu ayara əsasən hesablanacaq. Əvvəldən tarifi olan
            qeydlərin məbləği qorunur.
          </p>
          {existing > 0 && (
            <label className="checkbox warning-checkbox">
              <input
                type="checkbox"
                checked={apply}
                onChange={(e) => setApply(e.target.checked)}
              />
              Bu ayın əvvəlcədən tarifi olan {existing} qeydini də yeni maaşa
              görə yenidən hesabla
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={close}>
            Ləğv et
          </button>
          <button type="submit" className="button primary">
            <Check size={17} />
            Ayarları saxla
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportPreview({
  pending,
  current,
  corrupt,
  close,
  apply,
}: {
  pending: { data: AppData; filename: string; mode: string };
  current: AppData;
  corrupt: boolean;
  close: () => void;
  apply: (replace: boolean) => void;
}) {
  const [replace, setReplace] = useState(corrupt);
  const [confirmed, setConfirmed] = useState(false);
  const preview = mergeData(current, pending.data);
  const dates = pending.data.entries.map((e) => e.date).sort();
  return (
    <Modal title="İdxalı yoxla" subtitle={pending.filename} close={close}>
      <div className="modal-body">
        <div className="import-preview-stats">
          <div>
            <strong>{pending.data.entries.length}</strong>
            <span>qeyd</span>
          </div>
          <div>
            <strong>
              {formatDuration(
                pending.data.entries.reduce(
                  (s, e) => s + durationMinutes(e),
                  0,
                ),
              )}
            </strong>
            <span>saat</span>
          </div>
          <div>
            <strong>
              {
                new Set(pending.data.entries.map((e) => e.date.slice(0, 7)))
                  .size
              }
            </strong>
            <span>ay</span>
          </div>
        </div>
        {dates.length > 0 && (
          <p className="muted small-copy">
            Dövr: {displayDate(dates[0])} –{" "}
            {displayDate(dates[dates.length - 1])}
          </p>
        )}
        <label className="radio-option">
          <input
            type="radio"
            name="import-mode"
            checked={!replace}
            disabled={corrupt}
            onChange={() => {
              setReplace(false);
              setConfirmed(false);
            }}
          />
          <div>
            <strong>Mövcud qeydlərə əlavə et</strong>
            <p>
              {preview.added} yeni qeyd əlavə olunacaq, {preview.skipped} təkrar
              ötürüləcək. Mövcud profil və aylıq ayarlar qorunacaq; idxal edilən
              qeydlərin məlum tarifləri saxlanacaq.
            </p>
          </div>
        </label>
        <label className="radio-option">
          <input
            type="radio"
            name="import-mode"
            checked={replace}
            onChange={() => {
              setReplace(true);
              setConfirmed(false);
            }}
          />
          <div>
            <strong>Bütün məlumatları fayldakı ilə əvəz et</strong>
            <p>
              Hazırkı {current.entries.length} qeyd, profil və maaş ayarları
              silinərək fayldakı məlumatla əvəz olunacaq.
              {pending.mode === "excel" &&
                " Excel maaş ayarları və profil daşımır."}
            </p>
          </div>
        </label>
        {replace && (
          <div className="warning">
            <p>
              Davam etməzdən əvvəl hazırkı məlumatlarının JSON ehtiyat nüsxəsini
              saxlamağın məsləhətdir.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Bütün mövcud məlumatların əvəz olunmasını təsdiqləyirəm
            </label>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={close}>
          Ləğv et
        </button>
        <button
          className="button primary"
          disabled={replace && !confirmed}
          onClick={() => apply(replace)}
        >
          <Upload size={17} />
          {replace ? "Əvəz et və bərpa et" : "Qeydləri idxal et"}
        </button>
      </div>
    </Modal>
  );
}

function MonthComparison({ data, month }: { data: AppData; month: string }) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() - 1);
  const previous = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const now = data.entries.filter((e) => e.date.startsWith(month));
  const before = data.entries.filter((e) => e.date.startsWith(previous));
  const minutes = now.reduce((s, e) => s + durationMinutes(e), 0),
    previousMinutes = before.reduce((s, e) => s + durationMinutes(e), 0);
  const total = now.reduce((s, e) => s + (amount(e, data.months) ?? 0), 0),
    previousTotal = before.reduce(
      (s, e) => s + (amount(e, data.months) ?? 0),
      0,
    );
  return (
    <section className="panel comparison-panel">
      <div className="panel-heading">
        <div>
          <h2>Əvvəlki ayla müqayisə</h2>
          <p>
            {monthLabel(month)} / {monthLabel(previous)}
          </p>
        </div>
        <BarChart3 size={19} className="muted" />
      </div>
      <div className="comparison-row">
        <span>Faktiki müddət fərqi</span>
        <strong>
          {minutes >= previousMinutes ? "+" : "−"}
          {formatDuration(Math.abs(minutes - previousMinutes))} saat
        </strong>
      </div>
      <div className="comparison-row">
        <span>Məbləğ fərqi</span>
        <strong>
          {total >= previousTotal ? "+" : "−"}
          {money(Math.abs(total - previousTotal))} ₼
        </strong>
      </div>
      <p className="panel-footnote">
        Yalnız daxil edilmiş qeydlər müqayisə edilir. Tarifsiz qeydlər məbləğə
        daxil deyil.
      </p>
    </section>
  );
}
