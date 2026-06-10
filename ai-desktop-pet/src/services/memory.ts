import { invoke } from '@tauri-apps/api/core';
import type { Settings, CoreMemory } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/config';
import { createEmptyProfile } from '../lib/knowledge';

const SETTINGS_FILE = 'settings.json';
const MEMORY_FILE = 'core_memory.json';

/**
 * Load settings from disk. Returns null if not found (first run).
 */
export async function loadSettings(): Promise<Settings | null> {
  try {
    const content = await invoke<string | null>('read_app_json', { filename: SETTINGS_FILE });
    if (!content) return null;
    return JSON.parse(content) as Settings;
  } catch {
    return null;
  }
}

/**
 * Save settings to disk.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const content = JSON.stringify(settings, null, 2);
  await invoke('write_app_json', { filename: SETTINGS_FILE, content });
}

/**
 * Load core memory from disk. Returns null if not found.
 */
export async function loadCoreMemory(): Promise<CoreMemory | null> {
  try {
    const content = await invoke<string | null>('read_app_json', { filename: MEMORY_FILE });
    if (!content) return null;
    return JSON.parse(content) as CoreMemory;
  } catch {
    return null;
  }
}

/**
 * Save core memory to disk.
 */
export async function saveCoreMemory(memory: CoreMemory): Promise<void> {
  const content = JSON.stringify(memory, null, 2);
  await invoke('write_app_json', { filename: MEMORY_FILE, content });
}

/**
 * Create an empty core memory for a new user.
 */
export function createEmptyCoreMemory(petName: string, userName: string, userNote: string): CoreMemory {
  const now = new Date().toISOString();
  return {
    pet: {
      name: petName,
      created_at: now,
    },
    user: {
      name: userName,
      note: userNote,
    },
    knowledge_profile: createEmptyProfile(),
    stats: {
      total_feeds: 0,
      total_chats: 0,
      first_seen: now,
      last_active: now,
    },
    recent_files: [],
  };
}

/**
 * Check if this is the first run (no settings file exists).
 */
export async function isFirstRun(): Promise<boolean> {
  const settings = await loadSettings();
  return settings === null || !settings.llm.apiKey;
}

/**
 * Initialize settings with defaults if not present.
 */
export async function ensureSettings(): Promise<Settings> {
  const existing = await loadSettings();
  if (existing) return existing;
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
