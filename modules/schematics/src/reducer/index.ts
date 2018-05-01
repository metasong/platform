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
import * as schematicUtils from '@ngrx/store/schematics';
import { Schema as ReducerOptions } from './schema';

export default function(options: ReducerOptions): Rule {
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
            options.group ? 'reducers' : ''
          ),
        ...(options as object),
        dot: () => '.',
      } as any),
    ]);

    return chain([
      branchAndMerge(
        chain([
          filter(path => !path.includes('node_modules')),
          schematicUtils.addReducerToState(options),
        ])
      ),
      branchAndMerge(
        chain([
          filter(
            path =>
              path.endsWith('.module.ts') &&
              !path.endsWith('-routing.module.ts')
          ),
          schematicUtils.addReducerImportToNgModule(options),
          mergeWith(templateSource),
        ])
      ),
    ])(host, context);
  };
}
