const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products=[], categories=[], cart=[], selectedCategory=null;
const $ = id => document.getElementById(id);
const money = n => Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

async function loadData(){
  const [p,c] = await Promise.all([
    db.from("products").select("*").eq("is_active",true).order("created_at",{ascending:false}),
    db.from("categories").select("*").order("name")
  ]);
  if(p.error){console.error(p.error); alert("Products load nahi ho pa rahe. Supabase URL/Key check karein."); return;}
  products=p.data||[]; categories=c.data||[];
  renderCategories(); renderProducts();
}
function renderCategories(){
  $("categories").innerHTML = `<button class="chip ${!selectedCategory?'active':''}" onclick="filterCategory(null)">All</button>` +
    categories.map(c=>`<button class="chip ${selectedCategory===c.id?'active':''}" onclick="filterCategory(${c.id})">${escapeHtml(c.name)}</button>`).join("");
}
function filterCategory(id){selectedCategory=id;renderCategories();renderProducts();}
function renderProducts(){
  const q=$("search").value.toLowerCase().trim();
  const list=products.filter(p=>(!selectedCategory||p.category_id===selectedCategory)&&
    (!q||p.name.toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q)));
  $("empty").classList.toggle("hidden",list.length!==0);
  $("products").innerHTML=list.map(p=>{
    const price=p.discount_price??p.price, stock=Number(p.stock||0);
    return `<article class="card"><img src="${safeUrl(p.image_url)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://placehold.co/600x600?text=Product'">
      <div class="card-body"><h3>${escapeHtml(p.name)}</h3><div class="desc">${escapeHtml(p.description||"")}</div>
      <div class="price">₹${money(price)} ${p.discount_price!=null?`<span class="old">₹${money(p.price)}</span>`:""}</div>
      <small>Delivery: ₹${money(p.delivery_charge)}</small><br><small>${stock>0?`Stock: ${stock}`:"Out of stock"}</small><br><br>
      <button ${stock<=0?"disabled":""} onclick="addToCart(${p.id})">${stock>0?"Add to Cart":"Out of Stock"}</button></div></article>`;
  }).join("");
}
$("search").addEventListener("input",renderProducts);

function addToCart(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const stock=Number(p.stock||0), row=cart.find(x=>x.id===id);
  if(row){if(row.qty>=stock){alert(`Available stock only ${stock}.`);return;} row.qty++;}
  else {if(stock<=0){alert("This product is out of stock.");return;} cart.push({...p,qty:1});}
  renderCart(); openCart();
}
function changeQty(id,delta){
  const row=cart.find(x=>x.id===id); if(!row)return;
  const next=row.qty+delta, stock=Number(row.stock||0);
  if(next<1){removeItem(id);return;}
  if(next>stock){alert(`Available stock only ${stock}.`);return;}
  row.qty=next; renderCart();
}
function renderCart(){
  $("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);
  $("cartItems").innerHTML=cart.length?cart.map(x=>{
    const price=Number(x.discount_price??x.price);
    return `<div class="cart-row"><img src="${safeUrl(x.image_url)}" onerror="this.src='https://placehold.co/100x100?text=Product'">
      <div style="flex:1"><b>${escapeHtml(x.name)}</b><div>₹${money(price)} × ${x.qty} = ₹${money(price*x.qty)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
      <button type="button" onclick="changeQty(${x.id},-1)">−</button><strong>${x.qty}</strong>
      <button type="button" onclick="changeQty(${x.id},1)">+</button></div>
      <button type="button" onclick="removeItem(${x.id})">Remove</button></div></div>`;
  }).join(""):"<p>Your cart is empty.</p>";
  const subtotal=cart.reduce((s,x)=>s+Number(x.discount_price??x.price)*x.qty,0);
  const delivery=cart.reduce((s,x)=>s+Number(x.delivery_charge||0)*x.qty,0);
  $("cartTotal").textContent=money(subtotal+delivery);
}
function removeItem(id){cart=cart.filter(x=>x.id!==id);renderCart();}
function openCart(){$("cartPanel").classList.add("open");$("overlay").classList.add("show")}
function closeCart(){$("cartPanel").classList.remove("open");$("overlay").classList.remove("show")}
$("cartBtn").onclick=openCart;$("closeCart").onclick=closeCart;$("overlay").onclick=closeCart;
$("checkoutBtn").onclick=()=>{if(!cart.length){alert("Cart empty hai.");return;} alert("Quantity system ready hai. Next step mein Customer Details + COD Checkout connect karenge.");};
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function safeUrl(u){return u&&/^https?:\/\//i.test(u)?u:"https://placehold.co/600x600?text=Product";}
loadData();renderCart();
