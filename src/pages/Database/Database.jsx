// File: src/pages/Database/Database.jsx
import React from 'react';
import DetailItem from '../../components/common/DetailItem';
import './Database.css';

export default function Database({
  databaseRollInputRef,
  searchRoll, setSearchRoll,
  searchMobile, setSearchMobile,
  searchResults,
  leftIds,
  getAttendancePercent,
  openEditModal
}){
  return (
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
  );
}