// File: src/components/common/RemoveBtn.jsx
import React from 'react';

export default function RemoveBtn(props){
  return (
    <button type="button" aria-label={props.label} onClick={props.onClick}
      style={{width:20,height:20,borderRadius:'50%',border:'none',flex:'0 0 auto',background:'rgba(255,255,255,0.08)',color:'var(--text-dim)',cursor:'pointer',fontSize:13,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
      &#215;
    </button>
  );
}