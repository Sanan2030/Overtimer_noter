"use client";

import { useState } from "react";
import { ArrowRight, Clock3, Info, Save } from "lucide-react";
import {
  amount,
  calculationParts,
  monthLabel,
  LABOUR_CODE_URL,
  AppData,
  displayDate,
  durationMinutes,
  Entry,
  formatDuration,
  entryRate,
  isDate,
  money,
  overlaps,
  validateEntry,
} from "@/lib/model";
import { Field, Modal } from "./ui";
import { getWorkNorm } from "@/lib/work-calendar";

export function EntryForm({
  initial,
  data,
  editing,
  close,
  save,
}: {
  initial: Entry;
  data: AppData;
  editing: boolean;
  close: () => void;
  save: (entry: Entry, remember: boolean) => boolean;
}) {
  const [entry, setEntry] = useState({
    ...initial,
    end: initial.end === "24:00" ? "00:00" : initial.end,
    breakMinutes: 0,
  });
  const [remember, setRemember] = useState(true);
  const [ackOverlap, setAckOverlap] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof Entry>(key: K, value: Entry[K]) => {
    setEntry((prev) => ({ ...prev, [key]: value }));
    setAckOverlap(false);
    setError("");
  };
  let minutes = 0;
  let calculationError = "";
  try {
    if (!isDate(entry.date)) throw new Error("Düzgün tarix seç.");
    minutes = durationMinutes(entry);
  } catch (err) {
    calculationError = (err as Error).message;
  }
  const rate = entryRate(entry, data.months);
  const norm = getWorkNorm(entry.date.slice(0, 7));
  const total = calculationError ? null : amount(entry, data.months);
  const parts = calculationError ? [] : calculationParts(entry, data.months);
  const hasOverlap =
    isDate(entry.date) && !calculationError && overlaps(entry, data.entries);
  const overnight = entry.end < entry.start;
  return (
    <Modal
      title={editing ? "Qeydi redaktə et" : "Yeni əlavə iş qeydi"}
      subtitle="Tarix və saatları daxil et. Məbləğ avtomatik hesablanır."
      close={close}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const validated = validateEntry({ ...entry, rate });
            if (hasOverlap && !ackOverlap) {
              setError(
                "Bu vaxt aralığında başqa qeyd var. Davam etmək üçün xəbərdarlığı təsdiqlə.",
              );
              return;
            }
            if (save(validated, remember)) close();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="modal-body">
          <div className="form-grid three">
            <Field label="Tarix">
              <input
                type="date"
                required
                min="1900-01-01"
                max="2200-12-31"
                value={entry.date}
                onChange={(e) => {
                  setEntry((prev) => ({
                    ...prev,
                    date: e.target.value,
                    rate: null,
                  }));
                  setAckOverlap(false);
                }}
              />
            </Field>
            <Field label="Başlanma">
              <input
                type="time"
                required
                value={entry.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </Field>
            <Field label="Bitmə">
              <input
                type="time"
                required
                value={entry.end}
                onChange={(e) => update("end", e.target.value)}
              />
            </Field>
          </div>
          {overnight && (
            <p className="inline-info">
              <Info size={15} /> Bitmə saatı növbəti günə aiddir. Başlanma və
              bitmə günləri ayrıca hesablanır; hər hissə öz ayının maaş və
              normasından istifadə edir.
            </p>
          )}
          <div className="form-grid two align-end">
            <Field label="Ödəniş əmsalı">
              <div
                className="segmented"
                role="group"
                aria-label="Ödəniş əmsalı"
              >
                {([1, 2, 3] as const).map((multiplier) => (
                  <button
                    type="button"
                    key={multiplier}
                    aria-pressed={entry.multiplier === multiplier}
                    className={
                      entry.multiplier === multiplier ? "selected" : ""
                    }
                    onClick={() => update("multiplier", multiplier)}
                  >
                    {multiplier}x
                  </button>
                ))}
              </div>
            </Field>
            <div className="norm-note">
              <span>Aylıq norma</span>
              <strong>{norm ? `${norm.hours} saat` : "Məlumat yoxdur"}</strong>
              {norm && (
                <a href={norm.sourceUrl} target="_blank" rel="noreferrer">
                  ƏƏSMN · {norm.year} təqvimi ↗
                </a>
              )}
            </div>
          </div>
          <p className="muted small-copy">
            2x normadan artıq iş üçündür. İstirahət/bayram günü aylıq norma
            daxilində iş üçün 1x maaşdan əlavə ödənişdir. Tətbiq normal iş
            saatlarını uçota almadığı üçün bu fərqi özü müəyyən etmir.{" "}
            <a href={LABOUR_CODE_URL} target="_blank" rel="noreferrer">
              Maddə 164–165 ↗
            </a>
          </p>
          <div className="calculation">
            <div>
              <span>
                <Clock3 size={16} /> Faktiki müddət
              </span>
              <strong>
                {calculationError ? "—" : formatDuration(minutes)}{" "}
                <small>saat</small>
              </strong>
            </div>
            <ArrowRight size={20} className="calculation-arrow" />
            <div>
              <span>
                {rate === null
                  ? "Tarif təyin edilməyib"
                  : parts.length > 1
                    ? "Hər günün tarifi ilə · bölgü aşağıdadır"
                    : `${money(rate)} ₼ / saat × ${entry.multiplier}`}
              </span>
              <strong>
                {total === null ? "—" : money(total)} <small>AZN</small>
              </strong>
            </div>
          </div>
          {parts.length > 0 && (
            <div className="pay-breakdown" aria-label="Aylar üzrə hesablama">
              {parts.map((part) => (
                <div className="pay-breakdown-row" key={part.entry.date}>
                  <div>
                    <strong>
                      {displayDate(part.entry.date)} · {part.entry.start}–
                      {part.entry.end}
                    </strong>
                    <small>
                      {monthLabel(part.month)} · norma: {part.norm ?? "—"} saat
                    </small>
                  </div>
                  <div>
                    <strong>
                      {part.total === null
                        ? "Tarif yoxdur"
                        : `${money(part.total)} ₼`}
                    </strong>
                    <small>
                      {part.base === null
                        ? "Bu ayın maaşını daxil et"
                        : `${formatDuration(part.minutes)} saat × ${money(part.rate!)} ₼ × ${entry.multiplier}`}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
          {calculationError && (
            <p className="form-error" role="alert">
              {calculationError}
            </p>
          )}
          {total === null && !calculationError && (
            <p className="inline-info">
              <Info size={16} /> Məbləği hesablamaq üçün{" "}
              {[
                ...new Set(
                  parts
                    .filter((part) => part.rate === null)
                    .map((part) => monthLabel(part.month)),
                ),
              ].join(", ")}{" "}
              ayı üçün maaşı daxil et. Norma saatı avtomatik seçilir. Qeydi
              tarifsiz də saxlamaq olar.
            </p>
          )}
          <Field label="Mövzu">
            <textarea
              rows={2}
              maxLength={10000}
              placeholder="Nə üzərində işlədin?"
              value={entry.subject}
              onChange={(e) => update("subject", e.target.value)}
            />
          </Field>
          <section className="entry-metadata" aria-label="Qeyd məlumatları">
            <div className="form-grid two">
              <Field label="Əməkdaş">
                <input
                  maxLength={200}
                  placeholder="Ad və soyad"
                  value={entry.employee}
                  onChange={(e) => update("employee", e.target.value)}
                />
              </Field>
              <Field label="Şöbə müdiri">
                <input
                  maxLength={200}
                  placeholder="Ad və soyad"
                  value={entry.manager}
                  onChange={(e) => update("manager", e.target.value)}
                />
              </Field>
              <Field label="Müştəri">
                <input
                  maxLength={200}
                  placeholder="Məsələn, ƏN"
                  value={entry.customer}
                  onChange={(e) => update("customer", e.target.value)}
                />
              </Field>
              <Field label="Layihə">
                <input
                  maxLength={200}
                  placeholder="Məsələn, AzDoc 3.0"
                  value={entry.project}
                  onChange={(e) => update("project", e.target.value)}
                />
              </Field>
              <Field label="İcra günü statusu">
                <select
                  value={entry.dayStatus}
                  onChange={(e) => update("dayStatus", e.target.value)}
                >
                  {[
                    ...new Set([
                      "qeyri-iş saatı",
                      "istirahət günü",
                      "bayram günü",
                      entry.dayStatus,
                    ]),
                  ]
                    .filter(Boolean)
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </Field>
              <Field label="İş mühiti">
                <select
                  value={entry.environment}
                  onChange={(e) => update("environment", e.target.value)}
                >
                  {[
                    ...new Set([
                      "ofis şəraiti",
                      "məsafədən",
                      "hibrid",
                      entry.environment,
                    ]),
                  ]
                    .filter(Boolean)
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </Field>
              <Field label="Səbəb" className="full">
                <input
                  maxLength={500}
                  list="reason-options"
                  placeholder="Məsələn, Test, Təcili tapşırıq, Dəstək"
                  value={entry.reason}
                  onChange={(e) => update("reason", e.target.value)}
                />
                <datalist id="reason-options">
                  <option>Test</option>
                  <option>Təcili tapşırıq</option>
                  <option>Dəstək</option>
                  <option>Reliz</option>
                </datalist>
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Əməkdaş, rəhbər, müştəri, layihə və iş mühitini növbəti qeyd üçün
              yadda saxla
            </label>
          </section>
          {hasOverlap && (
            <div className="warning">
              <strong>Vaxt aralığı üst-üstə düşür</strong>
              <p>
                Bu əməkdaş üçün həmin aralıqda başqa qeyd var. Gecəni keçən
                qeydlər də yoxlanılır.
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ackOverlap}
                  onChange={(e) => setAckOverlap(e.target.checked)}
                />{" "}
                Yenə də bu qeydi saxlamaq istəyirəm
              </label>
            </div>
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
            <Save size={17} />
            {editing ? "Dəyişiklikləri saxla" : "Qeydi saxla"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
