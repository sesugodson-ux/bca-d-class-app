// File: src/pages/AdminSettings/AdminSettings.jsx
import React from 'react';
import AdminAccordionSection from '../../components/common/AdminAccordionSection';
import RemoveBtn from '../../components/common/RemoveBtn';
import ToggleSwitch from '../../components/common/ToggleSwitch';
import TimetableWidget from '../../components/Timetable/TimetableWidget';
import { APP_MODULES } from '../../utils/constants';
import { formatNiceDate, normalizeRollNo, maskDobValue } from '../../utils/helpers';
import './AdminSettings.css';

export default function AdminSettings({
  currentAdminRollNo,
  shakeCls,
  goLanding,
  activeAdminTab,
  toggleAdminTab,
  className,
  classNameInput, setClassNameInput,
  saveClassNameHandler,
  timetable,
  currentDayOrder,
  saveCurrentDayOrder,
  saveTimetableSlot,
  subjects,
  deleteSubject,
  newSubjectInput, setNewSubjectInput,
  handleAddSubjectAdmin,
  studentSearchQuery, setStudentSearchQuery,
  filteredStudents,
  leftIds,
  toggleStudentLeft,
  admins,
  newAdminRoll, setNewAdminRoll,
  newAdminDob, setNewAdminDob,
  handleAddAdmin,
  handleDeleteAdmin,
  studentPermissions,
  updateStudentPermission,
  studentDb,
  historySearchRoll, setHistorySearchRoll,
  getStudentHistoryRows,
  getAttendancePercent,
  groupedHistory,
  expandedHistoryDate,
  toggleHistoryExpand,
  expandedHistoryHours,
  toggleHistoryHourExpand,
  getDateHourWiseBreakdown,
  buildHistoryMessage,
  buildHourHistoryMessage,
  handleCopyHistoryMessage,
  handleDeleteHistoryEntry,
  handleDeleteHistoryHourEntry,
  handleExportPdf,
  handleExportStudentPdf,
  handleExportHourPdf,
  handleExportPdfForDate,
  handleExportAbsenteesPdfForDate
}){
  return (
    <section className="view active">
      <div className="landing-intro">
        <p className="landing-eyebrow">Logged in as Roll No {currentAdminRollNo}</p>
        <h2 className="landing-heading">Admin Dashboard</h2>
      </div>

      <AdminAccordionSection
        id="className"
        title="Update Class Name"
        subtitle="This name appears in the preview message and throughout the app."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="M15 5l4 4"/>
          </svg>
        }
      >
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
      </AdminAccordionSection>

      <AdminAccordionSection
        id="dayOrder"
        title="Today's Day Order"
        subtitle="Set the active day order and edit the full timetable."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="3"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
          </svg>
        }
      >
        <TimetableWidget bare timetable={timetable} currentDayOrder={currentDayOrder} onChangeDayOrder={saveCurrentDayOrder} editable={true} subjects={subjects} onSaveSlot={saveTimetableSlot} />
      </AdminAccordionSection>

      <AdminAccordionSection
        id="subjects"
        title="Manage Subjects"
        subtitle="Subjects live in Supabase — added or removed here, they update instantly in the Attendance Report dropdown and Study Material for every device."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        }
      >
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
      </AdminAccordionSection>

      <AdminAccordionSection
        id="students"
        title="Manage Students"
        subtitle="Mark students who have left the college. They are hidden from active totals but stay visible (shaded) on the grid."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        }
      >
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
      </AdminAccordionSection>

      <AdminAccordionSection
        id="admins"
        title="Manage Admins"
        subtitle="Admins live in Supabase. Add the next class representative so they can take over later — changes apply instantly across all devices."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        }
      >
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
      </AdminAccordionSection>

      <AdminAccordionSection
        id="studentLogin"
        title="Manage Student Login"
        subtitle="Control exactly which features students can see and access when they log in."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        }
      >
        <div className="manage-list">
          {APP_MODULES.map(function(m){
            const enabled = !!studentPermissions[m.id];
            return (
              <div key={m.id} className="permission-row">
                <span className="permission-icon">{m.icon}</span>
                <div className="permission-text">
                  <div className="permission-name">{m.name}</div>
                  <div className="permission-sub">{m.sub}</div>
                </div>
                <ToggleSwitch
                  checked={enabled}
                  label={'Toggle student access to '+m.name}
                  onChange={function(val){ updateStudentPermission(m.id, val); }}
                />
              </div>
            );
          })}
        </div>
        <div className="warning-box" style={{marginTop:14}}>
          <strong>Heads up:</strong> Enabling "Attendance Report", "Student Database", or "Admin Settings" grants students access to admin-only tools. Only enable these if you intend that.
        </div>
      </AdminAccordionSection>

      <AdminAccordionSection
        id="history"
        title="Attendance History"
        subtitle="Look up a specific student's attendance record across every saved date, export individual or global reports, and manage saved entries."
        activeTab={activeAdminTab}
        onToggle={toggleAdminTab}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v5h5"/>
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
            <path d="M12 7v5l4 2"/>
          </svg>
        }
      >
        <div className="history-search-panel">
          <div>
            <button type="button" className="link-btn" onClick={handleExportPdf}>Export PDF</button>
          </div>

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
              <div className="history-breakdown" style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:10}}>
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
        </div>

        <p className="helper-text" style={{marginTop:14}}>Each card below groups every hour saved for that date, newest first. Tap a card to see the hour-by-hour absentee breakdown.</p>
        <div className="history-grid">
          {groupedHistory.length===0 && <div className="empty-state">No saved reports yet — send an Attendance Report via WhatsApp to create one.</div>}
          {groupedHistory.map(function(dateEntry){
            const isOpen = expandedHistoryDate === dateEntry.date;
            const hoursWithAbsentees = dateEntry.rows.filter(function(row){ return (row.absent_rolls||[]).length > 0; }).length;
            const hourWiseBreakdown = isOpen ? getDateHourWiseBreakdown(dateEntry.rows) : [];
            const allRolls = new Set();
            dateEntry.rows.forEach(function(row){ (row.absent_rolls||[]).forEach(function(r){ allRolls.add(r); }); });
            const absentCount = allRolls.size;
            const presentCount = dateEntry.total_active!=null ? Math.max(dateEntry.total_active-absentCount,0) : null;
            const dayOrder = dateEntry.day_order!=null ? dateEntry.day_order : (dateEntry.rows[0] && dateEntry.rows[0].day_order);

            return (
              <div key={dateEntry.date} className={"history-row"+(isOpen?' is-open':'')}>
                <div className="history-row-top" style={{cursor:'pointer'}} onClick={function(){ toggleHistoryExpand(dateEntry.date); }}>
                  <div>
                    <div className="history-row-title">{formatNiceDate(dateEntry.date)}</div>
                    <div className="history-row-meta">
                      {dateEntry.class_name||'—'}
                      {dayOrder!=null && <span className="day-order-badge">Day Order: {dayOrder}</span>}
                    </div>
                    <div className="history-row-meta">{hoursWithAbsentees} of {dateEntry.rows.length} hour(s) with absentees</div>
                  </div>
                  <span className="link-btn">{isOpen ? 'Hide' : 'View breakdown'}</span>
                </div>
                <div className="history-row-stats">
                  <span><b>{dateEntry.total_active!=null?dateEntry.total_active:'—'}</b> strength</span>
                  <span><b>{absentCount}</b> absent</span>
                  <span><b>{presentCount!=null?presentCount:'—'}</b> present</span>
                </div>
                {isOpen && (
                  <div className="history-breakdown" style={{marginTop:12,borderTop:'1px solid var(--panel-border)',paddingTop:12}}>
                    <div style={{display:'grid',gap:10}}>
                      {hourWiseBreakdown.map(function(hb){
                        const hourLabel = 'Hour '+hb.hour + (hb.subject ? ' — '+hb.subject : '');
                        const absentLabel = hb.absentees.length===0 ? 'No absentees recorded' : hb.absentees.length+' absentee'+(hb.absentees.length===1 ? '' : 's');
                        const hourKey = dateEntry.date+'-'+hb.hour;
                        const isHourOpen = !!expandedHistoryHours[hourKey];
                        return (
                          <div key={hb.hour} style={{border:'1px solid var(--panel-border)',borderRadius:12,background:'var(--panel-soft)',padding:12}}>
                            <div
                              style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom: hb.hasData ? 8 : 0,cursor: hb.hasData ? 'pointer' : 'default'}}
                              onClick={function(){ if(hb.hasData) toggleHistoryHourExpand(hourKey); }}
                            >
                              <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                                {hb.hasData && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                                    strokeLinecap="round" strokeLinejoin="round"
                                    style={{marginTop:4,flex:'0 0 auto',color:'var(--text-dim)',transition:'transform .18s var(--ease)',transform: isHourOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                                    <path d="M6 9l6 6 6-6"/>
                                  </svg>
                                )}
                                <div>
                                  <div style={{fontWeight:800,color:'var(--accent)',marginBottom:4}}>{hourLabel}</div>
                                  <div style={{fontSize:12,color:'var(--text-dim)'}}>{hb.hasData ? absentLabel : 'Hour '+hb.hour+' — Not recorded'}</div>
                                </div>
                              </div>
                              {hb.hasData && (
                                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                  <button type="button" className="hb-action-btn" onClick={function(e){ e.stopPropagation(); handleCopyHistoryMessage(buildHourHistoryMessage(dateEntry, hb.hour)); }}>Copy Message</button>
                                  <button type="button" className="hb-action-btn danger" onClick={function(e){ e.stopPropagation(); handleDeleteHistoryHourEntry(dateEntry.date, hb.hour); }}>Delete</button>
                                  <button type="button" className="hb-action-btn" onClick={function(e){ e.stopPropagation(); handleExportHourPdf(dateEntry, hb.hour); }}>Export PDF</button>
                                </div>
                              )}
                            </div>

                            {hb.hasData && isHourOpen ? (
                              hb.absentees.length===0 ? (
                                <div className="empty-state" style={{margin:0,padding:0,border:'none',background:'transparent'}}>
                                  No absentees recorded for this hour.
                                </div>
                              ) : (
                                <div style={{display:'grid',gap:6}}>
                                  {hb.absentees.map(function(a){
                                    return (
                                      <div key={a.rollNo} className="result-row" style={{background:'var(--panel)',border:'1px solid var(--panel-border)',borderRadius:10,padding:'8px 10px'}}>
                                        <span className="result-row-subject">{a.rollNo} - {a.name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="history-actions" style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'8px'}}>
                  <button type="button" onClick={function(e){ e.stopPropagation(); handleCopyHistoryMessage(buildHistoryMessage(dateEntry)); }}>Copy Message</button>
                  <button type="button" onClick={function(e){ e.stopPropagation(); handleExportPdfForDate(dateEntry); }}>Master PDF</button>
                  <button type="button" onClick={function(e){ e.stopPropagation(); handleExportAbsenteesPdfForDate(dateEntry); }}>Absentees PDF</button>
                  <button type="button" className="danger" onClick={function(e){ e.stopPropagation(); handleDeleteHistoryEntry(dateEntry.date); }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </AdminAccordionSection>

      <button type="button" className="btn btn-secondary" onClick={goLanding}>Logout / Back to Home</button>
      <p className="app-footer">App Created by: <strong>GODSON S</strong></p>
    </section>
  );
}