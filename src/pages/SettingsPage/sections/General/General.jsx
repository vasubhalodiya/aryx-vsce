import React from 'react';
import { ChevronDown } from 'lucide-react';
import './General.css';

function ToggleSwitch({ checked, onChange }) {
  return (
    <div 
      className={`toggle-switch ${checked ? 'checked' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

function SegmentControl({ options, selected, onChange }) {
  return (
    <div className="segment-control">
      {options.map((opt) => (
        <div
          key={opt.value}
          className={`segment-item ${opt.value === selected ? 'selected' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
}

export default function General() {
  const [requireEnter, setRequireEnter] = React.useState(true);
  const [followBehavior, setFollowBehavior] = React.useState('queue');
  const [codeReview, setCodeReview] = React.useState('inline');

  return (
    <div className="tab-pane">
      <h2 className="pane-title">General</h2>
      
      <div className="settings-card">
        {/* Language Row */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Language</div>
            <div className="setting-desc">Language for the app UI</div>
          </div>
          <div className="setting-action">
            <div className="dropdown-trigger">
              <span>Auto Detect</span>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
        
        <div className="divider" />
        
        {/* Require Enter Row */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Require ^ Enter to send long prompts</div>
            <div className="setting-desc">When enabled, multiline prompts require ^ + enter to send.</div>
          </div>
          <div className="setting-action">
            <ToggleSwitch checked={requireEnter} onChange={setRequireEnter} />
          </div>
        </div>
        
        <div className="divider" />
        
        {/* Follow-up behavior Row */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Follow-up behavior</div>
            <div className="setting-desc">Queue follow-ups while Aryx runs or steer the current run. Press Ctrl+Shift+Enter to do the opposite for one message.</div>
          </div>
          <div className="setting-action">
            <SegmentControl 
              options={[{label: 'Queue', value: 'queue'}, {label: 'Steer', value: 'steer'}]}
              selected={followBehavior}
              onChange={setFollowBehavior}
            />
          </div>
        </div>

        <div className="divider" />

        {/* Code review Row */}
        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div className="setting-info">
            <div className="setting-name">Code review</div>
            <div className="setting-desc">Start a review in the current thread when possible or launch a separate review thread</div>
          </div>
          <div className="setting-action">
            <SegmentControl 
              options={[{label: 'Inline', value: 'inline'}, {label: 'Detached', value: 'detached'}]}
              selected={codeReview}
              onChange={setCodeReview}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
