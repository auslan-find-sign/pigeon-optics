## Attachments

Records in Datasets or Lenses may contain strings with hash url schemes, which reference attachments that you can fetch using this interface.

Attachments in records look like `hash://sha256/f2c9db35b09020b25b8d6b20a075f7e83141584d2aeed3820d89b1ac0020551e?type=mime%2Ftype` as a string value somewhere. It can be anywhere, the root record could be a string, or it could be an object property name, or a property value, or an array value, or inside a map or a set. The only requirement is that it must be a whole string. Pigeon Optics wont recognise and retain attachments that are inside a string with padding around it, like buried inside of markup.

## GET /attachments/attachment-hash?type=mime-type

Fetch the contents of an attachment, and serve it using the specified mime-type. This endpoint should always return either 404 or 200. 200 responses from this endpoint are infinitely cachable, their response value cannot change. The endpoint does support range requests, allowing for streaming video use cases.

It should be impossible for the server to contain documents that reference attachments that aren't available at this API endpoint, but you could still encounter a 404 if you read a record, wait a moment, and then try to fetch the attachment, if you were incredibly unlucky and the record was rewritten to not link to that attachment, and garbage collection ran and cleared it out.

## Musings on streaming video

A reasonable way to build out a small indie streaming video system might be to upload original video files to a dataset `original-videos` as an object describing the video clip metadata, and an attached mp4 or whatever.

A second dataset, `encoded-videos`, could exist, which uses the same IDs to represent each video's transcoded versions

A lens could be defined which inputs from both datasets and merges the info together in to a full state.

Another pair of lenses could then input from that one, which filter it down to output just a list of transcodes with no source video, and videos with no transcodes.

A worker bot could then watch the event stream of both lenses, and whenever a new source video appears which doesn't have a corroponding transcode, it could pull the source video, transcode it out to a few different quality HLS streams, and upload the stream pieces as attachments to an object in `encoded-videos`. When a source video is deleted and transcodes exist for it, it could watch for those records too, and go in and delete the transcode.

HLS should conceptually work just fine from Pigeon Optics attachment endpoint, but it's probably worth configuring your encoder to output the range-request style of HLS playlist, to keep the number of files to a relative few. Something like this should be able to be quite competitive with the likes of Vimeo, for a small community website, in terms of playback quality.