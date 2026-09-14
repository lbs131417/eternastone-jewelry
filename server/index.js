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

const allowedShapes = new Set(["round", "cushion", "emerald", "pear", "asscher", "princess", "oval", "heart", "marquise", "radiant"]);
const allowedCategories = new Set(["engagement", "jewelry", "couple", "wedding"]);

function getSupabaseKey(admin = false) {
  return admin ? supabaseServiceRoleKey : supabaseServiceRoleKey || supabaseAnonKey;
}

function assertSupabaseConfigured(admin = false) {
  const key = getSupabaseKey(admin);
  if (!supabaseRestUrl || !key) {
    const missing = admin ? "SUPABASE_SERVICE_ROLE_KEY" : "VITE_SUPABASE_ANON_KEY";
    const error = new Error(`Supabase 未配置完整，请检查 SUPABASE_URL 和 ${missing}`);
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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
    return res.status(401).json({ error: "后台操作未授权，请填写正确的管理员 Token。" });
  }
  return next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "eternastone-commerce-api",
    supabase: Boolean(supabaseRestUrl && (supabaseAnonKey || supabaseServiceRoleKey))
  });
});

app.get("/api/products", async (_req, res, next) => {
  try {
    const rows = await supabaseRequest("/products?select=*&order=created_at.desc", { admin: false });
    res.json({ data: rows.map(rowToProduct) });
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

app.post("/api/uploads/product-image", spamGuard, requireAdminToken, async (req, res, next) => {
  try {
    const body = req.body || {};
    const dataUrl = String(body.dataUrl || "");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(422).json({ error: "图片数据格式不正确" });
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
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(422).json({ error: "订单至少需要一个商品" });
    const order = {
      id: `ET-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`,
      customer_email: cleanText(body.email),
      status: "pending_payment",
      currency: "USD",
      subtotal: toNumber(body.subtotal),
      discount: toNumber(body.discount),
      shipping: toNumber(body.shipping),
      tax: toNumber(body.tax),
      total: toNumber(body.total),
      shipping_address: body.address || {},
      items: items.map((item) => ({
        productId: cleanText(item.productId || item.id),
        title: cleanText(item.title),
        material: cleanText(item.material || item.metal),
        size: cleanText(item.size),
        quantity: Math.max(1, Math.round(toNumber(item.quantity || item.qty, 1))),
        unitPrice: toNumber(item.unitPrice || item.price)
      }))
    };
    const rows = await supabaseRequest("/orders", {
      method: "POST",
      admin: true,
      prefer: "return=representation",
      body: order
    });
    res.status(201).json({ data: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`Eternastone API listening on http://localhost:${port}`);
});
