import { useState, useMemo, useCallback } from 'react';
import '../styles/nutrition.css';

/* ─── date helpers ─── */
function toKey(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}
function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtMonthYear(y, m) {
  return new Date(y, m, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
function buildCells(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

/* ─── period inference ─── */
function inferPeriods(markedKeys) {
  if (markedKeys.size === 0) return [];
  const sorted = [...markedKeys].sort();
  const periods = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromKey(cur[cur.length - 1]);
    const curr = fromKey(sorted[i]);
    if ((curr - prev) / 86400000 <= 2) {
      cur.push(sorted[i]);
    } else {
      periods.push(cur);
      cur = [sorted[i]];
    }
  }
  periods.push(cur);
  return periods;
}

function computePeriodMeta(markedKeys) {
  const periods = inferPeriods(markedKeys);
  if (periods.length === 0) return { periods, avgCycle: 28, avgLen: 5 };

  const avgLen =
    periods.length === 0
      ? 5
      : Math.round(
          periods.map((p) => p.length).reduce((s, l) => s + l, 0) /
            periods.length
        );

  let avgCycle = 28;
  if (periods.length >= 2) {
    const gaps = [];
    for (let i = 1; i < periods.length; i++) {
      const a = fromKey(periods[i - 1][0]);
      const b = fromKey(periods[i][0]);
      gaps.push(Math.round((b - a) / 86400000));
    }
    avgCycle = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
  }
  return { periods, avgCycle, avgLen };
}

function buildPredictedKeys(markedKeys) {
  const { periods, avgCycle, avgLen } = computePeriodMeta(markedKeys);
  if (periods.length === 0) return new Set();
  const predicted = new Set();
  const lastStart = fromKey(periods[periods.length - 1][0]);
  for (let c = 1; c <= 8; c++) {
    const ps = addDays(lastStart, avgCycle * c);
    for (let i = 0; i < avgLen; i++) {
      const k = toKey(addDays(ps, i));
      if (!markedKeys.has(k)) predicted.add(k);
    }
  }
  return predicted;
}

/* ─── component ─── */
const DURATIONS = [
  { label: '2 wks', days: 14 },
  { label: '4 wks', days: 28 },
  { label: '6 wks', days: 42 },
  { label: '8 wks', days: 56 },
  { label: '12 wks', days: 84 },
  { label: 'Custom', days: 0 },
];

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function NutritionPage({ athlete, nutrition, setNutrition }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeType, setActiveType] = useState('bulk');
  const [activeDur, setActiveDur] = useState(28);
  const [customDays, setCustomDays] = useState(21);
  const [trackPeriod, setTrackPeriod] = useState(
    athlete?.cycleTracking ?? false
  );

  const blocks = nutrition.bulkCutBlocks ?? [];
  // markedPeriodDays stored as array of key strings in nutrition state
  const markedPeriodDays = useMemo(
    () => new Set(nutrition.periodDays ?? []),
    [nutrition.periodDays]
  );

  const predictedPeriodKeys = useMemo(
    () => (trackPeriod ? buildPredictedKeys(markedPeriodDays) : new Set()),
    [trackPeriod, markedPeriodDays]
  );

  const periodMeta = useMemo(
    () => computePeriodMeta(markedPeriodDays),
    [markedPeriodDays]
  );

  const cells = useMemo(
    () => buildCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function blockAt(d) {
    const k = toKey(d);
    return blocks.find((b) => k >= b.start && k <= b.end);
  }

  const todayBlock = blockAt(today);

  const currentCycleInfo = useMemo(() => {
    if (!todayBlock) return null;
    const start = fromKey(todayBlock.start);
    const end = fromKey(todayBlock.end);
    const totalDays = Math.round((end - start) / 86400000) + 1;
    const elapsed = Math.round((today - start) / 86400000) + 1;
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
    const week = Math.ceil(elapsed / 7);
    const totalWeeks = Math.round(totalDays / 7);
    return { start, end, pct, week, totalWeeks, type: todayBlock.type };
  }, [todayBlock, today]);

  const getDur = useCallback(
    () => (activeDur === 0 ? customDays : activeDur),
    [activeDur, customDays]
  );

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleDayClick(date) {
    const isPast = date < today;
    const isToday = toKey(date) === toKey(today);
    const key = toKey(date);

    if (trackPeriod && (isPast || isToday)) {
      // Toggle period day marking
      const next = new Set(markedPeriodDays);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setNutrition((prev) => ({ ...prev, periodDays: [...next] }));
      return;
    }

    if (!isPast) {
      setSelectedDate(date);
    }
  }

  function applyBlock() {
    if (!selectedDate) return;
    const dur = getDur();
    const startKey = toKey(selectedDate);
    const endKey = toKey(addDays(selectedDate, dur - 1));
    const nb = { type: activeType, start: startKey, end: endKey };
    const filtered = blocks.filter(
      (b) => nb.end < b.start || nb.start > b.end
    );
    const sorted = [...filtered, nb].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
    setNutrition((prev) => ({ ...prev, bulkCutBlocks: sorted }));
    setSelectedDate(null);
  }

  function removeBlock() {
    if (!selectedDate) return;
    const k = toKey(selectedDate);
    setNutrition((prev) => ({
      ...prev,
      bulkCutBlocks: (prev.bulkCutBlocks ?? []).filter(
        (b) => !(k >= b.start && k <= b.end)
      ),
    }));
    setSelectedDate(null);
  }

  const previewEnd =
    selectedDate ? addDays(selectedDate, getDur() - 1) : null;

  const selectedBlock = selectedDate ? blockAt(selectedDate) : null;

  // Build period stats string
  const periodStatsText = useMemo(() => {
    if (markedPeriodDays.size === 0)
      return 'Tap any past day to mark it as a period day. Predictions appear after your first entry.';
    const { periods, avgCycle, avgLen } = periodMeta;
    const lastStart =
      periods.length > 0
        ? fromKey(periods[periods.length - 1][0])
        : null;
    const nextPredicted = lastStart ? addDays(lastStart, avgCycle) : null;
    return (
      `${markedPeriodDays.size} day${markedPeriodDays.size !== 1 ? 's' : ''} logged across ` +
      `${periods.length} period${periods.length !== 1 ? 's' : ''}. ` +
      `Avg cycle ${avgCycle}d · avg length ${avgLen}d. ` +
      (nextPredicted ? `Next predicted: ${fmtShort(nextPredicted)}.` : '')
    );
  }, [markedPeriodDays, periodMeta]);

  const showPredictedLegend =
    trackPeriod && predictedPeriodKeys.size > 0;

  return (
    <div className="screen nutrition-screen">
      <div className="nutr-shell">

        {/* ── Current cycle banner ── */}
        <div className="nutr-banner">
          <div className="nutr-banner-left">
            <div className="nutr-banner-label">Current cycle</div>
            {currentCycleInfo ? (
              <>
                <div className={`nutr-cycle-pill nutr-pill-${currentCycleInfo.type}`}>
                  <span className={`nutr-dot nutr-dot-${currentCycleInfo.type}`} />
                  {currentCycleInfo.type.charAt(0).toUpperCase() +
                    currentCycleInfo.type.slice(1)}{' '}
                  — week {currentCycleInfo.week} of {currentCycleInfo.totalWeeks}
                </div>
                <div className="nutr-prog-wrap">
                  <div
                    className={`nutr-prog-fill nutr-prog-${currentCycleInfo.type}`}
                    style={{ width: `${currentCycleInfo.pct}%` }}
                  />
                </div>
                <div className="nutr-banner-meta">
                  <span>Started {fmtShort(currentCycleInfo.start)}</span>
                  <span>
                    {currentCycleInfo.pct}% complete · ends{' '}
                    {fmtShort(currentCycleInfo.end)}
                  </span>
                </div>
              </>
            ) : (
              <div className="nutr-cycle-pill nutr-pill-none">No active cycle</div>
            )}
          </div>
        </div>

        <div className="nutr-body">
          {/* ── Calendar ── */}
          <div className="nutr-cal-card">
            <div className="nutr-cal-nav">
              <button className="nutr-nav-btn" onClick={prevMonth}>←</button>
              <span className="nutr-cal-month">
                {fmtMonthYear(viewYear, viewMonth)}
              </span>
              <button className="nutr-nav-btn" onClick={nextMonth}>→</button>
            </div>

            <div className="nutr-cal-dh">
              {DAY_HEADERS.map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>

            <div className="nutr-cal-grid">
              {cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} />;

                const isPast = date < today;
                const isToday = toKey(date) === toKey(today);
                const key = toKey(date);
                const b = blockAt(date);
                const isActualPeriod = trackPeriod && markedPeriodDays.has(key);
                const isPredicted = trackPeriod && predictedPeriodKeys.has(key);
                const isSelected = selectedDate && toKey(date) === toKey(selectedDate);

                let cellClass = 'nutr-day';
                if (isPast) cellClass += ' nutr-day-past';
                if (isActualPeriod) cellClass += ' nutr-day-period';
                else if (isPredicted) cellClass += ' nutr-day-predicted';
                else if (b) cellClass += ` nutr-day-${b.type}`;
                if (isSelected) cellClass += ' nutr-day-selected';
                if (isToday) cellClass += ' nutr-day-today';

                const clickable =
                  !isPast || (trackPeriod && (isPast || isToday));

                return (
                  <button
                    key={key}
                    className={cellClass}
                    onClick={() => handleDayClick(date)}
                    disabled={!clickable}
                  >
                    <span className="nutr-day-num">{date.getDate()}</span>
                    {isActualPeriod && (
                      <span className="nutr-day-tag">period</span>
                    )}
                    {isPredicted && !isActualPeriod && (
                      <span className="nutr-day-tag">pred.</span>
                    )}
                    {!isActualPeriod && !isPredicted && b && (
                      <span className="nutr-day-tag">{b.type}</span>
                    )}
                    {isToday && <span className="nutr-today-dot" />}
                  </button>
                );
              })}
            </div>

            <div className="nutr-legend">
              <div className="nutr-leg-item">
                <div className="nutr-leg-swatch nutr-swatch-bulk" />
                Bulk
              </div>
              <div className="nutr-leg-item">
                <div className="nutr-leg-swatch nutr-swatch-cut" />
                Cut
              </div>
              <div className="nutr-leg-item">
                <div className="nutr-leg-swatch nutr-swatch-maintain" />
                Maintain
              </div>
              {trackPeriod && (
                <div className="nutr-leg-item">
                  <div className="nutr-leg-swatch nutr-swatch-period" />
                  Period
                </div>
              )}
              {showPredictedLegend && (
                <div className="nutr-leg-item">
                  <div className="nutr-leg-swatch nutr-swatch-predicted" />
                  Predicted
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="nutr-sidebar">

            {/* Cycle editor */}
            <div className="nutr-panel">
              <div className="nutr-panel-title">Cycle editor</div>

              <div className="nutr-sel-box">
                {selectedDate
                  ? <>Starting <strong>{fmtShort(selectedDate)}</strong></>
                  : 'Click a future date to begin'}
              </div>

              <div className="nutr-field">
                <div className="nutr-field-label">Type</div>
                <div className="nutr-seg">
                  {['bulk', 'cut', 'maintain'].map((t) => (
                    <button
                      key={t}
                      className={`nutr-seg-btn nutr-seg-${t}${activeType === t ? ' nutr-seg-active' : ''}`}
                      onClick={() => setActiveType(t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="nutr-field">
                <div className="nutr-field-label">Duration</div>
                <div className="nutr-dur-grid">
                  {DURATIONS.map(({ label, days }) => (
                    <button
                      key={days}
                      className={`nutr-dur-btn${activeDur === days ? ' nutr-dur-active' : ''}`}
                      onClick={() => setActiveDur(days)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeDur === 0 && (
                <div className="nutr-field">
                  <div className="nutr-field-label">Custom days</div>
                  <input
                    className="nutr-input"
                    type="number"
                    min={7}
                    max={180}
                    value={customDays}
                    onChange={(e) =>
                      setCustomDays(Math.max(7, parseInt(e.target.value) || 7))
                    }
                  />
                </div>
              )}

              <div className="nutr-preview-box">
                {selectedDate && previewEnd
                  ? `${fmtShort(selectedDate)} → ${fmtShort(previewEnd)} (${getDur()} days)`
                  : 'Select a start date on the calendar'}
              </div>

              <button
                className="nutr-apply-btn"
                onClick={applyBlock}
                disabled={!selectedDate}
              >
                Apply cycle
              </button>

              {selectedBlock && selectedDate && (
                <button className="nutr-del-btn" onClick={removeBlock}>
                  Remove cycle
                </button>
              )}
            </div>

            {/* Period tracker */}
            {(athlete?.cycleTracking !== false) && (
              <div className="nutr-panel">
                <div className="nutr-panel-title">Period tracker</div>

                <div className="nutr-toggle-row">
                  <span className="nutr-toggle-label">Track period</span>
                  <label className="nutr-toggle">
                    <input
                      type="checkbox"
                      checked={trackPeriod}
                      onChange={(e) => setTrackPeriod(e.target.checked)}
                    />
                    <span className="nutr-tog-slider" />
                  </label>
                </div>

                {trackPeriod && (
                  <div className="nutr-period-panel">
                    <div className="nutr-period-hint">
                      Tap any past or current calendar day to mark it as a
                      period day. Predictions update automatically.
                    </div>
                    <div className="nutr-period-stats">{periodStatsText}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
