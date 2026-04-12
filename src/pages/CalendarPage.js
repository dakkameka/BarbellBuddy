import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import '../styles/calendar.css';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────

const DAY_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function today0() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate()+n); return x;
}

// ─────────────────────────────────────────────────────────────
// WORKOUT TYPES
// ─────────────────────────────────────────────────────────────

const WORKOUT_TYPES = {
  strength:    { label:'Strength',       color:'var(--violet)',  bg:'rgba(143,124,255,0.15)', border:'rgba(143,124,255,0.35)' },
  hypertrophy: { label:'Hypertrophy',    color:'var(--blue)',    bg:'rgba(87,165,255,0.15)',  border:'rgba(87,165,255,0.35)'  },
  endurance:   { label:'Endurance',      color:'var(--cyan)',    bg:'rgba(85,214,255,0.15)',  border:'rgba(85,214,255,0.35)'  },
  pr:          { label:'PR Attempt',     color:'var(--pink)',    bg:'rgba(255,111,216,0.15)', border:'rgba(255,111,216,0.35)' },
  deload:      { label:'Deload',         color:'var(--gold)',    bg:'rgba(255,216,77,0.15)',  border:'rgba(255,216,77,0.35)'  },
  recovery:    { label:'Active Recovery',color:'var(--mint)',    bg:'rgba(87,240,192,0.12)',  border:'rgba(87,240,192,0.3)'   },
  power:       { label:'Power',          color:'var(--pink)',    bg:'rgba(255,111,216,0.12)', border:'rgba(255,111,216,0.3)'  },
  buildup:     { label:'Build-Up',       color:'var(--mint)',    bg:'rgba(87,240,192,0.15)',  border:'rgba(87,240,192,0.35)'  },
};

// ─────────────────────────────────────────────────────────────
// CYCLE PHASES  (female, opt-in only)
// ─────────────────────────────────────────────────────────────

const CYCLE_PHASES = {
  menstrual: {
    label: 'Menstrual', color: 'var(--pink)', borderVar: '--pink',
    days: [1,2,3,4,5],
    intensityMod: 0.80,   // lift at ~80% of normal
    avoidTypes: ['pr','strength'],
    recommendedTypes: ['recovery','endurance'],
    workoutTip: 'Reduce load ~15–20%. Upper body accessories and mobility. Avoid heavy lower-body compounds.',
    nutritionTip: 'Iron-rich foods, higher magnesium. Moderate carbs, stay well-hydrated.',
  },
  follicular: {
    label: 'Follicular', color: 'var(--mint)', borderVar: '--mint',
    days: [6,7,8,9,10,11,12,13],
    intensityMod: 1.0,
    avoidTypes: [],
    recommendedTypes: ['strength','pr','hypertrophy'],
    workoutTip: 'Best window for strength gains. Push heavier weights — recovery is faster now.',
    nutritionTip: 'High carb tolerance. Prioritize pre-workout carbs and post-workout protein.',
  },
  ovulatory: {
    label: 'Ovulatory', color: 'var(--gold)', borderVar: '--gold',
    days: [14,15,16],
    intensityMod: 1.0,
    avoidTypes: ['deload','recovery'],
    recommendedTypes: ['pr','strength'],
    workoutTip: 'Peak performance window — best time for 1RM attempts. Warm up thoroughly.',
    nutritionTip: 'Slightly elevated caloric needs. High protein supports peak output.',
  },
  luteal_early: {
    label: 'Luteal (Early)', color: 'var(--orange)', borderVar: '--orange',
    days: [17,18,19,20,21,22],
    intensityMod: 0.92,
    avoidTypes: ['pr'],
    recommendedTypes: ['hypertrophy','buildup'],
    workoutTip: 'Shift to volume work (4×10–12). Slight fatigue is normal — don\'t chase PRs.',
    nutritionTip: 'Increase protein ~10%. Progesterone raises metabolism slightly. Moderate carbs.',
  },
  luteal_late: {
    label: 'Luteal (Late)', color: 'var(--violet)', borderVar: '--violet',
    days: [23,24,25,26,27,28],
    intensityMod: 0.80,
    avoidTypes: ['pr','strength'],
    recommendedTypes: ['deload','recovery','endurance'],
    workoutTip: 'Reduce intensity 20–30%. Focus on technique and mobility. Extra rest days are fine.',
    nutritionTip: 'Magnesium + B6 reduce PMS. Dark chocolate helps. Slight caloric reduction eases bloating.',
  },
};

function inferCycleAnchor(periodDays = []) {
  if (!periodDays.length) return null;
  const sorted = [...periodDays].sort();
  // find the most recent run of consecutive days
  let runStart = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i-1]), b = new Date(sorted[i]);
    if ((b - a) / 86400000 <= 2) runStart = sorted[0];
    else runStart = sorted[i];
  }
  return new Date(runStart);
}

function getCyclePhase(date, anchor, cycleLen = 28) {
  if (!anchor) return null;
  const d = new Date(date); d.setHours(0,0,0,0);
  const a = new Date(anchor); a.setHours(0,0,0,0);
  const diff = Math.round((d - a) / 86400000);
  let day = ((diff % cycleLen) + cycleLen) % cycleLen + 1;
  for (const [key, ph] of Object.entries(CYCLE_PHASES)) {
    if (ph.days.includes(day)) return { key, phase: ph, cycleDay: day };
  }
  return { key: 'luteal_late', phase: CYCLE_PHASES.luteal_late, cycleDay: day };
}

// ─────────────────────────────────────────────────────────────
// ACCESSORIES  (from equipment profile)
// ─────────────────────────────────────────────────────────────

const ACCESSORIES = {
  'full gym': {
    squat:    [{ name:'Leg Press 3×12', muscle:'Quads' }, { name:'Bulgarian Split Squat 3×10', muscle:'Glutes' }, { name:'Leg Curl 3×12', muscle:'Hamstrings' }, { name:'Calf Raise 4×15', muscle:'Calves' }],
    bench:    [{ name:'Cable Fly 3×15', muscle:'Chest' }, { name:'Tricep Pushdown 4×12', muscle:'Triceps' }, { name:'Face Pull 3×20', muscle:'Rear Delts' }, { name:'Incline DB Press 3×12', muscle:'Upper Chest' }],
    deadlift: [{ name:'Romanian DL 3×10', muscle:'Hamstrings' }, { name:'Lat Pulldown 3×12', muscle:'Lats' }, { name:'Seated Row 3×12', muscle:'Mid Back' }, { name:'Back Extension 3×15', muscle:'Erectors' }],
    ohp:      [{ name:'Lateral Raise 4×15', muscle:'Side Delts' }, { name:'Arnold Press 3×12', muscle:'Shoulders' }, { name:'Skull Crusher 3×12', muscle:'Triceps' }, { name:'Band Pull-Apart 3×25', muscle:'Rear Delts' }],
    upper:    [{ name:'Pull-Up 3×8', muscle:'Lats' }, { name:'DB Row 3×12', muscle:'Back' }, { name:'Chest Fly 3×15', muscle:'Chest' }, { name:'Bicep Curl 3×15', muscle:'Biceps' }],
    lower:    [{ name:'Leg Press 4×12', muscle:'Quads' }, { name:'Hip Thrust 3×15', muscle:'Glutes' }, { name:'Leg Extension 3×15', muscle:'Quads' }, { name:'Seated Leg Curl 3×12', muscle:'Hamstrings' }],
  },
  'barbell + rack': {
    squat:    [{ name:'Good Morning 3×10', muscle:'Hamstrings' }, { name:'Barbell Lunge 3×10/leg', muscle:'Quads' }, { name:'Back Extension 3×15', muscle:'Erectors' }],
    bench:    [{ name:'Close-Grip Bench 3×10', muscle:'Triceps' }, { name:'Barbell Row 3×10', muscle:'Back' }, { name:'Floor Press 3×12', muscle:'Chest' }],
    deadlift: [{ name:'Romanian DL 3×10', muscle:'Hamstrings' }, { name:'Pendlay Row 3×8', muscle:'Back' }, { name:'Good Morning 3×12', muscle:'Lower Back' }],
    ohp:      [{ name:'Push Press 3×5', muscle:'Shoulders' }, { name:'Barbell Shrug 4×15', muscle:'Traps' }, { name:'Close-Grip OHP 3×10', muscle:'Triceps' }],
    upper:    [{ name:'Barbell Row 4×8', muscle:'Back' }, { name:'Close-Grip Bench 3×10', muscle:'Triceps' }, { name:'Barbell Curl 3×12', muscle:'Biceps' }],
    lower:    [{ name:'Barbell Lunge 3×10', muscle:'Quads' }, { name:'Romanian DL 3×10', muscle:'Hamstrings' }, { name:'Good Morning 3×12', muscle:'Lower Back' }],
  },
  dumbbells: {
    squat:    [{ name:'Goblet Squat 4×12', muscle:'Quads' }, { name:'DB Reverse Lunge 3×12/leg', muscle:'Glutes' }, { name:'DB Step-Up 3×12/leg', muscle:'Quads' }],
    bench:    [{ name:'DB Press 4×12', muscle:'Chest' }, { name:'DB Fly 3×15', muscle:'Chest' }, { name:'DB Tricep Extension 3×15', muscle:'Triceps' }],
    deadlift: [{ name:'DB Romanian DL 3×12', muscle:'Hamstrings' }, { name:'DB Row 4×12', muscle:'Back' }, { name:'DB Shrug 3×20', muscle:'Traps' }],
    ohp:      [{ name:'DB Shoulder Press 4×12', muscle:'Shoulders' }, { name:'Lateral Raise 4×15', muscle:'Side Delts' }, { name:'DB Front Raise 3×15', muscle:'Front Delts' }],
    upper:    [{ name:'DB Row 4×12', muscle:'Back' }, { name:'DB Curl 3×15', muscle:'Biceps' }, { name:'Lateral Raise 3×15', muscle:'Delts' }],
    lower:    [{ name:'DB Goblet Squat 4×15', muscle:'Quads' }, { name:'DB RDL 4×12', muscle:'Hamstrings' }, { name:'DB Hip Thrust 3×15', muscle:'Glutes' }],
  },
  bodyweight: {
    squat:    [{ name:'Bodyweight Squat 4×20', muscle:'Quads' }, { name:'Jump Squat 3×10', muscle:'Power' }, { name:'Wall Sit 3×45s', muscle:'Quads' }],
    bench:    [{ name:'Push-Up 4×20', muscle:'Chest' }, { name:'Diamond Push-Up 3×15', muscle:'Triceps' }, { name:'Pike Push-Up 3×12', muscle:'Shoulders' }],
    deadlift: [{ name:'Single-Leg RDL 3×12', muscle:'Hamstrings' }, { name:'Superman Hold 3×30s', muscle:'Back' }, { name:'Glute Bridge 4×20', muscle:'Glutes' }],
    ohp:      [{ name:'Pike Push-Up 4×12', muscle:'Shoulders' }, { name:'Handstand Hold 3×30s', muscle:'Shoulders' }, { name:'Tricep Dip 3×15', muscle:'Triceps' }],
    upper:    [{ name:'Push-Up Variations 4×15', muscle:'Chest' }, { name:'Inverted Row 3×12', muscle:'Back' }, { name:'Tricep Dip 3×15', muscle:'Triceps' }],
    lower:    [{ name:'Bulgarian Split Squat 3×15', muscle:'Quads' }, { name:'Hip Thrust 4×20', muscle:'Glutes' }, { name:'Single-Leg Glute Bridge 3×15', muscle:'Glutes' }],
  },
};

function getAccessories(liftName, equipment) {
  const eq = ACCESSORIES[equipment] || ACCESSORIES['full gym'];
  const l = (liftName || '').toLowerCase();
  if (l.includes('squat'))                              return eq.squat    || [];
  if (l.includes('bench'))                              return eq.bench    || [];
  if (l.includes('deadlift') && !l.includes('romanian'))return eq.deadlift || [];
  if (l.includes('ohp') || l.includes('overhead') || l.includes('press')) return eq.ohp || [];
  if (l.includes('upper'))                              return eq.upper    || [];
  if (l.includes('lower') || l.includes('leg'))         return eq.lower    || [];
  return eq.upper || [];
}

// ─────────────────────────────────────────────────────────────
// GOAL CONFIGS  (maps goal → default schedule pattern)
// ─────────────────────────────────────────────────────────────

function getGoalConfig(goal) {
  const configs = {
    strength:    { sets:'5×5',  pct:0.82, note:'Heavy, low-rep neural adaptation',   restDays:3 },
    hypertrophy: { sets:'4×10', pct:0.70, note:'Volume focus — moderate weight',      restDays:2 },
    fat_loss:    { sets:'3×12', pct:0.65, note:'High rep, metabolic conditioning',    restDays:2 },
    general:     { sets:'4×8',  pct:0.72, note:'Balanced strength + conditioning',    restDays:3 },
    performance: { sets:'4×6',  pct:0.77, note:'Power + sport conditioning balance',  restDays:2 },
  };
  return configs[goal] || configs.general;
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE BUILDER
// ─────────────────────────────────────────────────────────────

/*
  Personalisation hooks wired in here:
  1. goal → sets/intensity pattern
  2. cyclePhase → intensityMod, avoidTypes, recommendedTypes
  3. bulkCutBlocks → caloric guidance per day
  4. blockedDays → marks day as blocked
  5. considerations (injury notes) → passed to AI, flagged in UI
*/

const BASE_PATTERNS = {
  strength: [
    { lift:'Back Squat',   type:'strength',    baseKey:'squat',    cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Bench Press',  type:'strength',    baseKey:'bench',    cal:'+350' },
    { lift:'Back Squat',   type:'hypertrophy', baseKey:'squat',    cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Deadlift',     type:'strength',    baseKey:'deadlift', cal:'+400' },
    { rest: true,                                                   cal:'+100' },
    { lift:'OHP',          type:'strength',    baseKey:'ohp',      cal:'+350' },
    { lift:'Bench Press',  type:'hypertrophy', baseKey:'bench',    cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Back Squat',   type:'pr',          baseKey:'squat',    cal:'+350' },
    { lift:'Deadlift',     type:'hypertrophy', baseKey:'deadlift', cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'OHP',          type:'buildup',     baseKey:'ohp',      cal:'+300' },
  ],
  hypertrophy: [
    { lift:'Back Squat',   type:'hypertrophy', baseKey:'squat',    cal:'+350' },
    { lift:'Bench Press',  type:'hypertrophy', baseKey:'bench',    cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Deadlift',     type:'strength',    baseKey:'deadlift', cal:'+350' },
    { lift:'OHP',          type:'hypertrophy', baseKey:'ohp',      cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Back Squat',   type:'buildup',     baseKey:'squat',    cal:'+350' },
    { rest: true,                                                   cal:'+100' },
    { lift:'Bench Press',  type:'hypertrophy', baseKey:'bench',    cal:'+350' },
    { lift:'Lower Body',   type:'hypertrophy', baseKey:'lower',    cal:'+350' },
    { rest: true,                                                   cal:'+150' },
    { lift:'Deadlift',     type:'hypertrophy', baseKey:'deadlift', cal:'+350' },
    { lift:'OHP',          type:'strength',    baseKey:'ohp',      cal:'+350' },
    { rest: true,                                                   cal:'+150' },
  ],
  fat_loss: [
    { lift:'Back Squat',   type:'endurance',   baseKey:'squat',    cal:'-200' },
    { lift:'Bench Press',  type:'endurance',   baseKey:'bench',    cal:'-200' },
    { rest: true,                                                   cal:'-300' },
    { lift:'Deadlift',     type:'strength',    baseKey:'deadlift', cal:'-150' },
    { lift:'OHP',          type:'endurance',   baseKey:'ohp',      cal:'-200' },
    { rest: true,                                                   cal:'-300' },
    { lift:'Upper Body',   type:'hypertrophy', baseKey:'upper',    cal:'-200' },
    { rest: true,                                                   cal:'-300' },
    { lift:'Back Squat',   type:'endurance',   baseKey:'squat',    cal:'-200' },
    { lift:'Bench Press',  type:'endurance',   baseKey:'bench',    cal:'-200' },
    { rest: true,                                                   cal:'-300' },
    { lift:'Deadlift',     type:'endurance',   baseKey:'deadlift', cal:'-200' },
    { lift:'Recovery',     type:'recovery',    baseKey:'upper',    cal:'-300' },
    { rest: true,                                                   cal:'-300' },
  ],
};
BASE_PATTERNS.general     = BASE_PATTERNS.strength;
BASE_PATTERNS.performance = BASE_PATTERNS.hypertrophy;

function buildSchedule(athlete, nutrition = {}) {
  const today = today0();
  const goal = getGoalConfig(athlete.goal);
  const pattern = BASE_PATTERNS[athlete.goal] || BASE_PATTERNS.strength;

  const isFemale  = athlete.gender === 'female';
  const useCycle  = isFemale && athlete.cycleTracking;
  const cycleAnchor = useCycle ? inferCycleAnchor(nutrition.periodDays || []) : null;
  const bulkCutBlocks = nutrition.bulkCutBlocks || [];

  function getActiveBulkCut(date) {
    const k = toKey(date);
    return bulkCutBlocks.find(b => k >= b.start && k <= b.end) || null;
  }

  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const dateKey = toKey(date);
    const p = { ...pattern[i % pattern.length] };

    // Cycle phase
    let cycleInfo = null;
    if (useCycle && cycleAnchor) {
      cycleInfo = getCyclePhase(date, cycleAnchor);
    }

    // Bulk/cut override
    const bulkCutBlock = getActiveBulkCut(date);

    // Optimize type for cycle phase
    if (cycleInfo && !p.rest) {
      const ph = cycleInfo.phase;
      if (ph.avoidTypes.includes(p.type) && ph.recommendedTypes.length) {
        p.type = ph.recommendedTypes[0];
      }
    }

    // Accessories
    const accessories = (!p.rest && p.baseKey)
      ? getAccessories(p.baseKey, athlete.equipment).map(a => ({ ...a, done: false }))
      : [];

    // Reason string (later replaced by AI)
    let reason = '';
    if (p.rest) {
      reason = 'CNS recovery day. Keep protein high, light movement only.';
    } else {
      const typeLabel = WORKOUT_TYPES[p.type]?.label || p.type;
      reason = `${typeLabel} — ${goal.note}. ${cycleInfo ? `Cycle day ${cycleInfo.cycleDay} (${cycleInfo.phase.label}).` : ''}`;
      if (athlete.considerations) {
        reason += ` Note: ${athlete.considerations}`;
      }
    }

    // Nutrition note
    let nutr = '';
    if (p.rest) {
      nutr = 'Recovery day — keep protein at 1g/lb bodyweight. Hydration priority.';
    } else if (cycleInfo) {
      nutr = cycleInfo.phase.nutritionTip;
    } else if (bulkCutBlock) {
      nutr = bulkCutBlock.type === 'bulk'
        ? `Bulk surplus ${p.cal} kcal. Pre-workout complex carbs 90 min before.`
        : bulkCutBlock.type === 'cut'
        ? `Deficit day. Keep protein high (${athlete.bodyweight}g). Time carbs around session.`
        : 'Maintenance calories. Balanced macros around training window.';
    } else {
      nutr = 'No active nutrition cycle set. Update your Nutrition page to get calorie targets here.';
    }

    days.push({
      lift: p.lift || null,
      type: p.type || null,
      baseKey: p.baseKey || null,
      cal: p.cal || '',
      rest: !!p.rest,
      reason,
      nutr,
      accessories,
      cycleInfo,
      bulkCutBlock,
      date,
      dateKey,
      dayNum: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      weekday: date.getDay(),
      isToday: i === 0,
      dayLabel: `${DAY_SHORT[date.getDay()]} ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
    });
  }
  return days;
}

// ─────────────────────────────────────────────────────────────
// AI PANEL (calls the same /api/openai proxy as the rest)
// ─────────────────────────────────────────────────────────────

async function askGPT(systemPrompt, userPrompt) {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'OpenAI API error');
  return data.output;
}

async function getCalendarInsight(athlete, schedule, blockedCount, nutrition) {
  const upcoming = schedule
    .filter(d => !d.rest && d.lift)
    .slice(0, 5)
    .map(d => `${d.dayLabel}: ${d.lift} (${d.type || 'general'})`)
    .join('\n');

  const bulkCutBlocks = nutrition?.bulkCutBlocks || [];
  const todayBlock = bulkCutBlocks.find(b => {
    const tk = toKey(today0());
    return tk >= b.start && tk <= b.end;
  });

  const system = `You are an elite strength coach embedded in a training app. Give EXACTLY 3 bullet points — each under 28 words, data-referenced, no fluff.
• [Load / intensity recommendation based on current phase]
• [Specific exercise or schedule adjustment]
• [Recovery or nutrition priority this week]`;

  const user = `Athlete: ${athlete.firstName} ${athlete.lastName}, ${athlete.age}yr, ${athlete.bodyweight}lb
Goal: ${athlete.goal} | Equipment: ${athlete.equipment}
Current nutrition phase: ${todayBlock ? todayBlock.type.toUpperCase() : 'None set'}
Cycle tracking: ${athlete.cycleTracking ? 'enabled' : 'disabled'}
Considerations / injuries: ${athlete.considerations || 'none'}
Blocked days this week: ${blockedCount}
Upcoming schedule:
${upcoming}`;

  return await askGPT(system, user);
}

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────

function WorkoutTypePill({ type }) {
  const wt = WORKOUT_TYPES[type];
  if (!wt) return null;
  return (
    <span
      className="cal-type-pill"
      style={{ color: wt.color, background: wt.bg, borderColor: wt.border }}
    >
      {wt.label}
    </span>
  );
}

function CycleBadge({ cycleInfo }) {
  if (!cycleInfo) return null;
  const { phase, cycleDay } = cycleInfo;
  return (
    <span
      className="cal-cycle-badge"
      style={{ color: phase.color, borderColor: phase.color + '55', background: phase.color + '15' }}
    >
      {phase.label} · D{cycleDay}
    </span>
  );
}

function NutritionBadge({ bulkCutBlock, cal }) {
  if (!bulkCutBlock && !cal) return null;
  const type = bulkCutBlock?.type;
  const colorMap = { bulk:'var(--mint)', cut:'var(--orange)', maintain:'var(--blue)' };
  const color = colorMap[type] || 'var(--muted)';
  const label = type ? `${type.charAt(0).toUpperCase() + type.slice(1)} ${cal}` : cal;
  return (
    <span className="cal-nutr-badge" style={{ color, borderColor: color + '44', background: color + '12' }}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// DAY MODAL
// ─────────────────────────────────────────────────────────────

function DayModal({ day, onClose, onBlock, onStartLift, onToggleAcc, accDone, useCycle }) {
  const wt = day.type ? WORKOUT_TYPES[day.type] : null;
  const accs = day.accessories || [];
  const dayAcc = accDone[day.dateKey] || {};
  const doneCount = Object.values(dayAcc).filter(Boolean).length;

  return (
    <div className="cal-modal-overlay" onClick={e => e.target.classList.contains('cal-modal-overlay') && onClose()}>
      <div className="cal-modal">
        {/* Header */}
        <div className="cal-modal-head">
          <div>
            <div className="cal-modal-date">{day.dayLabel}{day.isToday && <span className="cal-today-tag">Today</span>}</div>
            <div className="cal-modal-title">{day.rest ? 'Rest Day' : (day.lift || '—')}</div>
          </div>
          <button className="cal-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Type + badges */}
        <div className="cal-modal-badges">
          {wt && <WorkoutTypePill type={day.type} />}
          {useCycle && <CycleBadge cycleInfo={day.cycleInfo} />}
          {!day.rest && <NutritionBadge bulkCutBlock={day.bulkCutBlock} cal={day.cal} />}
        </div>

        {/* Cycle phase insight block */}
        {useCycle && day.cycleInfo && (
          <div className="cal-modal-section cal-cycle-insight"
            style={{ borderColor: day.cycleInfo.phase.color + '44', background: day.cycleInfo.phase.color + '0d' }}>
            <div className="cal-modal-section-label" style={{ color: day.cycleInfo.phase.color }}>
              Cycle insight
            </div>
            <p className="cal-modal-body">{day.cycleInfo.phase.workoutTip}</p>
            <p className="cal-modal-body-muted" style={{ marginTop: 6 }}>
              <strong style={{ color: day.cycleInfo.phase.color }}>Nutrition:</strong>{' '}
              {day.cycleInfo.phase.nutritionTip}
            </p>
            {day.cycleInfo.phase.intensityMod < 1 && (
              <div className="cal-intensity-chip" style={{ borderColor: day.cycleInfo.phase.color + '55', color: day.cycleInfo.phase.color }}>
                Intensity target: ~{Math.round(day.cycleInfo.phase.intensityMod * 100)}% of normal
              </div>
            )}
          </div>
        )}

        {/* Why scheduled */}
        <div className="cal-modal-section">
          <div className="cal-modal-section-label">Why this is scheduled</div>
          <p className="cal-modal-body">{day.reason}</p>
        </div>

        {/* Nutrition */}
        <div className="cal-modal-section">
          <div className="cal-modal-section-label">Nutrition today</div>
          <p className="cal-modal-body">{day.nutr}</p>
        </div>

        {/* Accessories */}
        {accs.length > 0 && (
          <div className="cal-modal-section">
            <div className="cal-modal-section-label-row">
              <span className="cal-modal-section-label">Accessories</span>
              <span className="cal-modal-acc-count">{doneCount}/{accs.length} done</span>
            </div>
            <div className="cal-modal-acc-list">
              {accs.map((acc, idx) => {
                const done = !!dayAcc[idx];
                return (
                  <div
                    key={idx}
                    className={`cal-acc-row ${done ? 'cal-acc-done' : ''}`}
                    onClick={() => onToggleAcc(day.dateKey, idx)}
                  >
                    <div className={`cal-acc-check ${done ? 'cal-acc-check-done' : ''}`}>
                      {done ? '✓' : ''}
                    </div>
                    <div className="cal-acc-info">
                      <div className="cal-acc-name">{acc.name}</div>
                      <div className="cal-acc-muscle">{acc.muscle}</div>
                    </div>
                    <div className="cal-acc-status">{done ? 'Done' : 'Tap'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="cal-modal-actions">
          <button className="cal-modal-btn cal-modal-btn-ghost" onClick={onClose}>Close</button>
          <button className="cal-modal-btn cal-modal-btn-block" onClick={() => { onBlock(day.dateKey); onClose(); }}>
            Block day
          </button>
          {!day.rest && day.lift && (
            <button className="cal-modal-btn cal-modal-btn-start" onClick={() => { onStartLift(day.lift); onClose(); }}>
              Start lift
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AI INSIGHT PANEL
// ─────────────────────────────────────────────────────────────

function AIInsightPanel({ athlete, schedule, blockedDays, nutrition }) {
  const [lines, setLines]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const raw = await getCalendarInsight(athlete, schedule, blockedDays, nutrition);
      const parsed = raw.split('\n')
        .filter(l => l.trim().startsWith('•'))
        .map(l => l.trim().replace(/^•\s*/, ''));
      setLines(parsed.length ? parsed : [raw]);
    } catch {
      setError('Could not reach AI — check your connection.');
    }
    setLoading(false);
  }, [athlete, schedule, blockedDays, nutrition]);

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; fetch(); }
  }, [fetch]);

  const dotColors = ['var(--mint)', 'var(--blue)', 'var(--orange)'];

  return (
    <div className="cal-ai-panel">
      <div className="cal-ai-panel-head">
        <div className="cal-ai-panel-title">
          <span className="cal-ai-spark">✦</span>
          AI Schedule Insight
        </div>
        <button
          className="cal-ai-refresh"
          onClick={fetch}
          disabled={loading}
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="cal-ai-loading">
          <div className="cal-ai-spinner" />
          <span>Analysing your schedule…</span>
        </div>
      )}

      {error && <p className="cal-ai-error">{error}</p>}

      {!loading && !error && lines.map((line, i) => (
        <div key={i} className="cal-ai-row">
          <div className="cal-ai-dot" style={{ background: dotColors[i] || 'var(--muted)' }} />
          <p className="cal-ai-text">{line}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WEEK STRIP  (the 7-day horizontal scroll card row)
// ─────────────────────────────────────────────────────────────

function WeekStrip({ days, blocked, onDayClick, onBlockToggle, accDone }) {
  return (
    <div className="cal-week-strip">
      {days.map(day => {
        const isBlocked = blocked.has(day.dateKey);
        const wt = day.type ? WORKOUT_TYPES[day.type] : null;
        const accs = day.accessories || [];
        const dayAcc = accDone[day.dateKey] || {};
        const doneAcc = Object.values(dayAcc).filter(Boolean).length;
        const cycleColor = day.cycleInfo ? day.cycleInfo.phase.color : null;

        return (
          <div
            key={day.dateKey}
            className={[
              'cal-day-card',
              day.isToday   ? 'cal-day-today'   : '',
              isBlocked     ? 'cal-day-blocked'  : '',
              day.rest      ? 'cal-day-rest'     : '',
            ].filter(Boolean).join(' ')}
            style={cycleColor && !isBlocked ? { '--cycle-color': cycleColor } : {}}
            onClick={() => !isBlocked && onDayClick(day)}
          >
            {/* Block toggle button */}
            <button
              className={`cal-block-btn ${isBlocked ? 'cal-block-btn-on' : ''}`}
              title={isBlocked ? 'Unblock day' : 'Block day'}
              onClick={e => { e.stopPropagation(); onBlockToggle(day.dateKey); }}
            >
              {isBlocked ? '↩' : '×'}
            </button>

            {/* Day header */}
            <div className="cal-day-header">
              <span className="cal-day-short">{DAY_SHORT[day.weekday]}</span>
              <span className={`cal-day-num ${day.isToday ? 'cal-day-num-today' : ''}`}>
                {day.dayNum}
              </span>
            </div>

            {/* Cycle phase stripe */}
            {cycleColor && !isBlocked && (
              <div
                className="cal-cycle-stripe"
                style={{ background: cycleColor }}
                title={day.cycleInfo.phase.label}
              />
            )}

            {/* Content */}
            {isBlocked ? (
              <div className="cal-day-blocked-label">Blocked</div>
            ) : day.rest ? (
              <div className="cal-day-rest-label">Rest</div>
            ) : (
              <>
                <div className="cal-day-lift">{day.lift}</div>
                {wt && (
                  <div className="cal-day-type" style={{ color: wt.color }}>
                    {wt.label}
                  </div>
                )}
                {day.bulkCutBlock && (
                  <div className="cal-day-nutr" style={{
                    color: day.bulkCutBlock.type === 'bulk' ? 'var(--mint)' : day.bulkCutBlock.type === 'cut' ? 'var(--orange)' : 'var(--blue)'
                  }}>
                    {day.bulkCutBlock.type.charAt(0).toUpperCase() + day.bulkCutBlock.type.slice(1)} {day.cal}
                  </div>
                )}
                {accs.length > 0 && (
                  <div className="cal-day-acc-progress">
                    <div
                      className="cal-day-acc-bar"
                      style={{ width: `${accs.length ? (doneAcc / accs.length) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function CalendarPage({ athlete, schedule: extSchedule, setSchedule: setExtSchedule, nutrition, goToScreen }) {
  const today = useMemo(() => today0(), []);

  // Build internal schedule from athlete + nutrition
  const [schedule, setSchedule] = useState(() =>
    buildSchedule(athlete, nutrition)
  );

  // Rebuild when athlete or nutrition changes
  useEffect(() => {
    setSchedule(buildSchedule(athlete, nutrition));
  }, [athlete, nutrition]);

  const [blocked, setBlocked]   = useState(new Set());
  const [accDone, setAccDone]   = useState({});
  const [modalDay, setModalDay] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = week 1, 1 = week 2

  const isFemale = athlete?.gender === 'female';
  const useCycle = isFemale && athlete?.cycleTracking;

  // Which 7 days to show
  const visibleDays = useMemo(
    () => schedule.slice(weekOffset * 7, weekOffset * 7 + 7),
    [schedule, weekOffset]
  );

  const toggleBlock = useCallback(dateKey => {
    setBlocked(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  }, []);

  const toggleAcc = useCallback((dateKey, idx) => {
    setAccDone(prev => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), [idx]: !(prev[dateKey]?.[idx]) },
    }));
  }, []);

  const handleStartLift = useCallback(liftName => {
    goToScreen?.('liveWorkout');
  }, [goToScreen]);

  // Active nutrition block for today
  const todayBlock = useMemo(() => {
    const k = toKey(today);
    return (nutrition?.bulkCutBlocks || []).find(b => k >= b.start && k <= b.end) || null;
  }, [nutrition, today]);

  // Cycle phase for today
  const todayCycle = useMemo(() => {
    if (!useCycle) return null;
    const anchor = inferCycleAnchor(nutrition?.periodDays || []);
    return anchor ? getCyclePhase(today, anchor) : null;
  }, [useCycle, nutrition]);

  const blockedCount = blocked.size;

  // Week label
  const weekLabel = useMemo(() => {
    const start = addDays(today, weekOffset * 7);
    const end   = addDays(today, weekOffset * 7 + 6);
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
  }, [today, weekOffset]);

  return (
    <div className="screen cal-screen">

      {/* ── PAGE HEADER ── */}
      <div className="cal-page-header">
        <div>
          <h1 className="page-title gradient-purple">Training Calendar</h1>
          <p className="page-sub">
            {athlete.firstName}&apos;s {athlete.goal} program · {athlete.equipment} ·{' '}
            {useCycle ? 'Cycle-optimised' : 'Standard schedule'}
          </p>
        </div>

        {/* Contextual status chips */}
        <div className="cal-header-chips">
          {todayBlock && (
            <div className={`cal-phase-chip cal-phase-${todayBlock.type}`}>
              <span className={`cal-phase-dot cal-phase-dot-${todayBlock.type}`} />
              {todayBlock.type.charAt(0).toUpperCase() + todayBlock.type.slice(1)}
            </div>
          )}
          {todayCycle && (
            <div className="cal-phase-chip" style={{
              color: todayCycle.phase.color,
              borderColor: todayCycle.phase.color + '55',
              background: todayCycle.phase.color + '12',
            }}>
              <span className="cal-phase-dot" style={{ background: todayCycle.phase.color }} />
              {todayCycle.phase.label} · D{todayCycle.cycleDay}
            </div>
          )}
          {athlete.considerations && (
            <div className="cal-phase-chip cal-phase-chip-warn">
              ⚠ {athlete.considerations.slice(0, 30)}{athlete.considerations.length > 30 ? '…' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── WEEK NAVIGATOR ── */}
      <div className="cal-week-nav">
        <button
          className="cal-week-btn"
          disabled={weekOffset === 0}
          onClick={() => setWeekOffset(0)}
        >
          ← Week 1
        </button>
        <div className="cal-week-label">{weekLabel}</div>
        <button
          className="cal-week-btn"
          disabled={weekOffset === 1}
          onClick={() => setWeekOffset(1)}
        >
          Week 2 →
        </button>
      </div>

      {/* ── WEEK STRIP ── */}
      <WeekStrip
        days={visibleDays}
        blocked={blocked}
        onDayClick={setModalDay}
        onBlockToggle={toggleBlock}
        accDone={accDone}
      />

      {/* ── LEGEND ── */}
      <div className="cal-legend">
        <span className="cal-legend-label">Legend:</span>
        {Object.entries(WORKOUT_TYPES).slice(0, 5).map(([k, wt]) => (
          <div key={k} className="cal-legend-item">
            <div className="cal-legend-dot" style={{ background: wt.color }} />
            <span>{wt.label}</span>
          </div>
        ))}
        {useCycle && (
          <>
            <span className="cal-legend-sep">|</span>
            {Object.entries(CYCLE_PHASES).map(([k, ph]) => (
              <div key={k} className="cal-legend-item">
                <div className="cal-legend-stripe" style={{ background: ph.color }} />
                <span>{ph.label}</span>
              </div>
            ))}
          </>
        )}
        <div className="cal-legend-item">
          <div className="cal-legend-dot" style={{ background: 'var(--muted)', opacity: 0.5 }} />
          <span>Blocked</span>
        </div>
      </div>

      {/* ── AI INSIGHT PANEL ── */}
      <AIInsightPanel
        athlete={athlete}
        schedule={schedule}
        blockedDays={blockedCount}
        nutrition={nutrition}
      />

      {/* ── DAY MODAL ── */}
      {modalDay && (
        <DayModal
          day={modalDay}
          onClose={() => setModalDay(null)}
          onBlock={toggleBlock}
          onStartLift={handleStartLift}
          onToggleAcc={toggleAcc}
          accDone={accDone}
          useCycle={useCycle}
        />
      )}
    </div>
  );
}
