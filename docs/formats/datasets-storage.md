Datasets are stored in a fairly complex way.

Dataset record values:

these are hashed and stored under the objects folder dataset/objects/(hash)

dataset versions:

the current dataset version is in dataset's config as a root 'version' property.

versions are stored in dataset/versions/(version number)

version file contains:

```js
{
  "version": 123 /* version number */,
  "created": Date.now() /* ms timestamp int */,
  "records": {
    "(recordID)": { "version": 122, "hash": Buffer[32] /* sha256 object hash */ }
  }
}
```

reading a record goes like this:

1. read config, get version number
2. read dataset/version/version-num
3. look for recordID
4. find remember hash, set X-Version header
5. read dataset/objects/(hash hex lowercase)
6. done