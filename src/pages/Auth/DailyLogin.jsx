// File: src/pages/Auth/DailyLogin.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function DailyLogin({
  shakeCls,
  dailyLoginRoll, setDailyLoginRoll,
  dailyLoginDob, setDailyLoginDob,
  dailyLoginBusy,
  attemptDailyLogin
}){
  return (
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
  );
}