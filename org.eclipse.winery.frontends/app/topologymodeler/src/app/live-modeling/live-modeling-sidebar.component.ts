/*******************************************************************************
 * Copyright (c) 2019 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the Apache Software License 2.0
 * which is available at https://www.apache.org/licenses/LICENSE-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR Apache-2.0
 *******************************************************************************/

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap';
import { Subscription } from 'rxjs';
import { NgRedux } from '@angular-redux/store';
import { IWineryState } from '../redux/store/winery.store';
import { LiveModelingStates, ReconfigureOptions, ServiceTemplateInstanceStates } from '../models/enums';
import { LiveModelingActions } from '../redux/actions/live-modeling.actions';
import { LiveModelingService } from '../services/live-modeling.service';
import { WineryActions } from '../redux/actions/winery.actions';
import { state, style, trigger } from '@angular/animations';
import { ResizeEvent } from 'angular-resizable-element';
import { EnableModalComponent } from './modals/enable-modal/enable-modal.component';
import { SettingsModalComponent } from './modals/settings-modal/settings-modal.component';
import { DisableModalComponent } from './modals/disable-modal/disable-modal.component';
import { ConfirmModalComponent } from './modals/confirm-modal/confirm-modal.component';
import { ReconfigureModalComponent } from './modals/reconfigure-modal/reconfigure-modal.component';

@Component({
    selector: 'winery-live-modeling-sidebar',
    templateUrl: './live-modeling-sidebar.component.html',
    styleUrls: ['./live-modeling-sidebar.component.css'],
    animations: [
        trigger('sidebarContentState', [
            state('shrunk', style({
                display: 'none'
            })),
            state('extended', style({
                display: 'block'
            }))
        ]),
        trigger('sidebarButtonState', [
            state('top', style({
                transform: 'rotate(0deg)'
            })),
            state('right', style({
                transform: 'rotate(90deg) translateY(-100%)'
            })),
        ])
    ]
})
export class LiveModelingSidebarComponent implements OnInit, OnDestroy {
    @Input() top: number;

    sidebarWidth: number;
    sidebarContentState = 'extended';
    sidebarButtonState = 'right';

    liveModelingState: LiveModelingStates;
    LiveModelingStates = LiveModelingStates;
    serviceTemplateInstanceId: string;
    serviceTemplateInstanceState: ServiceTemplateInstanceStates;
    currentCsarId: string;

    subscriptions: Array<Subscription> = [];

    modalRef: BsModalRef;

    unsavedChanges: boolean;
    deploymentChanges: boolean;

    showLogs = false;

    constructor(private ngRedux: NgRedux<IWineryState>,
                private wineryActions: WineryActions,
                private liveModelingActions: LiveModelingActions,
                private liveModelingService: LiveModelingService,
                private modalService: BsModalService) {
    }

    ngOnInit() {
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.liveModelingState.state)
            .subscribe(liveModelingState => {
                this.liveModelingState = liveModelingState;
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.liveModelingState.currentServiceTemplateInstanceId)
            .subscribe(serviceTemplateInstanceId => {
                this.serviceTemplateInstanceId = serviceTemplateInstanceId;
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.liveModelingState.currentServiceTemplateInstanceState)
            .subscribe(serviceTemplateInstanceState => {
                this.serviceTemplateInstanceState = serviceTemplateInstanceState;
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.wineryState.liveModelingSidebarOpenedState)
            .subscribe(sidebarOpened => {
                this.updateSidebarState(sidebarOpened);
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.wineryState.unsavedChanges)
            .subscribe(unsavedChanges => {
                this.unsavedChanges = unsavedChanges;
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.liveModelingState.deploymentChanges)
            .subscribe(deploymentChanges => {
                this.deploymentChanges = deploymentChanges;
            }));
        this.subscriptions.push(this.ngRedux.select(wineryState => wineryState.liveModelingState.currentCsarId)
            .subscribe(csarId => {
                this.currentCsarId = csarId;
            }));
    }

    handleEnable() {
        this.openModal(EnableModalComponent);
    }

    handleSettings() {
        this.openModal(SettingsModalComponent);
    }

    handleDisable() {
        this.openModal(DisableModalComponent);
    }

    async handleDeploy() {
        const resp = await this.openConfirmModal('Deploy new Instance', `Do you want to deploy a new instance of type ${this.currentCsarId}?`);
        if (resp) {
            this.liveModelingService.deploy();
        }
    }

    isDeployDisabled() {
        return this.serviceTemplateInstanceId || this.liveModelingState !== LiveModelingStates.TERMINATED || this.deploymentChanges;
    }

    async handleTerminate() {
        const resp = await this.openConfirmModal('Terminate Instance', 'Are you sure you want to terminate the instance?');
        if (resp) {
            this.liveModelingService.terminate();
        }
    }

    isTerminateDisabled() {
        return this.liveModelingState !== LiveModelingStates.ENABLED;
    }

    handleRefresh() {
        this.liveModelingService.update();
    }

    isRefreshDisabled() {
        return this.liveModelingState !== LiveModelingStates.ENABLED;
    }

    async handleReconfiguration() {
        const modalRef = this.modalService.show(ReconfigureModalComponent, { backdrop: 'static' });
        await new Promise(resolve => {
            const subscription = this.modalService.onHidden.subscribe(_ => {
                subscription.unsubscribe();
                resolve();
            });
        });

        if (modalRef.content.selectedOption !== ReconfigureOptions.NONE) {
            switch (modalRef.content.selectedOption) {
                case ReconfigureOptions.REDEPLOY: {
                    this.liveModelingService.redeploy();
                    return;
                }
                case ReconfigureOptions.TRANSFORM: {
                    this.liveModelingService.transform();
                    return;
                }
                case ReconfigureOptions.ADAPT: {
                    return;
                }
            }
        }
    }

    isReconfigurationDisabled() {
        return !(this.liveModelingState === LiveModelingStates.ENABLED &&
            !this.unsavedChanges &&
            this.deploymentChanges);
    }

    toggleLogs() {
        this.showLogs = !this.showLogs;
    }

    getBackgroundForState(serviceTemplateInstanceState: ServiceTemplateInstanceStates) {
        switch (serviceTemplateInstanceState) {
            case ServiceTemplateInstanceStates.DELETED:
            case ServiceTemplateInstanceStates.ERROR:
                return '#dc3545';
            case ServiceTemplateInstanceStates.DELETING:
            case ServiceTemplateInstanceStates.MIGRATING:
            case ServiceTemplateInstanceStates.CREATING:
                return '#007bff';
            case ServiceTemplateInstanceStates.MIGRATED:
            case ServiceTemplateInstanceStates.CREATED:
                return '#28a745';
            case ServiceTemplateInstanceStates.INITIAL:
            case ServiceTemplateInstanceStates.NOT_AVAILABLE:
            default:
                return '#6c757d';
        }
    }

    updateSidebarState(sidebarOpened: boolean) {
        if (sidebarOpened) {
            this.sidebarButtonState = 'top';
            this.sidebarContentState = 'extended';
        } else {
            this.sidebarButtonState = 'right';
            this.sidebarContentState = 'shrunk';
        }
    }

    toggleSidebarState() {
        if (this.sidebarContentState === 'shrunk') {
            this.ngRedux.dispatch(this.wineryActions.sendLiveModelingSidebarOpened(true));
        } else {
            this.ngRedux.dispatch(this.wineryActions.sendLiveModelingSidebarOpened(false));
        }
    }

    validateResize(event: ResizeEvent) {
        const SIDEBAR_MIN_WIDTH = 300;
        return event.rectangle.width >= SIDEBAR_MIN_WIDTH;
    }

    onResizeEnd(event: ResizeEvent): void {
        this.sidebarWidth = event.rectangle.width;
    }

    openModal(modal: any, options?: any) {
        const defaultConfig = { backdrop: 'static' };
        this.modalRef = this.modalService.show(modal, { ...defaultConfig, ...options });
    }

    async openConfirmModal(title: string, content: string): Promise<boolean> {
        const initialState = {
            title: title,
            content: content,
        };
        const modalRef = this.modalService.show(ConfirmModalComponent, { initialState, backdrop: 'static' });
        await new Promise(resolve => {
            const subscription = this.modalService.onHidden.subscribe(_ => {
                subscription.unsubscribe();
                resolve();
            });
        });

        return modalRef.content.confirmed;
    }

    dismissModal() {
        this.modalRef.hide();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }
}
