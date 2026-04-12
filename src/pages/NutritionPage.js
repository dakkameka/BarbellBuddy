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
  const avgLen = Math.round(
    periods.map((p) => p.length).reduce((s, l) => s + l, 0) / periods.length
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

/* ─── constants ─── */
const DURATIONS = [
  { label: '2 wks', days: 14 },
  { label: '4 wks', days: 28 },
  { label: '6 wks', days: 42 },
  { label: '8 wks', days: 56 },
  { label: '12 wks', days: 84 },
  { label: 'Custom', days: 0 },
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ─── Droplet SVG ─── */
function DropletIcon({ filled, predicted }) {
  const fill = filled
    ? 'rgba(212,83,126,0.9)'
    : 'none';
  const stroke = filled
    ? 'rgba(212,83,126,1)'
    : predicted
    ? 'rgba(212,83,126,0.45)'
    : 'rgba(212,83,126,0.35)';
  return (
    <svg viewBox="0 0 12 14" width="10" height="10" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <path
        d="M6 1 C6 1 1.5 6 1.5 9 C1.5 11.5 3.5 13 6 13 C8.5 13 10.5 11.5 10.5 9 C10.5 6 6 1 6 1Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── main component ─── */
export default function NutritionPage({ athlete, nutrition, setNutrition, goToScreen }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  /* Gate: both flags must be true */
  const nutritionEnabled = athlete?.nutritionGuidance && athlete?.doesBulkCutCycles;
  /* Period tracking is automatic from profile — no toggle needed */
  const trackPeriod = athlete?.cycleTracking === true;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeType, setActiveType] = useState('bulk');
  const [activeDur, setActiveDur] = useState(28);
  const [customDays, setCustomDays] = useState(21);

  const blocks = nutrition.bulkCutBlocks ?? [];
  const markedPeriodDays = useMemo(
    () => new Set(nutrition.periodDays ?? []),
    [nutrition.periodDays]
  );

  const predictedPeriodKeys = useMemo(
    () => (trackPeriod ? buildPredictedKeys(markedPeriodDays) : new Set()),
    [trackPeriod, markedPeriodDays]
  );

  const periodMeta = useMemo(() => computePeriodMeta(markedPeriodDays), [markedPeriodDays]);

  const cells = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth]);

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

  /* clicking the day cell body selects it for cycle editing (future only) */
  function handleDayClick(date) {
    if (date < today) return;
    setSelectedDate(date);
  }

  /* clicking the droplet toggles period for that day (past + today + future all ok) */
  function handleDropletClick(e, date) {
    e.stopPropagation();
    const key = toKey(date);
    const next = new Set(markedPeriodDays);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setNutrition((prev) => ({ ...prev, periodDays: [...next] }));
  }

  function applyBlock() {
    if (!selectedDate) return;
    const dur = getDur();
    const startKey = toKey(selectedDate);
    const endKey = toKey(addDays(selectedDate, dur - 1));
    const nb = { type: activeType, start: startKey, end: endKey };
    const filtered = blocks.filter((b) => nb.end < b.start || nb.start > b.end);
    const sorted = [...filtered, nb].sort((a, b) => a.start.localeCompare(b.start));
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

  const previewEnd = selectedDate ? addDays(selectedDate, getDur() - 1) : null;
  const selectedBlock = selectedDate ? blockAt(selectedDate) : null;
  const showPredictedLegend = trackPeriod && predictedPeriodKeys.size > 0;

  const periodStatsText = useMemo(() => {
    if (!trackPeriod) return '';
    if (markedPeriodDays.size === 0)
      return 'Tap the droplet on any day to log your period. Predictions appear automatically.';
    const { periods, avgCycle, avgLen } = periodMeta;
    const lastStart = periods.length > 0 ? fromKey(periods[periods.length - 1][0]) : null;
    const nextPredicted = lastStart ? addDays(lastStart, avgCycle) : null;
    return (
      `${markedPeriodDays.size} day${markedPeriodDays.size !== 1 ? 's' : ''} logged · ` +
      `${periods.length} period${periods.length !== 1 ? 's' : ''} · ` +
      `avg cycle ${avgCycle}d · avg length ${avgLen}d` +
      (nextPredicted ? ` · next ~${fmtShort(nextPredicted)}` : '')
    );
  }, [trackPeriod, markedPeriodDays, periodMeta]);

  /* ── Disabled state ── */
  if (!nutritionEnabled) {
    return (
      <div className="screen nutrition-screen">
        <div className="nutr-disabled-wrap">
          <div className="nutr-disabled-card">
            <div className="nutr-disabled-icon">🥗</div>
            <h2 className="nutr-disabled-title">Nutrition tracking is off</h2>
            <p className="nutr-disabled-body">
              Enable <strong>Nutrition Guidance</strong> and{' '}
              <strong>Bulk / Cut Cycles</strong> in your profile to use this page.
            </p>
            <button
              className="nutr-apply-btn"
              style={{ maxWidth: 220, margin: '0 auto' }}
              onClick={() => goToScreen?.('profile')}
            >
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main page ── */
  return (
    <div className="screen nutrition-screen">
      <div className="nutr-shell">

        {/* Banner */}
        <div className="nutr-banner">
          <div className="nutr-banner-label">Current cycle</div>
          {currentCycleInfo ? (
            <>
              <div className={`nutr-cycle-pill nutr-pill-${currentCycleInfo.type}`}>
                <span className={`nutr-dot nutr-dot-${currentCycleInfo.type}`} />
                {currentCycleInfo.type.charAt(0).toUpperCase() + currentCycleInfo.type.slice(1)}
                {' '}— week {currentCycleInfo.week} of {currentCycleInfo.totalWeeks}
              </div>
              <div className="nutr-prog-wrap">
                <div
                  className={`nutr-prog-fill nutr-prog-${currentCycleInfo.type}`}
                  style={{ width: `${currentCycleInfo.pct}%` }}
                />
              </div>
              <div className="nutr-banner-meta">
                <span>Started {fmtShort(currentCycleInfo.start)}</span>
                <span>{currentCycleInfo.pct}% complete · ends {fmtShort(currentCycleInfo.end)}</span>
              </div>
            </>
          ) : (
            <div className="nutr-cycle-pill nutr-pill-none">No active cycle — click a future date to add one</div>
          )}
        </div>

        <div className="nutr-body">

          {/* Calendar */}
          <div className="nutr-cal-card">
            <div className="nutr-cal-nav">
              <button className="nutr-nav-btn" onClick={prevMonth}>←</button>
              <span className="nutr-cal-month">{fmtMonthYear(viewYear, viewMonth)}</span>
              <button className="nutr-nav-btn" onClick={nextMonth}>→</button>
            </div>

            <div className="nutr-cal-dh">
              {DAY_HEADERS.map((h) => <div key={h}>{h}</div>)}
            </div>

            <div className="nutr-cal-grid">
              {cells.map((date, i) => {
                if (!date) return <div key={`e-${i}`} className="nutr-day-empty" />;

                const isPast = date < today;
                const isToday = toKey(date) === toKey(today);
                const key = toKey(date);
                const b = blockAt(date);
                const isActualPeriod = trackPeriod && markedPeriodDays.has(key);
                const isPredicted = trackPeriod && !isActualPeriod && predictedPeriodKeys.has(key);
                const isSelected = selectedDate && toKey(date) === toKey(selectedDate);

                let cellClass = 'nutr-day';
                if (isPast) cellClass += ' nutr-day-past';
                if (b) cellClass += ` nutr-day-${b.type}`;
                if (isSelected) cellClass += ' nutr-day-selected';
                if (isToday) cellClass += ' nutr-day-today';

                return (
                  <div
                    key={key}
                    className={cellClass}
                    onClick={() => handleDayClick(date)}
                    role="button"
                    tabIndex={isPast ? -1 : 0}
                    onKeyDown={(e) => e.key === 'Enter' && !isPast && handleDayClick(date)}
                  >
                    <span className="nutr-day-num">{date.getDate()}</span>
                    {b && <span className="nutr-day-tag">{b.type}</span>}
                    {isToday && <span className="nutr-today-dot" />}

                    {/* Droplet — shown when cycleTracking is on */}
                    {trackPeriod && (
                      <button
                        className={[
                          'nutr-droplet',
                          isActualPeriod ? 'nutr-droplet-on' : '',
                          isPredicted ? 'nutr-droplet-predicted' : '',
                        ].join(' ').trim()}
                        onClick={(e) => handleDropletClick(e, date)}
                        title={isActualPeriod ? 'Remove period log' : 'Log period day'}
                        tabIndex={-1}
                        aria-label={isActualPeriod ? 'Remove period log' : 'Log period day'}
                      >
                        <DropletIcon filled={isActualPeriod} predicted={isPredicted} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="nutr-legend">
              <div className="nutr-leg-item"><div className="nutr-leg-swatch nutr-swatch-bulk" />Bulk</div>
              <div className="nutr-leg-item"><div className="nutr-leg-swatch nutr-swatch-cut" />Cut</div>
              <div className="nutr-leg-item"><div className="nutr-leg-swatch nutr-swatch-maintain" />Maintain</div>
              {trackPeriod && (
                <div className="nutr-leg-item"><DropletIcon filled /><span style={{ marginLeft: 4 }}>Period</span></div>
              )}
              {showPredictedLegend && (
                <div className="nutr-leg-item"><DropletIcon predicted /><span style={{ marginLeft: 4 }}>Predicted</span></div>
              )}
            </div>

            {/* Period stats — only when tracking */}
            {trackPeriod && (
              <div className="nutr-period-stats-bar">{periodStatsText}</div>
            )}
          </div>

          {/* Sidebar */}
          <div className="nutr-sidebar">
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
                    onChange={(e) => setCustomDays(Math.max(7, parseInt(e.target.value) || 7))}
                  />
                </div>
              )}

              <div className="nutr-preview-box">
                {selectedDate && previewEnd
                  ? `${fmtShort(selectedDate)} → ${fmtShort(previewEnd)} (${getDur()} days)`
                  : 'Select a start date on the calendar'}
              </div>

              <button className="nutr-apply-btn" onClick={applyBlock} disabled={!selectedDate}>
                Apply cycle
              </button>

              {selectedBlock && selectedDate && (
                <button className="nutr-del-btn" onClick={removeBlock}>
                  Remove cycle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
