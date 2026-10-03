# departly-api
Backend API for Departly mini program


## 创建行程接口

- POST /api/ai/trip-plan：城市、起止日期必填，最多生成 10 天；可提供偏好、节奏、必去地点。
- POST /api/ai/trip-parse：text 为攻略正文，拒绝纯链接；返回原文地点与 source/inferred/suggested 时间来源。
- 两个接口均返回 { success, data, error }；不会输出提示词、密钥或原始模型响应。

沿用当前 api/ 路由及 ES Modules，已有 /api/health 和 /api/ai/test 保持原样。无需新增依赖。

环境变量继续使用 Vercel 中的 ZHIPU_API_KEY、ZHIPU_MODEL=glm-5.3、APP_ENV=production，勿把密钥写入源码。两个新接口的函数时限为 45 秒，上游请求超时为 38 秒。

本地验证：在此目录执行 npm test。测试使用模拟上游响应，不证明线上 GLM 连通。部署后需验证两个真实接口；小程序 request 合法域名应包含 https://departly-api.vercel.app。

## 网页内容解析

POST /api/content/resolve，输入 { url }，仅接受小红书笔记或 xhslink 短链接。后端读取 FIRECRAWL_API_KEY，禁止将密钥放入小程序或提交到 Git。Provider 使用 Firecrawl v2 scrape API（https://docs.firecrawl.dev/api-reference/endpoint/scrape）。

缓存按 noteId 合并，首次抓取保留原分享参数。内存缓存最多 100 条、30 天过期，仅在同一热实例内有效，不提供跨实例或部署后的持久缓存保证。缓存中不保留 xsec_token。短链接初次按完整 URL 的摘要缓存，不主动请求跳转；Provider 可通过 providers/index.js 替换，当前失败降级为用户粘贴正文。

Vercel 中配置 FIRECRAWL_API_KEY 后部署。当前没有数据库和新增依赖。
