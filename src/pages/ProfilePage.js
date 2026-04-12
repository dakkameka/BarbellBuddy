import { useState } from 'react';
import '../styles/profile.css';

function ProfilePage({ athlete, setAthlete, goBack }) {
  const [form, setForm] = useState(athlete);
  const [saved, setSaved] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    setAthlete(form);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 1500);
  };

  return (
    <div className="screen profile-screen">
      <div className="profile-shell">

        {/* HEADER */}
        <div className="profile-header glass-panel">
          <h1>Profile</h1>
          <p>Set up your training identity and baseline</p>
        </div>

        {/* IDENTITY */}
        <div className="profile-section glass-panel">
          <h2>Identity</h2>

          <div className="profile-grid">
            <input
              value={form.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="First name"
            />

            <input
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Last name"
            />

            <input
              type="number"
              value={form.age}
              onChange={(e) => handleChange('age', Number(e.target.value))}
              placeholder="Age"
            />

            <select
              value={form.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>

        {/* BODY */}
        <div className="profile-section glass-panel">
          <h2>Body Metrics</h2>

          <div className="profile-grid">
            <input
              type="number"
              value={form.bodyweight}
              onChange={(e) => handleChange('bodyweight', Number(e.target.value))}
              placeholder="Bodyweight (lb)"
            />

            <input
              type="number"
              value={form.heightFt}
              onChange={(e) => handleChange('heightFt', Number(e.target.value))}
              placeholder="Height (ft)"
            />

            <input
              type="number"
              value={form.heightIn}
              onChange={(e) => handleChange('heightIn', Number(e.target.value))}
              placeholder="Height (in)"
            />
          </div>
        </div>

        {/* TRAINING */}
        <div className="profile-section glass-panel">
          <h2>Training Context</h2>

          <div className="profile-grid">
            <select
              value={form.goal}
              onChange={(e) => handleChange('goal', e.target.value)}
            >
              <option value="strength">Strength</option>
              <option value="hypertrophy">Hypertrophy</option>
              <option value="general">General Fitness</option>
            </select>

            <select
              value={form.phase}
              onChange={(e) => handleChange('phase', e.target.value)}
            >
              <option value="build">Build</option>
              <option value="cut">Cut</option>
              <option value="maintain">Maintain</option>
            </select>

            <input
              type="number"
              value={form.phaseWeek}
              onChange={(e) => handleChange('phaseWeek', Number(e.target.value))}
              placeholder="Phase week"
            />

            <input
              type="number"
              value={form.phaseTotalWeeks}
              onChange={(e) => handleChange('phaseTotalWeeks', Number(e.target.value))}
              placeholder="Total weeks"
            />

            <select
              value={form.equipment}
              onChange={(e) => handleChange('equipment', e.target.value)}
            >
              <option value="full gym">Full Gym</option>
              <option value="dumbbells">Dumbbells</option>
              <option value="bodyweight">Bodyweight</option>
            </select>
          </div>
        </div>

        {/* STRENGTH */}
        <div className="profile-section glass-panel">
          <h2>Strength (1RM)</h2>

          <div className="profile-grid">
            <input
              type="number"
              value={form.squat1RM}
              onChange={(e) => handleChange('squat1RM', Number(e.target.value))}
              placeholder="Squat"
            />

            <input
              type="number"
              value={form.bench1RM}
              onChange={(e) => handleChange('bench1RM', Number(e.target.value))}
              placeholder="Bench"
            />

            <input
              type="number"
              value={form.deadlift1RM}
              onChange={(e) => handleChange('deadlift1RM', Number(e.target.value))}
              placeholder="Deadlift"
            />

            <input
              type="number"
              value={form.ohp1RM}
              onChange={(e) => handleChange('ohp1RM', Number(e.target.value))}
              placeholder="OHP"
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="profile-actions">
          <button onClick={goBack} className="ghost-btn">
            Back
          </button>

          <button onClick={handleSave} className="primary-btn">
            Save Profile
          </button>
        </div>

        {saved && <div className="profile-saved">Saved ✓</div>}
      </div>
    </div>
  );
}

export default ProfilePage;
