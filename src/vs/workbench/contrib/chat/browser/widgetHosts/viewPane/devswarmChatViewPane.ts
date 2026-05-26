/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Twenty Ideas, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../../../common/views.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { IChatService } from '../../../common/chatService/chatService.js';
import { IChatAgentService } from '../../../common/participants/chatAgents.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { IWorkbenchLayoutService } from '../../../../../services/layout/browser/layoutService.js';
import { IChatSessionsService } from '../../../common/chatSessionsService.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { ILifecycleService } from '../../../../../services/lifecycle/common/lifecycle.js';
import { IProgressService } from '../../../../../../platform/progress/common/progress.js';
import { IAgentSessionsService } from '../../agentSessions/agentSessionsService.js';
import { IChatEntitlementService } from '../../../../../services/chat/common/chatEntitlementService.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IActivityService } from '../../../../../services/activity/common/activity.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { IHostService } from '../../../../../services/host/browser/host.js';
import { IViewPaneOptions } from '../../../../../browser/parts/views/viewPane.js';
import { ChatWidget } from '../../widget/chatWidget.js';
import { DevSwarmChatWidget } from '../../widget/devswarmChatWidget.js';
import { ChatViewPane } from './chatViewPane.js';

export class DevSwarmChatViewPane extends ChatViewPane {

	protected override getChatWidgetCtor(): typeof ChatWidget {
		return DevSwarmChatWidget;
	}

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService storageService: IStorageService,
		@IChatService chatService: IChatService,
		@IChatAgentService chatAgentService: IChatAgentService,
		@ILogService logService: ILogService,
		@INotificationService notificationService: INotificationService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IChatSessionsService chatSessionsService: IChatSessionsService,
		@ITelemetryService telemetryService: ITelemetryService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IProgressService progressService: IProgressService,
		@IAgentSessionsService agentSessionsService: IAgentSessionsService,
		@IChatEntitlementService chatEntitlementService: IChatEntitlementService,
		@ICommandService commandService: ICommandService,
		@IActivityService activityService: IActivityService,
		@IWorkbenchEnvironmentService workbenchEnvironmentService: IWorkbenchEnvironmentService,
		@IHostService hostService: IHostService,
	) {
		super(
			options,
			keybindingService,
			contextMenuService,
			configurationService,
			contextKeyService,
			viewDescriptorService,
			instantiationService,
			openerService,
			themeService,
			hoverService,
			storageService,
			chatService,
			chatAgentService,
			logService,
			notificationService,
			layoutService,
			chatSessionsService,
			telemetryService,
			lifecycleService,
			progressService,
			agentSessionsService,
			chatEntitlementService,
			commandService,
			activityService,
			workbenchEnvironmentService,
			hostService,
		);
	}
}
