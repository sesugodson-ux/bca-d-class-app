// File: src/pages/MyAttendance/MyAttendance.jsx
import React from 'react';
import { HOURS } from '../../utils/constants';
import { formatNiceDate } from '../../utils/helpers';
import './MyAttendance.css';

export default function MyAttendance({ currentUser, getStudentHistoryRows, getAttendancePercent, handleStudentSelfPdfDownload, goLanding }){
  const safeRoll = String(currentUser.rollNo).trim();
  const rows = getStudentHistoryRows(safeRoll);
  const pct = getAttendancePercent(safeRoll);
  return (
    <section className="view active">
      <div className="landing-intro">
        <p className="landing-eyebrow">My Attendance · Roll No {safeRoll}</p>
        <h2 className="landing-heading">Your Attendance Report</h2>
      </div>

      {pct!=null && (
        <div className="semester-pct-hero">
          <div className="pct-num">{pct}%</div>
          <div className="pct-label">Overall attendance across all saved reports</div>
        </div>
      )}

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Absence Record</h2>
          <button type="button" className="link-btn" onClick={handleStudentSelfPdfDownload}>Download PDF</button>
        </div>
        {rows.length===0 && <div className="empty-state">No absences recorded — great job! Full attendance in all saved reports.</div>}
        <div style={{display:'grid',gap:10}}>
          {rows.map(function(r){
            return (
              <div key={r.date} style={{border:'1px solid var(--panel-border)',borderRadius:12,background:'var(--panel-soft)',padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom: r.isFullDay ? 0 : 8}}>
                  <div style={{fontWeight:800,color:'var(--text)',fontSize:13.5}}>{formatNiceDate(r.date)}</div>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:999,background: r.isFullDay ? 'rgba(255,77,77,.14)' : 'rgba(255,204,0,.14)',color: r.isFullDay ? 'var(--danger)' : 'var(--warn)',border:'1px solid '+(r.isFullDay ? 'rgba(255,77,77,.3)' : 'rgba(255,204,0,.3)'),whiteSpace:'nowrap'}}>
                    {r.isFullDay ? 'Full Day (All '+HOURS.length+' Hours)' : r.hoursAbsent.length+' Hour'+(r.hoursAbsent.length===1?'':'s')+' Missed'}
                  </span>
                </div>
                {!r.isFullDay && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:2}}>
                    {r.hoursAbsent.map(function(h){
                      return <span key={h} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:26,height:26,padding:'0 8px',borderRadius:8,background:'rgba(255,77,77,.12)',border:'1px solid rgba(255,77,77,.28)',color:'var(--danger)',fontSize:12,fontWeight:800}}>H{h}</span>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <button type="button" className="btn btn-secondary" onClick={goLanding}>Logout / Back to Home</button>
    </section>
  );
}