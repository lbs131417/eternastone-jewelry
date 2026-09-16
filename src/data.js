export const shapes = [
  { key: "round", label: "Round", zh: "圆形", image: new URL("./assets/shape-round-transparent.webp", import.meta.url).href, path: "M50 10a40 40 0 1 0 0 80 40 40 0 0 0 0-80Zm0 0 17 40-17 40-17-40L50 10Zm-40 40h80M23 23l54 54M77 23 23 77" },
  { key: "emerald", label: "Emerald", zh: "祖母绿形", image: new URL("./assets/shape-emerald-transparent.webp", import.meta.url).href, path: "M28 10h44l18 18v44L72 90H28L10 72V28L28 10Zm0 0v80M72 10v80M10 28h80M10 72h80M28 28h44v44H28z" },
  { key: "pear", label: "Pear", zh: "水滴形", image: new URL("./assets/shape-pear-transparent.webp", import.meta.url).href, path: "M50 8C34 28 19 42 19 62a31 31 0 0 0 62 0C81 42 66 28 50 8Zm0 0v82M26 49h48M31 74l38-38M69 74 31 36" },
  { key: "asscher", label: "Asscher", zh: "阿斯切形", image: new URL("./assets/shape-asscher-transparent.webp", import.meta.url).href, path: "M25 10h50l15 15v50L75 90H25L10 75V25L25 10Zm9 15h32l9 9v32l-9 9H34l-9-9V34l9-9Zm-9-15 9 15M75 10l-9 15M90 25l-15 9M90 75l-15-9M75 90l-9-15M25 90l9-15M10 75l15-9M10 25l15 9" },
  { key: "princess", label: "Princess", zh: "公主方形", image: new URL("./assets/shape-princess-transparent.webp", import.meta.url).href, path: "M13 13h74v74H13zM13 13l74 74M87 13 13 87M50 13v74M13 50h74M30 30h40v40H30z" },
  { key: "oval", label: "Oval", zh: "椭圆形", image: new URL("./assets/shape-oval-transparent.webp", import.meta.url).href, path: "M50 8c20 0 34 19 34 42S70 92 50 92 16 73 16 50 30 8 50 8Zm0 0 16 42-16 42-16-42L50 8Zm-34 42h68M27 23l46 54M73 23 27 77" },
  { key: "heart", label: "Heart", zh: "心形", image: new URL("./assets/shape-heart-transparent.webp", import.meta.url).href, path: "M50 88C25 66 13 51 13 33c0-12 9-21 21-21 7 0 13 4 16 10 3-6 9-10 16-10 12 0 21 9 21 21 0 18-12 33-37 55Zm0 0V22M20 42h60M30 20l40 56M70 20 30 76" },
  { key: "marquise", label: "Marquise", zh: "马眼形", image: new URL("./assets/shape-marquise-transparent.webp", import.meta.url).href, path: "M5 50C22 22 37 12 50 12s28 10 45 38C78 78 63 88 50 88S22 78 5 50Zm0 0h90M50 12v76M25 31l50 38M75 31 25 69" },
  { key: "radiant", label: "Radiant", zh: "放射方形", image: new URL("./assets/shape-radiant-transparent.webp", import.meta.url).href, path: "M23 10h54l13 13v54L77 90H23L10 77V23L23 10Zm0 0 54 80M77 10 23 90M10 23l80 54M90 23 10 77M50 10v80M10 50h80M28 28h44v44H28z" }
];

export const categories = [
  {
    key: "engagement",
    title: "Engagement Rings",
    original: "定制培育钻石主石与设计师戒托，打造专属求婚钻戒",
    zh: "甄选优质培育钻石主石，搭配原创设计师戒托，定格求婚瞬间的心动信物",
    subtitle: "Fine lab-grown center stones meet original designer settings, made to hold the moment your promise begins.",
    target: "diamonds"
  },
  {
    key: "couple",
    title: "Matching Rings",
    original: "结婚婚戒与情侣对戒合并展示，提供素圈、排钻与纪念款式",
    zh: "婚礼婚戒与日常情侣对戒合集，简约素圈、精致排钻，见证往后朝夕相伴",
    subtitle: "Wedding bands and everyday matching rings, from clean metal bands to delicate diamond details for all the days after.",
    contentKey: "couple"
  },
  {
    key: "designer",
    title: "Designer Editions",
    original: "黑金视觉呈现本期原创设计，精选更有辨识度的高级珠宝",
    zh: "本期原创主题系列，黑金美学放大钻石璀璨火彩，打造辨识度拉满的独特珠宝",
    subtitle: "Seasonal original designs in a black-and-gold mood, created for distinctive pieces with unmistakable presence.",
    contentKey: "designer"
  },
  {
    key: "custom",
    title: "Bespoke Rings",
    original: "从需求沟通、设计确认到制作交付，打造专属培育钻石戒指",
    zh: "从爱情故事沟通、手绘定稿到精工打磨交付，从头到尾打造只属于你们的戒指",
    subtitle: "From your story and sketch approval to final polish, every step is shaped around a ring that belongs only to you.",
    contentKey: "custom"
  }
];

export const colors = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
export const clarities = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1"];
export const grades = ["Excellent", "Very Good", "Good", "Fair", "Poor"];
export const certificates = ["GIA", "IGI", "HRD", "GCAL", "No Certificate"];
export const fluorescence = ["None", "Faint", "Medium", "Strong", "Very Strong"];

export const diamonds = [
  { id: "LD-1001", shape: "oval", carat: 2.18, color: "E", clarity: "VS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "61.8%", table: "58%", ratio: "1.42", price: 3280, image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=85", fast: true, realPhoto: true, createdAt: 12, sold: 98 },
  { id: "LD-1002", shape: "round", carat: 1.74, color: "D", clarity: "VVS2", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "GIA", fluorescence: "Faint", depth: "62.1%", table: "57%", ratio: "1.00", price: 2860, image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=85", fast: true, realPhoto: true, createdAt: 10, sold: 120 },
  { id: "LD-1003", shape: "pear", carat: 2.72, color: "F", clarity: "VS2", cut: "Very Good", polish: "Excellent", symmetry: "Very Good", certificate: "IGI", fluorescence: "None", depth: "63.4%", table: "59%", ratio: "1.58", price: 3950, image: "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=900&q=85", fast: false, realPhoto: true, createdAt: 8, sold: 88 },
  { id: "LD-1004", shape: "emerald", carat: 3.12, color: "G", clarity: "VS1", cut: "Excellent", polish: "Very Good", symmetry: "Excellent", certificate: "GCAL", fluorescence: "None", depth: "64.0%", table: "62%", ratio: "1.39", price: 5120, image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=85", fast: true, realPhoto: false, createdAt: 6, sold: 56 },
  { id: "LD-1006", shape: "marquise", carat: 2.42, color: "E", clarity: "VVS1", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "HRD", fluorescence: "None", depth: "60.5%", table: "57%", ratio: "1.92", price: 4480, image: "https://images.unsplash.com/photo-1628926379972-9843ad139a26?auto=format&fit=crop&w=900&q=85", fast: false, realPhoto: true, createdAt: 14, sold: 42 },
  { id: "LD-1007", shape: "princess", carat: 1.92, color: "F", clarity: "SI1", cut: "Good", polish: "Very Good", symmetry: "Good", certificate: "IGI", fluorescence: "Medium", depth: "69.1%", table: "70%", ratio: "1.01", price: 2180, image: "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=900&q=85", fast: true, realPhoto: false, createdAt: 5, sold: 61 },
  { id: "LD-1008", shape: "radiant", carat: 4.08, color: "I", clarity: "VS2", cut: "Very Good", polish: "Very Good", symmetry: "Excellent", certificate: "IGI", fluorescence: "None", depth: "65.8%", table: "63%", ratio: "1.31", price: 6420, image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=85", fast: false, realPhoto: true, createdAt: 3, sold: 35 },
  { id: "LD-1009", shape: "heart", carat: 1.18, color: "D", clarity: "IF", cut: "Excellent", polish: "Excellent", symmetry: "Excellent", certificate: "GIA", fluorescence: "Faint", depth: "59.8%", table: "56%", ratio: "1.02", price: 2420, image: "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=900&q=85", fast: true, realPhoto: true, createdAt: 11, sold: 28 },
  { id: "LD-1010", shape: "asscher", carat: 5.63, color: "J", clarity: "SI2", cut: "Good", polish: "Good", symmetry: "Very Good", certificate: "IGI", fluorescence: "Strong", depth: "67.2%", table: "64%", ratio: "1.00", price: 7180, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=85", fast: false, realPhoto: false, createdAt: 2, sold: 18 }
];

export const settings = ["14K White Gold", "18K White Gold", "14K Yellow Gold", "18K Yellow Gold", "Rose Gold", "Platinum"];
export const usSizes = ["4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9"];
export const ukSizes = ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
