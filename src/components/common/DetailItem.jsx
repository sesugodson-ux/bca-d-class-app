// File: src/components/common/DetailItem.jsx
import React from 'react';
import './Common.css';

export default function DetailItem(props){
  return (
    <div className="src-detail-item">
      <div className="src-detail-label">{props.label}</div>
      <div className="src-detail-value">
        {props.value
          ? (props.tel ? <a href={'tel:'+props.value}>{props.value}</a>
             : props.mail ? <a href={'mailto:'+props.value}>{props.value}</a>
             : props.value)
          : <span className="src-detail-empty">—</span>}
      </div>
    </div>
  );
}