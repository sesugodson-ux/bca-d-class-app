// File: src/pages/Auth/AdminLogin.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function AdminLogin({
  shakeCls,
  loginRoll, setLoginRoll,
  loginDob, setLoginDob,
  loginBusy,
  attemptAdminLogin
}){
  return (
    <section className="view active">
      <div className="landing-intro">
        <p className="landing-eyebrow">Admin Settings</p>
        <h2 className="landing-heading">Login to continue</h2>
      </div>
      <div className={"card"+shakeCls('adminLoginCard')}>
        <p className="helper-text" style={{marginTop:0}}>Enter your Roll Number and Date of Birth.</p>
        <div className="stack-fields">
          <div className="field"><label>Roll Number</label><input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" autoFocus
            className={shakeCls('adminRoll')} value={loginRoll} onChange={function(e){ setLoginRoll(e.target.value); }}
            onKeyDown={function(e){ if(e.key==='Enter'){ e.preventDefault(); document.getElementById('adminLoginDobInput')?.focus(); } }} /></div>
          <div className="field"><label>Date of Birth</label><input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" id="adminLoginDobInput"
            className={shakeCls('adminDob')} value={loginDob} onChange={function(e){ setLoginDob(maskDobValue(e.target.value)); }} onKeyDown={function(e){ if(e.key==='Enter') attemptAdminLogin(); }} /></div>
        </div>
        <button type="button" className="btn btn-primary" disabled={loginBusy} onClick={attemptAdminLogin}>Login</button>
      </div>
      <p className="app-footer">BCA App</p>
    </section>
  );
}