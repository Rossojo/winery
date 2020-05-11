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
import { LoggingService } from './logging.service';
import { catchError, concatMap, distinctUntilChanged, switchMap, takeWhile, tap, timeout } from 'rxjs/operators';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { Csar } from '../models/container/csar.model';
import { PlanInstance } from '../models/container/plan-instance.model';
import { InputParameter } from '../models/container/input-parameter.model';
import { InputParametersModalComponent } from '../live-modeling/modals/input-parameters-modal/input-parameters-modal.component';
import { ToastrService } from 'ngx-toastr';
import { NodeTemplateInstance } from '../models/container/node-template-instance.model';
import {
    CreateLiveModelingTemplateError, DeployInstanceError, LiveModelingError, RetrieveInputParametersError, TerminateInstanceError, TransformInstanceError,
    UploadCsarError
} from '../models/customErrors';

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
        private wineryActions: WineryActions,
        private containerService: ContainerService,
        private backendService: BackendService,
        private errorHandler: ErrorHandlerService,
        private modalService: BsModalService,
        private overlayService: OverlayService,
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
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.INIT));
            const topologyTemplate = this.currentTopologyTemplate;
            this.clearData();
            this.setAllNodeTemplateWorkingState(true);
            this.ngRedux.dispatch(this.liveModelingActions.setContainerUrl(containerUrl));
            const csarId = await this.createLiveModelingServiceTemplate();
            await this.installCsarIfNeeded(csarId);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(csarId));
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(csarId);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DEPLOY));
            const newInstanceId = await this.deployServiceTemplateInstance(csarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(topologyTemplate));
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            await this.updateLiveModelingData(csarId, newInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public async update(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            this.setAllNodeTemplateWorkingState(true);
            await this.updateLiveModelingData(this.currentCsarId, this.currentServiceTemplateInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public async deploy(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.TERMINATED) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DEPLOY));
            const currentCsarId = this.currentCsarId;
            this.setAllNodeTemplateWorkingState(true);
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(currentCsarId);
            const newInstanceId = await this.deployServiceTemplateInstance(currentCsarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            await this.updateLiveModelingData(currentCsarId, newInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public async redeploy(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED && this.state !== LiveModelingStates.ERROR) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.RECONFIGURATE));
            const oldCsarId = this.currentCsarId;
            const oldInstanceId = this.currentServiceTemplateInstanceId;
            const topologyTemplate = this.currentTopologyTemplate;
            this.setAllNodeTemplateWorkingState(true);
            this.terminateServiceTemplateInstanceInBackground(oldCsarId, oldInstanceId).add(() => {
                this.deleteApplicationInBackground(oldCsarId);
            });
            const newCsarId = await this.createLiveModelingServiceTemplate();
            await this.installCsarIfNeeded(newCsarId);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(newCsarId));
            const buildPlanInputParameters = await this.retrieveBuildPlanParametersAndShowModalIfNeeded(newCsarId);
            const newInstanceId = await this.deployServiceTemplateInstance(newCsarId, buildPlanInputParameters);
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(topologyTemplate));
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            await this.updateLiveModelingData(newCsarId, newInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public async transform(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.RECONFIGURATE));
            this.setAllNodeTemplateWorkingState(true);
            const sourceCsarId = this.currentCsarId;
            const oldInstanceId = this.currentServiceTemplateInstanceId;
            const topologyTemplate = this.currentTopologyTemplate;
            const targetCsarId = await this.createLiveModelingServiceTemplate();
            await this.installCsarIfNeeded(targetCsarId);
            const transformationPlanId = await this.containerService.generateTransformationPlan(sourceCsarId, targetCsarId).toPromise();
            const parameterPayload = await this.retrieveTransformPlanParametersAndShowModalIfNeeded(
                sourceCsarId, oldInstanceId, transformationPlanId);
            const newInstanceId = await this.transformServiceTemplateInstance(
                sourceCsarId, targetCsarId, oldInstanceId, parameterPayload);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsarId(targetCsarId));
            this.ngRedux.dispatch(this.liveModelingActions.setDeployedJsonTopology(topologyTemplate));
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.UPDATE));
            await this.updateLiveModelingData(targetCsarId, newInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.ENABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public async terminate(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED) {
                return;
            }
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.TERMINATE));
            this.setAllNodeTemplateWorkingState(true);
            await this.terminateServiceTemplateInstance(this.currentCsarId, this.currentServiceTemplateInstanceId);
            this.setAllNodeTemplateWorkingState(false);
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.TERMINATED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public disable(): Promise<void> {
        try {
            if (this.state !== LiveModelingStates.ENABLED && this.state !== LiveModelingStates.TERMINATED && this.state !== LiveModelingStates.ERROR) {
                return;
            }
            const csarId = this.currentCsarId;
            const instanceId = this.currentServiceTemplateInstanceId;
            if (this.state === LiveModelingStates.ENABLED && instanceId) {
                this.terminateServiceTemplateInstanceInBackground(csarId, instanceId).add(() => {
                    this.deleteApplicationInBackground(csarId);
                });
            } else {
                this.deleteApplicationInBackground(csarId);
            }
            this.deinitializeLiveModelingData();
            this.ngRedux.dispatch(this.liveModelingActions.setState(LiveModelingStates.DISABLED));
        } catch (error) {
            this.handleError(error);
        }
    }

    public fetchNodeTemplateInstanceData(nodeTemplateId: string): Observable<NodeTemplateInstance> {
        try {
            if (this.state === LiveModelingStates.DISABLED) {
                return of(null);
            }
            return this.containerService.getNodeTemplateInstance(this.currentCsarId, this.currentServiceTemplateInstanceId, nodeTemplateId).pipe(
                catchError(_ => {
                    this.loggingService.logError('Unable to fetch node template instance');
                    return of(null);
                })
            );
        } catch (error) {
            return of(null);
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
            throw new CreateLiveModelingTemplateError();
        }
    }

    private async installCsarIfNeeded(csarId: string): Promise<void> {
        try {
            const appInstalled = await this.containerService.isApplicationInstalled(csarId).toPromise();
            if (!appInstalled) {
                this.loggingService.logWarning('App not found, installing now...');
                const uploadPayload = new CsarUpload(this.getCsarResourceUrl(csarId), csarId, 'false');
                await this.containerService.installApplication(uploadPayload).toPromise();
            } else {
                this.loggingService.logInfo('App found. Skipping installation');
            }
        } catch (_) {
            throw new UploadCsarError();
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
            throw new RetrieveInputParametersError();
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
            throw new RetrieveInputParametersError();
        }
    }

    private async deployServiceTemplateInstance(csarId: string, buildPlanInputParameters: InputParameter[]): Promise<string> {
        let correlationId;
        try {
            this.setAllNodeTemplateInstanceState(NodeTemplateInstanceStates.INITIAL);

            this.loggingService.logInfo('Deploying service template instance...');

            correlationId = await this.containerService.deployServiceTemplateInstance(csarId, buildPlanInputParameters).toPromise();

            this.loggingService.logInfo('Executing build plan with correlation id ' + correlationId);

            const newInstanceId = await this.containerService.waitForServiceTemplateInstanceIdAfterDeployment(
                csarId,
                correlationId,
                this.pollInterval,
                this.pollTimeout
            ).toPromise();
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));

            this.loggingService.logInfo('Waiting for deployment of service template instance with id ' + newInstanceId);

            await this.waitUntilInstanceIsInState(csarId, newInstanceId, ServiceTemplateInstanceStates.CREATED);

            this.loggingService.logSuccess('Successfully deployed service template instance with Id ' + newInstanceId);
            return newInstanceId;
        } catch (error) {
            throw new DeployInstanceError();
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
            const prevServiceTemplateInstanceId = serviceTemplateInstanceId;

            this.loggingService.logInfo('Transforming service template instance...');
            correlationId = await this.containerService.executeTransformationPlan(
                serviceTemplateInstanceId, sourceCsarId, targetCsarId, transformationPayload).toPromise();

            this.loggingService.logInfo('Executing transformation plan with correlation id ' + correlationId);

            await this.waitUntilInstanceIsInState(sourceCsarId, serviceTemplateInstanceId, ServiceTemplateInstanceStates.MIGRATED);

            const newInstanceId = await this.containerService.waitForServiceTemplateInstanceIdAfterMigration(
                sourceCsarId, serviceTemplateInstanceId, correlationId, sourceCsarId, targetCsarId, this.pollInterval, this.pollTimeout).toPromise();

            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(newInstanceId));
            this.loggingService.logInfo('Waiting for transformation of service template instance with id ' + newInstanceId);

            await this.waitUntilInstanceIsInState(targetCsarId, newInstanceId, ServiceTemplateInstanceStates.CREATED);

            this.loggingService.logSuccess(`Successfully transformed service template instance from ${prevServiceTemplateInstanceId} to ${newInstanceId}`);
            return newInstanceId;
        } catch (error) {
            throw new TransformInstanceError();
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

    private handleError(error: Error): void {
        this.updateLiveModelingData(this.currentCsarId, this.currentServiceTemplateInstanceId);

        if (error instanceof LiveModelingError) {
            this.toastrService.error(error.message);
            this.loggingService.logError(error.message);
        } else {
            const errorMessage = 'There was an unexpected error during operation';
            this.toastrService.error(errorMessage);
            this.loggingService.logError(errorMessage);
        }

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

    private updateLiveModelingData(csarId: string, serviceTemplateInstanceId: string): Promise<any> {
        return forkJoin([
            this.updateCsar(csarId)
                .pipe(tap(resp => this.ngRedux.dispatch(this.liveModelingActions.setCurrentCsar(resp)))),
            this.updateBuildPlanInstance(csarId, serviceTemplateInstanceId)
                .pipe(tap(resp => this.ngRedux.dispatch(this.liveModelingActions.setCurrentBuildPlanInstance(resp)))),
            this.updateCurrentServiceTemplateInstanceState(csarId, serviceTemplateInstanceId)
                .pipe(tap(resp => this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceState(resp)))),
            this.updateNodeTemplateData(csarId, serviceTemplateInstanceId)
        ]).toPromise();
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

    private updateNodeTemplateData(csarId: string, serviceTemplateInstanceId: string): Observable<NodeTemplateInstance[]> {
        this.loggingService.logInfo(`Fetching node template data`);
        return this.containerService.getNodeTemplates(csarId, serviceTemplateInstanceId).pipe(
            switchMap(nodeTemplates => {
                const observables: Observable<NodeTemplateInstance>[] = [];
                for (const nodeTemplate of nodeTemplates) {
                    observables.push(this.containerService.getNodeTemplateInstance(
                        csarId, serviceTemplateInstanceId, nodeTemplate.id).pipe(
                            tap(resp => {
                                this.ngRedux.dispatch(this.wineryActions.setNodeInstanceState(resp.node_template_id, NodeTemplateInstanceStates[resp.state]));
                            }),
                        catchError(_ => {
                            this.loggingService.logError(`Unable to fetch data for node ${nodeTemplate.id}`);
                            return of(null);
                        })
                    ));
                }
                return forkJoin(observables);
            }),
            catchError(_ => {
                this.loggingService.logError('Unable to fetch node templates');
                return of(null);
            })
        );
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

            this.loggingService.logInfo(`Terminating service template instance ${serviceTemplateInstanceId}`);

            await this.containerService.terminateServiceTemplateInstance(csarId, serviceTemplateInstanceId).toPromise();

            this.loggingService.logInfo(`Waiting for deletion of service template instance with instance id ${serviceTemplateInstanceId}`);

            await this.waitUntilInstanceIsInState(csarId, serviceTemplateInstanceId, ServiceTemplateInstanceStates.DELETED);

            this.setAllNodeTemplateInstanceState(null);
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentServiceTemplateInstanceId(null));
            this.ngRedux.dispatch(this.liveModelingActions.setCurrentBuildPlanInstance(null));

            this.loggingService.logSuccess('Instance has been successfully deleted');
        } catch (error) {
            throw new TerminateInstanceError();
        }
    }

    private terminateServiceTemplateInstanceInBackground(csarId: string, serviceTemplateInstanceId: string): Subscription {
        return this.containerService.terminateServiceTemplateInstance(csarId, serviceTemplateInstanceId).subscribe(_ => {
            this.toastrService.info('Instance successfully terminated');
        }, _ => {
            this.toastrService.error('There was an error while terminating the service template instance');
        });
    }

    private deleteApplicationInBackground(csarId: string): Subscription {
        return this.containerService.deleteApplication(csarId).subscribe(_ => {
            this.toastrService.info('Application successfully deleted');
        }, _ => {
            this.toastrService.error('There was an error while deleting the application');
        });
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
