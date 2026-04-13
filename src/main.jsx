import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Settings, Plus, SlidersHorizontal, ArrowUp, Settings2 } from 'lucide-react';

const vscode = acquireVsCodeApi();

const DEFAULT_SETTINGS = {
  provider: 'google-gemini',
  apiKey: '',
  model: ''
};

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [models, setModels] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const listRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    vscode.postMessage({ type: 'getSettings' });

    function onMessage(event) {
      const message = event.data;

      if (message?.type === 'settingsLoaded') {
        setSettings({ ...DEFAULT_SETTINGS, ...(message.settings || {}) });
      }

      if (message?.type === 'modelsLoaded') {
        const next = Array.isArray(message.models) ? message.models : [];
        setModels(next);
        setIsLoadingModels(false);
      }

      if (message?.type === 'assistantMessage') {
        addMessage('assistant', message.text || '', 'now');
      }

      if (message?.type === 'errorMessage') {
        addMessage('system', message.text || 'Unknown error', 'error');
        setIsLoadingModels(false);
      }

      if (message?.type === 'replyStart') {
        setIsLoadingReply(true);
      }

      if (message?.type === 'replyEnd') {
        setIsLoadingReply(false);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isLoadingReply]);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  function addMessage(role, text, meta) {
    const value = String(text || '').trim();
    if (!value) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        role,
        text: value,
        meta
      }
    ]);
  }

  function saveSettings(nextSettings) {
    setSettings(nextSettings);
    vscode.postMessage({
      type: 'saveSettings',
      settings: nextSettings
    });
  }

  function loadModels() {
    if (!settings.apiKey.trim()) {
      addMessage('system', 'Enter API key first, then load models.', 'note');
      return;
    }

    setIsLoadingModels(true);
    vscode.postMessage({
      type: 'fetchModels',
      settings
    });
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();

    const text = input.trim();
    if (!text || isLoadingReply) {
      return;
    }

    if (!settings.apiKey || !settings.model) {
      addMessage('system', 'Open settings and set API key + model first.', 'note');
      return;
    }

    addMessage('user', text, 'you');
    setInput('');

    vscode.postMessage({
      type: 'sendMessage',
      text,
      settings
    });
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const modelOptions = useMemo(
    () => models.map((name) => ({ label: name, value: name })),
    [models]
  );

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">ARYX</div>
        <button
          className="icon-btn"
          type="button"
          title="Settings"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <Settings size={16} />
        </button>
      </div>

      {isSettingsOpen && (
        <div className="settings-panel">
          <div>
            <label className="field-label" htmlFor="providerSelect">
              Provider
            </label>
            <select
              id="providerSelect"
              value={settings.provider}
              onChange={(event) => {
                const next = { ...settings, provider: event.target.value };
                saveSettings(next);
              }}
            >
              <option value="google-gemini">Google Gemini</option>
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="apiKeyInput">
              API Key
            </label>
            <input
              id="apiKeyInput"
              type="password"
              placeholder="AIza..."
              value={settings.apiKey}
              onChange={(event) => setSettings((prev) => ({ ...prev, apiKey: event.target.value }))}
              onBlur={() => saveSettings(settings)}
            />
          </div>

          <div>
            <div className="settings-row">
              <label className="field-label" htmlFor="modelSelect">
                Model
              </label>
              <button className="text-btn" type="button" onClick={loadModels} disabled={isLoadingModels}>
                {isLoadingModels ? 'Loading...' : 'Load Models'}
              </button>
            </div>

            <select
              id="modelSelect"
              style={{ marginTop: '4px' }}
              value={settings.model}
              onChange={(event) => {
                const next = { ...settings, model: event.target.value };
                saveSettings(next);
              }}
            >
              <option value="">Select model</option>
              {modelOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && <div className="empty">How can I help you today?</div>}
        {messages.map((item) => (
          <div className={`message ${item.role}`} key={item.id}>
            <div className="bubble">{item.text}</div>
            {/* <div className="meta">{item.meta}</div> */}
          </div>
        ))}
        {isLoadingReply && (
          <div className="message assistant">
            <div className="bubble shimmer">Generating answer...</div>
          </div>
        )}
      </div>

      <div className="composer-container">
        <div className="chat-input-child">
          <div className="chat-input">
            <textarea
              ref={textareaRef}
              rows="1"
              placeholder="Ask anything"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            ></textarea>
          </div>
          <div className="chat-input-actions">
            <div className="chat-input-actions-left">
              <div className="action-dot">
                <Plus size={14}/>
              </div>
              <div className="action-dot">
                <Settings2 size={13} />
              </div>
            </div>
            <div className="chat-input-actions-right">
              <button 
                className="send-btn" 
                onClick={handleSubmit} 
                disabled={!input.trim() || isLoadingReply}
              >
                <ArrowUp size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
