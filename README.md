# departly-api
出发簿 Web App 与 API 共用的项目。首页使用 Next.js App Router、React、TypeScript 和 Tailwind CSS；微信小程序独立后端位于 ../departly-wechat-api。

## 本地预览

在 VS Code 终端进入本目录，使用 Node.js 22 或更高版本：

```powershell
cd G:\ChuFaBu_web_app\departly-api
npm install
npm run dev
```

打开 http://localhost:3000 查看首页。Windows PowerShell 若提示 `npm.ps1` 被执行策略阻止，将命令中的 `npm` 换成 `npm.cmd` 即可。

首页已按原微信小程序首页迁移，复用四季插画、快捷入口和底部导航，保留无旅程、待出发、旅行中三种状态。`/trips` 已迁移“我的旅程”列表，保留三种分组、编辑规则、创建者权限及删除后保留7天的本地规则。首页“我的旅程”和底部“行程”进入此列表。详情、创建、回顾、成员管理和回收站暂为占位页；回收站恢复界面尚未迁移。浏览器本地数据独立于微信，沿用 `departly_mvp_data_v1` 结构；首次打开没有演示旅程。旅行中天气需要单独配置 `NEXT_PUBLIC_AMAP_WEB_KEY`（高德 Web 服务 Key），未配置时显示原因。首页不调用 AI。

检查命令：`npm test`、`npm run typecheck`、`npm run build`。生产环境本地预览先构建，再执行 `npm start`。

## Web 部署

继续使用原 Vercel Project，Root Directory 保持指向本项目（若仓库根就是本目录，保持默认）。Framework Preset 使用 Next.js；构建命令为 `npm run build`，Output Directory 保持框架默认，不使用静态导出。保留现有服务端环境变量。

`vercel.json` 已指定 Next.js、构建命令和接口时限，保留图片清理定时任务。若项目设置曾覆盖 Install Command 或 Output Directory，恢复框架默认后重新部署。部署后根路径 `/` 为首页，`/api/*` 地址不变。

原处理代码仍在 `api/` 和 `lib/`；`pages/api/` 仅重新导出原处理函数，使 Next.js 本地开发和 Vercel 使用相同入口。图片提交入口设置 3MB 请求体上限，以兼容原有最大 2MB 图片的 Base64 数据。


保留 POST /api/ai/chat、/api/ai/trip-plan、/api/ai/trip-parse、/api/ai/scrapbook-route 以及 /api/content/resolve。公开测试接口停用。AI 接口继续执行身份验证、限流和输入校验，当前身份凭证来自微信登录；Web App 的登录方式仍需按其实际方案接入，不能无凭证直接调用。

AI 环境变量：ZHIPU_API_KEY、ZHIPU_MODEL；可选 ZHIPU_CHAT_MODEL、ZHIPU_IMAGE_MODEL。攻略链接解析需 FIRECRAWL_API_KEY。请只在服务端配置。

本目录仍是原独立 Git 仓库，新建的微信后端目录不会被本仓库推送；两份后端分别部署，微信后端部署说明见其 README。

## 登录、存储与部署配置

本轮已移除 Web 后端的微信文字审核和新上传图片的微信审核。身份校验、限流、图片格式/大小校验、私有存储、所有权校验和签名访问仍保留。未修改独立的微信小程序后端或云函数。

文字接口保留原响应字段，并增加 `moderation: "disabled"`。新图片上传后立即返回 `status: "pass"` 和 `moderation: "disabled"`；这里的 pass 表示文件可用，不表示内容经过审核。旧图片签名凭证格式保留，用于访问权限验证。历史待审图片仍可通过原回调完成处理；新上传不调用微信审核接口，也不需要微信回调配置。

当前登录凭证仍来自原微信登录接口，本轮未新增 Web 登录页或替换身份系统。因此首页无需登录即可查看，但后续 Web 调用 AI 前还需要接入 Web 登录方案。

服务端环境变量：

| 配置 | 用途 |
| --- | --- |
| WECHAT_APP_ID / WECHAT_APP_SECRET | 保留的原登录和签名凭证验证 |
| ZHIPU_API_KEY / ZHIPU_MODEL | 智谱 AI；可选 ZHIPU_CHAT_MODEL、ZHIPU_IMAGE_MODEL |
| FIRECRAWL_API_KEY | 可选的攻略链接解析 |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN | 持久限流和图片记录 |
| BLOB_READ_WRITE_TOKEN | Vercel Blob Private 存储凭证 |
| MEDIA_PUBLIC_ORIGIN | 后端 HTTPS 根地址，例如 https://departly-api.vercel.app |
| MEDIA_SIGNING_SECRET | 至少 32 字符，用于图片访问签名 |
| CRON_SECRET | 定时清理接口访问密钥 |
| WECHAT_MEDIA_CALLBACK_TOKEN / WECHAT_MEDIA_ENCODING_AES_KEY | 仅历史微信待审图片回调需要 |

照片支持 JPG、PNG、WebP，单张不超过 2MB。未保存的照片一小时后可清理；原每日清理任务保留，每次最多 20 项。所有密钥只放在服务端，不使用 NEXT_PUBLIC_ 前缀。

`npm test` 使用模拟服务；实际智谱调用、Blob 存储和 Vercel 部署需要真实环境验证。
