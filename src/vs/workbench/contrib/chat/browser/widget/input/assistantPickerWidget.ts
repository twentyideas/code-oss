/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../../../base/browser/keyboardEvent.js';
import { renderLabelWithIcons } from '../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { KeyCode } from '../../../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { ActionListItemKind, IActionListItem } from '../../../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionWidgetDropdownAction } from '../../../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import { IAssistantMetadata, IAssistantPickerDelegate } from './assistantPickerActionItem.js';

function buildAssistantPickerItems(
	installed: IAssistantMetadata[],
	available: IAssistantMetadata[],
	selectedId: string | undefined,
	onSelect: (assistant: IAssistantMetadata) => void,
	onInstall: (assistant: IAssistantMetadata) => void,
): IActionListItem<IActionWidgetDropdownAction>[] {
	const items: IActionListItem<IActionWidgetDropdownAction>[] = [];

	if (installed.length) {
		items.push({
			kind: ActionListItemKind.Header,
			label: localize('assistantPicker.installed', "Installed"),
		});
		for (const a of installed) {
			items.push({
				kind: ActionListItemKind.Action,
				label: a.name,
				item: {
					id: `select-${a.id}`,
					label: a.name,
					enabled: true,
					class: undefined,
					tooltip: a.name,
					checked: a.id === selectedId,
					run: () => onSelect(a),
				},
			});
		}
	}

	if (available.length) {
		items.push({
			kind: ActionListItemKind.Header,
			label: localize('assistantPicker.available', "Available"),
		});
		for (const a of available) {
			items.push({
				kind: ActionListItemKind.Action,
				label: a.name,
				item: {
					id: `install-${a.id}`,
					label: a.name,
					enabled: true,
					class: undefined,
					tooltip: a.name,
					run: () => onInstall(a),
				},
				toolbarActions: [{
					id: `install-action-${a.id}`,
					label: localize('assistantPicker.install', "Install"),
					enabled: true,
					class: undefined,
					tooltip: localize('assistantPicker.install', "Install"),
					run: () => onInstall(a),
					dispose: () => { },
				}],
			});
		}
	}

	return items;
}

export class AssistantPickerWidget extends Disposable {

	private readonly _onDidChangeSelection = this._register(new Emitter<IAssistantMetadata>());
	readonly onDidChangeSelection: Event<IAssistantMetadata> = this._onDidChangeSelection.event;

	private _selectedAssistant: IAssistantMetadata | undefined;
	private _domNode: HTMLElement | undefined;

	get domNode(): HTMLElement | undefined {
		return this._domNode;
	}

	constructor(
		private readonly _delegate: IAssistantPickerDelegate,
		@IActionWidgetService private readonly _actionWidgetService: IActionWidgetService,
	) {
		super();
	}

	setSelectedAssistant(assistant: IAssistantMetadata | undefined): void {
		this._selectedAssistant = assistant;
		this._renderLabel();
	}

	render(container: HTMLElement): void {
		this._domNode = dom.append(container, dom.$('a.action-label'));
		this._domNode.tabIndex = 0;
		this._domNode.setAttribute('role', 'button');
		this._domNode.setAttribute('aria-haspopup', 'true');
		this._domNode.setAttribute('aria-expanded', 'false');

		this._renderLabel();

		this._register(dom.addDisposableGenericMouseDownListener(this._domNode, e => {
			if (e.button !== 0) {
				return;
			}
			dom.EventHelper.stop(e, true);
			this.show();
		}));

		this._register(dom.addDisposableListener(this._domNode, dom.EventType.KEY_DOWN, (e) => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				dom.EventHelper.stop(e, true);
				this.show();
			}
		}));
	}

	show(anchor?: HTMLElement): void {
		const anchorElement = anchor ?? this._domNode;
		if (!anchorElement) {
			return;
		}

		const onSelect = (assistant: IAssistantMetadata) => {
			this._selectedAssistant = assistant;
			this._renderLabel();
			this._onDidChangeSelection.fire(assistant);
		};

		const onInstall = (_assistant: IAssistantMetadata) => {
			// Install flow will be wired by Workspace I
		};

		const installed = this._delegate.getInstalledAssistants().filter(a => !a.isTestOnly);
		const available = this._delegate.getAvailableAssistants().filter(a => !a.isTestOnly);

		const items = buildAssistantPickerItems(
			installed,
			available,
			this._selectedAssistant?.id,
			onSelect,
			onInstall,
		);

		const previouslyFocusedElement = dom.getActiveElement();

		const delegate = {
			onSelect: (action: IActionWidgetDropdownAction) => {
				this._actionWidgetService.hide();
				action.run();
			},
			onHide: (_didCancel?: boolean) => {
				this._domNode?.setAttribute('aria-expanded', 'false');
				if (dom.isHTMLElement(previouslyFocusedElement)) {
					previouslyFocusedElement.focus();
				}
			},
		};

		this._domNode?.setAttribute('aria-expanded', 'true');

		this._actionWidgetService.show(
			'AssistantPicker',
			false,
			items,
			delegate,
			anchorElement,
			undefined,
			[],
			undefined,
			{ minWidth: 200 },
		);
	}

	private _renderLabel(): void {
		if (!this._domNode) {
			return;
		}

		const assistantLabel = this._selectedAssistant?.name ?? localize('assistantPicker.select', "Assistant");
		const domChildren: (HTMLElement | string)[] = [];
		domChildren.push(dom.$('span.chat-input-picker-label', undefined, assistantLabel));
		domChildren.push(...renderLabelWithIcons(`$(chevron-down)`));

		dom.reset(this._domNode, ...domChildren);

		this._domNode.ariaLabel = localize('assistantPicker.ariaLabel', "Select Coding Assistant, {0}", assistantLabel);
	}
}
