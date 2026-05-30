import { useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { encodingForModel } from 'js-tiktoken'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

interface ExtractionResult {
  fileName: string
  fileSize: number
  pageCount: number
  text: string
  tokenCount: number
  extractionTime: number
  pages: { pageNum: number; text: string }[]
}

function App() {
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const startTime = performance.now()

      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer()

      // Load PDF
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      const pageCount = pdf.numPages

      // Extract text from each page
      const pages: { pageNum: number; text: string }[] = []
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        pages.push({ pageNum: i, text: pageText })
      }

      // Join all text
      const fullText = pages.map((p) => p.text).join('\n\n')

      // Count tokens (approximate with cl100k_base encoding)
      let tokenCount = 0
      try {
        const enc = encodingForModel('gpt-4o-mini')
        tokenCount = enc.encode(fullText).length
        enc.free()
      } catch {
        // Fallback: rough estimate ~4 chars per token
        tokenCount = Math.ceil(fullText.length / 4)
      }

      const extractionTime = performance.now() - startTime

      setResult({
        fileName: file.name,
        fileSize: file.size,
        pageCount,
        text: fullText,
        tokenCount,
        extractionTime,
        pages,
      })
    } catch (err: any) {
      setError(`解析失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type === 'application/pdf') {
        handleFile(file)
      } else {
        setError('请拖入 PDF 文件')
      }
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '20px',
        fontFamily: 'monospace',
        background: '#1a1a2e',
        minHeight: '100vh',
        color: '#eee',
      }}
    >
      <h2>Spike 4: pdfjs-dist PDF 文本提取验证</h2>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          width: '400px',
          height: '150px',
          border: '2px dashed #555',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onDragEnter={(e) => {
          e.currentTarget.style.borderColor = '#4fc3f7'
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = '#555'
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {loading ? (
          <p style={{ color: '#ff0' }}>解析中...</p>
        ) : (
          <>
            <p style={{ fontSize: '24px' }}>📄</p>
            <p>拖拽 PDF 到此处，或点击选择文件</p>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {/* Error */}
      {error && <p style={{ color: '#f44' }}>{error}</p>}

      {/* Results */}
      {result && (
        <div
          style={{
            width: '100%',
            maxWidth: '600px',
            background: '#222',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h3>提取结果</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['文件名', result.fileName],
                ['文件大小', `${(result.fileSize / 1024).toFixed(1)} KB`],
                ['页数', result.pageCount],
                ['提取时间', `${result.extractionTime.toFixed(0)} ms`],
                ['总字符数', result.text.length.toLocaleString()],
                ['Token 数 (近似)', result.tokenCount.toLocaleString()],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td
                    style={{
                      padding: '4px 8px',
                      color: '#888',
                      borderBottom: '1px solid #333',
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid #333',
                    }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{ marginTop: '16px' }}>
            提取文本预览（前 500 字）
          </h4>
          <pre
            style={{
              background: '#111',
              padding: '12px',
              borderRadius: '6px',
              maxHeight: '300px',
              overflow: 'auto',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {result.text.slice(0, 500)}
            {result.text.length > 500 && '\n\n... (已截断)'}
          </pre>

          <h4 style={{ marginTop: '16px' }}>分块策略建议</h4>
          <div
            style={{
              background: '#111',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            {result.tokenCount < 8000 && (
              <p style={{ color: '#8f8' }}>
                ✅ Token 数 &lt; 8000，可直接送入 LLM 处理
              </p>
            )}
            {result.tokenCount >= 8000 && result.tokenCount < 40000 && (
              <p style={{ color: '#ff0' }}>
                ⚠️ Token 数 8000-40000，建议 Map-Reduce 分块摘要
                <br />
                建议分 {Math.ceil(result.tokenCount / 6000)} 块，每块约{' '}
                {Math.ceil(result.tokenCount / Math.ceil(result.tokenCount / 6000))}{' '}
                tokens
              </p>
            )}
            {result.tokenCount >= 40000 && (
              <p style={{ color: '#f44' }}>
                ❌ Token 数 &gt; 40000，仅取前 40000 tokens + 截断提示
              </p>
            )}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          background: '#222',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h3>验收清单</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>☐ 拖拽 PDF 文件触发解析</li>
          <li>☐ 点击选择文件也能解析</li>
          <li>☐ 中文 PDF 文本正确提取（不乱码）</li>
          <li>☐ 多页 PDF 拼接为完整文本</li>
          <li>☐ Token 计数合理（与 tiktoken 一致）</li>
          <li>☐ 100 页以内 PDF 处理时间 &lt; 3 秒</li>
          <li>☐ 分块策略建议正确</li>
        </ul>
      </div>
    </div>
  )
}

export default App
