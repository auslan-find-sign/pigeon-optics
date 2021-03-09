## GET /datasets/

returns a Map/Hash/Object keyed with string usernames, and each value is an array of dataset names that user has

## GET /datasets/username:

returns an array of dataset names this user owns

```json
[
  "dataset-1",
  "dataset-2"
]
```

## GET /datasets/username:dataset-name/

returns an object with dataset configuration, and a list of records in the dataset and their versions.

```json
{
  "user": "username",
  "name": "dataset-name",
  "version": "overall-dataset-version-string",
  "config": { "memo": "Free text describing the dataset" },
  "records": {
    "name-of-record": { "version": "version-string" },
    "name-of-record-2": { "version": "version-string 2" },
  }
}
```

## GET /datasets/username:dataset-name/records/

returns a Map/Hash/Object with string keys (recordIDs) and object values `{ version: "123" }`. `version` is a string which maybe a hash, an integer number, or something else. Compatible clients shouldn't try to parse it or manipulate it. Response also includes an `X-Version` header containing the current version of the dataset. This number might not match any version value of any particular record, if the most recent change to the dataset was deleting some records.

```json
{
  "recordA": { "version": "6" },
  "recordB": { "version": "7" }
}
```

## POST /datasets/username:dataset-name/records/

POST body must be a Map/Hash/Object with recordID string keys, and any values. `undefined` or `null` values will cause that record to be deleted in the underlying dataset, if it exists. Any other values will be stored as the record's value, overwriting or creating records as needed. Any recordIDs that are not present in the body map will be left as is and inherited in the new version.

## PUT /datasets/username:dataset-name/records/

PUT body must be in the same format as the POST verb, but any unspecified recordIDs will be deleted, not inherited from previous versions.

## DELETE /datasets/username:dataset-name/

Delete the entire dataset. Including all versions.

## GET /datasets/username:dataset-name/records/recordID

returns the value of the record, as an arbitrary object, and the X-Version header specifying it's current version number.

## PUT /datasets/username:dataset-name/records/recordID

A new version of the dataset is created, changing the value of this record to whatever object is provided as the POST body.

## DELETE /datasets/username:dataset-name/records/recordID

A new version of the dataset is created, removing this recordID from the collection.

## A note on attachments

For regular object style records, you can use normal PUT messages to upload data, but taking advantage of Attachments is useful for uploading things like video files, AI model weights or outputs, or any other large binary blobs. Attachment uploads are normally handled using `multipart/form-data` mime messages, just like a web browser would use for file uploads in a html form.

You can include attachments as form data file uploads, with the field name `"attachment"`. For efficiency, it's usually a good idea to attempt to write the record as a regular PUT first. The Pigeon Optics server will check for attachments in the document, and if it already has the attachments it will accept the PUT immediately. If one or more attachments are missing, it will respond with a `400 Bad Request` error, and nothing will be modified in the dataset server side. This error response includes a header `X-Pigeon-Optics-Resend-With-Attachments` with a comma seperated list of hex encoded strings, which are the sha256 hash of each attachment that is missing server side.

It's recommended that clients should use the `X-Pigeon-Optics-Resend-With-Attachments` header to select the attachments the server needs, and retry the request, as with a `multipart/form-data` body. A properly formatted body will include one or more `"attachment"` fields, containing file uploads, and a `"body"` attachment field with a file of either application/cbor or application/json mime type.

The server will understand the `"body"` attachment as being the body of the POST/PUT request, and store the provided attachments in it's global attachment store. If the client receives another `400 Bad Request` error, it maybe a server error, it maybe a client error (the hashes in the document's attachment references didn't match the uploaded files contents), or a race condition where the server could have removed an attachment from the global attachment store and may now require some extra attachments. If the `X-Pigeon-Optics-Resend-With-Attachments` hasn't changed, treat the response as a severe error. If the list has updated to include new entries, it's worth retrying again, with the new attachments required.

Uploaded attachments will get cleared out of disk after a while, if they aren't referenced in any current dataset or lens outputs.

## A note on lenses

Lenses support this API as well (but at the /lenses/ path) with the GET verb, in exactly the same way. Lenses are not able to be written using any PUT/POST/DELETE verbs, because lens content is always derived from the output of user configured javascript map/reduce functions running server side. If you are building a derived dataset outside of Pigeon Optics lenses, you should use the [export.md](export.md) interface's event-stream to watch for changes in underlying datasets, and upload a resulting dataset through this API. A reasonable approach is to watch for changes, and whenever the X-Version of a record changes, reprocess it and upload your response to an output dataset.