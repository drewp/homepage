from fader import Fader

import socket
from string import *

def sendvolume(v):
    try:
        s=socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("dash", socket.getservbyname('volume','tcp')))

        s.send(`v`+'\n')
        return strip(s.recv(100))
    except:
        return 0


class Volume(Fader):
    lastset=0
    def __init__(self):
        pass
    
    def setlevel(self,newlevel):
        print newlevel
        if abs(newlevel-self.lastset)>.02:
            sendvolume(newlevel)
            self.lastset=newlevel
    def getlevel(self):
        return float(sendvolume(-1))


