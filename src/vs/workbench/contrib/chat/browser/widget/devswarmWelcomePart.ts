/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './devswarmWelcome.css';
import * as dom from '../../../../../base/browser/dom.js';
import { renderIcon } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { IAction } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../../base/common/network.js';
import { asCSSUrl } from '../../../../../base/browser/cssValue.js';
import { createCSSRule } from '../../../../../base/browser/domStylesheets.js';
import { StringSHA1 } from '../../../../../base/common/hash.js';
import { localize } from '../../../../../nls.js';
import { ActionListItemKind, IActionListItem } from '../../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionWidgetDropdownAction } from '../../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDevSwarmAssistantMetadata, IDevSwarmService, DevSwarmSessionState } from '../../common/devswarm/devswarmService.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';

const DEVSWARM_LOGO_URI = FileAccess.asBrowserUri('vs/workbench/contrib/chat/browser/widgetHosts/viewPane/media/devswarm-logo.svg');

export class DevSwarmWelcomePart extends Disposable {

	private readonly _onDidSelectAgent = this._register(new Emitter<string>());
	readonly onDidSelectAgent: Event<string> = this._onDidSelectAgent.event;

	readonly element: HTMLElement;
	private _button: Button | undefined;
	private _loadingElement: HTMLElement | undefined;

	constructor(
		@IDevSwarmService private readonly _devswarmService: IDevSwarmService,
		@ICommandService private readonly _commandService: ICommandService,
		@IActionWidgetService private readonly _actionWidgetService: IActionWidgetService,
	) {
		super();

		this.element = dom.$('.devswarm-welcome');

		// Logo
		const icon = dom.append(this.element, dom.$('.devswarm-welcome-icon'));
		const cssUrl = asCSSUrl(DEVSWARM_LOGO_URI);
		const hash = new StringSHA1();
		hash.update(cssUrl);
		const iconId = `devswarm-welcome-icon-${hash.digest()}`;
		createCSSRule(`.devswarm-welcome-icon.${iconId}`, `
			mask: ${cssUrl} no-repeat 50% 50%;
			-webkit-mask: ${cssUrl} no-repeat 50% 50%;
			background-color: var(--vscode-icon-foreground);
		`);
		icon.classList.add(iconId, 'custom-icon');

		// Title
		const title = dom.append(this.element, dom.$('.devswarm-welcome-title'));
		title.textContent = localize('devswarm.welcome.title', "What would you like to build?");

		// New Session button
		this._button = this._register(new Button(this.element, { ...defaultButtonStyles, title: localize('devswarm.welcome.newSession', "New Session") }));
		this._button.label = localize('devswarm.welcome.newSession', "New Session");
		this._register(this._button.onDidClick(() => this._showAgentDropdown()));

		// Loading indicator (hidden initially)
		this._loadingElement = dom.append(this.element, dom.$('.devswarm-welcome-loading'));
		this._loadingElement.style.display = 'none';
		const spinner = renderIcon(ThemeIcon.modify(Codicon.loading, 'spin'));
		this._loadingElement.appendChild(spinner);
		dom.append(this._loadingElement, dom.$('span', undefined, localize('devswarm.welcome.starting', "Starting session...")));

		// Subscribe to session state changes
		this._register(this._devswarmService.onDidChangeSessionState(state => {
			this._updateForState(state);
		}));

		this._updateForState(this._devswarmService.sessionState);
	}

	private _updateForState(state: DevSwarmSessionState): void {
		if (!this._button || !this._loadingElement) {
			return;
		}

		if (state === DevSwarmSessionState.Starting) {
			this._button.element.style.display = 'none';
			this._loadingElement.style.display = '';
		} else {
			this._button.element.style.display = '';
			this._loadingElement.style.display = 'none';
		}
	}

	private async _showAgentDropdown(): Promise<void> {
		const anchor = this._button?.element;
		if (!anchor) {
			return;
		}

		let installed: IDevSwarmAssistantMetadata[];
		let available: IDevSwarmAssistantMetadata[];

		try {
			const result = await this._commandService.executeCommand<{ installed: IDevSwarmAssistantMetadata[]; available: IDevSwarmAssistantMetadata[] }>('devswarm.chat.getAssistants');
			installed = result?.installed ?? [];
			available = result?.available ?? [];
		} catch {
			installed = this._devswarmService.getInstalledAssistants().filter(a => !a.isTestOnly);
			available = this._devswarmService.getAvailableAssistants().filter(a => !a.isTestOnly);
		}

		const items = this._buildDropdownItems(installed, available);

		const previouslyFocusedElement = dom.getActiveElement();

		const delegate = {
			onSelect: (action: IActionWidgetDropdownAction) => {
				this._actionWidgetService.hide();
				action.run();
			},
			onHide: (_didCancel?: boolean) => {
				if (dom.isHTMLElement(previouslyFocusedElement)) {
					previouslyFocusedElement.focus();
				}
			},
		};

		this._actionWidgetService.show(
			'DevSwarmSessionPicker',
			false,
			items,
			delegate,
			anchor,
			undefined,
			[],
			undefined,
			{ minWidth: 240 },
		);
	}

	private _buildDropdownItems(
		installed: IDevSwarmAssistantMetadata[],
		available: IDevSwarmAssistantMetadata[],
	): IActionListItem<IActionWidgetDropdownAction>[] {
		const items: IActionListItem<IActionWidgetDropdownAction>[] = [];

		if (installed.length) {
			items.push({
				kind: ActionListItemKind.Header,
				label: localize('devswarm.welcome.installed', "Installed"),
			});
			for (const agent of installed) {
				const terminalAction: IAction = {
					id: `terminal-${agent.id}`,
					label: '',
					tooltip: localize('devswarm.welcome.openTerminal', "Open in Terminal"),
					enabled: true,
					class: ThemeIcon.asClassName(Codicon.terminal),
					run: () => {
						this._commandService.executeCommand('devswarm.chat.spawnCliTerminal', agent.id);
					},
					dispose: () => { },
				};

				items.push({
					kind: ActionListItemKind.Action,
					label: agent.name,
					item: {
						id: `start-${agent.id}`,
						label: agent.name,
						enabled: true,
						class: undefined,
						tooltip: agent.name,
						run: () => {
							this._devswarmService.startSession(agent.id);
							this._onDidSelectAgent.fire(agent.id);
						},
						toolbarActions: [terminalAction],
					},
				});
			}
		}

		if (available.length) {
			items.push({
				kind: ActionListItemKind.Header,
				label: localize('devswarm.welcome.available', "Available"),
			});
			for (const agent of available) {
				items.push({
					kind: ActionListItemKind.Action,
					label: agent.name,
					item: {
						id: `install-${agent.id}`,
						label: agent.name,
						enabled: true,
						class: undefined,
						tooltip: agent.name,
						run: () => {
							// Install flow handled by extension
						},
						toolbarActions: [{
							id: `install-action-${agent.id}`,
							label: localize('devswarm.welcome.install', "Install"),
							enabled: true,
							class: undefined,
							tooltip: localize('devswarm.welcome.install', "Install"),
							run: () => { },
							dispose: () => { },
						}],
					},
				});
			}
		}

		return items;
	}
}
