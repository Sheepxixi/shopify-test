# 项目说明（Shopify 主题 + Vercel Serverless API）

本仓库包含两部分：

- **Shopify Theme（Liquid）**：位于根目录的 `layout/`、`templates/`、`sections/`、`snippets/`、`assets/` 等。
- **Vercel Serverless 后端（Node 18, ES Modules）**：位于 `api/`，用于通过 **Shopify Admin GraphQL API** 创建/查询/更新 Draft Order（草稿订单），以及文件上传到 Shopify Files、文件下载中转等。

适合场景：3D 打印/加工类的 **RFQ（询价）→ 创建 Draft Order → 客服报价 → 发送发票/客户付款** 的闭环。

---

## 快速开始

### 运行环境

- Node.js **>= 18**（见 `package.json`）

### 安装依赖

```bash
npm install
```

---

## 环境变量（后端）

环境变量示例见 `env.example`。

### 必填

- `SHOPIFY_STORE_DOMAIN`：Shopify 店铺域名（不带 `https://`）
- `SHOPIFY_ACCESS_TOKEN`：Admin API Token

### 兼容别名（代码里也支持）

部分接口同时兼容以下变量名（便于迁移旧环境）：

- `SHOP` ≈ `SHOPIFY_STORE_DOMAIN`
- `ADMIN_TOKEN` ≈ `SHOPIFY_ACCESS_TOKEN`

### 可选

- `ADMIN_EMAIL_WHITELIST`：管理员邮箱白名单（逗号分隔），用于管理端查询/删除等接口的权限控制。未配置时使用 `api/cors-config.js` 内置默认名单。

---

## 重要配置（移植/二开必看）

### 1) 修改 CORS 白名单（后端）

后端允许哪些 Shopify 域名/本地域名调用接口，由 `api/cors-config.js` 中的 `allowedOrigins` 控制。

- **移植到新店铺**：把你的店铺域名加入 `allowedOrigins`

### 2) 修改管理员邮箱白名单（前端 + 后端）

- **后端**：`api/cors-config.js`（或用 `ADMIN_EMAIL_WHITELIST` 环境变量覆盖）
- **前端主题**：`layout/theme.liquid` 的 `window.ADMIN_EMAILS`

> 建议：前端隐藏入口只是“弱约束”，真正的权限以 **后端校验** 为准。

### 3) 修改前端调用的后端域名（主题侧）

主题 JS/页面里存在对 Vercel 域名的硬编码或默认值。移植时至少检查并替换为你的域名：

- `assets/model-uploader.js`
  - 默认：`window.QUOTES_API_BASE || 'https://shopify-v587.vercel.app/api'`
  - 你可以在主题里注入 `window.QUOTES_API_BASE` 来统一配置（推荐）
- `assets/quote-notification.js`
  - 当前硬编码：`https://shopify-v587.vercel.app/api/...`
- `templates/page.admin-dashboard.liquid`
  - 当前硬编码：`const QUOTES_API_BASE = 'https://shopify-v587.vercel.app/api';`

---

## 后端接口（`api/`）

> 所有接口均为 Vercel Serverless Function：路径形式 `GET/POST/DELETE /api/<file-name>`。

### 询价提交（创建 Draft Order）

- **路径**：`POST /api/submit-quote-real`
- **用途**：客户提交 RFQ，后端创建 Draft Order（草稿订单）
- **入参**：`customerEmail`（必填）以及 `customerName` / `fileName` / `fileUrl` / `lineItems` 等
- **返回**：`draftOrderId`、`invoiceUrl`、`quoteId` 等
- **文件**：`api/submit-quote-real.js`

### 文件上传（存到 Shopify Files + Metaobject 记录）

- **路径**：`POST /api/store-file-real`
- **用途**：将 `data:...;base64,...` 上传到 Shopify Files（staged upload），并创建 `uploaded_file` Metaobject 作为索引
- **入参**：`fileData`（base64 data URL）、`fileName`、`fileType`
- **返回**：`fileId`（内部 handle）、`shopifyFileId`、`shopifyFileUrl`
- **文件**：`api/store-file-real.js`

### 文件下载（代理/重定向/从 Metaobject 取回）

- **路径**：`GET /api/download-file`
- **用途**：
  - 传 `shopifyFileUrl`：直接代理下载并设置文件名
  - 传 `shopifyFileId`：查询 Shopify Files，再中转下载
  - 传 `id`：按 `uploaded_file` Metaobject handle/字段查询并跳转或下载
- **文件**：`api/download-file.js`

### 获取 Draft Order 列表（管理端/按邮箱）

- **路径**：`GET /api/get-draft-orders`
- **用途**：
  - `admin=true` 且邮箱在白名单：可查看全部（可按 `status` 过滤）
  - 否则：只能按 `email` 查看自己的
- **关键参数**：`email`（必填）、`admin`、`status`、`limit`
- **文件**：`api/get-draft-orders.js`

### 获取单个 Draft Order（轻量版）

- **路径**：`GET /api/get-draft-order-simple`
- **用途**：按 DraftOrder GID 或订单名（`#Dxxxx`）查询；默认限制为当前邮箱，管理员白名单可跨用户
- **关键参数**：`id`（必填）、`email`（必填）、`admin`
- **文件**：`api/get-draft-order-simple.js`

### 更新报价（更新 Draft Order 价格 + 状态）

- **路径**：`POST /api/update-quote`
- **用途**：客服报价：更新 Draft Order lineItems 单价、写入 customAttributes（状态/金额/时间/备注/客服邮箱），并尝试同步更新 `quote` Metaobject 状态
- **入参**：`draftOrderId`（必填）、`amount`、`note`、`senderEmail`、`status`
- **文件**：`api/update-quote.js`

### 发送发票邮件（Shopify 内置发票邮件）

- **路径**：`POST /api/send-invoice-email`
- **用途**：调用 `draftOrderInvoiceSend` 给客户发送发票/结账链接邮件
- **入参**：`draftOrderId`（必填）、`customMessage`（当前实现未透传到 Shopify）
- **文件**：`api/send-invoice-email.js`

### 完成 Draft Order（进入待付款）

- **路径**：`POST /api/complete-draft-order`
- **用途**：调用 `draftOrderComplete(paymentPending: true)`
- **入参**：`draftOrderId`（必填）
- **文件**：`api/complete-draft-order.js`

### 删除 Draft Order（管理端/本人）

- **路径**：`DELETE /api/delete-draft-order`（同时也接受 `POST`）
- **用途**：
  - 管理员白名单：可删除任意 Draft Order
  - 非管理员：仅允许删除“属于本人邮箱”的 Draft Order（需要传 `email`）
- **入参**：`draftOrderId`（必填）、`email`、`admin`
- **文件**：`api/delete-draft-order.js`

---

## 关于 `templates/page.admin-dashboard.liquid` 的接口路径说明（重要）

当前管理页里存在对以下路径的调用：

- `GET ${QUOTES_API_BASE}/quotes`
- `GET ${QUOTES_API_BASE}/quotes?handle=...`
- `POST ${QUOTES_API_BASE}/send-email`

但本仓库 `api/` 目录下实际实现的接口文件是 `get-draft-orders.js` / `get-draft-order-simple.js` / `send-invoice-email.js` 等。

**迁移或二开时请统一接口命名**，避免“前端调用旧路径、后端不存在”的情况。推荐做法：

- 以 `api/` 文件名为准调整前端调用；或
- 在 `api/` 中补齐兼容路由（例如新增 `api/quotes.js` 作为适配层）再逐步迁移。

---

## Shopify 权限建议（Admin API Scopes）

根据现有功能，通常需要（具体以你店铺 App 配置为准）：

- Draft Orders：读写草稿订单（用于创建/查询/更新/发送发票/完成/删除）
- Files：上传/读取文件（`stagedUploadsCreate`、`fileCreate`、`node(id)` 获取文件 URL）
- Metaobjects：创建/查询 `uploaded_file`、`quote` 等记录（如有使用）

---

## 部署（Vercel）

1) 将仓库导入 Vercel 项目
2) 在 Vercel 项目里配置环境变量：
   - `SHOPIFY_STORE_DOMAIN`
   - `SHOPIFY_ACCESS_TOKEN`
   - （可选）`ADMIN_EMAIL_WHITELIST`
3) 部署完成后，前端主题中把 `QUOTES_API_BASE` 指向你的部署域名（见上文“重要配置”）

`vercel.json` 中对部分函数设置了 `maxDuration`（超时上限），用于上传/下载/发票邮件等较慢操作。

---

## 常见改动点（给同伴的“移植清单”）

- **后端**
  - `api/cors-config.js`：CORS 白名单 `allowedOrigins`
  - Vercel 环境变量：`SHOPIFY_STORE_DOMAIN` / `SHOPIFY_ACCESS_TOKEN` / `ADMIN_EMAIL_WHITELIST`
  - Shopify Admin API 版本路径：当前使用 `2024-01`（如店铺升级需要可统一替换）
- **前端主题**
  - `layout/theme.liquid`：`window.ADMIN_EMAILS`
  - `assets/model-uploader.js`：`window.QUOTES_API_BASE` 默认值 / 硬编码域名
  - `assets/quote-notification.js`：硬编码域名
  - `templates/page.admin-dashboard.liquid`：`QUOTES_API_BASE` 与接口路径映射

---

## 目录结构（摘录）

- `api/`：Vercel Serverless Functions（后端）
- `assets/`：主题前端脚本/CSS
- `templates/`、`sections/`、`snippets/`、`layout/`：Shopify Theme 结构
- `env.example`：环境变量示例
- `vercel.json`：Vercel 函数配置

