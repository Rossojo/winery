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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlAnyElement;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlType;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.eclipse.winery.model.tosca.constants.Namespaces;

import io.github.adr.embedded.ADR;
import org.eclipse.jdt.annotation.NonNull;
import org.eclipse.jdt.annotation.Nullable;
import org.w3c.dom.Comment;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.w3c.dom.Text;

@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "tBoundaryDefinitions", propOrder = {
    "properties",
    "propertyConstraints",
    "requirements",
    "capabilities",
    "policies",
    "interfaces"
})
public class TBoundaryDefinitions {
    @XmlElement(name = "Properties")
    protected TBoundaryDefinitions.Properties properties;
    @XmlElement(name = "PropertyConstraints")
    protected TBoundaryDefinitions.PropertyConstraints propertyConstraints;
    @XmlElement(name = "Requirements")
    protected TBoundaryDefinitions.Requirements requirements;
    @XmlElement(name = "Capabilities")
    protected TBoundaryDefinitions.Capabilities capabilities;
    @XmlElement(name = "Policies")
    protected TBoundaryDefinitions.Policies policies;
    @XmlElement(name = "Interfaces")
    protected TBoundaryDefinitions.Interfaces interfaces;

    public TBoundaryDefinitions() {

    }

    public TBoundaryDefinitions(Builder builder) {
        this.properties = builder.properties;
        this.propertyConstraints = builder.propertyConstraints;
        this.requirements = builder.requirements;
        this.capabilities = builder.capabilities;
        this.policies = builder.policies;
        this.interfaces = builder.interfaces;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TBoundaryDefinitions)) return false;
        TBoundaryDefinitions that = (TBoundaryDefinitions) o;
        return Objects.equals(properties, that.properties) &&
            Objects.equals(propertyConstraints, that.propertyConstraints) &&
            Objects.equals(requirements, that.requirements) &&
            Objects.equals(capabilities, that.capabilities) &&
            Objects.equals(policies, that.policies) &&
            Objects.equals(interfaces, that.interfaces);
    }

    @Override
    public int hashCode() {
        return Objects.hash(properties, propertyConstraints, requirements, capabilities, policies, interfaces);
    }

    public TBoundaryDefinitions.@Nullable Properties getProperties() {
        return properties;
    }

    public void setProperties(TBoundaryDefinitions.Properties value) {
        this.properties = value;
    }

    public TBoundaryDefinitions.@Nullable PropertyConstraints getPropertyConstraints() {
        return propertyConstraints;
    }

    public void setPropertyConstraints(TBoundaryDefinitions.PropertyConstraints value) {
        this.propertyConstraints = value;
    }

    public TBoundaryDefinitions.@Nullable Requirements getRequirements() {
        return requirements;
    }

    public void setRequirements(TBoundaryDefinitions.Requirements value) {
        this.requirements = value;
    }

    public TBoundaryDefinitions.@Nullable Capabilities getCapabilities() {
        return capabilities;
    }

    public void setCapabilities(TBoundaryDefinitions.Capabilities value) {
        this.capabilities = value;
    }

    public TBoundaryDefinitions.@Nullable Policies getPolicies() {
        return policies;
    }

    public void setPolicies(TBoundaryDefinitions.Policies value) {
        this.policies = value;
    }

    public TBoundaryDefinitions.@Nullable Interfaces getInterfaces() {
        return interfaces;
    }

    public void setInterfaces(TBoundaryDefinitions.Interfaces value) {
        this.interfaces = value;
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "capability"
    })
    public static class Capabilities {

        @XmlElement(name = "Capability", required = true)
        protected List<TCapabilityRef> capability;

        @NonNull
        public List<TCapabilityRef> getCapability() {
            if (capability == null) {
                capability = new ArrayList<TCapabilityRef>();
            }
            return this.capability;
        }
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "_interface"
    })
    public static class Interfaces {

        @XmlElement(name = "Interface", required = true)
        protected List<TExportedInterface> _interface;

        @NonNull
        public List<TExportedInterface> getInterface() {
            if (_interface == null) {
                _interface = new ArrayList<TExportedInterface>();
            }
            return this._interface;
        }
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "policy"
    })
    public static class Policies {

        @XmlElement(name = "Policy", required = true)
        protected List<TPolicy> policy;

        @NonNull
        public List<TPolicy> getPolicy() {
            if (policy == null) {
                policy = new ArrayList<TPolicy>();
            }
            return this.policy;
        }
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "any",
        "propertyMappings"
    })
    public static class Properties {

        @XmlAnyElement(lax = true)
        protected Object any;
        @XmlElement(name = "PropertyMappings")
        protected TBoundaryDefinitions.Properties.PropertyMappings propertyMappings;

        @Nullable
        public Object getAny() {
            if (this.getKVProperties() == null) {
                return any;
            } else {
                return null;
            }
        }

        public void setAny(@Nullable Object value) {
            this.any = value;
        }

        /**
         * This is a special method for Winery. Winery allows to define a property by specifying name/value values.
         * Instead of parsing the XML contained in TNodeType, this method is a convenience method to access this
         * information assumes the properties are key/value pairs (see WinerysPropertiesDefinition), all other cases are
         * return null.
         * <p>
         * Returns a map of key/values of this template based on the information of WinerysPropertiesDefinition. In case
         * no value is set, the empty string is used. The map is implemented as {@link LinkedHashMap} to ensure that the
         * order of the elements is the same as in the XML. We return the type {@link LinkedHashMap}, because there is
         * no appropriate Java interface for "sorted" Maps
         * <p>
         * In case the element is not of the form k/v, null is returned
         * <p>
         * This method assumes that the any field is always populated.
         *
         * @return null if not k/v, a map of k/v properties otherwise
         */
        @ADR(12)
        public LinkedHashMap<String, String> getKVProperties() {
            // we use the internal variable "any", because getAny() returns null, if we have KVProperties
            if (any == null || !(any instanceof Element)) {
                return null;
            }

            Element el = (Element) any;
            if (el == null) {
                return null;
            }

            // we have no type information in this place
            // we could inject a repository, but if Winery is used with multiple repositories, this could cause race conditions
            // therefore, we guess at the instance of the properties definition (i.e., here) if it is key/value or not.

            boolean isKv = true;

            LinkedHashMap<String, String> properties = new LinkedHashMap<>();

            NodeList childNodes = el.getChildNodes();

            if (childNodes.getLength() == 0) {
                // somehow invalid XML - do not treat it as k/v
                return null;
            }

            for (int i = 0; i < childNodes.getLength(); i++) {
                Node item = childNodes.item(i);
                if (item instanceof Element) {
                    String key = item.getLocalName();
                    String value;

                    Element kvElement = (Element) item;
                    NodeList kvElementChildNodes = kvElement.getChildNodes();
                    if (kvElementChildNodes.getLength() == 0) {
                        value = "";
                    } else if (kvElementChildNodes.getLength() > 1) {
                        // This is a wrong guess if comments are used, but this is prototype
                        isKv = false;
                        break;
                    } else {
                        // one child - just get the text.
                        value = item.getTextContent();
                    }
                    properties.put(key, value);
                } else if (item instanceof Text || item instanceof Comment) {
                    // these kinds of nodes are OK
                }
            }

            if (isKv) {
                return properties;
            } else {
                return null;
            }
        }

        @ADR(12)
        public void setKVProperties(Map<String, String> properties) {
            Objects.requireNonNull(properties);
            Element el = (Element) any;

            if (el == null) {
                // special case if JSON is parsed without updating an existing element
                DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
                DocumentBuilder db;
                try {
                    db = dbf.newDocumentBuilder();
                } catch (ParserConfigurationException e) {
                    throw new IllegalStateException("Could not instantiate document builder", e);
                }
                Document doc = db.newDocument();

                // We cannot access the wrapper definitions, because we don't have access to the type
                // Element root = doc.createElementNS(wpd.getNamespace(), wpd.getElementName());
                // Therefore, we create a dummy wrapper element:

                Element root = doc.createElementNS(Namespaces.EXAMPLE_NAMESPACE_URI, "Properties");
                doc.appendChild(root);

                // No wpd - so this is not possible:
                // we produce the serialization in the same order the XSD would be generated (because of the usage of xsd:sequence)
                // for (PropertyDefinitionKV prop : wpd.getPropertyDefinitionKVList()) {

                for (String key : properties.keySet()) {
                    // wpd.getNamespace()
                    Element element = doc.createElementNS(Namespaces.EXAMPLE_NAMESPACE_URI, key);
                    root.appendChild(element);
                    String value = properties.get(key);
                    if (value != null) {
                        Text text = doc.createTextNode(value);
                        element.appendChild(text);
                    }
                }

                this.setAny(doc.getDocumentElement());
            } else {
                // straight-forward copy over to existing property structure
                NodeList childNodes = el.getChildNodes();

                for (int i = 0; i < childNodes.getLength(); i++) {
                    Node item = childNodes.item(i);
                    if (item instanceof Element) {
                        final Element element = (Element) item;
                        final String key = element.getLocalName();
                        final String value = properties.get(key);
                        if (value != null) {
                            element.setTextContent(value);
                        }
                    } else if (item instanceof Text || item instanceof Comment) {
                        // these kinds of nodes are OK
                    }
                }
            }
        }

        public TBoundaryDefinitions.Properties.@Nullable PropertyMappings getPropertyMappings() {
            return propertyMappings;
        }

        public void setPropertyMappings(TBoundaryDefinitions.Properties.PropertyMappings value) {
            this.propertyMappings = value;
        }

        @XmlAccessorType(XmlAccessType.FIELD)
        @XmlType(name = "", propOrder = {
            "propertyMapping"
        })
        public static class PropertyMappings {

            @XmlElement(name = "PropertyMapping", required = true)
            protected List<TPropertyMapping> propertyMapping;

            @Nullable
            public List<TPropertyMapping> getPropertyMapping() {
                if (propertyMapping == null) {
                    propertyMapping = new ArrayList<TPropertyMapping>();
                }
                return this.propertyMapping;
            }
        }
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "propertyConstraint"
    })
    public static class PropertyConstraints {

        @XmlElement(name = "PropertyConstraint", required = true)
        protected List<TPropertyConstraint> propertyConstraint;

        @NonNull
        public List<TPropertyConstraint> getPropertyConstraint() {
            if (propertyConstraint == null) {
                propertyConstraint = new ArrayList<TPropertyConstraint>();
            }
            return this.propertyConstraint;
        }
    }

    @XmlAccessorType(XmlAccessType.FIELD)
    @XmlType(name = "", propOrder = {
        "requirement"
    })
    public static class Requirements {

        @XmlElement(name = "Requirement", required = true)
        protected List<TRequirementRef> requirement;

        @NonNull
        public List<TRequirementRef> getRequirement() {
            if (requirement == null) {
                requirement = new ArrayList<>();
            }
            return this.requirement;
        }
    }

    public static class Builder {
        private Properties properties;
        private PropertyConstraints propertyConstraints;
        private Requirements requirements;
        private Capabilities capabilities;
        private Policies policies;
        private Interfaces interfaces;

        public Builder() {

        }

        public Builder setProperties(Properties properties) {
            this.properties = properties;
            return this;
        }

        public Builder setPropertyConstraints(PropertyConstraints propertyConstraints) {
            this.propertyConstraints = propertyConstraints;
            return this;
        }

        public Builder setRequirements(Requirements requirements) {
            this.requirements = requirements;
            return this;
        }

        public Builder setCapabilities(Capabilities capabilities) {
            this.capabilities = capabilities;
            return this;
        }

        public Builder setPolicies(Policies policies) {
            this.policies = policies;
            return this;
        }

        public Builder setInterfaces(Interfaces interfaces) {
            this.interfaces = interfaces;
            return this;
        }

        public Builder addPolicies(TBoundaryDefinitions.Policies policies) {
            if (policies == null || policies.getPolicy().isEmpty()) {
                return this;
            }

            if (this.policies == null) {
                this.policies = policies;
            } else {
                this.policies.getPolicy().addAll(policies.getPolicy());
            }
            return this;
        }

        public Builder addPolicies(List<TPolicy> policies) {
            if (policies == null) {
                return this;
            }

            TBoundaryDefinitions.Policies tmp = new TBoundaryDefinitions.Policies();
            tmp.getPolicy().addAll(policies);
            return this.addPolicies(tmp);
        }

        public Builder addPolicies(TPolicy policies) {
            if (policies == null) {
                return this;
            }

            TBoundaryDefinitions.Policies tmp = new TBoundaryDefinitions.Policies();
            tmp.getPolicy().add(policies);
            return this.addPolicies(tmp);
        }

        public TBoundaryDefinitions build() {
            return new TBoundaryDefinitions(this);
        }
    }
}
