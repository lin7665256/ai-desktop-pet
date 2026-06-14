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
    const raw = JSON.parse(content);
    // Migrate: strip legacy top-level recent_files (moved to knowledge_profile)
    delete raw.recent_files;
    // Migrate: prune orphan topics and recalculate feed_count from actual file refs
    if (raw.knowledge_profile) {
      const kp = raw.knowledge_profile;
      const topicCountMap = new Map<string, number>();
      for (const f of kp.recent_files || []) {
        for (const t of f.topics || []) {
          topicCountMap.set(t, (topicCountMap.get(t) || 0) + 1);
        }
      }
      if (kp.topics) {
        kp.topics = kp.topics
          .filter((t: { name: string }) => topicCountMap.has(t.name))
          .map((t: { name: string; feed_count: number; last_fed: string }) => ({
            ...t,
            feed_count: topicCountMap.get(t.name) || 0,
          }));
      }
    }
    return raw as CoreMemory;
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
