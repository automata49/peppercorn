export type InstinctImage={url:string;image_url:string;source_url:string;caption:string;credit:string;usage_rights:string;license_url:string;kind:'photo'|'chart'|'illustration'}
const link=(v:unknown)=>{try{if(typeof v!=='string'||v.length>2048)return false;const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')}catch{return false}}
export function parseInstinctImages(raw:unknown,privateImage=false):InstinctImage[]{
 if(!Array.isArray(raw)||raw.length>3)return []
 return raw.filter((x):x is InstinctImage=>!!x&&typeof x==='object'&&
  ['photo','chart','illustration'].includes(x.kind)&&link(x.image_url)&&link(x.source_url)&&link(x.license_url)&&
  typeof x.caption==='string'&&x.caption.length<=500&&typeof x.credit==='string'&&x.credit.length>0&&x.credit.length<=200&&
  typeof x.usage_rights==='string'&&x.usage_rights.length>0&&x.usage_rights.length<=100&&
  typeof x.url==='string'&&(privateImage?/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(x.url)&&x.url.length<=1500000:/^data\/news-assets\/external-[a-f0-9]{64}\.webp$/.test(x.url)))
}
