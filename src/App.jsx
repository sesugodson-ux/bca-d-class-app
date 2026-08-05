import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

const XX_IDS = ["23","71"];

const LS_THEME    = 'bca_theme';
const LS_CLASS    = 'bca_class_name';

const DEFAULT_CLASS = '2 B.C.A. D';
const DEFAULT_SUBJECTS = [
  "Programming in C","C Programming Lab","Digital Logic & Computer Organization",
  "Discrete Mathematics","Database Management Systems","DBMS Lab","Data Structures",
  "Operating Systems","Computer Networks","Web Technology","Communicative English",
  "Statistics","Tamil / Hindi","Value Education"
];
const DAY_ORDERS = [1,2,3,4,5,6];
const HOURS = [1,2,3,4,5];
const PART_ONE_OPTIONS = ["Tamil","French","Hindi","Sanskrit","Telugu"];

/* ===== small helpers ===== */
function safeParse(json, fallback){
  try{ const v = JSON.parse(json); return v==null ? fallback : v; }
  catch(e){ return fallback; }
}
function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60000);
  return local.toISOString().slice(0,10);
}
function formatNiceDate(isoStr){
  if(!isoStr) return '—';
  const parts = isoStr.split('-');
  if(parts.length!==3) return isoStr;
  const y=parseInt(parts[0],10), m=parseInt(parts[1],10), d=parseInt(parts[2],10);
  const dt = new Date(y,m-1,d);
  if(isNaN(dt.getTime())) return isoStr;
  return d+' '+dt.toLocaleDateString('en-IN',{month:'long'})+' '+y+' ('+dt.toLocaleDateString('en-IN',{weekday:'long'})+')';
}
function isValidDobFormat(str){ return /^\d{2}-\d{2}-\d{4}$/.test(str); }
function maskDobValue(raw){
  const digits = raw.replace(/\D/g,'').slice(0,8);
  if(digits.length>4) return digits.slice(0,2)+'-'+digits.slice(2,4)+'-'+digits.slice(4);
  if(digits.length>2) return digits.slice(0,2)+'-'+digits.slice(2);
  return digits;
}
function escapeCsv(str){
  const s = String(str==null?'':str);
  if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}
function escapeHtml(str){
  return String(str==null?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function storagePathFromUrl(url, bucket){
  if(!url) return null;
  const marker = '/object/public/'+bucket+'/';
  const idx = url.indexOf(marker);
  if(idx===-1) return null;
  return url.slice(idx+marker.length);
}
/* Strict numeric comparator — parses the leading/trailing digits of a roll
   number and sorts purely on that integer value (falls back to 0). */
function numericRollCompare(a, b){
  const numA = parseInt(String(a).trim(), 10);
  const numB = parseInt(String(b).trim(), 10);
  const safeA = isNaN(numA) ? 0 : numA;
  const safeB = isNaN(numB) ? 0 : numB;
  return safeA - safeB;
}

/* Normalizes a roll number for comparison purposes: trims whitespace,
   strips any internal spaces, and lower-cases it. This lets login /
   lookup logic match roll numbers even if they carry stray whitespace
   or inconsistent casing coming from Supabase vs. user input. */
function normalizeRollNo(val){
  return String(val==null?'':val).trim().replace(/\s+/g,'').toLowerCase();
}

/* Normalizes a Date-of-Birth value (in almost any common shape) down to a
   canonical YYYY-MM-DD string so that values coming back from Supabase
   (which is often an ISO date like "2007-07-08" or a timestamp like
   "2007-07-08T00:00:00.000Z") can be safely compared against what the
   user types into the DD-MM-YYYY masked input field. Returns '' if the
   value can't be confidently parsed, so unrelated strings never falsely
   match each other. */
function normalizeDobToISO(val){
  if(!val) return '';
  const s = String(val).trim();
  if(!s) return '';

  // ISO date or timestamp: YYYY-MM-DD(...)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];

  // DD-MM-YYYY or DD/MM/YYYY (the format used throughout this app's UI)
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if(m) return m[3]+'-'+m[2]+'-'+m[1];

  // DD-MM-YY or DD/MM/YY (2-digit year fallback)
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{2})$/);
  if(m){
    const yy = parseInt(m[3],10);
    const yyyy = yy <= 30 ? 2000+yy : 1900+yy; // reasonable pivot for student DOBs
    return yyyy+'-'+m[2]+'-'+m[1];
  }

  return '';
}

/* True if two roll number / DOB pairs represent the same person, matching
   flexibly regardless of formatting differences between what's stored in
   Supabase and what the user typed. */
function credentialsMatch(storedRoll, storedDob, inputRoll, inputDob){
  const rollOk = normalizeRollNo(storedRoll) === normalizeRollNo(inputRoll) && normalizeRollNo(inputRoll) !== '';
  const dobA = normalizeDobToISO(storedDob);
  const dobB = normalizeDobToISO(inputDob);
  const dobOk = dobA !== '' && dobB !== '' && dobA === dobB;
  return rollOk && dobOk;
}

/* ===== attendance_history helpers (row-per-hour schema) =====
   Each row in Supabase now represents ONE hour of ONE date:
   { id, date, hour, subject_name, class_name, absent_rolls[], total_enrolled,
     total_left, total_active, total_absent, total_present, message, saved_at }

   The UI still needs to show a day at a glance, so we group the flat rows
   fetched from Supabase into per-date buckets purely for rendering. */
function groupHistoryByDate(rows){
  const map = {};
  rows.forEach(function(row){
    if(!map[row.date]){
      map[row.date] = { date: row.date, class_name: row.class_name, total_active: row.total_active, rows: [] };
    }
    map[row.date].rows.push(row);
    if(row.total_active!=null) map[row.date].total_active = row.total_active;
    if(row.class_name) map[row.date].class_name = row.class_name;
  });
  return Object.keys(map)
    .map(function(d){ return map[d]; })
    .sort(function(a,b){ return a.date < b.date ? 1 : -1; });
}

const STUDY_TABLE = 'study_materials';
const STUDY_BUCKET = 'materials';

export default function App(){
  /* ---------- theme ---------- */
  const [theme, setTheme] = useState(function(){ return localStorage.getItem(LS_THEME) || 'dark'; });
  useEffect(function(){ localStorage.setItem(LS_THEME, theme); }, [theme]);
  function toggleTheme(){ setTheme(function(t){ return t==='dark' ? 'light' : 'dark'; }); }

  /* ---------- navigation ---------- */
  const [view, setView] = useState('landing');
  const databaseRollInputRef = useRef(null);

  useEffect(function(){
    if(view === 'database'){
      const timer = setTimeout(function(){
        if(databaseRollInputRef.current){
          databaseRollInputRef.current.focus();
        }
      }, 100);
      return function(){ clearTimeout(timer); };
    }
  }, [view]);

  /* ---------- toast ---------- */
  const [toast, setToast] = useState({ show:false, msg:'', error:false });
  const toastTimer = useRef(null);
  function showToast(msg, isError){
    setToast({ show:true, msg, error: !!isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function(){ setToast(function(t){ return { ...t, show:false }; }); }, 2400);
  }

  /* ---------- shake ---------- */
  const [shakeKey, setShakeKey] = useState({});
  function triggerShake(key){
    setShakeKey(function(s){ return { ...s, [key]: (s[key]||0)+1 }; });
    setTimeout(function(){ setShakeKey(function(s){ return { ...s, [key]: 0 }; }); }, 400);
  }

  /* ---------- class name ---------- */
  const [className, setClassName] = useState(function(){ return localStorage.getItem(LS_CLASS) || DEFAULT_CLASS; });
  const [classNameInput, setClassNameInput] = useState('');
  function saveClassNameHandler(){
    const val = classNameInput.trim();
    if(!val){ triggerShake('className'); showToast('Enter a class name', true); return; }
    localStorage.setItem(LS_CLASS, val);
    setClassName(val);
    setClassNameInput('');
    showToast('Class name updated');
  }

  /* ---------- student db ===== FETCHED LIVE FROM SUPABASE ('students' table) ===== */
  const [studentDb, setStudentDb] = useState([]);
  const fetchStudents = useCallback(async function(){
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('roll_number', { ascending: true });

      if (error) {
        console.error(error);
        showToast('Could not load student database', true);
        return;
      }

      function pick(row, keys){
        for(let i=0;i<keys.length;i++){
          const v = row[keys[i]];
          if(v!==undefined && v!==null && String(v).trim()!==''){
            return String(v).trim();
          }
        }
        return '';
      }

      const mapped = (data || []).map(function(row) {
        return {
          id: String(row.id),
          rollNo: pick(row, ['roll_number','roll_no','rollNo','rollno']),
          name: pick(row, ['student_name','name','full_name','studentName']),
          studentMob: pick(row, ['mobile_number','student_mob','student_mobile','studentMob','student_phone','mobile']),
          fatherMob: pick(row, ['father_mobile','father_mob','fatherMob','father_phone','parent_mob']),
          collegeID: pick(row, ['college_id','college_email','collegeID','college_mail','email']),
          partOne: pick(row, ['part_one','part_one_language','partOne','language']),
          dob: pick(row, ['dob','date_of_birth','dateOfBirth'])
        };
      });

      setStudentDb(mapped);
    } catch(e) {
      console.error(e);
      showToast('Could not load student database', true);
    }
  }, []);
  function updateStudentById(id, updates){
    setStudentDb(function(db){ return db.map(function(s){ return s.id===id ? { ...s, ...updates } : s; }); });
  }
  function getStudentById(id){ return studentDb.find(function(s){ return s.id===id; }); }

  /* ---------- left students ---------- */
  const [leftIds, setLeftIds] = useState([]);
  const fetchLeftStudents = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('left_students').select('roll_no');
      if(error){ console.error(error); return; }
      const rolls = (data||[]).map(function(r){ return r.roll_no; });
      setLeftIds(studentDb.filter(function(s){ return rolls.indexOf(s.rollNo)!==-1; }).map(function(s){ return s.id; }));
    }catch(e){ console.error(e); }
  }, [studentDb]);
  async function toggleStudentLeft(id){
    const student = getStudentById(id);
    if(!student) return;
    const isLeft = leftIds.indexOf(id)!==-1;
    try{
      if(isLeft){ await supabase.from('left_students').delete().eq('roll_no', student.rollNo); }
      else { await supabase.from('left_students').insert({ roll_no: student.rollNo }); }
      await fetchLeftStudents();
      showToast(isLeft ? (student.name==='XX'?student.rollNo:student.name)+' restored' : (student.name==='XX'?student.rollNo:student.name)+' marked as Left');
    }catch(e){ console.error(e); showToast('Could not update Left status', true); }
  }

  /* ---------- subjects ---------- */
  const [subjects, setSubjects] = useState([]);
  const [subjectIdMap, setSubjectIdMap] = useState({});
  const fetchSubjects = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('subjects').select('id, subject_name').order('id',{ascending:true});
      if(error){ console.error(error); setSubjects(DEFAULT_SUBJECTS); setSubjectIdMap({}); return; }
      const rows = data||[];
      const names = rows.map(function(r){ return r.subject_name; });
      const idMap = {};
      rows.forEach(function(r){ if(r.subject_name) idMap[r.subject_name] = r.id; });
      setSubjects(names);
      setSubjectIdMap(idMap);
    }catch(e){ console.error(e); setSubjects(DEFAULT_SUBJECTS); setSubjectIdMap({}); }
  }, []);
  async function addSubject(name){
    try{
      const { error } = await supabase.from('subjects').insert({ subject_name: name });
      if(error){ showToast('Could not add subject', true); return false; }
      await fetchSubjects(); return true;
    }catch(e){ showToast('Could not add subject', true); return false; }
  }
  async function deleteSubject(name){
    try{
      const { error } = await supabase.from('subjects').delete().eq('subject_name', name);
      if(error){ showToast('Could not remove subject', true); return false; }
      await fetchSubjects(); return true;
    }catch(e){ showToast('Could not remove subject', true); return false; }
  }

  /* ---------- admins ---------- */
  const [admins, setAdmins] = useState([]);
  const fetchAdmins = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('admins').select('rollNo,dob');
      if(error){ console.error(error); return; }
      setAdmins(data||[]);
    }catch(e){ console.error(e); }
  }, []);
  async function addAdmin(rollNo, dob){
    try{
      const { error } = await supabase.from('admins').insert({ rollNo, dob });
      if(error){ showToast('Could not add admin', true); return false; }
      await fetchAdmins(); return true;
    }catch(e){ showToast('Could not add admin', true); return false; }
  }
  async function deleteAdmin(rollNo){
    try{
      const { error } = await supabase.from('admins').delete().eq('rollNo', rollNo);
      if(error){ showToast('Could not remove admin', true); return false; }
      await fetchAdmins(); return true;
    }catch(e){ showToast('Could not remove admin', true); return false; }
  }
  async function verifyAdmin(rollNo, dob){
    try{
      const { data, error } = await supabase.from('admins').select('rollNo,dob');
      if(error){ console.error(error); return false; }
      return (data||[]).some(function(a){
        return credentialsMatch(a.rollNo, a.dob, rollNo, dob);
      });
    }catch(e){ console.error(e); return false; }
  }

  /* ---------- timetable ---------- */
  const [timetable, setTimetable] = useState({});
  const [currentDayOrder, setCurrentDayOrder] = useState(1);
  const fetchTimetable = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('timetable').select('*');
      if(error){ console.error(error); return; }
      const map = {};
      (data||[]).forEach(function(row){ map[row.day_order+'-'+row.hour] = row.subject_name || ''; });
      setTimetable(map);
    }catch(e){ console.error(e); }
  }, []);
  const fetchCurrentDayOrder = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('app_settings').select('key,value').in('key',['current_day_order','last_updated_date']);
      if(error){ console.error(error); return; }

      const settingsMap = {};
      (data||[]).forEach(function(row){ if(row.key){ settingsMap[row.key] = row.value; } });

      const storedOrder = parseInt(settingsMap.current_day_order,10) || 1;
      const storedDate = settingsMap.last_updated_date || null;
      const today = todayISO();
      const todayDow = new Date().getDay();

      if((!storedDate || storedDate < today) && todayDow !== 0){
        const nextOrder = storedOrder >= 6 ? 1 : storedOrder + 1;
        setCurrentDayOrder(nextOrder);
        await supabase.from('app_settings').upsert({ key:'current_day_order', value:String(nextOrder) }, { onConflict:'key' });
        await supabase.from('app_settings').upsert({ key:'last_updated_date', value:today }, { onConflict:'key' });
      }else{
        setCurrentDayOrder(storedOrder);
      }
    }catch(e){ console.error(e); }
  }, []);
  async function saveCurrentDayOrder(dayOrder){
    try{
      const today = todayISO();
      const { error } = await supabase.from('app_settings').upsert(
        { key:'current_day_order', value:String(dayOrder) },
        { onConflict: 'key' }
      );
      if(error){ showToast('Could not update Day Order', true); return; }
      const { error: dateError } = await supabase.from('app_settings').upsert(
        { key:'last_updated_date', value:today },
        { onConflict: 'key' }
      );
      if(dateError){ showToast('Could not update Day Order', true); return; }
      setCurrentDayOrder(dayOrder); showToast('Day Order updated');
    }catch(e){ showToast('Could not update Day Order', true); }
  }
  async function saveTimetableSlot(dayOrder, hour, subjectName){
    try{
      const { error } = await supabase.from('timetable').upsert(
        { day_order:dayOrder, hour:hour, subject_name:subjectName },
        { onConflict:'day_order,hour' }
      );
      if(error){ console.error(error); showToast('Could not save timetable slot', true); return; }
      setTimetable(function(tt){ return { ...tt, [dayOrder+'-'+hour]: subjectName }; });
    }catch(e){ console.error(e); showToast('Could not save timetable slot', true); }
  }

  /* ---------- attendance history (row-per-hour, grouped by date for display) ---------- */
  const [history, setHistory] = useState([]);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState(null);
  const fetchHistory = useCallback(async function(){
    try{
      const { data, error } = await supabase
        .from('attendance_history')
        .select('*')
        .order('date', { ascending:false })
        .order('hour', { ascending:true });
      if(error){ console.error(error); return; }
      setHistory(data||[]);
    }catch(e){ console.error(e); }
  }, []);
  function toggleHistoryExpand(date){
    setExpandedHistoryDate(function(cur){ return cur === date ? null : date; });
  }

  const groupedHistory = useMemo(function(){ return groupHistoryByDate(history); }, [history]);

  /* ---------- student-specific attendance history search (Admin Dashboard) ---------- */
  const [historySearchRoll, setHistorySearchRoll] = useState('');

  /* Builds a per-date list of which hours a given roll number was absent in,
     scanning the flat row-per-hour history rows directly. Dates where the
     student had no absences at all are skipped. */
  function getStudentHistoryRows(rollNo){
    const rollQ = normalizeRollNo(rollNo);
    if(!rollQ) return [];
    const byDate = {};
    history.forEach(function(row){
      const isAbsent = (row.absent_rolls||[]).some(function(r){ return normalizeRollNo(r)===rollQ; });
      if(!isAbsent) return;
      if(!byDate[row.date]) byDate[row.date] = [];
      byDate[row.date].push(row.hour);
    });
    return Object.keys(byDate)
      .sort(function(a,b){ return a<b ? 1 : -1; })
      .map(function(date){
        const hoursAbsent = byDate[date].slice().sort(function(a,b){ return a-b; });
        return { date: date, hoursAbsent: hoursAbsent, isFullDay: hoursAbsent.length >= HOURS.length };
      });
  }

  /* Per-student breakdown for a single date's rows: which hours they were
     absent in, and whether that adds up to a full-day absence. */
  function getDateAbsenteeBreakdown(dateRows){
    const rollHourMap = {};
    dateRows.forEach(function(row){
      (row.absent_rolls||[]).forEach(function(rollNo){
        if(!rollHourMap[rollNo]) rollHourMap[rollNo] = [];
        rollHourMap[rollNo].push(row.hour);
      });
    });
    const totalHours = HOURS.length;
    const breakdown = Object.keys(rollHourMap).map(function(rollNo){
      const hoursAbsent = rollHourMap[rollNo].slice().sort(function(a,b){ return a-b; });
      const student = studentDb.find(function(s){ return s.rollNo === rollNo; });
      const isFullDay = hoursAbsent.length >= totalHours;
      return {
        rollNo: rollNo,
        name: student ? student.name : rollNo,
        hoursAbsent: hoursAbsent,
        isFullDay: isFullDay,
        label: isFullDay ? 'Full Day Absent' : 'Absent in Hour: '+hoursAbsent.join(', ')
      };
    });
    breakdown.sort(function(a,b){ return numericRollCompare(a.rollNo, b.rollNo); });
    return breakdown;
  }

  /* Hour-wise breakdown for a single date's rows: an ordered array (Hour 1 → 5)
     where each item lists the students absent in that hour (and the subject
     taught, if recorded), sorted by roll number. */
  function getDateHourWiseBreakdown(dateRows){
    return HOURS.map(function(h){
      const row = dateRows.find(function(r){ return r.hour === h; });
      const rolls = row ? (row.absent_rolls||[]).slice() : [];
      const students = rolls.map(function(rollNo){
        const student = studentDb.find(function(s){ return s.rollNo === rollNo; });
        return { rollNo: rollNo, name: student ? student.name : rollNo };
      }).sort(function(a,b){ return numericRollCompare(a.rollNo, b.rollNo); });
      return { hour: h, absentees: students, subject: row ? row.subject_name : null, hasData: !!row };
    });
  }

  function buildHistoryMessage(dateEntry){
    const niceDate = formatNiceDate(dateEntry.date);
    const breakdown = getDateAbsenteeBreakdown(dateEntry.rows);
    const lines = [];
    lines.push('Class: '+(dateEntry.class_name||className));
    lines.push('----------------------------------------');
    lines.push('📅 Date: '+niceDate);
    lines.push('----------------------------------------');
    lines.push('Absent Students List:');
    if(breakdown.length===0){ lines.push('✅ No absentees recorded.'); }
    else {
      breakdown.forEach(function(b,i){
        lines.push(String(i+1).padStart(2,'0')+'. '+b.rollNo+' - '+b.name+' — '+b.label);
      });
    }
    lines.push('----------------------------------------');
    return lines.join('\n');
  }

  /* Attendance % now simply treats every saved row as one conducted hour. */
  function getAttendancePercent(rollNo){
    if(history.length===0) return null;
    let conducted=0, present=0;
    history.forEach(function(row){
      conducted += 1;
      const rolls = row.absent_rolls || [];
      if(rolls.indexOf(rollNo)===-1) present += 1;
    });
    if(conducted===0) return null;
    return Math.round((present/conducted)*1000)/10;
  }

  /* ---------- semester results ---------- */
  const [semesterResults, setSemesterResults] = useState([]);
  const [semesterList, setSemesterList] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(null);
  async function fetchSemesterResults(rollNo){
    try{
      const { data, error } = await supabase.from('semester_results').select('*').eq('roll_no', rollNo).order('semester',{ascending:true});
      if(error){ console.error(error); showToast('Could not load results', true); return; }
      const rows = data||[];
      setSemesterResults(rows);
      const sems = Array.from(new Set(rows.map(function(r){ return r.semester; }))).sort(function(a,b){ return a-b; });
      setSemesterList(sems);
      setSelectedSemester(sems.length ? sems[sems.length-1] : null);
    }catch(e){ console.error(e); }
  }

  /* ---------- initial boot ---------- */
  useEffect(function(){
    fetchSubjects(); fetchAdmins(); fetchTimetable(); fetchCurrentDayOrder(); fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(function(){ fetchLeftStudents(); }, [fetchLeftStudents]);
  useEffect(function(){
    (async function(){
      if(localStorage.getItem('bca_xx_init')) return;
      try{
        for(const id of XX_IDS){
          const s = studentDb.find(function(x){ return x.id===id; });
          if(s){ await supabase.from('left_students').upsert({ roll_no: s.rollNo }); }
        }
        localStorage.setItem('bca_xx_init', '1');
        fetchLeftStudents();
      }catch(e){ console.error(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- session state ---------- */
  const [dailyAuthenticated, setDailyAuthenticated] = useState(false);
  const [currentAdminRollNo, setCurrentAdminRollNo] = useState('');
  const [currentStudyRollNo, setCurrentStudyRollNo] = useState('');
  const [currentStudyIsAdmin, setCurrentStudyIsAdmin] = useState(false);
  const [studyLoginMode, setStudyLoginMode] = useState('student');

  function goLanding(){
    setDailyAuthenticated(false);
    setCurrentAdminRollNo('');
    setCurrentStudyRollNo('');
    setCurrentStudyIsAdmin(false);
    setStudyLoginMode('student');
    setSemesterResults([]); setSemesterList([]); setSelectedSemester(null);
    setView('landing');
    window.scrollTo(0,0);
  }
  function navTo(v){ setView(v); window.scrollTo(0,0); }

  /* ================= ATTENDANCE REPORT ================= */
  const [dailyLoginRoll, setDailyLoginRoll] = useState('');
  const [dailyLoginDob, setDailyLoginDob] = useState('');
  const [dailyLoginBusy, setDailyLoginBusy] = useState(false);

  async function goDailyLoginGate(){
    if(dailyAuthenticated){ await fetchSubjects(); navTo('daily'); return; }
    setDailyLoginRoll(''); setDailyLoginDob('');
    navTo('dailyLogin');
  }
  async function attemptDailyLogin(){
    const rollNo = dailyLoginRoll.trim(), dob = dailyLoginDob.trim();
    if(!rollNo){ triggerShake('dailyRoll'); showToast('Enter your Admin Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('dailyDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    setDailyLoginBusy(true);
    const ok = await verifyAdmin(rollNo, dob);
    setDailyLoginBusy(false);
    if(ok){
      setDailyAuthenticated(true); setCurrentAdminRollNo(rollNo);
      showToast('Welcome back!'); await fetchSubjects(); navTo('daily');
    } else {
      triggerShake('dailyLoginCard'); showToast('Invalid Admin Roll Number or Date of Birth', true);
    }
  }

  const [dateVal, setDateVal] = useState(todayISO());
  const [hourVal, setHourVal] = useState('');
  const [subjectVal, setSubjectVal] = useState('');
  const [rollState, setRollState] = useState({});
  function cycleRollState(id){
    setRollState(function(rs){
      const next = { ...rs };
      if(next[id]==='absent') delete next[id]; else next[id]='absent';
      return next;
    });
  }
  function resetGrid(){ setRollState({}); }

  const activeStudents = useMemo(function(){
    return studentDb.filter(function(s){ return s.name!=='XX' && leftIds.indexOf(s.id)===-1; });
  }, [studentDb, leftIds]);

  const gridStudents = useMemo(function(){
    return studentDb
      .slice()
      .sort(function(a, b){ return numericRollCompare(a.rollNo, b.rollNo); });
  }, [studentDb]);

  const summary = useMemo(function(){
    const absentList = activeStudents
      .filter(function(s){ return rollState[s.id]==='absent'; })
      .sort(function(a, b){ return numericRollCompare(a.rollNo, b.rollNo); });

    const totalEnrolled = studentDb.length;
    const totalLeft = leftIds.length;
    const totalActive = activeStudents.length;
    const totalAbsent = absentList.length;
    const totalPresent = totalActive - totalAbsent;

    return { absentList, totalEnrolled, totalLeft, totalActive, totalAbsent, totalPresent };
  }, [activeStudents, rollState, studentDb, leftIds]);

  function buildRawMessage(){
    const niceDate = formatNiceDate(dateVal);
    const lines = [];
    lines.push('Class: '+className);
    lines.push('----------------------------------------');
    lines.push('📅 Date: '+niceDate);
    if(hourVal) lines.push('🕒 Hour: '+hourVal);
    if(subjectVal) lines.push('📚 Subject: '+subjectVal);
    lines.push('----------------------------------------');
    lines.push('Absent Students List:');
    if(summary.absentList.length===0){ lines.push('✅ No absentees recorded.'); }
    else { summary.absentList.forEach(function(s,i){ lines.push(String(i+1).padStart(2,'0')+'. '+s.rollNo+' - '+s.name); }); }
    lines.push('----------------------------------------');
    lines.push('❌ Total Absentees: '+summary.totalAbsent);
    lines.push('✅ Total Present: '+summary.totalPresent);
    lines.push('----------------------------------------');
    return lines.join('\n');
  }

  function validateBeforeSend(){
    let ok = true;
    if(!dateVal){ triggerShake('dateInput'); ok=false; }
    if(!hourVal.trim()){ triggerShake('hourInput'); ok=false; }
    if(!subjectVal.trim()){ triggerShake('subjectInput'); ok=false; }
    if(!ok) showToast('Please select a date, hour, and subject first', true);
    return ok;
  }

  /* Saves attendance as a single clean row keyed by (date, hour) into
     attendance_history, matching the row-per-hour schema:
     date, hour, subject_name, class_name, absent_rolls, strength counts,
     message, saved_at. Uses upsert with onConflict:'date,hour' so that
     re-submitting the same date+hour combination UPDATES the existing row
     instead of creating a duplicate. Requires a unique constraint on
     (date, hour) in Supabase:
       alter table attendance_history add constraint attendance_history_date_hour_key unique (date, hour);
     Returns true/false so callers (e.g. the WhatsApp send handler) know
     whether the save actually succeeded. Does not show its own toast on
     success — the caller decides how to report the combined outcome. */
  async function saveAttendanceToHistory(){
    const hour = parseInt(hourVal, 10);
    const absentRolls = summary.absentList.map(function(s){ return s.rollNo; });

    const record = {
      date: dateVal,
      hour: hour,
      subject_name: subjectVal,
      class_name: className,
      absent_rolls: absentRolls,
      total_enrolled: summary.totalEnrolled,
      total_left: summary.totalLeft,
      total_active: summary.totalActive,
      total_absent: summary.totalAbsent,
      total_present: summary.totalPresent,
      message: buildRawMessage(),
      saved_at: new Date().toISOString()
    };

    try{
      const { error } = await supabase
        .from('attendance_history')
        .upsert(record, { onConflict: 'date,hour' });

      if(error){ console.error(error); showToast('Could not save to history', true); return false; }

      fetchHistory();
      return true;
    }catch(e){
      console.error(e);
      showToast('Could not save to history', true);
      return false;
    }
  }

  /* Send to Parents Group via WhatsApp: STRICTLY awaits saveAttendanceToHistory()
     first. WhatsApp is only opened if the Supabase save succeeds — if the save
     fails, an error toast is shown and WhatsApp never opens, so we never send a
     report that wasn't actually recorded in history. */
  const [sendBusy, setSendBusy] = useState(false);
  async function handleSend(){
    if(!validateBeforeSend()){ triggerShake('sendBtn'); return; }
    setSendBusy(true);
    let saved = false;
    try{
      saved = await saveAttendanceToHistory();
    } finally {
      setSendBusy(false);
    }
    if(!saved){
      triggerShake('sendBtn');
      showToast('Could not save attendance — WhatsApp was not opened. Please try again.', true);
      return;
    }
    window.open('https://wa.me/?text='+encodeURIComponent(buildRawMessage()), '_blank');
    showToast('Saved to history — opening WhatsApp…');
  }
  function fallbackCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('Message Copied!'); }
    catch(e){ showToast('Copy failed — please copy manually', true); }
    document.body.removeChild(ta);
  }
  function handleCopy(){
    if(!validateBeforeSend()){ triggerShake('copyBtn'); return; }
    const text = buildRawMessage();
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ showToast('Message Copied!'); }).catch(function(){ fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }

  /* ================= STUDENT DATABASE ================= */
  const [dbLoginRoll, setDbLoginRoll] = useState('');
  const [dbLoginDob, setDbLoginDob] = useState('');
  const [dbLoginBusy, setDbLoginBusy] = useState(false);
  function goDatabaseLogin(){ setDbLoginRoll(''); setDbLoginDob(''); navTo('databaseLogin'); }
  async function attemptDbLogin(){
    const rollNo = dbLoginRoll.trim(), dob = dbLoginDob.trim();
    if(!rollNo){ triggerShake('dbRoll'); showToast('Enter your Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('dbDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    setDbLoginBusy(true);
    const ok = await verifyAdmin(rollNo, dob);
    setDbLoginBusy(false);
    if(ok){ showToast('Welcome back!'); navTo('database'); }
    else { triggerShake('dbLoginCard'); showToast('Invalid Roll Number or Date of Birth', true); }
  }

  const [searchRoll, setSearchRoll] = useState('');
  const [searchMobile, setSearchMobile] = useState('');
  const searchResults = useMemo(function(){
    const rollQ = searchRoll.replace(/\D/g,'').trim();
    const mobQ = searchMobile.replace(/\D/g,'').trim();
    if(!rollQ && !mobQ) return null;
    return studentDb.filter(function(s){
      if(s.name==='XX') return false;
      const rollMatch = rollQ ? s.rollNo.indexOf(rollQ)!==-1 : true;
      const mobMatch = mobQ ? (s.studentMob.indexOf(mobQ)!==-1 || s.fatherMob.indexOf(mobQ)!==-1) : true;
      if(rollQ && mobQ) return rollMatch && mobMatch;
      return rollQ ? rollMatch : mobMatch;
    });
  }, [searchRoll, searchMobile, studentDb]);

  /* ================= STUDY MATERIAL ================= */
  const [studyLoginRoll, setStudyLoginRoll] = useState('');
  const [studyLoginDob, setStudyLoginDob] = useState('');
  const [studyLoginBusy, setStudyLoginBusy] = useState(false);
  const [studyCache, setStudyCache] = useState([]);
  const [studyNewSubject, setStudyNewSubject] = useState('');
  const [studyMaterialSubject, setStudyMaterialSubject] = useState('');
  const [studyMaterialTitle, setStudyMaterialTitle] = useState('');
  const [studyMaterialFile, setStudyMaterialFile] = useState(null);
  const [studyUploading, setStudyUploading] = useState(false);

  function goStudyRoleSelect(){
    setStudyLoginRoll(''); setStudyLoginDob('');
    navTo('studyRoleSelect');
  }
  function goSemesterRoleSelect(){
    setStudyLoginRoll(''); setStudyLoginDob('');
    navTo('semesterRoleSelect');
  }

  function goStudyLogin(mode){
    setStudyLoginMode(mode);
    setStudyLoginRoll(''); setStudyLoginDob('');
    navTo('studyLogin');
  }
  function goSemesterLogin(mode){
    setStudyLoginMode(mode);
    setStudyLoginRoll(''); setStudyLoginDob('');
    navTo('semesterLogin');
  }

  function findStudentByCredentials(rollNo, dob){
    return studentDb.find(function(s){
      return s.name!=='XX' && credentialsMatch(s.rollNo, s.dob, rollNo, dob);
    });
  }

  async function attemptStudyLogin(){
    const rollNo = studyLoginRoll.trim(), dob = studyLoginDob.trim();
    if(!rollNo){ triggerShake('studyRoll'); showToast('Enter your Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('studyDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    setStudyLoginBusy(true);
    try{
      if(studyLoginMode==='admin'){
        const ok = await verifyAdmin(rollNo, dob);
        if(!ok){ triggerShake('studyLoginCard'); showToast('Invalid Admin Roll Number or Date of Birth', true); setStudyLoginBusy(false); return; }
        setCurrentStudyRollNo(rollNo);
        setCurrentStudyIsAdmin(true);
      } else {
        if(studentDb.length===0){ await fetchStudents(); }
        const student = findStudentByCredentials(rollNo, dob);
        if(!student){ triggerShake('studyLoginCard'); showToast('Invalid Roll Number or Date of Birth', true); setStudyLoginBusy(false); return; }
        setCurrentStudyRollNo(student.rollNo);
        setCurrentStudyIsAdmin(false);
      }
      showToast('Welcome back!');
      await refreshStudyView();
      navTo('studyDashboard');
    }catch(e){ console.error(e); showToast('Login error', true); }
    setStudyLoginBusy(false);
  }

  async function attemptSemesterLogin(){
    const rollNo = studyLoginRoll.trim(), dob = studyLoginDob.trim();
    if(!rollNo){ triggerShake('semRoll'); showToast('Enter your Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('semDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    setStudyLoginBusy(true);
    try{
      if(studyLoginMode==='admin'){
        const ok = await verifyAdmin(rollNo, dob);
        if(!ok){ triggerShake('semLoginCard'); showToast('Invalid Admin Roll Number or Date of Birth', true); setStudyLoginBusy(false); return; }
        setCurrentStudyRollNo(rollNo);
        setCurrentStudyIsAdmin(true);
        showToast('Welcome back!');
        await fetchSemesterResults(rollNo);
        navTo('semesterResults');
      } else {
        if(studentDb.length===0){ await fetchStudents(); }
        const student = findStudentByCredentials(rollNo, dob);
        if(!student){ triggerShake('semLoginCard'); showToast('Invalid Roll Number or Date of Birth', true); setStudyLoginBusy(false); return; }
        setCurrentStudyRollNo(student.rollNo);
        setCurrentStudyIsAdmin(false);
        showToast('Welcome back!');
        await fetchSemesterResults(student.rollNo);
        navTo('semesterResults');
      }
    }catch(e){ console.error(e); showToast('Login error', true); }
    setStudyLoginBusy(false);
  }

  async function fetchStudyMaterials(){
    try{
      const { data, error } = await supabase.from(STUDY_TABLE)
        .select('id, subject_id, subject_name, file_name, file_path, file_url, subjects(id, subject_name)')
        .order('file_name',{ascending:true});
      if(error){ console.error(error); showToast('Could not load study material', true); return []; }
      const rows = (data||[]).map(function(row){
        const joinedSubject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
        const resolvedSubjectName = row.subject_name || joinedSubject?.subject_name || '';
        return {
          ...row,
          subject_name: resolvedSubjectName,
          subject_id: row.subject_id ?? joinedSubject?.id ?? null,
          subjects: joinedSubject || null
        };
      });
      setStudyCache(rows); return rows;
    }catch(e){ console.error(e); return []; }
  }
  async function refreshStudyView(){ await fetchSubjects(); await fetchStudyMaterials(); }

  async function handleAddStudySubject(){
    if(!currentStudyIsAdmin) return;
    const val = studyNewSubject.trim();
    if(!val){ triggerShake('studyNewSubject'); showToast('Enter a subject name', true); return; }
    if(subjects.some(function(s){ return s.toLowerCase()===val.toLowerCase(); })){
      triggerShake('studyNewSubject'); showToast('That subject already exists', true); return;
    }
    const ok = await addSubject(val);
    if(ok){ setStudyNewSubject(''); showToast('Subject added'); await refreshStudyView(); }
  }
  async function handleDeleteStudySubject(name){
    const subjectId = subjectIdMap[name];
    const rowsForSubject = studyCache.filter(function(r){
      const relationSubjectName = Array.isArray(r.subjects) ? r.subjects[0]?.subject_name : r.subjects?.subject_name;
      return Number(r.subject_id)===Number(subjectId) || r.subject_name===name || relationSubjectName===name;
    });
    const filePaths = rowsForSubject.filter(function(r){ return r.file_url; }).map(function(r){ return storagePathFromUrl(r.file_url, STUDY_BUCKET); }).filter(Boolean);
    try{
      if(filePaths.length) await supabase.storage.from(STUDY_BUCKET).remove(filePaths);
      if(rowsForSubject.length){
        if(subjectId != null) await supabase.from(STUDY_TABLE).delete().eq('subject_id', subjectId);
        await supabase.from(STUDY_TABLE).delete().eq('subject_name', name);
      }
    }catch(e){ console.error(e); }
    const ok = await deleteSubject(name);
    if(ok){ showToast('Subject removed'); await refreshStudyView(); }
  }
  async function handleUploadMaterial() {
    if (!currentStudyIsAdmin) return;
    const subject = studyMaterialSubject.trim();
    const title = studyMaterialTitle.trim();

    if (!subject) {
      triggerShake('studyMaterialSubject');
      showToast('Select a subject', true);
      return;
    }
    if (!studyMaterialFile) {
      triggerShake('studyMaterialFile');
      showToast('Choose a file', true);
      return;
    }

    setStudyUploading(true);
    try {
      const { data: subjectRows, error: subjectLookupError } = await supabase
        .from('subjects')
        .select('id')
        .eq('subject_name', subject)
        .limit(1);

      if (subjectLookupError) throw subjectLookupError;
      const subjectId = subjectRows && subjectRows.length > 0 ? subjectRows[0].id : null;
      if (!subjectId) {
        showToast('Could not find the selected subject', true);
        return;
      }

      const safeName = studyMaterialFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = subject.replace(/[^a-zA-Z0-9\-_]/g, '_') + '/' + Date.now() + '_' + safeName;

      const { error: uploadError } = await supabase.storage.from(STUDY_BUCKET).upload(path, studyMaterialFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(STUDY_BUCKET).getPublicUrl(path);
      const fileUrl = publicUrlData?.publicUrl;

      const { error: insertError } = await supabase.from(STUDY_TABLE).insert({
        subject_id: subjectId,
        file_name: title || studyMaterialFile.name,
        file_path: path,
        file_url: fileUrl
      });

      if (insertError) throw insertError;
      setStudyMaterialTitle('');
      setStudyMaterialFile(null);
      showToast('Material uploaded');
      await refreshStudyView();
    } catch (err) {
      console.error(err);
      showToast('Upload failed', true);
    } finally {
      setStudyUploading(false);
    }
  }
  async function handleDeleteMaterial(m){
    const path = storagePathFromUrl(m.file_url, STUDY_BUCKET);
    try{
      if(path) await supabase.storage.from(STUDY_BUCKET).remove([path]);
      const { error } = await supabase.from(STUDY_TABLE).delete().eq('id', m.id);
      if(error){ showToast('Could not delete material', true); return; }
      showToast('Material deleted'); await refreshStudyView();
    }catch(e){ console.error(e); showToast('Could not delete material', true); }
  }

  /* ================= SEMESTER RESULTS ================= */
  const semesterRows = useMemo(function(){
    if(selectedSemester==null) return [];
    return semesterResults.filter(function(r){ return r.semester===selectedSemester; });
  }, [semesterResults, selectedSemester]);
  const semesterPercent = useMemo(function(){
    if(semesterRows.length===0) return null;
    let obtained=0, max=0;
    semesterRows.forEach(function(r){ obtained += Number(r.marks||0); max += Number(r.max_marks||100); });
    if(max===0) return null;
    return Math.round((obtained/max)*1000)/10;
  }, [semesterRows]);

  const [semAddRoll, setSemAddRoll] = useState('');
  const [semAddSemester, setSemAddSemester] = useState('');
  const [semAddSubject, setSemAddSubject] = useState('');
  const [semAddMarks, setSemAddMarks] = useState('');
  const [semAddMaxMarks, setSemAddMaxMarks] = useState('100');
  const [semAddBusy, setSemAddBusy] = useState(false);
  const [semBrowseRoll, setSemBrowseRoll] = useState('');

  async function handleAdminAddMarks(){
    const rollNo = semAddRoll.trim();
    const semester = parseInt(semAddSemester,10);
    const subjectName = semAddSubject.trim();
    const marks = parseFloat(semAddMarks);
    const maxMarks = parseFloat(semAddMaxMarks)||100;
    if(!rollNo){ triggerShake('semAddRoll'); showToast('Enter a Roll Number', true); return; }
    if(!semester){ triggerShake('semAddSemester'); showToast('Enter a valid semester number', true); return; }
    if(!subjectName){ triggerShake('semAddSubject'); showToast('Enter a subject name', true); return; }
    if(isNaN(marks)){ triggerShake('semAddMarks'); showToast('Enter valid marks', true); return; }
    setSemAddBusy(true);
    try{
      const { error } = await supabase.from('semester_results').insert({ roll_no: rollNo, semester, subject_name: subjectName, marks, max_marks: maxMarks });
      if(error){ showToast('Could not add marks: '+error.message, true); setSemAddBusy(false); return; }
      showToast('Marks added successfully');
      setSemAddSubject(''); setSemAddMarks(''); setSemAddMaxMarks('100');
      if(semBrowseRoll.trim()===rollNo || (!semBrowseRoll.trim() && currentStudyRollNo===rollNo)){
        await fetchSemesterResults(rollNo);
      }
    }catch(e){ console.error(e); showToast('Could not add marks', true); }
    setSemAddBusy(false);
  }

  async function handleAdminBrowseResults(){
    const rollNo = semBrowseRoll.trim();
    if(!rollNo){ triggerShake('semBrowseRoll'); showToast('Enter a Roll Number to search', true); return; }
    await fetchSemesterResults(rollNo);
    showToast('Loaded results for '+rollNo);
  }

  async function handleDeleteResultRow(id){
    try{
      const { error } = await supabase.from('semester_results').delete().eq('id', id);
      if(error){ showToast('Could not delete entry', true); return; }
      showToast('Entry deleted');
      const rollToRefresh = semBrowseRoll.trim() || currentStudyRollNo;
      if(rollToRefresh) await fetchSemesterResults(rollToRefresh);
    }catch(e){ console.error(e); showToast('Could not delete entry', true); }
  }

  /* ================= ADMIN SETTINGS ================= */
  const [loginRoll, setLoginRoll] = useState('');
  const [loginDob, setLoginDob] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  function goAdminLogin(){ setLoginRoll(''); setLoginDob(''); navTo('adminLogin'); }
  async function attemptAdminLogin(){
    const rollNo = loginRoll.trim(), dob = loginDob.trim();
    if(!rollNo){ triggerShake('adminRoll'); showToast('Enter your Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('adminDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    setLoginBusy(true);
    const ok = await verifyAdmin(rollNo, dob);
    setLoginBusy(false);
    if(ok){
      setCurrentAdminRollNo(rollNo); showToast('Welcome back!');
      await fetchSubjects(); await fetchAdmins(); await fetchHistory(); await fetchTimetable(); await fetchCurrentDayOrder();
      navTo('adminDashboard');
    } else { triggerShake('adminLoginCard'); showToast('Invalid Roll Number or Date of Birth', true); }
  }

  const [newSubjectInput, setNewSubjectInput] = useState('');
  async function handleAddSubjectAdmin(){
    const val = newSubjectInput.trim();
    if(!val){ triggerShake('newSubjectInput'); showToast('Enter a subject name', true); return; }
    if(subjects.some(function(s){ return s.toLowerCase()===val.toLowerCase(); })){
      triggerShake('newSubjectInput'); showToast('That subject already exists', true); return;
    }
    const ok = await addSubject(val);
    if(ok){ setNewSubjectInput(''); showToast('Subject added'); }
  }

  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const filteredStudents = useMemo(function(){
    const q = studentSearchQuery.toLowerCase().trim();
    if(!q) return studentDb;
    return studentDb.filter(function(s){
      return s.name.toLowerCase().indexOf(q)!==-1 || s.rollNo.indexOf(q)!==-1;
    });
  }, [studentDb, studentSearchQuery]);

  const [newAdminRoll, setNewAdminRoll] = useState('');
  const [newAdminDob, setNewAdminDob] = useState('');
  async function handleAddAdmin(){
    const rollNo = newAdminRoll.trim(), dob = newAdminDob.trim();
    if(!rollNo){ triggerShake('newAdminRoll'); showToast('Enter a Roll Number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('newAdminDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    if(admins.some(function(a){ return a.rollNo.trim()===rollNo; })){ triggerShake('newAdminRoll'); showToast('That admin already exists', true); return; }
    const ok = await addAdmin(rollNo, dob);
    if(ok){ setNewAdminRoll(''); setNewAdminDob(''); showToast('Admin added'); }
  }
  async function handleDeleteAdmin(rollNo){
    if(admins.length<=1){ showToast('At least one admin must remain', true); return; }
    await deleteAdmin(rollNo);
  }

  /* ---- Global CSV export (grouped by date) ---- */
  function handleExportCsv(){
    if(history.length===0){ showToast('No history to export', true); return; }
    const grouped = groupHistoryByDate(history);
    const headers = ['Date','Class','Hours With Absentees','Total Strength','Absent Count','Present Count'];
    const rows = [headers.map(escapeCsv).join(',')];
    grouped.forEach(function(dateEntry){
      const allRolls = new Set();
      const activeHours = [];
      dateEntry.rows.forEach(function(row){
        if((row.absent_rolls||[]).length>0) activeHours.push(row.hour);
        (row.absent_rolls||[]).forEach(function(r){ allRolls.add(r); });
      });
      const totalActive = dateEntry.total_active!=null ? dateEntry.total_active : '';
      const absentCount = allRolls.size;
      const presentCount = dateEntry.total_active!=null ? Math.max(dateEntry.total_active-absentCount,0) : '';
      rows.push([
        dateEntry.date||'', dateEntry.class_name||'', activeHours.join('; '),
        totalActive, absentCount, presentCount
      ].map(escapeCsv).join(','));
    });
    const csvContent = rows.join('\r\n');
    const blob = new Blob([csvContent], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bca_attendance_'+todayISO()+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  }

  /* Shared print-window opener: writes printHtml into a popup and triggers
     the browser print dialog so the admin can "Save as PDF". */
  function openPrintWindow(printHtml){
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

  const PRINT_BASE_STYLE = '*{box-sizing:border-box;}'
    + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;margin:32px;}'
    + 'h1{font-size:20px;margin:0 0 2px;}'
    + 'h2{font-size:15px;margin:18px 0 8px;}'
    + '.meta{font-size:12px;color:#555;margin-bottom:20px;}'
    + 'table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}'
    + 'th{background:#f0f0f0;font-weight:600;}'
    + 'td.num{text-align:center;}'
    + '.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px;}'
    + '.pill-present{background:#e3f7ea;color:#1e8449;}'
    + '.pill-absent{background:#fdeaea;color:#c0392b;}'
    + '.pill-partial{background:#fff6df;color:#9a6b00;}'
    + 'tbody tr:nth-child(even){background:#fafafa;}'
    + '.legend{font-size:11px;color:#555;margin:6px 0 18px;}'
    + '.legend span{margin-right:14px;}'
    + '.footer{margin-top:24px;font-size:11px;color:#888;text-align:center;}'
    + '.student-info{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;}'
    + '.student-info td{border:1px solid #ccc;padding:6px 8px;}'
    + '.student-info td.label{background:#f7f7f7;font-weight:600;width:32%;}'
    + '@media print{body{margin:12mm;}.footer{position:fixed;bottom:8mm;left:0;right:0;}}';

  /* Global attendance-history PDF export: a neat, structured, color-coded
     table (green = Present-heavy day, red = Full Day Absent count present,
     amber = partial/hour-specific absences) covering every saved date.
     Rows are grouped from the flat row-per-hour data first. */
  function handleExportPdf(){
    if(history.length===0){ showToast('No history to export', true); return; }
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

    const printHtml = '<!DOCTYPE html><html><head><meta charset="utf-8" />'
      + '<title>Attendance History Report</title>'
      + '<style>'+MODERN_GLOBAL_PRINT_STYLE+'</style></head><body>'
      + '<div class="header">'
      + '<div class="college-name">Bishop Heber College</div>'
      + '<div class="dept-name">Department of Computer Applications (BCA)</div>'
      + '<div class="report-title">Attendance History Report</div>'
      + '</div>'
      + '<div class="meta"><span>Class: <b>'+escapeHtml(className)+'</b></span><span>Generated: '+escapeHtml(generatedOn)+'</span></div>'
      + '<div class="legend">'
      + '<span class="label">Legend:</span>'
      + '<span class="pill pill-present">Green</span> All Present / Present count '
      + '<span class="pill pill-absent">Red</span> Full Day Absent / Absent count '
      + '<span class="pill pill-partial">Amber</span> Partial (specific-hour) absences'
      + '</div>'
      + '<table><thead><tr><th>Date</th><th>Class</th><th>Subject / Hours</th><th>Total Strength</th><th>Absent</th><th>Present</th><th>Status</th></tr></thead>'
      + '<tbody>'+rowsHtml+'</tbody></table>'
      + '<div class="footer">BCA Class Portal Record · Student-managed internal utility report. May contain minor discrepancies compared to official college portals.</div>'
      + '</body></html>';

    if(openPrintWindow(printHtml)){
      showToast('Opening print dialog — choose "Save as PDF"');
    }
  }

  /* Generates a printable, individual attendance PDF for a single student:
     College/Department header, full student details, and a clean table of
     every date + exact hours they were absent in, driven directly by the
     flat row-per-hour history data via getStudentHistoryRows(). */
  function handleExportStudentPdf(){
    const rollQ = historySearchRoll.trim();
    if(!rollQ){ triggerShake('historySearchRoll'); showToast('Enter a Roll Number to export', true); return; }
    const student = studentDb.find(function(s){ return normalizeRollNo(s.rollNo)===normalizeRollNo(rollQ); });
    if(!student){ triggerShake('historySearchRoll'); showToast('No student found with that Roll Number', true); return; }

    const rows = getStudentHistoryRows(student.rollNo);
    const pct = getAttendancePercent(student.rollNo);

    const rowsHtml = rows.length===0
      ? '<tr><td colspan="3" style="text-align:center;color:#666;padding:12px;">No absences recorded — full attendance in all saved reports.</td></tr>'
      : rows.map(function(r){
          const pillCls = r.isFullDay ? 'pill-absent' : 'pill-partial';
          const label = r.isFullDay ? 'Full Day Absent' : 'Absent — Hour '+r.hoursAbsent.join(', ');
          return (
            '<tr>'
            + '<td>'+escapeHtml(formatNiceDate(r.date))+'</td>'
            + '<td class="num">'+escapeHtml(r.hoursAbsent.join(', '))+'</td>'
            + '<td><span class="pill '+pillCls+'">'+escapeHtml(label)+'</span></td>'
            + '</tr>'
          );
        }).join('');

    const generatedOn = new Date().toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' });

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
      + '.pill{display:inline-block;padding:2px 8px;border-radius:12px;font-weight:700;font-size:10.5px;}'
      + '.pill-present{background:#dcfce7;color:#15803d;}'
      + '.pill-absent{background:#fee2e2;color:#b91c1c;}'
      + '.pill-partial{background:#fef9c3;color:#a16207;}'
      + 'tbody tr:nth-child(even){background:#fafafa;}'
      + '.footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:7.5px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:4px;}'
      + '@media print{body{margin:10mm;}}';

    const printHtml = '<!DOCTYPE html><html><head><meta charset="utf-8" />'
      + '<title>Individual Attendance Report — '+escapeHtml(student.rollNo)+'</title>'
      + '<style>'+MODERN_PRINT_STYLE+'</style></head><body>'
      + '<div class="header">'
      + '<div class="college-name">Bishop Heber College</div>'
      + '<div class="dept-name">Department of Computer Applications (BCA)</div>'
      + '<div class="report-title">Individual Student Attendance Report</div>'
      + '</div>'
      + '<div class="meta"><span>Class: <b>'+escapeHtml(className)+'</b></span><span>Generated: '+escapeHtml(generatedOn)+'</span></div>'
      + '<table class="student-info"><tbody>'
      + '<tr><td class="label">Student Name</td><td><b>'+escapeHtml(student.name)+'</b></td></tr>'
      + '<tr><td class="label">Roll Number</td><td><b>'+escapeHtml(student.rollNo)+'</b></td></tr>'
      + '<tr><td class="label">Student Mobile</td><td>'+escapeHtml(student.studentMob||'—')+'</td></tr>'
      + '<tr><td class="label">Date of Birth</td><td>'+escapeHtml(student.dob||'—')+'</td></tr>'
      + '<tr><td class="label">Part One Language</td><td>'+escapeHtml(student.partOne||'—')+'</td></tr>'
      + '<tr><td class="label">Overall Attendance %</td><td><b>'+(pct!=null ? escapeHtml(pct)+'%' : '—')+'</b></td></tr>'
      + '</tbody></table>'
      + '<h2>Absence Record</h2>'
      + '<table><thead><tr><th>Date</th><th>Hour(s) Absent</th><th>Status</th></tr></thead>'
      + '<tbody>'+rowsHtml+'</tbody></table>'
      + '<div class="footer">BCA Class Portal Record · Student-managed internal utility report. May contain minor discrepancies compared to official college portals.</div>'
      + '</body></html>';

    if(openPrintWindow(printHtml)){
      showToast('Opening print dialog — choose "Save as PDF"');
    }
  }

  /* Deletes every hour-row saved for a given date (a whole day's report). */
  async function handleDeleteHistoryEntry(date){
    try{
      const { error } = await supabase.from('attendance_history').delete().eq('date', date);
      if(error){ showToast('Could not delete report', true); return; }
      showToast('Report deleted'); fetchHistory();
    }catch(e){ showToast('Could not delete report', true); }
  }
  function handleCopyHistoryMessage(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ showToast('Message Copied!'); }).catch(function(){ fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }

  /* ---------- edit student modal ---------- */
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editForm, setEditForm] = useState({ name:'', rollNo:'', dob:'', studentMob:'', fatherMob:'', collegeID:'', partOne:'Tamil' });
  function openEditModal(id){
    const s = getStudentById(id);
    if(!s){ showToast('Student not found', true); return; }
    setEditingStudentId(id);
    setEditForm({ name:s.name, rollNo:s.rollNo, dob:s.dob, studentMob:s.studentMob, fatherMob:s.fatherMob, collegeID:s.collegeID, partOne:s.partOne });
    setEditModalOpen(true); document.body.style.overflow='hidden';
  }
  function closeEditModal(){ setEditModalOpen(false); setEditingStudentId(null); document.body.style.overflow=''; }
  function saveEditModal(){
    if(!editingStudentId) return;
    const { name, rollNo, dob, studentMob, fatherMob, collegeID, partOne } = editForm;
    if(!name.trim()){ triggerShake('editName'); showToast('Name is required', true); return; }
    if(!rollNo.trim() || !/^\d+$/.test(rollNo.trim())){ triggerShake('editRollNo'); showToast('Enter a valid roll number', true); return; }
    if(!isValidDobFormat(dob)){ triggerShake('editDob'); showToast('DOB must be DD-MM-YYYY', true); return; }
    updateStudentById(editingStudentId, { name:name.trim(), rollNo:rollNo.trim(), dob, studentMob:studentMob.trim(), fatherMob:fatherMob.trim(), collegeID:collegeID.trim(), partOne });
    closeEditModal(); showToast('Student data updated');
  }

  /* =========================================================  RENDER  ========================================================= */
  const shakeCls = function(key){ return shakeKey[key] ? ' shake' : ''; };

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <div className="header-content">
          {view!=='landing' && (
            <button type="button" className="header-back" aria-label="Back to Home" onClick={goLanding}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 11l2.5 2.5L16 8.5" stroke="#04201b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#04201b" strokeWidth="2.2"/></svg>
          </div>
          <div className="header-text">
            <h1>BCA App</h1>
          </div>
          <button type="button" className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme==='dark' ? '🌙' : '🌞'}
          </button>
          <div className="status-pill"><span className="status-dot"></span><span>{className}</span></div>
        </div>
      </header>

      <main>
        {/* ===== LANDING ===== */}
        {view==='landing' && (
          <section className="view active">
            <div className="landing-intro">
              <h2 className="landing-heading">What would you like to do?</h2>
            </div>
            <TimetableWidget timetable={timetable} currentDayOrder={currentDayOrder} onChangeDayOrder={function(d){ setCurrentDayOrder(d); }} editable={false} />

            <button type="button" className="mode-card mode-card-primary" onClick={goDailyLoginGate}>
              <span className="mode-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#04201b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2.5 2.5L16 8.5"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/></svg></span>
              <span className="mode-card-text"><span className="mode-card-title">Attendance Report</span><span className="mode-card-sub">Mark attendance on the grid &amp; send today's report</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>

            <button type="button" className="mode-card mode-card-tertiary" onClick={goDatabaseLogin}>
              <span className="mode-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#53bdeb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
              <span className="mode-card-text"><span className="mode-card-title">Student Database</span><span className="mode-card-sub">Look up &amp; edit contact details by roll or mobile no.</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>

            <button type="button" className="mode-card mode-card-quaternary" onClick={goStudyRoleSelect}>
              <span className="mode-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
              <span className="mode-card-text"><span className="mode-card-title">Study Material</span><span className="mode-card-sub">Browse notes &amp; resources shared for each subject</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>

            <button type="button" className="mode-card mode-card-quinary" onClick={goSemesterRoleSelect}>
              <span className="mode-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#be78ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 6 6 .9-4.5 4.3 1.1 6-5.6-3-5.6 3 1.1-6L3 8.9 9 8z"/></svg></span>
              <span className="mode-card-text"><span className="mode-card-title">Semester Results</span><span className="mode-card-sub">View your marks &amp; percentage per semester</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>

            <button type="button" className="mode-card mode-card-secondary" onClick={goAdminLogin}>
              <span className="mode-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></span>
              <span className="mode-card-text"><span className="mode-card-title">Admin Settings</span><span className="mode-card-sub">Subjects, students, admins, timetable &amp; history</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>

            <p className="app-footer">Class: {className} · {studentDb.length} students loaded ({leftIds.length} Left)</p>
            <p className="app-footer">Created by GODSON S</p>
          </section>
        )}

        {/* ===== ATTENDANCE: ADMIN LOGIN ===== */}
        {view==='dailyLogin' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Attendance Report</p>
              <h2 className="landing-heading">Admin Login Required</h2>
            </div>
            <div className={"card"+shakeCls('dailyLoginCard')}>
              <p className="helper-text" style={{marginTop:0}}>This section is restricted to verified Admins. Enter your Admin Roll Number and Date of Birth.</p>
              <div className="stack-fields">
                <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" autoFocus
                  className={shakeCls('dailyRoll')} value={dailyLoginRoll} onChange={function(e){ setDailyLoginRoll(e.target.value); }} id="dailyLoginRollInput"
                  onKeyDown={function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('dailyLoginDobInput')?.focus(); } }} /></div>
                <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off"
                  className={shakeCls('dailyDob')} value={dailyLoginDob} onChange={function(e){ setDailyLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptDailyLogin(); }} id="dailyLoginDobInput" /></div>
              </div>
              <button type="button" className="btn btn-primary" disabled={dailyLoginBusy} onClick={attemptDailyLogin}>Login</button>
            </div>
          </section>
        )}

        {/* ===== ATTENDANCE: MAIN VIEW ===== */}
        {view==='daily' && (
          <section className="view active">
            <section className="card">
              <h2 className="card-title">Configuration</h2>
              <div className="form-row">
                <div className="field"><label>Date</label><input type="date" className={shakeCls('dateInput')} value={dateVal} onChange={function(e){ setDateVal(e.target.value); }} /></div>
                <div className="field"><label>Hour</label>
                  <select className={shakeCls('hourInput')} value={hourVal} onChange={function(e){ setHourVal(e.target.value); }}>
                    <option value="">Select hour…</option>
                    {HOURS.map(function(h){ return <option key={h} value={h}>{h}</option>; })}
                  </select>
                </div>
                <div className="field"><label>Subject / Period</label>
                  <select className={shakeCls('subjectInput')} value={subjectVal} onChange={function(e){ setSubjectVal(e.target.value); }}>
                    <option value="" disabled>{subjects.length ? 'Select subject…' : 'No subjects configured — add one in Admin Settings'}</option>
                    {subjects.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                  </select>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Attendance Grid</h2>
                <button type="button" className="link-btn" onClick={resetGrid}>Reset all</button>
              </div>
              <div className="grid-legend">
                <span><i className="legend-swatch present"></i>Present</span>
                <span><i className="legend-swatch absent"></i>Absent</span>
                <span><i className="legend-swatch left"></i>Left / XX (disabled)</span>
              </div>
              <p className="helper-text" style={{marginTop:0}}>Tap a roll number to cycle Present → Absent → Present. Left students and unresolved "XX" entries stay visible but shaded and disabled.</p>
              <div className="attendance-grid" style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8 }}>
                {gridStudents.map(function(s){
                  const isXX = s.name === 'XX';
                  const isLeft = leftIds.indexOf(s.id) !== -1;
                  const isDisabled = isXX || isLeft;
                  const state = rollState[s.id] || 'present';
                  const displayNum = (s.rollNo && String(s.rollNo).trim() !== '') ? String(s.rollNo).slice(-2) : '—';

                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={
                        "roll-btn"
                        + (isDisabled ? ' state-left' : (state === 'absent' ? ' state-absent' : ''))
                      }
                      title={(isXX ? 'Unresolved roll' : s.name) + ' · ' + s.rollNo + (isLeft ? ' (Left)' : '') + (isXX ? ' (XX)' : '')}
                      aria-label={(isXX ? 'Unresolved' : s.name) + (isDisabled ? ' — disabled' : ' — ' + state)}
                      disabled={isDisabled}
                      onClick={function(){ if(!isDisabled) cycleRollState(s.id); }}>
                      {displayNum}
                    </button>
                  );
                })}
              </div>
              <div className="stats-strip">
                <StatBox label="Enrolled" value={summary.totalEnrolled} />
                <StatBox label="Left/XX" value={summary.totalLeft} cls="left" />
                <StatBox label="Present" value={summary.totalPresent} cls="present" />
                <StatBox label="Absent" value={summary.totalAbsent} cls="absent" />
              </div>
            </section>
            <section className="card preview-card">
              <h2 className="card-title">Live Preview</h2>
              <div className="chat-bg">
                <div className="bubble">
                  <pre>{buildRawMessage()}</pre>
                  <div className="bubble-meta">
                    <span>{new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                    <svg viewBox="0 0 16 11" fill="none"><path d="M1 5.5L4.5 9L11 1.5" stroke="#53bdeb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 5.5L9 9L15.5 1.5" stroke="#53bdeb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </section>
            <div className="actions">
              <button type="button" className={"btn btn-primary"+shakeCls('sendBtn')} disabled={sendBusy} onClick={handleSend}>
                <svg viewBox="0 0 24 24" fill="#04201b"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.13-1.32A9.93 9.93 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.2 14.3c-.22.62-1.28 1.18-1.77 1.25-.45.07-1.02.1-1.65-.1-.38-.12-.86-.28-1.48-.55-2.6-1.12-4.3-3.73-4.43-3.9-.13-.17-1.06-1.4-1.06-2.67 0-1.27.66-1.9.9-2.16.22-.24.5-.3.66-.3.17 0 .3 0 .43.01.14.01.33-.05.51.4.2.5.66 1.74.72 1.86.06.13.1.28.02.45-.42.9-.86 1.18-.6 1.6.74 1.2 1.36 1.78 2.4 2.4.18.1.3.08.43-.03.16-.13.65-.68.83-.91.18-.23.35-.18.58-.1.23.08 1.46.7 1.71.83.25.13.42.2.48.31.06.12.06.65-.16 1.27z"/></svg>
                {sendBusy ? 'Saving…' : 'Send to Parents Group via WhatsApp'}
              </button>
              <button type="button" className={"btn btn-secondary"+shakeCls('copyBtn')} onClick={handleCopy}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                Copy to Clipboard
              </button>
            </div>
            <p className="app-footer">BCA App</p>
          </section>
        )}

        {/* ===== DATABASE LOGIN ===== */}
        {view==='databaseLogin' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Student Database</p>
              <h2 className="landing-heading">Login to continue</h2>
            </div>
            <div className={"card"+shakeCls('dbLoginCard')}>
              <p className="helper-text" style={{marginTop:0}}>Enter your Admin Roll Number and Date of Birth.</p>
              <div className="stack-fields">
                <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off"
                  className={shakeCls('dbRoll')} value={dbLoginRoll} onChange={function(e){ setDbLoginRoll(e.target.value); }} /></div>
                <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off"
                  className={shakeCls('dbDob')} value={dbLoginDob} onChange={function(e){ setDbLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptDbLogin(); }} /></div>
              </div>
              <button type="button" className="btn btn-primary" disabled={dbLoginBusy} onClick={attemptDbLogin}>Login</button>
            </div>
          </section>
        )}

        {/* ===== DATABASE MAIN ===== */}
        {view==='database' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Student Database</p>
              <h2 className="landing-heading">Search Students</h2>
            </div>
            <section className="card">
              <h2 className="card-title">Search</h2>
              <div className="form-row">
                <div className="field"><label>Roll Number</label><input ref={databaseRollInputRef} type="text" inputMode="numeric" placeholder="e.g. 442 or 255113XXX" autoComplete="off" value={searchRoll} onChange={function(e){ setSearchRoll(e.target.value); }} /></div>
                <div className="field"><label>Mobile Number</label><input type="text" inputMode="numeric" placeholder="e.g. 9488631753" autoComplete="off" value={searchMobile} onChange={function(e){ setSearchMobile(e.target.value); }} /></div>
              </div>
            </section>
            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Results</h2>
                <span className="helper-text" style={{margin:0}}>{searchResults ? (searchResults.length+(searchResults.length===1?' match':' matches')) : ''}</span>
              </div>
              {!searchResults && <div className="empty-state">Enter a roll number or mobile number above to search.</div>}
              {searchResults && searchResults.length===0 && <div className="empty-state">No students match that search.</div>}
              {searchResults && searchResults.map(function(s){
                const left = leftIds.indexOf(s.id)!==-1;
                const pct = getAttendancePercent(s.rollNo);
                return (
                  <div key={s.id} className={"search-result-card"+(left?' left-status':'')}>
                    <div className="src-head">
                      <div>
                        <div className="src-name">{s.name}</div>
                        <div className="src-roll">Roll No {s.rollNo}{pct!=null ? ' · '+pct+'% attendance' : ''}</div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        {left && <span className="left-badge">Left</span>}
                        <button type="button" className="edit-student-btn" onClick={function(){ openEditModal(s.id); }}>✏ Edit</button>
                      </div>
                    </div>
                    <div className="src-detail-grid">
                      <DetailItem label="Student Mobile" value={s.studentMob} tel />
                      <DetailItem label="Father Mobile" value={s.fatherMob} tel />
                      <DetailItem label="College ID" value={s.collegeID} mail />
                      <DetailItem label="Part One Language" value={s.partOne} />
                      <DetailItem label="Date of Birth" value={s.dob} />
                    </div>
                  </div>
                );
              })}
            </section>
          </section>
        )}

        {/* ===== STUDY MATERIAL: ROLE SELECT ===== */}
        {view==='studyRoleSelect' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Study Material</p>
              <h2 className="landing-heading">Who are you?</h2>
            </div>
            <div className="card">
              <p className="helper-text" style={{marginTop:0}}>Select your role to continue. Students can browse and preview materials. Admins can upload and manage materials.</p>
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={function(){ goStudyLogin('student'); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#04201b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  I am a Student
                </button>
                <button type="button" className="btn btn-secondary" onClick={function(){ goStudyLogin('admin'); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  I am an Admin
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===== SEMESTER RESULTS: ROLE SELECT ===== */}
        {view==='semesterRoleSelect' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Semester Results</p>
              <h2 className="landing-heading">Who are you?</h2>
            </div>
            <div className="card">
              <p className="helper-text" style={{marginTop:0}}>Select your role to continue. Students can view their own marks. Admins can add marks and browse any student's results.</p>
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={function(){ goSemesterLogin('student'); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#04201b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  I am a Student
                </button>
                <button type="button" className="btn btn-secondary" onClick={function(){ goSemesterLogin('admin'); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  I am an Admin
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===== STUDY MATERIAL: LOGIN ===== */}
        {view==='studyLogin' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Study Material · {studyLoginMode==='admin' ? 'Admin Login' : 'Student Login'}</p>
              <h2 className="landing-heading">Login to continue</h2>
            </div>
            <div className={"card"+shakeCls('studyLoginCard')}>
              <p className="helper-text" style={{marginTop:0}}>
                {studyLoginMode==='admin'
                  ? 'Enter your Admin Roll Number and Date of Birth to access upload controls.'
                  : 'Enter your Roll Number and Date of Birth to browse study material.'}
              </p>
              <div className="stack-fields">
                <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" autoFocus
                  className={shakeCls('studyRoll')} value={studyLoginRoll} onChange={function(e){ setStudyLoginRoll(e.target.value); }}
                  onKeyDown={function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('studyLoginDobInput')?.focus(); } }} /></div>
                <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" id="studyLoginDobInput"
                  className={shakeCls('studyDob')} value={studyLoginDob} onChange={function(e){ setStudyLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptStudyLogin(); }} /></div>
              </div>
              <button type="button" className="btn btn-primary" disabled={studyLoginBusy} onClick={attemptStudyLogin}>
                {studyLoginBusy ? 'Verifying…' : 'Login'}
              </button>
            </div>
          </section>
        )}

        {/* ===== SEMESTER RESULTS: LOGIN ===== */}
        {view==='semesterLogin' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Semester Results · {studyLoginMode==='admin' ? 'Admin Login' : 'Student Login'}</p>
              <h2 className="landing-heading">Login to continue</h2>
            </div>
            <div className={"card"+shakeCls('semLoginCard')}>
              <p className="helper-text" style={{marginTop:0}}>
                {studyLoginMode==='admin'
                  ? 'Enter your Admin Roll Number and Date of Birth to add and manage results.'
                  : 'Enter your Roll Number and Date of Birth to view your semester results.'}
              </p>
              <div className="stack-fields">
                <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" autoFocus
                  className={shakeCls('semRoll')} value={studyLoginRoll} onChange={function(e){ setStudyLoginRoll(e.target.value); }}
                  onKeyDown={function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('semesterLoginDobInput')?.focus(); } }} /></div>
                <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" id="semesterLoginDobInput"
                  className={shakeCls('semDob')} value={studyLoginDob} onChange={function(e){ setStudyLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptSemesterLogin(); }} /></div>
              </div>
              <button type="button" className="btn btn-primary" disabled={studyLoginBusy} onClick={attemptSemesterLogin}>
                {studyLoginBusy ? 'Verifying…' : 'Login'}
              </button>
            </div>
          </section>
        )}

        {/* ===== SEMESTER RESULTS: MAIN VIEW ===== */}
        {view==='semesterResults' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">
                {currentStudyIsAdmin ? 'Semester Results · Admin Mode' : 'Semester Results · Roll No '+currentStudyRollNo}
              </p>
              <h2 className="landing-heading">{currentStudyIsAdmin ? 'Manage Results' : 'Your Results'}</h2>
            </div>

            {currentStudyIsAdmin && (
              <section className="card">
                <h2 className="card-title">Add / Update Marks</h2>
                <p className="helper-text" style={{marginTop:0}}>Enter the student's Roll Number, semester, subject, and marks to publish results. This will be visible to the student immediately.</p>
                <div className="stack-fields">
                  <div className="form-row">
                    <div className="field"><label>Student Roll Number</label>
                      <input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off"
                        className={shakeCls('semAddRoll')} value={semAddRoll} onChange={function(e){ setSemAddRoll(e.target.value); }} />
                    </div>
                    <div className="field"><label>Semester</label>
                      <input type="text" inputMode="numeric" placeholder="e.g. 1" autoComplete="off"
                        className={shakeCls('semAddSemester')} value={semAddSemester} onChange={function(e){ setSemAddSemester(e.target.value); }} />
                    </div>
                  </div>
                  <div className="field"><label>Subject Name</label>
                    <input type="text" placeholder="e.g. Data Structures" autoComplete="off"
                      className={shakeCls('semAddSubject')} value={semAddSubject} onChange={function(e){ setSemAddSubject(e.target.value); }} />
                  </div>
                  <div className="form-row">
                    <div className="field"><label>Marks Obtained</label>
                      <input type="text" inputMode="numeric" placeholder="e.g. 78" autoComplete="off"
                        className={shakeCls('semAddMarks')} value={semAddMarks} onChange={function(e){ setSemAddMarks(e.target.value); }} />
                    </div>
                    <div className="field"><label>Max Marks</label>
                      <input type="text" inputMode="numeric" placeholder="e.g. 100" autoComplete="off"
                        value={semAddMaxMarks} onChange={function(e){ setSemAddMaxMarks(e.target.value); }} />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn-add btn-add-block" disabled={semAddBusy} onClick={handleAdminAddMarks}>
                  {semAddBusy ? 'Saving…' : 'Add Marks Entry'}
                </button>
              </section>
            )}

            {currentStudyIsAdmin && (
              <section className="card">
                <h2 className="card-title">Browse Student Results</h2>
                <p className="helper-text" style={{marginTop:0}}>Enter any Roll Number to load and view that student's results below.</p>
                <div className="add-row">
                  <input type="text" inputMode="numeric" placeholder="Enter Roll Number…" autoComplete="off"
                    className={shakeCls('semBrowseRoll')} value={semBrowseRoll} onChange={function(e){ setSemBrowseRoll(e.target.value); }} />
                  <button type="button" className="btn-add" onClick={handleAdminBrowseResults}>Load</button>
                </div>
              </section>
            )}

            <section className="card">
              <div className="semester-select-row">
                {semesterList.length===0 && <span className="empty-state">No results published yet.</span>}
                {semesterList.map(function(sem){
                  return (
                    <button key={sem} type="button" className={sem===selectedSemester?'btn-add':'btn-add secondary-add'}
                      onClick={function(){ setSelectedSemester(sem); }}>Semester {sem}</button>
                  );
                })}
              </div>
              {semesterPercent!=null && (
                <div className="semester-pct-hero">
                  <div className="pct-num">{semesterPercent}%</div>
                  <div className="pct-label">Overall percentage · Semester {selectedSemester}</div>
                </div>
              )}
              {semesterRows.map(function(r){
                const pct = r.max_marks ? (r.marks/r.max_marks*100) : 0;
                return (
                  <div key={r.id} className="result-row">
                    <span className="result-row-subject">{r.subject_name}</span>
                    <span className={"result-row-marks"+(pct<40?' low':'')}>{r.marks} / {r.max_marks}</span>
                    {currentStudyIsAdmin && (
                      <button type="button" style={{flex:'0 0 auto',minHeight:28,padding:'0 10px',borderRadius:'var(--radius-sm)',fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(255,77,77,.35)',background:'rgba(255,77,77,.08)',color:'var(--danger)'}}
                        onClick={function(){ handleDeleteResultRow(r.id); }}>Delete</button>
                    )}
                  </div>
                );
              })}
              {selectedSemester!=null && semesterRows.length===0 && <div className="empty-state">No subjects recorded for this semester.</div>}
            </section>

            <button type="button" className="btn btn-secondary" onClick={goLanding}>Logout / Back to Home</button>
          </section>
        )}

        {/* ===== STUDY MATERIAL: MAIN VIEW ===== */}
        {view==='studyDashboard' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">{currentStudyIsAdmin ? 'Study Material · Admin Mode (Roll No '+currentStudyRollNo+')' : 'Study Material · Roll No '+currentStudyRollNo}</p>
              <h2 className="landing-heading">{currentStudyIsAdmin ? 'Manage Study Material' : 'Study Material Repository'}</h2>
            </div>

            {currentStudyIsAdmin && (
              <section className="card">
                <h2 className="card-title">Add Subject</h2>
                <p className="helper-text" style={{marginTop:0}}>Create a subject shared live via Supabase — appears instantly in Attendance Report and Study Material for everyone.</p>
                <div className="add-row">
                  <input type="text" placeholder="e.g. Data Structures" autoComplete="off" className={shakeCls('studyNewSubject')}
                    value={studyNewSubject} onChange={function(e){ setStudyNewSubject(e.target.value); }} />
                  <button type="button" className="btn-add" onClick={handleAddStudySubject}>Add</button>
                </div>
                <div className="manage-list">
                  {subjects.length===0 && <div className="empty-state">No subjects yet — add one above.</div>}
                  {subjects.map(function(name){
                    return (
                      <div key={name} className="manage-row">
                        <span className="manage-row-text">{name}</span>
                        <RemoveBtn label={'Remove subject '+name} onClick={function(){ handleDeleteStudySubject(name); }} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {currentStudyIsAdmin && (
              <section className="card">
                <h2 className="card-title">Upload Material</h2>
                <p className="helper-text" style={{marginTop:0}}>Pick a subject and upload a PDF, PPT, or Doc file. Files upload directly to the Supabase Storage bucket <code>materials</code>.</p>
                <div className="stack-fields">
                  <div className="field"><label>Subject</label>
                    <select className={shakeCls('studyMaterialSubject')} value={studyMaterialSubject} onChange={function(e){ setStudyMaterialSubject(e.target.value); }}>
                      <option value="" disabled>{subjects.length ? 'Select subject…' : 'Add a subject above first'}</option>
                      {subjects.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                    </select>
                  </div>
                  <div className="field"><label>Material Title</label>
                    <input type="text" placeholder="e.g. Unit 3 Notes" autoComplete="off" value={studyMaterialTitle} onChange={function(e){ setStudyMaterialTitle(e.target.value); }} />
                  </div>
                  <div className="field"><label>File (PDF / PPT / Doc)</label>
                    <input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" className={shakeCls('studyMaterialFile')}
                      onChange={function(e){ setStudyMaterialFile(e.target.files && e.target.files[0] ? e.target.files[0] : null); }} />
                  </div>
                </div>
                <button type="button" className="btn-add btn-add-block" disabled={studyUploading} onClick={handleUploadMaterial}>
                  {studyUploading ? 'Uploading…' : 'Upload Material'}
                </button>
              </section>
            )}

            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Repository</h2>
                <span className="helper-text" style={{margin:0}}>{studyCache.filter(function(r){ return r.file_url; }).length} items</span>
              </div>
              {subjects.length===0 && (
                <div className="empty-state">
                  {currentStudyIsAdmin ? 'No subjects yet — add one above to start uploading material.' : 'No study material has been shared yet. Check back soon.'}
                </div>
              )}
              {subjects.map(function(subject){
                const subjectId = subjectIdMap[subject];
                const materialsForSubject = studyCache.filter(function(m){
                  const relationSubjectName = Array.isArray(m.subjects) ? m.subjects[0]?.subject_name : m.subjects?.subject_name;
                  const rowSubjectId = m.subject_id != null ? Number(m.subject_id) : null;
                  return (subjectId != null && rowSubjectId===Number(subjectId)) || m.subject_name===subject || relationSubjectName===subject;
                }).filter(function(m){ return m.file_url; });
                return (
                  <div key={subject} className="study-subject-group">
                    <div className="study-subject-heading">
                      <span>{subject}</span>
                      <span className="study-count-pill">{materialsForSubject.length} {materialsForSubject.length===1?'file':'files'}</span>
                    </div>
                    <div className="manage-list" style={{marginTop:0}}>
                      {materialsForSubject.length===0 && <div className="empty-state">No material uploaded for this subject yet.</div>}
                      {materialsForSubject.map(function(m){
                        return (
                          <div key={m.id} className="manage-row study-material-row">
                            <span className="manage-row-text">
                              {currentStudyIsAdmin
                                ? m.file_name
                                : <a href={m.file_url} target="_blank" rel="noopener noreferrer">📄 {m.file_name}</a>
                              }
                            </span>
                            {currentStudyIsAdmin && (
                              <RemoveBtn label={'Delete '+m.file_name} onClick={function(){ handleDeleteMaterial(m); }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
            <button type="button" className="btn btn-secondary" onClick={goLanding}>Logout / Back to Home</button>
          </section>
        )}

        {/* ===== ADMIN SETTINGS: LOGIN ===== */}
        {view==='adminLogin' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Admin Settings</p>
              <h2 className="landing-heading">Login to continue</h2>
            </div>
            <div className={"card"+shakeCls('adminLoginCard')}>
              <p className="helper-text" style={{marginTop:0}}>Enter your Roll Number and Date of Birth.</p>
              <div className="stack-fields">
                <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" autoFocus
                  className={shakeCls('adminRoll')} value={loginRoll} onChange={function(e){ setLoginRoll(e.target.value); }}
                  onKeyDown={function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('adminLoginDobInput')?.focus(); } }} /></div>
                <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" id="adminLoginDobInput"
                  className={shakeCls('adminDob')} value={loginDob} onChange={function(e){ setLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptAdminLogin(); }} /></div>
              </div>
              <button type="button" className="btn btn-primary" disabled={loginBusy} onClick={attemptAdminLogin}>Login</button>
            </div>
            <p className="app-footer">BCA App</p>
          </section>
        )}

        {/* ===== ADMIN SETTINGS: DASHBOARD ===== */}
        {view==='adminDashboard' && (
          <section className="view active">
            <div className="landing-intro">
              <p className="landing-eyebrow">Logged in as Roll No {currentAdminRollNo}</p>
              <h2 className="landing-heading">Admin Dashboard</h2>
            </div>

            <section className="card">
              <h2 className="card-title">Update Class Name</h2>
              <p className="helper-text" style={{marginTop:0}}>This name appears in the preview message and throughout the app.</p>
              <div style={{marginBottom:10}}>
                <span className="current-class-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Current: {className}
                </span>
              </div>
              <div className="class-name-row">
                <input type="text" placeholder="e.g. 3 B.C.A. D" autoComplete="off" className={shakeCls('className')}
                  value={classNameInput} onChange={function(e){ setClassNameInput(e.target.value); }} onKeyDown={function(e){ if(e.key==='Enter') saveClassNameHandler(); }} />
                <button type="button" className="btn-add" onClick={saveClassNameHandler}>Save</button>
              </div>
            </section>

            <TimetableWidget timetable={timetable} currentDayOrder={currentDayOrder} onChangeDayOrder={saveCurrentDayOrder} editable={true} subjects={subjects} onSaveSlot={saveTimetableSlot} />

            <section className="card">
              <h2 className="card-title">Manage Subjects</h2>
              <p className="helper-text" style={{marginTop:0}}>Subjects live in Supabase — added or removed here, they update instantly in the Attendance Report dropdown and Study Material for every device.</p>
              <div className="add-row">
                <input type="text" placeholder="e.g. Java Programming" autoComplete="off" className={shakeCls('newSubjectInput')}
                  value={newSubjectInput} onChange={function(e){ setNewSubjectInput(e.target.value); }} />
                <button type="button" className="btn-add" onClick={handleAddSubjectAdmin}>Add</button>
              </div>
              <div className="manage-list">
                {subjects.length===0 && <div className="empty-state">No subjects yet — add one above.</div>}
                {subjects.map(function(name){
                  return (
                    <div key={name} className="manage-row">
                      <span className="manage-row-text">{name}</span>
                      <RemoveBtn label={'Remove '+name} onClick={function(){ deleteSubject(name); }} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 className="card-title">Manage Students</h2>
              <p className="helper-text" style={{marginTop:0}}>Mark students who have left the college. They are hidden from active totals but stay visible (shaded) on the grid.</p>
              <div className="student-search-wrap">
                <input type="text" placeholder="Search by name or roll number…" autoComplete="off" value={studentSearchQuery} onChange={function(e){ setStudentSearchQuery(e.target.value); }} />
              </div>
              <div className="student-list-scroll">
                {filteredStudents.length===0 && <div className="empty-state" style={{padding:'10px 4px'}}>No students match your search.</div>}
                {filteredStudents.map(function(s){
                  const left = leftIds.indexOf(s.id)!==-1;
                  return (
                    <div key={s.id} className={"student-row"+(left?' left-status':'')}>
                      <div className="student-row-info">
                        <div className="student-row-name">{s.name==='XX' ? '[No Data] '+s.rollNo : s.name}</div>
                        <div className="student-row-roll">{s.rollNo}</div>
                      </div>
                      {left && <span className="left-badge">Left</span>}
                      <button type="button" className={"toggle-left-btn "+(left?'restore':'mark')} onClick={function(){ toggleStudentLeft(s.id); }}>
                        {left ? 'Restore' : 'Mark Left'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 className="card-title">Manage Admins</h2>
              <p className="helper-text" style={{marginTop:0}}>Admins live in Supabase. Add the next class representative so they can take over later — changes apply instantly across all devices.</p>
              <div className="add-row">
                <input type="text" placeholder="Roll Number" inputMode="numeric" autoComplete="off" className={shakeCls('newAdminRoll')}
                  value={newAdminRoll} onChange={function(e){ setNewAdminRoll(e.target.value); }} />
                <input type="text" placeholder="DD-MM-YYYY" inputMode="numeric" maxLength={10} autoComplete="off" className={shakeCls('newAdminDob')}
                  value={newAdminDob} onChange={function(e){ setNewAdminDob(maskDobValue(e.target.value)); }} />
              </div>
              <button type="button" className="btn-add btn-add-block" onClick={handleAddAdmin}>Add Admin</button>
              <div className="manage-list">
                {admins.map(function(a){
                  return (
                    <div key={a.rollNo} className="manage-row">
                      <span className="manage-row-text"><strong>{a.rollNo}</strong> <span className="manage-row-sub">· DOB {a.dob}</span></span>
                      <RemoveBtn label={'Remove admin '+a.rollNo} onClick={function(){ handleDeleteAdmin(a.rollNo); }} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Attendance History</h2>
                <button type="button" className="link-btn" onClick={handleExportPdf}>Export PDF</button>
              </div>

              <p className="helper-text" style={{marginTop:0}}>Look up a specific student's attendance record across every saved date, or export their individual report as a PDF.</p>
              <div className="add-row">
                <input type="text" inputMode="numeric" placeholder="Enter Roll Number…" autoComplete="off"
                  className={shakeCls('historySearchRoll')} value={historySearchRoll} onChange={function(e){ setHistorySearchRoll(e.target.value); }} />
                <button type="button" className="btn-add" onClick={handleExportStudentPdf}>Export Student PDF</button>
              </div>

              {historySearchRoll.trim() && (function(){
                const rollQ = historySearchRoll.trim();
                const student = studentDb.find(function(s){ return normalizeRollNo(s.rollNo)===normalizeRollNo(rollQ); });
                if(!student){
                  return <div className="empty-state">No student found with Roll Number "{rollQ}".</div>;
                }
                const rows = getStudentHistoryRows(student.rollNo);
                const pct = getAttendancePercent(student.rollNo);
                return (
                  <div className="history-breakdown" style={{marginBottom:16,borderTop:'1px solid var(--border)',paddingTop:10}}>
                    <div className="result-row">
                      <span className="result-row-subject"><strong>{student.name}</strong> · {student.rollNo}</span>
                      <span className="result-row-marks">{pct!=null ? pct+'% attendance' : 'No data yet'}</span>
                    </div>
                    {rows.length===0 && <div className="empty-state">No absences recorded for this student.</div>}
                    {rows.map(function(r){
                      return (
                        <div key={r.date} className="result-row">
                          <span className="result-row-subject">{formatNiceDate(r.date)}</span>
                          <span className={"result-row-marks"+(r.isFullDay?' low':'')}>
                            {r.isFullDay ? 'Full Day Absent' : 'Absent — Hour '+r.hoursAbsent.join(', ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <p className="helper-text" style={{marginTop:0}}>Each entry below groups every hour saved for that date. Tap a date to see the hour-by-hour absentee breakdown.</p>
              <div className="manage-list">
                {groupedHistory.length===0 && <div className="empty-state">No saved reports yet — send an Attendance Report via WhatsApp to create one.</div>}
                {groupedHistory.map(function(dateEntry){
                  const isOpen = expandedHistoryDate === dateEntry.date;
                  const hoursWithAbsentees = dateEntry.rows.filter(function(row){ return (row.absent_rolls||[]).length > 0; }).length;
                  const hourWiseBreakdown = isOpen ? getDateHourWiseBreakdown(dateEntry.rows) : [];
                  const allRolls = new Set();
                  dateEntry.rows.forEach(function(row){ (row.absent_rolls||[]).forEach(function(r){ allRolls.add(r); }); });
                  const absentCount = allRolls.size;
                  const presentCount = dateEntry.total_active!=null ? Math.max(dateEntry.total_active-absentCount,0) : null;

                  return (
                    <div key={dateEntry.date} className="history-row">
                      <div className="history-row-top" style={{cursor:'pointer'}} onClick={function(){ toggleHistoryExpand(dateEntry.date); }}>
                        <div>
                          <div className="history-row-title">{formatNiceDate(dateEntry.date)}</div>
                          <div className="history-row-meta">{dateEntry.class_name||'—'} · {hoursWithAbsentees} of {dateEntry.rows.length} hour(s) with absentees</div>
                        </div>
                        <span className="link-btn">{isOpen ? 'Hide' : 'View breakdown'}</span>
                      </div>
                      <div className="history-row-stats">
                        <span><b>{dateEntry.total_active!=null?dateEntry.total_active:'—'}</b> strength</span>
                        <span><b>{absentCount}</b> absent</span>
                        <span><b>{presentCount!=null?presentCount:'—'}</b> present</span>
                      </div>
                      {isOpen && (
                        <div className="history-breakdown" style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:12}}>
                          <div style={{display:'grid',gap:10}}>
                            {hourWiseBreakdown.map(function(hb){
                              const hourLabel = 'Hour '+hb.hour + (hb.subject ? ' — '+hb.subject : '');
                              const absentLabel = hb.absentees.length===0 ? 'No absentees recorded' : hb.absentees.length+' absentee'+(hb.absentees.length===1 ? '' : 's');
                              return (
                                <div key={hb.hour} style={{border:'1px solid var(--border)',borderRadius:12,background:'#f8fafc',padding:12}}>
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:8}}>
                                    <div>
                                      <div style={{fontWeight:800,color:'#1e3a8a',marginBottom:4}}>{hourLabel}</div>
                                      <div style={{fontSize:12,color:'#64748b'}}>{hb.hasData ? absentLabel : 'Hour '+hb.hour+' — Not recorded'}</div>
                                    </div>
                                    {hb.hasData && (
                                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                        <button type="button" onClick={function(e){ e.stopPropagation(); handleCopyHistoryMessage(buildHistoryMessage(dateEntry)); }}>Copy Message</button>
                                        <button type="button" className="danger" onClick={function(e){ e.stopPropagation(); handleDeleteHistoryEntry(dateEntry.date); }}>Delete</button>
                                        <button type="button" onClick={function(e){ e.stopPropagation(); handleExportPdf(); }}>Export PDF</button>
                                      </div>
                                    )}
                                  </div>

                                  {hb.hasData ? (
                                    hb.absentees.length===0 ? (
                                      <div className="empty-state" style={{margin:0,padding:0,border:'none',background:'transparent'}}>
                                        No absentees recorded for this hour.
                                      </div>
                                    ) : (
                                      <div style={{display:'grid',gap:6}}>
                                        {hb.absentees.map(function(a){
                                          return (
                                            <div key={a.rollNo} className="result-row" style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:'8px 10px'}}>
                                              <span className="result-row-subject">{a.rollNo} - {a.name}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )
                                  ) : (
                                    <div style={{display:'inline-flex',alignItems:'center',padding:'4px 10px',borderRadius:999,background:'#e2e8f0',color:'#64748b',fontSize:12,fontWeight:700}}>
                                      Hour {hb.hour} — Not recorded
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="history-actions">
                        <button type="button" onClick={function(e){ e.stopPropagation(); handleCopyHistoryMessage(buildHistoryMessage(dateEntry)); }}>Copy Message</button>
                        <button type="button" className="danger" onClick={function(e){ e.stopPropagation(); handleDeleteHistoryEntry(dateEntry.date); }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <button type="button" className="btn btn-secondary" onClick={goLanding}>Logout / Back to Home</button>
            <p className="app-footer">App Created by: <strong>GODSON S</strong></p>
          </section>
        )}
      </main>

      {/* ===== EDIT STUDENT MODAL ===== */}
      <div className={"modal-overlay"+(editModalOpen?' open':'')} role="dialog" aria-modal="true" onClick={function(e){ if(e.target===e.currentTarget) closeEditModal(); }}>
        <div className="modal-sheet">
          <div className="modal-header">
            <h2 className="modal-title">Edit Student</h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={closeEditModal}>&#x2715;</button>
          </div>
          <div className="modal-grid">
            <div className="modal-field" style={{gridColumn:'1/-1'}}>
              <label>Full Name</label>
              <input type="text" placeholder="e.g. FIRST LAST" autoComplete="off" className={shakeCls('editName')}
                value={editForm.name} onChange={function(e){ setEditForm(function(f){ return { ...f, name:e.target.value }; }); }} />
            </div>
            <div className="modal-field">
              <label>Roll Number</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" className={shakeCls('editRollNo')}
                value={editForm.rollNo} onChange={function(e){ setEditForm(function(f){ return { ...f, rollNo:e.target.value }; }); }} />
            </div>
            <div className="modal-field">
              <label>Date of Birth (DD-MM-YYYY)</label>
              <input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" className={shakeCls('editDob')}
                value={editForm.dob} onChange={function(e){ setEditForm(function(f){ return { ...f, dob:maskDobValue(e.target.value) }; }); }} />
            </div>
            <div className="modal-field">
              <label>Student Mobile</label>
              <input type="text" inputMode="numeric" placeholder="10-digit number" autoComplete="off"
                value={editForm.studentMob} onChange={function(e){ setEditForm(function(f){ return { ...f, studentMob:e.target.value }; }); }} />
            </div>
            <div className="modal-field">
              <label>Father Mobile</label>
              <input type="text" inputMode="numeric" placeholder="10-digit number" autoComplete="off"
                value={editForm.fatherMob} onChange={function(e){ setEditForm(function(f){ return { ...f, fatherMob:e.target.value }; }); }} />
            </div>
            <div className="modal-field">
              <label>College Email ID</label>
              <input type="text" inputMode="email" placeholder="e.g. ca255113XXX@bhc.edu.in" autoComplete="off"
                value={editForm.collegeID} onChange={function(e){ setEditForm(function(f){ return { ...f, collegeID:e.target.value }; }); }} />
            </div>
            <div className="modal-field">
              <label>Part One Language</label>
              <select value={editForm.partOne} onChange={function(e){ setEditForm(function(f){ return { ...f, partOne:e.target.value }; }); }}>
                {PART_ONE_OPTIONS.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-cancel-btn" onClick={closeEditModal}>Cancel</button>
            <button type="button" className="modal-save-btn" onClick={saveEditModal}>Save Changes</button>
          </div>
        </div>
      </div>

      <div className={"toast"+(toast.show?' show':'')+(toast.error?' error':'')}>
        <span className="tdot"></span><span>{toast.msg}</span>
      </div>
    </div>
  );
}

/* =========================================================
   Sub-components
   ========================================================= */
function StatBox(props){
  return (
    <div className={"stat-box"+(props.cls?' '+props.cls:'')}>
      <div className="stat-num">{props.value}</div>
      <div className="stat-label">{props.label}</div>
    </div>
  );
}

function DetailItem(props){
  return (
    <div className="src-detail-item">
      <div className="src-detail-label">{props.label}</div>
      <div className="src-detail-value">
        {props.value
          ? (props.tel ? <a href={'tel:'+props.value}>{props.value}</a>
             : props.mail ? <a href={'mailto:'+props.value}>{props.value}</a>
             : props.value)
          : <span className="src-detail-empty">—</span>}
      </div>
    </div>
  );
}

function RemoveBtn(props){
  return (
    <button type="button" aria-label={props.label} onClick={props.onClick}
      style={{width:20,height:20,borderRadius:'50%',border:'none',flex:'0 0 auto',background:'rgba(255,255,255,0.08)',color:'var(--text-dim)',cursor:'pointer',fontSize:13,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
      &#215;
    </button>
  );
}

function TimetableWidget(props){
  const { timetable, currentDayOrder, onChangeDayOrder, editable, subjects, onSaveSlot } = props;
  const [showAllDays, setShowAllDays] = useState(false);
  function slotValue(dayOrder, hour){ return timetable[dayOrder+'-'+hour] || ''; }
  return (
    <section className="card timetable-card">
      {!editable && (
        <div className="timetable-section" aria-label="Compact timetable view">
          <div className="timetable-top">
            <h3>TIMETABLE</h3>
            <span className="day-badge">Day Order {currentDayOrder}</span>
          </div>
          <div className="timetable-grid">
            {HOURS.map(function(hour){
              return (
                <div key={hour} className="hour-box">
                  <div className="hour-label">HOUR {hour}</div>
                  <div className="hour-content">{slotValue(currentDayOrder, hour) || '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {editable && (
        <>
          <div className="form-row" style={{marginBottom:12}}>
            <div className="field">
              <label>Today's Day Order</label>
              <select className="timetable-dayorder-select" value={currentDayOrder} onChange={function(e){ onChangeDayOrder(parseInt(e.target.value,10)); }}>
                {DAY_ORDERS.map(function(d){ return <option key={d} value={d}>Day Order {d}</option>; })}
              </select>
            </div>
          </div>
          <button type="button" className="link-btn" onClick={function(){ setShowAllDays(function(v){ return !v; }); }}>
            {showAllDays ? 'Hide day-wise editor' : 'Edit all 6 day orders'}
          </button>
          {showAllDays && (
            <div className="timetable-admin-grid">
              {DAY_ORDERS.map(function(d){
                return (
                  <div key={d} className="timetable-admin-day">
                    <div className="timetable-admin-day-title">Day Order {d}</div>
                    {HOURS.map(function(h){
                      return (
                        <div key={h} className="timetable-admin-hour-row">
                          <label>Hour {h}</label>
                          <select value={slotValue(d,h)} onChange={function(e){ onSaveSlot(d, h, e.target.value); }}>
                            <option value="">— Free —</option>
                            {(subjects||[]).map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}