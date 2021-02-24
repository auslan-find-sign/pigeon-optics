## GET /export/(realm)/(username):(collection-name)?encoding=(encoding-type)&after=(version)&at=(version)

Exports all the data in the specified collection, as a machine readable file

* `(realm)` must be one of `datasets` or `lenses`
* `(username)` must be the resources owner username string, uri encoded
* `(collection-name)` must be the string name of the dataset or lens, uri encoded
* `(encoding-type)` must be one of `cbor`, `json`, or `json-lines`

`cbor` streams out concatenated CBOR arrays, with two elements, first a string recordID, and second an arbitrary record value

`json` streams out a valid JSON object, with recordID string keys and record values as object values

`json-lines` streams out the same format as `cbor`, but as JSON without whitespace, with each record terminated with a newline

If `after` query string parameter is provided, export will only include records with a version newer than the provided string. The response will include an X-Version header containing the current version when exported. Any entries which existed in the version specified which have been deleted later, will be specified with their value as `undefined`. You can pull sync with the server by keeping track of the X-Version response. Any records you've seen before, which aren't specified in the new export, are unchanged.

If `at` query string paramater is provided, it behaves like `after` but includes entries with an equal version number, useful in combination with the event-stream api (see below)

## GET /export/(realm)/(username):(collection-name)/zip

Exports all the data in the specified collection, as a zip file containing a json folder and a cbor folder, with each record
contained in each format.

The response will be a zip file, served with appropriate mime type. The zip is generated dynamically and streamed out to the user, so it may have poor compression, and does not support HTTP range requests or specify a Content Length as these are unknown at the start of the request.

## GET /export/(realm)/(username):(collection-name)/zip?attachments=true

As above, but also includes `/attachments/` folder containing the binary blobs of any attachments referenced in records that are in the cbor/json folders in the zip. The attachment filenames are just their hash, hex encoded, with no file extension. To determine file's mime type, search the json/cbor for attachment metadata.

## GET /export/(realm)/(username):(collection-name)/event-stream

Responds with a text/event-stream, which immediately outputs an event with the current version number of the underlying dataset as ID field, JSON data. The Data will contain an object like this:

{
  "version": same value as ID
  "recordIDs": String[],
  "changed": String[],
}

`version` will be a string, which matches the event's ID header. version should be treated as an arbitrary string, and not parsed or processed by downstream software. It is only to be used when reconnecting with the event-stream `Last-Event-ID` header.

When connecting without providing a `Last-Event-ID` header, the first response will contain the current version string, and both `recordIDs` and `changed` will be an array containing a full list of every recordID in the underlying dataset/lens output.

When reconnecting with a valid `Last-Event-ID`, the server may, if possible, choose to not send you an immediate event (if you're already up to date).

After receiving an initial catch up event, the server will stream you further events in the same format whenever data changes in the underlying dataset or lens output. the `changed` field will be a list of recordIDs whose contents has changed.

You can use the server's normal APIs to query those records. If you want to fully sync down the dataset, a good option is to use the export interface at the top of this document, and specify the value of the `version` field with it's `at` query string parameter.