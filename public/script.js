// client-side js, loaded by the webpages, run each time the page is loaded
// run by the browser each time the page is loaded

window.setupAceEditor = (options) => {
  const darkmode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
  options.ace.theme = (darkmode && darkmode.matches) ? options.darkTheme : options.lightTheme

  const editor = window.ace.edit(`${options.name}-editor`, options.ace)

  if (darkmode) {
    darkmode.addEventListener('change', function (event) {
      options.ace.theme = event.matches ? options.darkTheme : options.lightTheme
      editor.setTheme(options.ace.theme)
    })
  }

  editor.renderer.setScrollMargin(10, 10, 0, 0)

  const dataInput = document.getElementById(`${options.name}-form-input`)
  const cursorInput = document.getElementById(`${options.name}-cursor-info-input`)
  const updateHidden = function () {
    dataInput.value = editor.getValue()
    const { row, column } = editor.getCursorPosition()
    cursorInput.value = `${row + 1}:${column}`
  }
  if (dataInput.form) {
    dataInput.form.addEventListener('submit', updateHidden)
    updateHidden()
  }

  // place cursor at specified location if requested
  if (options.cursor) {
    const [row, column] = options.cursor.split(':').map(x => parseInt(x))
    editor.gotoLine(row, column)
  }

  // disable semicolon errors in javascript language, enable ecmascript v9 linting
  if (options.language === 'javascript') {
    editor.session.on('changeAnnotation', () => {
      editor.session.$worker.send('changeOptions', [{ asi: true, esversion: 9 }])
    })
  }

  window.aceEditor = editor
}
