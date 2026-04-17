
function WorkoutSummaryPage({ summary, logWorkout, goBack }) {
  if (!summary) {
    return (
      <div className="screen blank-page">
        <div style={{ padding: '32px' }}>
          <h2>No workout summary</h2>
          <button type="button" onClick={goBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen blank-page">
      <div style={{ padding: '32px' }}>
        <h1>Workout Summary</h1>
        <p>{summary.lift}</p>
        <p>{summary.durationLabel}</p>
        <p>{summary.totalSets} sets</p>
        <p>{summary.totalReps} reps</p>
        <p>{summary.coachDebrief}</p>

        <div style={{ marginTop: '24px' }}>
          <button type="button" onClick={goBack} style={{ marginRight: '12px' }}>
            Back
          </button>

          <button type="button" onClick={logWorkout}>
            Log workout
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkoutSummaryPage;
