// File: src/pages/Attendance/Attendance.jsx
import React from 'react';
import StatBox from '../../components/common/StatBox';
import { HOURS } from '../../utils/constants';
import { languageBadgeFor } from '../../utils/helpers';
import ScanAttendanceCard from './ScanAttendanceCard';
import './Attendance.css';

export default function Attendance({
  dateVal, setDateVal,
  hourVal, setHourVal,
  subjectVal, setSubjectVal,
  subjects,
  shakeCls,
  resetGrid,
  gridStudents,
  leftIds,
  rollState,
  cycleRollState,
  summary,
  buildRawMessage,
  sendBusy,
  handleSend,
  handleCopy,
  scanBusy, scanData, scanDayOrder,
  handleScanImage, applyScannedHour, clearScan
}){
  return (
    <section className="view active">
      <ScanAttendanceCard
        scanBusy={scanBusy}
        scanData={scanData}
        scanDayOrder={scanDayOrder}
        hourVal={hourVal}
        onFileSelected={handleScanImage}
        onSelectHour={function(h){ applyScannedHour(h); }}
        onClear={clearScan}
      />
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
          {(function(){
            const isTamilHour = /tamil/i.test(subjectVal || '');
            return gridStudents.map(function(s){
              const isXX = s.name === 'XX';
              const isLeft = leftIds.indexOf(s.id) !== -1;
              const isDisabled = isXX || isLeft;
              const state = rollState[s.id] || 'present';
              const displayNum = (s.rollNo && String(s.rollNo).trim() !== '') ? String(s.rollNo).slice(-2) : '—';
              const badge = (isTamilHour && !isDisabled) ? languageBadgeFor(s) : null;

              return (
                <button
                  key={s.id}
                  type="button"
                  className={
                    "roll-btn"
                    + (isDisabled ? ' state-left' : (state === 'absent' ? ' state-absent' : ''))
                  }
                  title={(isXX ? 'Unresolved roll' : s.name) + ' · ' + s.rollNo + (isLeft ? ' (Left)' : '') + (isXX ? ' (XX)' : '') + (badge ? ' · '+s.partOne : '')}
                  aria-label={(isXX ? 'Unresolved' : s.name) + (isDisabled ? ' — disabled' : ' — ' + state)}
                  disabled={isDisabled}
                  onClick={function(){ if(!isDisabled) cycleRollState(s.id); }}>
                  {displayNum}
                  {badge && (
                    <span style={{
                      position:'absolute', bottom:2, left:0, right:0, textAlign:'center',
                      fontSize:9, opacity:0.8, fontWeight:700, lineHeight:1, pointerEvents:'none'
                    }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            });
          })()}
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
  );
}