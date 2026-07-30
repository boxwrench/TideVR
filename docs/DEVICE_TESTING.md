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
- A/B ability cycling.
- Stable third-person XR origin movement.
- Moving-water reticle alignment for downward, level, and upward aim.
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

Use the normal URL for play testing. Add `?dev=1` only while profiling; it
enables a head-following panel showing actual XR-loop average/p95 frame time,
session refresh rate, foveation, and projection dimensions.

After Three.js, React Three Fiber, or WebXR changes, verify that the ocean
continues animating while immersive stereo rendering is active. This directly
exercises the XR-safe offscreen water pass.

Run at least two full buoy-course loops. The storm veil must reach full opacity
before the coordinate rebase, and the board, camera, and XR origin must resume
together without losing speed or heading.
