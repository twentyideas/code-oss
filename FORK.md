# Fork Customizations

This is a fork of [microsoft/vscode](https://github.com/microsoft/vscode) maintained by Twenty Ideas for use in DevSwarm. This document lists every intentional divergence from upstream so that changes can be re-applied after merging from upstream.

When merging from `microsoft/vscode`, resolve conflicts by re-applying the changes described below. Each entry includes enough detail for a human or AI agent to mechanically reproduce it.

---

## New Files (fork-only, no upstream conflict)

### `.github/workflows/build-vscode-server.yml`

**Purpose:** CI workflow that builds the VS Code REH Web server for DevSwarm.

**Details:** This file does not exist upstream, so it will never conflict on merge. It builds `vscode-reh-web` tarballs for darwin-arm64, win32-x64, and linux-x64, patches `product.json` to use the Open VSX marketplace, and creates a GitHub Release.

**Action on merge:** None required — no conflict possible.

---

## Modified Upstream Files

### `src/vs/server/node/webClientServer.ts`

**Change: Hide chat panel on first start via `configurationDefaults`**

**Purpose:** Prevent the GitHub Copilot chat panel (secondary sidebar) from appearing on first launch. DevSwarm has its own onboarding experience. Rather than removing `defaultChatAgent` from `product.json` and `product.ts` (which broke `DefaultAccountService` and 34+ other consumers at startup), this takes a configuration-over-code approach that minimizes upstream merge conflicts.

**Details:** Adds a `configurationDefaults` property to the web client server options object that sets `workbench.secondarySideBar.defaultVisibility` to `'hidden'`. This is a single property addition to an existing config object — no upstream code is removed.

**Action on merge:** If upstream modifies the options object in the `WebClientServer` class's method that constructs the client data (around the `callbackRoute` property), ensure the `configurationDefaults` block is preserved:
```typescript
configurationDefaults: {
	'workbench.secondarySideBar.defaultVisibility': 'hidden'
}
```
This is additive, so conflicts are unlikely unless upstream restructures the options object entirely.
