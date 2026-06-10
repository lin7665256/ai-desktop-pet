import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { LIVE2D_MODEL_URL } from '../lib/config';
import type { PetState } from '../lib/types';

// Register PIXI globally for pixi-live2d-display
(window as any).PIXI = PIXI;

interface PetProps {
  state: PetState;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
}

/** Check if WebGL is usable in this environment */
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Check if we get valid parameters (WebView2 sometimes returns 0)
    const maxUniforms = (gl as WebGLRenderingContext).getParameter(
      (gl as WebGLRenderingContext).MAX_VERTEX_UNIFORM_VECTORS,
    );
    return maxUniforms > 0;
  } catch {
    return false;
  }
}

export default function Pet({ state, onDoubleClick, onContextMenu, onDragStart }: PetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Initialize PixiJS + Live2D on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    // Check WebGL support first
    if (!checkWebGLSupport()) {
      console.warn('[Pet] WebGL not supported, using CSS fallback');
      setWebglFailed(true);
      return;
    }

    try {
      const app = new PIXI.Application({
        view: canvasRef.current,
        width: 300,
        height: 400,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      // Disable PixiJS event system entirely - all pet interaction
      // (drag, double-click, context menu) is handled via React DOM events,
      // and Live2DModel children lack isInteractive() causing hit-test crashes.
      const events = (app.renderer as any).events;
      if (events) {
        events.removeEvents();
        events.domElement = null; // prevent re-attaching DOM listeners
      }
      appRef.current = app;

      // Load Live2D model
      Live2DModel.from(LIVE2D_MODEL_URL)
        .then((model) => {
          modelRef.current = model;
          app.stage.addChild(model as any);

          const scale = Math.min(
            app.screen.width / model.width,
            app.screen.height / model.height,
          ) * 0.85;
          model.scale.set(scale);
          model.x = app.screen.width / 2 - (model.width * scale) / 2;
          model.y = app.screen.height - model.height * scale;

          model.motion('idle');
        })
        .catch((err) => {
          console.error('[Pet] Failed to load Live2D model:', err);
          setWebglFailed(true);
        });

      return () => {
        // Use false to NOT remove canvas from DOM - let React manage DOM
        app.destroy(false, { children: true });
      };
    } catch (err) {
      console.error('[Pet] PixiJS init failed:', err);
      setWebglFailed(true);
    }
  }, []);

  // Switch animation state when petState changes
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    try {
      switch (state) {
        case 'idle':
          model.motion('idle');
          break;
        case 'reading':
        case 'extracting':
        case 'summarizing':
          model.motion('tap_body');
          break;
        case 'done':
          model.motion('tap_head');
          break;
        case 'error':
          model.motion('tap_body');
          break;
      }
    } catch (err) {
      console.warn('[Pet] Motion error:', err);
    }
  }, [state]);

  // Map pet state to CSS class for visual feedback
  const cssState =
    state === 'reading' || state === 'extracting' || state === 'summarizing'
      ? 'thinking'
      : state;

  // --- Drag vs click detection ---
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5; // px

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left button triggers drag detection
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragStartPos.current = null; // prevent re-trigger
        onDragStart?.();
      }
    };
    const handleMouseUp = () => {
      dragStartPos.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onDragStart]);

  const containerProps = {
    className: `pet-container ${cssState}`,
    onMouseDown: handleMouseDown,
    onDoubleClick,
    onContextMenu,
  };

  // CSS fallback pet when WebGL fails
  if (webglFailed) {
    return (
      <div {...containerProps} className={`pet-container pet-fallback ${cssState}`}>
        <div className="pet-css-body">
          <div className="pet-css-face">
            <div className="pet-css-eye pet-css-eye-left" />
            <div className="pet-css-eye pet-css-eye-right" />
            <div className="pet-css-mouth" />
          </div>
          <div className="pet-css-label">
            {state === 'idle' ? '利落' : state === 'done' ? '✓' : '...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...containerProps}>
      <canvas ref={canvasRef} width={300} height={400} style={{ pointerEvents: 'none' }} />
    </div>
  );
}
