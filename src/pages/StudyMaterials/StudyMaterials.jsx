// File: src/pages/StudyMaterials/StudyMaterials.jsx
import React from 'react';
import AdminAccordionSection from '../../components/common/AdminAccordionSection';
import StudySubjectAccordion from '../../components/common/StudySubjectAccordion';
import RemoveBtn from '../../components/common/RemoveBtn';
import './StudyMaterials.css';

export default function StudyMaterials({
  currentStudyIsAdmin,
  currentStudyRollNo,
  shakeCls,
  activeStudyTab,
  toggleStudyTab,
  subjects,
  subjectIdMap,
  studyNewSubject, setStudyNewSubject,
  handleAddStudySubject,
  handleDeleteStudySubject,
  studyMaterialSubject, setStudyMaterialSubject,
  studyMaterialTitle, setStudyMaterialTitle,
  setStudyMaterialFile,
  studyUploading,
  handleUploadMaterial,
  studyCache,
  expandedRepoSubject,
  toggleRepoSubject,
  handleDeleteMaterial,
  goLanding
}){
  return (
    <section className="view active">
      <div className="landing-intro">
        <p className="landing-eyebrow">{currentStudyIsAdmin ? 'Study Material · Admin Mode (Roll No '+currentStudyRollNo+')' : 'Study Material · Roll No '+currentStudyRollNo}</p>
        <h2 className="landing-heading">{currentStudyIsAdmin ? 'Manage Study Material' : 'Study Material Repository'}</h2>
      </div>

      {currentStudyIsAdmin && (
        <AdminAccordionSection
          id="addSubject"
          title="Add Subject"
          subtitle="Create a subject shared live via Supabase — appears instantly in Attendance Report and Study Material for everyone."
          activeTab={activeStudyTab}
          onToggle={toggleStudyTab}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <path d="M9 8h6M9 12h6"/>
            </svg>
          }
        >
          <div className="add-row">
            <input type="text" placeholder="e.g. Data Structures" autoComplete="off" className={shakeCls('studyNewSubject')}
              value={studyNewSubject} onChange={function(e){ setStudyNewSubject(e.target.value); }} />
            <button type="button" className="btn-add" onClick={handleAddStudySubject}>Add</button>
          </div>
          <div className="manage-list">
            {subjects.length===0 && <div className="empty-state">No subjects yet — add one above.</div>}
            {subjects.map(function(name){
              return (
                <div key={name} className="manage-row">
                  <span className="manage-row-text">{name}</span>
                  <RemoveBtn label={'Remove subject '+name} onClick={function(){ handleDeleteStudySubject(name); }} />
                </div>
              );
            })}
          </div>
        </AdminAccordionSection>
      )}

      {currentStudyIsAdmin && (
        <AdminAccordionSection
          id="upload"
          title="Upload Material"
          subtitle="Pick a subject and upload a PDF, PPT, or Doc file directly to Supabase Storage."
          activeTab={activeStudyTab}
          onToggle={toggleStudyTab}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12"/><path d="M7 8l5-5 5 5"/>
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>
          }
        >
          <div className="stack-fields">
            <div className="field"><label>Subject</label>
              <select className={shakeCls('studyMaterialSubject')} value={studyMaterialSubject} onChange={function(e){ setStudyMaterialSubject(e.target.value); }}>
                <option value="" disabled>{subjects.length ? 'Select subject…' : 'Add a subject above first'}</option>
                {subjects.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
              </select>
            </div>
            <div className="field"><label>Material Title</label>
              <input type="text" placeholder="e.g. Unit 3 Notes" autoComplete="off" value={studyMaterialTitle} onChange={function(e){ setStudyMaterialTitle(e.target.value); }} />
            </div>
            <div className="field"><label>File (PDF / PPT / Doc)</label>
              <input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" className={shakeCls('studyMaterialFile')}
                onChange={function(e){ setStudyMaterialFile(e.target.files && e.target.files[0] ? e.target.files[0] : null); }} />
            </div>
          </div>
          <button type="button" className="btn-add btn-add-block" disabled={studyUploading} onClick={handleUploadMaterial}>
            {studyUploading ? 'Uploading…' : 'Upload Material'}
          </button>
        </AdminAccordionSection>
      )}

      <section className="card-title-row" style={{margin:'22px 4px 12px'}}>
        <h2 className="card-title" style={{margin:0}}>Repository</h2>
        <span className="helper-text" style={{margin:0}}>{studyCache.filter(function(r){ return r.file_url; }).length} items</span>
      </section>

      {subjects.length===0 && (
        <div className="card">
          <div className="empty-state">
            {currentStudyIsAdmin ? 'No subjects yet — add one above to start uploading material.' : 'No study material has been shared yet. Check back soon.'}
          </div>
        </div>
      )}

      {subjects.map(function(subject){
        const subjectId = subjectIdMap[subject];
        const materialsForSubject = studyCache.filter(function(m){
          const relationSubjectName = Array.isArray(m.subjects) ? m.subjects[0]?.subject_name : m.subjects?.subject_name;
          const rowSubjectId = m.subject_id != null ? Number(m.subject_id) : null;
          return (subjectId != null && rowSubjectId===Number(subjectId)) || m.subject_name===subject || relationSubjectName===subject;
        }).filter(function(m){ return m.file_url; });

        return (
          <StudySubjectAccordion
            key={subject}
            subject={subject}
            fileCount={materialsForSubject.length}
            isOpen={expandedRepoSubject === subject}
            onToggle={toggleRepoSubject}
          >
            <div className="manage-list" style={{marginTop:0}}>
              {materialsForSubject.length===0 && <div className="empty-state">No material uploaded for this subject yet.</div>}
              {materialsForSubject.map(function(m){
                return (
                  <div key={m.id} className="manage-row study-material-row">
                    <span className="manage-row-text">
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer">📄 {m.file_name}</a>
                    </span>
                    {currentStudyIsAdmin && (
                      <RemoveBtn label={'Delete '+m.file_name} onClick={function(){ handleDeleteMaterial(m); }} />
                    )}
                  </div>
                );
              })}
            </div>
          </StudySubjectAccordion>
        );
      })}

      <button type="button" className="btn btn-secondary" onClick={goLanding} style={{marginTop:8}}>Logout / Back to Home</button>
    </section>
  );
}