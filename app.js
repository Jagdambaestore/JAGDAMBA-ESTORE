const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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

async function loadData() {
  try {

    const [p, c] = await Promise.all([

     db
  .from("products")
  .select("*")
  .eq("is_active", true),
      db
        .from("categories")
        .select("*")
        .order("name")

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
    renderProducts();

  } catch (error) {

    console.error("Shop loading error:", error);
    alert("Shop loading error: " + error.message);

  }
}

function renderCategories() {

  const box = $("categories");

  if (!box) return;

  box.innerHTML =
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

function renderProducts() {

  const productBox = $("products");
  const emptyBox = $("empty");
  const searchBox = $("search");

  if (!productBox) return;

  const q = searchBox
    ? searchBox.value.toLowerCase().trim()
    : "";

  const list = products.filter((p) => {

    const name = String(p.name || "").toLowerCase();

    const description =
      String(p.description || "").toLowerCase();

    return (
      (!selectedCategory ||
        p.category_id === selectedCategory) &&

      (!q ||
        name.includes(q) ||
        description.includes(q))
    );

  });

  if (emptyBox) {

    emptyBox.classList.toggle(
      "hidden",
      list.length !== 0
    );

  }

  productBox.innerHTML = list.map((p) => {

    const price =
      Number(p.discount_price ?? p.price);

    const stock =
      Number(p.stock || 0);

    return `
      <article class="card">

        <img
          src="${safeUrl(p.image_url)}"
          alt="${escapeHtml(p.name)}"
          onerror="this.src='https://placehold.co/600x600?text=Product'"
        >

        <div class="card-body">

          <h3>${escapeHtml(p.name)}</h3>

          <div class="desc">
            ${escapeHtml(p.description || "")}
          </div>

          <div class="price">
            ₹${money(price)}

            ${
              p.discount_price != null
                ? `<span class="old">₹${money(p.price)}</span>`
                : ""
            }

          </div>

          <small>
            Delivery: ₹${money(p.delivery_charge)}
          </small>

          <br>

          <small>
            ${
              stock > 0
                ? `Stock: ${stock}`
                : "Out of stock"
            }
          </small>

          <br><br>

          <button
            ${stock <= 0 ? "disabled" : ""}
            onclick="addToCart(${Number(p.id)})"
          >
            ${
              stock > 0
                ? "Add to Cart"
                : "Out of Stock"
            }
          </button>

        </div>

      </article>
    `;

  }).join("");

}
function addToCart(id) {

  const p = products.find(
    x => Number(x.id) === Number(id)
  );

  if (!p) {
    alert("Product not found.");
    return;
  }

  const stock = Number(p.stock || 0);

  if (stock <= 0) {
    alert("This product is out of stock.");
    return;
  }

  const row = cart.find(
    x => Number(x.id) === Number(id)
  );

  if (row) {

    if (row.qty >= stock) {
      alert(`Available stock only ${stock}.`);
      return;
    }

    row.qty++;

  } else {

    cart.push({
      ...p,
      qty: 1
    });

  }

  renderCart();

}


function changeQty(id, change) {

  const row = cart.find(
    x => Number(x.id) === Number(id)
  );

  if (!row) return;

  const stock = Number(row.stock || 0);

  row.qty += change;

  if (row.qty <= 0) {

    cart = cart.filter(
      x => Number(x.id) !== Number(id)
    );

  } else if (row.qty > stock) {

    row.qty = stock;

    alert(`Available stock only ${stock}.`);

  }

  renderCart();

}


function removeFromCart(id) {

  cart = cart.filter(
    x => Number(x.id) !== Number(id)
  );

  renderCart();

}


function totals() {

  let subtotal = 0;

  cart.forEach(item => {

    const price =
      Number(item.discount_price ?? item.price ?? 0);

    subtotal += price * Number(item.qty || 0);

  });

  let delivery = 0;

  cart.forEach(item => {

    delivery +=
      Number(item.delivery_charge || 0) *
      Number(item.qty || 0);

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

  const count = cart.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );

  if (countBox) {
    countBox.textContent = count;
  }

  if (cart.length === 0) {

    box.innerHTML = `
      <p style="padding:20px;text-align:center">
        Your cart is empty.
      </p>
    `;

    if (totalBox) {
      totalBox.textContent = "0.00";
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = true;
    }

    return;
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = false;
  }

  box.innerHTML = cart.map(item => {

    const price =
      Number(item.discount_price ?? item.price ?? 0);

    const itemTotal =
      price * Number(item.qty || 0);

    return `
      <div class="cart-row">

        <img
          src="${safeUrl(item.image_url)}"
          alt="${escapeHtml(item.name)}"
          style="width:60px;height:60px;object-fit:cover;border-radius:8px"
        >

        <div style="flex:1">

          <strong>
            ${escapeHtml(item.name)}
          </strong>

          <div>
            ₹${money(price)}
          </div>

          <div style="display:flex;gap:8px;align-items:center;margin-top:6px">

            <button
              type="button"
              onclick="changeQty(${Number(item.id)},-1)"
            >
              −
            </button>

            <span>
              ${Number(item.qty)}
            </span>

            <button
              type="button"
              onclick="changeQty(${Number(item.id)},1)"
            >
              +
            </button>

            <button
              type="button"
              onclick="removeFromCart(${Number(item.id)})"
            >
              Remove
            </button>

          </div>

          <div style="margin-top:5px">
            Total: ₹${money(itemTotal)}
          </div>

        </div>

      </div>
    `;

  }).join("");

  const t = totals();

  if (totalBox) {
    totalBox.textContent = money(t.total);
  }

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

}


function closeCart() {

  const panel = $("cartPanel");
  const overlay = $("overlay");

  if (panel) {
    panel.classList.remove("open");
    panel.style.right = "-450px";
  }

  if (overlay) {
    overlay.classList.remove("show");
    overlay.style.display = "none";
  }

}


function openCheckout() {

  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  let old = $("checkoutModal");

  if (old) {
    old.remove();
  }

  const t = totals();

  old = document.createElement("div");

  old.id = "checkoutModal";

  old.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.55);
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
  `;

  old.innerHTML = `

    <div style="
      background:white;
      width:min(600px,100%);
      max-height:90vh;
      overflow:auto;
      border-radius:16px;
      padding:24px;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">

        <h2>Checkout</h2>

        <button
          type="button"
          id="closeCheckout"
        >
          ✕
        </button>

      </div>

      <input
        id="coName"
        placeholder="Customer Name"
        style="width:100%;padding:12px;margin:7px 0"
      >

      <input
        id="coMobile"
        placeholder="10-digit Mobile Number"
        maxlength="10"
        style="width:100%;padding:12px;margin:7px 0"
      >

      <textarea
        id="coAddress"
        placeholder="Full Address"
        style="width:100%;padding:12px;margin:7px 0"
      ></textarea>

      <input
        id="coCity"
        placeholder="City"
        style="width:100%;padding:12px;margin:7px 0"
      >

      <input
        id="coState"
        placeholder="State"
        style="width:100%;padding:12px;margin:7px 0"
      >

      <input
        id="coPincode"
        placeholder="6-digit Pincode"
        maxlength="6"
        style="width:100%;padding:12px;margin:7px 0"
      >

      <h3>Payment Method</h3>

      <label style="display:block;padding:12px;border:1px solid #ddd;border-radius:10px;margin-bottom:8px">

        <input
          type="radio"
          name="paymentMethod"
          value="COD"
          checked
        >

        💵 Cash on Delivery

      </label>

      <label style="display:block;padding:12px;border:1px solid #ddd;border-radius:10px">

        <input
          type="radio"
          name="paymentMethod"
          value="UPI"
        >

        📱 UPI Payment

      </label>

      <div
        id="upiPaymentBox"
        style="
          display:none;
          margin-top:12px;
          padding:15px;
          background:#f5f5f5;
          border-radius:10px;
        "
      >

        <p>
          <b>UPI ID:</b>
          anshul88266@okhdfcbank
        </p>

        <button
          type="button"
          id="copyCheckoutUPI"
        >
          Copy UPI ID
        </button>

        <p style="font-size:13px">
          UPI payment karne ke baad
          <b>PAYMENT DONE — PLACE ORDER</b>
          par click karein.
        </p>

      </div>

      <div style="
        margin-top:15px;
        padding:15px;
        background:#f5f5f5;
        border-radius:10px;
      ">

        <div>
          Subtotal:
          ₹${money(t.subtotal)}
        </div>

        <div>
          Delivery:
          ₹${money(t.delivery)}
        </div>

        <h3>
          Total:
          ₹${money(t.total)}
        </h3>

      </div>

      <p
        id="checkoutMsg"
        style="color:#d00"
      ></p>

      <button
        type="button"
        id="placeOrder"
        style="
          width:100%;
          padding:14px;
          margin-top:10px;
          border:0;
          border-radius:10px;
          cursor:pointer;
        "
      >
        PLACE ORDER — COD
      </button>

    </div>
  `;

  document.body.appendChild(old);

  $("closeCheckout").onclick = () => {
    old.remove();
  };

  const paymentRadios =
    document.querySelectorAll(
      'input[name="paymentMethod"]'
    );

  const upiBox = $("upiPaymentBox");
  const placeBtn = $("placeOrder");

  paymentRadios.forEach(radio => {

    radio.addEventListener("change", () => {

      if (radio.checked && radio.value === "UPI") {

        upiBox.style.display = "block";

        placeBtn.textContent =
          "PAYMENT DONE — PLACE ORDER";

      }

      if (radio.checked && radio.value === "COD") {

        upiBox.style.display = "none";

        placeBtn.textContent =
          "PLACE ORDER — COD";

      }

    });

  });

  $("copyCheckoutUPI").onclick = () => {

    const upi = "anshul88266@okhdfcbank";

    if (navigator.clipboard) {

      navigator.clipboard
        .writeText(upi)
        .then(() => {
          alert("UPI ID copied successfully!");
        })
        .catch(() => {
          alert("UPI ID: " + upi);
        });

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

  const selectedPayment =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  const paymentMethod =
    selectedPayment
      ? selectedPayment.value
      : "COD";

  const t = totals();

  const orderNo =
    "JDS-" +
    Date.now().toString().slice(-8);

  msg.textContent =
    "Order place ho raha hai...";

  const { data: order, error } =
    await db
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
        payment_status:
          paymentMethod === "UPI"
            ? "Paid"
            : "Pending",

        order_status: "New",

        subtotal: t.subtotal,
        delivery_charge: t.delivery,
        total_amount: t.total

      })
      .select("id,order_number")
      .single();

  if (error) {

    console.error(error);

    msg.textContent =
      error.message;

    return;
  }

  const items = cart.map(x => {

    const price =
      Number(
        x.discount_price ??
        x.price ??
        0
      );

    return {

      order_id: order.id,
      product_id: x.id,
      product_name: x.name,
      price: price,
      quantity: x.qty,
      total: price * x.qty

    };

  });

  const { error: itemError } =
    await db
      .from("order_items")
      .insert(items);

  if (itemError) {

    console.error(itemError);

    msg.textContent =
      itemError.message;

    await db
      .from("orders")
      .delete()
      .eq("id", order.id);

    return;
  }

  cart = [];

  renderCart();

  const modal =
    $("checkoutModal");

  if (!modal) return;

  modal.querySelector(
    "div > div"
  ).innerHTML = `

    <div style="
      text-align:center;
      padding:25px;
    ">

      <h2>
        🎉 Order Placed Successfully
      </h2>

      <p>
        Your Order Number
      </p>

      <h1>
        ${escapeHtml(order.order_number)}
      </h1>

      <p>
        Payment:
        <b>
          ${paymentMethod === "UPI"
            ? "UPI"
            : "Cash on Delivery"}
        </b>
      </p>

      <p>
        Order details admin panel mein
        save ho gaye hain.
      </p>

      <button
        type="button"
        id="doneOrder"
        style="
          padding:12px 22px;
          border:0;
          border-radius:10px;
        "
      >
        Done
      </button>

    </div>
  `;

  $("doneOrder").onclick =
    () => modal.remove();

}


document.addEventListener(
  "DOMContentLoaded",
  function () {

    const cartBtn =
      $("cartBtn");

    const closeBtn =
      $("closeCart");

    const overlay =
      $("overlay");

    const checkoutBtn =
      $("checkoutBtn");

    const searchBox =
      $("search");

    if (cartBtn) {
      cartBtn.onclick =
        openCart;
    }

    if (closeBtn) {
      closeBtn.onclick =
        closeCart;
    }

    if (overlay) {
      overlay.onclick =
        closeCart;
    }

    if (checkoutBtn) {
      checkoutBtn.onclick =
        openCheckout;
    }

    if (searchBox) {
      searchBox.addEventListener(
        "input",
        renderProducts
      );
    }

    loadData();

    renderCart();

  }
);
