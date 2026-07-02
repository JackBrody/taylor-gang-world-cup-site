# Taylor Gang World Cup 2026 Site

Static public site for the Taylor Gang Sports Hub World Cup 2026 pool.

## Vercel settings

- Framework preset: Other
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Root directory: `outputs/taylor-gang-world-cup-site`

## Build behavior

The build validates required files, checks the public JSON, scans deployable text files for local machine paths or obvious secret patterns, and writes the public site to `dist/`.

## Updating results

Run `npm run update-results` before deployment when you want to refresh `data/results.json`. The public site itself does not require API keys.

## GitHub upload

Recommended repository name: `taylor-gang-world-cup-site`.

This folder is the repository root. Push the full folder to GitHub, then import it in Vercel with the settings above.
