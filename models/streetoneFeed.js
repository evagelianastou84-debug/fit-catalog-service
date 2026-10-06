import zlib from "zlib";

const FEED_URL = "https://productdata.awin.com/datafeed/download/apikey/0fa3ab4fcfa6bee44ef5fe13014ea556/language/de/fid/33949/rid/0/hasEnhancedFeeds/0/columns/aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,large_image,alternate_image,alternate_image_two,alternate_image_three,alternate_image_four,colour,product_type,keywords,brand_name,in_stock,reviews,rating,rrp_price,Fashion%3Asize,Fashion%3Acategory/format/csv/delimiter/%2C/compression/gzip/adultcontent/1/";

const CATEGORY_KEYWORDS = {
  dress: ["kleid"],
  bottom: ["hose", "jeans", "rock", "shorts", "leggins"],
  top: ["shirt", "bluse", "pullover", "pulli", "top", "jacke", "blazer", "strick", "sweat", "weste", "cardigan"],
};

const COLOR_DE_EN = {
  rot: "Red", blau: "Blue", lila: "Purple", grün: "Green", gruen: "Green", schwarz: "Black",
  weiß: "White", weiss: "White", grau: "Grey", beige: "Beige", braun: "Brown", rosa: "Pink",
  pink: "Pink", gelb: "Yellow", orange: "Orange", marine: "Navy", navy: "Navy", bordeaux: "Burgundy",
  khaki: "Khaki", creme: "Cream", türkis: "Teal", tuerkis: "Teal", oliv: "Olive", camel: "Camel",
  bunt: "Multicolor", taupe: "Taupe", anthrazit: "Charcoal",
};

const COLOR_FAMILY = {
  Red: "reds", Burgundy: "reds", Pink: "reds", Blue: "blues", Navy: "blues", Teal: "blues",
  Green: "greens", Olive: "earth tones", Khaki: "earth tones", Camel: "earth tones", Brown: "earth tones",
  Beige: "earth tones", Taupe: "earth tones", Cream: "neutrals", Black: "neutrals", White: "neutrals",
  Grey: "neutrals", Charcoal: "neutrals", Purple: "reds", Yellow: "earth tones", Orange: "earth tones",
  Multicolor: "neutrals",
};

function classify(name) {
  const low = name.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((k) => low.includes(k))) return cat;
  }
  return null;
}

function translateColor(c) {
  const low = (c || "").toLowerCase().trim();
  for (const [k, v] of Object.entries(COLOR_DE_EN)) {
    if (low.includes(k)) return v;
  }
  return (c || "").split("/")[0].trim() || "Multicolor";
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchStreetOneLive() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;

  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Street One feed error ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = zlib.gunzipSync(buf).toString("utf-8");

  const rows = parseCSV(text);
  const header = rows[0];
  const idx = (name) => header.indexOf(name);
  const iName = idx("product_name"), iImg = idx("merchant_image_url"), iPrice = idx("search_price"),
    iCur = idx("currency"), iLink = idx("aw_deep_link"), iColor = idx("colour"), iStock = idx("in_stock"),
    iId = idx("aw_product_id"),
    iAlt4 = idx("alternate_image_four"), iAlt3 = idx("alternate_image_three"),
    iAlt2 = idx("alternate_image_two"), iAlt1 = idx("alternate_image");

  const products = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < header.length) continue;
    const name = (row[iName] || "").trim();
    const cat = classify(name);
    if (!cat) continue;
    if (row[iStock] !== "1") continue;

    // Prefer the last available alternate image (tends to be a clean,
    // full-garment front shot); fall back through to merchant_image_url.
    const img = (
      (iAlt4 >= 0 && row[iAlt4]) ||
      (iAlt3 >= 0 && row[iAlt3]) ||
      (iAlt2 >= 0 && row[iAlt2]) ||
      (iAlt1 >= 0 && row[iAlt1]) ||
      row[iImg] ||
      ""
    ).trim();
    if (!img) continue;

    const price = parseFloat(row[iPrice]);
    if (!price) continue;
    const colorEn = translateColor(row[iColor]);
    products.push({
      id: "streetone_" + (row[iId] || r),
      retailer_id: "streetone",
      category: cat,
      name: name.length > 90 ? name.slice(0, 90) : name,
      description: name,
      color: colorEn,
      color_family: COLOR_FAMILY[colorEn] || "neutrals",
      pattern_type: "solid",
      price_amount: price,
      price_currency: (row[iCur] || "EUR").trim(),
      affiliate_url: (row[iLink] || "").trim(),
      image_url: img,
      image_readiness: "high",
      active: true,
      occasion_tags: cat === "dress" ? ["casual", "date"] : ["casual", "work"],
      season_tags: ["all_season"],
      fit_tags: ["regular"],
      sizes_available: [{ retailer_size: "one-size", eu_size_mapped: "one-size", in_stock: true }],
      size_chart_id: null,
    });
  }

  cache = products;
  cacheTime = now;
  return products;
}

export { fetchStreetOneLive };
