import { useRef, useEffect } from 'react';
import type { ChatMessage } from '../lib/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onClose: () => void;
}

export default function ChatPanel({ messages, isProcessing, onClose }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-panel" onMouseDown={(e) => e.stopPropagation()}>
      <div className="chat-header">
        <span className="chat-title">对话</span>
        <button className="chat-close" onClick={onClose}>x</button>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">双击宠物或右键菜单开始对话。</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-content">{msg.content}</div>
          </div>
        ))}
        {isProcessing && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-content chat-typing">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
