import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions,openBrowser,renderStill,renderMedia,selectComposition} from '@remotion/renderer';
import {withPipeline} from './pipeline.mjs';
import {validateStreamMetadata} from './stream-metadata.mjs';

const baseline=process.argv.find(value=>value.startsWith('--baseline='))?.slice('--baseline='.length);
await withPipeline('check:compositions',async pipeline=>{
 const serveUrl=await bundle({entryPoint:resolve(pipeline.root,'src/index.ts'),publicDir:resolve(pipeline.root,'assets'),outDir:resolve(pipeline.workspace,'bundle')});
 let browser;
 const results=[];
 try{
  browser=await openBrowser('chrome',{browserExecutable:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',chromiumOptions:{gl:'angle'}});
  const comps=await getCompositions(serveUrl,{puppeteerInstance:browser});
  assert.deepEqual(comps.map(({id,width,height,fps,durationInFrames})=>({id,width,height,fps,durationInFrames})),[
   {id:'FitZoneHero',width:1920,height:1080,fps:30,durationInFrames:1800},
   {id:'FitZoneVertical',width:1080,height:1920,fps:30,durationInFrames:900}
  ]);
  for(const composition of comps){
   const {id}=composition;
   const frames=id==='FitZoneHero'?[270,810]:[180,440];
   for(const frame of frames){
    const output=await pipeline.stage(`output/qa/check-${id}-${frame}.png`);
    await renderStill({serveUrl,composition,inputProps:composition.props,frame,scale:.25,imageFormat:'png',puppeteerInstance:browser,output});
    const picture=await readFile(output);
    if(baseline)assert.deepEqual(picture,await readFile(resolve(pipeline.root,baseline,`${id}-${frame}.png`)),`${id} approved baseline frame changed`);
    // Legacy JSON props must never switch a composition's layout or stem selection.
    const inputProps={...composition.props,vertical:composition.height<composition.width};
    const override=await selectComposition({serveUrl,id,inputProps,puppeteerInstance:browser});
    const conflict=resolve(pipeline.workspace,`${id}-${frame}-conflict.png`);
    await renderStill({serveUrl,composition:override,inputProps,frame,scale:.25,imageFormat:'png',puppeteerInstance:browser,output:conflict});
    assert.deepEqual(await readFile(conflict),picture,`${id} changed under conflicting layout props`);
   }
   const clip=await pipeline.stage(`output/qa/check-${id}-1s.mp4`);
   await renderMedia({serveUrl,composition,inputProps:composition.props,outputLocation:clip,frameRange:[frames[0],frames[0]+29],scale:.25,codec:'h264',crf:17,pixelFormat:'yuv420p',colorSpace:'bt709',x264Preset:'fast',concurrency:3,muted:true,puppeteerInstance:browser});
   const probe=spawnSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',clip],{encoding:'utf8'});
   if(probe.status!==0)throw new Error('Sample FFprobe failed');
   validateStreamMetadata(JSON.parse(probe.stdout),{name:id,width:composition.width/4,height:composition.height/4,duration:1,hasAudio:false});
   const decode=spawnSync('ffmpeg',['-v','error','-i',clip,'-f','null','-'],{encoding:'utf8'});
   assert.equal(decode.status,0,'Sample decoding failed');
   assert.equal(decode.stderr.trim(),'','Sample decoding errors');
   results.push({id,frames,layoutOverride:'ignored',baseline:baseline?'pixel-identical':'not requested',sampleDecode:'passed'});
   console.log(`${id}: metadata, layout override, ${frames.length} frames and 1s H.264 sample passed`);
  }
  await writeFile(await pipeline.stage('output/composition-check.json'),JSON.stringify(results,null,2));
 }finally{if(browser)await browser.close({silent:true});}
});
