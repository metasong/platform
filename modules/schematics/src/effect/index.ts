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
  noop,
  template,
  url,
} from '@angular-devkit/schematics';
import * as ts from 'typescript';
import * as schematicUtils from '@ngrx/schematics-core';
import { Schema as EffectOptions } from './schema';

function addImportToNgModule(options: EffectOptions): Rule {
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

    const effectsName = `${schematicUtils.classify(`${options.name}Effects`)}`;

    const effectsModuleImport = schematicUtils.insertImport(
      source,
      modulePath,
      'EffectsModule',
      '@ngrx/effects'
    );

    const effectsPath =
      `/${options.path}/` +
      (options.flat ? '' : schematicUtils.dasherize(options.name) + '/') +
      (options.group ? 'effects/' : '') +
      schematicUtils.dasherize(options.name) +
      '.effects';
    const relativePath = schematicUtils.buildRelativePath(
      modulePath,
      effectsPath
    );
    const effectsImport = schematicUtils.insertImport(
      source,
      modulePath,
      effectsName,
      relativePath
    );
    const [effectsNgModuleImport] = schematicUtils.addImportToModule(
      source,
      modulePath,
      `EffectsModule.for${options.root ? 'Root' : 'Feature'}([${effectsName}])`,
      relativePath
    );
    const changes = [effectsModuleImport, effectsImport, effectsNgModuleImport];
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

export default function(options: EffectOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = schematicUtils.getProjectPath(host, options);

    if (options.module) {
      options.module = schematicUtils.findModuleFromOptions(host, options);
    }

    const templateSource = apply(url('./files'), [
      options.spec ? noop() : filter(path => !path.endsWith('__spec.ts')),
      template({
        ...schematicUtils,
        'if-flat': (s: string) =>
          schematicUtils.group(
            options.flat ? '' : s,
            options.group ? 'effects' : ''
          ),
        ...(options as object),
        dot: () => '.',
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
