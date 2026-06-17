// Introspect current component sources -> write entry.mjs + config.componentSrcMap.
// Runs fresh each build so a live repo (parallel pushes) stays in sync.
import { Project, Node, ts } from 'ts-morph';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = process.cwd();
const DIR = join(ROOT, 'src/shared/components');
function walk(d){let o=[];for(const e of readdirSync(d)){const p=join(d,e);if(statSync(p).isDirectory())o=o.concat(walk(p));else if(/\.tsx$/.test(p)&&!/\.(stories|test|spec)\./.test(p))o.push(p);}return o;}
const project=new Project({skipAddingFilesFromTsConfig:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,allowJs:true,skipLibCheck:true}});
const data=[];
for(const f of walk(DIR)){
  const sf=project.addSourceFileAtPathIfExists(f);if(!sf)continue;
  const names=[];
  for(const [name,decls] of sf.getExportedDeclarations()){
    const real=name==='default'?decls.map(d=>d.getName?.()).find(n=>n&&n!=='default'):name;
    if(!real||!/^[A-Z][A-Za-z0-9]*$/.test(real))continue;
    if(decls.some(d=>Node.isVariableDeclaration(d)||Node.isFunctionDeclaration(d)||Node.isClassDeclaration(d)))names.push({id:real,isDefault:name==='default'});
  }
  if(names.length)data.push({file:relative(ROOT,f),names});
}
// preserve explicit exclusions (null) from existing config
const cfgp=join(ROOT,'.design-sync/config.json');
const cfg=JSON.parse(readFileSync(cfgp,'utf8'));
const excluded=new Set(Object.entries(cfg.componentSrcMap||{}).filter(([,v])=>v===null).map(([k])=>k));
const lines=['import "./stubs/process-shim.mjs";', 'export { PreviewProvider } from "./provider/PreviewProvider";'];
const map={}; const seen=new Set();
for(const {file,names} of data){
  const rel='../'+file;
  const named=names.filter(n=>!n.isDefault&&!excluded.has(n.id)).map(n=>n.id).filter(id=>{if(seen.has(id))return false;seen.add(id);return true;});
  const def=names.find(n=>n.isDefault&&!excluded.has(n.id));
  if(named.length)lines.push(`export { ${named.join(', ')} } from ${JSON.stringify(rel)};`);
  if(def&&!seen.has(def.id)){seen.add(def.id);lines.push(`export { default as ${def.id} } from ${JSON.stringify(rel)};`);}
  for(const n of names){if(map[n.id]===undefined)map[n.id]=excluded.has(n.id)?null:file;}
}
for(const k of excluded)if(map[k]===undefined)map[k]=null;
writeFileSync(join(ROOT,'.design-sync/entry.mjs'),lines.join('\n')+'\n');
cfg.componentSrcMap=map;
writeFileSync(cfgp,JSON.stringify(cfg,null,2)+'\n');
const live=Object.values(map).filter(v=>v!==null).length;
console.log(`gen: ${live} components, ${excluded.size} excluded`);
