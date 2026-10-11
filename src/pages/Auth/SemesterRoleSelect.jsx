// File: src/pages/Auth/SemesterRoleSelect.jsx
import React from 'react';

export default function SemesterRoleSelect({ goSemesterLogin }){
  return (
    <section className="view active">
      <div className="landing-intro">
        <p className="landing-eyebrow">Semester Results</p>
        <h2 className="landing-heading">Who are you?</h2>
      </div>
      <div className="card">
        <p className="helper-text" style={{marginTop:0}}>Select your role to continue. Students can view their own marks. Admins can add marks and browse any student's results.</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={function(){ goSemesterLogin('student'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#04201b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            I am a Student
          </button>
          <button type="button" className="btn btn-secondary" onClick={function(){ goSemesterLogin('admin'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            I am an Admin
          </button>
        </div>
      </div>
    </section>
  );
}