## Attachments

Records in Datasets or Lenses may contain strings with hash url schemes, which reference attachments that you can fetch using this interface.

## GET /attachments/attachment-hash?type=mime-type

Fetch the contents of an attachment, and serve it using the specified mime-type. This endpoint should always return either 404 or 200. 200 responses from this endpoint are infinitely cachable, their response value cannot change. The endpoint does support range requests, allowing basic streaming (i.e. video playback).

If the server is only guarenteed to be able to stream AttachmentReferences. If the server responds with an Attachment (with inline data) it may or may not have that attachment in storage retrievable for streaming, so clients should not attempt to generate `/attachments/` urls from Attachment objects.