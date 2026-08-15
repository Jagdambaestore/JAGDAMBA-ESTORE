const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [];
let categories = [];
let cart = [];
let selectedCategory = null;

const $ = (id) => document.getElementById(id);

const money = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function safeUrl(u) {
  return u && /^https?:\/\//i.test(u)
    ? u
    : "https://placehold.co/600x600?text=Product";
}

function categoryIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("elect")) return "📱";
  if (n.includes("men")) return "👕";
  if (n.includes("women") || n.includes("fashion")) return "👗";
  if (n.includes("kid")) return "👶";
  if (n.includes("toy")) return "🧸";
  if (n.includes("sport") || n.includes("fitness")) return "🏋️";
  if (n.includes("beauty") || n.includes("cosmetic")) return "💄";
  if (n.includes("mobile")) return "🔌";
  if (n.includes("access")) return "🎧";
  return "🛍️";
}

async function loadData() {
  try {
    const [p, c] = await Promise.all([
      db.from("products").select("*").eq("is_active", true),
      db.from("categories").select("*").order("name")
    ]);

    if (p.error) {
      console.error("Products error:", p.error);
      alert("Products load nahi ho pa rahe: " + p.error.message);
      return;
    }

    if (c.error) {
      console.error("Categories error:", c.error);
      alert("Categories load nahi ho rahi: " + c.error.message);
      return;
    }

    products = p.data || [];
    categories = c.data || [];

    renderCategories();
    renderCategoryShowcase();
    renderProducts();
  } catch (error) {
    console.error("Shop loading error:", error);
    alert("Shop loading error: " + error.message);
  }
}

function renderCategoryShowcase() {
  const box = $("categoryShowcase");
  if (!box) return;

  if (!categories.length) {
    box.innerHTML = `
      <div class="category-tile">
        <span class="category-icon">🛍️</span>
        <h3>All Products</h3>
        <p>Explore our store</p>
      </div>`;
    return;
  }

  box.innerHTML = categories.slice(0, 8).map(c => `
    <button class="category-tile" type="button" onclick="filterCategory(${Number(c.id)}); document.getElementById('shop').scrollIntoView({behavior:'smooth'})">
      <span class="category-icon">${categoryIcon(c.name)}</span>
      <h3>${escapeHtml(c.name)}</h3>
      <p>Shop now →</p>
    </button>
  `).join("");
}

function renderCategories() {
  const box = $("categories");
  if (!box) return;

  box.innerHTML =
    `<button class="chip ${!selectedCategory ? "active" : ""}" onclick="filterCategory(null)">All Products</button>` +
    categories.map(c =>
      `<button class="chip ${selectedCategory === c.id ? "active" : ""}" onclick="filterCategory(${Number(c.id)})">${categoryIcon(c.name)} ${escapeHtml(c.name)}</button>`
    ).join("");
}

function filterCategory(id) {
  selectedCategory = id;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const productBox = $("products");
  const emptyBox = $("empty");
  const searchBox = $("search");

  if (!productBox) return;

  const q = searchBox ? searchBox.value.toLowerCase().trim() : "";

  const list = products.filter((p) => {
    const name = String(p.name || "").toLowerCase();
    const description = String(p.description || "").toLowerCase();

    return (
      (!selectedCategory || p.category_id === selectedCategory) &&
      (!q || name.includes(q) || description.includes(q))
    );
  });

  if (emptyBox) emptyBox.classList.toggle("hidden", list.length !== 0);

  productBox.innerHTML = list.map((p) => {
    const price = Number(p.discount_price ?? p.price);
    const original = Number(p.price || 0);
    const stock = Number(p.stock || 0);

    let discount = 0;
    if (p.discount_price != null && original > price) {
      discount = Math.round(((original - price) / original) * 100);
    }

    return `
      <article class="card">
        <div class="product-image-wrap">
          <img
            src="${safeUrl(p.image_url)}"
            alt="${escapeHtml(p.name)}"
            onerror="this.src='https://placehold.co/600x600?text=Product'"
          >
          <span class="product-badge ${stock <= 0 ? "out" : ""}">
            ${stock > 0 ? "IN STOCK" : "SOLD OUT"}
          </span>
          ${discount > 0 ? `<span class="product-discount">${discount}% OFF</span>` : ""}
        </div>

        <div class="card-body">
          <div class="rating">★★★★★ <span>Popular choice</span></div>
          <h3>${escapeHtml(p.name)}</h3>

          <div class="desc">
            ${escapeHtml(p.description || "Quality product from Jagdamba E-Store.")}
          </div>

          <div class="price">
            ₹${money(price)}
            ${p.discount_price != null ? `<span class="old">₹${money(original)}</span>` : ""}
          </div>

          <div class="product-meta">
            <span>🚚 Delivery: ₹${money(p.delivery_charge)}</span>
            <span class="${stock > 0 ? "stock-ok" : "stock-out"}">
              ${stock > 0 ? `Stock ${stock}` : "Out of stock"}
            </span>
          </div>

          <button
            ${stock <= 0 ? "disabled" : ""}
            onclick="addToCart(${Number(p.id)})"
            type="button"
          >
            ${stock > 0 ? "🛒 Add to Cart" : "Out of Stock"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function addToCart(id) {
  const p = products.find(x => Number(x.id) === Number(id));

  if (!p) {
    alert("Product not found.");
    return;
  }

  const stock = Number(p.stock || 0);

  if (stock <= 0) {
    alert("This product is out of stock.");
    return;
  }

  const row = cart.find(x => Number(x.id) === Number(id));

  if (row) {
    if (row.qty >= stock) {
      alert(`Available stock only ${stock}.`);
      return;
    }
    row.qty++;
  } else {
    cart.push({ ...p, qty: 1 });
  }

  renderCart();
  openCart();
}

function changeQty(id, change) {
  const row = cart.find(x => Number(x.id) === Number(id));
  if (!row) return;

  const stock = Number(row.stock || 0);
  row.qty += change;

  if (row.qty <= 0) {
    cart = cart.filter(x => Number(x.id) !== Number(id));
  } else if (row.qty > stock) {
    row.qty = stock;
    alert(`Available stock only ${stock}.`);
  }

  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(x => Number(x.id) !== Number(id));
  renderCart();
}

function totals() {
  let subtotal = 0;
  let delivery = 0;

  cart.forEach(item => {
    const price = Number(item.discount_price ?? item.price ?? 0);
    subtotal += price * Number(item.qty || 0);
    delivery += Number(item.delivery_charge || 0) * Number(item.qty || 0);
  });

  return {
    subtotal,
    delivery,
    total: subtotal + delivery
  };
}

function renderCart() {
  const box = $("cartItems");
  const countBox = $("cartCount");
  const totalBox = $("cartTotal");
  const checkoutBtn = $("checkoutBtn");

  if (!box) return;

  const count = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  if (countBox) countBox.textContent = count;

  if (cart.length === 0) {
    box.innerHTML = `
      <div style="padding:45px 10px;text-align:center;color:#747d8d">
        <div style="font-size:42px;margin-bottom:10px">🛒</div>
        <strong>Your cart is empty</strong>
        <p style="font-size:12px">Add something you love to continue.</p>
      </div>
    `;

    if (totalBox) totalBox.textContent = "0.00";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  box.innerHTML = cart.map(item => {
    const price = Number(item.discount_price ?? item.price ?? 0);
    const itemTotal = price * Number(item.qty || 0);

    return `
      <div class="cart-row">
        <img
          src="${safeUrl(item.image_url)}"
          alt="${escapeHtml(item.name)}"
        >

        <div style="flex:1">
          <strong>${escapeHtml(item.name)}</strong>
          <div style="margin-top:4px">₹${money(price)}</div>

          <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
            <button type="button" onclick="changeQty(${Number(item.id)},-1)">−</button>
            <span style="font-weight:800">${Number(item.qty)}</span>
            <button type="button" onclick="changeQty(${Number(item.id)},1)">+</button>
            <button type="button" onclick="removeFromCart(${Number(item.id)})">Remove</button>
          </div>

          <div style="margin-top:7px;color:#6f7789;font-size:11px">
            Item total: ₹${money(itemTotal)}
          </div>
        </div>
      </div>
    `;
  }).join("");

  const t = totals();
  if (totalBox) totalBox.textContent = money(t.total);
}

function openCart() {
  const panel = $("cartPanel");
  const overlay = $("overlay");

  if (panel) {
    panel.classList.add("open");
    panel.style.right = "0";
  }

  if (overlay) {
    overlay.classList.add("show");
    overlay.style.display = "block";
  }

  document.body.classList.add("cart-open");
}

function closeCart() {
  const panel = $("cartPanel");
  const overlay = $("overlay");

  if (panel) {
    panel.classList.remove("open");
    panel.style.right = "-470px";
  }

  if (overlay) {
    overlay.classList.remove("show");
    overlay.style.display = "none";
  }

  document.body.classList.remove("cart-open");
}

function openCheckout() {
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  let old = $("checkoutModal");
  if (old) old.remove();

  const t = totals();

  old = document.createElement("div");
  old.id = "checkoutModal";
  old.className = "checkout-modal";

  old.innerHTML = `
    <div class="checkout-box">
      <div class="checkout-head">
        <div>
          <span class="eyebrow">SECURE CHECKOUT</span>
          <h2>Complete Your Order</h2>
        </div>
        <button type="button" class="checkout-close" id="closeCheckout">✕</button>
      </div>

      <div class="checkout-form">
        <input class="checkout-field" id="coName" placeholder="Customer Name">
        <input class="checkout-field" id="coMobile" placeholder="10-digit Mobile Number" maxlength="10">
        <textarea class="checkout-address" id="coAddress" placeholder="Full Address"></textarea>
        <input class="checkout-field" id="coCity" placeholder="City">
        <input class="checkout-field" id="coState" placeholder="State">
        <input class="checkout-field" id="coPincode" placeholder="6-digit Pincode" maxlength="6">
      </div>

      <div class="checkout-payment">
        <h3>Payment Method</h3>

        <label class="payment-option">
          <input type="radio" name="paymentMethod" value="COD" checked>
          💵 Cash on Delivery
        </label>

        <label class="payment-option">
          <input type="radio" name="paymentMethod" value="UPI">
          📱 UPI Payment
        </label>

        <div id="upiPaymentBox" class="upi-box">
          <div><b>UPI ID:</b> anshul88266@okhdfcbank</div>
          <button type="button" id="copyCheckoutUPI" class="secondary-btn" style="margin-top:10px;min-height:38px;padding:8px 12px">
            Copy UPI ID
          </button>
          <p style="font-size:11px;color:#6f7789;margin:9px 0 0">
            UPI payment karne ke baad <b>PAYMENT DONE — PLACE ORDER</b> par click karein.
          </p>
        </div>
      </div>

      <div class="checkout-total-box">
        <div><span>Subtotal</span><span>₹${money(t.subtotal)}</span></div>
        <div><span>Delivery</span><span>₹${money(t.delivery)}</span></div>
        <h3><span>Total</span><span>₹${money(t.total)}</span></h3>
      </div>

      <p id="checkoutMsg" class="checkout-msg"></p>

      <button type="button" id="placeOrder" class="primary full">
        PLACE ORDER — COD
      </button>
    </div>
  `;

  document.body.appendChild(old);

  $("closeCheckout").onclick = () => old.remove();

  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  const upiBox = $("upiPaymentBox");
  const placeBtn = $("placeOrder");

  paymentRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.checked && radio.value === "UPI") {
        upiBox.style.display = "block";
        placeBtn.textContent = "PAYMENT DONE — PLACE ORDER";
      }

      if (radio.checked && radio.value === "COD") {
        upiBox.style.display = "none";
        placeBtn.textContent = "PLACE ORDER — COD";
      }
    });
  });

  $("copyCheckoutUPI").onclick = () => {
    const upi = "anshul88266@okhdfcbank";

    if (navigator.clipboard) {
      navigator.clipboard.writeText(upi)
        .then(() => alert("UPI ID copied successfully!"))
        .catch(() => alert("UPI ID: " + upi));
    } else {
      alert("UPI ID: " + upi);
    }
  };

  $("placeOrder").onclick = placeOrder;
}

async function placeOrder() {
  const name = $("coName").value.trim();
  const mobile = $("coMobile").value.trim();
  const address = $("coAddress").value.trim();
  const city = $("coCity").value.trim();
  const state = $("coState").value.trim();
  const pincode = $("coPincode").value.trim();
  const msg = $("checkoutMsg");

  if (
    !name ||
    !/^\d{10}$/.test(mobile) ||
    !address ||
    !city ||
    !state ||
    !/^\d{6}$/.test(pincode)
  ) {
    msg.textContent =
      "Name, valid 10-digit mobile, address, city, state aur 6-digit pincode bharna zaroori hai.";
    return;
  }

  const selectedPayment = document.querySelector(
    'input[name="paymentMethod"]:checked'
  );

  const paymentMethod = selectedPayment ? selectedPayment.value : "COD";
  const t = totals();

  const orderNo = "JDS-" + Date.now().toString().slice(-8);

  msg.textContent = "Order place ho raha hai...";

  const { data: order, error } = await db
    .from("orders")
    .insert({
      order_number: orderNo,
      customer_name: name,
      customer_mobile: mobile,
      address,
      city,
      state,
      pincode,
      payment_method: paymentMethod,
      payment_status: paymentMethod === "UPI" ? "Paid" : "Pending",
      order_status: "New",
      subtotal: t.subtotal,
      delivery_charge: t.delivery,
      total_amount: t.total
    })
    .select("id,order_number")
    .single();

  if (error) {
    console.error(error);
    msg.textContent = error.message;
    return;
  }

  const items = cart.map(x => {
    const price = Number(x.discount_price ?? x.price ?? 0);

    return {
      order_id: order.id,
      product_id: x.id,
      product_name: x.name,
      price,
      quantity: x.qty,
      total: price * x.qty
    };
  });

  const { error: itemError } = await db
    .from("order_items")
    .insert(items);

  if (itemError) {
    console.error(itemError);
    msg.textContent = itemError.message;

    await db
      .from("orders")
      .delete()
      .eq("id", order.id);

    return;
  }

  cart = [];
  renderCart();

  const modal = $("checkoutModal");
  if (!modal) return;

  modal.querySelector(".checkout-box").innerHTML = `
    <div class="success-order">
      <div class="success-icon">🎉</div>
      <span class="eyebrow">ORDER CONFIRMED</span>
      <h2>Order Placed Successfully</h2>
      <p style="color:#6f7789">Your Order Number</p>
      <div class="order-number">${escapeHtml(order.order_number)}</div>
      <p>Payment: <b>${paymentMethod === "UPI" ? "UPI" : "Cash on Delivery"}</b></p>
      <p style="color:#6f7789;font-size:12px">Order details admin panel mein save ho gaye hain.</p>
      <button type="button" id="doneOrder" class="primary" style="margin-top:10px">Done</button>
    </div>
  `;

  $("doneOrder").onclick = () => modal.remove();
}

document.addEventListener("DOMContentLoaded", function () {
  const cartBtn = $("cartBtn");
  const closeBtn = $("closeCart");
  const overlay = $("overlay");
  const checkoutBtn = $("checkoutBtn");
  const searchBox = $("search");

  if (cartBtn) cartBtn.onclick = openCart;
  if (closeBtn) closeBtn.onclick = closeCart;
  if (overlay) overlay.onclick = closeCart;
  if (checkoutBtn) checkoutBtn.onclick = openCheckout;

  if (searchBox) {
    searchBox.addEventListener("input", renderProducts);
  }

  loadData();
  renderCart();
});
/* ===== CHECKOUT BUTTON CLICK FIX ===== */

document.addEventListener("click", function (event) {

  const checkoutButton = event.target.closest("#checkoutBtn");

  if (!checkoutButton) return;

  event.preventDefault();
  event.stopPropagation();

  if (checkoutButton.disabled) {
    alert("Cart is empty.");
    return;
  }

  if (typeof openCheckout === "function") {
    openCheckout();
  } else {
    alert("Checkout system load nahi hua. Please refresh the page.");
    console.error("openCheckout function not found");
  }

}, true);
/* ===== FINAL CHECKOUT CLICK HANDLER ===== */
/* ===== FINAL CHECKOUT BUTTON ===== */

document.addEventListener("click", function (event) {

  const button = event.target.closest("#checkoutBtn");

  if (!button) return;

  event.preventDefault();

  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  openCheckout();

});

