import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function InfoTooltip({ text, label = '산정 기준 상세' }) {
  const id = useId();
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({});
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!anchor.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  function show() {
    const r = anchor.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 32);
    setPosition({ width, left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)), top: Math.min(r.bottom + 8, window.innerHeight - 200) });
    setOpen(true);
  }
  return <span className="info-tooltip-wrap">
    <button ref={anchor} type="button" className="info-trigger" aria-label={label}
      aria-expanded={open} aria-describedby={open ? id : undefined}
      onMouseEnter={show} onFocus={show}
      onClick={show}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>i</button>
    {open && createPortal(<span id={id} role="tooltip" className="info-overlay" style={position}>{text}</span>, document.body)}
    <span className="info-print-note">{text}</span>
  </span>;
}
