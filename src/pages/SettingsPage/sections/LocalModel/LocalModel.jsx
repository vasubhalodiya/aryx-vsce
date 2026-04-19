import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader, Search, Server, Pencil } from 'lucide-react';
import './LocalModel.css';

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

export default function LocalModel({ vscode }) {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [draftBaseUrl, setDraftBaseUrl] = useState(DEFAULT_BASE_URL);
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);
  const [localModel, setLocalModel] = useState('');
  const [models, setModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const dropdownRef = useRef(null);

  useEffect(() => {
    vscode.postMessage({ type: 'getSettings' });

    function onMessage(event) {
      const msg = event.data;
      if (msg?.type === 'settingsLoaded') {
        const s = msg.settings || {};
        const savedBaseUrl = s.localBaseUrl || DEFAULT_BASE_URL;
        setBaseUrl(savedBaseUrl);
        setDraftBaseUrl(savedBaseUrl);
        setLocalModel(s.localModel || (s.provider === 'ollama-local' ? s.model : '') || '');
      }

      if (msg?.type === 'modelsLoaded') {
        const list = Array.isArray(msg.models) ? msg.models : [];
        setModels(list);
        setIsLoadingModels(false);
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

  useEffect(() => {
    if (!baseUrl.trim()) {
      setModels([]);
      setIsLoadingModels(false);
      return;
    }

    setIsLoadingModels(true);
    const timer = setTimeout(() => {
      vscode.postMessage({
        type: 'fetchModels',
        settings: {
          provider: 'ollama-local',
          localBaseUrl: baseUrl
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [baseUrl]);

  useEffect(() => {
    function onOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  const filteredModels = useMemo(
    () => models.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase())),
    [models, modelSearch]
  );

  function saveLocalSettings(nextModel = localModel, nextBaseUrl = baseUrl) {
    vscode.postMessage({
      type: 'saveSettings',
      settings: {
        provider: 'ollama-local',
        apiKey: '',
        model: nextModel,
        localBaseUrl: nextBaseUrl,
        localModel: nextModel
      }
    });
  }

  function handleSaveBaseUrl() {
    const nextBaseUrl = draftBaseUrl.trim() || DEFAULT_BASE_URL;
    setBaseUrl(nextBaseUrl);
    setDraftBaseUrl(nextBaseUrl);
    setIsEditingBaseUrl(false);
    saveLocalSettings(localModel, nextBaseUrl);
  }

  function handleModelSelect(modelName) {
    setLocalModel(modelName);
    setShowModelDropdown(false);
    setModelSearch('');
    saveLocalSettings(modelName);
  }

  return (
    <div className="tab-pane">
      <h2 className="pane-title">Local Model</h2>

      <div className="settings-card">
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-name">Ollama Base URL</div>
            <div className="setting-desc">Local Ollama server endpoint for this extension.</div>
          </div>
          <div className="setting-action local-action-wide">
            <div className="local-input-wrap">
              <input
                type="text"
                className="local-input"
                placeholder={DEFAULT_BASE_URL}
                value={draftBaseUrl}
                onChange={(e) => setDraftBaseUrl(e.target.value)}
                spellCheck={false}
                disabled={!isEditingBaseUrl}
              />
              {!isEditingBaseUrl && (
                <button
                  className="local-icon-btn"
                  type="button"
                  title="Edit base URL"
                  onClick={() => {
                    setDraftBaseUrl(baseUrl);
                    setIsEditingBaseUrl(true);
                  }}
                >
                  <Pencil size={13} className="local-input-icon" />
                </button>
              )}
              {isEditingBaseUrl && (
                <button
                  className="local-save-btn"
                  type="button"
                  onClick={handleSaveBaseUrl}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div className="setting-info">
            <div className="setting-name">Local Model</div>
            <div className="setting-desc">
              {isLoadingModels
                ? 'Loading local models...'
                : `${models.length} model${models.length !== 1 ? 's' : ''} available from Ollama`}
            </div>
          </div>
          <div className="setting-action" ref={dropdownRef}>
            <div
              className="ai-dropdown-trigger model-trigger"
              onClick={() => !isLoadingModels && setShowModelDropdown((v) => !v)}
            >
              {isLoadingModels ? (
                <span className="loading-text">
                  <Loader size={14} className="spin" />
                  Loading...
                </span>
              ) : (
                <span className="model-label">{localModel || 'Select local model'}</span>
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
                    placeholder="Search local models..."
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
                        className={`ai-dropdown-item ${localModel === m ? 'selected' : ''}`}
                        onClick={() => handleModelSelect(m)}
                      >
                        <span className="model-item-label">{m}</span>
                        {localModel === m && <Check size={14} className="check-icon" />}
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
          Local model settings saved
        </div>
      )}
    </div>
  );
}
