import { useState, useRef, useEffect, useMemo } from 'react';

/* ─── exact same pattern as the working openai.js ─── */
async function askGPT(systemPrompt, conversationHistory) {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'OpenAI API error');
  return data.output;
}

/* ─── build system prompt from all athlete context ─── */
function buildSystemPrompt({ athlete, schedule, nutrition, workoutHistory }) {
  const bw = athlete?.bodyweight ? `${athlete.bodyweight} lbs` : 'unknown';
  const height =
    athlete?.heightFt != null
      ? `${athlete.heightFt}'${athlete.heightIn ?? 0}"`
      : 'unknown';

  const periodDays = nutrition?.periodDays ?? [];
  const bulkCutBlocks = nutrition?.bulkCutBlocks ?? [];

  const cycleText =
    bulkCutBlocks.length > 0
      ? bulkCutBlocks
          .map((b) => `  • ${b.type.toUpperCase()} from ${b.start} to ${b.end}`)
          .join('\n')
      : '  None logged.';

  const periodText =
    periodDays.length > 0
      ? `  ${periodDays.length} days logged: ${[...periodDays]
          .sort()
          .slice(-10)
          .join(', ')} (showing last 10)`
      : '  None logged.';

  const scheduleText =
    schedule && schedule.length > 0
      ? schedule
          .map((s) => `  • ${s.day} ${s.date}: ${s.title} — ${s.focus} [${s.status}]`)
          .join('\n')
      : '  No schedule.';

  const historyText =
    workoutHistory && workoutHistory.length > 0
      ? workoutHistory
          .slice(0, 8)
          .map(
            (w) =>
              `  • ${w.title} (${w.lift}): ${w.totalSets}×${Math.round(
                w.totalReps / w.totalSets
              )} @ ${w.weight} lbs, avg velocity ${w.avgVelocity} m/s, duration ${w.durationLabel}`
          )
          .join('\n')
      : '  No workout history yet.';

  return `You are Coach Nova, an elite strength and conditioning coach embedded in a personal training app. You have complete, real-time access to the athlete's data and you use it proactively. Be direct, specific, and evidence-based. Reference their actual numbers. Keep responses concise but substantive — 2-5 sentences for simple questions, a short structured breakdown for complex ones. Never be generic. Never say "great question." You are a coach, not a chatbot.

━━━ ATHLETE PROFILE ━━━
Name: ${athlete?.firstName ?? 'Athlete'} ${athlete?.lastName ?? ''}
Age: ${athlete?.age ?? 'unknown'}
Gender: ${athlete?.gender ?? 'unknown'}
Bodyweight: ${bw}
Height: ${height}
Primary goal: ${athlete?.goal ?? 'unknown'}
Equipment: ${athlete?.equipment ?? 'unknown'}
Calorie tracking style: ${athlete?.calorieTrackingStyle ?? 'unknown'}
Weight direction goal: ${athlete?.weightDirectionGoal ?? 'unknown'}
Nutrition guidance enabled: ${athlete?.nutritionGuidance ? 'yes' : 'no'}
Bulk/cut cycles enabled: ${athlete?.doesBulkCutCycles ? 'yes' : 'no'}
Cycle tracking enabled: ${athlete?.cycleTracking ? 'yes' : 'no'}
Special considerations: ${athlete?.considerations || 'none'}

━━━ UPCOMING SCHEDULE ━━━
${scheduleText}

━━━ BULK / CUT CYCLES ━━━
${cycleText}

━━━ PERIOD TRACKING ━━━
${periodText}

━━━ WORKOUT HISTORY (recent) ━━━
${historyText}

Always personalize your advice to this athlete's actual data above. If they ask about nutrition, reference their current cycle if active. If they ask about training, reference their schedule and history. If cycle tracking is enabled, factor in menstrual phase when relevant.`;
}

/* ─── suggested prompts ─── */
const SUGGESTIONS = [
  'How should I eat today given my current cycle?',
  "What's my weakest point based on my recent lifts?",
  'Should I push heavy or go for volume this week?',
  'How is my recovery looking?',
];

function TypingDots() {
  return (
    <div className="chat-typing-dots">
      <span /><span /><span />
    </div>
  );
}

function MessageBubble({ msg }) {
  const isCoach = msg.role === 'assistant';
  return (
    <div className={`chat-msg-row ${isCoach ? 'chat-msg-coach' : 'chat-msg-user'}`}>
      {isCoach && <div className="chat-avatar"><span>N</span></div>}
      <div className={`chat-bubble ${isCoach ? 'chat-bubble-coach' : 'chat-bubble-user'}`}>
        {msg.text}
      </div>
    </div>
  );
}

export default function ChatPage({
  athlete,
  schedule,
  nutrition,
  chatMessages,
  setChatMessages,
  workoutHistory,
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const systemPrompt = useMemo(
    () => buildSystemPrompt({ athlete, schedule, nutrition, workoutHistory }),
    [athlete, schedule, nutrition, workoutHistory]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;
    setInput('');
    setError(null);

    const userMsg = { id: Date.now(), role: 'user', text: trimmed };

    // Build history for API — oldest first, max 40 messages
    const history = [...chatMessages]
      .reverse()
      .slice(0, 39)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
    history.push({ role: 'user', content: trimmed });

    setChatMessages((prev) => [userMsg, ...prev]);
    setLoading(true);

    try {
      const reply = await askGPT(systemPrompt, history);
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', text: reply };
      setChatMessages((prev) => [assistantMsg, ...prev]);
    } catch (err) {
      setError('Failed to reach Coach Nova. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const showSuggestions = chatMessages.length === 0 && !loading;

  return (
    <div className="screen chat-screen">
      <style>{`
        .chat-screen {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 56px);
          padding: 0;
          overflow: hidden;
        }
        .chat-header {
          flex-shrink: 0;
          padding: 18px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(12px);
        }
        .chat-header-avatar {
          width: 38px; height: 38px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(87,165,255,0.3), rgba(155,168,255,0.3));
          border: 1px solid rgba(87,165,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 800; color: #bcdcff; flex-shrink: 0;
        }
        .chat-header-name {
          font-size: 0.92rem; font-weight: 800; color: var(--text); line-height: 1.2;
        }
        .chat-header-sub {
          font-size: 0.68rem; color: var(--muted); font-weight: 600; margin-top: 1px;
        }
        .chat-header-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--mint); box-shadow: 0 0 6px rgba(87,240,192,0.8);
          margin-right: 5px; vertical-align: middle;
        }
        .chat-messages {
          flex: 1; overflow-y: auto; padding: 20px 16px;
          display: flex; flex-direction: column-reverse; gap: 12px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .chat-msg-row { display: flex; align-items: flex-end; gap: 8px; max-width: 680px; }
        .chat-msg-coach { align-self: flex-start; }
        .chat-msg-user { align-self: flex-end; flex-direction: row-reverse; }
        .chat-avatar {
          width: 28px; height: 28px; border-radius: 8px;
          background: linear-gradient(135deg, rgba(87,165,255,0.25), rgba(155,168,255,0.25));
          border: 1px solid rgba(87,165,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 800; color: #bcdcff; flex-shrink: 0;
        }
        .chat-bubble {
          padding: 10px 14px; border-radius: 16px; font-size: 0.87rem;
          line-height: 1.6; max-width: 520px; white-space: pre-wrap; word-break: break-word;
        }
        .chat-bubble-coach {
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
          color: var(--text); border-bottom-left-radius: 4px;
        }
        .chat-bubble-user {
          background: linear-gradient(135deg, rgba(87,165,255,0.22), rgba(155,168,255,0.18));
          border: 1px solid rgba(87,165,255,0.25); color: #daeeff; border-bottom-right-radius: 4px;
        }
        .chat-typing-row { display: flex; align-items: flex-end; gap: 8px; align-self: flex-start; }
        .chat-typing-bubble {
          padding: 12px 16px; background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; border-bottom-left-radius: 4px;
        }
        .chat-typing-dots { display: flex; gap: 4px; align-items: center; }
        .chat-typing-dots span {
          width: 5px; height: 5px; border-radius: 50%; background: var(--muted);
          animation: chatDot 1.2s infinite ease-in-out;
        }
        .chat-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .chat-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes chatDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .chat-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: flex-end; flex: 1; padding: 0 16px 8px; gap: 12px;
        }
        .chat-empty-label {
          font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.18em;
          font-weight: 800; color: var(--muted);
        }
        .chat-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 560px; }
        .chat-suggestion-btn {
          padding: 8px 14px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 999px;
          font-size: 0.78rem; font-weight: 600; color: var(--text-soft);
          cursor: pointer; transition: background 0.15s, transform 0.15s, border-color 0.15s; text-align: center;
        }
        .chat-suggestion-btn:hover {
          background: rgba(87,165,255,0.12); border-color: rgba(87,165,255,0.25);
          color: #bcdcff; transform: translateY(-1px);
        }
        .chat-error {
          font-size: 0.76rem; color: #ffb8b8; text-align: center; padding: 6px 16px; flex-shrink: 0;
        }
        .chat-input-bar {
          flex-shrink: 0; padding: 12px 16px 16px;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02); backdrop-filter: blur(12px);
        }
        .chat-input-row {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.11);
          border-radius: 18px; padding: 8px 8px 8px 16px; transition: border-color 0.15s;
        }
        .chat-input-row:focus-within { border-color: rgba(87,165,255,0.35); }
        .chat-textarea {
          flex: 1; background: transparent; border: none; outline: none; resize: none;
          color: var(--text); font-size: 0.88rem; line-height: 1.5; font-family: inherit;
          min-height: 24px; max-height: 140px; overflow-y: auto; padding: 2px 0; scrollbar-width: thin;
        }
        .chat-textarea::placeholder { color: var(--muted); }
        .chat-send-btn {
          width: 34px; height: 34px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, rgba(87,165,255,0.5), rgba(155,168,255,0.4));
          color: #fff; cursor: pointer; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0; transition: transform 0.14s, filter 0.14s, opacity 0.14s;
        }
        .chat-send-btn:hover:not(:disabled) { transform: scale(1.07); filter: brightness(1.15); }
        .chat-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .chat-input-hint {
          font-size: 0.63rem; color: var(--muted); text-align: center; margin-top: 7px; opacity: 0.6;
        }
      `}</style>

      <div className="chat-header">
        <div className="chat-header-avatar">N</div>
        <div className="chat-header-info">
          <div className="chat-header-name">Coach Nova</div>
          <div className="chat-header-sub">
            <span className="chat-header-dot" />
            Live · knows your full profile
          </div>
        </div>
      </div>

      {showSuggestions ? (
        <div className="chat-empty">
          <div className="chat-empty-label">Ask your coach</div>
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chat-suggestion-btn" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          <div ref={bottomRef} />
          {loading && (
            <div className="chat-typing-row">
              <div className="chat-avatar">N</div>
              <div className="chat-typing-bubble"><TypingDots /></div>
            </div>
          )}
          {chatMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      )}

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-input-bar">
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask Coach Nova anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 13L13 7L1 1V5.5L9 7L1 8.5V13Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div className="chat-input-hint">Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  );
}
