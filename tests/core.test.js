import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeCheckins,
  escapeHtml,
  guessVisitPrice,
  monthsBetween,
  parseCSV,
  parseGermanDate,
} from "../src/lib/core.js";

test("parseCSV handles quoted commas and escaped quotes", () => {
  const csv = 'Datum,Einrichtung\n"1 Januar 2025","Fitness, ""Center"""\n';
  const rows = parseCSV(csv);

  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'Fitness, "Center"');
});

test("parseCSV ignores UTF-8 BOM in headers", () => {
  const csv = '\uFEFFDatum,Einrichtung\n"1 Januar 2025","Gym"\n';
  const rows = parseCSV(csv);

  assert.equal(rows[0][0], "Datum");
  assert.equal(rows[1][1], "Gym");
});

test("parseGermanDate parses umlaut, fallback spellings, and dotted day tokens", () => {
  const dateA = parseGermanDate("5 März 2025");
  const dateB = parseGermanDate("6 Maerz 2025");
  const dateC = parseGermanDate("7. Januar 2025");

  assert.ok(dateA instanceof Date);
  assert.ok(dateB instanceof Date);
  assert.ok(dateC instanceof Date);
  assert.equal(dateA.getMonth(), 2);
  assert.equal(dateB.getMonth(), 2);
  assert.equal(dateC.getDate(), 7);
});

test("parseGermanDate parses English month names and alternate order", () => {
  const dateA = parseGermanDate("21 June 2026");
  const dateB = parseGermanDate("June 25 2026");

  assert.ok(dateA instanceof Date);
  assert.ok(dateB instanceof Date);
  assert.equal(dateA.getFullYear(), 2026);
  assert.equal(dateA.getMonth(), 5);
  assert.equal(dateA.getDate(), 21);
  assert.equal(dateB.getMonth(), 5);
  assert.equal(dateB.getDate(), 25);
});

test("guessVisitPrice matches category rules", () => {
  assert.equal(guessVisitPrice("Alpen Therme Wellness Resort"), 24);
  assert.equal(guessVisitPrice("Super Sauna Resort"), 18);
  assert.equal(guessVisitPrice("Climb Boulder Hall"), 13);
  assert.equal(guessVisitPrice("Unbekannte Location"), 11);
});

test("monthsBetween includes both start and end month", () => {
  assert.equal(monthsBetween("2025-01-01", "2025-01-31"), 1);
  assert.equal(monthsBetween("2025-01-01", "2025-03-01"), 3);
  assert.equal(monthsBetween("2025-12-01", "2026-02-01"), 3);
});

test("analyzeCheckins computes totals for selected membership period", () => {
  const checkins = [
    { date: new Date(2025, 0, 3), facility: "Fitness Club" },
    { date: new Date(2025, 0, 16), facility: "Sauna World" },
    { date: new Date(2025, 1, 3), facility: "Fitness Club" },
  ];

  const result = analyzeCheckins({
    checkins,
    facilityPrices: {
      "Fitness Club": 10,
      "Sauna World": 20,
    },
    monthlyFee: 30,
    startKey: "2025-01-01",
    endKey: "2025-02-28",
  });

  assert.equal(result.totalCheckins, 3);
  assert.equal(result.membershipMonths, 2);
  assert.equal(result.membershipCost, 60);
  assert.equal(result.estimatedVisitValue, 40);
  assert.equal(result.netSavings, -20);
  assert.deepEqual(result.monthKeys, ["2025-01", "2025-02"]);
});

test("analyzeCheckins handles inverted date range defensively", () => {
  const checkins = [
    { date: new Date(2025, 0, 3), facility: "Fitness Club" },
    { date: new Date(2025, 1, 3), facility: "Fitness Club" },
  ];

  const result = analyzeCheckins({
    checkins,
    facilityPrices: {
      "Fitness Club": 10,
    },
    monthlyFee: 30,
    startKey: "2025-02-28",
    endKey: "2025-01-01",
  });

  assert.equal(result.totalCheckins, 2);
  assert.equal(result.membershipMonths, 2);
});

test("escapeHtml safely escapes dangerous characters", () => {
  assert.equal(escapeHtml('<span data-ref="#">Tom & Jerry</span>'), "&lt;span data-ref=&quot;#&quot;&gt;Tom &amp; Jerry&lt;/span&gt;");
});

test("English export rows can be parsed into valid date/facility pairs", () => {
  const csv =
    'Date,Time,"Facility name",Address\n"21 June 2026",11:15:13,"Greifbar Friedrichshafen","Anton-Sommer-Stra\u00dfe 8"\n';
  const rows = parseCSV(csv);
  const header = rows[0].map((h) => h.toLowerCase().replace(/"/g, ""));
  const dateIdx = header.findIndex((h) => h.includes("date"));
  const facilityIdx = header.findIndex((h) => h.includes("facility") || h.includes("name"));

  const date = parseGermanDate(rows[1][dateIdx]);
  const facility = rows[1][facilityIdx];

  assert.ok(date instanceof Date);
  assert.equal(facility, "Greifbar Friedrichshafen");
});
