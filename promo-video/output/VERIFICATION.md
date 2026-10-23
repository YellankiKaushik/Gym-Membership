# FitZone exported-file verification

Generated: 2026-10-23T20:31:43.797Z

| File | Dimensions | Duration | FPS | Decode | Audio |
| --- | --- | --- | --- | --- | --- |
| fitzone-hero-1080p.mp4 | 1920×1080 | 60s | 30 | Passed | -16.70 LUFS / -1.47 dBTP |
| fitzone-clean-no-voiceover.mp4 | 1920×1080 | 60s | 30 | Passed | -16.70 LUFS / -1.47 dBTP |
| fitzone-vertical-1080x1920.mp4 | 1080×1920 | 30s | 30 | Passed | -16.67 LUFS / -1.50 dBTP |

Every MP4 was fully decoded by FFmpeg. Stream metadata is validated, including H.264, yuv420p and constant 30 fps. Black detection uses a conservative 1.5% pixel threshold for the deliberately dark forest palette; detected segments are recorded in verification.json. Capture audit has 0 browser errors and 0 external requests.

The storyboard and boundary sheet were extracted from the encoded primary MP4. Representative stills and before/after-cut PNGs are in output/qa. Visual and editorial observations are recorded in ../CREATIVE_REVIEW.md. No optional voiceover source is present; the standard render workflow uses original music and effects only.
