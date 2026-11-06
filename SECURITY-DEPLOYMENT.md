# Static deployment security

The deployment source stays public at `aimroutine-tracker.github.io`, but
**the deployed Pages artifact is intentionally smaller than the source repo**.

- `scripts/public-assets.txt` is a manually reviewed allowlist of the 84
  static files currently needed by the website. New assets must be added
  deliberately after review.
- `scripts/build_public.py` refuses unlisted browser-looking root files,
  symlinks, traversal paths, and unexpected file types.
- `tests/check_public_artifact.py` checks the exact artifact and ensures
  the Riot verification file remains unchanged.
- `tests/check_secrets.py` searches tracked text for common credential
  formats and rejects sensitive key files.
- These checks run in GitHub Actions. None prevents browsing the original
  source of a **public GitHub repository**. Move development sources to a
  private repository in a separate migration once Pages is correctly set
  to **GitHub Actions** under Settings > Pages.
- A scanner cannot retract a previously exposed credential. Rotate
  exposed secrets in the provider dashboards and revoke the old values.
- Keep `riot.txt`, `privacy.html`, `terms.html`, and the public product
  pages available for Riot's application verification.

**Important:** GitHub Pages must use Actions as its publishing source;
branch-based deployment can still publish the complete repository.
Deployment failures caused by a stale Pages deployment cannot be repaired
by modifying the build allowlist; resolve the stale job with GitHub.
