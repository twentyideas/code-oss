/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ILogService } from '../../../../platform/log/common/log.js';

interface RenderSuspensionMessage {
	type: 'devswarm:suspend-rendering' | 'devswarm:resume-rendering';
}

function isRenderSuspensionMessage(data: unknown): data is RenderSuspensionMessage {
	return typeof data === 'object' && data !== null && 'type' in data
		&& (
			(data as RenderSuspensionMessage).type === 'devswarm:suspend-rendering'
			|| (data as RenderSuspensionMessage).type === 'devswarm:resume-rendering'
		);
}

export class RenderSuspensionContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.renderSuspension';

	private _suspended = false;
	private _realRequestAnimationFrame: typeof requestAnimationFrame | undefined;
	private _realCancelAnimationFrame: typeof cancelAnimationFrame | undefined;
	private _pendingResumeCallbacks: Array<FrameRequestCallback> = [];

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();

		const onMessage = (event: MessageEvent) => {
			if (!isRenderSuspensionMessage(event.data)) {
				return;
			}

			if (event.data.type === 'devswarm:suspend-rendering') {
				this.suspend();
			} else {
				this.resume();
			}
		};

		window.addEventListener('message', onMessage);
		this._register({ dispose: () => window.removeEventListener('message', onMessage) });
	}

	private suspend(): void {
		if (this._suspended) {
			return;
		}
		this._suspended = true;
		this._pendingResumeCallbacks = [];

		this._realRequestAnimationFrame = window.requestAnimationFrame.bind(window);
		this._realCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

		window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
			this._pendingResumeCallbacks.push(callback);
			return -1;
		};
		window.cancelAnimationFrame = () => { };

		this.logService.info('[RenderSuspension] Rendering suspended');
	}

	private resume(): void {
		if (!this._suspended || !this._realRequestAnimationFrame || !this._realCancelAnimationFrame) {
			return;
		}
		this._suspended = false;

		window.requestAnimationFrame = this._realRequestAnimationFrame;
		window.cancelAnimationFrame = this._realCancelAnimationFrame;

		const callbacks = this._pendingResumeCallbacks;
		this._pendingResumeCallbacks = [];
		this._realRequestAnimationFrame = undefined;
		this._realCancelAnimationFrame = undefined;

		// Flush all queued callbacks on the next real frame so every
		// subsystem (editor, minimap, terminals, etc.) repaints.
		window.requestAnimationFrame((timestamp) => {
			for (const cb of callbacks) {
				try {
					cb(timestamp);
				} catch (e) {
					this.logService.error('[RenderSuspension] Error in resumed callback', e);
				}
			}
		});

		this.logService.info('[RenderSuspension] Rendering resumed');
	}
}
