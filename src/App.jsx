import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChatPage from './pages/ChatPage/ChatPage';
import { Settings, ExternalLink, LogOut } from 'lucide-react';
import './App.css';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);

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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addMessage(role, text, meta) {
    const value = String(text || '').trim();
    if (!value) return;

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

  function handleSubmit(event) {
    if (event) event.preventDefault();

    const text = input.trim();
    if (!text || isLoadingReply) return;

    if (!settings.apiKey || !settings.model) {
      addMessage('system', 'Open Settings tab and configure your API key + model first.', 'note');
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

  function handleNewChat() {
    setMessages([]);
    setInput('');
  }

  async function handleCopyMessage(messageId, text) {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setCopiedMessageId(messageId);
      setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1200);
    } catch {
      addMessage('system', 'Copy failed.', 'error');
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const openSettingsTab = () => {
    setIsMenuOpen(false);
    vscode.postMessage({ type: 'openSettings' });
  };

  // Static options for design as requested
  const staticEmail = "login email id";
  
  return (
    <div className="app-shell">
      {/* ── Top Toolbar ──────────────────────────── */}
      <div className="topbar">
        <div className="brand-small">Tasks</div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            type="button"
            title="History"
            onClick={() => addMessage('system', 'History is not available yet.', 'note')}
          >
            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-xs hover:opacity-80"><path d="M17.1348 10.5455C17.1348 7.04681 14.2986 4.21057 10.7998 4.21057C8.59509 4.21063 6.65256 5.33708 5.5176 7.04749H7.34963C7.7169 7.04749 8.01467 7.34525 8.01467 7.71252C8.01447 8.07963 7.71678 8.37756 7.34963 8.37756H4.09963C3.73265 8.37737 3.43479 8.07951 3.43459 7.71252V4.46252C3.43459 4.09537 3.73253 3.79768 4.09963 3.79749C4.4669 3.79749 4.76467 4.09526 4.76467 4.46252V5.81995C6.16735 4.03097 8.34882 2.88054 10.7998 2.88049C15.0331 2.88049 18.4649 6.31227 18.4649 10.5455C18.4649 14.7788 15.0331 18.2106 10.7998 18.2106C7.32665 18.2105 4.39432 15.9006 3.45217 12.735C3.34762 12.3831 3.54851 12.0126 3.90041 11.9078C4.25233 11.8033 4.62283 12.0042 4.72756 12.3561C5.50658 14.9731 7.93122 16.8804 10.7998 16.8805C14.2986 16.8805 17.1348 14.0443 17.1348 10.5455ZM10.1348 7.54553C10.1348 7.17832 10.4326 6.88058 10.7998 6.88049C11.1671 6.88049 11.4649 7.17826 11.4649 7.54553V10.5455C11.4649 10.7219 11.3952 10.8915 11.2705 11.0162L9.27053 13.0162C9.01096 13.2757 8.58981 13.2755 8.3301 13.0162C8.0704 12.7565 8.0704 12.3345 8.3301 12.0748L10.1348 10.2701V7.54553Z" fill="currentColor"></path></svg>
          </button>
          
          <div className="menu-container" ref={menuRef}>
            <button
              className="icon-btn"
              type="button"
              title="Settings"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-xs"><path fillRule="evenodd" clipRule="evenodd" d="M9.99944 7.24939C11.5169 7.2495 12.7473 8.47995 12.7475 9.99744C12.7475 11.5151 11.517 12.7454 9.99944 12.7455C8.48176 12.7455 7.2514 11.5151 7.2514 9.99744C7.25155 8.47988 8.48186 7.24939 9.99944 7.24939ZM9.99944 8.57947C9.2164 8.57947 8.58163 9.21442 8.58148 9.99744C8.58148 10.7806 9.2163 11.4154 9.99944 11.4154C10.7825 11.4153 11.4174 10.7805 11.4174 9.99744C11.4173 9.21449 10.7824 8.57958 9.99944 8.57947Z" fill="currentColor"></path><path fillRule="evenodd" clipRule="evenodd" d="M10.6391 1.67517C11.2939 1.67532 11.8991 2.02577 12.226 2.59314L13.2485 4.36755H15.2963C15.9505 4.36758 16.555 4.71709 16.8823 5.28357L17.5219 6.39001C17.8489 6.95668 17.8481 7.65542 17.5209 8.22205L16.4975 9.99451L17.5239 11.7689C17.8519 12.3357 17.8521 13.0347 17.5248 13.6019L16.8862 14.7084C16.559 15.2747 15.9543 15.6243 15.3002 15.6244H13.2514L12.2299 17.3988C11.9029 17.9663 11.297 18.3168 10.642 18.3168L9.3637 18.3158C8.71064 18.3155 8.10718 17.9678 7.77972 17.4027L6.74847 15.6234L4.69964 15.6244C4.04558 15.6242 3.44087 15.2747 3.1137 14.7084L2.47503 13.6019C2.14791 13.0349 2.14836 12.3366 2.47601 11.7699L3.50237 9.99548L2.47894 8.22205C2.15175 7.65533 2.15174 6.95673 2.47894 6.39001L3.11761 5.28259C3.44458 4.71663 4.04894 4.36813 4.70257 4.36755L6.75042 4.36658L7.77581 2.59119C8.10301 2.02476 8.7076 1.67527 9.36175 1.67517H10.6391ZM9.36273 3.00623C9.1835 3.00623 9.01679 3.10199 8.92718 3.2572L7.82659 5.16345C7.63652 5.49253 7.28473 5.69529 6.90472 5.69568L4.70355 5.69763C4.52451 5.69782 4.3585 5.79355 4.26898 5.94861L3.6303 7.05505C3.54091 7.2102 3.54077 7.40192 3.6303 7.55701L4.73089 9.46326C4.92108 9.7929 4.92135 10.1992 4.73089 10.5287L3.62737 12.4359C3.5378 12.591 3.53792 12.7817 3.62737 12.9369L4.26605 14.0433C4.35567 14.1982 4.52067 14.2932 4.69964 14.2933L6.90276 14.2943C7.28242 14.2946 7.63335 14.497 7.82366 14.8256L8.93011 16.7357C9.01984 16.8905 9.18578 16.9857 9.36468 16.9857H10.642C10.8213 16.9857 10.987 16.89 11.0766 16.7347L12.1752 14.8275C12.3653 14.4975 12.7182 14.2943 13.0991 14.2943H15.3002C15.4794 14.2942 15.6452 14.1985 15.7348 14.0433L16.3725 12.9379C16.4621 12.7826 16.4621 12.5911 16.3725 12.4359L15.27 10.5287C15.1032 10.2404 15.0808 9.89331 15.2055 9.59021L15.269 9.46326L16.3696 7.55701C16.4591 7.40189 16.459 7.21022 16.3696 7.05505L15.7309 5.94861C15.6412 5.79363 15.4754 5.69863 15.2963 5.69861L13.0951 5.69763L12.9535 5.68884C12.6751 5.65158 12.4217 5.50519 12.2504 5.28259L12.1723 5.16443L11.0737 3.2572C10.9841 3.10175 10.8175 3.00525 10.6381 3.00525L9.36273 3.00623Z" fill="currentColor"></path></svg>
            </button>

            {isMenuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item static-item">
                  {staticEmail}
                </div>
                <div className="dropdown-item static-item">
                  <ExternalLink size={14} />
                  Upgrade to higher limits
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-item clickable" onClick={openSettingsTab}>
                  <Settings size={14} />
                  Aryx settings
                </div>
                <div className="dropdown-item clickable">
                  <LogOut size={14} />
                  Logout
                </div>
              </div>
            )}
          </div>

          <button
            className="icon-btn"
            type="button"
            title="New Chat"
            onClick={handleNewChat}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-xs"><path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z" fill="currentColor"></path></svg>
          </button>
        </div>
      </div>

      <ChatPage 
        messages={messages}
        isLoadingReply={isLoadingReply}
        listRef={listRef}
        copiedMessageId={copiedMessageId}
        handleCopyMessage={handleCopyMessage}
        input={input}
        setInput={setInput}
        textareaRef={textareaRef}
        handleKeyDown={handleKeyDown}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
