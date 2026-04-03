import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { getPostSessionDebrief, getLiveCoachMessage, getCalendarAdjustment, getNutritionAdvice, getChatCoachReply } from './openai';

// ─────────────────────────────────────────────
// DEFAULT ATHLETE PROFILE
// ─────────────────────────────────────────────
const DEFAULT_ATHLETE = {
  name: 'John D.',
  firstName: 'John',
  lastName: 'D.',
  gender: 'male',
  age: 26,
  heightFt: 5,
  heightIn: 11,
  bodyweight: 185,
  trainingAge: 3,
  phase: 'bulk',
  phaseWeek: 6,
  phaseTotalWeeks: 12,
  squat1RM: 285,
  bench1RM: 215,
  deadlift1RM: 365,
  ohp1RM: 145,
  goal: 'strength',
  equipment: 'full',
  daysPerWeek: 4,
  injuryNotes: '',
  caloricTarget: 3200,
};

const FAKE_SESSION = {
  lift: 'Back Squat', weight: 225, totalSets: 5, setsCompleted: 5, repsPerSet: 5,
  repVelocities: [0.72, 0.70, 0.67, 0.61, 0.55],
  repTilts: [1.8, 2.1, 2.3, 2.6, 2.9],
  avgVelocity: 0.65, rep1Velocity: 0.72, lastRepVelocity: 0.55,
  velocityDropoff: 24, avgTilt: 2.3, fatigueIndex: 34,
  nutritionPhase: 'Bulk',
};

const WORKOUT_TYPES = {
  strength:    { label:'STRENGTH FOCUS',  color:'var(--neon-purple)', bg:'rgba(124,0,255,0.1)',  border:'rgba(124,0,255,0.4)' },
  hypertrophy: { label:'HYPERTROPHY',     color:'var(--neon-blue)',   bg:'rgba(0,149,255,0.1)',  border:'rgba(0,149,255,0.4)' },
  endurance:   { label:'ENDURANCE',       color:'var(--neon-teal)',   bg:'rgba(0,191,165,0.1)',  border:'rgba(0,191,165,0.4)' },
  pr:          { label:'HIT A NEW PR 🏆', color:'var(--neon-pink)',   bg:'rgba(255,0,102,0.1)',  border:'rgba(255,0,102,0.4)' },
  buildup:     { label:'BUILD-UP',        color:'var(--neon-green)',  bg:'rgba(0,200,83,0.1)',   border:'rgba(0,200,83,0.4)'  },
  deload:      { label:'DELOAD',          color:'var(--neon-yellow)', bg:'rgba(255,171,0,0.1)',  border:'rgba(255,171,0,0.4)' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─────────────────────────────────────────────
// CALENDAR BUILDER
// ─────────────────────────────────────────────
function buildSchedule(athlete) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const liftPattern = [
    { lift:'Squat 5x5',      type:'strength',    cal:'+350', rest:false,
      reason:'Week 6 bulk — 5x5 at 79% 1RM drives neural adaptation. Squat is the foundation of your program.',
      nutr:'Bulk surplus +350 kcal. Target 420g carbs today. Pre-workout: rice + banana 90 min before.' },
    { lift:null,             type:null,          cal:'+200', rest:true,
      reason:'CNS recovery after heavy squat. Posterior chain needs 48h minimum.',
      nutr:'Lower calorie day +200 kcal. Protein stays high — MPS peaks 24-48h post session.' },
    { lift:'Bench 4x8',      type:'hypertrophy', cal:'+350', rest:false,
      reason:'Hypertrophy block: 4x8 at 72% 1RM. Controlled eccentric tempo today.',
      nutr:'60g carbs 90 min pre-workout. 50g protein within 30 min post-session.' },
    { lift:'Squat 4x6',      type:'hypertrophy', cal:'+350', rest:false,
      reason:'Second squat day — hypertrophy focus at 74% 1RM. More volume = more adaptation.',
      nutr:'Same carb timing as heavy squat day. Hypertrophy sessions are calorically expensive.' },
    { lift:null,             type:null,          cal:'+200', rest:true,
      reason:'Rest after back-to-back squat and bench. CNS fatigue accumulates.',
      nutr:'Recovery day. Keep protein high. Extra hydration.' },
    { lift:'Deadlift 3x5',   type:'strength',    cal:'+400', rest:false,
      reason:'CNS readiness high — 3x5 at 86% 1RM. This is a strength day, not volume.',
      nutr:'Highest calorie day: +400 kcal. Complex carbs only. 50g protein post.' },
    { lift:null,             type:null,          cal:'+150', rest:true,
      reason:'Active rest. Mobility or light cardio only.',
      nutr:'Lowest calorie day +150 kcal. Focus on sleep — GH peaks during deep sleep.' },
    { lift:'Squat 5x5+',     type:'pr',          cal:'+350', rest:false,
      reason:'PR ATTEMPT: add 5 lbs to last squat. 6 weeks of velocity data show consistent adaptation.',
      nutr:'Largest carb day. Load 500g carbs split between night before and pre-workout.' },
    { lift:null,             type:null,          cal:'+200', rest:true,
      reason:'Rest after PR attempt. Max effort causes more CNS fatigue than volume sessions.',
      nutr:'Recovery nutrition. High protein + antioxidants to reduce post-max inflammation.' },
    { lift:'Bench 4x8+',     type:'buildup',     cal:'+350', rest:false,
      reason:'Progressive bench: +2.5 lbs. Pressing velocity held at 0.68 m/s last session.',
      nutr:'Same as last bench day. Nutrition unchanged for progressive overload.' },
    { lift:'Squat 3x8',      type:'hypertrophy', cal:'+350', rest:false,
      reason:'Volume squat day — 3x8 at 68% 1RM. Higher reps build the muscular base.',
      nutr:'Higher carb timing around this session — 8-rep sets burn more glycogen.' },
    { lift:null,             type:null,          cal:'+200', rest:true,
      reason:'Rest after squat volume day.',
      nutr:'Standard recovery nutrition. Hydration priority today.' },
    { lift:'OHP 4x8',        type:'hypertrophy', cal:'+350', rest:false,
      reason:'OHP hypertrophy: 4x8 at 69% 1RM. IMU tilt shows right shoulder weakness — pause at top.',
      nutr:'Standard bulk day. Treat pre-workout nutrition same as squat day.' },
    { lift:'Deload Squat',   type:'deload',      cal:'+150', rest:false,
      reason:'Planned deload: 50% load, focus on bar path. Tendons need to catch up.',
      nutr:'Lower calorie day. Mild deficit on deload days accelerates recomposition.' },
  ];

  const days = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const pattern = liftPattern[i % liftPattern.length];
    days.push({
      ...pattern,
      date,
      dayNum: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      weekday: date.getDay(),
      today: i === 0,
      dateKey: date.toDateString(),
      dateLabel: `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`,
    });
  }
  return days;
}

// ─────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────
function AICard({ dot, text, meta, loading }) {
  return (
    <div className="ai-card">
      <div className={`ai-dot dot-${dot}`}/>
      <div style={{flex:1}}>
        {loading
          ? <div className="ai-loading"><div className="ai-spinner"/><span style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>AI thinking...</span></div>
          : <div className="at">{text}</div>
        }
        {meta && !loading && <div className="am">{meta}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INPUT ROW (must be outside ProfileScreen to avoid focus loss)
// ─────────────────────────────────────────────
function InputRow({ label, children }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
      <label style={{fontSize:10,fontWeight:900,color:'var(--muted)',letterSpacing:1}}>{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────
function ProfileScreen({ athlete, onSave }) {
  const [form, setForm] = useState({ ...athlete });
  const [saved, setSaved] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    const updated = {
      ...form,
      name: `${form.firstName} ${form.lastName}`,
      caloricTarget: form.phase === 'bulk'
        ? Math.round(form.bodyweight * 17 + 350)
        : form.phase === 'cut'
        ? Math.round(form.bodyweight * 13 - 300)
        : Math.round(form.bodyweight * 15),
    };
    onSave(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const bmi = ((form.bodyweight / Math.pow((form.heightFt * 12 + form.heightIn), 2)) * 703).toFixed(1);
  const heightCm = Math.round((form.heightFt * 12 + form.heightIn) * 2.54);
  const weightKg = Math.round(form.bodyweight * 0.453592);
  const initials = `${form.firstName?.[0] ?? '?'}${form.lastName?.[0] ?? '?'}`.toUpperCase();

  const inputStyle = {
    background:'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:8,
    color:'var(--text)',
    fontSize:13,
    fontWeight:700,
    padding:'9px 12px',
    outline:'none',
    width:'100%',
    boxSizing:'border-box',
  };
  const selectStyle = { ...inputStyle, cursor:'pointer' };

  return (
    <div className="screen">
      <div className="page-title gradient-blue">ATHLETE PROFILE</div>
      <div className="page-sub">Your data powers every AI recommendation in the app</div>

      {/* Summary card */}
      <div className="gcard gc-blue" style={{marginBottom:14}}>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          <div style={{
            width:64,height:64,borderRadius:'50%',flexShrink:0,
            background:'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontFamily:'Bebas Neue',fontSize:24,color:'#fff',letterSpacing:2,
          }}>{initials}</div>
          <div>
            <div style={{fontFamily:'Bebas Neue',fontSize:22,letterSpacing:2,color:'var(--text)'}}>{form.firstName} {form.lastName}</div>
            <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginTop:2}}>
              {form.age} yrs · {form.heightFt}'{form.heightIn}" ({heightCm}cm) · {form.bodyweight} lbs ({weightKg}kg) · BMI {bmi}
            </div>
            <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>
              {form.goal} goal · {form.equipment} equipment
            </div>
          </div>
        </div>
      </div>

      <div className="panel-grid">

        {/* Personal Info */}
        <div className="gcard gc-blue">
          <div className="panel-header"><span className="panel-title">PERSONAL INFO</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <InputRow label="FIRST NAME">
              <input style={inputStyle} value={form.firstName} onChange={e=>set('firstName',e.target.value)}/>
            </InputRow>
            <InputRow label="LAST NAME">
              <input style={inputStyle} value={form.lastName} onChange={e=>set('lastName',e.target.value)}/>
            </InputRow>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <InputRow label="AGE">
              <input style={inputStyle} type="number" min="13" max="80" value={form.age} onChange={e=>set('age',parseInt(e.target.value)||0)}/>
            </InputRow>
            <InputRow label="GENDER">
              <select style={selectStyle} value={form.gender} onChange={e=>set('gender',e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </InputRow>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 12px'}}>
            <InputRow label="HEIGHT (FT)">
              <input style={inputStyle} type="number" min="4" max="7" value={form.heightFt} onChange={e=>set('heightFt',parseInt(e.target.value)||0)}/>
            </InputRow>
            <InputRow label="HEIGHT (IN)">
              <input style={inputStyle} type="number" min="0" max="11" value={form.heightIn} onChange={e=>set('heightIn',parseInt(e.target.value)||0)}/>
            </InputRow>
            <InputRow label="WEIGHT (LBS)">
              <input style={inputStyle} type="number" min="80" max="500" value={form.bodyweight} onChange={e=>set('bodyweight',parseInt(e.target.value)||0)}/>
            </InputRow>
          </div>
        </div>

        {/* Training Info */}
        <div className="gcard gc-purple">
          <div className="panel-header"><span className="panel-title">TRAINING INFO</span></div>
          <InputRow label="PRIMARY GOAL">
            <select style={selectStyle} value={form.goal} onChange={e=>set('goal',e.target.value)}>
              <option value="strength">Strength (1RM focus)</option>
              <option value="hypertrophy">Hypertrophy (muscle size)</option>
              <option value="powerlifting">Powerlifting (compete)</option>
              <option value="athletic">Athletic performance</option>
              <option value="recomp">Body recomposition</option>
              <option value="endurance">Strength endurance</option>
            </select>
          </InputRow>
          <InputRow label="AVAILABLE EQUIPMENT">
            <select style={selectStyle} value={form.equipment} onChange={e=>set('equipment',e.target.value)}>
              <option value="full">Full gym (rack, platform, cables)</option>
              <option value="barbell">Barbell + plates only</option>
              <option value="dumbbell">Dumbbells only</option>
              <option value="home">Home gym (limited)</option>
            </select>
          </InputRow>
          <InputRow label="INJURY NOTES (optional)">
            <input style={inputStyle} placeholder="e.g. left knee tendinitis, avoid deep squats" value={form.injuryNotes} onChange={e=>set('injuryNotes',e.target.value)}/>
          </InputRow>
        </div>

      </div>

      <button onClick={handleSave} style={{
        width:'100%',padding:'16px 0',marginTop:8,marginBottom:24,
        background: saved ? 'rgba(0,200,83,0.15)' : 'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))',
        border: saved ? '1px solid var(--neon-green)' : 'none',
        borderRadius:12,cursor:'pointer',
        fontFamily:'Bebas Neue',fontSize:18,letterSpacing:3,
        color: saved ? 'var(--neon-green)' : '#fff',
        transition:'all 0.3s',
      }}>
        {saved ? '✓ PROFILE SAVED — AI UPDATED' : 'SAVE PROFILE'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// START LIFT
// ─────────────────────────────────────────────
function StartLift({ onStart, presetLift, athlete }) {

  const lifts = [
  { name:'BACK SQUAT',  icon:'/backsquat.png',   pct:0.79, color:'blue',   rm:athlete.squat1RM },
  { name:'BENCH PRESS', icon:'/bench.png',        pct:0.72, color:'purple', rm:athlete.bench1RM },
  { name:'DEADLIFT',    icon:'/deadlift.png',     pct:0.86, color:'green',  rm:athlete.deadlift1RM },
  { name:'OHP',         icon:'/overhead.png',     pct:0.69, color:'orange', rm:athlete.ohp1RM },
  { name:'ROMANIAN DL', icon:'/deadlift.png',     pct:0.70, color:'yellow', rm:Math.round(athlete.deadlift1RM * 0.56) },
  { name:'FRONT SQUAT', icon:'/frontsquat.png',   pct:0.75, color:'teal',   rm:Math.round(athlete.squat1RM * 0.79) },
  ];

  const guessIdx = () => {
    if (!presetLift) return 0;
    const p = presetLift.toLowerCase();
    if (p.includes('deadlift') && !p.includes('romanian')) return 2;
    if (p.includes('bench'))   return 1;
    if (p.includes('ohp') || p.includes('overhead')) return 3;
    if (p.includes('romanian')) return 4;
    if (p.includes('front squat')) return 5;
    return 0;
  };

  const [sel, setSel]       = useState(guessIdx);
  const [weight, setWeight] = useState(() => { const i = guessIdx(); return Math.round(lifts[i].rm * lifts[i].pct / 5) * 5; });
  const [sets, setSets]     = useState(5);
  const [reps, setReps]     = useState(5);

  const pick = (i) => { setSel(i); setWeight(Math.round(lifts[i].rm * lifts[i].pct / 5) * 5); };
  const pct1RM = Math.round((weight / lifts[sel].rm) * 100);
  const zone = pct1RM < 70 ? '⚡ Warm-up / Technique' : pct1RM < 80 ? '💪 Hypertrophy zone (70–80%)' : pct1RM < 90 ? '🏋️ Strength zone (80–90%)' : '🔥 Max effort zone (90%+)';

  return (
    <div className="screen">
      <div className="page-title gradient-blue">START LIFT</div>
      <div className="page-sub">
        {presetLift ? `📅 Pre-filled from calendar: ${presetLift} · Adjust as needed` : 'Choose your exercise · Weight auto-sets to working % · Adjust as needed'}
      </div>
      <div className="lift-grid">
        {lifts.map((l,i) => (
          <div key={i} className={`lift-btn ${sel===i?`sel-${l.color}`:''}`} onClick={() => pick(i)}>
            <div className="lift-icon">
              <img src={l.icon} alt={l.name} style={{ width: 80, height: 80, objectFit: 'contain' }} />
            </div>
            <div className="lift-name">{l.name}</div>
            <div className="lift-pr">1RM: {l.rm} lbs</div>
          </div>
        ))}
      </div>
      <div className="gcard gc-blue">
        <div className="panel-header">
          <span className="panel-title">SET WEIGHT</span>
          <span className="badge badge-blue">{pct1RM}% of 1RM</span>
        </div>
        <div className="weight-row">
          <button className="wb wm" onClick={() => setWeight(w => Math.max(45,w-10))}>−10</button>
          <button className="wb wm" onClick={() => setWeight(w => Math.max(45,w-5))}>−5</button>
          <div className="weight-display">{weight}</div>
          <button className="wb wp" onClick={() => setWeight(w => w+5)}>+5</button>
          <button className="wb wp" onClick={() => setWeight(w => w+10)}>+10</button>
        </div>
        <div style={{textAlign:'center',fontSize:11,color:'var(--muted)',fontWeight:800,marginBottom:12}}>{zone}</div>
        <div className="pill-row">
          <span className="pill-label">SETS</span>
          {[3,4,5,6].map(v => <span key={v} className={`pill ${sets===v?'pill-active':''}`} onClick={() => setSets(v)}>{v}</span>)}
          <span className="pill-label" style={{marginLeft:12}}>REPS</span>
          {[3,4,5,6,8,10].map(v => <span key={v} className={`pill ${reps===v?'pill-active':''}`} onClick={() => setReps(v)}>{v}</span>)}
        </div>
        <button className="start-btn" onClick={() => onStart({ lift:lifts[sel].name, weight, sets, reps, rm:lifts[sel].rm })}>
          START SESSION
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LIVE SESSION
// ─────────────────────────────────────────────
function LiveSession({ session, athlete }) {
  const [repCount, setRepCount]         = useState(0);
  const [setNum, setSetNum]             = useState(1);
  const [phase, setPhase]               = useState('lifting');
  const [restTimer, setRestTimer]       = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [coachMsg, setCoachMsg]         = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [done, setDone]                 = useState(false);

  const s = session || { lift:'Back Squat', weight:225, sets:5, reps:5, rm:athlete.squat1RM };
  const baseVel = (s.weight/s.rm) > 0.85 ? 0.55 : 0.72;
  const repVels = useMemo(() =>
    Array.from({length:s.reps},(_,i) => parseFloat((baseVel - i*(baseVel*0.045)).toFixed(2))),
    [s.reps, baseVel]
  );

  const currentVel = repVels[Math.min(repCount,repVels.length-1)] || baseVel;
  const velDropoff = repCount>0 ? Math.round(((repVels[0]-currentVel)/repVels[0])*100) : 0;
  const tiltDeg    = (1.8 + repCount*0.22).toFixed(1);
  const REST_SECONDS = 180;

  const fetchCoach = useCallback(async (rep) => {
    if (rep < 1) return;
    setCoachLoading(true);
    try {
      const vel = repVels[rep-1] || currentVel;
      const msg = await getLiveCoachMessage({
        lift:s.lift, currentRep:rep, targetReps:s.reps,
        thisRepVelocity:vel, rep1Velocity:repVels[0],
        velocityDropoff:Math.round(((repVels[0]-vel)/repVels[0])*100),
        tilt:(1.8+rep*0.22).toFixed(1),
        setNumber:setNum, totalSets:s.sets, nutritionPhase:athlete.phase,
      });
      setCoachMsg(msg);
    } catch { setCoachMsg('Stay tight — drive through the heels!'); }
    setCoachLoading(false);
  }, [s, repVels, currentVel, setNum, athlete.phase]);

  useEffect(() => {
    const cl = setInterval(() => setSessionTimer(t => t+1), 1000);
    return () => clearInterval(cl);
  }, []);

  useEffect(() => {
    if (phase !== 'lifting' || done) return;
    const rt = setInterval(() => {
      setRepCount(r => {
        const next = r + 1;
        if (next <= s.reps) { fetchCoach(next); return next; }
        clearInterval(rt);
        if (setNum < s.sets) { setPhase('resting'); setRestTimer(REST_SECONDS); }
        else { setDone(true); }
        return r;
      });
    }, 2200);
    return () => clearInterval(rt);
  }, [phase, done, s, setNum, fetchCoach]);

  useEffect(() => {
    if (phase !== 'resting') return;
    if (restTimer <= 0) { setSetNum(n=>n+1); setRepCount(0); setPhase('lifting'); return; }
    const t = setTimeout(() => setRestTimer(r=>r-1), 1000);
    return () => clearTimeout(t);
  }, [phase, restTimer]);

  const sessionMins = Math.floor(sessionTimer/60);
  const sessionSecs = String(sessionTimer%60).padStart(2,'0');
  const restMins    = Math.floor(restTimer/60);
  const restSecs    = String(restTimer%60).padStart(2,'0');
  const restPct     = Math.round(((REST_SECONDS - restTimer) / REST_SECONDS) * 100);

  return (
    <div className="screen">
      <div className="page-title gradient-teal">LIVE SESSION</div>
      <div className="page-sub">{s.lift} · Set {setNum} of {s.sets} · {s.weight} lbs ({Math.round((s.weight/s.rm)*100)}% 1RM) · ⏱ {sessionMins}:{sessionSecs}</div>
      {phase === 'resting' && (
        <div className="rest-banner">
          <div className="rest-icon">⏸</div>
          <div style={{flex:1}}>
            <div className="rest-title">REST PERIOD · Set {setNum} complete</div>
            <div className="rest-countdown">{restMins}:{restSecs}</div>
            <div className="rest-bar-wrap"><div className="rest-bar-fill" style={{width:`${restPct}%`}}/></div>
            <div className="rest-sub">Next: Set {setNum+1} of {s.sets} · {REST_SECONDS}s programmed rest</div>
          </div>
          <button className="rest-skip" onClick={()=>{setSetNum(n=>n+1);setRepCount(0);setPhase('lifting');}}>Skip Rest ▶</button>
        </div>
      )}
      {done && (
        <div className="rest-banner" style={{background:'rgba(0,200,83,0.08)',borderColor:'rgba(0,200,83,0.4)'}}>
          <div className="rest-icon">🏆</div>
          <div>
            <div className="rest-title" style={{color:'var(--neon-green)'}}>SESSION COMPLETE!</div>
            <div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>All {s.sets} sets done · Head to Post-Session for your debrief</div>
          </div>
        </div>
      )}
      <div className="stat-row">
        <div className="sc sc-blue"><div className="sl">Reps</div><div className="sv">{repCount}<span className="su">/{s.reps}</span></div><div className="sd neu">{phase==='resting'?'Set done ✓':`${Math.round((repCount/s.reps)*100)}% of set`}</div></div>
        <div className="sc sc-orange"><div className="sl">Bar Velocity</div><div className="sv">{currentVel}<span className="su">m/s</span></div><div className="sd" style={{color:velDropoff>20?'var(--neon-orange)':'var(--neon-green)'}}>{velDropoff>0?`▼ ${velDropoff}% from rep 1`:'Baseline'}</div></div>
        <div className="sc sc-yellow"><div className="sl">Bar Tilt</div><div className="sv">{tiltDeg}<span className="su">°L</span></div><div className="sd" style={{color:parseFloat(tiltDeg)>2.5?'var(--neon-orange)':'var(--neon-green)'}}>{parseFloat(tiltDeg)>2.5?'Form flag':'Acceptable'}</div></div>
        <div className="sc sc-purple"><div className="sl">Session Time</div><div className="sv">{sessionMins}:{sessionSecs}</div><div className="sd neu">Total elapsed</div></div>
      </div>
      <div className="gcard gc-blue" style={{textAlign:'center',marginBottom:14}}>
        <div className="rep-counter">
          <div className={`rep-num ${phase==='resting'?'gradient-green':'gradient-teal'}`}>{phase==='resting'?'✓':repCount}</div>
          <div className="rep-label">{phase==='resting'?'SET COMPLETE — RESTING':'REPS COUNTED BY IMU SENSOR'}</div>
        </div>
        <div className="set-dots">
          {Array.from({length:s.sets}).map((_,i)=><div key={i} className={`sdot ${i===setNum-1&&phase==='lifting'?'sdot-cur':i<setNum-1||(i===setNum-1&&phase==='resting')?'sdot-done':''}`}/>)}
        </div>
        <div style={{fontSize:10,color:'var(--muted)',fontWeight:800,marginTop:4}}>SETS COMPLETED</div>
      </div>
      <div className="panel-grid">
        <div className="gcard gc-blue">
          <div className="panel-header"><span className="panel-title">REP VELOCITY</span><span className="badge badge-blue">LIVE</span></div>
          <div className="bar-chart">
            {repVels.map((v,i)=><div key={i} className={`bar ${i<repCount?(v/repVels[0]>0.85?'bar-ok':'bar-warn'):'bar-dim'}`} style={{height:`${i<repCount?Math.round((v/repVels[0])*95):15}%`}}/>)}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--muted)',marginTop:4,fontWeight:800}}>
            <span>Rep 1 · {repVels[0]} m/s</span><span>Rep {s.reps} · {repVels[s.reps-1]} m/s</span>
          </div>
        </div>
        <div className="gcard gc-orange">
          <div className="panel-header"><span className="panel-title">BAR BALANCE</span><span className="badge badge-orange">IMU · LIVE</span></div>
          <div style={{textAlign:'center',fontSize:10,color:'var(--muted)',marginBottom:6,fontWeight:800}}>LEFT ←——————→ RIGHT</div>
          <div className="tilt-track"><div className="tilt-center"/><div className="tilt-fill" style={{width:Math.round(parseFloat(tiltDeg)*8),left:`calc(50% - ${Math.round(parseFloat(tiltDeg)*8)+4}px)`}}/></div>
          <div style={{textAlign:'center',fontFamily:'Bebas Neue',fontSize:22,color:parseFloat(tiltDeg)>2.5?'var(--neon-orange)':'var(--neon-green)',letterSpacing:2,margin:'8px 0'}}>
            {tiltDeg}° {parseFloat(tiltDeg)>2.5?'LEFT ⚠️':'LEFT ✓'}
          </div>
          <div className="metric-row"><span className="mn">Left sensor</span><span className="mv" style={{color:'var(--neon-green)'}}>✓ Active</span></div>
          <div className="metric-row"><span className="mn">Right sensor</span><span className="mv" style={{color:'var(--neon-green)'}}>✓ Active</span></div>
        </div>
        <div className="gcard gc-purple panel-full">
          <div className="panel-header"><span className="panel-title">AI COACH</span><span className="badge badge-purple">Live</span></div>
          <AICard dot={coachLoading?'blue':velDropoff>20?'orange':'green'} text={coachMsg||(phase==='resting'?'Good set — rest up, next set coming.':'Waiting for first rep...')} meta={coachLoading?null:'Live coaching · updated each rep'} loading={coachLoading}/>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// POST SESSION
// ─────────────────────────────────────────────
function PostSession({ athlete }) {
  const [aiLines, setAiLines] = useState([]);
  const [loading, setLoading] = useState(false);

  const s = {
    ...FAKE_SESSION,
    nutritionPhase: athlete.phase.charAt(0).toUpperCase() + athlete.phase.slice(1),
    caloricTarget: athlete.caloricTarget,
    bodyweight: athlete.bodyweight,
    trainingAge: athlete.trainingAge,
  };

  const fetchDebrief = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getPostSessionDebrief(s);
      const lines = raw.split('\n').filter(l=>l.trim().startsWith('•')).map(l=>l.trim().replace(/^•\s*/,''));
      setAiLines(lines.length>0?lines:[raw]);
    } catch { setAiLines(['Could not reach AI — check your API key.']); }
    setLoading(false);
  }, [athlete]);

  useEffect(() => { fetchDebrief(); }, [fetchDebrief]);

  return (
    <div className="screen">
      <div className="page-title gradient-green">POST-SESSION</div>
      <div className="page-sub">{s.lift} · 5x5 @ {s.weight} lbs · {Math.round((s.weight/athlete.squat1RM)*100)}% 1RM</div>
      <div className="stat-row">
        <div className="sc sc-green"><div className="sl">Total Volume</div><div className="sv">{(s.weight*s.repsPerSet*s.setsCompleted).toLocaleString()}<span className="su">lbs</span></div><div className="sd up">▲ +{s.weight*s.repsPerSet} vs last</div></div>
        <div className="sc sc-blue"><div className="sl">Avg Velocity</div><div className="sv">{s.avgVelocity}<span className="su">m/s</span></div><div className="sd up">▲ +0.03 vs last</div></div>
        <div className="sc sc-yellow"><div className="sl">Vel Dropoff</div><div className="sv">{s.velocityDropoff}<span className="su">%</span></div><div className="sd" style={{color:s.velocityDropoff>20?'var(--neon-orange)':'var(--neon-green)'}}>{s.velocityDropoff>20?'Fatigue detected':'Within range'}</div></div>
        <div className="sc sc-orange"><div className="sl">Avg Tilt</div><div className="sv">{s.avgTilt}<span className="su">°L</span></div><div className="sd dn">Persistent</div></div>
      </div>
      <div className="gcard gc-blue" style={{marginBottom:14}}>
        <div className="panel-header"><span className="panel-title">VELOCITY PER REP</span><span className="badge badge-blue">Set 1 of 5</span></div>
        <div className="bar-chart" style={{height:80}}>
          {s.repVelocities.map((v,i)=>(
            <div key={i} className={`bar ${v/s.repVelocities[0]>0.85?'bar-ok':'bar-warn'}`} style={{height:`${Math.round((v/s.repVelocities[0])*95)}%`,position:'relative'}}>
              <span style={{position:'absolute',top:-16,left:'50%',transform:'translateX(-50%)',fontSize:8,fontWeight:800,color:'var(--muted)',whiteSpace:'nowrap'}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--muted)',marginTop:4,fontWeight:800}}>
          {s.repVelocities.map((_,i)=><span key={i}>Rep {i+1}</span>)}
        </div>
      </div>
      <div className="gcard gc-green">
        <div className="panel-header">
          <span className="panel-title">AI DEBRIEF</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span className="badge badge-green">AI</span>
            <button className="refresh-btn" onClick={fetchDebrief} disabled={loading}>↺ Refresh</button>
          </div>
        </div>
        {loading
          ? <AICard dot="blue" text="" loading={true}/>
          : aiLines.map((line,i)=><AICard key={i} dot={i===0?'green':i===1?'orange':'blue'} text={line} meta={i===0?'Performance':i===1?'Form analysis':'Next session'}/>)
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────
function CalendarScreen({ schedule, setSchedule, onStartFromCalendar, athlete }) {
  const [phase, setPhase]         = useState(athlete.phase);
  const [blocked, setBlocked]     = useState(new Set());
  const [periodDays, setPeriodDays] = useState({}); // { dateKey: 'spotting'|'light'|'medium'|'heavy' }
  const [modalDay, setModalDay]   = useState(null);
  const [notif, setNotif]         = useState(null);
  const [aiLines, setAiLines]     = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const today = new Date(); today.setHours(0,0,0,0);
  const currentMonth = today.getMonth();
  const currentYear  = today.getFullYear();

  const showNotif = msg => { setNotif(msg); setTimeout(()=>setNotif(null),5000); };

  const fetchCalAI = useCallback(async (p, bl) => {
    setAiLoading(true);
    try {
      const upcoming = schedule.filter(d=>!d.rest&&d.lift).slice(0,4).map(d=>d.lift).join(', ');
      const raw = await getCalendarAdjustment({
        phase:p, phaseWeek:athlete.phaseWeek, phaseTotalWeeks:athlete.phaseTotalWeeks,
        avgFatigue:FAKE_SESSION.fatigueIndex, avgVelocityDropoff:FAKE_SESSION.velocityDropoff,
        tiltIssue:FAKE_SESSION.avgTilt>2.0, avgTilt:FAKE_SESSION.avgTilt,
        blockedDays:bl.size, caloricDelta:p==='bulk'?'+350':p==='cut'?'-300':'0',
        bodyweightTrend:p==='bulk'?'gaining ~0.5 lbs/week':'losing ~0.75 lbs/week',
        upcomingSchedule: upcoming,
      });
      const lines = raw.split('\n').filter(l=>l.trim().startsWith('•')).map(l=>l.trim().replace(/^•\s*/,''));
      setAiLines(lines.length>0?lines:[raw]);
    } catch { setAiLines(['Could not reach AI — check your API key.']); }
    setAiLoading(false);
  }, [schedule, athlete]);

  useEffect(()=>{ fetchCalAI(phase, new Set()); },[fetchCalAI]);

  const toggleBlock = dayKey => {
    const nb = new Set(blocked);
    if(nb.has(dayKey)){nb.delete(dayKey);showNotif('Day unblocked.');}
    else{nb.add(dayKey);showNotif('Day blocked. AI updating your plan...');}
    setBlocked(nb); fetchCalAI(phase,nb);
  };

  const handleFlowSelect = (dateKey, flow, dayLift) => {
    const updated = { ...periodDays, [dateKey]: flow };
    setPeriodDays(updated);
    // Heavy flow + leg-dominant lift → auto-swap to light upper body
    if (flow === 'heavy' && dayLift && /squat|deadlift|leg/i.test(dayLift)) {
      setSchedule(prev => prev.map(d =>
        d.dateKey === dateKey
          ? {
              ...d,
              lift: 'Upper Body (light)',
              type: 'hypertrophy',
              reason: 'Auto-adjusted: heavy flow day — lower body work moved to light upper body. Prioritize recovery and comfort.',
              nutr: d.nutr + ' Iron-rich foods recommended today (spinach, red meat, lentils).',
            }
          : d
      ));
      showNotif('Heavy flow detected — leg day swapped to light upper body 💪');
    }
  };

  const getDayBg = d => d.rest?'cal-rest-bg':phase==='bulk'?'cal-bulk-bg':phase==='cut'?'cal-cut-bg':'cal-maintain-bg';
  const phaseCalLabel = phase==='cut'?'pill-cut-cal':'pill-bulk-cal';
  const firstDayOfWeek = schedule[0]?.weekday ?? 0;

  return (
    <div className="screen">
      <div className="page-title gradient-purple">TRAINING CALENDAR</div>
      <div className="page-sub">{MONTH_NAMES[currentMonth]} {currentYear} · Tap any day for AI reasoning · ✕ to block · 🏋️ to start</div>
      <div className="phase-toggle">
        <span style={{fontSize:11,fontWeight:800,color:'var(--muted)'}}>CYCLE:</span>
        {[['bulk','ptog-bulk','🟢 BULKING'],['cut','ptog-cut','🔶 CUTTING'],['maintain','ptog-maintain','🔵 MAINTAIN']].map(([p,cls,lbl])=>(
          <button key={p} className={`ptog ${cls} ${phase===p?'ptog-active':''}`}
            onClick={()=>{setPhase(p);showNotif(`Switched to ${p} — AI updating...`);fetchCalAI(p,blocked);}}>
            {lbl}
          </button>
        ))}
        <span style={{fontSize:11,fontWeight:800,color:'var(--muted)',marginLeft:8}}>Wk {athlete.phaseWeek}/{athlete.phaseTotalWeeks}</span>
      </div>
      {notif&&<div className="notification"><div className="notif-icon">🤖</div><div><div className="notif-text">{notif}</div><div className="notif-sub">AI updated your plan · tap any day to review</div></div></div>}
      {schedule.some(d=>d._coachRebuilt)&&(
        <div className="notification" style={{background:'rgba(255,0,102,0.06)',borderColor:'rgba(255,0,102,0.25)'}}>
          <div className="notif-icon">🤖</div>
          <div>
            <div className="notif-text" style={{color:'var(--neon-pink)'}}>AI Coach rebuilt your full schedule</div>
            <div className="notif-sub">Pink days were changed · tap any day to see reasoning</div>
          </div>
        </div>
      )}
      <div className={`phase-banner ${phase==='bulk'?'bulk-banner':phase==='cut'?'cut-banner':'maintain-banner'}`}>
        <div>
          <div style={{fontFamily:'Bebas Neue',fontSize:20,letterSpacing:2,color:phase==='bulk'?'var(--neon-green)':phase==='cut'?'var(--neon-orange)':'var(--neon-blue)'}}>
            {phase.toUpperCase()} PHASE · WK {athlete.phaseWeek}/{athlete.phaseTotalWeeks}
          </div>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>
            Today: {DAY_NAMES[today.getDay()]} {MONTH_NAMES[currentMonth]} {today.getDate()} · {phase==='bulk'?'+350':phase==='cut'?'-300':'0'} kcal daily
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:10,color:'var(--muted)',fontWeight:800}}>NEXT PHASE</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:18,color:'var(--neon-yellow)',letterSpacing:1}}>{phase==='bulk'?'CUT':'BULK'} · +12 DAYS</div>
        </div>
      </div>
      <div className="legend-row">
        {[
          ['rgba(124,0,255,0.5)','Lift'],
          ['rgba(0,200,83,0.5)','Bulk'],
          ['rgba(255,98,0,0.5)','Cut'],
          ['rgba(200,200,200,0.7)','Rest'],
          ['rgba(0,149,255,0.5)','Today'],
          ['rgba(255,0,102,0.4)','Blocked'],
          ...(athlete.gender==='female' ? [['rgba(255,0,102,0.6)','Period']] : []),
        ].map(([bg,lbl])=>(
          <div key={lbl} className="leg-item"><div className="leg-dot" style={{background:bg}}/>{lbl}</div>
        ))}
      </div>
      <div className="gcard gc-purple" style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontFamily:'Bebas Neue',fontSize:20,letterSpacing:2,color:'var(--text)'}}>{MONTH_NAMES[currentMonth].toUpperCase()} {currentYear}</div>
          <span style={{fontSize:10,color:'var(--muted)',fontWeight:800}}>Tap day · ✕ block · 🏋️ start</span>
        </div>
        <div className="cal-grid">
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d=><div key={d} className="cal-dh">{d}</div>)}
          {Array.from({length:firstDayOfWeek}).map((_,i)=><div key={`e${i}`} className="cal-empty"/>)}
          {schedule.map(day=>{
            const isBlocked = blocked.has(day.dateKey);
            const wtype = day.type ? WORKOUT_TYPES[day.type] : null;
            const isPeriod = !!periodDays[day.dateKey];
            const periodFlow = periodDays[day.dateKey];
            return (
              <div key={day.dateKey}
                className={`cal-day ${getDayBg(day)} ${day.today?'cal-today':''} ${isBlocked?'cal-blocked':''}`}
                style={isPeriod ? {outline:'2px solid rgba(255,0,102,0.4)'} : {}}
                onClick={()=>!isBlocked&&setModalDay(day)}>
                <div className={`cal-num ${day.today?'cal-num-today':''}`}>
                  {day.dayNum}{day.today&&<span style={{fontSize:7,color:'var(--neon-blue)',marginLeft:3,fontWeight:900}}>TODAY</span>}
                </div>
                {isBlocked
                  ?<span className="cpill pill-blocked">BLOCKED</span>
                  :day.lift
                  ?<span className="cpill pill-lift" style={day._coachRebuilt?{background:'rgba(255,0,102,0.15)',color:'var(--neon-pink)'}:{}}>{day._coachRebuilt?'🤖 ':''}{day.lift}</span>
                  :<span className="cpill pill-rest-cal">{day._coachRebuilt?'🤖 Rest':'Rest'}</span>}
                {!isBlocked&&day.cal&&<span className={`cpill ${phaseCalLabel}`}>{day.cal} kcal</span>}
                {!isBlocked&&wtype&&<span className="cpill" style={{background:wtype.bg,color:wtype.color,fontSize:7}}>{wtype.label}</span>}
                {/* Period pill on tile */}
                {athlete.gender==='female'&&isPeriod&&(
                  <span className={`cpill ${periodFlow==='heavy'?'cpill-period-heavy':'cpill-period'}`}>
                    🩸 {periodFlow}
                  </span>
                )}
                {!isBlocked&&day.lift&&(
                  <button className="cal-start-btn" title="Start this lift" onClick={e=>{e.stopPropagation();onStartFromCalendar(day.lift);}}>🏋️</button>
                )}
                <button className={`block-btn ${isBlocked?'block-btn-blocked':''}`} onClick={e=>{e.stopPropagation();toggleBlock(day.dateKey);}}>
                  {isBlocked?'↩':'✕'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className="gcard gc-blue">
        <div className="panel-header">
          <span className="panel-title">AI SCHEDULE RECOMMENDATION</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span className="badge badge-purple">AI</span>
            <button className="refresh-btn" onClick={()=>fetchCalAI(phase,blocked)} disabled={aiLoading}>↺ Refresh</button>
          </div>
        </div>
        {aiLoading?<AICard dot="blue" text="" loading={true}/>
          :aiLines.map((line,i)=><AICard key={i} dot={i===0?'green':i===1?'blue':'orange'} text={line} meta={i===0?'Load recommendation':i===1?'Exercise adjustment':'Recovery priority'}/>)}
      </div>

      {/* ── DAY MODAL ── */}
      {modalDay&&(
        <div className="modal-overlay" onClick={e=>e.target.classList.contains('modal-overlay')&&setModalDay(null)}>
          <div className="modal">
            <h2>{modalDay.lift||'REST DAY'}</h2>
            <div className="modal-sub">
              {DAY_NAMES[modalDay.weekday]} · {MONTH_NAMES[modalDay.month]} {modalDay.dayNum}, {modalDay.year}
              {modalDay.today?' · TODAY':''} · {phase.charAt(0).toUpperCase()+phase.slice(1)} Phase
            </div>
            {modalDay.type&&(()=>{const wt=WORKOUT_TYPES[modalDay.type];return<span className="why-tag" style={{background:wt.bg,borderColor:wt.border,color:wt.color}}>{wt.label}</span>;})()}
            <div className="reason-block"><div className="reason-label">WHY THIS IS SCHEDULED</div><div className="reason-text">{modalDay.reason}</div></div>
            <div className="reason-block"><div className="reason-label">NUTRITION CONTEXT</div><div className="reason-text">{modalDay.nutr}</div></div>

            {/* ── PERIOD SECTION (female only) ── */}
            {athlete.gender === 'female' && (
              <div className="period-section">
                <div className="period-section-title">🩸 CYCLE TRACKING</div>
                {periodDays[modalDay.dateKey] ? (
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--neon-pink)',marginBottom:8}}>
                      Period day logged · tap flow to update:
                    </div>
                    <div className="flow-row">
                      {[
                        ['spotting','💧 Spotting','flow-spotting'],
                        ['light',   '🟡 Light',   'flow-light'   ],
                        ['medium',  '🟠 Medium',  'flow-medium'  ],
                        ['heavy',   '🔴 Heavy',   'flow-heavy'   ],
                      ].map(([f,lbl,cls])=>(
                        <button key={f}
                          className={`flow-btn ${cls} ${periodDays[modalDay.dateKey]===f?'flow-active':''}`}
                          onClick={()=>handleFlowSelect(modalDay.dateKey, f, modalDay.lift)}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <button
                      style={{marginTop:10,fontSize:11,fontWeight:800,color:'var(--muted)',background:'none',border:'none',cursor:'pointer',padding:0}}
                      onClick={()=>setPeriodDays(p=>{ const n={...p}; delete n[modalDay.dateKey]; return n; })}>
                      ✕ Remove period log
                    </button>
                  </>
                ) : (
                  <button className="period-btn" style={{width:'100%'}}
                    onClick={()=>setPeriodDays(p=>({...p,[modalDay.dateKey]:'medium'}))}>
                    🩸 Log as Period Day
                  </button>
                )}
              </div>
            )}

            <div className="modal-btns">
              <button className="mbtn mbtn-close" onClick={()=>setModalDay(null)}>Close</button>
              <button className="mbtn mbtn-block" onClick={()=>{toggleBlock(modalDay.dateKey);setModalDay(null);}}>✕ Block Day</button>
              {modalDay.lift&&(
                <button className="mbtn mbtn-swap"
                  style={{background:'rgba(0,200,83,0.1)',borderColor:'rgba(0,200,83,0.4)',color:'var(--neon-green)'}}
                  onClick={()=>{onStartFromCalendar(modalDay.lift);setModalDay(null);}}>
                  🏋️ Start This Lift
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AI COACH
// ─────────────────────────────────────────────
function AICoach({ schedule, onRebuildSchedule, onGoToCalendar, athlete }) {
  const [messages, setMessages] = useState([
    {role:'assistant', content:`Hey ${athlete.firstName}! I'm your Coach Nova. I know your full training history — squats, bench, deads, everything. What's on your mind? Tell me about life, training, goals — anything that affects your schedule and I'll adjust it in real time.`}
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  const athleteContext = `
Athlete: ${athlete.name} | Age: ${athlete.age} | Gender: ${athlete.gender}
Height: ${athlete.heightFt}'${athlete.heightIn}" | Bodyweight: ${athlete.bodyweight} lbs | Training age: ${athlete.trainingAge} yrs
Phase: ${athlete.phase} | Phase week: ${athlete.phaseWeek}/${athlete.phaseTotalWeeks}
Goal: ${athlete.goal} | Equipment: ${athlete.equipment} | Days/week: ${athlete.daysPerWeek}
1RMs — Squat: ${athlete.squat1RM} lbs | Bench: ${athlete.bench1RM} lbs | Deadlift: ${athlete.deadlift1RM} lbs | OHP: ${athlete.ohp1RM} lbs
Last session: ${FAKE_SESSION.lift} @ ${FAKE_SESSION.weight} lbs, 5x5, velocity dropoff ${FAKE_SESSION.velocityDropoff}%, fatigue ${FAKE_SESSION.fatigueIndex}%
Bar tilt: ${FAKE_SESSION.avgTilt}° left (persistent, 3 sessions) | Caloric target: ${athlete.caloricTarget} kcal/day
${athlete.injuryNotes ? `Injury notes: ${athlete.injuryNotes}` : ''}
`.trim();

  const scheduleForPrompt = schedule.map(d => ({
    dateLabel: d.dateLabel,
    weekday: DAY_NAMES[d.weekday],
    lift: d.lift,
    rest: d.rest,
  }));

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role:'user', content:input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    try {
      const apiHistory = newHistory.map(m=>({role:m.role,content:m.content}));
      const result = await getChatCoachReply(apiHistory, athleteContext, scheduleForPrompt);
      const { reply, newSchedule } = result;
      if (newSchedule && newSchedule.length > 0) onRebuildSchedule(newSchedule);
      setMessages(h=>[...h,{role:'assistant',content:reply,scheduleRebuilt:!!(newSchedule&&newSchedule.length>0)}]);
    } catch {
      setMessages(h=>[...h,{role:'assistant',content:'Connection issue — check your API key and try again.'}]);
    }
    setLoading(false);
  };

  const handleKey = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} };

  const quickPrompts = [
    "Just got a girlfriend, gym time might drop 👀",
    "Feeling overtrained this week",
    "Want to skip leg day this week",
    "Add more squat volume to my program",
    "Traveling next week, no gym access",
    "I'm injured — sore lower back",
  ];

  return (
    <div className="screen">
      <div className="page-title gradient-pink">AI COACH</div>
      <div className="page-sub">Tell me anything — I'll adjust your calendar in real time</div>
      <div className="coach-context-bar">
        <div className="coach-ctx-item"><span className="coach-ctx-label">PHASE</span><span className="coach-ctx-val">{athlete.phase.charAt(0).toUpperCase()+athlete.phase.slice(1)} Wk {athlete.phaseWeek}</span></div>
        <div className="coach-ctx-item"><span className="coach-ctx-label">SQUAT 1RM</span><span className="coach-ctx-val">{athlete.squat1RM} lbs</span></div>
        <div className="coach-ctx-item"><span className="coach-ctx-label">LAST FATIGUE</span><span className="coach-ctx-val" style={{color:FAKE_SESSION.fatigueIndex>30?'var(--neon-orange)':'var(--neon-green)'}}>{FAKE_SESSION.fatigueIndex}%</span></div>
        <div className="coach-ctx-item"><span className="coach-ctx-label">GOAL</span><span className="coach-ctx-val">{athlete.goal}</span></div>
        <button className="cal-peek-btn" onClick={onGoToCalendar}>📅 View Calendar</button>
      </div>
      <div className="quick-prompts">
        {quickPrompts.map((p,i)=><button key={i} className="qprompt" onClick={()=>setInput(p)}>{p}</button>)}
      </div>
      <div className="chat-window">
        {messages.map((m,i)=>(
          <div key={i}>
            <div className={`chat-bubble ${m.role==='user'?'bubble-user':'bubble-ai'}`}>
              {m.role==='assistant'&&<div className="bubble-avatar">BB</div>}
              <div className={`bubble-text ${m.role==='user'?'bubble-text-user':'bubble-text-ai'}`}>{m.content}</div>
            </div>
            {m.role==='assistant'&&m.scheduleRebuilt&&(
              <div className="patch-confirm">
                <span className="patch-confirm-icon">📅</span>
                <span className="patch-confirm-text">Calendar fully rebuilt — check your new schedule</span>
                <button className="patch-confirm-btn" onClick={onGoToCalendar}>See changes →</button>
              </div>
            )}
          </div>
        ))}
        {loading&&(
          <div className="chat-bubble bubble-ai">
            <div className="bubble-avatar">BB</div>
            <div className="bubble-text bubble-text-ai">
              <div className="ai-loading"><div className="ai-spinner"/><span style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>Coach is thinking...</span></div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="chat-input-row">
        <textarea className="chat-input" rows={2}
          placeholder="Talk to your coach... 'I'm exhausted' · 'skip squats this week' · 'add more volume'"
          value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}/>
        <button className="chat-send" onClick={send} disabled={loading||!input.trim()}>SEND</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// NUTRITION
// ─────────────────────────────────────────────
function Nutrition({ athlete }) {
  const [surplus, setSurplus]     = useState(athlete.phase==='bulk'?350:athlete.phase==='cut'?-300:0);
  const [aiLines, setAiLines]     = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const bw = athlete.bodyweight;
  const caloricTarget = surplus>100?Math.round(bw*17+surplus):surplus<-100?Math.round(bw*13+Math.abs(surplus)):Math.round(bw*15);
  const proteinTarget = bw;
  const fatTarget     = Math.round(bw*0.4);
  const carbTarget    = Math.round((caloricTarget-proteinTarget*4-fatTarget*9)/4);
  const protein = Math.round(proteinTarget*0.92);
  const carbs   = Math.round(carbTarget*0.89);
  const fat     = Math.round(fatTarget*0.85);
  const logged  = protein*4+carbs*4+fat*9;

  const getInfo = v => {
    if(v>100)  return {label:`+${v} KCAL SURPLUS`, tip:'Building muscle', color:'var(--neon-green)',  badge:'BULK',    cls:'badge-green'};
    if(v<-100) return {label:`${Math.abs(v)} KCAL DEFICIT`, tip:'Fat loss phase', color:'var(--neon-orange)', badge:'CUT', cls:'badge-orange'};
    return            {label:'MAINTENANCE', tip:'Body recomposition', color:'var(--neon-blue)', badge:'MAINTAIN', cls:'badge-blue'};
  };
  const info = getInfo(surplus);

  const fetchNutrAI = useCallback(async () => {
    setAiLoading(true);
    try {
      const raw = await getNutritionAdvice({
        phase:surplus>100?'Bulk':surplus<-100?'Cut':'Maintenance',
        caloricTarget, caloriesLogged:logged,
        protein, proteinTarget, carbs, carbTarget, fat, fatTarget,
        todaysLift:'Squat 5x5 @ 225 lbs',
        lastFatigue:FAKE_SESSION.fatigueIndex,
        bodyweight:bw, phaseWeek:athlete.phaseWeek, phaseTotalWeeks:athlete.phaseTotalWeeks,
      });
      const lines = raw.split('\n').filter(l=>l.trim().startsWith('•')).map(l=>l.trim().replace(/^•\s*/,''));
      setAiLines(lines.length>0?lines:[raw]);
    } catch { setAiLines(['Could not reach AI — check your API key.']); }
    setAiLoading(false);
  },[surplus,caloricTarget,logged,protein,proteinTarget,carbs,carbTarget,fat,fatTarget,bw,athlete]);

  useEffect(()=>{fetchNutrAI();},[fetchNutrAI]);

  return (
    <div className="screen">
      <div className="page-title gradient-orange">NUTRITION</div>
      <div className="page-sub">Slide your phase · Targets auto-calculate from bodyweight ({bw} lbs)</div>
      <div className="gcard gc-green" style={{marginBottom:14}}>
        <div className="panel-header"><span className="panel-title">PHASE DIAL</span><span className={`badge ${info.cls}`}>{info.badge}</span></div>
        <div className="phase-labels"><span className="phase-cut">◀ CUTTING</span><span style={{color:'var(--muted)',fontSize:10,fontWeight:800}}>MAINTENANCE</span><span className="phase-bulk">BULKING ▶</span></div>
        <input type="range" className="phase-slider" min="-500" max="500" value={surplus} step="50" onChange={e=>setSurplus(parseInt(e.target.value))}/>
        <div className="phase-result" style={{color:info.color}}>{info.label}</div>
        <div style={{textAlign:'center',fontSize:11,color:'var(--muted)',marginTop:4,fontWeight:700}}>{info.tip} · {caloricTarget} kcal target</div>
      </div>
      <div className="stat-row">
        <div className="sc sc-orange"><div className="sl">Target Kcal</div><div className="sv">{caloricTarget.toLocaleString()}<span className="su">kcal</span></div><div className="sd" style={{color:Math.abs(logged-caloricTarget)<200?'var(--neon-green)':'var(--neon-orange)'}}>{logged} logged</div></div>
        <div className="sc sc-purple"><div className="sl">Protein</div><div className="sv">{protein}<span className="su">g</span></div><div className="sd" style={{color:protein/proteinTarget>0.9?'var(--neon-green)':'var(--neon-orange)'}}>Target: {proteinTarget}g</div></div>
        <div className="sc sc-blue"><div className="sl">Carbs</div><div className="sv">{carbs}<span className="su">g</span></div><div className="sd" style={{color:carbs/carbTarget>0.85?'var(--neon-green)':'var(--neon-orange)'}}>Target: {carbTarget}g</div></div>
        <div className="sc sc-green"><div className="sl">Fat</div><div className="sv">{fat}<span className="su">g</span></div><div className="sd" style={{color:fat/fatTarget>0.8?'var(--neon-green)':'var(--neon-orange)'}}>Target: {fatTarget}g</div></div>
      </div>
      <div className="panel-grid">
        <div className="gcard gc-orange">
          <div className="panel-header"><span className="panel-title">QUICK LOG</span></div>
          <div className="quick-log">
            {[['Breakfast','✓ 820 kcal',true],['Lunch','✓ 1,050 kcal',true],['Pre-workout','✓ 340 kcal',true],['Dinner','+ Add meal',false]].map(([label,val,done])=>(
              <button key={label} className="qb" style={done?{}:{borderStyle:'dashed'}}>
                <span className="ql">{label}</span><span className="qv" style={{color:done?'var(--neon-green)':'var(--muted)'}}>{val}</span>
              </button>
            ))}
          </div>
          <div className="macro-grid">
            {[[`${protein}g`,'Protein','var(--neon-orange)',Math.round(protein/proteinTarget*100)],[`${carbs}g`,'Carbs','var(--neon-blue)',Math.round(carbs/carbTarget*100)],[`${fat}g`,'Fat','var(--neon-purple)',Math.round(fat/fatTarget*100)]].map(([v,l,c,pct])=>(
              <div key={l} className="macro-card">
                <div className="macro-val" style={{color:c}}>{v}</div>
                <div className="macro-label">{l}</div>
                <div style={{fontSize:9,color:'var(--muted)',marginBottom:4,fontWeight:700}}>{pct}%</div>
                <div className="macro-bar-wrap"><div className="macro-bar" style={{width:`${Math.min(pct,100)}%`,background:c}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="gcard gc-purple">
          <div className="panel-header">
            <span className="panel-title">AI NUTRITION</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span className="badge badge-purple">AI</span>
              <button className="refresh-btn" onClick={fetchNutrAI} disabled={aiLoading}>↺ Refresh</button>
            </div>
          </div>
          {aiLoading?<AICard dot="blue" text="" loading={true}/>
            :aiLines.map((line,i)=><AICard key={i} dot={i===0?'green':'blue'} text={line} meta={i===0?"Today's advice":'Phase strategy'}/>)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROGRESS
// ─────────────────────────────────────────────
function Progress({ athlete }) {
  const lifts = [
    {name:'SQUAT',   color:'blue',  data:[195,200,205,210,215,220,222,225],dates:['Jan 6','Mar 13'],pr:athlete.squat1RM},
    {name:'BENCH',   color:'purple',data:[170,172,175,175,177,180,182,185],dates:['Jan 8','Mar 11'],pr:athlete.bench1RM},
    {name:'DEADLIFT',color:'green', data:[285,295,300,305,305,310,315,315],dates:['Jan 7','Mar 13'],pr:athlete.deadlift1RM},
    {name:'OHP',     color:'orange',data:[110,111,112,113,115,118,120,122],dates:['Jan 9','Mar 10'],pr:athlete.ohp1RM},
  ];
  return (
    <div className="screen">
      <div className="page-title gradient-pink">PROGRESS</div>
      <div className="page-sub">8 sessions each · {athlete.phase.charAt(0).toUpperCase()+athlete.phase.slice(1)} phase Wk {athlete.phaseWeek}/{athlete.phaseTotalWeeks}</div>
      <div className="stat-row">
        <div className="sc sc-blue"><div className="sl">Squat</div><div className="sv">225<span className="su">lbs</span></div><div className="sd up">▲ +30 lbs</div></div>
        <div className="sc sc-purple"><div className="sl">Bench</div><div className="sv">185<span className="su">lbs</span></div><div className="sd up">▲ +15 lbs</div></div>
        <div className="sc sc-green"><div className="sl">Deadlift</div><div className="sv">315<span className="su">lbs</span></div><div className="sd up">▲ +30 lbs</div></div>
        <div className="sc sc-orange"><div className="sl">OHP</div><div className="sv">122<span className="su">lbs</span></div><div className="sd up">▲ +12 lbs</div></div>
      </div>
      <div className="panel-grid">
        {lifts.map(l=>{
          const max=Math.max(...l.data);
          const gain=l.data[l.data.length-1]-l.data[0];
          const pct=Math.round((l.data[l.data.length-1]/l.pr)*100);
          return(
            <div key={l.name} className={`gcard gc-${l.color}`}>
              <div className="panel-header"><span className="panel-title">{l.name}</span><span className={`badge badge-${l.color}`}>+{gain} lbs · {pct}% 1RM</span></div>
              <div className="bar-chart" style={{height:90}}>
                {l.data.map((v,i)=>{
                  const isLatest=i===l.data.length-1;
                  return(
                    <div key={i} className={`bar bar-${isLatest?l.color:'dim'}`} style={{height:`${Math.round((v/max)*92)}%`,opacity:isLatest?1:0.4+i*0.08,position:'relative'}}>
                      {isLatest&&<span style={{position:'absolute',top:-16,left:'50%',transform:'translateX(-50%)',fontSize:8,fontWeight:900,color:`var(--neon-${l.color})`,whiteSpace:'nowrap'}}>{v}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--muted)',marginTop:4,fontWeight:800}}><span>{l.dates[0]}</span><span>{l.dates[1]}</span></div>
            </div>
          );
        })}
      </div>
      <div className="gcard gc-green">
        <div className="panel-header"><span className="panel-title">CYCLE SUMMARY</span><span className="badge badge-green">Wk {athlete.phaseWeek}</span></div>
        <div className="ai-card"><div className="ai-dot dot-green"/><div><div className="at">Squat on track for 245 lb working max by end of bulk — 3 sessions away at current rate.</div><div className="am">8-session trend projection</div></div></div>
        <div className="ai-card"><div className="ai-dot dot-blue"/><div><div className="at">Deadlift velocity holding above 0.58 m/s at 86% 1RM — strength adaptation occurring normally.</div><div className="am">IMU velocity trend</div></div></div>
        <div className="ai-card"><div className="ai-dot dot-orange"/><div><div className="at">OHP progressing slower than target (1.5 vs 2 lbs/week). Coach Chat can help re-plan.</div><div className="am">Lagging lift flag</div></div></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [athlete, setAthlete]       = useState(DEFAULT_ATHLETE);
  const [screen, setScreen]         = useState('setup');
  const [session, setSession]       = useState(null);
  const [presetLift, setPresetLift] = useState(null);
  const [schedule, setSchedule]     = useState(() => buildSchedule(DEFAULT_ATHLETE));

  const handleSaveProfile = useCallback((updated) => {
    setAthlete(updated);
    setSchedule(buildSchedule(updated));
  }, []);

  const handleStartFromCalendar = (liftName) => {
    setPresetLift(liftName);
    setScreen('setup');
  };

  const rebuildSchedule = useCallback((newDays) => {
    if (!newDays || newDays.length === 0) return;
    setSchedule(prev => newDays.slice(0,14).map((gptDay,i) => ({
      ...prev[i],
      lift:   gptDay.lift   ?? null,
      type:   gptDay.type   ?? null,
      cal:    gptDay.cal    ?? '+200',
      rest:   gptDay.rest   ?? false,
      reason: gptDay.reason ?? prev[i]?.reason ?? '',
      nutr:   gptDay.nutr   ?? prev[i]?.nutr   ?? '',
      _coachRebuilt: true,
    })));
  }, []);

  const initials = `${athlete.firstName?.[0]??'?'}${athlete.lastName?.[0]??'?'}`.toUpperCase();

  const navItems = [
    {id:'setup',    label:'Start Lift',  icon:'⊕', group:'TRAIN'},
    {id:'live',     label:'Live Session',icon:'◉', group:'TRAIN'},
    {id:'analysis', label:'Post-Session',icon:'◈', group:'TRAIN'},
    {id:'coach',    label:'AI Coach',    icon:'💬', group:'TRAIN'},
    {id:'calendar', label:'Calendar',    icon:'◫', group:'PLAN'},
    {id:'nutrition',label:'Nutrition',   icon:'◑', group:'PLAN'},
    {id:'progress', label:'Progress',    icon:'◬', group:'TRACK'},
  ];

  return (
    <div className="app">
      <nav className="topnav">
        <div className="logo" style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logo.png" alt="Coach Nova" style={{width:36,height:36,objectFit:'contain'}}/>
          COACH<span>NOVA</span>
        </div>
        <div className="nav-right">
          <div className="imu-chip"><div className="pulse-dot"/>IMU L+R LIVE</div>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:800}}>200Hz · Sync 4ms</div>
        </div>
      </nav>
      <div className="layout">
        <aside className="sidebar">
          {['TRAIN','PLAN','TRACK'].map(g=>(
            <React.Fragment key={g}>
              <div className="nav-sect">{g}</div>
              {navItems.filter(n=>n.group===g).map(n=>(
                <div key={n.id} className={`nav-item ${screen===n.id?'nav-active':''}`} onClick={()=>setScreen(n.id)}>
                  <span className="ni">{n.icon}</span>{n.label}
                </div>
              ))}
            </React.Fragment>
          ))}
          <div className="sidebar-footer">
            <div
              className="user-chip"
              onClick={()=>setScreen('profile')}
              style={{cursor:'pointer', borderRadius:10, outline: screen==='profile'?'1px solid var(--neon-blue)':'none'}}
            >
              <div className="avatar" style={{
                background: screen==='profile'
                  ? 'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))'
                  : undefined,
              }}>{initials}</div>
              <div>
                <div className="user-name">{athlete.name}</div>
                <div className="user-sub">{athlete.phase.charAt(0).toUpperCase()+athlete.phase.slice(1)} · Wk {athlete.phaseWeek} · Tap to edit</div>
              </div>
            </div>
          </div>
        </aside>
        <main className="main-content">
          {screen==='setup'     && <StartLift     onStart={s=>{setSession(s);setScreen('live');}} presetLift={presetLift} athlete={athlete}/>}
          {screen==='live'      && <LiveSession    session={session} athlete={athlete}/>}
          {screen==='analysis'  && <PostSession    athlete={athlete}/>}
          {screen==='coach'     && <AICoach        schedule={schedule} onRebuildSchedule={rebuildSchedule} onGoToCalendar={()=>setScreen('calendar')} athlete={athlete}/>}
          {screen==='calendar'  && <CalendarScreen schedule={schedule} setSchedule={setSchedule} onStartFromCalendar={handleStartFromCalendar} athlete={athlete}/>}
          {screen==='nutrition' && <Nutrition      athlete={athlete}/>}
          {screen==='progress'  && <Progress       athlete={athlete}/>}
          {screen==='profile'   && <ProfileScreen  athlete={athlete} onSave={handleSaveProfile}/>}
        </main>
      </div>
    </div>
  );
}
