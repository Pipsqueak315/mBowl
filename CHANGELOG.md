# Changelog

## v1.0 — March 2026

### Core Features
- 4-tab app: Log, Stats, History, Reference
- Full session logging with frame-by-frame pin tracking (visual pin deck + quick chip entry)
- Draft auto-save with resume/discard on reopen
- Ball picker sorted by strength with per-game assignment

### Stats
- Overall average, high game, high series, strike %, spare %, opens/game
- Series trend and game-by-game trend charts
- Score distribution histogram
- Per-ball performance breakdown
- Common leaves with mini pin diagrams and conversion rates
- All tracked leaves with expand/collapse
- Current Season / All-Time toggle

### History
- Session cards with color-coded scores, expandable frame grids
- Filter by session type (League, Practice, Tournament, Makeup)
- Swipe to edit or delete
- Full session edit modal with all fields

### Reference
- Position table (editable stance/eyes/notes)
- Signals: Switch Guide + Ball Arsenal + Lane Reads (all editable)
- Pocket Diagnostics with Reference/My Data toggle and real leave stats
- Mental: Shot Clock framework + 5 editable cues + Release & Speed card
- Patterns: lane diagrams, suggested lines, filter by type

### Settings
- Season date configuration
- Ball roster management (add, rename, toggle active, edit strength)

### Infrastructure
- EAS Update for OTA deployment to Expo Go
- Auto-export JSON backup to Files app on every data change
- SideStore cert expiry notification (6-day repeating)
- TypeScript throughout, zero tsc errors
