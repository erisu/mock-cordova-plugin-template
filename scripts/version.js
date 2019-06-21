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

/**
 * Release Steps
 *
 * // This line bumps the package for a `major` release and store the version in the environment variable `PACKAGE_RELEASE_VERSION`.
 * // If you  plan to release anything other then `major`, change the cli argument `major` to the desired release target.
 * // Other valid options are `patch` or `minor`.
 * export PACKAGE_RELEASE_VERSION=$(npm --no-git-tag-version version major | head -n 1)
 *
 * // NOTE!: this script will execute after `npm` runs the `version` bump process. This script handle the `plugin.xml` file updates.
 *
 * // Remove the `package-lock.json` file before adding and commiting to repo. This file is current not commited to repo.
 * rm -rf package-lock.json
 *
 * // Add, commit, create tag, and push to master + tag
 * git add .
 * git commit -S -m ":bookmark: Bump release version ${PACKAGE_RELEASE_VERSION}"
 * git tag ${PACKAGE_RELEASE_VERSION}
 * git push origin master --tags
 *
 * // Run the version script to append suffix `-dev`
 * npm run version -- --dev
 *
 * // Add, commit, and push to master `-dev` suffix.
 * git add .
 * git commit -S -m "Set -dev suffix"
 * git push origin master
 */
const path = require('path');
const { existsSync, readFileSync, writeFile } = require('fs');
const { xml2json, json2xml } = require('xml-js');
const execa = require('execa');

const _ROOT = path.join(require.main.filename, '..', '..');

class Git {
    add () {
        return execa('git', ['add', '.']);
    }

    commit (message) {
        return execa('git', ['commit', '-S', '-m', message]);
    }

    push (branch) {
        return execa('git', ['push', 'origin', branch]);
    }

    pushTag () {
        return execa('git', ['push', '--tags']);
    }

    status () {
        return execa('git', ['status', '-s']);
    }

    tag (tag) {
        return execa('git', ['tag', tag]);
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
        this.git = new Git();
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
        return writeFile(
            this.pluginXmlPath,
            newPluginXml + '\n',
            'utf8'
        );
    }

    run () {
        return Promise.resolve()
            .then(this._updatePluginXml.bind(this))
            .then(() => {
                (async () => {
                    console.info('[git] Files to be commited:');
                    const { stdout } = await this.git.status();
                    console.info(stdout);
                })();

                (async () => {
                    console.info('[git] Adding files to commit');
                    const { stdout } = await this.git.add();
                    console.info(stdout);
                })();

                (async () => {
                    console.info('[git] Commiting bump verion.');
                    const { stdout } = await this.git.commit(`:bookmark: Release bump version: ${this.pkgJson.version}`);
                    console.info(stdout);
                })();

                (async () => {
                    if (!this.pkgJson.version.includes('-dev'))  {
                        console.info(`[git] Creating new tag: ${this.pkgJson.version}`);
                        const { stdout } = await this.git.tag(this.pkgJson.version);
                        console.info(stdout);
                    }
                })();

                (async () => {
                    console.info('[git] Pushing new tag to origin');
                    const { stdout } = await this.git.pushTag();
                    console.info(stdout);
                })();

                (async () => {
                    const branch = 'master';
                    console.info(`[git] Pushing commit to ${branch}`);
                    const { stdout } = await this.git.push(branch);
                    console.info(stdout);
                })();
            });
    }
}

const versionPostProcess = new VersionPostProcess();

versionPostProcess.run();
