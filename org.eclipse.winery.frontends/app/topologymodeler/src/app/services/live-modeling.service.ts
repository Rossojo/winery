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

import { Injectable } from '@angular/core';
import { NgRedux } from '@angular-redux/store';
import { IWineryState } from '../redux/store/winery.store';
import { TopologyRendererActions } from '../redux/actions/topologyRenderer.actions';
import { LiveModelingStates, NodeTemplateInstanceStates, ServiceTemplateInstanceStates } from '../models/enums';
import { BackendService } from './backend.service';
import { CsarUpload } from '../models/container/csar-upload.model';
import { ContainerService } from './container.service';
import { ErrorHandlerService } from './error-handler.service';
import { TTopologyTemplate } from '../models/ttopology-template';
import { LiveModelingActions } from '../redux/actions/live-modeling.actions';
import { WineryActions } from '../redux/actions/winery.actions';
import { BsModalService } from 'ngx-bootstrap';
import { OverlayService } from './overlay.service';
import { TopologyService } from './topology.service';
import { LoggingService } from './logging.service';
import { catchError, concatMap, distinctUntilChanged, takeWhile, timeout } from 'rxjs/operators';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { Csar } from '../models/container/csar.model';
import { PlanInstance } from '../models/container/plan-instance.model';
import { InputParameter } from '../models/container/input-parameter.model';
import { InputParametersModalComponent } from '../live-modeling/modals/input-parameters-modal/input-parameters-modal.component';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class LiveModelingService {
    private currentCsarId: string;
    private currentServiceTemplateInstanceId: string;

    private pollInterval: number;
    private pollTimeout: number;

    private currentTopologyTemplate: TTopologyTemplate;
    private lastSavedTopologyTemplate: TTopologyTemplate;
    private deployedTopologyTemplate: TTopologyTemplate;

    private readonly csarEnding = '.csar';
    private state: LiveModelingStates;

    constructor(
        private ngRedux: NgRedux<IWineryState>,
        private liveModelingActions: LiveModelingActions,
        private topologyRendererActions: TopologyRendererActions,
        private wineryActions: WineryActions,
        private containerService: ContainerService,
        private backendService: BackendService,
        private errorHandler: ErrorHandlerService,
        private modalService: BsModalService,
        private overlayService: OverlayService,
        private topologyService: TopologyService,
        private loggingService: LoggingService,
        private toastrService: ToastrService) {

        this.ngRedux.select(state => state.liveModelingState.settings).subscribe(settings => {
            this.pollInterval = settings.interval;
            this.pollTimeout = settings.timeout;
        });

        this.ngRedux.select(state => state.liveModelingState.state)
            .subscribe(state => this.state = state);

        this.ngRedux.select(state => state.wineryState.currentJsonTopology)
            .subscribe(topologyTemplate => {
                this.currentTopologyTemplate = topologyTemplate;
            });

        this.ngRedux.select(state => state.wineryState.lastSavedJsonTopology)
            .subscribe(topologyTemplate => {
                this.lastSavedTopologyTemplate = topologyTemplate;
            });

        this.ngRedux.select(state => state.liveModelingState.deployedJsonTopology)
            .subscribe(topologyTemplate => {
                this.deployedTopologyTemplate = topologyTemplate;
            });

        this.ngRedux.select(state => state.liveModelingState.currentServiceTemplateInstanceId)
            .subscribe(serviceTemplateInstanceId => {
                this.currentServiceTemplateInstanceId = serviceTemplateInstanceId;
            });

        this.ngRedux.select(state => state.liveModelingState.currentCsarId)
            .subscribe(csarId => {
                this.currentCsarId = csarId;
            });
    }

    public async enable(containerUrl: string): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.DISABLED) {
                return;
            }
            // clear data from previous iteration
            this.clearData();
            // set container url
            this.ngRedux.dispatch(this.liveModelingActions.setContainerUrl(containerUrl));
            // set to init state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.INIT));
            // create live modeling template
            const csarId = await this.createLiveModelingServiceTemplate();
            // Upload csar to container
            await this.installCsarIfNeeded(csarId);
            // Set current csar
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(csarId));
            // retrieve build plan parameters
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(csarId);
            // set to deploy state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DEPLOY));
            // Deploy service template instance
            const newInstanceId = await this.deployServiceTemplateInstance(csarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));
            // set last deployed topology
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(this.currentTopologyTemplate));
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            // refresh
            await this.updateLiveModelingData(csarId, newInstanceId);
            // set to enabled
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public async update(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            // refresh
            await this.updateLiveModelingData(this.currentCsarId, this.currentServiceTemplateInstanceId);
            // set to enabled
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public async deploy(): Promise<void> {
        try {
            // check for enabled state
            if (this.state !== LiveModelingStates.TERMINATED) {
                return;
            }
            // set to deploy state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DEPLOY));
            // retrieve build plan parameters
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(this.currentCsarId);
            // Deploy service template instance
            const newInstanceId = await this.deployServiceTemplateInstance(this.currentCsarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            // refresh
            await this.updateLiveModelingData(this.currentCsarId, newInstanceId);
            // set to enabled
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public async redeploy(): Promise<void> {
        try {
            // check for enabled state
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            // set to reconfigurate state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.RECONFIGURATE));
            // terminate old instance
            this.terminateServiceTemplateInstanceInBackground(this.currentCsarId, this.currentServiceTemplateInstanceId);
            // create live modeling template
            const csarId = await this.createLiveModelingServiceTemplate();
            // Upload csar to container
            await this.installCsarIfNeeded(csarId);
            // Set current csar
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(csarId));
            // retrieve build plan parameters
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(csarId);
            // Deploy service template instance
            const newInstanceId = await this.deployServiceTemplateInstance(csarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));
            // set last deployed topology
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(this.currentTopologyTemplate));
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            // refresh
            await this.updateLiveModelingData(csarId, newInstanceId);
            // set to enabled
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public async transform(): Promise<void> {
        try {
            // check for enabled state
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.RECONFIGURATE));
            // transform
            const sourceCsarId = this.currentCsarId;
            // create live-modeling csar
            const targetCsarId = await this.createLiveModelingServiceTemplate();
            // upload target csar
            await this.installCsarIfNeeded(targetCsarId);
            // generate transformation plan
            this.overlayService.showOverlay('Generating transformation plan');
            const transformationPlanId = await this.containerService.generateTransformationPlan(sourceCsarId, targetCsarId).toPromise();
            this.overlayService.hideOverlay();
            // execute transformation plan
            const parameterPayload = await this.retrieveTransformPlanParametersAndShowModalIfNeeded(
                sourceCsarId, this.currentServiceTemplateInstanceId, transformationPlanId);
            const newInstanceId = await this.transformServiceTemplateInstance(
                sourceCsarId, targetCsarId, this.currentServiceTemplateInstanceId, parameterPayload);
            // update data
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(targetCsarId));
            // set last deployed topology
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(this.currentTopologyTemplate));
            // set to update state
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            // refresh
            await this.updateLiveModelingData(targetCsarId, newInstanceId);
            // set to enabled
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public async terminate(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.TERMINATE));
            await this.terminateServiceTemplateInstance(this.currentCsarId, this.currentServiceTemplateInstanceId);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.TERMINATED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    public disable(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED && this.state !== LiveModelingStates.TERMINATED) {
                return;
            }
            if (this.state === LiveModelingStates.ENABLED && this.currentServiceTemplateInstanceId) {
                this.terminateServiceTemplateInstanceInBackground(this.currentCsarId, this.currentServiceTemplateInstanceId);
            }
            this.deinitializeLiveModelingData();
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DISABLED));
        } catch (error) {
            this.loggingService.logError(error.message);
            this.handleError();
        }
    }

    private clearData(): void {
        this.loggingService.clearLogs();
    }

    private async createLiveModelingServiceTemplate(): Promise<string> {
        try {
            this.overlayService.showOverlay('Creating temporary live modeling template');
            const resp = await this.backendService.createLiveModelingServiceTemplate().toPromise();
            this.overlayService.hideOverlay();
            return this.normalizeCsarId(resp.localname);
        } catch (_) {
            throw new Error('There was an error while creating a temporary service template');
        }
    }

    private async installCsarIfNeeded(csarId: string): Promise<void> {
        try {
            this.overlayService.showOverlay('Checking whether CSAR file is present');
            const appInstalled = await this.containerService.isApplicationInstalled(csarId).toPromise();
            if (!appInstalled) {
                this.loggingService.logWarning('App not found, installing now...');
                this.overlayService.showOverlay('Uploading CSAR file to container');
                const uploadPayload = new CsarUpload(this.getCsarResourceUrl(csarId), csarId, 'false');
                await this.containerService.installApplication(uploadPayload).toPromise();
            } else {
                this.loggingService.logInfo('App found. Skipping installation');
            }
            this.overlayService.hideOverlay();
        } catch (_) {
            throw Error('There was an error while uploading the csar to the container');
        }
    }

    private async retrieveBuildPlanParametersAndShowModalIfNeeded(csarId: string): Promise<InputParameter[]> {
        try {
            const requiredBuildPlanInputParameters = await this.containerService.getRequiredBuildPlanInputParameters(csarId).toPromise();
            let buildPlanInputParameters = [];
            if (requiredBuildPlanInputParameters.length > 0) {
                buildPlanInputParameters = await this.requestInputParameters(requiredBuildPlanInputParameters);
            }
            return buildPlanInputParameters;
        } catch (error) {
            throw Error('There was an error while retrieving the build plan parameters');
        }
    }

    private async retrieveTransformPlanParametersAndShowModalIfNeeded(
        csarId: string, serviceTemplateInstanceId: string, transformationPlanId: string): Promise<InputParameter[]> {
        try {
            const inputParameters = await this.containerService.getManagementPlanInputParameters(
                csarId,
                serviceTemplateInstanceId,
                transformationPlanId
            ).toPromise();

            let parameterPayload = [];
            if (inputParameters.length > 0) {
                parameterPayload = await this.requestInputParameters(inputParameters);
            }

            return parameterPayload;
        } catch (error) {
            throw Error('There was an error while retrieving the management plan parameters');
        }
    }

    private async deployServiceTemplateInstance(csarId: string, buildPlanInputParameters: InputParameter[]): Promise<string> {
        let correlationId;
        try {
            this.setAllNodeTemplateInstanceState(NodeTemplateInstanceStates.INITIAL);
            this.setAllNodeTemplateWorkingState(true);

            this.loggingService.logInfo('Deploying service template instance...');

            correlationId = await this.containerService.deployServiceTemplateInstance(csarId, buildPlanInputParameters).toPromise();

            this.loggingService.logInfo('Executing build plan with correlation id ' + correlationId);

            const newInstanceId = await this.containerService.waitForServiceTemplateInstanceIdAfterDeployment(
                csarId,
                correlationId,
                this.pollInterval,
                this.pollTimeout
            ).toPromise();

            this.loggingService.logInfo('Waiting for deployment of service template instance with id ' + newInstanceId);

            await this.waitUntilInstanceIsInState(csarId, newInstanceId, ServiceTemplateInstanceStates.CREATED);

            this.setAllNodeTemplateWorkingState(false);
            this.loggingService.logSuccess('Successfully deployed service template instance with Id ' + newInstanceId);
            return newInstanceId;
        } catch (error) {
            throw Error('There was an error while deploying service template instance');
        } finally {
            try {
                const buildPlanLogs = await this.containerService.getBuildPlanLogs(csarId, correlationId).toPromise();
                for (const log of buildPlanLogs) {
                    this.loggingService.logContainer(log.message);
                }
            } catch (e) {
            }
        }
    }

    private async transformServiceTemplateInstance(
        sourceCsarId: string, targetCsarId: string, serviceTemplateInstanceId: string, transformationPayload: InputParameter[]): Promise<string> {
        let correlationId;
        try {
            this.setAllNodeTemplateInstanceState(NodeTemplateInstanceStates.INITIAL);
            this.setAllNodeTemplateWorkingState(true);
            const prevServiceTemplateInstanceId = serviceTemplateInstanceId;

            this.loggingService.logInfo('Transforming service template instance...');
            correlationId = await this.containerService.executeTransformationPlan(
                serviceTemplateInstanceId, sourceCsarId, targetCsarId, transformationPayload).toPromise();

            this.loggingService.logInfo('Executing transformation plan with correlation id ' + correlationId);

            await this.waitUntilInstanceIsInState(sourceCsarId, serviceTemplateInstanceId, ServiceTemplateInstanceStates.MIGRATED);

            const newInstanceId = await this.containerService.waitForServiceTemplateInstanceIdAfterMigration(
                sourceCsarId, serviceTemplateInstanceId, correlationId, sourceCsarId, targetCsarId, this.pollInterval, this.pollTimeout).toPromise();

            this.loggingService.logInfo('Waiting for transformation of service template instance with id ' + newInstanceId);

            await this.waitUntilInstanceIsInState(targetCsarId, newInstanceId, ServiceTemplateInstanceStates.CREATED);

            this.setAllNodeTemplateWorkingState(false);
            this.loggingService.logSuccess(`Successfully transformed service template instance from ${prevServiceTemplateInstanceId} to ${newInstanceId}`);
            return newInstanceId;
        } catch (error) {
            throw Error('There was an error while transforming service template instance');
        } finally {
            try {
                const transformationPlanLogs = await this.containerService.getTransformationPlanLogs(
                    sourceCsarId, serviceTemplateInstanceId, correlationId, sourceCsarId, targetCsarId).toPromise();
                for (const log of transformationPlanLogs) {
                    this.loggingService.logContainer(log.message);
                }
            } catch (e) {
            }
        }
    }

    private handleError(): void {
        this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ERROR));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(ServiceTemplateInstanceStates.ERROR));
        this.overlayService.hideOverlay();
        this.setAllNodeTemplateWorkingState(false);
    }

    // ------------------- HELPER METHODS -------------------------

    private getCsarResourceUrl(csarId: string): string {
        const csarQueryString = '?csar';
        return this.backendService.configuration.repositoryURL + '/' +
            this.backendService.configuration.parentPath + '/' +
            encodeURIComponent(encodeURIComponent(this.backendService.configuration.ns)) + '/' +
            this.stripCsarSuffix(csarId) + csarQueryString;
    }

    private normalizeCsarId(csarId: string): string {
        return csarId.endsWith(this.csarEnding) ? csarId : csarId + this.csarEnding;
    }

    private stripCsarSuffix(csarId: string): string {
        return csarId.endsWith(this.csarEnding) ? csarId.slice(0, -this.csarEnding.length) : csarId;
    }

    private setAllNodeTemplateInstanceState(state: NodeTemplateInstanceStates): void {
        for (const nodeTemplate of this.lastSavedTopologyTemplate.nodeTemplates) {
            this.ngRedux.dispatch(this.wineryActions.setNodeInstanceState(nodeTemplate.id, state));
        }
    }

    private setAllNodeTemplateWorkingState(working: boolean): void {
        for (const nodeTemplate of this.lastSavedTopologyTemplate.nodeTemplates) {
            this.ngRedux.dispatch(this.wineryActions.setNodeWorking(nodeTemplate.id, working));
        }
    }

    private updateLiveModelingData(csarId: string, serviceTemplateInstanceId: string): Subscription {
        this.setAllNodeTemplateWorkingState(true);
        return forkJoin([
            this.updateCsar(csarId),
            this.updateBuildPlanInstance(csarId, serviceTemplateInstanceId),
            this.updateCurrentServiceTemplateInstanceState(csarId, serviceTemplateInstanceId),
            this.updateNodeTemplateData(csarId, serviceTemplateInstanceId)
        ]).subscribe(responses => {
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsar(responses[0]));
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentBuildPlanInstance(responses[1]));
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(responses[2]));

            for (let i = 0; i < responses[3].length; i++) {
                this.ngRedux.dispatch(this.wineryActions.setNodeInstanceState(this.deployedTopologyTemplate.nodeTemplates[i].id, responses[3][i]));
            }
            this.setAllNodeTemplateWorkingState(false);
        });
    }

    private updateCsar(csarId: string): Observable<Csar> {
        this.loggingService.logInfo('Fetching csar information');
        return this.containerService.getCsar(csarId).pipe(
            catchError(_ => {
                this.loggingService.logError('Unable to fetch csar information');
                return of(null);
            })
        );
    }

    private updateBuildPlanInstance(csarId: string, serviceTemplateInstanceId: string): Observable<PlanInstance> {
        this.loggingService.logInfo(`Fetching service template instance build plan instance`);
        return this.containerService.getServiceTemplateInstanceBuildPlanInstance(csarId, serviceTemplateInstanceId).pipe(
            catchError(_ => {
                this.loggingService.logError('Unable to fetch build plan instance');
                return of(null);
            })
        );
    }

    private updateNodeTemplateData(csarId: string, serviceTemplateInstanceId: string): Observable<NodeTemplateInstanceStates[]> {
        const observables: Observable<NodeTemplateInstanceStates>[] = [];
        for (const nodeTemplate of this.deployedTopologyTemplate.nodeTemplates) {
            observables.push(this.containerService.getNodeTemplateInstanceState(
                csarId, serviceTemplateInstanceId, nodeTemplate.id).pipe(
                catchError(_ => {
                    this.loggingService.logError(`Unable to fetch data for node ${nodeTemplate.id}`);
                    return of(NodeTemplateInstanceStates.NOT_AVAILABLE);
                })
            ));
        }
        return forkJoin(observables);
    }

    private updateCurrentServiceTemplateInstanceState(csarId: string, serviceTemplateInstanceId: string): Observable<ServiceTemplateInstanceStates> {
        this.loggingService.logInfo(`Fetching service template instance state`);
        return this.containerService.getServiceTemplateInstanceState(csarId, serviceTemplateInstanceId).pipe(
            catchError(_ => {
                this.loggingService.logError('Unable to fetch service template instance state');
                return of(ServiceTemplateInstanceStates.NOT_AVAILABLE);
            })
        );
    }

    private async terminateServiceTemplateInstance(csarId: string, serviceTemplateInstanceId: string): Promise<void> {
        try {
            this.setAllNodeTemplateWorkingState(true);

            this.loggingService.logInfo(`Terminating service template instance ${serviceTemplateInstanceId}`);

            await this.containerService.terminateServiceTemplateInstance(csarId, serviceTemplateInstanceId).toPromise();

            this.loggingService.logInfo(`Waiting for deletion of service template instance with instance id ${serviceTemplateInstanceId}`);

            await this.waitUntilInstanceIsInState(csarId, serviceTemplateInstanceId, ServiceTemplateInstanceStates.DELETED);

            this.setAllNodeTemplateWorkingState(false);
            this.setAllNodeTemplateInstanceState(null);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(null));

            this.loggingService.logSuccess('Instance has been successfully deleted');
        } catch (error) {
            throw Error('There was an error while terminating the service template instance');
        }
    }

    private terminateServiceTemplateInstanceInBackground(csarId: string, serviceTemplateInstanceId: string): void {
        try {
            this.containerService.terminateServiceTemplateInstance(csarId, serviceTemplateInstanceId).subscribe(_ => {
                this.toastrService.info('Instance successfully terminated');
                this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(ServiceTemplateInstanceStates.DELETED));
            });
            this.setAllNodeTemplateInstanceState(null);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(null));
        } catch (error) {
            this.toastrService.error('There was an error while terminating the service template instance');
        }
    }

    private async requestInputParameters(inputParameters: InputParameter[]): Promise<InputParameter[]> {
        const initialState = {
            inputParameters: inputParameters
        };
        const modalRef = this.modalService.show(InputParametersModalComponent, { initialState, backdrop: 'static' });
        await new Promise(resolve => {
            this.modalService.onHidden.subscribe(_ => {
                resolve();
            });
        });

        if (modalRef.content.cancelled) {
            return null;
        }

        return modalRef.content.inputParameters;
    }

    private waitUntilInstanceIsInState(csarId: string, serviceTemplateInstanceId: string, desiredInstanceState: ServiceTemplateInstanceStates): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            Observable.timer(0, this.pollInterval).pipe(
                concatMap(() => this.containerService.getServiceTemplateInstanceState(csarId, serviceTemplateInstanceId)),
                distinctUntilChanged(),
                timeout(this.pollTimeout),
                takeWhile(state => state !== desiredInstanceState && state !== ServiceTemplateInstanceStates.ERROR, true),
            ).subscribe(state => {
                this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(state));
                if (state === ServiceTemplateInstanceStates.ERROR) {
                    reject(new Error('There was an error during the operation'));
                }
            }, () => {
                this.loggingService.logError('There was an error while polling service template state');
                reject(new Error('Timeout when waiting for instance state'));
            }, () => {
                resolve();
            });
        });
    }

    private deinitializeLiveModelingData(): void {
        this.ngRedux.dispatch(this.liveModelingActions.setContainerUrl(null));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsar(null));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(null));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(null));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(null));
        this.ngRedux.dispatch(this.liveModelingActions.setCurrentBuildPlanInstance(null));
        this.setAllNodeTemplateWorkingState(false);
        this.setAllNodeTemplateInstanceState(null);
    }

    /*
    public async startNode(nodeTemplateId: string) {
        const adaptationArray = this.calculateAdaptationArray(nodeTemplateId, NodeTemplateInstanceStates.STARTED);
        await this.setNodeTemplateInstanceStates(adaptationArray);
        this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
    }

    public async stopNode(nodeTemplateId: string) {
        const adaptationArray = this.calculateAdaptationArray(nodeTemplateId, NodeTemplateInstanceStates.STOPPED);
        await this.setNodeTemplateInstanceStates(adaptationArray);
        this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
    }

    private calculateAdaptationArray(
        nodeTemplateId: string,
        targetNodeTemplateInstanceState: NodeTemplateInstanceStates): Array<[string, NodeTemplateInstanceStates]> {
        const topologyTemplate = { ...this.topologyService.lastSavedJsonTopology };
        const requiredSet: Set<string> = new Set<string>();
        const workingArray: Array<string> = [];
        const workingRel: Array<TRelationshipTemplate> = [...topologyTemplate.relationshipTemplates];
        workingArray.push(nodeTemplateId);

        // recursively calculate all nodes that depend on the source node
        while (workingArray.length > 0) {
            const nodeId = workingArray.shift();
            requiredSet.add(nodeId);
            let tempRelationships: TRelationshipTemplate[];
            if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STARTED) {
                tempRelationships = workingRel.filter(rel => rel.sourceElement.ref === nodeId);
            } else if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STOPPED) {
                tempRelationships = workingRel.filter(rel => rel.targetElement.ref === nodeId);
            }
            for (const tempRel of tempRelationships) {
                if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STARTED) {
                    workingArray.push(tempRel.targetElement.ref);
                } else if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STOPPED) {
                    workingArray.push(tempRel.sourceElement.ref);
                }
            }
        }

        // find all other nodes that are already in the same target state (so we do not start/stop nodes that are independent from the source node)
        const requiredNodes = Array.from(requiredSet);
        const currentNodes = this.topologyService.lastSavedJsonTopology.nodeTemplates.filter(node =>
            node.instanceState === targetNodeTemplateInstanceState).map(node => node.id);
        const mergeArray = Array.from(new Set(requiredNodes.concat(...currentNodes)));
        const adaptationArray: Array<[string, NodeTemplateInstanceStates]> = [];

        // calculate adaptation set which contains all nodes with their respective target state
        for (const nodeTemplate of topologyTemplate.nodeTemplates) {
            if (mergeArray.indexOf(nodeTemplate.id) > -1) {
                adaptationArray.push([nodeTemplate.id, targetNodeTemplateInstanceState]);
            } else {
                if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STARTED) {
                    adaptationArray.push([nodeTemplate.id, NodeTemplateInstanceStates.STOPPED]);
                } else if (targetNodeTemplateInstanceState === NodeTemplateInstanceStates.STOPPED) {
                    adaptationArray.push([nodeTemplate.id, NodeTemplateInstanceStates.STARTED]);
                }
            }
        }

        return adaptationArray;
    }

    private async setNodeTemplateInstanceStates(adaptationArray: Array<[string, NodeTemplateInstanceStates]>) {
        for (const nodeTemplate of adaptationArray) {
            await this.containerService.updateNodeTemplateInstanceState(
                nodeTemplate[0],
                nodeTemplate[1]
            ).toPromise();
        }
    }
     */
}
