import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition,openBrowser} from '@remotion/renderer';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {withPipeline} from './pipeline.mjs';
import {prepareMix} from './mix.mjs';
const mode=process.argv[2]||'hero';
if(!['hero','vertical','all','preview','preview-vertical','draft'].includes(mode))throw new Error(`Unknown render mode: ${mode}`);
await withPipeline(`render:${mode}`,async pipeline=>{
const browserExecutable=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const voiceover=existsSync(resolve(pipeline.root,'assets/audio/voiceover.wav'))?'audio/voiceover.wav':null;
const serveUrl=await bundle({entryPoint:resolve(pipeline.root,'src/index.ts'),publicDir:resolve(pipeline.root,'assets'),outDir:resolve(pipeline.workspace,'bundle'),onProgress:p=>{if(p===100)console.log('Bundle ready');}});
const browser=await openBrowser('chrome',{browserExecutable,chromiumOptions:{gl:'angle'}});
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('FFmpeg failed');}
const heroFrames=[40,95,175,245,340,420,510,610,720,798,875,950,1030,1130,1210,1280,1360,1465,1555,1655,1740];
try{
 if(mode==='preview'||mode==='preview-vertical'){
  const vertical=mode==='preview-vertical';
  const inputProps={music:true,sfx:true,voiceover:null};
  const composition=await selectComposition({serveUrl,id:vertical?'FitZoneVertical':'FitZoneHero',inputProps,puppeteerInstance:browser});
  for(const frame of vertical?[45,180,440,665,825]:heroFrames){await renderStill({serveUrl,composition,frame,inputProps,output:await pipeline.stage(`output/qa/${vertical?'portrait-preview-':'frame-'}${String(frame).padStart(4,'0')}.png`),puppeteerInstance:browser,imageFormat:'png'});console.log('Preview',frame);}
 }else if(mode==='draft'){
  const inputProps={music:false,sfx:false,voiceover:null};
  const composition=await selectComposition({serveUrl,id:'FitZoneHero',inputProps,puppeteerInstance:browser});
  await renderMedia({serveUrl,composition,inputProps,codec:'h264',outputLocation:await pipeline.stage('output/fitzone-draft-540p.mp4'),puppeteerInstance:browser,muted:true,crf:24,scale:0.5,x264Preset:'ultrafast',concurrency:3,onProgress:p=>{const n=Math.floor(p.progress*100);if(n%10===0&&n!==globalThis.lastProgress){globalThis.lastProgress=n;console.log(`Draft: ${n}%`);}}});
 }else{
  for(const vertical of mode==='all'?[false,true]:[mode==='vertical']){
   const id=vertical?'FitZoneVertical':'FitZoneHero';
   const inputProps={music:true,sfx:true,voiceover:vertical?null:voiceover};
   const composition=await selectComposition({serveUrl,id,inputProps,puppeteerInstance:browser});
   const master=await pipeline.stage(`output/${vertical?'vertical':'hero'}-picture-master.mp4`);
   await renderMedia({serveUrl,composition,inputProps,codec:'h264',outputLocation:master,puppeteerInstance:browser,muted:true,crf:17,pixelFormat:'yuv420p',colorSpace:'bt709',x264Preset:'fast',concurrency:Math.min(3,Math.max(2,Math.floor(os.cpus().length/2))),onProgress:p=>{const n=Math.floor(p.progress*100);if(n%10===0&&n!==globalThis.lastProgress){globalThis.lastProgress=n;console.log(`${id}: ${n}%`);}}});
   await prepareMix(pipeline,{vertical,masterPath:master});
   if(!vertical){
    ff(['-i',master,'-an','-c:v','copy','-movflags','+faststart',await pipeline.stage('output/fitzone-silent-1080p.mp4')]);
   }
   for(const frame of vertical?[45,180,440,665,825]:heroFrames){await renderStill({serveUrl,composition,frame,inputProps,output:await pipeline.stage(`output/qa/${vertical?'vertical-':'final-'}${String(frame).padStart(4,'0')}.png`),puppeteerInstance:browser,imageFormat:'png'});}
  }
 }
 await writeFile(await pipeline.stage('output/render-info.json'),JSON.stringify({remotion:'4.0.538',mode,renderedAt:new Date().toISOString(),voiceover,browserExecutable},null,2));
}finally{await browser.close({silent:true});}
});
