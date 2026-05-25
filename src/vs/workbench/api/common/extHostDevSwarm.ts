/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../../platform/log/common/log.js';
import { ExtHostDevSwarmShape, IDevSwarmAssistantDto, IDevSwarmRequestContext, IDevSwarmResult, IMainContext, MainContext, MainThreadDevSwarmShape } from './extHost.protocol.js';
import { mapIrToProgress, IrMessagePayload } from '../../contrib/chat/common/devswarm/devswarmProgressMapper.js';

interface WsMessage {
	type: string;
	channel?: string;
	id?: string;
	args?: unknown[];
	result?: unknown;
	error?: string;
}

export class ExtHostDevSwarm implements ExtHostDevSwarmShape {

	private readonly _proxy: MainThreadDevSwarmShape;
	private _ws: WebSocket | undefined;
	private _wsReady: Promise<void> | undefined;
	private readonly _pendingInvokes = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
	private readonly _messageListeners = new Map<string, (msg: { sessionId: string; message: IrMessagePayload & { messageId: string } }) => void>();

	constructor(
		mainContext: IMainContext,
		@ILogService private readonly _logService: ILogService,
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadDevSwarm);
		this._syncAssistants();
	}

	private async _syncAssistants(): Promise<void> {
		const port = this._httpPort;
		if (!port) {
			return;
		}

		try {
			const resp = await fetch(`http://127.0.0.1:${port}/api/agents/status`);
			const data = await resp.json() as {
				success: boolean;
				data?: Record<string, { installed?: boolean; version?: string }>;
			};
			if (!data.success || !data.data) {
				return;
			}

			const installed: IDevSwarmAssistantDto[] = [];
			const available: IDevSwarmAssistantDto[] = [];

			for (const [agentId, status] of Object.entries(data.data)) {
				const dto: IDevSwarmAssistantDto = {
					id: agentId,
					name: agentId.charAt(0).toUpperCase() + agentId.slice(1),
					installed: status.installed === true,
				};
				if (dto.installed) {
					installed.push(dto);
				} else {
					available.push(dto);
				}
			}

			this._proxy.$setAssistants(installed, available);
		} catch (err) {
			this._logService.debug('[ExtHostDevSwarm] Failed to sync assistants:', err);
		}
	}

	private get _httpPort(): string | undefined {
		return (globalThis as Record<string, unknown>).process
			? ((globalThis as Record<string, unknown>).process as { env: Record<string, string> }).env['DEVSWARM_HTTP_PORT']
			: undefined;
	}

	private _ensureWebSocket(): Promise<void> {
		if (this._wsReady) {
			return this._wsReady;
		}

		const port = this._httpPort;
		if (!port) {
			return Promise.reject(new Error('DEVSWARM_HTTP_PORT not set'));
		}

		this._wsReady = new Promise<void>((resolve, reject) => {
			const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

			ws.addEventListener('open', () => {
				ws.send(JSON.stringify({
					type: 'register',
					channel: 'register',
					clientType: 'ext-host-devswarm',
				}));
				this._ws = ws;
				resolve();
			});

			ws.addEventListener('message', (event) => {
				try {
					const msg = JSON.parse(String(event.data)) as WsMessage;

					if (msg.type === 'response' && msg.id) {
						const pending = this._pendingInvokes.get(msg.id);
						if (pending) {
							this._pendingInvokes.delete(msg.id);
							clearTimeout(pending.timer);
							if (msg.error) {
								pending.reject(new Error(msg.error));
							} else {
								pending.resolve(msg.result);
							}
						}
						return;
					}

					if (msg.type === 'event' && msg.channel === 'ai-chat:message') {
						const broadcast = msg.args?.[0] as { sessionId: string; message: IrMessagePayload & { messageId: string } } | undefined;
						if (broadcast) {
							for (const listener of this._messageListeners.values()) {
								listener(broadcast);
							}
						}
					}
				} catch (err) {
					this._logService.error('[ExtHostDevSwarm] Failed to parse WS message:', err);
				}
			});

			ws.addEventListener('close', () => {
				this._ws = undefined;
				this._wsReady = undefined;
			});

			ws.addEventListener('error', (err) => {
				this._logService.error('[ExtHostDevSwarm] WebSocket error:', err);
				reject(err);
			});
		});

		return this._wsReady;
	}

	private async _wsInvoke(channel: string, args: unknown[]): Promise<unknown> {
		await this._ensureWebSocket();
		if (!this._ws) {
			throw new Error('WebSocket not connected');
		}

		const id = crypto.randomUUID();

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this._pendingInvokes.delete(id);
				reject(new Error(`wsInvoke timeout for ${channel}`));
			}, 15_000);

			this._pendingInvokes.set(id, { resolve, reject, timer });

			this._ws!.send(JSON.stringify({
				type: 'invoke',
				id,
				channel,
				args,
			}));
		});
	}

	async $sendToAssistant(
		assistantId: string,
		message: string,
		requestId: string,
		_context: IDevSwarmRequestContext,
	): Promise<IDevSwarmResult> {
		const port = this._httpPort;
		if (!port) {
			return { errorDetails: { message: 'DEVSWARM_HTTP_PORT not set' } };
		}

		try {
			// Resolve the builderId from workspace folder
			const builderInfo = await this._resolveBuilderInfo(port);
			if (!builderInfo) {
				return { errorDetails: { message: 'No active DevSwarm workspace found' } };
			}

			// Find or spawn an agent terminal
			const sessionId = await this._findOrSpawnAgent(port, builderInfo.builderId, assistantId);
			if (!sessionId) {
				return { errorDetails: { message: `Failed to find or spawn agent: ${assistantId}` } };
			}

			// Register for ai-chat:message events
			await this._ensureWebSocket();

			await this._wsInvoke('ai-chat:register', [
				{ sessionId, subscriberId: `ext-host-${requestId}` },
			]);

			const seenMessageIds = new Set<string>();
			const listenerKey = requestId;

			this._messageListeners.set(listenerKey, (broadcast) => {
				if (broadcast.sessionId !== sessionId) {
					return;
				}
				if (seenMessageIds.has(broadcast.message.messageId)) {
					return;
				}
				seenMessageIds.add(broadcast.message.messageId);

				const chunks = mapIrToProgress(broadcast.message);
				if (chunks.length > 0) {
					this._proxy.$handleProgress(requestId, chunks);
				}

				if (broadcast.message.role === 'assistant' && broadcast.message.stopReason != null) {
					this._messageListeners.delete(listenerKey);
				}
			});

			// Send the prompt
			try {
				await this._wsInvoke('ai-chat:writeInput', [{ sessionId, text: message }]);
			} catch {
				// Fallback to raw terminal input
				try {
					await this._wsInvoke('terminal:sendInput', [{ terminalId: sessionId, data: message + '\n' }]);
				} catch (fallbackErr) {
					this._messageListeners.delete(listenerKey);
					return { errorDetails: { message: `Failed to send prompt: ${fallbackErr}` } };
				}
			}

			// Wait for completion (up to 10 minutes)
			await new Promise<void>((resolve) => {
				const originalListener = this._messageListeners.get(listenerKey);
				if (!originalListener) {
					resolve();
					return;
				}

				const timeout = setTimeout(() => {
					this._messageListeners.delete(listenerKey);
					resolve();
				}, 600_000);

				this._messageListeners.set(listenerKey, (broadcast) => {
					originalListener(broadcast);
					if (!this._messageListeners.has(listenerKey)) {
						clearTimeout(timeout);
						resolve();
					}
				});
			});

			return {};
		} catch (err) {
			this._logService.error('[ExtHostDevSwarm] sendToAssistant failed:', err);
			return { errorDetails: { message: String(err) } };
		}
	}

	$cancelRequest(requestId: string): void {
		this._messageListeners.delete(requestId);
		this._logService.debug(`ExtHostDevSwarm#$cancelRequest: ${requestId}`);
	}

	private async _resolveBuilderInfo(port: string): Promise<{ builderId: string } | undefined> {
		// Check DEVSWARM_BUILDER_ID first
		const env = (globalThis as Record<string, unknown>).process
			? ((globalThis as Record<string, unknown>).process as { env: Record<string, string> }).env
			: {} as Record<string, string>;

		if (env['DEVSWARM_BUILDER_ID']) {
			return { builderId: env['DEVSWARM_BUILDER_ID'] };
		}

		// Fall back to workspace folder resolution
		try {
			const workspaceFolder = env['VSCODE_CWD'] || env['PWD'];
			if (workspaceFolder) {
				const resp = await fetch(
					`http://127.0.0.1:${port}/api/builder/by-folder?folder=${encodeURIComponent(workspaceFolder)}`,
				);
				const data = await resp.json() as { success: boolean; builder?: { id: string } };
				if (data.success && data.builder) {
					return { builderId: data.builder.id };
				}
			}
		} catch (err) {
			this._logService.error('[ExtHostDevSwarm] Failed to resolve builder:', err);
		}

		return undefined;
	}

	private async _findOrSpawnAgent(port: string, builderId: string, agentId: string): Promise<string | null> {
		// Check existing AI terminals
		try {
			const resp = await fetch(
				`http://127.0.0.1:${port}/api/builder/terminals?builderId=${builderId}`,
			);
			const data = await resp.json() as {
				success: boolean;
				terminals?: Array<{ id: string; terminalType: string; aiAgent: string | null }>;
			};
			if (data.success && data.terminals) {
				const matching = data.terminals.filter(t => t.terminalType === 'ai' && t.aiAgent === agentId);
				if (matching.length > 0) {
					return matching[0]!.id;
				}
			}
		} catch (err) {
			this._logService.error('[ExtHostDevSwarm] Failed to fetch terminals:', err);
		}

		// Spawn a new agent
		try {
			const resp = await fetch(`http://127.0.0.1:${port}/api/terminal/spawn`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					builderId,
					terminalType: 'ai',
					aiAgent: agentId,
					mode: 'gui',
				}),
			});
			const data = await resp.json() as { success: boolean; builderTerminalId?: string };
			if (data.success && data.builderTerminalId) {
				return data.builderTerminalId;
			}
		} catch (err) {
			this._logService.error('[ExtHostDevSwarm] Failed to spawn agent:', err);
		}

		return null;
	}
}
