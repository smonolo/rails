# Rails

A minimalist 2D railway simulator built with pure TypeScript and HTML5 Canvas, inspired by real-world railway operations, track signaling, and physics.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=flat&logo=html5&logoColor=white)

---

## Features

### Railway Signaling System

- **Automatic Block Signaling**: Mainlines are divided into discrete blocks protected by entry signals.
- **Synchronized Signal Pairs**: Each primary stop signal (P) is paired 1-to-1 with an advance distant signal (D) located at braking distance:
  - **Clear**: `Clear` / `Expect Clear`
  - **Stop / Warning**: `Stop` / `Expect Stop`
- **Bidirectional Track Signaling**: Both tracks support full bidirectional travel with interleaved forward (`▸`) and reverse (`◂`) signals.
- **SPAD Enforcement (_Signal Passed at Danger_)**: Automatic emergency braking if a train passes a red signal.
- **Interactive Signal Control**: Click or tap any signal to toggle manual aspects, keeping paired distant signals in lockstep.

### Advanced Train Control Systems

- **Deadman Vigilance Control**: Optional driver vigilance safety monitoring.
- **Graduated Alert Sequence**: Timed visual alert (30.0s), urgent alarm (32.5s), and automatic penalty emergency braking (35.0s) if unacknowledged.
- **Interactive Reset**: Acknowledge alerts via keyboard (`Space` / `Q`) or HUD button during operation.

### Train Physics & Consist Management

- **Three Distinct Train Classes**:
  - **Regional Express**: Balanced acceleration, 160 km/h top speed, passenger commuter configuration.
  - **Heavy Cargo**: High mass (up to 800+ t), lower tractive acceleration, 120 km/h speed limit, freight container styling.
  - **High-Speed Express**: High power, 330 km/h top speed, aerodynamic streamliner nose.
- **Realistic Dynamics**: Air drag curves, rolling friction, dynamic service braking, emergency brake pipe rates, lateral curve acceleration, and derailment G-limits.
- **Consist Customization**: Adjust carriage count dynamically and invert the train heading at any time.

### Track Infrastructure & Switches

- **Double-Track Mainline**: Continuous Catmull-Rom spline curves with authentic track spacing.
- **High-Speed Crossovers & Sidings**: Turnouts with animated direction indicators, dead-end terminal sidings, and realistic buffer stops.
- **Switch Interlocking**: Turnout points cannot be thrown while a train is physically occupying or traversing the junction frog.

### Environment & World

- **Overhead Electrification**: Dual-track catenary wire simulation with realistic masts and tensioner pulleys.
- **Level Crossings**: Grade crossings with white stop lines and barrier gates with safety clearance.
- **Passenger Stations**: Platform dwelling, dwell timers, and timetable dispatching.
- **World Cartouche**: Vintage top-left map reference detailing trackage, coordinate bounds, and scale.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/your-username/rails.git
cd rails
npm install
```

### Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

### Type Checking

```bash
npx tsc --noEmit
```

---

## Controls

### Desktop Keyboard

| Key                | Action                                                    |
| ------------------ | --------------------------------------------------------- |
| `W` / `Arrow Up`   | Increase throttle (+1%)                                   |
| `S` / `Arrow Down` | Decrease throttle (-1%)                                   |
| `B`                | Apply service brake (+1%)                                 |
| `V`                | Release service brake (-1%)                               |
| `Space` / `Q`      | Acknowledge deadman vigilance alarm / Apply service brake |
| `X`                | Emergency brake (trip / reset at standstill)              |
| `F` / `N` / `R`    | Reverser (Forward / Neutral / Reverse)                    |
| `C`                | Center camera view on locomotive                          |
| `T`                | Toggle train configuration panel                          |
| `G`                | Regenerate world                                          |
| `H`                | Controls and operation help                               |
| `Click on switch`  | Toggle turnout route (straight / diverging)               |
| `Click on signal`  | Toggle signal aspect (Stop / Clear)                       |
| `Mouse Drag`       | Pan camera view                                           |
| `Mouse Wheel`      | Zoom in / out                                             |

### Touch & Mobile

- **Interactive Levers**: On-screen throttle and brake sliders with pointer dragging.
- **Gestures**: Single-finger drag to pan, pinch to zoom, single-tap on world elements to toggle switches and signals.
- **HUD Panel**: Accessible floating panels for train configuration, world layout, and camera recentering.

---

## License

MIT License.
