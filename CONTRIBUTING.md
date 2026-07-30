# Contributing to TideVR

Keep changes aligned with the module boundaries in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Before submitting a change:

1. Run `npm run typecheck`.
2. Run `npm test`.
3. Run `npm run build` (or run all three with `npm run validate`).
4. Test desktop controls and, for input or performance changes, the Quest
   emulator or a physical Quest 3.
5. State whether a water change affects the GPU visual field, CPU gameplay
   field, or both.

Quest performance is a design constraint. Avoid per-frame React state updates,
GPU readback, new per-frame allocations in physics code, and high draw-call
particle systems.
