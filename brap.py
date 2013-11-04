#!/usr/bin/python

"""
brap 1.0.0 - XMPP/WWW bridge

References:
http://sleekxmpp.com/getting_started/muc.html
https://raw.github.com/fritzy/SleekXMPP/develop/examples/muc.py
http://sendapatch.se/projects/pylibmc/
http://www.tornadoweb.org/
http://kevinsayscode.tumblr.com/post/7362319243/easy-basic-http-authentication-with-tornado
https://gist.github.com/paulosuzart/660185
http://daringfireball.net/2010/07/improved_regex_for_matching_urls
"""

import time
import datetime
import sys
import os
import logging
import re
import getpass
from optparse import OptionParser
import sleekxmpp
import subprocess
import tornado.ioloop
import tornado.httpserver
import tornado.web
import json
import collections
import pprint
import base64

# Python versions before 3.0 do not use UTF-8 encoding
# by default. To ensure that Unicode is handled properly
# throughout SleekXMPP, we will set the default encoding
# ourselves to UTF-8.
if sys.version_info < (3, 0):
    from sleekxmpp.util.misc_ops import setdefaultencoding
    setdefaultencoding('utf8')
else:
    raw_input = input

""" 
User Location State: Track last known location, user agent, lon and lat of user
"""

class GeoState:
    def __init__(self):
        self.loc = "unknown"
        self.agent = "unknown"
        self.lat = 0
        self.lon = 0
    
    def setLocation(self, loc, lat, lon):
        self.loc = loc
        if self.loc == '':
            if self.lon != 0 and self.lat != 0:
                self.loc = lat + ',' + lon

""" 
Bot State: Track options, public/private messages, handle authentication
"""

class BotState:
    def __init__(self, opts):
        self.opts = opts
        self.state = {}
        self.chatlines = 0
        self.pubmsgs = collections.deque(maxlen=100)
        self.privmsgs = collections.deque(maxlen=100)
        self.urls = collections.deque(maxlen=100)
        self.pat = re.compile(ur'(?i)\b((?:https?://|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:\'".,<>?\xab\xbb\u201c\u201d\u2018\u2019]))')

    def options(self):
        return { 'nick': self.opts.nick, 'room': self.opts.room, 'jid': self.opts.jid }

    def save(self, key, value):
        self.state[key] = value

    def public(self, _from, body):
        self.pubmsgs.append({'type': 'public', 'from': _from, 'body': body, 'date': time.mktime(time.gmtime())})
        urls = self.pat.findall(body)
        for url in urls:
            self.urls.append({'from': _from, 'url': url[0], 'date': time.mktime(time.gmtime())})
        self.chatlines += 1
        if self.opts.user in body:
            self.private (_from, body)

    def private(self, _from, body):
        self.privmsgs.append({'type': 'private', 'from': str(_from), 'body': body, 'date': time.mktime(time.gmtime())})
        self.chatlines += 1

    def dumpPublicMessages(self):
        return json.dumps({'state': self.state, 'options': self.options(), 'chatlines': self.chatlines, 'pubmsgs': list(self.pubmsgs)})
    
    def dumpPrivateMessages(self):
        return json.dumps({'privmsgs': list(self.privmsgs)})

    def dumpURLs(self):
        return json.dumps(list(self.urls))

    def dumpChatLines(self):
        return json.dumps({'chatlines': self.chatlines})

    def authorized(self, username, password):
        return username == self.opts.user and password == self.opts.password

""" 
HTTP AUTH mixin 
"""

def require_basic_auth(handler_class):
    def wrap_execute(handler_execute):
        def require_basic_auth(handler, kwargs):
            auth_header = handler.request.headers.get('Authorization')
            if auth_header is None or not auth_header.startswith('Basic '):
                handler.set_status(401)
                handler.set_header('WWW-Authenticate', 'Basic realm=Restricted')
                handler._transforms = []
                handler.finish()
                return False
            auth_decoded = base64.decodestring(auth_header[6:])
            kwargs['basicauth_user'], kwargs['basicauth_pass'] = auth_decoded.split(':', 2)
            return True
        def _execute(self, transforms, *args, **kwargs):
            if not require_basic_auth(self, kwargs):
                return False
            return handler_execute(self, transforms, *args, **kwargs)
        return _execute

    handler_class._execute = wrap_execute(handler_class._execute)
    return handler_class

""" 
Web Server 
"""

@require_basic_auth
class AbstractHandler(tornado.web.RequestHandler):
    def initialize(self, botState, geoState):
        self.botState = botState
        self.geoState = geoState

    def get(self, basicauth_user, basicauth_pass):
        pass

    def authorized(self, basicauth_user, basicauth_pass):
        if self.botState.authorized(basicauth_user, basicauth_pass):
            return True
        self.clear()
        self.set_status(401)
        self.finish("<html><body>Unauthorized</body></html>")
        return False

""" 
Read chatlines, other info
"""

class ReadHandler(AbstractHandler):
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            self.write(self.botState.dumpPublicMessages())

"""
Send chatline from client to server
"""

class WriteHandler(AbstractHandler):
    def post(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            line = self.get_argument ('line', "")
            loc = self.get_argument ('loc', "")
            lat = self.get_argument ('lat', 0)
            lon = self.get_argument ('lon', 0)
            
            if line != "":
                self.geoState.setLocation (loc, lat, lon)
                xmpp.send_message(mto=xmpp.room, mbody=line, mtype='groupchat')
                self.botState.public(xmpp.nick, line)

            self.redirect(u"/")

""" 
Read # of chatlines seen
"""

class UpdateHandler(AbstractHandler):
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            self.write(self.botState.dumpChatLines())

"""
Send list of URLs to client
"""

class URLHandler(AbstractHandler):
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            self.write(self.botState.dumpURLs())

"""
Send list of private messages and mentions to client
"""

class PrivateMessageHandler(AbstractHandler):
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            self.write(self.botState.dumpPrivateMessages())

"""
Receive geo information from client
"""

class GeoHandler(AbstractHandler):
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            loc = self.get_argument ('loc', "")
            lat = self.get_argument ('lat', 0)
            lon = self.get_argument ('lon', 0)
            self.geoState.agent = self.request.headers["User-Agent"]
            self.geoState.setLocation (loc, lat, lon)

"""
Serve files
"""

class GenericHandler(AbstractHandler):
    def getFile(self):
        return ""
    
    def get(self, basicauth_user, basicauth_pass):
        if self.authorized(basicauth_user, basicauth_pass):
            fh = open(self.getFile(),"r")
            buf = fh.read()
            self.write(buf)

class ConfigHandler(GenericHandler):
    def getFile(self):
        return "./config.json";

class MainHandler(GenericHandler):
    def getFile(self):
        return "docs/console.html"

""" 
XMPP Bot 
"""

class MUCBot(sleekxmpp.ClientXMPP):
    def __init__(self, opts, botState, geoState):
        sleekxmpp.ClientXMPP.__init__(self, opts.jid, opts.password)

        # options
        self.room = opts.room
        self.nick = opts.nick
        self.room_password = opts.room_password

        # states
        self.botState = botState
        self.geoState = geoState

        # event handlers
        self.add_event_handler("session_start", self.start)
        self.add_event_handler("message", self.message)
        self.add_event_handler("groupchat_message", self.muc_message)
        self.add_event_handler("muc::%s::got_online" % self.room, self.muc_online)
        self.add_event_handler("disconnected", self.disconnect)
        self.add_event_handler("groupchat_subject", self.groupchat_subject)
        self.add_event_handler("groupchat_presence", self.groupchat_presence)

        # muc users
        self.whom = {}

    """ handlers """
    def start(self, event):
        print ("[connected]")
        self.get_roster()
        self.send_presence()
        self.plugin['xep_0045'].joinMUC(self.room, self.nick, password=self.room_password, wait=True)
        self.botState.save('create_date', time.mktime(time.gmtime()))
        self.botState.save('update_date', time.mktime(time.gmtime()))

    def disconnect(self):
        print("[disconnected]")
        os._exit(1)

    """ internal commands """
    def special(self, type, whom, body):
        msg = xmpp.nick + ": " + self.geoState.loc
        if body == '!help':
            if type == 'private':
                xmpp.send_message(mto=whom, mbody=msg)
            else:
                xmpp.send_message(mto=xmpp.room, mbody=msg, mtype='groupchat')

    """ private messages """
    def message(self, msg):
        if msg['nick'] != self.nick and msg['type'] in ('normal', 'chat'):
            print("[message] %s: %s" % (msg['from'], msg['body']))
            self.botState.private(msg['from'], msg['body'])
            self.special('private', str(msg['from']), msg['body'])
            self.botState.save('update_date', time.mktime(time.gmtime()))

    """ public messages """
    def muc_message(self, msg):
        if msg['mucnick'] != self.nick:
            print("[mucmessage] " + msg['mucnick'] + ": " + msg['body'])
            self.botState.public(msg['mucnick'], msg['body'])
            self.special('public', msg['mucnick'], msg['body'])
            self.botState.save('update_date', time.mktime(time.gmtime()))

    """ list of users """
    def muc_online(self, presence):
        self.whom[presence['muc']['nick']] = 1
        self.botState.save('whom', self.whom)
        print("[users] " + presence['muc']['nick'])

    """ track users in room """
    def groupchat_presence(self, presence):
        nick = presence['from'].resource
        room = presence['from'].bare

        if(presence['type'] == 'unavailable'):
            print("[part] " + nick + " " + room)
            del self.whom[nick]
            self.botState.save('whom', self.whom)

    """ track room subject """
    def groupchat_subject(self, presence):
        print("[subject] " + presence['subject'])
        self.botState.save('subject', presence['subject'])

if __name__ == '__main__':
    optp = OptionParser()

    optp.add_option('-q', '--quiet', help='set logging to ERROR', action='store_const', dest='loglevel', const=logging.ERROR, default=logging.INFO)
    optp.add_option('-d', '--debug', help='set logging to DEBUG', action='store_const', dest='loglevel', const=logging.DEBUG, default=logging.INFO)
    optp.add_option('-v', '--verbose', help='set logging to COMM', action='store_const', dest='loglevel', const=5, default=logging.INFO)
    optp.add_option("-j", "--jid", dest="jid", help="JID to use")
    optp.add_option("-p", "--password", dest="password", help="password to use")
    optp.add_option("-r", "--room", dest="room", help="MUC room to join")
    optp.add_option("-x", "--room_password", dest="room_password", help="room password to use")
    optp.add_option("-n", "--nick", dest="nick", help="MUC nickname")
    optp.add_option("-u", "--user", dest="user", help="HTTP AUTH username")
    optp.add_option("-l", "--http_port", dest="http_port", help="HTTP listening port")
    optp.add_option("-c", "--cert", dest="cert", help="Path to SSL certificate")
    optp.add_option("-k", "--key", dest="key", help="Path to SSL key")
    
    opts, args = optp.parse_args()

    logging.basicConfig(level=opts.loglevel, format='%(levelname)-8s %(message)s')

    """ prompt user for missing required options """
    if opts.jid is None:
        opts.jid = raw_input("Username: ")
    if opts.password is None:
        opts.password = getpass.getpass("Password: ")
    if opts.room is None:
        opts.room = raw_input("MUC room: ")
    if opts.nick is None:
        opts.nick = raw_input("MUC nickname: ")
    if opts.user is None:
        opts.user = raw_input("HTTP AUTH username: ")
    
    """ set defaults for missing options """
    if opts.http_port is None:
        opts.http_port = 8888

    geoState = GeoState()
    botState = BotState(opts)

    xmpp = MUCBot(opts, botState, geoState)
    xmpp.register_plugin('xep_0030') # Service Discovery
    xmpp.register_plugin('xep_0045') # Multi-User Chat
    xmpp.register_plugin('xep_0199') # XMPP Ping

    application = tornado.web.Application([
        (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": "docs/static"}),
        (r"/", MainHandler, dict (botState=botState, geoState=geoState)),
        (r"/get", ReadHandler, dict (botState=botState, geoState=geoState)),
        (r"/put", WriteHandler, dict (botState=botState, geoState=geoState)),
        (r"/update", UpdateHandler, dict (botState=botState, geoState=geoState)),
        (r"/geo", GeoHandler, dict (botState=botState, geoState=geoState)),
        (r"/urls", URLHandler, dict (botState=botState, geoState=geoState)),
        (r"/priv", PrivateMessageHandler, dict (botState=botState, geoState=geoState)),
        (r"/config", ConfigHandler, dict (botState=botState, geoState=geoState))
    ])


    if not xmpp.connect():
        print("Can't connect")
    else:
        xmpp.process(threaded=True)
        """ Optional HTTPS support """
        if (opts.cert != None and opts.key != None):
            http_server = tornado.httpserver.HTTPServer(application, ssl_options= { "certfile": opts.cert, "keyfile": opts.key })
        else:
            http_server = tornado.httpserver.HTTPServer(application)
        http_server.listen(opts.http_port)
        tornado.ioloop.IOLoop.instance().start()
