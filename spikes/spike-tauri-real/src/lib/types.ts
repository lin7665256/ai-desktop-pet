// === File Info (matches Rust FileInfo struct) ===
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
}

// === Window info (matches Rust get_window_info response) ===
export interface WindowInfo {
  scaleFactor: number;
  innerSize: { width: number; height: number };
  position: { x: number; y: number };
  isAlwaysOnTop: boolean;
  isTransparent: boolean;
  isDecorated: boolean;
}

// === File content from Rust read_file command ===
export interface FileContent {
  content: string;
  is_binary: boolean;
  size: number;
}

// === Text extraction result ===
export interface ExtractionResult {
  text: string;
  pageCount?: number;
  extractionTimeMs: number;
}

// === LLM summarizer types ===
export interface SummarizerConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface SummaryResult {
  summary: string;
  topics: string[];
  relatedFile: string | null;
  tokenCount: number;
  strategy: 'direct' | 'map-reduce' | 'truncated';
  chunks?: number;
  apiCalls: number;
  totalTimeMs: number;
}

// === Knowledge profile types ===
export interface TopicEntry {
  name: string;
  feed_count: number;
  last_fed: string;
}

export interface RecentFile {
  name: string;
  fed_at: string;
  summary: string;
  topics: string[];
}

export interface KnowledgeProfile {
  topics: TopicEntry[];
  interest_signal: string;
  recent_files: RecentFile[];
}

// === Pipeline types ===
export type PetState =
  | 'idle'
  | 'reading'
  | 'extracting'
  | 'summarizing'
  | 'done'
  | 'error';

export type FeedingErrorType =
  | 'unsupported_format'
  | 'file_too_large'
  | 'empty_content'
  | 'llm_failure'
  | 'read_failure';

export interface FeedingError {
  type: FeedingErrorType;
  message: string;
}

export interface ProcessingResult {
  fileInfo: FileInfo;
  extraction: ExtractionResult;
  summary: SummaryResult;
}

export interface ProgressInfo {
  stage: string;
  message: string;
  fileIndex?: number;
  totalFiles?: number;
}
