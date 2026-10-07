import { apiError } from './response.js'

export async function callZhipu({
  messages,
  temperature = 0.3,
  maxTokens = Number(process.env.ZHIPU_MAX_TOKENS) || 4000,
  timeoutMs = Number(process.env.ZHIPU_TIMEOUT_MS) || 90000,
  model = process.env.ZHIPU_MODEL,
  responseFormat,
  reasoningEffort,
  onMetadata
}) {
  if (
    !process.env.ZHIPU_API_KEY ||
    !model
  ) {
    throw apiError(
      'AI_REQUEST_FAILED',
      'AI 服务尚未配置',
      503
    )
  }

  const controller = new AbortController()

  const timer = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        method: 'POST',

        signal: controller.signal,

        headers: {
          Authorization:
            'Bearer ' + process.env.ZHIPU_API_KEY,

          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          model,
          messages,
          temperature,

          max_tokens: maxTokens,

          stream: false,
          ...(responseFormat ? {response_format: responseFormat} : {}),
          ...(reasoningEffort ? {reasoning_effort: reasoningEffort} : {})
        })
      }
    )

    if(onMetadata)onMetadata({httpStatus:response.status})
    if (!response.ok) {
      console.error('[TripPlan] Zhipu request failed: '+response.status)

      throw apiError(
        'AI_REQUEST_FAILED',
        'AI 服务暂时不可用，请稍后重试',
        502
      )
    }

    const result = await response.json()

    const choice = result?.choices?.[0]
    const content = choice?.message?.content
    if(onMetadata)onMetadata({
      choicesPresent:Array.isArray(result?.choices),
      choicesLength:Array.isArray(result?.choices)?result.choices.length:0,
      contentPresent:content!=null,
      contentType:Array.isArray(content)?'array':typeof content,
      contentFormat:typeof content!=='string'?'non-string':!content.trim()?'empty':/^\s*```/.test(content)?'markdown-fence':/^\s*\{/.test(content)?'json-object-text':'text-with-content',
      responseChars:typeof content==='string'?content.length:0,
      finishReason:['stop','length','tool_calls','sensitive'].includes(choice?.finish_reason)?choice.finish_reason:'other-or-missing',
      reasoningChars:typeof choice?.message?.reasoning_content==='string'?choice.message.reasoning_content.length:0,
      promptTokens:Number.isFinite(result?.usage?.prompt_tokens)?result.usage.prompt_tokens:null,
      totalTokens:Number.isFinite(result?.usage?.total_tokens)?result.usage.total_tokens:null,
      completionTokens:Number.isFinite(result?.usage?.completion_tokens)?result.usage.completion_tokens:null,
      maxTokens,
      reasoningEffort:reasoningEffort||null
    })

    if (choice?.finish_reason === 'length') {
      throw Object.assign(apiError(
        'AI_RESPONSE_INVALID',
        '生成内容未完整返回，请重试',
        502
      ),{diagnostic:{field:'choices[0].finish_reason',reason:'output_truncated'}})
    }

    if (
      typeof content !== 'string' ||
      !content.trim()
    ) {
      throw Object.assign(apiError(
        'AI_EMPTY_RESULT',
        '没有识别到可用行程，请补充信息后重试',
        502
      ),{diagnostic:{field:'choices[0].message.content',reason:typeof content!=='string'?'missing_or_non_string':'empty_content'}})
    }

    return content

  } catch (error) {

    if (controller.signal.aborted) {
      console.error('[TripPlan] Zhipu request timed out')
      throw apiError(
        'AI_TIMEOUT',
        '生成时间有点久，请重新试试',
        504
      )
    }

    if (error.code) {
      throw error
    }

    console.error('[TripPlan] Zhipu request failed: network or invalid response',{name:error.name,code:error.cause?.code||null,syscall:error.cause?.syscall||null})
    throw apiError(
      'AI_REQUEST_FAILED',
      'AI 服务暂时不可用，请稍后重试',
      502
    )

  } finally {
    clearTimeout(timer)
  }
}
