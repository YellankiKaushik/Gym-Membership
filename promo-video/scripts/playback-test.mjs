import {chromium} from '../../node_modules/playwright/index.mjs';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
for(const file of ['fitzone-hero-1080p.mp4','fitzone-vertical-1080x1920.mp4']){
 if(!existsSync(resolve('output',file)))throw new Error(`Missing output/${file}. Run npm run render:all first.`);
}
const player=resolve('output/watch.html');
// A fresh clone has no generated player. Preserve an existing local player.
if(!existsSync(player)){
 await mkdir('output',{recursive:true});
 await writeFile(player,`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FitZone promotional films</title>
<style>body{margin:40px;background:#061b13;color:#ecfff1;font-family:'Segoe UI',Arial,sans-serif}video{display:block;width:min(100%,1280px);margin:24px 0 48px}#vertical{width:min(100%,420px)}</style>
<h1>FitZone — Less admin. More momentum.</h1><p>60-second hero film · 1920×1080 · 30 fps</p>
<video id="hero" controls preload="metadata" src="fitzone-hero-1080p.mp4"></video>
<h2>FitZone, in portrait.</h2><p>30-second vertical cutdown · 1080×1920 · 30 fps</p>
<video id="vertical" controls preload="metadata" src="fitzone-vertical-1080x1920.mp4"></video>
<p>All member details are illustrative. No live member data is shown.</p></html>
`);
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try{
 const page=await browser.newPage();
 await page.goto(pathToFileURL(player).href);
 for(const id of ['hero','vertical']){
  const result=await page.evaluate(async id=>{
   const video=document.getElementById(id);
   if(video.readyState<2) await new Promise((yes,no)=>{video.addEventListener('loadeddata',yes,{once:true});video.addEventListener('error',()=>no(new Error(video.error?.message)),{once:true});video.load();});
   video.muted=true;await video.play();await new Promise(r=>setTimeout(r,600));video.pause();
   const start=video.currentTime;video.currentTime=id==='hero'?57:27;await new Promise(r=>video.addEventListener('seeked',r,{once:true}));
   return {id,videoWidth:video.videoWidth,videoHeight:video.videoHeight,duration:video.duration,playbackAdvanced:start>0,seekedTo:video.currentTime,error:video.error,decodedFrames:video.getVideoPlaybackQuality().totalVideoFrames};
  },id);
  if(result.error||!result.playbackAdvanced||result.decodedFrames<1)throw new Error(JSON.stringify(result));results.push(result);
 }
 await writeFile('output/playback-verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
