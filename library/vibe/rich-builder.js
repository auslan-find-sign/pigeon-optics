const VibeBuilder = require('./builder')
const highlight = require('h.js')

/** gets or adds attributes object to args list when proxying calls to tag builder
 * note, this sometimes changes the args array to inject an object, beware side-effects
 * @param {Array} - args list
 * @returns {object}
 */
const getAttribs = (args) => {
  let opts = args.find(x => typeof x === 'object')
  if (!opts) args.push(opts = {})
  return opts
}
/** append class names to attributes object
 * @param {*} attributes - attributes object
 * @param {*} className - className string to append
 */
const appendClass = (attributes, className) => {
  if (Array.isArray(className)) className = className.join(' ')
  if (attributes.class) {
    attributes.class += ` ${className}`
  } else {
    attributes.class = `${className}`
  }
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
      appendClass(options, 'button')
      this.tag('a', ...args)
    } else {
      this.tag('button', ...args)
    }
  }

  /** shortcut for markup of a flex-row div */
  flexRow (...args) {
    const options = getAttribs(args)
    appendClass(options, 'flex-row')
    this.div(...args)
  }

  /** shortcut for markup of a flex-row div */
  toolbar (...args) {
    const options = getAttribs(args)
    appendClass(options, 'toolbar')
    this.div(...args)
  }

  /** shortcut for markup of a flex-row/toolbar spacer
   * @param {number} pressure - number indicating how much space this spacer should take up
   */
  flexSpacer (pressure) {
    this.span({
      class: 'spring',
      style: { flexGrow: pressure }
    })
  }

  /** formats and nicely displays javascript/json code with highlighting and line numbers */
  sourceCode (code, ...args) {
    if (typeof code !== 'string') code = JSON.stringify(code)
    const options = getAttribs(args)

    // syntax highlight the javascript/json
    const lines = highlight(code).split('\n')

    appendClass(options, 'source-code')
    options.data = {
      ...(options.data || {}),
      language: 'javascript'
    }
    options.style = {
      ...(options.style || {}),
      '--digits': lines.length.toString().length
    }

    this.div(...args, v => {
      for (const line of lines) {
        v.code({ innerHTML: line })
      }
    })
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

  // emits an ACE editor component, hooked up to work inside a form, configured for javascript highlighting
  sourceCodeEditor (name, language, code, options = {}) {
    if (!this.__aceEditorPackageIncluded) {
      this.__aceEditorPackageIncluded = true
      this.script({ src: '/npm/ace-builds/src-min-noconflict/ace.js', type: 'text/javascript', charset: 'utf-8' })
    }

    this.pre(code, { class: 'code-editor javascript', id: `${name}-editor` })
    this.input({ type: 'hidden', name, id: `${name}-form-input` })

    const aceOptions = {
      lightTheme: 'ace/theme/tomorrow',
      darkTheme: 'ace/theme/tomorrow_night',
      ace: {
        mode: `ace/mode/${language}`,
        autoScrollEditorIntoView: true,
        maxLines: 30,
        minLines: 2,
        ...(options.ace || {})
      }
    }

    const init = [
      '(function () {',
      `  const options = ${JSON.stringify(aceOptions)}`,
      "  const darkmode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')",
      '  options.ace.theme = (darkmode && darkmode.matches) ? options.darkTheme : options.lightTheme',
      `  const editor = ace.edit(${JSON.stringify(`${name}-editor`)}, options.ace)`,
      "  if (darkmode) darkmode.addEventListener('change', function (event) {",
      '    options.ace.theme = event.matches ? options.darkTheme : options.lightTheme',
      '    editor.setTheme(options.ace.theme)',
      '  })',
      "  editor.session.setMode('ace/mode/javascript')",
      '  editor.renderer.setScrollMargin(10, 10, 0, 0)',
      `  const hidden = document.getElementById(${JSON.stringify(`${name}-form-input`)})`,
      '  const updateHidden = function () { hidden.value = editor.getValue() }',
      '  if (hidden.form) {',
      "    hidden.form.addEventListener('submit', updateHidden)",
      '    updateHidden()',
      '  }',
      '})()'
    ]
    this.script(init.join('\n'))
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
      })
      await v.body(async () => {
        await block.call(v, v)
        v.script({ src: '/script.js', defer: true })
      })
    })
  })
}

module.exports = RichVibeBuilder
