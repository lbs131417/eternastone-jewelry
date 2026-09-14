const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
const adminTokenStorageKey = "eternastone.admin.apiToken";

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
