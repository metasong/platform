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
import * as utils from '@ngrx/store/schematics';
import { Schema as ActionOptions } from './schema';

export default function(options: ActionOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = utils.getProjectPath(host, options);

    const templateSource = apply(url('./files'), [
      options.spec ? noop() : filter(path => !path.endsWith('__spec.ts')),
      template({
        'if-flat': (s: string) =>
          utils.group(options.flat ? '' : s, options.group ? 'actions' : ''),
        ...utils,
        ...(options as object),
        dot: () => '.',
      } as any),
    ]);

    return chain([branchAndMerge(chain([mergeWith(templateSource)]))])(
      host,
      context
    );
  };
}
