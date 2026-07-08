# Changelog

All notable changes to this project are documented in this file.

## v1.0.0 - 2026-07-08
- Rebuilt movie search to use dynamic OMDb API data instead of hardcoded results.
- Added debounced search, explicit submit search, clear/reset flow, and result status messaging.
- Added sorting for title and year, with robust year parsing for ranges.
- Added favorites with local storage persistence and a dedicated favorites panel.
- Added movie details modal with plot, genre, runtime, and IMDb rating.
- Added load-more pagination and total-result tracking.
- Added resilient poster fallback handling and improved empty/error/loading states.
- Improved accessibility: better labels, live regions, focus styles, and keyboard-friendly interactions.
- Added local backend proxy to protect API key usage from direct browser exposure.
- Hardened proxy with input validation, security headers, and gentle per-IP rate limiting.
- Added unit tests for movie utility logic and integration tests for proxy behavior.
- Added Playwright end-to-end smoke tests for modal and pagination flows.
- Added CI workflow for unit + e2e tests and artifact upload on failures.
- Added release automation workflow with version bumping and changelog updates.
- Added pre-release one-command verification pipeline with health checks.
- Expanded README with quick start, architecture diagram, deployment guidance, and release process docs.

