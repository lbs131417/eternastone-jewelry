const siteUrl = (process.env.SITE_URL || "https://www.everastone.com").replace(/\/$/, "");

const xmlEscape = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const staticUrls = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/diamonds", priority: "0.9", changefreq: "weekly" },
  { loc: "/couple-rings", priority: "0.8", changefreq: "monthly" },
  { loc: "/designer-styles", priority: "0.8", changefreq: "monthly" },
  { loc: "/custom-ring", priority: "0.8", changefreq: "monthly" },
  { loc: "/brand-story", priority: "0.7", changefreq: "monthly" },
  { loc: "/blog", priority: "0.7", changefreq: "weekly" },
  { loc: "/shipping-policy", priority: "0.5", changefreq: "yearly" },
  { loc: "/payment-terms", priority: "0.5", changefreq: "yearly" },
  { loc: "/returns-policy", priority: "0.5", changefreq: "yearly" },
  { loc: "/warranty-policy", priority: "0.5", changefreq: "yearly" },
  { loc: "/terms-of-service", priority: "0.5", changefreq: "yearly" },
  { loc: "/privacy", priority: "0.5", changefreq: "yearly" },
  { loc: "/ring-size-guide", priority: "0.6", changefreq: "monthly" }
];

const buildStaticSitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map((item) => `  <url>
    <loc>${xmlEscape(`${siteUrl}${item.loc}`)}</loc>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

const sendSitemap = (response, body) => {
  response.statusCode = 200;
  response.setHeader("content-type", "application/xml; charset=utf-8");
  response.setHeader("cache-control", "s-maxage=300, stale-while-revalidate=86400");
  response.end(body);
};

export default async function handler(_request, response) {
  const apiBase = process.env.SITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "";
  const backendOrigin = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (!backendOrigin || backendOrigin.startsWith("/")) {
    sendSitemap(response, buildStaticSitemapXml());
    return;
  }

  try {
    const upstream = await fetch(`${backendOrigin}/sitemap.xml`, {
      headers: { accept: "application/xml,text/xml,*/*" }
    });
    const body = await upstream.text();
    if (upstream.ok && body.includes("<urlset")) {
      sendSitemap(response, body);
      return;
    }
    sendSitemap(response, buildStaticSitemapXml());
  } catch (error) {
    sendSitemap(response, buildStaticSitemapXml());
  }
}
