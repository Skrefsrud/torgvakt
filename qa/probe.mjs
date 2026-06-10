// Probe finn listings via plain fetch: extract JSON-LD product info to classify candidates.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const urls = process.argv.slice(2);

function findProduct(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const p = findProduct(n); if (p) return p; } return null; }
  const t = node["@type"];
  if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return node;
  return findProduct(node["@graph"]);
}

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    const html = await res.text();
    let prod = null;
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      try { const d = JSON.parse(m[1]); const p = findProduct(d); if (p) { prod = p; break; } } catch {}
    }
    const disposed = /\\?"disposed\\?":\s*true/.test(html);
    const monthly = /kr\/mnd|kr\s*\/\s*mnd|pr\/mnd|pr\.?\s*mnd/i.test(html);
    const sold = /Solgt/i.test(html);
    const out = {
      url, http: res.status, disposed, monthlyPriceText: monthly, soldText: sold,
      sku: prod?.sku ?? null,
      title: (prod?.name ?? "").slice(0, 90),
      titleLen: (prod?.name ?? "").length,
      price: prod?.offers?.price ?? null,
      availability: prod?.offers?.availability ?? null,
      imageType: Array.isArray(prod?.image) ? `array(${typeof prod.image[0]})` : typeof prod?.image,
    };
    console.log(JSON.stringify(out));
  } catch (e) {
    console.log(JSON.stringify({ url, error: String(e) }));
  }
}
