const SHOPS = require('./_shops');
const UA = 'LoadoutBench/1.0 (personal gear planner)';
const platform = {};            // remembers which adapter worked per shop (per warm instance)
const hits = new Map();         // best-effort rate limit; add Vercel's firewall rules for real protection

function limited(ip) {
  const now = Date.now(), w = (hits.get(ip) || []).filter(t => now - t < 60000);
  w.push(now); hits.set(ip, w); if (hits.size > 5000) hits.clear();
  return w.length > 20;
}
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const clean = t => String(t || '').replace(/&amp;|&#038;/g, '&').replace(/&#8217;|&#039;/g, '’').replace(/&quot;|&#8221;|&#8220;/g, '"');

async function shopify(s, q) {
  const j = await getJson(`https://${s.domain}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=8`);
  const list = j && j.resources && j.resources.results && j.resources.results.products;
  if (!Array.isArray(list)) throw new Error('not shopify');
  return list.map(p => ({ name: clean(p.title), brand: clean(p.vendor), price: parseFloat(p.price) || 0, cur: s.cur, weight: 0,
    source: s.name, url: `https://${s.domain}${p.url || ''}`, inStock: p.available !== false }));
}
async function woo(s, q) {
  const list = await getJson(`https://${s.domain}/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=8`);
  if (!Array.isArray(list)) throw new Error('not woocommerce');
  return list.map(p => {
    const pr = p.prices || {}, minor = Number(pr.currency_minor_unit ?? 2), w = parseFloat(p.weight);
    return { name: clean(p.name), brand: clean(p.brands && p.brands[0] && p.brands[0].name),
      price: (parseInt(pr.price, 10) || 0) / Math.pow(10, minor), cur: pr.currency_code || s.cur,
      weight: w ? Math.round(w < 50 ? w * 1000 : w) : 0,           // assumes kg unless the number is large
      source: s.name, url: p.permalink, inStock: p.is_in_stock !== false };
  });
}
async function run(s, q) {
  const order = platform[s.id] === 'woo' ? [woo, shopify] : [shopify, woo];
  for (const f of order) {
    try { const items = await f(s, q); platform[s.id] = f === woo ? 'woo' : 'shopify'; return items; } catch (e) {}
  }
  throw new Error('search not supported');
}

module.exports = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many searches. Wait a minute.' });
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const ids = String(req.query.shops || '').split(',');
  const picked = SHOPS.filter(s => ids.includes(s.id)).slice(0, 10);
  const out = await Promise.allSettled(picked.map(s => run(s, q)));
  const items = [], report = [];
  out.forEach((r, i) => {
    if (r.status === 'fulfilled') { items.push(...r.value); report.push({ id: picked[i].id, ok: true, count: r.value.length }); }
    else report.push({ id: picked[i].id, ok: false, error: r.reason.message });
  });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.json({ items, report });
};
