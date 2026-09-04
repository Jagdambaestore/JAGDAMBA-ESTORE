const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [], categories = [], cart = [], selectedCategory = null;

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

async function loadData() {
  const [p, c] = await Promise.all([
    db.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    db.from("categories").select("*").order("name")
  ]);

  if (p.error) {
    console.error(p.error);
    alert("Products load nahi ho pa rahe. Supabase URL/Key ya database columns check karein.");
    return;
  }

  products = p.data || [];
  categories = c.data || [];
  renderCategories();
  renderProducts();
}

function renderCategories() {
  $("categories").innerHTML =
    `<button class="chip ${!selectedCategory ? "active" : ""}" onclick="filterCategory(null)">All</button>` +
    categories.map(c =>
      `<button class="chip ${selectedCategory === c.id ? "active" : ""}" onclick="filterCategory(${c.id})">${escapeHtml(c.name)}</button>`
    ).join("");
}

function filterCategory(id) {
  selectedCategory = id;
  renderCategories();
  renderProducts();
}

function getAffiliateLinks(p) {
  return [
    { key: "amazon", label: "Amazon", url: p.amazon_url, cls: "aff-amazon" },
    { key: "flipkart", label: "Flipkart", url: p.flipkart_url, cls: "aff-flipkart" },
    { key: "meesho", label: "Meesho", url: p.meesho_url, cls: "aff-meesho" }
  ].filter(x => x.url && /^https?:\/\//i.test(x.url));
}

function renderProducts() {
  const q = ($("search").value || "").toLowerCase().trim();

  const list = products.filter(p =>
    (!selectedCategory || p.category_id === selectedCategory) &&
    (!q ||
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.description || "").toLowerCase().includes(q))
  );

  $("empty").classList.toggle("hidden", list.length !== 0);

  $("products").innerHTML = list.map(p => {
    const price = p.discount_price ?? p.price;
    const links = getAffiliateLinks(p);
    const isAffiliate = p.product_type === "affiliate" || links.length > 0;

    const affiliateButtons = links.length
      ? `<div class="affiliate-buttons">
          ${links.map(x =>
            `<button class="affiliate-btn ${x.cls}" onclick="openAffiliate(${p.id}, '${x.key}', '${escapeJs(x.url)}')">
              Buy on ${x.label}
            </button>`
          ).join("")}
         </div>`
      : "";

    const normalButton = !isAffiliate
      ? `<button class="primary full" onclick="addToCart(${p.id})">Add to Cart</button>`
      : "";

    const marketplaceNote = isAffiliate
      ? `<div class="affiliate-note">You will complete your purchase on the selected marketplace.</div>`
      : "";

    return `<article class="card">
      <div class="product-image-wrap">
        <img src="${safeUrl(p.image_url)}" alt="${escapeHtml(p.name)}"
             onerror="this.src='https://placehold.co/600x600?text=Product'">
        ${isAffiliate ? `<span class="affiliate-badge">AFFILIATE DEAL</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="desc">${escapeHtml(p.description || "")}</div>
        <div class="price">₹${money(price)}
          ${p.discount_price != null ? `<span class="old">₹${money(p.price)}</span>` : ""}
        </div>
        ${isAffiliate ? marketplaceNote + affiliateButtons : `
          <small>Delivery: ₹${money(p.delivery_charge)}</small><br><br>${normalButton}
        `}
      </div>
    </article>`;
  }).join("");
}

$("search").addEventListener("input", renderProducts);

async function openAffiliate(productId, marketplace, url) {
  if (!/^https?:\/\//i.test(url)) return;

  // Tracking is best-effort. The marketplace link still opens if tracking fails.
  try {
    await db.from("affiliate_clicks").insert({
      product_id: productId,
      marketplace: marketplace
    });
  } catch (e) {
    console.warn("Affiliate click tracking failed:", e);
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const row = cart.find(x => x.id === id);
  if (row) row.qty++;
  else cart.push({ ...p, qty: 1 });
  renderCart();
  openCart();
}

function renderCart() {
  $("cartCount").textContent = cart.reduce((s, x) => s + x.qty, 0);

  $("cartItems").innerHTML = cart.length
    ? cart.map(x => `<div class="cart-row">
        <img src="${safeUrl(x.image_url)}" onerror="this.src='https://placehold.co/100x100?text=Product'">
        <div style="flex:1">
          <b>${escapeHtml(x.name)}</b>
          <div>₹${money(x.discount_price ?? x.price)} × ${x.qty}</div>
          <button onclick="removeItem(${x.id})">Remove</button>
        </div>
      </div>`).join("")
    : "<p>Your cart is empty.</p>";

  $("cartTotal").textContent = money(
    cart.reduce((s, x) =>
      s + (Number(x.discount_price ?? x.price) + Number(x.delivery_charge || 0)) * x.qty, 0
    )
  );
}

function removeItem(id) {
  cart = cart.filter(x => x.id !== id);
  renderCart();
}

function openCart() {
  $("cartPanel").classList.add("open");
  $("overlay").classList.add("show");
}

function closeCart() {
  $("cartPanel").classList.remove("open");
  $("overlay").classList.remove("show");
}

$("cartBtn").onclick = openCart;
$("closeCart").onclick = closeCart;
$("overlay").onclick = closeCart;

$("checkoutBtn").onclick = () => {
  alert("Normal store checkout yahan continue hoga. Affiliate products ke liye Buy on Amazon/Flipkart/Meesho button use karein.");
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function escapeJs(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function safeUrl(u) {
  return u && /^https?:\/\//i.test(u)
    ? u
    : "https://placehold.co/600x600?text=Product";
}

loadData();
renderCart();
