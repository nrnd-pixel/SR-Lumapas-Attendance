export const $=id=>document.getElementById(id);

export function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

export function fillGroupedClasses(select,classes,{blankLabel=null,excludeId=null,compact=false}={}){
  select.innerHTML='';
  if(blankLabel!==null){const o=document.createElement('option');o.value='';o.textContent=blankLabel;select.appendChild(o);}
  const groups=new Map();
  (classes||[]).filter(c=>c.id!==excludeId).forEach(c=>{const y=c.year_level||0;if(!groups.has(y))groups.set(y,[]);groups.get(y).push(c);});
  [...groups.keys()].sort((a,b)=>a-b).forEach(y=>{
    const g=document.createElement('optgroup');g.label=y===0?'Prasekolah':'Year '+y;
    groups.get(y).sort((a,b)=>a.class_code.localeCompare(b.class_code)).forEach(c=>{
      const o=document.createElement('option');o.value=c.id;
      o.textContent=compact?(y===0?c.class_code.replace('PRA ','Pra '):c.class_code):(c.class_code+' — '+c.class_name);
      g.appendChild(o);
    });select.appendChild(g);
  });
}
