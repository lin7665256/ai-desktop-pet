import { invoke } from '@tauri-apps/api/core';
import type {
  FileInfo,
  FileContent,
  ProcessingResult,
  KnowledgeProfile,
  FeedingError,
  FeedingErrorType,
  ProgressInfo,
  SummarizerConfig,
} from '../lib/types';
import { limits, petMessages } from '../lib/config';
import { extractText, isEmpty } from './fileParser';
import { summarize, updateInterestSignal } from './llm';
import { addFileToProfile, getRecentFilesForContext, getTopicsSummary } from '../lib/knowledge';

function createFeedingError(type: FeedingErrorType): FeedingError {
  return { type, message: petMessages[type] };
}

/**
 * Process a single file through the full feeding pipeline
 */
export async function processFile(
  llmConfig: SummarizerConfig,
  fileInfo: FileInfo,
  profile: KnowledgeProfile,
  onProgress: (info: ProgressInfo) => void,
): Promise<ProcessingResult> {
  // 1. Validate file type
  if (!limits.supportedExtensions.includes(fileInfo.extension.toLowerCase())) {
    throw createFeedingError('unsupported_format');
  }

  // 2. Validate file size
  if (fileInfo.size > limits.maxFileSizeBytes) {
    throw createFeedingError('file_too_large');
  }

  // 3. Read file from Rust
  onProgress({ stage: 'reading', message: `正在读取 ${fileInfo.name}...` });
  let fileContent: FileContent;
  try {
    fileContent = await invoke<FileContent>('read_file', { path: fileInfo.path });
  } catch {
    throw createFeedingError('read_failure');
  }

  // 4. Extract text
  onProgress({ stage: 'extracting', message: '提取文字中...' });
  let extraction;
  try {
    extraction = await extractText(fileInfo, fileContent.content, fileContent.is_binary);
  } catch {
    throw createFeedingError('read_failure');
  }

  if (isEmpty(extraction)) {
    throw createFeedingError('empty_content');
  }

  // 5. Summarize via LLM
  onProgress({ stage: 'summarizing', message: '消化中...' });
  const recentFiles = getRecentFilesForContext(profile);
  const topicsContext = getTopicsSummary(profile);

  let summary;
  try {
    summary = await summarize(
      llmConfig,
      extraction.text,
      recentFiles,
      topicsContext,
      (stage, message) => onProgress({ stage, message }),
    );
  } catch {
    throw createFeedingError('llm_failure');
  }

  return { fileInfo, extraction, summary };
}

/**
 * Process multiple files sequentially, updating the knowledge profile after each
 */
export async function processFiles(
  llmConfig: SummarizerConfig,
  files: FileInfo[],
  profile: KnowledgeProfile,
  onFileProgress: (info: ProgressInfo) => void,
  onFileComplete: (result: ProcessingResult, updatedProfile: KnowledgeProfile) => void,
  onFileError: (file: FileInfo, error: FeedingError) => void,
): Promise<KnowledgeProfile> {
  let currentProfile = profile;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      const result = await processFile(llmConfig, file, currentProfile, (info) =>
        onFileProgress({ ...info, fileIndex: i, totalFiles: files.length }),
      );

      currentProfile = addFileToProfile(
        currentProfile,
        file.name,
        result.summary.summary,
        result.summary.topics,
      );

      onFileComplete(result, currentProfile);
    } catch (err) {
      const error = err as FeedingError;
      onFileError(file, error);
    }
  }

  return currentProfile;
}

/**
 * Fire-and-forget Pass 2: update interest signal in background
 */
export function firePass2(
  llmConfig: SummarizerConfig,
  profile: KnowledgeProfile,
  newTopics: string[],
  onComplete: (signal: string) => void,
): void {
  updateInterestSignal(llmConfig, profile.interest_signal, profile.topics, newTopics)
    .then(onComplete)
    .catch((err) => {
      console.warn('[Pipeline] Pass 2 failed (non-critical):', err);
    });
}
