// client-side js, loaded by the webpages, run each time the page is loaded
// run by the browser each time the page is loaded

if (document.body.dataset.state) {
  const state = JSON.parse(document.body.dataset.state)

  console.log('Page initialised with state information:', state)
}
