import { normalize } from '@angular-devkit/core';
import {
  Rule,
  SchematicsException,
  apply,
  branchAndMerge,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  template,
  url,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import * as schematicUtils from '@ngrx/schematics-core';
import { Schema as EntityOptions } from './schema';

export default function(options: EntityOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = schematicUtils.getProjectPath(host, options);

    if (options.module) {
      options.module = schematicUtils.findModuleFromOptions(host, options);
    }

    const templateSource = apply(url('./files'), [
      options.spec ? noop() : filter(path => !path.endsWith('__spec.ts')),
      template({
        ...schematicUtils,
        'if-flat': (s: string) => (options.flat ? '' : s),
        'group-actions': (name: string) =>
          schematicUtils.group(name, options.group ? 'actions' : ''),
        'group-models': (name: string) =>
          schematicUtils.group(name, options.group ? 'models' : ''),
        'group-reducers': (s: string) =>
          schematicUtils.group(s, options.group ? 'reducers' : ''),
        ...(options as object),
        dot: () => '.',
      } as any),
    ]);

    return chain([
      schematicUtils.addReducerToState({ ...options }),
      schematicUtils.addReducerImportToNgModule({ ...options }),
      branchAndMerge(chain([mergeWith(templateSource)])),
    ])(host, context);
  };
}
