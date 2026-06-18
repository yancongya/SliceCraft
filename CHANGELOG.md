# Changelog

## Unreleased

- Refactored the frontend element workflow to use a single canonical element source from the split panel.
- Removed manual cross-panel send/get/sync actions; remove, upscale, and recognize panels now render split elements automatically.
- Added per-panel selection state so each tab can select independently while editing the same element objects.
- Added source selectors for remove, upscale, recognize, and export flows.
- Made recognition names update the global element name used by all panels and exported files.
- Fixed the recognize tab card grid so recognized elements render in a multi-column layout.
