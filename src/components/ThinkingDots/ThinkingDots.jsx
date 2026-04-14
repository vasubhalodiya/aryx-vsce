import React from 'react';
import './ThinkingDots.css';

export default function ThinkingDots() {
  return (
    <div className="thinking-dots">
      <span className="dot" style={{ animationDelay: '0ms' }} />
      <span className="dot" style={{ animationDelay: '150ms' }} />
      <span className="dot" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
