// File: src/components/Timetable/TimetableWidget.jsx
import React, { useState } from 'react';
import { HOURS, DAY_ORDERS } from '../../utils/constants';
import './Timetable.css';

export default function TimetableWidget(props){
  const { timetable, currentDayOrder, onChangeDayOrder, editable, subjects, onSaveSlot, bare } = props;
  const [showAllDays, setShowAllDays] = useState(false);
  function slotValue(dayOrder, hour){ return timetable[dayOrder+'-'+hour] || ''; }
  const Wrapper = bare ? 'div' : 'section';
  const wrapperClassName = bare ? '' : 'card timetable-card';
  return (
    <Wrapper className={wrapperClassName}>
      {!editable && (
        <div className="timetable-section" aria-label="Compact timetable view">
          <div className="timetable-top">
            <h3>TIMETABLE</h3>
            <span className="day-badge">Day Order {currentDayOrder}</span>
          </div>
          <div className="timetable-grid">
            {HOURS.map(function(hour){
              return (
                <div key={hour} className="hour-box">
                  <div className="hour-label">HOUR {hour}</div>
                  <div className="hour-content">{slotValue(currentDayOrder, hour) || '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {editable && (
        <>
          <div className="form-row" style={{marginBottom:12}}>
            <div className="field">
              <label>Today's Day Order</label>
              <select className="timetable-dayorder-select" value={currentDayOrder} onChange={function(e){ onChangeDayOrder(parseInt(e.target.value,10)); }}>
                {DAY_ORDERS.map(function(d){ return <option key={d} value={d}>Day Order {d}</option>; })}
              </select>
            </div>
          </div>
          <button type="button" className="link-btn" onClick={function(){ setShowAllDays(function(v){ return !v; }); }}>
            {showAllDays ? 'Hide day-wise editor' : 'Edit all 6 day orders'}
          </button>
          {showAllDays && (
            <div className="timetable-admin-grid">
              {DAY_ORDERS.map(function(d){
                return (
                  <div key={d} className="timetable-admin-day">
                    <div className="timetable-admin-day-title">Day Order {d}</div>
                    {HOURS.map(function(h){
                      return (
                        <div key={h} className="timetable-admin-hour-row">
                          <label>Hour {h}</label>
                          <select value={slotValue(d,h)} onChange={function(e){ onSaveSlot(d, h, e.target.value); }}>
                            <option value="">— Free —</option>
                            {(subjects||[]).map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Wrapper>
  );
}