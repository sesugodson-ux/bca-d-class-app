// File: src/utils/pdfExports.js
import { HOURS } from './constants';
import { escapeHtml, formatNiceDate, numericRollCompare, groupHistoryByDate } from './helpers';

/* =========================================================
   PDF / print exports

   Every build*Html function is pure: it receives plain data (plus a few
   lookup callbacks that still live in App.jsx) and returns a complete HTML
   document string. App.jsx keeps the validation, toasts and state, then
   hands the string to openPrintWindow().
   ========================================================= */

/* Opens a popup, writes the HTML into it and triggers the browser print
   dialog so the admin can "Save as PDF". Returns false if popups are blocked. */
export function openPrintWindow(printHtml, showToast){
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if(!printWindow){
    showToast('Please allow popups to export PDF', true);
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.onload = function(){
    printWindow.focus();
    printWindow.print();
  };
  return true;
}

/* ---------- shared print chrome (identical across all reports) ---------- */
const PRINT_FOOTER_HTML = '<div class="footer">BCA Class Portal Record · Student-managed internal utility report. May contain minor discrepancies compared to official college portals.</div>';

function printHeaderHtml(reportTitle){
  return '<div class="header">'
    + '<div class="college-name">Bishop Heber College</div>'
    + '<div class="dept-name">Department of Computer Applications (BCA)</div>'
    + '<div class="report-title">'+reportTitle+'</div>'
    + '</div>';
}

/* ---------- print stylesheets ---------- */
const MODERN_GLOBAL_PRINT_STYLE = '*{box-sizing:border-box;}'
  + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c3e50;margin:24px;background:#fff;}'
  + '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;}'
  + '.college-name{font-size:20px;font-weight:800;color:#1e3a8a;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;}'
  + '.dept-name{font-size:13px;font-weight:600;color:#0f766e;margin:0 0 4px;}'
  + '.report-title{font-size:14px;font-weight:700;color:#475569;margin:0;}'
  + '.meta{font-size:11px;color:#64748b;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}'
  + '.legend{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:10.5px;color:#475569;margin:10px 0 14px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;}'
  + '.legend .label{font-weight:700;color:#334155;margin-right:4px;}'
  + 'table{width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;}'
  + 'th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;}'
  + 'th:last-child,td:last-child{border-right:none;}'
  + 'tbody tr:last-child td{border-bottom:none;}'
  + 'th{background:#f8fafc;color:#334155;font-weight:700;}'
  + 'td.num{text-align:center;}'
  + '.pill{display:inline-block;padding:2px 8px;border-radius:12px;font-weight:700;font-size:10.5px;}'
  + '.pill-present{background:#dcfce7;color:#15803d;}'
  + '.pill-absent{background:#fee2e2;color:#b91c1c;}'
  + '.pill-partial{background:#fef9c3;color:#a16207;}'
  + 'tbody tr:nth-child(even){background:#fafafa;}'
  + '.footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:4px;}'
  + '@media print{body{margin:10mm;}}';

const MODERN_PRINT_STYLE = '*{box-sizing:border-box;}'
  + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c3e50;margin:24px;background:#fff;}'
  + '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;}'
  + '.college-name{font-size:20px;font-weight:800;color:#1e3a8a;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;}'
  + '.dept-name{font-size:13px;font-weight:600;color:#0f766e;margin:0 0 4px;}'
  + '.report-title{font-size:14px;font-weight:700;color:#475569;margin:0;}'
  + '.meta{font-size:11px;color:#64748b;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}'
  + 'h2{font-size:13px;color:#1e3a8a;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.3px;}'
  + 'table{width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;}'
  + 'th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;}'
  + 'th:last-child,td:last-child{border-right:none;}'
  + 'tbody tr:last-child td{border-bottom:none;}'
  + 'th{background:#f8fafc;color:#334155;font-weight:700;}'
  + 'td.num{text-align:center;}'
  + '.student-info td.label{background:#f1f5f9;font-weight:600;width:35%;color:#334155;}'
  + 'tbody tr:nth-child(even){background:#fafafa;}'
  + '.footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:4px;}'
  + '@media print{body{margin:10mm;}}';

const HOUR_PRINT_STYLE = '*{box-sizing:border-box;}'
  + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c3e50;margin:24px;background:#fff;}'
  + '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;}'
  + '.college-name{font-size:20px;font-weight:800;color:#1e3a8a;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;}'
  + '.dept-name{font-size:13px;font-weight:600;color:#0f766e;margin:0 0 4px;}'
  + '.report-title{font-size:14px;font-weight:700;color:#475569;margin:0;}'
  + '.meta{font-size:11px;color:#64748b;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}'
  + 'table{width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;}'
  + 'th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;}'
  + 'th:last-child,td:last-child{border-right:none;}'
  + 'tbody tr:last-child td{border-bottom:none;}'
  + 'th{background:#f8fafc;color:#334155;font-weight:700;}'
  + 'td.num{text-align:center;}'
  + '.pill{display:inline-block;padding:2px 8px;border-radius:12px;font-weight:700;font-size:10.5px;}'
  + '.pill-present{background:#dcfce7;color:#15803d;}'
  + '.pill-absent{background:#fee2e2;color:#b91c1c;}'
  + '.pill-partial{background:#fef9c3;color:#a16207;}'
  + 'tbody tr:nth-child(even){background:#fafafa;}'
  + '.footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:4px;}'
  + '@media print{body{margin:10mm;}}';

/* Shared by the Master Register and the Absentees report. */
const UNIFIED_PRINT_STYLE = '*{box-sizing:border-box;}'
  + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2c3e50;margin:24px;background:#fff;}'
  + '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #e2e8f0;padding-bottom:12px;}'
  + '.college-name{font-size:20px;font-weight:800;color:#1e3a8a;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;}'
  + '.dept-name{font-size:13px;font-weight:600;color:#0f766e;margin:0 0 4px;}'
  + '.report-title{font-size:14px;font-weight:700;color:#475569;margin:0;}'
  + '.meta{font-size:11px;color:#64748b;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}'
  + 'table{width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;}'
  + 'th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;}'
  + 'th:last-child,td:last-child{border-right:none;}'
  + 'tbody tr:last-child td{border-bottom:none;}'
  + 'th{background:#f8fafc;color:#334155;font-weight:700;text-align:center;}'
  + 'th:nth-child(2),th:nth-child(3){text-align:left;}'
  + 'td.num{text-align:center;width:30px;}'
  + 'tbody tr:nth-child(even){background:#fafafa;}'
  + '.footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:4px;}'
  + '@media print{body{margin:10mm;}}';

/* =========================================================
   1. Global attendance-history report (all saved dates)
   ========================================================= */
export function buildHistoryPdfHtml({ history, className, getDateAbsenteeBreakdown }){
  const grouped = groupHistoryByDate(history);

  function absentCount(dateRows){
    const rolls = new Set();
    dateRows.forEach(function(row){ (row.absent_rolls||[]).forEach(function(r){ rolls.add(r); }); });
    return rolls.size;
  }
  function fullDayAbsentCount(dateRows){
    return getDateAbsenteeBreakdown(dateRows).filter(function(b){ return b.isFullDay; }).length;
  }
  function presentCount(dateEntry){
    const strength = dateEntry.total_active!=null ? dateEntry.total_active : 0;
    return Math.max(strength - absentCount(dateEntry.rows), 0);
  }
  function subjectOrHoursLabel(dateRows){
    const activeHours = dateRows.filter(function(r){ return (r.absent_rolls||[]).length > 0; }).map(function(r){ return r.hour; });
    return activeHours.length ? 'Hours: '+activeHours.join(', ') : 'All hours — no absentees';
  }

  const rowsHtml = grouped.map(function(dateEntry){
    const ac = absentCount(dateEntry.rows);
    const fullDay = fullDayAbsentCount(dateEntry.rows);
    const pc = presentCount(dateEntry);
    const pillCls = ac===0 ? 'pill-present' : (fullDay>0 ? 'pill-absent' : 'pill-partial');
    const pillLabel = ac===0 ? 'All Present' : (fullDay>0 ? fullDay+' Full-Day Absent' : 'Partial Absences');
    return (
      '<tr>'
      + '<td>'+escapeHtml(formatNiceDate(dateEntry.date))+'</td>'
      + '<td>'+escapeHtml(dateEntry.class_name||className)+'</td>'
      + '<td>'+escapeHtml(subjectOrHoursLabel(dateEntry.rows))+'</td>'
      + '<td class="num">'+escapeHtml(dateEntry.total_active!=null?dateEntry.total_active:'—')+'</td>'
      + '<td class="num"><span class="pill pill-absent">'+escapeHtml(ac)+'</span></td>'
      + '<td class="num"><span class="pill pill-present">'+escapeHtml(pc)+'</span></td>'
      + '<td class="num"><span class="pill '+pillCls+'">'+escapeHtml(pillLabel)+'</span></td>'
      + '</tr>'
    );
  }).join('');

  const generatedOn = new Date().toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' });

  return '<!DOCTYPE html><html><head><meta charset="utf-8" />'
    + '<title>Attendance History Report</title>'
    + '<style>'+MODERN_GLOBAL_PRINT_STYLE+'</style></head><body>'
    + printHeaderHtml('Attendance History Report')
    + '<div class="meta"><span>Class: <b>'+escapeHtml(className)+'</b></span><span>Generated: '+escapeHtml(generatedOn)+'</span></div>'
    + '<div class="legend">'
    + '<span class="label">Legend:</span>'
    + '<span class="pill pill-present">Green</span> All Present / Present count '
    + '<span class="pill pill-absent">Red</span> Full Day Absent / Absent count '
    + '<span class="pill pill-partial">Amber</span> Partial (specific-hour) absences'
    + '</div>'
    + '<table><thead><tr><th>Date</th><th>Class</th><th>Subject / Hours</th><th>Total Strength</th><th>Absent</th><th>Present</th><th>Status</th></tr></thead>'
    + '<tbody>'+rowsHtml+'</tbody></table>'
    + PRINT_FOOTER_HTML
    + '</body></html>';
}

/* =========================================================
   2. Individual student attendance report
      (App.jsx validates the roll number, finds the student and
       computes `breakdown` + `pct`, then passes them in.)
   ========================================================= */
export function buildStudentAttendancePdfHtml({ student, breakdown, pct, className }){
  function cellHtml(cell){
    if(cell.status==='dse') return '<td style="text-align:center;color:#c2410c;font-weight:800;">DSE</td>';
    if(cell.status==='blank') return '<td style="text-align:center;color:#94a3b8;font-weight:600;">—</td>';
    if(cell.status==='absent') return '<td style="text-align:center;color:#dc2626;font-weight:800;">A</td>';
    return '<td style="text-align:center;color:#16a34a;font-weight:800;">P</td>';
  }

  const rowsHtml = breakdown.length===0
    ? '<tr><td colspan="7" style="text-align:center;color:#666;padding:12px;">No attendance recorded yet.</td></tr>'
    : breakdown.map(function(entry){
        let tds = '<td>'+escapeHtml(formatNiceDate(entry.date))+'</td>'
                + '<td class="num">'+escapeHtml(entry.dayOrder)+'</td>';
        entry.hourCells.forEach(function(c){ tds += cellHtml(c); });
        return '<tr>'+tds+'</tr>';
      }).join('');

  const generatedOn = new Date().toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' });

  return '<!DOCTYPE html><html><head><meta charset="utf-8" />'
    + '<title>Individual Attendance Report — '+escapeHtml(student.rollNo)+'</title>'
    + '<style>'+MODERN_PRINT_STYLE+'</style></head><body>'
    + printHeaderHtml('Individual Student Attendance Report')
    + '<div class="meta"><span>Class: <b>'+escapeHtml(className)+'</b></span><span>Generated: '+escapeHtml(generatedOn)+'</span></div>'
    + '<table class="student-info"><tbody>'
    + '<tr><td class="label">Student Name</td><td><b>'+escapeHtml(student.name)+'</b></td></tr>'
    + '<tr><td class="label">Roll Number</td><td><b>'+escapeHtml(student.rollNo)+'</b></td></tr>'
    + '<tr><td class="label">Student Mobile</td><td>'+escapeHtml(student.studentMob||'—')+'</td></tr>'
    + '<tr><td class="label">Date of Birth</td><td>'+escapeHtml(student.dob||'—')+'</td></tr>'
    + '<tr><td class="label">Part One Language</td><td>'+escapeHtml(student.partOne||'—')+'</td></tr>'
    + '<tr><td class="label">Overall Attendance %</td><td><b>'+(pct!=null ? escapeHtml(pct)+'%' : '—')+'</b></td></tr>'
    + '</tbody></table>'
    + '<h2>Hour-wise Attendance Record</h2>'
    + '<table><thead><tr><th>Date</th><th>Day Order</th><th>H1</th><th>H2</th><th>H3</th><th>H4</th><th>H5</th></tr></thead>'
    + '<tbody>'+rowsHtml+'</tbody></table>'
    + PRINT_FOOTER_HTML
    + '</body></html>';
}

/* =========================================================
   3. Single-hour report
      (App.jsx finds `hourRow` and shows the "no data" toast if missing.)
   ========================================================= */
export function buildHourPdfHtml({ entry, hour, hourRow, studentDb, className }){
  const absentRolls = (hourRow.absent_rolls || []).slice();
  const rowsHtml = absentRolls.length===0
    ? '<tr><td colspan="2" style="text-align:center;color:#666;padding:12px;">No absentees recorded for this hour.</td></tr>'
    : absentRolls.map(function(rollNo){
        const student = studentDb.find(function(s){ return s.rollNo === rollNo; });
        return (
          '<tr>'
          + '<td class="num">'+escapeHtml(rollNo)+'</td>'
          + '<td>'+escapeHtml(student ? student.name : rollNo)+'</td>'
          + '</tr>'
        );
      }).join('');

  const generatedOn = new Date().toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' });

  return '<!DOCTYPE html><html><head><meta charset="utf-8" />'
    + '<title>Hour Attendance Report — Hour '+hour+'</title>'
    + '<style>'+HOUR_PRINT_STYLE+'</style></head><body>'
    + printHeaderHtml('Attendance Report — Hour '+hour)
    + '<div class="meta"><span>Class: <b>'+escapeHtml(entry.class_name||className)+'</b></span><span>Date: '+escapeHtml(formatNiceDate(entry.date))+'</span><span>Generated: '+escapeHtml(generatedOn)+'</span></div>'
    + '<table><thead><tr><th>Roll No</th><th>Student Name</th></tr></thead>'
    + '<tbody>'+rowsHtml+'</tbody></table>'
    + PRINT_FOOTER_HTML
    + '</body></html>';
}

/* =========================================================
   Shared helpers for the two full-day register reports
   ========================================================= */
function prepareEntryHours(entry, currentDayOrder){
  const entryDayOrder = (entry.rows && entry.rows[0] && entry.rows[0].day_order) || currentDayOrder;

  const hoursMap = {};
  const hourSubjectMap = {};
  const recordedHourSet = new Set();
  entry.rows.forEach(function(row){
    recordedHourSet.add(Number(row.hour));
    hoursMap[row.hour] = row.absent_rolls || [];
    hourSubjectMap[row.hour] = row.subject_name || '';
  });

  const recordedHours = HOURS.map(function(h){
    return { hour: h, isRecorded: recordedHourSet.has(h) };
  });

  return { entryDayOrder, hoursMap, hourSubjectMap, recordedHours };
}

function activeSortedStudents(studentDb, leftIds){
  return studentDb
    .filter(function(s){ return s.name !== 'XX' && leftIds.indexOf(s.id) === -1; })
    .sort(function(a, b){ return numericRollCompare(a.rollNo, b.rollNo); });
}

function registerHourHeaderCellsHtml(ctx){
  const { entryDayOrder, hourSubjectMap, getHourDisplayInfo } = ctx;
  return HOURS.map(function(h){
    const info = getHourDisplayInfo(entryDayOrder, h, hourSubjectMap[h]);
    const thStyle = info.isDse ? 'color:#c2410c;' : '';
    const subStyle = info.isDse ? 'font-size:9px;font-weight:800;color:#c2410c;' : 'font-size:9px;font-weight:normal;color:#64748b;';
    return '<th style="font-size:11px;'+thStyle+'">H'+h+'<br><span style="'+subStyle+'">'+escapeHtml(info.label)+'</span></th>';
  }).join('');
}

function registerStudentRowHtml(student, index, ctx){
  const { recordedHours, entryDayOrder, hourSubjectMap, hoursMap, getHourDisplayInfo } = ctx;

  let tds = '<td class="num">'+(index + 1)+'</td>'
          + '<td>'+escapeHtml(student.rollNo)+'</td>'
          + '<td><b>'+escapeHtml(student.name)+'</b></td>';

  recordedHours.forEach(function(rh){
    const info = getHourDisplayInfo(entryDayOrder, rh.hour, hourSubjectMap[rh.hour]);
    if (info.isDse) {
      tds += '<td style="text-align:center;color:#c2410c;font-weight:800;">DSE</td>';
      return;
    }

    if (!rh.isRecorded) {
      tds += '<td style="text-align:center;color:#94a3b8;font-weight:600;">—</td>';
      return;
    }

    const isTamilHour = /tamil/i.test(hourSubjectMap[rh.hour] || '');
    const isOtherLang = !!(student.partOne && student.partOne.trim().toLowerCase() !== 'tamil');

    if (isTamilHour && isOtherLang) {
      const badge = student.partOne.trim().slice(0, 2).toUpperCase();
      tds += '<td style="text-align:center;color:#f97316;font-weight:800;">'+escapeHtml(badge)+'</td>';
      return;
    }

    const isAbsent = (hoursMap[rh.hour] || []).indexOf(student.rollNo) !== -1;
    if (isAbsent) {
      tds += '<td style="text-align:center;color:#dc2626;font-weight:800;">A</td>';
      return;
    }

    tds += '<td style="text-align:center;color:#16a34a;font-weight:800;">P</td>';
  });
  return '<tr>'+tds+'</tr>';
}

function registerDocumentHtml({ docTitle, reportTitle, entry, className, entryDayOrder, headerCells, rowsHtml }){
  const generatedOn = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const niceDate = formatNiceDate(entry.date);

  return '<!DOCTYPE html><html><head><meta charset="utf-8" />'
    + '<title>' + docTitle + '</title>'
    + '<style>' + UNIFIED_PRINT_STYLE + '</style></head><body>'
    + printHeaderHtml(reportTitle)
    + '<div class="meta"><span>Class: <b>' + escapeHtml(entry.class_name || className) + '</b> · Date: <b>' + escapeHtml(niceDate) + '</b> · Day Order: <b>' + escapeHtml(entryDayOrder) + '</b></span><span>Generated: ' + escapeHtml(generatedOn) + '</span></div>'
    + '<table><thead><tr>'
    + '<th>#</th><th>Roll Number</th><th>Student Name</th>'
    + headerCells
    + '</tr></thead><tbody>'
    + rowsHtml
    + '</tbody></table>'
    + PRINT_FOOTER_HTML
    + '</body></html>';
}

/* =========================================================
   4. Full-day Master Register (every active student)
   ========================================================= */
export function buildMasterPdfHtml({ entry, studentDb, leftIds, currentDayOrder, className, getHourDisplayInfo }){
  const hourData = prepareEntryHours(entry, currentDayOrder);
  const ctx = { ...hourData, getHourDisplayInfo };

  const students = activeSortedStudents(studentDb, leftIds);
  const rowsHtml = students.map(function(student, i){
    return registerStudentRowHtml(student, i, ctx);
  }).join('');

  return registerDocumentHtml({
    docTitle: 'Full Day Attendance — ' + escapeHtml(entry.date),
    reportTitle: 'Full Day Attendance Master Register',
    entry,
    className,
    entryDayOrder: hourData.entryDayOrder,
    headerCells: registerHourHeaderCellsHtml(ctx),
    rowsHtml
  });
}

/* =========================================================
   5. Full-day Absentees report (only students absent in a recorded hour)
   ========================================================= */
export function buildAbsenteesPdfHtml({ entry, studentDb, leftIds, currentDayOrder, className, getHourDisplayInfo }){
  const hourData = prepareEntryHours(entry, currentDayOrder);
  const ctx = { ...hourData, getHourDisplayInfo };
  const { hoursMap, recordedHours } = hourData;

  const allStudents = activeSortedStudents(studentDb, leftIds);
  const absenteeStudents = allStudents.filter(function(student) {
    return recordedHours.some(function(rh) {
      return rh.isRecorded && (hoursMap[rh.hour] || []).includes(student.rollNo);
    });
  });

  let rowsHtml = '';
  if (absenteeStudents.length === 0) {
    rowsHtml = '<tr><td colspan="8" style="text-align:center;color:#666;padding:12px;">No absentees recorded for this date.</td></tr>';
  } else {
    rowsHtml = absenteeStudents.map(function(student, i){
      return registerStudentRowHtml(student, i, ctx);
    }).join('');
  }

  return registerDocumentHtml({
    docTitle: 'Full Day Absentees — ' + escapeHtml(entry.date),
    reportTitle: 'Full Day Absentees Report',
    entry,
    className,
    entryDayOrder: hourData.entryDayOrder,
    headerCells: registerHourHeaderCellsHtml(ctx),
    rowsHtml
  });
}