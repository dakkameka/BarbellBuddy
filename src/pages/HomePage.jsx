import '../styles/home.css';

function Sparkline({ points }) {
  const width = 120;
  const height = 42;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg className="home-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomePage({ summary, athlete, schedule, nutrition, progress, startTodaysWorkout }) {
  const weekCards = schedule || [];
  const progressRows = [
    { name: 'Deadlift', value: `${progress.deadlift[progress.deadlift.length - 1]} lb`, points: progress.deadlift },
    { name: 'Squat', value: `${progress.squat[progress.squat.length - 1]} lb`, points: progress.squat },
    { name: 'Bench', value: `${progress.bench[progress.bench.length - 1]} lb`, points: progress.bench },
  ];

  return (
    <div className="screen home-screen">
      <div className="home-shell">
        <section className="home-top-row">
          <div className="home-brand glass-panel">
            <div className="home-brand-mark-wrap">
              <div className="home-brand-orbit orbit-1" />
              <div className="home-brand-orbit orbit-2" />
              <div className="home-brand-fallback">★</div>
            </div>

            <div className="home-brand-copy">
              <div className="home-eyebrow">Coach</div>
              <h1 className="home-wordmark">Nova</h1>
              <p className="home-brand-sub">
                Precision training, cosmic energy, cleaner progress.
              </p>
            </div>
          </div>

          <div className="home-week glass-panel">
            <div className="home-section-head">
              <div>
                <div className="home-kicker">Upcoming</div>
                <h2 className="home-section-title">Training week</h2>
              </div>
              <button className="home-ghost-btn" type="button">
                {athlete.firstName} {athlete.lastName}
              </button>
            </div>

            <div className="home-week-strip">
              <button className="home-strip-arrow" type="button">‹</button>

              <div className="home-week-cards">
                {weekCards.map((card) => (
                  <div
                    key={card.id}
                    className={`home-week-card ${card.status === 'active' ? 'is-active' : ''}`}
                  >
                    <div className="home-week-day">{card.day}</div>
                    <div className="home-week-date">{card.date}</div>
                    <div className="home-week-lift">{card.title}</div>
                  </div>
                ))}
              </div>

              <button className="home-strip-arrow" type="button">›</button>
            </div>
          </div>
        </section>

        <section className="home-hero glass-panel">
          <div className="home-hero-badge">Coach insight</div>

          <div className="home-hero-inner">
            <div className="home-hero-star">✦</div>

            <div className="home-hero-copy">
              <h2 className="home-hero-title">
                Start today&apos;s workout when you&apos;re ready.
              </h2>
              <p className="home-hero-text">
                {summary.topInsight}
              </p>
            </div>

            <button className="home-start-btn" type="button" onClick={startTodaysWorkout}>
              Start today&apos;s workout
            </button>
          </div>
        </section>

        <section className="home-bottom-row">
          <div className="home-phase glass-panel">
            <div className="home-section-head">
              <div>
                <div className="home-kicker">Phase</div>
                <h2 className="home-section-title">Current focus</h2>
              </div>
            </div>

            <div className="home-phase-wheel-wrap">
              <div className="home-phase-wheel">
                <div className="home-phase-center">
                  <div className="home-phase-center-top">Phase</div>
                  <div className="home-phase-center-main">{athlete.phase}</div>
                  <div className="home-phase-center-sub">
                    Week {athlete.phaseWeek} / {athlete.phaseTotalWeeks}
                  </div>
                </div>

                <div className="home-phase-node node-top">Squat</div>
                <div className="home-phase-node node-right">Bench</div>
                <div className="home-phase-node node-bottom active">Deadlift</div>
                <div className="home-phase-node node-left">Pull</div>
              </div>
            </div>
          </div>

          <div className="home-nutrition glass-panel">
            <div className="home-section-head">
              <div>
                <div className="home-kicker">Nutrition</div>
                <h2 className="home-section-title">Current mode</h2>
              </div>
            </div>

            <div className="home-mode-pill">{nutrition.mode}</div>

            <p className="home-card-body">
              {nutrition.aiAdvice}
            </p>

            <button className="home-ghost-btn bottom-btn" type="button">
              {nutrition.caloriesTarget} kcal target
            </button>
          </div>

          <div className="home-progress glass-panel">
            <div className="home-section-head">
              <div>
                <div className="home-kicker">Progress</div>
                <h2 className="home-section-title">Recent trends</h2>
              </div>
            </div>

            <div className="home-progress-list">
              {progressRows.map((row) => (
                <div key={row.name} className="home-progress-row">
                  <div className="home-progress-meta">
                    <div className="home-progress-name">{row.name}</div>
                    <div className="home-progress-value">{row.value}</div>
                  </div>
                  <Sparkline points={row.points} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HomePage;
