/*******************************************************************************
 * Copyright (c) 2020 Contributors to the Eclipse Foundation
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
import { Component, OnDestroy, OnInit, } from '@angular/core';
import { of, Subject, Subscription } from 'rxjs';
import { NgRedux } from '@angular-redux/store';
import { IWineryState } from '../../redux/store/winery.store';
import { NodeTemplateInstance } from '../../models/container/node-template-instance.model';
import { LiveModelingService } from '../../services/live-modeling.service';
import { distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { AdaptationAction, NodeTemplateInstanceStates } from '../../models/enums';
import { ConfirmModalComponent } from '../modals/confirm-modal/confirm-modal.component';
import { BsModalService } from 'ngx-bootstrap';
import { WineryActions } from '../../redux/actions/winery.actions';

@Component({
    selector: 'winery-live-modeling-sidebar-node-template',
    templateUrl: './node-template.component.html',
    styleUrls: ['./node-template.component.css'],
})
export class NodeTemplateComponent implements OnInit, OnDestroy {

    subscriptions: Array<Subscription> = [];
    fetchingData = false;
    nodeTemplateInstance: NodeTemplateInstance;
    NodeTemplateInstanceStates = NodeTemplateInstanceStates;
    nodeSubject = new Subject<string>();

    objectKeys = Object.keys;

    constructor(private ngRedux: NgRedux<IWineryState>,
                private liveModelingService: LiveModelingService,
                private modalService: BsModalService,
                private wineryActions: WineryActions) {
    }

    ngOnInit() {
        this.subscriptions.push(this.ngRedux.select(state => state.wineryState.sidebarContents)
            .subscribe(sidebarContents => {
                if (sidebarContents.nodeClicked && sidebarContents.id) {
                    this.nodeSubject.next(sidebarContents.id);
                } else {
                    this.nodeSubject.next(null);
                }
            }));

        this.subscriptions.push(this.nodeSubject.pipe(
            distinctUntilChanged(),
            tap(_ => this.fetchingData = true),
            switchMap(nodeId => {
                return nodeId ? this.liveModelingService.fetchNodeTemplateInstanceData(nodeId) : of(null);
            })
        ).subscribe(resp => {
            this.fetchingData = false;
            this.updateNodeInstanceData(resp);
        }));

    }

    private updateNodeInstanceData(nodeTemplateInstance: NodeTemplateInstance): void {
        this.nodeTemplateInstance = nodeTemplateInstance ? nodeTemplateInstance : null;
    }

    async handleStartNode() {
        const resp = await this.openConfirmModal(
            'Start Node Instance',
            `Are you sure you want to start this node instance ${this.nodeTemplateInstance.node_template_id}?
            This might affect other node instances' state too.`);
        if (resp) {
            this.liveModelingService.adapt(this.nodeTemplateInstance.node_template_id, AdaptationAction.START_NODE);
            this.unselectNodeTemplate();
        }
    }

    async handleStopNode() {
        const resp = await this.openConfirmModal(
            'Stop Node Instance',
            `Are you sure you want to stop the node instance ${this.nodeTemplateInstance.node_template_id}?
            This might affect other node instances' state too.`);
        if (resp) {
            this.liveModelingService.adapt(this.nodeTemplateInstance.node_template_id, AdaptationAction.STOP_NODE);
            this.unselectNodeTemplate();
        }
    }

    async openConfirmModal(title: string, content: string, showWarning = false): Promise<boolean> {
        const initialState = {
            title: title,
            content: content,
            showWarning: showWarning
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

    unselectNodeTemplate() {
        this.ngRedux.dispatch(this.wineryActions.openSidebar({
            sidebarContents: {
                sidebarVisible: false,
                nodeClicked: false,
                id: '',
                nameTextFieldValue: '',
                type: '',
                properties: '',
                source: '',
                target: ''
            }
        }));
        this.ngRedux.dispatch(this.wineryActions.sendPaletteOpened(false));
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }
}
