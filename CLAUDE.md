# Coach NOVA

AI-augmented wearable coaching platform for competitive powerlifters. UC Berkeley course project (ME292C / DESINV 190: Human-AI Design Methods) in partnership with HP.

**Core problem:** Serious athletes use 5–8 disconnected apps. Coach NOVA consolidates them into a unified system delivering real-time, in-set feedback — including haptic cues mid-lift.

## Team

- Shanthanu Saravanan (hardware lead, this repo)
- Lilly Sweet, Kai Sims, Karisma Vyas, Mohannad ElAsad

## Architecture

```
ESP32-C3 + LSM6DS3
       │ USB serial (CSV)
       ▼
Python GUI (app/)          ← working prototype for velocity visualization

React Frontend (src/)      ← complete UI, currently on demo/fake data
       │ POST /api/openai
       ▼
Vercel Serverless (api/)   ← proxies OpenAI API
```

> No live data path from hardware to React frontend yet — BLE bridge is the missing link.

**Frontend** — React 19 SPA (`src/App.js`, ~1000 lines monolithic)
**Backend** — Vercel serverless function (`api/openai.js`) proxying OpenAI API
**Hardware** — ESP32-C3 Super Mini + SparkFun LSM6DS3 6-axis IMU, Arduino/PlatformIO
**Python GUI** — PyQt6 desktop app (Kai's code, `app/`) for serial IMU visualization

## Implementation Status

| Component | Status | Notes |
|---|---|---|
| React frontend (5 screens) | ✅ Done | Polished UI, AI integration working |
| Backend API (Vercel) | ✅ Done | OpenAI proxy, secure key handling |
| ESP32 firmware | ✅ Basic | Raw CSV streaming only, no on-device processing |
| Python GUI | ✅ Done | Live plots, complementary filter, ZUPT velocity |
| Motion estimation | ✅ Done | Runs on laptop, not on device |
| Rep detection (on-device) | ❌ Not started | Firmware roadmap item |
| Velocity calc (on-device) | ❌ Not started | Firmware roadmap item |
| BLE transmission | ❌ Not started | Needed to close hardware→frontend gap |
| Haptic feedback | ❌ Not started | No motor hardware or code yet |

## Running Locally

```bash
npm install
npm start        # Dev server at http://localhost:3000
npm run build    # Production build
npm test         # Jest + React Testing Library
```

Requires `OPENAI_API_KEY` env var for the backend.

## Hardware (ESP32 / PlatformIO)

```bash
platformio run                 # Build
platformio run -t upload       # Flash to ESP32-C3-DevKitM-1
platformio device monitor      # Serial at 115200 baud
```

### Wiring (I2C mode)

| LSM6DS3 Pin | Connects To |
|---|---|
| VIN | ESP32 3.3V |
| GND | ESP32 GND |
| SDA | ESP32 GPIO8 |
| SCL | ESP32 GPIO9 |
| CS | ESP32 3.3V (pulls HIGH → enables I2C mode) |
| SAO | ESP32 GND (sets I2C address to 0x6A) |

I2C address: `0x6A`. IMU reads at 10 Hz. Streams CSV over serial at 115200 baud.

### Serial Output Format

```
ax,ay,az,gx,gy,gz,temp
```
- `ax/ay/az` — accelerometer (g)
- `gx/gy/gz` — gyroscope (dps)
- `temp` — temperature (°C)

One startup line (`IMU ready!`) precedes the CSV stream; the Python parser ignores it.

### ESP32-C3 Serial Note

`ARDUINO_USB_CDC_ON_BOOT=1` is required for serial output on the ESP32-C3 Super Mini. Always include `while (!Serial) delay(10);` after `Serial.begin()`.

### Target Derived Metrics (priority order)

1. **Bar velocity** (m/s) — core VBT metric, primary differentiator
2. **Velocity loss %** — fatigue indicator within a set
3. **Rep counting** — detect reps from acceleration waveform
4. **Range of motion** — full lift depth and lockout
5. **Bar path deviation** — lateral drift from ideal vertical path
6. **Rep asymmetry** — left/right imbalance detection
7. **Lift phase timing** — eccentric vs. concentric phase durations

### Firmware Roadmap

1. Rep detection — threshold + peak detection on vertical accel axis
2. Velocity calculation — double-integrate accel with bias removal, high-pass filter, ZUPT
3. BLE transmission — stream computed metrics to companion app
4. Haptic feedback — vibration motor triggered on velocity drop below threshold

### Hardware Constraints

- Limited per-person budget — no speculative component additions
- PPG sensor (MAX30102) not confirmed for MVP
- All processing must run on ESP32-C3 (may upgrade to ESP32-S3 if compute-bound)
- Sensor placement: barbell collar/sleeve preferred; forearm is fallback (wrist-worn conflicts with powerlifting wrist wraps)
- Real-time = haptic feedback within the rep; visual feedback is post-set only

## Python App (Kai's GUI)

A PyQt6 desktop app in `app/` for real-time IMU visualization and velocity estimation. This is the current working prototype for VBT — connects directly to the ESP32 over USB serial.

```bash
pip install pyserial pyqt6 pyqtgraph
python app/main.py
```

Select a `/dev/cu.usbmodem*` port (auto-discovered) or choose `SIMULATED` to run without hardware.

**Algorithm** (`app/motion_estimator.py`): complementary filter (α=0.98) fuses gyro + accel for pitch/roll, subtracts gravity, integrates linear accel for velocity. ZUPT zeroes velocity when stationary. Bias calibration runs on the first 50 samples.

> Known limitation: if serial gap > 0.5s, velocity update is silently skipped.

| File | Purpose |
|---|---|
| `app/main.py` | PyQt6 GUI — live plots, digital readouts, port selector |
| `app/serial_reader.py` | Serial port handler, CSV parser, `ImuSample` dataclass |
| `app/motion_estimator.py` | Complementary filter + velocity integration |
| `app/simulator.py` | Synthetic IMU data for testing without hardware |

## Key Files

| File | Purpose |
|---|---|
| `src/App.js` | All 5 app screens and state management (demo data) |
| `src/openai.js` | AI coaching helper functions |
| `api/openai.js` | Backend API route (Vercel serverless) |
| `src/main.cpp` | ESP32 Arduino firmware |
| `platformio.ini` | PlatformIO config (ESP32-C3, LSM6DS3 library) |

## App Screens

1. **Start Lift** — Lift selection (squat/bench/deadlift/OHP/RDL/front squat), sets/reps/weight
2. **Live Session** — Rep counter, bar velocity (m/s), tilt (degrees), live AI coaching cues
3. **Post-Session** — Volume, velocity dropoff (fatigue), AI debrief (3 bullets)
4. **Calendar** — 14-day AI-generated periodized schedule with caloric targets
5. **Chat Coach** — Conversational AI that can regenerate/adjust the schedule

## AI Integration

All AI calls go through `/api/openai` (backend route). Model: `gpt-4o-mini`, max 700 tokens, temp 0.7.

Functions in `src/openai.js`:
- `getPostSessionDebrief(session)` — 3-bullet post-workout summary
- `getLiveCoachMessage(data)` — single-line real-time cue
- `getCalendarAdjustment(data)` — periodization advice
- `getNutritionAdvice(data)` — macro/nutrition guidance
- `getChatCoachReply(history, context, schedule)` — JSON with optional schedule updates

## Dependencies

- `react@19.2.4`, `openai@6.33.0`
- PlatformIO: `espressif32`, `arduino`, `sparkfun/SparkFun LSM6DS3 Breakout`
- Python: `pyserial`, `pyqt6`, `pyqtgraph`

## Branch Convention

- `main` — stable, team-reviewed code only
- `hardware/` prefix — hardware bringup and firmware work
- `feature/` prefix — new capability development
