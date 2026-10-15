# bcryptjs provenance

- Package: `bcryptjs`, version **3.0.3**, BSD-3-Clause.
- Upstream: https://github.com/dcodeIO/bcrypt.js
- Registry tarball: https://registry.npmjs.org/bcryptjs/-/bcryptjs-3.0.3.tgz
- Registry SHA-512 integrity (verified before extraction):
  `sha512-GlF5wPWnSa/X5LKM1o0wz0suXIINz1iHRLvTS+sLyi7XPbe5ycmYI3DlZqVGZZtDgl4DmasFg7gOB3JYbphV5g==`
- Original `package/umd/index.js` SHA-256:
  `ed01b52b436504d8bb7086d93fee4bd8edbb22d8ed88e1b456e0c604f30e79c4`
- License: `bcryptjs-LICENSE` in this directory, also retained in the source payload.

`../Bcrypt.gs` contains that unchanged UMD payload inside a two-line opening adapter
and a closing function call. The adapter provides a local timer placeholder that
throws if asynchronous bcrypt APIs are used. Apps Script has no `setTimeout`, and
the original UMD initializer references it even when only `compareSync` is wanted.
Password verification uses `compareSync` only; the local setup tool uses `hashSync`
with Node Web Crypto. No fallback based on Math.random has been added.

Do not include Bcrypt.gs in the React frontend. No runtime CDN fetch, dynamic eval,
third-party authentication service, or new application npm dependency is required.
