## Arbitrary data to XML

Pigeon Optics tries to allow converting any data to any format where ever possible. XML and HTML are not losslessly translatable in to JSON-like data structures, so they're represented using an extended version of JsonML called [PigeonMark](https://github.com/Bluebie/pigeonmark/), creating a compact almost DOM-like structure, preserving structure and ordering of tags, text, cdata, comments, whitespace, and processing instructions like doctypes and xml settings. These documents can be lensed and exported freely and may be exported with slight encoding differences (like different attribute order or different quote marks around attribute values) but will be structurally identical in semantic meaning.

When data is converted in to XML, if it's already in JsonML or PigeonMark structure, it will be encoded back in to the original document structure. If the data isn't formatted in this way, i.e. it was natively JSON or something similar, Pigeon Optics will attempt to represent the data using XML as best it can, instead of failing. It does this using PigeonMark's Arbitrary encoding. You can find details about this at pigeonmark-arbitrary, but the short version is:

Something like `{ a: 1, b: true, c: null, d: 'nope', e: Buffer('hello world'), f: false, g: [1, 2] }` becomes:

```xml
<object xmlns="pigeonmark:arbitrary">
  <number name="a">1</number>
  <true name="b"/>
  <null name="c"/>
  <string name="d">nope</string>
  <buffer encoding="base64" name="e">aGVsbG8gd29ybGQ=</buffer>
  <false name="f"/>
  <array name="g">
    <number>1</number>
    <number>2</number>
  </array>
</object>
```

Note, whitespace is inserted for readability but these documents don't normally contain whitespace.

XML documents sent to pigeon optics which strictly follow the format (including the xmlns) will be parsed in to the underlying data structure, allowing XML tools full interoperability with freeform JSON-like data.

## On HTML

HTML doesn't have an obvious way to translate JSON-like data structures in to markup, so the HTML codec will fail to encode arbitrary data, returning an error in this case. All valid HTML documents should parse in to JsonML-like structures, which are retrievable as HTML, XML, or any of the other JSON-like formats.

The HTML codec will happily produce non-spec markup, like custom unspecced elements, but it does try to enforce against obviously unparseable markup, for example it will fail and error if JsonML structure tries to emit child nodes inside of an `<img>` tag.

The HTML codec tries to always produce spec-compliant markup, and aggressively optimises for compactness. Attribute values are unquoted where ever possible, for example. The goal of the codec is to always produce valid parseable markup where possible, so you never need to think about how the html encoding works.

If you upload html to pigeon optics and then request it back as xml, you should recieve something that is basically xhtml, but likely missing a suitable doctype.

## On Lenses interacting with markup

Javascript lenses have access to a small standard library of utilities for interacting with markup stored in the JsonML-like format. These tools allow for basic scraping and feed construction

### Lens Markup API

### `Markup.toHTML(node)`

Serialize markup structure in to a string, using WHATWG spec HTML5 encoding

### `Markup.toXML(node)`

Serialize markup structure in to a string, using W3C XML 1.0 encoding

### `Markup.select(node, cssSelector)`

Given a markup root node, runs a css selector against the document structure and returns an array of matching nodes. Uses `tree-selector` under the hood with `pigeonmark-utils` adapter, so any css selectors `tree-selector` supports should work here.

### `Markup.get.type(node)`

Given a node, returns one of the strings: `tag`, `text`, `attributes`, `document`, `pi`, `cdata`, `comment`, or `fragment`. If the input node is not valid PigeonMark, it may return undefined. For JsonML inputs, the result will always be either `tag`, `text`, or `attributes`

### `Markup.get.name(node)` or `Markup.get.name(node, stringValue)`

Gets the string tag name of a tag node or xml processing instruction node

```js
Markup.get.name(['tag', { attr: 'val' }, 'child text']) //=> 'tag'
Markup.get.name(['?xml', { version: '1.0' }]) //=> 'xml'
Markup.get.name(['?xml', { version: '1.0' }], 'xml-stylesheet') //=> ['?xml-stylesheet', { version: '1.0' }]
```

### `Markup.get.id(tag)` or `Markup.set.id(tag, stringValue)`

Shortcut to read or write the ID attribute of a tag, returns a string or undefined.

### `Markup.get.classList(tag)` or `Markup.set.classList(tag, arrayOfStrings)`

Returns array of strings from tag's 'class' attribute, or an empty array if it is empty or unset.

### `Markup.get.attribute(tag, attrName)` or `Markup.set.attribute(tag, attrName, attrStringValue)`

Returns an attribute value from a tag or xml processing instruction as a string, or undefined if it isn't set. The set varient sets an attribute's value to a string.

### `Markup.get.attributes(tag)` or `Markup.set.attributes(tag, attributesObject)`

Gets a tag's attributes as an object, or replaces a tag's attributes with an object.

### `Markup.get.children(node)` or `Markup.set.children(node, childList)`

Gets the child tags of a node as an array, excluding direct descendants of other types (for example, skipping text nodes and comments)

The set varient replaces all the childNodes of the node with a child list.

### `Markup.get.childNodes(node)` or `Markup.set.childNodes(node, childList)`

Gets all the child nodes of a node, including text nodes, comments, cdata, as well as tags, as an ordered array, or in the set varient, replaces those items

### `Markup.get.text(node)` or `Markup.set.text(node, string)`

Like WebAPI's Element.textContent property, returns all the child text nodes, concatinated together in to one string, including descendents inside of tags within this one. The set varient replaces all this node's child nodes with a single text node of the provided string.

### `Markup.isPigeonMark(node)`

given an object, tests if that object could possibly be the root node of a PigeonMark document, which being a slightly extended superset of JsonML, is also good at detecting JsonML documents.

Note that any string is technically a valid JsonML document, as it's a text root node, so lookout for that.

This function tries to do some light validation, so it will return false for most structures that would fail to serialize to XML in really obvious ways, like spaces in tag names, or tag names that aren't strings.