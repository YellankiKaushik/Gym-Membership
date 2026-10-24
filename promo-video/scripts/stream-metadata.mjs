// Decoding alone does not prove that an export uses the delivery codecs.
export function validateStreamMetadata(info, {name, width, height, duration, hasAudio}) {
  const streams = Array.isArray(info.streams) ? info.streams : [];
  const videos = streams.filter(stream => stream.codec_type === 'video');
  const audios = streams.filter(stream => stream.codec_type === 'audio');
  const actualDuration = Number(info.format?.duration);
  const fail = detail => {throw new Error(`Unexpected stream metadata: ${name} (${detail})`);};

  if (!videos.length) fail('missing video stream');
  for (const video of videos) {
    if (video.codec_name !== 'h264') fail(`video codec ${video.codec_name || 'unknown'}; expected h264`);
    if (video.width !== width || video.height !== height || video.r_frame_rate !== '30/1' || video.pix_fmt !== 'yuv420p') {
      fail('video dimensions, frame rate or pixel format');
    }
  }
  if (Boolean(audios.length) !== hasAudio) fail(hasAudio ? 'missing audio stream' : 'unexpected audio stream');
  for (const audio of audios) {
    if (audio.codec_name !== 'aac') fail(`audio codec ${audio.codec_name || 'unknown'}; expected aac`);
  }
  if (!Number.isFinite(actualDuration) || Math.abs(actualDuration - duration) > .12) fail('duration');
  return {video: videos[0], audio: audios[0]};
}
