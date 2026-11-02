<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The 3D game scene lives in src/components/City3D.tsx (React Three Fiber, route uses ssr:false); game rules/city layout stay in plain TS in src/lib/game.ts so the scene only draws state.
- Imported CC0 models are cloned in CityModels before changing materials; this protects shared cached geometry and textures.
- Projected scene labels use low z-index ranges inside an isolated scene layer; dialogs sit above the whole scene.
- Local game saving retains cash, reputation and upgrades under the existing versioned device save key; no cross-device saving is implied.
- Dev-only window.__game exposes state, minigame(type, easy), dialog(), upgrade(), close(); window.__city exposes state and teleport(x,z,heading), and data-scene-ready marks the first rendered frame for playback checks.
- Driving input has one shared reset for keyboard and touch state; dialog/prompt transitions and focus loss use it to prevent stale controls.
- Vehicle collision uses solid building footprints separately from a smooth terrain height ramp, keeping lawns and curbs traversable.
- Named business properties share LOTS and normal makeJob selection; their footprints, roads and camera avoidance derive from shared layout constants so dispatch and driveable geometry stay aligned.
- Radio uses a single managed HTMLAudioElement playlist; synthesized background sound starts on user interaction and shares the main mute, with teardown on leaving the game.
- Minigames use a stable shared animation loop with transform-only motion and ref-based scoring; React updates only discrete game events, and opaque dialogs suspend hidden 3D frames to avoid competing rendering work.
- Tim reward logic reads the smoking state recorded by his rendered animation; wall-clock time must not independently decide reward availability.
- Rendering budgets live in a shared graphics configuration; hosted 1K surface maps and HDR lighting feed standard materials, one throttled local sun shadow map and half-resolution post effects with SMAA and final tone mapping.
- Keep Three.js and its types on the compatible r180 minor: later releases remove PCFSoftShadowMap, which the requested lightweight shadow pipeline uses.
- Weather timing is a pure game rule driven by the same scene clock as daylight; camera-local rain uses one pooled line buffer, and lens droplets run inside the composer below DOM HUD with no CSS blur or dynamic cube captures.
- Dev-only window.__weather.setTime(seconds) advances the shared scene clock for dry/rain transition checks; window.__weather.state reports particle visibility and camera-local positioning.
- Downtown layout (towers, fountain roundabout, park, stadium) is declared in src/lib/game.ts and drawn by src/components/Downtown.tsx; roundabouts share the ROUNDABOUTS list so terrain, dashes and colliders stay aligned.
