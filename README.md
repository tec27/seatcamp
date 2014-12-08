#seatcamp
A web-based ephemeral chat site that lets users send simple, short messages
along with a 2-second video of themselves.

The offical server can be found at [https://seat.camp](https://seat.camp)

##Features
- Send a message to anyone connected to the same seatcamp server
- Provides both webm and h264 videos alongside chats, allowing clients to
request whichever they wish to use (video transcoding is done using ffmpeg
or avconv, whichever is available)
- Proxies to a [meatspace](https://github.com/meatspaces/meatspace-chat-v2)
server, sending any seatcamp user's messages to that server as well as
display meatspace users' messages to seatcamp users
- No signup required, but users receive a unique ID based on browser
characteristics (displayed to users as an identicon alongside messages).
- Allows for muting users based on their ID, removing all their current
messages and blocking any future ones
- Performs extremely minimal DOM element creation and recycles message
elements, meaning the page loads quickly and is quite stable over long
periods of time.

##Protocol


##Running a server
Server configuration is handled through a JSON file: `conf.json`.
`conf.json-example` in the main directory will often provide all you need
for a development server, so for most developers, you can simply do:
```
$ cp conf.json-example conf.json
```

This will set you up with a server running on port `3456` over HTTP, and
connecting to a meatspace server at port `3000`.

The server can then be run with:
```
$ npm start
```

If you are running a production seatcamp server, or simply want to
customize your development environment, you can change a few options in
`conf.json`. The options are:
### Normal options
#### port
The port to run the HTTP server on for this instance.
**Ex:** `"port": 3000`

####idKey
The key to use for hashing user ID's. This allows users to be given a
stable, unique ID per browser, but not expose their actual fingerprint
to other users on the server or be able to track users across seatcamp
instances. This value should be unique to the server you're running it
on and sufficiently long (10+ characters recommended).
**Ex:** `"idKey": "thisServerIsGreat123"`

####meatspaceServer
The full URL for a meatspace server you want to proxy to/from. If you want
to turn proxying off for a particular server (useful in development
environments where you don't want to run 2 servers all the time).
**Ex:** `"meatspaceServer": "http://localhost:3000"`
**Or:** `"meatspaceServer": false`

### HTTPS options (all must be specified if you want to use HTTPS)
####sslCert
A relative filepath to an SSL certificate file to be used for setting up
HTTPS connections.
**Ex:** `"sslCert": "./certs/certificate.crt"`

####sslKey
A relative filepath to the private key used for the SSL certificate file specified in `sslCert`.
**Ex:** `"sslKey": "./certs/private.key"`

####sslCaBundle


####sslPort
####canonicalHost


##Contributing
seatcamp is written using ES6-compliant JavaScript, compiled to ES5 using traceur. Client-side code is similarly written, but compiled with browserify and es6ify. Contributions should attempt to make use of ES6 features where they make sense. Pull requests are accepted and will be looked at in a timely manner. If you are contributing a new feature (rather than a bug fix), its a good idea to open a PR early to discuss the viability of that feature in the larger ecosystem before you attempt to write code for it. 

New features will be accepted if they fortify behavior that developed from the community (e.g. hashtags on Twitter), but will likely be denied if they are something completely outside of the way the community uses the site. Code that breaks meatspace users' experiences (makes them feel left out if they don't use seatcamp, results in spammy messages appearing for them, etc.) will not be accepted.

##License
MIT
