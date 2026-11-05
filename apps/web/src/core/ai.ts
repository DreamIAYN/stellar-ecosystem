import type { AIMessage, AIProvider } from './types'

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface StreamOptions {
  system?: string
  signal?: AbortSignal
  onDelta?: (text: string) => void
}

function trimBase(url: string) {
  return url.replace(/\/+$/, '')
}

function toTurns(messages: AIMessage[]): ChatTurn[] {
  return messages
    .filter((m) => !m.pending && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
}

async function readSSE(res: Response, onEvent: (data: string) => void) {
  if (!res.body) throw new Error('当前浏览器不支持流式响应')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n\r?\n/)
    buffer = parts.pop() ?? ''
    for (const block of parts) {
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('data:')) onEvent(line.slice(5).trim())
      }
    }
  }
  if (buffer.trim()) {
    for (const line of buffer.split(/\r?\n/)) if (line.startsWith('data:')) onEvent(line.slice(5).trim())
  }
}

async function assertOk(res: Response) {
  if (res.ok) return
  let detail = ''
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      detail = json.error?.message ?? json.message ?? json.error ?? text
    } catch {
      detail = text
    }
  } catch {
    detail = res.statusText
  }
  throw new Error(`请求失败 (${res.status})：${String(detail).slice(0, 300)}`)
}

export async function streamCompletion(provider: AIProvider, input: AIMessage[], opts: StreamOptions = {}): Promise<string> {
  if (provider.kind === 'demo') return demoCompletion(input, opts)
  if (!provider.apiKey && provider.kind !== 'ollama') {
    throw new Error(`请先在「控制台 → AI 模型」中为 ${provider.label} 填入 API Key，或切换到演示模型。`)
  }
  const turns = toTurns(input)
  let text = ''
  const emit = (delta: string) => {
    if (!delta) return
    text += delta
    opts.onDelta?.(delta)
  }

  if (provider.kind === 'openai') {
    const base = trimBase(provider.baseUrl || 'https://api.openai.com/v1')
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      signal: opts.signal,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature: 0.7,
        messages: [
          ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
          ...turns,
        ],
      }),
    })
    await assertOk(res)
    await readSSE(res, (data) => {
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
        if (delta) emit(delta)
      } catch {
        /* ignore malformed keep-alive */
      }
    })
    return text
  }

  if (provider.kind === 'anthropic') {
    const base = trimBase(provider.baseUrl || 'https://api.anthropic.com')
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal: opts.signal,
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 4096,
        stream: true,
        system: opts.system || undefined,
        messages: turns.filter((t) => t.role !== 'system').map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content })),
      }),
    })
    await assertOk(res)
    await readSSE(res, (data) => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') emit(json.delta.text)
      } catch {
        /* ignore */
      }
    })
    return text
  }

  if (provider.kind === 'gemini') {
    const base = trimBase(provider.baseUrl || 'https://generativelanguage.googleapis.com')
    const url = `${base}/v1beta/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
        contents: turns
          .filter((t) => t.role !== 'system')
          .map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      }),
    })
    await assertOk(res)
    await readSSE(res, (data) => {
      try {
        const json = JSON.parse(data)
        for (const part of json.candidates?.[0]?.content?.parts ?? []) if (part.text) emit(part.text)
      } catch {
        /* ignore */
      }
    })
    return text
  }

  if (provider.kind === 'ollama') {
    const base = trimBase(provider.baseUrl || 'http://localhost:11434')
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        messages: [
          ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
          ...turns,
        ],
      }),
    })
    await assertOk(res)
    if (!res.body) throw new Error('当前浏览器不支持流式响应')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          if (json.message?.content) emit(json.message.content)
        } catch {
          /* ignore */
        }
      }
    }
    return text
  }

  throw new Error('未知的模型提供方')
}

function demoCompletion(input: AIMessage[], opts: StreamOptions): Promise<string> {
  const user = [...input].reverse().find((m) => m.role === 'user')?.content ?? ''
  const context = input.map((m) => m.context).filter(Boolean).join('\n')
  const answer = demoAnswer(user, context)
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const chunks = answer.match(/[\s\S]{1,8}/g) ?? []
    let i = 0
    const timer = setInterval(() => {
      if (opts.signal?.aborted) {
        clearInterval(timer)
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      const chunk = chunks[i++] ?? ''
      if (chunk) opts.onDelta?.(chunk)
      if (i >= chunks.length) {
        clearInterval(timer)
        resolve(answer)
      }
    }, 22)
  })
}

function demoAnswer(prompt: string, context: string): string {
  const p = prompt.toLowerCase()
  const hasContext = context.trim().length > 0
  const contextPeek = context.trim().slice(0, 420)

  if (/总结|摘要|概括|summar/.test(p) && !/扫描|试卷|手写/.test(p)) {
    if (hasContext) {
      const lines = context.split(/\n+/).filter((l) => l.trim()).slice(0, 5)
      return `**摘要（演示模式）**\n\n${lines.map((l) => `- ${l.replace(/^#+\s*/, '').slice(0, 90)}`).join('\n')}\n\n> 当前使用本地演示模型。配置任意模型 API Key 后，这里会由真实模型完成更细致的归纳、引用与追问。`
    }
    return '把需要总结的内容贴在输入框里，或从云巢/扫描仪/浏览器通过「分享 → 用 AI 分析」投递给我。我就能在同一个上下文里完成摘要。'
  }
  if (/翻译|translate/.test(p)) {
    return `**翻译工作台（演示）**\n\n我收到了一段待翻译内容${hasContext ? `：\n\n> ${contextPeek}` : '。'}\n\n接入真实模型后会保留术语表、语气与格式。当前可以在「控制台 → AI 模型」填入 Key 后重试。`
  }
  if (/扫描|试卷|ocr|手写/.test(p)) {
    return '**扫描工作流建议**\n\n1. 在「扫描师」选 **试卷** 模式，先做四点透视校正。\n2. 使用 **去手写** 滤镜：优先清除高饱和度的红/蓝批注，再增强印刷体对比度。\n3. 导出 PDF，或直接把文件通过分享面板交给云巢 / 星讯。\n\n提醒：黑色墨水与印刷体在像素层面高度重合，纯视觉算法无法保证 100% 去除；彩色笔迹效果最好。'
  }
  if (/代码|code|bug|typescript|react/.test(p)) {
    return `**代码审阅（演示）**\n\n我看到了${hasContext ? '你投递的代码上下文' : '你的问题'}。建议按这个顺序检查：\n\n1. **边界**：空输入、超大输入、权限失败。\n2. **并发**：请求取消、重复提交、竞态覆盖。\n3. **资源**：Blob URL、MediaStream、WebSocket 是否在卸载时释放。\n4. **可观测性**：错误信息是否能定位到具体步骤。\n\n把代码文件用「分享 → 用 AI 分析」发给我，配置真实模型后可以做逐行审阅。`
  }
  if (/会议|评审|议程|meeting/.test(p)) {
    return '**30 分钟评审议程（演示）**\n\n- 0–5 min：目标与不做的范围\n- 5–15 min：三个关键流程 Demo（扫描 → 云盘 → 分享）\n- 15–25 min：风险、依赖、许可\n- 25–30 min：决策与负责人\n\n可以直接在「会客厅」创建房间，把链接发到星讯群聊。'
  }
  if (/你好|hello|hi|你是谁/.test(p)) {
    return '你好，我是智核。现在我运行在**本地演示模式**——没有发出任何网络请求。\n\n你可以在「控制台 → AI 模型」里填入 DeepSeek、OpenAI、Claude、Gemini 的 Key，或者连接本机 Ollama，就能切换到真实模型。整个星环里的文件、扫描件和网页都可以投递到同一个对话里。'
  }
  return `我收到了：**${prompt.slice(0, 160)}**${hasContext ? `\n\n并读取了 ${context.length} 个字符的跨应用上下文。` : ''}\n\n这是演示模式的回答。当前生态已经打通：\n\n- 从云巢分享文件 → 用 AI 分析\n- 从扫描仪分享扫描件 → 提取 / 总结\n- 从浏览器分享网页 → 摘要\n\n在「控制台 → AI 模型」填入任意兼容 API 的 Key，即可获得真实模型的完整能力。`
}
