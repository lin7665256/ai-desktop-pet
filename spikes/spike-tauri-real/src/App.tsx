import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
}

interface WindowInfo {
  scaleFactor: number;
  innerSize: { width: number; height: number };
  position: { x: number; y: number };
  isAlwaysOnTop: boolean;
  isTransparent: boolean;
  isDecorated: boolean;
}

function App() {
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);
  const [clickThrough, setClickThrough] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [droppedFiles, setDroppedFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [petState, setPetState] = useState<"idle" | "thinking" | "done">("idle");
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  // 监听文件拖拽事件
  useEffect(() => {
    const unlisten = listen<FileInfo[]>("file-dropped", (event) => {
      const files = event.payload;
      setDroppedFiles((prev) => [...prev, ...files]);
      addLog(`收到 ${files.length} 个文件: ${files.map((f) => f.name).join(", ")}`);

      // 模拟处理流程
      setPetState("thinking");
      addLog("[Pass 1] 开始摘要...");

      setTimeout(() => {
        files.forEach((f) => {
          if (f.extension === "pdf") addLog(`[PDF] ${f.name} → 提取中`);
          else if (["txt", "md"].includes(f.extension)) addLog(`[Text] ${f.name} → 读取中`);
          else addLog(`[Skip] ${f.name} → 不支持: .${f.extension}`);
        });
        addLog("[Done] 投喂完成!");
        setPetState("done");
        setTimeout(() => setPetState("idle"), 2000);
      }, 1500);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addLog]);

  // 获取窗口信息
  useEffect(() => {
    invoke<WindowInfo>("get_window_info")
      .then(setWindowInfo)
      .catch((e) => addLog(`Error: ${e}`));
  }, [addLog]);

  // 切换鼠标穿透
  const handleToggleClickThrough = async () => {
    const newValue = !clickThrough;
    try {
      await invoke("toggle_click_through", { enabled: newValue });
      setClickThrough(newValue);
      addLog(`鼠标穿透: ${newValue ? "ON" : "OFF"}`);
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  // 切换置顶
  const handleToggleAlwaysOnTop = async () => {
    const newValue = !alwaysOnTop;
    try {
      await invoke("toggle_always_on_top", { enabled: newValue });
      setAlwaysOnTop(newValue);
      addLog(`置顶: ${newValue ? "ON" : "OFF"}`);
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  // 关闭窗口
  const handleClose = async () => {
    try {
      await invoke("close_window");
    } catch (e) {
      addLog(`Error: ${e}`);
    }
  };

  // 拖拽移动窗口
  const handleDragStart = async () => {
    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      addLog(`Drag error: ${e}`);
    }
    setIsDragging(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="app-container" onMouseDown={handleDragStart}>
      {/* 控制栏 */}
      <div className="control-bar" style={{ pointerEvents: clickThrough ? "none" : "auto" }}>
        <button className="ctrl-btn" onClick={handleToggleClickThrough} title="鼠标穿透">
          {clickThrough ? "🔓" : "🔒"}
        </button>
        <button className="ctrl-btn" onClick={handleToggleAlwaysOnTop} title="置顶">
          {alwaysOnTop ? "📌" : "📄"}
        </button>
        <button className="ctrl-btn close-btn" onClick={handleClose} title="关闭">
          ✕
        </button>
      </div>

      {/* 宠物主体 */}
      <div className={`pet-body ${petState} ${isDragging ? "dragging" : ""}`}>
        <div className="pet-face">
          <div className="eye left" />
          <div className="eye right" />
          <div className="mouth" />
        </div>
        <div className="pet-status">
          {petState === "idle" && "拖文件给我~"}
          {petState === "thinking" && "消化中..."}
          {petState === "done" && "吃饱了!"}
        </div>
      </div>

      {/* 拖拽提示 */}
      {isDragging && <div className="drag-hint">移动中...</div>}

      {/* 文件列表 */}
      {droppedFiles.length > 0 && (
        <div className="file-list" style={{ pointerEvents: clickThrough ? "none" : "auto" }}>
          <div className="file-header">已投喂 ({droppedFiles.length})</div>
          {droppedFiles.slice(-5).map((f, i) => (
            <div key={i} className="file-item">
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatSize(f.size)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 日志 */}
      {log.length > 0 && (
        <div className="log-panel" style={{ pointerEvents: clickThrough ? "none" : "auto" }}>
          {log.slice(0, 5).map((l, i) => (
            <div key={i} className="log-line">{l}</div>
          ))}
        </div>
      )}

      {/* 窗口信息 */}
      {windowInfo && (
        <div className="window-info">
          {windowInfo.innerSize.width}×{windowInfo.innerSize.height}
          {" @ "}
          {windowInfo.position.x},{windowInfo.position.y}
        </div>
      )}
    </div>
  );
}

export default App;
