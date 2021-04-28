## Pigeon Optics API

Pigeon Optics provides a restful API capable of all operations the web interface supports. This API can be communicated with using either JSON or CBOR. Requests must use `Accept:` HTTP header to specify either application/json or application/cbor, or the client will receive HTML UI instead.

Pigeon optics tries to use a CRUD-style interface as much as possible, with GET used to read, POST used to patch, PUT used to replace, and DELETE used to remove content. All operations that include a body must include a Content-Type request header specifying either application/json or application/cbor

Clients can either use Basic http authentication, or use the /auth interface to login and receive a cookie, to authenticate requests that require auth.

View documentation on some server paths:

 * [/attachments/...](attachments.md)
 * [/datasets/...](datasets.md)
 * [/lenses/...](lenses.md)
 * [/export/...](export.md)

Background info:

 * [General content types and encoding rules](content-types.md)
 * [XML and HTML markup handling](markup.md)