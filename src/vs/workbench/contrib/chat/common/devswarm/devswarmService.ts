/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IDevSwarmRequestContext, IDevSwarmResult } from '../../../../api/common/extHost.protocol.js';

export const IDevSwarmService = createDecorator<IDevSwarmService>('devswarmService');

export interface IDevSwarmService {
	readonly _serviceBrand: undefined;
	hasActiveAssistant(): boolean;
	get activeAssistantId(): string | undefined;
	setActiveAssistant(assistantId: string | undefined): void;
	sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult>;
}

export class DevSwarmService implements IDevSwarmService {

	declare readonly _serviceBrand: undefined;

	private _activeAssistantId: string | undefined;
	private _sendToAssistantDelegate: ((
		assistantId: string,
		message: string,
		requestId: string,
		context: IDevSwarmRequestContext,
	) => Promise<IDevSwarmResult>) | undefined;

	get activeAssistantId(): string | undefined {
		return this._activeAssistantId;
	}

	hasActiveAssistant(): boolean {
		return this._activeAssistantId !== undefined;
	}

	setActiveAssistant(assistantId: string | undefined): void {
		this._activeAssistantId = assistantId;
	}

	setSendToAssistantDelegate(delegate: (
		assistantId: string,
		message: string,
		requestId: string,
		context: IDevSwarmRequestContext,
	) => Promise<IDevSwarmResult>): void {
		this._sendToAssistantDelegate = delegate;
	}

	async sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult> {
		if (!this._sendToAssistantDelegate) {
			return { errorDetails: { message: 'No assistant delegate registered' } };
		}
		return this._sendToAssistantDelegate(assistantId, message, requestId, context);
	}
}
