import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";

const app = express();
const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "25mb" }));

const normalizeSupabaseUrl = (value = "") => value.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseRestUrl = supabaseUrl ? `${supabaseUrl}/rest/v1` : "";
const supabaseStorageUrl = supabaseUrl ? `${supabaseUrl}/storage/v1` : "";
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images1";
const adminApiToken = process.env.ADMIN_API_TOKEN || "";
const adminEmail = process.env.ADMIN_EMAIL || "";
const resendApiKey = process.env.RESEND_API_KEY || "";
const orderEmailFrom = process.env.ORDER_EMAIL_FROM || "everastone <orders@everastone.com>";
const paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID || "";
const paypalMode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
const paypalApiBase = paypalMode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const siteUrl = (process.env.SITE_URL || "https://everastone.com").replace(/\/$/, "");

const allowedShapes = new Set(["round", "emerald", "pear", "asscher", "princess", "oval", "heart", "marquise", "radiant"]);
const allowedCategories = new Set(["engagement", "jewelry", "couple", "wedding", "designer"]);
const allowedOrderStatuses = new Set(["待付款", "已付款", "制作中", "已发货", "已完成", "已取消", "退款中", "已退款"]);
const allowedPaymentStatuses = new Set(["待付款", "已付款", "退款中", "已退款", "支付失败", "已取消"]);
const defaultBlogPosts = [
  { id: "blog-oval-engagement-ring-guide", slug: "oval-lab-grown-diamond-ring-guide", title: "How to Choose an Oval Lab-Grown Diamond Ring", metaTitle: "How to Choose an Oval Lab-Grown Diamond Ring | everastone", metaDescription: "A practical guide to choosing an oval lab-grown diamond engagement ring by carat, ratio, color, clarity, setting style, and everyday comfort.", subtitle: "A warm, practical guide to carat, ratio and everyday comfort.", cover: "Oval engagement rings feel elongated, soft and quietly romantic.", content: "Oval lab-grown diamonds are loved for their graceful shape and finger-flattering presence.", status: "published", updatedAt: "2026-09-16" },
  { id: "blog-round-diamond-classic", slug: "round-diamond-classic-engagement-ring", title: "Why Round Diamonds Never Go Out of Style", metaTitle: "Why Round Lab-Grown Diamond Rings Never Go Out of Style | everastone", metaDescription: "Learn why round lab-grown diamond engagement rings remain a timeless choice for brilliance, symmetry, proposal sparkle, and long-lasting style.", subtitle: "The classic fire, symmetry and proposal-ready sparkle couples trust.", cover: "Round diamonds are timeless because their brilliance feels effortless.", content: "Round lab-grown diamonds are easy to style across solitaire, halo and pavé settings.", status: "published", updatedAt: "2026-09-16" },
  { id: "blog-pear-diamond-romance", slug: "pear-diamond-romantic-engagement-ring", title: "The Romantic Shape of a Pear Diamond", metaTitle: "Pear Lab-Grown Diamond Engagement Ring Guide | everastone", metaDescription: "Explore pear-shaped lab-grown diamond rings, from romantic teardrop proportions to elegant settings that flatter the hand.", subtitle: "A teardrop silhouette with elegant movement and delicate emotion.", cover: "Pear diamonds bring a gentle, expressive line to engagement rings.", content: "Pear-shaped lab-grown diamonds balance softness and drama.", status: "published", updatedAt: "2026-09-16" }
];

function getSupabaseKey(admin = false) {
  return admin ? supabaseServiceRoleKey : supabaseServiceRoleKey || supabaseAnonKey;
}

function assertSupabaseConfigured(admin = false) {
  const key = getSupabaseKey(admin);
  if (!supabaseRestUrl || !key) {
    const missing = admin ? "SUPABASE_SERVICE_ROLE_KEY" : "VITE_SUPABASE_ANON_KEY";
    const error = new Error(`Supabase is not fully configured. Please check SUPABASE_URL and ${missing}.`);
    error.status = 503;
    throw error;
  }
}

async function supabaseRequest(path, { method = "GET", body, admin = false, prefer } = {}) {
  assertSupabaseConfigured(admin);
  const key = getSupabaseKey(admin);
  const response = await fetch(`${supabaseRestUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || "Supabase request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function supabaseStorageUpload(path, buffer, contentType = "application/octet-stream") {
  assertSupabaseConfigured(true);
  const key = getSupabaseKey(true);
  const cleanPath = String(path).replace(/^\/+/, "");
  const response = await fetch(`${supabaseStorageUrl}/object/${encodeURIComponent(supabaseStorageBucket)}/${cleanPath}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: buffer
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || "Supabase storage upload failed");
    error.status = response.status;
    throw error;
  }
  return `${supabaseUrl}/storage/v1/object/public/${supabaseStorageBucket}/${cleanPath}`;
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 800);
}

function cleanLongText(value, fallback = "", limit = 20000) {
  return String(value ?? fallback).trim().slice(0, limit);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function moneyValue(value) {
  return Math.max(0, toNumber(value)).toFixed(2);
}

function normalizeMainMaterial(value = "") {
  const material = String(value).toLowerCase();
  if (material.includes("黄金") || material.includes("yellow")) return "黄金";
  if (material.includes("玫瑰") || material.includes("rose")) return "玫瑰金";
  return "铂金";
}

function normalizePurity(material = "", purity = "") {
  const mainMaterial = normalizeMainMaterial(material);
  if (mainMaterial === "铂金") return "铂金";
  const explicitPurity = String(purity || "").toUpperCase();
  if (/^1[0-8]K$/.test(explicitPurity)) return explicitPurity;
  const materialPurity = String(material || "").toUpperCase().match(/1[0-8]K/);
  return materialPurity?.[0] || "18K";
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function blogPathFromPost(post = {}) {
  return `/blog/${post.slug || slugify(post.title) || post.id}`;
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blogToRow(post = {}) {
  const title = cleanText(post.title);
  const slug = slugify(post.slug || title);
  return {
    id: cleanText(post.id || `blog-${nanoid(10)}`),
    slug,
    title,
    meta_title: cleanText(post.metaTitle || `${title} | everastone Blog`),
    meta_description: cleanText(post.metaDescription || post.subtitle || post.cover, "").slice(0, 320),
    subtitle: cleanText(post.subtitle),
    cover: cleanLongText(post.cover, "", 1200),
    image: cleanLongText(post.image, "", 200000),
    content: cleanLongText(post.content, "", 20000),
    status: post.status === "draft" ? "draft" : "published",
    updated_at: cleanText(post.updatedAt || new Date().toISOString().slice(0, 10))
  };
}

function rowToBlogPost(row = {}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    subtitle: row.subtitle,
    cover: row.cover,
    image: row.image,
    content: row.content,
    status: row.status || "published",
    updatedAt: row.updated_at || row.updatedAt || row.modified_at || row.created_at
  };
}

function buildSitemapXml(blogPosts = []) {
  const staticUrls = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/diamonds", priority: "0.9", changefreq: "weekly" },
    { loc: "/couple-rings", priority: "0.8", changefreq: "monthly" },
    { loc: "/designer-styles", priority: "0.8", changefreq: "monthly" },
    { loc: "/custom-ring", priority: "0.8", changefreq: "monthly" },
    { loc: "/brand-story", priority: "0.7", changefreq: "monthly" },
    { loc: "/blog", priority: "0.7", changefreq: "weekly" }
  ];
  const blogUrls = blogPosts
    .filter((post) => post.status !== "draft")
    .map((post) => ({
      loc: blogPathFromPost(post),
      priority: "0.7",
      changefreq: "monthly",
      lastmod: String(post.updatedAt || new Date().toISOString().slice(0, 10)).slice(0, 10)
    }));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...blogUrls].map((item) => `  <url>
    <loc>${xmlEscape(`${siteUrl}${item.loc}`)}</loc>
    ${item.lastmod ? `<lastmod>${xmlEscape(item.lastmod)}</lastmod>` : ""}
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join("\n")}
</urlset>`;
}

function productToRow(product = {}) {
  const sku = cleanText(product.sku || product.id || `SKU-${nanoid(8).toUpperCase()}`);
  const shape = allowedShapes.has(product.shape) ? product.shape : "round";
  const category = allowedCategories.has(product.category) ? product.category : "engagement";
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : product.image ? [product.image] : [];
  const materialImages = product.materialImages ?? {};
  const normalizedMaterialImages = {
    whiteGold: Array.isArray(materialImages.whiteGold) ? materialImages.whiteGold.filter(Boolean) : [],
    roseGold: Array.isArray(materialImages.roseGold) ? materialImages.roseGold.filter(Boolean) : [],
    yellowGold: Array.isArray(materialImages.yellowGold) ? materialImages.yellowGold.filter(Boolean) : []
  };
  const videoUrls = Array.isArray(product.videoUrls) ? product.videoUrls.map((url) => cleanText(url)).filter(Boolean) : [];
  const hasRichMedia = Object.values(normalizedMaterialImages).some((items) => items.length) || videoUrls.length;
  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => ({
        carat: cleanText(variant.carat, "1.00"),
        material: normalizeMainMaterial(variant.material || product.material || "铂金"),
        purity: normalizePurity(variant.material || product.material || "铂金", variant.purity),
        price: toNumber(variant.price, product.price)
      }))
    : [];
  const primaryImage = String(product.image ?? "")
    || normalizedMaterialImages.whiteGold[0]
    || normalizedMaterialImages.yellowGold[0]
    || normalizedMaterialImages.roseGold[0]
    || images[0]
    || "";

  return {
    id: sku,
    sku,
    category,
    name: cleanText(product.name, `${sku} 商品`),
    price: toNumber(product.price),
    stock: Math.max(0, Math.round(toNumber(product.stock))),
    material: normalizeMainMaterial(product.material || "铂金"),
    main_stone: cleanText(product.mainStone, "培育钻石"),
    shape,
    carat: toNumber(product.carat, 1),
    color: cleanText(product.color, "E"),
    clarity: cleanText(product.clarity, "VS1"),
    cut: cleanText(product.cut, "Excellent"),
    certificate: cleanText(product.certificate, "IGI"),
    polish: cleanText(product.polish, "Excellent"),
    symmetry: cleanText(product.symmetry, "Excellent"),
    depth: cleanText(product.depth, "62%"),
    table_percent: cleanText(product.table, "58%"),
    ratio: cleanText(product.ratio, "1.00"),
    fluorescence: cleanText(product.fluorescence, "None"),
    size_text: cleanText(product.size, "US 5-9 / UK J-R"),
    status: cleanText(product.status, "上架"),
    description: cleanText(product.description, ""),
    image_caption: cleanText(product.imageCaption, ""),
    image_alt: cleanText(product.name, `${sku} 商品`),
    image_title: cleanText(product.imageTitle, ""),
    image_url: primaryImage,
    images: hasRichMedia ? { default: images, ...normalizedMaterialImages, videos: videoUrls } : images,
    variants,
    fast: product.fast ?? product.status === "上架",
    real_photo: product.realPhoto ?? images.length > 0,
    sold: Math.max(0, Math.round(toNumber(product.sold)))
  };
}

function rowToProduct(row = {}) {
  const rawImages = row.images;
  const richMedia = rawImages && !Array.isArray(rawImages) && typeof rawImages === "object" ? rawImages : {};
  const defaultImages = Array.isArray(rawImages)
    ? rawImages.filter(Boolean)
    : Array.isArray(richMedia.default)
      ? richMedia.default.filter(Boolean)
      : row.image_url
        ? [row.image_url]
        : [];
  const materialImages = {
    whiteGold: Array.isArray(richMedia.whiteGold) ? richMedia.whiteGold.filter(Boolean) : [],
    roseGold: Array.isArray(richMedia.roseGold) ? richMedia.roseGold.filter(Boolean) : [],
    yellowGold: Array.isArray(richMedia.yellowGold) ? richMedia.yellowGold.filter(Boolean) : []
  };
  const videoUrls = Array.isArray(richMedia.videos) ? richMedia.videos.filter(Boolean) : [];
  const fallbackImage = row.image_url
    || defaultImages[0]
    || materialImages.whiteGold[0]
    || materialImages.roseGold[0]
    || materialImages.yellowGold[0]
    || "";

  return {
    id: row.id,
    sku: row.sku || row.id,
    category: row.category,
    name: row.name,
    price: Number(row.price) || 0,
    stock: Number(row.stock) || 0,
    material: row.material,
    mainStone: row.main_stone,
    shape: row.shape,
    carat: Number(row.carat) || 1,
    color: row.color,
    clarity: row.clarity,
    cut: row.cut,
    certificate: row.certificate,
    polish: row.polish,
    symmetry: row.symmetry,
    depth: row.depth,
    table: row.table_percent,
    ratio: row.ratio,
    fluorescence: row.fluorescence,
    size: row.size_text,
    status: row.status,
    description: row.description,
    imageCaption: row.image_caption,
    imageAlt: row.image_alt || row.name,
    imageTitle: row.image_title || "",
    image: fallbackImage,
    images: defaultImages.length ? defaultImages : fallbackImage ? [fallbackImage] : [],
    materialImages,
    videoUrls,
    variants: Array.isArray(row.variants) ? row.variants : [],
    fast: Boolean(row.fast),
    realPhoto: Boolean(row.real_photo),
    sold: Number(row.sold) || 0,
    createdAt: row.created_at
  };
}

function normalizeOrderItem(item = {}) {
  const quantity = Math.max(1, Math.round(toNumber(item.quantity || item.qty, 1)));
  const unitPrice = toNumber(item.unitPrice || item.price);
  const specs = item.specs || {
    material: cleanText(item.material || item.metal),
    size: cleanText(item.size),
    carat: cleanText(item.carat),
    shape: cleanText(item.shape),
    purity: cleanText(item.purity)
  };
  return {
    productId: cleanText(item.productId || item.id),
    sku: cleanText(item.sku || item.productId || item.id),
    title: cleanText(item.title || item.name),
    image: cleanText(item.image),
    specs,
    material: cleanText(item.material || item.metal || specs.material),
    size: cleanText(item.size || specs.size),
    quantity,
    unitPrice,
    lineTotal: toNumber(item.lineTotal, quantity * unitPrice)
  };
}

function rowToOrder(row = {}) {
  return {
    id: row.id,
    orderNumber: row.order_number || row.id,
    email: row.customer_email,
    items: row.items ?? [],
    productInfo: row.product_info ?? row.items ?? [],
    productSpecs: row.product_specs ?? [],
    size: row.ring_size,
    address: row.shipping_address ?? {},
    paymentStatus: row.payment_status,
    orderStatus: row.order_status || row.status,
    status: row.status,
    trackingNumber: row.tracking_number || row.logistics_no || "",
    logisticsProvider: row.logistics_provider || "",
    logisticsUrl: row.logistics_url || "",
    paymentIntentId: row.payment_intent_id || "",
    amount: Number(row.order_amount ?? row.total) || 0,
    discount: Number(row.discount_amount ?? row.discount) || 0,
    subtotal: Number(row.subtotal) || 0,
    shipping: Number(row.shipping) || 0,
    tax: Number(row.tax) || 0,
    currency: row.currency || "USD",
    orderedAt: row.ordered_at || row.created_at,
    createdAt: row.created_at
  };
}

function summarizeAdminData(orders = [], events = []) {
  const paidOrders = orders.filter((order) => ["已付款", "制作中", "已发货", "已完成"].includes(order.order_status || order.status));
  const refundedOrders = orders.filter((order) => ["退款中", "已退款"].includes(order.order_status || order.status));
  const salesAmount = paidOrders.reduce((sum, order) => sum + toNumber(order.order_amount ?? order.total), 0);
  const totalCarat = paidOrders.reduce((sum, order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    return sum + items.reduce((itemSum, item) => itemSum + toNumber(item.specs?.carat || item.carat) * toNumber(item.quantity, 1), 0);
  }, 0);
  const productSales = new Map();
  paidOrders.forEach((order) => {
    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const key = item.productId || item.sku || item.title || "未知商品";
      const current = productSales.get(key) || { productId: key, title: item.title || key, quantity: 0, amount: 0 };
      current.quantity += toNumber(item.quantity, 1);
      current.amount += toNumber(item.lineTotal || item.unitPrice);
      productSales.set(key, current);
    });
  });
  const eventCount = (type) => events.filter((event) => event.event_type === type).length;
  const pageCounts = new Map();
  events.filter((event) => event.event_type === "page_view").forEach((event) => {
    const key = event.page_path || "/";
    pageCounts.set(key, (pageCounts.get(key) || 0) + 1);
  });
  return {
    orders: {
      total: orders.length,
      paid: paidOrders.length,
      salesAmount,
      totalCarat,
      averageOrderValue: paidOrders.length ? salesAmount / paidOrders.length : 0,
      refundRate: orders.length ? refundedOrders.length / orders.length : 0,
      topProducts: Array.from(productSales.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8)
    },
    traffic: {
      pageViews: eventCount("page_view"),
      productViews: eventCount("product_view"),
      addToCart: eventCount("add_to_cart"),
      checkoutStarts: eventCount("checkout_start"),
      paypalStarts: eventCount("paypal_start"),
      paypalPaid: eventCount("paypal_paid"),
      topPages: Array.from(pageCounts.entries()).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8)
    }
  };
}

async function sendResendEmail({ to, subject, html }) {
  if (!resendApiKey || !to) return null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: orderEmailFrom, to, subject, html })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn("Resend email failed:", payload?.message || payload?.error || response.statusText);
    return null;
  }
  return payload;
}

async function notifyOrderCreated(order) {
  const itemText = (order.items ?? []).map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""} · ${moneyValue(item.lineTotal)}`).join("<br/>");
  const address = order.shipping_address ?? {};
  const addressText = [address.firstName, address.lastName, address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ");
  await Promise.allSettled([
    sendResendEmail({
      to: order.customer_email,
      subject: `Everastone order created: ${order.order_number}`,
      html: `<h2>Your order has been created</h2><p>Order No.: ${order.order_number}</p><p>${itemText}</p><p>Shipping address: ${addressText}</p><p>Subtotal: ${order.currency} ${moneyValue(order.subtotal)}</p><p>First-order offer: -${order.currency} ${moneyValue(order.discount_amount)}</p><p>Order total: ${order.currency} ${moneyValue(order.order_amount)}</p><p>Status: ${order.order_status}</p>`
    }),
    adminEmail ? sendResendEmail({
      to: adminEmail,
      subject: `New order received: ${order.order_number}`,
      html: `<h2>New order received</h2><p>Customer email: ${order.customer_email}</p><p>${itemText}</p><p>Order total: ${order.currency} ${order.order_amount}</p>`
    }) : null
  ]);
}

async function notifyPaymentPaid(order) {
  await Promise.allSettled([
    sendResendEmail({
      to: order.customer_email,
      subject: `Everastone payment received: ${order.order_number}`,
      html: `<h2>Payment received</h2><p>Order No.: ${order.order_number}</p><p>Payment method: PayPal</p><p>Paid amount: ${order.currency} ${moneyValue(order.order_amount)}</p><p>Order status: ${order.order_status}</p><p>We will begin arranging production. Standard crafting takes about 15 days, followed by 3-6 days for international air delivery.</p>`
    }),
    adminEmail ? sendResendEmail({
      to: adminEmail,
      subject: `PayPal payment received: ${order.order_number}`,
      html: `<h2>Order paid</h2><p>Customer email: ${order.customer_email}</p><p>Order total: ${order.currency} ${moneyValue(order.order_amount)}</p><p>Please confirm the production schedule in the admin dashboard.</p>`
    }) : null
  ]);
}

function buildOrderFromRequest(body = {}, overrides = {}) {
  const items = Array.isArray(body.items) ? body.items.map(normalizeOrderItem) : [];
  if (!items.length) {
    const error = new Error("At least one item is required to place an order.");
    error.status = 422;
    throw error;
  }
  const email = cleanText(body.email || body.customerEmail);
  if (!email || !email.includes("@")) {
    const error = new Error("Please enter a valid customer email.");
    error.status = 422;
    throw error;
  }
  const subtotal = toNumber(body.subtotal, items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discount = toNumber(body.discount ?? body.discountAmount, Math.round(subtotal * 0.1 * 100) / 100);
  const shipping = toNumber(body.shipping);
  const tax = toNumber(body.tax);
  const total = toNumber(body.total ?? body.orderAmount, subtotal - discount + shipping + tax);
  const orderNumber = overrides.orderNumber || `ET-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
  return {
    id: orderNumber,
    order_number: orderNumber,
    customer_email: email,
    status: overrides.orderStatus || "待付款",
    order_status: overrides.orderStatus || "待付款",
    payment_status: overrides.paymentStatus || "待付款",
    currency: "USD",
    subtotal,
    discount,
    discount_amount: discount,
    shipping,
    tax,
    total,
    order_amount: total,
    shipping_address: body.address || {},
    items,
    product_info: items.map(({ productId, sku, title, image, quantity, unitPrice, lineTotal }) => ({ productId, sku, title, image, quantity, unitPrice, lineTotal })),
    product_specs: items.map(({ productId, specs, material, size }) => ({ productId, specs, material, size })),
    ring_size: items.map((item) => item.size).filter(Boolean).join(" / "),
    payment_provider: overrides.paymentProvider || null,
    payment_intent_id: overrides.paymentIntentId || null,
    ordered_at: new Date().toISOString()
  };
}

function assertPayPalConfigured() {
  if (!paypalClientId || !paypalClientSecret) {
    const error = new Error("PayPal is not fully configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the backend environment variables.");
    error.status = 503;
    throw error;
  }
}

async function getPayPalAccessToken() {
  assertPayPalConfigured();
  const credentials = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString("base64");
  const response = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.message || "PayPal authorization failed.");
    error.status = response.status;
    throw error;
  }
  return payload.access_token;
}

async function paypalRequest(path, { method = "POST", body } = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalApiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `ET-${Date.now()}-${nanoid(8)}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.details?.[0]?.description || "PayPal request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function verifyPayPalWebhook(req) {
  if (!paypalWebhookId) return false;
  const verification = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    body: {
      auth_algo: req.get("paypal-auth-algo"),
      cert_url: req.get("paypal-cert-url"),
      transmission_id: req.get("paypal-transmission-id"),
      transmission_sig: req.get("paypal-transmission-sig"),
      transmission_time: req.get("paypal-transmission-time"),
      webhook_id: paypalWebhookId,
      webhook_event: req.body
    }
  });
  return verification?.verification_status === "SUCCESS";
}

async function updateOrderById(id, patch) {
  const rows = await supabaseRequest(`/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    admin: true,
    prefer: "return=representation",
    body: patch
  });
  return rows[0];
}

function spamGuard(req, res, next) {
  if (req.body?.companyWebsite) {
    return res.status(422).json({ error: "Submission rejected." });
  }
  next();
}

function requireAdminToken(req, res, next) {
  if (!adminApiToken) return next();
  const token = req.get("x-admin-token") || "";
  if (token !== adminApiToken) {
    return res.status(401).json({ error: "Admin action is not authorized. Please enter the correct admin token." });
  }
  return next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "everastone-commerce-api",
    supabase: Boolean(supabaseRestUrl && (supabaseAnonKey || supabaseServiceRoleKey))
  });
});

app.get("/sitemap.xml", async (_req, res) => {
  let posts = defaultBlogPosts;
  try {
    const rows = await supabaseRequest("/blog_posts?status=eq.published&select=*&order=updated_at.desc", { admin: false });
    if (Array.isArray(rows) && rows.length) posts = rows.map(rowToBlogPost);
  } catch (error) {
    console.warn("Dynamic sitemap fell back to default blog posts:", error.message);
  }
  res.type("application/xml").send(buildSitemapXml(posts));
});

app.get("/api/products", async (_req, res, next) => {
  try {
    const rows = await supabaseRequest("/products?select=*&order=created_at.desc", { admin: false });
    res.json({ data: rows.filter((row) => allowedShapes.has(row.shape)).map(rowToProduct) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", spamGuard, requireAdminToken, async (req, res, next) => {
  try {
    const row = productToRow(req.body);
    const rows = await supabaseRequest("/products", {
      method: "POST",
      admin: true,
      prefer: "resolution=merge-duplicates,return=representation",
      body: row
    });
    res.status(201).json({ data: rowToProduct(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", requireAdminToken, async (req, res, next) => {
  try {
    await supabaseRequest(`/products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      admin: true,
      prefer: "return=minimal"
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/blog-posts", async (_req, res) => {
  try {
    const rows = await supabaseRequest("/blog_posts?select=*&order=updated_at.desc", { admin: false });
    res.json({ data: rows.map(rowToBlogPost) });
  } catch (error) {
    console.warn("Blog API fell back to default posts:", error.message);
    res.json({ data: defaultBlogPosts });
  }
});

app.post("/api/blog-posts", spamGuard, requireAdminToken, async (req, res, next) => {
  try {
    const row = blogToRow(req.body);
    if (!row.title || !row.slug) return res.status(422).json({ error: "Please enter the blog title and SEO URL slug." });
    const rows = await supabaseRequest("/blog_posts", {
      method: "POST",
      admin: true,
      prefer: "resolution=merge-duplicates,return=representation",
      body: row
    });
    res.status(201).json({ data: rowToBlogPost(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/blog-posts/:id", requireAdminToken, async (req, res, next) => {
  try {
    await supabaseRequest(`/blog_posts?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      admin: true,
      prefer: "return=minimal"
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/uploads/product-image", spamGuard, requireAdminToken, async (req, res, next) => {
  try {
    const body = req.body || {};
    const dataUrl = String(body.dataUrl || "");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(422).json({ error: "Invalid image data format." });
    const contentType = cleanText(body.contentType || match[1], "image/jpeg");
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg";
    const sku = cleanText(body.sku || "product").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
    const material = cleanText(body.material || "material").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
    const filePath = `products/${sku}/${material}/${Date.now()}-${nanoid(8)}.${extension}`;
    const publicUrl = await supabaseStorageUpload(filePath, Buffer.from(match[2], "base64"), contentType);
    res.status(201).json({ data: { url: publicUrl, path: filePath } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", spamGuard, async (req, res, next) => {
  try {
    const order = buildOrderFromRequest(req.body || {});
    const rows = await supabaseRequest("/orders", {
      method: "POST",
      admin: true,
      prefer: "return=representation",
      body: order
    });
    const savedOrder = rows[0];
    notifyOrderCreated(savedOrder).catch((error) => console.warn("Order email notification failed:", error.message));
    res.status(201).json({ data: rowToOrder(savedOrder) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paypal/create-order", spamGuard, async (req, res, next) => {
  try {
    const order = buildOrderFromRequest(req.body || {}, { paymentProvider: "PayPal" });
    const paypalOrder = await paypalRequest("/v2/checkout/orders", {
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.id,
            invoice_id: order.id,
            custom_id: order.id,
            description: `Everastone order ${order.id}`,
            amount: {
              currency_code: order.currency,
              value: moneyValue(order.order_amount),
              breakdown: {
                item_total: { currency_code: order.currency, value: moneyValue(order.subtotal) },
                discount: { currency_code: order.currency, value: moneyValue(order.discount_amount) },
                shipping: { currency_code: order.currency, value: moneyValue(order.shipping) },
                tax_total: { currency_code: order.currency, value: moneyValue(order.tax) }
              }
            }
          }
        ]
      }
    });
    const rows = await supabaseRequest("/orders", {
      method: "POST",
      admin: true,
      prefer: "return=representation",
      body: { ...order, payment_intent_id: paypalOrder.id }
    });
    res.status(201).json({ data: { paypalOrderId: paypalOrder.id, order: rowToOrder(rows[0]) } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paypal/capture-order", spamGuard, async (req, res, next) => {
  try {
    const paypalOrderId = cleanText(req.body?.paypalOrderId);
    const localOrderId = cleanText(req.body?.localOrderId);
    if (!paypalOrderId || !localOrderId) return res.status(422).json({ error: "Missing PayPal order ID or local order ID." });
    const capture = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: "POST" });
    const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || paypalOrderId;
    const isCompleted = capture?.status === "COMPLETED";
    const savedOrder = await updateOrderById(localOrderId, {
      payment_provider: "PayPal",
      payment_intent_id: captureId,
      payment_status: isCompleted ? "已付款" : "待付款",
      order_status: isCompleted ? "已付款" : "待付款",
      status: isCompleted ? "已付款" : "待付款",
      paid_at: isCompleted ? new Date().toISOString() : null
    });
    if (isCompleted) notifyPaymentPaid(savedOrder).catch((error) => console.warn("Payment email notification failed:", error.message));
    res.json({ data: { order: rowToOrder(savedOrder), paypal: { id: paypalOrderId, status: capture?.status, captureId } } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/paypal/webhook", async (req, res, next) => {
  try {
    const verified = await verifyPayPalWebhook(req);
    if (!verified) return res.status(400).json({ error: "PayPal webhook verification failed." });
    const eventType = req.body?.event_type;
    const resource = req.body?.resource || {};
    const relatedOrderId = resource?.supplementary_data?.related_ids?.order_id || resource?.custom_id || "";
    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && relatedOrderId) {
      const rows = await supabaseRequest(`/orders?payment_intent_id=eq.${encodeURIComponent(relatedOrderId)}&select=*`, { admin: true });
      const orderId = rows?.[0]?.id || resource?.invoice_id || resource?.custom_id;
      if (orderId) {
        const savedOrder = await updateOrderById(orderId, {
          payment_provider: "PayPal",
          payment_intent_id: resource.id || relatedOrderId,
          payment_status: "已付款",
          order_status: "已付款",
          status: "已付款",
          paid_at: new Date().toISOString()
        });
        notifyPaymentPaid(savedOrder).catch((error) => console.warn("Webhook payment email notification failed:", error.message));
      }
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", requireAdminToken, async (_req, res, next) => {
  try {
    const rows = await supabaseRequest("/orders?select=*&order=created_at.desc", { admin: true });
    res.json({ data: rows.map(rowToOrder) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/lookup", spamGuard, async (req, res, next) => {
  try {
    const email = cleanText(req.body?.email).toLowerCase();
    if (!email || !email.includes("@")) return res.status(422).json({ error: "Please enter a valid checkout email." });
    const orderNumber = cleanText(req.body?.orderNumber);
    const path = orderNumber
      ? `/orders?customer_email=eq.${encodeURIComponent(email)}&order_number=eq.${encodeURIComponent(orderNumber)}&select=*&order=created_at.desc&limit=20`
      : `/orders?customer_email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=20`;
    const rows = await supabaseRequest(path, { admin: true });
    res.json({ data: rows.map(rowToOrder) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analytics/events", spamGuard, async (req, res, next) => {
  try {
    const body = req.body || {};
    const event = {
      event_type: cleanText(body.eventType || body.event_type || "page_view", "page_view").slice(0, 80),
      page_path: cleanText(body.pagePath || body.page_path || ""),
      product_id: body.productId ? cleanText(body.productId) : null,
      customer_email: body.email ? cleanText(body.email).toLowerCase() : null,
      session_id: cleanText(body.sessionId || ""),
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
    };
    await supabaseRequest("/analytics_events", {
      method: "POST",
      admin: true,
      prefer: "return=minimal",
      body: event
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics/summary", requireAdminToken, async (_req, res, next) => {
  try {
    const [orders, events] = await Promise.all([
      supabaseRequest("/orders?select=*&order=created_at.desc&limit=1000", { admin: true }),
      supabaseRequest("/analytics_events?select=*&order=created_at.desc&limit=5000", { admin: true })
    ]);
    res.json({ data: summarizeAdminData(orders, events) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id", spamGuard, requireAdminToken, async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    if (body.orderStatus && allowedOrderStatuses.has(body.orderStatus)) {
      patch.order_status = body.orderStatus;
      patch.status = body.orderStatus;
    }
    if (body.paymentStatus && allowedPaymentStatuses.has(body.paymentStatus)) {
      patch.payment_status = body.paymentStatus;
      if (body.paymentStatus === "已付款") patch.paid_at = new Date().toISOString();
    }
    if (body.trackingNumber !== undefined) {
      patch.tracking_number = cleanText(body.trackingNumber);
      patch.logistics_no = cleanText(body.trackingNumber);
    }
    if (body.logisticsProvider !== undefined) patch.logistics_provider = cleanText(body.logisticsProvider);
    if (body.logisticsUrl !== undefined) patch.logistics_url = cleanText(body.logisticsUrl);
    if (body.note !== undefined) patch.note = cleanText(body.note);
    if (!Object.keys(patch).length) return res.status(422).json({ error: "No order fields are available to update." });
    const rows = [await updateOrderById(req.params.id, patch)];
    res.json({ data: rowToOrder(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`everastone API listening on http://localhost:${port}`);
});
