# AimRoutine Tracker — public project website

[Open the site](https://aimroutine-tracker.github.io/) · [Try the routine demo](https://aimroutine-tracker.github.io/#routine) · [Training Insights](https://aimroutine-tracker.github.io/#insights)

Public FR/EN landing site for **AimRoutine Tracker V2**, an independent Windows VALORANT aim-training and coaching project.

## What this website does

- Explains the intended user journey: select rank, focus, available tools and session duration; train; understand progress.
- Recreates the desktop application's V2 visual identity in a **static hero miniature** (not an actual running desktop-app screenshot).
- Offers a **fully client-side educational routine demo** that changes exercise categories and time allocations based on selected rank, training goal, available software and time.
- Offers a **three-card illustrated choice of AIM focus** (first shot, tracking or switching), which directly preconfigures the routine demo; on narrow phones it becomes a native horizontal swipe gallery.
- Offers **Training Insights**, an interactive *fictional* dashboard featuring three tabs, chart-point explanations, skill breakdowns, a training calendar, sample profiles and a guided tour.
- Provides a detailed product presentation, privacy policy, terms and a conceptual Riot Sign On journey.

**Do not mistake website demos for working Windows software functionality, verified training recommendations, real Riot player data, or a public installer.** All demo numbers are fictional. The web page does not log training sessions. No real Riot connection is provided.

## Current status

| Component | Status |
| --- | --- |
| Public GitHub Pages site | Published from `main` root |
| Windows V2 interface | Shown in a creator-provided screenshot; reproduced as a static website preview |
| Public interactive demonstration | Available without login; examples only |
| Riot URL-ownership verification | Verified by Riot |
| Production API / Riot Sign On | Application pending review; not enabled |
| Public Windows download | Not offered by this website |

Do not claim functionality is released unless separately verified. Do not create a fake download button, beta list, review, rating, or player performance guarantee.

## Deployment

GitHub Pages is configured to publish `main` at `/(root)`. After editing, check **Actions → pages build and deployment**, then open the public site with a fresh cache-busting query such as `?v=11`. A successful commit does not by itself guarantee the public site has already deployed.

The Riot URL verification file is `/riot.txt`. Preserve it unless the project owner intentionally decides otherwise.

Never commit API keys, Riot Sign On secrets, tokens, account credentials, user match histories, or `.env` files.

## Main website files

- `index.html`: landing narrative, demo sections and calls to action.
- `product.html`: detailed product explanation and planned features.
- `riot-integration.html`: conceptual opt-in flow only.
- `privacy.html`, `terms.html`: public policy documents; review them before launch and provide a real public support contact.
- `site.js`: language preference, existing rank demo and Insights tab behavior.
- `experience-v11.js`: bilingual illustrative training plan builder.
- `aimroutine-visual-v14.js`, `aimroutine-visual-v15.js`: chapter navigation, training-time split, and focus-to-routine controls.
- `insights-guide.js`, `insights-v2.js`: interactive teaching layer and desktop-style mockup behavior.
- `hero-v2-static.css`: noninteractive miniature of the Windows V2 interface.
- `experience-v11.css`: value proposition, three-step narrative, status cards, routine settings, FAQ and responsive styles.
- `aimroutine-visual-v15.css`: original skill-card vector artwork styling and mobile snap-scroll gallery.
- `v5.css`, `design.css`, `styles.css`, `insights*.css`: older base and analytics CSS layers. Changes to CSS order require checking regressions.
- `aimroutine-arena.svg`: original SVG used in the static miniatures; not an official Riot character image.
- `favicon.svg`: site icon.

## Development checklist

1. Test `index.html` on 320, 375, 390, 430, 768, 1024 and 1440 px widths in real browsers.
2. Switch FR/EN and test every training selector, tab, chart point, FAQ item and guided tour.
3. Check that static miniatures contain **no clickable controls**.
4. Verify every link, especially `#routine`, `#insights`, `#availability` and links into `product.html`.
5. Verify website descriptions clearly label mockups, planned functionality and pending Riot approval.
6. Replace provisional legal contact language with a real public support channel before wider distribution.
7. When a Windows installer becomes available, validate its distribution and signature before adding a real download call to action.
8. Consider adding a **real licensed screenshot or product walkthrough video** to increase trust; the current miniature is a reconstruction.

## Trademarks

AimRoutine Tracker is not endorsed, certified or sponsored by Riot Games. VALORANT and the names of optional aim-training products remain the properties of their respective owners.
