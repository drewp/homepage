#!/usr/local/bin/python

import socket
import SocketServer

from oss import *
from string import *

mix = open_mixer()

#print "remmeber to set the channels right!"
#for i in range(0,32):
#    print "chan %i col %s" % (i,`mix.read_channel(i)`)

channels = (0,3,4,6,16) # set all these channels the same (we always return the level of channels[0])
#channels = (4,16) # after a re-insmod, the channels are here!

class VolumeHandler(SocketServer.StreamRequestHandler):
    def handle(self):

	volume = float(strip(self.rfile.readline(100)))
        print "change to %f" % volume

        if volume!=-1:
            for c in channels:
                mix.write_channel(c,100*volume)
        
        volume = max(mix.read_channel(channels[0]))/100.0
        self.wfile.write(`volume`+'\n')

server=SocketServer.TCPServer( ('', socket.getservbyname('volume','tcp')), VolumeHandler)
server.serve_forever()



