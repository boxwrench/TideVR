# Quest device testing

## Desktop emulator

```bash
npm run dev
```

Open `http://localhost:5175/TideVR/?emulate=1` and select **Enter VR**. The
emulator is deliberately opt-in so a development URL cannot replace a
connected headset's native runtime.

Verify:

- Left-stick steering and throttle.
- Right-controller surface aiming.
- Trigger press/hold/release differences across all three abilities.
- The visible Swell crest remains on the rideable wave for its full lifetime.
- Current foam moves with the painted flow and Vortex foam rotates.
- Airborne motion is not redirected by the water below the board.
- A/B ability cycling.
- Stable third-person XR origin movement.
- Moving-water reticle alignment for downward, level, and upward aim.
- No visible seam or nearby edge between the dynamic and far ocean.
- Frame time with `?emulate=1&dev=1`.

## Quest over USB

With developer mode enabled:

```bash
adb reverse tcp:5175 tcp:5175
```

Open `http://localhost:5175/TideVR/` in Meta Quest Browser. WebXR normally
requires a secure context; loopback through ADB is the simplest local path.

Record headset model, refresh rate, browser version, average frame time, and
the ability being stress-tested with performance reports.

Profile three cases for at least 60 seconds each:

1. Baseline riding with wake generation.
2. Continuously painted Current while carving.
3. Repeated Swell/Vortex casts across the wake.

At 72 Hz, target a Quest 3 p95 frame time below 13 ms. If a case misses the
budget, record the active water quality tier and retry with
`?waterQuality=low&dev=1` before changing simulation resolution.

Use the normal URL for play testing. Add `?dev=1` only while profiling; it
enables a head-following panel showing actual XR-loop average/p95 frame time,
session refresh rate, foveation, and projection dimensions.

After Three.js, React Three Fiber, or WebXR changes, verify that the ocean
continues animating while immersive stereo rendering is active. This directly
exercises the XR-safe offscreen water pass.

Run at least two full buoy-course loops. The storm veil must reach full opacity
before the coordinate rebase, and the board, camera, and XR origin must resume
together without losing speed or heading.
