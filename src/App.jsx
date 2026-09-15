import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  CreditCard,
  Diamond,
  Heart,
  LayoutDashboard,
  Menu,
  PackagePlus,
  Plane,
  RotateCcw,
  Ruler,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X
} from "lucide-react";
import { addMyFavorite, capturePayPalOrder, createPayPalOrder, createStorefrontOrder, deleteMyAddress, deleteStorefrontProduct, fetchAdminAnalyticsSummary, fetchAdminOrders, fetchMyAddresses, fetchMyFavorites, fetchMyOrders, fetchStorefrontProducts, getAdminApiToken, lookupGuestOrders, saveMyAddress, saveStorefrontProduct, sendPasswordRecovery, setAdminApiToken, signInWithEmail, signUpWithEmail, trackAnalyticsEvent, updateAdminOrder, uploadProductImage } from "./api.js";
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
const ANALYTICS_SESSION_STORAGE_KEY = "everastone.analytics.sessionId";
const readSharedFrontendProducts = () => {
  try {
    const stored = window.localStorage.getItem(FRONTEND_PRODUCTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
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

const shapeLabel = (key) => shapes.find((shape) => shape.key === key)?.zh ?? key;
const shapeLabelEn = (key) => shapes.find((shape) => shape.key === key)?.label ?? key;
const shapeKeyFromLabel = (value) => shapes.find((shape) => shape.zh === value || shape.key === value)?.key ?? "round";
const materialImageGroups = [
  { key: "whiteGold", label: "铂金", keywords: ["白金", "white", "platinum", "铂金", "pt", "925"] },
  { key: "yellowGold", label: "黄金", keywords: ["黄金", "yellow"] },
  { key: "roseGold", label: "玫瑰金", keywords: ["玫瑰", "rose"] }
];
const mainMaterials = materialImageGroups.map((group) => group.label);
const materialPurities = ["10K", "11K", "12K", "13K", "14K", "15K", "16K", "17K", "18K", "铂金"];
const goldPurities = materialPurities.filter((purity) => purity !== "铂金");
const getPurityOptionsForMaterial = (material = "") => getMainMaterial(material) === "铂金" ? ["铂金"] : goldPurities;
const getMaterialImageGroup = (material = "") => {
  const normalized = String(material).toLowerCase();
  return materialImageGroups.find((group) => group.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())))?.key ?? "whiteGold";
};
const getMainMaterial = (material = "") => materialImageGroups.find((group) => group.key === getMaterialImageGroup(material))?.label ?? "铂金";
const getMaterialPurity = (material = "", purity = "") => {
  const mainMaterial = getMainMaterial(material);
  if (mainMaterial === "铂金") return "铂金";
  if (purity && String(purity) !== "铂金") return String(purity);
  const value = String(material);
  const match = value.match(/1[0-8]K/i);
  if (match) return match[0].toUpperCase();
  return "18K";
};
const normalizeProductVariant = (variant = {}, fallbackMaterial = "铂金", fallbackPrice = 0) => ({
  carat: String(variant.carat ?? "1.00"),
  material: getMainMaterial(variant.material ?? fallbackMaterial),
  purity: getMaterialPurity(variant.material ?? fallbackMaterial, variant.purity),
  price: variant.price ?? fallbackPrice
});
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
  if (Object.values(contentPaths).includes(pathname)) return "content";
  return "home";
};

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
    return <img className={active ? "shape-image active" : "shape-image"} src={shape.image} alt={`${shape.zh}培育钻石`} loading="lazy" />;
  }

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={active ? "shape-drawing active" : "shape-drawing"}>
      <path d={shape.path} />
    </svg>
  );
}

function Header({ page, setPage, setFilters, openContent, cartCount, serviceCount }) {
  const [scrolled, setScrolled] = useState(false);
  const [liveServiceCount, setLiveServiceCount] = useState(serviceCount);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("engagement");
  const openTarget = (target, shape, contentKey) => {
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

  return (
    <>
      <div className="brand-ticker" aria-label="品牌服务与优惠提示">
        <div className="brand-ticker-track">
          <span>{homeCopy.ticker[0].en(liveServiceCount)}</span>
          <span>{homeCopy.ticker[1].en}</span>
          <span>{homeCopy.ticker[2].en}</span>
          <span>{homeCopy.ticker[0].en(liveServiceCount)}</span>
        </div>
      </div>
      <header className={scrolled ? "site-header scrolled" : "site-header"}>
        <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="打开移动端菜单">
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
            <span className="nav-item" key={item.key}>
              <button className={page === item.target && ["home", "cart", "account"].includes(item.key) ? "active" : ""} onClick={() => openTarget(item.target, null, item.contentKey)}>
                {item.label}
                {item.count > 0 ? <span className="cart-dot">{item.count}</span> : null}
              </button>
              {item.mega ? (
                <span className="nav-menu">
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
          <button className="mobile-drawer-scrim" aria-label="关闭移动端菜单" onClick={() => setMobileMenuOpen(false)} />
          <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="移动端导航菜单">
            <div className="mobile-drawer-brand">
              <span className="brand-mark"><Diamond size={18} /></span>
          <span><strong>everastone</strong><small>Lab-grown diamond atelier</small></span>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单"><X size={18} /></button>
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
          [BadgeCheck, "IGI认证钻石"],
          [RotateCcw, "30 天轻松退换"],
          [Plane, "美国境内免运费"],
          [ShieldCheck, "一年保修"],
          [Ruler, "免费戒指尺寸调整"]
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
              <img src={shape.image} alt={`${shape.zh}培育钻石`} loading="lazy" />
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
        <p className="eyebrow">仅售实验室培育钻石</p>
        <h1>定制你的专属钻戒</h1>
        <p>全站无天然钻石切换，无天然钻石商品，无混合来源库存。</p>
      </section>

      <section className="shape-bar" aria-label="Diamond shape filter">
        <button className={!filters.shape ? "active" : ""} onClick={() => setValue("shape", "")}>
          <span className="shape-all-icon">ALL</span>
          <span>所有款式</span>
        </button>
        {catalogShapes.map((shape) => (
          <button key={shape.key} className={filters.shape === shape.key ? "active" : ""} onClick={() => setValue("shape", filters.shape === shape.key ? "" : shape.key)}>
            <ShapeIcon shape={shape} active={filters.shape === shape.key} />
            <span>{shape.zh}</span>
          </button>
        ))}
      </section>

      <section className="catalog-layout">
        <aside className="filters-panel">
          <div className="filter-block">
            <h3>克拉重量</h3>
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
            <h3>价格区间</h3>
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
            <label>颜色<select value={filters.color} onChange={(event) => setValue("color", event.target.value)}><option value="">全部</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>净度<select value={filters.clarity} onChange={(event) => setValue("clarity", event.target.value)}><option value="">全部</option>{clarities.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>

          <label className="check-row"><input type="checkbox" checked={filters.realPhoto} onChange={(event) => setValue("realPhoto", event.target.checked)} /> 仅展示带实拍图商品</label>
          <label className="check-row"><input type="checkbox" checked={filters.fast} onChange={(event) => setValue("fast", event.target.checked)} /> 快速发货商品</label>

          <button className="ghost-btn" onClick={() => setAdvancedOpen(!advancedOpen)}>
            高级筛选 <ChevronDown className={advancedOpen ? "rotated" : ""} size={16} />
          </button>
          {advancedOpen ? (
            <div className="advanced-grid">
              <label>切工<select value={filters.cut} onChange={(event) => setValue("cut", event.target.value)}><option value="">全部</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>证书<select value={filters.certificate} onChange={(event) => setValue("certificate", event.target.value)}><option value="">全部</option>{certificates.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>抛光<select value={filters.polish} onChange={(event) => setValue("polish", event.target.value)}><option value="">全部</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>对称<select value={filters.symmetry} onChange={(event) => setValue("symmetry", event.target.value)}><option value="">全部</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>荧光反应<select value={filters.fluorescence} onChange={(event) => setValue("fluorescence", event.target.value)}><option value="">全部</option>{fluorescence.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          ) : null}
          <button className="secondary-btn full" onClick={resetFilters}>重置全部筛选</button>
        </aside>

        <section className="results-area">
          <div className="results-toolbar">
            <span>找到 {filtered.length} 件培育钻石商品</span>
            <label>排序<select value={filters.sort} onChange={(event) => setValue("sort", event.target.value)}><option value="popular">热销优先</option><option value="price-asc">价格从低到高</option><option value="price-desc">价格从高到低</option><option value="new">新品优先</option></select></label>
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
  useEffect(() => {
    setMaterialGroup(getMaterialImageGroup(product.material));
  }, [product.id, product.material]);
  const availableGroups = getAvailableMaterialGroups(product);
  useEffect(() => {
    if (!availableGroups.some((group) => group.key === materialGroup)) {
      setMaterialGroup(availableGroups[0]?.key ?? "whiteGold");
    }
  }, [availableGroups, materialGroup]);
  const selectedGroup = availableGroups.find((group) => group.key === materialGroup) ?? availableGroups[0] ?? materialImageGroups[0];
  const cardImage = getProductMedia(product, selectedGroup.label).images?.[0] || getPrimaryProductImage(product);
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
      <img src={cardImage} alt={product.name ?? `${shapeLabel(product.shape)} 培育钻石商品`} loading="lazy" />
      <div>
        <span>{product.id}</span>
        <h3>{product.name ?? `${Number(product.carat).toFixed(2)} ct ${shapeLabel(product.shape)}`}</h3>
        <p>{Number(product.carat).toFixed(2)} ct · {product.color} 色级 · {product.clarity} 净度 · {product.certificate}</p>
        <div className="card-price-row">
          <strong>{money(product.price)}</strong>
          <button className="card-add-btn" type="button" onClick={quickAdd}>加购</button>
        </div>
      </div>
      <div className="card-material-swatches" aria-label="戒托材质预览">
        {availableGroups.map((group) => (
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
      purity: index % 3 === 0 ? "铂金" : `${14 + index}K`,
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
  const selectedMetalText = selectedVariant?.purity === "铂金" ? "铂金" : `${selectedVariant?.purity ?? "18K"} ${selectedVariant?.material ?? "铂金"}`;
  const estimatedArrival = formatArrivalDate(23);
  const imageCaption = product.imageCaption || `上传图片为 ${Number(product.carat || previewCarat).toFixed(2)}ct ${shapeLabel(product.shape)}实物图`;
  const productDescription = product.description || `这款${shapeLabel(product.shape)}培育钻石戒指以日常佩戴的舒适比例为基础，围绕主钻火彩、戒托线条与手型比例做整体设计。戒托可按材质与克拉数组合定制，适合订婚、纪念日和重要承诺场景。`;
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
    ["carat", "钻石克拉", "ct"],
    ["material", "戒托材质", ""],
    ["purity", "材质纯度", ""]
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
        setFavoriteNotice("请先到“我的”页面登录后再收藏商品。");
        return;
      }
      await addMyFavorite(accessToken, userId, product.id);
      setFavoriteNotice("已加入收藏，可在“我的 - 收藏商品”查看。");
    } catch (error) {
      setFavoriteNotice(error.message || "收藏失败，请稍后重试。");
    }
  };

  return (
    <main className="detail-page">
      <button className="text-link" onClick={() => setPage("diamonds")}>返回钻石列表</button>
      <section className="detail-layout">
        <div className="gallery">
          <div
            className="gallery-main"
            onPointerMove={handleGalleryMove}
            onClick={openMobileImage}
            style={{ "--zoom-x": `${zoomPosition.x}%`, "--zoom-y": `${zoomPosition.y}%` }}
          >
            <button className="gallery-nav prev" onClick={(event) => { event.stopPropagation(); changeImage(-1); }} aria-label="上一张商品图">‹</button>
            <img src={activeImage} alt={`${shapeLabel(product.shape)} lab grown diamond jewelry`} />
            <button className="gallery-nav next" onClick={(event) => { event.stopPropagation(); changeImage(1); }} aria-label="下一张商品图">›</button>
          </div>
          <p className="image-caption">{imageCaption}</p>
          <div className="thumb-carousel">
            {productImages.length > 4 ? <button className="thumb-page-btn" onClick={() => setThumbStart((start) => Math.max(0, start - 1))} disabled={thumbStart === 0} aria-label="上一组缩略图">‹</button> : null}
            <div className="thumb-row">
              {visibleThumbs.map((image, index) => {
                const imageIndex = thumbStart + index;
                return (
                  <button className={activeImageIndex === imageIndex ? "active" : ""} onClick={() => setActiveImageIndex(imageIndex)} key={`${image}-${imageIndex}`} aria-label={`查看商品图 ${imageIndex + 1}`}>
                    <img src={image} alt={`商品图 ${imageIndex + 1}`} />
                  </button>
                );
              })}
            </div>
            {productImages.length > 4 ? <button className="thumb-page-btn" onClick={() => setThumbStart((start) => Math.min(Math.max(0, productImages.length - 4), start + 1))} disabled={thumbStart >= productImages.length - 4} aria-label="下一组缩略图">›</button> : null}
          </div>
          {productMedia.videoUrls.length ? (
            <div className="product-video-list">
              {productMedia.videoUrls.map((url, index) => {
                const embedUrl = getYouTubeEmbedUrl(url);
                return embedUrl ? (
                  <iframe key={`${url}-${index}`} src={embedUrl} title={`商品视频 ${index + 1}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                ) : (
                  <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">查看商品视频 {index + 1}</a>
                );
              })}
            </div>
          ) : null}
          <div className={specsOpen ? "gallery-specs mobile-fold open" : "gallery-specs mobile-fold"}>
            <button className="fold-trigger" onClick={() => setSpecsOpen((open) => !open)} aria-expanded={specsOpen}>
              <span>钻石参数</span>
              <ChevronDown size={18} />
            </button>
            {specsOpen ? (
              <div className="spec-grid">
                {[
                  ["形状", shapeLabel(product.shape)],
                  ["克拉", selectedVariant?.carat ?? product.carat.toFixed(2)],
                  ["颜色", product.color],
                  ["净度", product.clarity],
                  ["切工", product.cut],
                  ["抛光", product.polish],
                  ["对称", product.symmetry],
                  ["证书", product.certificate],
                  ["荧光", product.fluorescence]
                ].map(([label, value]) => (
                  <div key={label}><span>{label}</span><strong>{value}</strong></div>
                ))}
              </div>
            ) : null}
          </div>
          <section className={descriptionOpen ? "product-description mobile-fold open" : "product-description mobile-fold"}>
            <button className="fold-trigger" onClick={() => setDescriptionOpen((open) => !open)} aria-expanded={descriptionOpen}>
              <span>商品简介</span>
              <ChevronDown size={18} />
            </button>
            {descriptionOpen ? <p>{productDescription}</p> : null}
          </section>
        </div>
        <div className="detail-info">
          <p className="eyebrow">认证实验室培育钻石</p>
          <h1>{product.name ?? `${product.carat.toFixed(2)} ct ${shapeLabel(product.shape)} 钻石戒指`}</h1>
          <p className="price">{money(displayPrice)}</p>
          <div className="first-order-offer">
            <span>首单专享 10% OFF</span>
            <strong>优惠后 {money(firstOrderPrice)}</strong>
          </div>
          <p className="live-viewers">正在有 {viewerCount} 人浏览商品</p>
          <div className="variant-picker">
            <h3>选择商品规格</h3>
            <div className="variant-picker-grid">
              {variantFields.map(([field, label, suffix]) => {
                const values = variantOptions[field]?.length ? variantOptions[field] : field === "purity" ? getPurityOptionsForMaterial(selectedVariant?.material) : [];
                const currentValue = values.includes(String(selectedVariant?.[field] ?? "")) ? String(selectedVariant?.[field] ?? "") : values[0];
                return <label key={field}>{label}<select value={currentValue} onChange={(event) => updateVariantField(field, event.target.value)}>{values.map((value) => <option value={value} key={value}>{value}{suffix}</option>)}</select></label>;
              })}
            </div>
            <strong className="variant-price">当前规格价格：{money(displayPrice)}</strong>
          </div>
          <div className="size-row">
            <label>尺码标准<select value={sizeType} onChange={(event) => { setSizeType(event.target.value); setSize(event.target.value === "US" ? usSizes[4] : ukSizes[4]); }}><option>US</option><option>UK</option></select></label>
            <label>戒指尺码<select value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <button className="size-chart-trigger" onClick={() => setSizeChartOpen(true)}>查看国际戒指尺码对照表</button>
          <div className="detail-actions purchase-actions" ref={purchaseActionsRef}>
            <button className="primary-btn" onClick={() => addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`)}>加入购物车</button>
            <button className="secondary-btn" onClick={() => { addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`); setPage("checkout"); }}>立即购买</button>
          </div>
          <button className="favorite-btn" onClick={saveFavorite}><Heart size={16} /> 收藏商品</button>
          {favoriteNotice ? <p className="checkout-notice">{favoriteNotice}</p> : null}
          <div className="delivery-note">
            <Truck size={16} />
            <span>标准制作约 15 天，因款式有 ±2 天波动；</span>
            <span>全球空运配送 3-6 天，预计 {estimatedArrival} 前后送达，可加急。</span>
          </div>
          {showTryOn ? <div className="try-on-tool">
            <div>
              <span className="eyebrow">上手效果演示</span>
              <h3>右手无名指试戴预览</h3>
              <p>按真实戒指佩戴位置模拟主钻大小，钻石轮廓会跟随当前商品形状变化。</p>
              <input type="range" min="0" max={variants.length - 1} value={variantIndex} onChange={(event) => setVariantIndex(Number(event.target.value))} />
              <strong>{selectedVariant?.carat}ct · {shapeLabel(product.shape)} · {money(displayPrice)}</strong>
            </div>
            <div className="hand-preview" aria-label="右手无名指钻戒试戴演示">
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
                  <img src={tryOnDiamondImage} alt={`${shapeLabel(product.shape)} ${previewCarat.toFixed(2)}ct 上手效果`} />
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
          <span>首单优惠后 {money(firstOrderPrice)}</span>
          <button className="primary-btn" onClick={() => addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`)}>加入购物车</button>
          <button className="secondary-btn" onClick={() => { addToCart({ ...product, price: firstOrderPrice, carat: Number(selectedVariant?.carat) || product.carat }, selectedMetalText, `${sizeType} ${size}`); setPage("checkout"); }}>立即购买</button>
        </div>
      ) : null}
      {sizeChartOpen ? (
        <div className="size-chart-modal-backdrop" role="presentation">
          <div className="size-chart-modal" role="dialog" aria-modal="true" aria-label="国际戒指尺码对照表">
            <div className="size-chart-modal-head">
              <div>
                <p className="eyebrow">Ring Size Guide</p>
                <h3>国际戒指尺码对照表</h3>
              </div>
              <button className="ghost-btn" onClick={() => setSizeChartOpen(false)}>关闭</button>
            </div>
            <div className="size-chart-table">
              <span>US</span><span>UK</span><span>内径 mm</span><span>周长 mm</span>
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
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="商品图片放大预览" onClick={() => setMobileImageOpen(false)}>
          <button className="ghost-btn" onClick={() => setMobileImageOpen(false)}>关闭</button>
          <img src={activeImage} alt={`${shapeLabel(product.shape)}商品放大图`} />
        </div>
      ) : null}
      <section className="section compact">
        <h2>猜你喜欢</h2>
        <div className="mini-grid recommended-grid">
          {recommendedProducts.map((item) => (
            <button className="recommend-card" onClick={() => openProduct(item.id)} key={item.id}>
              <img src={item.image} alt={item.name ?? `${shapeLabel(item.shape)}推荐商品`} />
              <span>{shapeLabel(item.shape)} · {Number(item.carat).toFixed(2)}ct</span>
              <strong>{item.name ?? `${shapeLabel(item.shape)}培育钻石戒指`}</strong>
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

  const updateQty = (id, qty) => setCart((items) => items.map((item) => item.cartId === id ? { ...item, qty: Math.max(1, qty) } : item));
  const removeItem = (id) => setCart((items) => items.filter((item) => item.cartId !== id));

  return (
    <main className="utility-page">
      <h1>购物车</h1>
      <div className="cart-layout">
        <section className="cart-list">
          {cart.length === 0 ? <p>购物车为空，可先挑选一颗培育钻石。</p> : cart.map((item) => (
            <article className="cart-item" key={item.cartId}>
              <img src={item.image} alt={item.title} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.metal} · {item.size}</p>
                <strong>{money(item.price)}</strong>
              </div>
              <input type="number" min="1" value={item.qty} onChange={(event) => updateQty(item.cartId, Number(event.target.value))} />
              <button className="text-link" onClick={() => removeItem(item.cartId)}>删除</button>
            </article>
          ))}
          {cart.length > 0 ? <button className="ghost-btn" onClick={() => setCart([])}>批量删除商品</button> : null}
        </section>
        <aside className="summary-panel">
          <h2>订单汇总</h2>
          <p><span>商品小计</span><strong>{money(subtotal)}</strong></p>
          <p><span>首单优惠 10%</span><strong>-{money(discount)}</strong></p>
          <p><span>预估税费</span><strong>{money(tax)}</strong></p>
          <p><span>保价运费</span><strong>{money(shipping)}</strong></p>
          <p className="summary-total"><span>合计</span><strong>{money(subtotal - discount + tax + shipping)}</strong></p>
          <button className="primary-btn full" disabled={!cart.length} onClick={() => setPage("checkout")}>去结算</button>
        </aside>
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
    country: "美国",
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
    if (!cart.length) return "购物车为空，请先添加商品。";
    if (!form.email || !form.email.includes("@") || !form.addressLine1 || !form.city || !form.postalCode) {
      return "请先填写邮箱、街道地址、城市和邮编。";
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
    setNotice("正在保存待付款订单...");
    try {
      const order = await createStorefrontOrder(buildCheckoutPayload());
      onSubmitOrder(cart.reduce((sum, item) => sum + item.qty, 0));
      setNotice(`订单已保存到数据库，订单号：${order.orderNumber || order.id}。当前支付状态：待付款。`);
    } catch (error) {
      setNotice(error.message || "订单提交失败，请稍后重试。");
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
            setNotice("正在创建 PayPal 支付订单...");
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
            setNotice("PayPal 已授权，正在确认付款...");
            const result = await capturePayPalOrder(data.orderID, localOrderRef.current?.id || localOrderRef.current?.orderNumber);
            trackAnalyticsEvent({
              eventType: "paypal_paid",
              pagePath: window.location.pathname,
              sessionId: getAnalyticsSessionId(),
              metadata: { orderId: result.order?.orderNumber || result.order?.id, total }
            }).catch(() => {});
            onSubmitOrder(cart.reduce((sum, item) => sum + item.qty, 0));
            setNotice(`付款成功，订单号：${result.order?.orderNumber || result.order?.id}，订单状态已更新为“已付款”。`);
            setSubmitting(false);
          },
          onCancel: () => {
            setSubmitting(false);
            setNotice("你已取消 PayPal 支付，订单仍为待付款。");
          },
          onError: (error) => {
            setSubmitting(false);
            setNotice(error?.message || "PayPal 支付失败，请稍后重试。");
          }
        }).render(paypalButtonsRef.current);
      })
      .catch((error) => {
        setPaypalReady(false);
        setNotice(error?.message || "PayPal 按钮加载失败，请检查 VITE_PAYPAL_CLIENT_ID。");
      });
    return () => {
      cancelled = true;
      if (paypalButtonsRef.current) paypalButtonsRef.current.innerHTML = "";
    };
  }, [cart, form, subtotal, discount, tax, shipping, total]);

  return (
    <main className="utility-page">
      <h1>安全结算</h1>
      <form className="checkout-grid">
        <section>
          <h2>收货地址</h2>
          <div className="form-grid">
            <input placeholder="名" value={form.firstName} onChange={(event) => updateForm("firstName", event.target.value)} />
            <input placeholder="姓" value={form.lastName} onChange={(event) => updateForm("lastName", event.target.value)} />
            <input placeholder="邮箱" type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
            <select value={form.country} onChange={(event) => updateForm("country", event.target.value)}><option>美国</option><option>英国</option></select>
            <input placeholder="街道地址" className="wide" value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} />
            <input placeholder="公寓、套房、门牌号" className="wide" value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} />
            <input placeholder="城市" value={form.city} onChange={(event) => updateForm("city", event.target.value)} />
            <input placeholder="州 / 郡" value={form.state} onChange={(event) => updateForm("state", event.target.value)} />
            <input placeholder="邮编" value={form.postalCode} onChange={(event) => updateForm("postalCode", event.target.value)} />
            <input placeholder="电话" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
          </div>
        </section>
        <section>
          <h2>PayPal 安全支付</h2>
          <div className="payment-placeholder">
            <CreditCard />
            <p>点击 PayPal 后会先保存订单，再进入 PayPal 支付；支付成功后订单会自动更新为“已付款”。</p>
          </div>
          <div className="summary-panel checkout-summary">
            <p><span>商品小计</span><strong>{money(subtotal)}</strong></p>
            <p><span>首单优惠 10%</span><strong>-{money(discount)}</strong></p>
            <p><span>预估税费</span><strong>{money(tax)}</strong></p>
            <p><span>保价运费</span><strong>{money(shipping)}</strong></p>
            <p className="summary-total"><span>合计</span><strong>{money(total)}</strong></p>
          </div>
          <label className="check-row"><input type="checkbox" /> 我同意订单加密处理与隐私条款。</label>
          {import.meta.env.VITE_PAYPAL_CLIENT_ID ? (
            <div className={paypalReady ? "paypal-button-box ready" : "paypal-button-box"} ref={paypalButtonsRef} />
          ) : (
            <p className="checkout-notice">请先在 Vercel 前端环境变量填写 VITE_PAYPAL_CLIENT_ID，PayPal 按钮才会显示。</p>
          )}
          <button className="ghost-btn full" type="button" disabled={!cart.length || submitting} onClick={submitOrder}>{submitting ? "保存中..." : "仅保存待付款订单"}</button>
          {notice ? <p className="checkout-notice">{notice}</p> : null}
        </section>
      </form>
    </main>
  );
}

const contentPages = {
  couple: {
    eyebrow: "COUPLE RINGS",
    title: "情侣对戒",
    intro: "为两个人的日常佩戴设计，比例克制、舒适耐看，用一对戒指记录专属印记。",
    cards: [["素圈婚戒", "简洁线条与舒适内弧，适合长期佩戴。"], ["带钻对戒", "小颗培育钻石点缀，低调但有纪念感。"], ["极简窄款对戒", "轻盈窄戒宽，适合喜欢克制高级风格的情侣。"], ["复古雕花对戒", "细腻雕花与金属纹理，带有故事感与仪式感。"]]
  },
  coupleClassic: { eyebrow: "CLASSIC BANDS", title: "素圈婚戒", intro: "干净的金属线条与舒适佩戴体验，适合婚后每天佩戴。", cards: [["18K 白金素圈", "冷调高级，适合极简风格。"], ["铂金经典素圈", "稳重耐久，适合长期佩戴。"], ["玫瑰金素圈", "柔和温暖，更具亲密感。"]] },
  coupleDiamond: { eyebrow: "DIAMOND PAIRS", title: "带钻对戒", intro: "用小颗培育钻石增加光泽，日常佩戴不夸张。", cards: [["单颗点钻", "一颗小钻作为两人印记。"], ["半圈排钻", "光泽更明显，仍保持克制。"], ["隐藏钻设计", "内侧或侧边隐藏钻，低调浪漫。"]] },
  coupleMinimal: { eyebrow: "MINIMAL SLIM", title: "极简窄款对戒", intro: "更轻盈的戒宽和干净比例，适合年轻、现代的佩戴审美。", cards: [["细窄素圈", "佩戴存在感轻，适合叠戴。"], ["细窄点钻", "微光点缀，简洁耐看。"], ["情侣刻字", "支持英文缩写、日期与短句。"]] },
  coupleVintage: { eyebrow: "VINTAGE ENGRAVED", title: "复古雕花对戒", intro: "通过雕刻纹理、边缘珠边与复古比例表达更强的故事感。", cards: [["麦穗纹", "象征陪伴与丰盛。"], ["珠边雕刻", "经典复古细节。"], ["旧金质感", "柔和金属光泽，不刺眼。"]] },
  designer: { eyebrow: "DESIGNER EDITION", title: "设计师款式", intro: "以黑金视觉呈现本期原创设计，精选 3–5 款更有辨识度的培育钻石戒指，可查看详情或直接购买。", cards: [] },
  custom: { eyebrow: "BESPOKE RINGS", title: "定制戒指", intro: "从主钻选择、戒托设计到制作交付，打造只属于你的培育钻石戒指。", cards: [["定制流程介绍", "了解从沟通到交付的完整步骤。"], ["主钻选择入口", "按形状、克拉、颜色、净度筛选培育钻石。"], ["戒托定制入口", "选择材质、镶嵌方式、戒圈尺寸与细节。"]] },
  customProcess: { eyebrow: "CUSTOM PROCESS", title: "定制流程介绍", intro: "三步完成专属定制：选主钻、设计戒托、制作并保价配送。", cards: [["01 选择主钻", "确认形状、克拉、颜色、净度与证书。"], ["02 设计戒托", "选择金属材质、镶嵌方式与佩戴比例。"], ["03 制作交付", "按订单制作，多重质检后提供保价配送服务。"]] },
  customDiamond: { eyebrow: "CHOOSE DIAMOND", title: "主钻选择入口", intro: "进入培育钻石筛选页，按 10 种形状与完整钻石参数挑选主石。", cards: [["圆形 / 椭圆 / 水滴", "热门订婚钻戒主钻形状。"], ["颜色与净度", "支持 D-M、FL-I1 等级筛选。"], ["证书与比例", "切工、抛光、对称、荧光等同后台维护。"]], cta: "进入钻石筛选" },
  customSetting: { eyebrow: "CHOOSE SETTING", title: "戒托定制入口", intro: "确认材质、镶嵌类型、戒圈尺寸与佩戴细节。", cards: [["材质选择", "14K/18K 白金、黄金、玫瑰金、铂金。"], ["镶嵌类型", "单钻、围镶、密镶、三石、复古。"], ["尺码标准", "支持美码与英码。"]] },
  story: {
    eyebrow: "BRAND STORY",
    title: "Crafted for Love, Built for Eternity",
    intro: "Everastone believes a diamond’s true value is found in the sincerity, promise and emotional meaning behind every love story.",
    cards: []
  },
  popularOval: { eyebrow: "POPULAR DIAMOND", title: "2 克拉椭圆主钻", intro: "椭圆形在视觉上更显修长，是海外订婚戒指的热门选择。", cards: [["推荐克拉", "2.00–2.50ct"], ["推荐搭配", "单钻或隐藏光环戒托"], ["视觉特点", "显大、修长、温柔。"]] },
  popularRound: { eyebrow: "POPULAR DIAMOND", title: "1.5 克拉圆形主钻", intro: "圆形明亮式切割经典耐看，火彩表现稳定。", cards: [["推荐克拉", "1.50–2.00ct"], ["推荐搭配", "六爪单钻或密镶戒臂"], ["视觉特点", "经典、闪耀、保守安全。"]] },
  popularPear: { eyebrow: "POPULAR DIAMOND", title: "2.5 克拉水滴主钻", intro: "水滴形有明显方向感，适合追求独特轮廓的求婚戒指。", cards: [["推荐克拉", "2.50–3.00ct"], ["推荐搭配", "围镶或细戒臂"], ["视觉特点", "优雅、显长、辨识度强。"]] },
  popularEmerald: { eyebrow: "POPULAR DIAMOND", title: "3 克拉祖母绿主钻", intro: "阶梯切割更强调通透感与净度，气质稳重高级。", cards: [["推荐克拉", "3.00ct 左右"], ["推荐搭配", "三石或铂金戒托"], ["视觉特点", "冷静、通透、贵气。"]] },
  settingSolitaire: { eyebrow: "SETTING TYPE", title: "单钻款", intro: "突出主钻本身，适合极简、高级、经典的订婚戒指。", cards: [["四爪", "更轻盈，露出更多主钻。"], ["六爪", "经典稳定，适合圆钻。"], ["隐藏光环", "正面低调，侧面更闪。"]] },
  settingHalo: { eyebrow: "SETTING TYPE", title: "围镶款", intro: "主钻外圈增加细钻，视觉更显大、更华丽。", cards: [["圆形围镶", "甜美经典。"], ["椭圆围镶", "显大且修长。"], ["复古围镶", "更有故事感。"]] },
  settingPave: { eyebrow: "SETTING TYPE", title: "密镶款", intro: "戒臂铺设小钻，增加整体闪耀度。", cards: [["半圈密镶", "兼顾舒适和闪耀。"], ["细戒臂密镶", "更轻盈。"], ["双排密镶", "更华丽。"]] },
  settingThreeStone: { eyebrow: "SETTING TYPE", title: "三石款", intro: "三颗主石象征过去、现在与未来，纪念意义更强。", cards: [["祖母绿三石", "稳重高级。"], ["椭圆三石", "柔和显大。"], ["水滴侧石", "线条更优雅。"]] },
  settingVintage: { eyebrow: "SETTING TYPE", title: "复古款", intro: "通过雕花、珠边、老欧洲比例表达更强的仪式感。", cards: [["珠边细节", "复古精致。"], ["雕花戒臂", "更有手工感。"], ["旧金属光泽", "温润不浮夸。"]] },
  shipping: {
    eyebrow: "SHIPPING POLICY",
    title: "配送政策",
    intro: "everastone 按订单制作并质检后发货。标准制作约 15 天，因款式有 ±2 天波动；全球空运配送约 3–6 天，可联系客服咨询加急。",
    cards: [
      ["制作周期", "标准制作周期约 15 天，不同戒托、刻字、特殊定制和质检情况可能提前或延后约 2 天。"],
      ["配送方式", "订单默认使用可追踪空运配送，并按订单价值安排保价；特殊地区可联系客服确认。"],
      ["预计送达", `系统按当前日期自动估算约 ${formatArrivalDate(23)} 前后送达，实际时间以制作进度、物流清关和当地派送为准。`],
      ["物流通知", "订单发货后会更新物流单号，并可通过账户订单或邮箱通知查看配送进度。"],
      ["加急服务", "如求婚日期临近，请下单前联系定制师确认是否可加急制作与配送。"]
    ],
    cta: "返回选购订婚戒指"
  },
  returns: {
    eyebrow: "RETURN POLICY",
    title: "退换货政策",
    intro: "我们希望每一枚戒指都能安心佩戴。符合条件的未佩戴现货商品支持 30 天退换；定制、刻字、改圈和特殊规格商品需按实际情况审核。",
    cards: [
      ["可退换范围", "未佩戴、未损坏、包装和证书齐全的标准商品，可在签收后 30 天内联系客服申请。"],
      ["不适用范围", "已刻字、特殊定制、明显佩戴痕迹、损坏、证书或包装缺失的商品，通常不支持无理由退换。"],
      ["退款流程", "通过订单号和邮箱提交申请，客服确认后安排寄回质检；质检通过后按原支付方式退款。"],
      ["退款周期", "退款发起后，到账时间取决于 PayPal 与发卡行处理周期。"],
      ["售后支持", "如戒指尺寸不合适、物流异常或商品到达后存在问题，请优先联系客服处理。"]
    ],
    cta: "返回选购订婚戒指"
  },
  warranty: {
    eyebrow: "WARRANTY POLICY",
    title: "保修政策",
    intro: "在 everastone，我们承诺以精心设计、量身定制的精美珠宝伴您一生，直至永恒。我们对产品质量充满信心，并在发生意外时与您携手解决。",
    cards: [
      ["一年质量保修", "所有订单均享有一年保修期，涵盖制造缺陷，包括松动的爪子、装饰石脱落及电镀变色。"],
      ["副石遗失", "保修期内如副石遗失，我们将免费寄送一颗符合原规格的替换石。您可选择在当地珠宝商处镶嵌并凭收据报销，最高 100 美元；也可将戒指寄回售后服务中心处理。"],
      ["首次尺寸调整", "一年保修期内首次尺寸调整免费，支持美码 ±0.5 个尺码。超过此范围通常需要重新制作，不属于免费调整范围。"],
      ["尺寸调整费用", "调整后的目标尺寸高于美国 11 号时，需额外支付 150 美元。保修期过后或首次调整之外的再次调整，将按实际服务报价。"],
      ["如何办理", "可将戒指寄送至售后服务地址，或在当地珠宝商处调整后提交收据报销，尺寸调整报销上限为 50 美元。无论选择哪种方式，原保修权益仍然有效。申请修改尺寸或退款时，请同时提供订单信息、收据及调整后的戒指照片。"],
      ["免责声明与联系", "本保修条款不涵盖主石的丢失或损坏；人为或外部因素造成的损坏不属于制造缺陷。需要帮助时请联系 support@everastone.com（正式上线前请替换为实际客服邮箱）。"]
    ],
    cta: "返回选购订婚戒指"
  },
  terms: {
    eyebrow: "TERMS OF SERVICE",
    title: "服务条款",
    intro: "访问和购买 everastone 商品，即表示你理解并接受商品展示、定制沟通、在线支付、订单制作、物流配送和售后服务的相关规则。",
    cards: [
      ["商品信息", "商品图片、克拉、材质、规格和价格以页面展示及后台最终确认为准；天然拍摄光线可能造成轻微色差。"],
      ["订单确认", "提交订单并完成支付后，我们会按所选规格进入备货或制作流程；如库存或定制条件异常，会主动联系确认。"],
      ["价格与优惠", "首单 10% 优惠以结算页显示为准，不同活动不可保证叠加使用。"],
      ["支付安全", "在线支付由 PayPal 等第三方支付服务完成，我们不在前端保存完整银行卡信息。"],
      ["定制服务", "定制戒指需通过定制师确认需求、预算、设计和生产周期；最终交付以确认后的设计方案为准。"],
      ["责任限制", "因不可控物流、清关、支付机构或网络服务异常造成的延迟，我们会协助处理但无法完全控制第三方时效。"]
    ],
    cta: "返回选购订婚戒指"
  },
  privacy: {
    eyebrow: "PRIVACY POLICY",
    title: "隐私条款",
    intro: "everastone 重视客户隐私。我们仅为商品咨询、订单处理、支付核验、物流配送、售后服务与安全风控收集必要信息。",
    cards: [
      ["我们收集的信息", "包括姓名、联系方式、收货地址、订单商品、定制需求、支付状态、客服沟通记录以及你主动上传的参考图片。"],
      ["信息使用方式", "用于确认订单、安排定制、提供物流、处理退换售后、改进网站体验，并在必要时完成安全验证。"],
      ["支付与第三方服务", "在线支付由第三方支付服务处理，我们不在网站前端保存完整银行卡信息。物流、邮件与云存储服务仅接收完成服务所需的信息。"],
      ["图片与定制资料", "你上传的商品图、定制参考图或聊天截图仅用于当前定制沟通、订单生产和售后核对，不会未经允许用于公开宣传。"],
      ["数据保护", "后台管理接口使用权限控制，生产环境密钥不公开在前端。我们会尽合理商业措施保护客户资料安全。"],
      ["用户权利", "你可以联系客服请求查看、修正或删除与订单无关的个人信息；涉及已完成订单、财务与物流记录的信息会按合规要求保留必要期限。"]
    ],
    cta: "返回选购订婚戒指"
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
  const designerProducts = diamonds
    .filter((product) => ["engagement", "wedding", "couple"].includes(product.category))
    .slice(0, 5);
  const featuredProducts = designerProducts.length ? designerProducts : diamonds.slice(0, 5);
  const quickBuy = (product) => {
    const variant = normalizeProductVariant(product.variants?.[0], product);
    addToCart?.({ ...product, price: variant.price ?? product.price }, `${getMainMaterial(variant.material)} · ${variant.purity}`, "US 6");
  };

  return (
    <main className="designer-page">
      <section className="designer-hero">
        <p className="eyebrow">DESIGNER EDITION</p>
        <h1>设计师款式</h1>
        <p>本期主题「赤金星轨」：用黑金对比突出培育钻石的火彩，以一抹红色表达订婚戒指的情绪张力。</p>
      </section>
      <section className="designer-track" aria-label="设计师款式商品">
        {featuredProducts.slice(0, 5).map((product, index) => {
          const variant = normalizeProductVariant(product.variants?.[0], product);
          return (
            <article className="designer-product-card" key={product.id}>
              <span className="designer-index">0{index + 1}</span>
              <img src={getPrimaryProductImage(product)} alt={product.name} loading="lazy" />
              <div>
                <p className="designer-tag">{Number(product.carat).toFixed(2)}ct · {shapeLabel(product.shape)}</p>
                <h2>{product.name ?? `${shapeLabel(product.shape)}设计师钻戒`}</h2>
                <p>设计语言：利落戒臂、主钻高位显光，适合偏高级、纪念感强的订婚场景。</p>
                <strong>{money(variant.price ?? product.price)}</strong>
                <div className="designer-card-actions">
                  <button className="gold-btn" onClick={() => openProduct(product.id)}>查看详情</button>
                  <button className="redline-btn" onClick={() => quickBuy(product)}>直接购买</button>
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
              <img src={getPrimaryProductImage(product)} alt={`${shapeLabelEn(product.shape)} lab-grown diamond ring`} loading="lazy" />
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
        <h1>Your Bespoke Ring Timeline</h1>
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
          <div className="content-products-main">
            {needsFilters ? <div className="content-filter-bar">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索商品" />
              <select value={shapeFilter} onChange={(event) => setShapeFilter(event.target.value)}>
                <option value="">全部形状</option>
                {shapes.map((shape) => <option value={shape.key} key={shape.key}>{shape.zh}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="popular">热销优先</option>
                <option value="price">价格从低到高</option>
                <option value="new">新品优先</option>
              </select>
            </div> : null}
            <div className="results-toolbar">
              <span>{needsFilters ? "筛选结果" : "商品列表"} · {contentProducts.length} 件</span>
            </div>
            {contentProducts.length ? <div className="product-grid">
              {contentProducts.map((product) => (
                <ProductCard product={product} openProduct={openProduct} addToCart={addToCart} key={product.id} />
              ))}
            </div> : <p className="content-empty">暂无符合条件的商品，请调整筛选条件。</p>}
          </div>
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
  const [notice, setNotice] = useState("请选择一个功能查看详情。");
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
  const normalizeCustomerOrder = (order = {}) => ({
    id: order.orderNumber || order.order_number || order.id,
    orderStatus: order.orderStatus || order.order_status || order.status || "待付款",
    paymentStatus: order.paymentStatus || order.payment_status || "待付款",
    amount: Number(order.amount ?? order.order_amount ?? order.total) || 0,
    items: Array.isArray(order.items) ? order.items : [],
    trackingNumber: order.trackingNumber || order.tracking_number || order.logistics_no || "",
    logisticsProvider: order.logisticsProvider || order.logistics_provider || "",
    orderedAt: order.orderedAt || order.ordered_at || order.created_at
  });
  const loadAccountData = async (session = authSession) => {
    if (!session?.access_token) return;
    setNotice("正在同步账号数据...");
    try {
      const [ordersData, favoritesData, addressesData] = await Promise.all([
        fetchMyOrders(session.access_token),
        fetchMyFavorites(session.access_token),
        fetchMyAddresses(session.access_token)
      ]);
      setAccountOrders((ordersData ?? []).map(normalizeCustomerOrder));
      setFavorites(Array.isArray(favoritesData) ? favoritesData : []);
      setAddresses(Array.isArray(addressesData) ? addressesData : []);
      setNotice("账号数据已同步。");
    } catch (error) {
      setNotice(error.message || "账号数据同步失败。");
    }
  };
  const saveSession = (session) => {
    setAuthSession(session);
    window.localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
  };
  const submitAuth = async () => {
    if (!authForm.email || !authForm.password) {
      setNotice("请输入邮箱和密码。");
      return;
    }
    setNotice(authMode === "register" ? "正在注册..." : "正在登录...");
    try {
      const payload = authMode === "register"
        ? await signUpWithEmail(authForm.email, authForm.password)
        : await signInWithEmail(authForm.email, authForm.password);
      const session = payload.access_token ? payload : payload.session;
      if (session?.access_token) {
        saveSession(session);
        await loadAccountData(session);
        setNotice(authMode === "register" ? "注册成功，已登录。" : "登录成功。");
      } else {
        setNotice("注册已提交，请查看邮箱完成验证后再登录。");
      }
    } catch (error) {
      setNotice(error.message || "账号操作失败，请稍后重试。");
    }
  };
  const recoverPassword = async () => {
    if (!authForm.email || !authForm.email.includes("@")) {
      setNotice("请输入需要找回密码的邮箱。");
      return;
    }
    try {
      await sendPasswordRecovery(authForm.email);
      setNotice("找回密码邮件已发送，请查看邮箱。");
    } catch (error) {
      setNotice(error.message || "找回密码邮件发送失败。");
    }
  };
  const logout = () => {
    window.localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setAuthSession(null);
    setAccountOrders([]);
    setFavorites([]);
    setAddresses([]);
    setNotice("已退出登录。");
  };
  const submitAddress = async () => {
    if (!accessToken || !currentUser?.id) {
      setNotice("请先登录后再保存地址。");
      return;
    }
    if (!addressDraft.recipient_name || !addressDraft.address_line1 || !addressDraft.city) {
      setNotice("请至少填写收件人、街道地址和城市。");
      return;
    }
    try {
      await saveMyAddress(accessToken, { ...addressDraft, user_id: currentUser.id });
      setAddressDraft({ recipient_name: "", phone: "", country: "United States", state: "", city: "", postal_code: "", address_line1: "", address_line2: "", is_default: false });
      await loadAccountData();
      setNotice("地址已保存。");
    } catch (error) {
      setNotice(error.message || "地址保存失败。");
    }
  };
  const removeAddress = async (id) => {
    try {
      await deleteMyAddress(accessToken, id);
      setAddresses((items) => items.filter((item) => item.id !== id));
      setNotice("地址已删除。");
    } catch (error) {
      setNotice(error.message || "地址删除失败。");
    }
  };
  useEffect(() => {
    if (authSession?.access_token) loadAccountData(authSession);
  }, []);
  const searchGuestOrders = async () => {
    if (!guestEmail || !guestEmail.includes("@")) {
      setNotice("请输入下单时使用的邮箱。");
      return;
    }
    setGuestLookupLoading(true);
    setNotice("正在查询订单...");
    try {
      const orders = await lookupGuestOrders(guestEmail);
      setGuestOrders(orders);
      setNotice(orders.length ? `找到 ${orders.length} 个订单。` : "没有查询到该邮箱的订单。");
    } catch (error) {
      setNotice(error.message || "订单查询失败，请稍后重试。");
    } finally {
      setGuestLookupLoading(false);
    }
  };
  const panels = {
    orders: {
      title: "历史订单",
      text: "查看全部订婚戒指、婚戒与珠宝订单。",
      rows: ["HS20260913001 · 定制生产中 · $4,860", "HS20260912008 · 已付款待确认 · $2,980", "HS20260911003 · 已发货 · DHL 92838102"],
      actions: [["查看订单详情", "已打开最近订单详情"], ["申请售后", "售后申请入口已打开"], ["再次购买", "已跳转商品列表"]]
    },
    favorites: {
      title: "收藏钻石",
      text: "保存喜欢的培育钻石主石与戒托款式。",
      rows: ["2.18ct 椭圆形 · E / VS1 · IGI", "1.74ct 圆形 · D / VVS2 · GIA", "水滴形光环戒托方案"],
      actions: [["查看收藏", "收藏列表已展开"], ["移除选中收藏", "已模拟移除收藏"], ["继续挑选", "已跳转商品列表"]]
    },
    plans: {
      title: "定制方案",
      text: "查看已保存的材质、尺码与主石组合。",
      rows: ["方案 A · 椭圆形 2ct · 18K 白金 · US 6", "方案 B · 水滴形 2.5ct · 铂金 · US 5.5", "方案 C · 圆形 1.5ct · 14K 黄金 · UK L"],
      actions: [["编辑方案", "定制方案编辑面板已打开"], ["复制方案", "已复制当前方案"], ["进入定制", "已跳转定制页面"]]
    },
    addresses: {
      title: "地址管理",
      text: "管理常用收货地址与默认配送信息。",
      rows: ["Olivia · New York, United States · 默认地址", "Emma · London, United Kingdom", "Mia · Austin, United States"],
      actions: [["新增地址", "新增地址表单已打开"], ["编辑地址", "地址编辑面板已打开"], ["设为默认", "已设置默认地址"]]
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
    <main className="utility-page">
      <h1>个人中心</h1>
      <section className="auth-panel">
        {authSession ? (
          <div className="auth-signed-in">
            <div>
              <p className="eyebrow">SIGNED IN</p>
              <h2>{authSession.user?.email}</h2>
              <p>已登录账号，可查看订单、收藏商品和管理地址。</p>
            </div>
            <button className="secondary-btn" onClick={logout}>退出登录</button>
          </div>
        ) : (
          <div className="auth-box">
            <div>
              <p className="eyebrow">EMAIL ACCOUNT</p>
              <h2>{authMode === "register" ? "邮箱注册" : "邮箱登录"}</h2>
              <p>游客仍可下单；登录后可长期保存订单、收藏和地址。</p>
            </div>
            <div className="auth-form">
              <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} placeholder="邮箱" />
              <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} placeholder="密码" />
              <button className="primary-btn" onClick={submitAuth}>{authMode === "register" ? "注册" : "登录"}</button>
              <button className="secondary-btn" onClick={() => setAuthMode((mode) => mode === "register" ? "login" : "register")}>{authMode === "register" ? "已有账号，去登录" : "没有账号，去注册"}</button>
              <button className="text-link" onClick={recoverPassword}>找回密码</button>
            </div>
          </div>
        )}
      </section>
      <div className="account-grid">
        {cards.map(([Icon, key]) => (
          <button className={activePanel === key ? "account-card active" : "account-card"} key={key} onClick={() => { setActivePanel(key); setNotice(`已打开：${panels[key].title}`); }}>
            <Icon />
            <h3>{panels[key].title}</h3>
            <p>{panels[key].text}</p>
          </button>
        ))}
      </div>
      <section className="account-panel">
        <div>
          <p className="eyebrow">ACCOUNT CENTER</p>
          <h2>{active.title}</h2>
          <p>{notice}</p>
        </div>
        {activePanel === "orders" ? (
          <div className="guest-order-lookup">
            {authSession ? (
              <div className="guest-order-list">
                {(accountOrders.length ? accountOrders : []).map((order) => (
                  <article className="guest-order-card" key={order.id}>
                    <div><span>订单号</span><strong>{order.id}</strong></div>
                    <div><span>订单状态</span><strong>{order.orderStatus}</strong></div>
                    <div><span>支付状态</span><strong>{order.paymentStatus}</strong></div>
                    <div><span>订单金额</span><strong>{money(order.amount)}</strong></div>
                    <p>{(order.items ?? []).map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""}`).join("；") || "暂无商品明细"}</p>
                    {order.trackingNumber ? <p>物流：{order.logisticsProvider} {order.trackingNumber}</p> : <p>物流：等待发货</p>}
                  </article>
                ))}
                {!accountOrders.length ? <p>当前账号暂无订单。</p> : null}
              </div>
            ) : null}
            <div className="guest-order-form">
              <input type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="输入下单邮箱查询订单" />
              <button className="primary-btn" disabled={guestLookupLoading} onClick={searchGuestOrders}>{guestLookupLoading ? "查询中..." : "查询订单"}</button>
            </div>
            <div className="guest-order-list">
              {guestOrders.map((order) => (
                <article className="guest-order-card" key={order.id}>
                  <div>
                    <span>订单号</span>
                    <strong>{order.orderNumber || order.id}</strong>
                  </div>
                  <div>
                    <span>订单状态</span>
                    <strong>{order.orderStatus}</strong>
                  </div>
                  <div>
                    <span>支付状态</span>
                    <strong>{order.paymentStatus}</strong>
                  </div>
                  <div>
                    <span>订单金额</span>
                    <strong>{money(order.amount)}</strong>
                  </div>
                  <p>{(order.items ?? []).map((item) => `${item.title} × ${item.quantity} · ${item.material || ""} · ${item.size || ""}`).join("；")}</p>
                  {order.trackingNumber ? <p>物流：{order.logisticsProvider} {order.trackingNumber}</p> : <p>物流：等待发货</p>}
                </article>
              ))}
            </div>
            <div className="account-actions">
              <button className="primary-btn" onClick={() => setPage("diamonds")}>继续挑选</button>
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
                      <div><span>商品</span><strong>{product.name || favorite.product_id}</strong></div>
                      <div><span>SKU</span><strong>{favorite.product_id}</strong></div>
                      <div><span>价格</span><strong>{product.price ? money(product.price) : "-"}</strong></div>
                      <div><span>收藏时间</span><strong>{favorite.created_at ? new Date(favorite.created_at).toLocaleDateString("zh-CN") : "-"}</strong></div>
                    </article>
                  );
                })}
                {!favorites.length ? <p>暂无收藏商品。进入商品详情点击“收藏商品”即可保存。</p> : null}
              </div>
            ) : <p>请先登录后查看收藏商品。</p>}
            <div className="account-actions"><button className="primary-btn" onClick={() => setPage("diamonds")}>继续挑选</button></div>
          </div>
        ) : activePanel === "addresses" ? (
          <div className="address-manager">
            {authSession ? (
              <>
                <div className="address-form">
                  <input placeholder="收件人" value={addressDraft.recipient_name} onChange={(event) => setAddressDraft((current) => ({ ...current, recipient_name: event.target.value }))} />
                  <input placeholder="电话" value={addressDraft.phone} onChange={(event) => setAddressDraft((current) => ({ ...current, phone: event.target.value }))} />
                  <select value={addressDraft.country} onChange={(event) => setAddressDraft((current) => ({ ...current, country: event.target.value }))}><option>United States</option><option>United Kingdom</option></select>
                  <input placeholder="州 / 郡" value={addressDraft.state} onChange={(event) => setAddressDraft((current) => ({ ...current, state: event.target.value }))} />
                  <input placeholder="城市" value={addressDraft.city} onChange={(event) => setAddressDraft((current) => ({ ...current, city: event.target.value }))} />
                  <input placeholder="邮编" value={addressDraft.postal_code} onChange={(event) => setAddressDraft((current) => ({ ...current, postal_code: event.target.value }))} />
                  <input className="wide" placeholder="街道地址" value={addressDraft.address_line1} onChange={(event) => setAddressDraft((current) => ({ ...current, address_line1: event.target.value }))} />
                  <input className="wide" placeholder="公寓、套房、门牌号" value={addressDraft.address_line2} onChange={(event) => setAddressDraft((current) => ({ ...current, address_line2: event.target.value }))} />
                  <label className="check-row"><input type="checkbox" checked={addressDraft.is_default} onChange={(event) => setAddressDraft((current) => ({ ...current, is_default: event.target.checked }))} /> 设为默认地址</label>
                  <button className="primary-btn" onClick={submitAddress}>保存地址</button>
                </div>
                <div className="guest-order-list">
                  {addresses.map((address) => (
                    <article className="guest-order-card" key={address.id}>
                      <div><span>收件人</span><strong>{address.recipient_name}</strong></div>
                      <div><span>电话</span><strong>{address.phone || "-"}</strong></div>
                      <div><span>国家</span><strong>{address.country}</strong></div>
                      <div><span>默认</span><strong>{address.is_default ? "是" : "否"}</strong></div>
                      <p>{[address.address_line1, address.address_line2, address.city, address.state, address.postal_code].filter(Boolean).join(", ")}</p>
                      <button className="secondary-btn" onClick={() => removeAddress(address.id)}>删除地址</button>
                    </article>
                  ))}
                  {!addresses.length ? <p>暂无保存地址。</p> : null}
                </div>
              </>
            ) : <p>请先登录后管理收货地址。</p>}
          </div>
        ) : (
          <>
            <div className="account-list">
              {active.rows.map((row) => <button key={row} onClick={() => setNotice(`已选择：${row}`)}>{row}</button>)}
            </div>
            <div className="account-actions">
              {active.actions.map(([label, message]) => (
                <button
                  className={label.includes("继续") || label.includes("进入") ? "primary-btn" : "secondary-btn"}
                  key={label}
                  onClick={() => {
                    setNotice(message);
                    if (label === "继续挑选" || label === "再次购买") setPage("diamonds");
                    if (label === "进入定制") setPage("content", { contentKey: "custom" });
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

function Admin({ diamonds, setDiamonds }) {
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
    { key: "wedding", label: "结婚钻戒" }
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
                <article><span>商品总数</span><strong>{productCatalog.length}</strong><small>四类商品统一管理</small></article>
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
                        <span>{thumbImage ? <img className="admin-product-thumb" src={thumbImage} alt={product.name} /> : "无图"}</span>
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
                            {(viewingProduct.images?.length ? viewingProduct.images : [shapes.find((shape) => shape.key === viewingProduct.shape)?.image]).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${viewingProduct.name}-${index + 1}`} />)}
                          </div>
                          <div className="material-media-preview">
                            {materialImageGroups.map((group) => (
                              <div key={group.key}>
                                <strong>{group.label}商品图</strong>
                                <div className="modal-image-grid compact">
                                  {(viewingProduct.materialImages?.[group.key] ?? []).map((image, index) => <img key={`${group.key}-${index}`} src={image} alt={`${group.label}商品图${index + 1}`} />)}
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
                                  {(productDraft.materialImages?.[group.key] ?? []).map((image, index) => <img key={`${group.key}-${index}`} src={image} alt={`${group.label}商品图${index + 1}`} />)}
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
                            <label><span>商品名称</span><input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} placeholder="例如：椭圆形培育钻石求婚戒指" /></label>
                            <label><span>SKU 编码</span><input value={productDraft.sku} onChange={(event) => setProductDraft({ ...productDraft, sku: event.target.value })} placeholder="例如：ER-OVAL-001" /></label>
                            <label><span>售价 USD</span><input value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} placeholder="例如：3280" /></label>
                            <label><span>库存数量</span><input value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} placeholder="例如：8" /></label>
                            <label className="wide"><span>商品简介</span><textarea value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} placeholder="介绍戒指设计、主钻比例、戒托工艺、适合场景等" /></label>
                            <label className="wide"><span>商品图文字提示</span><input value={productDraft.imageCaption} onChange={(event) => setProductDraft({ ...productDraft, imageCaption: event.target.value })} placeholder="例如：上传图片为 2.00ct 椭圆形实物图" /></label>
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

function Footer({ openContent }) {
  return (
    <footer className="site-footer">
      <div>
        <strong>everastone</strong>
        <p>{homeCopy.footer.brandText.en}</p>
        <p>{homeCopy.footer.slogan.en}</p>
      </div>
      <div>
        <span>{homeCopy.footer.insured.en}</span>
        <span>{homeCopy.footer.returns.en}</span>
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
  const [filters, setFilters] = useState(initialFilters);
  const [diamonds, setDiamonds] = useState(() => mergeProductsById(initialFrontendProducts, readSharedFrontendProducts()));
  const [selectedId, setSelectedId] = useState(initialFrontendProducts[0].id);
  const [cart, setCart] = useState([]);
  const [serviceCount, setServiceCount] = useState(8659);
  const selectedProduct = diamonds.find((item) => item.id === selectedId) ?? diamonds[0];
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
    setPageState(nextPage);
    const path = options.productId
      ? `/product/${options.productId}`
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
    const onSharedProducts = () => setDiamonds((items) => mergeProductsById(items, readSharedFrontendProducts()));
    window.addEventListener("storage", onSharedProducts);
    const onPopState = () => {
      setPageState(pageFromPath(window.location.pathname));
      setContentKey(contentKeyFromPath(window.location.pathname));
      syncProductFromPath();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("storage", onSharedProducts);
    };
  }, []);

  useEffect(() => {
    const contentTitleMap = {
      couple: "Matching Rings",
      coupleClassic: "Matching Rings",
      coupleDiamond: "Matching Rings",
      coupleMinimal: "Matching Rings",
      coupleVintage: "Matching Rings",
      designer: "Designer Editions",
      custom: "Bespoke Rings",
      customProcess: "Bespoke Ring Timeline",
      customDiamond: "Choose a Diamond",
      customSetting: "Choose a Setting",
      story: "Brand Story",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      returns: "Return Policy",
      warranty: "Warranty Policy"
    };
    const titleMap = {
      home: "everastone | Bespoke Lab-Grown Diamond Jewelry",
      diamonds: "Engagement Rings | everastone",
      product: `${selectedProduct?.name ?? "Product Details"} | everastone`,
      cart: "Cart | everastone",
      checkout: "Secure Checkout | everastone",
      account: "My Account | everastone",
      admin: "Admin | everastone",
      content: `${contentTitleMap[contentKey] ?? "Brand Content"} | everastone`
    };
    const description = selectedProduct && page === "product"
      ? `${selectedProduct.name ?? shapeLabel(selectedProduct.shape)} supports secure PayPal checkout, a 10% first-order offer, and global air delivery.`
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
  }, [page, contentKey, selectedProduct?.id]);

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
      {page !== "admin" ? <Header page={page} setPage={setPage} setFilters={setFilters} openContent={openContent} cartCount={cart.reduce((sum, item) => sum + item.qty, 0)} serviceCount={serviceCount} /> : null}
      {page === "home" ? <Home setPage={setPage} applyPreset={applyPreset} /> : null}
      {page === "diamonds" ? <FilterPage filters={filters} setFilters={setFilters} diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} /> : null}
      {page === "product" ? <ProductDetail product={selectedProduct} addToCart={addToCart} setPage={setPage} products={diamonds} openProduct={openProduct} /> : null}
      {page === "cart" ? <Cart cart={cart} setCart={setCart} setPage={setPage} /> : null}
      {page === "checkout" ? <Checkout cart={cart} onSubmitOrder={submitOrder} /> : null}
      {page === "account" ? <Account setPage={setPage} /> : null}
      {page === "content" ? <ContentPage contentKey={contentKey} setPage={setPage} diamonds={diamonds} openProduct={openProduct} addToCart={addToCart} /> : null}
      {page === "admin" ? <Admin diamonds={diamonds} setDiamonds={setDiamonds} /> : null}
      {page !== "admin" ? <Footer openContent={openContent} /> : null}
    </>
  );
}

