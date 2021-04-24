module.exports = (v, req, state) => {
  v.dl(v => {
    v.dt('Flat File')
    v.dd(v => {
      v.button('CBOR', { href: 'export/flat-file.cbor' })
      v.button('YAML', { href: 'export/flat-file.yaml' })
      v.button('JSON', { href: 'export/flat-file.json' })
      v.button('JSON Lines', { href: 'export/flat-file.jsonl' })
      v.button('MessagePack', { href: 'export/flat-file.msgpack' })
      v.button('XML', { href: 'export/flat-file.xml' })
    })

    v.dt('Zip')
    v.dd(v => {
      v.button('CBOR', { href: 'export/archive.cbor.zip' })
      v.button('YAML', { href: 'export/archive.yaml.zip' })
      v.button('JSON', { href: 'export/archive.json.zip' })
      v.button('MessagePack', { href: 'export/archive.msgpack.zip' })
      v.button('XML', { href: 'export/archive.xml.zip' })
      v.button('HTML', { href: 'export/archive.html.zip' })
    })

    v.dt('Zip with Attachments')
    v.dd(v => {
      v.button('CBOR', { href: 'export/archive.cbor.zip?attachments=true' })
      v.button('YAML', { href: 'export/archive.yaml.zip?attachments=true' })
      v.button('JSON', { href: 'export/archive.json.zip?attachments=true' })
      v.button('MessagePack', { href: 'export/archive.msgpack.zip?attachments=true' })
      v.button('XML', { href: 'export/archive.xml.zip?attachments=true' })
      v.button('HTML', { href: 'export/archive.html.zip?attachments=true' })
    })
  })
}
