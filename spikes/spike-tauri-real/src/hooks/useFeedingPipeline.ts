import { useState, useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type {
  FileInfo,
  PetState,
  KnowledgeProfile,
  ProcessingResult,
  FeedingError,
  ProgressInfo,
} from '../lib/types';
import { createEmptyProfile } from '../lib/knowledge';
import { processFiles, firePass2 } from '../lib/pipeline';

const BUBBLE_DISPLAY_MS = 8000;

export function useFeedingPipeline() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [currentProgress, setCurrentProgress] = useState('');
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<FeedingError | null>(null);
  const [knowledgeProfile, setKnowledgeProfile] = useState<KnowledgeProfile>(createEmptyProfile);
  const [processedFiles, setProcessedFiles] = useState<
    (ProcessingResult & { fedAt: string })[]
  >([]);

  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(knowledgeProfile);
  profileRef.current = knowledgeProfile;

  const clearBubbleTimer = useCallback(() => {
    if (bubbleTimer.current) {
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = null;
    }
  }, []);

  const scheduleIdleReset = useCallback(() => {
    clearBubbleTimer();
    bubbleTimer.current = setTimeout(() => {
      setPetState('idle');
      setCurrentProgress('');
    }, BUBBLE_DISPLAY_MS);
  }, [clearBubbleTimer]);

  const feedFiles = useCallback(
    async (files: FileInfo[]) => {
      if (files.length === 0) return;

      clearBubbleTimer();
      setPetState('reading');
      setCurrentProgress(`收到 ${files.length} 个文件...`);
      setError(null);
      setLastResult(null);

      const allNewTopics: string[] = [];

      await processFiles(
        files,
        profileRef.current,
        // onFileProgress
        (info: ProgressInfo) => {
          const prefix = info.totalFiles && info.totalFiles > 1
            ? `[${(info.fileIndex ?? 0) + 1}/${info.totalFiles}] `
            : '';
          setCurrentProgress(prefix + info.message);
          setPetState(info.stage as PetState);
        },
        // onFileComplete
        (result: ProcessingResult, updatedProfile: KnowledgeProfile) => {
          setKnowledgeProfile(updatedProfile);
          setProcessedFiles((prev) => [
            ...prev,
            { ...result, fedAt: new Date().toISOString() },
          ]);
          setLastResult(result);
          allNewTopics.push(...result.summary.topics);

          // Show done state
          setPetState('done');
          setCurrentProgress('');
          scheduleIdleReset();
        },
        // onFileError
        (file: FileInfo, err: FeedingError) => {
          console.warn(`[Pipeline] Error processing ${file.name}:`, err);
          setError(err);
          setPetState('error');
          scheduleIdleReset();
        },
      );

      // Fire Pass 2 in background (non-blocking)
      if (allNewTopics.length > 0) {
        firePass2(profileRef.current, allNewTopics, (signal) => {
          setKnowledgeProfile((prev) => ({ ...prev, interest_signal: signal }));
        });
      }
    },
    [clearBubbleTimer, scheduleIdleReset],
  );

  // Listen for Tauri file-dropped events
  useEffect(() => {
    const unlisten = listen<FileInfo[]>('file-dropped', (event) => {
      feedFiles(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [feedFiles]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearBubbleTimer();
  }, [clearBubbleTimer]);

  const dismissBubble = useCallback(() => {
    clearBubbleTimer();
    setPetState('idle');
    setCurrentProgress('');
    setLastResult(null);
    setError(null);
  }, [clearBubbleTimer]);

  return {
    petState,
    currentProgress,
    lastResult,
    error,
    knowledgeProfile,
    processedFiles,
    feedFiles,
    dismissBubble,
  };
}
