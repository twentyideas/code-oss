/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IChatProgress } from '../../contrib/chat/common/chatService/chatService.js';
import { IExtHostContext, extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, ExtHostDevSwarmShape, IChatProgressDto, IDevSwarmRequestContext, IDevSwarmResult, MainContext, MainThreadDevSwarmShape } from '../common/extHost.protocol.js';

@extHostNamedCustomer(MainContext.MainThreadDevSwarm)
export class MainThreadDevSwarm extends Disposable implements MainThreadDevSwarmShape {

	private readonly _pendingProgress = new Map<string, (chunks: IChatProgress[]) => void>();
	private readonly _proxy: ExtHostDevSwarmShape;

	constructor(
		extHostContext: IExtHostContext,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostDevSwarm);
	}

	$handleProgress(requestId: string, chunks: IChatProgressDto[]): void {
		const callback = this._pendingProgress.get(requestId);
		if (!callback) {
			this._logService.warn(`MainThreadDevSwarm#$handleProgress: No pending progress for requestId ${requestId}`);
			return;
		}

		const revived: IChatProgress[] = chunks.map(chunk => revive(chunk) as IChatProgress);
		callback(revived);
	}

	registerProgressCallback(requestId: string, callback: (chunks: IChatProgress[]) => void): void {
		this._pendingProgress.set(requestId, callback);
	}

	removeProgressCallback(requestId: string): void {
		this._pendingProgress.delete(requestId);
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
		this._pendingProgress.clear();
		super.dispose();
	}
}
