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
  ListFilter,
  RotateCcw,
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
  dailyEntries,
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
import { getWorkNorm, CALENDAR_INDEX_URL } from "@/lib/work-calendar";
import { EntryForm } from "./entry-form";
import ThemeToggle from "./theme-toggle";
import { Stats } from "./analytics";
import { AnalyticsDashboard } from "./analytics-dashboard";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const ledger = useMemo(
    () => dailyEntries(data.entries, data.months),
    [data.entries, data.months],
  );
  const originalEntry = (entry: Entry) =>
    data.entries.find((item) => item.id === (entry.sourceId ?? entry.id)) ??
    entry;
  const months = useMemo(
    () =>
      [
        ...new Set([
          period === "all" ? localDate().slice(0, 7) : period,
          localDate().slice(0, 7),
          ...Object.keys(data.months),
          ...ledger.map((e) => e.date.slice(0, 7)),
        ]),
      ]
        .filter(Boolean)
        .sort()
        .reverse(),
    [data, period, ledger],
  );
  const selectedEntries = useMemo(
    () =>
      ledger
        .filter((entry) => period === "all" || entry.date.startsWith(period))
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.start.localeCompare(a.start),
        ),
    [ledger, period],
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
      notify(
        `${entries.length} qeyd şirkət cədvəli formatında Excel faylına yazıldı.`,
      );
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
    <div
      className={`app-shell${page === "analytics" ? " analytics-shell" : ""}`}
    >
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
          <div className="header-actions">
            <ThemeToggle />
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

        {page === "data" ? (
          <div className="page-heading">
            <div>
              <h1>{TITLES[page]}</h1>
              <p>{SUBTITLES[page]}</p>
            </div>
          </div>
        ) : page === "records" ? (
          <h1 className="sr-only">Əlavə iş saatları</h1>
        ) : null}
        {page === "records" && (
          <div className="period-toolbar">
            <div className="period-left">
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
                  <button
                    aria-label="Əvvəlki ay"
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    aria-label="Növbəti ay"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <div className="salary-control">
                <button
                  className="button secondary salary-button"
                  aria-label="Aylıq maaş"
                  onClick={() => setSalaryMonth(month)}
                >
                  <Wallet size={19} />
                  <span>
                    Aylıq maaş
                    {data.months[month] ? (
                      <>
                        : <strong>{money(data.months[month].salary)} ₼</strong>
                        <small>
                          {" "}
                          / {getWorkNorm(month)?.hours ?? "—"} s ·{" "}
                          {data.months[month].basis === "gross"
                            ? "əvvəlki brutto"
                            : "net"}
                        </small>
                      </>
                    ) : (
                      " əlavə et"
                    )}
                  </span>
                </button>
              </div>
            </div>
            {page === "records" && (
              <button
                className="button primary new-record-button"
                onClick={openNew}
                disabled={Boolean(corruptRaw)}
              >
                <Plus size={21} />
                Yeni qeyd
              </button>
            )}
          </div>
        )}
        {page === "records" && (
          <>
            <Stats entries={selectedEntries} data={data} compact />
            {!data.months[month] && period !== "all" && (
              <p className="setup-note">
                “Aylıq maaş” bölməsində net maaşını daxil et. Rəsmi norma saatı
                avtomatik seçilir.
              </p>
            )}
            {data.months[month] &&
              data.months[month].basis === "gross" &&
              period !== "all" && (
                <p className="setup-note">
                  Bu ay üçün əvvəlki brutto maaş saxlanıb. Hesablamanı davam
                  etdirmək üçün “Aylıq maaş” bölməsində net maaşını daxil et.
                </p>
              )}
            <section
              className="panel records-panel"
              aria-label="Əlavə iş qeydləri"
            >
              <div className="records-toolbar">
                <h2 className="sr-only">Qeydlər</h2>
                <div className="record-tools">
                  <label className="search-box">
                    <Search size={21} />
                    <input
                      type="search"
                      aria-label="Qeydlərdə axtar"
                      placeholder="Qeydlərdə axtarış (mövzu, layihə, əməkdaş)…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <button
                    className="button filter-toggle"
                    aria-expanded={filtersOpen}
                    aria-controls="record-filter-fields"
                    onClick={() => setFiltersOpen((value) => !value)}
                  >
                    <ListFilter size={20} />
                    <span>Filtrlər</span>
                    {(project || multiplierFilter) && (
                      <small>
                        {Number(Boolean(project)) +
                          Number(Boolean(multiplierFilter))}
                      </small>
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Filtrləri təmizlə"
                    title="Filtrləri təmizlə"
                    onClick={() => {
                      setSearch("");
                      setProject("");
                      setMultiplierFilter("");
                    }}
                  >
                    <RotateCcw size={19} />
                  </button>
                  <button
                    className="icon-button export-icon"
                    aria-label="Excel ixrac et"
                    title="Excel ixrac et"
                    onClick={exportExcel}
                    disabled={busy || filteredEntries.length === 0}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={19} />
                    ) : (
                      <Download size={19} />
                    )}
                  </button>
                </div>
              </div>
              <div
                className="record-filters"
                id="record-filter-fields"
                hidden={!filtersOpen}
              >
                <div className="filters">
                  <Field label="Layihə">
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
                  </Field>
                  <Field label="Əmsal">
                    <select
                      aria-label="Əmsala görə filtr"
                      value={multiplierFilter}
                      onChange={(event) =>
                        setMultiplierFilter(event.target.value)
                      }
                    >
                      <option value="">Hamısı</option>
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                    </select>
                  </Field>
                  <p>
                    Göstərilir: <strong>{filteredEntries.length}</strong> /{" "}
                    {selectedEntries.length} qeyd
                  </p>
                </div>
              </div>
              {visibleEntries.length > 0 ? (
                <>
                  <div className="table-scroll">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>Tarix və vaxt</th>
                          <th>Mövzu və layihə</th>
                          <th>Faktiki saat</th>
                          <th>Əmsal</th>
                          <th className="amount-cell">Məbləğ</th>
                          <th>Əməliyyatlar</th>
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
                                <span className="project-label">
                                  {entry.project || "Layihəsiz"}
                                </span>
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
                                      entry: { ...originalEntry(entry) },
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
                                        ...originalEntry(entry),
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
                                  onClick={() =>
                                    setDeleteEntry(originalEntry(entry))
                                  }
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
                    <div className="record-summary-inline">
                      <span>
                        Cəmi:{" "}
                        <strong>
                          {formatDuration(
                            filteredEntries.reduce(
                              (sum, entry) => sum + durationMinutes(entry),
                              0,
                            ),
                          )}
                        </strong>{" "}
                        saat
                      </span>
                      <strong>
                        {money(
                          filteredEntries.reduce(
                            (sum, entry) =>
                              sum + (amount(entry, data.months) ?? 0),
                            0,
                          ),
                        )}{" "}
                        ₼
                      </strong>
                    </div>
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
            <p className="privacy-strip">
              <ShieldCheck size={20} />
              Məlumatlar yalnız brauzerinin yerli yaddaşında saxlanılır. Ehtiyat
              nüsxə üçün JSON endirə bilərsən.
            </p>
          </>
        )}
        {page === "analytics" && (
          <AnalyticsDashboard
            data={data}
            period={period}
            months={months}
            onPeriod={(key) => {
              setPeriod(key);
              setProject("");
            }}
            onChangeMonth={changeMonth}
            onNew={openNew}
            onSalary={setSalaryMonth}
            disabled={Boolean(corruptRaw)}
          />
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
                    Seçdiyin qeydlər, açıq yaşıl başlıqlı 14 sütunlu şirkət
                    cədvəlində.
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
                  JSON tam ehtiyat nüsxəsidir; Excel profil, maaş, əmsal və
                  məbləği daşımır.
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
          save={(key, salary) => {
            const hours = getWorkNorm(key)!.hours;
            const success = commit((old) => ({
              ...old,
              months: {
                ...old.months,
                [key]: { salary, hours, basis: "net" },
              },
              entries: old.entries.map((e) =>
                e.date.startsWith(key) ? { ...e, rate: salary / hours } : e,
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
              Bu qeyd bütün günlərə düşən hissələri ilə birlikdə silinəcək.
              Əvvəlki JSON ehtiyat nüsxəndən onu yenidən bərpa edə bilərsən.
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
              const result = mergeData(old, pendingImport.data, {
                matchByWork: pendingImport.mode === "excel",
              });
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
                Saatlıq tarif = aylıq net maaş ÷ həmin ay üçün ƏƏSMN-nin rəsmi
                norma saatı. Yalnız maaşını daxil edirsən.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Vaxtını və əmsalı seç</h3>
              <p>
                Məbləğ = faktiki saat × həmin ayın net maaşına uyğun tarif ×
                seçilən əmsal. Yeni qeyddə 2x seçilir; əmsalı işin növünə uyğun
                dəyişə bilərsən. Ay dəyişəndə hər hissə öz ayının maaşı və
                norması ilə hesablanır. Norma daxilində/üstündə olması normal iş
                qrafiki bilinmədən avtomatik müəyyən edilmir.
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
                Excel yalnız şirkət cədvəlinin 14 sütununu saxlayır. Maaş, əmsal
                və məbləğ daxil olmaqla bütün məlumatları qorumaq üçün JSON
                ehtiyat nüsxəsini endir.
                <a
                  href="https://e-qanun.az/framework/46943"
                  target="_blank"
                  rel="noreferrer"
                >
                  Əmək Məcəlləsi: 164–165 ↗
                </a>
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
  save: (month: string, salary: number) => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [salary, setSalary] = useState(
    String(
      data.months[initialMonth]?.basis === "gross"
        ? ""
        : (data.months[initialMonth]?.salary ?? ""),
    ),
  );
  const norm = getWorkNorm(month);
  const hours = norm?.hours ?? null;
  const [error, setError] = useState("");
  const rate = salary !== "" && hours ? Number(salary) / hours : null;
  return (
    <Modal
      title="Aylıq maaş ayarları"
      subtitle="Net maaşını daxil et. Norma saatı rəsmi təqvimdən seçilir."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !/^\d{4}-\d{2}$/.test(month) ||
            !salary ||
            !norm ||
            !Number.isFinite(Number(salary)) ||
            Number(salary) < 0 ||
            Number(hours) <= 0 ||
            Number(hours) > 744
          ) {
            setError(
              "Ayı və net maaşını düzgün daxil et; norma avtomatik seçilir.",
            );
            return;
          }
          save(month, Number(salary));
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
                setSalary(
                  String(
                    data.months[key]?.basis === "gross"
                      ? ""
                      : (data.months[key]?.salary ?? ""),
                  ),
                );
              }}
            />
          </Field>
          {data.months[month] && data.months[month].basis === "gross" && (
            <p className="inline-info">
              Əvvəlki brutto maaş: {money(data.months[month].salary)} ₼. Net
              maaşını daxil et; overtime bu məbləğə görə hesablanacaq.
            </p>
          )}
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
            <div className="norm-note">
              <span>Rəsmi norma iş saatı</span>
              <strong>{norm ? `${norm.hours} saat` : "Məlumat yoxdur"}</strong>
              <small>Beşgünlük, həftədə 40 saat</small>
              <a
                href={norm?.sourceUrl ?? CALENDAR_INDEX_URL}
                target="_blank"
                rel="noreferrer"
              >
                ƏƏSMN · İstehsalat təqvimi ↗
              </a>
            </div>
          </div>
          <div className="rate-preview">
            <span>Saatlıq tarif</span>
            <strong>
              {rate === null || !Number.isFinite(rate) ? "—" : money(rate)}{" "}
              <small>AZN / saat</small>
            </strong>
          </div>
          <p className="muted small-copy">
            Bu ayın qeydləri rəsmi norma və daxil etdiyin maaşa görə yenidən
            hesablanır. Digər aylar dəyişmir.
          </p>
          {!norm && (
            <p className="form-error" role="alert">
              Bu il üçün təsdiqlənmiş norma hazırda tətbiqdə yoxdur. Rəsmi
              təqvim əlavə edilənədək maaş üzrə hesablama aparılmır.
            </p>
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
          <button type="submit" className="button primary" disabled={!norm}>
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
  const preview = mergeData(current, pending.data, {
    matchByWork: pending.mode === "excel",
  });
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
                " Excel maaş, əmsal və profil ayarlarını daşımır."}
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
