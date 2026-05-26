/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../../platform/log/common/log.js';
import { ExtHostDevSwarmShape, IDevSwarmRequestContext, IDevSwarmResult, IMainContext, MainContext, MainThreadDevSwarmShape } from './extHost.protocol.js';
import { ExtHostCommands } from './extHostCommands.js';

export class ExtHostDevSwarm implements ExtHostDevSwarmShape {

	private readonly _proxy: MainThreadDevSwarmShape;

	constructor(
		mainContext: IMainContext,
		private readonly _logService: ILogService,
		private readonly _commands: ExtHostCommands,
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadDevSwarm);
		this._syncAssistants();
	}

	private async _syncAssistants(): Promise<void> {
		try {
			const result = await this._commands.executeCommand<{ installed?: Array<{ id: string; name: string; installed: boolean }>; available?: Array<{ id: string; name: string; installed: boolean }> }>(
				'devswarm.chat.getAssistants',
			);
			if (result) {
				this._proxy.$setAssistants(result.installed || [], result.available || []);
			}
		} catch (err) {
			this._logService.debug('[ExtHostDevSwarm] Failed to sync assistants:', err);
		}
	}

	async $sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		_context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult> {
		try {
			const result = await this._commands.executeCommand<IDevSwarmResult>(
				'devswarm.chat.sendPrompt',
				assistantId,
				message,
				requestId,
			);
			return result || {};
		} catch (err) {
			this._logService.error('[ExtHostDevSwarm] sendToAssistant failed:', err);
			return { errorDetails: { message: String(err) } };
		}
	}

	$cancelRequest(requestId: string): void {
		this._commands.executeCommand('devswarm.chat.cancelRequest', requestId).catch(err => {
			this._logService.debug('[ExtHostDevSwarm] cancelRequest failed:', err);
		});
	}
}
