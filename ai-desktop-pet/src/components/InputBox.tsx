import { useState, useRef, useEffect } from 'react';

interface InputBoxProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export default function InputBox({ onSend, onCancel, isProcessing }: InputBoxProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    console.log('[InputBox] mounted, input focused:', !!document.activeElement);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="input-box-overlay" onClick={onCancel}>
      <form
        className="input-box"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
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
