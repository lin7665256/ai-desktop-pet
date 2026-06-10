import type { Settings, FeedingErrorType } from './types';

// Processing limits
export const limits = {
  maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
  supportedExtensions: ['txt', 'md', 'pdf'],
  maxDirectTokens: 8000,
  maxTotalTokens: 40000,
  chunkSize: 6000,
};

// Pet personality error messages
export const petMessages: Record<FeedingErrorType, string> = {
  unsupported_format: '这个格式我读不了。目前能吃 txt、md、pdf。',
  file_too_large: '太大了，啃不完。',
  empty_content: '这个文件好像没什么内容。',
  llm_failure: '处理出了点问题。要不要再试一次？',
  read_failure: '文件打不开了，检查一下路径？',
};

// Default settings for new users
export const DEFAULT_SETTINGS: Settings = {
  llm: {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  pet: {
    name: '利落',
  },
  user: {
    name: '',
    note: '',
  },
};

// Live2D model URL (CDN for MVP)
export const LIVE2D_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';

// Bubble display duration in ms
export const BUBBLE_DISPLAY_MS = 8000;

// Forbidden phrases for personality post-processing
export const FORBIDDEN_PHRASES = [
  '作为AI',
  '作为一个AI',
  '作为AI助手',
  '好的呢',
  '好的哦',
  '好的呀',
  '亲',
  '宝',
  '宝贝',
  '我很高兴帮助你',
  '我很开心能帮助你',
  '请问还有什么我可以帮您的吗',
  '让我来为您',
  '我理解您的需求',
  '抱歉给您带来不便',
];
