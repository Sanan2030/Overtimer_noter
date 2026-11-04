"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Clock3, Info, Save } from "lucide-react";
import {
  amount,
  AppData,
  displayDate,
  durationMinutes,
  Entry,
  formatDuration,
  hourlyRate,
  isDate,
  money,
  overlaps,
  validateEntry,
} from "@/lib/model";
import { Field, Modal } from "./ui";

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
  const [entry, setEntry] = useState(initial);
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
    minutes = durationMinutes(entry);
  } catch (err) {
    calculationError = (err as Error).message;
  }
  const rate = entry.rate ?? hourlyRate(data.months[entry.date.slice(0, 7)]);
  const total = calculationError ? null : amount(entry, data.months);
  const hasOverlap =
    isDate(entry.date) && !calculationError && overlaps(entry, data.entries);
  const overnight = entry.end < entry.start;
  return (
    <Modal
      title={editing ? "Qeydi redaktə et" : "Yeni overtime qeydi"}
      subtitle="İşlədiyin vaxtı əlavə et. Qalanını biz hesablayaq."
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
              <Info size={15} /> Bitmə saatı növbəti günə aiddir. Qeyd başlanma
              tarixinin ayına hesablanır.
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
                    {multiplier}x {multiplier === 1 && <span>standart</span>}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Fasilə (dəqiqə)">
              <input
                type="number"
                min="0"
                max="1438"
                step="1"
                value={entry.breakMinutes}
                onChange={(e) => update("breakMinutes", Number(e.target.value))}
              />
            </Field>
          </div>
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
                  : `${money(rate)} ₼ / saat × ${entry.multiplier}`}
              </span>
              <strong>
                {total === null ? "—" : money(total)} <small>AZN</small>
              </strong>
            </div>
          </div>
          {calculationError && (
            <p className="form-error" role="alert">
              {calculationError}
            </p>
          )}
          {rate === null && (
            <p className="inline-info">
              <Info size={16} /> Məbləği hesablamaq üçün{" "}
              {displayDate(`${entry.date.slice(0, 7)}-01`).slice(3)} ayının
              maaşını və norma saatını daxil et. Qeydi tarifsiz də saxlamaq
              olar.
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
          <details className="details-form">
            <summary>
              Ətraflı məlumatlar <ChevronDown size={17} />
            </summary>
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
          </details>
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
