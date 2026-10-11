// File: src/components/common/StudySubjectAccordion.jsx
import React from 'react';
import './Common.css';

export default function StudySubjectAccordion({ subject, isOpen, onToggle, fileCount, children }){
  return (
    <section className="card admin-accordion-item">
      <button
        type="button"
        className="admin-accordion-header"
        onClick={function(){ onToggle(subject); }}
        aria-expanded={isOpen}
      >
        <span className="admin-accordion-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </span>
        <div className="admin-accordion-header-text">
          <h2 className="study-subject-title">{subject}</h2>
          <p className="helper-text" style={{ margin: '4px 0 0' }}>{fileCount} {fileCount===1?'file':'files'}</p>
        </div>
        <svg
          className="admin-accordion-chevron"
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {isOpen && <div className="admin-accordion-body">{children}</div>}
    </section>
  );
}