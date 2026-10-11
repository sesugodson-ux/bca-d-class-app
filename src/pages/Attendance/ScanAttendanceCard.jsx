// File: src/pages/Attendance/ScanAttendanceCard.jsx
import React, { useRef } from 'react';
import { HOURS } from '../../utils/constants';
import { formatNiceDate } from '../../utils/helpers';

export default function ScanAttendanceCard({
  scanBusy, scanData, scanDayOrder, hourVal,
  onFileSelected, onSelectHour, onClear
}){
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  function handleChange(e){
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // lets the same file be picked again
    if(file) onFileSelected(file);
  }

  const activeInfo = scanData ? scanData.hours[Number(hourVal)] : null;

  return (
    <section className="card">
      <h2 className="card-title">Scan Attendance Note (Camera/Upload)</h2>
      <p className="helper-text" style={{marginTop:0}}>
        Photograph or upload your handwritten register note. The date, day order and absentees are filled in for you to review.
      </p>

      <div className="scan-actions">
        <button type="button" className="btn btn-primary" disabled={scanBusy} onClick={function(){ cameraRef.current.click(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {scanBusy ? 'Reading note…' : 'Take Photo'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={scanBusy} onClick={function(){ uploadRef.current.click(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Image
        </button>
      </div>

      {/* capture="environment" opens the rear camera on phones; desktops ignore it */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handleChange} />
      <input ref={uploadRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleChange} />

      {scanData && (
        <div className="scan-review">
          <div className="scan-summary">
            <span className="scan-pill">Date: {scanData.date ? formatNiceDate(scanData.date) : 'not found — using form date'}</span>
            <span className="scan-pill">Day Order: {scanDayOrder != null ? scanDayOrder : 'not found'}</span>
          </div>

          <div className="scan-hour-row">
            {HOURS.map(function(h){
              const info = scanData.hours[h];
              const isBlank = !info || info.isBlank;
              const isActive = String(h) === String(hourVal);
              return (
                <button
                  key={h}
                  type="button"
                  className={"scan-hour-chip"+(isActive?' active':'')+(isBlank?' blank':'')}
                  disabled={isBlank}
                  onClick={function(){ onSelectHour(h); }}
                >
                  <span className="scan-hour-label">H{h}</span>
                  <span className="scan-hour-count">{isBlank ? 'blank' : info.ids.length+' absent'}</span>
                </button>
              );
            })}
          </div>

          {activeInfo && activeInfo.unresolved.length > 0 && (
            <div className="warning-box">
              <strong>Couldn't match:</strong> {activeInfo.unresolved.join(', ')}. Check the note and tap them on the grid if needed.
            </div>
          )}
          {activeInfo && activeInfo.leftSkipped.length > 0 && (
            <div className="warning-box">
              <strong>Marked Left, skipped:</strong> {activeInfo.leftSkipped.join(', ')}
            </div>
          )}

          <p className="helper-text" style={{margin:'10px 0 0'}}>
            Save or send each hour before loading the next one. Loading a new hour replaces the grid.
          </p>
          <button type="button" className="link-btn" onClick={onClear}>Clear scan</button>
        </div>
      )}
    </section>
  );
}