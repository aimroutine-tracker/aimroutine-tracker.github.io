# V21 — visual validation gate (DRAFT)
Master references: four 1672×941 user-supplied images (8 November 2026), in order Home, Routines, Cloud, Progress.
This PR must NOT be merged or deployed until:
- [ ] Four new screenshots of the actual pages have been reviewed against the original user-supplied mockups, at exactly 1672×941, and differences corrected.
- [ ] The four BEFORE / AFTER comparisons and corresponding source-vs-candidate comparisons are stored in a reviewable artifact.
- [ ] The original screenshots are loaded into the automated reference comparison pipeline; current capture workflow only produces baseline-vs-V21 and does not assert pixel identity.
- [ ] All cross-browser functional tests and Auth tests pass.
- [ ] All stats come from real recordings; anonymous visitors must not persist data.
- [ ] Cloud sync is automatic for signed-in users; no manual sync action is required.
- [ ] User approves actual screenshot fidelity prior to merging.
This draft retains the GitHub, Supabase Auth, RLS and Riot API implementations unchanged.
