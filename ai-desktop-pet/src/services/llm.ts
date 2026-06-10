import OpenAI from 'openai';
import { encodingForModel } from 'js-tiktoken';
import type { SummarizerConfig, SummaryResult, ChatMessage } from '../lib/types';
import { limits, FORBIDDEN_PHRASES } from '../lib/config';

/**
 * Count tokens using tiktoken
 */
export function countTokens(text: string): number {
  const enc = encodingForModel('gpt-4o-mini');
  const tokens = enc.encode(text);
  return tokens.length;
}

/**
 * Split text into chunks of approximately maxTokens tokens each
 */
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const enc = encodingForModel('gpt-4o-mini');
  const tokens = enc.encode(text);

  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    const dec = encodingForModel('gpt-4o-mini');
    chunks.push(dec.decode(chunkTokens));
  }
  return chunks;
}

/**
 * Single LLM call
 */
async function llmCall(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
  model: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content || '';
}

/**
 * Parse LLM output to extract summary text, topics, and related file
 */
function parseSummaryOutput(raw: string): {
  summary: string;
  topics: string[];
  relatedFile: string | null;
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let topics: string[] = [];
  let relatedFile: string | null = null;
  let summary = raw;

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      topics = Array.isArray(parsed.topics) ? parsed.topics : [];
      relatedFile = parsed.related_file || null;
      summary = raw.slice(0, jsonMatch.index).trim();
    } catch {
      // JSON parse failed, treat entire output as summary
    }
  }

  if (topics.length === 0) {
    const tagMatch = raw.match(/\[([^\]]+)\]/);
    if (tagMatch) {
      try {
        const arr = JSON.parse(tagMatch[0]);
        if (Array.isArray(arr)) topics = arr;
      } catch {
        // ignore
      }
    }
  }

  return { summary, topics, relatedFile };
}

/**
 * Post-process LLM output to filter forbidden phrases
 */
export function postProcessOutput(text: string): string {
  let result = text;
  for (const phrase of FORBIDDEN_PHRASES) {
    if (result.includes(phrase)) {
      result = result.replace(new RegExp(phrase, 'g'), '嗯。');
    }
  }
  return result;
}

/**
 * Main summarization function with three strategies
 */
export async function summarize(
  config: SummarizerConfig,
  text: string,
  recentFiles?: { name: string; summary: string }[],
  topicsContext?: string,
  onProgress?: (stage: string, message: string) => void,
): Promise<SummaryResult> {
  const startTime = performance.now();
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: true,
  });

  const tokenCount = countTokens(text);
  let apiCalls = 0;

  const systemPrompt = `你是桌面宠物。请用3-5句话总结以下文件的核心内容。
要求：
- 先给结论，再给细节
- 如果内容质量差，直说
- 语气简洁直接，不用客套话
- 最后输出JSON格式：{"topics": ["主题1", "主题2"], "related_file": "关联的旧文件名或null"}`;

  const recentContext =
    recentFiles && recentFiles.length > 0
      ? `\n\n用户之前投喂过的文件：\n${recentFiles.map((f) => `- ${f.name}: ${f.summary}`).join('\n')}`
      : '';

  const topicsInfo = topicsContext
    ? `\n用户兴趣方向：${topicsContext}`
    : '';

  let strategy: SummaryResult['strategy'];
  let chunks: number | undefined;

  if (tokenCount <= limits.maxDirectTokens) {
    // Strategy 1: Direct
    strategy = 'direct';
    onProgress?.('summarizing', '直接摘要（文本较短）...');

    const raw = await llmCall(client, systemPrompt + topicsInfo, text + recentContext, config.model);
    const parsed = parseSummaryOutput(raw);
    apiCalls = 1;

    onProgress?.('summarizing', '提取主题标签...');
    const topicResult = await extractTopics(client, raw, config.model);
    if (topicResult.topics.length > 0) {
      parsed.topics = topicResult.topics;
    }
    apiCalls++;

    return {
      summary: postProcessOutput(parsed.summary),
      topics: parsed.topics,
      relatedFile: parsed.relatedFile,
      tokenCount,
      strategy,
      apiCalls,
      totalTimeMs: performance.now() - startTime,
    };
  } else if (tokenCount <= limits.maxTotalTokens) {
    // Strategy 2: Map-Reduce
    strategy = 'map-reduce';
    const textChunks = splitIntoChunks(text, limits.chunkSize);
    chunks = textChunks.length;
    const mapResults: { chunk: number; summary: string }[] = [];

    onProgress?.('summarizing', `Map 阶段：分 ${chunks} 块逐块摘要...`);
    for (let i = 0; i < textChunks.length; i++) {
      onProgress?.('summarizing', `摘要第 ${i + 1}/${chunks} 块...`);
      const chunkSummary = await llmCall(
        client,
        '请用2-3句话总结以下文本的核心内容。保持简洁。',
        textChunks[i],
        config.model,
      );
      mapResults.push({ chunk: i + 1, summary: chunkSummary });
      apiCalls++;
    }

    onProgress?.('summarizing', '合并所有摘要...');
    const combined = mapResults.map((r) => `[块${r.chunk}] ${r.summary}`).join('\n\n');

    const raw = await llmCall(client, systemPrompt + topicsInfo, combined + recentContext, config.model);
    const parsed = parseSummaryOutput(raw);
    apiCalls++;

    onProgress?.('summarizing', '提取主题标签...');
    const topicResult = await extractTopics(client, raw, config.model);
    if (topicResult.topics.length > 0) {
      parsed.topics = topicResult.topics;
    }
    apiCalls++;

    return {
      summary: postProcessOutput(parsed.summary),
      topics: parsed.topics,
      relatedFile: parsed.relatedFile,
      tokenCount,
      strategy,
      chunks,
      apiCalls,
      totalTimeMs: performance.now() - startTime,
    };
  } else {
    // Strategy 3: Truncated
    strategy = 'truncated';
    onProgress?.('summarizing', '文本过长，截取前40000 tokens...');

    const enc = encodingForModel('gpt-4o-mini');
    const tokens = enc.encode(text);
    const dec = encodingForModel('gpt-4o-mini');
    const truncated = dec.decode(tokens.slice(0, limits.maxTotalTokens));

    const raw = await llmCall(
      client,
      systemPrompt + topicsInfo,
      truncated + '\n\n[注：文件过长，以上内容为截取部分]' + recentContext,
      config.model,
    );
    const parsed = parseSummaryOutput(raw);
    apiCalls = 1;

    onProgress?.('summarizing', '提取主题标签...');
    const topicResult = await extractTopics(client, raw, config.model);
    if (topicResult.topics.length > 0) {
      parsed.topics = topicResult.topics;
    }
    apiCalls++;

    return {
      summary: postProcessOutput(parsed.summary),
      topics: parsed.topics,
      relatedFile: parsed.relatedFile,
      tokenCount,
      strategy,
      apiCalls,
      totalTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Extract topics from LLM output
 */
async function extractTopics(
  client: OpenAI,
  text: string,
  model: string,
): Promise<{ topics: string[] }> {
  const response = await llmCall(
    client,
    '从以下文本摘要中提取1-3个主题标签。只输出JSON数组格式，如 ["主题1", "主题2"]。不要其他内容。',
    text,
    model,
  );
  try {
    const parsed = JSON.parse(response);
    return { topics: Array.isArray(parsed) ? parsed : [] };
  } catch {
    const matches = response.match(/\[.*\]/s);
    if (matches) {
      try {
        return { topics: JSON.parse(matches[0]) };
      } catch {
        return { topics: [] };
      }
    }
    return { topics: [] };
  }
}

/**
 * Pass 2: Update interest signal (background, fire-and-forget)
 */
export async function updateInterestSignal(
  config: SummarizerConfig,
  currentSignal: string,
  topics: { name: string; feed_count: number }[],
  newTopics: string[],
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: true,
  });

  const topicsInfo = topics.map((t) => `${t.name}(${t.feed_count}份)`).join('、');

  const response = await llmCall(
    client,
    '根据用户的投喂记录，用一句话描述用户的兴趣画像。直接输出描述，不要前缀。',
    `当前兴趣信号: ${currentSignal || '暂无'}\n主题分布: ${topicsInfo}\n新投喂主题: ${newTopics.join('、')}`,
    config.model,
  );

  return response.trim();
}

/**
 * Chat completion for text dialogue
 */
export async function chatCompletion(
  config: SummarizerConfig,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    ],
    temperature: 0.5,
  });

  const raw = response.choices[0]?.message?.content || '';
  return postProcessOutput(raw);
}
