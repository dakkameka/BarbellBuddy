function LiveWorkoutPage({ activeWorkout, finishWorkout, goBack }) {
  if (!activeWorkout) {
    return (
      <div className="screen blank-page">
        <div style={{ padding: '32px' }}>
          <h2>No active workout</h2>
          <button type="button" onClick={goBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen blank-page">
      <div style={{ padding: '32px' }}>
        <h1>Live Workout</h1>
        <p>{activeWorkout.title}</p>
        <p>{activeWorkout.focus}</p>
        <p>{activeWorkout.lift}</p>
        <p>Set {activeWorkout.currentSet} of {activeWorkout.setsPlanned}</p>

        <div style={{ marginTop: '24px' }}>
          <button type="button" onClick={goBack} style={{ marginRight: '12px' }}>
            Back
          </button>

          <button type="button" onClick={finishWorkout}>
            Finish workout
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiveWorkoutPage;
