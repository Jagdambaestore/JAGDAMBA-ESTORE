const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let cats = [];
let products = [];
let orders = [];
let editing = null;

const $ = id => document.getElementById(id);

const money = n =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });


/* =========================
   ADMIN LOGIN
========================= */

async function check() {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (session) {
    show(session.user);
  }
}


if ($("login")) {
  $("login").onclick = async () => {

    $("loginMsg").textContent = "Logging in...";

    const { data, error } =
      await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });

    if (error) {
      $("loginMsg").textContent = error.message;
      return;
    }

    show(data.user);
  };
}


/* =========================
   SHOW ADMIN PANEL
========================= */

async function show(user) {

  const { data, error } =
    await db
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

  if (error || !data) {

    await db.auth.signOut();

    $("loginMsg").textContent =
      "This account is not an admin.";

    return;
  }

  $("loginBox").classList.add("hidden");
  $("panel").classList.remove("hidden");

  await load();
}


/* =========================
   LOGOUT
========================= */

if ($("logout")) {

  $("logout").onclick = async () => {

    await db.auth.signOut();

    location.reload();

  };

}


/* =========================
   LOAD PRODUCTS + CATEGORIES
========================= */

async function load() {

  const [c, p] = await Promise.all([

    db
      .from("categories")
      .select("*")
      .order("name"),

    db
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false
      })

  ]);


  if (c.error) {
    alert("Categories: " + c.error.message);
    return;
  }

  if (p.error) {
    alert("Products: " + p.error.message);
    return;
  }


  cats = c.data || [];
  products = p.data || [];


  if ($("pcat")) {

    $("pcat").innerHTML = cats
      .map(c =>
        `<option value="${c.id}">
          ${esc(c.name)}
        </option>`
      )
      .join("");

  }


  render();

}


/* =========================
   RENDER PRODUCTS
========================= */

function render() {

  if (!$("adminProducts")) return;


  $("adminProducts").innerHTML =
    products.map(p => `

      <article class="card">

        <img
          src="${url(p.image_url)}"
          style="
            width:100%;
            height:220px;
            object-fit:cover;
          "
        >

        <div class="card-body">

          <h3>${esc(p.name)}</h3>

          <div class="desc">
            ${esc(p.description || "")}
          </div>

          <div class="price">
            ₹${money(p.discount_price ?? p.price)}
          </div>

          <small>
            Delivery ₹${money(p.delivery_charge)}
            · Stock ${p.stock}
          </small>

          <br><br>

          <button onclick="editProduct(${p.id})">
            Edit
          </button>

          <button onclick="deleteProduct(${p.id})">
            Delete
          </button>

        </div>

      </article>

    `).join("");

}


/* =========================
   ADD PRODUCT
========================= */

if ($("newProduct")) {

  $("newProduct").onclick = () => {

    editing = null;

    clearForm();

    $("formTitle").textContent =
      "Add Product";

    $("formBox").classList.remove("hidden");

  };

}


/* =========================
   CANCEL PRODUCT
========================= */

if ($("cancel")) {

  $("cancel").onclick = () => {

    $("formBox").classList.add("hidden");

  };

}


/* =========================
   IMAGE PREVIEW
========================= */

if ($("pfile")) {

  $("pfile").onchange = () => {

    const f = $("pfile").files[0];

    if (f) {

      $("preview").src =
        URL.createObjectURL(f);

      $("preview").style.display =
        "block";

    }

  };

}


/* =========================
   UPLOAD IMAGE
========================= */

async function upload(file) {

  const ext =
    (file.name.split(".").pop() || "jpg")
      .toLowerCase();

  const path =
    `${crypto.randomUUID()}.${ext}`;


  const { error } =
    await db.storage
      .from("product-images")
      .upload(
        path,
        file,
        {
          upsert: false,
          contentType: file.type
        }
      );


  if (error) throw error;


  return db.storage
    .from("product-images")
    .getPublicUrl(path)
    .data
    .publicUrl;

}


/* =========================
   SAVE PRODUCT
========================= */

if ($("save")) {

  $("save").onclick = async () => {

    $("msg").textContent =
      "Saving...";


    try {

      const old =
        editing
          ? products.find(x => x.id === editing)
          : null;


      const file =
        $("pfile").files[0];


      let image =
        old?.image_url || null;


      if (file) {

        if (file.size > 5 * 1024 * 1024) {

          throw new Error(
            "Image 5 MB se chhoti honi chahiye."
          );

        }

        image = await upload(file);

      }


      const payload = {

        name: $("pname").value.trim(),

        description:
          $("pdesc").value.trim(),

        image_url: image,

        category_id:
          Number($("pcat").value) || null,

        price:
          Number($("pprice").value || 0),

        discount_price:
          $("pdiscount").value === ""
            ? null
            : Number($("pdiscount").value),

        delivery_charge:
          Number($("pdelivery").value || 0),

        stock:
          Number($("pstock").value || 0),

        is_active: true,

        updated_at:
          new Date().toISOString()

      };


      if (!payload.name ||
          payload.price < 0) {

        throw new Error(
          "Name and valid price required."
        );

      }


      const query =
        editing

          ? db
              .from("products")
              .update(payload)
              .eq("id", editing)

          : db
              .from("products")
              .insert(payload);


      const { error } =
        await query;


      if (error) throw error;


      $("formBox")
        .classList
        .add("hidden");


      await load();


    } catch (e) {

      $("msg").textContent =
        e.message ||
        "Upload failed.";

    }

  };

}


/* =========================
   EDIT PRODUCT
========================= */

window.editProduct = id => {

  const p =
    products.find(x => x.id === id);

  if (!p) return;


  editing = id;


  $("formTitle").textContent =
    "Edit Product";


  $("pname").value =
    p.name || "";

  $("pdesc").value =
    p.description || "";

  $("pcat").value =
    p.category_id || "";

  $("pprice").value =
    p.price ?? "";

  $("pdiscount").value =
    p.discount_price ?? "";

  $("pdelivery").value =
    p.delivery_charge ?? 0;

  $("pstock").value =
    p.stock ?? 0;

  $("pfile").value = "";


  $("preview").style.display =
    p.image_url
      ? "block"
      : "none";


  if (p.image_url) {

    $("preview").src =
      p.image_url;

  }


  $("formBox")
    .classList
    .remove("hidden");

};


/* =========================
   DELETE PRODUCT
========================= */

window.deleteProduct = async id => {

  if (!confirm("Delete this product?")) {
    return;
  }


  const { error } =
    await db
      .from("products")
      .delete()
      .eq("id", id);


  if (error) {

    alert(error.message);

    return;

  }


  await load();

};


/* =========================
   CLEAR PRODUCT FORM
========================= */

function clearForm() {

  $("pname").value = "";

  $("pdesc").value = "";

  $("pprice").value = "";

  $("pdiscount").value = "";

  $("pfile").value = "";

  $("preview").style.display =
    "none";

  $("pdelivery").value = 0;

  $("pstock").value = 0;

  $("msg").textContent = "";

}


/* =========================
   LOAD ORDERS
========================= */
/* =========================
   DASHBOARD SUMMARY
========================= */

function updateDashboardSummary() {

  const totalOrders = orders.length;

  const newOrders =
    orders.filter(o => o.order_status === "New").length;

  const packedOrders =
    orders.filter(o => o.order_status === "Packed").length;

  const shippedOrders =
    orders.filter(o => o.order_status === "Shipped").length;

  const outDeliveryOrders =
    orders.filter(o => o.order_status === "Out for Delivery").length;

  const deliveredOrders =
    orders.filter(o => o.order_status === "Delivered").length;

  const totalSales =
    orders
      .filter(o => o.order_status !== "Cancelled")
      .reduce(
        (sum, o) => sum + Number(o.total_amount || 0),
        0
      );

  const pendingPayments =
    orders.filter(
      o => (o.payment_status || "Pending") === "Pending"
    ).length;


  if ($("dashTotalOrders"))
    $("dashTotalOrders").textContent = totalOrders;

  if ($("dashNewOrders"))
    $("dashNewOrders").textContent = newOrders;

  if ($("dashPackedOrders"))
    $("dashPackedOrders").textContent = packedOrders;

  if ($("dashShippedOrders"))
    $("dashShippedOrders").textContent = shippedOrders;

  if ($("dashOutDeliveryOrders"))
    $("dashOutDeliveryOrders").textContent = outDeliveryOrders;

  if ($("dashDeliveredOrders"))
    $("dashDeliveredOrders").textContent = deliveredOrders;

  if ($("dashTotalSales"))
    $("dashTotalSales").textContent =
      "₹" + money(totalSales);

  if ($("dashPendingPayments"))
    $("dashPendingPayments").textContent =
      pendingPayments;

}
async function loadOrders() {

  const box =
    $("adminOrders");


  if (!box) return;


  box.innerHTML =
    `<p>Loading orders...</p>`;


  const { data, error } =
    await db
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false
      });


  if (error) {

    console.error(error);

    box.innerHTML =
      `<div class="card">
        <div class="card-body">
          <b>Orders load nahi ho rahe.</b>
          <p>${esc(error.message)}</p>
        </div>
      </div>`;

    return;

  }


  orders = data || [];
updateDashboardSummary();

  if (!orders.length) {

    box.innerHTML = "";

    $("ordersEmpty")
      .classList
      .remove("hidden");

    return;

  }


  $("ordersEmpty")
    .classList
    .add("hidden");


  box.innerHTML =
    orders.map(order => `

      <article
        class="card"
        style="margin-bottom:18px"
      >

        <div class="card-body">

          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:15px;
              flex-wrap:wrap;
            "
          >

            <div>

              <h3>
                📦 ${esc(order.order_number)}
              </h3>

              <p>
                <b>
                  ${esc(order.customer_name)}
                </b>
              </p>

              <p>
                📱 ${esc(order.customer_mobile)}
              </p>

            </div>


            <div>

              <div class="price">
                ₹${money(order.total_amount)}
              </div>

              <small>
                Payment:
                ${esc(order.payment_method || "-")}
              </small>

            </div>

          </div>


          <hr>


          <p>
            <b>Address:</b><br>
            ${esc(order.address || "")},
            ${esc(order.city || "")},
            ${esc(order.state || "")}
            - ${esc(order.pincode || "")}
          </p>


          <div style="margin:12px 0">

  <b>Payment Status:</b>

  <select
    class="search"
    style="width:100%;margin-top:6px"
    onchange="updatePaymentStatus(${order.id}, this.value)"
  >

    <option value="Pending" ${order.payment_status === "Pending" ? "selected" : ""}>
      Pending
    </option>

    <option value="Paid" ${order.payment_status === "Paid" ? "selected" : ""}>
      Paid
    </option>

    <option value="Failed" ${order.payment_status === "Failed" ? "selected" : ""}>
      Failed
    </option>

    <option value="Refunded" ${order.payment_status === "Refunded" ? "selected" : ""}>
      Refunded
    </option>

  </select>

</div>


         <div style="margin:12px 0">

  <b>Order Status:</b>

  <select
    class="search"
    style="width:100%;margin-top:6px"
    onchange="updateOrderStatus(${order.id}, this.value)"
  >

    <option value="New" ${order.order_status === "New" ? "selected" : ""}>
      New
    </option>

    <option value="Confirmed" ${order.order_status === "Confirmed" ? "selected" : ""}>
      Confirmed
    </option>
    
<option value="Packed" ${order.order_status === "Packed" ? "selected" : ""}>
  Packed
</option>

<option value="Out for Delivery" ${order.order_status === "Out for Delivery" ? "selected" : ""}>
  Out for Delivery
</option>

    <option value="Shipped" ${order.order_status === "Shipped" ? "selected" : ""}>
      Shipped
    </option>

    <option value="Delivered" ${order.order_status === "Delivered" ? "selected" : ""}>
      Delivered
    </option>

    <option value="Cancelled" ${order.order_status === "Cancelled" ? "selected" : ""}>
      Cancelled
    </option>

  </select>
<div style="margin:15px 0">

  <button
    type="button"
    class="primary"
    onclick="openWhatsApp(
      '${esc(order.customer_mobile)}',
      '${esc(order.customer_name)}',
      '${esc(order.order_number)}',
      '${esc(order.order_status || "New")}'
    )"
    style="width:100%;"
  >
    📱 WhatsApp Customer
  </button>

</div>
</div>


         <p>
  <b>Order Date:</b>
  ${formatDate(order.created_at)}
</p>



<button
  class="primary"
  type="button"
  onclick="viewOrder(${order.id})"
>
  View Order Items
</button>
        </div>

      </article>

    `).join("");

}
/* =========================
   WHATSAPP CUSTOMER
========================= */



/* =========================
   VIEW ORDER ITEMS
========================= */

window.viewOrder = async orderId => {

  const { data, error } =
    await db
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);


  if (error) {

    alert(error.message);

    return;

  }


  if (!data || !data.length) {

    alert("Order items nahi mile.");

    return;

  }


  let text =
    "ORDER ITEMS\n\n";


  data.forEach((item, index) => {

    text +=
      `${index + 1}. ${item.product_name}\n`;

    text +=
      `Qty: ${item.quantity}\n`;

    text +=
      `Price: ₹${money(item.price)}\n`;

    text +=
      `Total: ₹${money(item.total)}\n\n`;

  });


  alert(text);

};


/* =========================
   PRODUCTS / ORDERS TABS
========================= */

if ($("productsTab")) {

  $("productsTab").onclick = () => {

    $("productsSection")
      .classList
      .remove("hidden");

    $("ordersSection")
      .classList
      .add("hidden");

  };

}


if ($("ordersTab")) {

  $("ordersTab").onclick = async () => {

    $("productsSection")
      .classList
      .add("hidden");

    $("ordersSection")
      .classList
      .remove("hidden");

    await loadOrders();

  };

}


/* =========================
   REFRESH ORDERS
========================= */

if ($("refreshOrders")) {

  $("refreshOrders").onclick =
    loadOrders;

}


/* =========================
   HELPERS
========================= */

function esc(s) {

  return String(s ?? "")
    .replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));

}


function url(u) {

  return u &&
    /^https?:\/\//i.test(u)

    ? u

    : "https://placehold.co/600x600?text=Product";

}


function formatDate(value) {

  if (!value) return "-";

  try {

    return new Date(value)
      .toLocaleString("en-IN");

  } catch {

    return value;

  }

}


/* =========================
   START
========================= */
/* =========================
   UPDATE ORDER STATUS
========================= */

window.updateOrderStatus = async function(orderId, status) {

  const { error } = await db
    .from("orders")
    .update({
      order_status: status
    })
    .eq("id", orderId);

  if (error) {

    alert("Order status update nahi hua: " + error.message);

    return;
  }

  alert("Order status updated: " + status);

  await loadOrders();

};
window.updatePaymentStatus = async function(orderId, status) {

  const { error } = await db
    .from("orders")
    .update({
      payment_status: status
    })
    .eq("id", orderId);

  if (error) {
    alert("Payment status update nahi hua: " + error.message);
    return;
  }

  alert("Payment status updated: " + status);

  await loadOrders();
};
window.openWhatsApp = function(mobile, customerName, orderNumber, orderStatus) {

  let phone = String(mobile || "").replace(/\D/g, "");

  if (phone.length === 10) {
    phone = "91" + phone;
  }

  if (phone.length < 12) {
    alert("Customer mobile number valid nahi hai.");
    return;
  }

  const message =
`Hello ${customerName},

Jagdamba E-Store se aapke order ka update:

📦 Order Number: ${orderNumber}
📌 Order Status: ${orderStatus}

Aapke order ke liye dhanyavaad. 🙏

JAGDAMBA E-STORE`;

  const url =
    "https://wa.me/" +
    phone +
    "?text=" +
    encodeURIComponent(message);

  window.open(url, "_blank");
};
check();
