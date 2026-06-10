import { useRef, useEffect, useState, useCallback } from 'react';
import type { ChatMessage } from '../lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, isProcessing, onClose, onSend }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onSend(text.trim());
      setText('');
    }
  }, [text, isProcessing, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <div className="chat-panel" onMouseDown={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="chat-header">
        <span className="chat-title">对话</span>
        <button className="chat-close" onClick={onClose}>×</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">拖拽文件给我，或在这里输入消息开始对话。</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-content">{msg.content}</div>
          </div>
        ))}
        {isProcessing && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-content chat-typing">思考中...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="input-field"
          placeholder="说点什么..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
        />
        <button type="submit" className="input-send" disabled={!text.trim() || isProcessing}>
          {isProcessing ? '...' : '→'}
        </button>
      </form>
    </div>
  );
}
