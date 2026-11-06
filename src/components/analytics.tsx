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
          <p>İşin görüldüyü təqvim gününə əsasən</p>
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
