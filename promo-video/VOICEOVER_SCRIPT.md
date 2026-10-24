# FitZone — 60-second recording script

The supplied hero and clean exports contain original instrumental music and effects, with no narrator. Record the following at a warm, confident pace, approximately 140 words per minute. Leave the opening beat and marked pauses clear. Record a 60-second, 48 kHz WAV with silence retained between cues. Do not shorten the timeline by removing pauses.

| Time | Picture | Voiceover |
| --- | --- | --- |
| 00:00–00:05 | Dumbbell emblem and FitZone wordmark | **[Beat. Start at 00:01.]** “FitZone. Smarter gym membership management.” **[Pause.]** |
| 00:05–00:13 | Numeric ID entry, membership result, days remaining | “One member ID. Your plan, your status, and the days ahead. Check your membership, then get back to training.” **[Pause.]** |
| 00:13–00:23 | Owner dashboard; four summary categories | “For the person running the gym, a clearer view of the day. Total members. Active memberships. Expiring soon. And those ready for a fresh start.” **[Pause.]** |
| 00:23–00:33 | Add, edit, renewal, search | “Welcome new members. Keep their details current. Renew the next term. And find the right membership with search and filters.” **[Pause.]** |
| 00:33–00:41 | Upcoming expiries in the attention view | “See memberships expiring today or in the next seven days. Know who needs attention, and start the next conversation.” **[Pause.]** |
| 00:41–00:48 | Interface → Apps Script → Sheets | “A straightforward workflow, built around Google Sheets. Load, manage, and refresh.” **[Pause.]** |
| 00:48–00:54 | Desktop and mobile composition | “On desktop or mobile. Built for the people who run the gym.” **[Pause.]** |
| 00:54–01:00 | Logo and URL | **[Start at 00:55.]** “FitZone. Less admin. More momentum.” **[Let the final music resolve.]** |

## Recording and replacement

1. Export your performance as `assets/audio/voiceover.wav`, with the first sample aligned to 00:00 of the film.
2. Run `npm run render`. The primary hero includes your voice and a quieter music bed. The clean export always excludes voiceover.
3. Studio has independently adjustable `music`, `sfx`, and `voiceover` props. Restart Studio after adding a new asset. The render script detects the WAV automatically.
4. The SRT is a guide matching the intended recording. Adjust individual cue times to your final performance. Captions are a sidecar, not burned into the video.

No optional email or WhatsApp functionality is claimed in this edit. The score has space for narration, but no final human recording has been supplied yet.

## Optional 30-second vertical recording

| Time | Voiceover |
| --- | --- |
| 00:00–00:04 | “FitZone. Smarter gym membership management.” |
| 00:04–00:12 | “One ID. Your plan, your status, and your days remaining. Check, train, repeat.” |
| 00:12–00:20 | “For the gym owner, every membership in one clear view. Manage the details and plan the next renewal.” |
| 00:20–00:25 | “See who’s expiring soon. Know who needs attention.” |
| 00:25–00:30 | “FitZone. Less admin. More momentum.” |

The vertical export currently has music and effects only; its recording requires a separately timed track.
