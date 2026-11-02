# Remotion dependency license obligations

Reviewed on 2 November 2026 for the exact **4.0.538** dependency graph in `package-lock.json`. This document records the eight custom-license findings; it does not grant a license, establish the owner's eligibility, or replace upstream terms.

## Exact packages and evidence

The six `SEE LICENSE IN LICENSE.md` entries below ship identical Remotion license text. Their installed `LICENSE.md` files have SHA-256 `bd65083b940f61904f6ef298aade918a7cad72a3e35bc406e36fab365844b673`. The two packages labelled `Remotion License` do not ship a `LICENSE.md` in their installed 4.0.538 distributions; their manifest declarations and the [official version-tagged upstream license](https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md) are the evidence for their classification. Absence of a packaged file is not a permissive-license exception.

| Package, all at 4.0.538 | Relationship and use | Lockfile license value | Package evidence |
| --- | --- | --- | --- |
| `@remotion/bundler` | Direct; bundles the compositions for rendering | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |
| `@remotion/cli` | Direct; provides Remotion Studio and CLI | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |
| `@remotion/player` | Transitive via CLI/Studio/SDK; player infrastructure | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |
| `@remotion/renderer` | Direct; browser rendering, stills and video encoding | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |
| `@remotion/sdk` | Transitive via Studio; authoring infrastructure | `Remotion License` | Installed `package.json` declares it; packaged license file absent |
| `@remotion/studio-protocol` | Transitive via Studio/server/codemods; Studio communication | `Remotion License` | Installed `package.json` declares it; packaged license file absent |
| `@remotion/web-renderer` | Transitive via Studio; browser rendering infrastructure | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |
| `remotion` | Direct; compositions, timing, images and audio | `SEE LICENSE IN LICENSE.md` | Installed `LICENSE.md`; custom Remotion terms |

All eight findings are retained as custom-license obligations. Their lockfile values, versions and integrity records are unchanged. They must not be relabelled MIT, ignored merely because they are transitive, or described as ordinary permissive dependencies. Remotion describes its software as source-available, outside the OSI open-source definition. See its [official license FAQ](https://www.remotion.dev/docs/license/faq#is-remotion-open-source).

## Eligibility under the pinned version

The [4.0.538 license](https://github.com/remotion-dev/remotion/blob/v4.0.538/LICENSE.md#eligibility) provides free eligibility for an individual person, a business employing no more than three people, a nonprofit entity, or a party evaluating the tool before commercial use. Eligible users may create commercial or noncommercial videos/images and adapt the software for their needs. Parties outside those categories must obtain a Company License. It also restricts repackaging Remotion code into a derivative sold, rented or sublicensed as Remotion itself. Consult the full versioned terms for the precise scope.

A commercial gym advertisement cannot establish eligibility through the evaluation category. Other free categories may apply, but this repository supplies no verified legal-entity classification, total employee count, or Company License entitlement. The owner must confirm the applicable category or obtain the required entitlement before further use. No purchase, eligibility determination, or legal approval is claimed here.

## Current guidance and future use

The [current official Terms (v5.0)](https://www.remotion.dev/docs/terms), checked 2 November 2026, allow free use by an individual or an organization/team of up to three people, and state that eligible users may make commercial media. They describe a Company License requirement for users outside Free License eligibility, with involved-party headcount and ownership/control/use of the same project considered. A client receiving only a finished MP4 is not thereby a Remotion user; a client that owns, controls, or operates the editable project is treated differently. These current terms are guidance for current use and do not replace the exact 4.0.538 license shipped by this lockfile.

Current [Company License pricing](https://www.remotion.dev/docs/license/pricing) and [FAQ](https://www.remotion.dev/docs/license/faq) distinguish low-volume creation from automation. The FAQ explicitly lists `renderMedia()` and `renderStill()` as automation APIs and says eligible Free License users may also automate without paying per render. If the project owner is a Company License User, this project's scripted calls to those APIs fit Remotion's Automators definition; the owner must confirm the correct option and accurately report usage. No headcount, user classification, entitlement, or license purchase was verified here. Installing packages or publishing the editable project does not establish entitlement. Preserve upstream notices and recheck terms when upgrading dependencies.

This assessment concerns Remotion usage. Original compositions, synthetic captures, generated score and Lucide attribution have separate provenance in [assets/ASSET_PROVENANCE.md](assets/ASSET_PROVENANCE.md); that document does not relicense Remotion's dependencies.
