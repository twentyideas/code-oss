/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { RenderSuspensionService } from '../../browser/renderSuspensionService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';

suite('RenderSuspensionService', () => {

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

	function createService(): RenderSuspensionService {
		const service = new RenderSuspensionService(new NullLogService());
		disposables.add(service);
		return service;
	}

	test('initial state is not suspended', () => {
		const service = createService();
		assert.strictEqual(service.isSuspended, false);
	});

	test('suspend replaces requestAnimationFrame', () => {
		const service = createService();
		service.suspend();

		assert.strictEqual(service.isSuspended, true);
		assert.notStrictEqual(window.requestAnimationFrame, originalRAF);

		let called = false;
		const id = window.requestAnimationFrame(() => { called = true; });
		assert.strictEqual(id, -1);
		assert.strictEqual(called, false);
	});

	test('resume restores requestAnimationFrame', () => {
		const service = createService();
		service.suspend();
		service.resume();

		assert.strictEqual(service.isSuspended, false);
		assert.strictEqual(window.requestAnimationFrame, originalRAF);
	});

	test('resume flushes queued callbacks', () => {
		const service = createService();
		service.suspend();

		const calls: number[] = [];
		window.requestAnimationFrame(() => calls.push(1));
		window.requestAnimationFrame(() => calls.push(2));
		assert.deepStrictEqual(calls, []);

		service.resume();

		return new Promise<void>((resolve) => {
			// Queued callbacks fire on the next real animation frame
			originalRAF.call(window, () => {
				originalRAF.call(window, () => {
					assert.deepStrictEqual(calls, [1, 2]);
					resolve();
				});
			});
		});
	});

	test('double suspend is idempotent', () => {
		const service = createService();
		service.suspend();
		const rafAfterFirst = window.requestAnimationFrame;

		service.suspend();
		assert.strictEqual(window.requestAnimationFrame, rafAfterFirst);
	});

	test('double resume is a no-op', () => {
		const service = createService();
		service.suspend();
		service.resume();
		service.resume();

		assert.strictEqual(service.isSuspended, false);
		assert.strictEqual(window.requestAnimationFrame, originalRAF);
	});

	test('fires onDidChangeSuspended on suspend and resume', () => {
		const service = createService();
		const events: boolean[] = [];
		disposables.add(service.onDidChangeSuspended(v => events.push(v)));

		service.suspend();
		service.resume();

		assert.deepStrictEqual(events, [true, false]);
	});

	test('resume without prior suspend is a no-op', () => {
		const service = createService();
		service.resume();

		assert.strictEqual(service.isSuspended, false);
		assert.strictEqual(window.requestAnimationFrame, originalRAF);
	});
});
