Brap
====

An XMPP/WWW bridge in Python/JavaScript. 

Features
========

- Pleasant-looking HTML/CSS/JavaScript interface
- Single-threaded Python server for backend
- Password-protected web page (HTTP AUTH)
- Clickable links open in new browser window

Optional:

- Set custom favicon.ico
- Set custom icons per friend
- Track current location via maps.googleapis.com: lon, lat, street address
- Use a 3rd party service to remove referrals from links

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

Jerkcity-themed examples for icons are provided for your amusement. 

Options
=======

Usage: brap.py [options]

Options:
  -h, --help            show this help message and exit
  -q, --quiet           set logging to ERROR
  -d, --debug           set logging to DEBUG
  -v, --verbose         set logging to COMM
  -j JID, --jid=JID     JID to use
  -p PASSWORD, --password=PASSWORD
                        password to use
  -r ROOM, --room=ROOM  MUC room to join
  -x ROOM_PASSWORD, --room_password=ROOM_PASSWORD
                        room password to use
  -n NICK, --nick=NICK  MUC nickname
  -u USER, --user=USER  HTTP AUTH username
  -l HTTP_PORT, --http_port=HTTP_PORT
                        HTTP listening port

Minimal Example
===============

./brap.py -d -u USERNAME -q -j JID -r CHANNEL -n NICK -x PASSWORD

Ingredients
===========

- jQuery http://jquery.com/
- Tornado http://www.tornadoweb.org/en/stable/
- SleepXMPP http://sleekxmpp.com/

Under The Hood
==============

- JavaScript talks to Python via HTTP/JSON
- Always-on Python bot connects to Jabber server

Icons
=====

Courtesy of PixelKit: http://pixelkit.com/kits/flat-icon-set

TODO
====

- Specify arguments to deref URL e.g. http://whatever/?url=%%URL%% or something
- Separate HTTP AUTH password from Jabber server password
- Support for replying to private messages
- Support for multiple rooms

Author
======

- Harrison Page <harrisonpage@gmail.com>
- http://hanford.org/harrison/
- https://github.com/harrisonpage/brap
- 22-Jul-2013
