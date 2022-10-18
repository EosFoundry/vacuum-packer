import { FunctionDeclaration, Comment } from 'estree'

import { inspect } from 'node:util';
import chalk from 'chalk';
import { PluginCallable } from '../types/global';

const msg = console.log

// regex searching for asterisks at the beginning of comment lines
const CommentAsteriskRegex = /^[\ \t]*\*[\ \t]*/gm

/**
 * 
 * @param comLst list of comments in ESTree format 
 * @param fncLst 
 * @returns 
 */
export function matchComments(
  comLst: Comment[],
  fncLst: FunctionDeclaration[]
): PluginCallable[] {
  let commentedFunctions = []

  let fIdx = 0;
  let cIdx = 0;
  let targetLine = 0;

  fncLst.forEach((func) => {
    if (typeof func.loc !== 'undefined') {

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
        if (typeof comment.loc !== 'undefined') {
          return comment.loc.end.line === (start.line - 1);
        }
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


      commentedFunctions.push(commentFunc)
    }
  })
  return commentedFunctions
}