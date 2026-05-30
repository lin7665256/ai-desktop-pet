import { useState, useCallback } from 'react'
import { summarize, countTokens, type SummarizerConfig, type SummaryResult } from './lib/summarizer'
import './App.css'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'

const SAMPLE_TEXT = `大型语言模型（LLM）是一种基于深度学习的自然语言处理模型，通过在大规模文本数据上进行预训练，学习语言的统计规律和语义表示。
近年来，以GPT系列、Claude系列为代表的LLM在文本生成、代码编写、翻译、问答等任务上展现了强大的能力。
LLM的核心架构是Transformer，由Vaswani等人在2017年提出。Transformer使用自注意力机制来捕捉文本中的长距离依赖关系，相比传统的RNN和LSTM，可以并行处理序列中的所有位置。
预训练阶段，LLM通过下一个token预测（Next Token Prediction）的目标函数，在TB级别的文本数据上训练。这个阶段让模型学习到了丰富的语言知识和世界知识。
微调阶段，通过监督微调（SFT）和人类反馈强化学习（RLHF），让模型的输出更加符合人类的期望。
RAG（检索增强生成）是一种将外部知识库与LLM结合的技术。通过在生成前检索相关文档片段，为模型提供上下文，从而提高回答的准确性和时效性。
向量数据库是RAG的关键组件，它将文本转换为高维向量并存储，支持高效的相似度搜索。常见的向量数据库包括Pinecone、Weaviate、ChromaDB等。
Agent是LLM应用的另一个重要方向。通过给LLM赋予工具调用能力（如搜索、代码执行、API调用），让模型能够自主规划和执行复杂任务。
ReAct（Reasoning + Acting）是一种让LLM交替进行推理和行动的框架，显著提升了复杂任务的完成质量。`

function App() {
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState(DEFAULT_BASE_URL)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [text, setText] = useState('')
  const [useRecentFiles, setUseRecentFiles] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [error, setError] = useState('')

  const tokenCount = text ? countTokens(text) : 0

  const getStrategyHint = () => {
    if (tokenCount === 0) return null
    if (tokenCount <= 8000) return { label: 'Direct', color: '#4caf50' }
    if (tokenCount <= 40000) return { label: 'Map-Reduce', color: '#ff9800' }
    return { label: 'Truncated', color: '#f44336' }
  }
  const hint = getStrategyHint()

  const handleLoadSample = useCallback(() => {
    setText(SAMPLE_TEXT)
  }, [])

  const handleRun = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('请填写 API Key')
      return
    }
    if (!text.trim()) {
      setError('请填写或粘贴待摘要文本')
      return
    }

    setError('')
    setResult(null)
    setRunning(true)
    setProgress('初始化...')

    try {
      const config: SummarizerConfig = {
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || DEFAULT_BASE_URL,
        model: model.trim() || DEFAULT_MODEL,
      }

      const recentFiles = useRecentFiles
        ? [
            { name: 'AI行业周报.pdf', summary: '本周AI领域重大进展：OpenAI发布GPT-5，Google推出Gemini 2.0' },
            { name: '半导体产业分析.txt', summary: '全球芯片供应链格局变化，台积电3nm量产进展' },
          ]
        : undefined

      const res = await summarize(config, text, recentFiles, (step) => {
        setProgress(step)
      })

      setResult(res)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`摘要失败: ${msg}`)
    } finally {
      setRunning(false)
      setProgress('')
    }
  }, [apiKey, baseURL, model, text, useRecentFiles])

  return (
    <div className="app">
      <h1>Spike 5: OpenAI Map-Reduce 摘要验证</h1>
      <p className="subtitle">验证三策略摘要（Direct / Map-Reduce / Truncated）+ 主题提取 + 跨文件关联</p>

      <section className="config-section">
        <h2>API 配置</h2>
        <div className="config-grid">
          <label>
            <span>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              disabled={running}
            />
          </label>
          <label>
            <span>Base URL</span>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              disabled={running}
            />
          </label>
          <label>
            <span>Model</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
              disabled={running}
            />
          </label>
        </div>
      </section>

      <section className="text-section">
        <div className="text-header">
          <h2>输入文本</h2>
          <div className="text-actions">
            <button className="btn-secondary" onClick={handleLoadSample} disabled={running}>
              加载示例文本
            </button>
            <span className="token-count">
              {tokenCount} tokens
              {hint && (
                <span className="strategy-badge" style={{ backgroundColor: hint.color }}>
                  {hint.label}
                </span>
              )}
            </span>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="粘贴待摘要的文本内容..."
          rows={10}
          disabled={running}
        />
      </section>

      <section className="options-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={useRecentFiles}
            onChange={(e) => setUseRecentFiles(e.target.checked)}
            disabled={running}
          />
          模拟跨文件关联（注入 recentFiles 上下文）
        </label>
      </section>

      <button className="btn-primary" onClick={handleRun} disabled={running}>
        {running ? progress : '运行摘要'}
      </button>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <section className="result-section">
          <h2>结果</h2>

          <div className="result-meta">
            <div className="meta-item">
              <span className="meta-label">策略</span>
              <span className="meta-value">{result.strategy}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Tokens</span>
              <span className="meta-value">{result.tokenCount}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">API 调用</span>
              <span className="meta-value">{result.apiCalls} 次</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">耗时</span>
              <span className="meta-value">{(result.totalTimeMs / 1000).toFixed(1)}s</span>
            </div>
            {result.chunks && (
              <div className="meta-item">
                <span className="meta-label">分块数</span>
                <span className="meta-value">{result.chunks}</span>
              </div>
            )}
          </div>

          <h3>摘要内容</h3>
          <div className="summary-box">{result.summary}</div>

          <h3>提取的主题</h3>
          <div className="topics-box">
            {result.topics.length > 0 ? (
              <ul>
                {result.topics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <span className="no-topics">未提取到主题</span>
            )}
          </div>

          {result.details.mapResults && result.details.mapResults.length > 0 && (
            <>
              <h3>Map 阶段详情</h3>
              <div className="map-details">
                {result.details.mapResults.map((mr) => (
                  <div key={mr.chunk} className="chunk-detail">
                    <span className="chunk-label">块 {mr.chunk}</span>
                    <p>{mr.summary}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default App
