import {writeFile} from 'node:fs/promises';
import {withPipeline} from './pipeline.mjs';
// Original deterministic synthesis. No recordings, samples, or third-party compositions.
const SR=48000;
function wav(samples){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return b;}
let seed=31415;const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2147483648-1;};
const hz=m=>440*2**((m-69)/12);
function add(buf,start,dur,fn,pan=0){const a=Math.max(0,Math.round(start*SR)),n=Math.min(Math.round(dur*SR),buf.length/2-a);for(let j=0;j<n;j++){const t=j/SR,v=fn(t,j,n);buf[(a+j)*2]+=v*Math.sqrt((1-pan)/2);buf[(a+j)*2+1]+=v*Math.sqrt((1+pan)/2);}}
function generate(duration,vertical){
 const music=new Float32Array(duration*SR*2),sfx=new Float32Array(music.length),beat=.5;
 const chords=[[40,47,52,55,59],[36,43,48,52,55],[43,50,55,59,62],[38,45,50,54,57]];
 for(let bar=0;bar<duration/2;bar++){
  const start=bar*2,c=start>=duration-6?chords[0]:chords[Math.floor(bar/2)%4];
  c.slice(1).forEach((m,i)=>add(music,start,2.8,t=>{
   const env=Math.min(1,t/.28)*Math.min(1,(2.8-t)/.75),freq=hz(m);
   return env*.027*(Math.sin(2*Math.PI*freq*t)+.35*Math.sin(2*Math.PI*freq*1.002*t)+.15*Math.sin(4*Math.PI*freq*t));
  },(i-1.5)*.3));
  if(start>3&&start<duration-4){
   for(let b=0;b<4;b++){
    add(music,start+b*beat,.32,t=>.2*Math.exp(-t*18)*Math.sin(2*Math.PI*(48*t+65*(1-Math.exp(-t*40))/40)));
    if(b%2===1)add(music,start+b*beat,.16,t=>noise()*.032*Math.exp(-t*26));
    add(music,start+b*beat+.25,.055,t=>noise()*.018*Math.exp(-t*90),b%2?.45:-.45);
    const bass=hz(c[0]);add(music,start+b*beat,.38,t=>.068*Math.sin(2*Math.PI*bass*t)*Math.min(1,t/.012)*Math.exp(-t*7));
   }
   for(let a=0;a<8;a++){
    const note=hz(c[[1,2,3,2,4,3,2,1][a]]+12);
    const tone=t=>.044*Math.exp(-t*9)*Math.min(1,t/.008)*(Math.sin(2*Math.PI*note*t)+.17*Math.sin(4*Math.PI*note*t));
    add(music,start+a*.25,.6,tone,a%2?.35:-.35);add(music,start+a*.25+.375,.6,t=>tone(t)*.25,a%2?-.6:.6);
   }
  }
 }
 const transitions=vertical?[0,4,12,20,25]:[0,5,13,23,33,41,48,54];
 for(const at of transitions){
  let low=0;
  add(sfx,Math.max(0,at-.25),.45,t=>{low=.88*low+.12*noise();return low*.08*Math.sin(Math.PI*t/.45)**2;},.12);
  add(sfx,at,.55,t=>.1*Math.exp(-t*11)*Math.sin(2*Math.PI*(46*t+30*(1-Math.exp(-t*12))/12)));
  if(vertical||at===0||at===54)[64,71,76].forEach((m,i)=>add(sfx,at+i*.055,1.25,t=>.037*Math.exp(-t*5)*Math.sin(2*Math.PI*hz(m)*t),i*.3-.3));
 }
 (vertical?[6.5,7.2,21.5]:[6.8,7.95,24.1,26.6,29.16,31.2,34.23,43.33,45.2]).forEach(at=>add(sfx,at,.07,t=>.03*Math.sin(2*Math.PI*(1350*t-1800*t*t))*Math.exp(-t*75)));
 // A resolved E minor tonic, with a short ending tail.
 [40,47,52,55,59,64].forEach((m,i)=>add(music,duration-5,4.9,t=>.035*Math.sin(2*Math.PI*hz(m)*t)*Math.min(1,t/.1)*Math.exp(-t*.85),i/8-.3));
 for(let i=0;i<music.length/2;i++){const t=i/SR,g=Math.min(1,t/1.2)*Math.min(1,(duration-t)/1.2);music[i*2]*=g;music[i*2+1]*=g;const h=Math.min(1,(duration-t)/.5);sfx[i*2]*=h;sfx[i*2+1]*=h;}
 return {music,sfx};
}
await withPipeline('audio',async pipeline=>{
 for(const [duration,vertical] of [[60,false],[30,true]].filter(([,v])=>!process.argv.includes('--hero-only')||!v)){const stems=generate(duration,vertical);for(const [name,data]of Object.entries(stems)){let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));const gain=(name==='music'?.5:.35)/peak;for(let i=0;i<data.length;i++)data[i]*=gain;await writeFile(await pipeline.stage(`assets/audio/${vertical?'vertical-':''}${name}.wav`),wav(data));console.log(`${vertical?'Vertical':'Hero'} ${name}: ${duration}s, original stereo PCM`);}}
});
