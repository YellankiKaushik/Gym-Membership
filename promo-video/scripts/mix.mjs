import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const cfg=JSON.parse(await readFile('audio-config.json','utf8'));
const vertical=process.argv.includes('--vertical');
const prefix=vertical?'vertical-':'';
const master=`output/${vertical?'vertical':'hero'}-picture-master.mp4`;
if(!existsSync(master))throw new Error('Render the picture first with npm run render or npm run render:vertical.');
const duration=vertical?30:60;
const common=['-i',master,'-i',`assets/audio/${prefix}music.wav`,'-i',`assets/audio/${prefix}sfx.wav`];
const audio=(voice)=>`[1:a]volume=${voice?cfg.musicGainWithVoiceover:cfg.musicGain}[m];[2:a]volume=${cfg.sfxGain}[s];${voice?`[3:a]volume=${cfg.voiceoverGain}[v];`:''}[m][s]${voice?'[v]':''}amix=inputs=${voice?3:2}:normalize=0,loudnorm=I=${cfg.targetLUFS}:TP=${cfg.truePeakDB}:LRA=9[a]`;
function ff(inputs,filter,path){const r=spawnSync('ffmpeg',['-hide_banner','-y',...inputs,'-filter_complex',filter,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t',String(duration),'-movflags','+faststart',path],{stdio:'inherit'});if(r.status!==0)throw new Error('Audio assembly failed');}
ff(common,audio(false),vertical?'output/fitzone-vertical-1080x1920.mp4':'output/fitzone-clean-no-voiceover.mp4');
if(!vertical){const voice=existsSync('assets/audio/voiceover.wav');ff(voice?[...common,'-i','assets/audio/voiceover.wav']:common,audio(voice),'output/fitzone-hero-1080p.mp4');}
