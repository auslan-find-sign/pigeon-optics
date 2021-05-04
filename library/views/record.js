const layout = require('./layout')
const codec = require('../models/codec')
const uri = require('encodeuricomponent-tag')
const naturalCompare = require('string-natural-compare')
const capitalize = require('microsoft-capitalize')

/**
 * build a record view, with the data on a right panel, and a sidebar of records on the left
 * @param {Request} req - express Request
 * @param {object} data - object with state info for the form
 * @param {object} data.path - codec.path.decode object of what we're looking at
 * @param {*} data.record - the actual record data to display
 * @param {object} data.sidebar - info for the sidebar
 * @param {string[]} data.sidebar.recordIDs - array of recordIDs in this containing dataset
 */
module.exports = (req, { path, record, sidebar }) => {
  return layout(req, v => {
    if (sidebar) {
      v.sidebar(v => {
        v.heading(sidebar.title || 'Records')

        v.ul(v => {
          for (const recordID of sidebar.recordIDs.sort(naturalCompare)) {
            const attribs = recordID === req.params.recordID ? { class: 'selected' } : {}
            v.li(attribs, v => v.a(recordID, { href: codec.path.encode({ ...path, recordID }) }))
          }
        })
      })
    }

    v.panel(v => {
      v.header(v => {
        v.breadcrumbs(v => {
          v.a(capitalize(path.source), { href: uri`/${path.source}/` })
          v.iconLink('user-circle', req.params.author, { href: uri`/authors/${req.params.author}` })
          v.iconLink('cassette', req.params.name, { href: codec.path.encode({ ...path, recordID: undefined }) })
          v.iconLink('newspaper', req.params.recordID, { href: codec.path.encode(path) })
        })

        if (req.owner && path.source === 'datasets') {
          v.panelTabs(
            { label: 'View', href: codec.path.encode(path), current: true },
            { label: 'Edit', href: codec.path.encode(path) + '?edit=1' }
          )
        } else if (path.source === 'lenses') {
          v.panelTabs(
            { label: 'View', href: codec.path.encode(path), current: true },
            { label: 'Debug', href: codec.path.encode(path) + '/debug' }
          )
        }
      })

      v.sourceCode(codec.json.print(record), { class: 'expand' })
    })
  })
}
