const VibeBuilder = require('./builder')
const json5 = require('json5')
const path = require('path')

const prism = require('prismjs')
const prismLoadLanguages = require('prismjs/components/')
prismLoadLanguages(['yaml', 'markdown', 'json5', 'ruby', 'python'])

/** gets or adds attributes object to args list when proxying calls to tag builder
 * note, this sometimes changes the args array to inject an object, beware side-effects
 * @param {Array} - args list
 * @returns {object}
 */
const getAttribs = (args) => {
  let opts = args.find(x => typeof x === 'object' && x !== null /* I hate you */)
  if (!opts) args.push(opts = {})
  return opts
}
/** append class names to attributes object
 * @param {*} attributes - attributes object
 * @param {*} className - className string to append
 */
const appendClass = (attributes, ...classNames) => {
  if (!Array.isArray(attributes.class)) attributes.class = [attributes.class].flat().filter(x => typeof x === 'string')
  attributes.class.push(...classNames)
}

class RichVibeBuilder extends VibeBuilder {
  /** renders glitch styled text
   * @param {string|function} - string contents or function block body
   */
  glitch (contents) { return this.span({ class: 'styled-text glitch' }, contents) }

  /** renders retro styled text
   * @param {string|function} - string contents or function block body
   */
  retro (contents) { return this.span({ class: 'styled-text retro' }, contents) }

  /** renders bold styled text
   * @param {string|function} - string contents or function block body
   */
  bold (contents) { return this.span({ class: 'styled-text bold' }, contents) }

  /** renders retro styled text
   * @param {string|function} - string contents or function block body
   */
  italic (contents) { return this.span({ class: 'styled-text italic' }, contents) }

  /** creates a paragraph without using the weird abbreviation html tag name */
  paragraph (...args) { return this.p(...args) }

  /** monospace text */
  monospace (contents) { return this.pre({ class: 'monospace' }, contents) }

  /** shortcut for stylesheet link tag */
  stylesheet (url, ...args) {
    const options = getAttribs(args)
    options.rel = 'stylesheet'
    options.href = url
    return this.tag('link', ...args)
  }

  /** shortcut to create a heading at a certain level */
  heading (...args) {
    const options = getAttribs(args)
    const level = options.level || 1
    delete options.level
    this.tag(`h${level}`, ...args)
  }

  // override button to support a href attribute, which emits an <a> link instead with the same styling
  button (...args) {
    const options = getAttribs(args)

    if (options.href) {
      options.role = 'button'
      this.tag('a', ...args)
    } else {
      if (options.formmethod && !['GET', 'POST'].includes(options.formmethod.toUpperCase())) {
        const containerForm = (this.forms || []).slice(-1)[0]
        const [action, ...qs] = (options.formaction || containerForm.action || '').split('?')
        const searchParams = new URLSearchParams(qs.join('?'))
        searchParams.set('_method', options.formmethod.toUpperCase())
        options.formaction = `${action}?${searchParams}`
        options.formmethod = 'POST'
      }

      this.tag('button', ...args)
    }
  }

  // overload form with method overwriting functionality
  form (...args) {
    const options = getAttribs(args)
    this.forms = this.forms || []
    this.forms.push(options) // store parent forms for button rewriting functionality

    if (options.method && !['GET', 'POST'].includes(options.method.toUpperCase())) {
      const [action, ...qs] = (options.action || '').split('?')
      const searchParams = new URLSearchParams(qs.join('?'))
      searchParams.set('_method', options.method.toUpperCase())
      options.action = `${action}?${searchParams}`
      options.method = 'POST'
    }

    const result = this.tag('form', ...args)

    if (result instanceof Promise) {
      result.then(x => this.forms.pop())
    } else {
      this.forms.pop()
    }
    return result
  }

  iconButton (iconName, ...args) {
    this.button(getAttribs(args), v => {
      const fn = args.find(x => typeof x === 'function')
      const str = args.find(x => typeof x === 'string')
      this.icon(iconName)
      if (fn) fn.call(this, this)
      if (str) this.text(str)
    })
  }

  iconLink (iconName, ...args) {
    this.a(getAttribs(args), v => {
      const fn = args.find(x => typeof x === 'function')
      const str = args.find(x => typeof x === 'string')
      this.icon(iconName)
      if (fn) fn.call(this, this)
      if (str) this.text(str)
    })
  }

  /** formats and nicely displays javascript/json code with highlighting and line numbers */
  sourceCode (code, ...args) {
    if (typeof code !== 'string') code = JSON.stringify(code)
    const options = getAttribs(args)

    // syntax highlighting
    const language = options.data && options.data.language ? options.data.language : 'javascript'
    const grammars = {
      json: prism.languages.json5,
      jsonl: prism.languages.json,
      javascript: prism.languages.js,
      yaml: prism.languages.yaml,
      xml: prism.languages.xml,
      html: prism.languages.html,
      ruby: prism.languages.ruby,
      python: prism.languages.python,
      markdown: prism.languages.markdown
    }

    const grammar = grammars[language]
    const tokens = grammar ? prism.tokenize(code, grammar) : [code]

    // converts prism token format to range objects in a flat array
    function * tokensToRanges (tokens, inheritTypes = []) {
      for (const token of tokens) {
        if (typeof token === 'string') {
          yield { text: token, types: inheritTypes }
        } else if (token instanceof prism.Token) {
          const content = Array.isArray(token.content) ? token.content : [token.content]
          yield * tokensToRanges(content, [...inheritTypes, token.type])
        }
      }
    }

    const newline = Symbol('newline')
    function * splitRangesOnLines (ranges) {
      for (const range of ranges) {
        if (range.text.includes('\n')) {
          const sections = range.text.split('\n')
          yield { text: sections.shift(), types: range.types }
          while (sections.length > 0) {
            yield newline
            yield { text: sections.shift(), types: range.types }
          }
        } else {
          yield range
        }
      }
    }

    // yield an array of all the tokens between each newline symbol
    function * arrayify (ranges) {
      let accumulator = []
      for (const range of ranges) {
        if (range === newline) {
          yield accumulator
          accumulator = []
        } else {
          accumulator.push(range)
        }
      }
      if (accumulator.length > 0) {
        yield accumulator
      }
    }

    // when two tokens are butted up against each other, and of exactly the same type, combine them
    function * stripRedundant (lines) {
      for (const line of lines) {
        if (line.length === 0) {
          yield line
        } else {
          const out = line.slice(0, 1)
          for (const piece of line.slice(1)) {
            if (piece.types.join(' ') === out[out.length - 1].types.join(' ')) {
              out[out.length - 1].text += piece.text
            } else {
              out.push(piece)
            }
          }
          yield out
        }
      }
    }

    function * simplify (lines) {
      for (const line of lines) {
        const out = []
        for (const token of line) {
          if (token.text.match(/^[ \t\r\n]*$/)) {
            out.push({ text: token.text, types: [] }) // simplify markup for whitespace content
          } else {
            out.push(token)
          }
        }
        yield out
      }
    }

    const lines = [...simplify(stripRedundant(arrayify(splitRangesOnLines(tokensToRanges(tokens)))))]

    appendClass(options, 'source-code')
    options.data = {
      ...(options.data || {}),
      language
    }
    options.style = {
      ...(options.style || {}),
      '--digits': lines.length.toString().length
    }

    this.pre(...args, v => {
      for (const ranges of lines) {
        v.code(v => {
          for (const { text, types } of ranges) {
            if (text.length > 0) {
              if (types.length > 0) {
                v.tag('p-t', { class: types }, text)
              } else {
                v.text(text)
              }
            }
          }
        })
      }
    })
  }

  objectViewer (object, format, ...args) {
    try {
      const codec = require('../models/codec')
      const fmt = codec.for(format)
      let text = fmt ? (fmt.print ? fmt.print(object) : fmt.encode(object)) : `// error, unknown format ${format}`

      if (Buffer.isBuffer(text)) {
        format = 'hexdump'
        const lineSize = 16
        const out = []
        for (let i = 0; i < text.length; i += lineSize) {
          const line = text.slice(i, i + lineSize)
          const printable = line.toString('ascii').replace(/[^ -~]+/g, '.')
          const hex = idx => `0000${line.slice(idx * 2, (idx * 2) + 2).toString('hex')}`.slice(-4)
          const location = `00000000${i.toString(16)}`.slice(-8)
          out.push(`${location}: ${hex(0)} ${hex(1)} ${hex(2)} ${hex(3)} ${hex(4)} ${hex(5)} ${hex(6)} ${hex(7)}   ${printable}`)
        }
        text = out.join('\n')
      }

      if (format === 'html') {
        this.iframe({ srcdoc: text, sandbox: '', referrerpolicy: 'strict-origin-when-cross-origin', class: 'expand object-viewer', 'data-format': format })
      } else {
        this.sourceCode(text, { class: 'expand object-viewer', data: { language: format } })
      }
    } catch (err) {
      this.sourceCode(`/* View Error: ${err.message}\n${err.stack} */`, { class: 'expand object-viewer' })
    }
  }

  // generates <input type="hidden"> tags to represent all the strings in an object like req.body
  hiddenFormData (data) {
    for (const [key, value] of Object.entries(data)) {
      this.input({ type: 'hidden', name: key, value: value })
    }
  }

  /** emits a ul.link-list with links to each thing in the data array
   * @param {Array} list - array of entries
   * @param {function} [getURL] - returns url for entry in array
   */
  linkList (list, getURL = encodeURIComponent) {
    if (list[Symbol.asyncIterator]) return this.asyncLinkList(list, getURL)
    this.ul({ class: 'link-list' }, v => {
      for (const entry of list) {
        v.li(v => v.a(entry.toString(), { href: getURL(entry) }))
      }
    })
  }

  /** emits a ul.link-list with links to each thing in the data array
   * @param {AsyncIterable} list - array of entries
   * @param {function} [getURL] - returns url for entry in array
   */
  async asyncLinkList (list, getURL = encodeURIComponent) {
    await this.ul({ class: 'link-list' }, async v => {
      for await (const entry of list) {
        v.li(v => v.a(entry.toString(), { href: getURL(entry) }))
      }
    })
  }

  /** calls callback to insert elements for each item in an iterable, and writes commas and 'and' in between
   * @param {Array} list
   * @param {function} block - defaults to emiting text
   */
  inlineList (list, block = x => this.text(`${x}`)) {
    if (list.length > 1) {
      for (const item of list.slice(0, -1)) {
        block.call(this, item)
        this.text(', ')
      }
      this.text('and ')
      block.call(this, list.slice(-1)[0])
    } else {
      block.call(this, list[0])
    }
  }

  /** breadcrumbs structure, which just emits <div class="breadcrumbs"></div> */
  breadcrumbs (...args) {
    const attribs = getAttribs(args)
    const blocks = args.filter(x => typeof x === 'function')
    args = args.filter(x => typeof x !== 'function')
    if (!attribs.class) attribs.class = []
    if (!Array.isArray(attribs.class)) attribs.class = [attribs.class]
    attribs.class.push('breadcrumbs')
    attribs.ariaLabel = 'Breadcrumbs'
    return this.nav(...args, v => {
      v.a('Home', { href: '/' })
      for (const block of blocks) {
        block.call(v, v)
      }
    })
  }

  panel (...args) {
    const attribs = getAttribs(args)
    appendClass(attribs, 'panel')
    return this.div(...args)
  }

  sidebar (...args) {
    const attribs = getAttribs(args)
    appendClass(attribs, 'sidebar')
    return this.div(...args)
  }

  // given a list of objects, generates a panel tab bar heading
  panelTabs (...list) {
    this.nav({ class: 'panel-tabs', role: 'tablist' }, v => {
      for (const entry of list) {
        if (!entry) continue
        if ('if' in entry && !entry.if) continue

        const attribs = entry.current ? { ariaCurrent: 'page', role: 'tab' } : { role: 'tab' }
        if (entry.icon) v.iconLink(entry.icon, entry.label, { href: entry.href, ...attribs })
        else v.a(entry.label, { href: entry.href, ...attribs })
      }
    })
  }

  // emits an ACE editor component, hooked up to work inside a form, configured for javascript highlighting
  sourceCodeEditor (name, language, code, options = {}) {
    const aceOptions = {
      lightTheme: 'ace/theme/tomorrow',
      darkTheme: 'ace/theme/tomorrow_night',
      ...options,
      name,
      language,
      ace: {
        mode: `ace/mode/${language}`,
        autoScrollEditorIntoView: true,
        maxLines: 30,
        minLines: 2,
        tabSize: 2,
        useSoftTabs: true,
        ...(options.ace || {})
      }
    }

    this.div({ class: ['code-editor', 'javascript', ...options.class || []] }, v => {
      if (!this.__aceEditorPackageIncluded) {
        this.__aceEditorPackageIncluded = true
        v.script({ src: '/npm/ace-builds/src-min-noconflict/ace.js', type: 'text/javascript', charset: 'utf-8', defer: true })
      }

      v.script(`window.addEventListener('load', () => setupAceEditor(${JSON.stringify(aceOptions)}))`)
      v.input({ type: 'hidden', name, id: `${name}-form-input` })
      v.input({ type: 'hidden', name: `${name}CursorInfo`, id: `${name}-cursor-info-input` })
      v.pre(code, { id: `${name}-editor` })
    })
  }

  icon (symbolName) {
    if (RichVibeBuilder.iconPath.endsWith('.svg')) {
      this.svg({ class: ['icon', `icon-${symbolName}`], ariaHidden: 'true' }, v => {
        this.tag('use', { 'xlink:href': `${RichVibeBuilder.iconPath}#icon-${symbolName}` })
      })
    } else if (RichVibeBuilder.iconPath.endsWith('/')) {
      this.img({ class: ['icon', `icon-${symbolName}`], src: `${RichVibeBuilder.iconPath}${symbolName}.${RichVibeBuilder.iconExtension}` })
    } else {
      throw new Error('RichVibeBuilder.iconPath needs to point to a .svg symbol collection or a path ending in / with image files in it')
    }
  }

  // {
  //   line: 4,
  //   column: 9,
  //   filename: 'map.js',
  //   code: '  throw new Error('whatever')'
  // },
  stacktrace (error) {
    return this.div({ class: 'stacktrace' }, v => {
      v.heading(v => { v.icon('notice-in-circle'); v.text(` ${error.type}: ${error.message}`) })
      v.ul(v => {
        for (const item of error.stack) {
          v.li(v => {
            v.span(`${item.filename}`, { class: 'filename' })
            v.span(`${item.line}`, { class: 'line' })
            v.span(`${item.column}`, { class: 'column' })
            v.code({ class: 'inline-source-code', innerHTML: prism.highlight(`${item.code}`, prism.languages.javascript, 'javascript') })
          })
        }
      })
    })
  }

  logs (logs) {
    return this.ul({ class: 'logs' }, v => {
      for (const { type, args } of logs) {
        v.li({ class: [`log-entry log-entry-type-${type}`] }, v => {
          v.code(`console.${type}(`, { class: 'log-type' })
          let first = true
          for (const arg of args) {
            if (!first) v.text(', ')
            v.code({ innerHTML: prism.highlight(json5.stringify(arg), prism.languages.json5, 'json5'), class: 'inline-source-code' })
            first = false
          }
          v.code(')')
        })
      }
    })
  }
}

/** Builds a html doc with a title and some contents */
RichVibeBuilder.docStream = (title, block) => {
  return RichVibeBuilder.renderStream(async (v) => {
    v.doctype('html')
    await v.html(async () => {
      v.head(() => {
        v.title(title)
        v.meta({ charset: 'utf-8' })
        v.stylesheet('/style.css')
        v.stylesheet('/darkmode.css', { media: '(prefers-color-scheme: dark)' })
      })
      await v.body(async () => {
        await block.call(v, v)
        v.script({ src: '/script.js', defer: true })
      })
    })
  })
}

RichVibeBuilder.iconPath = '/icomoon/symbol-defs.svg'
RichVibeBuilder.iconExtension = 'png'

RichVibeBuilder.viewsPath = './views'
RichVibeBuilder.expressMiddleware = (req, res, next) => {
  /** sends a vibe template to the client using streaming
   * @param {string} viewName - filename of view
   * @param {string} pageTitle - title for html document
   * @param {any} ...args - args to pass to view
   * @async
   */
  res.sendVibe = (viewName, title, ...args) => {
    return new Promise((resolve, reject) => {
      const stream = RichVibeBuilder.docStream(title, v => {
        const viewPath = path.resolve(RichVibeBuilder.viewsPath, viewName)
        const view = require(viewPath)
        return view.call(v, req, ...args).call(v, v)
      })
      stream.pipe(res.type('html'))
      stream.on('close', () => resolve())
      stream.on('error', err => reject(err))
    })
  }
  next()
}

module.exports = RichVibeBuilder
