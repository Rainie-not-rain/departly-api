# departly-api
Backend API for Departly mini program


## 创建行程接口

- POST /api/ai/trip-plan：城市、起止日期必填，最多生成 10 天；可提供偏好、节奏、必去地点。
- POST /api/ai/trip-parse：text 为攻略正文，拒绝纯链接；返回原文地点与 source/inferred/suggested 时间来源。
- 两个接口均返回 { success, data, error }；不会输出提示词、密钥或原始模型响应。

沿用当前 api/ 路由及 ES Modules，已有 /api/health 和 /api/ai/test 保持原样。无需新增依赖。

环境变量继续使用 Vercel 中的 ZHIPU_API_KEY、ZHIPU_MODEL=glm-5.3、APP_ENV=production，勿把密钥写入源码。两个新接口的函数时限为 45 秒，上游请求超时为 38 秒。

本地验证：在此目录执行 npm test。测试使用模拟上游响应，不证明线上 GLM 连通。部署后需验证两个真实接口；小程序 request 合法域名应包含 https://departly-api.vercel.app。
