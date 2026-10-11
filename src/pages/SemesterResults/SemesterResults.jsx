// File: src/pages/SemesterResults/SemesterResults.jsx
import React from 'react';
import './SemesterResults.css';

export default function SemesterResults({
  currentStudyIsAdmin,
  currentStudyRollNo,
  shakeCls,
  semAddRoll, setSemAddRoll,
  semAddSemester, setSemAddSemester,
  semAddSubject, setSemAddSubject,
  semAddMarks, setSemAddMarks,
  semAddMaxMarks, setSemAddMaxMarks,
  semAddBusy,
  handleAdminAddMarks,
  semBrowseRoll, setSemBrowseRoll,
  handleAdminBrowseResults,
  semesterList,
  selectedSemester, setSelectedSemester,
  semesterPercent,
  semesterRows,
  handleDeleteResultRow,
  goLanding
}){
  return (
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
  );
}