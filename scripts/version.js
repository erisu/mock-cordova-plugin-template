/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

const path = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { xml2json, json2xml } = require('xml-js');
const execa = require('execa');

const _ROOT = path.join(require.main.filename, '..', '..');

class Git {
    constructor (dir) {
        this.dir = dir;
    }

    add () {
        console.info('[git] Adding files to commit');
        return execa.stdout('git', ['add', '.'], { cwd: this.dir });
    }

    commit (message) {
        console.info(`[git] Commiting bump verion with message: ${message}`);
        return execa.stdout('git', ['commit', '-S', '-m', message], { cwd: this.dir });
    }

    push (branch) {
        console.info(`[git] Pushing commit to ${branch}`);
        return execa.stdout('git', ['push', 'origin', branch], { cwd: this.dir });
    }

    pushTag () {
        console.info('[git] Pushing tags to origin');
        return execa.stdout('git', ['push', '--tags'], { cwd: this.dir });
    }

    status () {
        return execa.stdout('git', ['status', '-s'], { cwd: this.dir }).then(stdout => {
            console.info('[git] Files to be commited:');
            console.info(stdout);
        });
    }

    tag (tag) {
        console.info(`[git] Creating new tag: ${tag}`);
        return execa.stdout('git', ['tag', tag], { cwd: this.dir });
    }
}

class VersionPostProcess {
    constructor () {
        /**
         * Load package.json
         * - Used to get current version
         */
        console.info(`[setup] Loading package.json`);
        this.pkgJsonPath = path.resolve(_ROOT, 'package.json');
        this.pkgJson = require(this.pkgJsonPath);

        // Setup for Git Commands
        this.git = new Git(_ROOT);
    }

    _loadPluginXml () {
        /**
         * Do not continue if plugin.xml file missing.
         */
        this.pluginXmlPath = path.resolve(_ROOT, 'plugin.xml');
        if (!existsSync(this.pluginXmlPath)) {
            throw new Error('Missing plugin.xml file.');
        }

        /**
         * 1. Reads `plugin.xml` into variable
         * 2. Converts XML string to JSON
         * 3. Updates the plugin's version
         * 4. Converts JSON back to XML
         * 5. Writes out to `plugin.xml`
         */
        // Read in current plugin.xml file.
        console.info(`[plugin.xml] Fetching original file`);
        const plguinXml = readFileSync(this.pluginXmlPath);

        // Convert plugin.xml content to JSON
        console.info(`[plugin.xml] Converting XML to JSON`);
        this.pluginXmlJson = JSON.parse(xml2json(plguinXml, { compact: false, spaces: 0 }));
    }

    _updatePluginXml () {
        if (!this.pluginXmlJson) {
            this._loadPluginXml();
        }

        // Update plugin.xml version.
        console.info(`[plugin.xml] Updating version to: ${this.pkgJson.version}`);
        for (let i = 0; i <= this.pluginXmlJson.elements.length; i++) {
            let e = this.pluginXmlJson.elements[i];

            if (e.type === 'element' && e.name === 'plugin') {
                e.attributes.version = this.pkgJson.version;
                break;
            }
        }

        // Write back to XML
        console.info(`[plugin.xml] Converting JSON back to XML`);
        const newPluginXml = json2xml(JSON.stringify(this.pluginXmlJson), { compact: false, spaces: 4 });

        // // Write out updatetd plugin.xml
        console.info(`[plugin.xml] Updating original plugin.xml`);
        writeFileSync(
            this.pluginXmlPath,
            newPluginXml + '\n',
            'utf8'
        );

        return Promise.resolve();
    }

    run () {
        return Promise.resolve()
            .then(() => this._updatePluginXml())
            .then(() => this.git.status())
            .then(() => this.git.add())
            .then(() => this.git.commit(
                !this.pkgJson.version.includes('-dev')
                    ? `:bookmark: Release bump version: ${this.pkgJson.version}`
                    : `:gear: Bump dev version: ${this.pkgJson.version}`
            ))
            .then(() => this.git.push(`master`))
            .then(() => !this.pkgJson.version.includes('-dev')
                ? this.git.tag(`draft/${this.pkgJson.version}`)
                : Promise.resolve()
            )
            .then(() => !this.pkgJson.version.includes('-dev')
                ? this.git.pushTag()
                : Promise.resolve()
            );
    }
}

const versionPostProcess = new VersionPostProcess();

versionPostProcess.run();
