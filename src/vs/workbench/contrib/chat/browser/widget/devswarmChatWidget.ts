/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { IMarkdownString, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../../base/common/network.js';
import { localize } from '../../../../../nls.js';
import { IDevSwarmService, DevSwarmSessionState } from '../../common/devswarm/devswarmService.js';
import { IChatViewWelcomeContent } from '../viewsWelcome/chatViewWelcomeController.js';
import { ChatWidget } from './chatWidget.js';
import { DevSwarmWelcomePart } from './devswarmWelcomePart.js';

const DEVSWARM_LOGO_URI = FileAccess.asBrowserUri('vs/workbench/contrib/chat/browser/widgetHosts/viewPane/media/devswarm-logo.svg');

export class DevSwarmChatWidget extends ChatWidget {

	private readonly _devswarmWelcomePart = this._register(new MutableDisposable<DevSwarmWelcomePart>());
	private _sessionStateWired = false;

	override render(parent: HTMLElement): void {
		super.render(parent);
		this._wireSessionState();
	}

	private _wireSessionState(): void {
		if (this._sessionStateWired) {
			return;
		}
		this._sessionStateWired = true;

		const devswarmService = this._getDevSwarmService();
		if (!devswarmService) {
			return;
		}

		this._register(devswarmService.onDidChangeSessionState(state => {
			this._updateForSessionState(state);
		}));

		this._updateForSessionState(devswarmService.sessionState);
	}

	private _getDevSwarmService(): IDevSwarmService | undefined {
		try {
			return this.instantiationService.invokeFunction(accessor => accessor.get(IDevSwarmService));
		} catch {
			return undefined;
		}
	}

	protected override getWelcomeViewContent(additionalMessage: string | IMarkdownString | undefined): IChatViewWelcomeContent {
		if (this.isLockedToCodingAgent) {
			return super.getWelcomeViewContent(additionalMessage);
		}

		return {
			title: localize('devswarm.agentTitle', "What would you like to build?"),
			message: new MarkdownString(''),
			icon: DEVSWARM_LOGO_URI,
			additionalMessage,
			useLargeIcon: true,
		};
	}

	protected override renderWelcomeViewContentIfNeeded(): void {
		const devswarmService = this._getDevSwarmService();
		if (!devswarmService || devswarmService.sessionState === DevSwarmSessionState.Active) {
			super.renderWelcomeViewContentIfNeeded();
			return;
		}

		// In None or Starting states, show our custom welcome part
		if (!this._devswarmWelcomePart.value) {
			dom.clearNode(this.welcomeMessageContainer);
			this._devswarmWelcomePart.value = this.instantiationService.createInstance(DevSwarmWelcomePart);
			dom.append(this.welcomeMessageContainer, this._devswarmWelcomePart.value.element);
		}

		dom.setVisibility(true, this.welcomeMessageContainer);

		// Hide input part while in welcome state
		this.inputPart.element.style.display = 'none';
	}

	private _updateForSessionState(state: DevSwarmSessionState): void {
		switch (state) {
			case DevSwarmSessionState.None:
			case DevSwarmSessionState.Starting:
				// Show welcome, hide input
				this.renderWelcomeViewContentIfNeeded();
				break;

			case DevSwarmSessionState.Active:
				// Hide welcome, show input — let base ChatWidget behavior take over
				this._devswarmWelcomePart.clear();
				dom.clearNode(this.welcomeMessageContainer);
				dom.setVisibility(false, this.welcomeMessageContainer);
				this.inputPart.element.style.display = '';
				break;
		}
	}
}
