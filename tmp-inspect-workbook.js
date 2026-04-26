const XLSX = require("xlsx");

const workbookPath = "C:/Jag/Trainings/Projects/CalendarProject_v2/docs/Q2-2026- Be. Cognizant View- ONLY GEO LEADS.xlsx";
const query = /Communicating Across Cultures/i;

const workbook = XLSX.readFile(workbookPath);
for (const name of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
    header: 1,
    defval: "",
    raw: false,
  });

  rows.forEach((row, index) => {
    const joined = row.map((value) => String(value ?? "")).join(" | ");
    if (query.test(joined)) {
      console.log(`${name}\trow ${index + 1}\t${joined}`);
    }
  });
}
