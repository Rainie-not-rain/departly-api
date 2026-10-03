export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: null,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is allowed'
      }
    })
  }

  try {
    if (!process.env.ZHIPU_API_KEY) {
      throw new Error('ZHIPU_API_KEY is not configured')
    }

    if (!process.env.ZHIPU_MODEL) {
      throw new Error('ZHIPU_MODEL is not configured')
    }

    const response = await fetch(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`
        },

        body: JSON.stringify({
          model: process.env.ZHIPU_MODEL,

          messages: [
            {
              role: 'system',
              content: '你是小簿，一个旅行助手。'
            },
            {
              role: 'user',
              content: '这是一次 API 连通测试。请只回复：小簿AI连接成功'
            }
          ],

          temperature: 0.1
        })
      }
    )

    const raw = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        data: null,
        error: {
          code: 'ZHIPU_API_ERROR',
          message: raw?.error?.message || '智谱 API 请求失败',
          details: raw
        }
      })
    }

    const content =
      raw?.choices?.[0]?.message?.content || ''

    return res.status(200).json({
      success: true,

      data: {
        model: process.env.ZHIPU_MODEL,
        content
      },

      error: null
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,

      error: {
        code: 'AI_TEST_FAILED',
        message: error.message
      }
    })
  }
}
