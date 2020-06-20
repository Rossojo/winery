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

import { YesNoEnum } from '../../../../tosca-management/src/app/model/enums';
import { TArtifact } from './ttopology-template';
import { SelectData } from '../../../../tosca-management/src/app/model/selectData';

export class Interface {
    name: string;
    type: string;
    inputs: Parameter[] = [];
    operations: Operation[] = [];

    constructor(name: string,
                type: string,
                inputs: Parameter[],
                operations: Operation[]) {
        this.name = name;
        this.type = type;
        this.inputs = inputs;
        this.operations = operations;
    }
}

export class Operation {
    name: string;
    description = '';
    inputs: Parameter[] = [];
    outputs: Parameter[] = [];
    implementation: TArtifact;
}

export const StandardInterface: Interface = {
    name: 'Standard', type: '{tosca.interfaces.node.lifecycle}Standard', inputs: [], operations: [
        Object.assign(new Operation(), { name: 'create' }),
        Object.assign(new Operation(), { name: 'configure' }),
        Object.assign(new Operation(), { name: 'start' }),
        Object.assign(new Operation(), { name: 'stop' }),
        Object.assign(new Operation(), { name: 'delete' }),
    ]
};

export const ConfigureInterface: Interface = {
    name: 'Configure', type: '{tosca.interfaces.relationship}Configure', inputs: [], operations: [
        Object.assign(new Operation(), { name: 'pre_configure_source' }),
        Object.assign(new Operation(), { name: 'pre_configure_target' }),
        Object.assign(new Operation(), { name: 'post_configure_source' }),
        Object.assign(new Operation(), { name: 'post_configure_target' }),
        Object.assign(new Operation(), { name: 'add_target' }),
        Object.assign(new Operation(), { name: 'add_source' }),
        Object.assign(new Operation(), { name: 'target_changed' }),
        Object.assign(new Operation(), { name: 'remove_target' }),
    ]
};

export class InputParameters {
    inputParameter: InterfaceParameter[] = [];
}

export class OutputParameters {
    outputParameter: InterfaceParameter[] = [];
}

export class InterfaceParameter {

    name: string;
    type: string;
    required: YesNoEnum;

    constructor(name: string, type: string, required: YesNoEnum) {
        this.name = name;
        this.type = type;
        this.required = required;
    }
}

export class Parameter {
    key: string = null;
    type = 'string';
    description = '';
    required = false;
    defaultValue = '';
    value = '';
}
