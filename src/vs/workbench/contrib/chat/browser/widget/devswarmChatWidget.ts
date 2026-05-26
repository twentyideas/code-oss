/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMarkdownString, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { FileAccess } from '../../../../../base/common/network.js';
import { localize } from '../../../../../nls.js';
import { IChatViewWelcomeContent } from '../viewsWelcome/chatViewWelcomeController.js';
import { ChatModeKind } from '../../common/constants.js';
import { ChatWidget } from './chatWidget.js';

const DEVSWARM_LOGO_URI = FileAccess.asBrowserUri('vs/workbench/contrib/chat/browser/widgetHosts/viewPane/media/devswarm-logo.svg');

export class DevSwarmChatWidget extends ChatWidget {

	protected override getWelcomeViewContent(additionalMessage: string | IMarkdownString | undefined): IChatViewWelcomeContent {
		if (this.isLockedToCodingAgent) {
			return super.getWelcomeViewContent(additionalMessage);
		}

		let title: string;
		if (this.input.currentModeKind === ChatModeKind.Ask) {
			title = localize('chatDescription', "Ask about your code");
		} else if (this.input.currentModeKind === ChatModeKind.Edit) {
			title = localize('editsTitle', "Edit in context");
		} else {
			title = localize('devswarm.agentTitle', "What would you like to build?");
		}

		return {
			title,
			message: new MarkdownString(''),
			icon: DEVSWARM_LOGO_URI,
			additionalMessage,
			useLargeIcon: true,
		};
	}
}
