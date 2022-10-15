// types
import { Manifest } from './types/global';
import { FunctionDeclaration, Comment, Program, Node, SourceLocation } from 'estree';
// javascript parse/manipulation tooling
import { parse as espreeParse } from 'espree'
import { simple as acornSimpleWalk } from 'acorn-walk'
// file system tools
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync, existsSync } from 'fs';
import { exec } from 'node:child_process'
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Msg, strfy } from './utils';

// cli
import { inspect } from 'node:util';
import chalk from 'chalk';

// pull in default rollup config
import defaultRollupConfig from './rollup.vp.template.js'

const msg = Msg(chalk.grey('VACUUM_PACKER'));

const workingDir = process.cwd()

const vacpacDir = dirname(fileURLToPath(import.meta.url));

// regex searching for asterisks at the beginning of comment lines
const CommentAsteriskRegex = /^[\ \t]*\*[\ \t]*/gm

msg(`Operating in ${workingDir}...\n`)

function pullFile(directory:string, path: string): string {
  return readFileSync(
      join(directory, path),
      'utf-8'
    )
}

const packageJson = JSON.parse(pullFile(workingDir,'package.json'))




let parseOptions = {
  comment: true,
  loc: true,
  sourceType: "module",
  ecmaVersion: 'latest',
}

let unextracted: FunctionDeclaration[] = []
let exported: string[] = []
let manifest: Manifest = {
  name: packageJson.name,
  version: packageJson.version,
  functions: [],
}

// load up the plugin entry file
const sourceString = readFileSync(join(workingDir, packageJson.main), { encoding: 'utf-8' })


// build source tree with parser
const ast: Program = espreeParse(sourceString, parseOptions);

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
      // deleteIndices(node) as ESTree.FunctionDeclaration
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
  return (exported.includes(funcDec.id.name))
})

let toaster;
if (parseOptions.loc === true
  && parseOptions.comment === true) {
  toaster = matchComments(ast.comments, exportedFunctions)
}
manifest.functions.push(toaster)

msg(`Function metadata generation complete\n`)
writeFile('manifest.json', strfy(manifest));
msg(`Wrote 'manifest.json' to ${chalk.yellow('\'' + join(workingDir, 'manifest.json') + '\'')}\n`)

const rollupConf = pullFile(vacpacDir,'rollup.vp.template.js')
msg(rollupConf)

// exec('npx rollup -c', (error, stdout, stderr) => {
//   if (error) {
//     console.error(`exec error: ${error}`);
//     return;
//   }
//   console.log(`stdout: ${stdout}`);
//   console.error(`stderr: ${stderr}`);
// });

// ----- HELPER FUNCTIONS



/**
 * 
 * @param comLst list of comments in ESTree format 
 * @param fncLst 
 * @returns 
 */
function matchComments(
  comLst: Comment[],
  fncLst: FunctionDeclaration[]
): FunctionDeclaration[] {
  let commentedFunctions = []

  let fIdx = 0;
  let cIdx = 0;
  let targetLine = 0;

  fncLst.forEach((func) => {
    const start = func.loc.start
    const end = func.loc.end


    // generate simplified function metadata object 
    // from FunctionDeclaration Node
    const commentFunc = {
      identifier: func.id.name,
      params: func.params.map((param: any) => {
        return { name: param.name }
      }),
      docString: '',
      async: func.async,
      generator: func.generator,
    }

    const comment = comLst.filter((comment) => {
      return comment.loc.end.line === (start.line - 1);
    }).pop() // <- filter always returns an array
    // but in this case it needs to be a single element

    // comment will be undefined if filter returns nothing
    // lol imagine doing monads here
    if (typeof comment !== 'undefined') {

      // Generate the docString
      let docString = comment.value;
      if (comment.type.toString() == 'Block') {
        docString = docString.replace(CommentAsteriskRegex, '')
        docString = docString.replace(/\r/g, '') // fucking windows CRLF bs
        docString = docString.trim()
      }
      commentFunc.docString = docString
    }

    // some fancy output building shenanigans
    let logString = chalk.cyanBright('Found export\n  ')
    if (commentFunc.async) { logString += chalk.red('async ') }
    logString += chalk.bold.blue(commentFunc.identifier) + ' ('

    if (commentFunc.params.length > 0) {
      commentFunc.params.forEach((p) => { logString += chalk.magenta(p.name) + ', ' })
      logString = logString.slice(0, -2)
    }

    logString += ')\n  ' + chalk.white('docString') + ' : '
    if (commentFunc.docString !== '') {
      logString += '\n' + chalk.green(commentFunc.docString.replace(/^/gm, '    | ')) + '\n\n'
    } else { logString += 'none found\n\n' }

    logString += chalk.grey('created metadata object: ')
      + inspect(commentFunc, { colors: true })
      + '\n'

    msg(logString)
    // end of fancy output building shenanigans

    commentedFunctions.push(commentFunc)
  })

  return commentedFunctions
}

function ingestExportDeclaration(node) {
  let newNode = node;
  // console.dir(node, { depth: 4 })
  if (node.declaration !== null) {// test for direct declaration or specifier
    if (node.declaration.type === 'FunctionDeclaration') {
      exported.push(node.declaration.id.name)
    }
  } else if (node.specifiers !== null) { // if export is specifier
    for (const spec of node.specifiers) {
      exported.push(spec.exported.name)
    }
  }
}