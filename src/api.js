const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
const adminTokenStorageKey = "everastone.admin.apiToken";
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export function getAdminApiToken() {
  if (typeof window === "undefined") return import.meta.env.VITE_ADMIN_API_TOKEN || "";
  return window.localStorage.getItem(adminTokenStorageKey) || import.meta.env.VITE_ADMIN_API_TOKEN || "";
}

export function setAdminApiToken(token) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(adminTokenStorageKey, token);
  }
}

function adminHeaders(extra = {}) {
  const token = getAdminApiToken();
  return {
    ...extra,
    ...(token ? { "x-admin-token": token } : {})
  };
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "接口请求失败");
  }
  return payload;
}

export async function fetchStorefrontProducts() {
  const response = await fetch(`${apiBase}/products`);
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function saveStorefrontProduct(product) {
  const response = await fetch(`${apiBase}/products`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(product)
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

export async function deleteStorefrontProduct(id) {
  const response = await fetch(`${apiBase}/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders()
  });
  return parseJsonResponse(response);
}

export async function uploadProductImage({ dataUrl, fileName, contentType, sku, material }) {
  const response = await fetch(`${apiBase}/uploads/product-image`, {
    method: "POST",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ dataUrl, fileName, contentType, sku, material })
  });
  const payload = await parseJsonResponse(response);
  return payload.data?.url;
}

export async function createStorefrontOrder(order) {
  const response = await fetch(`${apiBase}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

export async function createPayPalOrder(order) {
  const response = await fetch(`${apiBase}/paypal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

export async function capturePayPalOrder(paypalOrderId, localOrderId) {
  const response = await fetch(`${apiBase}/paypal/capture-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paypalOrderId, localOrderId })
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

export async function fetchAdminOrders() {
  const response = await fetch(`${apiBase}/orders`, {
    headers: adminHeaders()
  });
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function lookupGuestOrders(email) {
  const response = await fetch(`${apiBase}/orders/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function trackAnalyticsEvent(event) {
  const response = await fetch(`${apiBase}/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });
  return parseJsonResponse(response);
}

export async function fetchAdminAnalyticsSummary() {
  const response = await fetch(`${apiBase}/analytics/summary`, {
    headers: adminHeaders()
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

export async function updateAdminOrder(id, patch) {
  const response = await fetch(`${apiBase}/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch)
  });
  const payload = await parseJsonResponse(response);
  return payload.data;
}

async function supabaseAuthRequest(path, body) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase Auth 未配置，请先填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY");
  }
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseJsonResponse(response);
}

export function signUpWithEmail(email, password) {
  return supabaseAuthRequest("/signup", { email, password });
}

export function signInWithEmail(email, password) {
  return supabaseAuthRequest("/token?grant_type=password", { email, password });
}

export function sendPasswordRecovery(email) {
  return supabaseAuthRequest("/recover", { email });
}

export async function fetchMyOrders(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase 未配置");
  const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&order=created_at.desc`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload) ? payload : [];
}

async function supabaseUserDataRequest(path, { method = "GET", body, accessToken, prefer } = {}) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase 未配置");
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return parseJsonResponse(response);
}

export function fetchMyFavorites(accessToken) {
  return supabaseUserDataRequest("/favorite_products?select=*,products(*)&order=created_at.desc", { accessToken });
}

export function addMyFavorite(accessToken, userId, productId) {
  return supabaseUserDataRequest("/favorite_products", {
    method: "POST",
    accessToken,
    prefer: "resolution=merge-duplicates,return=representation",
    body: { user_id: userId, product_id: productId }
  });
}

export function removeMyFavorite(accessToken, userId, productId) {
  return supabaseUserDataRequest(`/favorite_products?user_id=eq.${encodeURIComponent(userId)}&product_id=eq.${encodeURIComponent(productId)}`, {
    method: "DELETE",
    accessToken,
    prefer: "return=minimal"
  });
}

export function fetchMyAddresses(accessToken) {
  return supabaseUserDataRequest("/customer_addresses?select=*&order=is_default.desc,created_at.desc", { accessToken });
}

export function saveMyAddress(accessToken, address) {
  return supabaseUserDataRequest("/customer_addresses", {
    method: "POST",
    accessToken,
    prefer: "resolution=merge-duplicates,return=representation",
    body: address
  });
}

export function deleteMyAddress(accessToken, id) {
  return supabaseUserDataRequest(`/customer_addresses?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
    prefer: "return=minimal"
  });
}
