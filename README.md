# Rails

A minimalist 2D railway simulator built with pure TypeScript and HTML5 Canvas, inspired by German railway operations, track signaling, and physics.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=flat&logo=html5&logoColor=white)

---

## Features

### German Signaling System (H/V & GWB)
- **Automatic Block Signaling (*Selbsttätiger Streckenblock*)**: Mainlines are divided into discrete blocks protected by entry signals.
- **Synchronized Signal Pairs**: Each primary stop signal (*Hauptsignal* - Hp) is paired 1-to-1 with an advance distant signal (*Vorsignal* - Vr) located at braking distance:
  - **Clear**: `Hp 1 (Clear)` / `Vr 1 (Expect Clear)`
  - **Stop / Warning**: `Hp 0 (Stop)` / `Vr 0 (Expect Stop)`
- **Bidirectional Signaling (*Gleiswechselbetrieb* - GWB)**: Both tracks support full bidirectional travel with interleaved forward (`▸`) and reverse (`◂`) signals in an authentic `S-P-S-S-P-S` sequence.
- **SPAD Enforcement (*Signal Passed at Danger*)**: Automatic emergency braking if a train passes a red signal.
- **Interactive Signal Control**: Click or tap any signal to toggle manual aspects, keeping paired distant signals in lockstep.

### Train Physics & Consist Management
- **Three Distinct Train Classes**:
  - **Regional Express**: Balanced acceleration, 160 km/h top speed, passenger commuter configuration.
  - **Heavy Cargo**: High mass (up to 800+ t), lower tractive acceleration, 120 km/h speed limit, freight container styling.
  - **High-Speed (ICE-style)**: High power, 330 km/h top speed, aerodynamic streamliner nose.
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
| Key | Action |
| --- | --- |
| `W` / `Arrow Up` | Increase throttle |
| `S` / `Arrow Down` | Decrease throttle |
| `A` / `Arrow Left` | Release brakes |
| `D` / `Arrow Right` | Apply service brakes |
| `R` | Set reverser forward |
| `F` | Set reverser reverse |
| `Space` | Emergency brake |
| `Click on switch` | Toggle turnout straight / diverging |
| `Click on signal` | Manually toggle signal aspect (Hp 0 / Hp 1) |
| `Mouse Drag` | Pan camera view |
| `Mouse Wheel` | Zoom in / out |

### Touch & Mobile
- **Interactive Levers**: On-screen throttle and brake sliders.
- **Gestures**: Single-finger drag to pan, pinch to zoom, single-tap to toggle switches and signals.
- **HUD Panel**: Mobile-friendly dropdown for train type, carriage count, train inversion, and respawn.

---

## Project Structure

```
rails/
├── index.html          # HTML shell and responsive layout
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript compiler configuration
└── src/
    ├── main.ts         # Main game loop, canvas orchestration, input dispatch
    ├── train.ts        # Train physics, consists, aerodynamics, rendering
    ├── track.ts        # Track geometry, Catmull-Rom splines, turnout junctions
    ├── signals.ts      # H/V block signaling, GWB bidirectional logic, SPAD
    ├── stations.ts     # Station platforms, dwelling logic, timetable
    ├── scenery.ts      # Catenary masts, roads, crossings, vegetation, props
    ├── camera.ts       # Smooth tracking camera, world transformations, zoom
    ├── hud.ts          # DOM HUD overlay, control levers, telemetry, alerts
    ├── types.ts        # Data structures and shared TypeScript interfaces
    └── style.css       # Clean dark-mode stylesheet
```

---

## License

MIT License.
