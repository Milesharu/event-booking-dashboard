function getSheet() {
  const spreadsheet = SpreadsheetApp.openById("PASTE_YOUR_SHEET_ID_HERE");
  return spreadsheet.getSheetByName("Bookings") || spreadsheet.getSheets()[0];
}

function responseJson(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    return responseJson({ rows: [] });
  }

  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || "";
    });
    return obj;
  });

  return responseJson({ rows });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action;

    if (action !== "addBooking") {
      return responseJson({ ok: false, error: "Unsupported action" });
    }

    const booking = payload.booking || {};
    const sheet = getSheet();
    const row = [
      booking.dateBooked || "",
      booking.dateEvent || "",
      booking.venue || "",
      booking.clientName || "",
      booking.eventType || "",
      booking.pax || 0,
      booking.dp || "",
      booking.ae || "",
      booking.pr || "",
      booking.packageValue || 0,
      booking.lessValue || 0,
      booking.netValue || 0
    ];

    sheet.appendRow(row);
    return responseJson({ ok: true, message: "Booking saved" });
  } catch (error) {
    return responseJson({ ok: false, error: error.message || "Unknown error" });
  }
}
