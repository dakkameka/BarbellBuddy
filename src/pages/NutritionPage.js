import { useMemo, useState } from 'react';
import '../styles/nutrition.css';

function toKey(d) {
  return d.toISOString().split('T')[0];
}

function parseKey(k) {
  return new Date(k + 'T00:00:00');
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function getBlock(blocks, key) {
  return blocks.find(b => key >= b.start && key <= b.end);
}

function buildMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();

  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);

  const offset = first.getDay();
  const days = last.getDate();

  const cells = [];

  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));

  return cells;
}

function NutritionPage({ nutrition, setNutrition, athlete, goBack }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toKey(today));
  const [type, setType] = useState('bulk');
  const [duration, setDuration] = useState(28);

  const blocks = nutrition.bulkCutBlocks || [];

  const cells = useMemo(() => buildMonth(viewMonth), [viewMonth]);

  const current = getBlock(blocks, toKey(today));

  const apply = () => {
    const start = parseKey(selectedDate);
    const end = addDays(start, duration - 1);

    const newBlock = {
      id: Date.now(),
      type,
      start: selectedDate,
      end: toKey(end),
    };

    const filtered = blocks.filter(
      b => newBlock.end < b.start || newBlock.start > b.end
    );

    setNutrition({
      bulkCutBlocks: [...filtered, newBlock].sort((a,b) => a.start.localeCompare(b.start))
    });
  };

  if (!athlete.nutritionGuidance || !athlete.doesBulkCutCycles) {
    return (
      <div className="screen nutrition-screen">
        <div className="nutrition-shell">
          <div className="glass-panel" style={{padding:20}}>
            <h2>Nutrition cycles disabled in profile</h2>
            <button onClick={goBack}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen nutrition-screen">
      <div className="nutrition-shell">

        {/* TOP */}
        <div className="glass-panel nutrition-top">
          <h1>
            {current ? `You are in a ${current.type}` : 'No active cycle'}
          </h1>
        </div>

        {/* CALENDAR */}
        <div className="glass-panel nutrition-calendar">

          <div className="calendar-head">
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth()-1,1))}>Prev</button>
            <div>{viewMonth.toLocaleString('default',{month:'long', year:'numeric'})}</div>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1,1))}>Next</button>
          </div>

          <div className="calendar-grid">
            {cells.map((d,i) => {
              if (!d) return <div key={i} />;

              const key = toKey(d);
              const block = getBlock(blocks, key);
              const past = d < today;

              return (
                <button
                  key={key}
                  disabled={past}
                  className={`day ${past ? 'past':''} ${block ? block.type:''}`}
                  onClick={() => setSelectedDate(key)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* EDITOR */}
        <div className="glass-panel nutrition-editor">

          <h3>{selectedDate}</h3>

          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="bulk">Bulk</option>
            <option value="cut">Cut</option>
          </select>

          <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
            <option value={14}>2 weeks</option>
            <option value={28}>4 weeks</option>
            <option value={56}>8 weeks</option>
          </select>

          <div style={{marginTop:20}}>
            <button onClick={goBack}>Back</button>
            <button onClick={apply}>Apply</button>
          </div>

        </div>

      </div>
    </div>
  );
}

export default NutritionPage;
