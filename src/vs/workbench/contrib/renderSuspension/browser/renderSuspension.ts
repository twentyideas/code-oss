/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IRenderSuspensionService } from './renderSuspensionService.js';

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

	constructor(
		@IRenderSuspensionService private readonly renderSuspensionService: IRenderSuspensionService,
	) {
		super();

		const onMessage = (event: MessageEvent) => {
			if (!isRenderSuspensionMessage(event.data)) {
				return;
			}

			if (event.data.type === 'devswarm:suspend-rendering') {
				this.renderSuspensionService.suspend();
			} else {
				this.renderSuspensionService.resume();
			}
		};

		window.addEventListener('message', onMessage);
		this._register({ dispose: () => window.removeEventListener('message', onMessage) });
	}
}
