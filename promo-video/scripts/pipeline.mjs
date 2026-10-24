import * as fs from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));

function inside(root,path){
 const child=relative(root,path);
 return child!==''&&!isAbsolute(child)&&child!=='..'&&!child.startsWith('..'+sep);
}

async function existingFile(io,path){
 try{
  const info=await io.lstat(path);
  if(!info.isFile())throw new Error(`Pipeline destination must be a regular file: ${path}`);
  return true;
 }catch(error){if(error.code==='ENOENT')return false;throw error;}
}

// This is a recoverable replacement transaction, not a multi-file crash-atomic rename.
async function publish(io,entries,workspace){
 const plan=[];
 for(const [index,{source,destination}] of entries.entries()){
  const info=await io.lstat(source);
  if(!info.isFile()||info.size===0)throw new Error(`Pipeline output is missing or empty: ${source}`);
  const existed=await existingFile(io,destination);
  plan.push({source,destination,existed,backup:join(workspace,'backups',String(index))});
 }
 const backups=[],installed=[];
 try{
  await io.mkdir(join(workspace,'backups'),{recursive:true});
  // Leave a path map for manual recovery after a crash or failed rollback.
  await io.writeFile(join(workspace,'publication.json'),JSON.stringify({files:plan},null,2));
  // Move the entire previous set aside before making any new output visible.
  for(const entry of plan){
   await io.mkdir(dirname(entry.destination),{recursive:true});
   if(entry.existed){
    await io.rename(entry.destination,entry.backup);
    backups.push(entry);
   }
  }
  for(const entry of plan){
   await io.rename(entry.source,entry.destination);
   installed.push(entry);
  }
 }catch(error){
  const rollbackErrors=[];
  for(const entry of installed.reverse()){
   try{await io.rename(entry.destination,entry.source);}catch(failure){rollbackErrors.push(failure);}
  }
  for(const entry of backups.reverse()){
   try{await io.rename(entry.backup,entry.destination);}catch(failure){rollbackErrors.push(failure);}
  }
  if(rollbackErrors.length){
   const failure=new AggregateError([error,...rollbackErrors],`Output publication failed and rollback was incomplete. The pipeline remains locked. Recover files using ${join(workspace,'publication.json')} before removing the lock.`,{cause:error});
   failure.code='PIPELINE_ROLLBACK_INCOMPLETE';
   failure.recoveryDirectory=workspace;
   throw failure;
  }
  throw error;
 }
}

/** All cooperating render/audio/mix commands share one exclusive project lock. */
export async function withPipeline(label,task,{root=projectRoot,io=fs}={}){
 root=resolve(root);
 const lock=join(root,'.pipeline-lock');
 try{await io.mkdir(lock);}catch(error){
  if(error.code!=='EEXIST')throw error;
  const busy=new Error(`FitZone pipeline is busy (${lock}). Wait for the active render/audio/mix command to finish. If it crashed, confirm no pipeline process is running, inspect owner.json and recover any publication backups before removing the stale lock.`);
  busy.code='PIPELINE_BUSY';
  throw busy;
 }
 let workspace,result,failure,active=true;
 const owner={pid:process.pid,label,startedAt:new Date().toISOString()};
 const entries=[];
 try{
  await io.writeFile(join(lock,'owner.json'),JSON.stringify(owner,null,2));
  workspace=await io.mkdtemp(join(root,'.pipeline-work-'));
  const pipeline={
   root,workspace,
   assertActive(){if(!active)throw new Error('Pipeline transaction is no longer active.');},
   async stage(name){
    this.assertActive();
    const destination=resolve(root,name),source=resolve(workspace,'new',name);
    if(!inside(root,destination)||!inside(join(workspace,'new'),source))throw new Error(`Invalid pipeline output path: ${name}`);
    if(entries.some(entry=>entry.destination===destination))throw new Error(`Duplicate pipeline output: ${name}`);
    await io.mkdir(dirname(source),{recursive:true});
    entries.push({source,destination});
    return source;
   },
  };
  result=await task(pipeline);
  await publish(io,entries,workspace);
 }catch(error){failure=error;}finally{active=false;}
 // Preserve backups if rollback itself failed; never destroy recovery evidence.
 if(workspace&&!failure?.recoveryDirectory){
  try{await io.rm(workspace,{recursive:true,force:true});}catch(error){failure=failure?new AggregateError([failure,error],'Pipeline failed and its temporary workspace could not be removed.'):error;}
 }
 if(failure?.recoveryDirectory){
  try{await io.writeFile(join(lock,'owner.json'),JSON.stringify({...owner,status:'recovery-required',recoveryDirectory:failure.recoveryDirectory},null,2));}catch(error){failure.errors.push(error);}
 }else{
  try{await io.rm(lock,{recursive:true,force:true});}catch(error){failure=failure?new AggregateError([failure,error],'Pipeline failed and its lock could not be removed.'):error;}
 }
 if(failure)throw failure;
 return result;
}
