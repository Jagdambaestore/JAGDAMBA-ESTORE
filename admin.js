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

  // Load orders also so dashboard counters update automatically
  await loadOrders();

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

  const normalize = value =>
    String(value || "")
      .trim()
      .toLowerCase();


  /* =========================
     ORDER STATUS COUNTS
  ========================= */

  const newOrders =
    orders.filter(o =>
      normalize(o.order_status) === "new"
    ).length;


  const packedOrders =
    orders.filter(o =>
      normalize(o.order_status) === "packed"
    ).length;


  const shippedOrders =
    orders.filter(o =>
      normalize(o.order_status) === "shipped"
    ).length;


  const outDeliveryOrders =
    orders.filter(o =>
      normalize(o.order_status) === "out for delivery"
    ).length;


  const deliveredOrders =
    orders.filter(o =>
      normalize(o.order_status) === "delivered"
    ).length;


  const cancelledOrders =
    orders.filter(o =>
      normalize(o.order_status) === "cancelled"
    ).length;


  /* =========================
     TOTAL SALES
     Cancelled excluded
  ========================= */

  const activeOrders =
    orders.filter(o =>
      normalize(o.order_status) !== "cancelled"
    );


  const totalSales =
    activeOrders.reduce(
      (sum, o) =>
        sum + Number(o.total_amount || 0),
      0
    );


  /* =========================
     PENDING PAYMENTS
  ========================= */

  const pendingPayments =
    orders.filter(o =>
      normalize(o.payment_status || "Pending") === "pending"
    ).length;


  /* =========================
     TODAY'S SALES
     Cancelled excluded
  ========================= */

  const now = new Date();


  const todaySales =
    orders
      .filter(o => {

        if (
          normalize(o.order_status) ===
          "cancelled"
        ) {
          return false;
        }


        if (!o.created_at) {
          return false;
        }


        const date =
          new Date(o.created_at);


        return (
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );

      })
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     DELIVERED SALES
  ========================= */

  const deliveredSales =
    orders
      .filter(o =>
        normalize(o.order_status) ===
        "delivered"
      )
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     LOW STOCK PRODUCTS
     Stock <= 5
  ========================= */

  const lowStockProducts =
    products.filter(p =>
      Number(p.stock || 0) <= 5 &&
      Number(p.stock || 0) > 0
    ).length;


  /* =========================
     UPDATE DASHBOARD
  ========================= */

  if ($("dashTotalOrders"))
    $("dashTotalOrders").textContent =
      totalOrders;


  if ($("dashNewOrders"))
    $("dashNewOrders").textContent =
      newOrders;


  if ($("dashPackedOrders"))
    $("dashPackedOrders").textContent =
      packedOrders;


  if ($("dashShippedOrders"))
    $("dashShippedOrders").textContent =
      shippedOrders;


  if ($("dashOutDeliveryOrders"))
    $("dashOutDeliveryOrders").textContent =
      outDeliveryOrders;


  if ($("dashDeliveredOrders"))
    $("dashDeliveredOrders").textContent =
      deliveredOrders;


  if ($("dashTotalSales"))
    $("dashTotalSales").textContent =
      "₹" + money(totalSales);


  if ($("dashPendingPayments"))
    $("dashPendingPayments").textContent =
      pendingPayments;


  /* =========================
     NEW DASHBOARD CARDS
  ========================= */

  if ($("dashTodaySales"))
    $("dashTodaySales").textContent =
      "₹" + money(todaySales);


  if ($("dashDeliveredSales"))
    $("dashDeliveredSales").textContent =
      "₹" + money(deliveredSales);


  if ($("dashCancelledOrders"))
    $("dashCancelledOrders").textContent =
      cancelledOrders;


  if ($("dashLowStock"))
    $("dashLowStock").textContent =
      lowStockProducts;

}
/* =========================
   SALES ANALYTICS
========================= */

function updateSalesAnalytics() {

  const normalize = value =>
    String(value || "")
      .trim()
      .toLowerCase();


  const validSalesOrders =
    orders.filter(o =>
      normalize(o.order_status) !== "cancelled"
    );


  /* =========================
     DATE HELPERS
  ========================= */

  const dateOnly = date => {

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  };


  const today =
    dateOnly(new Date());


  const yesterday =
    new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );


  /* =========================
     TODAY
  ========================= */

  const todaySales =
    validSalesOrders
      .filter(o => {

        if (!o.created_at)
          return false;

        const d =
          dateOnly(
            new Date(o.created_at)
          );

        return (
          d.getTime() ===
          today.getTime()
        );

      })
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     YESTERDAY
  ========================= */

  const yesterdaySales =
    validSalesOrders
      .filter(o => {

        if (!o.created_at)
          return false;

        const d =
          dateOnly(
            new Date(o.created_at)
          );

        return (
          d.getTime() ===
          yesterday.getTime()
        );

      })
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     THIS WEEK
  ========================= */

  const weekStart =
    new Date(today);

  const day =
    weekStart.getDay();

  const diff =
    day === 0
      ? 6
      : day - 1;

  weekStart.setDate(
    weekStart.getDate() - diff
  );


  const weekSales =
    validSalesOrders
      .filter(o => {

        if (!o.created_at)
          return false;

        const d =
          dateOnly(
            new Date(o.created_at)
          );

        return d >= weekStart;

      })
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     THIS MONTH
  ========================= */

  const monthStart =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );


  const monthSales =
    validSalesOrders
      .filter(o => {

        if (!o.created_at)
          return false;

        const d =
          dateOnly(
            new Date(o.created_at)
          );

        return d >= monthStart;

      })
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     ALL TIME
  ========================= */

  const allTimeSales =
    validSalesOrders.reduce(
      (sum, o) =>
        sum + Number(o.total_amount || 0),
      0
    );


  /* =========================
     DELIVERED SALES
  ========================= */

  const deliveredSales =
    orders
      .filter(o =>
        normalize(o.order_status) ===
        "delivered"
      )
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     CANCELLED SALES
  ========================= */

  const cancelledSales =
    orders
      .filter(o =>
        normalize(o.order_status) ===
        "cancelled"
      )
      .reduce(
        (sum, o) =>
          sum + Number(o.total_amount || 0),
        0
      );


  /* =========================
     UPDATE CARDS
  ========================= */

  if ($("analyticsToday"))
    $("analyticsToday").textContent =
      "₹" + money(todaySales);


  if ($("analyticsYesterday"))
    $("analyticsYesterday").textContent =
      "₹" + money(yesterdaySales);


  if ($("analyticsWeek"))
    $("analyticsWeek").textContent =
      "₹" + money(weekSales);


  if ($("analyticsMonth"))
    $("analyticsMonth").textContent =
      "₹" + money(monthSales);


  if ($("analyticsAllTime"))
    $("analyticsAllTime").textContent =
      "₹" + money(allTimeSales);


  if ($("analyticsDelivered"))
    $("analyticsDelivered").textContent =
      "₹" + money(deliveredSales);


  if ($("analyticsCancelled"))
    $("analyticsCancelled").textContent =
      "₹" + money(cancelledSales);


  /* =========================
     LAST 7 DAYS CHART
  ========================= */

  renderSalesChart();

}


/* =========================
   LAST 7 DAYS SALES CHART
========================= */

function renderSalesChart() {

  const chart =
    $("salesChart");

  if (!chart)
    return;


  const today =
    new Date();


  const days = [];


  for (
    let i = 6;
    i >= 0;
    i--
  ) {

    const date =
      new Date(today);

    date.setHours(
      0, 0, 0, 0
    );

    date.setDate(
      date.getDate() - i
    );


    days.push(date);

  }


  const values =
    days.map(date => {

      return orders
        .filter(o => {

          if (
            String(o.order_status || "")
              .trim()
              .toLowerCase() ===
            "cancelled"
          ) {
            return false;
          }


          if (!o.created_at)
            return false;


          const d =
            new Date(o.created_at);


          return (
            d.getDate() ===
              date.getDate() &&

            d.getMonth() ===
              date.getMonth() &&

            d.getFullYear() ===
              date.getFullYear()
          );

        })
        .reduce(
          (sum, o) =>
            sum +
            Number(
              o.total_amount || 0
            ),
          0
        );

    });


  const max =
    Math.max(
      ...values,
      1
    );


  chart.innerHTML =
    days.map(
      (date, index) => {

        const value =
          values[index];


        const height =
          Math.max(
            8,
            (value / max) * 160
          );


        const label =
          date.toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short"
            }
          );


        return `

          <div
            style="
              min-width:70px;
              flex:1;
              height:190px;
              display:flex;
              flex-direction:column;
              justify-content:flex-end;
              align-items:center;
            "
          >

            <div
              style="
                font-size:11px;
                font-weight:700;
                margin-bottom:6px;
              "
            >
              ₹${money(value)}
            </div>


            <div
              title="₹${money(value)}"
              style="
                width:42px;
                height:${height}px;
                background:linear-gradient(
                  180deg,
                  #7c4dff,
                  #4c2bbf
                );
                border-radius:8px 8px 3px 3px;
                transition:height .3s;
              "
            ></div>


            <div
              style="
                font-size:10px;
                margin-top:7px;
                color:#6f7789;
                white-space:nowrap;
              "
            >
              ${label}
            </div>

          </div>

        `;

      }
    ).join("");

}


/* =========================
   REFRESH ANALYTICS
========================= */

if ($("refreshAnalytics")) {

  $("refreshAnalytics").onclick =
    updateSalesAnalytics;

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
  const filteredOrders = [...orders];
  updateDashboardSummary();
// =========================
// ORDER FILTERS
// =========================

function filterOrders() {

  const search =
    ($("orderSearch")?.value || "")
      .trim()
      .toLowerCase();

  const orderStatus =
    ($("orderStatusFilter")?.value || "")
      .trim()
      .toLowerCase();

  const paymentStatus =
    ($("paymentStatusFilter")?.value || "")
      .trim()
      .toLowerCase();

  const filteredOrders =
    orders.filter(order => {

      const searchText =
        [
          order.order_number,
          order.customer_name,
          order.customer_mobile
        ]
          .map(x => String(x || "").toLowerCase())
          .join(" ");

      const matchesSearch =
        !search || searchText.includes(search);

      const matchesOrderStatus =
        !orderStatus ||
        String(order.order_status || "")
          .trim()
          .toLowerCase() === orderStatus;

      const matchesPaymentStatus =
        !paymentStatus ||
        String(order.payment_status || "Pending")
          .trim()
          .toLowerCase() === paymentStatus;

      return (
        matchesSearch &&
        matchesOrderStatus &&
        matchesPaymentStatus
      );

    });

  renderOrders(filteredOrders);
}
updateDashboardSummary();
updateSalesAnalytics();

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
  filteredOrders.map(order => `

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
<button
  class="primary"
  type="button"
  onclick="printInvoice(${order.id})"
  style="margin-top:10px"
>
  🧾 Print A4 Invoice
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

/* =========================================================
   ORDER DETAILS + PRINTABLE INVOICE
========================================================= */

window.viewOrder = async function(orderId) {

  const order = orders.find(
    o => Number(o.id) === Number(orderId)
  );

  if (!order) {
    alert("Order details nahi mile.");
    return;
  }

  const { data: items, error } = await db
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (error) {
    alert("Order items load nahi hue: " + error.message);
    return;
  }

  if (!items || !items.length) {
    alert("Order items nahi mile.");
    return;
  }

  const subtotal = Number(order.subtotal || 0);
  const delivery = Number(order.delivery_charge || 0);
  const total = Number(order.total_amount || 0);

  const paymentMethod =
    order.payment_method || "-";

  const paymentStatus =
    order.payment_status || "Pending";

  const orderStatus =
    order.order_status || "New";

  const itemRows = items.map((item, index) => {

    const qty =
      Number(item.quantity || 0);

    const price =
      Number(item.price || 0);

    const itemTotal =
      Number(
        item.total ??
        price * qty
      );

    return `
      <tr>
        <td>${index + 1}</td>

        <td>
          ${esc(item.product_name || "Product")}
        </td>

        <td style="text-align:center">
          ${qty}
        </td>

        <td style="text-align:right">
          ₹${money(price)}
        </td>

        <td style="text-align:right">
          ₹${money(itemTotal)}
        </td>
      </tr>
    `;

  }).join("");


  /* Remove previous modal */

  const old =
    document.getElementById(
      "orderDetailsModal"
    );

  if (old) old.remove();


  /* Create modal */

  const modal =
    document.createElement("div");

  modal.id =
    "orderDetailsModal";

  modal.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.65);
    z-index:99999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:15px;
    overflow:auto;
  `;


  modal.innerHTML = `

    <div
      id="invoiceArea"
      style="
        width:100%;
        max-width:850px;
        background:#fff;
        border-radius:16px;
        padding:25px;
        max-height:95vh;
        overflow:auto;
        color:#222;
      "
    >

      <!-- HEADER -->

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:20px;
          flex-wrap:wrap;
          border-bottom:2px solid #222;
          padding-bottom:18px;
          margin-bottom:20px;
        "
      >

        <div>

          <h1
            style="
              margin:0;
              font-size:28px;
            "
          >
            JAGDAMBA E-STORE
          </h1>

          <p
            style="
              margin:5px 0 0;
              color:#666;
            "
          >
            Order Invoice
          </p>

        </div>


        <div
          style="
            text-align:right;
          "
        >

          <b>
            Order No:
          </b>

          <br>

          ${esc(order.order_number || "-")}

          <br><br>

          <b>
            Date:
          </b>

          <br>

          ${formatDate(order.created_at)}

        </div>

      </div>


      <!-- CUSTOMER + STATUS -->

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(240px,1fr));
          gap:20px;
          margin-bottom:25px;
        "
      >

        <div
          style="
            border:1px solid #ddd;
            border-radius:10px;
            padding:15px;
          "
        >

          <h3 style="margin-top:0">
            Customer Details
          </h3>

          <p>
            <b>Name:</b>
            ${esc(order.customer_name || "-")}
          </p>

          <p>
            <b>Mobile:</b>
            ${esc(order.customer_mobile || "-")}
          </p>

          <p>
            <b>Address:</b><br>
            ${esc(order.address || "-")}<br>
            ${esc(order.city || "")},
            ${esc(order.state || "")}<br>
            PIN:
            ${esc(order.pincode || "-")}
          </p>

        </div>


        <div
          style="
            border:1px solid #ddd;
            border-radius:10px;
            padding:15px;
          "
        >

          <h3 style="margin-top:0">
            Order Information
          </h3>

          <p>
            <b>Payment:</b>
            ${esc(paymentMethod)}
          </p>

          <p>
            <b>Payment Status:</b>
            ${esc(paymentStatus)}
          </p>

          <p>
            <b>Order Status:</b>
            ${esc(orderStatus)}
          </p>

        </div>

      </div>


      <!-- PRODUCTS -->

      <h3>
        Order Items
      </h3>

      <div
        style="
          overflow-x:auto;
        "
      >

        <table
          style="
            width:100%;
            border-collapse:collapse;
            margin-bottom:25px;
          "
        >

          <thead>

            <tr
              style="
                background:#f3f4f6;
              "
            >

              <th style="padding:10px;text-align:left">
                #
              </th>

              <th style="padding:10px;text-align:left">
                Product
              </th>

              <th style="padding:10px;text-align:center">
                Qty
              </th>

              <th style="padding:10px;text-align:right">
                Price
              </th>

              <th style="padding:10px;text-align:right">
                Total
              </th>

            </tr>

          </thead>


          <tbody>

            ${itemRows}

          </tbody>

        </table>

      </div>


      <!-- TOTAL -->

      <div
        style="
          max-width:350px;
          margin-left:auto;
          border-top:1px solid #ddd;
          padding-top:10px;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            padding:6px 0;
          "
        >

          <span>
            Subtotal
          </span>

          <b>
            ₹${money(subtotal)}
          </b>

        </div>


        <div
          style="
            display:flex;
            justify-content:space-between;
            padding:6px 0;
          "
        >

          <span>
            Delivery
          </span>

          <b>
            ₹${money(delivery)}
          </b>

        </div>


        <div
          style="
            display:flex;
            justify-content:space-between;
            padding:12px 0;
            border-top:2px solid #222;
            font-size:20px;
          "
        >

          <b>
            Grand Total
          </b>

          <b>
            ₹${money(total)}
          </b>

        </div>

      </div>


      <div
        style="
          margin-top:25px;
          text-align:center;
          color:#777;
          font-size:12px;
        "
      >

        Thank you for shopping with
        <b>Jagdamba E-Store</b>.

      </div>


      <!-- ACTION BUTTONS -->

      <div
        class="no-print"
        style="
          display:flex;
          gap:10px;
          justify-content:center;
          flex-wrap:wrap;
          margin-top:25px;
        "
      >

        <button
          type="button"
          id="printInvoiceBtn"
          class="primary"
        >
          🖨️ Print Invoice
        </button>


        <button
          type="button"
          id="invoiceWhatsAppBtn"
          class="primary"
        >
          📱 WhatsApp Customer
        </button>


        <button
          type="button"
          id="closeInvoiceBtn"
          class="chip"
        >
          ✕ Close
        </button>

      </div>

    </div>

  `;


  document.body.appendChild(modal);


  /* =======================================================
     CLOSE
  ======================================================= */

  document
    .getElementById("closeInvoiceBtn")
    .onclick = () => {

      modal.remove();

    };


  /* =======================================================
     PRINT
  ======================================================= */

  document
    .getElementById("printInvoiceBtn")
    .onclick = () => {

      const invoice =
        document.getElementById(
          "invoiceArea"
        );

      const printWindow =
        window.open(
          "",
          "_blank",
          "width=900,height=700"
        );

      if (!printWindow) {

        alert(
          "Popup blocked hai. Browser me popup allow karein."
        );

        return;

      }


      printWindow.document.write(`

        <!doctype html>

        <html>

        <head>

          <title>
            Invoice -
            ${esc(order.order_number || "")}
          </title>

          <style>

            * {
              box-sizing:border-box;
            }

            body {
              font-family:Arial,sans-serif;
              margin:0;
              padding:25px;
              color:#222;
            }

            table {
              page-break-inside:auto;
            }

            tr {
              page-break-inside:avoid;
              page-break-after:auto;
            }

            th,
            td {
              border:1px solid #ddd;
              padding:10px;
            }

            @media print {

              body {
                padding:0;
              }

              .no-print {
                display:none !important;
              }

            }

          </style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        </head>

        <body>

          ${invoice.innerHTML}

        </body>

        </html>

      `);

      printWindow.document.close();

      printWindow.focus();

      setTimeout(() => {

        printWindow.print();

      }, 500);

    };


  /* =======================================================
     WHATSAPP
  ======================================================= */

  document
    .getElementById("invoiceWhatsAppBtn")
    .onclick = () => {

      openWhatsApp(
        order.customer_mobile,
        order.customer_name,
        order.order_number,
        order.order_status || "New"
      );

    };

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
// =========================
// REALTIME + AUTO REFRESH
// =========================

let ordersChannel = null;
let ordersRefreshing = false;

async function refreshDashboardOrders() {

  // Ek time par multiple requests na chalein
  if (ordersRefreshing) return;

  ordersRefreshing = true;

  try {

    await loadOrders();

    console.log("Dashboard updated automatically.");

  } catch (error) {

    console.error(
      "Dashboard auto refresh error:",
      error
    );

  } finally {

    ordersRefreshing = false;

  }

}


// =========================
// SUPABASE REALTIME
// =========================

ordersChannel = db
  .channel("admin-orders-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "orders"
    },
    async payload => {

      console.log(
        "REALTIME ORDER CHANGE:",
        payload
      );

      await refreshDashboardOrders();

    }
  )
  .subscribe(status => {

    console.log(
      "Orders realtime status:",
      status
    );

  });


// =========================
// AUTO REFRESH EVERY 10 SEC
// =========================

setInterval(() => {

  // Sirf jab admin panel logged-in/open ho
  if (!$("panel")) return;

  if (!$("panel").classList.contains("hidden")) {

    refreshDashboardOrders();

  }

}, 10000);


// =========================
// START ADMIN
// =========================
/* =========================
   PRINT A4 INVOICE
========================= */

window.printInvoice = async function(orderId) {

  const { data: order, error: orderError } =
    await db
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

  if (orderError || !order) {

    alert(
      "Order load nahi hua: " +
      (orderError?.message || "")
    );

    return;
  }


  const { data: items, error: itemsError } =
    await db
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);


  if (itemsError) {

    alert(
      "Order items load nahi hue: " +
      itemsError.message
    );

    return;
  }


  const invoiceItems = items || [];


  const rows = invoiceItems
    .map((item, index) => {

      const qty =
        Number(item.quantity || 1);

      const price =
        Number(
          item.price ??
          item.product_price ??
          0
        );

      const total =
        Number(
          item.total ??
          price * qty
        );

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            ${esc(
              item.product_name ||
              "Product"
            )}
          </td>

          <td>${qty}</td>

          <td>₹${money(price)}</td>

          <td>₹${money(total)}</td>
        </tr>
      `;

    })
    .join("");


  const customerMobile =
    order.customer_mobile ||
    order.customer_phone ||
    "-";


  const customerAddress =
    order.address ||
    order.address_line ||
    "";


  const subtotal =
    Number(
      order.subtotal ||
      invoiceItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total ??
            (Number(item.price || 0) *
             Number(item.quantity || 1))
          ),
        0
      )
    );


  const delivery =
    Number(order.delivery_charge || 0);


  const grandTotal =
    Number(
      order.total_amount ||
      subtotal + delivery
    );


  const invoiceWindow =
    window.open(
      "",
      "_blank",
      "width=900,height=800"
    );


  if (!invoiceWindow) {

    alert(
      "Invoice popup blocked hai. Browser me popup allow karein."
    );

    return;
  }


  invoiceWindow.document.write(`
<!DOCTYPE html>
<html>
<head>

<title>
Invoice - ${esc(
  order.order_number || order.id
)}
</title>

<style>

* {
  box-sizing:border-box;
}

body {
  font-family:Arial,sans-serif;
  margin:0;
  padding:0;
  background:#eee;
}

.invoice {
  width:210mm;
  min-height:297mm;
  margin:20px auto;
  background:#fff;
  padding:18mm;
  color:#111;
}

.header {
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  border-bottom:2px solid #111;
  padding-bottom:15px;
  margin-bottom:20px;
}

.logo-box {
  display:flex;
  align-items:center;
  gap:12px;
}

.logo {
  width:70px;
  height:70px;
  object-fit:contain;
}

.store-name {
  font-size:26px;
  font-weight:800;
}

.store-sub {
  font-size:13px;
  margin-top:4px;
}

.invoice-title {
  text-align:right;
}

.invoice-title h1 {
  margin:0;
  font-size:30px;
}

.invoice-title p {
  margin:6px 0;
  font-size:13px;
}

.info-grid {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:25px;
  margin-bottom:25px;
}

.info-box {
  border:1px solid #ddd;
  padding:14px;
}

.info-box h3 {
  margin-top:0;
  font-size:15px;
}

.info-box p {
  line-height:1.6;
  margin:3px 0;
  font-size:13px;
}

table {
  width:100%;
  border-collapse:collapse;
  margin-top:15px;
}

th,
td {
  border:1px solid #aaa;
  padding:10px;
  text-align:left;
  font-size:13px;
}

th {
  background:#f2f2f2;
}

.right {
  text-align:right;
}

.total-box {
  width:320px;
  margin-left:auto;
  margin-top:25px;
}

.total-row {
  display:flex;
  justify-content:space-between;
  padding:8px 0;
  border-bottom:1px solid #ddd;
}

.grand-total {
  font-size:18px;
  font-weight:bold;
  border-top:2px solid #111;
  border-bottom:2px solid #111;
  margin-top:8px;
  padding:12px 0;
}

.footer {
  margin-top:50px;
  border-top:1px solid #ddd;
  padding-top:15px;
  text-align:center;
  font-size:12px;
}

@media print {

  body {
    background:#fff;
  }

  .invoice {
    width:100%;
    min-height:auto;
    margin:0;
    padding:0;
  }

}

</style>

</head>

<body>

<div id="invoice" class="invoice">

  <div class="header">

    <div class="logo-box">

     <img
  src="https://raw.githubusercontent.com/Jagdambaestore/JAGDAMBA-ESTORE/main/Logo.JPG"
  class="logo"
  alt=""
  crossorigin="anonymous"
>

      <div>

        <div class="store-name">
          JAGDAMBA E-STORE
        </div>

        <div class="store-sub">
          Online Shopping Store
        </div>

      </div>

    </div>


    <div class="invoice-title">

      <h1>INVOICE</h1>

      <p>
        <b>Order No:</b>
        ${esc(order.order_number || order.id)}
      </p>

      <p>
        <b>Date:</b>
        ${formatDate(order.created_at)}
      </p>

    </div>

  </div>


  <div class="info-grid">

    <div class="info-box">

      <h3>Customer Details</h3>

      <p>
        <b>${esc(order.customer_name || "-")}</b>
      </p>

      <p>
        Mobile:
        ${esc(customerMobile)}
      </p>

      <p>
        ${esc(customerAddress)}
      </p>

      <p>
        ${esc(order.city || "")},
        ${esc(order.state || "")}
      </p>

      <p>
        PIN:
        ${esc(order.pincode || "")}
      </p>

    </div>


    <div class="info-box">

      <h3>Payment Details</h3>

      <p>
        <b>Payment Method:</b>
        ${esc(order.payment_method || "COD")}
      </p>

      <p>
        <b>Payment Status:</b>
        ${esc(order.payment_status || "Pending")}
      </p>

      <p>
        <b>Order Status:</b>
        ${esc(order.order_status || "New")}
      </p>

    </div>

  </div>


  <table>

    <thead>

      <tr>

        <th>S.No.</th>
        <th>Product</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>

      </tr>

    </thead>


    <tbody>

      ${rows}

    </tbody>

  </table>


  <div class="total-box">

    <div class="total-row">

      <span>Subtotal</span>

      <span>
        ₹${money(subtotal)}
      </span>

    </div>


    <div class="total-row">

      <span>Delivery Charge</span>

      <span>
        ₹${money(delivery)}
      </span>

    </div>


    <div class="total-row grand-total">

      <span>Grand Total</span>

      <span>
        ₹${money(grandTotal)}
      </span>

    </div>

  </div>


  <div class="footer">

    <b>Thank you for shopping with Jagdamba E-Store!</b>

    <br><br>

    This is a computer-generated invoice.

  </div>

</div>
<div style="text-align:center; margin:20px 0;">

  <button
    onclick="downloadInvoicePDF()"
    style="
      padding:12px 25px;
      border:none;
      border-radius:8px;
      cursor:pointer;
      font-size:15px;
      font-weight:bold;
    "
  >
    ⬇ Download Invoice PDF
  </button>

</div>

function downloadInvoicePDF() {

  const invoice =
    document.getElementById("invoice");

  if (!invoice) {
    alert("Invoice not found.");
    return;
  }

  if (typeof html2pdf === "undefined") {
    alert("PDF library loading nahi hui. Please try again.");
    console.error("html2pdf library not loaded");
    return;
  }

  const orderNo =
    "${esc(order.order_number || order.id)}";

  const opt = {
    margin: [5, 5, 5, 5],

    filename:
      "Jagdamba-Invoice-" +
      orderNo +
      ".pdf",

    image: {
      type: "jpeg",
      quality: 0.98
    },

    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true
    },

    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },

    pagebreak: {
      mode: [
        "css",
        "legacy"
      ]
    }
  };

  html2pdf()
    .set(opt)
    .from(invoice)
    .save()
    .catch(function(error) {

      console.error(
        "PDF download error:",
        error
      );

      alert(
        "PDF download failed. Console check karein."
      );

    });

}
