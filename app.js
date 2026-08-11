const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products=[], categories=[], cart=[], selectedCategory=null;
const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
async function loadData() {
  try {
    const [p, c] = await Promise.all([
      db.from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

      db.from("categories")
        .select("*")
        .order("name")
    ]);

    if (p.error) {
      console.error(p.error);
      alert("Products load nahi ho pa rahe: " + p.error.message);
      return;
    }

    if (c.error) {
      console.error(c.error);
      alert("Categories load nahi ho pa rahi: " + c.error.message);
      return;
    }

    products = p.data || [];
    categories = c.data || [];

    renderCategories();
    renderProducts();

  } catch (error) {
    console.error(error);
    alert("Shop loading error: " + error.message);
  }
}


function renderCategories(){

  $("categories").innerHTML =
    `<button class="chip ${!selectedCategory?'active':''}" onclick="filterCategory(null)">All</button>` +
    categories.map(c =>
      `<button class="chip ${selectedCategory===c.id?'active':''}" onclick="filterCategory(${c.id})">${esc(c.name)}</button>`
    ).join("");
}

function filterCategory(id){
  selectedCategory = id;
  renderCategories();
  renderProducts();
}

function renderProducts(){
  const q = $("search").value.toLowerCase().trim();

  const list = products.filter(p =>
    (!selectedCategory || p.category_id === selectedCategory) &&
    (!q ||
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    )
  );

  $("empty").classList.toggle("hidden",list.length !== 0);

  $("products").innerHTML = list.map(p => {
    const price = p.discount_price ?? p.price;
    const stock = Number(p.stock || 0);

    return `<article class="card">
      <img src="${safeUrl(p.image_url)}"
           alt="${esc(p.name)}"
           onerror="this.src='https://placehold.co/600x600?text=Product'">

      <div class="card-body">
        <h3>${esc(p.name)}</h3>

        <div class="desc">${esc(p.description || "")}</div>

        <div class="price">
          ₹${money(price)}
          ${p.discount_price != null ? `₹${money(p.price)}` : ""}
        </div>

        <small>Delivery: ₹${money(p.delivery_charge)}</small>
        <br>

        <small>
          ${stock > 0 ? `Stock: ${stock}` : "Out of stock"}
        </small>

        <br><br>

        <button
          ${stock <= 0 ? "disabled" : ""}
          onclick="addToCart(${p.id})">
          ${stock > 0 ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
    </article>`;
  }).join("");
}

 const searchBox = $("search");

if(searchBox){
  searchBox.addEventListener("input",renderProducts);
}

function addToCart(id){
  const p = products.find(x => Number(x.id) === Number(id));

  if(!p){
    alert("Product not found.");
    return;
  }

  const stock = Number(p.stock || 0);
  const row = cart.find(x => Number(x.id) === Number(id));

  if(stock <= 0){
    alert("This product is out of stock.");
    return;
  }

  if(row){
    if(row.qty >= stock){
      alert(`Available stock only ${stock}.`);
      return;
    }

    row.qty++;
  }else{
    cart.push({
      ...p,
      qty: 1
    });
  }

  renderCart();
}
 
  function changeQty(id,delta){
 const row=cart.find(x=>x.id===id);if(!row)return;
 const next=row.qty+delta,stock=Number(row.stock||0);
 if(next<1){removeItem(id);return} if(next>stock){alert(`Available stock only ${stock}.`);return}
 row.qty=next;renderCart();
}
function totals(){
 return {
  subtotal:cart.reduce((s,x)=>s+Number(x.discount_price??x.price)*x.qty,0),
  delivery:cart.reduce((s,x)=>s+Number(x.delivery_charge||0)*x.qty,0)
 };
}
function renderCart(){
 $("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);
 $("cartItems").innerHTML=cart.length?cart.map(x=>{
  const price=Number(x.discount_price??x.price);
  return `<div class="cart-row"><img src="${safeUrl(x.image_url)}" onerror="this.src='https://placehold.co/100x100?text=Product'"><div style="flex:1"><b>${esc(x.name)}</b><div>₹${money(price)} × ${x.qty} = ₹${money(price*x.qty)}</div><div style="display:flex;align-items:center;gap:8px;margin-top:8px"><button type="button" onclick="changeQty(${x.id},-1)">−</button><strong>${x.qty}</strong><button type="button" onclick="changeQty(${x.id},1)">+</button></div><button type="button" onclick="removeItem(${x.id})">Remove</button></div></div>`;
 }).join(""):"<p>Your cart is empty.</p>";
 const t=totals();$("cartTotal").textContent=money(t.subtotal+t.delivery);
}
function openCheckout(){
 const t=totals();

 let old=document.getElementById("checkoutModal");
 if(old) old.remove();

 old=document.createElement("div");
 old.id="checkoutModal";

 old.innerHTML=`
 <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">

  <div style="background:#fff;border-radius:18px;max-width:620px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25)">

   <div style="display:flex;justify-content:space-between;align-items:center">
    <h2 style="margin:0">Checkout</h2>
    <button type="button" id="closeCheckout">×</button>
   </div>

   <p style="margin:8px 0 16px">
    <b>Payment Method</b>
   </p>

   <div style="display:grid;gap:10px;margin-bottom:18px">

    <label style="border:1px solid #ddd;padding:12px;border-radius:10px;cursor:pointer">
     <input type="radio" name="paymentMethod" value="COD" checked>
     💵 Cash on Delivery (COD)
    </label>

    <label style="border:1px solid #ddd;padding:12px;border-radius:10px;cursor:pointer">
     <input type="radio" name="paymentMethod" value="UPI">
     📱 Google Pay / UPI
    </label>

   </div>

   <div id="upiPaymentBox"
        style="display:none;text-align:center;background:#f8fafc;border-radius:14px;padding:18px;margin-bottom:18px">

    <h3 style="margin-top:0">📱 Scan & Pay</h3>

    <p style="font-size:14px">
     Google Pay, PhonePe, Paytm या किसी भी UPI App से QR scan करें।
    </p>

    <div style="background:#fff;padding:10px;border-radius:12px;width:290px;max-width:100%;margin:15px auto">
      <div id="checkoutQRCode"></div>
    </div>

    <p style="margin:10px 0 5px"><b>UPI ID</b></p>

    <div style="background:#fff;border:1px solid #ddd;padding:12px;border-radius:10px;font-weight:700;word-break:break-all">
      anshul88266@okhdfcbank
    </div>

    <button type="button" id="copyCheckoutUPI"
      style="margin-top:10px;padding:10px 16px;border:1px solid #222;border-radius:8px;background:#fff;cursor:pointer">
      📋 Copy UPI ID
    </button>

    <a href="upi://pay?pa=anshul88266@okhdfcbank&pn=JAGDAMBA%20E-STORE&cu=INR"
      style="display:block;margin-top:10px;padding:13px;background:#172033;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
      📲 PAY USING UPI APP
    </a>

    <p style="font-size:13px;color:#666">
      Payment करने के बाद नीचे <b>PAYMENT DONE — PLACE ORDER</b> दबाएँ।
    </p>

   </div>

   <div style="display:grid;gap:10px">

    <input id="coName" required placeholder="Customer Name"
      style="padding:12px;border:1px solid #ddd;border-radius:10px">

    <input id="coMobile" required inputmode="numeric" maxlength="10"
      placeholder="Mobile Number"
      style="padding:12px;border:1px solid #ddd;border-radius:10px">

    <textarea id="coAddress" required placeholder="Full Address"
      style="padding:12px;border:1px solid #ddd;border-radius:10px;min-height:80px"></textarea>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

     <input id="coCity" required placeholder="City"
      style="padding:12px;border:1px solid #ddd;border-radius:10px">

     <input id="coState" required placeholder="State"
      style="padding:12px;border:1px solid #ddd;border-radius:10px">

    </div>

    <input id="coPincode" required inputmode="numeric" maxlength="6"
      placeholder="Pincode"
      style="padding:12px;border:1px solid #ddd;border-radius:10px">

   </div>

   <h3>Order Summary</h3>

   <div>
    ${cart.map(x=>`
      <div style="display:flex;justify-content:space-between;padding:5px 0">
       <span>${esc(x.name)} × ${x.qty}</span>
       <b>₹${money(Number(x.discount_price??x.price)*x.qty)}</b>
      </div>
    `).join("")}
   </div>

   <hr>

   <div style="display:flex;justify-content:space-between">
    <span>Subtotal</span>
    <b>₹${money(t.subtotal)}</b>
   </div>

   <div style="display:flex;justify-content:space-between">
    <span>Delivery</span>
    <b>₹${money(t.delivery)}</b>
   </div>

   <div style="display:flex;justify-content:space-between;font-size:20px;margin-top:8px">
    <b>Total</b>
    <b>₹${money(t.subtotal+t.delivery)}</b>
   </div>

   <button id="placeOrder"
    style="width:100%;margin-top:16px;padding:14px;border:0;border-radius:10px;cursor:pointer;font-weight:700">
    PLACE ORDER — COD
   </button>

   <p id="checkoutMsg" style="text-align:center"></p>

  </div>
 </div>`;

 document.body.appendChild(old);

 const qrScript=document.createElement("script");

 qrScript.src=
   "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

 qrScript.onload=()=>{

   const qrBox=document.getElementById("checkoutQRCode");

   if(qrBox){

     new QRCode(qrBox,{
       text:
        "upi://pay?pa=anshul88266@okhdfcbank" +
        "&pn=JAGDAMBA%20E-STORE" +
        "&cu=INR",

       width:260,
       height:260,

       correctLevel:QRCode.CorrectLevel.M
     });

   }

 };

 document.body.appendChild(qrScript);

 document.getElementById("closeCheckout").onclick=()=>{
   old.remove();
 };

 const paymentRadios=
   document.querySelectorAll('input[name="paymentMethod"]');

 const upiBox=
   document.getElementById("upiPaymentBox");

 const placeBtn=
   document.getElementById("placeOrder");

 paymentRadios.forEach(radio=>{

   radio.addEventListener("change",()=>{

     if(radio.checked && radio.value==="UPI"){

       upiBox.style.display="block";

       placeBtn.textContent=
         "PAYMENT DONE — PLACE ORDER";

     }

     if(radio.checked && radio.value==="COD"){

       upiBox.style.display="none";

       placeBtn.textContent=
         "PLACE ORDER — COD";

     }

   });

 });

 document.getElementById("copyCheckoutUPI").onclick=()=>{

   navigator.clipboard
    .writeText("anshul88266@okhdfcbank")

    .then(()=>{
     alert("UPI ID copied successfully!");
})
.catch(()=>{
  alert("UPI ID: anshul88266@okhdfcbank");
});
};

document.getElementById("placeOrder").onclick=placeOrder;

async function placeOrder(){
 const name=$("coName").value.trim(),mobile=$("coMobile").value.trim(),address=$("coAddress").value.trim(),city=$("coCity").value.trim(),state=$("coState").value.trim(),pincode=$("coPincode").value.trim(),msg=$("checkoutMsg");
 if(!name||!/^\d{10}$/.test(mobile)||!address||!city||!state||!/^\d{6}$/.test(pincode)){msg.textContent="Name, valid 10-digit mobile, address, city, state aur 6-digit pincode bharna zaroori hai.";return;}
 const t=totals(),orderNo="JDS-"+Date.now().toString().slice(-8);
 msg.textContent="Order place ho raha hai...";
 const {data:order,error}=await db.from("orders").insert({order_number:orderNo,customer_name:name,customer_mobile:mobile,address,city,state,pincode,payment_method:"COD",payment_status:"Pending",order_status:"New",subtotal:t.subtotal,delivery_charge:t.delivery,total_amount:t.subtotal+t.delivery}).select("id,order_number").single();
 if(error){console.error(error);msg.textContent=error.message;return;}
 const items=cart.map(x=>({order_id:order.id,product_id:x.id,product_name:x.name,price:Number(x.discount_price??x.price),quantity:x.qty,total:Number(x.discount_price??x.price)*x.qty}));
 const {error:itemError}=await db.from("order_items").insert(items);
 if(itemError){console.error(itemError);msg.textContent=itemError.message;await db.from("orders").delete().eq("id",order.id);return;}
 cart=[];renderCart();
 const modal=$("checkoutModal");modal.querySelector("div > div").innerHTML=`<div style="text-align:center;padding:25px"><h2>🎉 Order Placed Successfully</h2><p>Your Order Number</p><h1>${esc(order.order_number)}</h1><p>Payment: <b>Cash on Delivery</b></p><p>Order details admin panel mein save ho gaye hain.</p><button type="button" id="doneOrder" style="padding:12px 22px;border:0;border-radius:10px">Done</button></div>`;
 $("doneOrder").onclick=()=>modal.remove();
}

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function safeUrl(u){return u&&/^https?:\/\//i.test(u)?u:"https://placehold.co/600x600?text=Product"}
document.getElementById("cartBtn").addEventListener("click", function(){
  const cartPanel = document.getElementById("cartPanel");

  if(cartPanel){
    cartPanel.classList.toggle("open");
  }else{
    alert("Cart panel not found.");
  }
});
