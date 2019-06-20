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
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { xml2json, json2xml } = require('xml-js');
const nopt = require('nopt');

const _ROOT = path.join(require.main.filename, '..', '..');

/**
 * Do not continue if plugin.xml file missing.
 */
const plguinXmlPath = path.resolve(_ROOT, 'plugin.xml');
if (!existsSync(plguinXmlPath)) {
    throw new Error('Missing plugin.xml file.');
}

/**
 * Load package.json
 * - Used to get current version
 */
const pkgJsonPath = path.resolve(_ROOT, 'package.json');
const pkgJson = require(pkgJsonPath);

/**
 * Gets User Arguments
 * - dev: append "-dev" suffix if set
 */
console.info(`[setup] Storing user defined arguments.`);
const args = nopt({ dev: Boolean }, {}, process.argv, 0);

// Update with `-dev` prefix if dev flag set.
if (args.dev) {
    console.info(`[setup] Dev release flag detected`);
    pkgJson.version = `${pkgJson.version}-dev`;
    console.info(`[setup] Setting version: ${pkgJson.version}`);
}

/**
 * 1. Reads `plugin.xml` into variable
 * 2. Converts XML string to JSON
 * 3. Updates the plugin's version
 * 4. Converts JSON back to XML
 * 5. Writes out to `plugin.xml`
 */
// Read in current plugin.xml file.
console.info(`[plugin.xml] Reading original file`);
const plguinXml = readFileSync(plguinXmlPath);

// Convert plugin.xml content to JSON
console.info(`[plugin.xml] Converting XML to JSON`);
const pluginXmlJson = JSON.parse(xml2json(plguinXml, { compact: false, spaces: 0 }));

// Update plugin.xml version.
console.info(`[plugin.xml] Updating version to: ${pkgJson.version}`);
for (let i = 0; i <= pluginXmlJson.elements.length; i++) {
    let e = pluginXmlJson.elements[i];

    if (e.type === 'element' && e.name === 'plugin') {
        e.attributes.version = pkgJson.version;
        break;
    }
}

// Write back to XML
console.info(`[plugin.xml] Converting JSON back to XML`);
const newPluginXml = json2xml(JSON.stringify(pluginXmlJson), { compact: false, spaces: 4 });

// // Write out updatetd plugin.xml
console.info(`[plugin.xml] Updating original plugin.xml`);
writeFileSync(plguinXmlPath, newPluginXml + '\n');

/**
 * Updating Package-Lock if it exists and for Dev
 */
const pkgJsonLockPath = path.resolve(_ROOT, 'package-lock.json');
console.info(`[package-lock.json] Discovering package-lock.json file`);
if (existsSync(pkgJsonLockPath)) {
    if (args.dev) {
        // Get package-lock
        const packageLock = require(pkgJsonLockPath);

        // Update only the package version
        console.info(`[package-lock.json] Updating version to: ${pkgJson.version}`);
        packageLock.version = pkgJson.version;

        // Write it back out
        console.info(`[package-lock.json] Updating original package-lock.json`);
        writeFileSync(
            pkgJsonLockPath,
            JSON.stringify(packageLock, null, 2) + '\n',
            'utf8'
        );
    } else {
        console.info(`[package-lock.json] No change required`);
    }
} else {
    console.info(`[package-lock.json] File not detected`);
}

if (args.dev) {
    // Write out changed package.json with the -dev prefix
    console.info(`[package.json] Updating original package.json with updated version: ${pkgJson.version}`);
    writeFileSync(
        pkgJsonPath,
        JSON.stringify(pkgJson, null, 2) + '\n',
        'utf8'
    );
}
