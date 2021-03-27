## <img src="public/design/icon.svg?raw=true" alt=Logo style=height:2em> Pigeon Optics

<img src="public/design/commissioned-art/lens-inspector.png?raw=true" style=height:16rem;float:right;shape-outside:circle(6.5rem)>

Pigeon Optics is a little webapp for having fun with data and collaborating on community data projects. If you need something big and Enterprise, look at Mongo or CouchDB. Pigeon Optics aims to be like a a little friend who helps you and your pals take object-style data and do map-reduce things to it, without needing to spend heaps on a server with lots of ram and disk. It can also keep track of attachment files, so you can store your video clips and gifs in here too.

With Pigeon Optics, anyone can make an account, create datasets, upload records to those datasets, create lenses to transform datasets in to new formats.

Users can subscribe with event stream, or pull updates whenever they please, and get data in the formats they want quickly and without too much hassle.

The app server is designed to be very gentle with your RAM. It aims to be small enough to happily cohabitate with a bunch of other webapps on the cheapest smallest tiniest cloud instance money can buy.

Lenses are defined as normal javascript code, which is executed in a sandboxed V8 instance (using isolated-vm) in a temporary subprocess, whenever lenses need to rebuild their output. Thinking about supporting Ruby and maybe Python for lens code too! What do you think?

Pigeon Optics is built to serve as the eventual backend of [Auslan Find Sign](https://find.auslan.fyi/) and to make it easier for community members to access and play with Sign Language data.

The server handles all your objects (as JSON or CBOR) and can efficiently export out your data. It's scalable to large amounts of data on disk, by storing things in the regular filesystem, and using streams where possible to process information. Even HTML views are built and streamed out to clients to avoid needing to buffer large webpages totally in to server memory.

A simple restful interface allows read access to everything on Pigeon Optics, as well as ephemeral (temporary) lenses. For logged in users, they can also save and edit lens code, and write to their own datasets.

### Radically unscalable?

It turns out, making Big Data scalable stuff is really hard. It makes a lot of coding really complicated. Why deal with merge conflicts and syncing troubles when you don't really need it for most things? Computers are so fast now! Do you really need that big old couch?

### Is it ready for use?

No, not really. It's still being worked on, lots of features don't work yet. The concept definitely works, the core features are functioning, but there's a bunch more dogfooding needed to work out the kinks, and non-essential features (like search) that aren't yet implemented at all. Links that just go to 404 pages and stuff. You know the drill. Check back later if you want a finished thing.

### How can I help?

<img src="public/design/commissioned-art/security-officer.png?raw=true" style=height:15rem;float:left;shape-outside:circle(7rem)>

Get in touch with me, playtest the test instance, maybe write some restful client libraries or helpful tooling, or if you really want to get to work on code, maybe try implement some more languages so lenses can be written with other languages!

Or, you know, if you have money burning a hole in your pockets, DM me, because I am so dirt poor (I'm a pensioner!). I can definitely get more stuff done quicker if I have a bit more resources.

<div style=text-align:right>-=- Made with love by Phoenix -=-</div>
