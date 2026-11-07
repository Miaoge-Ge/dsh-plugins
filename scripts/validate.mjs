import {readFile,access} from 'node:fs/promises';
import {parseDocument} from 'yaml';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const manifest=JSON.parse(await read('package.json'));
const names=new Set();
for (const folder of manifest.workspaces) {
  const pkg=JSON.parse(await read(`${folder}/package.json`));
  if(pkg.version!==manifest.version)throw new Error(`${folder}: version must be ${manifest.version}`);
  if(names.has(pkg.name))throw new Error(`Duplicate plugin ${pkg.name}`);
  names.add(pkg.name);
  if(pkg.repository.url!==manifest.repository.url||pkg.repository.directory!==folder)throw new Error(`${folder}: repository metadata mismatch`);
  for (const [name,target] of Object.entries(pkg.exports??{})) if(!target.includes('*'))await access(new URL(`${folder}/${target}`,root));
  const patch=parseDocument(await read(`${folder}/cordis.patch.yml`),{customTags:[{tag:'tag:yaml.org,2002:js',resolve:value=>value}]});
  if(patch.errors.length)throw patch.errors[0];
  const data=patch.toJS();
  if(!Array.isArray(data)||!data.some(item=>Array.isArray(item.insert)))throw new Error(`${folder}: invalid plugin bundle`);
  console.log(`Validated ${pkg.name}@${pkg.version}`);
}
