const ui = require('../ui')
const html = require('nanohtml')
const uri = require('encodeuricomponent-tag')
const pkg = require('../../package.json')
const render = require('../widgets/utilities/render')

module.exports = (req, body) => {
  let authLinks = []

  if (req.session && req.session.auth) {
    authLinks = [
      ui.link({ url: uri`/users/${req.session.auth.user}`, contents: html`${req.session.auth.user}` }),
      ' ',
      ui.link({ url: uri`/auth/logout?return=${req.originalUrl.split('?')[0]}`, contents: 'Logout' })
    ]
  } else {
    authLinks = [
      ui.link({ url: uri`/auth/login?return=${req.originalUrl.split('?')[0]}`, contents: 'Login' })
    ]
  }

  return [
    // heading bar
    ui.flexRow({
      contents: [
        html`<a href="/"><img src="/design/datasets-icon.png" alt="Site Icon" style="height: 1.5em"> <span>Datasets</span></a>`,
        5,
        html`<form id="search" action="/search" method="GET"><input type="search" value="${req.query.q}"></form>`,
        5,
        html`<span id="auth-links">${render(authLinks)}</span>`
      ]
    }),
    ...[body].flat(),
    ui.flexRow({
      contents: [
        `Auslan Find Sign - Datasets v${pkg.version}`,
        1,
        ui.link({ url: pkg.homepage, contents: 'Open Source' }),
        1,
        ui.link({ url: 'https://find.auslan.fyi/', contents: 'Find Sign' })
      ]
    })
  ]
}
