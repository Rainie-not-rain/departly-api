export default function handler(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'departly-api',
      environment: process.env.APP_ENV || 'unknown'
    },
    error: null
  })
}
