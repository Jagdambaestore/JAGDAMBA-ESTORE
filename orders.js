const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const ordersBox = document.getElementById("orders");
const message = document.getElementById("message");

const STATUS_OPTIONS = [
  "New",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

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

    const phone =
      order.customer_mobile ||
      order.customer_phone ||
      "-";

    const address =
      order.address ||
      order.address_line ||
      "-";

    const currentStatus =
      order.order_status || "New";

    const items = order.order_items || [];

    const statusOptions = STATUS_OPTIONS.map(status => `
      <option value="${escapeHtml(status)}"
        ${currentStatus === status ? "selected" : ""}>
        ${escapeHtml(status)}
      </option>
    `).join("");

    return `
      <div class="card" style="padding:20px;margin-bottom:18px">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:15px;
          flex-wrap:wrap;
        ">

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
                    ₹${money(
                      item.total ??
                      price * (item.quantity || 1)
                    )}
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

        </div>

        <div style="
          margin-top:18px;
          padding-top:15px;
          border-top:1px solid #ddd;
        ">

          <label>
            <b>Order Status</b>
          </label>

          <select
            class="order-status"
            data-order-id="${order.id}"
            style="
              display:block;
              width:100%;
              max-width:300px;
              margin-top:8px;
              padding:12px;
              border:1px solid #ccc;
              border-radius:8px;
            "
          >
            ${statusOptions}
          </select>

          <div
            class="status-message"
            id="status-message-${order.id}"
            style="margin-top:8px;font-weight:600"
          ></div>

        </div>

      </div>
    `;

  }).join("");

  document.querySelectorAll(".order-status").forEach(select => {

    select.addEventListener("change", async function () {

      const orderId = this.dataset.orderId;
      const newStatus = this.value;

      const statusMessage =
        document.getElementById(
          `status-message-${orderId}`
        );

      statusMessage.textContent = "Saving...";

      const { error } = await db
        .from("orders")
        .update({
          order_status: newStatus
        })
        .eq("id", orderId);

      if (error) {

        console.error(error);

        statusMessage.textContent =
          "❌ Update failed: " + error.message;

        return;
      }

      statusMessage.textContent =
        "✅ Status updated: " + newStatus;

    });

  });
}

document
  .getElementById("refresh")
  .addEventListener("click", loadOrders);

document
  .getElementById("logout")
  .addEventListener("click", async () => {

    await db.auth.signOut();

    window.location.href = "admin.html";

  });

loadOrders();
