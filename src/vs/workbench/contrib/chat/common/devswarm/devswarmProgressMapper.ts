/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChatProgressDto, IChatBeginToolInvocationDto, IChatUpdateToolInvocationDto } from '../../../../api/common/extHost.protocol.js';
import { IChatMarkdownContent, IChatThinkingPart } from '../chatService/chatService.js';

export interface IrContentBlock {
	type: 'text' | 'thinking' | 'tool_invocation' | 'tool_result';
	text?: string;
	content?: string;
	toolName?: string;
	toolCallId?: string;
	input?: Record<string, unknown>;
}

export interface IrMessagePayload {
	role: string;
	blocks: IrContentBlock[];
	isSidechain?: boolean;
	stopReason?: string | null;
	usage?: { inputTokens: number; outputTokens: number };
	model?: string | null;
}

export function mapIrToProgress(msg: IrMessagePayload): IChatProgressDto[] {
	if (msg.role !== 'assistant') {
		return [];
	}
	if (msg.isSidechain) {
		return [];
	}

	const chunks: IChatProgressDto[] = [];

	for (const block of msg.blocks) {
		switch (block.type) {
			case 'text': {
				const part: IChatMarkdownContent = {
					kind: 'markdownContent',
					content: { value: block.text ?? '' },
				};
				chunks.push(part as IChatProgressDto);
				break;
			}
			case 'thinking': {
				const part: IChatThinkingPart = {
					kind: 'thinking',
					value: block.text ?? '',
				};
				chunks.push(part as IChatProgressDto);
				break;
			}
			case 'tool_invocation': {
				const beginPart: IChatBeginToolInvocationDto = {
					kind: 'beginToolInvocation',
					toolCallId: block.toolCallId ?? '',
					toolName: block.toolName ?? 'unknown',
				};
				chunks.push(beginPart);

				if (block.input && Object.keys(block.input).length) {
					const updatePart: IChatUpdateToolInvocationDto = {
						kind: 'updateToolInvocation',
						toolCallId: block.toolCallId ?? '',
						streamData: {
							partialInput: JSON.stringify(block.input, null, 2),
						},
					};
					chunks.push(updatePart);
				}
				break;
			}
			case 'tool_result': {
				const part: IChatMarkdownContent = {
					kind: 'markdownContent',
					content: { value: block.content ?? '' },
				};
				chunks.push(part as IChatProgressDto);
				break;
			}
		}
	}

	return chunks;
}
