const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cats = [];
let products = [];
let editing = null;

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});

async function check() {
  const { data: { session } } = await db.auth.getSession();
  if (session) await show(session.user);
}

if ($("login")) {
  $("login").onclick = async () => {
    $("loginMsg").textContent = "Logging in...";

    const { data, error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) {
      $("loginMsg").textContent = error.message;
      return;
    }

    await show(data.user);
  };
}

async function show(user) {
  const { data, error } = await db
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    await db.auth.signOut();
    $("loginMsg").textContent = "This account is not an admin.";
    return;
  }

  $("loginBox").classList.add("hidden");
  $("panel").classList.remove("hidden");
  await load();
}

if ($("logout")) {
  $("logout").onclick = async () => {
    await db.auth.signOut();
    location.reload();
  };
}

async function load() {
  const [c, p] = await Promise.all([
    db.from("categories").select("*").order("name"),
    db.from("products").select("*").order("created_at", { ascending: false })
  ]);

  if (c.error) return alert("Categories: " + c.error.message);
  if (p.error) return alert("Products: " + p.error.message);

  cats = c.data || [];
  products = p.data || [];

  $("pcat").innerHTML = cats.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join("");

  render();
  toggleAffiliateFields();
}

function render() {
  if (!$("adminProducts")) return;

  $("adminProducts").innerHTML = products.map(p => {
    const isAffiliate = p.product_type === "affiliate" ||
      p.amazon_url || p.flipkart_url || p.meesho_url;

    const marketplaces = [
      p.amazon_url ? "Amazon" : "",
      p.flipkart_url ? "Flipkart" : "",
      p.meesho_url ? "Meesho" : ""
    ].filter(Boolean).join(" • ");

    return `<article class="card">
      <div class="product-image-wrap">
        <img src="${url(p.image_url)}" style="width:100%;height:220px;object-fit:cover"
             onerror="this.src='https://placehold.co/600x600?text=Product'">
        ${isAffiliate ? `<span class="affiliate-badge">AFFILIATE</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${esc(p.name)}</h3>
        <div class="desc">${esc(p.description || "")}</div>
        <div class="price">₹${money(p.discount_price ?? p.price)}</div>
        <small>
          Type: ${isAffiliate ? "Affiliate" : "Normal"} ·
          Stock: ${p.stock ?? 0}
        </small>
        ${isAffiliate ? `<div class="affiliate-admin-list">${esc(marketplaces || "No marketplace link")}</div>` : ""}
        <br>
        <button onclick="editProduct(${p.id})">Edit</button>
        <button onclick="deleteProduct(${p.id})">Delete</button>
      </div>
    </article>`;
  }).join("");
}

if ($("newProduct")) {
  $("newProduct").onclick = () => {
    editing = null;
    clearForm();
    $("formTitle").textContent = "Add Product";
    $("formBox").classList.remove("hidden");
  };
}

if ($("cancel")) {
  $("cancel").onclick = () => $("formBox").classList.add("hidden");
}

if ($("ptype")) $("ptype").onchange = toggleAffiliateFields;

function toggleAffiliateFields() {
  if (!$("affiliateFields")) return;
  $("affiliateFields").style.display =
    $("ptype").value === "affiliate" ? "block" : "none";
}

if ($("save")) {
  $("save").onclick = async () => {
    $("msg").textContent = "Saving...";

    try {
      const payload = {
        name: $("pname").value.trim(),
        description: $("pdesc").value.trim(),
        image_url: $("pimage").value.trim() || null,
        category_id: Number($("pcat").value) || null,
        product_type: $("ptype").value,
        amazon_url: cleanUrl($("amazonUrl").value),
        flipkart_url: cleanUrl($("flipkartUrl").value),
        meesho_url: cleanUrl($("meeshoUrl").value),
        price: Number($("pprice").value || 0),
        discount_price: $("pdiscount").value === "" ? null : Number($("pdiscount").value),
        delivery_charge: Number($("pdelivery").value || 0),
        stock: Number($("pstock").value || 0),
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (!payload.name || payload.price < 0) {
        throw new Error("Product name and valid price required.");
      }

      if (payload.product_type === "affiliate" &&
          !payload.amazon_url && !payload.flipkart_url && !payload.meesho_url) {
        throw new Error("Affiliate product ke liye kam se kam 1 marketplace link add karein.");
      }

      const query = editing
        ? db.from("products").update(payload).eq("id", editing)
        : db.from("products").insert(payload);

      const { error } = await query;
      if (error) throw error;

      $("formBox").classList.add("hidden");
      $("msg").textContent = "";
      await load();

    } catch (e) {
      $("msg").textContent = e.message || "Save failed.";
    }
  };
}

window.editProduct = id => {
  const p = products.find(x => x.id === id);
  if (!p) return;

  editing = id;
  $("formTitle").textContent = "Edit Product";

  $("pname").value = p.name || "";
  $("pdesc").value = p.description || "";
  $("pimage").value = p.image_url || "";
  $("pcat").value = p.category_id || "";
  $("ptype").value = p.product_type || (
    p.amazon_url || p.flipkart_url || p.meesho_url ? "affiliate" : "normal"
  );
  $("amazonUrl").value = p.amazon_url || "";
  $("flipkartUrl").value = p.flipkart_url || "";
  $("meeshoUrl").value = p.meesho_url || "";
  $("pprice").value = p.price ?? "";
  $("pdiscount").value = p.discount_price ?? "";
  $("pdelivery").value = p.delivery_charge ?? 0;
  $("pstock").value = p.stock ?? 0;

  toggleAffiliateFields();
  $("formBox").classList.remove("hidden");
};

window.deleteProduct = async id => {
  if (!confirm("Delete this product?")) return;

  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return alert(error.message);

  await load();
};

function clearForm() {
  $("pname").value = "";
  $("pdesc").value = "";
  $("pimage").value = "";
  $("pprice").value = "";
  $("pdiscount").value = "";
  $("pdelivery").value = 0;
  $("pstock").value = 0;
  $("ptype").value = "normal";
  $("amazonUrl").value = "";
  $("flipkartUrl").value = "";
  $("meeshoUrl").value = "";
  $("msg").textContent = "";
  toggleAffiliateFields();
}

function cleanUrl(value) {
  const u = String(value || "").trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function url(u) {
  return u && /^https?:\/\//i.test(u)
    ? u
    : "https://placehold.co/600x600?text=Product";
}

check();
