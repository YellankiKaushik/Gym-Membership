import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {withPipeline} from '../scripts/pipeline.mjs';
import {prepareMix} from '../scripts/mix.mjs';

async function project(t){
 const root=await fs.mkdtemp(join(tmpdir(),'fitzone-pipeline-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return root;
}

async function mixProject(t){
 const root=await project(t);
 await fs.mkdir(join(root,'output'));
 await fs.mkdir(join(root,'assets/audio'),{recursive:true});
 await fs.writeFile(join(root,'audio-config.json'),JSON.stringify({musicGain:1,sfxGain:1,voiceoverGain:1,musicGainWithVoiceover:.42,targetLUFS:-17,truePeakDB:-1.5}));
 for(const name of ['music.wav','sfx.wav'])await fs.writeFile(join(root,'assets/audio',name),'fixture audio');
 for(const name of ['hero-picture-master.mp4','fitzone-clean-no-voiceover.mp4','fitzone-hero-1080p.mp4'])await fs.writeFile(join(root,'output',name),'original '+name);
 return root;
}

async function originalsIntact(root){
 for(const name of ['hero-picture-master.mp4','fitzone-clean-no-voiceover.mp4','fitzone-hero-1080p.mp4'])assert.equal(await fs.readFile(join(root,'output',name),'utf8'),'original '+name);
}

async function noTemporaryFiles(root){
 assert.deepEqual((await fs.readdir(root)).filter(name=>name.startsWith('.pipeline-')),[]);
}

test('one project lock excludes competing audio/render/mix jobs across processes',async t=>{
 const root=await project(t);
 const moduleUrl=new URL('../scripts/pipeline.mjs',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`import {withPipeline} from ${JSON.stringify(moduleUrl)}; await withPipeline('render',async()=>{console.log('LOCKED');await new Promise(resolve=>process.stdin.once('data',resolve));},{root:process.argv[1]});`,root],{stdio:['pipe','pipe','pipe']});
 t.after(()=>{if(child.exitCode===null)child.kill();});
 let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
 const finished=once(child,'exit');
 await new Promise((resolve,reject)=>{
  child.stdout.once('data',chunk=>String(chunk).includes('LOCKED')?resolve():reject(new Error(String(chunk))));
  child.once('error',reject);
  child.once('exit',code=>reject(new Error(`Lock holder exited early (${code}): ${stderr}`)));
 });
 for(const label of ['audio','render:vertical','mix']){
  await assert.rejects(withPipeline(label,()=>assert.fail('Competing job entered the transaction'),{root}),{code:'PIPELINE_BUSY'});
 }
 child.stdin.end('release');
 const [code]=await finished;
 assert.equal(code,0,stderr);
 await withPipeline('audio',async()=>{}, {root});
 await noTemporaryFiles(root);
});

test('audio publication cannot replace stems while a render consumes them',async t=>{
 const root=await project(t);
 await fs.mkdir(join(root,'assets/audio'),{recursive:true});
 const stem=join(root,'assets/audio/music.wav');
 await fs.writeFile(stem,'approved stem');
 await withPipeline('render',async()=>{
  await assert.rejects(withPipeline('audio',async pipeline=>{
   await fs.writeFile(await pipeline.stage('assets/audio/music.wav'),'new stem');
  },{root}),{code:'PIPELINE_BUSY'});
  assert.equal(await fs.readFile(stem,'utf8'),'approved stem');
 },{root});
 await withPipeline('audio',async pipeline=>{
  await fs.writeFile(await pipeline.stage('assets/audio/music.wav'),'new stem');
  await assert.rejects(withPipeline('mix',()=>assert.fail('Mix consumed unpublished stems'),{root}),{code:'PIPELINE_BUSY'});
  assert.equal(await fs.readFile(stem,'utf8'),'approved stem');
 },{root});
 assert.equal(await fs.readFile(stem,'utf8'),'new stem');
});

test('a failed hero encode leaves the previously published clean and hero pair intact',async t=>{
 const root=await mixProject(t);
 let calls=0;
 await assert.rejects(withPipeline('mix',pipeline=>prepareMix(pipeline,{ffmpeg:async args=>{
  await fs.writeFile(args.at(-1),++calls===1?'completed clean':'partial hero');
  await originalsIntact(root);
  if(calls===2)throw new Error('injected hero encode failure');
 }}),{root}),/injected hero encode failure/);
 assert.equal(calls,2);
 await originalsIntact(root);
 await noTemporaryFiles(root);
});

test('parent render prepares mixes under its lock and publishes the completed set together',async t=>{
 const root=await mixProject(t);
 let calls=0;
 await withPipeline('render:hero',async pipeline=>{
  const master=await pipeline.stage('output/hero-picture-master.mp4');
  await fs.writeFile(master,'new picture master');
  await prepareMix(pipeline,{masterPath:master,ffmpeg:async args=>{
   assert.equal(args[1],master);
   assert.ok(args.includes('copy'));
   await originalsIntact(root);
   await fs.writeFile(args.at(-1),++calls===1?'new clean':'new hero');
  }});
  await originalsIntact(root);
 },{root});
 assert.equal(calls,2);
 assert.equal(await fs.readFile(join(root,'output/hero-picture-master.mp4'),'utf8'),'new picture master');
 assert.equal(await fs.readFile(join(root,'output/fitzone-clean-no-voiceover.mp4'),'utf8'),'new clean');
 assert.equal(await fs.readFile(join(root,'output/fitzone-hero-1080p.mp4'),'utf8'),'new hero');
 await noTemporaryFiles(root);
});

test('a later render failure also discards already completed staged mixes',async t=>{
 const root=await mixProject(t);
 await assert.rejects(withPipeline('render:all',async pipeline=>{
  const master=await pipeline.stage('output/hero-picture-master.mp4');
  await fs.writeFile(master,'new master');
  await prepareMix(pipeline,{masterPath:master,ffmpeg:args=>fs.writeFile(args.at(-1),'new mix')});
  throw new Error('injected later vertical/frame failure');
 },{root}),/injected later vertical\/frame failure/);
 await originalsIntact(root);
 await noTemporaryFiles(root);
});

test('publication rename failure rolls back every earlier replacement',async t=>{
 const root=await mixProject(t);
 let failed=false;
 const io={...fs,rename:async(source,destination)=>{
  if(!failed&&source.includes(sep+'new'+sep)&&destination.endsWith('fitzone-hero-1080p.mp4')){
   failed=true;
   throw new Error('injected publication failure');
  }
  return fs.rename(source,destination);
 }};
 await assert.rejects(withPipeline('mix',pipeline=>prepareMix(pipeline,{ffmpeg:args=>fs.writeFile(args.at(-1),'new mix')}),{root,io}),/injected publication failure/);
 assert.equal(failed,true);
 await originalsIntact(root);
 await noTemporaryFiles(root);
});

test('backup rename failure restores previous files without publishing the new set',async t=>{
 const root=await mixProject(t);
 let failed=false;
 const io={...fs,rename:async(source,destination)=>{
  if(!failed&&destination.includes(sep+'backups'+sep)&&source.endsWith('fitzone-hero-1080p.mp4')){
   failed=true;
   throw new Error('injected backup failure');
  }
  return fs.rename(source,destination);
 }};
 await assert.rejects(withPipeline('mix',pipeline=>prepareMix(pipeline,{ffmpeg:args=>fs.writeFile(args.at(-1),'new mix')}),{root,io}),/injected backup failure/);
 await originalsIntact(root);
 await noTemporaryFiles(root);
});

test('incomplete rollback preserves backups and identifies the recovery directory',async t=>{
 const root=await mixProject(t);
 let publicationFailed=false;
 const io={...fs,rename:async(source,destination)=>{
  if(!publicationFailed&&source.includes(sep+'new'+sep)&&destination.endsWith('fitzone-hero-1080p.mp4')){
   publicationFailed=true;
   throw new Error('injected publication failure');
  }
  if(publicationFailed&&source.includes(sep+'backups'+sep)&&destination.endsWith('fitzone-hero-1080p.mp4'))throw new Error('injected restoration failure');
  return fs.rename(source,destination);
 }};
 let recovery;
 await assert.rejects(withPipeline('mix',pipeline=>prepareMix(pipeline,{ffmpeg:args=>fs.writeFile(args.at(-1),'new mix')}),{root,io}),error=>{
  assert.equal(error.code,'PIPELINE_ROLLBACK_INCOMPLETE');
  recovery=error.recoveryDirectory;
  assert.ok(error.message.includes(recovery));
  return true;
 });
 assert.ok(existsSync(recovery));
 const journal=JSON.parse(await fs.readFile(join(recovery,'publication.json'),'utf8'));
 assert.equal(journal.files[1].destination,join(root,'output/fitzone-hero-1080p.mp4'));
 assert.equal(await fs.readFile(join(recovery,'backups','1'),'utf8'),'original fitzone-hero-1080p.mp4');
 assert.equal(await fs.readFile(join(root,'output/fitzone-clean-no-voiceover.mp4'),'utf8'),'original fitzone-clean-no-voiceover.mp4');
 const owner=JSON.parse(await fs.readFile(join(root,'.pipeline-lock/owner.json'),'utf8'));
 assert.equal(owner.status,'recovery-required');
 assert.equal(owner.recoveryDirectory,recovery);
 await assert.rejects(withPipeline('mix',()=>assert.fail('Pipeline entered before recovery'),{root}),{code:'PIPELINE_BUSY'});
});

test('preflight rejects incomplete output sets before moving any published file',async t=>{
 const root=await mixProject(t);
 await assert.rejects(withPipeline('render:hero',async pipeline=>{
  await fs.writeFile(await pipeline.stage('output/fitzone-clean-no-voiceover.mp4'),'new clean');
  await pipeline.stage('output/fitzone-hero-1080p.mp4');
 },{root}),{code:'ENOENT'});
 await originalsIntact(root);
 await noTemporaryFiles(root);
});

test('staging paths cannot escape the project or register the same output twice',async t=>{
 const root=await project(t);
 await assert.rejects(withPipeline('audio',pipeline=>pipeline.stage('../outside.wav'),{root}),/Invalid pipeline output path/);
 await assert.rejects(withPipeline('audio',async pipeline=>{
  await pipeline.stage('assets/audio/music.wav');
  await pipeline.stage('assets/audio/music.wav');
 },{root}),/Duplicate pipeline output/);
 await noTemporaryFiles(root);
});
