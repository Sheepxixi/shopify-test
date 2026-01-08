# Vercel 部署方式修复指南

## 🔍 问题诊断

从你的截图可以看出：
- **Static Assets（静态资源）**: API文件被当作静态JS文件列出
- **API端点列表**: 虽然显示了API端点，但可能没有正确部署为Serverless Functions

这说明Vercel可能将项目识别为**静态站点**而不是**Serverless Functions项目**。

---

## ✅ 解决方案

### 1. 更新 vercel.json 配置

我已经更新了 `vercel.json`，添加了：
- `"version": 2` - 明确使用Vercel v2配置
- `"framework": null` - 不指定框架（纯API项目）
- `"buildCommand": null` - 不需要构建命令
- `"rewrites"` - 确保API路由正确重写
- `"functions"` 中指定所有API文件使用 `nodejs18.x` runtime

### 2. 在Vercel Dashboard中检查项目设置

1. **登录Vercel Dashboard**
   - https://vercel.com/dashboard

2. **进入项目设置**
   - 选择你的项目
   - Settings → General

3. **检查以下设置**：
   - **Framework Preset**: 应该选择 "Other" 或 "None"
   - **Root Directory**: 应该是 `.` (根目录)
   - **Build Command**: 应该为空（如果不需要构建）
   - **Output Directory**: 应该为空（纯API项目）

4. **检查Functions设置**
   - Settings → Functions
   - 确认 **Node.js Version** 设置为 `18.x` 或更高

---

## 🚀 重新部署步骤

### 步骤1: 提交更新的vercel.json

```bash
git add vercel.json
git commit -m "Fix Vercel configuration for Serverless Functions"
git push
```

### 步骤2: 在Vercel中清除缓存并重新部署

1. **删除旧部署**（可选）:
   - Dashboard → Deployments
   - 删除旧的部署（如果有问题）

2. **手动触发新部署**:
   - Dashboard → Deployments
   - 点击 "Redeploy" 或等待自动部署

3. **等待部署完成**:
   - 查看构建日志
   - 确认没有错误

---

## 🧪 验证部署

部署完成后，测试：

```powershell
# 测试 test-cors
curl https://shopify-v587.vercel.app/api/test-cors

# 测试 store-file-real (OPTIONS)
curl -X OPTIONS -H "Origin: https://sain-pdc-test.myshopify.com" https://shopify-v587.vercel.app/api/store-file-real -I
```

**期望结果**:
- `test-cors` 返回JSON数据（不是404）
- OPTIONS请求返回CORS头

---

## 🔧 如果问题仍然存在

### 方法1: 在Vercel Dashboard中修改项目类型

1. Settings → General
2. 找到 **Framework Preset**
3. 如果显示 "Vite"、"Next.js" 等，改为 **"Other"**
4. 保存并重新部署

### 方法2: 删除并重新连接项目

1. 在Vercel Dashboard中删除当前项目
2. 重新导入GitHub仓库
3. 在导入时选择：
   - Framework: **Other**
   - Root Directory: `.`
   - Build Command: （留空）
   - Output Directory: （留空）

### 方法3: 检查package.json

确保 `package.json` 中有：
```json
{
  "engines": {
    "node": ">=18"
  }
}
```

---

## 📋 检查清单

部署前确认：
- [ ] `vercel.json` 已更新并提交
- [ ] `package.json` 中有 `engines.node` 配置
- [ ] Vercel Dashboard中Framework设置为 "Other"
- [ ] 所有API文件都在 `api/` 目录下
- [ ] 所有API文件都使用 `export default async function handler(req, res)`

部署后验证：
- [ ] Vercel Dashboard → Functions 中能看到所有API函数
- [ ] 函数列表显示 "Runtime: Node.js 18.x"
- [ ] 测试API端点返回200（不是404）
- [ ] OPTIONS请求返回正确的CORS头

---

## 🎯 快速修复命令

```bash
# 1. 提交更新的vercel.json
git add vercel.json
git commit -m "Fix Vercel Serverless Functions configuration"
git push

# 2. 等待2-3分钟让Vercel部署

# 3. 测试API
curl https://shopify-v587.vercel.app/api/test-cors
```

---

**提示**: 如果Vercel Dashboard中仍然显示"Static Assets"，说明项目类型识别错误。需要在Dashboard中手动修改Framework设置。
