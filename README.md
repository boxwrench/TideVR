# TideVR

TideVR is a WebXR hydrofoil/surfing game where the playable surface is living
water. The player does not shoot water at targets: they conduct the ocean and
ride the consequences.

This repository begins from SnowVR's proven React, Three.js, and Quest input
toolchain, but its simulation and rendering code are new. SnowVR stores
persistent terrain deformation; TideVR evolves temporary height, velocity, and
foam fields.

## Foundation status

The first runnable foundation includes:

- Quest/WebXR entry plus desktop fallback controls.
- A third-person hydroboard with center, front, back, left, and right water
  samples.
- Separate water-contact, airborne, and landing behavior.
- Four synchronized broad swells on the CPU and GPU, with finer shader-only
  ripples for readable detail without destabilizing board physics.
- A 512² RGBA16F GPU water simulation fixed at 30 Hz.
- A separate 64² CPU gameplay field; board physics never reads the GPU.
- Swell, Current, Vortex, and continuous hydroboard wake commands sent to both
  fields, with bounded deformation and distinct transient cast visuals.
- A carved wake trough with raised foam rails that follows and records the
  rider's turns for several seconds.
- A lightweight buoy route, horizon atmosphere, foam, Fresnel, and sun glints.
- XR-safe offscreen compute passes that preserve the headset framebuffer.
- Right-controller-origin moving-water aiming, a visible range guide with
  meter readout, masked course rebasing, and corrected XR chase orientation.
- In-headset ability/status UI, optional native XR diagnostics, procedural
  wind/water audio, and tested input lifecycle handling.

The ability tuning is intentionally first-pass. Course timing, scoring,
hydromancy energy, storm progression, adaptive effects, audio, and
rider-following domain recentering are roadmap work.

## Controls

| Input | Action |
| --- | --- |
| Left thumbstick / WASD / arrows | Accelerate, brake, and carve |
| Left trigger or grip / Space | Hydroboard boost |
| Right controller ray / mouse | Aim at the water |
| Right trigger or grip / left mouse / E / Shift | Use the selected ability |
| Quest A or B / keys 1–3 | Select an ability |
| Right mouse drag | Inspect with the desktop orbit camera |

Swell charges while held and launches on release. Current paints while held.
Vortex fires on press.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:5175/TideVR/`. The development build installs the WebXR
emulator only when requested with
`http://localhost:5175/TideVR/?emulate=1`, so it cannot replace a connected
native headset. Add `&dev=1` for in-headset performance diagnostics.

## Play online

The latest `main` build is deployed automatically to:

**https://boxwrench.github.io/TideVR/**

GitHub Pages supplies the secure HTTPS context required by WebXR. Open the URL
in Meta Browser on a Quest headset and select **Enter VR**.

## Validate

```bash
npm run typecheck
npm test
npm run build
npm run validate
```

## Project map

```text
src/
  game/          Ability definitions and shared water commands
  player/        Hydroboard input, contact states, and chase camera
  water/         CPU field, GPU simulation, surface material, and wave math
  environment/   Sky, fog, buoys, and course scale references
  rendering/     XR-safe offscreen render-pass utilities
  ui/            Ability and performance overlays
  utils/         Frame-independent timing helpers
  xr/            WebXR session store
docs/
  ARCHITECTURE.md
  GAMEPLAY.md
  ROADMAP.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system boundaries and
[docs/GAMEPLAY.md](docs/GAMEPLAY.md) for the design brief.
