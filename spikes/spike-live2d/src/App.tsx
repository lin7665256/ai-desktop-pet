import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

// Register PIXI globally for pixi-live2d-display
;(window as any).PIXI = PIXI

// Sample model URLs (Cubism 4 format, hosted by pixi-live2d-display)
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json'

type PetState = 'idle' | 'thinking' | 'done'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const [state, setState] = useState<PetState>('idle')
  const [status, setStatus] = useState<string>('初始化中...')
  const [error, setError] = useState<string>('')

  // Initialize PixiJS + Live2D
  useEffect(() => {
    if (!canvasRef.current) return

    const app = new PIXI.Application({
      view: canvasRef.current,
      width: 400,
      height: 500,
      backgroundAlpha: 0, // transparent background
      antialias: true,
    })
    appRef.current = app

    // Load Live2D model
    setStatus('加载 Live2D 模型...')
    Live2DModel.from(MODEL_URL)
      .then((model) => {
        modelRef.current = model
        app.stage.addChild(model)

        // Scale and position model to fit canvas
        const scale = Math.min(
          app.screen.width / model.width,
          app.screen.height / model.height
        ) * 0.8
        model.scale.set(scale)
        model.x = app.screen.width / 2 - (model.width * scale) / 2
        model.y = app.screen.height - model.height * scale

        // Start idle motion
        model.motion('idle')
        setStatus('模型加载成功 - idle 状态')
      })
      .catch((err) => {
        console.error('Failed to load model:', err)
        setError(`模型加载失败: ${err.message}`)
        setStatus('加载失败')
      })

    return () => {
      app.destroy(true, { children: true })
    }
  }, [])

  // Switch animation state
  useEffect(() => {
    const model = modelRef.current
    if (!model) return

    switch (state) {
      case 'idle':
        model.motion('idle')
        setStatus('idle - 待机动画')
        break
      case 'thinking':
        // Use a different motion group for "thinking"
        // Haru model has motion groups: idle, tap_body, tap_head
        model.motion('tap_body')
        setStatus('thinking - 处理中动画')
        break
      case 'done':
        model.motion('tap_head')
        setStatus('done - 完成动画')
        break
    }
  }, [state])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      fontFamily: 'monospace',
      background: '#1a1a2e',
      minHeight: '100vh',
      color: '#eee',
    }}>
      <h2>Spike 3: pixi-live2d-display 验证</h2>

      {/* Live2D Canvas */}
      <div style={{
        border: '2px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        // Checkerboard pattern to verify transparency
        backgroundImage: 'linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      }}>
        <canvas ref={canvasRef} width={400} height={500} />
      </div>

      {/* Status */}
      <p style={{ color: error ? '#f44' : '#8f8' }}>{error || status}</p>

      {/* Animation Controls */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {(['idle', 'thinking', 'done'] as PetState[]).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              border: state === s ? '2px solid #4fc3f7' : '2px solid #555',
              borderRadius: '6px',
              background: state === s ? '#4fc3f7' : '#333',
              color: state === s ? '#000' : '#eee',
              cursor: 'pointer',
              fontWeight: state === s ? 'bold' : 'normal',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Checklist */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: '#222',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h3>验收清单</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>☐ 模型正确显示在透明背景上（棋盘格可见）</li>
          <li>☐ 点击 idle 按钮 → 待机动画播放</li>
          <li>☐ 点击 thinking 按钮 → 切换动作</li>
          <li>☐ 点击 done 按钮 → 切换动作</li>
          <li>☐ 动画流畅，无明显卡顿</li>
          <li>☐ 内存占用合理（&lt; 100MB）</li>
        </ul>
      </div>
    </div>
  )
}

export default App
