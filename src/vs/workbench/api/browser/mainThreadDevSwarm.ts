/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { IChatProgress } from '../../contrib/chat/common/chatService/chatService.js';
import { IDevSwarmService } from '../../contrib/chat/common/devswarm/devswarmService.js';
import { IExtHostContext, extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, ExtHostDevSwarmShape, IChatProgressDto, IDevSwarmAssistantDto, IDevSwarmRequestContext, IDevSwarmResult, MainContext, MainThreadDevSwarmShape } from '../common/extHost.protocol.js';

@extHostNamedCustomer(MainContext.MainThreadDevSwarm)
export class MainThreadDevSwarm extends Disposable implements MainThreadDevSwarmShape {

	private readonly _proxy: ExtHostDevSwarmShape;

	constructor(
		extHostContext: IExtHostContext,
		@ILogService private readonly _logService: ILogService,
		@IDevSwarmService private readonly _devswarmService: IDevSwarmService,
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDevSwarm);

		// Wire the service delegate so chatServiceImpl → DevSwarmService → MainThreadDevSwarm → ExtHostDevSwarm
		(this._devswarmService as import('../../contrib/chat/common/devswarm/devswarmService.js').DevSwarmService).setSendToAssistantDelegate(
			(assistantId, message, requestId, context) => this.sendToAssistant(assistantId, message, requestId, context),
		);

		// Register command so the DevSwarm extension can push progress back into the fork
		this._register(CommandsRegistry.registerCommand('devswarm.chat.handleProgress', (accessor, requestId: string, chunks: IChatProgressDto[]) => {
			this.$handleProgress(requestId, chunks);
		}));
	}

	$handleProgress(requestId: string, chunks: IChatProgressDto[]): void {
		const revived: IChatProgress[] = chunks.map(chunk => revive(chunk) as IChatProgress);
		this._devswarmService.handleProgress(requestId, revived);
	}

	$setAssistants(installed: IDevSwarmAssistantDto[], available: IDevSwarmAssistantDto[]): void {
		(this._devswarmService as import('../../contrib/chat/common/devswarm/devswarmService.js').DevSwarmService).setAssistants(installed, available);
	}

	async sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult> {
		return this._proxy.$sendToAssistant(assistantId, message, requestId, context);
	}

	override dispose(): void {
		super.dispose();
	}
}
