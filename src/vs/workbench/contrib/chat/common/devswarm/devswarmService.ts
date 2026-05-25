/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IDevSwarmRequestContext, IDevSwarmResult } from '../../../../api/common/extHost.protocol.js';
import { IChatProgress } from '../chatService/chatService.js';

export interface IDevSwarmAssistantMetadata {
	id: string;
	name: string;
	iconId?: string;
	installed: boolean;
	isTestOnly?: boolean;
}

export const IDevSwarmService = createDecorator<IDevSwarmService>('devswarmService');

export interface IDevSwarmService {
	readonly _serviceBrand: undefined;
	hasActiveAssistant(): boolean;
	get activeAssistantId(): string | undefined;
	setActiveAssistant(assistantId: string | undefined): void;
	getInstalledAssistants(): IDevSwarmAssistantMetadata[];
	getAvailableAssistants(): IDevSwarmAssistantMetadata[];
	registerProgressCallback(requestId: string, callback: (chunks: IChatProgress[]) => void): void;
	removeProgressCallback(requestId: string): void;
	handleProgress(requestId: string, chunks: IChatProgress[]): void;
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
	private _installedAssistants: IDevSwarmAssistantMetadata[] = [];
	private _availableAssistants: IDevSwarmAssistantMetadata[] = [];
	private readonly _progressCallbacks = new Map<string, (chunks: IChatProgress[]) => void>();
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

	getInstalledAssistants(): IDevSwarmAssistantMetadata[] {
		return this._installedAssistants;
	}

	getAvailableAssistants(): IDevSwarmAssistantMetadata[] {
		return this._availableAssistants;
	}

	setAssistants(installed: IDevSwarmAssistantMetadata[], available: IDevSwarmAssistantMetadata[]): void {
		this._installedAssistants = installed;
		this._availableAssistants = available;
	}

	registerProgressCallback(requestId: string, callback: (chunks: IChatProgress[]) => void): void {
		this._progressCallbacks.set(requestId, callback);
	}

	removeProgressCallback(requestId: string): void {
		this._progressCallbacks.delete(requestId);
	}

	handleProgress(requestId: string, chunks: IChatProgress[]): void {
		const callback = this._progressCallbacks.get(requestId);
		if (callback) {
			callback(chunks);
		}
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
