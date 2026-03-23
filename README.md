# mBowl

Personal iPhone bowling tracker and coaching app. Built for one bowler — not a generic score tracker.

## What It Does

- **Log** sessions with full frame-by-frame pin tracking
- **Stats** dashboard with averages, trends, strike/spare rates, leave analysis, and per-ball performance
- **History** of every session, filterable and searchable
- **Reference** tab with personalized coaching content: switch guide, shot clock, pocket diagnostics, lane reads, pattern library, and release data

## Tech Stack

- React Native via Expo (SDK 54, Expo Router 6)
- AsyncStorage for all persistence
- TypeScript
- Apple dark mode design language (SF Pro, SF Symbols, teal accent)

## Development

Requires Node.js and Expo CLI.

```bash
npm install
npx expo start
```

Preview on iPhone via Expo Go, or deploy OTA via EAS Update.

## Deployment

- **Expo Go**: `eas update --branch preview --message "description"`
- **Standalone IPA**: Built via `expo prebuild` + Xcode Archive on Mac, sideloaded via SideStore

## Project Structure

```
app/           — Expo Router screens (tabs + log-frames)
components/    — Shared UI components
src/           — Data layer (storage, seeds, types, utilities)
scripts/       — Asset generation
```

## Not on the App Store

This is a personal tool, sideloaded via SideStore. Not intended for public distribution.
