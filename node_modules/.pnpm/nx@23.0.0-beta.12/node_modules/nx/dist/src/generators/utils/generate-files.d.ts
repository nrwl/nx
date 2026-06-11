import { Tree } from '../tree';
/**
 * Specify what should be done when a file is generated but already exists on the system
 */
export declare enum OverwriteStrategy {
    Overwrite = "overwrite",
    KeepExisting = "keepExisting",
    ThrowIfExisting = "throwIfExisting"
}
/**
 * Options for the generateFiles function
 */
export interface GenerateFilesOptions {
    /**
     * Specify what should be done when a file is generated but already exists on the system
     */
    overwriteStrategy?: OverwriteStrategy;
}
/**
 * Generates a folder of files based on provided templates.
 *
 * While doing so it performs two substitutions:
 * - Substitutes segments of file names surrounded by __
 * - Uses ejs to substitute values in templates
 *
 * Examples:
 * ```typescript
 * generateFiles(tree, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'})
 * ```
 * This command will take all the files from the `files` directory next to the place where the command is invoked from.
 * It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
 * `<%= name %>` with `myscript` in the files themselves.
 * `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
 * doesn't get confused about incorrect TypeScript files.
 *
 * @param tree - the file system tree
 * @param srcFolder - the source folder of files (absolute path)
 * @param target - the target folder (relative to the tree root)
 * @param substitutions - an object of key-value pairs
 * @param options - See {@link GenerateFilesOptions}
 */
export declare function generateFiles(tree: Tree, srcFolder: string, target: string, substitutions: {
    [k: string]: any;
}, options?: GenerateFilesOptions): void;
