self.onmessage=({data:{size,canopy}})=>{
  const grid=256,field=new Float32Array((grid+1)*(grid+1)*3),pools=canopy?[[.51,.48,.37,.29]]:[[.28,.42,.10,.07],[.72,.77,.07,.115],[.82,.2,.055,.04],[.13,.88,.045,.06],[.55,.13,.11,.035],[.47,.65,.035,.055]];
  for(let gy=0;gy<=grid;gy++)for(let gx=0;gx<=grid;gx++){
    const x=gx/grid*1024,y=gy/grid*1024,mottling=Math.sin(x*.018+Math.sin(y*.023)*1.8)+Math.sin(y*.031+x*.007)+.6*Math.sin(x*.057-y*.019),stain=Math.max(0,mottling-1.05);let pool=0,rim=0;
    for(const [cx,cy,rx,ry] of pools){const dx=(x/1024-cx)/rx,dy=(y/1024-cy)/ry,a=Math.atan2(dy,dx),r=Math.hypot(dx,dy)/(1+.12*Math.sin(3*a+cx*39)+.075*Math.sin(7*a+cy*31)+.04*Math.cos(11*a+cx*17));pool=Math.max(pool,Math.max(0,1-r*r));rim=Math.max(rim,Math.exp(-Math.pow((r-.93)/.055,2)));}
    const v=195+mottling*2-stain*6-pool*(canopy?38:25)+rim*7,k=(gy*(grid+1)+gx)*3;field[k]=v-stain*2+pool*3;field[k+1]=v;field[k+2]=v-stain*7-pool*7;
  }
  // Smooth metre-scale weathering is independent of the 4 mm aggregate pixels.
  const data=new Uint8ClampedArray(size*size*4);let seed=711;const stride=(grid+1)*3,aggregateSide=size/4+1,aggregate=new Float32Array(aggregateSide*aggregateSide);
  for(let i=0;i<aggregate.length;i++){seed=(1664525*seed+1013904223)>>>0;aggregate[i]=seed/4294967296;}
  for(let y=0;y<size;y++){const fy=y/size*grid,iy=Math.floor(fy),v=fy-iy;for(let x=0;x<size;x++){
    const fx=x/size*grid,ix=Math.floor(fx),u=fx-ix,k=iy*stride+ix*3,p=(y*size+x)*4;seed=(1664525*seed+1013904223)>>>0;
    const ax=(x%4)/4,ay=(y%4)/4,au=ax*ax*(3-2*ax),av=ay*ay*(3-2*ay),ak=(y>>2)*aggregateSide+(x>>2),stone=(aggregate[ak]*(1-au)+aggregate[ak+1]*au)*(1-av)+(aggregate[ak+aggregateSide]*(1-au)+aggregate[ak+aggregateSide+1]*au)*av;
    // Correlated granules survive minification; fine noise alone averages into a flat sheen.
    const grain=(stone-.5)*75+(seed/4294967296-.5)*18,seam=(y%(size/16)<1||x%(size/4)<1)?-10:0;
    for(let ch=0;ch<3;ch++)data[p+ch]=(field[k+ch]*(1-u)+field[k+3+ch]*u)*(1-v)+(field[k+stride+ch]*(1-u)+field[k+stride+3+ch]*u)*v+grain+seam;data[p+3]=255;
  }}
  self.postMessage(data,[data.buffer]);
};
