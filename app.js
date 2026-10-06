const STORAGE_KEY = "event-booking-dashboard-bookings";

const demoBookings = [
  {
    dateBooked: "2026-09-18",
    dateEvent: "2026-10-07",
    venue: "CHANDLER",
    clientName: "JT INT'L PHILS. INC.",
    eventType: "CORPORATE",
    pax: 180,
    dp: "C/O VENUE",
    ae: "CALVIN",
    pr: "C/O VENUE",
    packageValue: 0,
    lessValue: 0,
    netValue: 0
  },
  {
    dateBooked: "2026-09-21",
    dateEvent: "2026-12-16",
    venue: "EL CIRCULO",
    clientName: "ST. JOSEPH GROUP INC",
    eventType: "YEAR END",
    pax: 100,
    dp: "C/O VENUE",
    ae: "CALVIN",
    pr: "C/O VENUE",
    packageValue: 0,
    lessValue: 0,
    netValue: 0
  },
  {
    dateBooked: "2026-10-01",
    dateEvent: "2026-12-19",
    venue: "ERA'S EVENTS PLACE",
    clientName: "CAMPOSANO",
    eventType: "XMAS PARTY",
    pax: 150,
    dp: "BPI-5K",
    ae: "MILES",
    pr: "17299",
    packageValue: 1221200,
    lessValue: 12870,
    netValue: 1092500
  },
  {
    dateBooked: "2026-10-02",
    dateEvent: "2026-12-05",
    venue: "HIGHLANDS POINTE",
    clientName: "CRUZ",
    eventType: "XMAS PARTY",
    pax: 150,
    dp: "CASH-4,910.71",
    ae: "CALVIN",
    pr: "OR#0862",
    packageValue: 1023288,
    lessValue: 15428,
    netValue: 869000
  },
  {
    dateBooked: "2026-10-03",
    dateEvent: "2026-07-22",
    venue: "GLASS GARDEN PASIG",
    clientName: "JARDER",
    eventType: "WEDDING",
    pax: 100,
    dp: "BPI-5K",
    ae: "REN",
    pr: "17125",
    packageValue: 1117200,
    lessValue: 5000,
    netValue: 1122000
  }
];

const state = {
  bookings: [],
  filters: {
    search: "",
    month: "all",
    status: "all"
  }
};

const els = {
  sheetApiUrlInput: document.getElementById("sheetApiUrlInput"),
  monthFilter: document.getElementById("monthFilter"),
  statusFilter: document.getElementById("statusFilter"),
  searchInput: document.getElementById("searchInput"),
  bookingsTableBody: document.getElementById("bookingsTableBody"),
  totalBookings: document.getElementById("totalBookings"),
  packageTotal: document.getElementById("packageTotal"),
  lessTotal: document.getElementById("lessTotal"),
  netTotal: document.getElementById("netTotal"),
  bookingForm: document.getElementById("bookingForm"),
  connectBtn: document.getElementById("connectBtn"),
  loadDataBtn: document.getElementById("loadDataBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn")
};

function formatCurrency(value) {
  const numeric = Number(value) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(numeric);
}

function parseCurrency(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;

  const clean = String(value)
    .replace(/[₱,]/g, "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "-")
    .replace(/[^0-9.\-]/g, "");

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBooking(row = {}) {
  return {
    dateBooked: row.dateBooked || row["Date Booked"] || row["DATE BOOKED"] || "",
    dateEvent: row.dateEvent || row["Date of Event"] || row["DATE OF EVENT"] || "",
    venue: row.venue || row["Venue"] || row["VENUE"] || "",
    clientName: row.clientName || row["Client Name"] || row["CLIENT'S NAME"] || row["CLIENT NAME"] || "",
    eventType: row.eventType || row["Event"] || row["EVENT"] || "",
    pax: Number(row.pax ?? row["# of Pax"] ?? row["# OF PAX"] ?? 0) || 0,
    dp: row.dp || row["DP"] || "",
    ae: row.ae || row["AE"] || "",
    pr: row.pr || row["PR"] || "",
    packageValue: parseCurrency(row.packageValue ?? row["Package"] ?? row["PACKAGE"] ?? 0),
    lessValue: parseCurrency(row.lessValue ?? row["Less"] ?? row["LESS"] ?? 0),
    netValue: parseCurrency(row.netValue ?? row["Net"] ?? row["NET"] ?? 0)
  };
}

function saveLocalBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function getLocalBookings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((row) => normalizeBooking(row)) : [];
  } catch {
    return [];
  }
}

function loadDemoBookings() {
  state.bookings = demoBookings.map((booking) => normalizeBooking(booking));
  saveLocalBookings(state.bookings);
  render();
}

function parseGvizData(rawText) {
  try {
    const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\)\s*;?\s*$/s);
    if (!match) return [];

    const parsed = JSON.parse(match[1]);
    const cols = parsed?.table?.cols || [];
    const rows = parsed?.table?.rows || [];

    return rows.map((row) => {
      const values = row?.c || [];
      const obj = {};
      cols.forEach((col, index) => {
        const field = col?.label || col?.id || `col${index}`;
        const cell = values[index] || {};
        obj[field] = cell?.v ?? cell?.f ?? "";
      });
      return obj;
    });
  } catch (error) {
    console.error("Could not parse Google Sheet response:", error);
    return [];
  }
}

function mapSheetRows(rawRows) {
  return rawRows.map((row) => normalizeBooking(row));
}

async function loadDataFromSheet(url) {
  if (!url) {
    const local = getLocalBookings();
    state.bookings = local.length ? local : demoBookings.map((booking) => normalizeBooking(booking));
    saveLocalBookings(state.bookings);
    render();
    return;
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch sheet");

    const rawText = await response.text();
    const contentType = response.headers.get("content-type") || "";
    let rows = [];

    if (contentType.includes("application/json") || rawText.trim().startsWith("{")) {
      const payload = JSON.parse(rawText);
      rows = Array.isArray(payload) ? payload : payload.rows || payload.data || [];
    } else if (rawText.includes("google.visualization.Query.setResponse")) {
      rows = parseGvizData(rawText);
    } else {
      const lines = rawText.split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        const headers = lines[0].split(",");
        rows = lines.slice(1).map((line) => {
          const cells = line.split(",");
          const row = {};
          headers.forEach((header, index) => {
            row[header.trim()] = cells[index] ? cells[index].trim() : "";
          });
          return row;
        });
      }
    }

    const mapped = mapSheetRows(rows);
    state.bookings = mapped.length ? mapped : getLocalBookings();
    saveLocalBookings(state.bookings);
    render();
  } catch (error) {
    console.error(error);
    state.bookings = getLocalBookings();
    if (!state.bookings.length) {
      loadDemoBookings();
    } else {
      render();
    }
  }
}

function renderMonths() {
  const monthSet = new Set();
  state.bookings.forEach((booking) => {
    if (booking.dateEvent) {
      const date = new Date(booking.dateEvent);
      if (!Number.isNaN(date.getTime())) {
        monthSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      }
    }
  });

  const options = ['<option value="all">All Months</option>'];
  Array.from(monthSet)
    .sort()
    .forEach((monthKey) => {
      const [year, month] = monthKey.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric"
      });
      options.push(`<option value="${monthKey}">${label}</option>`);
    });

  els.monthFilter.innerHTML = options.join("");
  els.monthFilter.value = state.filters.month || "all";
}

function filterBookings() {
  const searchTerm = state.filters.search.trim().toLowerCase();

  return state.bookings.filter((booking) => {
    const matchesSearch =
      !searchTerm ||
      [
        booking.venue,
        booking.clientName,
        booking.eventType,
        booking.ae,
        booking.pr,
        booking.dp
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);

    const bookingMonth = booking.dateEvent ? new Date(booking.dateEvent).toISOString().slice(0, 7) : null;
    const matchesMonth = state.filters.month === "all" || bookingMonth === state.filters.month;

    const matchesStatus =
      state.filters.status === "all" ||
      (state.filters.status === "withNet" && Number(booking.netValue) > 0) ||
      (state.filters.status === "noNet" && Number(booking.netValue) === 0);

    return matchesSearch && matchesMonth && matchesStatus;
  });
}

function renderSummary(filteredBookings) {
  const totalBookings = filteredBookings.length;
  const packageTotal = filteredBookings.reduce((sum, booking) => sum + Number(booking.packageValue || 0), 0);
  const lessTotal = filteredBookings.reduce((sum, booking) => sum + Number(booking.lessValue || 0), 0);
  const netTotal = filteredBookings.reduce((sum, booking) => sum + Number(booking.netValue || 0), 0);

  els.totalBookings.textContent = String(totalBookings);
  els.packageTotal.textContent = formatCurrency(packageTotal);
  els.lessTotal.textContent = formatCurrency(lessTotal);
  els.netTotal.textContent = formatCurrency(netTotal);
}

function renderTable(filteredBookings) {
  if (!filteredBookings.length) {
    els.bookingsTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-state">No bookings found for the selected filters.</td>
      </tr>
    `;
    return;
  }

  els.bookingsTableBody.innerHTML = filteredBookings
    .map((booking) => {
      const dateBooked = booking.dateBooked ? new Date(booking.dateBooked).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      const dateEvent = booking.dateEvent ? new Date(booking.dateEvent).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "";

      return `
        <tr>
          <td>${dateBooked}</td>
          <td>${dateEvent}</td>
          <td>${booking.venue || ""}</td>
          <td>${booking.clientName || ""}</td>
          <td>${booking.eventType || ""}</td>
          <td>${booking.pax || 0}</td>
          <td>${booking.dp || ""}</td>
          <td>${booking.ae || ""}</td>
          <td>${booking.pr || ""}</td>
          <td class="amount neutral">${formatCurrency(booking.packageValue || 0)}</td>
          <td class="amount neutral">${formatCurrency(booking.lessValue || 0)}</td>
          <td class="amount ${Number(booking.netValue || 0) > 0 ? "positive" : "neutral"}">${formatCurrency(booking.netValue || 0)}</td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  renderMonths();
  const filtered = filterBookings();
  renderSummary(filtered);
  renderTable(filtered);
}

function getBookingPayload(formData) {
  return {
    dateBooked: formData.get("dateBooked"),
    dateEvent: formData.get("dateEvent"),
    venue: formData.get("venue"),
    clientName: formData.get("clientName"),
    eventType: formData.get("eventType"),
    pax: Number(formData.get("pax") || 0),
    dp: formData.get("dp"),
    ae: formData.get("ae"),
    pr: formData.get("pr"),
    packageValue: Number(formData.get("packageValue") || 0),
    lessValue: Number(formData.get("lessValue") || 0),
    netValue: Number(formData.get("netValue") || 0)
  };
}

async function addBooking(record) {
  const normalized = normalizeBooking(record);
  state.bookings = [normalized, ...state.bookings];
  saveLocalBookings(state.bookings);
  render();

  const apiUrl = els.sheetApiUrlInput.value.trim();
  if (apiUrl) {
    try {
      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addBooking", booking: normalized })
      });
    } catch {
      console.warn("Could not sync booking to connected sheet.");
    }
  }
}

function exportCsv() {
  const filtered = filterBookings();
  if (!filtered.length) return;

  const headers = [
    "Date Booked",
    "Date of Event",
    "Venue",
    "Client Name",
    "Event",
    "# of Pax",
    "DP",
    "AE",
    "PR",
    "Package",
    "Less",
    "Net"
  ];

  const rows = [headers];
  filtered.forEach((booking) => {
    rows.push([
      booking.dateBooked,
      booking.dateEvent,
      booking.venue,
      booking.clientName,
      booking.eventType,
      booking.pax,
      booking.dp,
      booking.ae,
      booking.pr,
      booking.packageValue,
      booking.lessValue,
      booking.netValue
    ]);
  });

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "event-bookings-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

els.searchInput.addEventListener("input", (event) => {
  state.filters.search = event.target.value;
  render();
});

els.monthFilter.addEventListener("change", (event) => {
  state.filters.month = event.target.value;
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  state.filters.status = event.target.value;
  render();
});

els.bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const record = getBookingPayload(formData);
  await addBooking(record);
  event.target.reset();
});

els.connectBtn.addEventListener("click", async () => {
  const apiUrl = els.sheetApiUrlInput.value.trim();
  if (apiUrl) {
    await loadDataFromSheet(apiUrl);
  } else {
    loadDemoBookings();
  }
});

els.loadDataBtn.addEventListener("click", async () => {
  const apiUrl = els.sheetApiUrlInput.value.trim();
  await loadDataFromSheet(apiUrl);
});

els.exportCsvBtn.addEventListener("click", exportCsv);

window.addEventListener("DOMContentLoaded", () => {
  const saved = getLocalBookings();
  state.bookings = saved.length ? saved : demoBookings.map((booking) => normalizeBooking(booking));
  saveLocalBookings(state.bookings);
  render();
});
