/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IDevSwarmRequestContext, IDevSwarmResult } from '../../../../api/common/extHost.protocol.js';
import { IChatProgress } from '../chatService/chatService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ChatContextKeys } from '../actions/chatContextKeys.js';

export const enum DevSwarmSessionState {
	None = 'none',
	Starting = 'starting',
	Active = 'active',
}

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
	readonly sessionState: DevSwarmSessionState;
	readonly onDidChangeSessionState: Event<DevSwarmSessionState>;
	hasActiveAssistant(): boolean;
	get activeAssistantId(): string | undefined;
	setActiveAssistant(assistantId: string | undefined): void;
	startSession(agentId: string): void;
	endSession(): void;
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

export class DevSwarmService extends Disposable implements IDevSwarmService {

	declare readonly _serviceBrand: undefined;

	private _sessionState: DevSwarmSessionState = DevSwarmSessionState.None;
	private readonly _onDidChangeSessionState = this._register(new Emitter<DevSwarmSessionState>());
	readonly onDidChangeSessionState: Event<DevSwarmSessionState> = this._onDidChangeSessionState.event;

	get sessionState(): DevSwarmSessionState {
		return this._sessionState;
	}

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService private readonly _commandService: ICommandService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super();
		ChatContextKeys.enabled.bindTo(contextKeyService).set(true);
		ChatContextKeys.panelParticipantRegistered.bindTo(contextKeyService).set(true);
		ChatContextKeys.devswarmChatActive.bindTo(contextKeyService).set(true);

		configurationService.updateValue('chat.tips.enabled', false);

		this._register(CommandsRegistry.registerCommand('devswarm.chat.sessionStarted', () => {
			this._setSessionState(DevSwarmSessionState.Active);
		}));
	}

	private _setSessionState(state: DevSwarmSessionState): void {
		if (this._sessionState !== state) {
			this._sessionState = state;
			this._onDidChangeSessionState.fire(state);
		}
	}

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
		return this._sessionState === DevSwarmSessionState.Active;
	}

	setActiveAssistant(assistantId: string | undefined): void {
		this._activeAssistantId = assistantId;
	}

	startSession(agentId: string): void {
		if (this._sessionState !== DevSwarmSessionState.None) {
			return;
		}
		this._setSessionState(DevSwarmSessionState.Starting);
		this._commandService.executeCommand('devswarm.chat.startSession', agentId);
	}

	endSession(): void {
		this._activeAssistantId = undefined;
		this._setSessionState(DevSwarmSessionState.None);
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
