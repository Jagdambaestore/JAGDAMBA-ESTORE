const SUPABASE_URL = "https://vffjurnwzkfjttjvbire.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7IJpU2ggKrHiV_jO7ED-eg_jngoiBSU";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let cats=[], products=[], editing=null;
const $=id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

async function checkAdmin(){
  const {data:{session}}=await db.auth.getSession();
  if(session) await showPanel(session.user);
}
$("login").onclick=async()=>{
  $("loginMsg").textContent="Logging in...";
  const {data,error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});
  if(error){$("loginMsg").textContent=error.message;return}
  await showPanel(data.user);
};
async function showPanel(user){
  const {data:admin,error}=await db.from("admins").select("id").eq("id",user.id).maybeSingle();
  if(error||!admin){await db.auth.signOut();$("loginMsg").textContent="This account is not an admin.";return}
  $("loginBox").classList.add("hidden");$("panel").classList.remove("hidden");await load();
}
$("logout").onclick=async()=>{await db.auth.signOut();location.reload()};
async function load(){
  const [c,p]=await Promise.all([db.from("categories").select("*").order("name"),db.from("products").select("*").order("created_at",{ascending:false})]);
  cats=c.data||[];products=p.data||[];renderCats();render();
}
function renderCats(){$("pcat").innerHTML=cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
function render(){$("adminProducts").innerHTML=products.map(p=>`<article class="card"><img src="${url(p.image_url)}" onerror="this.src='https://placehold.co/600x600?text=Product'"><div class="card-body">
<h3>${esc(p.name)}</h3><div class="desc">${esc(p.description||"")}</div><div class="price">₹${money(p.discount_price??p.price)}</div><small>Delivery ₹${money(p.delivery_charge)} · Stock ${p.stock}</small><br><br>
<button onclick="editProduct(${p.id})">Edit</button> <button onclick="deleteProduct(${p.id})">Delete</button></div></article>`).join("")}
$("newProduct").onclick=()=>{editing=null;clearForm();$("formTitle").textContent="Add Product";$("formBox").classList.remove("hidden")};
$("cancel").onclick=()=>{$("formBox").classList.add("hidden")};
$("save").onclick=async()=>{
  const payload={name:$("pname").value.trim(),description:$("pdesc").value.trim(),image_url:$("pimage").value.trim()||null,category_id:Number($("pcat").value)||null,price:Number($("pprice").value||0),discount_price:$("pdiscount").value===""?null:Number($("pdiscount").value),delivery_charge:Number($("pdelivery").value||0),stock:Number($("pstock").value||0),is_active:true,updated_at:new Date().toISOString()};
  if(!payload.name||payload.price<0){$("msg").textContent="Name and valid price required.";return}
  const q=editing?db.from("products").update(payload).eq("id",editing):db.from("products").insert(payload);
  const {error}=await q;if(error){$("msg").textContent=error.message;return}
  $("msg").textContent="Saved successfully.";$("formBox").classList.add("hidden");await load();
};
window.editProduct=id=>{const p=products.find(x=>x.id===id);if(!p)return;editing=id;$("formTitle").textContent="Edit Product";$("pid").value=id;$("pname").value=p.name;$("pdesc").value=p.description||"";$("pimage").value=p.image_url||"";$("pcat").value=p.category_id||"";$("pprice").value=p.price;$("pdiscount").value=p.discount_price??"";$("pdelivery").value=p.delivery_charge;$("pstock").value=p.stock;$("formBox").classList.remove("hidden")};
window.deleteProduct=async id=>{if(!confirm("Delete this product?"))return;const {error}=await db.from("products").delete().eq("id",id);if(error)alert(error.message);else await load()};
function clearForm(){$("pid").value="";["pname","pdesc","pimage","pprice","pdiscount"].forEach(x=>$(x).value="");$("pdelivery").value=0;$("pstock").value=0}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function url(u){return u&&/^https?:\/\//i.test(u)?u:"https://placehold.co/600x600?text=Product"}
checkAdmin();
