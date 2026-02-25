# Audit: DevSwarm VS Code Customizations — Fork vs. Runtime

> **Date:** 2026-02-24
> **Scope:** Inventory of all VS Code customizations across the `twentyideas/code-oss` fork and the DevSwarm repository, with recommendations for where each should live.

---

## Summary

The DevSwarm customization approach is well-architected. Almost everything uses standard VS Code extension APIs and runtime configuration rather than patching VS Code internals. Only changes to files that ship *inside* the bundle and can't be overridden from outside belong in the fork (`product.json` marketplace configuration, hiding the Copilot chat panel via server-side configuration defaults). Everything else correctly stays in DevSwarm.

**One cleanup item:** The duplicate Open VSX patch in DevSwarm's `scripts/compile-vscode.sh` is redundant now that the fork CI handles it.

---

## Complete Inventory

### A. In the Fork (`twentyideas/code-oss`)

| # | Customization | Files | Status |
|---|---------------|-------|--------|
| 1 | **Open VSX marketplace** — patched into `product.json` during CI | `.github/workflows/build-vscode-server.yml` (lines 83-106) | Merged on `main` |
| 2 | **Hide chat panel on first start** — hides secondary sidebar (Copilot chat) by default via `configurationDefaults` instead of removing `defaultChatAgent` (which broke 34+ consumers) | `src/vs/server/node/webClientServer.ts` | [PR #7](https://github.com/twentyideas/code-oss/pull/7) (open, mergeable) |

**Supporting documentation:**
- Branch `add-fork-documentation` has a `FORK.md` with merge-conflict resolution instructions for each divergence. Should be merged alongside or after PR #7.

### B. In DevSwarm (Runtime / Build-time)

| # | Customization | Where in DevSwarm | How It Works |
|---|---------------|-------------------|--------------|
| 3 | **Custom DevSwarm theme** | `apps/ide/extensions/devswarm-theme/` | Standard VS Code theme extension, copied into bundle's `extensions/` dir at build time |
| 4 | **DevSwarm extension** (welcome panel, terminals, agents, commands, keybindings) | `apps/ide/extensions/devswarm/` | Full VS Code extension using standard APIs, copied into bundle at build time |
| 5 | **Extension bundling pipeline** | `scripts/ide/bundle-ide-extensions.ts` | Copies built extensions from `dist/` into extracted bundle |
| 6 | **Default settings injection** | `apps/desktop/electron/src/app/services/ide/ide.service.ts` (lines ~1123-1170) | Writes `Machine/settings.json` at server launch with defaults (theme, telemetry off, minimap off, etc.) |
| 7 | **Open VSX marketplace patch** (local compile script) | `scripts/compile-vscode.sh` (lines ~262-283) | Patches `product.json` post-build — **duplicate of fork CI** |
| 8 | **Theme sync with Electron** | `apps/desktop/electron/src/app/services/theme/theme.service.ts` | Reads VS Code settings to sync theme colors to the Electron shell |
| 9 | **Server process management** | `apps/desktop/electron/src/app/services/ide/ide.service.ts` | Launches `code-server-oss` per workspace with dynamic ports |

---

## Recommendations

### Keep in DevSwarm (no change needed)

| # | Customization | Rationale |
|---|---------------|-----------|
| 3 | DevSwarm theme extension | DevSwarm-specific extension that evolves independently. Standard extension API is the right mechanism. |
| 4 | DevSwarm extension | Large, actively developed extension with 20+ commands. Uses standard APIs, doesn't patch internals. Moving it into the fork would couple its release cycle to upstream merges. |
| 5 | Extension bundling pipeline | DevSwarm build infrastructure. Orchestrates extension deployment. |
| 6 | Default settings injection | DevSwarm-specific UX preferences applied via `Machine/settings.json`. Respects user overrides without forking VS Code's settings system. |
| 8 | Theme sync with Electron | Electron desktop app logic, not a VS Code customization. |
| 9 | Server process management | DevSwarm's orchestration layer. |

### Remove from DevSwarm (redundant)

| # | Customization | Action |
|---|---------------|--------|
| 7 | Open VSX patch in `compile-vscode.sh` | **Redundant.** The fork's CI workflow already patches `product.json` with Open VSX config. If `compile-vscode.sh` is still used for local dev builds, keep the patch as a safety net. If only used for CI, remove it. |

### Already in Fork (pending merge)

| # | Customization | Status | Next Step |
|---|---------------|--------|-----------|
| 1 | Open VSX marketplace (CI) | Merged on `main` | Done |
| 2 | Hide chat panel by default | PR #7 open | Merge PR #7, then merge `add-fork-documentation` branch for `FORK.md` |

---

## Architecture Principle

**Fork only what can't be overridden from outside the bundle.** Specifically:

- **Fork:** `product.json` fields (marketplace config) and server-side configuration defaults (hiding Copilot chat panel)
- **Runtime:** Extensions (via `extensions/` dir), settings (via `Machine/settings.json`), Electron shell behavior

This keeps the fork minimal, reduces merge conflicts with upstream `microsoft/vscode`, and lets DevSwarm-specific features evolve on their own release cadence.
