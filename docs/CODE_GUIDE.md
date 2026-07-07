# SWITCH Diagnostic Tool — Code Guide
**Current Engineering | Developer Reference**

This document explains every part of the codebase so you can confidently
make changes without needing a developer.

---

## File Structure

```
switch_package/
│
├── app/                    ← The web application
│   ├── index.html          ← HTML skeleton (page structure, no logic)
│   ├── styles.css          ← All visual styling
│   └── app.js              ← All logic, data, and export functions
│
├── data/                   ← Data files
│   ├── error_code_4.xlsx   ← Source Excel (edit this to update DTC 4)
│   ├── dtc_4_cases.js      ← Parsed data (auto-generated, don't edit)
│   └── dtc_4_cases.json    ← Same data as JSON (for reference)
│
├── scripts/
│   └── parse_excel.py      ← Run this after updating any Excel file
│
├── assets/
│   └── logo.jpg            ← Logo image
│
└── docs/
    ├── README.md           ← Quick start guide
    ├── CODE_GUIDE.md       ← This file
    └── Report_Template.docx
```

---

## index.html — What's Where

The HTML file only contains **structure** — no logic, no data.
Everything dynamic is built by JavaScript.

### Key element IDs

| ID | What it is |
|----|-----------|
| `#veh-overlay` | Vehicle selector modal (hidden after pick) |
| `#pg-diag` | The diagnostic page container |
| `#pg-nl` | The newsletter page container |
| `#caseBar` | Case progress bar (built by `buildCaseBar()`) |
| `#diagContent` | Main scrollable area — ALL screens render here |
| `#dtcList` | Sidebar DTC card list |
| `#dOp` | "Operator: Name · VIN" status text |
| `#d-prog` | "Case 3 of 14" progress counter |
| `#nlGrid` | Newsletter issue cards grid |
| `#nlReader` | Full article reader overlay |
| `#toast` | Subscribe confirmation notification |

### Adding a new page tab

To add a third tab (e.g. "Settings"):

1. In `index.html`, add a button in the `<nav>`:
   ```html
   <button class="ntab" onclick="showPage('settings', this)">⚙ Settings</button>
   ```

2. Add a page container after the newsletter page:
   ```html
   <div id="pg-settings" class="page">
     <!-- your content here -->
   </div>
   ```

3. If the page needs `display:block` instead of `flex`, add to `styles.css`:
   ```css
   #pg-settings.active { display: block; }
   ```

---

## styles.css — Design System

### Changing colours

All colours are CSS custom properties (variables) at the top of the file:

```css
:root {
  --brand:      #4845D2;   /* Primary accent colour — buttons, links, active states */
  --brand-l:    #6260E0;   /* Hover state of brand colour */
  --brand-dim:  rgba(72,69,210,.09);  /* Very light tint — card backgrounds */
  --brand-glow: rgba(72,69,210,.20);  /* Glow/shadow for buttons */

  --bg:         #F2F4FA;   /* Page background */
  --surface:    #FFFFFF;   /* Cards and panels */
  --border:     #E0E4F0;   /* Default border colour */

  --text:   #1A1D35;  /* Main body text */
  --text2:  #525878;  /* Secondary text */
  --text3:  #9AA0BE;  /* Muted text, labels */

  --green:  #16A34A;  /* OK / passed / success */
  --red:    #DC2626;  /* NO / failed / error */
  --amber:  #D97706;  /* Warning / corrective action needed */
  --blue:   #1D4ED8;  /* Info / session badge */
}
```

To rebrand to orange (for example):
```css
--brand:      #E85D04;
--brand-l:    #F48C06;
--brand-dim:  rgba(232,93,4,.09);
--brand-glow: rgba(232,93,4,.20);
```

### Component class names

| Class | Component |
|-------|-----------|
| `.step-card` | Each diagnostic step container |
| `.step-card.answered` | Green border — step has an answer |
| `.step-card.flagged` | Amber border — step has a failing answer |
| `.yn-btn.yes` / `.yn-btn.no` | YES / NO toggle buttons |
| `.cond-btn` | OK / NOT OK toggle buttons |
| `.num-input` | Resistance/value numeric input |
| `.sc-corrective.show` | Corrective action — shown when flagged |
| `.sc-ok.show` | OK confirmation — shown when answered (not flagged) |
| `.sc-notes` | Notes textarea below each step |
| `.case-panel` | White card containing all steps for one case |
| `.dtc-hdr` | DTC name/description banner above the case panel |
| `.complete-card` | Purple gradient banner on the summary screen |
| `.obs-table-wrap` | Container for the full observations table |
| `.obs-tbl` | The HTML table in the observations summary |

---

## app.js — Section by Section

The file has 15 clearly labelled sections. Here's what each one does:

---

### Section 1 — DTC_LIBRARY

This is the master database of all DTC codes.

```javascript
const DTC_LIBRARY = {
  "4": {
    code:        "4",
    name:        "HighVltgBattFault",
    description: "High Voltage Battery pack fault",
    action:      "Shutdown the System",
    severity:    "CRITICAL",       // Shown as a red badge
    category:    "HV Battery",
    vehicles:    ["BUS", "LCV"],   // Filter — which vehicles show this DTC
    cases:       DTC_4_CASES       // ← points to the variable in dtc_4_cases.js
  }
};
```

**To add DTC 7:** see README.md step-by-step guide.

**vehicles array controls visibility:**
- `["BUS", "LCV"]` — shown for both
- `["BUS"]` — shown only when technician picks BUS
- `["LCV"]` — shown only when technician picks LCV

---

### Section 2 — NL_DATA

The newsletter articles. Index 0 is always the featured article.

**To add an issue:** paste a new object at the TOP of the array.
See README.md for the full field reference.

---

### Section 3 — Application State

These are the global variables that track what's happening:

```javascript
const SESS = 'SW-ABC123';  // Session ID — random, generated on page load

let vehicle    = null;  // "BUS" or "LCV" — set when user picks vehicle
let activeDTC  = null;  // The current DTC object from DTC_LIBRARY
let currentCase = 0;    // Which case (0-indexed) is being shown
let answers    = {};    // All user answers: answers[caseIdx][stepIdx] = {value, notes}
let intake     = {};    // Problem statement form data
```

---

### Section 5 — Vehicle Selection

`selectVehicle(v)` — called when user clicks BUS or LCV:
1. Sets `vehicle` variable
2. Hides the overlay
3. Calls `buildSidebar()` to populate DTC list
4. Calls `showProblemStatement()` to show the intake form

`switchVehicle()` — re-shows the overlay so user can change vehicle.

---

### Section 6 — Sidebar

`buildSidebar()`:
- Loops through `DTC_LIBRARY`
- Filters by `vehicle`
- Creates a clickable card for each DTC
- Clicking a card sets `activeDTC` and calls `renderCase(0)`

---

### Section 7 — Case Progress Bar

`buildCaseBar(dtc)` — creates the numbered circles at the top (1, 2, 3... 14)
`updateCaseBar(active)` — colours them:
- Past cases → green
- Current case → brand purple with glow
- Future cases → grey

---

### Section 8 — Problem Statement Form

`showProblemStatement()` — renders the intake form HTML into `#diagContent`.
The form has three sections matching the report template:
- Introduction (free text)
- Problem Statement (8 fields)
- DTC Selection (dropdown)

`startDiag()` — called when "Start Diagnostic" is clicked:
1. Validates required fields
2. Saves everything to the `intake` object
3. Calls `buildCaseBar()` and `renderCase(0)`

---

### Section 9 — renderCase(ci)

The core rendering function. Called with a case index (0–13).

For each step it generates HTML with:
- A numbered badge (`.sc-num`)
- The step text
- The observation label
- The input widget (YES/NO, OK/NOT OK, or number field)
- A hidden corrective action div (shown when answer is flagged)
- A notes textarea

**Input type → HTML widget:**

```
input_type === 'yesno'     → two buttons: YES (green) / NO (red)
input_type === 'condition' → two buttons: OK / NOT OK
input_type === 'number'    → <input type="number"> with unit label
```

---

### Section 10 — Answer Logic

`setAns(ci, si, val, el)` — called whenever a button is clicked or a number typed:
- `ci` = case index
- `si` = step index
- `val` = the value ("YES", "NO", "OK", "NOT OK", or a number string)
- `el` = the button element (for visual selection state)

What it does:
1. Stores `{value, notes}` in `answers[ci][si]`
2. Adds/removes `.sel` class on buttons
3. Updates card class: `.answered` (green) or `.flagged` (amber)
4. Shows/hides corrective action and OK confirmation

`saveNotes(ci, si, val)` — called when notes textarea loses focus (onblur).
Saves notes without changing the answer value.

---

### Section 11 — Case Navigation

`navigateCase(idx)` — moves to a different case. Calls `renderCase(idx)`.
User can go backwards to review/change answers.

---

### Section 12 — finishDiag()

Called when the last case is complete.
Builds the summary screen:
1. `complete-card` — coloured banner with export buttons
2. `obs-table-wrap` — full observations table grouped by case

The table shows:
- Step number, step text, observation value, notes, corrective action
- Flagged rows (NO/NOT OK) have amber background

---

### Section 13 — Export (PDF + Word)

`doExport(type)` — dispatcher. Calls `exportPDF(d)` or `exportWord(d)`.

Both functions receive a data object `d` containing:
```javascript
{
  session, generated,     // Session ID and timestamp
  vehicle, vin, odo,      // From intake form
  intro, part, prob,      // Problem statement
  date, loc, failed, op,  // More problem statement
  dtcCode,                // Selected DTC number
  dtc,                    // Full DTC object from DTC_LIBRARY
  answers                 // All user answers
}
```

**PDF report structure (4 sections matching template):**
1. Header banner (purple, SWITCH branding)
2. Section 1 — Introduction
3. Section 2 — Problem Statement (blue-header table)
4. Section 3 — Root Cause Analysis (auto-generated)
5. Section 4 — Key Observations (one sub-table per case)
6. Footer

**Word report structure:**
- Same 4 sections
- Uses `docx` library to generate proper `.docx` format
- Tables use proper Word table cells (not plain text)
- Flagged rows have amber background shading

---

### Section 14 — Page Navigation

`showPage(id, btn)` — switches between Diagnostic and Newsletter tabs.
Just adds/removes `.active` class on pages and nav buttons.

---

### Section 15 — Newsletter

`buildNL()` — runs once on page load. Creates issue cards from `NL_DATA[1..]`.

`openReader(idx)` — opens the full article overlay for `NL_DATA[idx]`.

`closeReader()` — hides the article overlay.

`nlSub(id)` — handles the subscribe form. Validates email, shows toast.

---

## How the Data Files Work Together

```
error_code_4.xlsx
       │
       │  (run: python scripts/parse_excel.py data/error_code_4.xlsx)
       ▼
data/dtc_4_cases.js
  └─ const DTC_4_CASES = [ ...14 case objects... ]
       │
       │  (loaded by: <script src="../data/dtc_4_cases.js"> in index.html)
       ▼
app.js: DTC_LIBRARY["4"].cases = DTC_4_CASES
       │
       │  (when user selects DTC 4 → renderCase(0) → steps from DTC_4_CASES)
       ▼
  User sees Case 1 with 2 steps
  User navigates → Case 2 with 10 steps
  ...
  User completes Case 14 → finishDiag() → summary table
  User clicks export → exportPDF() or exportWord()
```

---

## Common Changes

### Change the number of vehicle types

In `index.html`, find the vehicle modal HTML and add a new button:
```html
<div class="veh-btn" onclick="selectVehicle('TRUCK')">
  <div class="vb-icon">🚛</div>
  <div class="vb-name">TRUCK</div>
  <div class="vb-sub">Heavy Commercial</div>
</div>
```
The new vehicle will automatically work with the DTC filtering system.
Any DTC with `vehicles: ["TRUCK"]` will show only for TRUCK users.

### Make a DTC show for only one vehicle

In `app.js`, change the `vehicles` array:
```javascript
// BUS only:
vehicles: ["BUS"]

// LCV only:
vehicles: ["LCV"]

// Both (default):
vehicles: ["BUS", "LCV"]
```

### Change the report header colour

In `exportPDF()` (Section 13), find:
```javascript
doc.setFillColor(72,69,210);  // RGB values for purple
```
Change to your brand colour RGB values.

For Word reports, find:
```javascript
const hdrShd = { fill: '4845D2', type: ShadingType.CLEAR };
```
Change `'4845D2'` to your hex colour (without the #).

### Add a new field to the Problem Statement

1. In `showProblemStatement()` (Section 8), add a new form row:
   ```javascript
   <div class="frow">
     <label class="flabel">New Field Label</label>
     <input class="finput" id="fi-newfield" placeholder="...">
   </div>
   ```

2. In `startDiag()`, read and save the value:
   ```javascript
   const newfield = document.getElementById('fi-newfield').value.trim();
   intake = { ...intake, newfield };
   ```

3. In `exportPDF()` and `exportWord()`, add a row to the Problem Statement table.
   In PDF, find the `trow(...)` calls and add:
   ```javascript
   y = trow('New Field Label', d.newfield, y);
   ```

---

## Troubleshooting

### App shows blank page
- You may need a local server (see README.md Quick Start)
- Or use the standalone `switch_v5.html` which has everything embedded

### DTC cases don't appear
- Check that `<script src="../data/dtc_4_cases.js"></script>` is in `index.html`
- Check the variable name in the .js file matches `cases: DTC_4_CASES` in app.js
- Open browser DevTools (F12) → Console for error messages

### PDF export fails
- jsPDF requires internet on first load (CDN script)
- After first load it's cached and works offline

### Word export fails / shows error
- docx.js is loaded from unpkg.com CDN
- Try PDF export instead
- Or use the jsPDF version which is more reliable offline

### Excel parser gives "No cases found"
- Check column order exactly: A=code, B=name, C=desc, D=action, E=area, F=step, G=obs, H=corrective
- First row must be a header row (any text in first row)
- Data starts from row 2
- Sheet names don't matter

---

## Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| HTML5 + CSS3 + Vanilla JS | — | App framework (no build step) |
| jsPDF | 2.5.1 | PDF generation in browser |
| docx | 8.5.0 | Word document generation |
| FileSaver.js | 2.0.5 | Browser file download helper |
| Plus Jakarta Sans | Google Fonts | UI typography |
| Fira Code | Google Fonts | Monospace labels |
| openpyxl | Python | Excel parsing (parse_excel.py only) |

All external libraries are loaded from CDN (no npm/node needed).
The app works fully offline after the first load caches the CDN scripts.
