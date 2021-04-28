## Content-Types

Pigeon Optics servers implement a bunch of codecs. Internally, all data is stored as binary CBOR files. These are a superset of JSON, able to efficiently store binary buffers as well as some speciality types like CBOR tags.

Pigeon Optics contains many codecs, to translate data between various formats:

### application/cbor

The most straight forward format, CBOR is a standardised binary encoding that is a functional superset of JSON with support for Buffers and some standardised ways to encode things like dates, and even complex cloneable objects.

### application/json

Everyone knows JSON, one of the most common serialisation formats on the internet. Pigeon Optics outputs standard JSON, and translates binary buffers to `{ type: 'Buffer', data: [1, 2, 3] }` standard NodeJS `buffer.toJSON()` format. For uploaded content, buffers encoded in that way will be converted back to binary buffers.

Pigeon Optics will attempt to decode uploaded messages using regular JSON, and if that fails, it'll try using json5, allowing easier manual text input.

### application/json-lines or application/nljson

This format can be used for iterable data, like exporting a dataset. It also technically works on any data where the root type is an Array.

json-lines is a standardised way to encode each entry in a sequence as json, without whitespace, followed by `'\n'`. This allows simple processing using line reading utilities in most languages, without needing to buffer an entire dataset in to memory.

### application/yaml or text/yaml

YAML is a common text-based data language, which is technically a superset of JSON. YAML is popular for it's human readability. Documents are translated to yaml, with the same buffer encoding as json types. Iterable streams of data will output multiple documents, using the standard yaml document seperator of `'\n...\n'`, allowing for streaming parsing.

### application/xml, text/xml, application/rdf+xml, application/rss+xml, application/atom+xml, text/xml

A superset of JsonML described in [markup.md](markup.md) is used to handle markup like xml and html. This format should preserve tag order, text nodes, comments, attributes, cdata, processing instructions, etc. Attribute order is not necessarily preserved, and details like the type of quoting around attribute strings and entity encoding may change when documents are roundtripped. The XML codec attempts to build concise XML and will use the shortest encoding available when there are multiple options.

When requesting records in xml formats, records which contain at their root an object, containing one property, which is 'JsonML', will be encoded using JsonML and served up.

For records which aren't in this format, a translation of the raw object structure is done:

 - `"text"` become `<string>text</string>`
 - `123` becomes `<number>123</number>`
 - `true` becomes `<true/>`
 - `false` becomes `<false/>`
 - `null` becomes `<null/>`
 - `undefined` becomes `<undefined/>`
 - `[ arrays ]` and iterables become `<array>` and contain a sequence of tags without whitespace
 - `{ objects }` becomes `<object>` and contain a sequence of tags without whitespace, and each tag also gains a 'name' attribute with the property name
 - Buffers become `<buffer encoding="base64|hex|utf-8">data...</buffer>`

### application/msgpack

MessagePack is supported, and functions much like CBOR. In Pigeon Optics, msgpack is provided as a convenience, as it has wide support in many languages, and maybe useful for example in Ruby if yaml isn't good for your application (for example, dealing with data that contains a lot of Buffers).

If you can use CBOR instead, it's a good idea. MessagePack is fairly slow to encode, and provides no real benefit over CBOR, which is an IETF standard based on the core ideas of MessagePack.

## Note on other formats:

If you have a good usecase for another format, feel free to open an issue on the Pigeon Optics issue tracker and request support. It's a goal of Pigeon Optics to make it very easy to consume data regardless your preferred tools.

As a bonus quirk, if your dataset or lens outputs as it's root node, a string, you can use any mime type within the text/ range to display it. If the output is a Buffer, you can use any type within `application/*`, `image/*`, or `video/*`, and the content will be simply served out in the format specified. Note that `'Content-Security-Policy: sandbox'` header will be served on all content provided via the raw interface, to protect against cross site scripting. This means if you're building interactive content like html with scripts, the scripts wont run in modern browsers. This is true for attachments as well. If you need interactivity, it's best to build a client-side webapp and access Pigeon Optics data via it's APIs, which do allow cross site access.