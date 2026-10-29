// Off the main thread: the 4096² roof felt alone took 0.7 s of page load.
// Memoised, so a preload started before the scene data arrives is reused.
const jobs=new Map();
export function paintFelt(size,canopy){
  const key=size+(canopy?'c':'');
  if(!jobs.has(key))jobs.set(key,new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./felt.worker.js',import.meta.url),{type:'module'});
    worker.onmessage=e=>{resolve(e.data);worker.terminate();};
    worker.onerror=e=>{reject(new Error(e.message));worker.terminate();};
    worker.postMessage({size,canopy});
  }));
  return jobs.get(key);
}
export const preloadFelt=()=>Promise.all([paintFelt(4096,false),paintFelt(1024,true)]);
