// File: src/pages/Auth/SemesterLogin.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function SemesterLogin({
  shakeCls,
  studyLoginMode,
  studyLoginRoll, setStudyLoginRoll,
  studyLoginDob, setStudyLoginDob,
  studyLoginBusy,
  attemptSemesterLogin
}){
  return (
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
  );
}