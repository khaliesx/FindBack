import {cosine} from './data.js';
let lib,extractor,vision,processor;
const textCache=new Map(),imageCache=new Map();
async function library(){if(!lib){lib=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');lib.env.allowLocalModels=false;lib.env.backends.onnx.wasm.numThreads=1;}return lib}
export async function loadText(progress){const t=await library();extractor=await t.pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{progress_callback:progress});}
export function textReady(){return !!extractor}
async function vector(text){if(!textCache.has(text)){const out=await extractor(text,{pooling:'mean',normalize:true});textCache.set(text,Array.from(out.data));}return textCache.get(text)}
export async function semantic(query,items){const q=await vector(query);const results=[];for(const item of items){const v=await vector(`${item.name}. ${item.description}`);results.push({id:item.id,score:cosine(q,v)});}return results}
export async function loadVision(progress){const t=await library();processor ||= await t.AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32');vision ||= await t.CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32',{progress_callback:progress});}
async function raster(url){const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=300;c.height=280;const ctx=c.getContext('2d');ctx.fillStyle='#f1f2eb';ctx.fillRect(0,0,300,280);const ratio=Math.min(300/img.width,280/img.height);ctx.drawImage(img,(300-img.width*ratio)/2,(280-img.height*ratio)/2,img.width*ratio,img.height*ratio);return c.toDataURL('image/png')}
async function imageVector(url){if(!imageCache.has(url)){const t=await library();const image=await t.RawImage.read(await raster(url));const input=await processor(image);const {image_embeds}=await vision(input);imageCache.set(url,Array.from(image_embeds.data));}return imageCache.get(url)}
export async function visual(queryImage,items,progress){await loadVision(progress);const q=await imageVector(queryImage);const results=[];for(let i=0;i<items.length;i++){progress?.({status:'indexing',text:`Comparing item ${i+1} of ${items.length}…`});results.push({id:items[i].id,score:cosine(q,await imageVector(items[i].image))});}return results}
