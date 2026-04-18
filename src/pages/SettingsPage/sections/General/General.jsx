import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './General.css';

const UnifiedIcon = () => (
  <svg width="98" height="89" viewBox="0 0 98 89" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="3.5" width="91" height="82" rx="16.5" stroke="white" strokeWidth="7" />
    <rect x="14" y="14" width="70" height="28" rx="6" fill="#B84A59" />
    <rect x="14" y="48" width="70" height="27" rx="6" fill="#436AA1" />
  </svg>
);

const SplitIcon = () => (
  <svg width="98" height="89" viewBox="0 0 98 89" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="3.5" width="91" height="82" rx="16.5" stroke="white" stroke-width="7" />
    <rect x="52" y="14" width="32" height="61" rx="6" fill="#436AA1" />
    <rect x="14" y="14" width="32" height="61" rx="6" fill="#B84A59" />
  </svg>
);

const DIFF_OPTIONS = [
  { value: 'unified', label: 'Unified', icon: <UnifiedIcon /> },
  { value: 'split', label: 'Split', icon: <SplitIcon /> }
];

export default function General() {
  const [customInstructions, setCustomInstructions] = useState('');
  const [diffFormat, setDiffFormat] = useState('unified');
  const [showDiffDropdown, setShowDiffDropdown] = useState(false);
  const diffDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (diffDropdownRef.current && !diffDropdownRef.current.contains(e.target)) {
        setShowDiffDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedOption = DIFF_OPTIONS.find((o) => o.value === diffFormat);

  return (
    <div className="tab-pane">
      <h2 className="pane-title">General</h2>

      <div className="settings-card">
        {/* Custom Instructions */}
        <div className="setting-row setting-row-column">
          <div className="setting-info">
            <div className="setting-name">Custom Instructions</div>
            <div className="setting-desc">Custom instructions are used to customize the behavior of the Codex model.</div>
          </div>
          <div className="custom-instructions-wrap">
            <textarea
              className="custom-instructions-textarea"
              placeholder="Enter custom instructions..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="divider" />

        {/* Diff Display Format */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Diff display format</div>
            <div className="setting-desc">Choose how code diffs are displayed in the chat.</div>
          </div>
          <div className="setting-action" ref={diffDropdownRef}>
            <div
              className="ai-dropdown-trigger general-dropdown-trigger"
              onClick={() => setShowDiffDropdown(!showDiffDropdown)}
            >
              <span className="diff-option-label">
                {selectedOption?.icon}
                {selectedOption?.label}
              </span>
              <ChevronDown size={14} className={`chevron-icon ${showDiffDropdown ? 'rotated' : ''}`} />
            </div>
            {showDiffDropdown && (
              <div className="ai-dropdown-menu">
                {DIFF_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className={`ai-dropdown-item ${diffFormat === opt.value ? 'selected' : ''}`}
                    onClick={() => {
                      setDiffFormat(opt.value);
                      setShowDiffDropdown(false);
                    }}
                  >
                    <span className="diff-option-label">
                      {opt.icon}
                      {opt.label}
                    </span>
                    {diffFormat === opt.value && <Check size={14} className="check-icon" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
