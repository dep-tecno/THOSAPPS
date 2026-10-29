var e={},i={};const t=e.promisify(i.readFile),a=e.promisify(i.writeFile),c=r=>e.promisify(i.unlink)(r).catch(()=>{});export{c as deleteCache,t as readCache,a as writeCache};
