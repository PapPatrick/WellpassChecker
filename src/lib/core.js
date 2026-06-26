export const GERMAN_MONTHS = {
  januar: 0,
  februar: 1,
  "m\u00e4rz": 2,
  maerz: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  dezember: 11,
};

export const DEFAULT_VISIT_PRICE = 12;

export const VISIT_PRICE_RULES = [
  { patterns: /spa|wellness|therm|sauna|resort/i, price: 22 },
  { patterns: /strand|freibad|outdoor|beach|open.?air/i, price: 6 },
  { patterns: /bad|pool|schwimm|aqua|swim|hallen/i, price: 9 },
  { patterns: /kletter|boulder|climb|bloc|wall/i, price: 14 },
  { patterns: /yoga|pilates|dance|box|martial|functional|crossfit/i, price: 15 },
  { patterns: /fitness|gym|sport|training|studio|center|centre/i, price: 12 },
];

const assignedFacilityColors = new Map();
const assignedRgb = [];
const GOLDEN_ANGLE = 137.508;

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const m = light - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

function rgbDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function createDistinctColor(index) {
  let hue = (index * GOLDEN_ANGLE) % 360;
  const saturationOptions = [80, 72, 88, 76];
  const lightnessOptions = [46, 52, 40, 58];
  const minDistance = 92;

  for (let attempt = 0; attempt < 36; attempt++) {
    const sat = saturationOptions[(index + attempt) % saturationOptions.length];
    const light = lightnessOptions[(Math.floor(index / saturationOptions.length) + attempt) % lightnessOptions.length];
    const rgb = hslToRgb(hue, sat, light);

    const hasCloseNeighbor = assignedRgb.some((existing) => rgbDistance(existing, rgb) < minDistance);
    if (!hasCloseNeighbor) {
      assignedRgb.push(rgb);
      return `hsl(${Math.round(hue)}, ${sat}%, ${light}%)`;
    }

    hue = (hue + 29) % 360;
  }

  const fallbackSat = saturationOptions[index % saturationOptions.length];
  const fallbackLight = lightnessOptions[index % lightnessOptions.length];
  const fallbackRgb = hslToRgb(hue, fallbackSat, fallbackLight);
  assignedRgb.push(fallbackRgb);
  return `hsl(${Math.round(hue)}, ${fallbackSat}%, ${fallbackLight}%)`;
}

export function parseCSV(text) {
  const normalizedText = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i++) {
    const ch = normalizedText[i];
    const next = normalizedText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = "";
      if (ch === "\r") i++;
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

export function parseGermanDate(dateStr) {
  const cleaned = String(dateStr || "").replace(/"/g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 3) return null;

  const dayToken = parts[0].replace(/\.$/, "");
  const day = parseInt(dayToken, 10);
  const monthName = parts[1].toLowerCase();
  const year = parseInt(parts[2], 10);
  const month = GERMAN_MONTHS[monthName];

  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return new Date(year, month, day);
}

export function guessVisitPrice(facilityName) {
  for (const rule of VISIT_PRICE_RULES) {
    if (rule.patterns.test(facilityName)) return rule.price;
  }
  return DEFAULT_VISIT_PRICE;
}

export function colorFromName(name) {
  const key = String(name || "");
  const cached = assignedFacilityColors.get(key);
  if (cached) return cached;

  const color = createDistinctColor(assignedFacilityColors.size);
  assignedFacilityColors.set(key, color);
  return color;
}

export function shortFacilityName(name) {
  return name.length > 28 ? `${name.slice(0, 26)}...` : name;
}

export function formatEuro(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function parseDateKey(key) {
  const [y, m, d] = String(key || "").split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, d || 1);
}

export function formatMonthLabel(key, showYear = true) {
  const [y, m] = key.split("-");
  const months = ["Jan", "Feb", "M\u00e4r", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const month = months[parseInt(m, 10) - 1];
  return showYear ? `${month} '${y.slice(2)}` : month;
}

export function isWithinDateRange(date, startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start || !end) return true;

  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return day >= startDay && day <= endDay;
}

export function iterMonthKeys(fromDate, toDate) {
  const keys = [];
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth();
  const endYear = toDate.getFullYear();
  const endMonth = toDate.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return keys;
}

export function groupMonthKeysByYear(monthKeys) {
  const groups = [];
  for (const key of monthKeys) {
    const year = key.split("-")[0];
    const last = groups[groups.length - 1];
    if (!last || last.year !== year) {
      groups.push({ year, keys: [key] });
    } else {
      last.keys.push(key);
    }
  }
  return groups;
}

export function monthsBetween(startKey, endKey) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (!start || !end || end < start) return 1;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

export function normalizeEuroAmount(value) {
  const amount = parseFloat(value);
  if (isNaN(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function analyzeCheckins({ checkins, facilityPrices, monthlyFee, startKey, endKey }) {
  let rangeStart = parseDateKey(startKey);
  let rangeEnd = parseDateKey(endKey);

  if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
    [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    [startKey, endKey] = [endKey, startKey];
  }

  const activeCheckins = checkins.filter((c) => isWithinDateRange(c.date, startKey, endKey));

  const byFacility = {};
  const byMonth = {};
  const byMonthByFacility = {};

  for (const { date, facility } of activeCheckins) {
    byFacility[facility] = (byFacility[facility] || 0) + 1;
    const mk = formatMonthKey(date);
    byMonth[mk] = (byMonth[mk] || 0) + 1;
    if (!byMonthByFacility[mk]) byMonthByFacility[mk] = {};
    byMonthByFacility[mk][facility] = (byMonthByFacility[mk][facility] || 0) + 1;
  }

  let estimatedVisitValue = 0;
  const facilityDetails = Object.entries(byFacility)
    .map(([name, count]) => {
      const pricePerVisit = facilityPrices[name] ?? guessVisitPrice(name);
      const total = count * pricePerVisit;
      estimatedVisitValue += total;
      return { name, count, pricePerVisit, total };
    })
    .sort((a, b) => b.count - a.count);

  const membershipMonths = startKey && endKey ? monthsBetween(startKey, endKey) : 1;
  const membershipCost = membershipMonths * monthlyFee;
  const totalCheckins = activeCheckins.length;
  const averageVisitValue = estimatedVisitValue / totalCheckins || 1;
  const netSavings = estimatedVisitValue - membershipCost;
  const avgVisitsPerMonth = totalCheckins / membershipMonths;
  const breakevenVisits = membershipCost / averageVisitValue;

  const monthKeys =
    rangeStart && rangeEnd
      ? iterMonthKeys(rangeStart, rangeEnd)
      : activeCheckins.length
      ? iterMonthKeys(activeCheckins[0].date, activeCheckins[activeCheckins.length - 1].date)
      : [];

  const yearCount = new Set(monthKeys.map((key) => key.split("-")[0])).size;
  const spansMultipleYears = yearCount > 1;
  const firstDate = activeCheckins[0]?.date ?? rangeStart;
  const lastDate = activeCheckins[activeCheckins.length - 1]?.date ?? rangeEnd;

  return {
    monthlyFee,
    membershipMonths,
    membershipCost,
    estimatedVisitValue,
    netSavings,
    avgVisitsPerMonth,
    breakevenVisits,
    facilityDetails,
    byMonth,
    byMonthByFacility,
    monthKeys,
    yearCount,
    spansMultipleYears,
    totalCheckins,
    facilityCount: facilityDetails.length,
    firstDate,
    lastDate,
    hasCheckins: totalCheckins > 0,
  };
}
