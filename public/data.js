export function illustration(type, color='#303c3c', accent='#d8684b') {
 const body={
 bottle:`<rect x="126" y="27" width="48" height="30" rx="8" fill="#202f2b"/><path d="M122 54 Q108 65 108 90V218Q108 237 128 237H172Q192 237 192 218V90Q192 65 178 54Z" fill="${color}"/><path d="M120 83V214" stroke="#ffffff20" stroke-width="5" stroke-linecap="round"/><rect x="119" y="119" width="61" height="49" rx="12" fill="${accent}" transform="rotate(-10 150 143)"/><path d="m138 143 8 8 17-20" fill="none" stroke="#fff2d4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M179 35C210 28 205 77 187 74" fill="none" stroke="#263b33" stroke-width="8"/>`,
 keys:`<g transform="rotate(-24 150 140)"><circle cx="143" cy="86" r="41" stroke="#9d9e92" stroke-width="9" fill="none"/><path d="M128 107H148V218H128V196H113V180H128Z" fill="#c8b783" stroke="#a49162" stroke-width="3"/><rect x="104" y="89" width="56" height="48" rx="16" fill="#d8c89a" stroke="#ad9c6c" stroke-width="3"/><circle cx="132" cy="104" r="7" fill="#92978b"/><rect x="160" y="101" width="50" height="90" rx="16" fill="${color}"/><circle cx="185" cy="121" r="5" fill="#9baca3"/><path d="M175 151h20m-10-8v16" stroke="#b9c9bc" stroke-width="3"/></g>`,
 wallet:`<g transform="rotate(-12 150 140)"><rect x="61" y="78" width="180" height="121" rx="15" fill="${color}"/><rect x="68" y="85" width="166" height="107" rx="10" fill="none" stroke="#ffffff55" stroke-dasharray="3 4"/><path d="M63 103H239" stroke="#0002" stroke-width="3"/><rect x="190" y="121" width="57" height="39" rx="9" fill="${accent}"/><circle cx="209" cy="140" r="5" fill="#d9bf83"/></g>`,
 earbuds:`<g transform="rotate(8 150 140)"><rect x="83" y="126" width="135" height="92" rx="32" fill="#fafbf6" stroke="#d6dcd2" stroke-width="3"/><path d="M84 151H217" stroke="#d2d8cd" stroke-width="2"/><circle cx="150" cy="177" r="3" fill="#92b86c"/><g fill="#fff" stroke="#d2d8cf" stroke-width="2"><rect x="109" y="58" width="16" height="60" rx="8"/><ellipse cx="112" cy="59" rx="19" ry="15"/><rect x="177" y="58" width="16" height="60" rx="8"/><ellipse cx="190" cy="59" rx="19" ry="15"/></g><ellipse cx="103" cy="59" rx="5" ry="7" fill="#454d47"/><ellipse cx="199" cy="59" rx="5" ry="7" fill="#454d47"/></g>`,
 bag:`<path d="M120 77V57Q150 23 180 57V77" fill="none" stroke="${accent}" stroke-width="13"/><path d="M94 70H206L225 223H75Z" fill="${color}"/><path d="M97 75 83 216M203 75 217 216" stroke="#ffffff40" stroke-width="3"/><rect x="111" y="126" width="78" height="65" rx="3" fill="${accent}"/><path d="m135 155 12 12 24-28" fill="none" stroke="#ffffff99" stroke-width="4"/>`,
 umbrella:`<g transform="rotate(22 150 140)"><path d="M150 56V215Q150 242 129 242Q110 242 110 224" stroke="#8d7457" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M59 130Q75 46 150 46Q225 46 241 130Q212 112 195 130Q171 111 150 130Q127 111 105 130Q83 111 59 130Z" fill="${color}"/><path d="M150 46Q114 72 105 130M150 46Q188 72 195 130M150 46V130" stroke="#ffffff44" stroke-width="2"/></g>`,
 glasses:`<g transform="rotate(-12 150 140)" fill="none" stroke="${color}" stroke-width="9"><path d="M57 134 40 92M243 134 261 92M131 133Q150 121 169 133"/><rect x="53" y="118" width="79" height="55" rx="21" fill="#afc6af66"/><rect x="168" y="118" width="79" height="55" rx="21" fill="#afc6af66"/></g>`
 }[type]||`<rect x="85" y="80" width="130" height="130" rx="20" fill="${color}"/><path d="M85 110h130M150 80v130" stroke="#ffffff55" stroke-width="4"/>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="280" viewBox="0 0 300 280"><ellipse cx="150" cy="245" rx="75" ry="9" fill="#213b2b12"/>${body}</svg>`);
}
// Photo-based scenario records. The database adds them in migration 0004;
// the app reads live items from /api/items. seedItems[0] is still used for the home hero image.
export const seedItems=[
 {id:'FB-ELM-001',name:'Black insulated bottle',category:'Bottles',color:'Black',image:'/images/items/black-bottle.webp',location:'Elmina Central Park',date:'2026-10-18',description:'Black insulated bottle with a silver base and carrying handle.',privateNote:'A small scrape underneath the base.',collection:'Elmina Rainforest Knowledge Centre (ERKC)'},
 {id:'FB-ELM-002',name:'Keys with a green fob',category:'Keys',color:'Green',image:'/images/items/green-fob-keys.jpg',location:'Elmina Green Seven',date:'2026-10-18',description:'Several silver keys on a ring with a green cylindrical fob.',privateNote:'Owner can describe the key cuts and a mark on the reverse of the fob.',collection:'Elmina Green 7 Management Office'},
 {id:'FB-ELM-003',name:'Brown leather wallet',category:'Bags & wallets',color:'Brown',image:'/images/items/brown-wallet.webp',location:'Elmina Lakeside Mall',date:'2026-10-17',description:'Small brown leather folding wallet.',privateNote:'Owner can describe the contents and interior markings.',collection:'Elmina Lakeside Mall Centre Management Office'},
 {id:'FB-ELM-004',name:'Black wireless earbuds',category:'Electronics',color:'Black',image:'/images/items/black-earbuds.jpg',location:'Elmina Urban Park',date:'2026-10-17',description:'Black wireless earbuds in a matching charging case.',privateNote:'Owner can describe the underside of the case and its pairing name.',collection:'Elmina Lakeside Mall Centre Management Office'},
 {id:'FB-ELM-005',name:'Black over-ear headphones',category:'Electronics',color:'Black',image:'/images/items/black-headphones.jpg',location:'Elmina Green Seven',date:'2026-10-16',description:'Black over-ear wireless headphones with a grey accent on the headband.',privateNote:'Owner can describe a hidden mark on the inner headband.',collection:'Elmina Green 7 Management Office'},
 {id:'FB-ELM-006',name:'Black and white football',category:'Sports',color:'White',image:'/images/items/football.jpg',location:'Elmina Central Park',date:'2026-10-16',description:'Black and white football with a traditional panel pattern.',privateNote:'Owner can describe a mark near the valve.',collection:'Elmina Rainforest Knowledge Centre (ERKC)'},
 {id:'FB-ELM-007',name:'Orange Tarmak basketball',category:'Sports',color:'Orange',image:'/images/items/basketball.webp',location:'Elmina Lakeside Mall',date:'2026-10-17',description:'Orange Tarmak BT 100 basketball with black seams.',privateNote:'Owner can describe any initials or wear around the valve.',collection:'Elmina Lakeside Mall Centre Management Office'}
].map(x=>({...x,status:'available',sample:true}));
// These are named areas, not exact find spots. A map can resolve the public place
// names; individual reports must never imply a more precise location than supplied.
export const locationCatalog=[
 {name:'Elmina Central Park',area:'Elmina West',lat:3.1797,lng:101.513,mapQuery:'Elmina Central Park, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/press-releases/tn50-aspirations-realisation-sime-darby-property-launches-city-elmina-townships?id=&thankyou=true',coordinateSource:'https://www.distancesfrom.com/my/Elmina-Central-Park-latitude-longitude-Elmina-Central-Park-latitude-Elmina-Central-Park-longitude/LatLongHistory/13144299.aspx'},
 {name:'Elmina Green Seven',area:'Elmina Green',lat:3.20752,lng:101.49754,mapQuery:'Elmina Green Seven, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/press-releases/first-phase-of-sime-darby-property%E2%80%99s-elmina-green-seven-100%25-taken-up?id=&thankyou=true',coordinateSource:'https://mapcarta.com/N11012404157'},
 {name:'Elmina Lakeside Mall',area:'Elmina City Centre',lat:3.18133,lng:101.5099,mapQuery:'Elmina Lakeside Mall, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/malls/elmina-lake-side-mall/',coordinateSource:'https://mapcarta.com/W1308938137'},
 {name:'Elmina Urban Park',area:'Elmina City Centre',lat:3.17999,lng:101.50956,mapQuery:'Elmina Urban Park, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/press-releases/elmina-lakeside-mall-now-open-nature-inspired-lifestyle-community-hub-sime-darby',coordinateSource:'https://mapcarta.com/W1309457596'}
];
export const locations=locationCatalog.map(place=>place.name);
export const categories=['All items','Bottles','Keys','Bags & wallets','Electronics','Sports','Other'];
export const collectionPoints=['Elmina Lakeside Mall Centre Management Office','Elmina Rainforest Knowledge Centre (ERKC)','Elmina Green 7 Management Office'];
// Proposed handover desks are distinct from reported find locations. Directions
// will resolve to the real facility; the exact counter needs operator approval.
export const collectionCatalog=[
 {name:collectionPoints[0],facility:'Elmina Lakeside Mall',lat:3.18133,lng:101.5099,mapQuery:'Elmina Lakeside Mall, No. 5 Persiaran Garcinia, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/malls/elmina-lake-side-mall/'},
 {name:collectionPoints[1],facility:'Elmina Rainforest Knowledge Centre',lat:3.171455,lng:101.500648,mapQuery:'Elmina Rainforest Knowledge Centre, No. 7 Persiaran Ficus, Shah Alam, Selangor',source:'https://www.trcrc.org/contact/',coordinateSource:'https://commons.wikimedia.org/wiki/File:Elmina_Rainforest_Knowledge_Centre_20231021_112730.jpg'},
 {name:collectionPoints[2],facility:'Elmina Green Seven',lat:3.20752,lng:101.49754,mapQuery:'Elmina Green Seven, Shah Alam, Selangor',source:'https://www.simedarbyproperty.com/city-of-elmina/elmina-green-seven/'}
];
const synonyms={earphones:'earbuds',headphones:'earbuds',flask:'bottle',tumbler:'bottle',bottles:'bottle',handbag:'bag',backpack:'bag',tote:'bag',navy:'blue',grey:'gray',keys:'key'};
export const normalize=s=>String(s||'').toLowerCase().replace(/[a-z0-9]+/g,t=>synonyms[t]||t);
const stop=new Set('i my a an the at in on by with and of is it was lost find me near please have has this that something to for keep without'.split(' '));
export function lexical(item,query){
 const tokens=[...new Set(normalize(query).match(/[a-z0-9]+/g)||[])].filter(t=>!stop.has(t));
 const words=new Set(normalize(`${item.name} ${item.category} ${item.color} ${item.description}`).match(/[a-z0-9]+/g)||[]);
 const matched=tokens.filter(t=>words.has(t));
 return {score:tokens.length?matched.length/tokens.length:0,reasons:matched.slice(0,4)};
}
// Keep full ranking until display filters have been applied.
export function rankText(items,query,semanticScores=[]){
 const scores=new Map(semanticScores.map(r=>[r.id,r.score]));
 // Similarity scales differ between models, so "close enough" is measured against the best match.
 const best=semanticScores.length?Math.max(...semanticScores.map(r=>r.score)):0;
 return items.filter(i=>i.status==='available').map(item=>{
  const l=lexical(item,query),s=scores.get(item.id)||0;
  return {id:item.id,score:semanticScores.length?.55*l.score+.45*s:l.score,
   reason:l.reasons.length?'Shared details: '+l.reasons.join(' · '):'Similar description · check details',eligible:l.score>0||(semanticScores.length>0&&s>=best-.08&&s>.3)};
 }).filter(r=>r.eligible).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function filterResults(results,items,category='All items',location='',limit=8){
 const inventory=new Map(items.map(i=>[i.id,i]));
 return results.filter(r=>{const i=inventory.get(r.id);return i&&i.status==='available'&&(category==='All items'||i.category===category)&&(!location||i.location===location)}).slice(0,limit);
}
export function cosine(a,b){let n=0,aa=0,bb=0;for(let i=0;i<a.length;i++){n+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return n/(Math.sqrt(aa*bb)||1)}
