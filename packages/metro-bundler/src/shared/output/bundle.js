/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

'use strict';

const Server = require('../../Server');

const meta = require('./meta');
const relativizeSourceMap = require('../../lib/relativizeSourceMap');
const writeFile = require('./writeFile');

import type Bundle from '../../Bundler/Bundle';
import type {SourceMap} from '../../lib/SourceMap';
import type {OutputOptions, RequestOptions} from '../types.flow';

function buildBundle(packagerClient: Server, requestOptions: RequestOptions) {
  return packagerClient.buildBundle({
    ...Server.DEFAULT_BUNDLE_OPTIONS,
    ...requestOptions,
    isolateModuleIDs: true,
  });
}

function createCodeWithMap(
  bundle: Bundle,
  dev: boolean,
  sourceMapSourcesRoot?: string,
): {code: string, map: SourceMap} {
  const map = bundle.getSourceMap({dev});
  const sourceMap = relativizeSourceMap(
    typeof map === 'string' ? (JSON.parse(map): SourceMap) : map,
    sourceMapSourcesRoot);
  return {
    code: bundle.getSource({dev}),
    map: sourceMap,
  };
}
// created peanut
function createBundleManifest(bundle) {
  return JSON.stringify(bundle.getManifest(), null, 2);
}
function saveBundleAndMap(
  bundle: Bundle,
  options: OutputOptions,
  log: (...args: Array<string>) => {},
): Promise<> {
  const {
    bundleOutput,
    bundleEncoding: encoding,
    dev,
    sourcemapOutput,
    sourcemapSourcesRoot,
  } = options;

  log('start');
  const origCodeWithMap = createCodeWithMap(bundle, !!dev, sourcemapSourcesRoot);
  const codeWithMap = bundle.postProcessBundleSourcemap({
    ...origCodeWithMap,
    outFileName: bundleOutput,
  });
  log('finish');

  log('Writing bundle output to:', bundleOutput);

  const {code} = codeWithMap;
  const writeBundle = writeFile(bundleOutput, code, encoding);
  const writeMetadata = writeFile(
    bundleOutput + '.meta',
    meta(code, encoding),
    'binary');
  Promise.all([writeBundle, writeMetadata])
    .then(() => log('Done writing bundle output'));
  const writeTasks = [writeBundle];
  if (sourcemapOutput) {
    log('Writing sourcemap output to:', sourcemapOutput);
    const map = typeof codeWithMap.map !== 'string'
      ? JSON.stringify(codeWithMap.map)
      : codeWithMap.map;
    const writeMap = writeFile(sourcemapOutput, map, null);
    writeMap.then(() => log('Done writing sourcemap output'));
    writeTasks.push(writeMap);
  }
  // peanut 增加输出 模块json 文件
  if (manifestOutput) {
    log('Writing manifest output to:', manifestOutput);
    const manifest = createBundleManifest(bundle);
    const writeManifest = writeFile(manifestOutput, manifest, null);
    writeManifest.then(() => log('Done writing manifest output'));
    writeTasks.push(writeManifest);
  }
  return Promise.all(writeTasks);
}

exports.build = buildBundle;
exports.save = saveBundleAndMap;
exports.formatName = 'bundle';
