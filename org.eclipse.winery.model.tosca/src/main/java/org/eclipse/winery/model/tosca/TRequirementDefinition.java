/*******************************************************************************
 * Copyright (c) 2013-2018 Contributors to the Eclipse Foundation
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

package org.eclipse.winery.model.tosca;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;
import javax.xml.namespace.QName;

import org.eclipse.winery.model.tosca.visitor.Visitor;

import org.eclipse.jdt.annotation.NonNull;
import org.eclipse.jdt.annotation.Nullable;

@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "tRequirementDefinition", propOrder = {
    "constraints"
})
public class TRequirementDefinition extends TExtensibleElements {
    @XmlElement(name = "Constraints")
    protected TRequirementDefinition.Constraints constraints;
    @XmlAttribute(name = "name", required = true)
    protected String name;
    @XmlAttribute(name = "requirementType", required = true)
    protected QName requirementType;
    @XmlAttribute(name = "lowerBound")
    protected Integer lowerBound;
    @XmlAttribute(name = "upperBound")
    protected String upperBound;

    public TRequirementDefinition() {

    }

    public TRequirementDefinition(Builder builder) {
        super(builder);
        this.constraints = builder.constraints;
        this.name = builder.name;
        this.requirementType = builder.requirementType;
        this.lowerBound = builder.lowerBound;
        this.upperBound = builder.upperBound;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TRequirementDefinition)) return false;
        if (!super.equals(o)) return false;
        TRequirementDefinition that = (TRequirementDefinition) o;
        return Objects.equals(constraints, that.constraints) &&
            Objects.equals(name, that.name) &&
            Objects.equals(requirementType, that.requirementType) &&
            Objects.equals(lowerBound, that.lowerBound) &&
            Objects.equals(upperBound, that.upperBound);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), constraints, name, requirementType, lowerBound, upperBound);
    }

    @Override
    public void accept(Visitor visitor) {
        visitor.visit(this);
    }

    public TRequirementDefinition.@Nullable Constraints getConstraints() {
        return constraints;
    }

    public void setConstraints(TRequirementDefinition.@Nullable Constraints value) {
        this.constraints = value;
    }

    @NonNull
    public String getName() {
        return name;
    }

    public void setName(@NonNull String value) {
        Objects.requireNonNull(value);
        this.name = value;
    }

    @NonNull
    public QName getRequirementType() {
        return requirementType;
    }

    public void setRequirementType(@NonNull QName value) {
        Objects.requireNonNull(value);
        this.requirementType = value;
    }

    @NonNull
    public int getLowerBound() {
        if (lowerBound == null) {
            return 1;
        } else {
            return lowerBound;
        }
    }

    public void setLowerBound(@Nullable Integer value) {
        this.lowerBound = value;
    }

    @NonNull
    public String getUpperBound() {
        if (upperBound == null) {
            return "1";
        } else {
            return upperBound;
        }
    }

    public void setUpperBound(@Nullable String value) {
        this.upperBound = value;
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "constraint"
    })
    public static class Constraints implements Serializable {

        @XmlElement(name = "Constraint", required = true)
        protected List<TConstraint> constraint;

        @NonNull
        public List<TConstraint> getConstraint() {
            if (constraint == null) {
                constraint = new ArrayList<TConstraint>();
            }
            return this.constraint;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Constraints that = (Constraints) o;
            return Objects.equals(constraint, that.constraint);
        }

        @Override
        public int hashCode() {
            return Objects.hash(constraint);
        }
    }

    public static class Builder extends TExtensibleElements.Builder<Builder> {
        private final String name;
        private final QName requirementType;

        private Constraints constraints;
        private Integer lowerBound;
        private String upperBound;

        public Builder(String name, QName requirementType) {
            this.name = name;
            this.requirementType = requirementType;
        }

        public Builder setConstraints(TRequirementDefinition.Constraints constraints) {
            this.constraints = constraints;
            return this;
        }

        public Builder setLowerBound(Integer lowerBound) {
            this.lowerBound = lowerBound;
            return this;
        }

        public Builder setUpperBound(String upperBound) {
            this.upperBound = upperBound;
            return this;
        }

        public Builder addConstraints(TRequirementDefinition.Constraints constraints) {
            if (constraints == null || constraints.getConstraint().isEmpty()) {
                return this;
            }

            if (this.constraints == null) {
                this.constraints = constraints;
            } else {
                this.constraints.getConstraint().addAll(constraints.getConstraint());
            }
            return this;
        }

        public Builder addConstraints(List<TConstraint> constraints) {
            if (constraints == null) {
                return this;
            }

            TRequirementDefinition.Constraints tmp = new TRequirementDefinition.Constraints();
            tmp.getConstraint().addAll(constraints);
            return addConstraints(tmp);
        }

        public Builder addConstraints(TConstraint constraints) {
            if (constraints == null) {
                return this;
            }

            TRequirementDefinition.Constraints tmp = new TRequirementDefinition.Constraints();
            tmp.getConstraint().add(constraints);
            return addConstraints(tmp);
        }

        @Override
        public Builder self() {
            return this;
        }

        public TRequirementDefinition build() {
            return new TRequirementDefinition(this);
        }
    }
}
