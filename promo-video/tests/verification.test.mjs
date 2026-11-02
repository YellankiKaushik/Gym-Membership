import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {validateStreamMetadata} from '../scripts/stream-metadata.mjs';
import {withPipeline} from '../scripts/pipeline.mjs';

const expected = {name: 'fixture.mp4', width: 16, height: 16, duration: .5, hasAudio: true};
const video = {codec_type: 'video', codec_name: 'h264', width: 16, height: 16, r_frame_rate: '30/1', pix_fmt: 'yuv420p'};
const audio = {codec_type: 'audio', codec_name: 'aac'};
const metadata = (streams = [video, audio]) => ({streams, format: {duration: '.5'}});

test('delivery metadata accepts H.264/AAC and the intentional silent export', () => {
  assert.deepEqual(validateStreamMetadata(metadata(), expected), {video, audio});
  assert.deepEqual(validateStreamMetadata(metadata([video]), {...expected, hasAudio: false}), {video, audio: undefined});
});

test('missing video is a descriptive validation failure', () => {
  for (const info of [metadata([audio]), metadata([]), {format: {duration: '.5'}}]) {
    assert.throws(() => validateStreamMetadata(info, expected), /missing video stream/);
  }
});

test('all present video and audio streams must use the delivery codecs', () => {
  for (const codec of ['mpeg4', 'vp9', undefined]) {
    assert.throws(() => validateStreamMetadata(metadata([{...video, codec_name: codec}, audio]), expected), /video codec/);
    assert.throws(() => validateStreamMetadata(metadata([video, {...video, codec_name: codec}, audio]), expected), /video codec/);
  }
  for (const codec of ['mp3', 'opus', undefined]) {
    assert.throws(() => validateStreamMetadata(metadata([video, {...audio, codec_name: codec}]), expected), /audio codec/);
    assert.throws(() => validateStreamMetadata(metadata([video, audio, {...audio, codec_name: codec}]), expected), /audio codec/);
  }
});

test('malformed durations and unexpected audio do not pass metadata checks', () => {
  for (const duration of [undefined, 'not-a-duration', '2']) {
    assert.throws(() => validateStreamMetadata({...metadata(), format: {duration}}, expected), /duration/);
  }
  assert.throws(() => validateStreamMetadata(metadata([video]), expected), /missing audio stream/);
  assert.throws(() => validateStreamMetadata(metadata(), {...expected, hasAudio: false}), /unexpected audio stream/);
});

test('verification refuses a competing pipeline lock before probing or writing reports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-verify-lock-test-'));
  try {
    await mkdir(join(directory, 'scripts'));
    for (const name of ['verify.mjs', 'pipeline.mjs', 'stream-metadata.mjs']) {
      await copyFile(new URL(`../scripts/${name}`, import.meta.url), join(directory, 'scripts', name));
    }
    await withPipeline('render', async () => {
      const result = spawnSync(process.execPath, [join(directory, 'scripts/verify.mjs'), '--published-only'], {
        cwd: directory, encoding: 'utf8', timeout: 15000
      });
      assert.equal(result.error, undefined, result.error?.message);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PIPELINE_BUSY/);
      // Deliberately no inputs exist: reaching any read/probe would fail differently.
      const names = await readdir(directory);
      assert.equal(names.filter(name => name.startsWith('.pipeline-work-')).length, 1);
      assert.deepEqual(names.filter(name => !name.startsWith('.pipeline-work-')).sort(), ['.pipeline-lock', 'scripts']);
    }, {root: directory});
    assert.deepEqual(await readdir(directory), ['scripts']);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

const hasFfmpeg = ['ffmpeg', 'ffprobe'].every(exe => spawnSync(exe, ['-version'], {encoding: 'utf8'}).status === 0);
test('fully decodable MPEG-4 and MP3 fixtures still fail the delivery codec contract', {skip: !hasFfmpeg}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fitzone-codec-test-'));
  const run = (exe, args) => {
    const result = spawnSync(exe, args, {encoding: 'utf8', timeout: 15000});
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout;
  };
  try {
    for (const [videoCodec, audioCodec, rejection] of [['mpeg4', 'aac', /video codec mpeg4/], ['libx264', 'libmp3lame', /audio codec mp3/]]) {
      const path = join(directory, `${videoCodec}-${audioCodec}.mp4`);
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=black:s=16x16:r=30:d=0.5', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.5', '-c:v', videoCodec, '-pix_fmt', 'yuv420p', '-c:a', audioCodec, '-t', '0.5', path]);
      run('ffmpeg', ['-v', 'error', '-i', path, '-f', 'null', '-']);
      const info = JSON.parse(run('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', path]));
      assert.throws(() => validateStreamMetadata(info, expected), rejection);
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
