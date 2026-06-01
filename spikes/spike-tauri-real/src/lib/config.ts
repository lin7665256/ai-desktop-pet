import type { SummarizerConfig } from './types';

// LLM API configuration - fill in your API key here
export const llmConfig: SummarizerConfig = {
  apiKey: 'YOUR_API_KEY_HERE',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

// Processing limits
export const limits = {
  maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
  supportedExtensions: ['txt', 'md', 'pdf'],
  maxDirectTokens: 8000,
  maxTotalTokens: 40000,
  chunkSize: 6000,
};

// Pet personality messages
export const petMessages = {
  unsupported_format: '这个格式我读不了。目前能吃 txt、md、pdf。',
  file_too_large: '太大了，啃不完。',
  empty_content: '这个文件好像没什么内容。',
  llm_failure: '处理出了点问题。要不要再试一次？',
  read_failure: '文件打不开了，检查一下路径？',
};
