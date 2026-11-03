/** Single-process development throttle; not a substitute for a shared production limiter. */
export function createLimiter({limit=20,windowMs=600000,now=Date.now}={}){
  const buckets=new Map();
  return key=>{const t=now();for(const [id,b] of buckets)if(b.until<=t)buckets.delete(id);let b=buckets.get(key);if(!b){b={count:0,until:t+windowMs};buckets.set(key,b)}b.count++;return {allowed:b.count<=limit,retryAfter:Math.max(1,Math.ceil((b.until-t)/1000))}};
}
