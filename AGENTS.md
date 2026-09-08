# AGENTS.md

Developer and AI agent guidelines for working on the `rails` repository.

---

## 1. Project Philosophy & Architecture

`Rails` is a high-performance, minimalist 2D railway simulator built on pure TypeScript and the HTML5 Canvas API without external physics engines or heavy frontend frameworks.

### Core Modules
- **`src/main.ts`**: Game loop entry point (`requestAnimationFrame`), input aggregation, camera viewport orchestration, high-level event handling.
- **`src/train.ts`**: Train physics engine, consist tracking, speed/tractive force curves, braking simulation, lateral G and derailment calculations, canvas rendering.
- **`src/track.ts`**: Catmull-Rom spline curves, arc-length distance parameterization, junction switches, crossover transition zones, switch occupancy interlocking.
- **`src/signals.ts`**: German H/V block signaling system, *Gleiswechselbetrieb* (GWB) bidirectional track logic, SPAD detection, aspect synchronization, canvas rendering.
- **`src/stations.ts`**: Platform waypoints, passenger dwell timers, dispatching state machine.
- **`src/scenery.ts`**: Overhead catenary masts and contact wires, level crossings with safety barriers, roads, buildings, and vegetation.
- **`src/camera.ts`**: Viewport transformation, smooth following, screen-to-world unprojection, pinch-to-zoom, touch panning.
- **`src/hud.ts`**: DOM-based UI overlay, throttle and brake levers, telemetry, warning alerts, mobile action drawer.
- **`src/types.ts`**: Canonical TypeScript interfaces, enums, and types.

---

## 2. Critical Repository Rules

When modifying or generating code in this repository, you must adhere to the following rules:

### A. No Comments in Code
- **Never add comments** (`//` or `/* */`) to code files (`.ts`, `.js`, `.css`, `.html`).
- Code must be self-documenting through clear, descriptive variable and method names.
- Existing comments must not be introduced or re-added.

### B. Code Formatting
- Keep blank lines between declarations, blocks, interfaces, and methods.
- Maintain consistent indentation (2 spaces).

### C. Build Verification
- **NEVER run `npm run build` or `vite build`** during agent sessions.
- Run `npx tsc --noEmit` to verify type safety and compilation.

---

## 3. Domain Logic & Invariants

### A. Railway Signaling (German H/V & GWB)
1. **Signal Pairs**:
   - Every primary signal (*Hauptsignal* - `Hp`) must have a corresponding secondary distant signal (*Vorsignal* - `Vr`).
   - The distant signal is positioned at braking distance (~800 m) ahead of the primary signal in the direction of travel.
2. **Synchronization Invariant**:
   - Secondary signal aspects are strictly derived from their linked primary signal:
     - `Hp` is `green` $\iff$ `Vr` is `green` (`Vr 1 - Expect Clear`).
     - `Hp` is `red` $\iff$ `Vr` is `yellow` (`Vr 0 - Expect Stop`).
   - Toggling either the primary or secondary signal manually must toggle the entire pair in lockstep.
3. **Block Boundaries**:
   - Each block section begins exactly at its entry primary signal (`startDistance = sig.distance`) and terminates at the next primary signal (`endDistance = nextSig.distance`).
   - A block must never be marked occupied before the front of the train has crossed the signal controlling that block.
4. **Directional Isolation**:
   - Mainlines support bidirectional traffic (*Gleiswechselbetrieb*).
   - Only signals matching the train's active travel direction (`trainFacing` and velocity sign) are tripped by train passage.
   - Opposing signals must remain in their default clear state (`green`) and must not trigger false SPAD alerts.
5. **Neutral Styling**:
   - Never highlight manual signal changes or switch states in blue or artificial colors.
   - Signals render with neutral white borders (`#ffffff`), and switches render with neutral gray borders (`#71717a`) and white direction arrows (`#ffffff`).
   - Junction track segments render in uniform rail gray (`#4a4a54`, width 7).

### B. Track & Junction Switch Interlocking
1. **Switch States**:
   - Switches operate in either `straight` or `diverging` routes.
2. **Interlocking Rule**:
   - A switch cannot be toggled if a train is currently traversing the switch points, frog, or active crossover transition zone (`isSwitchOccupied`).

### C. Physics & Units
1. **Coordinate & Scale Conventions**:
   - World coordinates are in pixels, with 1 canvas pixel approximately equal to 1 meter of track.
   - Speed is tracked in internal simulation units and scaled for real-world km/h readouts.
2. **Train Classes**:
   - Regional: 46 m locomotive, 42 m passenger carriages.
   - Cargo: 48 m locomotive, 42 m freight wagons with container bays, higher mass (up to 800+ t).
   - High-Speed: 48 m streamlined nose, 42 m carriages, 330 km/h top speed.

---

## 4. Verification Workflow

Before concluding any code changes:
1. Run `npx tsc --noEmit` from the repository root. Ensure 0 errors.
2. Check `git diff` to ensure no comments were added to any source files.
3. Ensure no trailing unused imports or variables exist.
