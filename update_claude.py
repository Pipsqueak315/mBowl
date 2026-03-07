import os

claude_md_path = r'C:\Users\marcus\Desktop\mBowl\CLAUDE.md'

with open(claude_md_path, 'r') as f:
    content = f.read()

content = content.replace('mBowl-SessionBrief-REV02.md', 'mBowl-SessionBrief-REV04.md')
content = content.replace('mBowl-SessionBrief-REV03.md', 'mBowl-SessionBrief-REV04.md')

addon = """

---

## Project Path (Locked)

C:\\Users\\marcus\\Desktop\\mBowl

All brief writes go here. Never ask Marcus to confirm this path again.

---

## End of Phase Protocol

Run this at the end of every phase, in order. Do not skip steps.

### Step 1 - Verify Phase Completion
Run phase-specific checks listed below. Do not mark complete if any check fails.

### Step 2 - Update the Brief
- Mark phase complete in Build Schedule table
- Update Current Status block at top
- Add completion date to phase header
- Write thorough session notes covering: files created/modified, version pins, workarounds, decisions made, issues hit and how resolved, anything the next session needs to know. Vague notes are not acceptable. The next session starts cold with zero memory.
- Add row to Session Notes table at bottom
- Increment RevXX number by 1 in filename and header

### Step 3 - Write the Updated Brief
Use python script file method only (never heredoc in PowerShell).
Write to both:
- C:\\Users\\marcus\\Desktop\\mBowl\\mBowl-SessionBrief-REVXX.md
- C:\\Users\\marcus\\Desktop\\mBowl-SessionBrief-REVXX.md
Confirm both files exist after writing.

### Step 4 - Git Commit
cd C:\\Users\\marcus\\Desktop\\mBowl
git add .
git commit -m "Phase X complete -- [one line description]"
Confirm commit hash to Marcus.

### Step 5 - Wrap Confirmation
Output this exact block:
Phase X complete and verified.
Brief updated: mBowl-SessionBrief-REVXX.md
Written to project folder + Desktop backup
Git committed: [hash]
One manual step: upload mBowl-SessionBrief-REVXX.md to Claude.ai project Knowledge folder.
Next up: Phase X+1 -- [phase name and one sentence preview]

---

## Phase Verification Checklists

### Phase 3
- app/(tabs)/log.tsx, stats.tsx, history.tsx, reference.tsx all exist
- app/(tabs)/_layout.tsx contains teal #00CEC9
- app/log-frames.tsx exists
- Gear icon modal wired on all 4 tabs
- npx tsc --noEmit returns no errors
- Marcus confirms app loads on iPhone via Expo Go

### Phase 4
- LogScreen renders all session types without crash
- Type-specific fields show/hide correctly
- Ball Picker Modal opens and dismisses cleanly
- Draft persists across app close and reopen
- Submit writes to mbowl_sessions_v1 and navigates to Stats
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 5
- Log Frames screen pushes correctly from Log tab
- All 10 frames render in top strip
- Chip bar inputs correctly for frames 1-9
- 10th frame handles all 3-throw cases
- Running score calculates in real time
- Score auto-fills game row on complete
- Cancel confirm sheet fires without saving
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 6
- All 17 seeded sessions visible in History
- Filter pills filter correctly by type
- Scores color-coded vs session own average
- Swipe left, delete, confirm, removed from storage
- Empty state shows per filter
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 7
- Overall average correct against seeded data
- High game and high series correct
- Current Season / All-Time toggle works
- Strike/Spare/Opens shows N/A when no frame data
- Both charts render without crash
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 8
- Settings modal opens from gear on all 4 tabs
- Season dates save and persist
- Ball roster add, rename, toggle all work
- Ball changes reflect in Log tab picker immediately
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 9
- Reference tab renders 4 horizontal sub-tabs
- Position table: 6 rows editable, saves on blur, persists
- Mental: Shot Clock static, 5 cues editable and persist
- All content matches Spec exactly
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 10
- Signals toggle works between Switch Guide and Ball Arsenal
- Ball Arsenal: 9 balls, sorted weakest to strongest
- Switch Guide: 11 scenarios, color-coded direction
- Spares: 14 leave cards, filter pills work
- All editable fields persist
- npx tsc --noEmit returns no errors
- Marcus confirms on device

### Phase 11
- Scale-on-press fires on all interactive elements
- Haptics on submit, delete confirm, strike entry
- No keyboard overlap on any form
- Safe area insets correct everywhere
- Modals blur via expo-blur
- Marcus confirms feels native

### Phase 12
- App icon and splash configured in app.json
- EAS build completes without error
- .ipa installs without Expo Go
- Data persists across full close and reopen
- Marcus confirms on device

## Windows Note
Always write files using a .py script file, not heredoc. Example:
Set-Content -Path "C:\\Users\\marcus\\Desktop\\mBowl\\script.py" -Value 
python C:\\Users\\marcus\\Desktop\\mBowl\\script.py
"""

if 'End of Phase Protocol' not in content:
    content = content + addon

with open(claude_md_path, 'w') as f:
    f.write(content)

print("CLAUDE.md updated successfully")
