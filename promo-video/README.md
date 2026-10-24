# FitZone promotional film

An editable Remotion project demonstrating FitZone's numeric member lookup, owner dashboard, member forms, search, expiry filters, Google Sheets integration, and responsive interface. The 60-second hero contains the latest creative-director revision; the 30-second portrait film is its independently composed earlier cutdown. This project does not change application functionality or deployment configuration.

## Published films and supporting material

| Export included in Git | Format | Size |
| --- | --- | --- |
| [Refined hero](output/fitzone-hero-1080p.mp4) | 60s, 1920×1080, 30 fps | 13,552,685 bytes / 12.92 MiB |
| [Vertical cutdown](output/fitzone-vertical-1080x1920.mp4) | 30s, 1080×1920, 30 fps | 5,535,652 bytes / 5.28 MiB |
| [Clean hero](output/fitzone-clean-no-voiceover.mp4) | 60s, 1920×1080, 30 fps | 13,552,685 bytes / 12.92 MiB |

All three contain H.264/yuv420p picture and stereo AAC music/effects. No final voiceover recording has been supplied, so the published hero and clean export are byte-identical. The clean workflow always excludes narration.

The combined exports are **32,641,022 bytes / 31.13 MiB**. Publication permits at most 20 MiB per MP4 and 40 MiB combined, prioritizing hero, vertical, then clean. These three reviewed files are explicit exceptions to the generated-output ignore rule. Future exports must be measured again before publication; Git LFS is not enabled.

The silent hero (`fitzone-silent-1080p.mp4`), 540p draft (`fitzone-draft-540p.mp4`), picture masters (`hero-picture-master.mp4`, `hero-picture-master-bt709.mp4`, `vertical-picture-master.mp4`), previous film, and detailed QA/review media remain preserved locally under `output/` and are excluded from Git. They are generated intermediates or historical material; adding the silent export alongside the three published films would exceed the combined budget. No existing media was recompressed or removed to meet the limit.

Published support includes the [encoded-film storyboard](output/storyboard.png), [verification report](output/VERIFICATION.md), [machine-readable verification](output/verification.json), [browser playback results](output/playback-verification.json), [narration script](VOICEOVER_SCRIPT.md), and [SRT caption guide](SUBTITLES.srt). The SRT is a sidecar guide for the proposed narration, not burned into the picture; retime it after recording.

## Install and preview

Use Node.js 24+, npm, FFmpeg and FFprobe on `PATH`, and an installed Chrome/Chromium executable. The lockfile pins matching Remotion 4.0.538 packages. From the repository root:

```powershell
cd promo-video
npm ci
npm run studio
```

Studio opens at `http://localhost:3007`; choose `FitZoneHero` or `FitZoneVertical`. Captured UI and original WAV stems are committed under `assets/`, so previewing and rendering need no backend, environment file, or root application install.

Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe`. When installed elsewhere, set the executable before starting Studio or scripts:

```powershell
$env:CHROME_PATH = "C:/path/to/chrome.exe"
```

Use the equivalent environment-variable syntax on other shells. Rendering was verified on Windows with installed Bahnschrift and Segoe UI. No proprietary font files are redistributed; other systems may use the declared fallbacks and produce different typography. Use suitably licensed installed fonts to match the supplied exports.

## Render and verify

Run these commands from `promo-video/`:

```powershell
npm run typecheck
npm test                       # focused reliability regressions; root npm ci also required
npm run check:compositions      # layout checks, stills and two 1s sample encodes
npm run preview                # representative full-resolution stills
node scripts/render.mjs draft  # silent 540p motion-review draft
npm run render                 # refined hero, clean and silent; retains picture master
npm run render:vertical        # independent portrait export and picture master
npm run verify                 # both films: metadata, full decode, audio, storyboard
```

`npm run render:all` renders both compositions. Rendering uses up to three Chromium tabs and software H.264; FFmpeg mixes separate stems while copying the encoded picture. Outputs are written under `output/`; rendering overwrites those generated filenames. Keep a separate copy before experimenting with a published version.

The supported render, mix, audio-generation, verification and composition-check commands share an exclusive `.pipeline-lock/`. An overlapping command exits with `PIPELINE_BUSY`; rerun it after the active job finishes. Each command writes to a unique ignored `.pipeline-work-*/` directory, prepares the complete output set, and only then replaces destination files. Failed generation or encoding leaves previous exports intact; a replacement failure attempts rollback. This is a recoverable multi-file transaction, not a crash-atomic filesystem snapshot. If rollback cannot complete, its recovery directory and lock are retained and reported. After a process crash, confirm no pipeline process remains and inspect the owner/recovery manifest before manually removing its stale lock; preserve any reported recovery files.

Composition dimensions choose the layout and stems. A legacy `vertical` JSON prop cannot switch the registered landscape or portrait format. Studio and FFmpeg read the same pre-mastering gains from `audio-config.json`; final exports additionally receive FFmpeg loudness mastering.

After a fresh clone, run `npm run verify -- --published-only` to check the three shipped MP4s without rerendering. Default `npm run verify` expects all four final outputs, including the uncommitted silent hero created by `npm run render:all`. To check only freshly rendered hero versions, run `node scripts/verify.mjs --hero-only`. Existing published reports describe the supplied films, not future edits.

Optional capture regeneration and browser playback testing use the root application's Vite/React plugin/Playwright dependencies. Install them once from the repository root, then return to the video project:

```powershell
cd ..
npm ci
cd promo-video
node scripts/playback-test.mjs
```

The playback check loads the local hero and vertical files, verifies decoded playback, and seeks near each ending. `npm run review` extracts chronological two-fps sheets from the encoded hero into ignored `output/review-v2/`; it does not rerender the film. The full local review archives and QA frames are intentionally not published.

## Record a voiceover and mix

1. Follow [VOICEOVER_SCRIPT.md](VOICEOVER_SCRIPT.md). Record a 60-second, mono or stereo 48 kHz WAV with its first sample aligned to film time 00:00, retaining silence between cues.
2. Save it as `assets/audio/voiceover.wav`. Personal recordings are ignored by Git.
3. Run `npm run render` to create the picture master and all hero variants. If the matching local `output/hero-picture-master.mp4` already exists, run `npm run mix` to update audio without rerendering picture.
4. Run verification again and adjust the SRT to the performance.

`audio-config.json` controls music, effects and voice gains, a -17 LUFS target, and -1.5 dBTP mastering target. With voiceover present, the music gain becomes 0.42 before mastering. The primary hero includes the WAV; clean and silent exports retain their respective behavior. Studio exposes independent `music`, `sfx`, and `voiceover` props; use `audio/voiceover.wav` as the voiceover prop and restart Studio after adding the asset.

The portrait film has separate music/effect stems. `node scripts/mix.mjs --vertical` remixes them against its local picture master; automatic portrait narration mixing is not implemented. Its optional recording script requires its own timed track and audio-editing integration. To return the hero to narration-free delivery, remove the WAV from the expected input location and rerun `npm run mix` with the retained master.

## Editable source and asset provenance

- `src/Root.tsx` and `src/Film.tsx`: registered compositions and independent audio layers.
- `src/Premium.tsx`: revised hero scenes and product camera choreography.
- `src/Vertical.tsx`: independent portrait scene layout.
- `src/Motion.tsx` and `src/style.css`: shared animation, emblem, device framing, typography and palette.
- `scripts/render.mjs`, `scripts/mix.mjs`, `scripts/verify.mjs`: picture rendering, audio assembly and validation.
- `scripts/audio.mjs`: original deterministic synthesis; `npm run audio` regenerates the four WAV stems.
- `scripts/capture.mjs`: `npm run capture` regenerates synthetic native-UI regions after root dependency installation. It uses isolated Vite configuration, reads no environment file, intercepts fixture API responses, and blocks external browser requests. All names, IDs and dates are fictional; contacts are blank or hidden. The illustrative clock is 24 October 2026. No production account is accessed.

The committed captures and WAVs are sufficient to render from a fresh clone. Keep the committed WAVs to reproduce the approved films: the current synthesis reproduces the refined hero stems, while the preserved earlier portrait stems have historical noise/choreography differences. Running `npm run audio` intentionally prepares a new stem set; review it before re-exporting the portrait film. Audio synthesis is optional for rendering and is not a prerequisite for a fresh clone.

See [asset provenance](assets/ASSET_PROVENANCE.md), [Lucide ISC/MIT attribution](assets/LICENSE-lucide.txt), and the [capture audit](assets/captures/capture-audit.json). No external stock footage, photographic asset, sampled music or redistributed system font is required. The unused full-page mobile capture, which includes unrelated gym photographs, remains excluded locally.

See [Remotion license obligations](LICENSE_OBLIGATIONS.md) for the eight custom-license dependencies and applicable free/Company License conditions. No dependency license classification or lockfile has been changed. The [schema review](SCHEMA_REVIEW.md) explains the approved spreadsheet illustration's installation-guide labels and the staging fixture's equivalent positional contract.

[CREATIVE_DIRECTION.md](CREATIVE_DIRECTION.md) records the brand and product-truth constraints. [CREATIVE_REVIEW.md](CREATIVE_REVIEW.md) identifies the five weakest moments in the original encoded film and the replacement choreography. Historical `output/review-v1/` and current detailed `output/review-v2/` evidence mentioned there are local-only archives; the refined hero, storyboard and compact reports above are the published deliverables.
