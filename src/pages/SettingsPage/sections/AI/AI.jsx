import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Loader2, Check, Eye, EyeOff, Loader } from 'lucide-react';
import './AI.css';

const PROVIDERS = [
  { id: 'google-gemini', label: 'Google Gemini' },
  { id: 'openrouter', label: 'OpenRouter' }
];

export default function AI({ vscode }) {
  const [provider, setProvider] = useState('google-gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [modelSearch, setModelSearch] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const modelDropdownRef = useRef(null);
  const providerDropdownRef = useRef(null);
  const pendingModelRef = useRef('');

  // Load saved settings on mount
  useEffect(() => {
    vscode.postMessage({ type: 'getSettings' });

    function onMessage(event) {
      const msg = event.data;

      if (msg?.type === 'settingsLoaded') {
        const s = msg.settings || {};
        if (s.provider) setProvider(s.provider);
        if (s.apiKey) setApiKey(s.apiKey);
        // Don't show model yet — store it pending until models load
        if (s.model) pendingModelRef.current = s.model;
      }

      if (msg?.type === 'modelsLoaded') {
        const list = Array.isArray(msg.models) ? msg.models : [];
        setModels(list);
        setIsLoadingModels(false);
        // Now apply pending model if it exists in list
        if (pendingModelRef.current) {
          const pending = pendingModelRef.current;
          if (list.includes(pending)) {
            setModel(pending);
          }
          pendingModelRef.current = '';
        }
      }

      if (msg?.type === 'settingsSaved') {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      }

      if (msg?.type === 'errorMessage') {
        setIsLoadingModels(false);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Auto-fetch models when provider or apiKey changes (with debounce)
  useEffect(() => {
    if (!apiKey.trim()) {
      setModels([]);
      setIsLoadingModels(false);
      return;
    }

    setIsLoadingModels(true);
    const timer = setTimeout(() => {
      vscode.postMessage({
        type: 'fetchModels',
        settings: { provider, apiKey }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [provider, apiKey]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target)) {
        setShowProviderDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Save settings whenever they change
  function saveSettings(nextProvider, nextApiKey, nextModel) {
    vscode.postMessage({
      type: 'saveSettings',
      settings: {
        provider: nextProvider,
        apiKey: nextApiKey,
        model: nextModel
      }
    });
  }

  function handleProviderChange(id) {
    setProvider(id);
    setShowProviderDropdown(false);
    setModel('');
    setModels([]);
    setModelSearch('');
    saveSettings(id, apiKey, '');
  }

  function handleApiKeyChange(e) {
    const val = e.target.value;
    setApiKey(val);
    setModel('');
    setModels([]);
  }

  function handleApiKeyBlur() {
    saveSettings(provider, apiKey, model);
  }

  function handleModelSelect(m) {
    setModel(m);
    setShowModelDropdown(false);
    setModelSearch('');
    saveSettings(provider, apiKey, m);
  }

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label || provider;

  return (
    <div className="tab-pane">
      <h2 className="pane-title">AI</h2>

      <div className="settings-card">
        {/* Provider Row */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Provider</div>
            <div className="setting-desc">Select the AI provider for chat completions</div>
          </div>
          <div className="setting-action" ref={providerDropdownRef}>
            <div
              className="ai-dropdown-trigger"
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            >
              <span>{providerLabel}</span>
              <ChevronDown size={14} className={`chevron-icon ${showProviderDropdown ? 'rotated' : ''}`} />
            </div>
            {showProviderDropdown && (
              <div className="ai-dropdown-menu">
                {PROVIDERS.map((p) => (
                  <div
                    key={p.id}
                    className={`ai-dropdown-item ${provider === p.id ? 'selected' : ''}`}
                    onClick={() => handleProviderChange(p.id)}
                  >
                    <span>{p.label}</span>
                    {provider === p.id && <Check size={14} className="check-icon" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="divider" />

        {/* API Key Row */}
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">API Key</div>
            <div className="setting-desc">
              {provider === 'google-gemini'
                ? 'Your Google AI Studio API key'
                : 'Your OpenRouter API key'}
            </div>
          </div>
          <div className="setting-action">
            <div className="api-key-input-wrap">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="api-key-input"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={handleApiKeyChange}
                onBlur={handleApiKeyBlur}
                spellCheck={false}
              />
              <button
                className="eye-btn"
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Hide' : 'Show'}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Model Row */}
        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div className="setting-info">
            <div className="setting-name">Model</div>
            <div className="setting-desc">
              {!apiKey.trim()
                ? 'Enter an API key above to load available models'
                : isLoadingModels
                ? 'Loading models...'
                : `${models.length} model${models.length !== 1 ? 's' : ''} available`}
            </div>
          </div>
          <div className="setting-action" ref={modelDropdownRef}>
            <div
              className={`ai-dropdown-trigger model-trigger ${!apiKey.trim() ? 'disabled' : ''}`}
              onClick={() => {
                if (apiKey.trim() && !isLoadingModels) {
                  setShowModelDropdown(!showModelDropdown);
                }
              }}
            >
              {isLoadingModels ? (
                <span className="loading-text">
                  <Loader size={14} className="spin" />
                  Loading...
                </span>
              ) : (
                <span className="model-label">{model || 'Select model'}</span>
              )}
              <ChevronDown size={14} className={`chevron-icon ${showModelDropdown ? 'rotated' : ''}`} />
            </div>
            {showModelDropdown && (
              <div className="ai-dropdown-menu model-menu">
                <div className="model-search-wrap">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    className="model-search-input"
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="model-list">
                  {filteredModels.length === 0 ? (
                    <div className="model-empty">No models found</div>
                  ) : (
                    filteredModels.map((m) => (
                      <div
                        key={m}
                        className={`ai-dropdown-item ${model === m ? 'selected' : ''}`}
                        onClick={() => handleModelSelect(m)}
                      >
                        <span className="model-item-label">{m}</span>
                        {model === m && <Check size={14} className="check-icon" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {saveStatus === 'saved' && (
        <div className="save-toast">
          <Check size={14} />
          Settings saved
        </div>
      )}
    </div>
  );
}
