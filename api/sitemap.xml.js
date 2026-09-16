export default async function handler(_request, response) {
  const apiBase = process.env.SITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "";
  const backendOrigin = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (!backendOrigin || backendOrigin.startsWith("/")) {
    response.statusCode = 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("SITE_API_BASE_URL or VITE_API_BASE_URL must point to the deployed backend API origin.");
    return;
  }

  try {
    const upstream = await fetch(`${backendOrigin}/sitemap.xml`, {
      headers: { accept: "application/xml,text/xml,*/*" }
    });
    const body = await upstream.text();
    response.statusCode = upstream.ok ? 200 : upstream.status;
    response.setHeader("content-type", "application/xml; charset=utf-8");
    response.setHeader("cache-control", "s-maxage=300, stale-while-revalidate=86400");
    response.end(body);
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(`Unable to load dynamic sitemap: ${error.message}`);
  }
}
