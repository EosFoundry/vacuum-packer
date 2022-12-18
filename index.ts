// types
import {
  FunctionDeclaration,
  Comment,
  Program,
  BaseModuleDeclaration,
} from 'estree';

// javascript parse/manipulation tooling
import { parse as espreeParse } from 'espree'
import { simple as acornSimpleWalk } from 'acorn-walk'
import { matchComments } from './src/ast-helpers';

// file system tools
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync, existsSync } from 'fs';
import { exec } from 'node:child_process'
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// cli
import { Msg, strfy } from './src/utils';
import { inspect } from 'node:util';
import chalk from 'chalk';

// pull in default rollup config
import { writeFileSync } from 'node:fs';

const msg = Msg(chalk.grey('VACUUM_PACKER'));

const workingDir = process.cwd()

const vacpacDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// regex searching for asterisks at the beginning of comment lines
const CommentAsteriskRegex = /^[\ \t]*\*[\ \t]*/gm

msg(`Operating in ${workingDir}...\n`)

function pullFile(directory: string, path: string): string {
  return readFileSync(
    join(directory, path),
    'utf-8'
  )
}

const packageJson = JSON.parse(pullFile(workingDir, 'package.json'))

let parseOptions = {
  comment: true,
  loc: true,
  sourceType: "module",
  ecmaVersion: 'latest',
}

let unextracted: FunctionDeclaration[] = []
let exportedFunctionNames: string[] = []
let manifest: Manifest = {
  name: packageJson.name,
  version: packageJson.version,
  functions: [],
}

// load up the plugin entry file
const sourceString = readFileSync(join(workingDir, packageJson.main), { encoding: 'utf-8' })


// build source tree with parser
const ast: Program = espreeParse(sourceString, parseOptions);

// check if there is a rollup.config.js file in the project already
const pluginHasRollupConf = existsSync(join(workingDir, 'rollup.config.js'))
msg(`rollupconf existence: ${pluginHasRollupConf}`)

/**
 * walks through the AST to extract all the exports
 * along with any comments
 */
acornSimpleWalk(ast as unknown as acorn.Node, {
  /**
   * Finds and records all 'FunctionDeclaration' nodes into a temporary
   * array. The node.body is deleted here to save some space/processing
   */
  FunctionDeclaration(node: any) {
    // msg(`FunctionDeclaration found with name: ${node.id.name}`)
    // console.dir(node, { depth: 4 })
    if (typeof node.body === 'object') {
      delete node.body
    }
    unextracted.push(
      node
    )
  },

  /**
   * Finds and records the names of all Default declarations,
   * i.e. declarations of the form:
   * `export default ...`
   */
  ExportDefaultDeclaration(node: any) {
    // msg('ExportDefaultDeclaration')
    ingestExportDeclaration(node)
  },
  /**
   * Finds and records the names of all Named declarations,
   * i.e. declarations of the from:
   * `export function|const|let|var ...`
   * `export { Name }`
   * `export { Name as NewName}`
   */
  ExportNamedDeclaration(node: any) {
    // msg('ExportNamedDeclaration')
    ingestExportDeclaration(node)
  }
})


// filters all found FunctionDeclarations by removing all declarations
// that were not exported
const exportedFunctions = unextracted.filter((funcDec) => {
  return (exportedFunctionNames.includes(funcDec.id.name))
})

// check for comments and match them to the function they belong to
// this also retypes the function objects to PluginCallable
let manifestReadyFunctions: PluginCallable[]
let commentSection: Comment[] = []
if (parseOptions.loc === true && parseOptions.comment === true) {
  commentSection = ast.comments
}
manifestReadyFunctions = matchComments(commentSection, exportedFunctions)

// log output to cli
manifestReadyFunctions.forEach((func) => {
  let logString = chalk.cyanBright('Found export\n  ')
  if (func.async) { logString += chalk.red('async ') }
  logString += chalk.bold.blue(func.identifier) + ' ('

  if (func.params.length > 0) {
    func.params.forEach((p) => { logString += chalk.magenta(p.name) + ', ' })
    logString = logString.slice(0, -2)
  }

  logString += ')\n  ' + chalk.white('docString') + ' : '
  if (func.docString !== '') {
    logString += '\n' + chalk.green(func.docString.replace(/^/gm, '    | ')) + '\n\n'
  } else { logString += 'none found\n\n' }

  logString += chalk.grey('created metadata object: ')
    + inspect(func, { colors: true })
    + '\n'

  msg(logString)
})

manifest.functions.push(...manifestReadyFunctions)

msg(`Function metadata generation complete\n`)
writeFile('manifest.json', strfy(manifest));
msg(`Wrote 'manifest.json' to ${chalk.yellow('\'' + join(workingDir, 'manifest.json') + '\'')}\n`)


// if the project doesn't come with a rollup config, pull up the template
if (pluginHasRollupConf === false) {
  let rollupConf = pullFile(vacpacDir, 'rollup.template.js')
  const rollupNameRegex = /<PluginName>/g
  const rollupMainRegex = /<PluginMain>/g
  const main = packageJson.main.replace('/','_');

  rollupConf = rollupConf.replace(rollupNameRegex, packageJson.name)
  rollupConf = rollupConf.replace(rollupMainRegex, main)

  let rollupFileMsg = `Modifying default rollup config file...\n`
    + chalk.yellow(join(vacpacDir, `rollup.template.js`))
    + `\n---\n${rollupConf}`

  msg(rollupFileMsg)
  writeFileSync(join(workingDir, 'rollup.config.js'), rollupConf)
}

msg(`executing ${chalk.yellowBright(`'npx rollup --config rollup.config.js'`)}`)

// call rollup from the command line
exec('npx rollup --config rollup.config.js', (error, stdout, stderr) => {
  if (error) {
    console.error(`error while running 'npx rollup --config rollup.config.js' : ${error}`);
  } else {
    msg(`stdout: ${stdout}`);
    msg(`stderr: ${stderr}`);
  }
});

/**
 * Checks for the type of declaration and pushes the name of the export
 * into the list of exported functions
 * @param node Declaration node
 */
function ingestExportDeclaration(node) {
  let newNode = node;
  // console.dir(node, { depth: 4 })
  if (node.declaration !== null) {// test for direct declaration or specifier
    if (node.declaration.type === 'FunctionDeclaration') {
      exportedFunctionNames.push(node.declaration.id.name)
    }
  } else if (node.specifiers !== null) { // if export is specifier
    for (const spec of node.specifiers) {
      exportedFunctionNames.push(spec.exported.name)
    }
  }
}