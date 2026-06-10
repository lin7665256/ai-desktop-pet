import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onChat: () => void;
  onSettings: () => void;
  onQuit: () => void;
}

export default function ContextMenu({ x, y, onClose, onChat, onSettings, onQuit }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position so menu doesn't go off screen
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 1000,
  };

  return (
    <div className="context-menu" ref={menuRef} style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="context-menu-hint">拖文件到窗口投喂</div>
      <button className="context-menu-item" onClick={onChat}>对话</button>
      <button className="context-menu-item" onClick={onSettings}>设置</button>
      <div className="context-menu-sep" />
      <button className="context-menu-item context-menu-danger" onClick={onQuit}>退出</button>
    </div>
  );
}
