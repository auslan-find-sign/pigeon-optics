Datasets are stored as a folder, by default under ./.data (for happy Glitch compatability!)

The path is ./.data/authors/(owner-name)/datasets/(dataset-name)

the dataset folder contains two things usually, a `meta.cbor` file and an `objects` folder.

the meta.cbor file contains the whole state of the dataset, that is, it's current version number, it's configured memo text, and a 'records' object, with recordID string keys and `{ hash: <Buffer>, version: <number>, links: <string[]> }` values.

Every time the dataset changes, the version number goes up by one. It's always an integer. Whenever a record's value changes, or a new record is added, it's meta object will also include the version number where that happened.

To read the value of a record, look it up in the `meta.cbor/records/(recordID)` object, grab the hash, then read `objects/(hash.toString('hex')).cbor`. The object file contains the value of the record. Object files get created as needed and removed when they're no longer linked to in the current state of the dataset. This helps keep everything down to small files that don't require heaps of memory to buffer, and it's all pretty quick on a modern SSD. Popular datasets should mostly end up keeping their meta.cbor cached in system memory, if there's memory available, on most kinds of computers too.

Write locking happens internally to Pigeon Optics, in memory. No write lock files get written to filesystem and PO doesn't attempt to use syscalls to write lock the files either. You should never run multiple instances of Pigeon Optics pointing at the same data directory, because they'll totally clobber each other.

Lenses use the same format, but there's also a map-outputs folder which caches the map function's outputs, and the meta.cbor contains all the javascript code and stuff.