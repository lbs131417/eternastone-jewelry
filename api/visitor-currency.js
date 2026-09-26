const supportedDisplayCurrencies = {
  GB: { country: "GB", currency: "GBP", locale: "en-GB", rate: 0.79 },
  FR: { country: "FR", currency: "EUR", locale: "fr-FR", rate: 0.92 },
  DE: { country: "DE", currency: "EUR", locale: "de-DE", rate: 0.92 },
  SA: { country: "SA", currency: "SAR", locale: "ar-SA", rate: 3.75 }
};

function getHeader(request, name) {
  return request.headers?.[name] || request.headers?.[name.toLowerCase()] || "";
}

function detectCountry(request) {
  const url = new URL(request.url || "https://www.everastone.com/api/visitor-currency");
  const candidates = [
    getHeader(request, "x-vercel-ip-country"),
    getHeader(request, "cf-ipcountry"),
    getHeader(request, "cloudfront-viewer-country"),
    getHeader(request, "x-country-code"),
    getHeader(request, "x-appengine-country"),
    url.searchParams.get("country")
  ];
  return String(candidates.find(Boolean) || "").trim().toUpperCase();
}

export default function handler(request, response) {
  const country = detectCountry(request);
  const profile = supportedDisplayCurrencies[country] || {
    country: country || "US",
    currency: "USD",
    locale: "en-US",
    rate: 1
  };
  response.statusCode = 200;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "private, max-age=3600");
  response.end(JSON.stringify({
    data: {
      ...profile,
      source: supportedDisplayCurrencies[country] ? "geo-header" : "default"
    }
  }));
}
