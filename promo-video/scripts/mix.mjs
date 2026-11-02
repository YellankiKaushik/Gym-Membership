import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {withPipeline} from './pipeline.mjs';

function runFfmpeg(args){
 const result=spawnSync('ffmpeg',['-hide_banner','-y',...args],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error('Audio assembly failed');
}

// Prepare every mix in the caller's transaction. Rendering calls this directly,
// rather than launching another CLI that would try to acquire the same lock.
export async function prepareMix(pipeline,{vertical=false,masterPath,ffmpeg=runFfmpeg}={}){
 pipeline.assertActive();
 const cfg=JSON.parse(await readFile(resolve(pipeline.root,'audio-config.json'),'utf8'));
 const prefix=vertical?'vertical-':'';
 const master=masterPath||resolve(pipeline.root,`output/${vertical?'vertical':'hero'}-picture-master.mp4`);
 if(!existsSync(master))throw new Error('Render the picture first with npm run render or npm run render:vertical.');
 const duration=vertical?30:60;
 const common=['-i',master,'-i',resolve(pipeline.root,`assets/audio/${prefix}music.wav`),'-i',resolve(pipeline.root,`assets/audio/${prefix}sfx.wav`)];
 const audio=voice=>`[1:a]volume=${voice?cfg.musicGainWithVoiceover:cfg.musicGain}[m];[2:a]volume=${cfg.sfxGain}[s];${voice?`[3:a]volume=${cfg.voiceoverGain}[v];`:''}[m][s]${voice?'[v]':''}amix=inputs=${voice?3:2}:normalize=0,loudnorm=I=${cfg.targetLUFS}:TP=${cfg.truePeakDB}:LRA=9[a]`;
 async function encode(inputs,voice,name){
  const staged=await pipeline.stage(`output/${name}`);
  await ffmpeg([...inputs,'-filter_complex',audio(voice),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t',String(duration),'-movflags','+faststart',staged]);
 }
 await encode(common,false,vertical?'fitzone-vertical-1080x1920.mp4':'fitzone-clean-no-voiceover.mp4');
 if(!vertical){
  const recording=resolve(pipeline.root,'assets/audio/voiceover.wav');
  const voice=existsSync(recording);
  await encode(voice?[...common,'-i',recording]:common,voice,'fitzone-hero-1080p.mp4');
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await withPipeline('mix',pipeline=>prepareMix(pipeline,{vertical:process.argv.includes('--vertical')}));
}
