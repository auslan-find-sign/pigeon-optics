// client-side js, loaded by the webpages, run each time the page is loaded
// run by the browser each time the page is loaded

if (document.body.dataset.state) {
  const state = JSON.parse(document.body.dataset.state)

  console.log('Page initialised with state information:', state)
}

for (const textarea of document.querySelectorAll('form.simple-form > dl > dd > textarea[wrap=off]')) {
  const update = () => {
    const lineCount = Array.prototype.reduce.call(textarea.value, (count, char) => char === '\n' ? count + 1 : count, 0)
    textarea.rows = lineCount + 1
  }
  textarea.addEventListener('input', update)
  update()
}
