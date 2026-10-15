# Remaining real Google server-session verification

Authentication and membership work is integrated into main. Auth.gs and Bcrypt.gs remain unchanged by the completion pass; frontend sessions now live only in page memory. Mocked authentication tests remain required, and passing them does not verify Google runtime behavior.

Use only a disposable Sheet/project and temporary credentials, following
[AUTH_STAGING_VALIDATION.md](AUTH_STAGING_VALIDATION.md). Real Google acceptance
for all items below remains **NOT RUN**:

1. Load exactly Code.gs, Auth.gs and Bcrypt.gs from main; verify V8,
   Asia/Kolkata, required Script Properties, execution identity and Sheets OAuth.
2. Correct/wrong/null credentials and absent verifier fail/succeed as specified;
   login returns only the short-lived session credential and expiry, never members.
3. Every listing/mutation rejects missing, fake and expired session credentials.
   Verify this again for the new locked membership functions; no rows may change.
4. Logout revokes the captured server session. Replaying it must fail even if browser
   state is reconstructed. Wait past the actual 30-minute lifetime and check expiry
   with a direct protected POST; browser timers alone are insufficient evidence.
5. Rotating the test ID/verifier invalidates old sessions. Missing configuration
   fails closed. Test the installation-wide five-failure throttle last.
6. Benchmark actual bcrypt login and simultaneous login/member writes. Both use
   ScriptLock, so record bounded AUTH_BUSY/MEMBER_BUSY responses and actual latency.
   Mock timing and interleaving simulations are not performance measurements.
7. From phone/laptop browser viewports verify ContentService redirects, readable
   cross-origin JSON, network/timeout handling and endpoint-change invalidation.
   Never use no-cors, GET credentials, authentication bypasses or production probes.
8. Inspect URLs locally: no permanent password or sessionToken. Do not publish HARs,
   private endpoints, credentials, tokens, member rows or Script Property dumps.

No production deployment, real email, or merge is authorized by this checklist.
Record sanitized results with the exact commit and test deployment version before
describing either authentication or membership as production-verified.
