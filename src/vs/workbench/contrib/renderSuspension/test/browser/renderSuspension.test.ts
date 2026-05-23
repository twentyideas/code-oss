/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { RenderSuspensionContribution } from '../../browser/renderSuspension.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';

suite('RenderSuspensionContribution', () => {

	const disposables = new DisposableStore();
	let originalRAF: typeof requestAnimationFrame;
	let originalCAF: typeof cancelAnimationFrame;

	setup(() => {
		originalRAF = window.requestAnimationFrame;
		originalCAF = window.cancelAnimationFrame;
	});

	teardown(() => {
		window.requestAnimationFrame = originalRAF;
		window.cancelAnimationFrame = originalCAF;
		disposables.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	function createContribution(): RenderSuspensionContribution {
		const contribution = new RenderSuspensionContribution(new NullLogService());
		disposables.add(contribution);
		return contribution;
	}

	test('suspend replaces requestAnimationFrame with a no-op', () => {
		createContribution();

		window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

		// postMessage is async — need to wait for it
		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				assert.notStrictEqual(window.requestAnimationFrame, originalRAF);

				// Calling rAF while suspended should return -1 and not invoke the callback synchronously
				let called = false;
				const id = window.requestAnimationFrame(() => { called = true; });
				assert.strictEqual(id, -1);
				assert.strictEqual(called, false);

				resolve();
			});
		});
	});

	test('resume restores requestAnimationFrame', () => {
		createContribution();

		window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				window.postMessage({ type: 'devswarm:resume-rendering' }, '*');

				originalRAF.call(window, () => {
					assert.strictEqual(window.requestAnimationFrame, originalRAF);
					resolve();
				});
			});
		});
	});

	test('resume flushes queued callbacks', () => {
		createContribution();

		window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				// Queue some callbacks while suspended
				const calls: number[] = [];
				window.requestAnimationFrame(() => calls.push(1));
				window.requestAnimationFrame(() => calls.push(2));
				assert.deepStrictEqual(calls, []);

				window.postMessage({ type: 'devswarm:resume-rendering' }, '*');

				originalRAF.call(window, () => {
					// After resume, a real rAF fires the queued callbacks
					originalRAF.call(window, () => {
						assert.deepStrictEqual(calls, [1, 2]);
						resolve();
					});
				});
			});
		});
	});

	test('ignores unrelated messages', () => {
		createContribution();

		window.postMessage({ type: 'some-other-message' }, '*');
		window.postMessage('a string', '*');
		window.postMessage(42, '*');

		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				assert.strictEqual(window.requestAnimationFrame, originalRAF);
				resolve();
			});
		});
	});

	test('double suspend is idempotent', () => {
		createContribution();

		window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				const rafAfterFirstSuspend = window.requestAnimationFrame;

				window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

				originalRAF.call(window, () => {
					// Should be the same patched function, not double-wrapped
					assert.strictEqual(window.requestAnimationFrame, rafAfterFirstSuspend);
					resolve();
				});
			});
		});
	});

	test('double resume is a no-op', () => {
		createContribution();

		window.postMessage({ type: 'devswarm:suspend-rendering' }, '*');

		return new Promise<void>((resolve) => {
			originalRAF.call(window, () => {
				window.postMessage({ type: 'devswarm:resume-rendering' }, '*');

				originalRAF.call(window, () => {
					window.postMessage({ type: 'devswarm:resume-rendering' }, '*');

					originalRAF.call(window, () => {
						assert.strictEqual(window.requestAnimationFrame, originalRAF);
						resolve();
					});
				});
			});
		});
	});
});
