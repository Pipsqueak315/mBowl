# mBowl — Rebuild Reference

Step-by-step guide to rebuild the mBowl IPA on Mac and sideload it via iloader on PC. Every command and Xcode setting captured so the process can be repeated from scratch without live help.

---

## Prerequisites

### Mac
- **Node.js** — download from nodejs.org (LTS version)
- **Git** — included with Xcode Command Line Tools; installs automatically when you first run `git`
- **Xcode** — download from the Mac App Store (free, ~10 GB)
- **Homebrew** — install from brew.sh if not present: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **CocoaPods** — install via Homebrew, NOT system Ruby:
  ```
  brew install cocoapods
  ```
  If prebuild fails with ffi errors, install the ffi gem manually first:
  ```
  sudo gem install ffi
  ```

### PC
- **iloader** — download from the SideStore website
- **iTunes** — required for USB device detection; install from apple.com or Microsoft Store

### iPhone
- **SideStore** already installed and set up
- **Developer Mode** enabled: Settings → Privacy & Security → Developer Mode → ON

---

## Clone and Install

Repo is private — authenticate via GitHub CLI (`gh auth login`) or HTTPS with a personal access token when prompted.

```
git clone https://github.com/Pipsqueak315/mBowl.git
cd mBowl
npm install
```

---

## Expo Prebuild

```
npx expo prebuild --platform ios
```

- When prompted for bundle ID, confirm: **com.marcus.mbowl**
- CocoaPods runs automatically at the end of prebuild
- You will see CocoaPods ffi warnings in the output — these are harmless noise, ignore them

**If CocoaPods fails during prebuild**, run it manually:

```
cd ios
pod install
cd ..
```

---

## Xcode Configuration

Open the workspace file — always use `.xcworkspace`, never `.xcodeproj`:

```
open ios/mBowl.xcworkspace
```

### Add Apple ID
- Xcode → Settings (⌘,) → Accounts tab
- Click **+** → Apple ID → sign in if not already present

### Signing & Capabilities
- In the left sidebar, click the **mBowl** project (top of file tree)
- Select the **mBowl** target (under TARGETS)
- Go to the **Signing & Capabilities** tab
- Set:
  - **Automatically manage signing:** ON (checkbox checked)
  - **Team:** Marcus Castro (Personal Team)
  - **Bundle Identifier:** com.marcus.mbowl

### Remove Push Notifications (if present)
- Still on Signing & Capabilities tab, scroll down to capability tiles
- If **Push Notifications** appears as a capability tile, click the **×** to remove it
- Free Apple IDs do not support Push Notifications — removing it is required for the archive to succeed
- Local notifications (cert reminder) still work fine without this capability

### Set Destination
- In the toolbar at the top of Xcode, click the device/simulator selector
- Choose **Any iOS Device (arm64)**
- Do NOT select a simulator — archive only works with a device target

---

## Archive and Export IPA

### Archive
- **Product → Archive**
- Wait 5–15 minutes for the build to complete
- The Organizer window opens automatically when done

### Export IPA (Manual Method — no paid developer account needed)

Do NOT use "Distribute App" in the Organizer — it requires a paid Apple Developer account.

Instead, create the IPA manually in Terminal:

```
mkdir ~/Desktop/Payload
```

The archive folder name contains invisible special characters — always use a wildcard path:

```
cp -r ~/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/*.xcarchive/Products/Applications/mBowl.app ~/Desktop/Payload/
```

```
cd ~/Desktop
zip -r mBowl.ipa Payload
rm -rf Payload
```

IPA is now at: **~/Desktop/mBowl.ipa**

---

## Transfer IPA to PC

Choose any of these methods:

- **iCloud Drive** — copy mBowl.ipa to iCloud Drive → Documents. Visible on PC if iCloud for Windows is installed. Most reliable.
- **AirDrop** — note: AirDrop to PC may try to install the IPA as an app instead of saving it as a file. If that happens, use iCloud Drive instead.
- **USB / email / any file transfer** — any method that gets mBowl.ipa into a folder on the PC works.

---

## Sideload via iloader (PC)

1. Connect iPhone to PC via USB
2. Open iloader
3. Confirm device is detected — should show iPhone name and "Selected"
4. Click **Import IPA** → browse to mBowl.ipa → select it
5. Wait for "operation completed"
6. On iPhone: Settings → General → VPN & Device Management → trust Apple ID if prompted
7. Open mBowl from the home screen — verify it loads and data is correct

---

## Cert Refresh (every 6–7 days)

The free Apple ID cert that signs the app expires every 7 days. The in-app notification fires at day 6 as a reminder.

**Refresh via iloader (PC):**
1. Plug iPhone into PC via USB
2. Open iloader
3. Use iloader to refresh the cert for mBowl

**Refresh via SideStore (iPhone):**
1. Connect LocalDevVPN on iPhone
2. Open SideStore → My Apps
3. Tap the day counter on the mBowl tile to refresh

If LocalDevVPN shows a StosVPN error, use the iloader PC method instead.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| CocoaPods ffi warnings during prebuild | Harmless noise — ignore, prebuild still succeeds |
| "Push Notifications capability" error in Xcode | Remove the Push Notifications capability tile from Signing & Capabilities — not needed, cert reminder uses local notifications |
| Archive fails: no signing certificate | Xcode → Settings → Accounts → make sure Apple ID is added and team shows as "Marcus Castro (Personal Team)" |
| Archive folder path errors | Always use `*.xcarchive` wildcard — the folder name has invisible characters that break tab-complete |
| AirDrop sends IPA as app install instead of file | Use iCloud Drive → Documents transfer instead |
| "AFC unable to manage files" error in SideStore | Pairing file issue — in iloader, use "Manage Pairing File" → place pairing file next to SideStore |
| StosVPN error when refreshing SideStore cert | Use iloader from PC to refresh instead of SideStore on iPhone |
| mBowl data missing after reinstall | JSON backup is at On My iPhone → mBowl → mBowl-backup.json in Files app — import manually or wait for iCloud sync |
