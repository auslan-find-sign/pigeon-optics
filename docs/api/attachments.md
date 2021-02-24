## Attachments

Datasets and Lenses might contain files as values inside their records. Those files are represented as either Attachment or AttachmentReference objects. Attachment objects contain a mime type, the data of the file, and a sha256 hash of the file's contents. AttachmentReference objects omit the data, but their data can be fetched via the `/attachments/` path.

### JSON encoding

JSON can represent attachments as a base64 encoded string. Consider using CBOR instead for better efficiency by eliminating the base64 decoding step and the memory inefficiency of base64.

Attachment object's are encoded as:

```json
{
  "class": "Attachment",
  "hash": "string sha265 hex hash of attachment's contents",
  "mimeType": "string mime type of attachment's contents",
  "data": "string base64 encoded attachment's contents"
}
```

AttachmentReference objects are encoded as:

```json
{
  "class": "AttachmentReference",
  "hash": "string sha265 hex hash of attachment's contents",
  "mimeType": "string mime type of attachment's contents",
}
```

### CBOR encoding

CBOR can represent Attachments and AttachmentReferences as CBOR [tag 27 object encoding](http://cbor.schmorp.de/generic-object).

Attachment:

```
27(["pigeon-optics/Attachment", data, mimeType])
```

Where `data` is a binary buffer containing the attached file's contents, and `mimeType` is a string which must be a valid mime type.

AttachmentReference:

```
27(["pigeon-optics/Attachment", hash, mimeType])
```

Where `hash` is a binary buffer containing the sha256 hash of the file's contents, and `mimeType` is a string which must be a valid mime type.

### Uploading Attachments

When submitting data to the server, the "hash" property is optional on Attachment objects in JSON and not present in CBOR, and is silently ignored. It's provided for your convenience in server JSON output. All other properties are mandatory. Users may submit documents with AttachmentReference's in them, if the server already has the data. If you submit a document with AttachmentReferences, but the server does not already have the attachments specified, it will respond with HTTP error code 422, and a `X-Missing-Attachment` header for each missing attachment, with a header value as a hex encoded lower case sha256 hash.

A reasonable client might choose to always upload full attachments to avoid this complexity, or it might choose to always upload AttachmentReferences, and retry with any missing attachments changed from AttachmentReferences to Attachments when the server responds with error 422.

## GET /attachments/attachment-hash?type=mime-type

Fetch the contents of an attachment, and serve it using the specified mime-type. This endpoint should always return either 404 or 200. 200 responses from this endpoint are infinitely cachable, their response value cannot change. The endpoint does support range requests, allowing basic streaming (i.e. video playback).

If the server is only guarenteed to be able to stream AttachmentReferences. If the server responds with an Attachment (with inline data) it may or may not have that attachment in storage retrievable for streaming, so clients should not attempt to generate `/attachments/` urls from Attachment objects.