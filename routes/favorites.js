import { Router } from "express";

const router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

router.post("/favorites", async (req, res) => {
  try {
    const { device_id, outfit_label, items, price_total } = req.body || {};
    if (!device_id || !outfit_label || !items) {
      return res.status(400).json({ error: "device_id, outfit_label, and items are required" });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites`, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        device_id,
        outfit_label,
        items_json: JSON.stringify(items),
        price_total: price_total || 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    const [saved] = await response.json();
    res.json({ id: saved.id, saved: true });
  } catch (err) {
    res.status(502).json({ error: `Could not save favorite: ${err.message}` });
  }
});

router.get("/favorites", async (req, res) => {
  try {
    const { device_id } = req.query;
    if (!device_id) return res.status(400).json({ error: "device_id is required" });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/favorites?device_id=eq.${encodeURIComponent(device_id)}&order=created_at.desc&select=*`,
      { headers: supabaseHeaders() }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    const rows = await response.json();
    const favorites = rows.map((row) => ({
      id: row.id,
      outfit_label: row.outfit_label,
      items: JSON.parse(row.items_json),
      price_total: row.price_total,
      created_at: row.created_at,
    }));

    res.json({ favorites });
  } catch (err) {
    res.status(502).json({ error: `Could not load favorites: ${err.message}` });
  }
});

router.delete("/favorites/:id", async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites?id=eq.${req.params.id}`, {
      method: "DELETE",
      headers: supabaseHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase error ${response.status}: ${text}`);
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(502).json({ error: `Could not delete favorite: ${err.message}` });
  }
});

export default router;
