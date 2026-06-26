import {
  analyzeCheckins,
  colorFromName,
  escapeHtml,
  formatDateKey,
  formatEuro,
  formatMonthLabel,
  groupMonthKeysByYear,
  guessVisitPrice,
  normalizeEuroAmount,
  parseCSV,
  parseGermanDate,
  shortFacilityName,
} from "./lib/core.js";

const DEFAULT_REPO_URL = "https://github.com/PapPatrick/WellpassChecker";

let checkins = [];
let facilityPrices = {};

const page = document.getElementById("page");
const landing = document.getElementById("landing");
const dashboard = document.getElementById("dashboard");
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("file-input");
const reuploadTop = document.getElementById("reupload-top");

function getFacilityColor(name) {
  return colorFromName(name);
}

function openFilePicker() {
  fileInput.value = "";
  fileInput.click();
}

function showDashboard() {
  landing.hidden = true;
  dashboard.hidden = false;
  if (reuploadTop) reuploadTop.hidden = false;
  page.classList.add("page--dashboard");
}

function processCSV(text) {
  facilityPrices = {};
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("Die CSV-Datei enthält keine Daten.");

  const header = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
  const dateIdx = header.findIndex((h) => h.includes("datum") || h.includes("date"));
  const facilityIdx = header.findIndex(
    (h) => h.includes("einrichtung") || h.includes("facility") || h.includes("name")
  );

  if (dateIdx === -1 || facilityIdx === -1) {
    throw new Error("Unerwartetes CSV-Format. Erwartet: Datum, Name der Einrichtung, …");
  }

  checkins = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseGermanDate(row[dateIdx]);
    const facility = (row[facilityIdx] || "").replace(/"/g, "").trim();
    if (date && facility) {
      checkins.push({ date, facility });
    }
  }

  if (checkins.length === 0) throw new Error("Keine gültigen Check-ins gefunden.");

  checkins.sort((a, b) => a.date - b.date);

  const facilities = [...new Set(checkins.map((c) => c.facility))];
  for (const f of facilities) {
    if (!(f in facilityPrices)) {
      facilityPrices[f] = guessVisitPrice(f);
    }
  }

  const first = checkins[0].date;
  const last = checkins[checkins.length - 1].date;
  document.getElementById("membership-start").value = formatDateKey(first);
  document.getElementById("membership-end").value = formatDateKey(last);

  showDashboard();
  render();
}

function getAnalysis() {
  const monthlyFee = normalizeEuroAmount(document.getElementById("monthly-fee").value);
  const startKey = document.getElementById("membership-start").value;
  const endKey = document.getElementById("membership-end").value;

  return analyzeCheckins({
    checkins,
    facilityPrices,
    monthlyFee,
    startKey,
    endKey,
  });
}

function renderMonthBar(key, data, maxMonthCount, showYearLabel) {
  const count = data.byMonth[key] || 0;
  const stackHeight = count > 0 ? (count / maxMonthCount) * 130 : 4;
  const stackStyle = `height: ${stackHeight}px`;
  const monthFacilities = data.byMonthByFacility[key] || {};
  const monthLabel = formatMonthLabel(key, showYearLabel);
  const segments = Object.entries(monthFacilities)
    .sort((a, b) => b[1] - a[1])
    .map(([facility, segCount]) => {
      const segHeight = (segCount / count) * stackHeight;
      const color = getFacilityColor(facility);
      return `<div class="month-bar__segment"
        style="height: ${segHeight}px; background: ${color}; color: ${color}"
        data-facility="${escapeHtml(facility)}"
        data-count="${segCount}"
        data-month="${monthLabel}"
        data-color="${color}"></div>`;
    })
    .join("");

  return `
    <div class="month-bar${count === 0 ? " month-bar--empty" : ""}" title="${monthLabel}: ${count} Check-ins">
      <div class="month-bar__count">${count || ""}</div>
      <div class="month-bar__stack" style="${stackStyle}">${segments}</div>
      <div class="month-bar__label">${monthLabel}</div>
    </div>
  `;
}

function renderSavingsPanel(data) {
  const panel = document.getElementById("savings-panel");

  if (!data.hasCheckins) {
    panel.innerHTML = `
      <h2 class="section-title">Kosten-Nutzen-Rechnung</h2>
      <div class="empty-notice empty-notice--panel">
        Keine Check-ins im gewählten Mitgliedschaftszeitraum.
        Passe die Daten oben an oder lade eine andere CSV.
      </div>
    `;
    return;
  }

  const isPositive = data.netSavings >= 0;
  const periodStr = data.firstDate && data.lastDate
    ? `${data.firstDate.toLocaleDateString("de-DE")} – ${data.lastDate.toLocaleDateString("de-DE")}`
    : "–";
  const periodHint = data.spansMultipleYears
    ? ` (${data.membershipMonths} Monate über ${data.yearCount} Jahre)`
    : ` (${data.membershipMonths} Monate)`;

  panel.innerHTML = `
    <h2 class="section-title">Kosten-Nutzen-Rechnung</h2>
    <div class="savings-hero">
      <div class="savings-hero__amount ${isPositive ? "positive" : "negative"}">
        ${isPositive ? "+" : ""}${formatEuro(data.netSavings)}
      </div>
      <p class="savings-hero__text">
        ${
          isPositive
            ? `Du hast im Zeitraum <strong>${periodStr}</strong>${periodHint} geschätzt <strong>${formatEuro(data.estimatedVisitValue)}</strong> an Tageskartenwert genutzt – bei <strong>${formatEuro(data.membershipCost)}</strong> Mitgliedsbeitrag (${data.membershipMonths} Monate × ${formatEuro(data.monthlyFee)}).`
            : `Du zahlst im Zeitraum <strong>${periodStr}</strong>${periodHint} <strong>${formatEuro(data.membershipCost)}</strong> Mitgliedsbeitrag, nutzt aber nur etwa <strong>${formatEuro(data.estimatedVisitValue)}</strong> an Tageskartenwert. Du gehst zu selten – oder passe den Eigenbeitrag oben an.`
        }
      </p>
    </div>
    <div class="savings-breakdown">
      <div class="savings-breakdown__item">
        <div class="savings-breakdown__label">Geschätzter Tageskartenwert</div>
        <div class="savings-breakdown__value">${formatEuro(data.estimatedVisitValue)}</div>
      </div>
      <div class="savings-breakdown__item">
        <div class="savings-breakdown__label">Mitgliedsbeitrag (${data.membershipMonths} Mon.)</div>
        <div class="savings-breakdown__value">− ${formatEuro(data.membershipCost)}</div>
      </div>
      <div class="savings-breakdown__item">
        <div class="savings-breakdown__label">Kosten pro Besuch (Wellpass)</div>
        <div class="savings-breakdown__value">${formatEuro(data.membershipCost / data.totalCheckins)}</div>
      </div>
      <div class="savings-breakdown__item">
        <div class="savings-breakdown__label">Ø Tageskartenwert pro Besuch</div>
        <div class="savings-breakdown__value">${formatEuro(data.estimatedVisitValue / data.totalCheckins)}</div>
      </div>
    </div>
    ${
      !isPositive
        ? `<div class="breakeven breakeven--negative">Du bräuchtest etwa <strong>${Math.ceil(data.breakevenVisits)} Besuche</strong> im Zeitraum (statt ${data.totalCheckins}), um break-even zu sein – bei durchschnittlich ${formatEuro(data.estimatedVisitValue / data.totalCheckins)} pro Besuch.</div>`
        : `<div class="breakeven breakeven--positive">Wellpass lohnt sich für dich! Jeder Besuch kostet dich effektiv <strong>${formatEuro(data.membershipCost / data.totalCheckins)}</strong> statt Ø <strong>${formatEuro(data.estimatedVisitValue / data.totalCheckins)}</strong> als Tageskarte.</div>`
    }
  `;
}

function render() {
  const data = getAnalysis();
  renderSavingsPanel(data);

  if (!data.hasCheckins) {
    document.getElementById("summary-cards").innerHTML = "";
    document.getElementById("facility-legend").innerHTML = "";
    document.getElementById("facility-list").innerHTML = "";
    document.getElementById("month-chart").innerHTML = "";
    document.getElementById("month-chart").className = "month-chart";
    return;
  }

  const maxCount = Math.max(...data.facilityDetails.map((f) => f.count), 1);
  const maxMonthCount = Math.max(...Object.values(data.byMonth), 1);
  const sortedFacilities = [...data.facilityDetails]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((f) => f.name);

  document.getElementById("summary-cards").innerHTML = `
    <div class="summary-card">
      <div class="summary-card__value">${data.totalCheckins}</div>
      <div class="summary-card__label">Check-ins gesamt</div>
    </div>
    <div class="summary-card">
      <div class="summary-card__value">${data.facilityCount}</div>
      <div class="summary-card__label">Einrichtungen</div>
    </div>
    <div class="summary-card">
      <div class="summary-card__value">${data.avgVisitsPerMonth.toFixed(1)}</div>
      <div class="summary-card__label">Ø Besuche / Monat</div>
    </div>
    ${
      data.spansMultipleYears
        ? `
    <div class="summary-card">
      <div class="summary-card__value">${data.yearCount}</div>
      <div class="summary-card__label">Jahre im Zeitraum</div>
    </div>`
        : ""
    }
  `;

  document.getElementById("facility-legend").innerHTML = sortedFacilities
    .map(
      (name) => `
    <span class="facility-legend__item" title="${escapeHtml(name)}">
      <span class="facility-legend__dot" style="background: ${getFacilityColor(name)}"></span>
      ${escapeHtml(shortFacilityName(name))}
    </span>
  `
    )
    .join("");

  document.getElementById("facility-list").innerHTML = data.facilityDetails
    .map((f) => {
      const color = getFacilityColor(f.name);
      const pct = ((f.count / data.totalCheckins) * 100).toFixed(0);
      return `
    <div class="facility-row" data-facility="${escapeHtml(f.name)}">
      <div class="facility-row__swatch" style="background: ${color}"></div>
      <div class="facility-row__name">${escapeHtml(f.name)}</div>
      <div class="facility-row__meta">
        <label>
          <span class="sr-only">Tageskarte €</span>
          <input type="number" class="facility-row__price-input" data-facility="${escapeHtml(f.name)}"
            value="${f.pricePerVisit}" min="0" step="0.5" title="Geschätzter Tageskartenpreis"> €
        </label>
        <span class="facility-row__value">= ${formatEuro(f.total)}</span>
      </div>
      <div class="facility-row__pct">${pct}%</div>
      <div class="facility-row__count">${f.count}×</div>
      <div class="facility-row__bar-wrap">
        <div class="facility-row__bar" style="width: ${(f.count / maxCount) * 100}%; background: ${color}"></div>
      </div>
    </div>
  `;
    })
    .join("");

  document.querySelectorAll(".facility-row__price-input").forEach((input) => {
    input.addEventListener("change", () => {
      facilityPrices[input.dataset.facility] = parseFloat(input.value) || 0;
      render();
    });
  });

  const monthChart = document.getElementById("month-chart");
  const showYearLabel = data.spansMultipleYears;
  const yearGroups = groupMonthKeysByYear(data.monthKeys);
  const compactChart = data.monthKeys.length > 18;

  monthChart.className = `month-chart${data.spansMultipleYears ? " month-chart--multi-year" : ""}${compactChart ? " month-chart--compact" : ""}`;

  monthChart.innerHTML = yearGroups
    .map((group) => {
      const bars = group.keys
        .map((key) => renderMonthBar(key, data, maxMonthCount, showYearLabel))
        .join("");

      if (!data.spansMultipleYears) return bars;

      return `
        <div class="month-chart__year-group">
          <div class="month-chart__year-label">${group.year}</div>
          <div class="month-chart__year-bars">${bars}</div>
        </div>
      `;
    })
    .join("");

  bindMonthChartTooltips();
}


const chartTooltip = document.getElementById("chart-tooltip");

function showChartTooltip(e, { facility, count, month, color }) {
  chartTooltip.innerHTML = `
    <span class="chart-tooltip__dot" style="background: ${color}"></span>
    <div>
      <div class="chart-tooltip__facility">${escapeHtml(facility)}</div>
      <div class="chart-tooltip__meta">${escapeHtml(month)} · ${count} Check-in${count !== 1 ? "s" : ""}</div>
    </div>
  `;
  chartTooltip.hidden = false;
  positionChartTooltip(e.clientX, e.clientY);
}

function positionChartTooltip(x, y) {
  chartTooltip.style.left = "0";
  chartTooltip.style.top = "0";
  const rect = chartTooltip.getBoundingClientRect();
  const pad = 14;
  let left = x + pad;
  let top = y - rect.height - pad;

  if (left + rect.width > window.innerWidth - 8) {
    left = x - rect.width - pad;
  }
  if (top < 8) {
    top = y + pad;
  }
  if (left < 8) {
    left = 8;
  }

  chartTooltip.style.left = `${left}px`;
  chartTooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  chartTooltip.hidden = true;
}

function bindMonthChartTooltips() {
  document.querySelectorAll(".month-bar__segment").forEach((seg) => {
    seg.addEventListener("mouseenter", (e) => {
      showChartTooltip(e, {
        facility: seg.dataset.facility,
        count: Number(seg.dataset.count),
        month: seg.dataset.month,
        color: seg.dataset.color,
      });
    });
    seg.addEventListener("mousemove", (e) => {
      positionChartTooltip(e.clientX, e.clientY);
    });
    seg.addEventListener("mouseleave", hideChartTooltip);
  });
}

uploadZone.addEventListener("click", openFilePicker);

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openFilePicker();
  }
});

if (reuploadTop) {
  reuploadTop.addEventListener("click", openFilePicker);
}

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!/\.csv$/i.test(file.name)) {
    alert("Bitte eine CSV-Datei auswählen.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      processCSV(e.target.result);
    } catch (err) {
      alert(err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}

["monthly-fee", "membership-start", "membership-end"].forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("change", () => {
    if (id === "monthly-fee") {
      el.value = normalizeEuroAmount(el.value);
    }
    if (checkins.length) render();
  });
});

(function initGitHubLink() {
  const link = document.getElementById("github-link");
  if (!link) return;

  const repoMeta = document.querySelector('meta[name="github-repo"]');
  const configuredRepoUrl = repoMeta?.content?.trim();
  if (configuredRepoUrl) {
    link.href = configuredRepoUrl;
    return;
  }

  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && window.location.hostname.endsWith("github.io")) {
    link.href = `https://github.com/${parts[0]}/${parts[1]}`;
    return;
  }

  link.href = DEFAULT_REPO_URL;
})();
