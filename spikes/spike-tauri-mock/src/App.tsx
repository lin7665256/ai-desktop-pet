import { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'

// ─── Spike 1 Mock: Transparent Window + Click-Through ───
// Simulates Tauri 2 transparent always-on-top window behavior using pure web APIs.
// In real Tauri: appWindow.setDecorations(false), setAlwaysOnTop(true), setIgnoreCursorEvents(true)

interface PetPosition {
  x: number
  y: number
}

function TransparentWindowDemo() {
  const [clickThrough, setClickThrough] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [petPos, setPetPos] = useState<PetPosition>({ x: 120, y: 160 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (clickThrough) return
      setDragging(true)
      dragOffset.current = {
        x: e.clientX - petPos.x,
        y: e.clientY - petPos.y,
      }
    },
    [clickThrough, petPos],
  )

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragging) return
      setPetPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  return (
    <section className="demo-section">
      <h2>Spike 1 Mock: 透明窗口 + 鼠标穿透</h2>
      <p className="demo-desc">
        模拟 Tauri 2 的 <code>setDecorations(false)</code> + <code>setAlwaysOnTop(true)</code> +{' '}
        <code>setIgnoreCursorEvents(true/false)</code>
      </p>

      <div className="controls">
        <label className="toggle">
          <input type="checkbox" checked={clickThrough} onChange={(e) => setClickThrough(e.target.checked)} />
          <span>鼠标穿透 {clickThrough ? '(ON - 点击会穿过宠物)' : '(OFF - 可拖拽宠物)'}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={alwaysOnTop} onChange={(e) => setAlwaysOnTop(e.target.checked)} />
          <span>置顶 {alwaysOnTop ? '(ON)' : '(OFF)'}</span>
        </label>
      </div>

      <div className="desktop-sim">
        {/* Fake desktop background with "apps" */}
        <div className="fake-desktop">
          <div className="fake-app">
            <div className="fake-titlebar">VS Code</div>
            <div className="fake-content">
              <code>{'fn main() {\n  println!("Hello Tauri!");\n}'}</code>
            </div>
          </div>
          <div className="fake-app small">
            <div className="fake-titlebar">Terminal</div>
            <div className="fake-content terminal">$ cargo build --release</div>
          </div>
        </div>

        {/* Pet window overlay */}
        <div
          ref={windowRef}
          className={`pet-window ${dragging ? 'dragging' : ''} ${clickThrough ? 'click-through' : ''}`}
          style={{
            left: petPos.x,
            top: petPos.y,
            zIndex: alwaysOnTop ? 9999 : 1,
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="pet-body">
            <div className="pet-face">
              <div className="eye left" />
              <div className="eye right" />
              <div className="mouth" />
            </div>
            <div className="pet-label">
              {clickThrough ? '穿透中' : dragging ? '拖拽中...' : '拖我试试'}
            </div>
          </div>
          <div className="window-border-indicator" />
        </div>
      </div>

      <div className="tauri-code">
        <h4>真实 Tauri 2 实现要点：</h4>
        <pre>{`// src-tauri/src/main.rs
tauri::Builder::default()
  .setup(|app| {
    let win = app.get_webview_window("main").unwrap();
    win.set_decorations(false)?;      // 无边框
    win.set_always_on_top(true)?;     // 置顶
    win.set_transparent(true)?;       // 透明背景
    win.set_ignore_cursor_events(true)?; // 鼠标穿透(空白区域)
    Ok(())
  })

// tauri.conf.json
{
  "app": {
    "windows": [{
      "transparent": true,
      "decorations": false,
      "alwaysOnTop": true,
      "width": 200, "height": 200
    }]
  }
}`}</pre>
      </div>
    </section>
  )
}

// ─── Spike 2 Mock: File Drag-Drop ───
// Simulates Tauri 2 file drag-drop using HTML5 Drag & Drop API.
// In real Tauri: window.listen('tauri://file-drop', ...) or onFileDropEvent

interface DroppedFile {
  name: string
  size: number
  type: string
  lastModified: number
}

function FileDragDropDemo() {
  const [files, setFiles] = useState<DroppedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const droppedFiles: DroppedFile[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i]
        droppedFiles.push({
          name: f.name,
          size: f.size,
          type: f.type || 'unknown',
          lastModified: f.lastModified,
        })
      }

      if (droppedFiles.length === 0) return

      setFiles((prev) => [...prev, ...droppedFiles])
      addLog(`收到 ${droppedFiles.length} 个文件: ${droppedFiles.map((f) => f.name).join(', ')}`)

      // Simulate processing
      setProcessing(true)
      setTimeout(() => {
        droppedFiles.forEach((f) => {
          const isPdf = f.name.endsWith('.pdf')
          const isText = f.name.endsWith('.txt') || f.name.endsWith('.md')
          if (isPdf) addLog(`[Pass 1] ${f.name} → PDF 提取中...`)
          else if (isText) addLog(`[Pass 1] ${f.name} → 文本直接读取`)
          else addLog(`[Skip] ${f.name} → 不支持的类型: ${f.type}`)
        })
        addLog(`[Done] 投喂完成，宠物消化中...`)
        setProcessing(false)
      }, 1500)
    },
    [addLog],
  )

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <section className="demo-section">
      <h2>Spike 2 Mock: 文件拖拽接收</h2>
      <p className="demo-desc">
        使用 HTML5 Drag & Drop API 模拟 Tauri 2 的 <code>onFileDropEvent</code> / <code>tauri://file-drop</code>
      </p>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${processing ? 'processing' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {processing ? (
          <div className="drop-content">
            <div className="pet-eating">
              <div className="eat-face">
                <div className="eye left happy" />
                <div className="eye right happy" />
                <div className="mouth eating" />
              </div>
            </div>
            <p>宠物正在消化...</p>
          </div>
        ) : dragOver ? (
          <div className="drop-content">
            <div className="drop-icon">+</div>
            <p>松开投喂!</p>
          </div>
        ) : (
          <div className="drop-content">
            <div className="pet-idle">
              <div className="eat-face">
                <div className="eye left" />
                <div className="eye right" />
                <div className="mouth" />
              </div>
            </div>
            <p>拖拽文件到这里投喂</p>
            <span className="hint">支持 .pdf / .txt / .md</span>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h4>已投喂文件 ({files.length})</h4>
          <table>
            <thead>
              <tr>
                <th>文件名</th>
                <th>大小</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i}>
                  <td>{f.name}</td>
                  <td>{formatSize(f.size)}</td>
                  <td>{f.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div className="process-log">
          <h4>处理日志</h4>
          <pre>{log.join('\n')}</pre>
        </div>
      )}

      <div className="tauri-code">
        <h4>真实 Tauri 2 实现要点：</h4>
        <pre>{`// src-tauri/src/main.rs
tauri::Builder::default()
  .on_file_drop_event(|window, event| {
    match event {
      FileDropEvent::Dropped(paths, _pos) => {
        for path in paths {
          window.emit("file-dropped", &path)?;
        }
      }
      FileDropEvent::Hovered(_, _) => {}
      FileDropEvent::Cancelled => {}
      _ => {}
    }
    Ok(())
  })

// 前端监听
import { listen } from '@tauri-apps/api/event'
listen<string>('file-dropped', (event) => {
  // event.payload = 文件路径
  processFile(event.payload)
})

// tauri.conf.json
{ "app": { "windows": [{ "dragDropEnabled": true }] }}`}</pre>
      </div>
    </section>
  )
}

// ─── Main App ───
function App() {
  return (
    <div className="app">
      <header>
        <h1>Spike 1+2 Mock: Tauri 概念验证</h1>
        <p>纯 Web 模拟 Tauri 2 的透明窗口、鼠标穿透、文件拖拽行为。等 MSVC 就绪后替换为真实 Tauri API。</p>
      </header>
      <TransparentWindowDemo />
      <FileDragDropDemo />
    </div>
  )
}

export default App
