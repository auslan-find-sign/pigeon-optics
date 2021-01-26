## Viewport Worker

Viewport workers are similar to lenses, but implemented remotely as a webhook instead of sandboxed javascript
code running directly in the dataset server.

Implementation is simple and language agnostic, and can be implemented using lambda-style services like CloudFlare
Workers, or Glitch.com, or with a simple application server like express.js or a php script. The only requirements
are that the script can recieve post requests, and can parse and generate either CBOR or JSON.

Dataset entries can include file attachments, which are a weird implementation detail. Have a look at
/library/models/codec.js for an example implementation of the CBOR and Javascript codecs.

### Special notes for CBOR encoding

In CBOR these objects are encoded using the standard registered CBOR tag 27 "object representation" spec. Files
maybe either embedded in the document directly as a buffer with a mime type, or maybe an Attachment Reference
object, which includes a hash that can be transformed in to a URL the resource can be fetched from.

Attachments are available for access from the site's mountpoint /attachments/{attachment hash}?type={attachment mime type}
If type isn't specified, attachments are served as application/octet-stream, which maybe fine for certain applications.

Tag 27 Types are as follows:
 - ["dataset/Attachment", data buffer, mime type string]
 - ["dataset/AttachmentReference", sha256 hash buffer, mime type string]

### Special notes for JSON encoding

In JSON attachments and buffers are handled in a special way. AttachmentReference objects are encoded to an object:

```json
{
  "class": "AttachmentReference",
  "hash": "hexadecimal string of regular sha256 hash of file's contents", // try not to depend on hash algo not changing in future
  "type": "video/mp4" // or similar mime type
}
```

In the case of Attachments (with embedded data) class is set to "Attachment" and an additional "data" field contains the file's contents as a base64 encoded string.

Buffers are transformed in to an object with only one key "bufferBase64" whose value is a base64 encoded string of the buffer's contents, like `{"bufferBase64": "SSBsb3ZlIEF1c2xhbiE="}`

### Webhook API: syncronous mode

A syncronous webhook is one which processes data directly, and returns http "200 OK" status, and a CBOR or JSON document containing
an Array as the root object, of zero or more length, with each entry in the array being a subarray containing 2 elements, first
being the string recordID for the viewport's entry, and second being a dataset entry value, which should be a plain object/dictionary.

The response must be encoded in the same format as the webhook is configured to recieve.

Example Posted input:

```json
{
  "path": "/datasets/auslan-signbank/grapes1b",
  "returnURL": "https://data.auslan.fyi/webhook/viewport-response?...",
  "input": {
    "id": "grapes1b",
    "keywords": ["grapes"],
    "definition": "A small round fruit which comes in bunches...",
    "videos": [
      {
        "class": "AttachmentReference",
        "type": "video/mp4",
        "hash": "8286ee4ea8f54f0276bcd4a125de6fd38a58534eebe24df396f05febeee3a91a"
      }
    ]
  }
}
```

Example response:

```json
[
  ["tag:food", "auslan-signbank:grapes1b"]
  ["tag:delicious", "auslan-signbank:grapes1b"]
]
```

### Webhook API: POST return mode

A webhook may choose to respond with "202 Accepted" instead, and an empty body. In this case, the worker should HTTP POST the response to the provided `"returnURL"` provided with the webhook request, and the POST body must be in the same format as a
syncronous webhook would respond with.

Note also, while it is possible to return a syncronous response, and then later update it using the returnURL, it is considered bad practice to do both. The returnURL will remain valid so long as the underlying input remains current, in general usage, though in some configurations the datasets server may stop honouring old returnURLs if the server is restarted. Do not depend on returnURLs to remain valid perpetually for multiple repeated updates.

### Other HTTP status codes

No other status codes aside from 200 and 202 are considered valid. Returning any other status code will be considered a failure.
Datasets server may reattempt the webhook at a later time, and also may consider the webhook broken and could disable it in the
future if failures continue. Webhooks should not be used in cases where services are unreliably available. If your application
is only available intermittently, consider instead using the update feed API to watch for changes in underlying datasets, and
use the dataset upload API to upload a derived dataset as if it is a regular dataset.