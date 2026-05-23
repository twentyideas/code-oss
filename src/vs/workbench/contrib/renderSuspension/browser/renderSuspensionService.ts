/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';

export const IRenderSuspensionService = createDecorator<IRenderSuspensionService>('renderSuspensionService');

export interface IRenderSuspensionService {
	readonly _serviceBrand: undefined;
	readonly isSuspended: boolean;
	readonly onDidChangeSuspended: Event<boolean>;
	suspend(): void;
	resume(): void;
}

export class RenderSuspensionService extends Disposable implements IRenderSuspensionService {

	declare readonly _serviceBrand: undefined;

	private _suspended = false;
	private _realRequestAnimationFrame: typeof requestAnimationFrame | undefined;
	private _realCancelAnimationFrame: typeof cancelAnimationFrame | undefined;
	private _pendingResumeCallbacks: Array<FrameRequestCallback> = [];

	private readonly _onDidChangeSuspended = this._register(new Emitter<boolean>());
	readonly onDidChangeSuspended: Event<boolean> = this._onDidChangeSuspended.event;

	get isSuspended(): boolean {
		return this._suspended;
	}

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	suspend(): void {
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
		this._onDidChangeSuspended.fire(true);
	}

	resume(): void {
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
		this._onDidChangeSuspended.fire(false);
	}
}

registerSingleton(IRenderSuspensionService, RenderSuspensionService, InstantiationType.Delayed);
