// File: src/components/modals/AboutModal.jsx
import React from 'react';
import './Modals.css';

export default function AboutModal({ open, onClose }){
  return (
    <div className={"modal-overlay"+(open?' open':'')} role="dialog" aria-modal="true" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-sheet" style={{maxWidth:420, textAlign:'center', padding:'32px 24px'}}>
        <div className="modal-header" style={{justifyContent:'center', position:'relative'}}>
          <h2 className="modal-title">About</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose} style={{position:'absolute', right:0}}>&#x2715;</button>
        </div>
        <div style={{width:56,height:56,margin:'8px auto 18px',borderRadius:16,background:'linear-gradient(135deg,var(--accent),var(--accent-dark))',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(0,168,132,.35)'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 11l2.5 2.5L16 8.5" stroke="#04201b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="#04201b" strokeWidth="2.2"/></svg>
        </div>
        <p style={{fontSize:15,fontWeight:700,color:'var(--text)',margin:'0 0 6px'}}>BCA App</p>
        <p style={{fontSize:13.5,color:'var(--text-dim)',margin:0,lineHeight:1.6}}>Managed by Class Representative - GODSON S</p>
      </div>
    </div>
  );
}