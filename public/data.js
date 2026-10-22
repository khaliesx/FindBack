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
// Sample records. These are loaded into the database by migrations/0002_seed.sql;
// the app reads live items from /api/items. seedItems[0] is still used for the home hero image.
export const seedItems=[
 {id:'FB-001',name:'Black bottle, red sticker',category:'Bottles',color:'Black',type:'bottle',paint:'#303b39',accent:'#d4674a',location:'Central Park',date:'2026-10-18',description:'Black reusable water bottle with a red sticker and carry loop. Found beside the playground bench.',privateNote:'Small dent on the base. Initials AK underneath.',collection:'Central Park security desk'},
 {id:'FB-002',name:'Keys with a green fob',category:'Keys',color:'Green',type:'keys',paint:'#42604b',location:'Clubhouse',date:'2026-10-18',description:'House keys on a silver ring with a dark green key fob. Found near the gym entrance.',privateNote:'Three keys. Tiny star engraving on the reverse of the fob.',collection:'Clubhouse reception'},
 {id:'FB-003',name:'Brown leather wallet',category:'Bags & wallets',color:'Brown',type:'wallet',paint:'#916b4f',accent:'#a17b5b',location:'Retail Square',date:'2026-10-17',description:'Brown leather folding wallet found near the café at Retail Square.',privateNote:'Blue library card inside. Do not expose any personal details.',collection:'Township management office'},
 {id:'FB-004',name:'Wireless earbuds',category:'Electronics',color:'White',type:'earbuds',location:'Community Garden',date:'2026-10-17',description:'White wireless earphones in a charging case found on a bench by the community garden.',privateNote:'Small moon sticker underneath the case.',collection:'Township management office'},
 {id:'FB-005',name:'Sage everyday tote',category:'Bags & wallets',color:'Green',type:'bag',paint:'#a5b58f',accent:'#6c805c',location:'Clubhouse',date:'2026-10-16',description:'Green canvas tote bag with a front pocket, left near the swimming pool.',privateNote:'Orange notebook inside.',collection:'Clubhouse reception'},
 {id:'FB-006',name:'Navy blue umbrella',category:'Other',color:'Blue',type:'umbrella',paint:'#344c68',location:'Retail Square',date:'2026-10-16',description:'Navy blue umbrella with a wooden curved handle. Left outside the grocery shop.',privateNote:'One white stitch on the strap.',collection:'Township management office'},
 {id:'FB-007',name:'Black everyday bottle',category:'Bottles',color:'Black',type:'bottle',paint:'#273735',accent:'#7a8b78',location:'Clubhouse',date:'2026-10-17',description:'Black water bottle with a grey green label and a carry loop. Found at the gym.',privateNote:'Name Sam on the lid.',collection:'Clubhouse reception'},
 {id:'FB-008',name:'Tortoiseshell glasses',category:'Other',color:'Brown',type:'glasses',paint:'#7b5c3f',location:'Central Park',date:'2026-10-15',description:'Brown reading glasses found near the jogging track.',privateNote:'Right arm has a tiny repair with clear tape.',collection:'Central Park security desk'},
 {id:'FB-009',name:'Blue sports bottle',category:'Bottles',color:'Blue',type:'bottle',paint:'#668b9c',accent:'#c4d5cc',location:'Community Garden',date:'2026-10-18',description:'Blue water bottle with a pale label found beside the garden walking path.',privateNote:'Sticker with number 12 under the lid.',collection:'Township management office'},
 {id:'FB-010',name:'Cream canvas tote',category:'Bags & wallets',color:'Cream',type:'bag',paint:'#d8cdb0',accent:'#a68c66',location:'Central Park',date:'2026-10-17',description:'Cream shopping bag with a brown pocket. Found at the playground.',privateNote:'Red pencil pouch inside.',collection:'Central Park security desk'},
 {id:'FB-011',name:'Keys with a blue fob',category:'Keys',color:'Blue',type:'keys',paint:'#52758c',location:'Retail Square',date:'2026-10-15',description:'Silver keys and a blue remote fob found in the car park.',privateNote:'Two keys. Number 8 engraved on one key.',collection:'Township management office'},
 {id:'FB-012',name:'Green pocket umbrella',category:'Other',color:'Green',type:'umbrella',paint:'#778761',location:'Clubhouse',date:'2026-10-18',description:'Green umbrella with a curved handle found by the clubhouse café.',privateNote:'Yellow ribbon tied to the handle.',collection:'Clubhouse reception'}
].map(x=>({...x,status:'available',sample:true,image:illustration(x.type,x.paint,x.accent)}));
export const locations=['Central Park','Clubhouse','Retail Square','Community Garden'];
export const categories=['All items','Bottles','Keys','Bags & wallets','Electronics','Other'];
export const collectionPoints=['Township management office','Central Park security desk','Clubhouse reception'];
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
 return items.filter(i=>i.status==='available').map(item=>{
  const l=lexical(item,query),s=scores.get(item.id)||0;
  return {id:item.id,score:semanticScores.length?.55*l.score+.45*s:l.score,
   reason:l.reasons.length?'Shared details: '+l.reasons.join(' · '):'Similar description · check details',eligible:l.score>0||s>.32};
 }).filter(r=>r.eligible).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function filterResults(results,items,category='All items',location='',limit=8){
 const inventory=new Map(items.map(i=>[i.id,i]));
 return results.filter(r=>{const i=inventory.get(r.id);return i&&i.status==='available'&&(category==='All items'||i.category===category)&&(!location||i.location===location)}).slice(0,limit);
}
export function cosine(a,b){let n=0,aa=0,bb=0;for(let i=0;i<a.length;i++){n+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return n/(Math.sqrt(aa*bb)||1)}
