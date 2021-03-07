## Attachments

Datasets and Lenses might contain files as values inside their records. Those files are represented as either Attachment or AttachmentReference objects. Attachment objects contain a mime type, the data of the file, and a sha256 hash of the file's contents. AttachmentReference objects omit the data, but their data can be fetched via the `/attachments/` path.

### JSON encoding

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

AttachmentReference:

```
27(["pigeon-optics/AttachmentReference", hash, mimeType])
```

Where `hash` is a binary buffer containing the sha256 hash of the file's contents, and `mimeType` is a string which must be a valid mime type.


## GET /attachments/attachment-hash?type=mime-type

Fetch the contents of an attachment, and serve it using the specified mime-type. This endpoint should always return either 404 or 200. 200 responses from this endpoint are infinitely cachable, their response value cannot change. The endpoint does support range requests, allowing basic streaming (i.e. video playback).

If the server is only guarenteed to be able to stream AttachmentReferences. If the server responds with an Attachment (with inline data) it may or may not have that attachment in storage retrievable for streaming, so clients should not attempt to generate `/attachments/` urls from Attachment objects.