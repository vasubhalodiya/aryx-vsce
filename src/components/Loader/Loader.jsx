import React, { useState, useEffect } from 'react';
import './Loader.css';

const SPINNER_FRAMES = ['*', '✶', '✻', '✻', '✶', '*', '✢', '·', '✢'];
const TEXT = 'Thinking...';

export default function Loader() {
  const [iconFrame, setIconFrame] = useState(0);
  const [shimmerFrame, setShimmerFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIconFrame(f => (f + 1) % SPINNER_FRAMES.length), 180);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setShimmerFrame(f => f + 1), 120);
    return () => clearInterval(t);
  }, []);

  const pos = shimmerFrame % (TEXT.length + 4);

  return (
    <div className="aryx-loader">
      <span className="aryx-loader-icon">{SPINNER_FRAMES[iconFrame]}</span>
      <span className="aryx-loader-text">
        {TEXT.split('').map((char, i) => {
          let cls = 'ch-base';
          if (i === pos) cls = 'ch-bright';
          else if (i === pos - 1) cls = 'ch-mid';
          else if (i === pos - 2) cls = 'ch-dim';
          return <span key={i} className={cls}>{char}</span>;
        })}
      </span>
    </div>
  );
}
