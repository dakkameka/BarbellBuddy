const MODEL = 'gpt-4o-mini';

async function askGPT(systemPrompt, userPrompt, conversationHistory = []) {
  const messages = conversationHistory.length > 0
    ? [{ role: 'system', content: systemPrompt }, ...conversationHistory]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'OpenAI API error');
  }

  return data.output;
}

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

export async function getLiveCoachMessage(d) {
  const system = `You are a real-time barbell coach. Give ONE coaching cue (max 18 words).
Direct, punchy, like a coach on the gym floor. No bullet points. No preamble.`;

  const user = `${d.lift} - Rep ${d.currentRep}/${d.targetReps}, Set ${d.setNumber}/${d.totalSets}
Velocity this rep: ${d.thisRepVelocity} m/s (rep 1 was ${d.rep1Velocity} m/s, dropoff: ${d.velocityDropoff}%)
Bar tilt: ${d.tilt}° left | Phase: ${d.nutritionPhase}`;

  return await askGPT(system, user);
}

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

export async function getChatCoachReply(conversationHistory, athleteContext, currentSchedule) {
  const scheduleStr = currentSchedule.map((d, i) =>
    `[${i}] ${d.dateLabel} (${d.weekday}): ${d.lift || 'REST'}${d.rest ? ' (rest)' : ''}`
  ).join('\n');

  const system = `You are BarbellBuddy's AI coach — strength coach, training partner, and life advisor for a serious lifter.

ATHLETE CONTEXT:
${athleteContext}

CURRENT 14-DAY SCHEDULE:
${scheduleStr}

When the athlete tells you something that should change their training — less gym time, new girlfriend, travel, injury, overtrained, wants more squats, wants to drop OHP, etc — you MUST regenerate the full 14-day schedule to reflect their new reality.

ALWAYS respond with valid JSON only. No markdown, no extra text:

If NO schedule change needed:
{ "reply": "...", "newSchedule": null }

If schedule SHOULD change, regenerate all 14 days:
{
  "reply": "...",
  "newSchedule": [
    { "lift": "Squat 5x5", "type": "strength", "cal": "+350", "rest": false, "reason": "Why this day has this lift", "nutr": "Nutrition note for this day" },
    { "lift": null, "type": null, "cal": "+200", "rest": true, "reason": "Rest day reason", "nutr": "Nutrition on rest day" }
  ]
}

SCHEDULE RULES:
- Always 14 entries total
- Rest days: lift=null, type=null, rest=true
- At least 2 rest days per week
- Preserve today unless they specifically want today changed

Valid type values: "strength", "hypertrophy", "endurance", "pr", "buildup", "deload"
reply should be warm, direct, max 100 words.`;

  const raw = await askGPT(system, '', conversationHistory);

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { reply: raw, newSchedule: null };
  }
}
