import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  ChevronDown,
  CreditCard,
  Diamond,
  Facebook,
  Heart,
  Instagram,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PackagePlus,
  Plane,
  RotateCcw,
  Ruler,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
  Youtube
} from "lucide-react";
import { addMyFavorite, capturePayPalOrder, createPayPalOrder, createStorefrontOrder, deleteBlogPostApi, deleteMyAddress, deleteStorefrontProduct, fetchAdminAnalyticsSummary, fetchAdminOrders, fetchAuthUser, fetchBlogPosts, fetchMyAddresses, fetchMyFavorites, fetchMyOrders, fetchStorefrontProducts, getAdminApiToken, getGoogleSignInUrl, lookupGuestOrders, saveBlogPostApi, saveMyAddress, saveStorefrontProduct, sendPasswordRecovery, setAdminApiToken, signInWithEmail, signUpWithEmail, trackAnalyticsEvent, updateAdminOrder, uploadProductImage } from "./api.js";
import {
  categories,
  certificates,
  clarities,
  colors,
  diamonds as initialDiamonds,
  fluorescence,
  grades,
  settings,
  shapes,
  ukSizes,
  usSizes
} from "./data.js";

const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const formatArrivalDate = (days = 23) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
};

const FRONTEND_PRODUCTS_STORAGE_KEY = "everastone.frontend.products";
const CUSTOMER_SESSION_STORAGE_KEY = "everastone.customer.session";
const CUSTOMER_PROFILES_STORAGE_KEY = "everastone.customer.profiles";
const ANALYTICS_SESSION_STORAGE_KEY = "everastone.analytics.sessionId";
const SUPPORT_SESSIONS_STORAGE_KEY = "everastone.support.sessions";
const SUPPORT_VISITOR_STORAGE_KEY = "everastone.support.visitorId";
const SOCIAL_LINKS_STORAGE_KEY = "everastone.site.socialLinks";
const BLOG_POSTS_STORAGE_KEY = "everastone.blog.posts";
const defaultSocialLinks = {
  instagram: "",
  youtube: "",
  facebook: ""
};
const defaultBlogPosts = [
  {
    id: "blog-oval-engagement-ring-guide",
    slug: "oval-lab-grown-diamond-ring-guide",
    title: "How to Choose an Oval Lab-Grown Diamond Ring",
    metaTitle: "How to Choose an Oval Lab-Grown Diamond Ring | everastone",
    metaDescription: "A practical guide to choosing an oval lab-grown diamond engagement ring by carat, ratio, color, clarity, setting style, and everyday comfort.",
    subtitle: "A warm, practical guide to carat, ratio and everyday comfort.",
    cover: "Oval engagement rings feel elongated, soft and quietly romantic.",
    image: shapes.find((shape) => shape.key === "oval")?.image,
    content: "Oval lab-grown diamonds are loved for their graceful shape and finger-flattering presence. Start with the carat range, then look at ratio, color, clarity and the setting style you want to wear every day.",
    status: "published",
    updatedAt: "2026-09-16"
  },
  {
    id: "blog-round-diamond-classic",
    slug: "round-diamond-classic-engagement-ring",
    title: "Why Round Diamonds Never Go Out of Style",
    metaTitle: "Why Round Lab-Grown Diamond Rings Never Go Out of Style | everastone",
    metaDescription: "Learn why round lab-grown diamond engagement rings remain a timeless choice for brilliance, symmetry, proposal sparkle, and long-lasting style.",
    subtitle: "The classic fire, symmetry and proposal-ready sparkle couples trust.",
    cover: "Round diamonds are timeless because their brilliance feels effortless.",
    image: shapes.find((shape) => shape.key === "round")?.image,
    content: "A round lab-grown diamond is the easiest shape to style across solitaire, halo and pavé settings. If you want a ring that feels classic today and decades from now, round remains the safest romantic choice.",
    status: "published",
    updatedAt: "2026-09-16"
  },
  {
    id: "blog-pear-diamond-romance",
    slug: "pear-diamond-romantic-engagement-ring",
    title: "The Romantic Shape of a Pear Diamond",
    metaTitle: "Pear Lab-Grown Diamond Engagement Ring Guide | everastone",
    metaDescription: "Explore pear-shaped lab-grown diamond rings, from romantic teardrop proportions to elegant settings that flatter the hand.",
    subtitle: "A teardrop silhouette with elegant movement and delicate emotion.",
    cover: "Pear diamonds bring a gentle, expressive line to engagement rings.",
    image: shapes.find((shape) => shape.key === "pear")?.image,
    content: "Pear-shaped lab-grown diamonds balance softness and drama. They can visually lengthen the hand and feel especially romantic in halo, three-stone and delicate pavé designs.",
    status: "published",
    updatedAt: "2026-09-16"
  }
];
const readSharedFrontendProducts = () => {
  try {
    const stored = window.localStorage.getItem(FRONTEND_PRODUCTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const readSupportSessions = () => {
  try {
    const stored = window.localStorage.getItem(SUPPORT_SESSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const writeSupportSessions = (sessions) => {
  window.localStorage.setItem(SUPPORT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new CustomEvent("everastone-support-updated"));
};

const readCustomerProfiles = () => {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_PROFILES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const slugify = (value = "") => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

const blogPathFromPost = (post = {}) => `/blog/${post.slug || slugify(post.title) || post.id}`;

const buildBlogSitemapXml = (posts = []) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${posts.filter((post) => post.status !== "draft").map((post) => `  <url>
    <loc>https://everastone.com${blogPathFromPost(post)}</loc>
    <lastmod>${post.updatedAt || new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join("\n")}
</urlset>`;

const upsertCustomerProfile = (session = {}, source = "email", extra = {}) => {
  const user = session.user ?? {};
  const id = user.id || user.sub || session.user_id || session.email || `customer-${Date.now()}`;
  const email = user.email || session.email || "";
  const now = new Date().toISOString();
  const profile = {
    id,
    email,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || email?.split("@")[0] || `Customer ${String(id).slice(-4)}`,
    source,
    provider: user.app_metadata?.provider || source,
    lastSignInAt: now,
    createdAt: user.created_at || now,
    orderCount: Number(extra.orderCount ?? extra.incrementOrderCount ?? 0),
    orderEmails: Array.from(new Set([...(extra.orderEmails ?? []), email].filter(Boolean))),
    rawUser: user,
    ...extra
  };
  const profiles = readCustomerProfiles();
  const nextProfiles = profiles.some((item) => item.id === id || (email && item.email === email))
    ? profiles.map((item) => (item.id === id || (email && item.email === email)) ? {
      ...item,
      ...profile,
      createdAt: item.createdAt || profile.createdAt,
      orderEmails: Array.from(new Set([...(item.orderEmails ?? []), ...(extra.orderEmails ?? []), email].filter(Boolean))),
      orderCount: Math.max(Number(item.orderCount ?? 0), 0) + Number(extra.incrementOrderCount ?? 0),
      lastOrderAt: extra.lastOrderAt || item.lastOrderAt
    } : item)
    : [profile, ...profiles];
  window.localStorage.setItem(CUSTOMER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
  window.dispatchEvent(new CustomEvent("everastone-customers-updated"));
  return profile;
};

const readSocialLinks = () => {
  try {
    const stored = window.localStorage.getItem(SOCIAL_LINKS_STORAGE_KEY);
    return { ...defaultSocialLinks, ...(stored ? JSON.parse(stored) : {}) };
  } catch {
    return defaultSocialLinks;
  }
};

const writeSocialLinks = (links) => {
  window.localStorage.setItem(SOCIAL_LINKS_STORAGE_KEY, JSON.stringify({ ...defaultSocialLinks, ...links }));
  window.dispatchEvent(new CustomEvent("everastone-site-settings-updated"));
};

const readBlogPosts = () => {
  try {
    const stored = window.localStorage.getItem(BLOG_POSTS_STORAGE_KEY);
    const posts = stored ? JSON.parse(stored) : defaultBlogPosts;
    return Array.isArray(posts) ? posts : defaultBlogPosts;
  } catch {
    return defaultBlogPosts;
  }
};

const writeBlogPosts = (posts) => {
  window.localStorage.setItem(BLOG_POSTS_STORAGE_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent("everastone-blog-updated"));
};

const getSupportVisitorId = () => {
  let visitorId = window.localStorage.getItem(SUPPORT_VISITOR_STORAGE_KEY);
  if (!visitorId) {
    visitorId = `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SUPPORT_VISITOR_STORAGE_KEY, visitorId);
  }
  return visitorId;
};

const getAnalyticsSessionId = () => {
  let sessionId = window.localStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
};

const updateSeoMeta = ({ title, description }) => {
  document.title = title;
  const ensureMeta = (selector, attributes) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      document.head.appendChild(element);
    }
    return element;
  };
  ensureMeta('meta[name="description"]', { name: "description" }).setAttribute("content", description);
  ensureMeta('meta[property="og:title"]', { property: "og:title" }).setAttribute("content", title);
  ensureMeta('meta[property="og:description"]', { property: "og:description" }).setAttribute("content", description);
  ensureMeta('meta[property="og:type"]', { property: "og:type" }).setAttribute("content", "website");
};
const mergeProductsById = (base, additions) => {
  const merged = new Map(base.map((product) => [product.id, product]));
  additions.forEach((product) => merged.set(product.id, { ...merged.get(product.id), ...product }));
  return Array.from(merged.values());
};

const shapeLabel = (key) => shapes.find((shape) => shape.key === key)?.label ?? key;
const shapeLabelEn = (key) => shapes.find((shape) => shape.key === key)?.label ?? key;
const shapeKeyFromLabel = (value) => shapes.find((shape) => shape.zh === value || shape.key === value)?.key ?? "round";
const materialImageGroups = [
  { key: "whiteGold", label: "Platinum", keywords: ["白金", "white", "platinum", "铂金", "pt", "925"] },
  { key: "yellowGold", label: "Yellow Gold", keywords: ["黄金", "yellow"] },
  { key: "roseGold", label: "Rose Gold", keywords: ["玫瑰", "rose"] }
];
const mainMaterials = materialImageGroups.map((group) => group.label);
const materialPurities = ["10K", "11K", "12K", "13K", "14K", "15K", "16K", "17K", "18K", "Platinum"];
const goldPurities = materialPurities.filter((purity) => purity !== "Platinum");
const getPurityOptionsForMaterial = (material = "") => getMainMaterial(material) === "Platinum" ? ["Platinum"] : goldPurities;
const getMaterialImageGroup = (material = "") => {
  const normalized = String(material).toLowerCase();
  return materialImageGroups.find((group) => group.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.key ?? "whiteGold";
};
const getMainMaterial = (material = "") => materialImageGroups.find((group) => group.key === getMaterialImageGroup(material))?.label ?? "Platinum";
const getMaterialPurity = (material = "", purity = "") => {
  const mainMaterial = getMainMaterial(material);
  if (mainMaterial === "Platinum") return "Platinum";
  if (purity && !["铂金", "Platinum"].includes(String(purity))) return String(purity);
  const value = String(material);
  const match = value.match(/1[0-8]K/i);
  if (match) return match[0].toUpperCase();
  return "18K";
};
const normalizeProductVariant = (variant = {}, fallbackMaterial = "Platinum", fallbackPrice = 0) => ({
  carat: String(variant.carat ?? "1.00"),
  material: getMainMaterial(variant.material ?? fallbackMaterial),
  purity: getMaterialPurity(variant.material ?? fallbackMaterial, variant.purity),
  price: variant.price ?? fallbackPrice
});
const orderStatusLabel = (value = "") => ({
  "待付款": "Pending payment",
  "已付款": "Paid",
  "制作中": "In production",
  "已发货": "Shipped",
  "已完成": "Completed",
  "已取消": "Cancelled",
  "退款中": "Refund in progress",
  "已退款": "Refunded"
}[value] || value || "Pending payment");
const getProductMedia = (product = {}, material = "") => {
  const groupKey = getMaterialImageGroup(material || product.material);
  const materialImages = product.materialImages ?? {};
  const groupImages = Array.isArray(materialImages[groupKey]) ? materialImages[groupKey].filter(Boolean) : [];
  const defaultImages = Array.isArray(product.images) ? product.images.filter(Boolean) : product.image ? [product.image] : [];
  return {
    groupKey,
    images: groupImages.length ? groupImages : defaultImages,
    videoUrls: Array.isArray(product.videoUrls) ? product.videoUrls.filter(Boolean) : []
  };
};
const getPrimaryProductImage = (product = {}) => {
  const materialImages = product.materialImages ?? {};
  const firstMaterialImage = materialImageGroups.flatMap((group) => materialImages[group.key] ?? []).find(Boolean);
  return firstMaterialImage || product.images?.[0] || product.image || shapes.find((shape) => shape.key === product.shape)?.image;
};
const getProductImageAlt = (product = {}) => product.imageAlt || product.name || `${shapeLabel(product.shape)} lab-grown diamond jewelry`;
const getProductImageTitle = (product = {}) => product.imageTitle || undefined;
const orderedCatalogShapeKeys = ["oval", "round", "marquise", "emerald", "princess"];
const catalogShapes = [
  ...orderedCatalogShapeKeys.map((key) => shapes.find((shape) => shape.key === key)).filter(Boolean),
  ...shapes.filter((shape) => !orderedCatalogShapeKeys.includes(shape.key))
];
const getAvailableMaterialGroups = (product = {}) => {
  const materialImages = product.materialImages ?? {};
  const groupsFromImages = materialImageGroups.filter((group) => (materialImages[group.key] ?? []).filter(Boolean).length);
  const materialKeys = new Set([
    product.material ? getMaterialImageGroup(product.material) : "",
    ...(product.variants ?? []).map((variant) => getMaterialImageGroup(variant.material))
  ].filter(Boolean));
  const groupsFromProperties = materialImageGroups.filter((group) => materialKeys.has(group.key));
  const available = groupsFromImages.length ? groupsFromImages : groupsFromProperties;
  return available.length ? available : [materialImageGroups[0]];
};
const getYouTubeEmbedUrl = (url = "") => {
  const value = String(url).trim();
  const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
};
const diamondFaceUpMm = {
  round: [6.5, 6.5],
  emerald: [5.0, 7.0],
  pear: [5.8, 8.6],
  asscher: [5.5, 5.5],
  princess: [5.5, 5.5],
  oval: [5.7, 8.1],
  heart: [6.6, 6.0],
  marquise: [4.4, 10.2],
  radiant: [5.5, 7.1]
};
const getTryOnDiamondSize = (shape, carat) => {
  const safeCarat = Math.max(0.3, Math.min(Number(carat) || 1, 7));
  const scale = Math.cbrt(safeCarat);
  const [widthMm, heightMm] = diamondFaceUpMm[shape] ?? diamondFaceUpMm.round;
  const ringFingerWidthPx = 39.5;
  const ringFingerWidthMm = 16.6;
  const pxPerMm = ringFingerWidthPx / ringFingerWidthMm;

  return {
    width: Math.round(widthMm * scale * pxPerMm),
    height: Math.round(heightMm * scale * pxPerMm)
  };
};
const heroRingImage = new URL("./assets/everastone-hero-ring.png", import.meta.url).href;
const warmGoldHero = new URL("./assets/everastone-hero-warm-gold.png", import.meta.url).href;
const whatsappDesignerQr = new URL("./assets/whatsapp-designer-qr.png", import.meta.url).href;
const pageToPath = {
  home: "/",
  diamonds: "/diamonds",
  product: "/product",
  cart: "/cart",
  checkout: "/checkout",
  account: "/account",
  blog: "/blog",
  content: "/collection",
  admin: "/admin"
};

const contentPaths = {
  couple: "/couple-rings",
  coupleClassic: "/couple-rings/classic-bands",
  coupleDiamond: "/couple-rings/diamond-pairs",
  coupleMinimal: "/couple-rings/minimal-slim",
  coupleVintage: "/couple-rings/vintage-engraved",
  designer: "/designer-styles",
  custom: "/custom-ring",
  customProcess: "/custom-ring/process",
  customDiamond: "/custom-ring/choose-diamond",
  customSetting: "/custom-ring/choose-setting",
  story: "/brand-story",
  popularOval: "/collection/2ct-oval-diamond",
  popularRound: "/collection/1-5ct-round-diamond",
  popularPear: "/collection/2-5ct-pear-diamond",
  popularEmerald: "/collection/3ct-emerald-diamond",
  settingSolitaire: "/collection/solitaire-settings",
  settingHalo: "/collection/halo-settings",
  settingPave: "/collection/pave-settings",
  settingThreeStone: "/collection/three-stone-settings",
  settingVintage: "/collection/vintage-settings",
  shipping: "/shipping-policy",
  returns: "/returns-policy",
  warranty: "/warranty-policy",
  terms: "/terms-of-service",
  privacy: "/privacy"
};

const contentKeyFromPath = (pathname) =>
  Object.entries(contentPaths).find(([, path]) => pathname === path)?.[0] ?? "couple";

const homeCopy = {
  ticker: [
    {
      original: "已服务 8,668 人，越来越多新人选择 everastone。",
      zh: "已有 8668 对新人信赖我们，无数挚爱选择 everastone 定格永恒承诺",
      en: (count) => `Trusted by over ${count.toLocaleString("en-US")} couples. Countless lovers choose everastone for their lifelong promise.`
    },
    {
      original: "首单享受 10% 折扣，定制钻戒也可享受。",
      zh: "首单享受折扣 10%",
      en: "Enjoy 10% off your first order."
    },
    {
      original: "制作+配送周期约 23 天，可加急处理。",
      zh: "制作+配送周期 23 天（可加急）",
      en: "Production and delivery take about 23 days. Rush service is available."
    }
  ],
  hero: {
    eyebrow: {
      original: "高级培育钻石定制工作室",
      zh: "为每一段独一无二的爱情，打造专属于你们的永恒婚戒",
      en: "Created for a love that is entirely your own"
    },
    title: { original: "everastone", zh: "为你们的爱情故事打造永恒婚戒", en: "Made for Your Love Story" },
    subtitle: {
      original: "定制订婚戒指与高级培育钻石珠宝",
      zh: "高级实验室培育钻石定制工坊",
      en: "Bespoke Lab-Grown Diamond Atelier"
    },
    text: {
      original: "为美国与英国客户手工定制。甄选伦理培育钻石，坚持按需设计与精工制作。",
      zh: "我们为海外挚爱提供完整定制服务。严选可溯源伦理培育钻石，每一枚戒指，都围绕你们独有的爱情故事独立设计、精工雕琢。",
      en: "Handcrafting engagement rings and heirloom lab-grown diamond jewelry with traceable ethical stones, each piece designed around the story only you two share."
    },
    primaryCta: { original: "选购订婚戒指", zh: "选购订婚戒指", en: "Shop Engagement Rings" },
    secondaryCta: { original: "定制专属钻戒", zh: "定制专属钻戒", en: "Create a Bespoke Ring" }
  },
  shapes: {
    title: {
      original: "找到最适合你的主钻轮廓",
      zh: "找到专属于你的钻石轮廓",
      en: "Find the Diamond Shape That Feels Like Yours"
    },
    intro: {
      original: "挑选你的主钻形状，开启培育钻戒定制第一步",
      zh: "每一种钻石切形，都藏着独属于你的浪漫风格。选定主钻造型，开启你们的钻戒定制之旅。",
      en: "Every diamond shape carries a different kind of romance. Choose the silhouette that begins your ring story."
    },
    itemPrefix: { original: "查看", zh: "探索", en: "Explore" },
    itemSuffix: { original: "戒指", zh: "戒指", en: "rings" }
  },
  popular: {
    eyebrow: { original: "Best-Selling Searches", zh: "热门钻石规格", en: "Most-Loved Diamond Sizes" },
    title: {
      original: "欧美客户热门钻石规格",
      zh: "广受海外新人喜爱的钻石规格",
      en: "Diamond Sizes Loved by Couples Worldwide"
    },
    intro: {
      original: "一键进入对应培育钻石筛选条件，快速挑选主石与戒托。",
      zh: "参考众多海外新人青睐的克拉区间，一键筛选适配你的理想主石与戒托",
      en: "Start with carat ranges many couples love, then refine the center stone and setting that feel right for you."
    }
  },
  process: {
    eyebrow: { original: "Custom Process", zh: "专属定制流程", en: "Bespoke Process" },
    title: { original: "三步完成专属定制", zh: "三步，打造你的专属钻戒", en: "Three Steps to Your One-of-a-Kind Ring" },
    steps: [
      {
        original: ["01", "选择培育钻石", "按形状、克拉、颜色、净度与证书筛选理想主石。"],
        zh: ["01", "挑选培育钻石", "按形状、克拉、颜色、净度、权威证书，筛选契合你的理想主石"],
        en: ["01", "Choose Your Diamond", "Filter by shape, carat, color, clarity and certificate to find the center stone that fits your story."]
      },
      {
        original: ["02", "设计戒托方案", "选择金属材质、戒指尺码与适合日常佩戴的比例。"],
        zh: ["02", "定制戒托方案", "选定贵金属材质、戒指圈号，平衡美观与日常佩戴舒适感"],
        en: ["02", "Design the Setting", "Select the metal, ring size and proportions that balance beauty with everyday comfort."]
      },
      {
        original: ["03", "制作并配送", "工坊按订单制作，完成质检后为英美客户保价配送。"],
        zh: ["03", "精工制作 & 安心配送", "匠人纯手工打造，多重质检完毕，提供全境保价配送服务"],
        en: ["03", "Handcrafted and Securely Delivered", "Your ring is made by hand, carefully inspected, and shipped with insured delivery."]
      }
    ]
  },
  labGrown: {
    eyebrow: { original: "Why Lab Grown", zh: "培育钻石价值", en: "Why Lab-Grown" },
    title: {
      original: "同样闪耀，更适合现代高级珠宝定制",
      zh: "同等璀璨火光，更适配当代恋人的浪漫选择",
      en: "The Same Fire, Made for Modern Love"
    },
    text: {
      original: "培育钻石拥有与天然钻石相同的碳晶体结构与火彩表现，同时让客户在预算、尺寸、净度与伦理选择上拥有更高自由度。",
      zh: "实验室培育钻石拥有和天然钻石完全一致的晶体结构与闪耀火彩，让你在预算、尺寸、品质、道德理念之间拥有完整选择权。",
      en: "Lab-grown diamonds share the same crystal structure and brilliance as mined diamonds, giving you more freedom across size, quality, budget and values."
    },
    panelTitle: {
      original: "甄选实验室培育钻石",
      zh: "严苛甄选实验室培育钻石",
      en: "Strictly Selected Lab-Grown Diamonds"
    },
    panelText: {
      original: "每颗主石均可录入形状、克拉、颜色、净度、切工、抛光、对称、证书与荧光等专业参数。",
      zh: "每颗主石附带完整可核验参数：形状、克拉、颜色、净度、切工、抛光、对称、权威证书、荧光等级。",
      en: "Each center stone includes verifiable details: shape, carat, color, clarity, cut, polish, symmetry, certificate and fluorescence grade."
    }
  },
  footer: {
    brandText: {
      original: "面向美国与英国客户的高级培育钻石设计师珠宝品牌。",
      zh: "专注为全球挚爱打造高级培育钻石设计师珠宝",
      en: "Designer lab-grown diamond jewelry for love stories around the world."
    },
    slogan: {
      original: "Crafted for love, built for eternity.",
      zh: "为爱雕琢，为永恒而生。",
      en: "Crafted for love, built for eternity."
    },
    insured: { original: "美国与英国保价配送", zh: "全境保价配送", en: "Insured delivery" },
    returns: {
      original: "符合条件未佩戴商品支持 30 天退换",
      zh: "未佩戴、符合条件商品，支持 30 天无忧退换",
      en: "Eligible unworn pieces support 30-day worry-free returns."
    },
    email: { original: "support@everastone.com", zh: "客服邮箱：support@everastone.com", en: "Support: support@everastone.com" }
  }
};

const pageFromPath = (pathname) => {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/diamonds")) return "diamonds";
  if (pathname.startsWith("/product")) return "product";
  if (pathname.startsWith("/cart")) return "cart";
  if (pathname.startsWith("/checkout")) return "checkout";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/blog")) return "blog";
  if (Object.values(contentPaths).includes(pathname)) return "content";
  return "home";
};

const blogSlugFromPath = (pathname) => pathname.startsWith("/blog/")
  ? decodeURIComponent(pathname.replace(/^\/blog\/?/, "").split("/")[0] || "")
  : "";

const engagementMenuFilters = {
  popularOval: { shape: "oval", caratMin: 2, caratMax: 2.5 },
  popularRound: { shape: "round", caratMin: 1.5, caratMax: 2 },
  popularPear: { shape: "pear", caratMin: 2.5, caratMax: 3 },
  popularEmerald: { shape: "emerald", caratMin: 3, caratMax: 4 },
  settingSolitaire: { sort: "popular" },
  settingHalo: { sort: "popular" },
  settingPave: { sort: "popular" },
  settingThreeStone: { sort: "popular" },
  settingVintage: { sort: "popular" }
};

function ShapeIcon({ shape, active }) {
  if (shape.image) {
    return <img className={active ? "shape-image active" : "shape-image"} src={shape.image} alt={`${shape.label} lab-grown diamond`} loading="lazy" />;
  }

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={active ? "shape-drawing active" : "shape-drawing"}>
      <path d={shape.path} />
    </svg>
  );
}

function Header({ page, contentKey, setPage, setFilters, openContent, cartCount, serviceCount }) {
  const [scrolled, setScrolled] = useState(false);
  const [liveServiceCount, setLiveServiceCount] = useState(serviceCount);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("engagement");
  const [openMegaKey, setOpenMegaKey] = useState("");
  const megaCloseTimer = useRef(null);
  const clearMegaCloseTimer = () => {
    if (megaCloseTimer.current) {
      window.clearTimeout(megaCloseTimer.current);
      megaCloseTimer.current = null;
    }
  };
  const showMega = (key) => {
    clearMegaCloseTimer();
    setOpenMegaKey(key);
  };
  const hideMegaSoon = () => {
    clearMegaCloseTimer();
    megaCloseTimer.current = window.setTimeout(() => setOpenMegaKey(""), 180);
  };
  const openTarget = (target, shape, contentKey) => {
    clearMegaCloseTimer();
    setOpenMegaKey("");
    setMobileMenuOpen(false);
    if (shape) {
      setFilters((current) => ({ ...current, shape, caratMin: 1, caratMax: 7 }));
      setPage("diamonds");
      return;
    }
    if (engagementMenuFilters[contentKey]) {
      setFilters((current) => ({ ...current, ...engagementMenuFilters[contentKey] }));
      setPage("diamonds");
      return;
    }
    if (contentKey) {
      openContent(contentKey);
      return;
    }
    setPage(target);
  };
  const nav = [
    { key: "home", label: "Home", target: "home" },
    {
      key: "engagement",
      label: "Engagement",
      target: "diamonds",
      mega: [
        { title: "Diamond Shapes", items: [["Oval", "oval"], ["Round", "round"], ["Marquise", "marquise"], ["Emerald", "emerald"], ["Princess", "princess"], ["Pear", "pear"], ["Radiant", "radiant"]] },
        { title: "Popular Diamonds", items: [["2 ct Oval Center Stone", null, "popularOval"], ["1.5 ct Round Center Stone", null, "popularRound"], ["2.5 ct Pear Center Stone", null, "popularPear"], ["3 ct Emerald Center Stone", null, "popularEmerald"]] },
        { title: "Setting Types", items: [["Solitaire", null, "settingSolitaire"], ["Halo", null, "settingHalo"], ["Pavé", null, "settingPave"], ["Three-Stone", null, "settingThreeStone"], ["Vintage", null, "settingVintage"]] }
      ]
    },
    { key: "couple", label: "Matching", contentKey: "couple", mega: [{ title: "Ring Categories", items: [["Classic Bands", null, "coupleClassic"], ["Diamond Pairs", null, "coupleDiamond"], ["Minimal Slim Rings", null, "coupleMinimal"], ["Vintage Engraved Rings", null, "coupleVintage"]] }] },
    { key: "designer", label: "Designer", contentKey: "designer" },
    { key: "custom", label: "Bespoke", contentKey: "custom" },
    { key: "story", label: "Story", contentKey: "story" },
    { key: "cart", label: "Cart", target: "cart", count: cartCount },
    { key: "account", label: "Account", target: "account" }
  ];
  const primaryNav = nav.filter((item) => !["cart", "account"].includes(item.key));
  const utilityNav = nav.filter((item) => ["cart", "account"].includes(item.key));
  const mobileGroups = primaryNav.filter((item) => item.key !== "home" && item.mega);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setLiveServiceCount(serviceCount);
    const timer = window.setInterval(() => {
      setLiveServiceCount((count) => count + Math.ceil(Math.random() * 4));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [serviceCount]);

  useEffect(() => () => clearMegaCloseTimer(), []);

  return (
    <>
      <div className="brand-ticker" aria-label="Brand service and offer highlights">
        <div className="brand-ticker-track">
          <span>{homeCopy.ticker[0].en(liveServiceCount)}</span>
          <span>{homeCopy.ticker[1].en}</span>
          <span>{homeCopy.ticker[2].en}</span>
          <span>{homeCopy.ticker[0].en(liveServiceCount)}</span>
        </div>
      </div>
      <header className={scrolled ? "site-header scrolled" : "site-header"}>
        <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="Open mobile menu">
          <Menu size={22} />
        </button>
        <button className="brand" onClick={() => setPage("home")} aria-label="everastone Jewelry home">
          <span className="brand-mark"><Diamond size={20} /></span>
          <span>
            <strong>everastone</strong>
            <small>Lab-grown diamond atelier</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {primaryNav.map((item) => (
            <span
              className="nav-item"
              key={item.key}
              onPointerEnter={() => item.mega ? showMega(item.key) : hideMegaSoon()}
              onPointerLeave={hideMegaSoon}
              onFocus={() => item.mega ? showMega(item.key) : hideMegaSoon()}
              onBlur={hideMegaSoon}
            >
              <button className={page === item.target && ["home", "cart", "account"].includes(item.key) ? "active" : ""} onClick={() => openTarget(item.target, null, item.contentKey)}>
                {item.label}
                {item.count > 0 ? <span className="cart-dot">{item.count}</span> : null}
              </button>
              {item.mega ? (
                <span
                  className={openMegaKey === item.key ? "nav-menu open" : "nav-menu"}
                  onPointerEnter={() => showMega(item.key)}
                  onPointerLeave={hideMegaSoon}
                >
                  <span className="nav-menu-inner">
                    {item.mega.map((section) => (
                      <span className="nav-menu-section" key={section.title}>
                        <strong>{section.title}</strong>
                        {section.items.map(([menuItem, shape, contentKey]) => (
                          <button className={shape ? "nav-shape-link" : ""} key={menuItem} onClick={() => openTarget(item.target, shape, contentKey)}>
                            {shape ? <ShapeIcon shape={shapes.find((shapeItem) => shapeItem.key === shape)} /> : null}
                            <span>{menuItem}</span>
                          </button>
                        ))}
                      </span>
                    ))}
                  </span>
                </span>
              ) : null}
            </span>
          ))}
        </nav>
        <div className="header-actions" aria-label="Account and cart">
          {utilityNav.map((item) => (
            <button key={item.key} className="header-icon-btn" onClick={() => openTarget(item.target)} aria-label={item.label}>
              {item.key === "cart" ? <ShoppingBag size={20} /> : <UserRound size={20} />}
              {item.count > 0 ? <span className="cart-dot">{item.count}</span> : null}
            </button>
          ))}
        </div>
      </header>
      {mobileMenuOpen ? (
        <div className="mobile-drawer-layer" role="presentation">
          <button className="mobile-drawer-scrim" aria-label="Close mobile menu" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
            <div className="mobile-drawer-brand">
              <span className="brand-mark"><Diamond size={18} /></span>
          <span><strong>everastone</strong><small>Lab-grown diamond atelier</small></span>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <label className="mobile-search">
              <input placeholder="Search..." />
              <Search size={18} />
            </label>
            <div className="mobile-drawer-links">
              <button onClick={() => openTarget("home")}>Home</button>
              {mobileGroups.map((item) => (
                <div className={mobilePanel === item.key ? "mobile-menu-group open" : "mobile-menu-group"} key={item.key}>
                  <button onClick={() => setMobilePanel((current) => current === item.key ? "" : item.key)}>
                    <span>{item.label}</span>
                    <ChevronDown size={18} />
                  </button>
                  <div className="mobile-submenu">
                    {item.mega.map((section) => (
                      <div key={section.title}>
                        <strong>{section.title}</strong>
                        {section.items.map(([menuItem, shape, contentKey]) => (
                          <button className={shape ? "mobile-shape-link" : ""} key={menuItem} onClick={() => openTarget(item.target, shape, contentKey)}>
                            {shape ? <ShapeIcon shape={shapes.find((shapeItem) => shapeItem.key === shape)} /> : null}
                            <span>{menuItem}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => openTarget(null, null, "designer")}>Designer Editions</button>
              <button onClick={() => openTarget(null, null, "story")}>Brand Story</button>
              <button onClick={() => openTarget("account")}><UserRound size={16} /> Sign in / Account</button>
              <button onClick={() => openTarget("cart")}><ShoppingBag size={16} /> Bag{cartCount > 0 ? ` (${cartCount})` : ""}</button>
            </div>
          </aside>
        </div>
      ) : null}
      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        <button className={page === "diamonds" ? "active" : ""} onClick={() => openTarget("diamonds")}>
          <Diamond size={20} />
          <span>Rings</span>
        </button>
        <button className={page === "content" && String(contentKey).startsWith("couple") ? "active" : ""} onClick={() => openTarget(null, null, "couple")}>
          <Heart size={20} />
          <span>Pairs</span>
        </button>
        <button className={page === "content" && contentKey === "designer" ? "active" : ""} onClick={() => openTarget(null, null, "designer")}>
          <Sparkles size={20} />
          <span>Designer</span>
        </button>
        <button className={page === "cart" ? "active" : ""} onClick={() => openTarget("cart")}>
          <ShoppingBag size={20} />
          <span>Bag</span>
          {cartCount > 0 ? <em>{cartCount}</em> : null}
        </button>
        <button className={page === "account" ? "active" : ""} onClick={() => openTarget("account")}>
          <UserRound size={20} />
          <span>Account</span>
        </button>
      </nav>
    </>
  );
}

function Home({ setPage, applyPreset }) {
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });
  const [heroScroll, setHeroScroll] = useState(0);
  const presets = [
    { title: "Oval Lab-Grown Diamond", text: "2.00-2.50 ct", shape: "oval", min: 2, max: 2.5, desc: "An elongated, graceful silhouette and one of today's most loved engagement ring choices." },
    { title: "Round Lab-Grown Diamond", text: "1.50-2.00 ct", shape: "round", min: 1.5, max: 2, desc: "Full fire, timeless symmetry and a proposal classic that never feels dated." },
    { title: "Pear Lab-Grown Diamond", text: "2.50-3.00 ct", shape: "pear", min: 2.5, max: 3, desc: "A soft teardrop shape with romantic presence, designed to flatter the hand." }
  ];
  const homeShapeKeys = ["oval", "round", "marquise", "emerald", "princess", "pear", "radiant"];
  const homeShapes = homeShapeKeys.map((key) => shapes.find((shape) => shape.key === key)).filter(Boolean);
  const handleHeroMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setHeroTilt({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
  };

  useEffect(() => {
    let frame = 0;
    const updateHeroScroll = () => {
      frame = 0;
      const progress = Math.min(window.scrollY / 560, 1);
      setHeroScroll(Number(progress.toFixed(3)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateHeroScroll);
    };
    updateHeroScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main>
      <section
        className="hero"
        onPointerMove={handleHeroMove}
        onPointerLeave={() => setHeroTilt({ x: 0, y: 0 })}
        style={{ "--hero-x": heroTilt.x, "--hero-y": heroTilt.y, "--hero-scroll": heroScroll }}
      >
        <div className="hero-motion" aria-hidden="true">
          <span className="motion-veil" />
          <span className="motion-ring-line motion-ring-line-one" />
          <span className="motion-ring-line motion-ring-line-two" />
          <span className="motion-ring-glow" />
        </div>
        <div className="hero-product-wrap" aria-hidden="true">
          <img className="hero-product" src={heroRingImage} alt="" />
          <span className="hero-product-shine" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">{homeCopy.hero.eyebrow.en}</p>
          <h1>{homeCopy.hero.title.en}</h1>
          <h2 className="hero-subtitle">{homeCopy.hero.subtitle.en}</h2>
          <p>{homeCopy.hero.text.en}</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setPage("diamonds")}>{homeCopy.hero.primaryCta.en}</button>
            <button className="secondary-btn hero-outline" onClick={() => setPage("diamonds")}>{homeCopy.hero.secondaryCta.en}</button>
          </div>
        </div>
      </section>

      <section className="home-service-strip" aria-label="Service promises">
        {[
          [BadgeCheck, "IGI certified diamonds"],
          [RotateCcw, "30-day easy returns"],
          [Plane, "Free shipping within the U.S."],
          [ShieldCheck, "One-year warranty"],
          [Ruler, "Free first resize"]
        ].map(([Icon, label]) => (
          <div className="home-service-item" key={label}>
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="section shape-showcase">
        <div className="section-heading">
          <h2>{homeCopy.shapes.title.en}</h2>
          <p>{homeCopy.shapes.intro.en}</p>
        </div>
        <div className="shape-card-grid">
          {homeShapes.map((shape) => (
            <button className="shape-photo-card" key={shape.key} onClick={() => applyPreset({ shape: shape.key, min: 1, max: 7 })}>
              <img src={shape.image} alt={`${shape.label} lab-grown diamond`} loading="lazy" />
              <strong>{shape.label}</strong>
              <span>{homeCopy.shapes.itemPrefix.en} {shape.label} {homeCopy.shapes.itemSuffix.en}</span>
            </button>
          ))}
        </div>
        <div className="collection-divider">
          <span>OUR COLLECTION</span>
          <strong>Four Signature Collections</strong>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <button className="category-card" key={category.key} onClick={() => category.contentKey ? setPage("content", { contentKey: category.contentKey }) : setPage(category.target ?? "diamonds")}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{category.title}</h3>
              <p>{category.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section muted-band">
        <div className="section-heading">
          <p className="eyebrow">{homeCopy.popular.eyebrow.en}</p>
          <h2>{homeCopy.popular.title.en}</h2>
          <p>{homeCopy.popular.intro.en}</p>
        </div>
        <div className="preset-grid">
          {presets.map((preset) => {
            const shape = shapes.find((item) => item.key === preset.shape);
            return (
              <button className="preset-card" key={preset.title} onClick={() => applyPreset(preset)}>
                <ShapeIcon shape={shape} active />
                <span>{preset.text}</span>
                <h3>{preset.title}</h3>
                <p>{preset.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section process-section">
        <div className="section-heading">
          <p className="eyebrow">{homeCopy.process.eyebrow.en}</p>
          <h2>{homeCopy.process.title.en}</h2>
        </div>
        <div className="process-grid">
          {homeCopy.process.steps.map(({ en: [step, title, text] }) => (
            <article className="process-card" key={step}>
              <span>{step}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section">
        <div>
          <p className="eyebrow">{homeCopy.labGrown.eyebrow.en}</p>
          <h2>{homeCopy.labGrown.title.en}</h2>
          <p>{homeCopy.labGrown.text.en}</p>
        </div>
        <div className="education-panel">
          <Sparkles />
          <h3>{homeCopy.labGrown.panelTitle.en}</h3>
          <p>{homeCopy.labGrown.panelText.en}</p>
        </div>
      </section>

      <section className="reviews">
        {[
          ["Ava, New York", "The oval ring looked even brighter in person. The design process felt clear, calm and deeply personal."],
          ["Mia, London", "The pricing was transparent, the platinum setting felt beautifully refined, and the timing worked perfectly for our date."],
          ["James, Austin", "The 1.8 ct round diamond had exactly the presence we wanted without pushing beyond our budget."]
        ].map(([name, text]) => (
          <article className="review-card" key={name}>
            <div><Star /><Star /><Star /><Star /><Star /></div>
            <p>{text}</p>
            <span>{name}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

function FilterPage({ filters, setFilters, diamonds, openProduct, addToCart }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const sorted = diamonds
      .filter((diamond) => !filters.shape || diamond.shape === filters.shape)
      .filter((diamond) => diamond.carat >= filters.caratMin && diamond.carat <= filters.caratMax)
      .filter((diamond) => diamond.price >= filters.priceMin && diamond.price <= filters.priceMax)
      .filter((diamond) => !filters.color || diamond.color === filters.color)
      .filter((diamond) => !filters.clarity || diamond.clarity === filters.clarity)
      .filter((diamond) => !filters.cut || diamond.cut === filters.cut)
      .filter((diamond) => !filters.certificate || diamond.certificate === filters.certificate)
      .filter((diamond) => !filters.polish || diamond.polish === filters.polish)
      .filter((diamond) => !filters.symmetry || diamond.symmetry === filters.symmetry)
      .filter((diamond) => !filters.fluorescence || diamond.fluorescence === filters.fluorescence)
      .filter((diamond) => !filters.realPhoto || diamond.realPhoto)
      .filter((diamond) => !filters.fast || diamond.fast);

    return sorted.sort((a, b) => {
      if (filters.sort === "price-asc") return a.price - b.price;
      if (filters.sort === "price-desc") return b.price - a.price;
      if (filters.sort === "new") return b.createdAt - a.createdAt;
      return b.sold - a.sold;
    });
  }, [diamonds, filters]);

  const setValue = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () =>
    setFilters({
      shape: "",
      caratMin: 1,
      caratMax: 7,
      priceMin: 900,
      priceMax: 9000,
      color: "",
      clarity: "",
      cut: "",
      certificate: "",
      polish: "",
      symmetry: "",
      depth: "",
      table: "",
      ratio: "",
      fluorescence: "",
      realPhoto: false,
      fast: false,
      sort: "popular"
    });

  return (
    <main className="catalog-page">
      <section className="catalog-top">
        <p className="eyebrow">LAB-GROWN DIAMONDS ONLY</p>
        <h1>Bespoke Lab-Grown Diamond Engagement Rings</h1>
        <p>No mined diamonds, no mixed-source inventory — only traceable ethical lab-grown stones.</p>
      </section>

      <button className="catalog-mobile-filter-toggle" onClick={() => setMobileFiltersOpen((open) => !open)}>
        {mobileFiltersOpen ? "Hide filters" : "Show filters"}
        <ChevronDown className={mobileFiltersOpen ? "rotated" : ""} size={16} />
      </button>

      <section className="mobile-catalog-tabs" aria-label="Mobile catalog shortcuts">
        <button className={!filters.shape ? "active" : ""} onClick={() => setValue("shape", "")}>All</button>
        <button onClick={() => setValue("sort", "new")}>New</button>
        <button onClick={() => setValue("sort", "popular")}>Popular</button>
        <button onClick={() => setValue("sort", filters.sort === "price-asc" ? "price-desc" : "price-asc")}>Price</button>
        <button onClick={() => setMobileFiltersOpen((open) => !open)}>Filter</button>
      </section>

      <section className={mobileFiltersOpen ? "shape-bar mobile-open" : "shape-bar"} aria-label="Diamond shape filter">
        <button className={!filters.shape ? "active" : ""} onClick={() => setValue("shape", "")}>
          <span className="shape-all-icon">ALL</span>
          <span>All Styles</span>
        </button>
        {catalogShapes.map((shape) => (
          <button key={shape.key} className={filters.shape === shape.key ? "active" : ""} onClick={() => setValue("shape", filters.shape === shape.key ? "" : shape.key)}>
            <ShapeIcon shape={shape} active={filters.shape === shape.key} />
            <span>{shape.label}</span>
          </button>
        ))}
      </section>

      <section className="catalog-layout">
        <aside className={mobileFiltersOpen ? "filters-panel mobile-open" : "filters-panel"}>
          <div className="filter-block">
            <h3>Carat Weight</h3>
            <div className="range-row">
              <input type="range" min="1" max="7" step="0.01" value={filters.caratMin} onChange={(event) => setValue("caratMin", Math.min(Number(event.target.value), filters.caratMax))} />
              <input type="range" min="1" max="7" step="0.01" value={filters.caratMax} onChange={(event) => setValue("caratMax", Math.max(Number(event.target.value), filters.caratMin))} />
            </div>
            <div className="input-pair">
              <input type="number" min="1" max="7" step="0.01" value={filters.caratMin} onChange={(event) => setValue("caratMin", Number(event.target.value))} />
              <input type="number" min="1" max="7" step="0.01" value={filters.caratMax} onChange={(event) => setValue("caratMax", Number(event.target.value))} />
            </div>
          </div>

          <div className="filter-block">
            <h3>Price Range</h3>
            <div className="range-row">
              <input type="range" min="900" max="9000" step="50" value={filters.priceMin} onChange={(event) => setValue("priceMin", Math.min(Number(event.target.value), filters.priceMax))} />
              <input type="range" min="900" max="9000" step="50" value={filters.priceMax} onChange={(event) => setValue("priceMax", Math.max(Number(event.target.value), filters.priceMin))} />
            </div>
            <div className="input-pair">
              <input type="number" min="900" max="9000" value={filters.priceMin} onChange={(event) => setValue("priceMin", Number(event.target.value))} />
              <input type="number" min="900" max="9000" value={filters.priceMax} onChange={(event) => setValue("priceMax", Number(event.target.value))} />
            </div>
          </div>

          <div className="select-grid">
            <label>Color<select value={filters.color} onChange={(event) => setValue("color", event.target.value)}><option value="">All</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Clarity<select value={filters.clarity} onChange={(event) => setValue("clarity", event.target.value)}><option value="">All</option>{clarities.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>

          <label className="check-row"><input type="checkbox" checked={filters.realPhoto} onChange={(event) => setValue("realPhoto", event.target.checked)} /> Real-photo pieces only</label>
          <label className="check-row"><input type="checkbox" checked={filters.fast} onChange={(event) => setValue("fast", event.target.checked)} /> Fast dispatch available</label>

          <button className="ghost-btn" onClick={() => setAdvancedOpen(!advancedOpen)}>
            Advanced Filters <ChevronDown className={advancedOpen ? "rotated" : ""} size={16} />
          </button>
          {advancedOpen ? (
            <div className="advanced-grid">
              <label>Cut<select value={filters.cut} onChange={(event) => setValue("cut", event.target.value)}><option value="">All</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Certificate<select value={filters.certificate} onChange={(event) => setValue("certificate", event.target.value)}><option value="">All</option>{certificates.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Polish<select value={filters.polish} onChange={(event) => setValue("polish", event.target.value)}><option value="">All</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Symmetry<select value={filters.symmetry} onChange={(event) => setValue("symmetry", event.target.value)}><option value="">All</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Fluorescence<select value={filters.fluorescence} onChange={(event) => setValue("fluorescence", event.target.value)}><option value="">All</option>{fluorescence.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          ) : null}
          <button className="secondary-btn full" onClick={resetFilters}>Reset Filters</button>
        </aside>

        <section className="results-area">
          <div className="results-toolbar">
            <span>{filtered.length} lab-grown diamond pieces found</span>
            <label>Sort<select value={filters.sort} onChange={(event) => setValue("sort", event.target.value)}><option value="popular">Most Popular</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="new">Newest First</option></select></label>
          </div>
          <div className="product-grid">
            {filtered.map((diamond) => (
              <ProductCard product={diamond} openProduct={openProduct} addToCart={addToCart} key={diamond.id} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function ProductCard({ product, openProduct, addToCart }) {
  const [materialGroup, setMaterialGroup] = useState(getMaterialImageGroup(product.material));
  const productCardMaterialGroups = useMemo(() => [
    materialImageGroups.find((group) => group.key === "yellowGold"),
    materialImageGroups.find((group) => group.key === "whiteGold"),
    materialImageGroups.find((group) => group.key === "roseGold")
  ].filter(Boolean), []);
  useEffect(() => {
    setMaterialGroup(getMaterialImageGroup(product.material));
  }, [product.id, product.material]);
  const availableGroups = getAvailableMaterialGroups(product);
  useEffect(() => {
    if (!productCardMaterialGroups.some((group) => group.key === materialGroup)) {
      setMaterialGroup(productCardMaterialGroups[0]?.key ?? "yellowGold");
    }
  }, [productCardMaterialGroups, materialGroup]);
  const selectedGroup = productCardMaterialGroups.find((group) => group.key === materialGroup) ?? availableGroups[0] ?? materialImageGroups[0];
  const cardImage = getProductMedia(product, selectedGroup.label).images?.[0] || getPrimaryProductImage(product);
  const fallbackImage = getPrimaryProductImage(product);
  const firstVariant = normalizeProductVariant(product.variants?.[0], product.material, product.price);
  const quickMetal = `${selectedGroup.label}${firstVariant.purity && firstVariant.purity !== selectedGroup.label ? ` · ${firstVariant.purity}` : ""}`;
  const openCard = () => openProduct(product.id);
  const quickAdd = (event) => {
    event.stopPropagation();
    addToCart?.({ ...product, price: firstVariant.price ?? product.price, image: cardImage }, quickMetal, "US 6");
  };

  return (
    <article
      className="product-card"
      key={product.id}
      role="button"
      tabIndex={0}
      onClick={openCard}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCard();
        }
      }}
    >
      <img
        src={cardImage}
        alt={getProductImageAlt(product)}
        title={getProductImageTitle(product)}
        loading="lazy"
        onError={(event) => {
          if (fallbackImage && event.currentTarget.src !== fallbackImage) {
            event.currentTarget.src = fallbackImage;
          }
        }}
      />
      <div>
        <span>{product.id}</span>
        <h3>{product.name ?? `${Number(product.carat).toFixed(2)} ct ${shapeLabel(product.shape)}`}</h3>
        <p>{Number(product.carat).toFixed(2)} ct · {product.color} Color · {product.clarity} Clarity · {product.certificate}</p>
        <div className="card-price-row">
          <strong>{money(product.price)}</strong>
          <button className="card-add-btn" type="button" onClick={quickAdd}>Add</button>
        </div>
      </div>
      <div className="card-material-swatches" aria-label="Ring metal preview">
        {productCardMaterialGroups.map((group) => (
          <span
            role="button"
            tabIndex={0}
            className={materialGroup === group.key ? `active material-${group.key}` : `material-${group.key}`}
            key={group.key}
            onClick={(event) => {
              event.stopPropagation();
              setMaterialGroup(group.key);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                setMaterialGroup(group.key);
              }
            }}
          >
            {group.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProductDetail({ product, addToCart, setPage, products, openProduct }) {
  const defaultVariants = useMemo(() => {
    const baseCarat = Number(product?.carat) || 1.5;
    const basePrice = Number(product?.price) || 2800;
    return [1, 1.5, 2, 2.5, 3].map((carat, index) => ({
      carat: carat.toFixed(2),
      material: mainMaterials[index % mainMaterials.length],
      purity: index % 3 === 0 ? "Platinum" : `${14 + index}K`,
      price: Math.round(basePrice * (carat / baseCarat) * (index > 2 ? 1.08 : 1))
    }));
  }, [product]);
  const variants = (product?.variants?.length ? product.variants : defaultVariants).map((variant) => normalizeProductVariant(variant, product?.material, product?.price));
  const [variantIndex, setVariantIndex] = useState(0);
  const selectedVariant = variants[Math.min(variantIndex, variants.length - 1)] ?? variants[0];
  const [sizeType, setSizeType] = useState("US");
  const [size, setSize] = useState(usSizes[4]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerCount, setViewerCount] = useState(65);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [stickyActionsVisible, setStickyActionsVisible] = useState(false);
  const [mobileImageOpen, setMobileImageOpen] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [thumbStart, setThumbStart] = useState(0);
  const [specsOpen, setSpecsOpen] = useState(true);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [favoriteNotice, setFavoriteNotice] = useState("");
  const purchaseActionsRef = useRef(null);
  useEffect(() => {
    setVariantIndex(0);
    setActiveImageIndex(0);
  }, [product?.id]);
  useEffect(() => {
    setActiveImageIndex(0);
    setThumbStart(0);
  }, [product?.id, selectedVariant?.material]);
  useEffect(() => {
    setThumbStart((start) => {
      if (activeImageIndex < start) return activeImageIndex;
      if (activeImageIndex > start + 3) return Math.max(0, activeImageIndex - 3);
      return start;
    });
  }, [activeImageIndex]);
  useEffect(() => {
    const seed = Math.max(65, 65 + String(product?.id ?? "product").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 38);
    setViewerCount(seed);
    const timer = window.setInterval(() => {
      setViewerCount((count) => Math.max(65, count + (Math.random() > 0.48 ? 1 : -1) * (Math.floor(Math.random() * 15) + 1)));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [product?.id]);
  useEffect(() => {
    const target = purchaseActionsRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setStickyActionsVisible(!entry.isIntersecting);
    }, { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [product?.id]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncMobileSections = () => {
      const shouldOpen = !mediaQuery.matches;
      setSpecsOpen(shouldOpen);
      setDescriptionOpen(shouldOpen);
    };
    syncMobileSections();
    mediaQuery.addEventListener?.("change", syncMobileSections);
    return () => mediaQuery.removeEventListener?.("change", syncMobileSections);
  }, [product?.id]);

  if (!product) return null;
  const sizes = sizeType === "US" ? usSizes : ukSizes;
  const productMedia = getProductMedia(product, selectedVariant?.material);
  const productImages = productMedia.images?.length ? productMedia.images : [product.image, product.image, product.image].filter(Boolean);
  const activeImage = productImages[Math.min(activeImageIndex, productImages.length - 1)] ?? productImages[0];
  const visibleThumbs = productImages.slice(thumbStart, thumbStart + 4);
  const previewCarat = Number(selectedVariant?.carat) || product.carat || 1.5;
  const previewDiamondSize = getTryOnDiamondSize(product.shape, previewCarat);
  const tryOnDiamondImage = shapes.find((shape) => shape.key === product.shape)?.image ?? product.image;
  const displayPrice = Number(selectedVariant?.price) || product.price;
  const firstOrderPrice = Math.round(displayPrice * 0.9);
  const selectedMetalText = selectedVariant?.purity === "Platinum" ? "Platinum" : `${selectedVariant?.purity ?? "18K"} ${selectedVariant?.material ?? "Platinum"}`;
  const estimatedArrival = formatArrivalDate(23);
  const imageCaption = product.imageCaption || `${Number(product.carat || previewCarat).toFixed(2)}ct ${shapeLabel(product.shape)} product image`;
  const productDescription = product.description || `This ${shapeLabel(product.shape)} lab-grown diamond ring is designed around everyday comfort, balanced proportions and visible brilliance. Choose the carat, metal and size combination that best fits your proposal, anniversary or lifelong promise.`;
  const sizeChart = usSizes.map((usSize, index) => ({
    us: usSize,
    uk: ukSizes[index] ?? "-",
    diameter: (14.8 + index * 0.4).toFixed(1),
    circumference: (46.5 + index * 1.25).toFixed(1)
  }));
  const recommendedProducts = (products ?? [])
    .filter((item) => item.id !== product.id && item.category !== "couple" && item.category !== "jewelry")
    .sort((a, b) => Number(b.sold ?? 0) - Number(a.sold ?? 0))
    .slice(0, 4);
  const showTryOn = !["couple", "jewelry"].includes(product.category);
  const variantFields = [
    ["carat", "Diamond Carat", "ct"],
    ["material", "Metal", ""],
    ["purity", "Metal Purity", ""]
  ];
  const uniqueValues = (items, field) => [...new Set(items.map((variant) => String(variant?.[field] ?? "")).filter(Boolean))];
  const variantsForCarat = variants.filter((variant) => String(variant.carat) === String(selectedVariant?.carat));
  const variantsForMaterial = variantsForCarat.filter((variant) => String(variant.material) === String(selectedVariant?.material));
  const variantOptions = {
    carat: uniqueValues(variants, "carat"),
    material: uniqueValues(variantsForCarat.length ? variantsForCarat : variants, "material"),
    purity: uniqueValues(variantsForMaterial.length ? variantsForMaterial : variantsForCarat, "purity").filter((purity) => getPurityOptionsForMaterial(selectedVariant?.material).includes(purity))
  };
  const updateVariantField = (field, value) => {
    let nextSelection = { ...selectedVariant, [field]: value };

    if (field === "carat") {
      const caratMatches = variants.filter((variant) => String(variant.carat) === String(value));
      const materialStillAvailable = caratMatches.some((variant) => String(variant.material) === String(selectedVariant?.material));
      nextSelection.material = materialStillAvailable ? selectedVariant?.material : caratMatches[0]?.material;
      const purityStillAvailable = caratMatches.some((variant) => String(variant.material) === String(nextSelection.material) && String(variant.purity) === String(selectedVariant?.purity));
      nextSelection.purity = purityStillAvailable ? selectedVariant?.purity : caratMatches.find((variant) => String(variant.material) === String(nextSelection.material))?.purity;
    }

    if (field === "material") {
      const materialMatches = variants.filter((variant) => String(variant.carat) === String(selectedVariant?.carat) && String(variant.material) === String(value));
      const purityStillAvailable = materialMatches.some((variant) => String(variant.purity) === String(selectedVariant?.purity));
      nextSelection.purity = purityStillAvailable ? selectedVariant?.purity : materialMatches[0]?.purity;
    }

    const matchingIndex = variants.findIndex((variant) =>
      ["carat", "material", "purity"].every((variantField) => String(variant?.[variantField] ?? "") === String(nextSelection?.[variantField] ?? ""))
    );
    if (matchingIndex >= 0) setVariantIndex(matchingIndex);
  };
  const changeImage = (direction) => {
    setActiveImageIndex((index) => (index + direction + productImages.length) % productImages.length);
  };
  const handleGalleryMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoomPosition({
      x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((event.clientY - rect.top) / rect.height) * 100)
    });
  };
  const openMobileImage = () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileImageOpen(true);
    }
  };
  const saveFavorite = async () => {
    try {
      const session = JSON.parse(window.localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY) || "null");
      const accessToken = session?.access_token;
      const userId = session?.user?.id;
      if (!accessToken || !userId) {
        setFavoriteNotice("Please sign in on the Account page before saving favorites.");
        return;
      }
      await addMyFavorite(accessToken, userId, product.id);
      setFavoriteNotice("Saved to favorites. You can find it in My Account.");
    } catch (error) {
      setFavoriteNotice(error.message || "Unable to save this favorite. Please try again later.");
    }
  };

  return (
    <main className="detail-page">
      <button className="text-link" onClick={() => setPage("diamonds")}>Back to Engagement Rings</button>
      <section className="detail-layout">
        <div className="gallery">
          <div
            className="gallery-main"
            onPointerMove={handleGalleryMove}
            onClick={openMobileImage}
            style={{ "--zoom-x": `${zoomPosition.x}%`, "--zoom-y": `${zoomPosition.y}%` }}
          >
            <button className="gallery-nav prev" onClick={(event) => { event.stopPropagation(); changeImage(-1); }} aria-label="Previous product image">‹</button>
            <img src={activeImage} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} />
            <button className="gallery-nav next" onClick={(event) => { event.stopPropagation(); changeImage(1); }} aria-label="Next product image">›</button>
          </div>
          <p className="image-caption">{imageCaption}</p>
          <div className="thumb-carousel">
            {productImages.length > 4 ? <button className="thumb-page-btn" onClick={() => setThumbStart((start) => Math.max(0, start - 1))} disabled={thumbStart === 0} aria-label="Previous thumbnails">‹</button> : null}
            <div className="thumb-row">
              {visibleThumbs.map((image, index) => {
                const imageIndex = thumbStart + index;
                return (
                  <button className={activeImageIndex === imageIndex ? "active" : ""} onClick={() => setActiveImageIndex(imageIndex)} key={`${image}-${imageIndex}`} aria-label={`View product image ${imageIndex + 1}`}>
                    <img src={image} alt={`${getProductImageAlt(product)} ${imageIndex + 1}`} title={getProductImageTitle(product)} />
                  </button>
                );
              })}
            </div>
            {productImages.length > 4 ? <button className="thumb-page-btn" onClick={() => setThumbStart((start) => Math.min(Math.max(0, productImages.length - 4), start + 1))} disabled={thumbStart >= productImages.length - 4} aria-label="Next thumbnails">›</button> : null}
          </div>
          {productMedia.videoUrls.length ? (
            <div className="product-video-list">
              {productMedia.videoUrls.map((url, index) => {
                const embedUrl = getYouTubeEmbedUrl(url);
                return embedUrl ? (
                  <iframe key={`${url}-${index}`} src={embedUrl} title={`Product video ${index + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                ) : (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">View Product Video {index + 1}</a>
                );
              })}
            </div>
          ) : null}
          <div className={specsOpen ? "gallery-specs mobile-fold open" : "gallery-specs mobile-fold"}>
            <button className="fold-trigger" onClick={() => setSpecsOpen((open) => !open)} aria-expanded={specsOpen}>
              <span>Diamond Details</span>
              <ChevronDown size={18} />
            </button>
            {specsOpen ? (
              <div className="spec-grid">
                {[
                  ["Shape", shapeLabel(product.shape)],
                  ["Carat", selectedVariant?.carat ?? product.carat.toFixed(2)],
                  ["Color", product.color],
                  ["Clarity", product.clarity],
                  ["Cut", product.cut],
                  ["Polish", product.polish],
                  ["Symmetry", product.symmetry],
                  ["Certificate", product.certificate],
                  ["Fluorescence", product.fluorescence]
                ].map(([label, value]) => (
                  <div key={label}><span>{label}</span><strong>{value}</strong></div>
                ))}
              </div>
            ) : null}
          </div>
          <section className={descriptionOpen ? "product-description mobile-fold open" : "product-description mobile-fold"}>
            <button className="fold-trigger" onClick={() => setDescriptionOpen((open) => !open)} aria-expanded={descriptionOpen}>
              <span>Product Story</span>
              <ChevronDown size={18} />
            </button>
            {descriptionOpen ? <p>{productDescription}</p> : null}
          </section>
        </div>
        <div className="detail-info">
          <p className="eyebrow">CERTIFIED LAB-GROWN DIAMOND</p>
          <h1>{product.name ?? `${product.carat.toFixed(2)} ct ${shapeLabel(product.shape)} Diamond Ring`}</h1>
          <p className="price">{money(displayPrice)}</p>
          <div className="first-order-offer">
            <span>First Order 10% Off</span>
            <strong>After offer {money(firstOrderPrice)}</strong>
          </div>
          <p className="live-viewers">{viewerCount} people are viewing this piece</p>
          <div className="variant-picker">
            <h3>Choose Your Specification</h3>
            <div className="variant-picker-grid">
              {variantFields.map(([field, label, suffix]) => {
                const values = variantOptions[field]?.length ? variantOptions[field] : field === "purity" ? getPurityOptionsForMaterial(selectedVariant?.material) : [];
                const currentValue = values.includes(String(selectedVariant?.[field] ?? "")) ? String(selectedVariant?.[field] ?? "") : values[0];
                return <label key={field}>{label}<select value={currentValue} onChange={(event) => updateVariantField(field, event.target.value)}>{values.map((value) => <option value={value} key={value}>{value}{suffix}</option>)}</select></label>;
              })}
            </div>
            <strong className="variant-price">Selected price: {money(displayPrice)}</strong>
          </div>
          <div className="size-row">
            <label>Size Standard<select value={sizeType} onChange={(event) => { setSizeType(event.target.value); setSize(event.target.value === "US" ? usSizes[4] : ukSizes[4]); }}><option>US</option><option>UK</option></select></label>
            <label>Ring Size<select value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <button className="size-chart-trigger" onClick={() => setSizeChartOpen(true)}>View International Ring Size Chart</button>
          <div className="detail-actions purchase-actions" ref={purchaseActionsRef}>
            <button className="primary-btn" onClick={() => addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`)}>Add to Bag</button>
            <button className="secondary-btn" onClick={() => { addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`); setPage("checkout"); }}>Buy Now</button>
          </div>
          <button className="favorite-btn" onClick={saveFavorite}><Heart size={16} /> Save to Favorites</button>
          {favoriteNotice ? <p className="checkout-notice">{favoriteNotice}</p> : null}
          <div className="delivery-note">
            <Truck size={16} />
            <span>Standard production takes about 15 days, with a ±2 day variation by style.</span>
            <span>Global air delivery takes 3–6 days. Estimated arrival around {estimatedArrival}. Rush service is available.</span>
          </div>
          {showTryOn ? <div className="try-on-tool">
            <div>
              <span className="eyebrow">TRY-ON PREVIEW</span>
              <h3>Right Ring Finger Preview</h3>
              <p>Preview the center stone scale on a realistic ring position. The diamond outline follows the selected shape.</p>
              <input type="range" min="0" max={variants.length - 1} value={variantIndex} onChange={(event) => setVariantIndex(Number(event.target.value))} />
              <strong>{selectedVariant?.carat}ct · {shapeLabel(product.shape)} · {money(displayPrice)}</strong>
            </div>
            <div className="hand-preview" aria-label="Engagement ring try-on preview on the right ring finger">
              <span className="finger finger-index"><i /></span>
              <span className="finger finger-middle"><i /></span>
              <span className="finger finger-ring">
                <i />
                <span
                  className={`try-diamond try-diamond-${product.shape}`}
                  style={{
                    "--try-diamond-width": `${previewDiamondSize.width}px`,
                    "--try-diamond-height": `${previewDiamondSize.height}px`
                  }}
                >
                  <img src={tryOnDiamondImage} alt={`${shapeLabel(product.shape)} ${previewCarat.toFixed(2)}ct try-on preview`} />
                  <span className="try-diamond-facets" />
                </span>
              </span>
              <span className="finger finger-pinky"><i /></span>
              <span className="thumb" />
              <span className="palm" />
            </div>
          </div> : null}
        </div>
      </section>
      {stickyActionsVisible ? (
        <div className="sticky-purchase-bar visible">
          <span>After offer {money(firstOrderPrice)}</span>
          <button className="primary-btn" onClick={() => addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`)}>Add to Bag</button>
          <button className="secondary-btn" onClick={() => { addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`); setPage("checkout"); }}>Buy Now</button>
        </div>
      ) : null}
      {sizeChartOpen ? (
        <div className="size-chart-modal-backdrop" role="presentation">
          <div className="size-chart-modal" role="dialog" aria-modal="true" aria-label="International ring size chart">
            <div className="size-chart-modal-head">
              <div>
                <p className="eyebrow">Ring Size Guide</p>
                <h3>International Ring Size Chart</h3>
              </div>
              <button className="ghost-btn" onClick={() => setSizeChartOpen(false)}>Close</button>
            </div>
            <div className="size-chart-table">
              <span>US</span><span>UK</span><span>Inner Diameter mm</span><span>Circumference mm</span>
              {sizeChart.map((row) => (
                <React.Fragment key={row.us}>
                  <strong>{row.us}</strong><strong>{row.uk}</strong><span>{row.diameter}</span><span>{row.circumference}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {mobileImageOpen ? (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setMobileImageOpen(false)}>
          <button className="ghost-btn" onClick={() => setMobileImageOpen(false)}>Close</button>
          <img src={activeImage} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} />
        </div>
      ) : null}
      <section className="section compact">
        <h2>You May Also Like</h2>
        <div className="mini-grid recommended-grid">
          {recommendedProducts.map((item) => (
            <button className="recommend-card" onClick={() => openProduct(item.id)} key={item.id}>
              <img src={item.image} alt={getProductImageAlt(item)} title={getProductImageTitle(item)} />
              <span>{shapeLabel(item.shape)} · {Number(item.carat).toFixed(2)}ct</span>
              <strong>{item.name ?? `${shapeLabel(item.shape)} Lab-Grown Diamond Ring`}</strong>
              <em>{money(item.price)}</em>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function Cart({ cart, setCart, setPage }) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = subtotal * 0.1;
  const tax = subtotal * 0.075;
  const shipping = subtotal > 0 ? 95 : 0;
  const total = subtotal - discount + tax + shipping;

  const updateQty = (id, qty) => setCart((items) => items.map((item) => item.cartId === id ? { ...item, qty: Math.max(1, qty) } : item));
  const removeItem = (id) => setCart((items) => items.filter((item) => item.cartId !== id));

  return (
    <main className="utility-page cart-page">
      <div className="mobile-cart-head">
        <h1>Shopping Bag <span>({cart.length})</span></h1>
        <button type="button">Manage</button>
      </div>
      <h1 className="desktop-cart-title">Shopping Bag</h1>
      <div className="mobile-cart-tabs" aria-label="Cart shortcuts">
        <button className="active" type="button">All</button>
        <button type="button">Rings</button>
        <button type="button">Bespoke</button>
        <button type="button">Gifts</button>
        <button type="button">Filter</button>
      </div>
      <div className="cart-layout">
        <section className="cart-list">
          {cart.length === 0 ? <p>Your bag is empty. Start by choosing a lab-grown diamond ring.</p> : cart.map((item) => (
            <article className="cart-item" key={item.cartId}>
              <img src={item.image} alt={item.imageAlt || item.title} title={item.imageTitle || undefined} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.metal} · {item.size}</p>
                <strong>{money(item.price)}</strong>
              </div>
              <input type="number" min="1" value={item.qty} onChange={(event) => updateQty(item.cartId, Number(event.target.value))} />
              <button className="text-link" onClick={() => removeItem(item.cartId)}>Remove</button>
            </article>
          ))}
          {cart.length > 0 ? <button className="ghost-btn" onClick={() => setCart([])}>Clear Bag</button> : null}
        </section>
        <aside className="summary-panel">
          <h2>Order Summary</h2>
          <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
          <p><span>First order 10% off</span><strong>-{money(discount)}</strong></p>
          <p><span>Estimated tax</span><strong>{money(tax)}</strong></p>
          <p><span>Insured shipping</span><strong>{money(shipping)}</strong></p>
          <p className="summary-total"><span>Total</span><strong>{money(total)}</strong></p>
          <button className="primary-btn full" disabled={!cart.length} onClick={() => setPage("checkout")}>Checkout</button>
        </aside>
      </div>
      <div className="mobile-cart-promo" aria-hidden={!cart.length}>
        <ShoppingBag size={16} />
        <span>First order 10% off · insured delivery included at checkout</span>
      </div>
      <div className="mobile-cart-checkout-bar">
        <label><input type="checkbox" readOnly checked={cart.length > 0} /> All</label>
        <div>
          <strong>{money(total)}</strong>
          <small>Saved {money(discount)}</small>
        </div>
        <button disabled={!cart.length} onClick={() => setPage("checkout")}>Checkout ({cart.length})</button>
      </div>
    </main>
  );
}

function Checkout({ cart, onSubmitOrder }) {
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalButtonsRef = useRef(null);
  const localOrderRef = useRef(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    country: "United States",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    phone: ""
  });
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.round(subtotal * 0.1 * 100) / 100;
  const tax = Math.round(subtotal * 0.075 * 100) / 100;
  const shipping = subtotal > 0 ? 95 : 0;
  const total = Math.max(0, subtotal - discount + tax + shipping);
  useEffect(() => {
    if (cart.length) {
      trackAnalyticsEvent({
        eventType: "checkout_start",
        pagePath: window.location.pathname,
        sessionId: getAnalyticsSessionId(),
        metadata: { total, itemCount: cart.reduce((sum, item) => sum + item.qty, 0) }
      }).catch(() => {});
    }
  }, []);
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const validateCheckout = () => {
    if (!cart.length) return "Your bag is empty. Please add a piece before checkout.";
    if (!form.email || !form.email.includes("@") || !form.addressLine1 || !form.city || !form.postalCode) {
      return "Please fill in your email, street address, city and postal code.";
    }
    return "";
  };
  const buildCheckoutPayload = () => ({
    email: form.email,
    address: {
      firstName: form.firstName,
      lastName: form.lastName,
      country: form.country,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      phone: form.phone
    },
    items: cart.map((item) => ({
      productId: item.id,
      title: item.title,
      image: item.image,
      material: item.metal,
      size: item.size,
      quantity: item.qty,
      unitPrice: item.price,
      lineTotal: item.price * item.qty,
      specs: {
        material: item.metal,
        size: item.size
      }
    })),
    subtotal,
    discount,
    tax,
    shipping,
    total
  });
  const submitOrder = async () => {
    const validation = validateCheckout();
    if (validation) {
      setNotice(validation);
      return;
    }
    setSubmitting(true);
    setNotice("Saving your unpaid order...");
    try {
      const order = await createStorefrontOrder(buildCheckoutPayload());
      upsertCustomerProfile({
        email: form.email,
        user: {
          id: form.email,
          email: form.email,
          user_metadata: { full_name: `${form.firstName} ${form.lastName}`.trim() }
        }
      }, "checkout", {
        phone: form.phone,
        country: form.country,
        orderEmails: [form.email],
        incrementOrderCount: 1,
        lastOrderAt: new Date().toISOString(),
        lastOrderId: order.orderNumber || order.id
      });
      onSubmitOrder(cart.reduce((sum, item) => sum + item.qty, 0));
      setNotice(`Order saved. Order number: ${order.orderNumber || order.id}. Payment status: unpaid.`);
    } catch (error) {
      setNotice(error.message || "Order submission failed. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    if (!clientId || !paypalButtonsRef.current) return undefined;
    let cancelled = false;
    const scriptId = "paypal-js-sdk";
    const loadPayPal = () => new Promise((resolve, reject) => {
      if (window.paypal) return resolve(window.paypal);
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.paypal), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
      script.onload = () => resolve(window.paypal);
      script.onerror = reject;
      document.body.appendChild(script);
    });
    paypalButtonsRef.current.innerHTML = "";
    loadPayPal()
      .then((paypal) => {
        if (cancelled || !paypalButtonsRef.current) return;
        setPaypalReady(true);
        paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
          onClick: () => {
            const validation = validateCheckout();
            if (validation) {
              setNotice(validation);
              return false;
            }
            setNotice("");
            return true;
          },
          createOrder: async () => {
            setSubmitting(true);
            setNotice("Creating your PayPal payment order...");
            trackAnalyticsEvent({
              eventType: "paypal_start",
              pagePath: window.location.pathname,
              sessionId: getAnalyticsSessionId(),
              metadata: { total }
            }).catch(() => {});
            const result = await createPayPalOrder(buildCheckoutPayload());
            localOrderRef.current = result.order;
            return result.paypalOrderId;
          },
          onApprove: async (data) => {
            setNotice("PayPal authorized. Confirming payment...");
            const result = await capturePayPalOrder(data.orderID, localOrderRef.current?.id || localOrderRef.current?.orderNumber);
            trackAnalyticsEvent({
              eventType: "paypal_paid",
              pagePath: window.location.pathname,
              sessionId: getAnalyticsSessionId(),
              metadata: { orderId: result.order?.orderNumber || result.order?.id, total }
            }).catch(() => {});
            onSubmitOrder(cart.reduce((sum, item) => sum + item.qty, 0));
            setNotice(`Payment successful. Order number: ${result.order?.orderNumber || result.order?.id}. Your order is now marked as paid.`);
            setSubmitting(false);
          },
          onCancel: () => {
            setSubmitting(false);
            setNotice("You cancelled PayPal payment. The order remains unpaid.");
          },
          onError: (error) => {
            setSubmitting(false);
            setNotice(error?.message || "PayPal payment failed. Please try again later.");
          }
        }).render(paypalButtonsRef.current);
      })
      .catch((error) => {
        setPaypalReady(false);
        setNotice(error?.message || "PayPal buttons failed to load. Please check VITE_PAYPAL_CLIENT_ID.");
      });
    return () => {
      cancelled = true;
      if (paypalButtonsRef.current) paypalButtonsRef.current.innerHTML = "";
    };
  }, [cart, form, subtotal, discount, tax, shipping, total]);

  return (
    <main className="utility-page">
      <h1>Secure Checkout</h1>
      <form className="checkout-grid">
        <section>
          <h2>Shipping Address</h2>
          <div className="form-grid">
            <input placeholder="First name" value={form.firstName} onChange={(event) => updateForm("firstName", event.target.value)} />
            <input placeholder="Last name" value={form.lastName} onChange={(event) => updateForm("lastName", event.target.value)} />
            <input placeholder="Email" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
            <select value={form.country} onChange={(event) => updateForm("country", event.target.value)}><option>United States</option><option>United Kingdom</option></select>
            <input placeholder="Street address" className="wide" value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} />
            <input placeholder="Apartment, suite, unit" className="wide" value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} />
            <input placeholder="City" value={form.city} onChange={(event) => updateForm("city", event.target.value)} />
            <input placeholder="State / County" value={form.state} onChange={(event) => updateForm("state", event.target.value)} />
            <input placeholder="Postal code" value={form.postalCode} onChange={(event) => updateForm("postalCode", event.target.value)} />
            <input placeholder="Phone" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
          </div>
        </section>
        <section>
          <h2>Secure PayPal Payment</h2>
          <div className="payment-placeholder">
            <CreditCard />
            <p>Your order is saved before PayPal opens. After payment succeeds, the order status updates automatically.</p>
          </div>
          <div className="summary-panel checkout-summary">
            <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
            <p><span>First order 10% off</span><strong>-{money(discount)}</strong></p>
            <p><span>Estimated tax</span><strong>{money(tax)}</strong></p>
            <p><span>Insured shipping</span><strong>{money(shipping)}</strong></p>
            <p className="summary-total"><span>Total</span><strong>{money(total)}</strong></p>
          </div>
          <label className="check-row"><input type="checkbox" /> I agree to encrypted order processing and the privacy policy.</label>
          {import.meta.env.VITE_PAYPAL_CLIENT_ID ? (
            <div className={paypalReady ? "paypal-button-box ready" : "paypal-button-box"} ref={paypalButtonsRef} />
          ) : (
            <p className="checkout-notice">Please add VITE_PAYPAL_CLIENT_ID to the frontend environment variables before PayPal buttons can appear.</p>
          )}
          <button className="ghost-btn full" type="button" disabled={!cart.length || submitting} onClick={submitOrder}>{submitting ? "Saving..." : "Save Unpaid Order Only"}</button>
          {notice ? <p className="checkout-notice">{notice}</p> : null}
        </section>
      </form>
    </main>
  );
}

const contentPages = {
  couple: {
    eyebrow: "COUPLE RINGS",
    title: "Matching Couple Wedding Rings",
    intro: "Designed for daily wear between two people: balanced, comfortable and quietly meaningful.",
    cards: [["Classic Bands", "Clean metal lines and a comfort-fit inner curve for everyday wear."], ["Diamond Pairs", "Subtle lab-grown diamond details with a low-key sense of ceremony."], ["Minimal Slim Rings", "Light profiles for couples who prefer refined restraint."], ["Vintage Engraved", "Engraved textures and romantic details with a story-led feel."]]
  },
  coupleClassic: { eyebrow: "CLASSIC BANDS", title: "Classic Wedding Bands", intro: "Clean metal lines and comfortable proportions for daily wear after the wedding.", cards: [["18K White Gold Band", "Cool-toned and minimal."], ["Platinum Classic Band", "Durable, steady and made for long-term wear."], ["Rose Gold Band", "Warm, soft and intimate."]] },
  coupleDiamond: { eyebrow: "DIAMOND PAIRS", title: "Diamond Matching Rings", intro: "Add subtle lab-grown diamond light without making the pair feel too ornate.", cards: [["Single Accent Diamond", "One small diamond as a shared mark."], ["Half Pavé Band", "More sparkle while staying refined."], ["Hidden Diamond Detail", "A private romantic detail inside or along the side."]] },
  coupleMinimal: { eyebrow: "MINIMAL SLIM", title: "Minimal Slim Matching Rings", intro: "Light widths and clean proportions for a modern couple's everyday style.", cards: [["Slim Plain Band", "Light on the hand and easy to stack."], ["Slim Diamond Accent", "A small flash of light with a clean profile."], ["Personal Engraving", "Add initials, dates or a short phrase."]] },
  coupleVintage: { eyebrow: "VINTAGE ENGRAVED", title: "Vintage Engraved Matching Rings", intro: "Engraving, milgrain edges and vintage proportions create a stronger sense of story.", cards: [["Wheat Motif", "A symbol of companionship and abundance."], ["Milgrain Details", "Classic vintage finishing."], ["Soft Aged Gold Feel", "Warm metal light without feeling loud."]] },
  designer: { eyebrow: "DESIGNER EDITION", title: "Designer Edition Lab-Grown Diamond Rings", intro: "Original designer pieces with a distinctive visual language, ready to view in detail or purchase directly.", cards: [] },
  custom: { eyebrow: "BESPOKE RINGS", title: "Build Your Custom Bespoke Diamond Ring", intro: "From center-stone selection and setting design to crafting and delivery, build a lab-grown diamond ring made for your story.", cards: [["Bespoke Process", "Understand the full journey from first conversation to final delivery."], ["Choose a Center Stone", "Filter lab-grown diamonds by shape, carat, color and clarity."], ["Customize the Setting", "Choose metal, setting style, ring size and design details."]] },
  customProcess: { eyebrow: "CUSTOM PROCESS", title: "Bespoke Ring Process", intro: "Create your ring in three steps: choose the diamond, design the setting, then approve production and insured delivery.", cards: [["01 Choose the Diamond", "Confirm shape, carat, color, clarity and certificate."], ["02 Design the Setting", "Select metal, setting style and wearable proportions."], ["03 Craft and Deliver", "Made to order, inspected carefully and shipped with insured delivery."]] },
  customDiamond: { eyebrow: "CHOOSE DIAMOND", title: "Choose Your Center Stone", intro: "Enter the lab-grown diamond filter page and compare shapes, carat ranges and professional diamond parameters.", cards: [["Round / Oval / Pear", "Popular center-stone shapes for engagement rings."], ["Color and Clarity", "Filter by D-M color and FL-I1 clarity ranges."], ["Certificate and Proportion", "Cut, polish, symmetry and fluorescence can be reviewed before purchase."]], cta: "Choose a Diamond" },
  customSetting: { eyebrow: "CHOOSE SETTING", title: "Choose Your Ring Setting", intro: "Confirm metal, setting type, ring size and the details that make it yours.", cards: [["Metal Choice", "14K/18K white gold, yellow gold, rose gold and platinum."], ["Setting Type", "Solitaire, halo, pavé, three-stone and vintage styles."], ["Size Standard", "US and UK ring size options are supported."]] },
  story: {
    eyebrow: "BRAND STORY",
    title: "Our Story of Ethical Lab-Grown Diamonds",
    intro: "Everastone believes a diamond’s true value is found in the sincerity, promise and emotional meaning behind every love story.",
    cards: []
  },
  popularOval: { eyebrow: "POPULAR DIAMOND", title: "2 ct Oval Center Stone", intro: "Oval diamonds visually elongate the finger and remain a favorite for engagement rings.", cards: [["Suggested carat", "2.00–2.50ct"], ["Suggested setting", "Solitaire or hidden halo"], ["Visual feel", "Larger-looking, elongated and soft."]] },
  popularRound: { eyebrow: "POPULAR DIAMOND", title: "1.5 ct Round Center Stone", intro: "The round brilliant cut is classic, balanced and consistently fiery.", cards: [["Suggested carat", "1.50–2.00ct"], ["Suggested setting", "Six-prong solitaire or pavé band"], ["Visual feel", "Classic, bright and timeless."]] },
  popularPear: { eyebrow: "POPULAR DIAMOND", title: "2.5 ct Pear Center Stone", intro: "A pear shape brings direction, romance and a distinctive outline.", cards: [["Suggested carat", "2.50–3.00ct"], ["Suggested setting", "Halo or slim band"], ["Visual feel", "Elegant, lengthening and memorable."]] },
  popularEmerald: { eyebrow: "POPULAR DIAMOND", title: "3 ct Emerald Center Stone", intro: "Step-cut emerald diamonds emphasize clarity, openness and architectural elegance.", cards: [["Suggested carat", "Around 3.00ct"], ["Suggested setting", "Three-stone or platinum setting"], ["Visual feel", "Composed, transparent and elevated."]] },
  settingSolitaire: { eyebrow: "SETTING TYPE", title: "Solitaire Setting", intro: "A clean setting that lets the center stone lead.", cards: [["Four Prongs", "Airier and shows more of the diamond."], ["Six Prongs", "Classic and secure, especially for round diamonds."], ["Hidden Halo", "Subtle from the top, brighter from the side."]] },
  settingHalo: { eyebrow: "SETTING TYPE", title: "Halo Setting", intro: "A fine diamond frame around the center stone for a larger, brighter look.", cards: [["Round Halo", "Sweet and classic."], ["Oval Halo", "Elongated and visually generous."], ["Vintage Halo", "More ornate and story-led."]] },
  settingPave: { eyebrow: "SETTING TYPE", title: "Pavé Setting", intro: "Small diamonds along the band add light across the whole ring.", cards: [["Half Pavé", "Comfortable and bright."], ["Slim Pavé Band", "Lighter and more delicate."], ["Double Pavé", "A more glamorous look."]] },
  settingThreeStone: { eyebrow: "SETTING TYPE", title: "Three-Stone Setting", intro: "Three stones symbolize past, present and future.", cards: [["Emerald Three-Stone", "Composed and refined."], ["Oval Three-Stone", "Soft and visually generous."], ["Pear Side Stones", "Elegant directional lines."]] },
  settingVintage: { eyebrow: "SETTING TYPE", title: "Vintage Setting", intro: "Engraving, milgrain and vintage proportions add ceremony and character.", cards: [["Milgrain Detail", "Fine vintage texture."], ["Engraved Band", "Handcrafted character."], ["Soft Aged Metal", "Warm and understated."]] },
  shipping: {
    eyebrow: "SHIPPING POLICY",
    title: "Shipping Policy",
    intro: "Everastone crafts every order and ships after quality inspection. Standard production takes about 15 days, with global air delivery in about 3–6 days. Rush service may be available.",
    cards: [
      ["Production time", "Standard production takes about 15 days. Setting complexity, engraving and inspection may shift timing by around two days."],
      ["Delivery method", "Orders ship by trackable air delivery with insured shipment arranged according to order value."],
      ["Estimated arrival", `Based on today, estimated arrival is around ${formatArrivalDate(23)}. Actual timing depends on production, customs and local delivery.`],
      ["Tracking notice", "Tracking details are updated after dispatch and can be reviewed by email or account order history."],
      ["Rush service", "If your proposal date is close, contact your designer before ordering to confirm rush options."]
    ],
    cta: "Shop Engagement Rings"
  },
  returns: {
    eyebrow: "RETURN POLICY",
    title: "Return Policy",
    intro: "We want every ring to feel right. Eligible unworn standard pieces may be returned within 30 days. Bespoke, engraved, resized or special-specification pieces are reviewed case by case.",
    cards: [
      ["Eligible items", "Unworn, undamaged standard pieces with complete packaging and certificate may be reviewed within 30 days of delivery."],
      ["Non-returnable items", "Engraved, bespoke, resized, visibly worn, damaged or incomplete pieces are usually not eligible for no-reason returns."],
      ["Refund process", "Submit your order number and email. After approval, return inspection is arranged; approved refunds go back to the original payment method."],
      ["Refund timing", "Once issued, the arrival time depends on PayPal and your card issuer."],
      ["After-sale support", "For size issues, delivery exceptions or arrival concerns, contact support first so we can help."]
    ],
    cta: "Shop Engagement Rings"
  },
  warranty: {
    eyebrow: "WARRANTY POLICY",
    title: "Warranty Policy",
    intro: "Everastone is committed to carefully crafted jewelry made to accompany your story. We stand behind our workmanship and help resolve eligible issues with care.",
    cards: [
      ["One-year workmanship warranty", "Orders include a one-year warranty for eligible manufacturing defects such as loose prongs, accent-stone issues or plating concerns."],
      ["Accent-stone loss", "Within the warranty period, eligible accent-stone replacement may be supported according to the original specification."],
      ["First size adjustment", "The first eligible size adjustment within one year is complimentary within a limited size range."],
      ["Resize costs", "Major resizing or resizing after the warranty period is quoted case by case."],
      ["How to request service", "Contact support with your order information, photos and service request. We will confirm whether local repair or return service is appropriate."],
      ["Limitations", "This warranty does not cover center-stone loss or damage, misuse, impact damage or issues caused by outside factors."]
    ],
    cta: "Shop Engagement Rings"
  },
  terms: {
    eyebrow: "TERMS OF SERVICE",
    title: "Terms of Service",
    intro: "By browsing and purchasing from Everastone, you understand and accept the terms related to product display, bespoke communication, payment, production, shipping and after-sale service.",
    cards: [
      ["Product information", "Images, carat, material, specifications and prices are based on the product page and final order confirmation."],
      ["Order confirmation", "After payment, we begin inventory reservation or production according to the selected specification."],
      ["Prices and offers", "The first-order 10% discount is based on checkout display and may not combine with all campaigns."],
      ["Payment security", "Online payment is handled by PayPal or other third-party payment services. We do not store full card details on the frontend."],
      ["Bespoke service", "Bespoke rings require designer confirmation of budget, design and production timeline."],
      ["Limitations", "We assist with logistics, customs or third-party service issues, but cannot fully control external processing times."]
    ],
    cta: "Shop Engagement Rings"
  },
  privacy: {
    eyebrow: "PRIVACY POLICY",
    title: "Privacy Policy",
    intro: "Everastone values your privacy. We collect only the information needed for consultation, order processing, payment verification, delivery, after-sale service and security.",
    cards: [
      ["Information we collect", "Name, contact details, shipping address, order items, bespoke notes, payment status, support messages and reference images you provide."],
      ["How we use information", "To confirm orders, arrange bespoke service, provide delivery, support after-sale requests and improve the site experience."],
      ["Payment and third parties", "Payment is processed by third-party services. Logistics, email and storage providers receive only the information required to complete their service."],
      ["Images and bespoke materials", "Reference images and screenshots are used only for your bespoke consultation, production and after-sale verification unless you give permission for public use."],
      ["Data protection", "Admin interfaces use permission controls, and production keys should never be exposed in the frontend."],
      ["Your rights", "You may contact support to request review, correction or deletion of personal information not required for order or compliance records."]
    ],
    cta: "Shop Engagement Rings"
  }
};

const contentProductCategory = {
  couple: "couple",
  coupleClassic: "couple",
  coupleDiamond: "couple",
  coupleMinimal: "couple",
  coupleVintage: "couple"
};

const coupleSubcategories = [
  { key: "couple", label: "All", hint: "All matching rings" },
  { key: "coupleClassic", label: "Classic Bands", hint: "Clean everyday bands" },
  { key: "coupleDiamond", label: "Diamond Pairs", hint: "Subtle diamond details" },
  { key: "coupleMinimal", label: "Minimal Slim Rings", hint: "Light, refined profiles" },
  { key: "coupleVintage", label: "Vintage Engraved", hint: "Textured romantic details" }
];

const coupleProductMatchers = {
  coupleClassic: ["classic", "素圈", "经典", "band"],
  coupleDiamond: ["diamond", "带钻", "排钻", "钻"],
  coupleMinimal: ["minimal", "极简", "窄款"],
  coupleVintage: ["vintage", "复古", "雕花"]
};

const brandStorySections = [
  {
    title: "A promise beyond rarity",
    paragraphs: [
      "A diamond’s true value never lies in rare mining resources, but in the one-of-a-kind sincerity and everlasting promise behind every love story.",
      "Everastone was born from a simple yet unwavering belief: every genuine love deserves to be gently preserved by a pure, brilliant, and stress-free ring.",
      "Traditional diamond markets are often bounded by excessive premiums, complicated supply chains, and ethical concerns — weighing down the pure symbolism of love and commitment. We firmly believe that eternity should never be defined by price, and true love should never be limited by cost.",
      "Rooted in advanced lab-grown diamond craftsmanship, Everastone breaks the limitations of traditional fine jewelry. We do not simply replicate mined diamonds — we create a brighter, purer, and warmer alternative for modern couples who chase sincere and lasting love."
    ]
  },
  {
    title: "Emotion before craftsmanship",
    paragraphs: [
      "From carefully selecting every loose diamond to hand-polishing every delicate curve of the band, Everastone always upholds the philosophy: emotion precedes craftsmanship, and perfection lies in details.",
      "Every lab-grown diamond we feature carries the identical crystal structure and brilliant light performance as natural diamonds. Free from mining damage and chaotic supply chains, every sparkle is pure, transparent, and timeless.",
      "We reject assembly-line uniformity and focus entirely on emotional personalized customization. The outline, proportion, and subtle details of each ring are tailored to your unique love — passionate, gentle, minimalist, or resolute. Every love story deserves its own exclusive token.",
      "Stripping away unnecessary commercial premiums while retaining ultimate quality. We let couples invest in pure romance and lifelong commitment, not artificial scarcity."
    ]
  },
  {
    title: "The stone of eternity",
    paragraphs: [
      "Everastone — the stone of eternity, born for true love.",
      "We do not chase fleeting trends, only timeless classics that endure years of precipitation. In the fast-paced modern world of love, we choose to be the steady witness. With exquisitely crafted rings, we freeze the heartbeat of proposals, the tenderness of companionship, and the certainty of a lifetime together.",
      "No matter how you meet and how you stay together, true love is always equal and precious.",
      "May every Everastone ring walk through time with you, turning every precious moment into everlasting eternity."
    ]
  }
];

function DesignerStylesPage({ diamonds, openProduct, addToCart }) {
  const dedicatedDesignerProducts = diamonds
    .filter((product) => product.category === "designer")
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
  const designerProducts = (dedicatedDesignerProducts.length ? dedicatedDesignerProducts : diamonds
    .filter((product) => ["engagement", "wedding", "couple"].includes(product.category))
  ).slice(0, 5);
  const featuredProducts = designerProducts.length ? designerProducts : diamonds.slice(0, 5);
  const quickBuy = (product) => {
    const variant = normalizeProductVariant(product.variants?.[0], product.material, product.price);
    addToCart?.({ ...product, price: variant.price ?? product.price }, `${getMainMaterial(variant.material)} · ${variant.purity}`, "US 6");
  };

  return (
    <main className="designer-page">
      <section className="designer-hero">
        <p className="eyebrow">DESIGNER EDITION</p>
        <h1>Designer Edition Lab-Grown Diamond Rings</h1>
        <p>This season’s theme, Scarlet Orbit, uses black-and-gold contrast to amplify lab-grown diamond fire, with a refined red accent for proposal-day emotion.</p>
      </section>
      <section className="designer-track" aria-label="Designer edition products">
        {featuredProducts.slice(0, 5).map((product, index) => {
          const variant = normalizeProductVariant(product.variants?.[0], product.material, product.price);
          return (
            <article className="designer-product-card" key={product.id}>
              <span className="designer-index">0{index + 1}</span>
              <img src={getPrimaryProductImage(product)} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} loading="lazy" />
              <div>
                <p className="designer-tag">{Number(product.carat).toFixed(2)}ct · {shapeLabel(product.shape)}</p>
                <h2>{product.name ?? `${shapeLabel(product.shape)} Designer Diamond Ring`}</h2>
                <p>Design language: clean shoulders and a high-set center stone, made for polished, memorable proposal moments.</p>
                <div className="designer-buy-row">
                  <strong>{money(variant.price ?? product.price)}</strong>
                  <div className="designer-card-actions">
                    <button className="gold-btn" onClick={() => openProduct(product.id)}>View Details</button>
                    <button className="redline-btn" onClick={() => quickBuy(product)}>Buy Now</button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function FeaturedProductGuide({ diamonds, openProduct, addToCart, setPage, title = "Featured Rings", intro = "Start from a finished style, then personalize the diamond, metal and size with our designer." }) {
  const featured = (diamonds ?? [])
    .filter((product) => ["engagement", "wedding", "couple"].includes(product.category))
    .slice(0, 3);
  const products = featured.length ? featured : (diamonds ?? []).slice(0, 3);
  const quickAdd = (product) => {
    const variant = normalizeProductVariant(product.variants?.[0], product.material, product.price);
    addToCart?.({ ...product, price: variant.price ?? product.price }, `${getMainMaterial(variant.material)} · ${variant.purity}`, "US 6");
  };

  if (!products.length) return null;

  return (
    <section className="page-product-guide" aria-label="Featured product recommendations">
      <div>
        <p className="eyebrow">SHOP THE EDIT</p>
        <h2>{title}</h2>
        <p>{intro}</p>
        <button className="secondary-btn" onClick={() => setPage("diamonds")}>View All Engagement Rings</button>
      </div>
      <div className="page-product-guide-list">
        {products.map((product) => (
          <article className="page-product-guide-card" key={product.id}>
            <button type="button" onClick={() => openProduct(product.id)} aria-label={`View ${shapeLabelEn(product.shape)} ring`}>
              <img src={getPrimaryProductImage(product)} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} loading="lazy" />
            </button>
            <div>
              <span>{Number(product.carat).toFixed(2)}ct · {shapeLabelEn(product.shape)}</span>
              <strong>{shapeLabelEn(product.shape)} Lab-Grown Diamond Ring</strong>
              <small>{money(product.price)}</small>
              <button type="button" onClick={() => quickAdd(product)}>Add to Bag</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomFlowPage({ setPage, diamonds, openProduct, addToCart }) {
  const [designerModalOpen, setDesignerModalOpen] = useState(false);
  const steps = [
    ["01", UserRound, "Add Your Designer", "Connect with a WhatsApp designer and share your budget, occasion and inspiration references."],
    ["02", Heart, "Share the Story", "Confirm the center-stone shape, carat range, metal, ring size and preferred delivery window."],
    ["03", CreditCard, "Place the Deposit", "Approve the direction and secure your design slot before the private order is prepared."],
    ["04", Sparkles, "Review the Design", "Receive the style direction, proportion notes and detail adjustments before production begins."],
    ["05", ShieldCheck, "Approve the Finished Piece", "Review photos or video of the finished ring, then confirm certificate, size and packaging details."],
    ["06", Truck, "Packed and Shipped", "After final inspection, your ring is packed securely and shipped with tracking information."]
  ];

  return (
    <main className="custom-flow-page">
      <section className="custom-flow-hero">
        <p className="eyebrow">BESPOKE SERVICE</p>
        <h1>Build Your Custom Bespoke Diamond Ring</h1>
        <p>Start with a designer conversation. Share your budget, style and date, then let us shape the details into a ring that feels unmistakably yours.</p>
        <div className="custom-flow-actions">
          <button className="primary-btn" onClick={() => setDesignerModalOpen(true)}>Add a Designer</button>
          <button className="secondary-btn" onClick={() => setPage("diamonds")}>Browse Engagement Rings</button>
        </div>
      </section>
      <section className="custom-timeline" aria-label="Bespoke ring timeline">
        {steps.map(([step, Icon, title, text]) => (
          <article className="custom-flow-card" key={step}>
            <span>{step}</span>
            <i aria-hidden="true"><Icon size={22} /></i>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>
      <FeaturedProductGuide
        diamonds={diamonds}
        openProduct={openProduct}
        addToCart={addToCart}
        setPage={setPage}
        title="Begin with a Ring You Love"
        intro="Explore ready-to-customize engagement rings before your designer refines the diamond, setting and timeline around your story."
      />
      {designerModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="designer-qr-modal" role="dialog" aria-modal="true" aria-label="Add a WhatsApp designer">
            <button className="modal-close" onClick={() => setDesignerModalOpen(false)} aria-label="Close"><X size={18} /></button>
            <img src={whatsappDesignerQr} alt="WhatsApp designer QR code" />
            <h2>Add Your Designer</h2>
            <p>Scan the QR code and send screenshots or inspiration images. We will confirm the diamond, metal, budget and delivery plan with you.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ContentPage({ contentKey, setPage, diamonds, openProduct, addToCart }) {
  if (contentKey === "designer") {
    return <DesignerStylesPage diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} />;
  }
  if (contentKey === "custom" || contentKey === "customProcess") {
    return <CustomFlowPage setPage={setPage} diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} />;
  }
  const isCouplePage = Boolean(contentProductCategory[contentKey]);
  const content = isCouplePage ? contentPages.couple : contentPages[contentKey] ?? contentPages.couple;
  const productCategory = contentProductCategory[contentKey];
  const isCatalogPage = Boolean(productCategory);
  const needsFilters = productCategory === "jewelry";
  const [search, setSearch] = useState("");
  const [shapeFilter, setShapeFilter] = useState("");
  const [sort, setSort] = useState("popular");
  const coupleMatchers = coupleProductMatchers[contentKey] ?? [];
  const contentProducts = productCategory ? diamonds
    .filter((product) => product.category === productCategory)
    .filter((product) => !coupleMatchers.length || coupleMatchers.some((keyword) => `${product.name ?? ""} ${product.id}`.toLowerCase().includes(keyword.toLowerCase())))
    .filter((product) => !search || `${product.name ?? ""} ${product.id}`.toLowerCase().includes(search.toLowerCase()))
    .filter((product) => !shapeFilter || product.shape === shapeFilter)
    .sort((a, b) => sort === "price" ? a.price - b.price : sort === "new" ? b.createdAt - a.createdAt : b.sold - a.sold) : [];
  return (
    <main className={`utility-page content-page${contentKey === "story" ? " brand-story-page" : ""}`}>
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p className="content-intro">{content.intro}</p>
      {contentKey === "story" ? (
        <section className="brand-story-layout">
          {brandStorySections.map((section, index) => (
            <article className="brand-story-section" key={section.title}>
              <div>
                <span>{section.title}</span>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <figure>
                <img
                  src={index === 0 ? heroRingImage : index === 1 ? shapes.find((shape) => shape.key === "round")?.image : warmGoldHero}
                  alt={`${section.title} visual`}
                  loading="lazy"
                />
              </figure>
            </article>
          ))}
          <article className="brand-slogan-card">
            <span>Core Slogan</span>
            <strong>{homeCopy.footer.slogan.en}</strong>
          </article>
        </section>
      ) : null}
      {contentKey === "story" ? (
        <FeaturedProductGuide
          diamonds={diamonds}
          openProduct={openProduct}
          addToCart={addToCart}
          setPage={setPage}
          title="Rings That Carry the Promise"
          intro="Discover the engagement rings our couples love most, then step into the Everastone story behind every piece."
        />
      ) : null}
      {!isCatalogPage && content.cards.length ? <div className="content-card-grid">
        {content.cards.map(([title, text]) => (
          <article className="content-card" key={title}>
            <Sparkles size={18} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div> : null}
      {isCatalogPage ? (
        <section className={isCouplePage ? "content-products couple-products-layout" : "content-products"}>
          {isCouplePage ? (
            <aside className="couple-subcategory-panel">
              <span>Choose a Style</span>
              {coupleSubcategories.map((item) => (
                <button className={contentKey === item.key ? "active" : ""} key={item.key} onClick={() => setPage("content", { contentKey: item.key })}>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
            ))}
            </aside>
          ) : null}
          <div className="content-products-main">
            {needsFilters ? <div className="content-filter-bar">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" />
              <select value={shapeFilter} onChange={(event) => setShapeFilter(event.target.value)}>
                <option value="">All Shapes</option>
                {shapes.map((shape) => <option value={shape.key} key={shape.key}>{shape.label}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="popular">Most Popular</option>
                <option value="price">Price: Low to High</option>
                <option value="new">Newest First</option>
              </select>
            </div> : null}
            <div className="results-toolbar">
              <span>{needsFilters ? "Filtered Results" : "Product List"} · {contentProducts.length} pieces</span>
            </div>
            {contentProducts.length ? <div className="product-grid">
              {contentProducts.map((product) => (
                <ProductCard product={product} openProduct={openProduct} addToCart={addToCart} key={product.id} />
              ))}
            </div> : <p className="content-empty">No matching products yet. Please adjust your filters.</p>}
          </div>
        </section>
      ) : null}
      {!isCatalogPage ? <div className="content-actions">
        <button className="primary-btn" onClick={() => setPage("diamonds")}>{content.cta ?? "Explore Engagement Rings"}</button>
        <button className="secondary-btn" onClick={() => setPage("home")}>Back to Home</button>
      </div> : null}
    </main>
  );
}

function Account({ setPage }) {
  const [activePanel, setActivePanel] = useState("orders");
  const [notice, setNotice] = useState("Welcome to Everastone. Sign in, or look up an order with your checkout email.");
  const [authSession, setAuthSession] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState("login");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestOrders, setGuestOrders] = useState([]);
  const [guestLookupLoading, setGuestLookupLoading] = useState(false);
  const [accountOrders, setAccountOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [addressDraft, setAddressDraft] = useState({
    recipient_name: "",
    phone: "",
    country: "United States",
    state: "",
    city: "",
    postal_code: "",
    address_line1: "",
    address_line2: "",
    is_default: false
  });
  const accessToken = authSession?.access_token;
  const currentUser = authSession?.user;
  const userId = currentUser?.id || currentUser?.sub || "";
  const userSuffix = (userId || "0000").replace(/[^a-zA-Z0-9]/g, "").slice(-4).padStart(4, "0").toUpperCase();
  const displayName = `#${userSuffix}`;
  const normalizeCustomerOrder = (order = {}) => ({
    id: order.orderNumber || order.order_number || order.id,
    orderStatus: orderStatusLabel(order.orderStatus || order.order_status || order.status),
    paymentStatus: orderStatusLabel(order.paymentStatus || order.payment_status),
    amount: Number(order.amount ?? order.order_amount ?? order.total) || 0,
    items: Array.isArray(order.items) ? order.items : [],
    trackingNumber: order.trackingNumber || order.tracking_number || order.logistics_no || "",
    logisticsProvider: order.logisticsProvider || order.logistics_provider || "",
    orderedAt: order.orderedAt || order.ordered_at || order.created_at
  });
  const loadAccountData = async (session = authSession) => {
    if (!session?.access_token) return;
    setNotice("Syncing your account details...");
    try {
      const [ordersData, favoritesData, addressesData] = await Promise.all([
        fetchMyOrders(session.access_token),
        fetchMyFavorites(session.access_token),
        fetchMyAddresses(session.access_token)
      ]);
      setAccountOrders((ordersData ?? []).map(normalizeCustomerOrder));
      setFavorites(Array.isArray(favoritesData) ? favoritesData : []);
      setAddresses(Array.isArray(addressesData) ? addressesData : []);
      setNotice("Your account details are up to date.");
    } catch (error) {
      setNotice(error.message || "We could not sync your account details.");
    }
  };
  const saveSession = (session) => {
    setAuthSession(session);
    window.localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
    upsertCustomerProfile(session, session.user?.app_metadata?.provider || "email");
  };
  const submitAuth = async () => {
    if (!authForm.email || !authForm.password) {
      setNotice("Please enter your email and password.");
      return;
    }
    setNotice(authMode === "register" ? "Creating your account..." : "Signing you in...");
    try {
      const payload = authMode === "register"
        ? await signUpWithEmail(authForm.email, authForm.password)
        : await signInWithEmail(authForm.email, authForm.password);
      const session = payload.access_token ? payload : payload.session;
      if (session?.access_token) {
        saveSession(session);
        await loadAccountData(session);
        setNotice(authMode === "register" ? "Account created. You are signed in." : "Signed in successfully.");
      } else {
        setNotice("Registration submitted. Please check your email to verify your account.");
      }
    } catch (error) {
      setNotice(error.message || "Account action failed. Please try again.");
    }
  };
  const recoverPassword = async () => {
    if (!authForm.email || !authForm.email.includes("@")) {
      setNotice("Please enter the email for password recovery.");
      return;
    }
    try {
      await sendPasswordRecovery(authForm.email);
      setNotice("Password recovery email sent. Please check your inbox.");
    } catch (error) {
      setNotice(error.message || "We could not send the password recovery email.");
    }
  };
  const handleGoogleSignIn = () => {
    try {
      window.location.assign(getGoogleSignInUrl(`${window.location.origin}/account`));
    } catch (error) {
      setNotice(error.message || "Google sign-in is not available yet. Please check Supabase Auth settings.");
    }
  };
  const logout = () => {
    window.localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setAuthSession(null);
    setAccountOrders([]);
    setFavorites([]);
    setAddresses([]);
    setNotice("You have signed out.");
  };
  const submitAddress = async () => {
    if (!accessToken || !currentUser?.id) {
      setNotice("Please sign in before saving an address.");
      return;
    }
    if (!addressDraft.recipient_name || !addressDraft.address_line1 || !addressDraft.city) {
      setNotice("Please enter at least the recipient, street address, and city.");
      return;
    }
    try {
      await saveMyAddress(accessToken, { ...addressDraft, user_id: currentUser.id });
      setAddressDraft({ recipient_name: "", phone: "", country: "United States", state: "", city: "", postal_code: "", address_line1: "", address_line2: "", is_default: false });
      await loadAccountData();
      setNotice("Address saved.");
    } catch (error) {
      setNotice(error.message || "We could not save this address.");
    }
  };
  const removeAddress = async (id) => {
    try {
      await deleteMyAddress(accessToken, id);
      setAddresses((items) => items.filter((item) => item.id !== id));
      setNotice("Address removed.");
    } catch (error) {
      setNotice(error.message || "We could not remove this address.");
    }
  };
  useEffect(() => {
    if (authSession?.access_token) loadAccountData(authSession);
  }, []);
  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const expires_in = params.get("expires_in");
    const token_type = params.get("token_type") || "bearer";
    if (!access_token) return;
    let cancelled = false;
    const completeOAuthLogin = async () => {
      setNotice("Completing Google sign-in...");
      try {
        const user = await fetchAuthUser(access_token);
        if (cancelled) return;
        const session = {
          access_token,
          refresh_token,
          expires_in: expires_in ? Number(expires_in) : undefined,
          token_type,
          user
        };
        saveSession(session);
        window.history.replaceState({}, "", "/account");
        await loadAccountData(session);
        setNotice("Signed in. Your orders, favorites, and addresses are synced.");
      } catch (error) {
        if (!cancelled) setNotice(error.message || "Google sign-in failed. Please try again.");
      }
    };
    completeOAuthLogin();
    return () => {
      cancelled = true;
    };
  }, []);
  const searchGuestOrders = async () => {
    if (!guestEmail || !guestEmail.includes("@")) {
      setNotice("Please enter the email used at checkout.");
      return;
    }
    setGuestLookupLoading(true);
    setNotice("Looking up your orders...");
    try {
      const orders = await lookupGuestOrders(guestEmail);
      setGuestOrders(orders);
      setNotice(orders.length ? `Found ${orders.length} order${orders.length > 1 ? "s" : ""}.` : "No orders were found for this email.");
    } catch (error) {
      setNotice(error.message || "Order lookup failed. Please try again.");
    } finally {
      setGuestLookupLoading(false);
    }
  };
  const panels = {
    orders: {
      title: "Orders",
      text: "View every engagement ring, matching ring, and jewelry order.",
      rows: ["HS20260913001 · In production · $4,860", "HS20260912008 · Paid, awaiting confirmation · $2,980", "HS20260911003 · Shipped · DHL 92838102"],
      actions: [["View details", "Recent order details opened."], ["Request support", "After-sales request opened."], ["Shop again", "Opening engagement rings."]]
    },
    favorites: {
      title: "Favorites",
      text: "Keep the diamonds and settings you love in one place.",
      rows: ["2.18ct Oval · E / VS1 · IGI", "1.74ct Round · D / VVS2 · GIA", "Pear halo setting concept"],
      actions: [["View favorites", "Favorites opened."], ["Remove selected", "Selected favorite removed."], ["Keep shopping", "Opening engagement rings."]]
    },
    plans: {
      title: "Saved Designs",
      text: "Review saved diamond, metal, size, and setting combinations.",
      rows: ["Design A · 2ct Oval · 18K White Gold · US 6", "Design B · 2.5ct Pear · Platinum · US 5.5", "Design C · 1.5ct Round · 14K Yellow Gold · UK L"],
      actions: [["Edit design", "Design editor opened."], ["Duplicate", "Current design duplicated."], ["Start bespoke", "Opening bespoke rings."]]
    },
    addresses: {
      title: "Addresses",
      text: "Manage saved shipping addresses and default delivery details.",
      rows: ["Olivia · New York, United States · Default", "Emma · London, United Kingdom", "Mia · Austin, United States"],
      actions: [["Add address", "Address form opened."], ["Edit address", "Address editor opened."], ["Set default", "Default address updated."]]
    }
  };
  const cards = [
    [ShoppingBag, "orders"],
    [Heart, "favorites"],
    [Sparkles, "plans"],
    [UserRound, "addresses"]
  ];
  const active = panels[activePanel];

  return (
    <main className="utility-page account-page">
      <h1>My Account</h1>
      <div className="mobile-account-shortcuts" aria-label="Account shortcuts">
        <button type="button"><UserRound size={22} /><span>Service</span></button>
        <button type="button" onClick={() => setActivePanel("addresses")}><Truck size={22} /><span>Address</span></button>
        <button type="button"><LayoutDashboard size={22} /><span>Settings</span></button>
      </div>
      <section className="auth-panel">
        {authSession ? (
          <div className="auth-signed-in account-welcome">
            <div>
              <p className="eyebrow">WELCOME BACK</p>
              <h2>{displayName}</h2>
              <p>Welcome back. May every visit to Everastone bring you a little closer to the ring meant for your story.</p>
              <small>{authSession.user?.email}</small>
            </div>
            <button className="secondary-btn" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <div className="auth-box account-guest-box">
            <div>
              <p className="eyebrow">GUEST CHECKOUT READY</p>
              <h2>You can check out as a guest anytime</h2>
              <div className="guest-status-copy">
                <p>No account is required to place an order. We will send order updates to the email you use at checkout.</p>
                <p>Sign in to keep your orders, favorite pieces, and saved addresses ready for every future visit.</p>
              </div>
            </div>
            <div className="auth-form">
              <button className="google-signin-btn" onClick={handleGoogleSignIn}>
                <span className="google-mark">G</span>
                Continue with Google
              </button>
              <div className="auth-divider"><span>or use email</span></div>
              <h3>{authMode === "register" ? "Create an email account" : "Email sign in"}</h3>
              <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
              <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" />
              <button className="primary-btn" onClick={submitAuth}>{authMode === "register" ? "Create account" : "Sign in"}</button>
              <button className="secondary-btn" onClick={() => setAuthMode((mode) => mode === "register" ? "login" : "register")}>{authMode === "register" ? "Already have an account" : "Create an account"}</button>
              <button className="text-link" onClick={recoverPassword}>Forgot password</button>
            </div>
          </div>
        )}
      </section>
      {authSession ? (
        <div className="account-grid">
          {cards.map(([Icon, key]) => (
            <button className={activePanel === key ? "account-card active" : "account-card"} key={key} onClick={() => { setActivePanel(key); setNotice(`${panels[key].title} opened.`); }}>
              <Icon />
              <h3>{panels[key].title}</h3>
              <p>{panels[key].text}</p>
            </button>
          ))}
        </div>
      ) : null}
      <section className="account-panel">
        <div>
          <p className="eyebrow">{authSession ? "ACCOUNT CENTER" : "ORDER LOOKUP"}</p>
          <h2>{authSession ? active.title : "Find your order by email"}</h2>
          <p>{notice}</p>
        </div>
        {activePanel === "orders" ? (
          <div className="guest-order-lookup">
            {!authSession ? (
              <div className="guest-lookup-intro">
                <h3>Already placed an order?</h3>
                <p>Enter the email used at checkout to view order status, payment status, and shipping progress.</p>
              </div>
            ) : null}
            {authSession ? (
              <div className="guest-order-list">
                {(accountOrders.length ? accountOrders : []).map((order) => (
                  <article className="guest-order-card" key={order.id}>
                    <div><span>Order No.</span><strong>{order.id}</strong></div>
                    <div><span>Order Status</span><strong>{orderStatusLabel(order.orderStatus)}</strong></div>
                    <div><span>Payment</span><strong>{orderStatusLabel(order.paymentStatus)}</strong></div>
                    <div><span>Total</span><strong>{money(order.amount)}</strong></div>
                    <p>{(order.items ?? []).map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""}`).join("; ") || "No item details yet."}</p>
                    {order.trackingNumber ? <p>Shipping: {order.logisticsProvider} {order.trackingNumber}</p> : <p>Shipping: awaiting dispatch</p>}
                  </article>
                ))}
                {!accountOrders.length ? <p>No orders are saved under this account yet.</p> : null}
              </div>
            ) : null}
            <div className="guest-order-form">
              <input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="Enter checkout email" />
              <button className="primary-btn" disabled={guestLookupLoading} onClick={searchGuestOrders}>{guestLookupLoading ? "Searching..." : "Look up order"}</button>
            </div>
            <div className="guest-order-list">
              {guestOrders.map((order) => (
                <article className="guest-order-card" key={order.id}>
                  <div>
                    <span>Order No.</span>
                    <strong>{order.orderNumber || order.id}</strong>
                  </div>
                  <div>
                    <span>Order Status</span>
                    <strong>{orderStatusLabel(order.orderStatus)}</strong>
                  </div>
                  <div>
                    <span>Payment</span>
                    <strong>{orderStatusLabel(order.paymentStatus)}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(order.amount)}</strong>
                  </div>
                  <p>{(order.items ?? []).map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""}`).join("; ")}</p>
                  {order.trackingNumber ? <p>Shipping: {order.logisticsProvider} {order.trackingNumber}</p> : <p>Shipping: awaiting dispatch</p>}
                </article>
              ))}
            </div>
            <div className="account-actions">
              <button className="primary-btn" onClick={() => setPage("diamonds")}>Continue shopping</button>
            </div>
          </div>
        ) : activePanel === "favorites" ? (
          <div className="guest-order-lookup">
            {authSession ? (
              <div className="guest-order-list">
                {favorites.map((favorite) => {
                  const product = favorite.products ?? {};
                  return (
                    <article className="guest-order-card" key={favorite.id}>
                      <div><span>Product</span><strong>{product.name || favorite.product_id}</strong></div>
                      <div><span>SKU</span><strong>{favorite.product_id}</strong></div>
                      <div><span>Price</span><strong>{product.price ? money(product.price) : "-"}</strong></div>
                      <div><span>Saved</span><strong>{favorite.created_at ? new Date(favorite.created_at).toLocaleDateString("en-US") : "-"}</strong></div>
                    </article>
                  );
                })}
                {!favorites.length ? <p>No favorites yet. Open a product detail page and save the pieces you love.</p> : null}
              </div>
            ) : <p>Please sign in to view saved favorites.</p>}
            <div className="account-actions"><button className="primary-btn" onClick={() => setPage("diamonds")}>Continue shopping</button></div>
          </div>
        ) : activePanel === "addresses" ? (
          <div className="address-manager">
            {authSession ? (
              <>
                <div className="address-form">
                  <input placeholder="Recipient" value={addressDraft.recipient_name} onChange={(event) => setAddressDraft((current) => ({ ...current, recipient_name: event.target.value }))} />
                  <input placeholder="Phone" value={addressDraft.phone} onChange={(event) => setAddressDraft((current) => ({ ...current, phone: event.target.value }))} />
                  <select value={addressDraft.country} onChange={(event) => setAddressDraft((current) => ({ ...current, country: event.target.value }))}><option>United States</option><option>United Kingdom</option></select>
                  <input placeholder="State / Region" value={addressDraft.state} onChange={(event) => setAddressDraft((current) => ({ ...current, state: event.target.value }))} />
                  <input placeholder="City" value={addressDraft.city} onChange={(event) => setAddressDraft((current) => ({ ...current, city: event.target.value }))} />
                  <input placeholder="ZIP / Postal Code" value={addressDraft.postal_code} onChange={(event) => setAddressDraft((current) => ({ ...current, postal_code: event.target.value }))} />
                  <input className="wide" placeholder="Street address" value={addressDraft.address_line1} onChange={(event) => setAddressDraft((current) => ({ ...current, address_line1: event.target.value }))} />
                  <input className="wide" placeholder="Apartment, suite, unit" value={addressDraft.address_line2} onChange={(event) => setAddressDraft((current) => ({ ...current, address_line2: event.target.value }))} />
                  <label className="check-row"><input type="checkbox" checked={addressDraft.is_default} onChange={(event) => setAddressDraft((current) => ({ ...current, is_default: event.target.checked }))} /> Set as default address</label>
                  <button className="primary-btn" onClick={submitAddress}>Save address</button>
                </div>
                <div className="guest-order-list">
                  {addresses.map((address) => (
                    <article className="guest-order-card" key={address.id}>
                      <div><span>Recipient</span><strong>{address.recipient_name}</strong></div>
                      <div><span>Phone</span><strong>{address.phone || "-"}</strong></div>
                      <div><span>Country</span><strong>{address.country}</strong></div>
                      <div><span>Default</span><strong>{address.is_default ? "Yes" : "No"}</strong></div>
                      <p>{[address.address_line1, address.address_line2, address.city, address.state, address.postal_code].filter(Boolean).join(", ")}</p>
                      <button className="secondary-btn" onClick={() => removeAddress(address.id)}>Remove address</button>
                    </article>
                  ))}
                  {!addresses.length ? <p>No saved addresses yet.</p> : null}
                </div>
              </>
            ) : <p>Please sign in to manage shipping addresses.</p>}
          </div>
        ) : (
          <>
            <div className="account-list">
              {active.rows.map((row) => <button key={row} onClick={() => setNotice(`Selected: ${row}`)}>{row}</button>)}
            </div>
            <div className="account-actions">
              {active.actions.map(([label, message]) => (
                <button
                  className={label === "Keep shopping" || label === "Shop again" || label === "Start bespoke" ? "primary-btn" : "secondary-btn"}
                  key={label}
                  onClick={() => {
                    setNotice(message);
                    if (label === "Keep shopping" || label === "Shop again") setPage("diamonds");
                    if (label === "Start bespoke") setPage("content", { contentKey: "custom" });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function BlogPage({ posts, diamonds, openProduct, blogSlug, setPage }) {
  const recommendedProducts = ["oval", "round", "pear"].map((shapeKey) => diamonds
    .filter((product) => product.shape === shapeKey && product.category !== "couple" && product.category !== "jewelry")
    .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))[0]
  ).filter(Boolean);
  const publishedPosts = (posts ?? []).filter((post) => post.status !== "draft");
  const activePost = blogSlug ? publishedPosts.find((post) => (post.slug || slugify(post.title) || post.id) === blogSlug) : null;

  if (blogSlug && activePost) {
    return (
      <main className="blog-page blog-detail-page">
        <button className="text-link blog-back-link" onClick={() => setPage("blog")}>← Back to Blog</button>
        <article className="blog-detail-article">
          {activePost.image ? <img className="blog-detail-image" src={activePost.image} alt={activePost.title} /> : null}
          <span>{activePost.updatedAt}</span>
          <h1>{activePost.title}</h1>
          <p>{activePost.subtitle}</p>
          <blockquote>{activePost.cover}</blockquote>
          <div className="blog-content-text">{activePost.content}</div>
        </article>
        <aside className="blog-recommendations blog-detail-recommendations">
          <p className="eyebrow">RECOMMENDED RINGS</p>
          <h2>Continue with a ring</h2>
          {recommendedProducts.map((product) => (
            <button className="blog-recommend-card" key={product.id} onClick={() => openProduct(product.id)}>
              <img src={getPrimaryProductImage(product)} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} />
              <span>{shapeLabelEn(product.shape)} · {Number(product.carat).toFixed(2)}ct</span>
              <strong>{product.name}</strong>
              <small>{money(product.price)}</small>
            </button>
          ))}
        </aside>
      </main>
    );
  }

  return (
    <main className="blog-page">
      <section className="blog-hero">
        <p className="eyebrow">EVERASTONE JOURNAL</p>
        <h1>Brand Blog</h1>
        <p>Guides, stories and designer notes for choosing a lab-grown diamond ring with confidence.</p>
      </section>
      <div className="blog-layout">
        <section className="blog-list">
          {publishedPosts.map((post) => (
            <article className="blog-card" key={post.id}>
              {post.image ? <img className="blog-card-image" src={post.image} alt={post.title} /> : null}
              <span>{post.updatedAt}</span>
              <h2>{post.title}</h2>
              <p>{post.subtitle}</p>
              <blockquote>{post.cover}</blockquote>
              <button className="secondary-btn" onClick={() => setPage("blog", { blogSlug: post.slug || slugify(post.title) || post.id })}>Read Article</button>
            </article>
          ))}
          {!publishedPosts.length ? <p className="content-empty">No blog posts yet. Add posts in the admin dashboard.</p> : null}
        </section>
        <aside className="blog-recommendations">
          <p className="eyebrow">RECOMMENDED RINGS</p>
          <h2>Start with loved silhouettes</h2>
          {recommendedProducts.map((product) => (
            <button className="blog-recommend-card" key={product.id} onClick={() => openProduct(product.id)}>
              <img src={getPrimaryProductImage(product)} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} />
              <span>{shapeLabelEn(product.shape)} · {Number(product.carat).toFixed(2)}ct</span>
              <strong>{product.name}</strong>
              <small>{money(product.price)}</small>
            </button>
          ))}
        </aside>
      </div>
    </main>
  );
}

const formatOrderAddress = (address = {}) => [
  address.firstName || address.lastName ? `${address.firstName ?? ""} ${address.lastName ?? ""}`.trim() : "",
  address.addressLine1,
  address.addressLine2,
  address.city,
  address.state,
  address.postalCode,
  address.country
].filter(Boolean).join(", ");

const mapApiOrderToAdminOrder = (order = {}) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] ?? {};
  return {
    id: order.orderNumber || order.id,
    userId: order.email,
    email: order.email,
    amount: Number(order.amount) || 0,
    paid: order.paymentStatus || "待付款",
    status: order.orderStatus || "待付款",
    country: order.address?.country || "",
    type: firstItem.title?.includes("对戒") ? "对戒" : firstItem.title?.includes("项链") || firstItem.title?.includes("耳") ? "首饰" : "钻戒成品",
    payment: "PayPal",
    transaction: order.paymentIntentId || "",
    address: formatOrderAddress(order.address),
    items: items.map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""}`).join("；"),
    logistics: order.trackingNumber ? `${order.logisticsProvider || "物流"} ${order.trackingNumber}` : "待发货",
    note: "",
    refund: ["退款中", "已退款"].includes(order.orderStatus) ? order.orderStatus : "无",
    raw: order
  };
};

function Admin({ diamonds, setDiamonds, socialLinks, setSocialLinks, blogPosts, setBlogPosts }) {
  const [adminTab, setAdminTab] = useState("products");
  const [adminTokenInput, setAdminTokenInput] = useState(() => getAdminApiToken());
  const [productTab, setProductTab] = useState("engagement");
  const [orderTab, setOrderTab] = useState("list");
  const [productSearch, setProductSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [apiNotice, setApiNotice] = useState("");
  const [adminLogs, setAdminLogs] = useState([
    "超级管理员 09:30 更新 LD-1001 售价与证书信息",
    "商品运营 10:12 批量导出裸钻库存 CSV",
    "订单客服 11:08 为 HS20260911003 录入 DHL 物流单号"
  ]);
  const [supportSessions, setSupportSessions] = useState(() => readSupportSessions());
  const [activeSupportId, setActiveSupportId] = useState("");
  const [supportReply, setSupportReply] = useState("");
  const [customerProfiles, setCustomerProfiles] = useState(() => readCustomerProfiles());
  const [socialDraft, setSocialDraft] = useState(() => socialLinks);
  const [blogDraft, setBlogDraft] = useState(() => ({
    id: "",
    slug: "",
    title: "",
    metaTitle: "",
    metaDescription: "",
    subtitle: "",
    cover: "",
    image: "",
    content: "",
    status: "published",
    updatedAt: new Date().toISOString().slice(0, 10)
  }));
  const [selectedOrderId, setSelectedOrderId] = useState("HS20260913001");
  const [orderSearch, setOrderSearch] = useState("");
  const [draft, setDraft] = useState({
    sku: "LD-CUSTOM-001",
    name: "2ct Oval Lab Grown Diamond",
    shape: "oval",
    carat: "2.00",
    color: "E",
    clarity: "VS1",
    cut: "Excellent",
    polish: "Excellent",
    symmetry: "Excellent",
    certificate: "IGI",
    fluorescence: "None",
    depth: "60-62%",
    table: "56-58%",
    ratio: "1.40",
    pricePerCarat: "1600",
    stock: "1",
    status: "上架",
    tag: "热销"
  });
  const emptyProductDraft = {
    name: "",
    sku: "",
    price: "",
    stock: "",
    material: "铂金",
    mainStone: "培育钻石",
    shape: "round",
    carat: "1.50",
    color: "E",
    clarity: "VS1",
    cut: "Excellent",
    certificate: "IGI",
    polish: "Excellent",
    symmetry: "Excellent",
    depth: "60-62%",
    table: "56-58%",
    ratio: "1.00",
    fluorescence: "None",
    size: "US 6 / UK L",
    status: "上架",
    description: "以主钻比例、戒托线条与日常佩戴舒适度为核心设计，可按克拉、材质、颜色与净度组合定制。",
    imageCaption: "上传图片为 1.50ct 圆形实物图",
    imageAlt: "",
    imageTitle: "",
    images: [],
    materialImages: { whiteGold: [], roseGold: [], yellowGold: [] },
    videoUrls: [],
    variants: [
      { carat: "1.00", material: "铂金", purity: "铂金", price: "1880" },
      { carat: "1.50", material: "黄金", purity: "18K", price: "2680" },
      { carat: "2.00", material: "玫瑰金", purity: "18K", price: "3980" }
    ]
  };
  const productCategories = [
    { key: "engagement", label: "求婚钻戒" },
    { key: "jewelry", label: "首饰" },
    { key: "couple", label: "对戒" },
    { key: "wedding", label: "结婚钻戒" },
    { key: "designer", label: "设计师款式" }
  ];
  const [productDraft, setProductDraft] = useState({
    ...emptyProductDraft,
    name: "椭圆形培育钻石求婚戒指",
    sku: "ER-OVAL-001",
    price: "3280",
    stock: "8",
    shape: "oval",
    carat: "2.00"
  });
  const [productCatalog, setProductCatalog] = useState([
    { id: "ER-OVAL-001", category: "engagement", name: "椭圆形培育钻石求婚戒指", sku: "ER-OVAL-001", price: 3280, stock: 8, material: "18K 白金", mainStone: "培育钻石", shape: "oval", carat: "2.00", color: "E", clarity: "VS1", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Excellent", depth: "61.8%", table: "58%", ratio: "1.42", fluorescence: "None", size: "US 6 / UK L", status: "上架", images: [shapes.find((shape) => shape.key === "oval")?.image], variants: [{ carat: "1.50", material: "14K 白金", price: "2480" }, { carat: "2.00", material: "18K 白金", price: "3280" }, { carat: "2.50", material: "铂金", price: "4680" }] },
    { id: "JW-NECK-001", category: "jewelry", name: "日常轻奢培育钻石项链", sku: "JW-NECK-001", price: 880, stock: 16, material: "14K 黄金", mainStone: "培育钻石", shape: "round", carat: "0.50", color: "F", clarity: "VS2", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Excellent", depth: "62.0%", table: "58%", ratio: "1.00", fluorescence: "None", size: "可调节链长", status: "上架", images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.30", material: "14K 黄金", price: "680" }, { carat: "0.50", material: "14K 黄金", price: "880" }, { carat: "0.80", material: "18K 黄金", price: "1280" }] },
    { id: "CP-PAIR-001", category: "couple", name: "极简窄款培育钻石对戒", sku: "CP-PAIR-001", price: 1260, stock: 12, material: "铂金", mainStone: "小颗培育钻石", shape: "round", carat: "0.20", color: "G", clarity: "VS1", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Very Good", depth: "62.1%", table: "57%", ratio: "1.00", fluorescence: "Faint", size: "男戒/女戒可选", status: "上架", images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.10", material: "18K 白金", price: "980" }, { carat: "0.20", material: "铂金", price: "1260" }, { carat: "0.35", material: "铂金", price: "1680" }] },
    { id: "WR-BAND-001", category: "wedding", name: "结婚纪念培育钻石婚戒", sku: "WR-BAND-001", price: 1680, stock: 10, material: "18K 玫瑰金", mainStone: "培育钻石", shape: "princess", carat: "0.80", color: "F", clarity: "VS2", cut: "Very Good", certificate: "GIA", polish: "Excellent", symmetry: "Very Good", depth: "69.1%", table: "70%", ratio: "1.01", fluorescence: "Medium", size: "US/UK 尺码", status: "上架", images: [shapes.find((shape) => shape.key === "princess")?.image], variants: [{ carat: "0.50", material: "18K 玫瑰金", price: "1280" }, { carat: "0.80", material: "18K 玫瑰金", price: "1680" }, { carat: "1.20", material: "铂金", price: "2380" }] },
    { id: "ER-PEAR-002", category: "engagement", name: "水滴形光环培育钻石求婚戒指", sku: "ER-PEAR-002", price: 3950, stock: 6, material: "18K 白金", mainStone: "培育钻石", shape: "pear", carat: "2.50", color: "F", clarity: "VS2", cut: "Very Good", certificate: "IGI", polish: "Excellent", symmetry: "Very Good", depth: "63.4%", table: "59%", ratio: "1.58", fluorescence: "None", size: "US 5-9 / UK J-R", status: "上架", images: [shapes.find((shape) => shape.key === "pear")?.image], variants: [{ carat: "2.00", material: "14K 白金", price: "3180" }, { carat: "2.50", material: "18K 白金", price: "3950" }, { carat: "3.00", material: "铂金", price: "5480" }] },
    { id: "ER-EMERALD-003", category: "engagement", name: "祖母绿形三石培育钻石求婚戒指", sku: "ER-EMERALD-003", price: 5120, stock: 4, material: "铂金", mainStone: "培育钻石", shape: "emerald", carat: "3.00", color: "G", clarity: "VS1", cut: "Excellent", certificate: "GIA", polish: "Very Good", symmetry: "Excellent", depth: "64.0%", table: "62%", ratio: "1.39", fluorescence: "None", size: "US 5-9 / UK J-R", status: "上架", images: [shapes.find((shape) => shape.key === "emerald")?.image], variants: [{ carat: "2.00", material: "18K 白金", price: "3680" }, { carat: "3.00", material: "铂金", price: "5120" }, { carat: "4.00", material: "铂金", price: "6980" }] },
    { id: "JW-EAR-002", category: "jewelry", name: "圆形培育钻石耳钉", sku: "JW-EAR-002", price: 1180, stock: 22, material: "18K 白金", mainStone: "培育钻石", shape: "round", carat: "1.00", color: "E", clarity: "VS1", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Excellent", depth: "62.1%", table: "57%", ratio: "1.00", fluorescence: "Faint", size: "耳针款", status: "上架", images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.50", material: "14K 白金", price: "780" }, { carat: "1.00", material: "18K 白金", price: "1180" }, { carat: "1.50", material: "铂金", price: "1880" }] },
    { id: "CP-VINTAGE-002", category: "couple", name: "复古雕花培育钻石情侣对戒", sku: "CP-VINTAGE-002", price: 1580, stock: 7, material: "18K 黄金", mainStone: "培育钻石", shape: "round", carat: "0.30", color: "G", clarity: "VS2", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Excellent", depth: "62.0%", table: "58%", ratio: "1.00", fluorescence: "None", size: "男女戒可选", status: "上架", images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.20", material: "18K 黄金", price: "1280" }, { carat: "0.30", material: "18K 黄金", price: "1580" }, { carat: "0.50", material: "铂金", price: "2180" }] },
    { id: "WR-OVAL-002", category: "wedding", name: "椭圆形排镶培育钻石结婚戒指", sku: "WR-OVAL-002", price: 2280, stock: 5, material: "18K 白金", mainStone: "培育钻石", shape: "oval", carat: "1.20", color: "E", clarity: "VS2", cut: "Excellent", certificate: "IGI", polish: "Excellent", symmetry: "Excellent", depth: "61.5%", table: "58%", ratio: "1.36", fluorescence: "None", size: "US/UK 尺码", status: "上架", images: [shapes.find((shape) => shape.key === "oval")?.image], variants: [{ carat: "0.80", material: "14K 白金", price: "1680" }, { carat: "1.20", material: "18K 白金", price: "2280" }, { carat: "1.80", material: "铂金", price: "3280" }] }
  ]);
  const totalPrice = Math.round((Number(draft.carat) || 0) * (Number(draft.pricePerCarat) || 0));
  const adminModules = [
    { key: "products", title: "商品管理", desc: "裸钻、钻戒、首饰、回收站、操作日志" },
    { key: "categories", title: "类目管理", desc: "前台导航、二级分类、筛选标签、SEO" },
    { key: "orders", title: "订单管理", desc: "订单流转、物流、备注、售后" },
    { key: "customers", title: "用户管理", desc: "注册用户、登录来源、联系方式" },
    { key: "support", title: "联系定制师", desc: "前台留言、WhatsApp、后台回复" },
    { key: "blog", title: "品牌博客", desc: "博客内容、推荐商品、SEO 内容" },
    { key: "sales", title: "订单数据", desc: "销售额、克拉、客单价、退款率" },
    { key: "traffic", title: "流量统计", desc: "UV/PV、来源、页面、转化漏斗" },
    { key: "settings", title: "权限设置", desc: "子账号、物流、支付、促销、系统日志" }
  ];
  const optionGroups = [
    ["切工", grades],
    ["证书", certificates],
    ["抛光", grades],
    ["对称", grades],
    ["荧光反应", fluorescence]
  ];
  const [orders, setOrders] = useState([
    {
      id: "HS20260913001",
      userId: "U-1028",
      email: "olivia@example.com",
      amount: 4860,
      paid: "已付款",
      status: "已付款待确认",
      country: "United States",
      type: "钻戒成品",
      payment: "PayPal",
      transaction: "PP-83Y2-9182",
      address: "48 Madison Ave, New York, NY 10010, United States",
      items: "2.18ct 椭圆形 E/VS1 IGI + 18K White Gold Halo Setting",
      logistics: "FedEx 待发货",
      note: "客户希望加急，戒圈 US 6.5，内侧刻字 Always.",
      refund: "无"
    },
    {
      id: "HS20260912008",
      userId: "U-0981",
      email: "emma@example.co.uk",
      amount: 2980,
      paid: "已付款",
      status: "定制生产中",
      country: "United Kingdom",
      type: "裸钻",
      payment: "Stripe",
      transaction: "ST-UK-77219",
      address: "12 King Street, London W1, United Kingdom",
      items: "1.74ct 圆形 D/VVS2 GIA 裸钻",
      logistics: "待生产完成",
      note: "生产备注：证书随包裹寄出。",
      refund: "无"
    },
    {
      id: "HS20260911003",
      userId: "U-0872",
      email: "mia@example.com",
      amount: 1260,
      paid: "已付款",
      status: "已发货",
      country: "United States",
      type: "首饰",
      payment: "PayPal",
      transaction: "PP-73A1-4490",
      address: "22 Sunset Blvd, Los Angeles, CA 90028, United States",
      items: "Lab Diamond Tennis Bracelet",
      logistics: "DHL 92838102",
      note: "无特殊备注。",
      refund: "售后窗口开启"
    }
  ]);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const filteredDiamonds = diamonds.filter((diamond) => {
    const keyword = `${diamond.id} ${shapeLabel(diamond.shape)} ${diamond.color} ${diamond.clarity} ${diamond.certificate}`.toLowerCase();
    return keyword.includes(productSearch.toLowerCase());
  });
  const filteredOrders = orders.filter((order) => `${order.id} ${order.email} ${order.country} ${order.status}`.toLowerCase().includes(orderSearch.toLowerCase()));
  const statusFlow = ["待付款", "已付款", "制作中", "已发货", "已完成", "已取消", "退款中", "已退款"];
  const logAction = (message) => setAdminLogs((items) => [`${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} ${message}`, ...items].slice(0, 12));
  const saveAdminToken = () => {
    setAdminApiToken(adminTokenInput.trim());
    setApiNotice("管理员 Token 已保存到当前浏览器。");
  };
  const activeProductCategory = productCategories.find((category) => category.key === productTab) ?? productCategories[0];
  const currentProducts = productCatalog.filter((product) => {
    const keyword = `${product.name} ${product.sku} ${product.material} ${product.shape} ${product.status}`.toLowerCase();
    return product.category === productTab && keyword.includes(productSearch.toLowerCase());
  });
  const openProductModal = (mode, product = null) => {
    if (product) {
      setEditingProductId(product.id);
      setViewingProduct(product);
      setProductDraft({
        ...product,
        price: String(product.price),
        stock: String(product.stock),
        images: product.images ?? [],
        materialImages: product.materialImages ?? { whiteGold: [], roseGold: [], yellowGold: [] },
        videoUrls: product.videoUrls ?? [],
        variants: (product.variants ?? []).map((variant) => ({ ...normalizeProductVariant(variant, product.material, product.price), price: String(variant.price ?? product.price ?? "") }))
      });
    } else {
      setEditingProductId(null);
      setViewingProduct(null);
      setProductDraft({ ...emptyProductDraft, sku: `${productTab.toUpperCase()}-${Date.now().toString().slice(-5)}` });
    }
    setProductModal(mode);
  };
  const closeProductModal = () => {
    setEditingProductId(null);
    setViewingProduct(null);
    setProductDraft({ ...emptyProductDraft, sku: `${productTab.toUpperCase()}-${Date.now().toString().slice(-5)}` });
    setProductModal(null);
  };
  const syncProductToFrontend = (product) => {
    const firstVariant = product.variants?.[0];
    const diamondItem = {
      id: product.sku,
      category: product.category,
      name: product.name,
      shape: shapeKeyFromLabel(product.shape),
      carat: Number(firstVariant?.carat ?? product.carat) || 1,
      color: product.color,
      clarity: product.clarity,
      cut: product.cut,
      polish: product.polish,
      symmetry: product.symmetry,
      certificate: product.certificate,
      fluorescence: product.fluorescence,
      depth: product.depth,
      table: product.table,
      ratio: product.ratio,
      price: Number(firstVariant?.price ?? product.price) || 0,
      image: getPrimaryProductImage(product) || shapes.find((shape) => shape.key === shapeKeyFromLabel(product.shape))?.image,
      images: product.images ?? [],
      materialImages: product.materialImages ?? { whiteGold: [], roseGold: [], yellowGold: [] },
      videoUrls: product.videoUrls ?? [],
      description: product.description,
      imageCaption: product.imageCaption,
      imageAlt: product.name,
      imageTitle: product.imageTitle ?? "",
      variants: (product.variants ?? []).map((variant) => ({ ...normalizeProductVariant(variant, product.material, product.price), price: Number(variant.price) || 0 })),
      fast: product.status === "上架",
      realPhoto: Boolean(getPrimaryProductImage(product)),
      createdAt: 22,
      sold: 0
    };
    setDiamonds((items) => {
      const exists = items.some((item) => item.id === diamondItem.id);
      return exists ? items.map((item) => item.id === diamondItem.id ? { ...item, ...diamondItem } : item) : [diamondItem, ...items];
    });
    const sharedProducts = mergeProductsById(readSharedFrontendProducts(), [diamondItem]);
    window.localStorage.setItem(FRONTEND_PRODUCTS_STORAGE_KEY, JSON.stringify(sharedProducts));
  };
  const saveProduct = async () => {
    const materialImages = productDraft.materialImages ?? { whiteGold: [], roseGold: [], yellowGold: [] };
    const allMaterialImages = materialImageGroups.flatMap((group) => materialImages[group.key] ?? []).filter(Boolean);
    const payload = {
      ...productDraft,
      id: editingProductId || productDraft.sku || `${productTab}-${Date.now()}`,
      sku: productDraft.sku || `${productTab.toUpperCase()}-${Date.now().toString().slice(-5)}`,
      category: productTab,
      imageAlt: productDraft.name,
      imageTitle: productDraft.imageTitle ?? "",
      price: Number(productDraft.price) || 0,
      stock: Number(productDraft.stock) || 0,
      image: productDraft.image || allMaterialImages[0] || "",
      images: allMaterialImages,
      materialImages,
      videoUrls: (productDraft.videoUrls ?? []).filter(Boolean)
    };
    setProductSaving(true);
    setApiNotice("");
    try {
      const savedProduct = await saveStorefrontProduct(payload);
      const nextProduct = savedProduct || payload;
      setProductCatalog((items) => editingProductId ? items.map((item) => item.id === editingProductId ? nextProduct : item) : [nextProduct, ...items]);
      syncProductToFrontend(nextProduct);
      logAction(`${editingProductId ? "编辑" : "新增"}${activeProductCategory.label}商品 ${nextProduct.sku || payload.sku}，已同步 Supabase`);
      closeProductModal();
    } catch (error) {
      setProductCatalog((items) => editingProductId ? items.map((item) => item.id === editingProductId ? payload : item) : [payload, ...items]);
      syncProductToFrontend(payload);
      setApiNotice(`Supabase 暂未写入：${error.message}。已先保存到本地演示数据。`);
      logAction(`${editingProductId ? "编辑" : "新增"}${activeProductCategory.label}商品 ${payload.sku}，本地兜底保存`);
      closeProductModal();
    } finally {
      setProductSaving(false);
    }
  };
  const editProduct = (product) => {
    openProductModal("edit", product);
  };
  const deleteProduct = async (product) => {
    try {
      await deleteStorefrontProduct(product.sku);
      logAction(`删除商品 ${product.sku}，已同步 Supabase`);
    } catch (error) {
      setApiNotice(`Supabase 暂未删除：${error.message}。已先从本地演示数据移除。`);
      logAction(`删除商品 ${product.sku}，本地兜底删除`);
    }
    setProductCatalog((items) => items.filter((item) => item.id !== product.id));
    setDiamonds((items) => items.filter((item) => item.id !== product.sku));
    const sharedProducts = readSharedFrontendProducts().filter((item) => item.id !== product.sku);
    window.localStorage.setItem(FRONTEND_PRODUCTS_STORAGE_KEY, JSON.stringify(sharedProducts));
    if (editingProductId === product.id) closeProductModal();
  };
  const handleProductImageUpload = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }))).then((images) => setProductDraft((current) => ({ ...current, images: [...(current.images ?? []), ...images] })));
  };
  const handleMaterialImageUpload = (groupKey, event) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const group = materialImageGroups.find((item) => item.key === groupKey);
    Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        try {
          const url = await uploadProductImage({
            dataUrl,
            fileName: file.name,
            contentType: file.type,
            sku: productDraft.sku || editingProductId || productTab,
            material: group?.label || groupKey
          });
          resolve(url || dataUrl);
        } catch (error) {
          setApiNotice(`图片暂未上传到 Supabase Storage：${error.message}。已先使用本地预览图，正式上线前请确认 ADMIN_API_TOKEN 与 Storage 权限。`);
          resolve(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }))).then((images) => setProductDraft((current) => ({
      ...current,
      image: current.image || images[0],
      materialImages: {
        ...(current.materialImages ?? {}),
        [groupKey]: [...(current.materialImages?.[groupKey] ?? []), ...images]
      }
    })));
  };
  const updateVideoUrl = (index, value) => {
    setProductDraft((current) => ({
      ...current,
      videoUrls: (current.videoUrls?.length ? current.videoUrls : [""]).map((url, urlIndex) => urlIndex === index ? value : url)
    }));
  };
  const addVideoUrl = () => setProductDraft((current) => ({ ...current, videoUrls: [...(current.videoUrls ?? []), ""] }));
  const removeVideoUrl = (index) => setProductDraft((current) => ({ ...current, videoUrls: (current.videoUrls ?? []).filter((_, urlIndex) => urlIndex !== index) }));
  const updateVariant = (index, key, value) => {
    setProductDraft((current) => ({
      ...current,
      variants: (current.variants ?? []).map((variant, variantIndex) => {
        if (variantIndex !== index) return variant;
        if (key === "material") {
          return { ...variant, material: value, purity: value === "铂金" ? "铂金" : variant.purity === "铂金" ? "18K" : variant.purity };
        }
        if (key === "purity" && value === "铂金") return { ...variant, purity: value, material: "铂金" };
        return { ...variant, [key]: value };
      })
    }));
  };
  const addVariant = () => {
    setProductDraft((current) => ({
      ...current,
      variants: [...(current.variants ?? []), { carat: current.carat || "1.00", material: current.material, purity: getMaterialImageGroup(current.material) === "whiteGold" ? "铂金" : "18K", price: current.price || "0" }]
    }));
  };
  const removeVariant = (index) => {
    setProductDraft((current) => ({ ...current, variants: (current.variants ?? []).filter((_, variantIndex) => variantIndex !== index) }));
  };
  const updateOrder = async (id, patch) => {
    setOrders((items) => items.map((order) => order.id === id ? { ...order, ...patch } : order));
    try {
      const apiPatch = {
        orderStatus: patch.status,
        paymentStatus: patch.paid,
        trackingNumber: patch.trackingNumber || (patch.logistics && !patch.logistics.includes("待") ? patch.logistics.replace(/^(FedEx|DHL|UPS|Royal Mail)\s*/i, "") : undefined),
        logisticsProvider: patch.logisticsProvider || (patch.logistics?.match(/^(FedEx|DHL|UPS|Royal Mail)/i)?.[0] ?? undefined),
        note: patch.note
      };
      const savedOrder = await updateAdminOrder(id, apiPatch);
      setOrders((items) => items.map((order) => order.id === id ? mapApiOrderToAdminOrder(savedOrder) : order));
      logAction(`${id} 已同步更新到订单数据库`);
    } catch (error) {
      setApiNotice(`订单本地已更新，但同步数据库失败：${error.message}`);
    }
  };
  const activeSupportSession = supportSessions.find((session) => session.id === activeSupportId) ?? supportSessions[0];
  const refreshSupportSessions = () => {
    const nextSessions = readSupportSessions();
    setSupportSessions(nextSessions);
    setActiveSupportId((current) => current || nextSessions[0]?.id || "");
  };
  const sendSupportReply = () => {
    const text = supportReply.trim();
    if (!text || !activeSupportSession) return;
    const now = new Date().toISOString();
    const nextSessions = readSupportSessions().map((session) => session.id === activeSupportSession.id ? {
      ...session,
      updatedAt: now,
      status: "replied",
      messages: [
        ...(session.messages ?? []),
        { id: `staff-${Date.now()}`, role: "staff", text, createdAt: now }
      ]
    } : session);
    writeSupportSessions(nextSessions);
    setSupportSessions(nextSessions);
    setSupportReply("");
    logAction(`客服回复访客 ${activeSupportSession.whatsapp || activeSupportSession.visitorId}`);
  };
  const saveSocialSettings = () => {
    writeSocialLinks(socialDraft);
    setSocialLinks({ ...defaultSocialLinks, ...socialDraft });
    setApiNotice("页脚社媒主页链接已保存。");
    logAction("更新页脚 Instagram / YouTube / Facebook 链接");
  };
  const saveBlogPost = async () => {
    if (!blogDraft.title.trim()) {
      setApiNotice("请先填写博客标题。");
      return;
    }
    const nextPost = {
      ...blogDraft,
      id: blogDraft.id || `blog-${Date.now()}`,
      slug: blogDraft.slug || slugify(blogDraft.title),
      metaTitle: blogDraft.metaTitle || `${blogDraft.title} | everastone Blog`,
      metaDescription: blogDraft.metaDescription || blogDraft.subtitle || blogDraft.cover,
      updatedAt: blogDraft.updatedAt || new Date().toISOString().slice(0, 10)
    };
    const nextPosts = blogPosts.some((post) => post.id === nextPost.id)
      ? blogPosts.map((post) => post.id === nextPost.id ? nextPost : post)
      : [nextPost, ...blogPosts];
    let syncedPost = nextPost;
    let backendSynced = true;
    try {
      syncedPost = await saveBlogPostApi(nextPost);
    } catch (error) {
      backendSynced = false;
      setApiNotice(`品牌博客已先保存到本地，后端同步失败：${error.message}`);
    }
    const syncedPosts = nextPosts.map((post) => post.id === nextPost.id ? { ...nextPost, ...syncedPost } : post);
    writeBlogPosts(syncedPosts);
    setBlogPosts(syncedPosts);
    setBlogDraft({ id: "", slug: "", title: "", metaTitle: "", metaDescription: "", subtitle: "", cover: "", image: "", content: "", status: "published", updatedAt: new Date().toISOString().slice(0, 10) });
    if (backendSynced) setApiNotice("品牌博客已保存，前台列表和动态 Sitemap 会同步更新。");
    logAction(`${blogDraft.id ? "编辑" : "新增"}品牌博客 ${nextPost.title}`);
  };
  const editBlogPost = (post) => {
    setBlogDraft({ ...post });
    setAdminTab("blog");
  };
  const deleteBlogPost = async (id) => {
    const nextPosts = blogPosts.filter((post) => post.id !== id);
    try {
      await deleteBlogPostApi(id);
    } catch (error) {
      setApiNotice(`本地已删除，后端删除失败：${error.message}`);
    }
    writeBlogPosts(nextPosts);
    setBlogPosts(nextPosts);
    logAction(`删除品牌博客 ${id}`);
  };
  const handleBlogImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBlogDraft((current) => ({ ...current, image: reader.result }));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    refreshSupportSessions();
    const refresh = () => refreshSupportSessions();
    window.addEventListener("storage", refresh);
    window.addEventListener("everastone-support-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("everastone-support-updated", refresh);
    };
  }, []);

  useEffect(() => {
    const refreshCustomers = () => setCustomerProfiles(readCustomerProfiles());
    window.addEventListener("storage", refreshCustomers);
    window.addEventListener("everastone-customers-updated", refreshCustomers);
    return () => {
      window.removeEventListener("storage", refreshCustomers);
      window.removeEventListener("everastone-customers-updated", refreshCustomers);
    };
  }, []);

  useEffect(() => {
    productCatalog.forEach(syncProductToFrontend);
    const generatedAdminProducts = categorySeedProducts.map((product) => ({
      id: product.id,
      category: product.category,
      name: product.name,
      sku: product.id,
      price: product.price,
      stock: 12,
      material: getMainMaterial(product.variants?.[0]?.material ?? "铂金"),
      mainStone: "培育钻石",
      shape: product.shape,
      carat: String(product.carat),
      color: product.color,
      clarity: product.clarity,
      cut: product.cut,
      certificate: product.certificate,
      polish: product.polish,
      symmetry: product.symmetry,
      depth: product.depth,
      table: product.table,
      ratio: product.ratio,
      fluorescence: product.fluorescence,
      size: "US 5-9 / UK J-R",
      status: "上架",
      images: product.images ?? [],
      materialImages: product.materialImages ?? { whiteGold: [], roseGold: [], yellowGold: [] },
      videoUrls: product.videoUrls ?? [],
      description: product.description ?? `这款${shapeLabel(product.shape)}培育钻石商品支持多规格定制，适合日常佩戴与重要时刻赠礼。`,
      imageCaption: product.imageCaption ?? `上传图片为 ${Number(product.carat).toFixed(2)}ct ${shapeLabel(product.shape)}实物图`,
      imageAlt: product.name,
      imageTitle: product.imageTitle ?? "",
      variants: (product.variants ?? []).map((variant) => ({ ...normalizeProductVariant(variant, product.material, product.price), price: String(variant.price) }))
    }));
    setProductCatalog((items) => {
      const missing = generatedAdminProducts.filter((product) => !items.some((item) => item.id === product.id));
      return missing.length ? [...missing, ...items] : items;
    });
  }, []);

  useEffect(() => {
    const syncedProducts = diamonds
      .filter((product) => productCategories.some((category) => category.key === product.category))
      .map((product) => ({
        id: product.id,
        category: product.category,
        name: product.name ?? `${shapeLabel(product.shape)}培育钻石商品`,
        sku: product.sku ?? product.id,
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        material: getMainMaterial(product.material ?? product.variants?.[0]?.material ?? "铂金"),
        mainStone: product.mainStone ?? "培育钻石",
        shape: product.shape,
        carat: String(product.carat ?? "1.00"),
        color: product.color ?? "E",
        clarity: product.clarity ?? "VS1",
        cut: product.cut ?? "Excellent",
        certificate: product.certificate ?? "IGI",
        polish: product.polish ?? "Excellent",
        symmetry: product.symmetry ?? "Excellent",
        depth: product.depth ?? "62%",
        table: product.table ?? "58%",
        ratio: product.ratio ?? "1.00",
        fluorescence: product.fluorescence ?? "None",
        size: product.size ?? "US 5-9 / UK J-R",
        status: product.status ?? "上架",
        images: product.images ?? (product.image ? [product.image] : []),
        materialImages: product.materialImages ?? { whiteGold: [], roseGold: [], yellowGold: [] },
        videoUrls: product.videoUrls ?? [],
        description: product.description ?? "",
        imageCaption: product.imageCaption ?? "",
        imageAlt: product.name ?? `${shapeLabel(product.shape)}培育钻石商品`,
        imageTitle: product.imageTitle ?? "",
        variants: (product.variants ?? []).map((variant) => ({ ...normalizeProductVariant(variant, product.material, product.price), price: String(variant.price) }))
      }));
    setProductCatalog((items) => {
      const merged = new Map(items.map((product) => [product.id, product]));
      syncedProducts.forEach((product) => merged.set(product.id, { ...merged.get(product.id), ...product }));
      return Array.from(merged.values());
    });
  }, [diamonds]);

  useEffect(() => {
    fetchAdminOrders()
      .then((remoteOrders) => {
        if (remoteOrders.length) {
          const mappedOrders = remoteOrders.map(mapApiOrderToAdminOrder);
          setOrders(mappedOrders);
          setSelectedOrderId(mappedOrders[0].id);
        }
      })
      .catch((error) => {
        setApiNotice(`暂未读取真实订单：${error.message}`);
      });
  }, []);

  useEffect(() => {
    fetchAdminAnalyticsSummary()
      .then((summary) => setAnalyticsSummary(summary))
      .catch((error) => {
        setApiNotice(`暂未读取真实统计：${error.message}`);
      });
  }, []);

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <LayoutDashboard />
        <div>
          <p className="eyebrow">全球培育钻石电商后台</p>
          <h1>everastone 管理后台</h1>
          <p>商品管理、类目管理、订单管理、订单数据与流量统计一体化，钻石参数与前台筛选栏同源维护。</p>
        </div>
        <div className="admin-token-box">
          <label>
            管理员 Token
            <input type="password" value={adminTokenInput} onChange={(event) => setAdminTokenInput(event.target.value)} placeholder="上线后填写 ADMIN_API_TOKEN" />
          </label>
          <button className="ghost-btn" onClick={saveAdminToken}>保存</button>
        </div>
        <a className="admin-storefront-link" href="/">返回前台官网</a>
      </section>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          {adminModules.map((module) => (
            <button className={adminTab === module.key ? "active" : ""} key={module.key} onClick={() => setAdminTab(module.key)}>
              <strong>{module.title}</strong>
              <span>{module.desc}</span>
            </button>
          ))}
        </aside>
        <section className="admin-workspace">
          {adminTab === "products" ? (
            <>
              <div className="admin-kpis">
                <article><span>商品总数</span><strong>{productCatalog.length}</strong><small>五类商品统一管理</small></article>
                <article><span>当前类目</span><strong>{currentProducts.length}</strong><small>{activeProductCategory.label}</small></article>
                <article><span>在售商品</span><strong>{productCatalog.filter((item) => item.status === "上架").length}</strong><small>可前台展示</small></article>
                <article><span>低库存</span><strong>{productCatalog.filter((item) => item.stock <= 3).length}</strong><small>库存 ≤ 3</small></article>
              </div>
              <section className="admin-panel large">
                <div className="admin-panel-title">
                  <h2><PackagePlus /> 商品管理</h2>
                  <div>
                    <button className="ghost-btn" onClick={() => openProductModal("add")}>新增商品</button>
                    <button className="ghost-btn" onClick={() => logAction("导出商品列表 CSV")}>导出列表</button>
                  </div>
                </div>
                {apiNotice ? <p className="admin-api-notice">{apiNotice}</p> : null}
                <div className="admin-subtabs">
                  {productCategories.map((category) => <button className={productTab === category.key ? "active" : ""} key={category.key} onClick={() => { setProductTab(category.key); setProductSearch(""); closeProductModal(); }}>{category.label}</button>)}
                </div>
                <div className="admin-filterbar simple-product-filter">
                  <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={`搜索${activeProductCategory.label}名称 / SKU / 材质 / 属性`} />
                  <select>
                    <option>全部状态</option>
                    <option>上架</option>
                    <option>下架</option>
                    <option>售罄</option>
                  </select>
                </div>
                <div className="admin-table simple-product-table">
                  <div className="admin-row admin-row-head"><span>图片</span><span>商品名称</span><span>SKU</span><span>商品属性</span><span>价格</span><span>库存</span><span>状态</span><span>操作</span></div>
                  {currentProducts.map((product) => {
                    const thumbImage = getProductMedia(product, product.material).images?.[0];
                    return (
                      <div className="admin-row" key={product.id}>
                        <span>{thumbImage ? <img className="admin-product-thumb" src={thumbImage} alt={getProductImageAlt(product)} title={getProductImageTitle(product)} /> : "无图"}</span>
                        <span>{product.name}</span>
                        <span>{product.sku}</span>
                        <span>{product.material} / {shapeLabel(product.shape)} / {product.carat}ct / {product.color} / {product.clarity}</span>
                        <strong>{money(product.price)}</strong>
                        <span>{product.stock}</span>
                        <span>{product.status}</span>
                        <span className="admin-actions">
                          <button onClick={() => openProductModal("view", product)}>查看</button>
                          <button onClick={() => editProduct(product)}>编辑</button>
                          <button onClick={() => deleteProduct(product)}>删除</button>
                        </span>
                      </div>
                    );
                  })}
                  {!currentProducts.length ? <div className="admin-empty">当前类目暂无商品，可以先上传商品图并新增。</div> : null}
                </div>
                {productModal ? (
                  <div className="admin-modal-backdrop" role="presentation">
                    <div className="admin-modal" role="dialog" aria-modal="true">
                      <div className="admin-modal-head">
                        <div>
                          <p className="eyebrow">{activeProductCategory.label}</p>
                          <h3>{productModal === "view" ? "查看商品" : editingProductId ? "编辑商品" : "新增商品"}</h3>
                        </div>
                        <button className="ghost-btn" onClick={closeProductModal}>关闭</button>
                      </div>
                      {productModal === "view" && viewingProduct ? (
                        <div className="product-view-panel modal-view">
                          <div className="modal-image-grid">
                            {(viewingProduct.images?.length ? viewingProduct.images : [shapes.find((shape) => shape.key === viewingProduct.shape)?.image]).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${getProductImageAlt(viewingProduct)} ${index + 1}`} title={getProductImageTitle(viewingProduct)} />)}
                          </div>
                          <div className="material-media-preview">
                            {materialImageGroups.map((group) => (
                              <div key={group.key}>
                                <strong>{group.label}商品图</strong>
                                <div className="modal-image-grid compact">
                                  {(viewingProduct.materialImages?.[group.key] ?? []).map((image, index) => <img key={`${group.key}-${index}`} src={image} alt={`${getProductImageAlt(viewingProduct)} ${group.label} ${index + 1}`} title={getProductImageTitle(viewingProduct)} />)}
                                </div>
                              </div>
                            ))}
                          </div>
                          <strong>{viewingProduct.name}</strong>
                          <span>SKU：{viewingProduct.sku}</span>
                          <span>类目：{activeProductCategory.label}</span>
                          <span>基础属性：{viewingProduct.material} / {viewingProduct.mainStone} / {viewingProduct.size}</span>
                          <span>筛选属性：{shapeLabel(viewingProduct.shape)} / {viewingProduct.carat}ct / {viewingProduct.color} / {viewingProduct.clarity}</span>
                          <span>高级属性：{viewingProduct.cut} / {viewingProduct.certificate} / {viewingProduct.polish} / {viewingProduct.symmetry} / {viewingProduct.fluorescence}</span>
                          <span>价格库存：{money(viewingProduct.price)} / 库存 {viewingProduct.stock} / {viewingProduct.status}</span>
                          <span>图片 alt：{getProductImageAlt(viewingProduct)}</span>
                          <span>图片 title：{viewingProduct.imageTitle || "未填写"}</span>
                          <span>图片提示：{viewingProduct.imageCaption}</span>
                          <p>{viewingProduct.description}</p>
                          {(viewingProduct.videoUrls ?? []).length ? <span>商品视频：{viewingProduct.videoUrls.join(" / ")}</span> : null}
                          <div className="variant-list">
                            <strong>可选规格价格</strong>
                            {(viewingProduct.variants ?? []).map((variant, index) => {
                              const normalizedVariant = normalizeProductVariant(variant, viewingProduct.material, viewingProduct.price);
                              const metalText = normalizedVariant.purity === "铂金" ? "铂金" : `${normalizedVariant.purity} ${normalizedVariant.material}`;
                              return <p key={`${variant.carat}-${index}`}>{normalizedVariant.carat}ct / {metalText} / {money(Number(normalizedVariant.price))}</p>;
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="material-media-editor">
                            <h4>按戒托材质上传商品图</h4>
                            <p>只区分铂金、黄金、玫瑰金三种展示图；10K-18K 等纯度会自动归到同一种主材质图片。每种材质第一张图会作为该材质列表主图。</p>
                            {materialImageGroups.map((group) => (
                              <div className="material-media-card" key={group.key}>
                                <label className="image-uploader small">
                                  <input type="file" accept="image/*" multiple onChange={(event) => handleMaterialImageUpload(group.key, event)} />
                                  <span>上传{group.label}多张商品图</span>
                                </label>
                                <div className="modal-image-grid compact">
                                  {(productDraft.materialImages?.[group.key] ?? []).map((image, index) => <img key={`${group.key}-${index}`} src={image} alt={`${getProductImageAlt(productDraft)} ${group.label} ${index + 1}`} title={getProductImageTitle(productDraft)} />)}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="video-url-editor">
                            <div className="variant-editor-head">
                              <div>
                                <h4>商品视频链接</h4>
                                <p>支持填写 YouTube 商品视频链接，前台商品详情会自动展示视频。</p>
                              </div>
                              <button className="ghost-btn" onClick={addVideoUrl}>添加视频链接</button>
                            </div>
                            {(productDraft.videoUrls?.length ? productDraft.videoUrls : [""]).map((url, index) => (
                              <div className="video-url-row" key={index}>
                                <input value={url} onChange={(event) => updateVideoUrl(index, event.target.value)} placeholder="例如：https://www.youtube.com/watch?v=xxxx" />
                                <button className="ghost-btn" onClick={() => removeVideoUrl(index)} disabled={(productDraft.videoUrls ?? []).length <= 1}>删除</button>
                              </div>
                            ))}
                          </div>
                          <div className="admin-form simple-product-form modal-product-form">
                            <h4>基础信息</h4>
                            <label><span>商品名称</span><input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value, imageAlt: event.target.value })} placeholder="例如：椭圆形培育钻石求婚戒指" /></label>
                            <label><span>SKU 编码</span><input value={productDraft.sku} onChange={(event) => setProductDraft({ ...productDraft, sku: event.target.value })} placeholder="例如：ER-OVAL-001" /></label>
                            <label><span>售价 USD</span><input value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} placeholder="例如：3280" /></label>
                            <label><span>库存数量</span><input value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} placeholder="例如：8" /></label>
                            <label className="wide"><span>商品简介</span><textarea value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} placeholder="介绍戒指设计、主钻比例、戒托工艺、适合场景等" /></label>
                            <label className="wide"><span>商品图文字提示</span><input value={productDraft.imageCaption} onChange={(event) => setProductDraft({ ...productDraft, imageCaption: event.target.value })} placeholder="例如：上传图片为 2.00ct 椭圆形实物图" /></label>
                            <label className="wide"><span>商品图片 title="" 属性</span><input value={productDraft.imageTitle ?? ""} onChange={(event) => setProductDraft({ ...productDraft, imageTitle: event.target.value })} placeholder="例如：2.00ct Oval Lab-Grown Diamond Engagement Ring" /></label>
                            <label><span>戒托 / 商品材质</span><select value={getMainMaterial(productDraft.material)} onChange={(event) => setProductDraft({ ...productDraft, material: event.target.value })}>{mainMaterials.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>主石 / 宝石属性</span><input value={productDraft.mainStone} onChange={(event) => setProductDraft({ ...productDraft, mainStone: event.target.value })} placeholder="例如：培育钻石" /></label>
                            <h4>前台筛选属性</h4>
                            <label><span>钻石形状</span><select value={productDraft.shape} onChange={(event) => setProductDraft({ ...productDraft, shape: event.target.value })}>{shapes.map((shape) => <option value={shape.key} key={shape.key}>{shape.zh}</option>)}</select></label>
                            <label><span>克拉重量</span><input value={productDraft.carat} onChange={(event) => setProductDraft({ ...productDraft, carat: event.target.value })} placeholder="1.00 - 7.00" /></label>
                            <label><span>颜色等级</span><select value={productDraft.color} onChange={(event) => setProductDraft({ ...productDraft, color: event.target.value })}>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>净度等级</span><select value={productDraft.clarity} onChange={(event) => setProductDraft({ ...productDraft, clarity: event.target.value })}>{clarities.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>切工等级</span><select value={productDraft.cut} onChange={(event) => setProductDraft({ ...productDraft, cut: event.target.value })}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>证书类型</span><select value={productDraft.certificate} onChange={(event) => setProductDraft({ ...productDraft, certificate: event.target.value })}>{certificates.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>抛光等级</span><select value={productDraft.polish} onChange={(event) => setProductDraft({ ...productDraft, polish: event.target.value })}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>对称等级</span><select value={productDraft.symmetry} onChange={(event) => setProductDraft({ ...productDraft, symmetry: event.target.value })}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <label><span>荧光反应</span><select value={productDraft.fluorescence} onChange={(event) => setProductDraft({ ...productDraft, fluorescence: event.target.value })}>{fluorescence.map((item) => <option key={item}>{item}</option>)}</select></label>
                            <h4>销售状态</h4>
                            <label><span>尺码 / 尺寸</span><input value={productDraft.size} onChange={(event) => setProductDraft({ ...productDraft, size: event.target.value })} placeholder="例如：US 6 / UK L" /></label>
                            <label><span>商品状态</span><select value={productDraft.status} onChange={(event) => setProductDraft({ ...productDraft, status: event.target.value })}><option>上架</option><option>下架</option><option>售罄</option></select></label>
                          </div>
                          <div className="variant-editor">
                            <div className="variant-editor-head">
                              <div>
                                <h4>多规格价格</h4>
                                <p>用户可在前台选择克拉数、主材质与材质纯度，不同规格对应不同售价；材质图片只跟随主材质变化。</p>
                              </div>
                              <button className="ghost-btn" onClick={addVariant}>添加规格</button>
                            </div>
                            {(productDraft.variants ?? []).map((variant, index) => (
                              <div className="variant-row" key={index}>
                                <label><span>克拉数</span><input value={variant.carat} onChange={(event) => updateVariant(index, "carat", event.target.value)} /></label>
                                <label><span>戒托材质</span><select value={getMainMaterial(variant.material)} onChange={(event) => updateVariant(index, "material", event.target.value)}>{mainMaterials.map((item) => <option key={item}>{item}</option>)}</select></label>
                                <label><span>材质纯度</span><select value={getPurityOptionsForMaterial(variant.material).includes(variant.purity ?? getMaterialPurity(variant.material)) ? variant.purity ?? getMaterialPurity(variant.material) : getPurityOptionsForMaterial(variant.material)[0]} onChange={(event) => updateVariant(index, "purity", event.target.value)}>{getPurityOptionsForMaterial(variant.material).map((item) => <option key={item}>{item}</option>)}</select></label>
                                <label><span>规格价格 USD</span><input value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} /></label>
                                <button className="ghost-btn" onClick={() => removeVariant(index)} disabled={(productDraft.variants ?? []).length <= 1}>删除</button>
                              </div>
                            ))}
                          </div>
                          <div className="admin-modal-actions">
                            <button className="ghost-btn" onClick={closeProductModal}>取消</button>
                            <button className="primary-btn" onClick={saveProduct} disabled={productSaving}>{productSaving ? "同步中..." : editingProductId ? "保存修改" : "确认新增"}</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {adminTab === "categories" ? (
            <section className="admin-panel large">
              <h2>类目管理</h2>
              <div className="admin-columns">
                <article><h3>一级类目</h3>{["订婚戒指", "情侣对戒", "日常珠宝", "定制戒指"].map((item, index) => <p key={item}>#{index + 1} {item} / Enabled / SEO 可编辑</p>)}</article>
                <article><h3>二级子类目</h3><p>圆形钻戒、祖母绿钻戒、水滴钻戒、公主方钻戒、复古款钻戒、素圈对戒、耳饰、项链、手链。</p></article>
                <article><h3>筛选标签管理</h3>{optionGroups.map(([title, list]) => <p key={title}>{title}：{list.join(" / ")}</p>)}</article>
              </div>
            </section>
          ) : null}

          {adminTab === "orders" ? (
            <section className="admin-panel large">
              <div className="admin-panel-title">
                <h2>订单管理</h2>
                <div>
                  <button className="ghost-btn" onClick={() => logAction("批量导出订单 CSV")}>导出订单</button>
                  <button className="ghost-btn" onClick={() => logAction("批量打印发货单")}>打印发货单</button>
                  <button className="ghost-btn" onClick={() => logAction("批量导出收货地址")}>导出地址</button>
                </div>
              </div>
              <div className="admin-subtabs">
                {[
                  ["list", "订单列表"],
                  ["detail", "订单详情"],
                  ["shipping", "发货物流"],
                  ["aftersales", "售后管理"],
                  ["reminders", "消息提醒"]
                ].map(([key, item]) => <button className={orderTab === key ? "active" : ""} key={key} onClick={() => setOrderTab(key)}>{item}</button>)}
              </div>
              {orderTab === "list" ? (
                <>
                  <div className="admin-filterbar order-filterbar">
                    <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="订单号 / 邮箱 / 国家 / 状态搜索" />
                    <select><option>全部状态</option>{statusFlow.map((item) => <option key={item}>{item}</option>)}</select>
                    <select><option>全部国家</option><option>United States</option><option>United Kingdom</option></select>
                    <select><option>全部商品类型</option><option>裸钻</option><option>钻戒成品</option><option>首饰</option></select>
                  </div>
                  <div className="admin-table order-table">
                    <div className="admin-row admin-row-head"><span>订单号</span><span>邮箱</span><span>金额</span><span>状态</span><span>国家</span><span>类型</span><span>操作</span></div>
                    {filteredOrders.map((order) => (
                      <div className="admin-row" key={order.id}>
                        <span>{order.id}<small>{order.logistics}</small></span>
                        <span>{order.email}<small>{order.userId}</small></span>
                        <strong>{money(order.amount)}</strong>
                        <span>{order.status}<small>{order.paid}</small></span>
                        <span>{order.country}</span>
                        <span>{order.type}</span>
                        <span className="admin-actions">
                          <button onClick={() => { setSelectedOrderId(order.id); setOrderTab("detail"); }}>详情</button>
                          <button onClick={() => { setSelectedOrderId(order.id); setOrderTab("shipping"); }}>发货</button>
                          <button onClick={() => updateOrder(order.id, { status: "已取消" })}>取消</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {orderTab === "detail" ? (
                <div className="order-detail-grid">
                  <article className="admin-detail-card"><h3>用户信息</h3><p>{selectedOrder.email}</p><p>{selectedOrder.address}</p><p>用户 ID：{selectedOrder.userId}</p></article>
                  <article className="admin-detail-card"><h3>商品清单</h3><p>{selectedOrder.items}</p><p>商品类型：{selectedOrder.type}</p></article>
                  <article className="admin-detail-card"><h3>价格明细</h3><p>商品金额：{money(selectedOrder.amount - 80)}</p><p>运费：$80</p><p>实付金额：{money(selectedOrder.amount)} USD</p></article>
                  <article className="admin-detail-card"><h3>支付信息</h3><p>{selectedOrder.payment}</p><p>流水号：{selectedOrder.transaction}</p><p>{selectedOrder.paid}</p></article>
                  <article className="admin-detail-card wide"><h3>内部备注 / 用户留言</h3><textarea value={selectedOrder.note} onChange={(event) => updateOrder(selectedOrder.id, { note: event.target.value })} /><button className="ghost-btn" onClick={() => logAction(`更新 ${selectedOrder.id} 内部备注`)}>保存备注</button></article>
                  <article className="admin-detail-card wide"><h3>订单状态流转</h3><div className="status-flow">{statusFlow.map((status) => <button className={selectedOrder.status === status ? "active" : ""} key={status} onClick={() => { updateOrder(selectedOrder.id, { status }); logAction(`${selectedOrder.id} 状态改为 ${status}`); }}>{status}</button>)}</div></article>
                </div>
              ) : null}
              {orderTab === "shipping" ? (
                <div className="order-detail-grid">
                  <article className="admin-detail-card wide"><h3>物流发货</h3><p>当前订单：{selectedOrder.id}</p><div className="admin-form shipping-form"><select defaultValue="FedEx"><option>FedEx</option><option>DHL</option><option>UPS</option><option>Royal Mail</option></select><input placeholder="物流单号" defaultValue={selectedOrder.logistics.includes("待") ? "" : selectedOrder.logistics} /><input placeholder="物流跟踪链接" /><button className="primary-btn" onClick={() => { updateOrder(selectedOrder.id, { status: "已发货", logistics: "FedEx 782910223" }); logAction(`${selectedOrder.id} 已录入物流并标记发货`); }}>确认发货</button></div></article>
                  <article className="admin-detail-card"><h3>物流模板</h3><p>美国：FedEx / UPS 保价配送</p><p>英国：DHL / Royal Mail 保价配送</p></article>
                  <article className="admin-detail-card"><h3>地址操作</h3><p>{selectedOrder.address}</p><button className="ghost-btn" onClick={() => logAction(`修改 ${selectedOrder.id} 收货地址`)}>修改地址</button></article>
                </div>
              ) : null}
              {orderTab === "aftersales" ? (
                <div className="admin-table aftersales-table">
                  <div className="admin-row admin-row-head"><span>售后单号</span><span>关联订单</span><span>类型</span><span>状态</span><span>处理人</span><span>操作</span></div>
                  {[
                    ["AS-202609-001", "HS20260911003", "退货", "待审核", "客服 Anna"],
                    ["AS-202609-002", "HS20260908012", "改款", "处理中", "客服 Lily"],
                    ["AS-202609-003", "HS20260903006", "退款", "退款完成", "主管 Claire"]
                  ].map((row) => <div className="admin-row" key={row[0]}>{row.map((item) => <span key={item}>{item}</span>)}<span className="admin-actions"><button onClick={() => logAction(`审核售后 ${row[0]}`)}>审核</button><button onClick={() => logAction(`上传 ${row[0]} 客户凭证`)}>凭证</button></span></div>)}
                </div>
              ) : null}
              {orderTab === "reminders" ? (
                <div className="admin-columns admin-product-cards">
                  {[
                    ["待付款超时提醒", "下单 30 分钟未付款自动提醒客户，并在后台生成客服待办。"],
                    ["新订单提醒", "PayPal / Stripe 支付成功后提醒商品运营确认库存与生产排期。"],
                    ["售后申请提醒", "客户提交退货、退款、改款申请后推送给订单客服。"],
                    ["发货超时提醒", "订单进入待发货 48 小时未录入物流，提醒管理员处理。"]
                  ].map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p><button className="ghost-btn" onClick={() => logAction(`开启${title}`)}>开启提醒</button></article>)}
                </div>
              ) : null}
            </section>
          ) : null}

          {adminTab === "customers" ? (
            <section className="admin-panel large customers-admin-panel">
              <div className="admin-panel-title">
                <h2><UserRound /> 用户管理</h2>
                <div>
                  <button className="ghost-btn" onClick={() => setCustomerProfiles(readCustomerProfiles())}>刷新用户</button>
                  <button className="ghost-btn" onClick={() => logAction("导出注册用户列表")}>导出用户</button>
                </div>
              </div>
              <p className="admin-api-notice">用户使用相同邮箱注册/登录时，会自动合并此前游客下单邮箱记录，便于同步订单、收藏和地址。</p>
              <div className="admin-kpis">
                <article><span>用户档案</span><strong>{customerProfiles.length}</strong><small>注册/登录/下单邮箱</small></article>
                <article><span>有订单邮箱</span><strong>{customerProfiles.filter((item) => Number(item.orderCount ?? 0) > 0 || item.lastOrderId).length}</strong><small>可自动绑定</small></article>
                <article><span>Google 用户</span><strong>{customerProfiles.filter((item) => String(item.provider).includes("google")).length}</strong><small>第三方登录</small></article>
                <article><span>Email 用户</span><strong>{customerProfiles.filter((item) => item.email).length}</strong><small>邮箱可触达</small></article>
              </div>
              <div className="admin-table customers-table">
                <div className="admin-row admin-row-head"><span>用户</span><span>邮箱</span><span>来源</span><span>订单绑定</span><span>最近登录/下单</span><span>操作</span></div>
                {customerProfiles.map((customer) => (
                  <div className="admin-row" key={customer.id}>
                    <span>{customer.displayName}<small>#{String(customer.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}</small></span>
                    <span>{customer.email || "-"}<small>{customer.phone || ""}</small></span>
                    <span>{customer.provider || customer.source || "-"}<small>{customer.country || ""}</small></span>
                    <span>{Number(customer.orderCount ?? 0)} 单<small>{customer.lastOrderId || (customer.orderEmails ?? []).join(" / ")}</small></span>
                    <span>{customer.lastOrderAt || customer.lastSignInAt || customer.createdAt}</span>
                    <span className="admin-actions">
                      <button onClick={() => logAction(`查看用户 ${customer.email || customer.id}`)}>查看</button>
                      <button onClick={() => logAction(`同步用户 ${customer.email || customer.id} 的订单邮箱`)}>同步订单</button>
                    </span>
                  </div>
                ))}
                {!customerProfiles.length ? <p className="content-empty">暂无用户档案。用户注册、登录或下单后会自动记录。</p> : null}
              </div>
            </section>
          ) : null}

          {adminTab === "support" ? (
            <section className="admin-panel large support-admin-panel">
              <div className="admin-panel-title">
                <h2><MessageCircle /> 联系定制师</h2>
                <div>
                  <button className="ghost-btn" onClick={refreshSupportSessions}>刷新会话</button>
                  <button className="ghost-btn" onClick={() => logAction("导出客服留言记录")}>导出记录</button>
                </div>
              </div>
              <p className="admin-api-notice">当前为本地实时演示：前台用户留下 WhatsApp 和留言后会出现在这里；上线可接 Supabase Realtime 或客服系统。</p>
              <div className="support-admin-grid">
                <aside className="support-session-list">
                  {supportSessions.length ? supportSessions.map((session) => {
                    const lastMessage = (session.messages ?? []).at(-1);
                    return (
                      <button className={activeSupportSession?.id === session.id ? "active" : ""} key={session.id} onClick={() => setActiveSupportId(session.id)}>
                        <strong>{session.name || session.whatsapp || session.email || "Guest visitor"}</strong>
                        <span>{session.whatsapp || session.email || "No contact yet"}</span>
                        <span>{lastMessage?.text || "暂无消息"}</span>
                        <small>{session.status === "replied" ? "已回复" : "待回复"}</small>
                      </button>
                    );
                  }) : <p>暂无前台留言。用户打开右下角 Message us 后提交，会自动出现在这里。</p>}
                </aside>
                <section className="support-admin-chat">
                  {activeSupportSession ? (
                    <>
                      <div className="support-admin-customer">
                        <strong>访客：{activeSupportSession.name || "未填写姓名"}</strong>
                        <span>邮箱：{activeSupportSession.email || "未填写"}</span>
                        <span>WhatsApp：{activeSupportSession.whatsapp || "未填写"}</span>
                        <span>访客 ID：{activeSupportSession.visitorId}</span>
                        <span>最近更新：{activeSupportSession.updatedAt ? new Date(activeSupportSession.updatedAt).toLocaleString("zh-CN") : "-"}</span>
                      </div>
                      <div className="support-admin-messages">
                        {(activeSupportSession.messages ?? []).map((item) => (
                          <p className={item.role === "customer" ? "from-customer" : "from-staff"} key={item.id}>
                            <span>{item.role === "customer" ? "用户" : item.role === "staff" ? "客服" : "系统"}</span>
                            {item.text}
                          </p>
                        ))}
                      </div>
                      <div className="support-admin-reply">
                        <textarea value={supportReply} onChange={(event) => setSupportReply(event.target.value)} placeholder="输入后台回复，前台对话框会同步显示..." />
                        <button className="primary-btn" onClick={sendSupportReply}>发送回复</button>
                      </div>
                    </>
                  ) : (
                    <div className="support-admin-empty">
                      <MessageCircle />
                      <h3>等待新的客户留言</h3>
                      <p>用户可以在前台右下角留言并留下 WhatsApp，客服再主动添加沟通。</p>
                    </div>
                  )}
                </section>
              </div>
            </section>
          ) : null}

          {adminTab === "blog" ? (
            <section className="admin-panel large blog-admin-panel">
              <div className="admin-panel-title">
                <h2><BookOpen /> 品牌博客</h2>
                <div>
                  <button className="ghost-btn" onClick={() => setBlogDraft({ id: "", slug: "", title: "", metaTitle: "", metaDescription: "", subtitle: "", cover: "", image: "", content: "", status: "published", updatedAt: new Date().toISOString().slice(0, 10) })}>新增博客</button>
                  <button className="ghost-btn" onClick={() => logAction("预览博客列表页 /blog")}>预览列表页</button>
                </div>
              </div>
              <p className="admin-api-notice">每篇博客前台都会默认推荐椭圆、圆形、水滴形里价格最低的戒指，帮助用户继续访问商品。</p>
              <div className="blog-admin-grid">
                <div className="admin-form blog-admin-form">
                  <label><span>博客标题</span><input value={blogDraft.title} onChange={(event) => setBlogDraft({ ...blogDraft, title: event.target.value })} placeholder="例如：How to Choose an Oval Lab-Grown Diamond Ring" /></label>
                  <label><span>SEO URL Slug</span><input value={blogDraft.slug ?? ""} onChange={(event) => setBlogDraft({ ...blogDraft, slug: slugify(event.target.value) })} placeholder="oval-lab-grown-diamond-ring-guide" /></label>
                  <label className="wide"><span>{"<title>"}</span><input value={blogDraft.metaTitle ?? ""} onChange={(event) => setBlogDraft({ ...blogDraft, metaTitle: event.target.value })} placeholder="例如：Oval Lab-Grown Diamond Ring Guide | everastone" /></label>
                  <label className="wide"><span>Meta Description</span><textarea value={blogDraft.metaDescription ?? ""} onChange={(event) => setBlogDraft({ ...blogDraft, metaDescription: event.target.value })} placeholder="填写搜索结果中展示的页面描述，建议 120–160 个英文字符。" /></label>
                  <label><span>副标题</span><input value={blogDraft.subtitle} onChange={(event) => setBlogDraft({ ...blogDraft, subtitle: event.target.value })} placeholder="一句话概括文章价值" /></label>
                  <label><span>发布日期</span><input value={blogDraft.updatedAt} onChange={(event) => setBlogDraft({ ...blogDraft, updatedAt: event.target.value })} placeholder="2026-09-16" /></label>
                  <label><span>状态</span><select value={blogDraft.status} onChange={(event) => setBlogDraft({ ...blogDraft, status: event.target.value })}><option value="published">发布</option><option value="draft">草稿</option></select></label>
                  <label className="wide"><span>博客封面图片</span><input type="file" accept="image/*" onChange={handleBlogImageUpload} /></label>
                  {blogDraft.image ? <img className="blog-admin-preview" src={blogDraft.image} alt="博客封面预览" /> : null}
                  <label className="wide"><span>列表摘要</span><textarea value={blogDraft.cover} onChange={(event) => setBlogDraft({ ...blogDraft, cover: event.target.value })} placeholder="显示在博客卡片里的重点摘要" /></label>
                  <label className="wide"><span>正文内容</span><textarea value={blogDraft.content} onChange={(event) => setBlogDraft({ ...blogDraft, content: event.target.value })} placeholder="填写完整博客正文，可用于品牌故事、选钻指南、定制科普等" /></label>
                  <label className="wide"><span>博客 GSC Sitemap（保存后自动更新）</span><textarea readOnly value={buildBlogSitemapXml(blogPosts)} /></label>
                  <button className="primary-btn" onClick={saveBlogPost}>{blogDraft.id ? "保存修改" : "发布博客"}</button>
                </div>
                <div className="blog-admin-list">
                  {blogPosts.map((post) => (
                    <article key={post.id}>
                      <span>{post.status === "draft" ? "草稿" : "已发布"} · {post.updatedAt}</span>
                      <h3>{post.title}</h3>
                      <p>{post.subtitle}</p>
                      <div className="admin-actions">
                        <button onClick={() => editBlogPost(post)}>编辑</button>
                        <button onClick={() => deleteBlogPost(post.id)}>删除</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {adminTab === "sales" ? (
            <section className="admin-panel large">
              <h2>订单数据分析报表</h2>
              <div className="admin-kpis">
                <article><span>总订单</span><strong>{analyticsSummary?.orders?.total ?? orders.length}</strong></article>
                <article><span>已付款订单</span><strong>{analyticsSummary?.orders?.paid ?? orders.filter((order) => order.paid === "已付款").length}</strong></article>
                <article><span>销售额</span><strong>{money(analyticsSummary?.orders?.salesAmount ?? orders.reduce((sum, order) => sum + Number(order.amount || 0), 0))}</strong></article>
                <article><span>成交克拉</span><strong>{Number(analyticsSummary?.orders?.totalCarat ?? 0).toFixed(2)} ct</strong></article>
                <article><span>客单价</span><strong>{money(analyticsSummary?.orders?.averageOrderValue ?? 0)}</strong></article>
                <article><span>退款率</span><strong>{((analyticsSummary?.orders?.refundRate ?? 0) * 100).toFixed(1)}%</strong></article>
              </div>
              <div className="admin-chart">
                {(analyticsSummary?.orders?.topProducts ?? []).length ? (
                  <div className="analytics-list">
                    {(analyticsSummary?.orders?.topProducts ?? []).map((item) => <p key={item.productId}><span>{item.title}</span><strong>{item.quantity} 件 / {money(item.amount)}</strong></p>)}
                  </div>
                ) : "暂无真实销售数据，付款订单产生后会自动统计。"}
              </div>
              <div className="admin-columns"><article><h3>钻石专项统计</h3><p>根据已付款订单统计销售额、成交克拉、客单价、退款率与热销商品。</p></article><article><h3>报表导出</h3><p>下一步可继续增加 CSV 导出、时间筛选和国家维度统计。</p></article></div>
            </section>
          ) : null}

          {adminTab === "traffic" ? (
            <section className="admin-panel large">
              <h2>流量统计</h2>
              <div className="admin-kpis">
                <article><span>PV</span><strong>{analyticsSummary?.traffic?.pageViews ?? 0}</strong></article>
                <article><span>商品浏览</span><strong>{analyticsSummary?.traffic?.productViews ?? 0}</strong></article>
                <article><span>加购</span><strong>{analyticsSummary?.traffic?.addToCart ?? 0}</strong></article>
                <article><span>开始结算</span><strong>{analyticsSummary?.traffic?.checkoutStarts ?? 0}</strong></article>
                <article><span>PayPal 发起</span><strong>{analyticsSummary?.traffic?.paypalStarts ?? 0}</strong></article>
                <article><span>成功付款</span><strong>{analyticsSummary?.traffic?.paypalPaid ?? 0}</strong></article>
              </div>
              <div className="admin-funnel"><span>访客访问</span><span>浏览商品</span><span>加入购物车</span><span>提交订单</span><span>成功付款</span></div>
              <div className="admin-columns">
                <article><h3>页面排行</h3>{(analyticsSummary?.traffic?.topPages ?? []).length ? (analyticsSummary?.traffic?.topPages ?? []).map((item) => <p key={item.path}>{item.path}：{item.count}</p>) : <p>暂无访问事件，页面被浏览后会自动记录。</p>}</article>
                <article><h3>转化漏斗</h3><p>从 PV、商品浏览、加购、结算、PayPal 发起、付款成功逐步统计。</p></article>
                <article><h3>来源分析</h3><p>当前为站内事件统计；上线后可再接 Google Analytics / Meta Pixel 做广告来源归因。</p></article>
              </div>
            </section>
          ) : null}

          {adminTab === "settings" ? (
            <section className="admin-panel large">
              <h2>权限与基础设置</h2>
              <div className="admin-form social-settings-form">
                <h3>页脚媒体平台主页链接</h3>
                <label><span>Instagram</span><input value={socialDraft.instagram} onChange={(event) => setSocialDraft({ ...socialDraft, instagram: event.target.value })} placeholder="https://www.instagram.com/everastone" /></label>
                <label><span>YouTube</span><input value={socialDraft.youtube} onChange={(event) => setSocialDraft({ ...socialDraft, youtube: event.target.value })} placeholder="https://www.youtube.com/@everastone" /></label>
                <label><span>Facebook</span><input value={socialDraft.facebook} onChange={(event) => setSocialDraft({ ...socialDraft, facebook: event.target.value })} placeholder="https://www.facebook.com/everastone" /></label>
                <button className="primary-btn" onClick={saveSocialSettings}>保存社媒链接</button>
              </div>
              <div className="admin-columns">
                {[
                  ["子账号权限", "超级管理员、商品运营、订单客服、数据查看员；客服不可修改商品售价，成本价仅管理员可见。"],
                  ["用户管理", "查看前台客户账号、订单、收藏、邮箱与内部备注。"],
                  ["物流管理", "维护 FedEx / DHL / UPS 渠道、运费模板与物流跟踪链接。"],
                  ["支付设置", "PayPal、Stripe 等支付接口配置预留。"],
                  ["促销管理", "优惠券、限时折扣、克拉促销、会员价。"],
                  ["系统日志", "记录谁在何时修改商品、订单、价格、权限与设置。"]
                ].map(([title, text]) => <article key={title}><ShieldCheck /><h3>{title}</h3><p>{text}</p></article>)}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Footer({ openContent, setPage, socialLinks }) {
  const socialItems = [
    ["instagram", "Instagram", Instagram],
    ["youtube", "YouTube", Youtube],
    ["facebook", "Facebook", Facebook]
  ];
  return (
    <footer className="site-footer">
      <div>
        <strong>everastone</strong>
        <p>{homeCopy.footer.brandText.en}</p>
        <p>{homeCopy.footer.slogan.en}</p>
        <div className="footer-socials" aria-label="Social media links">
          {socialItems.map(([key, label, Icon]) => (
            <a href={socialLinks?.[key] || "#"} target={socialLinks?.[key] ? "_blank" : undefined} rel="noreferrer" aria-label={label} key={key}>
              <Icon size={16} />
              <small>{label}</small>
            </a>
          ))}
        </div>
      </div>
      <div>
        <span>{homeCopy.footer.insured.en}</span>
        <span>{homeCopy.footer.returns.en}</span>
        <button className="footer-link" onClick={() => setPage("blog")}>Brand Blog</button>
        <button className="footer-link" onClick={() => openContent("shipping")}>Shipping Policy</button>
        <button className="footer-link" onClick={() => openContent("returns")}>Returns Policy</button>
        <button className="footer-link" onClick={() => openContent("warranty")}>Warranty Policy</button>
        <button className="footer-link" onClick={() => openContent("terms")}>Terms of Service</button>
        <button className="footer-link" onClick={() => openContent("privacy")}>Privacy Policy</button>
        <span>{homeCopy.footer.email.en}</span>
      </div>
    </footer>
  );
}

function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(() => readSupportSessions());
  const [contact, setContact] = useState({ name: "", email: "", whatsapp: "" });
  const [message, setMessage] = useState("");
  const visitorId = useMemo(() => getSupportVisitorId(), []);
  const activeSession = sessions.find((session) => session.visitorId === visitorId);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    const refresh = () => setSessions(readSupportSessions());
    window.addEventListener("storage", refresh);
    window.addEventListener("everastone-support-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("everastone-support-updated", refresh);
    };
  }, []);

  const sendMessage = () => {
    const cleanMessage = message.trim();
    const cleanWhatsapp = contact.whatsapp.trim();
    const cleanEmail = contact.email.trim();
    const cleanName = contact.name.trim();
    if (!cleanMessage && !cleanWhatsapp && !cleanEmail) return;
    const now = new Date().toISOString();
    const nextMessage = cleanMessage || `WhatsApp: ${cleanWhatsapp}`;
    const currentSessions = readSupportSessions();
    const existing = currentSessions.find((session) => session.visitorId === visitorId);
    const nextSession = existing ? {
      ...existing,
      name: cleanName || existing.name,
      email: cleanEmail || existing.email,
      whatsapp: cleanWhatsapp || existing.whatsapp,
      updatedAt: now,
      status: "open",
      messages: [
        ...(existing.messages ?? []),
        { id: `msg-${Date.now()}`, role: "customer", text: nextMessage, createdAt: now }
      ]
    } : {
      id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      visitorId,
      name: cleanName,
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: `msg-${Date.now()}`, role: "system", text: "Thanks for reaching out. Leave your WhatsApp or email and our designer will reply here and contact you personally.", createdAt: now },
        { id: `msg-${Date.now()}-customer`, role: "customer", text: nextMessage, createdAt: now }
      ]
    };
    const nextSessions = existing
      ? currentSessions.map((session) => session.visitorId === visitorId ? nextSession : session)
      : [nextSession, ...currentSessions];
    writeSupportSessions(nextSessions);
    setSessions(nextSessions);
    setMessage("");
  };

  return (
    <div className={open ? "support-chat open" : "support-chat"}>
      {open ? (
        <section className="support-chat-panel" aria-label="Contact your Everastone designer">
          <div className="support-chat-head">
            <div>
              <strong>Contact a Designer</strong>
              <span>Leave your WhatsApp or email. Our designer will reply here and add you personally.</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close support chat">×</button>
          </div>
          <div className="support-chat-messages">
            {messages.length ? messages.map((item) => (
              <p className={item.role === "customer" ? "from-customer" : "from-staff"} key={item.id}>{item.text}</p>
            )) : (
              <>
                <p className="from-staff">Hi, tell us the ring style, budget and timeline you have in mind.</p>
                <p className="from-staff">Leave your WhatsApp or email so our designer can reply precisely to your request.</p>
              </>
            )}
          </div>
          <label>
            Name
            <input value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" />
          </label>
          <label>
            Email
            <input value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" />
          </label>
          <label>
            WhatsApp
            <input value={contact.whatsapp} onChange={(event) => setContact((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="+1 000 000 0000" />
          </label>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us your preferred style, budget, occasion, timeline or ring size..." />
          <button className="support-send-btn" onClick={sendMessage}><Send size={15} /> Send to Designer</button>
        </section>
      ) : null}
      <button className="support-chat-toggle" onClick={() => setOpen((value) => !value)} aria-label="Contact a Designer">
        <MessageCircle size={22} />
        <span>Contact Designer</span>
      </button>
    </div>
  );
}

const initialFilters = {
  shape: "",
  caratMin: 1,
  caratMax: 7,
  priceMin: 900,
  priceMax: 9000,
  color: "",
  clarity: "",
  cut: "",
  certificate: "",
  polish: "",
  symmetry: "",
  depth: "",
  table: "",
  ratio: "",
  fluorescence: "",
  realPhoto: false,
  fast: false,
  sort: "popular"
};

const adminSeedProducts = [
  { id: "ER-PEAR-002", shape: "pear", carat: 2, color: "F", clarity: "VS2", cut: "Very Good", polish: "Excellent", symmetry: "Very Good", certificate: "IGI", fluorescence: "None", depth: "63.4%", table: "59%", ratio: "1.58", price: 3180, image: shapes.find((shape) => shape.key === "pear")?.image, images: [shapes.find((shape) => shape.key === "pear")?.image], variants: [{ carat: "2.00", material: "14K 白金", price: 3180 }, { carat: "2.50", material: "18K 白金", price: 3950 }, { carat: "3.00", material: "铂金", price: 5480 }], fast: true, realPhoto: true, createdAt: 25, sold: 34 },
  { id: "ER-EMERALD-003", shape: "emerald", carat: 2, color: "G", clarity: "VS1", cut: "Excellent", polish: "Very Good", symmetry: "Excellent", certificate: "GIA", fluorescence: "None", depth: "64.0%", table: "62%", ratio: "1.39", price: 3680, image: shapes.find((shape) => shape.key === "emerald")?.image, images: [shapes.find((shape) => shape.key === "emerald")?.image], variants: [{ carat: "2.00", material: "18K 白金", price: 3680 }, { carat: "3.00", material: "铂金", price: 5120 }, { carat: "4.00", material: "铂金", price: 6980 }], fast: true, realPhoto: true, createdAt: 24, sold: 28 },
  { id: "JW-EAR-002", shape: "round", carat: 0.5, color: "F", clarity: "VS2", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "Faint", depth: "62.1%", table: "57%", ratio: "1.00", price: 780, image: shapes.find((shape) => shape.key === "round")?.image, images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.50", material: "14K 白金", price: 780 }, { carat: "1.00", material: "18K 白金", price: 1180 }, { carat: "1.50", material: "铂金", price: 1880 }], fast: true, realPhoto: true, createdAt: 23, sold: 42 },
  { id: "CP-VINTAGE-002", shape: "round", carat: 0.2, color: "G", clarity: "VS2", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "62.0%", table: "58%", ratio: "1.00", price: 1280, image: shapes.find((shape) => shape.key === "round")?.image, images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.20", material: "18K 黄金", price: 1280 }, { carat: "0.30", material: "18K 黄金", price: 1580 }, { carat: "0.50", material: "铂金", price: 2180 }], fast: true, realPhoto: true, createdAt: 22, sold: 21 },
  { id: "WR-OVAL-002", shape: "oval", carat: 0.8, color: "F", clarity: "VS2", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "61.5%", table: "58%", ratio: "1.36", price: 1680, image: shapes.find((shape) => shape.key === "oval")?.image, images: [shapes.find((shape) => shape.key === "oval")?.image], variants: [{ carat: "0.80", material: "14K 白金", price: 1680 }, { carat: "1.20", material: "18K 白金", price: 2280 }, { carat: "1.80", material: "铂金", price: 3280 }], fast: true, realPhoto: true, createdAt: 21, sold: 19 }
];

const categorySeedProducts = [
  { id: "CP-CLASSIC-101", category: "couple", name: "经典素圈情侣对戒", shape: "round", carat: 0.1, color: "G", clarity: "VS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "62.0%", table: "58%", ratio: "1.00", price: 980, image: shapes.find((shape) => shape.key === "round")?.image, images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.10", material: "18K 白金", price: 980 }, { carat: "0.20", material: "铂金", price: 1280 }, { carat: "0.30", material: "18K 黄金", price: 1580 }], fast: true, realPhoto: true, createdAt: 31, sold: 66 },
  { id: "CP-DIAMOND-102", category: "couple", name: "半圈排钻情侣对戒", shape: "princess", carat: 0.35, color: "F", clarity: "VS2", cut: "Excellent", polish: "Excellent", symmetry: "Very Good", certificate: "IGI", fluorescence: "Faint", depth: "68.0%", table: "69%", ratio: "1.00", price: 1860, image: shapes.find((shape) => shape.key === "princess")?.image, images: [shapes.find((shape) => shape.key === "princess")?.image], variants: [{ carat: "0.25", material: "14K 白金", price: 1480 }, { carat: "0.35", material: "18K 白金", price: 1860 }, { carat: "0.50", material: "铂金", price: 2460 }], fast: true, realPhoto: true, createdAt: 32, sold: 51 },
  { id: "CP-MINIMAL-103", category: "couple", name: "极简窄款点钻对戒", shape: "round", carat: 0.18, color: "E", clarity: "VS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "GIA", fluorescence: "None", depth: "61.9%", table: "57%", ratio: "1.00", price: 1360, image: shapes.find((shape) => shape.key === "round")?.image, images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.10", material: "14K 黄金", price: 1080 }, { carat: "0.18", material: "18K 白金", price: 1360 }, { carat: "0.25", material: "铂金", price: 1760 }], fast: true, realPhoto: true, createdAt: 33, sold: 43 },
  { id: "CP-VINTAGE-104", category: "couple", name: "复古雕花情侣对戒", shape: "oval", carat: 0.3, color: "G", clarity: "VS2", cut: "Very Good", polish: "Excellent", symmetry: "Very Good", certificate: "IGI", fluorescence: "None", depth: "61.5%", table: "58%", ratio: "1.36", price: 1680, image: shapes.find((shape) => shape.key === "oval")?.image, images: [shapes.find((shape) => shape.key === "oval")?.image], variants: [{ carat: "0.20", material: "18K 黄金", price: 1380 }, { carat: "0.30", material: "玫瑰金", price: 1680 }, { carat: "0.50", material: "铂金", price: 2380 }], fast: true, realPhoto: true, createdAt: 34, sold: 37 },
  { id: "JW-STUD-201", category: "jewelry", name: "圆形培育钻石耳钉", shape: "round", carat: 0.5, color: "E", clarity: "VS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "62.1%", table: "57%", ratio: "1.00", price: 880, image: shapes.find((shape) => shape.key === "round")?.image, images: [shapes.find((shape) => shape.key === "round")?.image], variants: [{ carat: "0.30", material: "14K 白金", price: 680 }, { carat: "0.50", material: "18K 白金", price: 880 }, { carat: "1.00", material: "铂金", price: 1580 }], fast: true, realPhoto: true, createdAt: 35, sold: 72 },
  { id: "JW-NECK-202", category: "jewelry", name: "椭圆形单钻锁骨链", shape: "oval", carat: 0.8, color: "F", clarity: "VS2", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "Faint", depth: "61.6%", table: "58%", ratio: "1.38", price: 1280, image: shapes.find((shape) => shape.key === "oval")?.image, images: [shapes.find((shape) => shape.key === "oval")?.image], variants: [{ carat: "0.50", material: "14K 黄金", price: 980 }, { carat: "0.80", material: "18K 黄金", price: 1280 }, { carat: "1.20", material: "18K 白金", price: 1980 }], fast: true, realPhoto: true, createdAt: 36, sold: 58 },
  { id: "JW-BRACELET-203", category: "jewelry", name: "轻奢钻石细链手链", shape: "marquise", carat: 0.6, color: "G", clarity: "VS1", cut: "Very Good", polish: "Excellent", symmetry: "Very Good", certificate: "IGI", fluorescence: "None", depth: "60.6%", table: "57%", ratio: "1.90", price: 1180, image: shapes.find((shape) => shape.key === "marquise")?.image, images: [shapes.find((shape) => shape.key === "marquise")?.image], variants: [{ carat: "0.30", material: "14K 黄金", price: 820 }, { carat: "0.60", material: "18K 黄金", price: 1180 }, { carat: "1.00", material: "铂金", price: 1860 }], fast: true, realPhoto: true, createdAt: 37, sold: 46 },
  { id: "JW-PEAR-204", category: "jewelry", name: "水滴形钻石吊坠项链", shape: "pear", carat: 1, color: "E", clarity: "VS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "GIA", fluorescence: "None", depth: "63.2%", table: "59%", ratio: "1.55", price: 1880, image: shapes.find((shape) => shape.key === "pear")?.image, images: [shapes.find((shape) => shape.key === "pear")?.image], variants: [{ carat: "0.80", material: "18K 白金", price: 1560 }, { carat: "1.00", material: "铂金", price: 1880 }, { carat: "1.50", material: "铂金", price: 2680 }], fast: true, realPhoto: true, createdAt: 38, sold: 39 }
];

const initialFrontendProducts = [
  ...categorySeedProducts,
  ...adminSeedProducts,
  ...initialDiamonds.filter((diamond) => ![...categorySeedProducts, ...adminSeedProducts].some((product) => product.id === diamond.id))
];

export function App() {
  const [page, setPageState] = useState(() => pageFromPath(window.location.pathname));
  const [contentKey, setContentKey] = useState(() => contentKeyFromPath(window.location.pathname));
  const [blogSlug, setBlogSlug] = useState(() => blogSlugFromPath(window.location.pathname));
  const [filters, setFilters] = useState(initialFilters);
  const [diamonds, setDiamonds] = useState(() => mergeProductsById(initialFrontendProducts, readSharedFrontendProducts()));
  const [selectedId, setSelectedId] = useState(initialFrontendProducts[0].id);
  const [cart, setCart] = useState([]);
  const [serviceCount, setServiceCount] = useState(8659);
  const [socialLinks, setSocialLinks] = useState(() => readSocialLinks());
  const [blogPosts, setBlogPosts] = useState(() => readBlogPosts());
  const selectedProduct = diamonds.find((item) => item.id === selectedId) ?? diamonds[0];
  const activeBlogPost = blogSlug ? blogPosts.find((post) => (post.slug || slugify(post.title) || post.id) === blogSlug) : null;
  const syncProductFromPath = () => {
    const match = window.location.pathname.match(/^\/product\/([^/]+)/);
    if (match) {
      setSelectedId(decodeURIComponent(match[1]));
    }
  };
  const setPage = (nextPage, options = {}) => {
    if (options.contentKey) {
      setContentKey(options.contentKey);
    }
    if (nextPage === "blog") {
      setBlogSlug(options.blogSlug || "");
    }
    setPageState(nextPage);
    const path = options.productId
      ? `/product/${options.productId}`
      : options.blogSlug
        ? `/blog/${options.blogSlug}`
      : options.contentKey
        ? contentPaths[options.contentKey] ?? pageToPath.content
        : pageToPath[nextPage] ?? "/";
    if (window.location.pathname !== path) {
      window.history.pushState({ page: nextPage }, "", path);
    }
    if (!options.keepScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    syncProductFromPath();
    fetchStorefrontProducts()
      .then((remoteProducts) => {
        if (remoteProducts.length) {
          setDiamonds((items) => mergeProductsById(items, remoteProducts));
        }
      })
      .catch(() => {
        setDiamonds((items) => mergeProductsById(items, readSharedFrontendProducts()));
      });
    fetchBlogPosts()
      .then((remotePosts) => {
        if (remotePosts.length) {
          writeBlogPosts(remotePosts);
          setBlogPosts(remotePosts);
        }
      })
      .catch(() => {});
    const onSharedProducts = () => setDiamonds((items) => mergeProductsById(items, readSharedFrontendProducts()));
    window.addEventListener("storage", onSharedProducts);
    const onPopState = () => {
      setPageState(pageFromPath(window.location.pathname));
      setContentKey(contentKeyFromPath(window.location.pathname));
      setBlogSlug(blogSlugFromPath(window.location.pathname));
      syncProductFromPath();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("storage", onSharedProducts);
    };
  }, []);

  useEffect(() => {
    const refreshSiteSettings = () => {
      setSocialLinks(readSocialLinks());
      setBlogPosts(readBlogPosts());
    };
    window.addEventListener("storage", refreshSiteSettings);
    window.addEventListener("everastone-site-settings-updated", refreshSiteSettings);
    window.addEventListener("everastone-blog-updated", refreshSiteSettings);
    return () => {
      window.removeEventListener("storage", refreshSiteSettings);
      window.removeEventListener("everastone-site-settings-updated", refreshSiteSettings);
      window.removeEventListener("everastone-blog-updated", refreshSiteSettings);
    };
  }, []);

  useEffect(() => {
    const coreMeta = {
      home: {
        title: "Everastone | Bespoke Lab-Grown Diamond Engagement Rings Atelier",
        description: "Handcrafted ethical lab-grown diamond engagement rings & heirloom fine jewelry. Custom bespoke rings designed for your unique love story. Shop now."
      },
      diamonds: {
        title: "Lab-Grown Diamond Engagement Rings | Custom Bespoke Rings | Everastone",
        description: "Shop traceable ethical lab grown diamond engagement rings. Build your custom ring with round, oval, pear, emerald & fancy shape diamonds."
      },
      matching: {
        title: "Lab-Grown Diamond Couple Wedding Bands & Matching Rings | Everastone",
        description: "Shop matching couple wedding bands & diamond pair rings. Minimal, vintage & classic lab-grown diamond wedding rings for everyday wear."
      },
      designer: {
        title: "Designer Lab-Grown Diamond Rings | Limited Designer Edition | Everastone",
        description: "Explore our designer edition lab-grown diamond rings. Artfully crafted bespoke engagement rings with unique design language for your proposal."
      },
      bespoke: {
        title: "Create Your Bespoke Lab-Grown Diamond Ring | Everastone Atelier",
        description: "Design your own custom lab-grown diamond ring. Choose diamond shape, carat, metal & details. Ethical traceable stones, handcrafted fine jewelry."
      },
      story: {
        title: "Our Story | Everastone Lab-Grown Diamond Atelier",
        description: "Everastone creates ethical, traceable lab-grown diamond jewelry. Learn our mission to craft meaningful rings for your lifelong promise."
      }
    };
    const contentMetaMap = {
      couple: coreMeta.matching,
      coupleClassic: coreMeta.matching,
      coupleDiamond: coreMeta.matching,
      coupleMinimal: coreMeta.matching,
      coupleVintage: coreMeta.matching,
      designer: coreMeta.designer,
      custom: coreMeta.bespoke,
      customProcess: coreMeta.bespoke,
      customDiamond: coreMeta.bespoke,
      customSetting: coreMeta.bespoke,
      story: coreMeta.story,
      privacy: { title: "Privacy Policy | Everastone", description: "Read Everastone privacy practices for customer data, orders and online services." },
      terms: { title: "Terms of Service | Everastone", description: "Read Everastone terms of service for ordering, checkout, delivery and website use." },
      returns: { title: "Return Policy | Everastone", description: "Review Everastone return policy for eligible unworn jewelry and order support." },
      warranty: { title: "Warranty Policy | Everastone", description: "Review Everastone warranty policy for lab-grown diamond jewelry and after-sale service." }
    };
    const titleMap = {
      home: coreMeta.home.title,
      diamonds: coreMeta.diamonds.title,
      product: `${selectedProduct?.name ?? "Product Details"} | everastone`,
      cart: "Cart | everastone",
      checkout: "Secure Checkout | everastone",
      account: "My Account | everastone",
      blog: activeBlogPost ? (activeBlogPost.metaTitle || `${activeBlogPost.title} | everastone Blog`) : "Brand Blog | everastone",
      admin: "Admin | everastone",
      content: contentMetaMap[contentKey]?.title ?? "Brand Content | everastone"
    };
    const description = selectedProduct && page === "product"
      ? `${selectedProduct.name ?? shapeLabel(selectedProduct.shape)} supports secure PayPal checkout, a 10% first-order offer, and global air delivery.`
      : activeBlogPost && page === "blog"
        ? activeBlogPost.metaDescription || activeBlogPost.subtitle || activeBlogPost.cover
      : page === "content"
        ? contentMetaMap[contentKey]?.description || coreMeta.home.description
      : page === "diamonds"
        ? coreMeta.diamonds.description
      : page === "home"
        ? coreMeta.home.description
      : "everastone creates bespoke lab-grown diamond engagement rings, matching rings, and designer editions with online checkout, PayPal payment, and global delivery.";
    updateSeoMeta({ title: titleMap[page] ?? titleMap.home, description });
    const existingJsonLd = document.getElementById("product-json-ld");
    if (page === "product" && selectedProduct?.id) {
      const jsonLd = existingJsonLd ?? document.createElement("script");
      jsonLd.id = "product-json-ld";
      jsonLd.type = "application/ld+json";
      jsonLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: selectedProduct.name ?? `${shapeLabel(selectedProduct.shape)}培育钻石戒指`,
        image: getProductMedia(selectedProduct).images.slice(0, 6),
        description: selectedProduct.description ?? description,
        sku: selectedProduct.id,
        brand: { "@type": "Brand", name: "everastone" },
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          price: Number(selectedProduct.price ?? 0),
          availability: Number(selectedProduct.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: window.location.href
        }
      });
      if (!existingJsonLd) document.head.appendChild(jsonLd);
    } else if (existingJsonLd) {
      existingJsonLd.remove();
    }
    trackAnalyticsEvent({
      eventType: "page_view",
      pagePath: window.location.pathname,
      productId: page === "product" ? selectedProduct?.id : undefined,
      sessionId: getAnalyticsSessionId()
    }).catch(() => {});
    if (page === "product" && selectedProduct?.id) {
      trackAnalyticsEvent({
        eventType: "product_view",
        pagePath: window.location.pathname,
        productId: selectedProduct.id,
        sessionId: getAnalyticsSessionId(),
        metadata: { name: selectedProduct.name, price: selectedProduct.price }
      }).catch(() => {});
    }
  }, [page, contentKey, selectedProduct?.id, activeBlogPost?.id, activeBlogPost?.metaTitle, activeBlogPost?.metaDescription]);

  const openProduct = (id) => {
    setSelectedId(id);
    setPage("product", { productId: id });
  };

  const applyPreset = (preset) => {
    setFilters((current) => ({ ...current, shape: preset.shape, caratMin: preset.min, caratMax: preset.max }));
    setPage("diamonds");
  };

  const openContent = (nextContentKey) => {
    setPage("content", { contentKey: nextContentKey });
  };

  const addToCart = (product, metal, size) => {
    setCart((items) => [
      ...items,
      {
        cartId: `${product.id}-${metal}-${size}-${Date.now()}`,
        title: product.name ?? `${product.carat.toFixed(2)} ct ${shapeLabel(product.shape)} 培育钻石戒指`,
        price: product.price,
        image: getPrimaryProductImage(product),
        imageAlt: getProductImageAlt(product),
        imageTitle: product.imageTitle ?? "",
        metal,
        size,
        qty: 1
      }
    ]);
    trackAnalyticsEvent({
      eventType: "add_to_cart",
      pagePath: window.location.pathname,
      productId: product.id,
      sessionId: getAnalyticsSessionId(),
      metadata: { title: product.name ?? product.title, metal, size, price: product.price }
    }).catch(() => {});
  };
  const submitOrder = (count = 1) => {
    setServiceCount((current) => current + Math.max(1, Number(count) || 1));
  };

  return (
    <>
      {page !== "admin" ? <Header page={page} contentKey={contentKey} setPage={setPage} setFilters={setFilters} openContent={openContent} cartCount={cart.reduce((sum, item) => sum + item.qty, 0)} serviceCount={serviceCount} /> : null}
      {page === "home" ? <Home setPage={setPage} applyPreset={applyPreset} /> : null}
      {page === "diamonds" ? <FilterPage filters={filters} setFilters={setFilters} diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} /> : null}
      {page === "product" ? <ProductDetail product={selectedProduct} addToCart={addToCart} setPage={setPage} products={diamonds} openProduct={openProduct} /> : null}
      {page === "cart" ? <Cart cart={cart} setCart={setCart} setPage={setPage} /> : null}
      {page === "checkout" ? <Checkout cart={cart} onSubmitOrder={submitOrder} /> : null}
      {page === "account" ? <Account setPage={setPage} /> : null}
      {page === "blog" ? <BlogPage posts={blogPosts} diamonds={diamonds} openProduct={openProduct} blogSlug={blogSlug} setPage={setPage} /> : null}
      {page === "content" ? <ContentPage contentKey={contentKey} setPage={setPage} diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} /> : null}
      {page === "admin" ? <Admin diamonds={diamonds} setDiamonds={setDiamonds} socialLinks={socialLinks} setSocialLinks={setSocialLinks} blogPosts={blogPosts} setBlogPosts={setBlogPosts} /> : null}
      {page !== "admin" ? <Footer openContent={openContent} setPage={setPage} socialLinks={socialLinks} /> : null}
      {page !== "admin" ? <SupportChatWidget /> : null}
    </>
  );
}

