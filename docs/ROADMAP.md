# TideVR roadmap

## Current plateau

The water-truth pass is complete:

- Swell feedback is attached to the crest sampled from gameplay water.
- Horizontal water forces are contact-dependent and use relative Current
  velocity.
- Velocity and foam advect in the CPU and GPU fields.
- The dynamic near ocean blends into an analytic 900-meter horizon skirt.
- Water aiming and Swell cue searches run at 30 Hz.
- Render-only low, medium, and high ocean quality tiers are available without
  changing gameplay simulation resolution.

The next priority is Quest 3 profiling followed by carving spray, landing
splash, and continuous wake presentation. The controller should be decomposed
further before adding the Storm Run game-state systems.

## 1. Riding foundation

- Flat/open ocean and chase camera.
- Quest left-stick and desktop carving.
- Automatic wake and course-scale buoys.

Exit: the rider can hold a comfortable line and complete a simple loop on
desktop and Quest.

## 2. Water contact

- Five-point height, slope, and current sampling.
- Water-contact, airborne, and landing states.
- Tune pitch, roll, crest launches, and impact recovery.

Exit: jumps are intentional and landings are readable rather than surface
snaps.

## 3. Base ocean

- Multi-scale procedural waves.
- Fresnel, depth color, glints, and crest foam.
- Establish CPU/GPU agreement and Quest frame budget.

Exit: surface shape remains readable without reflection or refraction passes.

## 4. Swell

- Charge, energy cost, propagation, flattening, and surf interaction.
- Crest VFX, wake response, haptics, and launch tuning.

## 5. Current

- Painted flow ribbons.
- Foam direction, object advection, favorable acceleration, and opposing drag.

## 6. Vortex

- Smooth radial falloff, depression, banked spiral, danger zone, and slingshot
  exits.

## 7. Feedback and scale

- Adaptive spray/foam particles.
- Procedural wind, board, wave, and impact audio.
- Crest and landing haptics.
- Debris, ships, storm fronts, and distant lightning.

## 8. Storm Run

- Three-minute gate course.
- Hydromancy energy, pickups, scoring, misses, crashes, and finish beacon.
- Combination scoring for turbulence and shaped wave routes.

## 9. Endless ocean

- Rider-following water domains.
- World-origin rebasing.
- Storm atmosphere progression and procedural course continuation.

## Foundation notes

The current repository deliberately touches stages 1–6 at prototype fidelity
to prove the shared command and dual-field architecture. Each stage still
needs its focused feel, art, performance, and device-testing pass before it is
complete.

The reusable Quest foundation now includes tested session/input policy,
XR-safe GPU passes, moving-surface aiming, masked coordinate rebasing,
in-headset diagnostics/status, and telemetry-driven procedural board audio.
