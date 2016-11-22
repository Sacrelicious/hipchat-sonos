#!/usr/bin/env python
# -*- coding: utf-8 -*-
from soco import SoCo
import soco
import sys
import cgi
import time
import json
import logging
import requests

logging.basicConfig(filename='output.log',level=logging.DEBUG)

#print to output and to the log file
def printlog(a):
    logging.debug(a)
    print a

#load settings
f = open('config.txt','r')
settings = json.load(f)
f.close()

zone = SoCo(settings['SONOS_IP_ADDRESS'])
url = settings['POST_SONGS_URL']
currentTrackInfo = None

needToQuit = False

while not needToQuit:
    try:
        newTrackInfo = zone.get_current_track_info()
##        only procede if the player is playing
        if zone.get_current_transport_info()['current_transport_state'] == 'PLAYING':
##              if the current track exists and is different from the last we found procede
            if(currentTrackInfo == None or newTrackInfo['title'] != currentTrackInfo['title']):
                ##printlog(unicode(newTrackInfo))

                payload = {
                    "SonosName":zone.player_name,
                    "Title": unicode(newTrackInfo['title']),
                    "Artist": unicode(newTrackInfo['artist']),
                    "Album": unicode(newTrackInfo['album']),
                    "AlbumArt": unicode(newTrackInfo['album_art'])
                }

                r = requests.post(url, json=payload)
                
                currentTrackInfo = newTrackInfo
    except Exception as e:
        printlog('An exception occurred!!!')
        printlog(type(e))
        printlog(e.args)
        printlog(e)

    #don't scan again for another 5 seconds
    time.sleep(5)
