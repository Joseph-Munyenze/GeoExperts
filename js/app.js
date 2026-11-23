var $=function(i){return document.getElementById(i)};
// ===== Contact details: replace these placeholders before launch =====
var CONTACT={email:"info@geoexpert.co.ke",phone:"+254700000000",phoneLabel:"+254 700 000 000"};
function mailto(subject,body){return "mailto:"+CONTACT.email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body)}
function telLink(){return "tel:"+CONTACT.phone}
var views=["home","services","land","projects"];
function route(){var h=(location.hash||"#home").slice(1);if(views.indexOf(h)<0)h="home";
views.forEach(function(v){$("v-"+v).classList.toggle("on",v===h)});
document.querySelectorAll("nav a").forEach(function(a){if(a.getAttribute("href")==="#"+h)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
window.scrollTo(0,0)}
window.addEventListener("hashchange",route);route();

var SV=[["Land surveying",["Cadastral surveying",5000],["Geodetic surveying",9000],["Topographic survey",6000],["Engineering survey",8000]],
["Mapping and geospatial",["General mapping",5500],["GIS mapping",6500],["Drone mapping",7000],["LiDAR mapping",14000],["Drone and LiDAR processing",5000]],
["Spatial databases",["PostGIS database design",0],["Spatial data migration and cleaning",0],["Spatial queries and reporting",0],["Database publishing and administration",0]],
["Planning and compliance",["Urban planning",9000],["EIA reports",60000]],
["Land buying and selling",["Buyer title and boundary check",12000],["Seller valuation and listing",10000],["Verified land listings",0]]];
var H=SV.map(function(g){return '<div class="pillar"><h3>'+g[0]+'</h3><ul>'+g.slice(1).map(function(s){return '<li>'+s[0]+'</li>'}).join("")+'</ul></div>'}).join("");
$("svcHome").innerHTML=H;
var D={"Cadastral surveying":["Boundary surveys, beacon placement, mutations and subdivisions for title registration.","Signed survey plan, beacon certificate"],"Geodetic surveying":["High-accuracy control networks tied to the national geodetic datum.","Control point coordinates, network report"],"Topographic survey":["Ground survey of levels, features and contours for design and planning.","Contour plan in DWG and PDF, spot heights"],"Engineering survey":["Setting out, as-built and corridor surveys for roads, buildings and utilities.","Setting-out data, as-built drawings"],"General mapping":["Base maps and plans at the scale your project needs.","Printed and digital maps"],"GIS mapping":["Spatial databases, parcel and utility layers, and web maps.","Geodatabase, shapefiles, web map"],"Drone mapping":["RTK-enabled UAV flights for fast coverage of large or hard-to-reach sites.","Orthomosaic, DSM, flight report"],"LiDAR mapping":["Airborne or terrestrial LiDAR capture, including under vegetation.","Classified point cloud, DTM"],"Drone and LiDAR processing":["We turn your own drone or LiDAR data into usable products.","Orthomosaics, DEM, DTM, DSM, volumes, LAZ files"],"PostGIS database design":["PostgreSQL/PostGIS schema for parcels, survey control, projects, utilities, imagery and metadata, with user roles.","Database schema, setup script, data dictionary"],"Spatial data migration and cleaning":["Load your Shapefile, GeoPackage, CAD, GeoJSON and CSV data into one database, with geometry and CRS checks.","Clean, validated database layers, QA log"],"Spatial queries and reporting":["Area, overlap, buffer and proximity analysis, saved views and repeatable reports.","SQL views, query reports, map exports"],"Database publishing and administration":["Connect the database to web maps and OGC services, with access control, backups and restore testing.","Published layers, backup plan, admin guide"],"Urban planning":["Physical development plans, subdivision schemes and land use studies.","Plan report, approval-ready drawings"],"EIA reports":["Environmental impact assessments, audits and project reports for NEMA.","EIA report, NEMA submission support"],"Buyer title and boundary check":["Confirm the title is clean and the boundary matches the ground before you pay.","Title review, boundary verification"],"Seller valuation and listing":["Valuation, boundary verification and a verified listing for your land.","Valuation, verified listing"],"Verified land listings":["Browse surveyed plots that have had a title check.","Plot details and boundary map"]};
var cur=-1;
function svc(){$("seg").innerHTML=["All services"].concat(SV.map(function(g){return g[0]})).map(function(n,i){return '<button type="button" data-f="'+(i-1)+'" aria-pressed="'+(i-1===cur)+'">'+n+'</button>'}).join("");
$("svc").innerHTML=SV.map(function(g,i){return(cur<0||cur===i)?'<div class="pillar"><h3>'+g[0]+'</h3><ul>'+g.slice(1).map(function(s){return '<li><button type="button" class="svbtn" data-sv="'+s[0]+'">'+s[0]+'</button></li>'}).join("")+'</ul></div>':""}).join("")}
svc();
document.addEventListener("click",function(e){var f=e.target.closest("[data-f]");if(f){cur=+f.getAttribute("data-f");svc();return}
var v=e.target.closest("[data-sv]");if(v){var n=v.getAttribute("data-sv"),d=D[n];$("dT").textContent=n;$("dD").textContent=d[0];$("dL").textContent=d[1];$("dGo").setAttribute("data-n",n);$("dGo").textContent=n==="Verified land listings"?"Browse land":"Email about this service";$("dlg").showModal()}});
$("dGo").onclick=function(){var n=this.getAttribute("data-n");$("dlg").close();if(n==="Verified land listings"){location.hash="#land";return}
location.href=mailto("Service enquiry: "+n,"Hello Geoexpert,\n\nI would like to enquire about: "+n+".\n\nSite location:\nApproximate size (acres):\nPreferred timeline:\n\nName:\nPhone:\n")};
$("dX").onclick=function(){$("dlg").close()};
$("menu").onclick=function(){var o=$("nav").classList.toggle("open");this.setAttribute("aria-expanded",o)};
window.addEventListener("hashchange",function(){$("nav").classList.remove("open");$("menu").setAttribute("aria-expanded","false")});

var cx=$("cv").getContext("2d"),W=620,HH=360,M="Orthophoto",VN={"Orthophoto":"Georeferenced aerial image. The real product is 2 to 5 cm per pixel.","DSM":"Surface model: includes buildings and trees.","DTM":"Bare-earth model: buildings removed, ready for contours and earthworks.","Point cloud":"LiDAR returns coloured by height, delivered as LAZ files."};
function ter(x,y){return 40+22*Math.sin(x/70)+16*Math.cos(y/55+x/140)+8*Math.sin((x+y)/30)}
var BL=[[120,80,70,50,9],[300,200,90,60,12],[430,70,60,70,7],[200,240,50,40,6]];
function bld(x,y){for(var i=0;i<BL.length;i++){var q=BL[i];if(x>q[0]&&x<q[0]+q[2]&&y>q[1]&&y<q[1]+q[3])return q[4]}return 0}
function ramp(t){t=Math.min(1,Math.max(0,t));return[40+t*215,70+Math.sin(t*3.1)*150,170-t*150]}
function paint(){if(M==="Point cloud"){cx.fillStyle="#0d1233";cx.fillRect(0,0,W,HH);var s=7;for(var n=0;n<16000;n++){s=(s*16807)%2147483647;var x=s%W;s=(s*16807)%2147483647;var y=s%HH;var c=ramp((ter(x,y)+bld(x,y)-14)/76);cx.fillStyle="rgb("+(c[0]|0)+","+(c[1]|0)+","+(c[2]|0)+")";cx.fillRect(x,y,2,2)}return}
var img=cx.createImageData(W,HH),d=img.data;
for(var y=0;y<HH;y++)for(var x=0;x<W;x++){var b=bld(x,y),g=ter(x,y),i=(y*W+x)*4,sh=(ter(x-1,y-1)-ter(x+1,y+1))*6+(bld(x-1,y-1)-bld(x+1,y+1))*8,c;
if(M==="Orthophoto"){var f=(Math.floor(x/60)+Math.floor(y/45))%2;c=b?[170,90,70]:(f?[96,140,70]:[120,150,80]);var k=1+sh/120;c=[c[0]*k,c[1]*k,c[2]*k]}
else{c=ramp(((M==="DSM"?g+b:g)-14)/76);var k2=1+sh/200;c=[c[0]*k2,c[1]*k2,c[2]*k2]}
d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}
cx.putImageData(img,0,0)}
function vm(){$("vm").innerHTML=Object.keys(VN).map(function(k){return '<button type="button" data-m="'+k+'" aria-pressed="'+(k===M)+'">'+k+'</button>'}).join("");$("vn").textContent=VN[M];paint()}
document.addEventListener("click",function(e){var m=e.target.closest("[data-m]");if(m){M=m.getAttribute("data-m");vm()}});
vm();
$("sBtn").onclick=function(){
 var loc=$("sL").value.trim(),title=$("sT").value.trim(),contact=$("sContact").value.trim(),area=$("sArea").value.trim();
 if(!loc||!title||!contact||!area||!$("sConsent").checked){$("sMsg").textContent="Add the location, title number, land size, contact and consent before sending.";return;}
 var price=$("sPrice").value?"KES "+Number($("sPrice").value).toLocaleString("en-KE"):"Not supplied";
 location.href=mailto("Land listing request: "+loc,"Hello Geoexpert,\n\nI would like you to review my land for listing.\n\nLocation: "+loc+"\nTitle number: "+title+"\nLand size: "+area+" acres\nExpected asking price: "+price+"\nService needed: "+$("sS").value+"\nOwner / authorised agent contact: "+contact+"\n\nI confirm I am the owner or authorised representative and consent to Geoexpert reviewing these details.\n");
 $("sMsg").textContent="Your email app should open with the details filled in. If it does not, email "+CONTACT.email+" or call "+CONTACT.phoneLabel+".";
};

// ===== Land for sale =====
// Listings are loaded from data/parcels.geojson, which is written by the admin page (/admin/).
var P=[],sel=0,lastShown=[];
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmt(n){if(n==null)return "Price on request";return "KES "+(n>=1e6?(n/1e6).toFixed(1).replace(".0","")+"M":n.toLocaleString("en-KE"))}
function acres(a){return a==null?"Size on request":(+a).toLocaleString("en-KE",{maximumFractionDigits:3})+(+a===1?" acre":" acres")}
function toParcel(f){var p=f.properties;return{id:f.id,n:p.name,loc:p.location||"",t:p.land_use||"Unspecified",a:p.size_acres,p:p.price_kes,ten:p.tenure||"",d:p.description||"",status:p.status||"available",geom:f.geometry}}
function summary(q){return [acres(q.a),q.t,q.ten].filter(Boolean).join(", ")}
function parcelMail(q){return mailto("Land enquiry: "+q.n+" ("+fmt(q.p)+")","Hello Geoexpert,\n\nI am interested in this parcel:\n\nParcel: "+q.n+"\nListing ref: "+q.id+"\nLocation: "+(q.loc||"As listed")+"\nSize: "+acres(q.a)+"\nLand use: "+q.t+"\nTenure: "+(q.ten||"To confirm")+"\nPrice: "+fmt(q.p)+(q.d?"\nNotes: "+q.d:"")+"\n\nPlease share availability for a site visit and the documents available for verification.\n\nName:\nPhone:\n")}
function parcelActions(q){return '<div class="contact-actions"><a class="btn sm" href="'+esc(parcelMail(q))+'" aria-label="Email about '+esc(q.n)+'">Email</a><a class="btn alt sm" href="'+telLink()+'" aria-label="Call about '+esc(q.n)+'">Call</a></div>'}
function badge(q){return q.status==="under offer"?'<span class="badge">Under offer</span>':""}
function render(){if(!P.length)return;var t=$("fT").value,p=+$("fP").value,a=+$("fA").value;
 var L=P.map(function(q,i){q.i=i;return q}).filter(function(q){return(!t||q.t===t)&&(!p||(q.p!=null&&q.p<=p))&&(!a||(q.a!=null&&q.a>=a))});
 if(L.length&&!L.some(function(q){return q.i===sel}))sel=L[0].i;
 $("list").innerHTML=L.length?L.map(function(q){return '<div class="lcard"><button type="button" class="card" data-i="'+q.i+'" aria-pressed="'+(q.i===sel)+'"><span class="price">'+esc(fmt(q.p))+'</span><b>'+esc(q.n)+'</b>'+badge(q)+'<small>'+esc(summary(q))+'</small></button>'+parcelActions(q)+'</div>'}).join(""):'<p class="note msg">No plots match. Widen the land use, price or size filter.</p>';
 lastShown=L.map(function(q){return q.i});updateLandMap();
 var q=P[sel];$("det").innerHTML=L.length?'<h3>'+esc(q.n)+badge(q)+'</h3><p>'+esc(summary(q))+'. '+(q.d?esc(q.d)+'. ':'')+'Price '+esc(fmt(q.p))+'.</p><p class="note" style="margin:0 0 8px">Contact us about this parcel or to book a site visit:</p>'+parcelActions(q):""}
function buildLandUseFilter(){var cur=$("fT").value,uses=[];P.forEach(function(q){if(uses.indexOf(q.t)<0)uses.push(q.t)});uses.sort();
 $("fT").innerHTML='<option value="">Any</option>'+uses.map(function(u){return '<option'+(u===cur?' selected':'')+'>'+esc(u)+'</option>'}).join("")}
["fT","fP","fA"].forEach(function(i){$(i).addEventListener("input",render);$(i).addEventListener("change",function(){fitShown()})});
document.addEventListener("click",function(e){var el=e.target.closest("[data-i]");if(el){sel=+el.getAttribute("data-i");render();focusParcel(sel)}});

function loadParcels(){
 fetch("data/parcels.geojson?v="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(function(gj){
  var res=ParcelSchema.normaliseCollection(gj);
  P=res.features.filter(ParcelSchema.isPublic).map(toParcel);sel=0;
  if(!P.length){$("list").innerHTML='<p class="note msg">No land is listed right now. Email or call us to ask about upcoming plots.</p>';$("det").innerHTML="";buildLayers();return}
  buildLandUseFilter();render();buildLayers();landFitted=false;if(location.hash==="#land")showLand();
 }).catch(function(){
  $("list").innerHTML='<p class="note msg">Listings could not be loaded. If you opened this file directly from your computer, start the site with <code>npm start</code> (see README) and open it through the local address instead.</p>';
 });
}

// ===== Land for sale: satellite basemap (Leaflet) =====
var landMap=null,landLayers=[],landFitted=false;
var PARCEL_STYLE={normal:"#ffd54a",selected:"#ff3b1f"};
function initLandMap(){
 if(landMap)return;
 if(!window.L){$("landMapNote").textContent="Map library unavailable. Check your internet connection and reload to see the satellite basemap.";return}
 landMap=L.map("landMap",{scrollWheelZoom:false}).setView([-1.29,36.82],7);
 var s2=L.tileLayer("https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg",{maxZoom:19,maxNativeZoom:15,attribution:'<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016, CC BY 4.0)'});
 var esri=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,maxNativeZoom:18,attribution:"Imagery &copy; Esri, Maxar, Earthstar Geographics and the GIS User Community"});
 var osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'});
 var labels=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Labels &copy; Esri"});
 s2.addTo(landMap);labels.addTo(landMap);
 L.control.layers({"Sentinel-2 cloudless (open, 10 m)":s2,"High-resolution imagery (Esri)":esri,"Street map (OpenStreetMap)":osm},{"Place labels":labels},{collapsed:true}).addTo(landMap);
 L.control.scale({imperial:false}).addTo(landMap);
 buildLayers();
}
function buildLayers(){
 if(!landMap)return;
 landLayers.forEach(function(l){landMap.removeLayer(l)});
 landLayers=P.map(function(q,i){
  var lyr=L.geoJSON({type:"Feature",geometry:q.geom,properties:{}},{pointToLayer:function(f,ll){return L.circleMarker(ll,{radius:9})}});
  // Small plots vanish when zoomed out, so polygons also get a centre pin
  if(q.geom.type!=="Point")lyr.addLayer(L.circleMarker(lyr.getBounds().getCenter(),{radius:6}));
  lyr.addTo(landMap);
  lyr.bindTooltip(esc(q.n)+" · "+esc(fmt(q.p)),{sticky:true});
  lyr.bindPopup(function(){return '<b>'+esc(q.n)+'</b><br>'+esc(summary(q))+'<br>'+esc(fmt(q.p))+parcelActions(q)});
  lyr.on("click",function(){sel=i;render();focusParcel(i)});
  return lyr});
 updateLandMap();
}
function updateLandMap(){if(!landMap)return;landLayers.forEach(function(l,i){var on=lastShown.indexOf(i)>=0,s=i===sel,c=s?PARCEL_STYLE.selected:PARCEL_STYLE.normal;
 l.setStyle({color:c,weight:s?3:2,opacity:on?1:.35,fillColor:c,fillOpacity:on?(s?.35:.18):.04});if(s)l.eachLayer(function(x){if(x._path)x.bringToFront()})})}
function boundsOf(idx){var b=null;idx.forEach(function(i){if(!landLayers[i])return;var lb=landLayers[i].getBounds();b=b?b.extend(lb):L.latLngBounds(lb.getSouthWest(),lb.getNorthEast())});return b}
function fitShown(){if(!landMap||!landLayers.length)return;var b=boundsOf(lastShown.length?lastShown:P.map(function(q,i){return i}));if(b&&b.isValid())landMap.fitBounds(b.pad(.05),{padding:[30,30],maxZoom:17})}
function focusParcel(i){if(!landMap||!landLayers[i])return;landMap.flyToBounds(landLayers[i].getBounds(),{padding:[40,40],maxZoom:17,duration:.8})}
function showLand(){initLandMap();setTimeout(function(){if(!landMap)return;landMap.invalidateSize();if(!landFitted&&landLayers.length){fitShown();landFitted=true}},150)}
window.addEventListener("hashchange",function(){if(location.hash==="#land")showLand()});
loadParcels();
if(location.hash==="#land")showLand();

// Keep every static email/phone link in sync with CONTACT
document.querySelectorAll(".js-tel").forEach(function(a){a.href=telLink()});
document.querySelectorAll(".js-mail-general").forEach(function(a){a.href=mailto("Survey enquiry","Hello Geoexpert,\n\nI need help choosing the right survey.\n\nSite location:\nApproximate size (acres):\nPurpose of the survey:\n\nName:\nPhone:\n")});
