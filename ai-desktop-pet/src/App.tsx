import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppView, Settings, CoreMemory, BubbleData } from './lib/types';
import { petMessages } from './lib/config';
import { loadSettings, saveSettings, loadCoreMemory, saveCoreMemory, createEmptyCoreMemory } from './services/memory';
import { usePetState } from './hooks/usePetState';
import { useChat } from './hooks/useChat';
import Pet from './components/Pet';
import Bubble from './components/Bubble';
import ContextMenu from './components/ContextMenu';
import SettingsPanel from './components/Settings';
import Onboarding from './components/Onboarding';
import ChatPanel from './components/ChatPanel';
import './styles/app.css';

function App() {
  // === App state ===
  const [view, setView] = useState<AppView>('main');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [coreMemory, setCoreMemory] = useState<CoreMemory | null>(null);
  const [loading, setLoading] = useState(true);

  // === Context menu state ===
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // === Pet state (feeding pipeline) ===
  const {
    petState,
    currentProgress,
    lastResult,
    error,
    knowledgeProfile,
    setKnowledgeProfile,
    processedFiles,
    dismissBubble,
  } = usePetState(settings);

  // === Chat ===
  const chat = useChat(settings, coreMemory);

  // === Ref to avoid stale closures in effects ===
  const coreMemoryRef = useRef(coreMemory);
  useEffect(() => { coreMemoryRef.current = coreMemory; }, [coreMemory]);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // === Initialize: load settings + memory ===
  useEffect(() => {
    (async () => {
      try {
        console.log('[App] Loading settings...');
        const s = await loadSettings();
        console.log('[App] Settings loaded:', s ? 'yes' : 'no (first run)');
        const m = await loadCoreMemory();
        console.log('[App] Core memory loaded:', m ? 'yes' : 'no');

        if (!s || !s.llm.apiKey) {
          setSettings(s);
          setView('onboarding');
        } else {
          setSettings(s);
          setCoreMemory(m);
          setView('main');
        }
      } catch (err) {
        console.error('[App] Init error:', err);
        // On any error, show onboarding
        setView('onboarding');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // === Save core memory when knowledge profile changes ===
  useEffect(() => {
    const cm = coreMemoryRef.current;
    const s = settingsRef.current;
    if (!cm || !s) return;

    const updatedMemory: CoreMemory = {
      pet: cm.pet,
      user: cm.user,
      knowledge_profile: knowledgeProfile,
      stats: {
        ...cm.stats,
        total_feeds: processedFiles.length,
        last_active: new Date().toISOString(),
      },
    };

    setCoreMemory(updatedMemory);
    saveCoreMemory(updatedMemory).catch(console.error);
  }, [knowledgeProfile, processedFiles]);

  // === Onboarding complete ===
  const handleOnboardingComplete = useCallback(async (newSettings: Settings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);

    const memory = createEmptyCoreMemory(
      newSettings.pet.name,
      newSettings.user.name,
      newSettings.user.note,
    );
    await saveCoreMemory(memory);
    setCoreMemory(memory);
    setKnowledgeProfile(memory.knowledge_profile);

    setView('main');
  }, [setKnowledgeProfile]);

  // === Settings save ===
  const handleSettingsSave = useCallback(async (newSettings: Settings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);

    // Update core memory if user/pet info changed
    if (coreMemory) {
      const updated = {
        ...coreMemory,
        pet: { ...coreMemory.pet, name: newSettings.pet.name },
        user: { name: newSettings.user.name, note: newSettings.user.note },
      };
      await saveCoreMemory(updated);
      setCoreMemory(updated);
    }
  }, [coreMemory]);

  // === Derive bubble data from pet state ===
  const bubbleData: BubbleData | null = useMemo(() => {
    if (petState === 'idle') return null;

    if (petState === 'error' && error) {
      return {
        type: 'error',
        text: petMessages[error.type] || error.message,
      };
    }

    if (petState === 'done' && lastResult) {
      return {
        type: 'summary',
        text: lastResult.summary.summary,
        topics: lastResult.summary.topics,
        relatedFile: lastResult.fileInfo.name,
      };
    }

    if (currentProgress) {
      return {
        type: 'progress',
        text: currentProgress,
      };
    }

    return null;
  }, [petState, error, lastResult, currentProgress]);

  // === Context menu handlers ===
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleContextMenuChat = useCallback(() => {
    setContextMenu(null);
    chat.openChat();
  }, [chat]);

  const handleContextMenuSettings = useCallback(() => {
    setContextMenu(null);
    setView('settings');
  }, []);

  const handleContextMenuQuit = useCallback(() => {
    invoke('close_window').catch(console.error);
  }, []);

  // === Double click → open chat ===
  const handleDoubleClick = useCallback(() => {
    chat.openChat();
  }, [chat]);

  // === Drag window from pet body ===
  const handleDragStart = useCallback(() => {
    getCurrentWindow().startDragging().catch(console.error);
  }, []);

  // === Chat send ===
  const handleChatSend = useCallback(async (text: string) => {
    await chat.sendMessage(text);
  }, [chat]);

  // === Loading state ===
  if (loading) {
    return (
      <>
        <div className="drag-handle" onMouseDown={() => getCurrentWindow().startDragging()} />
        <div style={{ color: '#888', fontSize: 14, textAlign: 'center', paddingTop: 200, fontFamily: 'sans-serif' }}>
          初始化中...
        </div>
      </>
    );
  }

  // === Onboarding view ===
  if (view === 'onboarding') {
    return (
      <>
        <div className="drag-handle" onMouseDown={() => getCurrentWindow().startDragging()} />
        <Onboarding onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // === Main view ===
  return (
    <div className="app-container">
      {/* Invisible drag handle at top */}
      <div
        className="drag-handle"
        onMouseDown={() => getCurrentWindow().startDragging()}
      />
      {/* Bubble area */}
      {bubbleData && !chat.isVisible && (
        <Bubble data={bubbleData} onDismiss={dismissBubble} autoDismiss={bubbleData.type !== 'progress'} />
      )}

      {/* Chat panel (integrated with input) */}
      {chat.isVisible && (
        <ChatPanel
          messages={chat.messages}
          isProcessing={chat.isProcessing}
          onClose={chat.closeChat}
          onSend={handleChatSend}
        />
      )}

      {/* Pet (compact when chat is open) */}
      <Pet
        state={petState}
        compact={chat.isVisible}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
      />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onChat={handleContextMenuChat}
          onSettings={handleContextMenuSettings}
          onQuit={handleContextMenuQuit}
        />
      )}

      {/* Settings overlay */}
      {view === 'settings' && settings && (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setView('main')}
        />
      )}
    </div>
  );
}

export default App;
