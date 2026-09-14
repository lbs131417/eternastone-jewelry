# Eternastone 珠宝上线部署清单

推荐方案：Supabase 数据库/图片存储 + Render 后端 API + Vercel 前端。

## 1. 上线前你需要准备

- 一个 GitHub 仓库，用来放当前项目代码。
- 一个 Supabase 项目，数据库脚本已执行。
- Supabase Storage bucket：`product-images1`。
- 一个 Render 账号，用来部署后端 API。
- 一个 Vercel 账号，用来部署前端网站。
- 一个正式域名，例如 `eternastone.com`。

## 2. 重要安全提醒

- 不要提交 `.env` 到 GitHub。
- `.env.example` 只能放占位符，不能放真实密钥。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放后端平台 Render，不能放 Vercel 前端。
- `ADMIN_API_TOKEN` 必须设置成长随机字符串，用来保护后台新增/编辑/删除商品和图片上传接口。

## 3. Supabase 需要确认

1. SQL Editor 已执行：

   `server/supabase-schema.sql`

2. Storage 中存在 bucket：

   `product-images1`

3. bucket 用于商品图公开展示。若图片需要前端直接访问，请在 Supabase Storage policy 中允许公开读取，或把 bucket 设置为 public。

## 4. 部署后端 API 到 Render

Render 新建 Web Service，连接 GitHub 仓库。

配置：

```bash
Build Command: pnpm install
Start Command: pnpm run server
```

Render 环境变量：

```env
PORT=4000
CORS_ORIGIN=https://你的前端正式域名
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
SUPABASE_STORAGE_BUCKET=product-images1
ADMIN_API_TOKEN=你自己生成的长随机管理员Token
```

部署成功后，Render 会给你一个后端地址，例如：

```text
https://eternastone-api.onrender.com
```

检查：

```text
https://eternastone-api.onrender.com/api/health
```

如果返回 `ok: true`，说明后端正常。

## 5. 部署前端到 Vercel

Vercel 新建 Project，连接同一个 GitHub 仓库。

配置：

```bash
Build Command: pnpm run build
Output Directory: dist
```

Vercel 环境变量：

```env
VITE_API_BASE_URL=https://你的 Render 后端地址/api
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

不要在 Vercel 前端环境变量中填写：

```env
SUPABASE_SERVICE_ROLE_KEY
ADMIN_API_TOKEN
```

## 6. 后台上线后怎么用

打开：

```text
https://你的前端正式域名/admin
```

在后台顶部填写 `管理员 Token`，这个值必须和 Render 后端环境变量 `ADMIN_API_TOKEN` 一致。

填写并保存后，后台才可以：

- 新增商品
- 编辑商品
- 删除商品
- 上传商品图片到 Supabase Storage

## 7. 商品图片上传逻辑

后台上传商品图时：

- 铂金商品图上传到 Supabase Storage
- 黄金商品图上传到 Supabase Storage
- 玫瑰金商品图上传到 Supabase Storage
- 商品数据里只保存图片 URL，不把大图直接塞进数据库
- 如果上传失败，页面会临时用本地预览兜底，并提示检查管理员 Token 或 Storage 权限

## 8. 上线后测试顺序

1. 打开前端首页，确认页面正常。
2. 打开商品列表，确认商品来自 Supabase。
3. 打开商品详情，确认规格、材质图片、视频链接正常。
4. 打开 `/admin`，填写管理员 Token。
5. 新增一个测试商品。
6. 分别上传铂金、黄金、玫瑰金图片。
7. 保存后回到前端商品列表，确认新商品出现。
8. 打开商品详情，切换材质，确认图片跟着变化。
9. 删除测试商品。
10. 测试购物车和提交订单。

## 9. 支付上线建议

当前项目已有购物车和订单接口，完整在线支付建议下一步接：

- Stripe Checkout：信用卡、Apple Pay、Google Pay
- PayPal Checkout：适合海外客户

支付需要新增：

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
VITE_STRIPE_PUBLIC_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
```

建议先完成网站部署和商品后台，再接支付，避免上线变量太多一起排错。
