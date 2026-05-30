import OpenAI from 'openai'
import { encodingForModel } from 'js-tiktoken'

export interface SummarizerConfig {
  apiKey: string
  baseURL: string
  model: string
}

export interface SummaryResult {
  summary: string
  topics: string[]
  tokenCount: number
  strategy: 'direct' | 'map-reduce' | 'truncated'
  chunks?: number
  apiCalls: number
  totalTimeMs: number
  details: {
    mapResults?: { chunk: number; summary: string }[]
  }
}

const MAX_DIRECT_TOKENS = 8000
const MAX_TOTAL_TOKENS = 40000
const CHUNK_SIZE = 6000 // tokens per chunk for map phase

/**
 * Count tokens using tiktoken (cl100k_base encoding, compatible with GPT-4o-mini)
 */
export function countTokens(text: string): number {
  const enc = encodingForModel('gpt-4o-mini')
  const tokens = enc.encode(text)
  enc.free()
  return tokens.length
}

/**
 * Split text into chunks of approximately `maxTokens` tokens each
 */
function splitIntoChunks(text: string, maxTokens: number): string[] {
  const enc = encodingForModel('gpt-4o-mini')
  const tokens = enc.encode(text)
  enc.free()

  const chunks: string[] = []
  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens)
    const dec = encodingForModel('gpt-4o-mini')
    chunks.push(dec.decode(chunkTokens))
    dec.free()
  }
  return chunks
}

/**
 * Single LLM call to summarize text
 */
async function summarizeChunk(
  client: OpenAI,
  text: string,
  model: string,
  instruction: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: instruction },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
  })
  return response.choices[0]?.message?.content || ''
}

/**
 * Extract topics from text using LLM
 */
async function extractTopics(
  client: OpenAI,
  summary: string,
  model: string,
): Promise<string[]> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          '从以下文本摘要中提取1-3个主题标签。只输出JSON数组格式，如 ["主题1", "主题2"]。不要其他内容。',
      },
      { role: 'user', content: summary },
    ],
    temperature: 0.1,
  })
  const content = response.choices[0]?.message?.content || '[]'
  try {
    return JSON.parse(content)
  } catch {
    // Fallback: try to extract from markdown-style output
    const matches = content.match(/\[.*\]/s)
    return matches ? JSON.parse(matches[0]) : []
  }
}

/**
 * Main summarization function
 * Implements the two-pass strategy from MVP-CutLine.md:
 * - Pass 1: Summary + topics + association detection
 * - Pass 2: Interest profile update (not implemented here, done separately)
 */
export async function summarize(
  config: SummarizerConfig,
  text: string,
  recentFiles?: { name: string; summary: string }[],
  onProgress?: (step: string) => void,
): Promise<SummaryResult> {
  const startTime = performance.now()
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: true, // Running in browser for spike testing
  })

  const tokenCount = countTokens(text)
  let apiCalls = 0
  const details: SummaryResult['details'] = {}

  const systemPrompt = `你是桌面宠物。请用3-5句话总结以下文件的核心内容。
要求：
- 先给结论，再给细节
- 如果内容质量差，直说
- 语气简洁直接，不用客套话
- 最后输出JSON格式的主题标签：{"topics": ["主题1", "主题2"]}`

  let summary: string
  let strategy: SummaryResult['strategy']

  if (tokenCount <= MAX_DIRECT_TOKENS) {
    // Strategy 1: Direct summarization
    strategy = 'direct'
    onProgress?.('直接摘要（文本较短）...')

    const recentContext = recentFiles?.length
      ? `\n\n用户之前投喂过的文件：\n${recentFiles.map((f) => `- ${f.name}: ${f.summary}`).join('\n')}`
      : ''

    summary = await summarizeChunk(
      client,
      text + recentContext,
      config.model,
      systemPrompt,
    )
    apiCalls = 1
  } else if (tokenCount <= MAX_TOTAL_TOKENS) {
    // Strategy 2: Map-Reduce
    strategy = 'map-reduce'
    const chunks = splitIntoChunks(text, CHUNK_SIZE)
    details.mapResults = []

    // Map phase: summarize each chunk
    onProgress?.(`Map 阶段：分 ${chunks.length} 块逐块摘要...`)
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(`Map 阶段：摘要第 ${i + 1}/${chunks.length} 块...`)
      const chunkSummary = await summarizeChunk(
        client,
        chunks[i],
        config.model,
        '请用2-3句话总结以下文本的核心内容。保持简洁。',
      )
      details.mapResults.push({ chunk: i + 1, summary: chunkSummary })
      apiCalls++
    }

    // Reduce phase: combine all summaries
    onProgress?.('Reduce 阶段：合并所有摘要...')
    const combined = details.mapResults
      .map((r) => `[块${r.chunk}] ${r.summary}`)
      .join('\n\n')

    const recentContext = recentFiles?.length
      ? `\n\n用户之前投喂过的文件：\n${recentFiles.map((f) => `- ${f.name}: ${f.summary}`).join('\n')}`
      : ''

    summary = await summarizeChunk(
      client,
      combined + recentContext,
      config.model,
      systemPrompt,
    )
    apiCalls++
  } else {
    // Strategy 3: Truncate
    strategy = 'truncated'
    onProgress?.('文本过长，截取前40000 tokens...')

    const enc = encodingForModel('gpt-4o-mini')
    const tokens = enc.encode(text)
    enc.free()
    const dec = encodingForModel('gpt-4o-mini')
    const truncated = dec.decode(tokens.slice(0, MAX_TOTAL_TOKENS))
    dec.free()

    summary = await summarizeChunk(
      client,
      truncated + '\n\n[注：文件过长，以上内容为截取部分]',
      config.model,
      systemPrompt,
    )
    apiCalls = 1
  }

  // Extract topics (separate call for structured output)
  onProgress?.('提取主题标签...')
  const topics = await extractTopics(client, summary, config.model)
  apiCalls++

  const totalTimeMs = performance.now() - startTime

  return {
    summary,
    topics,
    tokenCount,
    strategy,
    chunks: details.mapResults?.length,
    apiCalls,
    totalTimeMs,
    details,
  }
}
