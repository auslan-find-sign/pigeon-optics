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

Records can include attachments. Attachments are a mime type string, and a binary blob of arbitrary length. Attachments are the best way to represent large pieces of media like images and video files, or large outputs of AI inferrence. Attachments can also be served from the Pigeon Optics server directly, and support range requests, so they're suitable for in browser video streaming playback. Uploading new attachments requires implementing a multipart/related mime encoder, to better allow the client and server to stream large attachments.

If you submit a record containing attachment references, and the server is missing any of the attachments referenced, the server will respond with a 400 Bad Request, including a header 'X-Pigeon-Optics-Resend-With-Attachments' which contains a comma seperated list of hex encoded sha256 content hashes for all the resources that need to be provided.

Clients MAY always upload attachments using multipart/related, but clients SHOULD attempt to just submit a cbor document as the root body of their http request, and repeat the request as a multipart/related with attachments included only if the request fails with a 400 error and X-Pigeon-Optics-Resend-With-Attachments header present in response.

When using multipart/related, the application/cbor/json record data should be the last entity in the mime collection. It MUST have headers:

```
Content-Disposition: inline
Message-ID: <record>
Content-Type: application/cbor or application/json
```

Attachments should preceed the record data, and MUST have headers:

```
Content-Disposition: attachment
Message-ID: <hex-sha256-content-hash-here>
Content-Type: mimetype-here
```

Message-ID should contain a correct hex sha256 hash of the file's contents. Content-Type should be appropriate to the content and should match the content-type of the AttachmentReference in the cbor/json record data.

## A note on lenses

Lenses support this API as well (but at the /lenses/ path) with the GET verb, in exactly the same way. Lenses are not able to be written using any PUT/POST/DELETE verbs, because lens content is always derived from the output of user configured javascript map/reduce functions running server side. If you are building a derived dataset outside of Pigeon Optics lenses, you should use the [export.md](export.md) interface's event-stream to watch for changes in underlying datasets, and upload a resulting dataset through this API. A reasonable approach is to watch for changes, and whenever the X-Version of a record changes, reprocess it and upload your response to an output dataset.