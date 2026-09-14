import "dotenv/config";
import { readFile } from "node:fs/promises";

const apiBase = process.env.SEED_API_BASE_URL || "http://localhost:4000/api";
const products = JSON.parse(await readFile(new URL("./seed-products.json", import.meta.url), "utf8"));

let success = 0;
const failures = [];

for (const product of products) {
  try {
    const response = await fetch(`${apiBase}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || response.statusText);
    success += 1;
  } catch (error) {
    failures.push({ sku: product.sku, error: error.message });
  }
}

const response = await fetch(`${apiBase}/products`);
const payload = await response.json().catch(() => ({ data: [] }));
const counts = (payload.data || []).reduce((acc, product) => {
  acc[product.category] = (acc[product.category] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({ attempted: products.length, success, failures, total: payload.data?.length ?? 0, counts }, null, 2));

if (failures.length) process.exitCode = 1;
