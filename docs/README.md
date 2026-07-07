# SWITCH Diagnostic Tool
**by Current Engineering**

A browser-based diagnostic tool for SWITCH electric vehicles (BUS & LCV).
No server, no Python needed to run — just open `app/index.html` in any browser.

---

## Quick Start

```
switch_package/
├── app/
│   ├── index.html    ← Open this in Chrome/Edge to run the app
│   ├── styles.css
│   └── app.js
├── data/
│   ├── error_code_4.xlsx    ← Original Excel source files
│   └── dtc_4_cases.js       ← Generated data (loaded by index.html)
├── scripts/
│   └── parse_excel.py       ← Run this when you update Excel files
├── assets/
│   └── logo.jpg
└── docs/
    ├── README.md             ← This file
    ├── CODE_GUIDE.md         ← Developer reference
    └── Report_Template.docx  ← Official report template
```

### To run the app
Double-click `app/index.html`, or right-click → Open With → Chrome/Edge.

> **Note:** Because the app loads local JS files (`../data/dtc_4_cases.js`),
> you may need to run it from a local server in some browsers.
> The easiest way:
> ```bash
> cd switch_package
> python3 -m http.server 8080
> # then open http://localhost:8080/app/index.html
> ```
> This is only needed during development. For sharing, deploy to any web host
> (Netlify, Cloudflare Pages, GitHub Pages — see DEPLOYMENT section below).

---

## Adding a New DTC

### Step 1 — Prepare your Excel file
Format your Excel file with these exact columns:

| Col | Header | Example |
|-----|--------|---------|
| A | DTC code | `7` |
| B | DTC name | `MotorFault` |
| C | DTC description | `Motor controller failure` |
| D | DTC action | `Shutdown the System` |
| E | Areas of Issue | `Motor Harness: Wire continuity check` |
| F | Step | `Check for continuity between Pin 1...` |
| G | Observation | `Continuity Yes or No` |
| H | Corrective Action | `If not observed, harness is defective` |

- Each **sheet** = one **Case**
- Each **row** (after the header) = one **diagnostic step**
- The Observation column drives the input widget (see below)

**Observation column → input type:**
| Observation text contains | Input shown |
|---|---|
| "Yes or No", "Yes or N" | YES / NO buttons |
| "Mounting", "Condition", "Eyelet", "Connector" | OK / NOT OK buttons |
| "Resistance", "Value", `___` | Number input field |
| anything else | YES / NO buttons (default) |

### Step 2 — Run the parser
```bash
cd switch_package
python3 scripts/parse_excel.py data/your_new_dtc.xlsx
```
This creates `data/dtc_7_cases.js` (auto-named from the DTC number in the file).

### Step 3 — Load the data in the app
In `app/index.html`, add a script tag **before** the `app.js` line:
```html
<script src="../data/dtc_7_cases.js"></script>
```

### Step 4 — Register the DTC in app.js
In `app/app.js`, find `const DTC_LIBRARY = {` and add:
```javascript
"7": {
  code:        "7",
  name:        "MotorFault",
  description: "Motor controller failure",
  action:      "Shutdown the System",
  severity:    "CRITICAL",      // CRITICAL | HIGH | MEDIUM
  category:    "Motor",
  vehicles:    ["BUS", "LCV"],  // which vehicles this applies to
  cases:       DTC_7_CASES      // ← variable name from dtc_7_cases.js
}
```

That's it. Refresh the app and DTC 7 will appear in the sidebar.

---

## Adding a Newsletter Issue

Open `app/app.js` and find `const NL_DATA = [`.
Paste a new object **at the very top** of the array:

```javascript
{
  id:       50,
  date:     "April 1, 2026",
  readTime: "4 min",
  isNew:    true,
  title:    "Your issue headline",
  tags:     ["DTC 7", "Motor", "Field Report"],
  tagColors: ["pu", "gr", "bl"],   // pu=purple  gr=green  bl=blue
  excerpt:  "Short preview shown on the card (2 sentences max).",
  sections: [
    {
      heading: "Section Title",
      body:    "Full article text here.\n\nUse \\n for line breaks.\n\n• Bullet point"
    },
    {
      heading: "Another Section",
      body:    "More text..."
    }
  ]
}
```

---

## Changing the Brand

All colours are in one place — `app/styles.css`, section 1:

```css
:root {
  --brand:      #4845D2;   /* ← Change this to your primary colour */
  --brand-l:    #6260E0;   /* ← Lighter shade for hover states */
  --brand-dim:  rgba(72, 69, 210, 0.09);  /* ← Very transparent tint */
  --brand-glow: rgba(72, 69, 210, 0.20);  /* ← Shadow/glow colour */
}
```

To change the logo, replace `assets/logo.jpg` with your new file (keep the filename),
or update the `<img>` tags in `app/index.html`.

---

## Deployment (Sharing the App)

### Option A — USB / Shared Network Drive (simplest, offline)
Copy the entire `switch_package/` folder. Anyone with Chrome/Edge can open `app/index.html`.

### Option B — Netlify Drop (30 seconds, free, public URL)
1. Go to https://app.netlify.com/drop
2. Drag the entire `app/` folder onto the page
3. Done — you get a public URL like `https://amazing-name-123456.netlify.app`

> ⚠ The data files in `../data/` won't be accessible this way since you're only dragging `app/`.
> Use the **standalone version** (`switch_v5.html`) for drag-and-drop deployment.

### Option C — Cloudflare Pages (recommended for teams, free, private)
1. Push the full `switch_package/` folder to a **private** GitHub repository
2. Go to https://pages.cloudflare.com → Connect to Git → select your repo
3. Set build output directory to `app/`
4. Deploy — get a free `.pages.dev` URL
5. Your source code stays private; only the built site is public

### Option D — GitHub Pages (free, public source)
Only use this if you're comfortable with the code being publicly visible.
```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/yourname/switch-diagnostic.git
git push -u origin main
# Enable Pages in repo Settings → Pages → Branch: main
```

---

## Report Template

The exported PDF and Word reports follow the structure in `docs/Report_Template.docx`:

| Section | Source |
|---------|--------|
| **1. Introduction** | Free-text field on intake form |
| **2. Problem Statement** | Part Name, Problem Description, Date, Location, VIN, ODO, Failed Part |
| **3. Root Cause Analysis** | Auto-generated from DTC info |
| **4. Key Observations & Insights** | Full observations table — one row per step, all 14 cases |

---

## Requirements

**To run the app:** Any modern browser (Chrome 80+, Edge 80+, Firefox 75+).
No Python, no Node.js, no internet required (after first load — fonts are cached).

**To parse new Excel files:** Python 3.8+ with openpyxl:
```bash
pip install openpyxl
```

**To run the local dev server:**
```bash
python3 -m http.server 8080
```

---

## File Reference

| File | Purpose |
|------|---------|
| `app/index.html` | Main HTML — structure and page layout |
| `app/styles.css` | All CSS — colours, typography, components |
| `app/app.js` | All JavaScript — DTC data, logic, export |
| `data/error_code_4.xlsx` | Source Excel for DTC 4 |
| `data/dtc_4_cases.js` | Parsed JS data (auto-generated) |
| `scripts/parse_excel.py` | Converts Excel → JS data file |
| `assets/logo.jpg` | Company logo (replace to rebrand) |
| `docs/Report_Template.docx` | Original Word template |
| `docs/CODE_GUIDE.md` | Detailed code documentation |
