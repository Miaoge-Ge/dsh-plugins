import {mkdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
await mkdir(new URL('dist/',root),{recursive:true});
// npm_execpath is supplied by `npm run`; pass arguments directly without a shell.
if(!process.env.npm_execpath)throw new Error('Run npm run pack:plugins');
for(const folder of manifest.workspaces){
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'pack','--workspace',folder,'--pack-destination',fileURLToPath(new URL('dist/',root))],{cwd:fileURLToPath(root),stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
