import { Router } from "express";
import { findProducts, findProductById, recommendSize } from "../models/product.js";

const router = Router();

router.get("/products", async (req, res) => {
  const { category, occasion, season, maxPrice } = req.query;
  const products = await findProducts({
    category,
    occasion,
    season,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  });
  res.json({ count: products.length, products });
});

router.get("/product/:id", async (req, res) => {
  const product = await findProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.get("/product/:id/size-recommendation", async (req, res) => {
  const euSize = req.query.eu_size;
  if (!euSize) return res.status(400).json({ error: "eu_size query param is required" });

  const result = await recommendSize(req.params.id, euSize);
  if (!result) return res.status(404).json({ error: "Product not found" });
  res.json(result);
});

router.get("/product/:id/buy-link", async (req, res) => {
  const product = await findProductById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ affiliate_url: product.affiliate_url, retailer: product.retailer_id });
});

export default router;
