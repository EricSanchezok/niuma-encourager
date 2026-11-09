# Repository guidance

This is a local-first Tauri 2 + React desktop application. Keep financial calculations deterministic and independent of the UI. Use the system local time zone and recompute from the clock instead of accumulating timer ticks.

Run `pnpm lint`, `pnpm test`, `pnpm build`, and `cargo check --manifest-path src-tauri/Cargo.toml --locked` before committing. Run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` for Rust changes. Test changes to work calendars against the documented official holiday sources.

Keep UI text concise and maintain the vocabulary in `src/i18n.ts`. Salary and calendar data stay on the user's device. Keep version values in package.json, Cargo.toml and tauri.conf.json aligned for releases.
