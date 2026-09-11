import * as T from './lib/three/three.module.min.js';

// Merge static siblings by material, retaining the astronaut's joints and all
// independently animated sculptures. This reduces submissions, not model detail.
export function batchStaticMeshes(root,animated=[]){
  const skip=new Set(animated),old=new Set();
  const parents=[];root.traverse(node=>parents.push(node));
  for(const parent of parents){
    const batches=new Map();
    for(const child of parent.children){
      if(!child.isMesh||child.isInstancedMesh||child.children.length||skip.has(child)||Array.isArray(child.material))continue;
      const key=child.material; if(!batches.has(key))batches.set(key,[]);batches.get(key).push(child);
    }
    for(const [material,children] of batches){
      if(children.length<2)continue;
      const arrays={position:[],normal:[],uv:[]};
      for(const child of children){
        child.updateMatrix();const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
        geometry.applyMatrix4(child.matrix);
        for(const name of Object.keys(arrays)){
          const attribute=geometry.getAttribute(name);if(!attribute)continue;
          const values=attribute.array;
          if(child.matrix.determinant()<0){
            const n=attribute.itemSize;
            for(let i=0;i<values.length;i+=n*3)for(const vertex of [0,2,1])for(let j=0;j<n;j++)arrays[name].push(values[i+vertex*n+j]);
          }else for(const value of values)arrays[name].push(value);
        }
        geometry.dispose();old.add(child.geometry);parent.remove(child);
      }
      const geometry=new T.BufferGeometry();
      for(const [name,values] of Object.entries(arrays))if(values.length)geometry.setAttribute(name,new T.Float32BufferAttribute(values,name==='uv'?2:3));
      geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.name='Batched sculpture detail';parent.add(mesh);
    }
  }
  const retained=new Set();root.traverse(node=>{if(node.geometry)retained.add(node.geometry);});
  old.forEach(geometry=>{if(!retained.has(geometry))geometry.dispose();});
}
