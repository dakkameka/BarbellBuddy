// ─────────────────────────────────────────────
// BarbellBuddy · OpenAI Service
// Paste your key below. Never commit to GitHub.
// ─────────────────────────────────────────────

const OPENAI_API_KEY = ''; // ← paste your key here
const MODEL = 'gpt-4o-mini';

async function askGPT(systemPrompt, userPrompt, conversationHistory = []) {
  const messages = conversationHistory.length > 0
    ? [{ role: 'system', content: systemPrompt }, ...conversationHistory]
    : [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      temperature: 0.7,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'OpenAI API error');
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── POST-SESSION DEBRIEF ──────────────────────
export async function getPostSessionDebrief(s) {
  const system = `You are an expert strength coach analyzing barbell IMU sensor data.
Respond with EXACTLY 3 bullet points:
• [performance observation]
• [form/imbalance observation]
• [next session progressive overload recommendation]
Each bullet under 25 words. Be specific and data-driven. No fluff.`;

  const user = `Session data:
Lift: ${s.lift} | Weight: ${s.weight} lbs | Sets: ${s.setsCompleted}/${s.totalSets} | Reps: ${s.repsPerSet}
Rep 1 velocity: ${s.rep1Velocity} m/s | Last rep: ${s.lastRepVelocity} m/s | Dropoff: ${s.velocityDropoff}%
Avg tilt: ${s.avgTilt}° left | Fatigue index: ${s.fatigueIndex}%
Phase: ${s.nutritionPhase} | Caloric target: ${s.caloricTarget} kcal
Bodyweight: ${s.bodyweight} lbs | Training age: ${s.trainingAge} years`;

  return await askGPT(system, user);
}

// ── LIVE COACH MESSAGE ────────────────────────
export async function getLiveCoachMessage(d) {
  const system = `You are a real-time barbell coach. Give ONE coaching cue (max 18 words).
Direct, punchy, like a coach on the gym floor. No bullet points. No preamble.`;

  const user = `${d.lift} - Rep ${d.currentRep}/${d.targetReps}, Set ${d.setNumber}/${d.totalSets}
Velocity this rep: ${d.thisRepVelocity} m/s (rep 1 was ${d.rep1Velocity} m/s, dropoff: ${d.velocityDropoff}%)
Bar tilt: ${d.tilt}° left | Phase: ${d.nutritionPhase}`;

  return await askGPT(system, user);
}

// ── CALENDAR ADJUSTMENT ───────────────────────
export async function getCalendarAdjustment(d) {
  const system = `You are a periodization expert. Respond with EXACTLY 3 bullet points:
• [load recommendation for next session]
• [exercise swap or addition based on data]
• [recovery priority this week]
Each bullet under 30 words. Reference the numbers directly.`;

  const user = `Athlete schedule data:
Phase: ${d.phase} (week ${d.phaseWeek}/${d.phaseTotalWeeks})
Recent fatigue: ${d.avgFatigue}% | Velocity dropoff: ${d.avgVelocityDropoff}%
Tilt issue: ${d.tiltIssue ? 'Yes, ' + d.avgTilt + '° left persistent' : 'No'}
Blocked days: ${d.blockedDays} | Caloric delta: ${d.caloricDelta} kcal
Bodyweight trend: ${d.bodyweightTrend}
Upcoming schedule: ${d.upcomingSchedule || 'standard program'}`;

  return await askGPT(system, user);
}

// ── NUTRITION ADVICE ──────────────────────────
export async function getNutritionAdvice(d) {
  const system = `You are a sports nutritionist for strength athletes.
Respond with EXACTLY 2 bullet points:
• [specific advice for today based on the numbers]
• [phase/long-term strategy advice]
Each bullet under 25 words. Reference actual numbers.`;

  const user = `Nutrition data:
Phase: ${d.phase} | Target: ${d.caloricTarget} kcal | Logged: ${d.caloriesLogged} kcal
Protein: ${d.protein}g/${d.proteinTarget}g | Carbs: ${d.carbs}g/${d.carbTarget}g | Fat: ${d.fat}g/${d.fatTarget}g
Today's lift: ${d.todaysLift} | Last session fatigue: ${d.lastFatigue}%
Bodyweight: ${d.bodyweight} lbs | Phase week: ${d.phaseWeek}/${d.phaseTotalWeeks}`;

  return await askGPT(system, user);
}

// ── AI COACH CHAT — returns { reply, patches } ─
export async function getChatCoachReply(conversationHistory, athleteContext, currentSchedule) {
  const scheduleStr = currentSchedule.map((d, i) =>
    `[${i}] ${d.dateLabel} (${d.weekday}): ${d.lift || 'REST'}${d.rest ? ' (rest day)' : ''}`
  ).join('\n');

  const system = `You are BarbellBuddy's AI coach — strength coach, training partner, life advisor.

ATHLETE CONTEXT:
${athleteContext}

CURRENT 14-DAY SCHEDULE (index = day position, 0 = today):
${scheduleStr}

Adjust the live schedule when the athlete mentions life changes, fatigue, wanting more/less of a lift, travel, injury, etc.

YOU MUST ALWAYS respond with valid JSON only — no markdown fences, no text before or after:
{
  "reply": "Your conversational response (max 120 words, warm and direct like a real coach)",
  "patches": []
}

When schedule changes ARE needed, populate patches:
{
  "reply": "...",
  "patches": [
    { "index": 2, "lift": "Squat 3x3 (light)", "type": "deload", "rest": false, "cal": "+200", "reason": "Reduced load — life stress noted, keeping sessions short and manageable." },
    { "index": 4, "lift": null, "type": null, "rest": true, "cal": "+150", "reason": "Extra rest day added — recovery priority this week." }
  ]
}

Valid type values: "strength", "hypertrophy", "endurance", "pr", "buildup", "deload", or null for rest.
Only patch days that genuinely need to change. Empty patches array if no schedule change needed.`;

  const raw = await askGPT(system, '', conversationHistory);

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { reply: raw, patches: [] };
  }
}