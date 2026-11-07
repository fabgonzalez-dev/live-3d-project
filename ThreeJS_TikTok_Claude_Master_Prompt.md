# Claude implementation prompt: immersive interactive audiovisual studio

Act as a senior creative developer, Three.js graphics engineer, shader artist, and TypeScript application engineer. Build a complete, locally runnable application for broadcasting original, continuously evolving 3D visuals with ambient music and TikTok viewer interaction. Implement working code, not merely an architecture proposal.

## 1. Objective and scope

The flagship experience is an immersive glowing tunnel: a deep central vanishing point, twisting faceted walls, rich blue/violet/magenta colors, countless luminous star-like particles, slow forward travel, and restrained cinematic bloom. It must feel beautiful, spatial, calm, and intentionally art-directed. A generic starfield, rotating wireframe cylinder, or bright neon rings alone does not satisfy the brief.

If I attach reference screenshots, analyze their composition, geometry, lighting, particle distribution, contrast, and palette before implementation. Reproduce the general aesthetic with original procedural artwork; exclude TikTok's interface, usernames, gift graphics, and comments from the artwork. If no reference is attached, proceed using this specification.

Primary environment: a Mac, with its exact hardware initially unknown. Chrome is the initial graphics target. Include practical Safari compatibility notes. Support a vertical broadcast output and a separate operator panel. Rendering and audio must work without TikTok connectivity. Never claim live connectivity, stream eligibility, music rights, or hardware performance without verification.

Deliver the complete project incrementally. Begin with the flagship tunnel and an executable application; expand through the milestones below. Do not halt after a plan or ask for approval between routine implementation phases. Ask only if a genuinely blocking dependency cannot be resolved using a reasonable default.

## 2. Authoritative documentation and API discipline

Read current official documentation before implementing version-sensitive APIs. Use the Three.js manual, API documentation, official examples, and source as the primary graphics references:

- Manual index: https://threejs.org/manual/
- API index: https://threejs.org/docs/
- Installation: https://threejs.org/manual/pages/installation.html
- Creating a scene: https://threejs.org/manual/pages/creating-a-scene.html
- Post-processing: https://threejs.org/manual/pages/post-processing.html
- Color management: https://threejs.org/manual/pages/color-management.html
- Cleanup: https://threejs.org/manual/pages/cleanup.html
- Resource disposal: https://threejs.org/manual/pages/how-to-dispose-of-objects.html
- WebGLRenderer: https://threejs.org/docs/pages/WebGLRenderer.html
- ShaderMaterial: https://threejs.org/docs/pages/ShaderMaterial.html
- BufferGeometry: https://threejs.org/docs/pages/BufferGeometry.html
- Points: https://threejs.org/docs/pages/Points.html
- InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
- EffectComposer: https://threejs.org/docs/pages/EffectComposer.html
- UnrealBloomPass: https://threejs.org/docs/pages/UnrealBloomPass.html
- OutputPass: https://threejs.org/docs/pages/OutputPass.html
- AudioAnalyser: https://threejs.org/docs/pages/AudioAnalyser.html
- Bloom example: https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html
- Particle example: https://threejs.org/examples/webgl_points_sprites.html

If a URL has moved, find its replacement through the official index. Do not pretend an inaccessible page was read. State if browsing is unavailable and identify APIs needing verification. Add a documentation map to the README linking implemented features to their official references.

Select and pin a stable Three.js release and compatible dependencies. Keep core and addons on that same release; use supported ES module addon imports. Do not mix old examples, deprecated color APIs, WebGPU-specific materials, and WebGL post-processing. Use WebGLRenderer with GLSL ShaderMaterial for the first implementation. Explain significant deviations.

## 3. Technology and project structure

Use TypeScript, Vite, Three.js, and a local Node.js service. Prefer a lightweight HTML/CSS/TypeScript operator interface; React is optional only if it materially simplifies the interface. Avoid unnecessary frameworks, databases, paid services, authentication providers, and cloud deployment.

Suggested structure, adjustable with justification:

    src/rendering/       renderer, camera, composer, quality manager
    src/scenes/          crystal tunnel, aurora passage, cosmic garden
    src/shaders/         explicit GLSL source files
    src/audio/           playlist, analysis, procedural ambient fallback
    src/state/           typed configuration, presets, transitions
    src/ui/              operator controls and broadcast overlays
    src/shared/          shared event types and validation
    server/adapters/     simulated and TikTok event sources
    server/engine/       voting, deduplication, scheduling, reconnects
    tests/               meaningful behavioral and integration tests
    public/audio/        user-supplied soundtrack assets, initially empty
    docs/                setup, references, operations, music production

Provide npm scripts for development, production build, local production serving, type checking, and tests. Prefer one command to start the local service and frontend. Production serving must support both application routes and WebSocket connections. Bind services to loopback by default. Include lockfile, .env.example, .gitignore, README, and useful errors for missing dependencies or unsupported graphics.

## 4. Flagship visual: crystal tunnel

### Composition

- Portrait-first, 9:16 composition, centered or subtly offset vanishing point, strong perspective, visible near/mid/far depth layers.
- Black or near-black negative spaces between luminous surfaces. Preserve dark areas so the image does not become a uniform glowing blur.
- Rich saturated wall colors and brighter small highlights. Avoid clipping most highlights to white.
- No text, debug widgets, control handles, grids, axes, or placeholder geometry in clean output.
- Keep important visual action away from configurable overlay exclusion zones; these are operator guides, not assumptions about fixed TikTok UI dimensions.

### Geometry and movement

- Build an inward-facing tunnel mesh with enough radial and longitudinal subdivisions for a faceted/crystalline appearance.
- Vary radius, angular twist, and surface displacement using coherent functions or noise. Keep the camera corridor open and avoid geometry intersecting the camera.
- Generate slow evolving folds and ridges; normals and shading must remain consistent with displacement. Explain whether normals are analytic, derivative-based, or recomputed.
- Simulate endless forward movement through wrapped geometry, procedural scrolling, or seamless recycled segments. Hide joins with continuous coordinates and depth attenuation; no visible reset.
- Use frame-rate-independent motion and smoothly interpolated parameter changes. Avoid large delta-time jumps after suspension.
- Forward motion, rotation, wall deformation, and particles should move at related but nonidentical rates to create parallax.
- Keep rotations slow, avoid abrupt camera roll, and offer a low-motion preset.

### Material and lighting

- Use custom GLSL shaders for spatial color variation, emissive ridges, crystalline highlights, and subtle flowing detail.
- Faceted reflective-looking shading is acceptable; do not claim physical reflection if using an approximation. Prefer an inexpensive procedural effect over a large external HDR asset.
- Provide a clear parameter model: base palette, emissive intensity, fold amplitude, twist, pattern scale, flow speed, and highlight sharpness.
- Keep randomized values seeded for reproducible testing and preset previews.

### Particles

- Use BufferGeometry/Points with shaders or suitable instancing. Never create an Object3D and material for each particle.
- Initial tunable particle budgets: low 2,000, medium 8,000, high 20,000. These are starting budgets, not guaranteed performance targets.
- Distribute particles in multiple depth layers, including wall-adjacent clusters and sparse foreground sparkles.
- Recycle positions seamlessly with no allocation or regeneration of the full particle system every frame.
- Use procedural sprite masks for soft points and occasional four-point star shapes. Vary brightness, size, phase, and drift. Avoid identical dots moving together.
- Respect hardware point-size limits; use instanced quads if needed for larger stars. Explain transparency/depth-write choices and limit additive overdraw.

## 5. Additional visual scenes

Implement these after the tunnel is visually convincing and stable. Reuse rendering, transitions, audio, quality settings, and event handling.

Aurora passage: layered translucent-looking ribbons with smooth undulation, subtle volumetric-looking depth through inexpensive approximations, drifting lights, cyan/green/violet palettes. It must have a genuinely different silhouette and motion from the tunnel.

Cosmic garden: original radial or branching luminous forms that slowly unfold, with controlled symmetry, floating particles, and gentle constellation accents. Avoid dense visual noise and expensive unconstrained recursive growth.

Define a scene lifecycle contract such as initialize, update, resize, apply state, trigger effect, and dispose. Scene transitions should be smooth and should not double GPU load indefinitely. A short fade is acceptable for initial release; use dual-render-target crossfades only where the quality budget permits. Prewarm shaders where practical to reduce first-use stalls.

## 6. Rendering, color, and performance

- Use one persistent renderer and one animation owner. Avoid duplicated loops when routes or scenes change.
- Set color handling, tone mapping, exposure, and final output conversion according to the selected release's documentation. Perform lighting and blending in the correct working space.
- Build a deliberate pipeline, initially RenderPass -> UnrealBloomPass -> OutputPass, adjusted if current documentation requires it. Apply tone mapping/output conversion once; custom shaders must not accidentally apply it a second time before bloom.
- Bloom settings are adjustable: strength, radius, threshold. Keep the core image legible without bloom. Optional vignette is subtle; chromatic aberration defaults off.
- Resize renderer, composer, camera, render targets, and shader resolution uniforms consistently. Separate CSS size, drawing-buffer size, and device pixel ratio; avoid multiplying DPR twice.
- Cap pixel ratio and provide render-scale controls. Default to balanced settings, not unrestricted Retina resolution.
- Output presets: 720x1280/30 fps, 1080x1920/30 fps, optional 60 fps after measurement. Provide landscape preview without distorting the scene.
- Adapt quality using smoothed frame time and hysteresis. Reduce resolution/bloom cost before making distracting large particle changes. Prevent rapid oscillation and expose manual override.
- Diagnostics: FPS, frame time, active quality, draw calls, triangles/points where available, renderer resource counts, connection state, audio state, queue size. Label JS memory metrics as browser-dependent and renderer counts as counts, not GPU-byte measurements.
- Avoid per-frame object allocation, unbounded history, accumulating listeners, and unnecessary DOM updates. Reuse vectors, typed arrays, materials, and geometry.
- Dispose owned geometries, materials, textures, render targets, composer passes where applicable, object URLs, listeners, sockets, and audio connections. Maintain explicit ownership for shared resources.
- Handle WebGL context loss with operator status and recovery or a clear restart path. Do not silently create endless replacement contexts.
- Start graphics without network asset downloads. Bundle required runtime assets/dependencies locally in the production build.

## 7. State, palettes, and transitions

Maintain one authoritative shared session state in the local service; the display consumes snapshots/events and the control panel sends validated commands. Keep render interpolation local to the display. A frontend-only demo may use the same protocol through an in-memory adapter.

Provide at least six carefully designed palettes: deep blue/violet, magenta/plum, teal/cyan, emerald/blue, warm amber, and soft pastel. Colors should vary across walls, highlights, particles, and distant fog rather than tinting every pixel identically.

Default palette transition: five seconds with easing. Color voting must not abruptly overwrite ongoing special effects. Store a bounded set of named presets as versioned JSON and support import/export with schema validation and sensible migration behavior. Persist ordinary settings locally, never secrets. Include reset to defaults.

Controls must have documented units, ranges, defaults, and clamping: travel speed, rotation speed, displacement amplitude, particle density/size, bloom, exposure, audio influence, render scale, FPS target, scene, and palette.

## 8. Operator and clean broadcast views

Provide /control and /display routes.

/control: preview thumbnail or optional preview, scene selection, palettes, transition duration, visual controls, playback controls, event connection status, simulated event buttons, vote/queue monitoring, preset import/export, clean-output link, fullscreen instructions, and a clear emergency control to disable interactions while visuals/music continue.

/display: artwork and optional minimal overlay only. No configuration controls or diagnostic panels by default. Offer an overlay toggle and configurable safe zones. Display a small instruction such as 'Vote: blue / pink / teal' when enabled. Never display raw untrusted chat HTML. Escape text, limit length, and support disabling usernames.

Use a single active broadcast renderer. Avoid rendering a full-resolution second preview by default. Synchronize panels via the local service. If multiple display instances are opened, warn the operator; prevent accidental duplicate audio playback by requiring explicit audio activation on the chosen display.

Browser autoplay rules apply: include an explicit Start session/Enable audio step on the output surface where necessary. Do not claim a button on another tab can always unlock this tab's AudioContext. Document embedded browser-source audio activation separately and provide a window-capture fallback.

Keyboard shortcuts must be documented, avoid typing conflicts, and require focus or deliberate enablement. Fullscreen requires a user gesture. Keep the control interface useful on a narrow screen.

## 9. Audio playback and analysis

Build an audio engine using Web Audio APIs, with Three.js audio helpers only where beneficial. Three.js documentation covers graphics/audio helpers; use official Web Audio/MDN references for browser audio behavior.

Required:

- Load user-supplied local audio or a local playlist manifest; handle unsupported formats and decode errors gracefully.
- Play, pause, next, previous, volume, mute, shuffle-without-immediate-repeat, and a configurable 5-15 second equal-power crossfade.
- Keep at most the current and next tracks decoded or otherwise use bounded buffering. Do not decode hours of music into memory at once.
- Smoothly ramp gains to prevent clicks. Crossfades must account for short tracks and end-of-playlist behavior.
- Analyze the same signal being played, using low/mid/high energy plus overall loudness with attack/release smoothing. Do not open the microphone by default.
- Modulate emissive intensity, particle shimmer, and small surface movement within bounded ranges. Music must not cause camera shake, strobe, or rapid palette changes.
- Include a deterministic, locally synthesized ambient demo using simple pads, slow chords, sparse notes, and gentle modulation; use no unlicensed samples or copied melody. It should demonstrate functionality, not pretend to be a finished album.
- Procedural mode must use bounded scheduling and voices, release completed nodes, and pause/resume correctly. Handle unavailable audio devices or suspended AudioContext without crashing visuals.
- Provide an operator-controlled master gain and clipping protection. Do not describe compression as true loudness normalization or a guaranteed true-peak limiter.
- Make exactly one audio owner and one intended broadcasting audio path explicit to prevent doubled music.

Add a music-production guide describing an optional offline AI-assisted workflow: generate instrumental ambient candidates, audition, edit artifacts, match levels, sequence compatible tracks, and export a 60-90 minute library. Include three generic production briefs for the visual themes, without imitating named artists. No music-generation API or paid subscription is required for the application to run. Do not fabricate commercial rights; instruct the operator to verify current service terms for the specific creation/download workflow and retain records. Do not promise therapeutic effects.

## 10. Interaction engine and event contract

Create a provider-independent event interface with a simulator first and a separately configurable live adapter. Keep provider payloads out of rendering modules.

Normalized events should include an internal unique ID, optional provider event ID, provider, received timestamp, optional provider timestamp, type, opaque user ID if available, bounded display name, and typed payload. Handle chat, likes, gifts, follows, connection changes, and moderator/operator commands. Optional data must not be invented.

Validate external messages at the service boundary. Limit message sizes, event rates, queue length, retained history, and deduplication TTL. Never execute chat as code, shell commands, URLs, or HTML. Keep any connector credentials in environment variables on the service side; never put them in frontend bundles or broadcast URLs.

Color voting:

- English/Spanish allowlisted aliases, case-insensitive normalization, exact supported commands, and reasonable accent handling.
- Default round length 20 seconds; one active vote per user per round, replaceable by a newer vote.
- If no stable user ID exists, use a clearly documented bounded fallback, not an assumption that display names are unique.
- Deterministic tie-break rule, visible round timing, no-vote behavior, and smooth winner transitions.
- Do not change color on every comment. Do not send unsolicited chat replies.

Gifts:

- Operator-configurable mapping from provider gift identifiers to effects. Fetch/verify identifiers or configure them; do not hard-code guessed IDs or values.
- Handle provider streak/combination semantics so a running streak is not charged/triggered repeatedly as a final streak.
- Document whether a mapping triggers once per completed streak or uses a capped aggregate count.
- Default effects: sparkle wave, constellation, and temporary aurora veil. Duration 8-12 seconds, configurable cooldown, bounded concurrency.
- Temporary effects restore the current underlying scene/palette state instead of an obsolete snapshot.
- No random prizes, payout estimates, spending pressure, or misleading promises.

Likes/follows:

- Aggregate like activity into gentle waves. Distinguish cumulative counters from incremental counts before normalization.
- Follow events create capped short-lived stars; do not allocate an unlimited persistent object per follower.

Scheduling and failure behavior:

- Priority: emergency/operator commands, already-running special effect, scheduled palette/scene transition, ambient automatic evolution.
- Explicit bounded queues, effect coalescing/expiry, and cancellation rules. Do not replay stale actions after reconnect.
- Keep animation/audio running if the event provider is offline. Show status only to the operator unless they enable a broadcast notice.
- Reconnect with bounded exponential backoff and jitter; stop on unrecoverable authorization/configuration failures with actionable messages.
- Normalize and test with recorded synthetic fixtures, never real personal data committed to the repository.

Live adapter: investigate the current documented interface of https://github.com/zerodytrash/TikTok-Live-Connector and verify its requirements before implementation. It is unofficial; isolate it, make it optional, and disclose connectivity dependencies. TikFinity is an alternative only where its required capabilities and OS support are verified. Do not claim an official general-purpose TikTok LIVE events API exists without an authoritative source. Do not bypass permissions, streaming restrictions, or access controls. If live access cannot be verified, deliver the fully functioning simulator and document the precise remaining integration step.

## 11. Streaming and operating guide

The application produces audiovisual output; it does not independently grant TikTok LIVE access or publish a stream.

Document /display capture using an available OBS browser source or window capture. Describe alternative TikTok LIVE Studio capture only after verifying its current OS support and source capabilities. Direct OBS publishing requires an account-supported destination; never assume a stream key is available.

Provide a step-by-step setup: start local services, open control/output, enable audio in the correct surface, choose output resolution, add capture source, select one audio route, perform a local recording, verify sound and overlays, then use the account's supported broadcasting route. Explain how to check duplicate audio and handle capture audio separately from an OBS virtual camera video feed.

Keep this local-first. No public inbound port or hosted backend is needed initially. Reject unauthorized/origin-mismatched control connections; restrict WebSocket origins and validate local control commands. If remote access is added later, require explicit authentication and a separate design.

Include a preflight and recovery guide: power/sleep settings, stable internet, audio check, GPU load, connector status, emergency interaction toggle, fallback preset, and restart instructions. Keep it practical and avoid implying unattended 24/7 streaming is approved or guaranteed.

## 12. Verification and acceptance criteria

Run installation/build/type checks and meaningful tests. Fix failures before claiming completion. Use tests for complex state and event behavior, not superficial assertions that merely repeat implementation constants.

Required automated behavioral coverage: vote replacement and ties, malformed events, deduplication expiry, cumulative versus incremental likes, repeated gift streak payloads, bounded queues/expiry, disconnect/reconnect handling, preset validation, and temporary-effect restoration after an underlying palette change.

Browser verification: initial render, route loading, resizing, fullscreen controls where feasible, audio activation, playback/crossfade, scene switching, simulated interactions, and clean-output isolation. Capture visual evidence at portrait resolution if tools allow. Report actual visual inspection; do not equate a successful build with beautiful graphics.

Performance/reliability checks:

- Record hardware/browser, resolution, quality, FPS/frame-time observations, and whether broadcasting/capture was running.
- Target stable 30 fps at 720x1280 on the tested machine; do not claim universal performance on unknown hardware.
- Run a practical short soak test and provide a reproducible two-hour soak procedure. Do not claim a two-hour pass if it was not run.
- Repeated scene switching must return resource counts toward a stable baseline; account for documented renderer caches rather than requiring zero resources.
- Simulate a bounded burst of at least 1,000 chat events plus gifts and verify responsive controls and bounded memory/queues.
- Visual quality: convincing depth, layered particles, readable dark spaces, controlled bloom, no obvious recycling seams, no abrupt transitions, and visually distinct additional scenes.
- No uncaught errors, shader compilation errors, duplicate animation loops, duplicate music playback, or exposed secrets.

## 13. Implementation milestones and deliverables

Milestone A: initialize project, pin versions, document source choices, create display/control routes, and deliver the convincing tunnel with manual controls and deterministic demo mode. Run build/type checks and inspect the image before proceeding.

Milestone B: add palettes, smooth transitions, presets, quality profiles, diagnostics, and robust scene lifecycle/resource management. Add aurora and garden scenes after the flagship meets quality goals.

Milestone C: add bounded audio playback, crossfades, music analysis, procedural demo audio, and the music-production guide. Verify actual audio activation and routing.

Milestone D: implement normalized events, simulator, voting, gifts, likes/follows, queues, automated behavior tests, and optional live adapter. Keep manual/demo operation independent of live access.

Milestone E: validate production serving, capture workflow, resilience, performance, and operating documentation. Present exact startup commands, implemented features, measured checks, and remaining external dependencies.

For every milestone, create/modify actual files when filesystem tools are available, run relevant checks, and summarize results concisely. If only chat output is possible, provide complete files with paths in manageable batches, maintain a manifest, and never use 'implementation omitted' for required functionality. Maintain a progress checklist so subsequent sessions resume accurately.

Deliver a runnable repository, complete shaders, config examples, tests, README, feature-to-documentation map, music-production guide, streaming guide, and known-limitations list. Avoid a single giant source file, fake TikTok integration, unlicensed assets, excessive architectural scaffolding, and unfinished placeholders presented as working features.

Start now by verifying the official references and dependency versions, stating a short architecture and milestone checklist, then implementing Milestone A. Continue through the remaining milestones as the execution environment permits.
