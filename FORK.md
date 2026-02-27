# Fork Customizations

This is a fork of [microsoft/vscode](https://github.com/microsoft/vscode) maintained by Twenty Ideas for use in DevSwarm. This document lists every intentional divergence from upstream so that changes can be re-applied after merging from upstream.

When merging from `microsoft/vscode`, resolve conflicts by re-applying the changes described below. Each entry includes enough detail for a human or AI agent to mechanically reproduce it.

---

## New Files (fork-only, no upstream conflict)

### `.github/workflows/build-vscode-server.yml`

**Purpose:** CI workflow that builds the VS Code REH Web server for DevSwarm.

**Details:** This file does not exist upstream, so it will never conflict on merge. It builds `vscode-reh-web` tarballs for darwin-arm64, win32-x64, and linux-x64, patches `product.json` to use the Open VSX marketplace, and creates a GitHub Release.

**PR build trigger:** Adding the `build-bundle` label to a PR triggers a darwin-arm64-only build. The artifact is available on the workflow run for download via `DEVSWARM_VSCODE_SERVER_VERSION=pr-{N} pnpm install` in the main repo. The release job is skipped for PR builds.

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

### `src/vs/platform/actions/common/actions.ts`

**Change: Add TitleBarNavigation and TitleBarActions MenuId constants**

**Purpose:** Allow extensions to contribute action buttons to the VS Code title bar via standard menu contribution points. DevSwarm uses this to place mode toggles, agent spawning, and merge controls in the title bar.

**Details:** Adds two new `MenuId` static properties: `TitleBarNavigation` (left side of title bar, after menu bar) and `TitleBarActions` (right side of title bar, before layout controls). These are additive — no existing code is modified.

**Action on merge:** Re-add the two static properties if the `MenuId` class definition changes.

### `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`

**Change: Render contributed actions from TitleBarNavigation and TitleBarActions menus**

**Purpose:** Render extension-contributed toolbar items in the title bar alongside existing elements.

**Details:** Adds two new `WorkbenchToolBar` instances in the title bar layout — one in `leftContent` (navigation) and one in `rightContent` (actions). Uses the standard `MenuWorkbenchToolBar` pattern already used for `MenuId.TitleBar`.

**Action on merge:** If upstream restructures the title bar layout, re-add the toolbar containers and menu listeners in the appropriate locations.

### `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css`

**Change: Add styles for TitleBarNavigation and TitleBarActions containers**

**Purpose:** Style the new toolbar containers in the title bar.

**Details:** Adds CSS for `.titlebar-navigation` and `.titlebar-actions` classes — flex containers with center alignment, appropriate margins, non-draggable app regions, and `has-no-actions` visibility toggle. These are new rules appended to the file — no existing styles modified.

**Action on merge:** Re-add the CSS rules if the file is restructured.
