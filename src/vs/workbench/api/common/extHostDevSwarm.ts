/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../../platform/log/common/log.js';
import { ExtHostDevSwarmShape, IDevSwarmRequestContext, IDevSwarmResult, IMainContext, MainContext, MainThreadDevSwarmShape } from './extHost.protocol.js';

export class ExtHostDevSwarm implements ExtHostDevSwarmShape {

	private readonly _proxy: MainThreadDevSwarmShape;

	constructor(
		mainContext: IMainContext,
		@ILogService private readonly _logService: ILogService,
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadDevSwarm);
	}

	async $sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		_context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult> {
		this._proxy.$handleProgress(requestId, [{
			kind: 'markdownContent',
			content: { value: `**${assistantId}:** ${message}` }
		}]);
		return {};
	}

	$cancelRequest(requestId: string): void {
		this._logService.debug(`ExtHostDevSwarm#$cancelRequest: ${requestId} (stub — no-op)`);
	}
}
