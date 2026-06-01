import type { KnowledgeProfile, RecentFile } from './types';

/**
 * Create an empty knowledge profile
 */
export function createEmptyProfile(): KnowledgeProfile {
  return {
    topics: [],
    interest_signal: '',
    recent_files: [],
  };
}

/**
 * Add a processed file to the knowledge profile (immutable update)
 */
export function addFileToProfile(
  profile: KnowledgeProfile,
  fileName: string,
  summary: string,
  topics: string[],
): KnowledgeProfile {
  const now = new Date().toISOString();

  // Update topic counts
  const updatedTopics = [...profile.topics];
  for (const topicName of topics) {
    const existing = updatedTopics.find((t) => t.name === topicName);
    if (existing) {
      existing.feed_count += 1;
      existing.last_fed = now;
    } else {
      updatedTopics.push({
        name: topicName,
        feed_count: 1,
        last_fed: now,
      });
    }
  }

  // Sort by feed_count descending
  updatedTopics.sort((a, b) => b.feed_count - a.feed_count);

  // Add to recent files (keep last 20)
  const newRecentFile: RecentFile = {
    name: fileName,
    fed_at: now,
    summary,
    topics,
  };
  const updatedRecentFiles = [newRecentFile, ...profile.recent_files].slice(0, 20);

  return {
    ...profile,
    topics: updatedTopics,
    recent_files: updatedRecentFiles,
  };
}

/**
 * Get recent files formatted for LLM context injection
 */
export function getRecentFilesForContext(
  profile: KnowledgeProfile,
  limit = 5,
): { name: string; summary: string }[] {
  return profile.recent_files.slice(0, limit).map((f) => ({
    name: f.name,
    summary: f.summary,
  }));
}

/**
 * Generate a human-readable summary of topic distribution
 */
export function getTopicsSummary(profile: KnowledgeProfile): string {
  if (profile.topics.length === 0) return '';
  return profile.topics
    .slice(0, 5)
    .map((t) => `${t.name}×${t.feed_count}份`)
    .join('、');
}
