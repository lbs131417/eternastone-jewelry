import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Diamond,
  Heart,
  LayoutDashboard,
  Menu,
  PackagePlus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X
} from "lucide-react";
import { deleteStorefrontProduct, fetchStorefrontProducts, getAdminApiToken, saveStorefrontProduct, setAdminApiToken, uploadProductImage } from "./api.js";
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

const FRONTEND_PRODUCTS_STORAGE_KEY = "eternastone.frontend.products";
const readSharedFrontendProducts = () => {
  try {
    const stored = window.localStorage.getItem(FRONTEND_PRODUCTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};
const mergeProductsById = (base, additions) => {
  const merged = new Map(base.map((product) => [product.id, product]));
  additions.forEach((product) => merged.set(product.id, { ...merged.get(product.id), ...product }));
  return Array.from(merged.values());
};

const shapeLabel = (key) => shapes.find((shape) => shape.key === key)?.zh ?? key;
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
const getYouTubeEmbedUrl = (url = "") => {
  const value = String(url).trim();
  const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
};
const diamondFaceUpMm = {
  round: [6.5, 6.5],
  cushion: [6.1, 6.1],
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
const heroRingImage = new URL("./assets/hengshi-hero-ring.png", import.meta.url).href;
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
  jewelry: "/daily-jewelry",
  earrings: "/daily-jewelry/earrings",
  necklaces: "/daily-jewelry/necklaces",
  bracelets: "/daily-jewelry/bracelets",
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
  settingVintage: "/collection/vintage-settings"
};

const contentKeyFromPath = (pathname) =>
  Object.entries(contentPaths).find(([, path]) => pathname === path)?.[0] ?? "couple";

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
    if (contentKey) {
      openContent(contentKey);
      return;
    }
    setPage(target);
  };
  const nav = [
    { key: "home", label: "首页", target: "home" },
    {
      key: "engagement",
      label: "订婚戒指",
      target: "diamonds",
      mega: [
        { title: "钻石形状", items: [["圆形", "round"], ["垫形", "cushion"], ["祖母绿形", "emerald"], ["水滴形", "pear"], ["公主方形", "princess"], ["椭圆形", "oval"], ["放射方形", "radiant"]] },
        { title: "热门钻石", items: [["2 克拉椭圆主钻", null, "popularOval"], ["1.5 克拉圆形主钻", null, "popularRound"], ["2.5 克拉水滴主钻", null, "popularPear"], ["3 克拉祖母绿主钻", null, "popularEmerald"]] },
        { title: "镶嵌类型", items: [["单钻款", null, "settingSolitaire"], ["围镶款", null, "settingHalo"], ["密镶款", null, "settingPave"], ["三石款", null, "settingThreeStone"], ["复古款", null, "settingVintage"]] }
      ]
    },
    { key: "couple", label: "情侣对戒", contentKey: "couple", mega: [{ title: "热门对戒分类", items: [["素圈婚戒", null, "coupleClassic"], ["带钻对戒", null, "coupleDiamond"], ["极简窄款对戒", null, "coupleMinimal"], ["复古雕花对戒", null, "coupleVintage"]] }] },
    { key: "fine", label: "日常珠宝", contentKey: "jewelry", mega: [{ title: "首饰分类", items: [["耳饰", null, "earrings"], ["项链", null, "necklaces"], ["手链", null, "bracelets"]] }] },
    { key: "custom", label: "定制戒指", contentKey: "custom", mega: [{ title: "定制戒指", items: [["定制流程介绍", null, "customProcess"], ["主钻选择入口", null, "customDiamond"], ["戒托定制入口", null, "customSetting"]] }] },
    { key: "story", label: "品牌故事", contentKey: "story" },
    { key: "cart", label: "购物车", target: "cart", count: cartCount },
    { key: "account", label: "我的", target: "account" }
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
          <span>已服务 {liveServiceCount.toLocaleString("zh-CN")} 人，越来越多新人选择 Eternastone 珠宝。</span>
          <span>首单享受 10% 折扣，定制钻戒也可享受。</span>
          <span>制作+配送周期约 23 天，可加急处理。</span>
          <span>已服务 {liveServiceCount.toLocaleString("zh-CN")} 人，越来越多新人选择 Eternastone 珠宝。</span>
        </div>
      </div>
      <header className={scrolled ? "site-header scrolled" : "site-header"}>
        <button className="mobile-menu-trigger" onClick={() => setMobileMenuOpen(true)} aria-label="打开移动端菜单">
          <Menu size={22} />
        </button>
        <button className="brand" onClick={() => setPage("home")} aria-label="Eternastone Jewelry home">
          <span className="brand-mark"><Diamond size={20} /></span>
          <span>
            <strong>Eternastone 珠宝</strong>
            <small>培育钻石高级定制</small>
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
              <span><strong>ETERNASTONE 珠宝</strong><small>培育钻石高级定制</small></span>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单"><X size={18} /></button>
            </div>
            <label className="mobile-search">
              <input placeholder="搜索..." />
              <Search size={18} />
            </label>
            <div className="mobile-drawer-links">
              <button onClick={() => openTarget("home")}>首页</button>
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
              <button onClick={() => openTarget(null, null, "story")}>品牌故事</button>
              <button onClick={() => openTarget("account")}><UserRound size={16} /> 登录 / 我的</button>
              <button onClick={() => openTarget("cart")}><ShoppingBag size={16} /> 我的包{cartCount > 0 ? `（${cartCount}）` : ""}</button>
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
    { title: "椭圆形培育钻石", text: "2.00-2.50 ct", shape: "oval", min: 2, max: 2.5 },
    { title: "圆形培育钻石", text: "1.50-2.00 ct", shape: "round", min: 1.5, max: 2 },
    { title: "水滴形培育钻石", text: "2.50-3.00 ct", shape: "pear", min: 2.5, max: 3 }
  ];
  const homeShapeKeys = ["round", "cushion", "emerald", "pear", "princess", "oval", "radiant"];
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
          <p className="eyebrow">高级培育钻石定制工作室</p>
          <h1>Eternastone 珠宝</h1>
          <h2 className="hero-subtitle">定制订婚戒指与高级培育钻石珠宝</h2>
          <p>为美国与英国客户手工定制。甄选伦理培育钻石，坚持按需设计与精工制作。</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setPage("diamonds")}>选购订婚戒指</button>
            <button className="secondary-btn hero-outline" onClick={() => setPage("diamonds")}>定制专属钻戒</button>
          </div>
        </div>
      </section>

      <section className="section shape-showcase">
        <div className="section-heading">
          <h2>找到最适合你的主钻轮廓</h2>
          <p>挑选你的主钻形状，开启培育钻戒定制第一步</p>
        </div>
        <div className="shape-card-grid">
          {homeShapes.map((shape) => (
            <button className="shape-photo-card" key={shape.key} onClick={() => applyPreset({ shape: shape.key, min: 1, max: 7 })}>
              <img src={shape.image} alt={`${shape.zh}培育钻石`} loading="lazy" />
              <strong>{shape.zh}</strong>
              <span>查看{shape.zh}戒指</span>
            </button>
          ))}
        </div>
        <div className="collection-divider">
          <span>OUR COLLECTION</span>
          <strong>四大核心珠宝系列</strong>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <button className="category-card" key={category.key} onClick={() => setPage("diamonds")}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{category.title}</h3>
              <p>{category.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section muted-band">
        <div className="section-heading">
          <p className="eyebrow">Best-Selling Searches</p>
          <h2>欧美客户热门钻石规格</h2>
        </div>
        <div className="preset-grid">
          {presets.map((preset) => {
            const shape = shapes.find((item) => item.key === preset.shape);
            return (
              <button className="preset-card" key={preset.title} onClick={() => applyPreset(preset)}>
                <ShapeIcon shape={shape} active />
                <span>{preset.text}</span>
                <h3>{preset.title}</h3>
                <p>一键进入对应培育钻石筛选条件，快速挑选主石与戒托。</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section process-section">
        <div className="section-heading">
          <p className="eyebrow">Custom Process</p>
          <h2>三步完成专属定制</h2>
        </div>
        <div className="process-grid">
          {[
            ["01", "选择培育钻石", "按形状、克拉、颜色、净度与证书筛选理想主石。"],
            ["02", "设计戒托方案", "选择金属材质、戒指尺码与适合日常佩戴的比例。"],
            ["03", "制作并配送", "工坊按订单制作，完成质检后为英美客户保价配送。"]
          ].map(([step, title, text]) => (
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
          <p className="eyebrow">Why Lab Grown</p>
          <h2>同样闪耀，更适合现代高级珠宝定制</h2>
          <p>培育钻石拥有与天然钻石相同的碳晶体结构与火彩表现，同时让客户在预算、尺寸、净度与伦理选择上拥有更高自由度。</p>
        </div>
        <div className="education-panel">
          <Sparkles />
          <h3>甄选实验室培育钻石</h3>
          <p>每颗主石均可录入形状、克拉、颜色、净度、切工、抛光、对称、证书与荧光等专业参数。</p>
        </div>
      </section>

      <section className="reviews">
        {[
          ["Ava, New York", "椭圆钻戒实物比图片更通透，定制沟通非常清晰，整个过程让人安心。"],
          ["Mia, London", "价格透明，铂金戒托质感很细腻，交付节奏也符合我们的婚期安排。"],
          ["James, Austin", "1.8 克拉圆钻的存在感非常好，没有超出我们的预算。"]
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

function FilterPage({ filters, setFilters, diamonds, openProduct }) {
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
        {shapes.map((shape) => (
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
              <ProductCard product={diamond} openProduct={openProduct} key={diamond.id} />
            ))}
          </div>
          <div className="pagination" aria-label="Pagination">
            <button>上一页</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>下一页</button>
          </div>
        </section>
      </section>
    </main>
  );
}

function ProductCard({ product, openProduct }) {
  const [materialGroup, setMaterialGroup] = useState(getMaterialImageGroup(product.material));
  useEffect(() => {
    setMaterialGroup(getMaterialImageGroup(product.material));
  }, [product.id, product.material]);
  const selectedGroup = materialImageGroups.find((group) => group.key === materialGroup) ?? materialImageGroups[0];
  const cardImage = getProductMedia(product, selectedGroup.label).images?.[0] || getPrimaryProductImage(product);

  return (
    <button className="product-card" key={product.id} onClick={() => openProduct(product.id)}>
      <img src={cardImage} alt={product.name ?? `${shapeLabel(product.shape)} 培育钻石商品`} loading="lazy" />
      <div>
        <span>{product.id}</span>
        <h3>{product.name ?? `${Number(product.carat).toFixed(2)} ct ${shapeLabel(product.shape)}`}</h3>
        <p>{Number(product.carat).toFixed(2)} ct · {product.color} 色级 · {product.clarity} 净度 · {product.certificate}</p>
        <strong>{money(product.price)}</strong>
      </div>
      <div className="card-material-swatches" aria-label="戒托材质预览">
        {materialImageGroups.map((group) => (
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
    </button>
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
          <p><span>预估税费</span><strong>{money(tax)}</strong></p>
          <p><span>保价运费</span><strong>{money(shipping)}</strong></p>
          <p className="summary-total"><span>合计</span><strong>{money(subtotal + tax + shipping)}</strong></p>
          <button className="primary-btn full" disabled={!cart.length} onClick={() => setPage("checkout")}>去结算</button>
        </aside>
      </div>
    </main>
  );
}

function Checkout({ cart, onSubmitOrder }) {
  const [notice, setNotice] = useState("");
  const submitOrder = () => {
    if (!cart.length) return;
    onSubmitOrder(cart.reduce((sum, item) => sum + item.qty, 0));
    setNotice("订单已提交，首单优惠已应用，服务人数已同步累加。");
  };
  return (
    <main className="utility-page">
      <h1>安全结算</h1>
      <form className="checkout-grid">
        <section>
          <h2>收货地址</h2>
          <div className="form-grid">
            <input placeholder="名" />
            <input placeholder="姓" />
            <input placeholder="邮箱" type="email" />
            <select><option>美国</option><option>英国</option></select>
            <input placeholder="街道地址" className="wide" />
            <input placeholder="公寓、套房、门牌号" className="wide" />
            <input placeholder="城市" />
            <input placeholder="州 / 郡" />
            <input placeholder="邮编" />
            <input placeholder="电话" />
          </div>
        </section>
        <section>
          <h2>支付接口预留</h2>
          <div className="payment-placeholder">
            <CreditCard />
            <p>此处预留 Stripe、PayPal 或本地收单支付接口对接区域。</p>
          </div>
          <label className="check-row"><input type="checkbox" /> 我同意订单加密处理与隐私条款。</label>
          <button className="primary-btn full" type="button" disabled={!cart.length} onClick={submitOrder}>提交订单</button>
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
  jewelry: { eyebrow: "DAILY JEWELRY", title: "日常珠宝", intro: "适合通勤、约会与纪念日佩戴的轻奢培育钻石首饰。", cards: [["耳饰", "圆钻耳钉、垂坠耳饰与日常小钻耳饰。"], ["项链", "锁骨链、单钻吊坠与纪念日项链。"], ["手链", "细链钻石手链与轻奢手饰。"]] },
  earrings: { eyebrow: "EARRINGS", title: "钻石耳饰", intro: "从基础圆钻耳钉到轻盈垂坠款，突出脸部光泽。", cards: [["圆钻耳钉", "日常百搭，适合通勤佩戴。"], ["水滴耳饰", "修饰脸型，更有仪式感。"], ["排钻耳饰", "闪耀但保持轻盈。"]] },
  necklaces: { eyebrow: "NECKLACES", title: "钻石项链", intro: "以锁骨线为中心设计，简洁但有记忆点。", cards: [["单钻吊坠", "经典安全的礼物选择。"], ["椭圆钻项链", "更显修长温柔。"], ["定制字母链", "结合纪念日与姓名缩写。"]] },
  bracelets: { eyebrow: "BRACELETS", title: "钻石手链", intro: "轻盈链条与培育钻石火彩结合，适合日常叠戴。", cards: [["细链单钻", "低调精致。"], ["小钻排链", "微闪效果更明显。"], ["纪念日手链", "可定制刻字与钻石大小。"]] },
  custom: { eyebrow: "BESPOKE RINGS", title: "定制戒指", intro: "从主钻选择、戒托设计到制作交付，打造只属于你的培育钻石戒指。", cards: [["定制流程介绍", "了解从沟通到交付的完整步骤。"], ["主钻选择入口", "按形状、克拉、颜色、净度筛选培育钻石。"], ["戒托定制入口", "选择材质、镶嵌方式、戒圈尺寸与细节。"]] },
  customProcess: { eyebrow: "CUSTOM PROCESS", title: "定制流程介绍", intro: "三步完成专属定制：选主钻、设计戒托、制作并保价配送。", cards: [["01 选择主钻", "确认形状、克拉、颜色、净度与证书。"], ["02 设计戒托", "选择金属材质、镶嵌方式与佩戴比例。"], ["03 制作交付", "按订单制作，质检后配送至美国或英国。"]] },
  customDiamond: { eyebrow: "CHOOSE DIAMOND", title: "主钻选择入口", intro: "进入培育钻石筛选页，按 10 种形状与完整钻石参数挑选主石。", cards: [["圆形 / 椭圆 / 水滴", "热门订婚钻戒主钻形状。"], ["颜色与净度", "支持 D-M、FL-I1 等级筛选。"], ["证书与比例", "切工、抛光、对称、荧光等同后台维护。"]], cta: "进入钻石筛选" },
  customSetting: { eyebrow: "CHOOSE SETTING", title: "戒托定制入口", intro: "确认材质、镶嵌类型、戒圈尺寸与佩戴细节。", cards: [["材质选择", "14K/18K 白金、黄金、玫瑰金、铂金。"], ["镶嵌类型", "单钻、围镶、密镶、三石、复古。"], ["尺码标准", "支持美码与英码。"]] },
  story: { eyebrow: "BRAND STORY", title: "品牌故事", intro: "Eternastone 珠宝是一家专注实验室培育钻石的原创设计师工作室，坚持按需定制与长期佩戴价值。", cards: [["只做培育钻石", "全站无天然钻石切换、无混合来源库存。"], ["设计师工作室", "重视比例、佩戴舒适度与纪念意义。"], ["面向英美客户", "适配美国与英国尺码、地址与配送习惯。"]] },
  popularOval: { eyebrow: "POPULAR DIAMOND", title: "2 克拉椭圆主钻", intro: "椭圆形在视觉上更显修长，是海外订婚戒指的热门选择。", cards: [["推荐克拉", "2.00–2.50ct"], ["推荐搭配", "单钻或隐藏光环戒托"], ["视觉特点", "显大、修长、温柔。"]] },
  popularRound: { eyebrow: "POPULAR DIAMOND", title: "1.5 克拉圆形主钻", intro: "圆形明亮式切割经典耐看，火彩表现稳定。", cards: [["推荐克拉", "1.50–2.00ct"], ["推荐搭配", "六爪单钻或密镶戒臂"], ["视觉特点", "经典、闪耀、保守安全。"]] },
  popularPear: { eyebrow: "POPULAR DIAMOND", title: "2.5 克拉水滴主钻", intro: "水滴形有明显方向感，适合追求独特轮廓的求婚戒指。", cards: [["推荐克拉", "2.50–3.00ct"], ["推荐搭配", "围镶或细戒臂"], ["视觉特点", "优雅、显长、辨识度强。"]] },
  popularEmerald: { eyebrow: "POPULAR DIAMOND", title: "3 克拉祖母绿主钻", intro: "阶梯切割更强调通透感与净度，气质稳重高级。", cards: [["推荐克拉", "3.00ct 左右"], ["推荐搭配", "三石或铂金戒托"], ["视觉特点", "冷静、通透、贵气。"]] },
  settingSolitaire: { eyebrow: "SETTING TYPE", title: "单钻款", intro: "突出主钻本身，适合极简、高级、经典的订婚戒指。", cards: [["四爪", "更轻盈，露出更多主钻。"], ["六爪", "经典稳定，适合圆钻。"], ["隐藏光环", "正面低调，侧面更闪。"]] },
  settingHalo: { eyebrow: "SETTING TYPE", title: "围镶款", intro: "主钻外圈增加细钻，视觉更显大、更华丽。", cards: [["圆形围镶", "甜美经典。"], ["椭圆围镶", "显大且修长。"], ["复古围镶", "更有故事感。"]] },
  settingPave: { eyebrow: "SETTING TYPE", title: "密镶款", intro: "戒臂铺设小钻，增加整体闪耀度。", cards: [["半圈密镶", "兼顾舒适和闪耀。"], ["细戒臂密镶", "更轻盈。"], ["双排密镶", "更华丽。"]] },
  settingThreeStone: { eyebrow: "SETTING TYPE", title: "三石款", intro: "三颗主石象征过去、现在与未来，纪念意义更强。", cards: [["祖母绿三石", "稳重高级。"], ["椭圆三石", "柔和显大。"], ["水滴侧石", "线条更优雅。"]] },
  settingVintage: { eyebrow: "SETTING TYPE", title: "复古款", intro: "通过雕花、珠边、老欧洲比例表达更强的仪式感。", cards: [["珠边细节", "复古精致。"], ["雕花戒臂", "更有手工感。"], ["旧金属光泽", "温润不浮夸。"]] }
};

const contentProductCategory = {
  couple: "couple",
  coupleClassic: "couple",
  coupleDiamond: "couple",
  coupleMinimal: "couple",
  coupleVintage: "couple",
  jewelry: "jewelry",
  earrings: "jewelry",
  necklaces: "jewelry",
  bracelets: "jewelry"
};

function ContentPage({ contentKey, setPage, diamonds, openProduct }) {
  const content = contentPages[contentKey] ?? contentPages.couple;
  const productCategory = contentProductCategory[contentKey];
  const isCatalogPage = Boolean(productCategory);
  const needsFilters = productCategory === "jewelry";
  const [search, setSearch] = useState("");
  const [shapeFilter, setShapeFilter] = useState("");
  const [sort, setSort] = useState("popular");
  const contentProducts = productCategory ? diamonds
    .filter((product) => product.category === productCategory)
    .filter((product) => !search || `${product.name ?? ""} ${product.id}`.toLowerCase().includes(search.toLowerCase()))
    .filter((product) => !shapeFilter || product.shape === shapeFilter)
    .sort((a, b) => sort === "price" ? a.price - b.price : sort === "new" ? b.createdAt - a.createdAt : b.sold - a.sold) : [];
  return (
    <main className="utility-page content-page">
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p className="content-intro">{content.intro}</p>
      {!isCatalogPage ? <div className="content-card-grid">
        {content.cards.map(([title, text]) => (
          <article className="content-card" key={title}>
            <Sparkles size={18} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div> : null}
      {isCatalogPage ? (
        <section className="content-products">
          {needsFilters ? <div className="content-filter-bar">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索日常珠宝" />
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
              <ProductCard product={product} openProduct={openProduct} key={product.id} />
            ))}
          </div> : <p className="content-empty">暂无符合条件的商品，请调整筛选条件。</p>}
        </section>
      ) : null}
      {!isCatalogPage ? <div className="content-actions">
        <button className="primary-btn" onClick={() => setPage("diamonds")}>{content.cta ?? "查看相关培育钻石"}</button>
        <button className="secondary-btn" onClick={() => setPage("home")}>返回首页</button>
      </div> : null}
    </main>
  );
}

function Account({ setPage }) {
  const [activePanel, setActivePanel] = useState("orders");
  const [notice, setNotice] = useState("请选择一个功能查看详情。");
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
      text: "管理美国与英国收货地址。",
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
      </section>
    </main>
  );
}

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
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const filteredDiamonds = diamonds.filter((diamond) => {
    const keyword = `${diamond.id} ${shapeLabel(diamond.shape)} ${diamond.color} ${diamond.clarity} ${diamond.certificate}`.toLowerCase();
    return keyword.includes(productSearch.toLowerCase());
  });
  const filteredOrders = orders.filter((order) => `${order.id} ${order.email} ${order.country} ${order.status}`.toLowerCase().includes(orderSearch.toLowerCase()));
  const statusFlow = ["待付款", "已付款待确认", "定制生产中", "待发货", "已发货", "已完成", "售后中", "已取消", "退款完成"];
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
  const updateOrder = (id, patch) => {
    setOrders((items) => items.map((order) => order.id === id ? { ...order, ...patch } : order));
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

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <LayoutDashboard />
        <div>
          <p className="eyebrow">海外 B2C 培育钻石电商后台</p>
          <h1>Eternastone 珠宝管理后台</h1>
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
                <article><h3>二级子类目</h3><p>圆形钻戒、垫形钻戒、祖母绿钻戒、水滴钻戒、复古款钻戒、素圈对戒、耳饰、项链、手链。</p></article>
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
              <div className="admin-kpis"><article><span>总订单</span><strong>1,286</strong></article><article><span>销售额</span><strong>$428K</strong></article><article><span>成交克拉</span><strong>2,184 ct</strong></article><article><span>客单价</span><strong>$3,328</strong></article><article><span>退款率</span><strong>2.8%</strong></article></div>
              <div className="admin-chart">销售额趋势 / 销量柱状图 / 国家销售分布地图预留区</div>
              <div className="admin-columns"><article><h3>钻石专项统计</h3><p>按克拉区间、证书类型、钻石形状、切工、荧光反应统计销量。</p></article><article><h3>报表导出</h3><p>支持按时间、国家、商品类型导出 CSV。</p></article></div>
            </section>
          ) : null}

          {adminTab === "traffic" ? (
            <section className="admin-panel large">
              <h2>流量统计</h2>
              <div className="admin-kpis"><article><span>UV</span><strong>18,420</strong></article><article><span>PV</span><strong>64,108</strong></article><article><span>加购</span><strong>842</strong></article><article><span>下单转化率</span><strong>3.6%</strong></article></div>
              <div className="admin-funnel"><span>访客访问</span><span>浏览商品</span><span>加入购物车</span><span>提交订单</span><span>成功付款</span></div>
              <div className="admin-columns"><article><h3>来源分析</h3><p>Google SEO、Google Ads、Facebook、YouTube、WhatsApp、直接访问。</p></article><article><h3>页面排行</h3><p>首页、订婚戒指分类页、裸钻筛选页、商品详情页。</p></article><article><h3>访客国家</h3><p>美国、英国、加拿大、澳大利亚访问与下单统计。</p></article></div>
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

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Eternastone 珠宝</strong>
        <p>面向美国与英国客户的高级培育钻石设计师珠宝品牌。</p>
      </div>
      <div>
        <span>美国与英国保价配送</span>
        <span>符合条件未佩戴商品支持 30 天退换</span>
        <span>隐私优先的客户服务</span>
        <span>support@hengshijewelry.example</span>
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
        image: product.image,
        metal,
        size,
        qty: 1
      }
    ]);
  };
  const submitOrder = (count = 1) => {
    setServiceCount((current) => current + Math.max(1, Number(count) || 1));
  };

  return (
    <>
      {page !== "admin" ? <Header page={page} setPage={setPage} setFilters={setFilters} openContent={openContent} cartCount={cart.reduce((sum, item) => sum + item.qty, 0)} serviceCount={serviceCount} /> : null}
      {page === "home" ? <Home setPage={setPage} applyPreset={applyPreset} /> : null}
      {page === "diamonds" ? <FilterPage filters={filters} setFilters={setFilters} diamonds={diamonds} openProduct={openProduct} /> : null}
      {page === "product" ? <ProductDetail product={selectedProduct} addToCart={addToCart} setPage={setPage} products={diamonds} openProduct={openProduct} /> : null}
      {page === "cart" ? <Cart cart={cart} setCart={setCart} setPage={setPage} /> : null}
      {page === "checkout" ? <Checkout cart={cart} onSubmitOrder={submitOrder} /> : null}
      {page === "account" ? <Account setPage={setPage} /> : null}
      {page === "content" ? <ContentPage contentKey={contentKey} setPage={setPage} diamonds={diamonds} openProduct={openProduct} /> : null}
      {page === "admin" ? <Admin diamonds={diamonds} setDiamonds={setDiamonds} /> : null}
      {page !== "admin" ? <Footer /> : null}
    </>
  );
}

