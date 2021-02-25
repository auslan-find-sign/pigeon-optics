const VibeBuilder = require('./builder')
const highlight = require('h.js')
const path = require('path')
const uri = require('encodeuricomponent-tag')

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
      options.role = 'button'
      this.tag('a', ...args)
    } else {
      if (options.formmethod && !['GET', 'POST'].includes(options.formmethod.toUpperCase())) {
        if (!options.name) {
          // rewrite this button to provide the method
          options.name = '_method'
          options.value = options.formmethod.toUpperCase()
        } else {
          // rewrite the formaction
          const containerForm = (this.forms || []).slice(-1)[0]
          const action = options.formaction || containerForm.action || ''
          if (action.includes('?')) {
            options.formaction = action + uri`&_method=${options.formmethod.toUpperCase()}`
          } else {
            options.formaction = action + uri`?_method=${options.formmethod.toUpperCase()}`
          }
        }
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
      if (!options.action) {
        options.action = uri`?_method=${options.method.toUpperCase()}`
      } else if (options.action.includes('?')) {
        options.action += uri`&_method=${options.method.toUpperCase()}`
      } else {
        options.action += uri`?_method=${options.method.toUpperCase()}`
      }
      options.method = 'POST'
    }
    this.tag('form', ...args)

    this.forms.pop()
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
      for (const block of blocks) {
        block.call(v, v)
      }
    })
  }

  panel (...args) {
    const attribs = getAttribs(args)
    if (!attribs.class) attribs.class = []
    if (!Array.isArray(attribs.class)) attribs.class = [attribs.class]
    attribs.class.push('panel')
    return this.div(...args)
  }

  // given a list of objects, generates a panel tab bar heading
  panelTabs (...list) {
    this.nav({ class: 'panel-tabs', role: 'tablist' }, v => {
      for (const entry of list) {
        if (!entry) continue

        const attribs = entry.current ? { ariaCurrent: 'page', role: 'tab' } : { role: 'tab' }
        if (entry.icon) v.iconLink(entry.icon, entry.label, { href: entry.href, ...attribs })
        else v.a(entry.label, { href: entry.href, ...attribs })
      }
    })
  }

  panelActions (...args) {
    this.div({ class: 'panel-actions' }, v => {
      for (const entry of args) {
        if (!entry) continue

        if (entry.icon) v.iconButton(entry.icon, entry.label, entry.attributes || {})
        else v.button(entry.label, entry.attributes || {})
      }
    })
  }

  // emits an ACE editor component, hooked up to work inside a form, configured for javascript highlighting
  sourceCodeEditor (name, language, code, options = {}) {
    if (!this.__aceEditorPackageIncluded) {
      this.__aceEditorPackageIncluded = true
      this.script({ src: '/npm/ace-builds/src-min-noconflict/ace.js', type: 'text/javascript', charset: 'utf-8', defer: true })
    }

    this.pre(code, { class: 'code-editor javascript', id: `${name}-editor` })
    this.input({ type: 'hidden', name, id: `${name}-form-input` })

    const aceOptions = {
      lightTheme: 'ace/theme/tomorrow',
      darkTheme: 'ace/theme/tomorrow_night',
      name,
      ace: {
        mode: `ace/mode/${language}`,
        autoScrollEditorIntoView: true,
        maxLines: 30,
        minLines: 2,
        tabSize: 2,
        esVersion: 9,
        ...(options.ace || {})
      }
    }

    this.script(`window.addEventListener('load', () => setupAceEditor(${JSON.stringify(aceOptions)}))`)
  }

  footerButtons (...args) {
    this.div({ class: [] }, ...args)
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
   */
  res.sendVibe = (viewName, title, ...args) => {
    RichVibeBuilder.docStream(title, v => {
      const viewPath = path.resolve(RichVibeBuilder.viewsPath, viewName)
      const view = require(viewPath)
      view.call(v, req, ...args).call(v, v)
    }).pipe(res.type('html'))
  }
  next()
}

module.exports = RichVibeBuilder
