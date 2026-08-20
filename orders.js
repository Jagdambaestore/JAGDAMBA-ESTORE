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
        <button
          type="button"
          onclick='printInvoice(${JSON.stringify(order).replace(/'/g, "&#39;")})'
          style="
            margin-top:15px;
            padding:12px 18px;
            border:0;
            border-radius:8px;
            background:#6c4cff;
            color:white;
            font-weight:600;
            cursor:pointer;
          "
        >
          🧾 Print Invoice
        </button>
        <button
  type="button"
  class="print-invoice-btn"
  data-order-id="${order.id}"
  style="
    margin-top:15px;
    padding:12px 18px;
    border:0;
    border-radius:8px;
    background:#6c4cff;
    color:white;
    font-weight:600;
    cursor:pointer;
  "
>
  🧾 Print A4 Invoice
</button>
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
  document.querySelectorAll(".print-invoice-btn").forEach(button => {

    button.addEventListener("click", function () {

      const orderId = this.dataset.orderId;

      const selectedOrder = data.find(
        order => String(order.id) === String(orderId)
      );

      if (selectedOrder) {
        printInvoice(selectedOrder);
      }

    });

  });
  });
}
function printInvoice(order) {

  const phone =
    order.customer_mobile ||
    order.customer_phone ||
    "-";

  const address =
    order.address ||
    order.address_line ||
    "-";

  const items = order.order_items || [];

  const itemsHtml = items.length
    ? items.map((item, index) => {

        const price =
          item.price ??
          item.product_price ??
          0;

        const qty = item.quantity || 1;

        const total =
          item.total ??
          price * qty;

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.product_name || "Product")}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:right">₹${money(price)}</td>
            <td style="text-align:right">₹${money(total)}</td>
          </tr>
        `;

      }).join("")
    : `
      <tr>
        <td colspan="5" style="text-align:center">
          No product details found.
        </td>
      </tr>
    `;

  const invoiceWindow = window.open("", "_blank");

  if (!invoiceWindow) {
    alert("Please allow popups to print the invoice.");
    return;
  }

  invoiceWindow.document.write(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<title>
Invoice - ${escapeHtml(order.order_number || order.id)}
</title>

<style>

@page {
  size: A4;
  margin: 12mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  color: #1f2937;
  background: #ffffff;
}

.invoice {
  width: 100%;
  max-width: 210mm;
  margin: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #6c4cff;
  padding-bottom: 18px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logo-area img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.store-name {
  font-size: 28px;
  font-weight: 800;
  color: #6c4cff;
}

.store-sub {
  margin-top: 5px;
  color: #555;
  font-size: 14px;
}

.invoice-title {
  text-align: right;
}

.invoice-title h1 {
  margin: 0;
  font-size: 32px;
}

.invoice-number {
  margin-top: 8px;
  font-size: 14px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
  margin: 25px 0;
}

.info-box {
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 15px;
}

.info-box h3 {
  margin: 0 0 10px;
  color: #6c4cff;
}

.info-box p {
  line-height: 1.6;
  margin: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th {
  background: #6c4cff;
  color: white;
  padding: 12px;
  text-align: left;
}

td {
  padding: 12px;
  border-bottom: 1px solid #ddd;
}

.summary {
  width: 320px;
  margin-left: auto;
  margin-top: 25px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #ddd;
}

.grand-total {
  font-size: 20px;
  font-weight: 800;
  color: #6c4cff;
  border-top: 2px solid #6c4cff;
  border-bottom: 2px solid #6c4cff;
}

.footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
  text-align: center;
  color: #666;
  font-size: 13px;
}

@media print {

  .no-print {
    display: none !important;
  }

}

</style>

</head>

<body>

<div class="invoice">

  <div class="header">

    <div class="logo-area">

      <img
        src="https://jagdambaestore.github.io/JAGDAMBA-ESTORE/Logo.JPG"
        alt="Jagdamba E-Store Logo"
      >

      <div>

        <div class="store-name">
          JAGDAMBA E-STORE
        </div>

        <div class="store-sub">
          Your Trusted Online Shopping Store
        </div>

      </div>

    </div>

    <div class="invoice-title">

      <h1>INVOICE</h1>

      <div class="invoice-number">
        <b>Order #:</b>
        ${escapeHtml(order.order_number || order.id)}
        <br>

        <b>Date:</b>
        ${new Date(order.created_at).toLocaleDateString("en-IN")}
      </div>

    </div>

  </div>


  <div class="info-grid">

    <div class="info-box">

      <h3>Bill To</h3>

      <p>

        <b>
          ${escapeHtml(order.customer_name || "-")}
        </b>

        <br>

        Mobile:
        ${escapeHtml(phone)}

        <br>

        ${escapeHtml(address)}

        <br>

        ${escapeHtml(order.city || "-")}

        <br>

        ${escapeHtml(order.state || "-")}

        -
        ${escapeHtml(order.pincode || "-")}

      </p>

    </div>


    <div class="info-box">

      <h3>Order Details</h3>

      <p>

        <b>Payment Method:</b>
        ${escapeHtml(order.payment_method || "COD")}

        <br>

        <b>Payment Status:</b>
        ${escapeHtml(order.payment_status || "Pending")}

        <br>

        <b>Order Status:</b>
        ${escapeHtml(order.order_status || "New")}

      </p>

    </div>

  </div>


  <table>

    <thead>

      <tr>

        <th>#</th>

        <th>Product</th>

        <th style="text-align:center">
          Qty
        </th>

        <th style="text-align:right">
          Price
        </th>

        <th style="text-align:right">
          Total
        </th>

      </tr>

    </thead>

    <tbody>

      ${itemsHtml}

    </tbody>

  </table>


  <div class="summary">

    <div class="summary-row">

      <span>Subtotal</span>

      <b>
        ₹${money(order.subtotal)}
      </b>

    </div>

    <div class="summary-row">

      <span>Delivery Charge</span>

      <b>
        ₹${money(order.delivery_charge)}
      </b>

    </div>

    <div class="summary-row grand-total">

      <span>Grand Total</span>

      <span>
        ₹${money(order.total_amount)}
      </span>

    </div>

  </div>


  <div class="footer">

    <b>Thank you for shopping with Jagdamba E-Store!</b>

    <br><br>

    This is a computer-generated invoice.

  </div>


  <div
    class="no-print"
    style="
      text-align:center;
      margin-top:30px;
    "
  >

    <button
      onclick="window.print()"
      style="
        padding:12px 25px;
        background:#6c4cff;
        color:white;
        border:0;
        border-radius:8px;
        font-size:16px;
        font-weight:bold;
        cursor:pointer;
      "
    >
      🖨️ Print Invoice
    </button>

  </div>

</div>

</body>

</html>
  `);

  invoiceWindow.document.close();

  invoiceWindow.focus();

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
