// File: src/components/modals/EditStudentModal.jsx
import React from 'react';
import { maskDobValue } from '../../utils/helpers';
import { PART_ONE_OPTIONS } from '../../utils/constants';
import './Modals.css';

export default function EditStudentModal({ open, editForm, setEditForm, shakeCls, onClose, onSave }){
  return (
    <div className={"modal-overlay"+(open?' open':'')} role="dialog" aria-modal="true" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="modal-header">
          <h2 className="modal-title">Edit Student</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-grid">
          <div className="modal-field" style={{gridColumn:'1/-1'}}>
            <label>Full Name</label>
            <input type="text" placeholder="e.g. FIRST LAST" autoComplete="off" className={shakeCls('editName')}
              value={editForm.name} onChange={function(e){ setEditForm(function(f){ return { ...f, name:e.target.value }; }); }} />
          </div>
          <div className="modal-field">
            <label>Roll Number</label>
            <input type="text" inputMode="numeric" placeholder="e.g. 255113XXX" autoComplete="off" className={shakeCls('editRollNo')}
              value={editForm.rollNo} onChange={function(e){ setEditForm(function(f){ return { ...f, rollNo:e.target.value }; }); }} />
          </div>
          <div className="modal-field">
            <label>Date of Birth (DD-MM-YYYY)</label>
            <input type="text" inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10} autoComplete="off" className={shakeCls('editDob')}
              value={editForm.dob} onChange={function(e){ setEditForm(function(f){ return { ...f, dob:maskDobValue(e.target.value) }; }); }} />
          </div>
          <div className="modal-field">
            <label>Student Mobile</label>
            <input type="text" inputMode="numeric" placeholder="10-digit number" autoComplete="off"
              value={editForm.studentMob} onChange={function(e){ setEditForm(function(f){ return { ...f, studentMob:e.target.value }; }); }} />
          </div>
          <div className="modal-field">
            <label>Father Mobile</label>
            <input type="text" inputMode="numeric" placeholder="10-digit number" autoComplete="off"
              value={editForm.fatherMob} onChange={function(e){ setEditForm(function(f){ return { ...f, fatherMob:e.target.value }; }); }} />
          </div>
          <div className="modal-field">
            <label>College Email ID</label>
            <input type="text" inputMode="email" placeholder="e.g. ca255113XXX@bhc.edu.in" autoComplete="off"
              value={editForm.collegeID} onChange={function(e){ setEditForm(function(f){ return { ...f, collegeID:e.target.value }; }); }} />
          </div>
          <div className="modal-field">
            <label>Part One Language</label>
            <select value={editForm.partOne} onChange={function(e){ setEditForm(function(f){ return { ...f, partOne:e.target.value }; }); }}>
              {PART_ONE_OPTIONS.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-save-btn" onClick={onSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}