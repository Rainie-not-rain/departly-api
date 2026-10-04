import { apiError } from './response.js'

export async function callZhipu({
  messages,
  temperature = 0.3,
  maxTokens = Number(process.env.ZHIPU_MAX_TOKENS) || 4000,
  timeoutMs = Number(process.env.ZHIPU_TIMEOUT_MS) || 90000,
  model = process.env.ZHIPU_MODEL
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

          stream: false
        })
      }
    )

    if (!response.ok) {
      const text = await response.text()

      console.error(
        '[ZHIPU_API_ERROR]',
        response.status,
        text
      )

      throw apiError(
        'AI_REQUEST_FAILED',
        'AI 服务暂时不可用，请稍后重试',
        502
      )
    }

    const result = await response.json()

    const choice = result.choices?.[0]

    if (choice?.finish_reason === 'length') {
      throw apiError(
        'AI_RESPONSE_INVALID',
        '生成内容未完整返回，请重试',
        502
      )
    }

    const content =
      choice?.message?.content

    if (
      typeof content !== 'string' ||
      !content.trim()
    ) {
      throw apiError(
        'AI_EMPTY_RESULT',
        '没有识别到可用行程，请补充信息后重试',
        502
      )
    }

    return content

  } catch (error) {

    if (controller.signal.aborted) {
      throw apiError(
        'AI_TIMEOUT',
        '生成时间有点久，请重新试试',
        504
      )
    }

    if (error.code) {
      throw error
    }

    throw apiError(
      'AI_REQUEST_FAILED',
      'AI 服务暂时不可用，请稍后重试',
      502
    )

  } finally {
    clearTimeout(timer)
  }
}