// File: src/components/common/LoginScreen.jsx
import React, { useRef, useEffect } from 'react';
import { maskDobValue } from '../../utils/helpers';

export default function LoginScreen({ roll, dob, busy, error, onRollChange, onDobChange, onSubmit, sectionLabel }){
  const rollInputRef = useRef(null);
  useEffect(function(){
    if(rollInputRef.current){
      rollInputRef.current.focus();
    }
  }, []);

  return (
    <div className="app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="app-header" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, background: '#10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#022c22', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <polyline points="9 11 12 14 16 9"></polyline>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>BCA App</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 6, height: 6, background: 'var(--primary)', borderRadius: '50%' }}></span>
            {sectionLabel}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: 540, width: '100%', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>BCA Portal · Unified Login</div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Login to continue</h2>
          </div>

          <div className="card" style={{ padding: '32px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-dim)', margin: '0 0 24px 0' }}>Enter your Roll Number and Date of Birth to securely access your account.</p>

            <div className="stack-fields">
              <div className="field">
                <label>Roll Number</label>
                <input
                  ref={rollInputRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 255113XXX"
                  autoComplete="off"
                  value={roll}
                  onChange={function(e){ onRollChange(e.target.value); }}
                  onKeyDown={function(e){ if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('unifiedLoginDobInput')?.focus(); } }}
                  style={{ padding: '14px', fontSize: '15px' }}
                />
              </div>
              <div className="field">
                <label>Date of Birth</label>
                <input
                  id="unifiedLoginDobInput"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD-MM-YYYY"
                  maxLength={10}
                  autoComplete="off"
                  value={dob}
                  onChange={function(e){ onDobChange(maskDobValue(e.target.value)); }}
                  onKeyDown={function(e){ if(e.key === 'Enter') onSubmit(); }}
                  style={{ padding: '14px', fontSize: '15px' }}
                />
              </div>
            </div>

            {error && <p className="helper-text" style={{color: 'var(--danger)', marginTop: '16px', textAlign: 'center', fontWeight: 700}}>{error}</p>}

            <button
              type="button"
              className="btn btn-primary"
              style={{marginTop: '28px', width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700}}
              disabled={busy}
              onClick={onSubmit}
            >
              {busy ? 'Verifying…' : 'Login'}
            </button>
          </div>

          <div style={{marginTop: '40px', fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, textAlign: 'center'}}>
            Created by GODSON S
          </div>
        </div>
      </div>
    </div>
  );
}