# The stage

`stage.html` shows the swarm's real runs as a presentation that the presenter controls scene by scene and step by step. It was built by swarm.1.dev.fringe@PrompTugal.dinis on 12 November 2026, at Dinis's word (01:2x UTC): "start, stop, move, zoom in, move out, and also focus completely, minimize things on the left, on the right, resize everything ... every scene needs to tell a story."

| File | What it is | Who changes it |
|---|---|---|
| `stage.html` | The shell: the left pane (story, runs, altitudes), the stage, the right pane (what to say, this run, knobs), and the controls | swarm.1.dev |
| `stage/stage.js` | The engine: the clock, the five views, overlays, anchors and counters | swarm.1.dev |
| `stage/themes.css` | Themes as CSS tokens only: `--alt-<altitude>`, `--bg`, `--accent`, `--reach` and the rest | swarm.1.designer |
| `stage/stage.css` | Layout | either of them |
| `stage/universe.js` | The 3D view: three.js 0.147.0 with bloom, after Silvio's Gravity | swarm.1.designer can restyle it |
| `stage/scenes.json` | The story, as data | storytelling.1, swarm.1.designer, swarm.1.dev |

## The clock

The clock is the Ultimate Insider talk player's.
- Every step has a start and an end.
- → plays the next step from its start, then holds on its built end.
- ← goes back to the previous stop. That is the **end** of the step before, and across a scene boundary it is the end of the previous scene, so a loop is always seen whole.
- Space plays everything through.

Steps are cumulative within a scene. A step's state is every earlier step applied in full, plus its own at progress p.

## A scene

```json
{ "id": "same-privileges", "act": "2 · The same privileges", "title": "Everybody can reach everything",
  "run": "20261111T2134-r4.json",
  "mode": "force",
  "anchors": { "P": "left", "A3": "left", "X": "right" },
  "say": "what the presenter says (the right pane)", "cue": "an optional note for the presenter",
  "steps": [ { "label": "…", "dur": 2.5, "caption": "the one line on screen" } ] }
```

What goes where:
- `run`: a file in `runs/`; `gh:<request id>` for a result in PrompTugal__News__Swarm__Runs; or `sim:mesh`, `sim:mesh10` or `sim:policy`, which are simulated and say so on screen.
- `mode`: `layers` (top-down), `tree`, `radial`, `force` or `universe` (3D). The presenter's keys 1–5 override it.
- `anchors`: keys are an altitude, a kind or a node id. Values are `left`, `right`, `top`, `bottom`, `middle`, `center` or a corner, as in `top-left`. Anchors apply in the force view; `A` turns them off.

## Step keys

A step may set any of these, and they carry forward to the scene's later steps:

| Key | What it does |
|---|---|
| `show` | Altitudes, kinds or ids to show; the rest are hidden. `null` shows everything again. |
| `highlight` | The units to keep bright; the rest are dimmed. `null` clears it. |
| `replay` | `true` replays the run file's timeline across the step: each unit appears when it started and glows while it runs. |
| `assets` | `["Gmail", "Drive", "GitHub", "Database", "Calendar", "Slack", "Zapier"]`: simulated assets join the graph. |
| `overlay` | `"all"`: every unit reaches every asset, the lines drawing in one by one. `"policy"`: only the `owner` reaches them. `"isolated"`: the same as policy, with the cut lines drawn; use it for units running away from the assets. `null` turns the overlay off. |
| `owner` | The id of the unit a policy lets through. In simulated graphs, each asset's `home` is used. |
| `fail` | The id of a unit that loses control: it turns red and pulses, and so do its lines. |
| `counter` | `{ "of": "reach" \| "units" \| "calls" \| "peak" \| "value" \| "summary.<path>", "label": "…", "value": n }` counts up across the step. `summary.<path>` reads the Runs repo's `runs/summary.json`. |
| `bars` | `{ "upto": n, "items": [{ "label", "of": "claude-opus-5.5" \| "claude-sonnet-5.5" \| "claude-haiku-5.5" \| "openrouter", "color" }] }`: the cost story, one bar more per step. |
| `camera` | `"fit"` (the default: the camera refits at each step) or `"hold"`. |
| `mode` | Changes the view for this step. |

## Keys

Press `?` on the page for the full list.

| Key | What it does |
|---|---|
| → / ← | Step forward / back |
| Space | Play or pause |
| PageDown / PageUp | Next / previous scene |
| 1–5 | The views |
| L | Labels on or off |
| + / − | Text size |
| ] / [ | Node size |
| 0 | Fit |
| = / - | Zoom |
| A | Anchors on or off |
| Z | Focus: the stage only |
| Q / E | Hide the left / right pane |
| T | Theme |
| S | Speed |
| H | Auto-advance |
| F | Fullscreen |

Drag a node to move it, and hold shift as you let go to pin it. Double-click a node to focus on its neighbours. Drag a pane's edge to resize it, and double-click the edge to hide the pane.

Add `?scene=<id>` to the URL to open on that scene, and `?mode=` or `?theme=` to set the view or the theme.

## Rules

- Numbers on screen come from the run files.
- Anything simulated says so on screen.
- No model text is stored or shown.

## Linking and embedding a step (12 Nov, Dinis via swarm.1)

- `stage.html#pack=<pack>&step=<id>` opens on that step and plays it. `<id>` is stable: `<scene id>/<label slug>`, e.g. `elsewhere/the-honest-gap`. A number (1..n inside the pack) also works but moves when scenes move.
- Add `&embed` for an iframe: the stage alone, with its controls; the panes, top bar, navigation pill and feedback tab are hidden.
- Every id is listed in `stage/step-ids.json` (`node tools/step-ids.mjs` rebuilds it). On the stage, hover a step bar to see its id, or press U to copy a link to the current step.
- `▶▶ all` (key P) plays the whole story from the scene on screen; `»` on the last scene shows its end.
