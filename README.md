Brap
====

An XMPP/WWW bridge in Python/JavaScript. Connect to a Jabber chat room from a 
web page. 

Features
========

- Somewhat pleasant-looking HTML/CSS/JavaScript interface
- Single-threaded Python server for backend
- SSL
- Password-protected web page via HTTP AUTH
- Clickable links open in new browser window
- Clickable hashtags open to twitter
- 3rd party service to remove referrals from links can be specified
- Night mode
- Set a custom favicon.ico
- Set custom icons per friend
- Track current location (lon, lat)
- Track street address via maps.googleapis.com
- Tracks URLs and images seen in chat
- Pings server to check for new messages, notification appears in window title

Config File
===========

Configure the UI by editing the config.json file. 

Explanation of key/value pairs:

    title          Page title shown by client
    favicon        URL to an ico, png or gif file for your browser to consume
    geolocation    Set to "enabled" to pass lon, lat and address to the server
    deref          URL to a dereferer service
    icons          Dictionary of username to image, width and height
    alias          Link a username to another to avoid duplicate icon entries
    refresh_rate   Time in milliseconds to check for new messages (60000 = 1m)

Jerkcity-themed examples for icons are provided for your amusement. 

Options
=======

Usage: brap.py [options]

Options:

    -h, --help                                        show this help message and exit
    -q, --quiet                                       set logging to ERROR
    -d, --debug                                       set logging to DEBUG
    -v, --verbose                                     set logging to COMM
    -j JID, --jid=JID                                 JID to use
    -p PASSWORD, --password=PASSWORD                  password to use
    -r ROOM, --room=ROOM                              MUC room to join
    -x ROOM_PASSWORD, --room_password=ROOM_PASSWORD   room password to use
    -n NICK, --nick=NICK                              MUC nickname
    -u USER, --user=USER                              HTTP AUTH username
    -l HTTP_PORT, --http_port=HTTP_PORT               HTTP listening port
    -c CERTIFICATE, --cert=CERTIFICATE                Path to SSL certificate
    -k KEY, --key=KEY                                 Path to SSL private key

Minimal Example
===============

Start up brap (perhaps in a screen session):

    ./brap.py -d -u USERNAME -q -j JID -r CHANNEL -n NICK -x PASSWORD -l 6502

Open your browser to http://localhost:6502/ and login via HTTP AUTH. 

For the username, use the value you specified with -u. 

For the password, use the value you specified with -p or were prompted for. 
This is different from the room password as specified with -x.

Supply paths to an SSL certificate/key via -c and -k and instead load 
an https URL e.g.

    ./brap.py -d -u USERNAME -q -j JID -r CHANNEL -n NICK -x PASSWORD -l 6502 -c ~/certs/duh.cert -k ~/certs/duh.key

Ingredients
===========

- jQuery http://jquery.com/
- Tornado http://www.tornadoweb.org/en/stable/
- SleepXMPP http://sleekxmpp.com/
- jquery-cookie https://github.com/carhartl/jquery-cookie (bundled)

Under The Hood
==============

- JavaScript talks to Python via HTTP/JSON
- Always-on Python bot maintains connection to Jabber server

Refresh Rate
============

Adding a refresh_rate key to your config.json will make the client check for new
messages every so often. The value should be specified in milliseconds. New 
messages will be indicated in the browser window's title bar.

If refresh_rate is not available or set to 0, this feature is disabled. By default
this feature is disabled. 

GeoLocation Features
====================

Enabling this feature assumes you want to share your current location with other
users. By default this is off. You can enable this by changing the value of
geolocation in config.json to enabled. For each time you load the page, the lon/lat
as reported by your browser will be stored on the server and, if available from
Google, your street address. 

Your browser may prompt you to enable these features repeatedly. This might get annoying. 

Users can type !help in channel to show your current location: lon, lat and 
street address if available.

Icons
=====

- PixelKit http://pixelkit.com/kits/flat-icon-set
- FlatIcons http://flaticons.net/

TODO
====

- Specify arguments to deref URL e.g. http://whatever/?url=%%URL%% or something
- Separate HTTP AUTH password from Jabber server password
- Support for sending/receiving to private messages
- Support for multiple rooms
- Fetch user icons from Jabber server instead of config.json

Author
======

- Harrison Page <harrisonpage@gmail.com>
- https://hanford.org/harrison/
- https://github.com/harrisonpage/brap
- Created 22-Jul-2013

About
=====

Skinny Puppy's often informal, improvisational approach to musical composition is indicated by use of the term brap, coined by them and defined as a verb meaning "to get together, hook up electronic instruments, get high, and record".
