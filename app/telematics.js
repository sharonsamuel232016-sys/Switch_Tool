/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH DIAGNOSTIC TOOL — telematics.js
   Telematics Dashboard page (added as a 3rd tab alongside Diagnostic/Newsletter)
   ═══════════════════════════════════════════════════════════════════════════

   TABLE OF CONTENTS
   ─────────────────
   1.  Config (required columns, plottable params, DTC name table)
   2.  State
   3.  File Upload & Parsing (SheetJS)
   4.  Filters
   5.  Section 1: Error Codes vs Sequence State
   6.  Section 2: Parameter Trends (Plotly)
   7.  Cycle detection + Section 3/4: Voltage & Temperature Delta tables
   8.  Raw data preview + CSV export
   9.  Reset / Init

   HOW TO ADD MORE PLOTTABLE PARAMETERS
   ──────────────────────────────────────
   Add a line to PLOTTABLE_PARAMS below: "Label": "column_name_in_your_file"
   Anything else numeric in the uploaded file shows up automatically under
   "Add extra parameter(s) to plot" without any code changes.
═══════════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════════
   1. CONFIG
   ══════════════════════════════════════════════════════════════════════════ */

const TM_REQUIRED_COLUMNS = [
  "timestamp_local", "vin", "vehicle_type", "ignition_status", "soc",
  "battery_max_cell_temp", "battery_min_cell_temperature",
  "main_coolant_temperature", "battery_coolant_out_temperature",
  "battery_max_cell_voltage", "battery_min_cell_voltage",
  "e_code", "system_mode_seq_state",
];

const TM_KNOWN_SEQ_STATES = [102, 109, 131, 145, 150, 170];
const TM_BATTERY_STATUS_COL = "battery_status";
const TM_STATUS_LABELS = { 10: "Charging", 4: "Discharging" };

let TM_PLOTTABLE_PARAMS = {
  "SOC (%)": "soc",
  "Battery Max Cell Temp": "battery_max_cell_temp",
  "Battery Min Cell Temp": "battery_min_cell_temperature",
  "Main Coolant Temp": "main_coolant_temperature",
  "Battery Coolant Out Temp": "battery_coolant_out_temperature",
  "Battery Max Cell Voltage": "battery_max_cell_voltage",
  "Battery Min Cell Voltage": "battery_min_cell_voltage",
};
const TM_DEFAULT_PARAMS = [
  "SOC (%)", "Battery Max Cell Temp", "Battery Min Cell Temp", "Battery Coolant Out Temp",
];

const TM_TRACE_COLORS = [
  "#2E86AB", "#E63946", "#F4A261", "#2A9D8F",
  "#8E44AD", "#E9C46A", "#457B9D", "#D62828",
];

const TM_MAX_PLOT_POINTS = 8000;

/* DTC Code -> raw fault name, from the DTC reference table. */
const TM_DTC_NAMES = {
  4: "BMS_Internal_Fault",
  5: "HVIL_Fault",
  6: "HVAC_Warn",
  7: "HVAC_Derate_Warn",
  8: "HVAC_Fully_Off_Fault",
  9: "HVAC_CAN_Message_Absent",
  10: "MCU_Sys1_Warn",
  11: "MCU_Sys2_Warn",
  12: "MCU_Sys3_Warn",
  13: "MCU_CAN_Message_Absent",
  14: "MCU_Sys4_Warn",
  15: "MCU_Sys5_Warn",
  16: "MCU_Sys6_Warn",
  17: "MCU_Sys7_Warn",
  18: "MCU_Sys8_Warn",
  19: "MCU_Regn_Derate_Warn",
  20: "MCU_Trctn_Derate_Warn",
  25: "KeyOff_While_Mvng_Fault",
  29: "BMS_Chksum_Fault",
  31: "BCU_CAN_Message_Absent",
  32: "MCU_Sys1_Fault",
  33: "MCU_Sys2_Fault",
  34: "MCU_Sys3_Fault",
  35: "MCU_Sys4_Fault",
  36: "MCU_Sys5_Fault",
  37: "MCU_Sys6_Fault",
  38: "MCU_Sys7_Fault",
  39: "MCU_Sys8_Fault",
  40: "MCU_Sys9_Fault",
  41: "MCU_Sys10_Fault",
  42: "MCU_Sys11_Fault",
  43: "MCU_Sys12_Fault",
  44: "MCU_Sys13_Fault",
  45: "MCU_Sys14_Fault",
  46: "MCU_Sys15_Fault",
  47: "EM_Switch_Status_Fault",
  50: "AUX_Air_Comp_Warn",
  51: "AUX_Air_Comp_Fault",
  52: "AUX_EPAS_Warn",
  53: "AUX_EPAS_Fault",
  62: "MCU_State_Disagree_Fault",
  63: "MCU_Sys16_Fault",
  64: "MCU_Sys17_Fault",
  65: "MCU_Sys18_Fault",
  69: "AccltrPedl_Pwrsup_Fault",
  70: "Accltr_PedlTrack1_Oorng_Fault",
  71: "Accltr_PedlTrack2_Oorng_Fault",
  72: "Accltr_PedlTracks_Disgree_Fault",
  74: "FNR_Fault",
  77: "PECS_Radiator_Fan_Fault",
  78: "BCS_HV_Fault",
  81: "BCS_Diag_Fault",
  83: "BCS_Comp_Fault",
  86: "PDB_MCU_Cntactr_OpenIncrrct_Fault",
  87: "PDB_MCU_Cntactr_ClosdIncrrct_Fault",
  88: "PDB_AUX_Cntactr_OpenIncrrct_Fault",
  89: "PDB_AUX_Cntactr_ClosdIncrrct_Fault",
  92: "PDB_CCS_Cntactr_OpenIncrrct_Fault",
  93: "PDB_CCS_Cntactr_ClosdIncrrct_Fault",
  94: "Isoltn_Fault",
  95: "BMS_ThermalRunaway_Fault",
  99: "Brake_PedlTracks_Disgree_Fault",
  100: "PECS_Coolant_Temp_Sensor_PS_Fault",
  101: "CANA_Bus_Fault",
  102: "CANB_Bus_Fault",
  103: "CANC_Bus_Fault",
  104: "CAND_Bus_Fault",
  105: "FNR_CAN_Message_Absent",
  106: "FNR_Gear_Stuck",
  107: "Isoltn_HW_Fault",
  118: "PECS_Coolant_Lvl_Warn",
  120: "PECS_Coolant_Pump_Fault",
  122: "PECS_Coolant_Temp_Fault",
  123: "AUX_SHIGAN_RESERVED_SLOT",
  124: "AUX_SHIGAN_RESERVED_SLOT",
  125: "AUX_SHIGAN_RESERVED_SLOT",
  126: "AUX_SHIGAN_RESERVED_SLOT",
  127: "AUX_SHIGAN_RESERVED_SLOT",
  128: "AUX_SHIGAN_RESERVED_SLOT",
  129: "AUX_SHIGAN_RESERVED_SLOT",
  130: "AUX_SHIGAN_RESERVED_SLOT",
  131: "AUX_SHIGAN_RESERVED_SLOT",
  140: "BMS_CAN_Message_Absent",
  142: "DCDC_CAN_Message_Absent",
  143: "Booster_Pump_Fault",
  145: "AUX_Comp_CAN_Message_Absent",
  146: "AUX_EPAS_CAN_Message_Absent",
  147: "PECS_SPAL_CAN_Message_Absent",
  148: "PECS_CAN_Message_Absent",
  149: "BCS_CAN_Message_Absent",
  150: "Booster_Pump_CAN_Message_Absent",
  182: "MCU_Torq_Direction_Incorrect_Fault",
  184: "DCDC_Input_Fault",
  185: "DCDC_Internal_Fault",
  186: "DCDC_Output_Fault",
  187: "DCDC_Temp_Fault",
  188: "DCDC_CAN_Fault",
  189: "DCDC_Sts_Fault",
  191: "BMS_CellOV_Alrm4_Fault",
  192: "BMS_CellUV_Alrm4_Fault",
  193: "BMS_CellOTFault",
  194: "BMS_CellUTFault",
  195: "BMS_PackVoltage_OVFault",
  196: "BMS_PackVoltage_UVFault",
  197: "BMS_CellOV_Alrm3_Fault",
  198: "BMS_CellUV_Alrm3_Fault",
  199: "BMS_Smoke_Fault",
  200: "BMS_Cell_Voltage_Difference",
  201: "BMS_Extreme_Cell_UV",
  202: "BMS_Riso_Fault",
  203: "BMS_HVIL_Fault",
};

const TM_WORD_EXPANSIONS = {
  BMS: "BMS (Battery Management System)", MCU: "MCU (Motor Control Unit)",
  HVAC: "HVAC", HVIL: "HVIL (High Voltage Interlock Loop)", AUX: "Auxiliary",
  PECS: "PECS (Powertrain Electronics Cooling System)", BCS: "BCS (Battery Contactor System)",
  BCU: "BCU (Battery Control Unit)", PDB: "PDB (Power Distribution Box)",
  DCDC: "DC-DC Converter", EPAS: "EPAS (Electric Power Assisted Steering)",
  FNR: "FNR (Forward/Neutral/Reverse)", CAN: "CAN Bus", CANA: "CAN Bus A",
  CANB: "CAN Bus B", CANC: "CAN Bus C", CAND: "CAN Bus D", Sys: "System",
  Cntactr: "Contactor", Incrrct: "Incorrect", Oorng: "Out of Range",
  Disgree: "Disagree", Pwrsup: "Power Supply", Accltr: "Accelerator",
  AccltrPedl: "Accelerator Pedal", Isoltn: "Isolation", Chksum: "Checksum",
  Regn: "Regen", Trctn: "Traction", Mvng: "Moving", Sts: "Status",
  Lvl: "Level", Riso: "Riso (Insulation Resistance)", OV: "Over-Voltage",
  UV: "Under-Voltage", OT: "Over-Temperature", UT: "Under-Temperature",
  Alrm3: "Alarm 3", Alrm4: "Alarm 4", SHIGAN: "Shigan",
};

function tmHumanizeDtcName(rawName) {
  if (!rawName) return "";
  return rawName.split("_").map(part => {
    const m = part.match(/^([A-Za-z]+)(\d*)$/);
    if (!m) return part;
    const [, word, num] = m;
    const expanded = TM_WORD_EXPANSIONS[word] || word;
    return num ? `${expanded} ${num}` : expanded;
  }).join(" ");
}

function tmDtcName(code) {
  const n = Number(code);
  return TM_DTC_NAMES[n] || "Unknown DTC";
}

function tmDtcDescription(code) {
  const n = Number(code);
  if (!(n in TM_DTC_NAMES)) return "No description available (code not in reference table).";
  return tmHumanizeDtcName(TM_DTC_NAMES[n]);
}


/* ══════════════════════════════════════════════════════════════════════════
   2. STATE
   ══════════════════════════════════════════════════════════════════════════ */

const TM = {
  rows: [],          // full parsed dataset (array of row objects)
  filtered: [],       // after sidebar filters applied
  columns: [],
  hasBatteryStatus: false,
  selectedParams: [...TM_DEFAULT_PARAMS],
  extraParams: [],
  viewMode: "combined",  // "combined" | "individual"
  selectedTs: null,       // clicked error-row timestamp, drawn as a vline
  filters: { vin: "All", vtype: "All", ignition: new Set(), dateStart: null, dateEnd: null },
  fileName: "",
};


/* ══════════════════════════════════════════════════════════════════════════
   3. FILE UPLOAD & PARSING
   ══════════════════════════════════════════════════════════════════════════ */

function tmInitUpload() {
  const input = document.getElementById("tmFileInput");
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) tmHandleFile(file);
  });

  const dz = document.getElementById("tmUpload");
  ["dragover", "dragleave", "drop"].forEach(evt => {
    dz.addEventListener(evt, (e) => e.preventDefault());
  });
  dz.addEventListener("dragover", () => dz.classList.add("tm-drag"));
  dz.addEventListener("dragleave", () => dz.classList.remove("tm-drag"));
  dz.addEventListener("drop", (e) => {
    dz.classList.remove("tm-drag");
    const file = e.dataTransfer.files[0];
    if (file) tmHandleFile(file);
  });

  document.getElementById("tmReset").addEventListener("click", tmResetToUpload);
}

function tmHandleFile(file) {
  const errEl = document.getElementById("tmUploadErr");
  errEl.textContent = "";
  TM.fileName = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
      tmLoadRows(rows);
    } catch (err) {
      console.error(err);
      errEl.textContent = "Couldn't read that file. Make sure it's a valid CSV or XLSX export.";
    }
  };
  reader.onerror = () => { errEl.textContent = "Failed to read the file."; };
  reader.readAsArrayBuffer(file);
}

function tmLoadRows(rows) {
  const errEl = document.getElementById("tmUploadErr");
  if (!rows.length) {
    errEl.textContent = "The file appears to be empty.";
    return;
  }

  // Trim column names (mirrors the Python app's df.columns = [c.strip() ...])
  const trimmedRows = rows.map(r => {
    const out = {};
    Object.keys(r).forEach(k => { out[k.trim()] = r[k]; });
    return out;
  });
  const columns = Object.keys(trimmedRows[0]);

  const missing = TM_REQUIRED_COLUMNS.filter(c => !columns.includes(c));
  if (missing.length) {
    errEl.innerHTML = "The uploaded file is missing expected column(s):<br>" +
      missing.map(c => `&nbsp;&nbsp;• <code>${c}</code>`).join("<br>") +
      "<br>Please check the column names and re-upload.";
    return;
  }

  // Parse timestamps + coerce numeric columns
  const numericCols = new Set([
    ...Object.values(TM_PLOTTABLE_PARAMS),
    "battery_max_cell_voltage", "battery_min_cell_voltage",
    "battery_max_cell_temp", "battery_min_cell_temperature", "soc",
  ]);
  trimmedRows.forEach(r => {
    if (r.timestamp_local != null) {
      const d = tmParseDate(r.timestamp_local);
      r._ts = d;
    } else {
      r._ts = null;
    }
    numericCols.forEach(c => {
      if (c in r) {
        const v = parseFloat(r[c]);
        r[c] = isNaN(v) ? null : v;
      }
    });
    if (TM_BATTERY_STATUS_COL in r) {
      const v = parseFloat(r[TM_BATTERY_STATUS_COL]);
      r[TM_BATTERY_STATUS_COL] = isNaN(v) ? r[TM_BATTERY_STATUS_COL] : v;
    }
  });
  trimmedRows.sort((a, b) => (a._ts || 0) - (b._ts || 0));

  TM.rows = trimmedRows;
  TM.columns = columns;
  TM.hasBatteryStatus = columns.includes(TM_BATTERY_STATUS_COL);
  if (TM.hasBatteryStatus) tmComputeCycles(TM.rows);

  TM.filters = { vin: "All", vtype: "All", ignition: new Set(), dateStart: null, dateEnd: null };
  TM.selectedTs = null;
  TM.selectedParams = [...TM_DEFAULT_PARAMS].filter(p => TM.columns.includes(TM_PLOTTABLE_PARAMS[p]) || Object.values(TM_PLOTTABLE_PARAMS).includes(TM_PLOTTABLE_PARAMS[p]));

  document.getElementById("tmUpload").style.display = "none";
  document.getElementById("tmDashboard").style.display = "block";
  document.getElementById("tmFileName").textContent = TM.fileName;
  document.getElementById("tmRowCount").textContent = `${trimmedRows.length.toLocaleString()} rows`;

  tmRenderFilters();
  tmApplyFilters();
}

function tmParseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(val) : null;
    if (d) return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function tmResetToUpload() {
  TM.rows = [];
  TM.filtered = [];
  document.getElementById("tmDashboard").style.display = "none";
  document.getElementById("tmUpload").style.display = "flex";
  document.getElementById("tmUploadErr").textContent = "";
  document.getElementById("tmFileInput").value = "";
}


/* ══════════════════════════════════════════════════════════════════════════
   4. FILTERS
   ══════════════════════════════════════════════════════════════════════════ */

function tmRenderFilters() {
  const wrap = document.getElementById("tmFilters");
  const vins = [...new Set(TM.rows.map(r => r.vin).filter(v => v != null))].sort();
  const vtypes = [...new Set(TM.rows.map(r => r.vehicle_type).filter(v => v != null))].sort();
  const ignitions = [...new Set(TM.rows.map(r => r.ignition_status).filter(v => v != null))].sort();
  ignitions.forEach(v => TM.filters.ignition.add(v));

  const dates = TM.rows.map(r => r._ts).filter(Boolean);
  const minD = dates.length ? new Date(Math.min(...dates)) : null;
  const maxD = dates.length ? new Date(Math.max(...dates)) : null;
  TM.filters.dateStart = minD;
  TM.filters.dateEnd = maxD;

  const fmtDate = d => d ? d.toISOString().slice(0, 10) : "";

  wrap.innerHTML = `
    <div class="tm-filter-row">
      ${vins.length > 1 ? `
      <div class="frow tm-filter-item">
        <label class="flabel">VIN</label>
        <select class="fselect" id="tmFVin">
          <option value="All">All</option>
          ${vins.map(v => `<option value="${v}">${v}</option>`).join("")}
        </select>
      </div>` : ""}
      ${vtypes.length > 1 ? `
      <div class="frow tm-filter-item">
        <label class="flabel">Vehicle Type</label>
        <select class="fselect" id="tmFVtype">
          <option value="All">All</option>
          ${vtypes.map(v => `<option value="${v}">${v}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="frow tm-filter-item">
        <label class="flabel">Date Range</label>
        <div class="tm-date-range">
          <input type="date" class="finput" id="tmFDateStart" value="${fmtDate(minD)}" min="${fmtDate(minD)}" max="${fmtDate(maxD)}">
          <span>–</span>
          <input type="date" class="finput" id="tmFDateEnd" value="${fmtDate(maxD)}" min="${fmtDate(minD)}" max="${fmtDate(maxD)}">
        </div>
      </div>
    </div>
    ${ignitions.length > 1 ? `
    <div class="tm-filter-row">
      <div class="frow tm-filter-item full">
        <label class="flabel">Ignition Status</label>
        <div class="tm-chip-group" id="tmFIgnition">
          ${ignitions.map(v => `<span class="tm-chip active" data-val="${v}">${v}</span>`).join("")}
        </div>
      </div>
    </div>` : ""}
    <div class="tm-filter-count" id="tmFilterCount"></div>
  `;

  if (vins.length > 1) document.getElementById("tmFVin").addEventListener("change", (e) => {
    TM.filters.vin = e.target.value; tmApplyFilters();
  });
  if (vtypes.length > 1) document.getElementById("tmFVtype").addEventListener("change", (e) => {
    TM.filters.vtype = e.target.value; tmApplyFilters();
  });
  document.getElementById("tmFDateStart").addEventListener("change", (e) => {
    TM.filters.dateStart = e.target.value ? new Date(e.target.value) : minD; tmApplyFilters();
  });
  document.getElementById("tmFDateEnd").addEventListener("change", (e) => {
    TM.filters.dateEnd = e.target.value ? new Date(e.target.value) : maxD; tmApplyFilters();
  });
  if (ignitions.length > 1) {
    document.getElementById("tmFIgnition").querySelectorAll(".tm-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const v = chip.dataset.val;
        chip.classList.toggle("active");
        if (chip.classList.contains("active")) TM.filters.ignition.add(v);
        else TM.filters.ignition.delete(v);
        tmApplyFilters();
      });
    });
  }
}

function tmApplyFilters() {
  const f = TM.filters;
  TM.filtered = TM.rows.filter(r => {
    if (f.vin !== "All" && r.vin !== f.vin) return false;
    if (f.vtype !== "All" && r.vehicle_type !== f.vtype) return false;
    if (f.ignition.size && r.ignition_status != null && !f.ignition.has(r.ignition_status)) return false;
    if (r._ts) {
      if (f.dateStart && r._ts < new Date(f.dateStart.toDateString())) return false;
      if (f.dateEnd) {
        const endOfDay = new Date(f.dateEnd); endOfDay.setHours(23, 59, 59, 999);
        if (r._ts > endOfDay) return false;
      }
    }
    return true;
  });

  const countEl = document.getElementById("tmFilterCount");
  if (countEl) countEl.textContent = `${TM.filtered.length.toLocaleString()} rows after filtering`;

  tmRenderErrorTable();
  tmRenderParamControls();
  tmRenderChart();
  tmRenderCycleTables();
}


/* ══════════════════════════════════════════════════════════════════════════
   5. SECTION 1: ERROR CODES VS SEQUENCE STATE
   ══════════════════════════════════════════════════════════════════════════ */

function tmRenderErrorTable() {
  const wrap = document.getElementById("tmErrTableWrap");
  const caption = document.getElementById("tmErrCaption");

  const errors = TM.filtered.filter(r => {
    const v = r.e_code;
    if (v == null) return false;
    if (typeof v === "number") return v !== 0;
    return String(v).trim() !== "";
  });

  caption.textContent = `Click a row to mark that timestamp on the chart below. Recognized sequence states: [${TM_KNOWN_SEQ_STATES.join(", ")}]. DTC Name/Description come from the built-in reference table; codes not in it show as 'Unknown DTC'.`;

  if (!errors.length) {
    wrap.innerHTML = `<div class="tm-empty">No error codes found in this dataset.</div>`;
    return;
  }

  const rowsHtml = errors.map((r, i) => {
    const known = TM_KNOWN_SEQ_STATES.includes(Number(r.system_mode_seq_state));
    const inLibrary = (typeof DTC_LIBRARY !== "undefined") && DTC_LIBRARY[String(r.e_code)];
    return `
      <tr class="tm-err-row" data-idx="${i}">
        <td>${r._ts ? r._ts.toLocaleString() : "—"}</td>
        <td>${r.vin ?? "—"}</td>
        <td class="tm-mono">${r.e_code}</td>
        <td>${tmDtcName(r.e_code)}</td>
        <td class="tm-desc-cell">${tmDtcDescription(r.e_code)}</td>
        <td class="tm-mono">${r.system_mode_seq_state ?? "—"}</td>
        <td>${known ? '<span class="v-ok">Known</span>' : '<span class="v-none">Unknown</span>'}</td>
        <td class="tm-mono">${r.soc ?? "—"}</td>
        <td>${inLibrary ? '<span class="tm-tag-link" data-code="' + r.e_code + '">View in Diagnostic →</span>' : ""}</td>
      </tr>`;
  }).join("");

  wrap.innerHTML = `
    <div class="tm-table-scroll">
      <table class="obs-tbl tm-tbl">
        <thead><tr>
          <th>Timestamp</th><th>VIN</th><th>DTC Code</th><th>DTC Name</th>
          <th>DTC Description</th><th>Sequence State</th><th>Known Seq.</th>
          <th>SOC (%)</th><th></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  wrap.querySelectorAll(".tm-err-row").forEach(tr => {
    tr.addEventListener("click", () => {
      wrap.querySelectorAll(".tm-err-row").forEach(x => x.classList.remove("tm-sel"));
      tr.classList.add("tm-sel");
      const idx = Number(tr.dataset.idx);
      TM.selectedTs = errors[idx]._ts;
      tmRenderChart();
    });
  });

  wrap.querySelectorAll(".tm-tag-link").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const diagTab = document.querySelector('.ntab[onclick*="\'diag\'"]');
      if (diagTab) showPage("diag", diagTab);
    });
  });
}


/* ══════════════════════════════════════════════════════════════════════════
   6. SECTION 2: PARAMETER TRENDS
   ══════════════════════════════════════════════════════════════════════════ */

function tmRenderParamControls() {
  const wrap = document.getElementById("tmParamControls");
  const available = Object.keys(TM_PLOTTABLE_PARAMS).filter(p => TM.columns.includes(TM_PLOTTABLE_PARAMS[p]));

  const predefinedCols = new Set(Object.values(TM_PLOTTABLE_PARAMS));
  const nonDataCols = new Set(["timestamp_local", "vin", "vehicle_type", "ignition_status", "e_code", "system_mode_seq_state", "_ts", "cycle_id", "cycle_type"]);
  const extraCandidates = TM.columns.filter(c => !predefinedCols.has(c) && !nonDataCols.has(c) && TM.rows.some(r => typeof r[c] === "number"));

  wrap.innerHTML = `
    <div class="frow" style="margin-bottom:10px">
      <label class="flabel">Select parameter(s) to plot</label>
      <div class="tm-chip-group" id="tmParamChips">
        ${available.map(p => `<span class="tm-chip ${TM.selectedParams.includes(p) ? "active" : ""}" data-val="${p}">${p}</span>`).join("")}
      </div>
    </div>
    <div class="frow" style="margin-bottom:10px">
      <label class="flabel">Add extra parameter(s) to plot (any other numeric column found in your file)</label>
      <div class="tm-chip-group" id="tmExtraChips">
        ${extraCandidates.length ? extraCandidates.map(c => `<span class="tm-chip ${TM.extraParams.includes(c) ? "active" : ""}" data-val="${c}">${c}</span>`).join("") : '<span class="tm-empty-inline">No other numeric columns found.</span>'}
      </div>
    </div>
    <div class="frow" style="margin-bottom:10px">
      <label class="flabel">Chart view</label>
      <div class="tm-toggle-group">
        <button class="tm-toggle ${TM.viewMode === "combined" ? "active" : ""}" data-mode="combined">Combined chart (shared axis)</button>
        <button class="tm-toggle ${TM.viewMode === "individual" ? "active" : ""}" data-mode="individual">Individual charts (independent zoom)</button>
      </div>
    </div>
  `;

  wrap.querySelectorAll("#tmParamChips .tm-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const v = chip.dataset.val;
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) TM.selectedParams.push(v);
      else TM.selectedParams = TM.selectedParams.filter(p => p !== v);
      tmRenderChart();
    });
  });
  wrap.querySelectorAll("#tmExtraChips .tm-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const v = chip.dataset.val;
      chip.classList.toggle("active");
      TM_PLOTTABLE_PARAMS[v] = v; // register so it plots like any predefined param
      if (chip.classList.contains("active")) {
        TM.extraParams.push(v);
        TM.selectedParams.push(v);
      } else {
        TM.extraParams = TM.extraParams.filter(p => p !== v);
        TM.selectedParams = TM.selectedParams.filter(p => p !== v);
      }
      tmRenderChart();
    });
  });
  wrap.querySelectorAll(".tm-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".tm-toggle").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      TM.viewMode = btn.dataset.mode;
      tmRenderChart();
    });
  });
}

function tmDownsample(rows, maxPoints = TM_MAX_PLOT_POINTS) {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, i) => i % step === 0);
}

function tmBuildGapAwareTraces(rows, col, thresholdMs) {
  const solidX = [], solidY = [], dottedX = [], dottedY = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i]._ts, v = rows[i][col];
    if (i > 0 && rows[i - 1]._ts && t) {
      const gap = t - rows[i - 1]._ts;
      if (gap > thresholdMs) {
        solidX.push(null); solidY.push(null);
        dottedX.push(rows[i - 1]._ts, t, null);
        dottedY.push(rows[i - 1][col], v, null);
      }
    }
    solidX.push(t); solidY.push(v);
  }
  return { solidX, solidY, dottedX, dottedY };
}

function tmDefaultGapMinutes(rows) {
  const diffs = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]._ts && rows[i - 1]._ts) {
      const d = (rows[i]._ts - rows[i - 1]._ts) / 1000;
      if (d > 0) diffs.push(d);
    }
  }
  if (!diffs.length) return 5.0;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.max(1.0, Math.round((median * 3) / 60 * 10) / 10);
}

function tmRenderChart() {
  const area = document.getElementById("tmChartArea");
  if (!TM.selectedParams.length) {
    area.innerHTML = `<div class="tm-empty">Select at least one parameter above to see the chart.</div>`;
    return;
  }

  const plotRows = tmDownsample(TM.filtered.filter(r => r._ts));
  const note = plotRows.length < TM.filtered.length
    ? `<div class="tm-caption">Showing ${plotRows.length.toLocaleString()} of ${TM.filtered.length.toLocaleString()} points (downsampled for plotting speed).</div>`
    : "";

  const gapMinutes = tmDefaultGapMinutes(plotRows);
  const gapMs = gapMinutes * 60 * 1000;

  area.innerHTML = note + `<div id="tmPlotHost"></div>`;
  const host = document.getElementById("tmPlotHost");

  const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#4845D2";
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text2").trim() || "#525878";
  const fontFamily = "Plus Jakarta Sans, sans-serif";

  if (TM.viewMode === "combined") {
    const traces = [];
    const primary = TM.selectedParams[0];
    TM.selectedParams.forEach((p, i) => {
      const col = TM_PLOTTABLE_PARAMS[p];
      const color = TM_TRACE_COLORS[i % TM_TRACE_COLORS.length];
      const axis = p === primary ? "y" : "y2";
      const { solidX, solidY, dottedX, dottedY } = tmBuildGapAwareTraces(plotRows, col, gapMs);
      traces.push({ x: solidX, y: solidY, name: p, yaxis: axis, mode: "lines", line: { color }, connectgaps: false });
      if (dottedX.length) {
        traces.push({ x: dottedX, y: dottedY, name: `${p} (no data)`, yaxis: axis, mode: "lines", line: { color, dash: "dot" }, connectgaps: false, showlegend: false });
      }
    });

    const shapes = [];
    if (TM.selectedTs) {
      shapes.push({ type: "line", x0: TM.selectedTs, x1: TM.selectedTs, y0: 0, y1: 1, yref: "paper", line: { color: "#1A1D35", width: 2, dash: "dash" } });
    }

    Plotly.newPlot(host, traces, {
      xaxis: { title: "Timestamp" },
      yaxis: { title: primary, side: "left" },
      yaxis2: { title: "Other selected parameters", overlaying: "y", side: "right" },
      legend: { orientation: "h", y: 1.15, x: 0 },
      height: 460,
      margin: { t: 40, l: 55, r: 55, b: 40 },
      font: { family: fontFamily, color: textColor, size: 11 },
      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      shapes,
    }, { responsive: true, scrollZoom: true, displaylogo: false });

  } else {
    host.innerHTML = "";
    TM.selectedParams.forEach((p, i) => {
      const col = TM_PLOTTABLE_PARAMS[p];
      const color = TM_TRACE_COLORS[i % TM_TRACE_COLORS.length];
      const div = document.createElement("div");
      div.className = "tm-indiv-chart";
      host.appendChild(div);

      const { solidX, solidY, dottedX, dottedY } = tmBuildGapAwareTraces(plotRows, col, gapMs);
      const traces = [{ x: solidX, y: solidY, name: p, mode: "lines", line: { color }, connectgaps: false, showlegend: false }];
      if (dottedX.length) {
        traces.push({ x: dottedX, y: dottedY, name: `${p} (no data)`, mode: "lines", line: { color, dash: "dot" }, connectgaps: false, showlegend: false });
      }
      const shapes = [];
      if (TM.selectedTs) {
        shapes.push({ type: "line", x0: TM.selectedTs, x1: TM.selectedTs, y0: 0, y1: 1, yref: "paper", line: { color: "#1A1D35", width: 2, dash: "dash" } });
      }
      Plotly.newPlot(div, traces, {
        title: { text: p, font: { size: 13 } },
        xaxis: { title: "Timestamp" }, yaxis: { title: p },
        height: 280, margin: { t: 36, l: 55, r: 20, b: 30 },
        font: { family: fontFamily, color: textColor, size: 10 },
        paper_bgcolor: "transparent", plot_bgcolor: "transparent",
        shapes,
      }, { responsive: true, scrollZoom: true, displaylogo: false });
    });
  }
}


/* ══════════════════════════════════════════════════════════════════════════
   7. CYCLE DETECTION + VOLTAGE/TEMP DELTA TABLES
   ══════════════════════════════════════════════════════════════════════════ */

function tmComputeCycles(rows) {
  let cid = 0, prev = undefined;
  rows.forEach(r => {
    if (r[TM_BATTERY_STATUS_COL] !== prev) { cid++; prev = r[TM_BATTERY_STATUS_COL]; }
    r.cycle_id = cid;
    r.cycle_type = TM_STATUS_LABELS[r[TM_BATTERY_STATUS_COL]] || "Other";
  });
}

function tmBuildCycleTable(rows, cycleType, deltaCol, maxCol, minCol, maxLabel, minLabel, deltaLabel) {
  const groups = {};
  rows.filter(r => r.cycle_type === cycleType).forEach(r => {
    (groups[r.cycle_id] = groups[r.cycle_id] || []).push(r);
  });

  const out = [];
  Object.values(groups).forEach(group => {
    const g = group.filter(r => r[deltaCol] != null && r._ts);
    if (!g.length) return;
    const start = group.reduce((a, r) => (!a || (r._ts && r._ts < a)) ? r._ts : a, null);
    const end = group.reduce((a, r) => (!a || (r._ts && r._ts > a)) ? r._ts : a, null);
    let minRow = g[0], maxRow = g[0], sum = 0;
    g.forEach(r => {
      if (r[deltaCol] < minRow[deltaCol]) minRow = r;
      if (r[deltaCol] > maxRow[deltaCol]) maxRow = r;
      sum += r[deltaCol];
    });
    out.push({
      start, end, duration: end - start,
      minDelta: minRow[deltaCol], maxAtMin: minRow[maxCol], minAtMin: minRow[minCol],
      maxDelta: maxRow[deltaCol], maxAtMax: maxRow[maxCol], minAtMax: maxRow[minCol],
      avgDelta: sum / g.length,
    });
  });
  out.sort((a, b) => a.start - b.start);
  out.forEach((r, i) => r.num = i + 1);
  return out;
}

function tmBuildOverallExtremes(rows, deltaCol, maxCol, minCol) {
  const clean = rows.filter(r => r[deltaCol] != null && r.soc != null && r._ts);
  if (!clean.length) return null;
  let minRow = clean[0], maxRow = clean[0], sum = 0;
  clean.forEach(r => {
    if (r[deltaCol] < minRow[deltaCol]) minRow = r;
    if (r[deltaCol] > maxRow[deltaCol]) maxRow = r;
    sum += r[deltaCol];
  });
  const avg = sum / clean.length;
  let avgRow = clean[0], bestDiff = Infinity;
  clean.forEach(r => { const d = Math.abs(r[deltaCol] - avg); if (d < bestDiff) { bestDiff = d; avgRow = r; } });
  return { minRow, maxRow, avgRow, avg, maxCol, minCol };
}

function tmFmtDur(ms) {
  if (!isFinite(ms)) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `${h}h ${m}m`;
}
function tmR3(v) { return v == null ? "—" : Math.round(v * 1000) / 1000; }

function tmCycleTableHtml(rows, maxLabel, minLabel, deltaLabel) {
  if (!rows.length) return `<div class="tm-empty">No cycles found.</div>`;
  return `
    <div class="tm-table-scroll">
    <table class="obs-tbl tm-tbl">
      <thead><tr>
        <th>Cycle #</th><th>Start</th><th>End</th><th>Duration</th>
        <th>Min ${deltaLabel} Δ</th><th>${maxLabel} @Min</th><th>${minLabel} @Min</th>
        <th>Max ${deltaLabel} Δ</th><th>${maxLabel} @Max</th><th>${minLabel} @Max</th>
        <th>Avg ${deltaLabel} Δ</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.num}</td><td>${r.start.toLocaleString()}</td><td>${r.end.toLocaleString()}</td>
            <td>${tmFmtDur(r.duration)}</td>
            <td class="tm-mono">${tmR3(r.minDelta)}</td><td class="tm-mono">${tmR3(r.maxAtMin)}</td><td class="tm-mono">${tmR3(r.minAtMin)}</td>
            <td class="tm-mono">${tmR3(r.maxDelta)}</td><td class="tm-mono">${tmR3(r.maxAtMax)}</td><td class="tm-mono">${tmR3(r.minAtMax)}</td>
            <td class="tm-mono">${tmR3(r.avgDelta)}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    </div>`;
}

function tmOverallTableHtml(res, maxLabel, minLabel, deltaLabel) {
  if (!res) return `<div class="tm-empty">Not enough data to compute this.</div>`;
  const row = (name, r, valOverride) => `
    <tr>
      <td>${name}</td><td class="tm-mono">${tmR3(valOverride != null ? valOverride : r[res.maxCol] - r[res.minCol])}</td>
      <td class="tm-mono">${tmR3(r[res.maxCol])}</td><td class="tm-mono">${tmR3(r[res.minCol])}</td>
      <td class="tm-mono">${tmR3(r.soc)}</td><td>${r._ts.toLocaleString()}</td>
    </tr>`;
  return `
    <div class="tm-table-scroll">
    <table class="obs-tbl tm-tbl">
      <thead><tr><th>Metric</th><th>${deltaLabel} Δ</th><th>${maxLabel}</th><th>${minLabel}</th><th>SOC (%)</th><th>Timestamp</th></tr></thead>
      <tbody>
        ${row("Min " + deltaLabel + " Delta", res.minRow)}
        ${row("Max " + deltaLabel + " Delta", res.maxRow)}
        ${row("Avg " + deltaLabel + " Delta (closest match)", res.avgRow, res.avg)}
      </tbody>
    </table>
    </div>`;
}

function tmRenderCycleTables() {
  TM.filtered.forEach(r => {
    r.voltage_delta = (r.battery_max_cell_voltage != null && r.battery_min_cell_voltage != null)
      ? r.battery_max_cell_voltage - r.battery_min_cell_voltage : null;
    r.battery_temp_delta = (r.battery_max_cell_temp != null && r.battery_min_cell_temperature != null)
      ? r.battery_max_cell_temp - r.battery_min_cell_temperature : null;
  });

  const vWrap = document.getElementById("tmVoltageTables");
  const tWrap = document.getElementById("tmTempTables");

  if (TM.hasBatteryStatus) {
    const vCharge = tmBuildCycleTable(TM.filtered, "Charging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage");
    const vDischarge = tmBuildCycleTable(TM.filtered, "Discharging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage");
    vWrap.innerHTML = `
      <div class="tm-caption">Cycles detected from <code>battery_status</code> (10 = Charging, 4 = Discharging).</div>
      <div class="tm-subhead">Charging Cycles</div>${tmCycleTableHtml(vCharge, "Max Cell Voltage", "Min Cell Voltage", "Voltage")}
      <div class="tm-subhead">Discharging Cycles</div>${tmCycleTableHtml(vDischarge, "Max Cell Voltage", "Min Cell Voltage", "Voltage")}
    `;
    const tCharge = tmBuildCycleTable(TM.filtered, "Charging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature");
    const tDischarge = tmBuildCycleTable(TM.filtered, "Discharging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature");
    tWrap.innerHTML = `
      <div class="tm-caption">Cycles detected from <code>battery_status</code> (10 = Charging, 4 = Discharging).</div>
      <div class="tm-subhead">Charging Cycles</div>${tmCycleTableHtml(tCharge, "Max Temp", "Min Temp", "Temp")}
      <div class="tm-subhead">Discharging Cycles</div>${tmCycleTableHtml(tDischarge, "Max Temp", "Min Temp", "Temp")}
    `;
  } else {
    const vRes = tmBuildOverallExtremes(TM.filtered, "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage");
    vWrap.innerHTML = `<div class="tm-caption">No <code>battery_status</code> column found — showing overall extremes instead.</div>${tmOverallTableHtml(vRes, "Max Cell Voltage", "Min Cell Voltage", "Voltage")}`;
    const tRes = tmBuildOverallExtremes(TM.filtered, "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature");
    tWrap.innerHTML = `<div class="tm-caption">No <code>battery_status</code> column found — showing overall extremes instead.</div>${tmOverallTableHtml(tRes, "Max Temp", "Min Temp", "Temp")}`;
  }
}


/* ══════════════════════════════════════════════════════════════════════════
   8. RAW DATA PREVIEW + CSV EXPORT
   ══════════════════════════════════════════════════════════════════════════ */

function tmInitRawAndExport() {
  document.getElementById("tmToggleRaw").addEventListener("click", (e) => {
    const wrap = document.getElementById("tmRawWrap");
    const show = wrap.style.display === "none";
    wrap.style.display = show ? "block" : "none";
    e.target.textContent = show ? "Hide raw data preview" : "Show raw data preview";
    if (show) tmRenderRawPreview();
  });
  document.getElementById("tmDownloadCsv").addEventListener("click", tmDownloadCsv);
}

function tmRenderRawPreview() {
  const wrap = document.getElementById("tmRawWrap");
  const preview = TM.filtered.slice(0, 500);
  if (!preview.length) { wrap.innerHTML = `<div class="tm-empty">No rows to show.</div>`; return; }
  const cols = TM.columns;
  wrap.innerHTML = `
    <div class="tm-table-scroll" style="max-height:420px">
      <table class="obs-tbl tm-tbl">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${preview.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function tmDownloadCsv() {
  if (!TM.filtered.length) return;
  const cols = TM.columns;
  const lines = [cols.join(",")];
  TM.filtered.forEach(r => {
    lines.push(cols.map(c => {
      let v = r[c];
      if (v == null) v = "";
      v = String(v).replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  saveAs(blob, "telematics_filtered.csv");
}


/* ══════════════════════════════════════════════════════════════════════════
   9. INIT
   ══════════════════════════════════════════════════════════════════════════ */

function tmInit() {
  tmInitUpload();
  tmInitRawAndExport();
  tmInitExport();
  tmInitManagerEmail();
}

tmInit();

/* Remember the manager's email in this browser between visits. */
function tmInitManagerEmail() {
  const input = document.getElementById("tmManagerEmail");
  const saved = localStorage.getItem("tm_manager_email");
  if (saved) input.value = saved;
  input.addEventListener("change", () => {
    localStorage.setItem("tm_manager_email", input.value.trim());
  });
}


/* ══════════════════════════════════════════════════════════════════════════
   10. EXPORT (PDF + WORD)

   Report structure:
     1. Filters Applied
     2. Error Code Summary (aggregated by DTC)
     3. Parameter Trend Chart (snapshot of whatever is currently plotted)
     4. Voltage Delta Cycles (Charging / Discharging)
     5. Temperature Delta Cycles (Charging / Discharging)
   ══════════════════════════════════════════════════════════════════════════ */

function tmInitExport() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".xwrap")) {
      document.getElementById("tmXmenu")?.classList.remove("open");
    }
  });
}

function tmToggleExport() {
  document.getElementById("tmXmenu").classList.toggle("open");
}

function tmErrorSummary() {
  const errors = TM.filtered.filter(r => {
    const v = r.e_code;
    if (v == null) return false;
    return typeof v === "number" ? v !== 0 : String(v).trim() !== "";
  });
  const groups = {};
  errors.forEach(r => {
    const key = String(r.e_code);
    if (!groups[key]) groups[key] = { code: key, count: 0, first: r._ts, last: r._ts };
    groups[key].count++;
    if (r._ts && (!groups[key].first || r._ts < groups[key].first)) groups[key].first = r._ts;
    if (r._ts && (!groups[key].last || r._ts > groups[key].last)) groups[key].last = r._ts;
  });
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

async function tmCaptureChartImages() {
  const images = [];
  const single = document.getElementById("tmPlotHost");
  const indiv = document.querySelectorAll(".tm-indiv-chart");
  const targets = single ? [single] : Array.from(indiv);
  for (const el of targets) {
    if (!el || !window.Plotly) continue;
    try {
      const url = await Plotly.toImage(el, { format: "png", width: 900, height: el === single ? 420 : 260, scale: 2 });
      images.push(url);
    } catch (e) { console.warn("Chart capture failed", e); }
  }
  return images;
}

async function tmDoExport(type) {
  document.getElementById("tmXmenu")?.classList.remove("open");
  if (!TM.filtered.length) { alert("Upload a telematics file first."); return; }

  const images = await tmCaptureChartImages();
  const d = {
    generated: new Date().toLocaleString("en-IN"),
    fileName: TM.fileName,
    totalRows: TM.rows.length,
    filteredRows: TM.filtered.length,
    filters: TM.filters,
    selectedParams: TM.selectedParams,
    errorSummary: tmErrorSummary(),
    hasBatteryStatus: TM.hasBatteryStatus,
    vCharge: tmBuildCycleTable(TM.filtered, "Charging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage"),
    vDischarge: tmBuildCycleTable(TM.filtered, "Discharging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage"),
    tCharge: tmBuildCycleTable(TM.filtered, "Charging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature"),
    tDischarge: tmBuildCycleTable(TM.filtered, "Discharging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature"),
    chartImages: images,
  };

  type === "pdf" ? tmExportPDF(d) : tmExportWord(d);
}

function tmFiltersText(d) {
  const f = d.filters;
  const parts = [];
  parts.push(`VIN: ${f.vin}`);
  parts.push(`Vehicle Type: ${f.vtype}`);
  parts.push(`Ignition: ${f.ignition.size ? [...f.ignition].join(", ") : "All"}`);
  if (f.dateStart && f.dateEnd) {
    parts.push(`Date Range: ${f.dateStart.toLocaleDateString()} – ${f.dateEnd.toLocaleDateString()}`);
  }
  return parts;
}

/* ── PDF Export ── */
function tmBuildPDFDoc(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 18;
  let y = 0;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkY = need => { if (y + need > 272) addPage(); };

  /* Cover header */
  doc.setFillColor(72, 69, 210); doc.rect(0, 0, W, 32, "F");
  doc.setFillColor(255, 255, 255); doc.rect(0, 32, W, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text("SWITCH", M, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Telematics Dashboard Report · Current Engineering", M, 22);
  doc.text(`Generated: ${d.generated}`, W - M, 14, { align: "right" });
  doc.text(`File: ${d.fileName || "—"}`, W - M, 22, { align: "right" });
  y = 48;

  const sh = (t, yy) => {
    doc.setFillColor(244, 246, 251); doc.rect(M, yy - 5, W - M * 2, 8, "F");
    doc.setFillColor(72, 69, 210); doc.rect(M, yy - 5, 3, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(82, 88, 120);
    doc.text(t, M + 6, yy);
    return yy + 10;
  };
  const hr = () => { doc.setFillColor(226, 230, 239); doc.rect(M, y, W - M * 2, .5, "F"); y += 6; };
  const h1 = (t) => {
    checkY(16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(26, 29, 46);
    doc.text(t, M, y); y += 8;
  };

  /* 1. Filters Applied */
  h1("1. FILTERS APPLIED");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(82, 88, 120);
  tmFiltersText(d).forEach(line => { doc.text(line, M, y); y += 5.5; });
  doc.text(`Rows: ${d.filteredRows.toLocaleString()} of ${d.totalRows.toLocaleString()} total`, M, y); y += 8;
  hr();

  /* 2. Error Code Summary */
  h1("2. ERROR CODE SUMMARY");
  if (!d.errorSummary.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(82, 88, 120);
    doc.text("No error codes found in the filtered dataset.", M, y); y += 8;
  } else {
    doc.setFillColor(72, 69, 210); doc.rect(M, y - 5, W - M * 2, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text("CODE", M + 2, y); doc.text("NAME", M + 20, y); doc.text("COUNT", M + 95, y);
    doc.text("FIRST SEEN", M + 118, y); doc.text("LAST SEEN", M + 160, y);
    y += 6;
    d.errorSummary.slice(0, 25).forEach((e, i) => {
      checkY(8);
      doc.setFillColor(...(i % 2 === 0 ? [250, 251, 254] : [255, 255, 255]));
      doc.rect(M, y - 4, W - M * 2, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(72, 69, 210);
      doc.text(String(e.code), M + 2, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(26, 29, 46);
      doc.text((tmDtcName(e.code) || "").substring(0, 34), M + 20, y);
      doc.text(String(e.count), M + 95, y);
      doc.setFontSize(6.5); doc.setTextColor(82, 88, 120);
      doc.text(e.first ? e.first.toLocaleString() : "—", M + 118, y);
      doc.text(e.last ? e.last.toLocaleString() : "—", M + 160, y);
      y += 7;
    });
    if (d.errorSummary.length > 25) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(155, 160, 190);
      doc.text(`...and ${d.errorSummary.length - 25} more DTC(s) not shown.`, M, y); y += 6;
    }
  }
  y += 4; hr();

  /* 3. Parameter Trend Chart */
  checkY(20);
  h1("3. PARAMETER TREND CHART");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(82, 88, 120);
  doc.text(`Parameters: ${d.selectedParams.join(", ") || "—"}`, M, y); y += 6;
  if (d.chartImages.length) {
    d.chartImages.forEach(img => {
      const w = W - M * 2, h = w * 0.44;
      checkY(h + 6);
      doc.addImage(img, "PNG", M, y, w, h);
      y += h + 6;
    });
  } else {
    doc.text("No chart available to embed (select parameters on the dashboard first).", M, y); y += 8;
  }
  hr();

  /* 4 & 5. Cycle tables */
  const cycleSection = (title, rows, maxLabel, minLabel, deltaLabel) => {
    checkY(16);
    h1(title);
    if (!rows.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(82, 88, 120);
      doc.text("No cycles found.", M, y); y += 8;
      return;
    }
    doc.setFillColor(240, 242, 252); doc.rect(M, y - 4, W - M * 2, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.3); doc.setTextColor(82, 88, 120);
    doc.text("#", M + 1, y); doc.text("START", M + 8, y); doc.text("DUR", M + 55, y);
    doc.text(`MIN ${deltaLabel}Δ`, M + 72, y); doc.text(`MAX ${deltaLabel}Δ`, M + 105, y); doc.text(`AVG ${deltaLabel}Δ`, M + 138, y);
    y += 6.5;
    rows.slice(0, 20).forEach((r, i) => {
      checkY(7);
      doc.setFillColor(...(i % 2 === 0 ? [250, 251, 254] : [255, 255, 255]));
      doc.rect(M, y - 4, W - M * 2, 6.5, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(26, 29, 46);
      doc.text(String(r.num), M + 1, y);
      doc.text(r.start.toLocaleString(), M + 8, y);
      doc.text(tmFmtDur(r.duration), M + 55, y);
      doc.text(String(tmR3(r.minDelta)), M + 72, y);
      doc.text(String(tmR3(r.maxDelta)), M + 105, y);
      doc.text(String(tmR3(r.avgDelta)), M + 138, y);
      y += 6.5;
    });
    if (rows.length > 20) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(6.8); doc.setTextColor(155, 160, 190);
      doc.text(`...and ${rows.length - 20} more cycle(s) not shown.`, M, y); y += 6;
    }
    y += 4;
  };

  if (d.hasBatteryStatus) {
    cycleSection("4. VOLTAGE DELTA — CHARGING CYCLES", d.vCharge, "Max V", "Min V", "V");
    cycleSection("4b. VOLTAGE DELTA — DISCHARGING CYCLES", d.vDischarge, "Max V", "Min V", "V");
    hr();
    cycleSection("5. TEMPERATURE DELTA — CHARGING CYCLES", d.tCharge, "Max T", "Min T", "T");
    cycleSection("5b. TEMPERATURE DELTA — DISCHARGING CYCLES", d.tDischarge, "Max T", "Min T", "T");
  } else {
    checkY(16);
    h1("4 & 5. VOLTAGE / TEMPERATURE DELTA");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(82, 88, 120);
    doc.text("No battery_status column found in this file — cycle detection unavailable.", M, y); y += 8;
  }

  /* Footer on every page */
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const FY = doc.internal.pageSize.height;
    doc.setFillColor(244, 246, 251); doc.rect(0, FY - 16, W, 16, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(155, 163, 190);
    doc.text("SWITCH Telematics Dashboard · Current Engineering · Confidential", M, FY - 8);
    doc.text(`${d.generated} · Page ${p}/${pageCount}`, W - M, FY - 8, { align: "right" });
  }

  return doc;
}

function tmExportPDF(d) {
  const doc = tmBuildPDFDoc(d);
  doc.save(`Telematics_Report_${(d.fileName || "report").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`);
}

/* ── Email PDF Report to Manager (via serverless function — see
     /netlify/functions/send-report.js) ──
   Browsers can't safely hold email/API credentials, so this posts the
   generated PDF to a small backend function that actually sends the mail.
   See HOSTING_EMAIL_SETUP.md for how to deploy that function. */
async function tmEmailReport() {
  document.getElementById("tmXmenu")?.classList.remove("open");
  if (!TM.filtered.length) { alert("Upload a telematics file first."); return; }

  const emailInput = document.getElementById("tmManagerEmail");
  const to = emailInput.value.trim();
  if (!to || !to.includes("@")) {
    alert("Enter your manager's email address first.");
    emailInput.focus();
    return;
  }
  localStorage.setItem("tm_manager_email", to);

  const btn = document.querySelector('.xitem[onclick="tmEmailReport()"]');
  const originalText = btn ? btn.textContent : "";
  if (btn) { btn.textContent = "Sending..."; btn.style.pointerEvents = "none"; }

  try {
    const images = await tmCaptureChartImages();
    const d = {
      generated: new Date().toLocaleString("en-IN"),
      fileName: TM.fileName,
      totalRows: TM.rows.length,
      filteredRows: TM.filtered.length,
      filters: TM.filters,
      selectedParams: TM.selectedParams,
      errorSummary: tmErrorSummary(),
      hasBatteryStatus: TM.hasBatteryStatus,
      vCharge: tmBuildCycleTable(TM.filtered, "Charging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage"),
      vDischarge: tmBuildCycleTable(TM.filtered, "Discharging", "voltage_delta", "battery_max_cell_voltage", "battery_min_cell_voltage"),
      tCharge: tmBuildCycleTable(TM.filtered, "Charging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature"),
      tDischarge: tmBuildCycleTable(TM.filtered, "Discharging", "battery_temp_delta", "battery_max_cell_temp", "battery_min_cell_temperature"),
      chartImages: images,
    };

    const doc = tmBuildPDFDoc(d);
    const pdfBase64 = doc.output("datauristring").split(",")[1]; // strip "data:application/pdf;base64,"
    const fileName = `Telematics_Report_${(d.fileName || "report").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    const resp = await fetch("/.netlify/functions/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject: `Telematics Report — ${d.fileName || "dataset"} (${d.generated})`,
        summary: `Rows: ${d.filteredRows.toLocaleString()} of ${d.totalRows.toLocaleString()} · Errors found: ${d.errorSummary.length} · Generated: ${d.generated}`,
        fileName,
        pdfBase64,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(errText || `Server responded ${resp.status}`);
    }

    alert(`Report emailed to ${to}.`);
  } catch (err) {
    console.error(err);
    alert("Couldn't send the email. Check that the send-report function is deployed and configured (see HOSTING_EMAIL_SETUP.md), then try again.\n\n" + err.message);
  } finally {
    if (btn) { btn.textContent = originalText; btn.style.pointerEvents = ""; }
  }
}

/* ── Word Export ── */
async function tmExportWord(d) {
  try {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            WidthType, BorderStyle, HeadingLevel, ShadingType, ImageRun } = docx;

    const bdr = { style: BorderStyle.SINGLE, size: 1, color: "CBD1E5" };
    const bdrAll = { top: bdr, bottom: bdr, left: bdr, right: bdr };
    const hdrShd = { fill: "4845D2", type: ShadingType.CLEAR };

    const cell = (txt, w, bold, shade, color) => new TableCell({
      width: { size: w, type: WidthType.DXA }, borders: bdrAll,
      shading: shade || { type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: String(txt ?? "—"), bold: bold || false, font: "Arial", size: 18, color: color || "1A1D35" })] })],
    });
    const hcell = (txt, w) => cell(txt, w, true, hdrShd, "FFFFFF");

    const children = [];

    children.push(new Paragraph({ children: [
      new TextRun({ text: "SWITCH — TELEMATICS DASHBOARD REPORT", bold: true, size: 32, color: "4845D2", font: "Arial" }),
    ] }));
    children.push(new Paragraph({ children: [
      new TextRun({ text: `${d.generated}  |  File: ${d.fileName || "—"}  |  Rows: ${d.filteredRows.toLocaleString()} of ${d.totalRows.toLocaleString()}`, size: 16, color: "9AA0BE", font: "Courier New" }),
    ], spacing: { after: 300 } }));

    /* 1. Filters */
    children.push(new Paragraph({ text: "1. FILTERS APPLIED", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
    tmFiltersText(d).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, font: "Arial" })], spacing: { after: 60 } }));
    });
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "" })] }));

    /* 2. Error Code Summary */
    children.push(new Paragraph({ text: "2. ERROR CODE SUMMARY", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
    if (!d.errorSummary.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: "No error codes found in the filtered dataset.", size: 20, font: "Arial" })], spacing: { after: 200 } }));
    } else {
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [1200, 3600, 1200, 1680, 1680],
        rows: [
          new TableRow({ children: [hcell("Code", 1200), hcell("Name", 3600), hcell("Count", 1200), hcell("First Seen", 1680), hcell("Last Seen", 1680)] }),
          ...d.errorSummary.map(e => new TableRow({ children: [
            cell(e.code, 1200, true),
            cell(tmDtcName(e.code), 3600),
            cell(e.count, 1200),
            cell(e.first ? e.first.toLocaleString() : "—", 1680),
            cell(e.last ? e.last.toLocaleString() : "—", 1680),
          ] })),
        ],
      }));
    }
    children.push(new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: "" })] }));

    /* 3. Parameter Trend Chart */
    children.push(new Paragraph({ text: "3. PARAMETER TREND CHART", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Parameters: ${d.selectedParams.join(", ") || "—"}`, size: 20, font: "Arial" })], spacing: { after: 120 } }));
    for (const imgUrl of d.chartImages) {
      try {
        const resp = await fetch(imgUrl);
        const buf = await resp.arrayBuffer();
        children.push(new Paragraph({
          children: [new ImageRun({ data: buf, transformation: { width: 600, height: 264 } })],
          spacing: { after: 200 },
        }));
      } catch (e) { console.warn("Could not embed chart image in Word doc", e); }
    }
    if (!d.chartImages.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: "No chart available to embed.", size: 20, font: "Arial" })], spacing: { after: 200 } }));
    }

    /* 4 & 5. Cycle tables */
    const cycleSection = (title, rows, deltaLabel) => {
      children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 120 } }));
      if (!rows.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: "No cycles found.", size: 20, font: "Arial" })], spacing: { after: 200 } }));
        return;
      }
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [700, 1800, 1200, 1400, 1400, 1400, 1460],
        rows: [
          new TableRow({ children: [
            hcell("#", 700), hcell("Start", 1800), hcell("Duration", 1200),
            hcell(`Min ${deltaLabel}Δ`, 1400), hcell(`Max ${deltaLabel}Δ`, 1400), hcell(`Avg ${deltaLabel}Δ`, 1400), hcell("End", 1460),
          ] }),
          ...rows.map(r => new TableRow({ children: [
            cell(r.num, 700), cell(r.start.toLocaleString(), 1800), cell(tmFmtDur(r.duration), 1200),
            cell(tmR3(r.minDelta), 1400), cell(tmR3(r.maxDelta), 1400), cell(tmR3(r.avgDelta), 1400), cell(r.end.toLocaleString(), 1460),
          ] })),
        ],
      }));
      children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "" })] }));
    };

    if (d.hasBatteryStatus) {
      cycleSection("4. VOLTAGE DELTA — CHARGING CYCLES", d.vCharge, "V");
      cycleSection("4b. VOLTAGE DELTA — DISCHARGING CYCLES", d.vDischarge, "V");
      cycleSection("5. TEMPERATURE DELTA — CHARGING CYCLES", d.tCharge, "T");
      cycleSection("5b. TEMPERATURE DELTA — DISCHARGING CYCLES", d.tDischarge, "T");
    } else {
      children.push(new Paragraph({ text: "4 & 5. VOLTAGE / TEMPERATURE DELTA", heading: HeadingLevel.HEADING_1, spacing: { after: 120 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: "No battery_status column found in this file — cycle detection unavailable.", size: 20, font: "Arial" })] }));
    }

    const dc = new Document({ styles: { default: { document: { run: { font: "Arial", size: 20 } } } }, sections: [{ children }] });
    const buf = await Packer.toBlob(dc);
    saveAs(buf, `Telematics_Report_${(d.fileName || "report").replace(/[^a-zA-Z0-9]/g, "-")}.docx`);

  } catch (e) {
    console.error(e);
    alert("Word export failed — try PDF instead.");
  }
}
