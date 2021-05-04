## GET /(source)/(author):(collection-name)/export?encoding=(encoding-type)&after=(version)&at=(version)

Exports all the data in the specified collection, as a machine readable file

* `(source)` must be one of `datasets` or `lenses`
* `(author)` must be the resources owner author string, uri encoded
* `(collection-name)` must be the string name of the dataset or lens, uri encoded
* `(encoding-type)` must be one of `cbor`, `json`, or `json-lines`

`cbor` streams out concatenated CBOR arrays, with two elements, first a string recordID, and second an arbitrary record value

`json` streams out a valid JSON object, with recordID string keys and record values as object values

`json-lines` streams out the same format as `cbor`, but as JSON without whitespace, with each record terminated with a newline

If `after` query string parameter is provided, export will only include records with a version newer than the provided string. The response will include an X-Version header containing the current version when exported. Any entries which existed in the version specified which have been deleted later, will be specified with their value as `undefined`. You can pull sync with the server by keeping track of the X-Version response. Any records you've seen before, which aren't specified in the new export, are unchanged.

If `at` query string paramater is provided, it behaves like `after` but includes entries with an equal version number, useful in combination with the event-stream api (see below)

## GET /(source)/(author):(collection-name)/zip

Exports all the data in the specified collection, as a zip file containing a json folder and a cbor folder, with each record
contained in each format.

The response will be a zip file, served with appropriate mime type. The zip is generated dynamically and streamed out to the author, so it may have poor compression, and does not support HTTP range requests or specify a Content Length as these are unknown at the start of the request.

## GET /(source)/(author):(collection-name)/zip?attachments=true

As above, but also includes `/attachments/` folder containing the binary blobs of any attachments referenced in records that are in the cbor/json folders in the zip. The attachment filenames are just their hash, hex encoded, with no file extension. To determine file's mime type, search the json/cbor for attachment metadata.

## GET /(source)/(author):(collection-name)/event-stream

Responds with an event stream, which immediately outputs an event containing this object:

```json
{
  "version": 123,
  "records": { "recordID1": 123, "record-xyz": 122, "record-foo": 3 }
}
```

Which can be understood as meaning the current version of the dataset/lens is `123`, and `recordID1` was modified in the most recent update (it's value has changed, it has a different hash), `record-xyz` changed in the previous update, and `record-foo` changed in the third update, ages ago. There are no other records in the dataset.

For efficient syncing, the best approach is to remove any records from your local copy whose ID's aren't included in the `"records"` property of the event, and to request `/(source)/(author):(collection-name)/export?at=(event.version)&encoding=(cbor|json|json-lines)` to load a stream of just records that have changed in the specified version or more recently.

Note, this API always responds with JSON encoded events. It does not have a CBOR mode as event-stream is a text based format and doesn't efficiently support CBOR.