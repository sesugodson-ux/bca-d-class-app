// File: src/pages/Auth/StudyLogin.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function StudyLogin({
  shakeCls,
  studyLoginMode,
  studyLoginRoll, setStudyLoginRoll,
  studyLoginDob, setStudyLoginDob,
  studyLoginBusy,
  attemptStudyLogin
}){
  return (
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
  );
}