# everastone

Vite + React 前端，Express API 作为安全代理，数据使用 Supabase Postgres。适合部署到 Vercel / Cloudflare Pages 等无服务器平台，不需要自购服务器。

## 本地开发

```bash
pnpm install
pnpm run dev
```

前端默认运行在 `http://localhost:5173`。

另开一个终端启动 API：

```bash
copy .env.example .env
pnpm run server
```

API 默认运行在 `http://localhost:4000`，Vite 已配置 `/api` 代理。

## Supabase 配置

1. 在 Supabase 项目后台打开 SQL Editor。
2. 复制 `server/supabase-schema.sql` 的完整内容并执行，创建商品表和订单表。
3. 在本地 `.env` 或 Vercel Environment Variables 中填写：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images1
VITE_API_BASE_URL=/api
VITE_PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox
```

注意：

- `VITE_SUPABASE_URL` 请填写项目根地址，例如 `https://xxxx.supabase.co`，不要带 `/rest/v1/`。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量里，不能写入前端代码，也不要提交到 GitHub。
- `.env` 已在 `.gitignore` 中忽略。

## 当前已接入的线上数据能力

- 前台启动时会从 `/api/products` 拉取 Supabase 商品。
- 后台新增/编辑商品会写入 `/api/products`，并同步到前台商品列表/详情页。
- 后台删除商品会调用 `/api/products/:id`。
- 结算页会通过 PayPal 创建支付订单，付款成功后更新 Supabase 订单为“已付款”。
- 订单接口：`/api/orders`、`/api/paypal/create-order`、`/api/paypal/capture-order`。
- 如果 Supabase 暂未配置或表还没创建，页面会自动使用内置演示商品兜底，不会空白。

## 推荐上线方式

1. Supabase 创建表：执行 `server/supabase-schema.sql`。
2. Render 部署后端 API。
3. Vercel 部署前端网站。
4. 在 Render / Vercel 分别添加对应环境变量。
5. 后台 `/admin` 填写管理员 Token 后再维护商品。
6. 先使用 PayPal Sandbox 测试付款，确认成功后再把 `PAYPAL_MODE` 切换为 `live`。

完整上线步骤见：[DEPLOYMENT.md](./DEPLOYMENT.md)。
