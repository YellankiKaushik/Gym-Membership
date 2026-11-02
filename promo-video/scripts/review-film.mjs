import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const input=resolve(process.argv[2]||'output/fitzone-hero-1080p.mp4');
const directory=resolve(process.argv[3]||'output/review-v2');
await mkdir(directory,{recursive:true});
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-y',...args],{encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0)throw new Error(r.stderr);return r.stderr;}
for(const start of [0,10,20,30,40,50])ff(['-loglevel','error','-ss',String(start),'-t','10','-i',input,'-vf','fps=2,scale=480:270,tile=4x5:padding=8:margin=12:color=0x061b13','-frames:v','1',resolve(directory,`sequence-${start}.png`)]);
const log=ff(['-i',input,'-vf','freezedetect=n=-40dB:d=0.8','-an','-f','null','-']);
await writeFile(resolve(directory,'motion-analysis.txt'),log);
const intervals=[];let start=null;
for(const line of log.split(/\r?\n/)){let m=line.match(/freeze_start: ([\d.]+)/);if(m)start=Number(m[1]);m=line.match(/freeze_end: ([\d.]+)/);if(m&&start!==null){intervals.push({start,end:Number(m[1]),duration:Number(m[1])-start});start=null;}}
const total=intervals.reduce((n,i)=>n+i.duration,0);
await writeFile(resolve(directory,'motion-review.json'),JSON.stringify({input,method:'FFmpeg freezedetect -40 dB, 0.8 seconds; approximate visual-hold indicator, not a creative score',intervals,totalDetectedHoldSeconds:Number(total.toFixed(3))},null,2));
console.log(`Review sheets ready. ${total.toFixed(2)} seconds flagged as near-static; final CTA holds are intentional.`);
