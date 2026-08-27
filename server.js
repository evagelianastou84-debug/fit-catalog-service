import express from "express";
import cors from "cors";
import catalogRoutes from "./routes/catalog.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "catalog-service" }));

app.use(catalogRoutes);

app.listen(PORT, () => {
  console.log(`Fit Catalog Service running on http://localhost:${PORT}`);
});
