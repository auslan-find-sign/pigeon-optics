const layout = require('./layout')
/**
 * build's homepage
 * @param {Request} req - express Request
 */
module.exports = (req) => {
  return layout(req, v => {
    v.panel(v => {
      v.heading('Pigeon Optics')

      v.p(v => {
        v.text('Pigeon Optics is a radically low performance unscalable open access database built for small scale ')
        v.text('non-profit community data gathering and manipulation. Designed initially to be the back end archive ')
        v.text('behind the ')
        v.a('Auslan Find Sign', { href: 'https://find.auslan.fyi/' })
        v.text(' search engine. Pigeon Optics will become the canonical source of data feeding the search results on ')
        v.text('Find Sign, allowing anyone to drop in at any level in the signal path from spider to search result tile ')
        v.text('and extract data in whatever format they need. Anyone can make an account and write their own map/reduce ')
        v.text('lenses in javascript, and Pigeon Optics will build custom views over any data in the system and provide ')
        v.text('export in a Zip archive, or as CBOR, or JSON, or newline seperated JSON objects. Anyone building ethical apps that ')
        v.text('need to update as data changes and evolves can either query for updates since a specific sequence number ')
        v.text('or connect to an event-stream and be fed updates in realtime.')
      })

      v.p(v => {
        v.text('You’re also welcomed and encouraged to create your own datasets and contribute data to the project ')
        v.text('for potential inclusion in Find Sign’s search results. The current version of Pigeon Optics is a minimum ')
        v.text('viable product, but in the future I want to explore allowing the building of new interfaces to customise ')
        v.text('the editing experience to make community participation in data augmentation easy for people who aren’t ')
        v.text('familliar with JSON and related technologies.')
      })
    })
  })
}
