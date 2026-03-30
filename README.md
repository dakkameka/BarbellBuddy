# Coach NOVA

AI-augmented wearable coaching platform for competitive powerlifters.
UC Berkeley · ME292C / DESINV 190: Human-AI Design Methods · HP Partnership

---

## Hardware Wiring — ESP32-C3 Super Mini + LSM6DS3 IMU

### Overview

The LSM6DS3 is a 6-axis IMU (3-axis accelerometer + 3-axis gyroscope). It communicates with the ESP32-C3 over I2C — a two-wire protocol (data + clock) that lets multiple devices share the same bus.

Two additional pins (CS and SAO) are configuration pins that must be tied to fixed voltage levels to put the sensor in I2C mode and assign it a specific address.

### Wiring Table

| LSM6DS3 Pin | Connects To | Wire Color (suggested) | Notes |
|---|---|---|---|
| VIN | ESP32 3.3V | Red | Powers the sensor — must be 3.3V, not 5V |
| GND | ESP32 GND | Black | Common ground |
| SDA | ESP32 GPIO8 | Blue | I2C data line |
| SCL | ESP32 GPIO9 | Yellow | I2C clock line |
| CS | ESP32 3.3V | Orange | Pull HIGH → selects I2C mode (LOW = SPI mode) |
| SAO | ESP32 GND | White | Pull LOW → sets I2C address to 0x6A (HIGH = 0x6B) |

> **CS and SAO are not I2C pins** — they are strap pins that set the sensor's communication mode and address at power-on. They carry no data during operation; just tie them to the correct voltage and forget them.

### ASCII Wiring Diagram

```
ESP32-C3 Super Mini          LSM6DS3 Breakout
┌─────────────────┐          ┌──────────────┐
│                 │          │              │
│           3.3V ─┼──────────┼─ VIN         │
│            GND ─┼──┬───────┼─ GND         │
│                 │  │       │              │
│          GPIO8 ─┼──┼───────┼─ SDA         │  ← I2C data
│          GPIO9 ─┼──┼───────┼─ SCL         │  ← I2C clock
│                 │  │       │              │
│           3.3V ─┼──┼───────┼─ CS          │  ← tie HIGH → I2C mode
│                 │  └───────┼─ SAO         │  ← tie LOW  → addr 0x6A
│                 │          │              │
└─────────────────┘          └──────────────┘
```

### Why These Pin Choices

**SDA = GPIO8, SCL = GPIO9**
The ESP32-C3 supports I2C on any GPIO pair. GPIO8/9 were chosen because they are broken out cleanly on the Super Mini form factor and kept away from the boot-strapping pins (GPIO2, GPIO8 on some variants can affect boot — test with your specific board if you see issues).

**CS pulled HIGH (3.3V)**
The LSM6DS3 supports both I2C and SPI. The CS pin selects which protocol is active:
- CS = HIGH → I2C mode (what we want)
- CS = LOW → SPI mode

**SAO pulled LOW (GND)**
SAO (also called SDO or ADDR on some breakouts) sets the 7-bit I2C address:
- SAO = LOW → address `0x6A`
- SAO = HIGH → address `0x6B`

We use `0x6A`. If you ever need two LSM6DS3 sensors on the same I2C bus, wire the second one's SAO to 3.3V to give it address `0x6B`.

### Voltage

The LSM6DS3 is a 3.3V device. The ESP32-C3 runs at 3.3V. Do not connect VIN to a 5V pin — this will damage the sensor.

### Pull-up Resistors

I2C requires pull-up resistors on SDA and SCL (typically 4.7kΩ to 3.3V). The SparkFun LSM6DS3 breakout board includes these on-board, so no external resistors are needed.

---

## Quick Start

### Firmware (ESP32)

```bash
# Install PlatformIO CLI or use the VS Code extension
platformio run -t upload       # build and flash
platformio device monitor      # open serial monitor at 115200 baud
```

On boot you'll see:
```
Calibrating gyro — keep sensor still for 2 seconds...
Gyro bias: X=0.012  Y=-0.008  Z=0.003 dps
IMU ready!
```

Then continuous CSV at 50Hz:
```
0.0123,-0.0045,1.0001,0.0120,-0.0080,0.0030,24.50
```

And a summary line after each detected rep:
```
REP,1,1240,1.87
```

### Python GUI

```bash
pip install pyserial pyqt6 pyqtgraph
python app/main.py
```

Select your `/dev/cu.usbmodem*` port (macOS) or `SIMULATED` for testing without hardware.

### Web App

```bash
npm install
npm start        # http://localhost:3000
```

Requires `OPENAI_API_KEY` environment variable.

---

## Serial Output Format

| Line type | Format | Example |
|---|---|---|
| Sensor data (50Hz) | `ax,ay,az,gx,gy,gz,temp` | `0.01,-0.02,1.00,0.12,-0.08,0.03,24.5` |
| Rep event | `REP,<n>,<ms>,<peak_g>` | `REP,3,1240,1.87` |

Fields: `ax/ay/az` = accelerometer (g), `gx/gy/gz` = gyroscope bias-corrected (dps), `temp` = °C.

---

## Project Structure

```
BarbellBuddy/
├── src/
│   └── main.cpp          # ESP32 firmware — IMU streaming + rep detection
├── app/
│   ├── main.py           # PyQt6 GUI — live plots and rep counter
│   ├── serial_reader.py  # Serial port handler + CSV/REP parser
│   ├── motion_estimator.py # Complementary filter + velocity integration
│   └── simulator.py      # Synthetic IMU data for testing
├── src/
│   └── App.js            # React frontend (5 screens)
├── api/
│   └── openai.js         # Vercel serverless OpenAI proxy
├── platformio.ini        # PlatformIO build config
└── CLAUDE.md             # Full technical reference for AI-assisted development
```

---

## Team

- Shanthanu Saravanan — hardware lead
- Lilly Sweet
- Kai Sims
- Karisma Vyas
- Mohannad ElAsad
