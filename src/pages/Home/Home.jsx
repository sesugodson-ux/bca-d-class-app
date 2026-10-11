// File: src/pages/Home/Home.jsx
import React from 'react';
import TimetableWidget from '../../components/Timetable/TimetableWidget';
import DisclaimerNote from '../../components/common/DisclaimerNote';
import { APP_MODULES } from '../../utils/constants';
import './Home.css';

export default function Home({ currentUser, timetable, currentDayOrder, setCurrentDayOrder, studentPermissions, onModuleClick, onLogout }){
  return (
    <section className="view active">
      <div className="landing-intro">
        <h2 className="landing-heading">Welcome, {currentUser.name || currentUser.rollNo || 'Admin'}</h2>
        <p className="helper-text">{currentUser.role==='admin' ? 'Admin access' : 'Roll No '+currentUser.rollNo}</p>
      </div>
      <TimetableWidget currentDayOrder={currentDayOrder} editable={false} onChangeDayOrder={function(d){ setCurrentDayOrder(d); }} timetable={timetable} />

      {(function(){
        const isAdmin = currentUser.role==='admin';
        const visibleModules = isAdmin ? APP_MODULES : APP_MODULES.filter(function(m){ return studentPermissions[m.id]===true; });
        const cardClasses = ['mode-card-primary','mode-card-tertiary','mode-card-secondary','mode-card-quaternary','mode-card-quinary'];

        return visibleModules.map(function(m, idx){
          return (
            <button key={m.id} type="button" className={'mode-card '+cardClasses[idx % cardClasses.length]} onClick={function(){ onModuleClick(m.id); }}>
              <span className="mode-card-icon">{m.icon}</span>
              <span className="mode-card-text"><span className="mode-card-title">{m.name}</span><span className="mode-card-sub">{m.sub}</span></span>
              <span className="mode-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
            </button>
          );
        });
      })()}

      <DisclaimerNote />
      <button type="button" className="btn btn-secondary" onClick={onLogout} style={{marginTop:'20px'}}>Logout</button>
      <p className="app-footer">Created by GODSON S</p>
    </section>
  );
}