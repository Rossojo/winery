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
