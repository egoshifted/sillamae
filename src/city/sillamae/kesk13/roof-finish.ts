import * as THREE from 'three';

export function corrugatedNormal() {
  const width=64, data=new Uint8Array(width*4);
  for(let x=0;x<width;x++) {
    const slope=.62*Math.sin(2*Math.PI*x/width), n=new THREE.Vector3(-slope,0,1).normalize();
    data.set([Math.round((n.x+1)*127.5),128,Math.round((n.z+1)*127.5),255],x*4);
  }
  const map=new THREE.DataTexture(data,width,1);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
  return map;
}

export function roofUV(g: THREE.BufferGeometry) {
  const p=g.attributes.position, uv=new Float32Array(p.count*2), a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3) {
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
    const n=b.sub(a).cross(c.sub(a)).normalize(), u=new THREE.Vector3(n.z,0,-n.x);
    if(u.lengthSq()<1e-10) u.set(1,0,0); else u.normalize();
    if(u.x<0 || (Math.abs(u.x)<1e-8 && u.z<0)) u.negate();
    const v=n.clone().cross(u).normalize();
    for(let j=0;j<3;j++) {a.fromBufferAttribute(p,i+j);uv[(i+j)*2]=a.dot(u)/.177;uv[(i+j)*2+1]=a.dot(v);}
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
