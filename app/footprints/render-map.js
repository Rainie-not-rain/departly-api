import china from './maps/china.js';
import world from './maps/world.js';
function geometry(scope) {
  return scope === 'china' ? china : world
}
function rings(f) { const g=f.geometry||{}; return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[] }
const geometryCache={}
function mapGeometry(scope) {
 if(geometryCache[scope])return geometryCache[scope]
 const features=geometry(scope).features.filter(f=>scope==='china'||!rings(f).every(poly=>poly.every(r=>r.every(c=>c[1]<-60))))
 const bounds=[Infinity,-Infinity,Infinity,-Infinity]
 features.forEach(f=>rings(f).forEach(poly=>poly.forEach(r=>r.forEach(c=>{bounds[0]=Math.min(bounds[0],c[0]);bounds[1]=Math.max(bounds[1],c[0]);bounds[2]=Math.min(bounds[2],c[1]);bounds[3]=Math.max(bounds[3],c[1])}))))
 if(!Number.isFinite(bounds[0]))throw new Error('地图没有有效地理边界')
 return geometryCache[scope]={features,bounds}
}
function inside(r,x,y) { let a=false; for(let i=0,j=r.length-1;i<r.length;j=i++){const p=r[i],q=r[j];if((p[1]>y)!==(q[1]>y)&&x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0])a=!a} return a }
function renderMap(ctx,o) {
 const {scope='china',locations=[],status='visited',width,height,selectedLocationKey}=o
 const data=mapGeometry(scope),b=data.bounds
 const z=Math.max(1,Math.min(3,Number(o.zoom)||1)),s=Math.min((width-32)/(b[1]-b[0]),(height-32)/(b[3]-b[2]))*z
 const project=(lon,lat)=>[width/2+(lon-(b[0]+b[1])/2)*s+(Number(o.panX)||0),height/2-(lat-(b[2]+b[3])/2)*s+(Number(o.panY)||0)]
 ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip()
 try {
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#f3f0e7';ctx.fillRect(0,0,width,height)
 const regions=[]
 ;(data.features||[]).forEach(f=>{
  // 世界资产已在日期变更线分段；南极洲在展示范围之外，避免极点闭合横跨整幅地图。
  if(scope!=='china'&&rings(f).every(poly=>poly.every(r=>r.every(c=>c[1]<-60))))return
  const p=f.properties||{},name=p.name||p.NAME||'',countryCode=p.countryCode||p.iso_a2||p.ISO_A2||''
  const polygons=rings(f).map(poly=>poly.map(r=>r.map(c=>project(c[0],c[1]))))
  const selected=locations.find(l=>l.locationKey===selectedLocationKey),selectedProvince=selected&&(selected.provinceName||selected.province)
  const isSelected=selected&&(scope==='china'?selectedProvince&&(name.includes(selectedProvince.replace(/省|市|自治区/g,''))||selectedProvince.includes(name)):selected.countryCode===countryCode)
  const active=locations.some(l=>{const province=l.provinceName||l.province;return scope==='china'?(province&&(name.includes(province.replace(/省|市|自治区/g,''))||province.includes(name))):(countryCode&&l.countryCode===countryCode)||(l.countryName||l.country)===name})
  ctx.fillStyle=isSelected?'#749577':active?(status==='wishlist'?'#d9e4cd':'#a8c5aa'):'#e5e4dc';ctx.strokeStyle='#faf8ef';ctx.lineWidth=.7
  polygons.forEach(poly=>{ctx.beginPath();poly.forEach(r=>{r.forEach((c,i)=>i?ctx.lineTo(c[0],c[1]):ctx.moveTo(c[0],c[1]));ctx.closePath()});ctx.fill('evenodd');ctx.stroke()})
  regions.push({name,countryCode,adcode:p.adcode,polygons})
 })
 const points=[]
 locations.forEach(l=>{
  if(l.locationResolved!==true||!(l.cityName||l.city))return
  const longitude=l.lng!=null?l.lng:l.longitude,latitude=l.lat!=null?l.lat:l.latitude
  if(longitude==null||latitude==null||longitude===''||latitude==='')return
  const lon=Number(longitude),lat=Number(latitude);if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return
  const [x,y]=project(lon,lat),locationKey=l.locationKey||l.key||l.id,selected=locationKey===selectedLocationKey
  ctx.beginPath();ctx.arc(x,y,selected?7:4,0,Math.PI*2);ctx.fillStyle=status==='wishlist'?'#f3f0e7':'#d28b54';ctx.fill();ctx.strokeStyle=status==='wishlist'?'#94b281':'#fffdf5';ctx.lineWidth=2;ctx.stroke()
  if(selected){ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.strokeStyle='#255b43';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#255b43';ctx.font='12px sans-serif';ctx.fillText(l.cityName||l.city||l.name||'',Math.max(4,Math.min(width-90,x+10)),Math.max(16,y-10))}
  points.push({x,y,locationKey,location:l})
 })
 return {points,regions,project}
 } finally {ctx.restore()}
}
function hitTest(map,x,y) {
 if(!map)return {}
 const p=map.points.slice().reverse().find(p=>Math.hypot(p.x-x,p.y-y)<=16);if(p)return {locationKey:p.locationKey}
 const r=map.regions.slice().reverse().find(r=>r.polygons.some(p=>inside(p[0],x,y)&&!p.slice(1).some(h=>inside(h,x,y))))
 return r?{region:{name:r.name,countryCode:r.countryCode,adcode:r.adcode}}:{locationKey:'',region:null}
}
export {renderMap,hitTest}
