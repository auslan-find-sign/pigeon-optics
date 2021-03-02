## GET /lenses/

returns a Map/Hash/Object keyed with string usernames, and each value is an array of lens names that user owns

## GET /lenses/username:

returns an array of lens names this user owns

```json
[
  "dataset-1",
  "dataset-2"
]
```

## GET /lenses/username:lens-name/

returns an object with lens configuration, and a list of records in the dataset and their versions.

```js
{
  "user": "username",
  "name": "lens-name",
  "version": "overall-dataset-version-string",
  "config": {
    "memo": "Free text describing the dataset",
    "mapCode": "js source code",
    "reduceCode": "js source code",
    "inputs": ["/datasets/user:name/", "/lenses/user:name/"],
  },
  "records": {
    "name-of-record": { "version": "version-string", "hash": Buffer[32] },
    "name-of-record-2": { "version": "version-string 2", "hash": Buffer[32] },
  }
}
```

## GET /lenses/username:lens-name/configuration

returns the config of this lens

```json
{
  "memo": "Free text describing the dataset",
  "mapCode": "js source code",
  "reduceCode": "js source code",
  "inputs": ["/datasets/user:name/", "/lenses/user:name/"],
}
```

## PUT /lenses/username:lens-name/configuration

set the configuration of this lens, triggering a rebuild. On success returns HTTP 204.

## GET /lenses/username:lens-name/configuration/map.js

returns the map function as javascript

## GET /lenses/username:lens-name/configuration/reduce.js

returns the reduce function as javascript

## GET /lenses/username:lens-name/records/

returns a Map/Hash/Object with string keys (recordIDs) and object values `{ version: "123", hash: Buffer[32] }`. `version` maybe a string or integer number. Compatible clients shouldn't try to parse it or manipulate it. Response also includes an `X-Version` header containing the current version of the lens output. This number might not match any version value of any particular record, if the most recent change to the lens output was deleting some records.

```json
{
  "recordA": { "version": "6" },
  "recordB": { "version": "7" }
}
```

## DELETE /lenses/username:lens-name/

Delete the entire lens. Including all versions.

## GET /lenses/username:lens-name/records/recordID

returns the value of the record, as an arbitrary object, and the X-Version header specifying it's current version number.

## POST /lenses/ephemeral

accepts the same object as `/lenses/username:lens-name/configuration`, containing at least:

```json
{
  "mapType": "javascript",
  "mapCode": "javascript code string",
  "reduceCode": "javascript code string",
  "inputs": ["/datasets/user:dataset-name/", "/lenses/user:lens-name/"]
}
```

The API will generate and build a temporary lens, then returns a JSON/CBOR array (or JSON objects on lines if requested with `?encoding=json-lines` query string options). Each array entry will be one of:

```js
{
  log: {
    input: 'dataPath to record which was input to map function',
    function: "/lenses/user:lens-name/configuration/map.js", // or reduce.js
    error: { // or error will be set to "false" if no errors were thrown

    },
    logs: [
      {
        type: 'log', // or "warn" or "info" or "error"
        timestamp: 1234, // epoch milliseconds timestamp when log was emitted
        args: ['parameters', 'sent', 'to', 'console.log()', 'or whatever']
      }
    ]
  }
}
```

or:

```js
{
  record: {
    id: 'recordID-goes-here',
    hash: Buffer[32], // some kind of hash of the contents of data, to aid caching, kind of like an ETag
    version: 5, // sequence ID number
    data: /* whatever reduce function returns is here */
  }
}
```