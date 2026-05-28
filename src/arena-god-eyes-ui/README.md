# ArenaGodEyes UI

This app is the React + TypeScript + Vite UI layer for ArenaGodEyes.

## Product Boundary

This app is not a standalone website.

It is meant to be hosted inside the Electron desktop shell and communicate with the local .NET backend.

## Current Direction

The UI already supports:

- settings and setup flows
- match list and review flows
- manual ChatGPT prompt export and response import
- OBS status and manual recording controls
- video thumbnail and metadata display

The next UI evolution should focus on:

- clip review actions
- richer Details++ metrics
- stronger validation target display
- deeper video-review workflow

## Development Rule

Keep following the local guides in `ArenaGodEyes.Docs/src/skills`, especially `react` and `ui-ux-pro-max`.
