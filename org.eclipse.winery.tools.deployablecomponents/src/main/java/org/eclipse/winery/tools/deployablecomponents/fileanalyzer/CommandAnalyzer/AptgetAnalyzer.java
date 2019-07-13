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

package org.eclipse.winery.tools.deployablecomponents.fileanalyzer.CommandAnalyzer;

import org.eclipse.winery.tools.deployablecomponents.commons.Component;

import java.util.ArrayList;
import java.util.List;

// apt-get [Options] install PAKET1 [PAKET2]
public class AptgetAnalyzer implements CommandAnalyzer {
    public List<Component> analyze(String command) {
        if (!command.contains(" install ")) {
            return new ArrayList<>();
        }
        command = command.replace(Commands.AptGet.asString(), "");
        String[] words = command.split("\\s");
        List<String> packets = new ArrayList<>();

        for (String word : words) {
            if (word.length() > 0 && word.charAt(0) != '-') {
                packets.add(word);
            }
            // remove RUN and "install" itself
            if (word.equals("install")) {
                packets.clear();
            }
        }
        return parseComponents(packets);
    }

    private List<Component> parseComponents(List<String> packets) {
        List<Component> components = new ArrayList<>();
        for (String packet : packets) {
            String version = "undefined";
            String name = packet;
            if (packet.contains("=")) {
                version = packet.substring(packet.indexOf('=') + 1);
                name = packet.substring(0, packet.indexOf('='));
            }
            components.add(new Component(name, version, "equals"));
        }
        return components;
    }
}
