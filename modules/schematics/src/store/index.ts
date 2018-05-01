import { normalize } from '@angular-devkit/core';
import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
  apply,
  branchAndMerge,
  chain,
  filter,
  mergeWith,
  move,
  template,
  url,
} from '@angular-devkit/schematics';
import * as ts from 'typescript';
import * as schematicUtils from '@ngrx/store/schematics';
import { Schema as StoreOptions } from './schema';

function addImportToNgModule(options: StoreOptions): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    if (!modulePath) {
      return host;
    }

    if (!host.exists(modulePath)) {
      throw new Error('Specified module does not exist');
    }

    const text = host.read(modulePath);
    if (text === null) {
      throw new SchematicsException(`File ${modulePath} does not exist.`);
    }
    const sourceText = text.toString('utf-8');

    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    const statePath = `${options.path}/${options.statePath}`;
    const relativePath = schematicUtils.buildRelativePath(
      modulePath,
      statePath
    );
    const environmentsPath = schematicUtils.buildRelativePath(
      statePath,
      `/${options.path}/environments/environment`
    );

    const storeNgModuleImport = schematicUtils
      .addImportToModule(
        source,
        modulePath,
        options.root
          ? `StoreModule.forRoot(reducers, { metaReducers })`
          : `StoreModule.forFeature('${schematicUtils.camelize(
              options.name
            )}', from${schematicUtils.classify(
              options.name
            )}.reducers, { metaReducers: from${schematicUtils.classify(
              options.name
            )}.metaReducers })`,
        relativePath
      )
      .shift();

    let commonImports = [
      schematicUtils.insertImport(
        source,
        modulePath,
        'StoreModule',
        '@ngrx/store'
      ),
      options.root
        ? schematicUtils.insertImport(
            source,
            modulePath,
            'reducers, metaReducers',
            relativePath
          )
        : schematicUtils.insertImport(
            source,
            modulePath,
            `* as from${schematicUtils.classify(options.name)}`,
            relativePath,
            true
          ),
      storeNgModuleImport,
    ];
    let rootImports: (schematicUtils.Change | undefined)[] = [];

    if (options.root) {
      const storeDevtoolsNgModuleImport = schematicUtils
        .addImportToModule(
          source,
          modulePath,
          `!environment.production ? StoreDevtoolsModule.instrument() : []`,
          relativePath
        )
        .shift();

      rootImports = rootImports.concat([
        schematicUtils.insertImport(
          source,
          modulePath,
          'StoreDevtoolsModule',
          '@ngrx/store-devtools'
        ),
        schematicUtils.insertImport(
          source,
          modulePath,
          'environment',
          environmentsPath
        ),
        storeDevtoolsNgModuleImport,
      ]);
    }

    const changes = [...commonImports, ...rootImports];
    const recorder = host.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof schematicUtils.InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);

    return host;
  };
}

export default function(options: StoreOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = schematicUtils.getProjectPath(host, options);

    const statePath = `/${options.path}/${options.statePath}/index.ts`;
    const environmentsPath = schematicUtils.buildRelativePath(
      statePath,
      `/${options.path}/environments/environment`
    );

    if (options.module) {
      options.module = schematicUtils.findModuleFromOptions(host, options);
    }

    if (
      options.root &&
      options.stateInterface &&
      options.stateInterface !== 'State'
    ) {
      options.stateInterface = schematicUtils.classify(options.stateInterface);
    }

    const templateSource = apply(url('./files'), [
      template({
        ...schematicUtils,
        ...(options as object),
        environmentsPath,
      } as any),
    ]);

    return chain([
      branchAndMerge(
        chain([
          filter(
            path =>
              path.endsWith('.module.ts') &&
              !path.endsWith('-routing.module.ts')
          ),
          addImportToNgModule(options),
          mergeWith(templateSource),
        ])
      ),
    ])(host, context);
  };
}
