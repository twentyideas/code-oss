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

### `product.json`

**Change 1: Remove `defaultChatAgent` block**

**Purpose:** Prevent VS Code from showing the GitHub Copilot welcome overlay, install prompts, and AI panel on startup. DevSwarm has its own onboarding experience.

**Action on merge:** If upstream modifies `defaultChatAgent`, discard their changes to that block. The entire `defaultChatAgent` key and its contents should be deleted from the file.

**Change 2: Clear `trustedExtensionAuthAccess`**

**Purpose:** The upstream value only granted `GitHub.copilot-chat` access to GitHub auth providers. With Copilot removed, this should be empty.

**Action on merge:** Replace the upstream `trustedExtensionAuthAccess` value with an empty object:
```json
"trustedExtensionAuthAccess": {}
```
If upstream adds non-Copilot entries here in the future, keep those and only remove Copilot-related ones.

---

### `src/vs/platform/product/common/product.ts`

**Change: Remove hardcoded `defaultChatAgent` fallback**

**Purpose:** The dev-mode fallback (when `product.json` is empty) also hardcodes a `defaultChatAgent` with Copilot extension IDs. This must be removed to match the `product.json` change.

**Action on merge:** In the `Object.keys(product).length === 0` block (the "Running out of sources" fallback), ensure there is no `defaultChatAgent` property in the `Object.assign` call. The block should end after `serverLicenseUrl` with no trailing comma or additional properties. If upstream adds other properties to this block, keep them — only remove `defaultChatAgent`.
