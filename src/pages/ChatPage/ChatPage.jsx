import React from 'react';
import { Copy, Check } from 'lucide-react';
import AryxLogo from '../../components/AryxLogo/AryxLogo';
import ThinkingDots from '../../components/ThinkingDots/ThinkingDots';
import './ChatPage.css';

export default function ChatPage({
  messages,
  isLoadingReply,
  listRef,
  copiedMessageId,
  handleCopyMessage,
  input,
  setInput,
  textareaRef,
  handleKeyDown,
  handleSubmit
}) {
  return (
    <>
      {/* ── Aryx-style loading bar ─────────────── */}
      {isLoadingReply && <div className="loading-bar" />}

      {/* ── Message Thread ──────────────────────── */}
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">
            <AryxLogo size={56} />
          </div>
        )}
        {messages.map((item) => (
          <div className={`message ${item.role}`} key={item.id}>
            <div className="message-row">
              <div className="bubble">{item.text}</div>
            </div>
            {(item.role === 'user' || item.role === 'assistant') && (
              <div className="copy-row">
                <button
                  className="copy-btn"
                  type="button"
                  title="Copy"
                  onClick={() => handleCopyMessage(item.id, item.text)}
                >
                  {copiedMessageId === item.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            )}
            {/* <div className="meta">{item.meta}</div> */}
          </div>
        ))}
        {isLoadingReply && (
          <div className="message assistant">
            <div className="bubble shimmer">
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* ── Composer ────────────────────────────── */}
      <div className="composer-container">
        <div className="chat-input-child">
          <div className="chat-input">
            <textarea
              ref={textareaRef}
              rows="2"
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            ></textarea>
          </div>
          <div className="chat-input-actions">
            <div className="chat-input-actions-left">
              <div className="action-dot" title="Attach">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-sm"><path d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z" fill="currentColor"></path></svg>
              </div>
              <div className="action-dot" title="Options">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-2xs"><g><path d="M8.13037 3.71927L5.33252 5.20023V8.42289L7.89697 6.94242L7.94873 6.90775C8.06253 6.82002 8.13037 6.68363 8.13037 6.53763V3.71927ZM5.23389 1.52005C5.10743 1.44704 4.95515 1.43799 4.82227 1.49271L4.7666 1.52005L2.16309 3.0225L5.00488 4.62113L7.92383 3.07572L7.89697 3.05765L5.23389 1.52005ZM1.86963 6.53763C1.86963 6.70452 1.95852 6.85894 2.10303 6.94242L4.66748 8.4224V5.19437L1.86963 3.62015V6.53763ZM8.79541 6.53763C8.79541 6.91694 8.60593 7.26936 8.29346 7.47855L8.22949 7.5181L5.56641 9.0557C5.23795 9.24533 4.83786 9.2573 4.50049 9.09134L4.43408 9.0557L1.77051 7.5181C1.42032 7.31582 1.20459 6.94206 1.20459 6.53763V3.46244C1.20459 3.05801 1.42032 2.68425 1.77051 2.48197L4.43408 0.94437L4.50049 0.908726C4.83786 0.742764 5.23795 0.754738 5.56641 0.94437L8.22949 2.48197L8.29346 2.52152C8.60593 2.7307 8.79541 3.08313 8.79541 3.46244V6.53763Z" fill="currentColor"></path></g></svg>
              </div>
            </div>
            <div className="chat-input-actions-right">
              <button 
                className="send-btn" 
                onClick={handleSubmit} 
                disabled={!input.trim() || isLoadingReply}
                title="Send"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-sm text-token-dropdown-background"><path d="M9.33467 16.6663V4.93978L4.6374 9.63704L4.1667 9.16634L3.69599 8.69661L9.52998 2.86263L9.63447 2.77767C9.8925 2.60753 10.2433 2.63564 10.4704 2.86263L16.3034 8.69661L16.3884 8.80111C16.5588 9.05922 16.5306 9.40982 16.3034 9.63704C16.0762 9.86414 15.7255 9.89242 15.4675 9.722L15.363 9.63704L10.6647 4.9388V16.6663C10.6647 17.0336 10.367 17.3314 9.99971 17.3314C9.63259 17.3312 9.33467 17.0335 9.33467 16.6663ZM4.6374 9.63704C4.3777 9.89674 3.95569 9.89674 3.69599 9.63704C3.43657 9.37744 3.43668 8.95628 3.69599 8.69661L4.6374 9.63704Z" fill="currentColor"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
