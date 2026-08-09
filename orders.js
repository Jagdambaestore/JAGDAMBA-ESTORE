const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const ordersBox = document.getElementById("orders");
const message = document.getElementById("message");

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}

async function loadOrders() {
  ordersBox.innerHTML = "";
  message.textContent = "Orders loading...";

  const { data, error } = await db
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      customer_mobile,
      customer_phone,
      address,
      address_line,
      city,
      state,
      pincode,
      payment_method,
      payment_status,
      order_status,
      subtotal,
      delivery_charge,
      total_amount,
      created_at,
      order_items (
        product_name,
        product_id,
        price,
        product_price,
        quantity,
        total
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    message.textContent = "Orders load nahi ho pa rahe: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    message.textContent = "Abhi koi order nahi mila.";
    return;
  }

  message.textContent = `${data.length} order(s) found`;

  ordersBox.innerHTML = data.map(order => {
    const phone = order.customer_mobile || order.customer_phone || "-";
    const address =
      order.address ||
      order.address_line ||
      "-";

    const items = order.order_items || [];

    return `
      <div class="card" style="padding:20px;margin-bottom:18px">

        <div style="display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap">

          <div>
            <h3 style="margin:0">
              Order #${escapeHtml(order.order_number || order.id)}
            </h3>

            <small>
              ${new Date(order.created_at).toLocaleString("en-IN")}
            </small>
          </div>

          <div>
            <strong>₹${money(order.total_amount)}</strong>
          </div>

        </div>

        <hr>

        <h4>Customer Details</h4>

        <p>
          <b>Name:</b> ${escapeHtml(order.customer_name || "-")}<br>
          <b>Mobile:</b> ${escapeHtml(phone)}<br>
          <b>Address:</b> ${escapeHtml(address)}<br>
          <b>City:</b> ${escapeHtml(order.city || "-")}<br>
          <b>State:</b> ${escapeHtml(order.state || "-")}<br>
          <b>Pincode:</b> ${escapeHtml(order.pincode || "-")}
        </p>

        <h4>Products</h4>

        ${
          items.length
          ? items.map(item => {

              const price =
                item.price ??
                item.product_price ??
                0;

              return `
                <div style="
                  display:flex;
                  justify-content:space-between;
                  padding:8px 0;
                  border-bottom:1px solid #eee;
                ">
                  <span>
                    ${escapeHtml(item.product_name || "Product")}
                    × ${item.quantity || 1}
                  </span>

                  <b>
                    ₹${money(item.total ?? price * (item.quantity || 1))}
                  </b>
                </div>
              `;

            }).join("")
          : "<p>No product details found.</p>"
        }

        <div style="margin-top:15px">

          <b>Subtotal:</b>
          ₹${money(order.subtotal)}
          <br>

          <b>Delivery:</b>
          ₹${money(order.delivery_charge)}
          <br>

          <b>Total:</b>
          ₹${money(order.total_amount)}
          <br><br>

          <b>Payment:</b>
          ${escapeHtml(order.payment_method || "COD")}

          <br>

          <b>Payment Status:</b>
          ${escapeHtml(order.payment_status || "Pending")}

          <br>

          <b>Order Status:</b>
          ${escapeHtml(order.order_status || "New")}

        </div>

      </div>
    `;
  }).join("");
}

document.getElementById("refresh").addEventListener("click", loadOrders);

document.getElementById("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "admin.html";
});

loadOrders();
