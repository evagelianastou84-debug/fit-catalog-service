import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let productsCache = null;
let sizeChartsCache = null;

async function loadProducts() {
  if (!productsCache) {
    const raw = await readFile(path.join(__dirname, "../data/mock-products.json"), "utf-8");
    productsCache = JSON.parse(raw);
  }
  return productsCache;
}

async function loadSizeCharts() {
  if (!sizeChartsCache) {
    const raw = await readFile(path.join(__dirname, "../data/mock-size-charts.json"), "utf-8");
    sizeChartsCache = JSON.parse(raw);
  }
  return sizeChartsCache;
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
  const charts = await loadSizeCharts();
  return charts[product.size_chart_id] ?? null;
}

async function recommendSize(productId, targetEuSize) {
  const product = await findProductById(productId);
  if (!product) return null;

  const chart = await getSizeChartFor(product);
  if (!chart) return { product_id: productId, recommended_size: null, confidence: "low" };

  const entry = chart.entries.find((e) => e.eu_size === String(targetEuSize));
  if (!entry) {
    return { product_id: productId, recommended_size: null, confidence: "low", note: "Size not in chart — nearest alternative needed." };
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
