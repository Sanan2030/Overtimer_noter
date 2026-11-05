"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  Coins,
  Layers3,
  TrendingUp,
} from "lucide-react";
import {
  amount,
  AppData,
  durationMinutes,
  dailyEntries,
  Entry,
  formatDuration,
  money,
} from "@/lib/model";
import { EmptyState } from "./ui";

export function Stats({
  entries,
  data,
  compact = false,
}: {
  entries: Entry[];
  data: AppData;
  compact?: boolean;
}) {
  const minutes = entries.reduce((sum, e) => sum + durationMinutes(e), 0);
  const total = entries.reduce(
    (sum, e) => sum + (amount(e, data.months) ?? 0),
    0,
  );
  const unpriced = entries.filter(
    (e) => amount(e, data.months) === null,
  ).length;
  const days = new Set(entries.map((e) => e.date)).size;
  return (
    <div className={`stats-grid ${compact ? "compact" : ""}`}>
      <div className="stat-card">
        <div className="stat-label">
          Ümumi əlavə saat{" "}
          <span className="stat-icon green">
            <Clock3 size={19} />
          </span>
        </div>
        <div className="stat-value">
          {Number((minutes / 60).toFixed(2))
            .toString()
            .replace(".", ",")}{" "}
          <small>saat</small>
        </div>
        <p>Faktiki işlənmiş vaxt</p>
      </div>
      <div className="stat-card">
        <div className="stat-label">
          Ümumi məbləğ{" "}
          <span className="stat-icon amber">
            <Coins size={19} />
          </span>
        </div>
        <div className="stat-value">
          {money(total)} <small>₼</small>
        </div>
        <p>
          {unpriced
            ? `${unpriced} qeyd üçün tarif daxil edilməyib`
            : "Seçilən əmsal nəzərə alınmaqla"}
        </p>
      </div>
      {!compact && (
        <>
          <div className="stat-card">
            <div className="stat-label">
              Overtime günləri{" "}
              <span className="stat-icon blue">
                <Layers3 size={19} />
              </span>
            </div>
            <div className="stat-value">
              {days} <small>gün</small>
            </div>
            <p>{entries.length} qeyd əlavə edilib</p>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              Gündəlik orta müddət{" "}
              <span className="stat-icon purple">
                <TrendingUp size={19} />
              </span>
            </div>
            <div className="stat-value">
              {formatDuration(days ? Math.round(minutes / days) : 0)}{" "}
              <small>saat</small>
            </div>
            <p>Overtime olan günlər üzrə</p>
          </div>
        </>
      )}
    </div>
  );
}

export function Trend({ data, month }: { data: AppData; month: string }) {
  const base = month === "all" ? new Date() : new Date(`${month}-01T12:00:00`);
  const points = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entries = dailyEntries(data.entries, data.months).filter((e) =>
      e.date.startsWith(key),
    );
    return {
      key,
      label: [
        "Yan",
        "Fev",
        "Mar",
        "Apr",
        "May",
        "İyn",
        "İyl",
        "Avq",
        "Sen",
        "Okt",
        "Noy",
        "Dek",
      ][date.getMonth()],
      minutes: entries.reduce((sum, e) => sum + durationMinutes(e), 0),
      total: entries.reduce((sum, e) => sum + (amount(e, data.months) ?? 0), 0),
    };
  });
  const max = Math.max(...points.map((p) => p.minutes), 240);
  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <div>
          <h2>Aylıq dinamika</h2>
          <p>Son 6 ayda əlavə iş saatların</p>
        </div>
        <span className="chart-legend">
          <i />
          Faktiki saat
        </span>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={points
          .map(
            (p) =>
              `${p.key}: ${formatDuration(p.minutes)} saat, ${money(p.total)} AZN`,
          )
          .join("; ")}
      >
        <div className="chart-y">
          <span>{Math.ceil(max / 60)} s</span>
          <span>{Math.ceil(max / 120)} s</span>
          <span>0</span>
        </div>
        <div className="chart-plot">
          <div className="chart-grid-lines">
            <i />
            <i />
            <i />
          </div>
          {points.map((point, i) => (
            <div className="chart-column" key={point.key}>
              <div className="bar-space">
                <div
                  className={`chart-bar ${i === 5 ? "current" : ""}`}
                  style={{
                    height: `${(point.minutes / max) * 100}%`,
                    minHeight: point.minutes ? 5 : 0,
                  }}
                >
                  <span className="bar-tooltip">
                    {point.key}
                    <br />
                    {formatDuration(point.minutes)} saat · {money(point.total)}{" "}
                    ₼
                  </span>
                </div>
              </div>
              <span>{point.label}</span>
            </div>
          ))}
        </div>
      </div>
      {!points.some((p) => p.minutes) && (
        <p className="chart-note">
          İlk qeydinlə saatlarının dinamikası burada görünəcək.
        </p>
      )}
    </section>
  );
}

export function ActivitySummary({ entries }: { entries: Entry[] }) {
  const days = new Set(entries.map((entry) => entry.date)).size;
  const minutes = entries.reduce(
    (sum, entry) => sum + durationMinutes(entry),
    0,
  );
  return (
    <div className="activity-summary">
      <span>
        <strong>{entries.length}</strong> qeyd
      </span>
      <span>
        <strong>{days}</strong> overtime günü
      </span>
      <span>
        Gündəlik orta:{" "}
        <strong>{formatDuration(days ? Math.round(minutes / days) : 0)}</strong>{" "}
        saat
      </span>
    </div>
  );
}

export function Multipliers({
  entries,
  data,
}: {
  entries: Entry[];
  data: AppData;
}) {
  const totalMinutes = entries.reduce((sum, e) => sum + durationMinutes(e), 0);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Əmsal bölgüsü</h2>
          <p>Vaxt və məbləğ bir baxışda</p>
        </div>
        <Layers3 size={19} className="muted" />
      </div>
      <div className="multiplier-list">
        {([1, 2, 3] as const).map((m) => {
          const rows = entries.filter((e) => e.multiplier === m);
          const minutes = rows.reduce((sum, e) => sum + durationMinutes(e), 0);
          return (
            <div className="multiplier-item" key={m}>
              <div className={`multiplier-badge multiplier-${m}`}>{m}x</div>
              <div className="multiplier-detail">
                <div>
                  <strong>
                    {m === 1 ? "Standart" : m === 2 ? "İkiqat" : "Üçqat"}
                  </strong>
                  <span>{formatDuration(minutes)} saat</span>
                </div>
                <div className="progress">
                  <i
                    className={`progress-${m}`}
                    style={{
                      width: `${totalMinutes ? (minutes / totalMinutes) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <strong className="multiplier-amount">
                {money(
                  rows.reduce(
                    (sum, e) => sum + (amount(e, data.months) ?? 0),
                    0,
                  ),
                )}
                <small>AZN</small>
              </strong>
            </div>
          );
        })}
      </div>
      <p className="panel-footnote">
        Əmsal ödənişə tətbiq olunur. Faktiki iş saatı dəyişmir.
      </p>
    </section>
  );
}

export function Breakdown({
  entries,
  field,
  title,
  subtitle,
}: {
  entries: Entry[];
  field: "project" | "customer" | "reason" | "environment";
  title: string;
  subtitle: string;
}) {
  const groups = new Map<string, number>();
  entries.forEach((entry) => {
    const key = entry[field] || "Qeyd edilməyib";
    groups.set(key, (groups.get(key) ?? 0) + durationMinutes(entry));
  });
  const rows = [...groups].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <BriefcaseBusiness size={19} className="muted" />
      </div>
      {rows.length ? (
        <div className="breakdown-list">
          {rows.map(([name, minutes], index) => (
            <div key={name}>
              <div className="breakdown-label">
                <span>
                  <i className={`dot dot-${index % 4}`} />
                  {name}
                </span>
                <strong>
                  {Number((minutes / 60).toFixed(2))
                    .toString()
                    .replace(".", ",")}{" "}
                  <small>saat</small>
                </strong>
              </div>
              <div className="progress">
                <i style={{ width: `${(minutes / total) * 100}%` }} />
              </div>
              <small className="breakdown-percent">
                {Math.round((minutes / total) * 100)}% ümumi vaxtdan
              </small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BarChart3 size={24} />}
          title="Hələ məlumat yoxdur"
          description="Qeydlər əlavə olunduqca bölgü burada görünəcək."
        />
      )}
    </section>
  );
}

export function Weekdays({ entries }: { entries: Entry[] }) {
  const names = ["B.e.", "Ç.a.", "Çər.", "C.a.", "Cüm.", "Şən.", "Baz."];
  const points = Array.from({ length: 7 }, () => 0);
  entries.forEach((e) => {
    const day = (new Date(`${e.date}T12:00:00Z`).getUTCDay() + 6) % 7;
    points[day] += durationMinutes(e);
  });
  const max = Math.max(...points, 60);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Həftənin günləri</h2>
          <p>Qeydin başlanma gününə əsasən</p>
        </div>
        <Clock3 size={19} className="muted" />
      </div>
      <div className="weekday-chart">
        {points.map((minutes, i) => (
          <div key={i}>
            <strong>{formatDuration(minutes)}</strong>
            <div className="weekday-track">
              <i style={{ height: `${(minutes / max) * 100}%` }} />
            </div>
            <span>{names[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
