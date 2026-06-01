import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useFeedingPipeline } from './hooks/useFeedingPipeline';
import type { WindowInfo } from './lib/types';

function App() {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);
  const [clickThrough, setClickThrough] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const {
    petState,
    currentProgress,
    lastResult,
    error,
    knowledgeProfile,
    processedFiles,
    dismissBubble,
  } = useFeedingPipeline();

  const addLog = useCallback((msg: string) => {
    setLog((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10),
    );
  }, []);

  // Fetch window info on mount
  useEffect(() => {
    invoke<WindowInfo>('get_window_info')
      .then(setWindowInfo)
      .catch((e) => addLog(`Error: ${e}`));
  }, [addLog]);

  // Log when processed files change
  useEffect(() => {
    if (lastResult) {
      const { fileInfo, summary } = lastResult;
      addLog(`✓ ${fileInfo.name} → ${summary.topics.join(', ')}`);
    }
  }, [lastResult, addLog]);

  useEffect(() => {
    if (error) {
      addLog(`✗ ${error.message}`);
    }
  }, [error, addLog]);

  const handleToggleClickThrough = async () => {
    const newValue = !clickThrough;
    try {
      await invoke('toggle_click_through', { enabled: newValue });
      setClickThrough(newValue);
      addLog(`鼠标穿透: ${newValue ? 'ON' : 'OFF'}`);
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    const newValue = !alwaysOnTop;
    try {
      await invoke('toggle_always_on_top', { enabled: newValue });
      setAlwaysOnTop(newValue);
      addLog(`置顶: ${newValue ? 'ON' : 'OFF'}`);
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_window');
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  const handleDragStart = async () => {
    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      addLog(`Drag error: ${e}`);
    }
    setIsDragging(false);
  };

  // Map pet states to CSS class
  const petCssClass =
    petState === 'reading' || petState === 'extracting' || petState === 'summarizing'
      ? 'thinking'
      : petState;

  // Status text based on pet state
  const statusText = (() => {
    switch (petState) {
      case 'idle':
        return '拖文件给我~';
      case 'reading':
      case 'extracting':
      case 'summarizing':
        return currentProgress || '消化中...';
      case 'done':
        return '吃饱了!';
      case 'error':
        return error?.message || '出错了';
      default:
        return '';
    }
  })();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="app-container" onMouseDown={handleDragStart}>
      {/* 控制栏 */}
      <div
        className="control-bar"
        style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
      >
        <button
          className="ctrl-btn"
          onClick={handleToggleClickThrough}
          title="鼠标穿透"
        >
          {clickThrough ? '🔓' : '🔒'}
        </button>
        <button
          className="ctrl-btn"
          onClick={handleToggleAlwaysOnTop}
          title="置顶"
        >
          {alwaysOnTop ? '📌' : '📄'}
        </button>
        <button className="ctrl-btn close-btn" onClick={handleClose} title="关闭">
          ✕
        </button>
      </div>

      {/* 气泡 */}
      {(petState === 'done' || petState === 'error') && lastResult && (
        <div
          className="bubble"
          onClick={dismissBubble}
          style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
        >
          <div className="bubble-text">{lastResult.summary.summary}</div>
          {lastResult.summary.relatedFile && (
            <div className="bubble-association">
              关联: {lastResult.summary.relatedFile}
            </div>
          )}
          {lastResult.summary.topics.length > 0 && (
            <div className="bubble-topics">
              {lastResult.summary.topics.map((t, i) => (
                <span key={i} className="topic-pill">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 进度气泡 (处理中) */}
      {(petState === 'reading' ||
        petState === 'extracting' ||
        petState === 'summarizing') &&
        currentProgress && (
          <div className="bubble bubble-progress">
            <div className="bubble-text">{currentProgress}</div>
          </div>
        )}

      {/* 错误气泡 */}
      {petState === 'error' && !lastResult && error && (
        <div
          className="bubble bubble-error"
          onClick={dismissBubble}
          style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
        >
          <div className="bubble-text">{error.message}</div>
        </div>
      )}

      {/* 宠物主体 */}
      <div className={`pet-body ${petCssClass} ${isDragging ? 'dragging' : ''}`}>
        <div className="pet-face">
          <div className="eye left" />
          <div className="eye right" />
          <div className="mouth" />
        </div>
        <div className="pet-status">{statusText}</div>
      </div>

      {/* 拖拽提示 */}
      {isDragging && <div className="drag-hint">移动中...</div>}

      {/* 知识画像摘要 */}
      {knowledgeProfile.topics.length > 0 && (
        <div
          className="knowledge-summary"
          style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
        >
          {knowledgeProfile.topics.slice(0, 3).map((t, i) => (
            <span key={i} className="topic-pill">
              {t.name}×{t.feed_count}
            </span>
          ))}
        </div>
      )}

      {/* 已投喂文件列表 */}
      {processedFiles.length > 0 && (
        <div
          className="file-list"
          style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
        >
          <div className="file-header">已投喂 ({processedFiles.length})</div>
          {processedFiles
            .slice(-5)
            .reverse()
            .map((f, i) => (
              <div key={i} className="file-item">
                <div className="file-info-col">
                  <span className="file-name">{f.fileInfo.name}</span>
                  {f.summary.topics.length > 0 && (
                    <div className="file-topics">
                      {f.summary.topics.map((t, j) => (
                        <span key={j} className="topic-pill-sm">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="file-size">{formatSize(f.fileInfo.size)}</span>
              </div>
            ))}
        </div>
      )}

      {/* 日志 */}
      {log.length > 0 && (
        <div
          className="log-panel"
          style={{ pointerEvents: clickThrough ? 'none' : 'auto' }}
        >
          {log.slice(0, 5).map((l, i) => (
            <div key={i} className="log-line">
              {l}
            </div>
          ))}
        </div>
      )}

      {/* 窗口信息 */}
      {windowInfo && (
        <div className="window-info">
          {windowInfo.innerSize.width}×{windowInfo.innerSize.height}
          {' @ '}
          {windowInfo.position.x},{windowInfo.position.y}
        </div>
      )}
    </div>
  );
}

export default App;
