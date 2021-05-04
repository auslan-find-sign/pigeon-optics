## GET /lenses/

returns a Map/Hash/Object keyed with string authors, and each value is an array of lens names that author owns

## GET /lenses/author:

returns an array of lens names this author owns

```json
[
  "dataset-1",
  "dataset-2"
]
```

## GET /lenses/author:lens-name/

returns an object with lens configuration, and a list of records in the dataset and their versions.

```js
{
  "author": "author-profile-name",
  "name": "lens-name",
  "version": 39,
  "config": {
    "memo": "Free text describing the dataset",
    "mapCode": "js source code",
    "reduceCode": "js source code",
    "inputs": ["/datasets/author:name/", "/lenses/author:name/"],
  },
  "records": {
    "name-of-record": { "version": 14, "hash": Buffer[32], "links": [] },
    "name-of-record-2": { "version": 19, "hash": Buffer[32], "links": [] },
  }
}
```

## GET /lenses/author:lens-name/configuration

returns the config of this lens

```json
{
  "memo": "Free text describing the dataset",
  "mapCode": "js source code",
  "reduceCode": "js source code",
  "inputs": ["/datasets/author:name/", "/lenses/author:name/"],
}
```

## PUT /lenses/author:lens-name/configuration

set the configuration of this lens, triggering a rebuild. On success returns HTTP 204.

## GET /lenses/author:lens-name/configuration/map

returns the map function as javascript

## GET /lenses/author:lens-name/configuration/reduce

returns the reduce function as javascript

## GET /lenses/author:lens-name/records/

returns a Map/Hash/Object with string keys (recordIDs) and object values `{ version: "123", hash: Buffer[32] }`. `version` maybe a string or integer number. Compatible clients shouldn't try to parse it or manipulate it. Response also includes an `X-Version` header containing the current version of the lens output. This number might not match any version value of any particular record, if the most recent change to the lens output was deleting some records.

```json
{
  "recordA": { "version": "6" },
  "recordB": { "version": "7" }
}
```

## DELETE /lenses/author:lens-name/

Delete the entire lens. Including all versions.

## GET /lenses/author:lens-name/records/recordID

returns the value of the record, as an arbitrary object, and the X-Version header specifying it's current version number.

## POST /lenses/ephemeral

accepts the same object as `/lenses/author:lens-name/configuration`, containing at least:

```json
{
  "mapType": "javascript",
  "mapCode": "javascript code string",
  "reduceCode": "javascript code string",
  "inputs": ["/datasets/author:dataset-name/", "/lenses/author:lens-name/"]
}
```

The API will generate and build a temporary lens, then stream out the entire output of the lens in whichever supported format requested via `Accept` http header

```jsonc
{
  "log": {
    "input": "dataPath to record which was input to map function",
    "function": "/lenses/author:lens-name/configuration/map.js", // or reduce.js
    "error": { // or error will be set to "false" if no errors were thrown
      "type": "Error", // or another error constructor name
      "message": "string error message",
      "stack": [
        {
          "code": "throw new Error('string error message')",
          "line": 3, // line, 1 based
          "column": 0, // column, 0 based
          "filename": "map.js" // or reduce.js, normally
        }
        // ... possibly more entries
      ]
    },
    "logs": [
      {
        "type": "log", // or "warn" or "info" or "error"
        "timestamp": 1234, // epoch milliseconds timestamp when log was emitted
        "args": ["arguments", "sent", "to", "console.log()", "or whatever"]
      }
    ]
  }
}
```

or:

```js
{
  "record": {
    "id": 'recordID-goes-here',
    "hash": Buffer[32], // some kind of hash of the contents of data, to aid caching, kind of like an ETag
    "version": 5, // sequence ID number
    "data": // whatever reduce function returns is here
  }
}
```