// File: src/App.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from './services/supabaseClient';
import './global.css';

import {
  XX_IDS, LS_CLASS, LS_USER, DEFAULT_CLASS, DEFAULT_SUBJECTS, APP_MODULES,
  DEFAULT_STUDENT_PERMISSIONS, HOURS, STUDY_TABLE, STUDY_BUCKET
} from './utils/constants';
import {
  safeParse, todayISO, formatNiceDate, isValidDobFormat, escapeCsv,
  storagePathFromUrl, numericRollCompare, getDseForSlot, normalizeRollNo,
  credentialsMatch, groupHistoryByDate
} from './utils/helpers';
import {
  openPrintWindow, buildHistoryPdfHtml, buildStudentAttendancePdfHtml,
  buildHourPdfHtml, buildMasterPdfHtml, buildAbsenteesPdfHtml
} from './utils/pdfExports';

import LoginScreen from './components/common/LoginScreen.jsx';
import EditStudentModal from './components/modals/EditStudentModal.jsx';
import AboutModal from './components/modals/AboutModal.jsx';

import Home from './pages/Home/Home.jsx';
import Attendance from './pages/Attendance/Attendance.jsx';
import Database from './pages/Database/Database.jsx';
import StudyMaterials from './pages/StudyMaterials/StudyMaterials.jsx';
import SemesterResults from './pages/SemesterResults/SemesterResults.jsx';
import AdminSettings from './pages/AdminSettings/AdminSettings.jsx';
import MyAttendance from './pages/MyAttendance/MyAttendance.jsx';
import DailyLogin from './pages/Auth/DailyLogin';
import DatabaseLogin from './pages/Auth/DatabaseLogin';
import StudyRoleSelect from './pages/Auth/StudyRoleSelect';
import SemesterRoleSelect from './pages/Auth/SemesterRoleSelect';
import StudyLogin from './pages/Auth/StudyLogin';
import SemesterLogin from './pages/Auth/SemesterLogin';
import AdminLogin from './pages/Auth/AdminLogin';

export default function App(){
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(function(){
    try{
      const raw = localStorage.getItem(LS_USER);
      if(raw){
        const parsed = safeParse(raw, null);
        if(parsed && parsed.rollNo && parsed.role){
          setCurrentUser(parsed);
        }
      }
    }catch(e){ console.error(e); }
    setAuthChecked(true);
  }, []);

  function handleLogout(){
    try{ localStorage.removeItem(LS_USER); }catch(e){ console.error(e); }
    setCurrentUser(null);
    goLanding();
  }

  /* ---------- navigation ---------- */
  const [view, setView] = useState('landing');
  const databaseRollInputRef = useRef(null);
  const [loginScreenRoll, setLoginScreenRoll] = useState('');
  const [loginScreenDob, setLoginScreenDob] = useState('');
  const [loginScreenBusy, setLoginScreenBusy] = useState(false);
  const [loginScreenError, setLoginScreenError] = useState('');

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
  useEffect(function(){
    if(view==='myAttendance' && history.length===0){
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /* ---------- toast ---------- */
  const [toast, setToast] = useState({ show:false, msg:'', error:false });
  const [aboutOpen, setAboutOpen] = useState(false);
  const toastTimer = useRef(null);
  function showToast(msg, isError){
    setToast({ show:true, msg, error: !!isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function(){ setToast(function(t){ return { ...t, show:false }; }); }, 2400);
  }

  /* ---------- student permissions (feature flags) ---------- */
  const [studentPermissions, setStudentPermissions] = useState(DEFAULT_STUDENT_PERMISSIONS);
  const fetchStudentPermissions = useCallback(async function(){
    try{
      const { data, error } = await supabase.from('app_settings').select('value').eq('key','student_permissions').maybeSingle();
      if(error){ console.error(error); return; }
      if(data && data.value){
        const parsed = safeParse(data.value, null);
        if(parsed) setStudentPermissions(function(sp){ return { ...DEFAULT_STUDENT_PERMISSIONS, ...sp, ...parsed }; });
      }
    }catch(e){ console.error(e); }
  }, []);

  async function updateStudentPermission(moduleId, value){
    const next = { ...studentPermissions, [moduleId]: value };
    setStudentPermissions(next);
    try{
      const { error } = await supabase.from('app_settings').upsert(
        { key:'student_permissions', value: JSON.stringify(next) },
        { onConflict:'key' }
      );
      if(error){ showToast('Could not save permission change', true); await fetchStudentPermissions(); return; }
      showToast((value ? 'Enabled: ' : 'Disabled: ')+(APP_MODULES.find(function(m){ return m.id===moduleId; })||{}).name);
    }catch(e){ console.error(e); showToast('Could not save permission change', true); await fetchStudentPermissions(); }
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

  /* ================= ADMIN SETTINGS ================= */
  const [activeAdminTab, setActiveAdminTab] = useState(null);
  function toggleAdminTab(tabId){
    setActiveAdminTab(function(cur){ return cur === tabId ? null : tabId; });
  }

  /* ---------- student db (live from Supabase 'students' table) ---------- */
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

  async function attemptUnifiedLogin(){
    const rollNo = loginScreenRoll.trim();
    const dob = loginScreenDob.trim();
    setLoginScreenError('');

    if(!rollNo){ setLoginScreenError('Enter your Roll Number'); return; }
    if(!isValidDobFormat(dob)){ setLoginScreenError('DOB must be DD-MM-YYYY'); return; }

    setLoginScreenBusy(true);
    try{
      // 1. Check admins table first
      const isAdmin = await verifyAdmin(rollNo, dob);
      if(isAdmin){
        const user = { rollNo, role:'admin', name:'Admin' };
        localStorage.setItem(LS_USER, JSON.stringify(user));
        setCurrentUser(user);

        await fetchStudents();
        await fetchSubjects();
        await fetchAdmins();
        await fetchHistory();
        await fetchTimetable();
        await fetchCurrentDayOrder();

        setLoginScreenBusy(false);
        return;
      }
      // 2. Fall back to student lookup
      if(studentDb.length===0){ await fetchStudents(); }
      const student = findStudentByCredentials(rollNo, dob);
      if(student){
        const user = { rollNo: student.rollNo, role:'student', name: student.name };
        localStorage.setItem(LS_USER, JSON.stringify(user));
        setCurrentUser(user);
        await fetchHistory();
        setLoginScreenBusy(false);
        return;
      }
      setLoginScreenError('Invalid Roll Number or Date of Birth');
    }catch(e){
      console.error(e);
      setLoginScreenError('Login failed — please try again');
    }
    setLoginScreenBusy(false);
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

  function getHourDisplayInfo(dayOrder, hour, recordedSubjectName){
    const dse = getDseForSlot(dayOrder, hour);
    if(dse) return { label: dse, isDse: true };
    const recorded = (recordedSubjectName || '').trim();
    if(recorded) return { label: recorded, isDse: false };
    const scheduled = (timetable[dayOrder+'-'+hour] || '').trim();
    if(scheduled) return { label: scheduled, isDse: false };
    return { label: '—', isDse: false };
  }

  /* Per-date, per-hour breakdown for one student (DSE + timetable fallback logic). */
  function getStudentDatewiseHourBreakdown(rollNo){
    const rollQ = normalizeRollNo(rollNo);
    if(!rollQ) return [];
    const grouped = groupHistoryByDate(history);
    const withCells = grouped.map(function(dateEntry){
      const dayOrder = (dateEntry.rows[0] && dateEntry.rows[0].day_order) || currentDayOrder;
      const hourCells = HOURS.map(function(h){
        const row = dateEntry.rows.find(function(r){ return r.hour === h; });
        const info = getHourDisplayInfo(dayOrder, h, row ? row.subject_name : '');
        if(info.isDse) return { hour: h, status: 'dse' };
        if(!row) return { hour: h, status: 'blank' };
        const isAbsent = (row.absent_rolls||[]).some(function(r){ return normalizeRollNo(r)===rollQ; });
        return { hour: h, status: isAbsent ? 'absent' : 'present' };
      });
      return { date: dateEntry.date, dayOrder: dayOrder, hourCells: hourCells };
    });
    return withCells.filter(function(entry){
      return entry.hourCells.some(function(c){ return c.status === 'absent'; });
    });
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
  const [expandedHistoryHours, setExpandedHistoryHours] = useState({});
  function toggleHistoryHourExpand(key){
    setExpandedHistoryHours(function(s){ return { ...s, [key]: !s[key] }; });
  }

  const groupedHistory = useMemo(function(){ return groupHistoryByDate(history); }, [history]);

  /* ---------- student-specific attendance history search (Admin Dashboard) ---------- */
  const [historySearchRoll, setHistorySearchRoll] = useState('');

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

  function buildHourHistoryMessage(entry, hour){
    const niceDate = formatNiceDate(entry.date);
    const hourRow = entry.rows.find(function(r){ return r.hour === hour; });
    const absentees = hourRow ? (hourRow.absent_rolls || []).slice() : [];
    const lines = [];
    lines.push('Class: '+(entry.class_name||className));
    lines.push('----------------------------------------');
    lines.push('📅 Date: '+niceDate);
    lines.push('🕒 Hour '+hour+(hourRow && hourRow.subject_name ? ' — '+hourRow.subject_name : ''));
    lines.push('----------------------------------------');
    if(!hourRow || absentees.length===0){
      lines.push('✅ No absentees recorded for this hour.');
    } else {
      lines.push('Absent Students List:');
      absentees.forEach(function(rollNo, idx){
        const student = studentDb.find(function(s){ return s.rollNo === rollNo; });
        lines.push(String(idx+1).padStart(2,'0')+'. '+rollNo+' - '+(student ? student.name : rollNo));
      });
    }
    lines.push('----------------------------------------');
    return lines.join('\n');
  }

  /* Every saved row counts as one conducted hour. */
  function getAttendancePercent(rollNo){
    if(history.length===0) return null;
    const rollQ = normalizeRollNo(rollNo);
    if(!rollQ) return null;
    let conducted=0, present=0;
    history.forEach(function(row){
      conducted += 1;
      const rolls = row.absent_rolls || [];
      const isAbsent = rolls.some(function(r){ return normalizeRollNo(r)===rollQ; });
      if(!isAbsent) present += 1;
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
    fetchSubjects(); fetchAdmins(); fetchTimetable(); fetchCurrentDayOrder(); fetchStudents(); fetchStudentPermissions();
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
    setSemesterResults([]); setSemesterList([]); setSelectedSemester(null);
    setView('landing');
    window.scrollTo(0,0);
  }
  function navTo(v){ setView(v); window.scrollTo(0,0); }

  function handleModuleClick(moduleId){
    const isAdmin = currentUser.role==='admin';
    switch(moduleId){
      case 'attendanceReport':
        setDailyAuthenticated(true); setCurrentAdminRollNo(currentUser.rollNo); fetchSubjects(); navTo('daily');
        break;
      case 'studentDb':
        navTo('database');
        break;
      case 'adminSettings':
        navTo('adminDashboard');
        break;
      case 'studyMaterials':
        setCurrentStudyRollNo(currentUser.rollNo); setCurrentStudyIsAdmin(isAdmin);
        refreshStudyView().then(function(){ navTo('studyDashboard'); });
        break;
      case 'semesterResults':
        setCurrentStudyRollNo(currentUser.rollNo); setCurrentStudyIsAdmin(isAdmin);
        fetchSemesterResults(currentUser.rollNo).then(function(){ navTo('semesterResults'); });
        break;
      case 'myAttendance':
        Promise.all([fetchHistory(), studentDb.length===0 ? fetchStudents() : Promise.resolve()])
          .then(function(){ navTo('myAttendance'); });
        break;
      default:
        break;
    }
  }

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

  /* Upserts one row per (date, hour). Requires a unique constraint on (date, hour):
       alter table attendance_history add constraint attendance_history_date_hour_key unique (date, hour); */
  async function saveAttendanceToHistory(){
    const hour = parseInt(hourVal, 10);
    const absentRolls = summary.absentList.map(function(s){ return s.rollNo; });

    const record = {
      date: dateVal,
      hour: hour,
      day_order: currentDayOrder,
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

      await fetchHistory();
      return true;
    }catch(e){
      console.error(e);
      showToast('Could not save to history', true);
      return false;
    }
  }

  /* WhatsApp only opens if the Supabase save succeeds. */
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

  const [activeStudyTab, setActiveStudyTab] = useState(null);
  function toggleStudyTab(tabId){
    setActiveStudyTab(function(cur){ return cur === tabId ? null : tabId; });
  }

  const [expandedRepoSubject, setExpandedRepoSubject] = useState(null);
  function toggleRepoSubject(name){
    setExpandedRepoSubject(function(cur){ return cur === name ? null : name; });
  }

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

  /* ---- PDF exports (HTML builders live in utils/pdfExports.js) ---- */
  function handleExportPdf(){
    if(history.length===0){ showToast('No history to export', true); return; }
    const printHtml = buildHistoryPdfHtml({ history, className, getDateAbsenteeBreakdown });
    if(openPrintWindow(printHtml, showToast)){
      showToast('Opening print dialog — choose "Save as PDF"');
    }
  }

  /* Individual attendance PDF for a single student. */
  function exportStudentAttendancePdf(rollNoInput){
    const safeRoll = String(rollNoInput==null?'':rollNoInput).trim();
    if(!safeRoll){ showToast('No Roll Number available to export', true); return; }
    const student = studentDb.find(function(s){ return normalizeRollNo(s.rollNo)===normalizeRollNo(safeRoll); });
    if(!student){ showToast('No student found with that Roll Number', true); return; }

    const breakdown = getStudentDatewiseHourBreakdown(student.rollNo);
    const pct = getAttendancePercent(student.rollNo);
    const printHtml = buildStudentAttendancePdfHtml({ student, breakdown, pct, className });

    if(openPrintWindow(printHtml, showToast)){
      showToast('Opening print dialog — choose "Save as PDF"');
    }
  }

  function handleExportHourPdf(entry, hour){
    const hourRow = entry.rows.find(function(r){ return r.hour === hour; });
    if(!hourRow){ showToast('No data recorded for this hour', true); return; }
    const printHtml = buildHourPdfHtml({ entry, hour, hourRow, studentDb, className });
    if(openPrintWindow(printHtml, showToast)){
      showToast('Opening print dialog — choose "Save as PDF"');
    }
  }

  function handleExportPdfForDate(entry){
    const printHtml = buildMasterPdfHtml({ entry, studentDb, leftIds, currentDayOrder, className, getHourDisplayInfo });
    if(openPrintWindow(printHtml, showToast)){
      showToast('Opening print dialog for Full Day Report — choose "Save as PDF"');
    }
  }

  function handleExportAbsenteesPdfForDate(entry){
    const printHtml = buildAbsenteesPdfHtml({ entry, studentDb, leftIds, currentDayOrder, className, getHourDisplayInfo });
    if(openPrintWindow(printHtml, showToast)){
      showToast('Opening print dialog for Absentees Report — choose "Save as PDF"');
    }
  }

  function handleExportStudentPdf(){
    const rollQ = historySearchRoll.trim();
    if(!rollQ){ triggerShake('historySearchRoll'); showToast('Enter a Roll Number to export', true); return; }
    exportStudentAttendancePdf(rollQ);
  }

  function handleStudentSelfPdfDownload(){
    const safeRoll = String(currentUser.rollNo).trim();
    exportStudentAttendancePdf(safeRoll);
  }

  /* Deletes every hour-row saved for a given date. */
  async function handleDeleteHistoryEntry(date){
    try{
      const { error } = await supabase.from('attendance_history').delete().eq('date', date);
      if(error){ showToast('Could not delete report', true); return; }
      showToast('Report deleted'); await fetchHistory();
    }catch(e){ showToast('Could not delete report', true); }
  }

  /* Deletes only one hour-row for a given date. */
  async function handleDeleteHistoryHourEntry(dateStr, hour){
    try{
      const { error } = await supabase
        .from('attendance_history')
        .delete()
        .eq('date', dateStr)
        .eq('hour', hour);

      if(error){ showToast('Could not delete hour record', true); return; }
      showToast('Hour record deleted');
      await fetchHistory();
    }catch(e){ showToast('Could not delete hour record', true); }
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

  if(!authChecked){
    return null;
  }
  if(!currentUser){
    return (
      <LoginScreen
        busy={loginScreenBusy}
        dob={loginScreenDob}
        error={loginScreenError}
        onDobChange={setLoginScreenDob}
        onRollChange={setLoginScreenRoll}
        onSubmit={attemptUnifiedLogin}
        roll={loginScreenRoll}
        sectionLabel={className}
      />
    );
  }

  return (
    <div className="app">
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
          <div className="status-pill"><span className="status-dot"></span><span>{className}</span></div>
          <button type="button" className="header-back" aria-label="About" onClick={function(){ setAboutOpen(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </button>
        </div>
      </header>

      <main>
        {view==='landing' && (
          <Home
            currentUser={currentUser}
            timetable={timetable}
            currentDayOrder={currentDayOrder}
            setCurrentDayOrder={setCurrentDayOrder}
            studentPermissions={studentPermissions}
            onModuleClick={handleModuleClick}
            onLogout={handleLogout}
          />
        )}

        {view==='dailyLogin' && (
          <DailyLogin
            shakeCls={shakeCls}
            dailyLoginRoll={dailyLoginRoll} setDailyLoginRoll={setDailyLoginRoll}
            dailyLoginDob={dailyLoginDob} setDailyLoginDob={setDailyLoginDob}
            dailyLoginBusy={dailyLoginBusy}
            attemptDailyLogin={attemptDailyLogin}
          />
        )}

        {view==='databaseLogin' && (
          <DatabaseLogin
            shakeCls={shakeCls}
            dbLoginRoll={dbLoginRoll} setDbLoginRoll={setDbLoginRoll}
            dbLoginDob={dbLoginDob} setDbLoginDob={setDbLoginDob}
            dbLoginBusy={dbLoginBusy}
            attemptDbLogin={attemptDbLogin}
          />
        )}

        {view==='studyRoleSelect' && (
          <StudyRoleSelect goStudyLogin={goStudyLogin} />
        )}

        {view==='semesterRoleSelect' && (
          <SemesterRoleSelect goSemesterLogin={goSemesterLogin} />
        )}

        {view==='studyLogin' && (
          <StudyLogin
            shakeCls={shakeCls}
            studyLoginMode={studyLoginMode}
            studyLoginRoll={studyLoginRoll} setStudyLoginRoll={setStudyLoginRoll}
            studyLoginDob={studyLoginDob} setStudyLoginDob={setStudyLoginDob}
            studyLoginBusy={studyLoginBusy}
            attemptStudyLogin={attemptStudyLogin}
          />
        )}

        {view==='semesterLogin' && (
          <SemesterLogin
            shakeCls={shakeCls}
            studyLoginMode={studyLoginMode}
            studyLoginRoll={studyLoginRoll} setStudyLoginRoll={setStudyLoginRoll}
            studyLoginDob={studyLoginDob} setStudyLoginDob={setStudyLoginDob}
            studyLoginBusy={studyLoginBusy}
            attemptSemesterLogin={attemptSemesterLogin}
          />
        )}

        {view==='adminLogin' && (
          <AdminLogin
            shakeCls={shakeCls}
            loginRoll={loginRoll} setLoginRoll={setLoginRoll}
            loginDob={loginDob} setLoginDob={setLoginDob}
            loginBusy={loginBusy}
            attemptAdminLogin={attemptAdminLogin}
          />
        )}

        {view==='daily' && (
          <Attendance
            dateVal={dateVal} setDateVal={setDateVal}
            hourVal={hourVal} setHourVal={setHourVal}
            subjectVal={subjectVal} setSubjectVal={setSubjectVal}
            subjects={subjects}
            shakeCls={shakeCls}
            resetGrid={resetGrid}
            gridStudents={gridStudents}
            leftIds={leftIds}
            rollState={rollState}
            cycleRollState={cycleRollState}
            summary={summary}
            buildRawMessage={buildRawMessage}
            sendBusy={sendBusy}
            handleSend={handleSend}
            handleCopy={handleCopy}
          />
        )}

        {view==='database' && (
          <Database
            databaseRollInputRef={databaseRollInputRef}
            searchRoll={searchRoll} setSearchRoll={setSearchRoll}
            searchMobile={searchMobile} setSearchMobile={setSearchMobile}
            searchResults={searchResults}
            leftIds={leftIds}
            getAttendancePercent={getAttendancePercent}
            openEditModal={openEditModal}
          />
        )}

        {view==='semesterResults' && (
          <SemesterResults
            currentStudyIsAdmin={currentStudyIsAdmin}
            currentStudyRollNo={currentStudyRollNo}
            shakeCls={shakeCls}
            semAddRoll={semAddRoll} setSemAddRoll={setSemAddRoll}
            semAddSemester={semAddSemester} setSemAddSemester={setSemAddSemester}
            semAddSubject={semAddSubject} setSemAddSubject={setSemAddSubject}
            semAddMarks={semAddMarks} setSemAddMarks={setSemAddMarks}
            semAddMaxMarks={semAddMaxMarks} setSemAddMaxMarks={setSemAddMaxMarks}
            semAddBusy={semAddBusy}
            handleAdminAddMarks={handleAdminAddMarks}
            semBrowseRoll={semBrowseRoll} setSemBrowseRoll={setSemBrowseRoll}
            handleAdminBrowseResults={handleAdminBrowseResults}
            semesterList={semesterList}
            selectedSemester={selectedSemester} setSelectedSemester={setSelectedSemester}
            semesterPercent={semesterPercent}
            semesterRows={semesterRows}
            handleDeleteResultRow={handleDeleteResultRow}
            goLanding={goLanding}
          />
        )}

        {view==='studyDashboard' && (
          <StudyMaterials
            currentStudyIsAdmin={currentStudyIsAdmin}
            currentStudyRollNo={currentStudyRollNo}
            shakeCls={shakeCls}
            activeStudyTab={activeStudyTab}
            toggleStudyTab={toggleStudyTab}
            subjects={subjects}
            subjectIdMap={subjectIdMap}
            studyNewSubject={studyNewSubject} setStudyNewSubject={setStudyNewSubject}
            handleAddStudySubject={handleAddStudySubject}
            handleDeleteStudySubject={handleDeleteStudySubject}
            studyMaterialSubject={studyMaterialSubject} setStudyMaterialSubject={setStudyMaterialSubject}
            studyMaterialTitle={studyMaterialTitle} setStudyMaterialTitle={setStudyMaterialTitle}
            setStudyMaterialFile={setStudyMaterialFile}
            studyUploading={studyUploading}
            handleUploadMaterial={handleUploadMaterial}
            studyCache={studyCache}
            expandedRepoSubject={expandedRepoSubject}
            toggleRepoSubject={toggleRepoSubject}
            handleDeleteMaterial={handleDeleteMaterial}
            goLanding={goLanding}
          />
        )}

        {view==='myAttendance' && (
          <MyAttendance
            currentUser={currentUser}
            getStudentHistoryRows={getStudentHistoryRows}
            getAttendancePercent={getAttendancePercent}
            handleStudentSelfPdfDownload={handleStudentSelfPdfDownload}
            goLanding={goLanding}
          />
        )}

        {view==='adminDashboard' && (
          <AdminSettings
            currentAdminRollNo={currentAdminRollNo}
            shakeCls={shakeCls}
            goLanding={goLanding}
            activeAdminTab={activeAdminTab}
            toggleAdminTab={toggleAdminTab}
            className={className}
            classNameInput={classNameInput} setClassNameInput={setClassNameInput}
            saveClassNameHandler={saveClassNameHandler}
            timetable={timetable}
            currentDayOrder={currentDayOrder}
            saveCurrentDayOrder={saveCurrentDayOrder}
            saveTimetableSlot={saveTimetableSlot}
            subjects={subjects}
            deleteSubject={deleteSubject}
            newSubjectInput={newSubjectInput} setNewSubjectInput={setNewSubjectInput}
            handleAddSubjectAdmin={handleAddSubjectAdmin}
            studentSearchQuery={studentSearchQuery} setStudentSearchQuery={setStudentSearchQuery}
            filteredStudents={filteredStudents}
            leftIds={leftIds}
            toggleStudentLeft={toggleStudentLeft}
            admins={admins}
            newAdminRoll={newAdminRoll} setNewAdminRoll={setNewAdminRoll}
            newAdminDob={newAdminDob} setNewAdminDob={setNewAdminDob}
            handleAddAdmin={handleAddAdmin}
            handleDeleteAdmin={handleDeleteAdmin}
            studentPermissions={studentPermissions}
            updateStudentPermission={updateStudentPermission}
            studentDb={studentDb}
            historySearchRoll={historySearchRoll} setHistorySearchRoll={setHistorySearchRoll}
            getStudentHistoryRows={getStudentHistoryRows}
            getAttendancePercent={getAttendancePercent}
            groupedHistory={groupedHistory}
            expandedHistoryDate={expandedHistoryDate}
            toggleHistoryExpand={toggleHistoryExpand}
            expandedHistoryHours={expandedHistoryHours}
            toggleHistoryHourExpand={toggleHistoryHourExpand}
            getDateHourWiseBreakdown={getDateHourWiseBreakdown}
            buildHistoryMessage={buildHistoryMessage}
            buildHourHistoryMessage={buildHourHistoryMessage}
            handleCopyHistoryMessage={handleCopyHistoryMessage}
            handleDeleteHistoryEntry={handleDeleteHistoryEntry}
            handleDeleteHistoryHourEntry={handleDeleteHistoryHourEntry}
            handleExportPdf={handleExportPdf}
            handleExportStudentPdf={handleExportStudentPdf}
            handleExportHourPdf={handleExportHourPdf}
            handleExportPdfForDate={handleExportPdfForDate}
            handleExportAbsenteesPdfForDate={handleExportAbsenteesPdfForDate}
          />
        )}
      </main>

      <EditStudentModal
        open={editModalOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        shakeCls={shakeCls}
        onClose={closeEditModal}
        onSave={saveEditModal}
      />

      <AboutModal open={aboutOpen} onClose={function(){ setAboutOpen(false); }} />

      <div className={"toast"+(toast.show?' show':'')+(toast.error?' error':'')}>
        <span className="tdot"></span><span>{toast.msg}</span>
      </div>
    </div>
  );
}