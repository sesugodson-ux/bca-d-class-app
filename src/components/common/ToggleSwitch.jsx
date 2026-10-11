// File: src/components/common/ToggleSwitch.jsx
import React from 'react';
import './Common.css';

export default function ToggleSwitch({ checked, onChange, label }){
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={"ios-toggle"+(checked?' on':'')}
      onClick={function(){ onChange(!checked); }}
    >
      <span className="ios-toggle-thumb"></span>
    </button>
  );
}