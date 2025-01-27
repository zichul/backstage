/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { relative as relativePath } from 'path';
import { buildPackages, getOutputsForRole } from '../../lib/builder';
import { PackageGraph } from '../../lib/monorepo';
import { ExtendedPackage } from '../../lib/monorepo/PackageGraph';
import { paths } from '../../lib/paths';
import { getRoleInfo } from '../../lib/role';
import { buildApp } from '../build/buildApp';
import { buildBackend } from '../build/buildBackend';

function createScriptOptionsParser(anyCmd: Command, commandPath: string[]) {
  // Regardless of what command instance is passed in we want to find
  // the root command and resolve the path from there
  let rootCmd = anyCmd;
  while (rootCmd.parent) {
    rootCmd = rootCmd.parent;
  }

  // Now find the command that was requested
  let targetCmd = rootCmd as Command | undefined;
  for (const name of commandPath) {
    targetCmd = targetCmd?.commands.find(c => c.name() === name) as
      | Command
      | undefined;
  }

  if (!targetCmd) {
    throw new Error(`Could not find script command '${commandPath.join(' ')}'`);
  }
  const cmd = targetCmd;

  const expectedScript = `backstage-cli ${commandPath.join(' ')}`;

  return (scriptStr?: string) => {
    if (!scriptStr || !scriptStr.startsWith(expectedScript)) {
      return undefined;
    }

    const argsStr = scriptStr.slice(expectedScript.length).trim();

    // Can't clone or copy or even use commands as prototype, so we mutate
    // the necessary members instead, and then reset them once we're done
    const currentOpts = cmd._optionValues;
    const currentStore = cmd._storeOptionsAsProperties;

    const result: Record<string, any> = {};
    cmd._storeOptionsAsProperties = false;
    cmd._optionValues = result;

    // Triggers the writing of options to the result object
    cmd.parseOptions(argsStr.split(' '));

    cmd._storeOptionsAsProperties = currentOpts;
    cmd._optionValues = currentStore;

    return result;
  };
}

export async function command(cmd: Command): Promise<void> {
  const packages = await PackageGraph.listTargetPackages();
  const bundledPackages = new Array<ExtendedPackage>();

  const parseBuildScript = createScriptOptionsParser(cmd, ['script', 'build']);

  const options = packages.flatMap(pkg => {
    const role = pkg.packageJson.backstage?.role;
    if (!role) {
      console.warn(`Ignored ${pkg.packageJson.name} because it has no role`);
      return [];
    }

    const outputs = getOutputsForRole(role);
    if (outputs.size === 0) {
      if (getRoleInfo(role).output.includes('bundle')) {
        bundledPackages.push(pkg);
      } else {
        console.warn(
          `Ignored ${pkg.packageJson.name} because it has no output`,
        );
      }
      return [];
    }

    const buildOptions = parseBuildScript(pkg.packageJson.scripts?.build);
    if (!buildOptions) {
      console.warn(
        `Ignored ${pkg.packageJson.name} because it does not have a matching build script`,
      );
      return [];
    }

    return {
      targetDir: pkg.dir,
      outputs,
      logPrefix: `${chalk.cyan(relativePath(paths.targetRoot, pkg.dir))}: `,
      minify: buildOptions.minify,
      useApiExtractor: buildOptions.experimentalTypeBuild,
    };
  });

  console.log('Building packages');
  await buildPackages(options);

  if (cmd.all) {
    const apps = bundledPackages.filter(
      pkg => pkg.packageJson.backstage?.role === 'app',
    );

    console.log('Building apps');
    await Promise.all(
      apps.map(async pkg => {
        const buildOptions = parseBuildScript(pkg.packageJson.scripts?.build);
        if (!buildOptions) {
          console.warn(
            `Ignored ${pkg.packageJson.name} because it does not have a matching build script`,
          );
          return;
        }
        await buildApp({
          targetDir: pkg.dir,
          configPaths: (buildOptions.config as string[]) ?? [],
          writeStats: Boolean(buildOptions.stats),
        });
      }),
    );

    console.log('Building backends');
    const backends = bundledPackages.filter(
      pkg => pkg.packageJson.backstage?.role === 'backend',
    );
    await Promise.all(
      backends.map(async pkg => {
        const buildOptions = parseBuildScript(pkg.packageJson.scripts?.build);
        if (!buildOptions) {
          console.warn(
            `Ignored ${pkg.packageJson.name} because it does not have a matching build script`,
          );
          return;
        }
        await buildBackend({
          targetDir: pkg.dir,
          skipBuildDependencies: true,
        });
      }),
    );
  }
}
