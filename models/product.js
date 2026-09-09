const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const CACHE_TTL_MS = 60 * 1000;
let cache = null;
let cacheTime = 0;

function splitTags(value) {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function normalizeRow(row) {
  return {
    id: row.product_code,
    retailer_id: row.retailer_id,
    category: row.category,
    name: row.name,
    description: row.description,
    color: row.color,
    color_family: row.color_family,
    pattern_type: row.pattern_type,
    price_amount: Number(row.price_amount),
    price_currency: row.price_currency,
    affiliate_url: row.affiliate_url,
    image_readiness: row.image_readiness,
    active: row.active,
    occasion_tags: splitTags(row.occasion_tags),
    season_tags: splitTags(row.season_tags),
    fit_tags: splitTags(row.fit_tags),
    sizes_available: [{ retailer_size: "one-size", eu_size_mapped: "one-size", in_stock: true }],
    size_chart_id: null,
  };
}

async function fetchAllProductsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables must be set");
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&active=eq.true`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }

  const rows = await res.json();
  return rows.map(normalizeRow);
}

async function loadProducts() {
  const now = Date.now();
  if (!cache || now - cacheTime > CACHE_TTL_MS) {
    cache = await fetchAllProductsFromSupabase();
    cacheTime = now;
  }
  return cache;
}

async function findProducts({ category, occasion, season, maxPrice, inStockOnly = true } = {}) {
  const products = await loadProducts();
  return products.filter((p) => {
    if (!p.active) return false;
    if (category && p.category !== category) return false;
    if (occasion && !p.occasion_tags.includes(occasion)) return false;
    if (season && !p.season_tags.includes(season) && !p.season_tags.includes("all_season")) return false;
    if (maxPrice && p.price_amount > maxPrice) return false;
    if (inStockOnly && !p.sizes_available.some((s) => s.in_stock)) return false;
    return true;
  });
}

async function findProductById(id) {
  const products = await loadProducts();
  return products.find((p) => p.id === id) ?? null;
}

async function getSizeChartFor(product) {
  return null;
}

async function recommendSize(productId, targetEuSize) {
  const product = await findProductById(productId);
  if (!product) return null;

  const chart = await getSizeChartFor(product);
  if (!chart) {
    return {
      product_id: productId,
      recommended_size: null,
      confidence: "low",
      note: "Size chart data not yet available for this product.",
    };
  }

  const entry = chart.entries.find((e) => e.eu_size === String(targetEuSize));
  if (!entry) {
    return { product_id: productId, recommended_size: null, confidence: "low", note: "Size not in chart." };
  }

  const stockEntry = product.sizes_available.find((s) => s.retailer_size === entry.retailer_size);
  return {
    product_id: productId,
    retailer_size: entry.retailer_size,
    eu_size: entry.eu_size,
    in_stock: stockEntry?.in_stock ?? false,
    confidence: "high",
  };
}

export { findProducts, findProductById, getSizeChartFor, recommendSize };
