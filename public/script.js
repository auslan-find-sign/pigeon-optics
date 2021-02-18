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

  const hidden = document.getElementById(`${options.name}-form-input`)
  const updateHidden = function () { hidden.value = editor.getValue() }
  if (hidden.form) {
    hidden.form.addEventListener('submit', updateHidden)
    updateHidden()
  }
}
