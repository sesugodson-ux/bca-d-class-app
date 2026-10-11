// File: src/pages/Auth/DatabaseLogin.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function DatabaseLogin({
  shakeCls,
  dbLoginRoll, setDbLoginRoll,
  dbLoginDob, setDbLoginDob,
  dbLoginBusy,
  attemptDbLogin
}){
  return (
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
  );
}