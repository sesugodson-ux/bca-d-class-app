// File: src/components/common/AdminAccordionSection.jsx
import React from 'react';
import './Common.css';

export default function AdminAccordionSection({ id, title, subtitle, icon, activeTab, onToggle, children }){
  const isOpen = activeTab === id;
  return (
    <section className="card admin-accordion-item">
      <button
        type="button"
        className="admin-accordion-header"
        onClick={function(){ onToggle(id); }}
        aria-expanded={isOpen}
      >
        {icon && (
          <span className="admin-accordion-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="admin-accordion-header-text">
          <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>
          {subtitle && <p className="helper-text" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
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