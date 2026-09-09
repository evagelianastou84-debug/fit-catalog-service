import { Router } from "express";
import { findProducts, findProductById, recommendSize } from "../models/product.js";

const router = Router();

router.get("/products", async (req, res) => {
  try {
    const { category, occasion, season, maxPrice } = req.query;
    const products = await findProducts({
      category,
      occasion,
      season,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
    res.json({ products, count: products.length });
  } catch (err) {
    res.status(502).json({ error: `Could not load products: ${err.message}` });
  }
});

router.get("/product/:id", async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(502).json({ error: `Could not load product: ${err.message}` });
  }
});

router.get("/product/:id/size-recommendation", async (req, res) => {
  try {
    const result = await recommendSize(req.params.id, req.query.eu_size);
    if (!result) return res.status(404).json({ error: "Product not found" });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `Could not compute size recommendation: ${err.message}` });
  }
});

router.get("/product/:id/buy-link", async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product_id: product.id, retailer_id: product.retailer_id, affiliate_url: product.affiliate_url });
  } catch (err) {
    res.status(502).json({ error: `Could not load buy link: ${err.message}` });
  }
});

export default router;
