"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
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
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
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
import { Breakdown, Multipliers, Stats, Trend, Weekdays } from "./analytics";
import { EmptyState, Field, Modal } from "./ui";

type Page = "overview" | "records" | "analytics" | "data";
const NAV = [
  { id: "overview", label: "İcmal", icon: LayoutDashboard },
  { id: "records", label: "Qeydlərim", icon: Clock3 },
  { id: "analytics", label: "Analiz", icon: BarChart3 },
  { id: "data", label: "Məlumatlar", icon: Database },
] as const;
const TITLES = {
  overview: "Vaxtına dəyər qat.",
  records: "Hər saat öz yerində.",
  analytics: "Rəqəmlərin arxasındakı hekayə.",
  data: "Məlumatların səninlə qalsın.",
};
const SUBTITLES = {
  overview: "Əlavə iş saatların və qazancın, bir yerdə.",
  records: "Overtime qeydlərini gör, axtar və idarə et.",
  analytics: "Vaxtını hara sərf etdiyini daha yaxşı anla.",
  data: "Ehtiyat nüsxə yarat, Excel-dən idxal et və hesabatını paylaş.",
};

export default function OvertimeApp() {
  const [data, setData] = useState<AppData>(emptyData);
  const currentData = useRef(data);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [corruptRaw, setCorruptRaw] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const unsavedRef = useRef(false);
  const [page, setPage] = useState<Page>("overview");
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
          "Saxlanmış məlumat oxunmur. Orijinal nüsxə qorunur. Məlumatlar bölməsindən onu endir və ya düzgün JSON nüsxəsi ilə əvəz et.",
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
  const visibleEntries =
    page === "overview"
      ? selectedEntries.slice(0, 5)
      : filteredEntries.slice((actualPage - 1) * 15, actualPage * 15);
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
      `overtime-ehtiyat-${localDate()}.json`,
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
        `overtime-${period}.xlsx`,
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
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <div className="brand-mark">
            <Clock3 size={25} strokeWidth={2.2} />
          </div>
          <span>
            overtime<span className="brand-period">.</span>
            <small>VAXTININ DƏYƏRİ</small>
          </span>
        </a>
        <div className="nav-caption">İŞ MƏKANIN</div>
        <nav aria-label="Əsas menyu">
          {NAV.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "records" && data.entries.length > 0 && (
                <small>{data.entries.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <div>
              <ShieldCheck size={18} />
              <strong>Şəxsi iş məkanın</strong>
            </div>
            <p>
              Qeydlərin yalnız bu brauzerdə saxlanır. Ehtiyat nüsxəni unutma.
            </p>
            <button onClick={exportJson}>
              JSON nüsxəsi endir <ArrowDownToLine size={15} />
            </button>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            Necə işləyir?
          </button>
          <div className="user-card">
            <span className="avatar">
              {data.profile.employee
                ? data.profile.employee
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")
                    .toLocaleUpperCase("az")
                : "S"}
            </span>
            <div>
              <strong>{data.profile.employee || "Şəxsi iş məkanı"}</strong>
              <small>Lokal iş məkanı · AZN</small>
            </div>
            <button
              className="icon-button"
              aria-label="Aylıq maaş ayarları"
              onClick={() => setSalaryMonth(month)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            İş məkanım <ChevronRight size={14} />
            <strong>{NAV.find((item) => item.id === page)?.label}</strong>
          </div>
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
                      "overtime-orijinal.json",
                      "application/json",
                    );
                  else exportJson();
                }}
              >
                JSON endir
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "SƏNİN İŞ GÜNDƏLİYİN"
                  : page === "analytics"
                    ? "VAXT VƏ GƏLİR"
                    : page === "records"
                      ? "OVERTIME QEYDLƏRİ"
                      : "İDXAL VƏ İXRAC"}
              </div>
              <h1>{TITLES[page]}</h1>
              <p>{SUBTITLES[page]}</p>
            </div>
            <button
              className="button primary"
              onClick={openNew}
              disabled={Boolean(corruptRaw)}
            >
              <Plus size={18} />
              Yeni qeyd
            </button>
          </div>
          {page !== "data" && (
            <div className="period-toolbar">
              <div className="period-selector">
                <CalendarDays size={17} />
                <select
                  aria-label="Hesabat dövrü"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
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
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    aria-label="Növbəti ay"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="toolbar-actions">
                <button
                  className="button text-button"
                  onClick={() => setSalaryMonth(month)}
                >
                  <Wallet size={17} />
                  <span>Aylıq maaş</span>
                </button>
                <button
                  className="button secondary small"
                  onClick={exportExcel}
                  disabled={busy || selectedEntries.length === 0}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Excel ixrac et
                </button>
              </div>
            </div>
          )}
          {page === "overview" && (
            <>
              {!data.months[month] && (
                <div className="salary-banner">
                  <span className="banner-icon">
                    <Wallet size={21} />
                  </span>
                  <div>
                    <strong>Vaxtının saatlıq dəyərini təyin et</strong>
                    <p>
                      {monthLabel(month)} üçün net maaş və norma saatını daxil
                      et, məbləğlər avtomatik hesablansın.
                    </p>
                  </div>
                  <button onClick={() => setSalaryMonth(month)}>
                    Maaş əlavə et <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <Stats entries={selectedEntries} data={data} />
              <div className="overview-charts">
                <Trend data={data} month={period} />
                <Multipliers entries={selectedEntries} data={data} />
              </div>
            </>
          )}
          {(page === "overview" || page === "records") && (
            <section className="panel records-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {page === "overview" ? "Son qeydlər" : "Overtime qeydləri"}
                    <span className="count-badge">
                      {page === "overview"
                        ? selectedEntries.length
                        : filteredEntries.length}
                    </span>
                  </h2>
                  <p>
                    {page === "overview"
                      ? "Əlavə iş saatlarının qısa icmalı"
                      : "Seçilmiş dövrə aid bütün qeydlər"}
                  </p>
                </div>
                {page === "overview" ? (
                  <button
                    className="text-link"
                    onClick={() => setPage("records")}
                  >
                    Hamısına bax <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="button secondary small"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    <Upload size={15} />
                    İdxal et
                  </button>
                )}
              </div>
              {page === "records" && (
                <>
                  <div className="record-summary">
                    <span>
                      <Clock3 size={15} />
                      {formatDuration(
                        filteredEntries.reduce(
                          (s, e) => s + durationMinutes(e),
                          0,
                        ),
                      )}{" "}
                      saat
                    </span>
                    <span>
                      <Wallet size={15} />
                      {money(
                        filteredEntries.reduce(
                          (s, e) => s + (amount(e, data.months) ?? 0),
                          0,
                        ),
                      )}{" "}
                      AZN
                    </span>
                  </div>
                  <div className="filters">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Qeydlərdə axtar"
                        placeholder="Mövzu, layihə və ya tarix axtar…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label className="filter-select">
                      <ListFilter size={16} />
                      <select
                        aria-label="Layihəyə görə filtr"
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                      >
                        <option value="">Bütün layihələr</option>
                        {projects.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <select
                      aria-label="Əmsala görə filtr"
                      value={multiplierFilter}
                      onChange={(e) => setMultiplierFilter(e.target.value)}
                    >
                      <option value="">Bütün əmsallar</option>
                      <option value="1">1x</option>
                      <option value="2">2x</option>
                      <option value="3">3x</option>
                    </select>
                    {(search || project || multiplierFilter) && (
                      <button
                        className="icon-button"
                        aria-label="Filtrləri təmizlə"
                        onClick={() => {
                          setSearch("");
                          setProject("");
                          setMultiplierFilter("");
                        }}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                </>
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
                  {page === "records" && (
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
                  )}
                </>
              ) : (
                <EmptyState
                  icon={<Clock3 size={29} />}
                  title={
                    search || project || multiplierFilter
                      ? "Uyğun qeyd tapılmadı"
                      : "İlk saatını qeyd et"
                  }
                  description={
                    search || project || multiplierFilter
                      ? "Axtarış sözünü və ya filtrləri dəyişərək yenidən yoxla."
                      : "Əlavə işlədiyin vaxtı qeyd et, qazancını bizimlə izləməyə başla."
                  }
                  action={
                    !search && !project && !multiplierFilter ? (
                      <div className="empty-actions">
                        <button className="button primary" onClick={openNew}>
                          <Plus size={17} />
                          İlk qeydi əlavə et
                        </button>
                        <button
                          className="text-link"
                          onClick={() => fileInput.current?.click()}
                          disabled={busy}
                        >
                          Excel-dən idxal et
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              )}
            </section>
          )}
          {page === "analytics" && (
            <>
              <Stats entries={selectedEntries} data={data} />
              <div className="analytics-grid">
                <Trend data={data} month={period} />
                <Multipliers entries={selectedEntries} data={data} />
                <Breakdown
                  entries={selectedEntries}
                  field="project"
                  title="Layihələr üzrə"
                  subtitle="Ən çox vaxt ayırdığın layihələr"
                />
                <Breakdown
                  entries={selectedEntries}
                  field="customer"
                  title="Müştərilər üzrə"
                  subtitle="Müştərilərə sərf olunan əlavə vaxt"
                />
                <Weekdays entries={selectedEntries} />
                <Breakdown
                  entries={selectedEntries}
                  field="reason"
                  title="Səbəblər üzrə"
                  subtitle="Əlavə işə səbəb olan tapşırıqlar"
                />
                <Breakdown
                  entries={selectedEntries}
                  field="environment"
                  title="İş mühiti üzrə"
                  subtitle="Ofisdə və məsafədən işlədiyin vaxt"
                />
                <MonthComparison data={data} month={month} />
              </div>
            </>
          )}
          {page === "data" && (
            <div className="data-page">
              <div className="privacy-banner">
                <ShieldCheck size={27} />
                <div>
                  <h2>Məlumatların sənin nəzarətindədir.</h2>
                  <p>
                    Bu versiyada hesabla giriş və bulud sinxronizasiyası yoxdur.
                    Məlumatlar bu cihazın bu brauzerindədir. Brauzer
                    məlumatlarını silmək qeydləri də silir. Başqa cihazda davam
                    etmək üçün JSON nüsxəni idxal et.
                  </p>
                </div>
              </div>
              <div className="data-cards">
                <section className="panel data-card">
                  <div className="file-icon json-icon">
                    <FileJson size={27} />
                  </div>
                  <h2>Tam ehtiyat nüsxə</h2>
                  <p>
                    Bütün qeydlər, aylıq maaşlar və yadda saxladığın sahələr bir
                    JSON faylında. Tam bərpa üçün ən uyğun seçim.
                  </p>
                  <div className="file-meta">
                    {data.entries.length} qeyd ·{" "}
                    {Object.keys(data.months).length} aylıq maaş ayarı
                  </div>
                  <button className="button primary" onClick={exportJson}>
                    <Download size={17} />
                    JSON endir
                  </button>
                </section>
                <section className="panel data-card">
                  <div className="file-icon excel-icon">
                    <FileSpreadsheet size={27} />
                  </div>
                  <h2>Excel hesabatı</h2>
                  <p>
                    Göndərdiyin cədvəlin 14 sütunu, sonda əmsal, saatlıq tarif
                    və məbləğ. Ayrı vərəqdə aylıq yekun.
                  </p>
                  <div className="data-period">
                    <label htmlFor="export-period">İxrac dövrü</label>
                    <select
                      id="export-period"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    >
                      <option value="all">Bütün tarixlər</option>
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {monthLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="button secondary"
                    onClick={exportExcel}
                    disabled={busy || selectedEntries.length === 0}
                  >
                    <Download size={17} />
                    Excel endir
                  </button>
                </section>
              </div>
              <section className="panel import-panel">
                <div className="file-icon import-icon">
                  <Upload size={26} />
                </div>
                <div>
                  <h2>Əvvəlki qeydlərini gətir</h2>
                  <p>
                    JSON ehtiyat nüsxəni və ya mövcud Excel hesabatını seç.
                    Əvvəlcə məlumatın icmalını görəcəksən, sonra idxalı
                    təsdiqləyəcəksən.
                  </p>
                  <div className="import-tags">
                    <span>.json</span>
                    <span>.xlsx</span>
                    <span>Ən çox 10 MB</span>
                  </div>
                </div>
                <button
                  className="button primary"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <FolderOpen size={17} />
                  )}
                  Fayl seç
                </button>
              </section>
              <section className="panel import-notes">
                <h3>İdxal haqqında</h3>
                <ul>
                  <li>
                    Excel-də <strong>Tarix, Başlanma və Bitmə</strong> sütunları
                    olmalıdır. Azərbaycan dilində göndərdiyin başlıqlar
                    dəstəklənir.
                  </li>
                  <li>
                    Maaş və tarif olmayan Excel qeydləri saat analizində
                    görünür. Aylıq maaş ayarı əlavə edəndə məbləğ hesablanır.
                  </li>
                  <li>
                    Excel-də eyni başlanma–bitmə aralığından qısa müddət
                    göstərilibsə, fərq fasilə kimi qəbul edilir.
                  </li>
                  <li>
                    JSON tam bərpa üçündür; Excel aylıq maaş ayarlarını və
                    profilini saxlamır.
                  </li>
                  <li>
                    İdxal zamanı təkrarlanan qeydlər ötürülür. Səhv sətirlər
                    aşkarlansa, fayldan heç bir qeyd əlavə edilmir.
                  </li>
                </ul>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>Az vaxt qeyd etməyə, çox vaxt özünə.</span>
            <span>
              overtime<span className="brand-period">.</span>
            </span>
          </footer>
        </main>
      </div>
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
        <Modal title="Overtime necə işləyir?" close={() => setHelp(false)}>
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
