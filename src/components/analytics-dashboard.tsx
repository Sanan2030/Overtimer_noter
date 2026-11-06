"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Info,
  Layers3,
  Plus,
  Wallet,
  Zap,
} from "lucide-react";
import {
  AppData,
  formatDuration,
  hourlyRate,
  money,
  monthLabel,
  MONTHS,
} from "@/lib/model";
import {
  buildAnalytics,
  percentageChange,
  type Distribution,
  type Summary,
} from "@/lib/analytics";
import { getWorkNorm } from "@/lib/work-calendar";
import { Breakdown, Weekdays } from "./analytics";
import styles from "./analytics-dashboard.module.css";

type Report = ReturnType<typeof buildAnalytics>;
const COLORS = [
  "var(--a-emerald)",
  "var(--a-cyan)",
  "var(--a-purple)",
  "var(--a-amber)",
  "var(--a-slate)",
];
function number(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits })
    .format(value)
    .replace(/,/g, "\u00a0")
    .replace(".", ",");
}
function shortMonth(month: string) {
  const name = MONTHS[Number(month.slice(5)) - 1];
  return name === "İyun" || name === "İyul" ? name : name.slice(0, 3);
}
function hours(minutes: number) {
  return `${number(minutes / 60, 2)} saat`;
}
function duration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h} saat${m ? ` ${m} dəqiqə` : ""}` : `${m} dəqiqə`;
}
function value(summary: Summary) {
  return summary.count && summary.unpriced === summary.count
    ? "—"
    : money(summary.knownAmount);
}
function signed(
  current: number,
  previous: number,
  format: (n: number) => string,
) {
  const delta = current - previous;
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${format(Math.abs(delta))}`;
}
function Delta({
  current,
  previous,
  format,
  available,
}: {
  current: number;
  previous: number;
  format: (n: number) => string;
  available: boolean;
}) {
  if (!available)
    return <span className={styles.neutral}>Əvvəlki ayla müqayisə yoxdur</span>;
  const pct = percentageChange(current, previous);
  return (
    <span
      className={`${styles.delta} ${current < previous ? styles.decrease : ""}`}
    >
      {current < previous ? (
        <ArrowDownRight size={13} />
      ) : (
        <ArrowUpRight size={13} />
      )}
      {signed(current, previous, format)}
      {pct !== null && ` (${pct > 0 ? "+" : ""}${number(pct)}%)`}
    </span>
  );
}
function Metric({
  label,
  icon,
  children,
  footer,
  accent = false,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={styles.metric} aria-label={label}>
      <div className={styles.metricHeading}>
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <div className={`${styles.metricValue} ${accent ? styles.accent : ""}`}>
        {children}
      </div>
      <div className={styles.metricFooter}>{footer}</div>
    </article>
  );
}
function Panel({
  title,
  subtitle,
  badge,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      {children}
    </section>
  );
}
function Donut({
  values,
  labels,
  colors = COLORS,
  center,
  caption,
  label,
}: {
  values: number[];
  labels: string[];
  colors?: string[];
  center: string;
  caption: string;
  label: string;
}) {
  const total = values.reduce((sum, v) => sum + v, 0);
  const circumference = 2 * Math.PI * 38;
  let offset = 0;
  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="var(--a-track)"
          strokeWidth="12"
        />
        {values.map((v, i) => {
          const length = total ? (v / total) * circumference : 0;
          const start = offset;
          offset += length;
          return (
            v > 0 && (
              <circle
                key={labels[i]}
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="12"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-start}
                className={styles.arc}
              >
                <title>
                  {labels[i]}: {number(total ? (v / total) * 100 : 0)}%
                </title>
              </circle>
            )
          );
        })}
      </svg>
      <div className={styles.donutCenter}>
        <small>{caption}</small>
        <strong title={center}>{center}</strong>
        <span>{total > 0 ? "100%" : "Məlumat yoxdur"}</span>
      </div>
    </div>
  );
}
function MonthlyTrend({
  report,
  onPeriod,
}: {
  report: Report;
  onPeriod: (month: string) => void;
}) {
  const maximum = Math.max(...report.trend.map((point) => point.minutes), 60);
  const ceiling = Math.ceil(maximum / 240) * 240;
  return (
    <Panel
      title="Aylıq dinamika"
      subtitle="Son 6 ay üzrə faktiki əlavə iş saatları"
      badge="6 ay"
      className={styles.trend}
    >
      <div className={styles.barChart}>
        <div className={styles.axis}>
          {[1, 0.75, 0.5, 0.25, 0].map((p) => (
            <span key={p}>{number((ceiling / 60) * p)} s</span>
          ))}
        </div>
        <div className={styles.plot}>
          <div className={styles.gridLines} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </div>
          <div className={styles.columns}>
            {report.trend.map((point) => (
              <div key={point.month} className={styles.column}>
                <div className={styles.barSlot}>
                  <button
                    className={`${styles.bar} ${point.month === report.anchor ? styles.currentBar : ""}`}
                    style={{
                      height: `${(point.minutes / ceiling) * 100}%`,
                      minHeight: point.minutes ? 7 : 3,
                    }}
                    onClick={() => onPeriod(point.month)}
                    aria-label={`${monthLabel(point.month)}: ${formatDuration(point.minutes)} saat`}
                    title={`${monthLabel(point.month)} · ${duration(point.minutes)} · ${point.unpriced ? "Tarif çatışmır" : `${value(point)} ₼`}`}
                  >
                    <span>{number(point.minutes / 60, 2)}s</span>
                  </button>
                </div>
                <span
                  className={
                    point.month === report.anchor ? styles.activeMonth : ""
                  }
                >
                  {shortMonth(point.month)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.panelFoot}>
        <span>Əmsal faktiki saatları dəyişmir.</span>
        <strong>
          6 aylıq cəm: {hours(report.trend.reduce((s, p) => s + p.minutes, 0))}
        </strong>
      </div>
    </Panel>
  );
}
function ProjectChart({ report }: { report: Report }) {
  const groups: Distribution[] =
    report.projects.length <= 5
      ? report.projects
      : [
          ...report.projects.slice(0, 4),
          {
            key: "__others",
            label: "Digər layihələr",
            ...report.projects.slice(4).reduce(
              (sum, group) => ({
                minutes: sum.minutes + group.minutes,
                knownAmount: sum.knownAmount + group.knownAmount,
                unpriced: sum.unpriced + group.unpriced,
                count: sum.count + group.count,
                days: 0,
                average: 0,
              }),
              {
                minutes: 0,
                knownAmount: 0,
                unpriced: 0,
                count: 0,
                days: 0,
                average: 0,
              },
            ),
          },
        ];
  const top = report.projects[0];
  const before =
    top && report.previousProjects.find((project) => project.key === top.key);
  return (
    <Panel
      title="Layihələr üzrə bölgü"
      subtitle="Faktiki iş saatlarının layihələr üzrə payı"
      badge={hours(report.summary.minutes)}
    >
      <div className={styles.donutLayout}>
        <Donut
          values={groups.map((g) => g.minutes)}
          labels={groups.map((g) => g.label)}
          center={number(report.summary.minutes / 60)}
          caption="Ümumi saat"
          label="Layihələr üzrə saat bölgüsü"
        />
        <div className={styles.legend}>
          {groups.map((group, i) => (
            <div className={styles.legendRow} key={group.key}>
              <i
                className={styles.dot}
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <div>
                <strong title={group.label}>{group.label}</strong>
                <small>
                  {hours(group.minutes)} · {value(group)} ₼
                  {group.unpriced > 0 && " (natamam)"}
                </small>
              </div>
              <b style={{ color: COLORS[i % COLORS.length] }}>
                {number((group.minutes / report.summary.minutes) * 100, 0)}%
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.panelFoot}>
        <span>
          Aparıcı layihə: <strong>{top?.label ?? "—"}</strong>
        </span>
        {!report.all && report.previous.count > 0 && top && (
          <span className={styles.accent}>
            {signed(top.minutes, before?.minutes ?? 0, hours)}
          </span>
        )}
      </div>
    </Panel>
  );
}
function MultiplierChart({ report }: { report: Report }) {
  const [mode, setMode] = useState<"hours" | "amount">("hours");
  const values = report.multipliers.map((group) =>
    mode === "hours" ? group.minutes : group.knownAmount,
  );
  const total = values.reduce((s, n) => s + n, 0);
  const colors = ["var(--a-amber)", "var(--a-emerald)", "var(--a-purple)"];
  return (
    <Panel
      title="Əmsallar üzrə bölgü"
      subtitle="İş yükü və hesablanmış məbləğin payı"
      badge="1x · 2x · 3x"
    >
      <div
        className={styles.chartSwitch}
        role="group"
        aria-label="Əmsal bölgüsünün ölçüsü"
      >
        <button
          aria-pressed={mode === "hours"}
          onClick={() => setMode("hours")}
        >
          Saat
        </button>
        <button
          aria-pressed={mode === "amount"}
          onClick={() => setMode("amount")}
        >
          Məbləğ
        </button>
      </div>
      <div className={styles.donutLayout}>
        <Donut
          values={values}
          labels={report.multipliers.map((group) => group.label)}
          colors={colors}
          center={
            mode === "hours"
              ? `${number(total / 60)} s`
              : value(report.summary) === "—"
                ? "—"
                : `${money(total)} ₼`
          }
          caption={mode === "hours" ? "Faktiki saat" : "Məbləğ"}
          label={`Əmsallar üzrə ${mode === "hours" ? "saat" : "məbləğ"} bölgüsü`}
        />
        <div className={styles.legend}>
          {report.multipliers.map((group, i) => (
            <div className={styles.legendRow} key={group.key}>
              <i className={styles.dot} style={{ background: colors[i] }} />
              <div>
                <strong>{group.label} əmsal</strong>
                <small>
                  {hours(group.minutes)} · {value(group)} ₼
                </small>
              </div>
              <b style={{ color: colors[i] }}>
                {total > 0 ? `${number((values[i] / total) * 100, 0)}%` : "—"}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.panelFoot}>
        <span>
          {mode === "hours"
            ? "Pay faktiki iş müddətinə əsaslanır."
            : report.summary.unpriced
              ? "Tarifsiz qeydlər məbləğ payına daxil deyil."
              : "Pay hesablanmış məbləğə əsaslanır."}
        </span>
      </div>
    </Panel>
  );
}
function WeeklyLoad({ report }: { report: Report }) {
  const maximum = Math.max(...report.weeks.map((week) => week.minutes), 1);
  return (
    <Panel
      title="Həftəlik əlavə iş yükü"
      subtitle="Təqvim həftələri üzrə faktiki iş müddəti"
      badge={report.all ? undefined : `${report.weeks.length} həftə`}
    >
      {report.all ? (
        <div className={styles.chartHint}>
          <CalendarDays size={28} />
          <p>Həftəlik bölgünü görmək üçün bir ay seç.</p>
        </div>
      ) : (
        <>
          <div className={styles.weekLegend}>
            <span>
              <i />
              Qeyri-iş saatı
            </span>
            <span>
              <i />
              İstirahət / bayram
            </span>
          </div>
          <div className={styles.weeks}>
            {report.weeks.map((week, i) => (
              <div key={week.start} className={styles.week}>
                <span className={styles.weekNumber}>{i + 1}</span>
                <div className={styles.weekBody}>
                  <div className={styles.weekLabel}>
                    <span>
                      {week.start}–{week.end} {shortMonth(report.anchor)}{" "}
                      {week.minutes === maximum && week.minutes > 0 && (
                        <em>Pik</em>
                      )}
                    </span>
                    <strong>
                      {hours(week.minutes)} <small>· {value(week)} ₼</small>
                    </strong>
                  </div>
                  <div
                    className={styles.weekTrack}
                    role="img"
                    aria-label={`${week.start}–${week.end}: ${duration(week.minutes)}`}
                  >
                    <i
                      style={{ width: `${(week.regular / maximum) * 100}%` }}
                    />
                    <i
                      style={{ width: `${(week.special / maximum) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.panelFoot}>
            <span>Gün növü qeyddə seçilən statusa əsaslanır.</span>
            <strong>
              Orta: {hours(report.summary.minutes / report.weeks.length)}
            </strong>
          </div>
        </>
      )}
    </Panel>
  );
}
function Comparison({ report }: { report: Report }) {
  const { summary: current, previous: before } = report;
  if (!report.previousMonth)
    return (
      <Panel
        title="Əvvəlki ayla müqayisə"
        subtitle="İki ardıcıl ayın göstəriciləri"
      >
        <p className={styles.chartHint}>
          Müqayisəni görmək üçün konkret ay seç.
        </p>
      </Panel>
    );
  const monetaryComparison = !current.unpriced && !before.unpriced;
  const pct = percentageChange(current.minutes, before.minutes);
  const metrics = [
    {
      label: "Əlavə iş saatı",
      current: current.minutes,
      before: before.minutes,
      now: hours(current.minutes),
      was: hours(before.minutes),
      diff: signed(current.minutes, before.minutes, hours),
    },
    {
      label: "Hesablanmış məbləğ",
      current: current.knownAmount,
      before: before.knownAmount,
      now: `${value(current)} ₼`,
      was: `${value(before)} ₼`,
      diff: monetaryComparison
        ? signed(
            current.knownAmount,
            before.knownAmount,
            (n) => `${money(n)} ₼`,
          )
        : "Tarif çatışmır",
    },
    {
      label: "İş günü",
      current: current.days,
      before: before.days,
      now: `${current.days} gün`,
      was: `${before.days} gün`,
      diff: signed(current.days, before.days, (n) => `${n} gün`),
    },
  ];
  return (
    <Panel
      title="Əvvəlki ayla müqayisə"
      subtitle={`${monthLabel(report.previousMonth)} və ${monthLabel(report.anchor)}`}
      badge={
        pct === null
          ? "İki aylıq baxış"
          : `${pct > 0 ? "+" : ""}${number(pct)}% saat fərqi`
      }
      className={styles.comparison}
    >
      <div className={styles.comparisonCards}>
        {metrics.map((metric, i) => {
          const max = Math.max(metric.current, metric.before, 1);
          const missing = i === 1 && !monetaryComparison;
          return (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <div>
                <strong>{metric.now}</strong>
                <small>{metric.was}</small>
              </div>
              <div className={styles.miniBars} aria-hidden="true">
                <i
                  style={{
                    width: missing ? "0%" : `${(metric.current / max) * 100}%`,
                  }}
                />
                <i
                  style={{
                    width: missing ? "0%" : `${(metric.before / max) * 100}%`,
                  }}
                />
              </div>
              <b>{metric.diff}</b>
            </div>
          );
        })}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Göstərici</th>
              <th>{monthLabel(report.previousMonth)}</th>
              <th>
                {monthLabel(report.anchor)} <span>Seçilən ay</span>
              </th>
              <th>Fərq</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label}>
                <td>{metric.label}</td>
                <td>{metric.was}</td>
                <td>{metric.now}</td>
                <td>{metric.diff}</td>
              </tr>
            ))}
            <tr>
              <td>Gündəlik orta əlavə vaxt</td>
              <td>{duration(before.average)}</td>
              <td>{duration(current.average)}</td>
              <td>{signed(current.average, before.average, duration)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.panelFoot}>
        <span>
          Yalnız daxil edilmiş qeydlər müqayisə olunur.
          {!monetaryComparison && " Məbləğlər natamamdır; tarifləri tamamla."}
        </span>
      </div>
    </Panel>
  );
}
export function AnalyticsDashboard({
  data,
  period,
  months,
  onPeriod,
  onChangeMonth,
  onNew,
  onSalary,
  disabled = false,
}: {
  data: AppData;
  period: string;
  months: string[];
  onPeriod: (month: string) => void;
  onChangeMonth: (delta: number) => void;
  onNew: () => void;
  onSalary: (month: string) => void;
  disabled?: boolean;
}) {
  const report = useMemo(() => buildAnalytics(data, period), [data, period]);
  const { summary, previous, dominant } = report;
  const norm = report.all ? null : getWorkNorm(period);
  const config = data.months[period];
  const rate = report.all ? null : hourlyRate(config, period);
  const compare = !report.all && previous.count > 0;
  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div>
          <div className={styles.titleLine}>
            <h1>Vaxt və gəlir analizi</h1>
            <span>Canlı hesabat</span>
          </div>
          <p>Əlavə iş saatlarına və hesablanmış məbləğə vizual baxış.</p>
        </div>
        <div className={styles.period}>
          <button
            aria-label="Əvvəlki ay"
            disabled={period === "1900-01"}
            onClick={() => onChangeMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <CalendarDays size={17} />
          <select
            aria-label="Hesabat dövrü"
            value={period}
            onChange={(event) => onPeriod(event.target.value)}
          >
            <option value="all">Bütün tarixlər</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
          <button
            aria-label="Növbəti ay"
            disabled={period === "2200-12"}
            onClick={() => onChangeMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className={styles.metrics}>
        <Metric
          label="Ümumi əlavə iş"
          icon={<Clock3 size={17} />}
          footer={
            <Delta
              current={summary.minutes}
              previous={previous.minutes}
              format={hours}
              available={compare}
            />
          }
        >
          <span>{number(summary.minutes / 60, 2)}</span>
          <small>saat</small>
        </Metric>
        <Metric
          label="Hesablanmış məbləğ"
          icon={<Coins size={17} />}
          accent
          footer={
            summary.unpriced ? (
              <span className={styles.incomplete}>
                {summary.unpriced} qeyd üçün tarif çatışmır
              </span>
            ) : (
              <Delta
                current={summary.knownAmount}
                previous={previous.knownAmount}
                format={(n) => `${money(n)} ₼`}
                available={compare && !previous.unpriced}
              />
            )
          }
        >
          <span>{value(summary)}</span>
          <small>₼</small>
        </Metric>
        <Metric
          label="Orta gündəlik"
          icon={<Zap size={17} />}
          footer={
            <span className={styles.neutral}>
              <i />
              {summary.days} əlavə iş günü
            </span>
          }
        >
          <span>
            {Math.floor(summary.average / 60)}
            <em>s</em> {summary.average % 60}
            <em>d</em>
          </span>
          <small>/ gün</small>
        </Metric>
        <Metric
          label="Əsas əmsal payı"
          icon={<span>{summary.minutes ? dominant.label : "—"}</span>}
          footer={
            <span className={styles.neutral}>
              {summary.minutes
                ? `${dominant.label} əmsalla ${hours(dominant.minutes)}`
                : "Əmsal faktiki saatı dəyişmir"}
            </span>
          }
        >
          <span>
            {summary.minutes
              ? `${number((dominant.minutes / summary.minutes) * 100, 0)}%`
              : "—"}
          </span>
          <small>vaxt payı</small>
        </Metric>
      </div>
      <div className={styles.contextBar}>
        <span>
          <i />
          {report.all ? "Bütün tarixlər" : monthLabel(period)} ·{" "}
          <strong>{hours(summary.minutes)}</strong>
        </span>
        {norm && (
          <a href={norm.sourceUrl} target="_blank" rel="noreferrer">
            Rəsmi norma: <strong>{norm.hours} saat ↗</strong>
          </a>
        )}
        {!report.all && (
          <button
            type="button"
            aria-label="Aylıq maaş"
            onClick={() => onSalary(period)}
            disabled={disabled}
          >
            Net maaş:{" "}
            <strong>
              {config && config.basis !== "gross"
                ? `${money(config.salary)} ₼`
                : "Daxil edilməyib"}
            </strong>
          </button>
        )}
        <span>
          Baza tarifi:{" "}
          <strong>
            {rate === null
              ? report.all
                ? "Aylar üzrə"
                : "—"
              : `${money(rate)} ₼ / saat`}
          </strong>
        </span>
      </div>
      {summary.unpriced > 0 && (
        <div className={styles.salaryNotice} role="status">
          <Info size={21} />
          <div>
            <strong>Məbləği görmək üçün aylıq net maaşını daxil et</strong>
            <p>
              {report.missingMonths.map(monthLabel).join(", ")} · İş saatları
              qrafiklərdə görünür.
            </p>
          </div>
          <button
            className="button secondary small"
            onClick={() => onSalary(report.missingMonths[0])}
            disabled={disabled}
          >
            <Wallet size={15} />
            Maaş əlavə et
          </button>
        </div>
      )}
      {summary.count > 0 ? (
        <>
          <div className={styles.chartGrid}>
            <MonthlyTrend report={report} onPeriod={onPeriod} />
            <ProjectChart report={report} />
          </div>
          <div className={styles.secondaryGrid}>
            <MultiplierChart report={report} />
            <WeeklyLoad report={report} />
          </div>
          <Comparison report={report} />
          <details className={styles.advanced}>
            <summary>
              Daha ətraflı analiz <Layers3 size={16} />
            </summary>
            <div className={styles.advancedGrid}>
              <Weekdays entries={report.entries} />
              <Breakdown
                entries={report.entries}
                field="customer"
                title="Müştərilər üzrə"
                subtitle="Müştərilərə sərf olunan vaxt"
              />
              <Breakdown
                entries={report.entries}
                field="reason"
                title="Səbəblər üzrə"
                subtitle="Əlavə işin səbəbləri"
              />
              <Breakdown
                entries={report.entries}
                field="environment"
                title="İş mühiti üzrə"
                subtitle="Ofis və məsafədən iş"
              />
            </div>
          </details>
        </>
      ) : (
        <>
          <div className={styles.empty}>
            <div>
              <BarChart3 size={31} />
            </div>
            <h2>Hələ analiz üçün qeyd yoxdur</h2>
            <p>
              Seçdiyin dövrə əlavə iş qeydi daxil et. Saat və məbləğ bölgüsü
              burada görünəcək.
            </p>
            <button
              className="button primary"
              onClick={onNew}
              disabled={disabled}
            >
              <Plus size={17} />
              Yeni qeyd əlavə et
            </button>
          </div>
          {data.entries.length > 0 && (
            <MonthlyTrend report={report} onPeriod={onPeriod} />
          )}
        </>
      )}
    </div>
  );
}
