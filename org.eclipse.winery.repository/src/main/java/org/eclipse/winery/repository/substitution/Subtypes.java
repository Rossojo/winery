/*******************************************************************************
 * Copyright (c) 2018 Contributors to the Eclipse Foundation
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

package org.eclipse.winery.repository.substitution;

import java.util.List;

import org.eclipse.winery.model.tosca.HasInheritance;

public class Subtypes<T extends HasInheritance> {

    private T element;
    private List<Subtypes<T>> children;

    public Subtypes(T parent) {
        this.element = parent;
    }

    public void addChildren(List<Subtypes<T>> children) {
        this.children = children;
    }

    public T getElement() {
        return this.element;
    }

    public List<Subtypes<T>> getChildren() {
        return this.children;
    }
}
