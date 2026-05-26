# Fork Customizations

This is a fork of [microsoft/vscode](https://github.com/microsoft/vscode) maintained by Twenty Ideas for use in DevSwarm. This document lists every intentional divergence from upstream so that changes can be re-applied after merging from upstream.

When merging from `microsoft/vscode`, resolve conflicts by re-applying the changes described below. Each entry includes enough detail for a human or AI agent to mechanically reproduce it.

---

## New Files (fork-only, no upstream conflict)

### `.github/workflows/build-vscode-server.yml`

**Purpose:** CI workflow that builds the VS Code REH Web server for DevSwarm.

**Details:** This file does not exist upstream, so it will never conflict on merge. It builds `vscode-reh-web` tarballs for darwin-arm64, win32-x64, and linux-x64, patches `product.json` to use the Open VSX marketplace, and creates a GitHub Release.

**Building from upstream release tags:** When `vscode_ref` is set to an upstream tag (e.g. `1.112.0`), the workflow automatically applies fork patches on top of the clean upstream code. It diffs the upstream merge base on `main` against `main` itself to compute the full fork delta, then applies it with `--3way`. No manual maintenance is needed — any change on `main` is automatically included. If a patch fails to apply cleanly against a given tag, the build will fail with a clear `git apply` error.

**PR build trigger:** Adding a `build-bundle` label to a PR triggers builds. Label options:
- `build-bundle` — all platforms (darwin-arm64, win32-x64, linux-x64)
- `build-bundle-darwin` — darwin-arm64 only
- `build-bundle-win32` — win32-x64 only
- `build-bundle-linux` — linux-x64 only

Multiple platform labels can be combined. The artifact is available on the workflow run for download via `DEVSWARM_VSCODE_SERVER_VERSION=pr-{N} pnpm install` in the main repo. The release job is skipped for PR builds.

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

### `src/vs/workbench/services/actions/common/menusExtensionPoint.ts`

**Change: Register TitleBarNavigation and TitleBarActions as extension API menus**

**Purpose:** Allow extensions to contribute commands to the title bar contribution points via `package.json` menu declarations (e.g., `"titleBar/navigation"` and `"titleBar/actions"`).

**Details:** Adds two entries to the `apiMenus` array mapping the extension-facing menu keys `titleBar/navigation` and `titleBar/actions` to the corresponding `MenuId.TitleBarNavigation` and `MenuId.TitleBarActions` constants. Both set `supportsSubmenus: false` since these are horizontal toolbar menus. These are additive — no existing entries are modified.

**Action on merge:** Re-add the two `apiMenus` entries if the array is restructured.

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

### `build/lib/compilation.ts`

**Change: Whitelist `setEditorVisible` in mangler's implicit-public check**

**Purpose:** Upstream `chatDebugEditor.ts` overrides the `protected setEditorVisible` method without the `protected` keyword, widening it to public. The mangler treats this as a fatal error. Rather than patching the upstream source file (which would create a recurring merge conflict), we add `'setEditorVisible'` to the existing `strictImplicitPublicHandling` whitelist alongside `'saveState'`.

**Details:** Appends `'setEditorVisible'` to the `Set` passed to `computeNewFileContents()`. The mangler will log a warning instead of erroring.

**Action on merge:** If the `computeNewFileContents` call changes, ensure `'setEditorVisible'` remains in the Set. Can be removed if upstream adds `protected` to the override in `chatDebugEditor.ts`.

### `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`

**Change: Promote `welcomeMessageContainer`, `instantiationService`, and `renderWelcomeViewContentIfNeeded` from private to protected**

**Purpose:** Allow `DevSwarmChatWidget` (our subclass) to override the welcome view rendering for session-first UX — showing a custom agent-picker welcome part and controlling input visibility based on session state.

**Details:** Three visibility changes:
- `private welcomeMessageContainer` → `protected welcomeMessageContainer` (line ~277)
- `@IInstantiationService private readonly instantiationService` → `protected readonly` (line ~398)
- `private renderWelcomeViewContentIfNeeded()` → `protected renderWelcomeViewContentIfNeeded()` (line ~1036)

No logic changes. The subclass `DevSwarmChatWidget` overrides `renderWelcomeViewContentIfNeeded()` to render a `DevSwarmWelcomePart` instead of the stock `ChatViewWelcomePart`.

**Action on merge:** Re-apply the `protected` modifiers if upstream modifies these declarations.
