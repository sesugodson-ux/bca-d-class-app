// File: src/utils/helpers.js
import { DSE_SCHEDULE } from './constants';

export function safeParse(json, fallback){
  try{ const v = JSON.parse(json); return v==null ? fallback : v; }
  catch(e){ return fallback; }
}

export function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60000);
  return local.toISOString().slice(0,10);
}

export function formatNiceDate(isoStr){
  if(!isoStr) return '—';
  const parts = isoStr.split('-');
  if(parts.length!==3) return isoStr;
  const y=parseInt(parts[0],10), m=parseInt(parts[1],10), d=parseInt(parts[2],10);
  const dt = new Date(y,m-1,d);
  if(isNaN(dt.getTime())) return isoStr;
  return d+' '+dt.toLocaleDateString('en-IN',{month:'long'})+' '+y+' ('+dt.toLocaleDateString('en-IN',{weekday:'long'})+')';
}

export function isValidDobFormat(str){ return /^\d{2}-\d{2}-\d{4}$/.test(str); }

export function maskDobValue(raw){
  const digits = raw.replace(/\D/g,'').slice(0,8);
  if(digits.length>4) return digits.slice(0,2)+'-'+digits.slice(2,4)+'-'+digits.slice(4);
  if(digits.length>2) return digits.slice(0,2)+'-'+digits.slice(2);
  return digits;
}

export function escapeCsv(str){
  const s = String(str==null?'':str);
  if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

export function escapeHtml(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function storagePathFromUrl(url, bucket){
  if(!url) return null;
  const marker = '/object/public/'+bucket+'/';
  const idx = url.indexOf(marker);
  if(idx===-1) return null;
  return url.slice(idx+marker.length);
}

/* Strict numeric comparator — sorts purely on the integer value of the roll number. */
export function numericRollCompare(a, b){
  const numA = parseInt(String(a).trim(), 10);
  const numB = parseInt(String(b).trim(), 10);
  const safeA = isNaN(numA) ? 0 : numA;
  const safeB = isNaN(numB) ? 0 : numB;
  return safeA - safeB;
}

export function getDseForSlot(dayOrder, hour){
  return DSE_SCHEDULE[String(dayOrder)+'-'+String(hour)] || null;
}

export function languageBadgeFor(student){
  if(!student) return null;
  const raw = student.partOne;
  if(raw == null) return null;
  const lang = String(raw).trim();
  if(!lang) return null;
  if(lang.toLowerCase() === 'tamil') return null;
  return lang.slice(0, 2).toUpperCase();
}

/* Trims, strips internal spaces and lower-cases a roll number for comparison. */
export function normalizeRollNo(val){
  return String(val==null?'':val).trim().replace(/\s+/g,'').toLowerCase();
}

/* Normalizes a DOB in almost any common shape to YYYY-MM-DD ('' if unparseable). */
export function normalizeDobToISO(val){
  if(!val) return '';
  const s = String(val).trim();
  if(!s) return '';

  // ISO date or timestamp: YYYY-MM-DD(...)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];

  // DD-MM-YYYY or DD/MM/YYYY
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if(m) return m[3]+'-'+m[2]+'-'+m[1];

  // DD-MM-YY or DD/MM/YY (2-digit year fallback)
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{2})$/);
  if(m){
    const yy = parseInt(m[3],10);
    const yyyy = yy <= 30 ? 2000+yy : 1900+yy;
    return yyyy+'-'+m[2]+'-'+m[1];
  }

  return '';
}

export function credentialsMatch(storedRoll, storedDob, inputRoll, inputDob){
  const rollOk = normalizeRollNo(storedRoll) === normalizeRollNo(inputRoll) && normalizeRollNo(inputRoll) !== '';
  const dobA = normalizeDobToISO(storedDob);
  const dobB = normalizeDobToISO(inputDob);
  const dobOk = dobA !== '' && dobB !== '' && dobA === dobB;
  return rollOk && dobOk;
}

/* Groups flat row-per-hour attendance_history rows into per-date buckets (newest first). */
export function groupHistoryByDate(rows){
  const map = {};
  rows.forEach(function(row){
    if(!map[row.date]){
      map[row.date] = { date: row.date, class_name: row.class_name, total_active: row.total_active, day_order: row.day_order, rows: [] };
    }
    map[row.date].rows.push(row);
    if(row.total_active!=null) map[row.date].total_active = row.total_active;
    if(row.class_name) map[row.date].class_name = row.class_name;
    if(row.day_order!=null) map[row.date].day_order = row.day_order;
  });
  return Object.keys(map)
    .map(function(d){ return map[d]; })
    .sort(function(a,b){
      if(a.date === b.date) return 0;
      return a.date > b.date ? -1 : 1;
    });
}