# Sunnyside Life Sim

A Sims 4-inspired **3D mobile landscape life simulation game** built with **Vite, React, TypeScript, React Three Fiber (Three.js), and Zustand**, ready for zero-config deployment on **Vercel**.

## Phase 1 Foundation Features

- **Live Mode & Autonomy**: Playable 3D Sim (**Maya Lin**) with 6 decaying needs (*Hunger, Energy, Bladder, Hygiene, Fun, Social*), Sims-style Emotions & dynamic Plumbob crystal, cancellable Action Queue with radial progress rings, utility-AI **Free Will**, Day/Night lighting cycle, and `Pause / 1x / 3x / 8x` speed controls.
- **Mobile Landscape Touch Controls**: 1-finger pan, 2-finger pinch-zoom & orbit/tilt, tap-vs-drag gesture disambiguation, camera-reactive **Cutaway Walls**, and a screen-clamped **Radial Pie Menu** when tapping floors, objects, or Maya.
- **Starter House & Build/Buy Grid**: Furnished `16 × 16` lot (kitchen/dining, living lounge, bedroom, bathroom, patio) with 8-directional A* pathfinding and a live **Build & Buy Mode** featuring real-time collision validation, `90°` rotation, moving/selling existing furniture (`80%` refund), and Simoleon (`§`) economy.
- **Stylized 3D + GLB-Ready Asset Pipeline**: Lightweight 60 FPS procedural 3D meshes with active interaction effects (glowing TV, stove burner & pot, shower spray, night lamps) backed by `AssetRenderer`, ready to swap in external `.glb` models per catalog item via `modelUrl`.
- **Auto-Save Persistence**: Automatic `localStorage` persistence (`lifesim_save_v1`) plus a one-tap **Reset Starter Lot** option in the settings modal.

## Development Commands

```bash
npm install
npm run dev        # Start local Vite dev server
npm run typecheck  # Strict TypeScript check
npm test -- --run  # Run Vitest simulation & pathfinding tests
npm run build      # Production build (Vercel output: dist/)
```

## Deploying to Vercel

Connect this repository to Vercel with the included `vercel.json`—Vite is auto-detected with SPA fallback routing and immutable caching for `/assets/*` and `/models/*`.
