# ArenaGodEyes.Frontend

This project group contains the React-based UI layer for ArenaGodEyes.

## Role

The frontend is not the whole product.

It is the UI that will be hosted by Electron and powered by the local .NET backend.

React + Vite is the renderer only.

The UI must feel like real installed desktop coach software, not like a normal website.

## Layout

- `src/arena-god-eyes-ui`
  - Vite application

## Current State

The current UI already covers:

- settings
- setup validation
- addon install flow
- import actions
- match library
- review screen
- manual ChatGPT export and import
- OBS test and manual controls
- processed thumbnail and video metadata display

## Required Future Screens

- settings
- match and video library
- review dashboard
- video player
- timeline markers
- Details++ metrics
- manual ChatGPT response import and display

## Design Rule

Use the local references in:

- `ArenaGodEyes.Docs/src/skills`
- `ArenaGodEyes.Docs/src/images`
- `ArenaGodEyes.Docs/src/images/IdeaisLayoutUIiUx`
- `ArenaGodEyes.Docs/src/DESKTOP_UI_UX_DIRECTION.md`

Key expectations:

- left desktop sidebar
- top status bar
- dense match and clip cards
- desktop settings tabs
- review workstation with large video player and timeline
- premium dark palette
