// File: src/components/common/StatBox.jsx
import React from 'react';
import './Common.css';

export default function StatBox(props){
  return (
    <div className={"stat-box"+(props.cls?' '+props.cls:'')}>
      <div className="stat-num">{props.value}</div>
      <div className="stat-label">{props.label}</div>
    </div>
  );
}