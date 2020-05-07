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

@Component({
    selector: 'winery-live-modeling-sidebar-node-template',
    templateUrl: './node-template.component.html',
    styleUrls: ['./node-template.component.css'],
})
export class NodeTemplateComponent implements OnInit, OnDestroy {

    subscriptions: Array<Subscription> = [];
    fetchingData = false;
    nodeTemplateInstance: {};
    nodeSubject = new Subject<string>();

    objectKeys = Object.keys;

    constructor(private ngRedux: NgRedux<IWineryState>,
                private liveModelingService: LiveModelingService) {
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
        this.nodeTemplateInstance = nodeTemplateInstance ? {
            Name: nodeTemplateInstance.node_template_id,
            Id: nodeTemplateInstance.id,
            State: nodeTemplateInstance.state
        } : null;
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }
}
