/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseActionViewItem } from '../../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../../../../base/common/actions.js';
import { autorun, IObservable } from '../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { AssistantPickerWidget } from './assistantPickerWidget.js';

export interface IAssistantMetadata {
	id: string;
	name: string;
	iconId?: string;
	installed: boolean;
	isTestOnly?: boolean;
}

export interface IAssistantPickerDelegate {
	readonly currentAssistant: IObservable<IAssistantMetadata | undefined>;
	setAssistant(assistant: IAssistantMetadata): void;
	getInstalledAssistants(): IAssistantMetadata[];
	getAvailableAssistants(): IAssistantMetadata[];
}

export class AssistantPickerActionItem extends BaseActionViewItem {
	private readonly _pickerWidget: AssistantPickerWidget;

	constructor(
		action: IAction,
		delegate: IAssistantPickerDelegate,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(undefined, action);

		this._pickerWidget = this._register(
			instantiationService.createInstance(AssistantPickerWidget, delegate)
		);

		this._register(
			autorun(reader => {
				const assistant = delegate.currentAssistant.read(reader);
				this._pickerWidget.setSelectedAssistant(assistant);
			})
		);

		this._register(
			this._pickerWidget.onDidChangeSelection(a => delegate.setAssistant(a))
		);
	}

	override render(container: HTMLElement): void {
		this._pickerWidget.render(container);
		this.element = this._pickerWidget.domNode;
		container.classList.add('chat-input-picker-item');
	}

	public openAssistantPicker(): void {
		this._pickerWidget.show();
	}
}
