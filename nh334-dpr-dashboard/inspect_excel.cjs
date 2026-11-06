const xlsx = require('xlsx');

console.log('=== WORK PROGRAM: MCW -Milling & DBM (BHS) ===');
const wb1 = xlsx.readFile('./public/data/Work Program.xlsx');
const ws1 = wb1.Sheets['MCW -Milling & DBM (BHS)'];
const rows1 = xlsx.utils.sheet_to_json(ws1, { header: 1 });
for (let i = 0; i < Math.min(15, rows1.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows1[i]));
}

console.log('\n=== DPR: Chainage Progress ===');
const wb2 = xlsx.readFile('./public/data/Major_Maintenance_Daily_Progress_Report.23.10.2026.xlsx');
console.log('DPR Sheet Names:', wb2.SheetNames);
const ws2 = wb2.Sheets['Chainage Progress'];
const rows2 = xlsx.utils.sheet_to_json(ws2, { header: 1 });
for (let i = 0; i < Math.min(25, rows2.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rows2[i]));
}

console.log('\n=== DPR: Daily DPR sample ===');
const wsDaily = wb2.Sheets['Daily DPR'];
if (wsDaily) {
  const r = xlsx.utils.sheet_to_json(wsDaily, { header: 1 });
  for (let i = 0; i < Math.min(15, r.length); i++) {
    console.log(`Daily DPR Row ${i}:`, JSON.stringify(r[i]));
  }
}

console.log('\n=== DPR: QC Test Log sample ===');
const wsQC = wb2.Sheets['QC Test Log'];
if (wsQC) {
  const r = xlsx.utils.sheet_to_json(wsQC, { header: 1 });
  for (let i = 0; i < Math.min(10, r.length); i++) {
    console.log(`QC Row ${i}:`, JSON.stringify(r[i]));
  }
}

console.log('\n=== DPR: Resources & Materials sample ===');
const wsRes = wb2.Sheets['Resources & Materials'];
if (wsRes) {
  const r = xlsx.utils.sheet_to_json(wsRes, { header: 1 });
  for (let i = 0; i < Math.min(10, r.length); i++) {
    console.log(`Resources Row ${i}:`, JSON.stringify(r[i]));
  }
}
