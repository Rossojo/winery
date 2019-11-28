/********************************************************************************
 * Copyright (c) 2012-2019 Contributors to the Eclipse Foundation
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
 ********************************************************************************/
package org.eclipse.winery.repository.rest.resources.servicetemplates;

import java.io.IOException;
import java.net.URI;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import javax.xml.bind.JAXBException;
import javax.xml.namespace.QName;
import javax.xml.parsers.ParserConfigurationException;

import org.eclipse.winery.common.ids.definitions.NodeTypeId;
import org.eclipse.winery.common.ids.definitions.ServiceTemplateId;
import org.eclipse.winery.common.version.VersionUtils;
import org.eclipse.winery.common.version.WineryVersion;
import org.eclipse.winery.compliance.checking.ServiceTemplateCheckingResult;
import org.eclipse.winery.compliance.checking.ServiceTemplateComplianceRuleRuleChecker;
import org.eclipse.winery.model.adaptation.substitution.Substitution;
import org.eclipse.winery.model.threatmodeling.ThreatAssessment;
import org.eclipse.winery.model.threatmodeling.ThreatModeling;
import org.eclipse.winery.model.tosca.TBoundaryDefinitions;
import org.eclipse.winery.model.tosca.TCapability;
import org.eclipse.winery.model.tosca.TEntityTemplate;
import org.eclipse.winery.model.tosca.TExtensibleElements;
import org.eclipse.winery.model.tosca.TInterface;
import org.eclipse.winery.model.tosca.TInterfaces;
import org.eclipse.winery.model.tosca.TNodeTemplate;
import org.eclipse.winery.model.tosca.TNodeTemplate.Capabilities;
import org.eclipse.winery.model.tosca.TNodeType;
import org.eclipse.winery.model.tosca.TOperation;
import org.eclipse.winery.model.tosca.TParameter;
import org.eclipse.winery.model.tosca.TPlans;
import org.eclipse.winery.model.tosca.TRelationshipTemplate;
import org.eclipse.winery.model.tosca.TRequirement;
import org.eclipse.winery.model.tosca.TServiceTemplate;
import org.eclipse.winery.model.tosca.TTag;
import org.eclipse.winery.model.tosca.TTags;
import org.eclipse.winery.model.tosca.TTopologyTemplate;
import org.eclipse.winery.model.tosca.constants.ToscaBaseTypes;
import org.eclipse.winery.model.tosca.kvproperties.PropertyDefinitionKV;
import org.eclipse.winery.model.tosca.kvproperties.PropertyDefinitionKVList;
import org.eclipse.winery.model.tosca.kvproperties.WinerysPropertiesDefinition;
import org.eclipse.winery.model.tosca.utils.ModelUtilities;
import org.eclipse.winery.repository.backend.BackendUtils;
import org.eclipse.winery.repository.backend.IRepository;
import org.eclipse.winery.repository.backend.NamespaceManager;
import org.eclipse.winery.repository.backend.RepositoryFactory;
import org.eclipse.winery.repository.driverspecificationandinjection.DASpecification;
import org.eclipse.winery.repository.driverspecificationandinjection.DriverInjection;
import org.eclipse.winery.repository.rest.RestUtils;
import org.eclipse.winery.repository.rest.resources._support.AbstractComponentInstanceResourceContainingATopology;
import org.eclipse.winery.repository.rest.resources._support.IHasName;
import org.eclipse.winery.repository.rest.resources._support.ResourceResult;
import org.eclipse.winery.repository.rest.resources._support.dataadapter.injectionadapter.InjectorReplaceData;
import org.eclipse.winery.repository.rest.resources._support.dataadapter.injectionadapter.InjectorReplaceOptions;
import org.eclipse.winery.repository.rest.resources.apiData.QNameApiData;
import org.eclipse.winery.repository.rest.resources.servicetemplates.boundarydefinitions.BoundaryDefinitionsResource;
import org.eclipse.winery.repository.rest.resources.servicetemplates.plans.PlansResource;
import org.eclipse.winery.repository.rest.resources.servicetemplates.selfserviceportal.SelfServicePortalResource;
import org.eclipse.winery.repository.rest.resources.servicetemplates.topologytemplates.TopologyTemplateResource;
import org.eclipse.winery.repository.splitting.InjectRemoval;
import org.eclipse.winery.repository.splitting.Splitting;
import org.eclipse.winery.repository.splitting.SplittingException;

import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiResponse;
import io.swagger.annotations.ApiResponses;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

public class ServiceTemplateResource extends AbstractComponentInstanceResourceContainingATopology implements IHasName {

    private static final Logger LOGGER = LoggerFactory.getLogger(ServiceTemplateResource.class);

    public ServiceTemplateResource(ServiceTemplateId id) {
        super(id);
    }

    public TServiceTemplate getServiceTemplate() {
        return (TServiceTemplate) this.getElement();
    }

    @Override
    public void setTopology(TTopologyTemplate topologyTemplate, String type) {
        this.getServiceTemplate().setTopologyTemplate(topologyTemplate);
    }

    /**
     * sub-resources
     **/

    @Path("topologytemplate/")
    public TopologyTemplateResource getTopologyTemplateResource() {
        if (this.getServiceTemplate().getTopologyTemplate() == null) {
            // the main service template resource exists
            // default topology template: empty template
            // This eases the JSPs etc. and is valid as a non-existant topology template is equal to an empty one
            this.getServiceTemplate().setTopologyTemplate(new TTopologyTemplate());
        }
        return new TopologyTemplateResource(this, this.getServiceTemplate().getTopologyTemplate(), null);
    }

    @Path("plans/")
    public PlansResource getPlansResource() {
        TPlans plans = this.getServiceTemplate().getPlans();
        if (plans == null) {
            plans = new TPlans();
            this.getServiceTemplate().setPlans(plans);
        }
        return new PlansResource(plans.getPlan(), this);
    }

    @Path("selfserviceportal/")
    public SelfServicePortalResource getSelfServicePortalResource() {
        return new SelfServicePortalResource(this);
    }

    @Path("boundarydefinitions/")
    public BoundaryDefinitionsResource getBoundaryDefinitionsResource() {
        TBoundaryDefinitions boundaryDefinitions = this.getServiceTemplate().getBoundaryDefinitions();
        if (boundaryDefinitions == null) {
            boundaryDefinitions = new TBoundaryDefinitions();
            this.getServiceTemplate().setBoundaryDefinitions(boundaryDefinitions);
        }
        return new BoundaryDefinitionsResource(this, boundaryDefinitions);
    }

    @Override
    public String getName() {
        String name = this.getServiceTemplate().getName();
        if (name == null) {
            // place default
            name = this.getId().getXmlId().getDecoded();
        }
        return name;
    }

    @Override
    public Response setName(String name) {
        this.getServiceTemplate().setName(name);
        return RestUtils.persist(this);
    }

    @GET
    @ApiOperation(value = "Returns the associated node type, which can be substituted by this service template.")
    @ApiResponses(value = {
        @ApiResponse(code = 200, response = QName.class, message = "QName of the form {namespace}localName")
    })
    @Path("substitutableNodeType")
    @Produces(MediaType.TEXT_PLAIN)
    public Response getSubstitutableNodeTypeAsResponse() {
        QName qname = this.getServiceTemplate().getSubstitutableNodeType();
        if (qname == null) {
            return Response.status(Status.NOT_FOUND).build();
        } else {
            return Response.ok(qname.toString()).build();
        }
    }

    /**
     * @return null if there is no substitutable node type
     */
    public QName getSubstitutableNodeType() {
        return this.getServiceTemplate().getSubstitutableNodeType();
    }

    @DELETE
    @ApiOperation(value = "Removes the association to substitutable node type")
    @Path("substitutableNodeType")
    public Response deleteSubstitutableNodeType() {
        this.getServiceTemplate().setSubstitutableNodeType(null);
        RestUtils.persist(this);
        return Response.noContent().build();
    }

    @GET
    @Path("injector/options")
    @Produces( {MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.APPLICATION_JSON})
    public Response getInjectorOptions() {
        Splitting splitting = new Splitting();
        TTopologyTemplate topologyTemplate = this.getServiceTemplate().getTopologyTemplate();
        Map<String, List<TTopologyTemplate>> hostMatchingOptions;
        Map<String, List<TTopologyTemplate>> connectionMatchingOptions;
        InjectorReplaceOptions injectionReplaceOptions = new InjectorReplaceOptions();

        try {

            Map<TRequirement, String> requirementsAndMatchingBasisCapabilityTypes =
                splitting.getOpenRequirementsAndMatchingBasisCapabilityTypeNames(this.getServiceTemplate().getTopologyTemplate());
            // Output check
            for (TRequirement req : requirementsAndMatchingBasisCapabilityTypes.keySet()) {
                System.out.println("open Requirement: " + req.getId());
                System.out.println("matchingBasisType: " + requirementsAndMatchingBasisCapabilityTypes.get(req));
            }

            if (requirementsAndMatchingBasisCapabilityTypes.containsValue("Container")) {
                hostMatchingOptions = splitting.getHostingMatchingOptionsWithDefaultLabeling(topologyTemplate);
            } else {
                hostMatchingOptions = null;
            }
            if (requirementsAndMatchingBasisCapabilityTypes.containsValue("Endpoint")) {
                connectionMatchingOptions = splitting.getConnectionInjectionOptions(topologyTemplate);
            } else {
                connectionMatchingOptions = null;
            }

            injectionReplaceOptions.setTopologyTemplate(topologyTemplate);
            injectionReplaceOptions.setHostInjectionOptions(hostMatchingOptions);
            injectionReplaceOptions.setConnectionInjectionOptions(connectionMatchingOptions);

            if (hostMatchingOptions == null && connectionMatchingOptions == null) {
                return Response.status(Status.BAD_REQUEST).type(MediaType.TEXT_PLAIN).entity("No need for matching").build();
            }
        } catch (SplittingException e) {
            LOGGER.error("Could not match", e);
            return Response.status(Status.BAD_REQUEST).entity(e.getMessage()).build();
        }
        return Response.ok().entity(injectionReplaceOptions).build();
    }

    @POST
    @Path("placeholder/generator")
    @Consumes( {MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.APPLICATION_JSON})
    @Produces( {MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.APPLICATION_JSON})
    public Response generatePlaceholdersWithCapability() {
        Splitting splitting = new Splitting();
        TTopologyTemplate topologyTemplate = this.getServiceTemplate().getTopologyTemplate();

        try {
            // get all open requirements and the respective node templates with open requirements
            Map<TRequirement, TNodeTemplate> requirementsAndItsNodeTemplates =
                splitting.getOpenRequirementsAndItsNodeTemplate(topologyTemplate);
            IRepository repo = RepositoryFactory.getRepository();

            // iterate over all open requirements
            for (Map.Entry<TRequirement, TNodeTemplate> entry : requirementsAndItsNodeTemplates.entrySet()) {
                PropertyDefinitionKVList propertyDefinitionKVList = new PropertyDefinitionKVList();
                LinkedHashMap<String, String> placeholderNodeTemplateProperties = new LinkedHashMap<>();
                // current node template with open requirements
                TNodeTemplate nodeTemplateWithOpenReq = entry.getValue();
                // get type of node template with open requirements
                NodeTypeId id = new NodeTypeId(nodeTemplateWithOpenReq.getType());
                TNodeType sourceNodeType = repo.getElement(id);

                TInterfaces sourceNodeTypeInterfaces = sourceNodeType.getInterfaces();
                if (sourceNodeTypeInterfaces != null) {
                    for (TInterface tInterface : sourceNodeTypeInterfaces.getInterface()) {
                        // TODO: make this more safe
                        for (TOperation tOperation : tInterface.getOperation()) {
                            TOperation.InputParameters inputParameters = tOperation.getInputParameters();
                            if (inputParameters != null) {
                                for (TParameter inputParameter : inputParameters.getInputParameter()) {
                                    PropertyDefinitionKV inputParamKV = new PropertyDefinitionKV(inputParameter.getName(), inputParameter.getType());
                                    if (sourceNodeType.getWinerysPropertiesDefinition() != null &&
                                        !sourceNodeType.getWinerysPropertiesDefinition().getPropertyDefinitionKVList().getPropertyDefinitionKVs().contains(inputParamKV)
                                        && !propertyDefinitionKVList.getPropertyDefinitionKVs().contains(inputParamKV)) {
                                        propertyDefinitionKVList.getPropertyDefinitionKVs().add(inputParamKV);
                                        placeholderNodeTemplateProperties.put(inputParameter.getName(), "get_input: " + inputParameter.getName());
                                    }
                                }
                            }
                        }
                    }
                }

                List<TRelationshipTemplate> incomingRelationshipTemplates = ModelUtilities.getIncomingRelationshipTemplates(topologyTemplate, nodeTemplateWithOpenReq);
                List<TParameter> inputParameters = splitting.getInputParamListofIncomingRelationshipTemplates(topologyTemplate, incomingRelationshipTemplates);
                for (TParameter inputParameter : inputParameters) {
                    String prefixTARGET = "TARGET_";
                    String prefixSOURCE = "SOURCE_";
                    String inputParamName = inputParameter.getName();
                    if (inputParamName.contains(prefixTARGET)) {
                        inputParamName = inputParamName.replaceAll(prefixTARGET, "");
                    }
                    if (inputParamName.contains(prefixSOURCE)) {
                        inputParamName = inputParamName.replaceAll(prefixSOURCE, "");
                    }
                    inputParameter.setName(inputParamName);

                    PropertyDefinitionKV inputParamKV = new PropertyDefinitionKV(inputParameter.getName(), inputParameter.getType());
                    if (sourceNodeType.getWinerysPropertiesDefinition() != null &&
                        !sourceNodeType.getWinerysPropertiesDefinition().getPropertyDefinitionKVList().getPropertyDefinitionKVs().contains(inputParamKV)
                        && !propertyDefinitionKVList.getPropertyDefinitionKVs().contains(inputParamKV)) {
                        propertyDefinitionKVList.getPropertyDefinitionKVs().add(inputParamKV);
                        placeholderNodeTemplateProperties.put(inputParameter.getName(), "get_input: " + inputParameter.getName());
                    }
                }

                // get required capability type of open requirement
                QName capabilityType = splitting.getRequiredCapabilityTypeQNameOfRequirement(entry.getKey());

                // create new placeholder node type
                TNodeType placeholderNodeType = splitting.createPlaceholderNodeType(nodeTemplateWithOpenReq.getName());
                QName placeholderQName = new QName(placeholderNodeType.getTargetNamespace(), placeholderNodeType.getName());

                WinerysPropertiesDefinition winerysPropertiesDefinition = sourceNodeType.getWinerysPropertiesDefinition();
                // add properties definition
                placeholderNodeType.setPropertiesDefinition(null);
                if (winerysPropertiesDefinition != null) {
                    winerysPropertiesDefinition.setPropertyDefinitionKVList(propertyDefinitionKVList);
                    ModelUtilities.replaceWinerysPropertiesDefinition(placeholderNodeType, winerysPropertiesDefinition);
                    String namespace = placeholderNodeType.getWinerysPropertiesDefinition().getNamespace();
                    NamespaceManager namespaceManager = RepositoryFactory.getRepository().getNamespaceManager();
                    if (!namespaceManager.hasPermanentProperties(namespace)) {
                        namespaceManager.addPermanentNamespace(namespace);
                    }
                }

                NodeTypeId placeholderId = new NodeTypeId(placeholderQName);
                // check if placeholder node type exists
                if (repo.exists(placeholderId)) {
                    // delete and create new
                    RestUtils.delete(placeholderId);
                }
                repo.setElement(placeholderId, placeholderNodeType);

                // create placeholder node template
                TNodeTemplate placeholderNodeTemplate = splitting.createPlaceholderNodeTemplate(nodeTemplateWithOpenReq.getName(), placeholderQName);

                // create capability of placeholder node template
                TCapability capa = splitting.createPlaceholderCapability(capabilityType);

                TEntityTemplate.Properties properties = new TEntityTemplate.Properties();
                properties.setKVProperties(placeholderNodeTemplateProperties);
                placeholderNodeTemplate.setCapabilities(new Capabilities());
                placeholderNodeTemplate.getCapabilities().getCapability().add(capa);
                placeholderNodeTemplate.setProperties(properties);
                for (Map.Entry<QName, String> targetLocation : nodeTemplateWithOpenReq.getOtherAttributes().entrySet()) {
                    placeholderNodeTemplate.getOtherAttributes().put(targetLocation.getKey(), targetLocation.getValue());
                }
                // add placeholder to node template and connect with source node template with open requirements
                topologyTemplate.addNodeTemplate(placeholderNodeTemplate);
                ModelUtilities.createRelationshipTemplateAndAddToTopology(nodeTemplateWithOpenReq, placeholderNodeTemplate, ToscaBaseTypes.hostedOnRelationshipType, topologyTemplate);
            }
            LOGGER.debug("PERSISTING");
            RestUtils.persist(this);
            LOGGER.debug("PERSISTED");
            String responseId = this.getServiceTemplate().getId();
            return Response.ok().entity(responseId).build();
        } catch (
            Exception e) {
            LOGGER.error("Could not fetch requirements and capabilities", e);
            return Response.status(Status.BAD_REQUEST).entity(e.getMessage()).build();
        }
    }

    @POST
    @Path("injector/replace")
    @Consumes( {MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.APPLICATION_JSON})
    @Produces( {MediaType.APPLICATION_XML, MediaType.TEXT_XML, MediaType.APPLICATION_JSON})
    public Response injectNodeTemplates(InjectorReplaceData injectorReplaceData, @Context UriInfo uriInfo) throws
        Exception, IOException, ParserConfigurationException, SAXException, SplittingException {

        if (injectorReplaceData.hostInjections != null) {
            Collection<TTopologyTemplate> hostInjectorTopologyTemplates = injectorReplaceData.hostInjections.values();
            hostInjectorTopologyTemplates.forEach(t -> {
                try {
                    ModelUtilities.patchAnyAttributes(t.getNodeTemplates());
                } catch (IOException e) {
                    LOGGER.error("XML was invalid", e);
                }
            });
        }
        if (injectorReplaceData.connectionInjections != null) {
            Collection<TTopologyTemplate> connectionInjectorTopologyTemplates = injectorReplaceData.connectionInjections.values();
            connectionInjectorTopologyTemplates.forEach(t -> {
                try {
                    ModelUtilities.patchAnyAttributes(t.getNodeTemplates());
                } catch (IOException e) {
                    LOGGER.error("XML was invalid", e);
                }
            });
        }

        Splitting splitting = new Splitting();
        TTopologyTemplate matchedHostsTopologyTemplate;
        TTopologyTemplate matchedConnectedTopologyTemplate;

        //Test Method findOpenRequirements
        Map<TRequirement, String> requirementsAndMatchingBasisCapabilityTypes =
            splitting.getOpenRequirementsAndMatchingBasisCapabilityTypeNames(this.getServiceTemplate().getTopologyTemplate());
        // Output check
        for (TRequirement req : requirementsAndMatchingBasisCapabilityTypes.keySet()) {
            System.out.println("open Requirement: " + req.getId());
            System.out.println("matchingbasisType: " + requirementsAndMatchingBasisCapabilityTypes.get(req));
        }
        // End Output check

        if (requirementsAndMatchingBasisCapabilityTypes.containsValue("Container")) {
            matchedHostsTopologyTemplate = splitting.injectNodeTemplates(this.getServiceTemplate().getTopologyTemplate(), injectorReplaceData.hostInjections, InjectRemoval.REMOVE_REPLACED_AND_SUCCESSORS);

            if (requirementsAndMatchingBasisCapabilityTypes.containsValue("Endpoint")) {
                matchedConnectedTopologyTemplate = splitting.injectConnectionNodeTemplates(matchedHostsTopologyTemplate, injectorReplaceData.connectionInjections);
            } else {
                matchedConnectedTopologyTemplate = matchedHostsTopologyTemplate;
            }
        } else if (requirementsAndMatchingBasisCapabilityTypes.containsValue("Endpoint")) {
            matchedConnectedTopologyTemplate = splitting.injectConnectionNodeTemplates(this.getServiceTemplate().getTopologyTemplate(), injectorReplaceData.connectionInjections);
        } else {
            throw new SplittingException("No open Requirements which can be matched");
        }

        TTopologyTemplate daSpecifiedTopology = matchedConnectedTopologyTemplate;

        //Start additional functionality Driver Injection
        if (!DASpecification.getNodeTemplatesWithAbstractDAs(matchedConnectedTopologyTemplate).isEmpty() &&
            DASpecification.getNodeTemplatesWithAbstractDAs(matchedConnectedTopologyTemplate) != null) {
            daSpecifiedTopology = DriverInjection.injectDriver(matchedConnectedTopologyTemplate);
        }
        //End additional functionality Driver Injection

        this.getServiceTemplate().setTopologyTemplate(daSpecifiedTopology);

        LOGGER.debug("Persisting...");
        RestUtils.persist(this);
        LOGGER.debug("Persisted.");

        //No renaming of the Service Template allowed because of the plans

        URI url = uriInfo.getBaseUri().resolve(RestUtils.getAbsoluteURL(id));
        LOGGER.debug("URI of the old and new service template {}", url.toString());
        return Response.created(url).build();
    }

    @Path("constraintchecking")
    @Produces(MediaType.APPLICATION_XML)
    @POST
    public Response complianceChecking(@Context UriInfo uriInfo) throws JAXBException {
        ServiceTemplateComplianceRuleRuleChecker checker = new ServiceTemplateComplianceRuleRuleChecker(this.getServiceTemplate());
        ServiceTemplateCheckingResult serviceTemplateCheckingResult = checker.checkComplianceRules();
        return Response.ok().entity(serviceTemplateCheckingResult.toXMLString()).build();
    }

    @Path("substitute")
    @Produces(MediaType.APPLICATION_JSON)
    @GET
    public ServiceTemplateId substitute() {
        Substitution substitution = new Substitution();
        return substitution.substituteTopologyOfServiceTemplate((ServiceTemplateId) this.id);
    }

    @POST()
    @Path("createparticipantsversion")
    @Produces( {MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public List<Response> createParticipantsVersion() throws IOException {
        IRepository repo = RepositoryFactory.getRepository();
        // create list of responses because we create multiple resources at once
        List<Response> listOfResponses = new ArrayList<>();

        Map<QName, TTags> newServiceTemplateIdsAndTags = new LinkedHashMap<>();

        LOGGER.debug("Creating new participants version of Service Template {}...", this.getId());

        ServiceTemplateId id = (ServiceTemplateId) this.getId();
        WineryVersion version = VersionUtils.getVersion(id);

        TTags tagsOfServiceTemplate = this.getServiceTemplate().getTags();

        // iterate over tags of origin service template
        for (TTag tagOfServiceTemplate : tagsOfServiceTemplate.getTag()) {
            // check if tag with partner in service template
            if (tagOfServiceTemplate.getName().contains("partner")) {
                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd-HHmmss");
                WineryVersion newVersion = new WineryVersion(
                    tagOfServiceTemplate.getName() + "-" + version.toString() + "-" + dateFormat.format(new Date()),
                    1,
                    0
                );
                // create list of tags to add to service tempalte
                TTags tTagList = new TTags();

                // new tag to define participant of service template
                TTag participantTag = new TTag();
                participantTag.setName("participant");
                participantTag.setValue(tagOfServiceTemplate.getName());
                tTagList.getTag().add(participantTag);

                String choreoValue = "";
                // iterate over node templates and check if their target location == current participant
                for (TNodeTemplate tNodeTemplate : this.getServiceTemplate().getTopologyTemplate().getNodeTemplates()) {
                    for (Map.Entry<QName, String> entry : tNodeTemplate.getOtherAttributes().entrySet()) {
                        if (entry.getValue().equals(tagOfServiceTemplate.getName())) {
                            // add to choregraphy value
                            choreoValue += tNodeTemplate.getId() + ",";
                        }
                    }
                }
                choreoValue = choreoValue.substring(0, choreoValue.length() - 1);
                TTag choreoTag = new TTag();
                choreoTag.setName("choreography");
                choreoTag.setValue(choreoValue);
                tTagList.getTag().add(choreoTag);

                ServiceTemplateId newId = new ServiceTemplateId(id.getNamespace().getDecoded(),
                    VersionUtils.getNameWithoutVersion(id) + WineryVersion.WINERY_NAME_FROM_VERSION_SEPARATOR + newVersion.toString(),
                    false);

                ResourceResult response = RestUtils.duplicate(id, newId);

                if (response.getStatus() == Status.CREATED) {
                    response.setUri(null);
                    response.setMessage(new QNameApiData(newId));
                }

                TServiceTemplate tempServiceTempl = repo.getElement(newId);
                // reset tags and set tags with respective entry
                tempServiceTempl.setTags(null);
                tempServiceTempl.setTags(tTagList);

                listOfResponses.add(response.getResponse());
                // set element to propagate changed tags
                repo.setElement(newId, tempServiceTempl);

                newServiceTemplateIdsAndTags.put(newId.getQName(), tTagList);
            }
        }
        return listOfResponses;
    }

    @POST()
    @Path("createplaceholderversion")
    @Produces( {MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response createNewPlaceholderVersion() {
        LOGGER.debug("Creating new placeholder version of Service Template {}...", this.getId());
        ServiceTemplateId id = (ServiceTemplateId) this.getId();
        WineryVersion version = VersionUtils.getVersion(id);

        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd-HHmmss");
        WineryVersion newVersion = new WineryVersion(
            "placeholder-" + version.toString() + "-" + dateFormat.format(new Date()),
            1,
            0
        );

        ServiceTemplateId newId = new ServiceTemplateId(id.getNamespace().getDecoded(),
            VersionUtils.getNameWithoutVersion(id) + WineryVersion.WINERY_NAME_FROM_VERSION_SEPARATOR + newVersion.toString(),
            false);

        ResourceResult response = RestUtils.duplicate(id, newId);

        if (response.getStatus() == Status.CREATED) {
            response.setUri(null);
            response.setMessage(new QNameApiData(newId));
        }

        LOGGER.debug("Created Service Template {}", newId.getQName());

        return response.getResponse();
    }

    @POST()
    @Path("createnewstatefulversion")
    @Produces( {MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response createNewStatefulVersion() {
        LOGGER.debug("Creating new stateful version of Service Template {}...", this.getId());
        ServiceTemplateId id = (ServiceTemplateId) this.getId();
        WineryVersion version = VersionUtils.getVersion(id);

        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd-HHmmss");
        WineryVersion newVersion = new WineryVersion(
            "stateful-" + version.toString() + "-" + dateFormat.format(new Date()),
            1,
            0
        );

        ServiceTemplateId newId = new ServiceTemplateId(id.getNamespace().getDecoded(),
            VersionUtils.getNameWithoutVersion(id) + WineryVersion.WINERY_NAME_FROM_VERSION_SEPARATOR + newVersion.toString(),
            false);
        ResourceResult response = RestUtils.duplicate(id, newId);

        if (response.getStatus() == Status.CREATED) {
            response.setUri(null);
            response.setMessage(new QNameApiData(newId));
        }

        LOGGER.debug("Created Service Template {}", newId.getQName());

        return response.getResponse();
    }

    @Path("threatmodeling")
    @Produces(MediaType.APPLICATION_JSON)
    @GET
    public ThreatAssessment threatModeling() {
        ThreatModeling threatModeling = new ThreatModeling((ServiceTemplateId) this.id);
        return threatModeling.getServiceTemplateThreats();
    }

    @Override
    protected TExtensibleElements createNewElement() {
        return new TServiceTemplate();
    }

    @Override
    public void synchronizeReferences() throws IOException {
        BackendUtils.synchronizeReferences((ServiceTemplateId) this.id);
    }
}
