#!/usr/bin/python

import urllib, pprint, sys, os, time
try:
    from elementtree.ElementTree import fromstring
except ImportError:
    from xml.etree.ElementTree import fromstring
from rdflib import URIRef, Literal
from nevow import flat, tags as T

try:
    os.mkdir("/tmp/revyu-cache")
except OSError:
    pass

SPARQL_RESULTS = "{http://www.w3.org/2005/sparql-results#}"

def nodeElement(e):
    if e[0].tag == SPARQL_RESULTS + 'uri':
        u = e[0].text
        if not u.startswith('http'):
            u = "http://revyu.com/" + u
        return URIRef(u)
    elif e[0].tag == SPARQL_RESULTS + 'unbound':
        return None
    elif e[0].tag == SPARQL_RESULTS + 'literal':
        dt = e[0].get('datatype', None)
        return Literal(e[0].text, datatype=dt)
    raise NotImplementedError

def fetch(query):
    cacheFile = os.path.join("/tmp", # __file__ is broken
                             "revyu-cache",
                             str(abs(hash(query))))
    try:
        if os.path.getmtime(cacheFile) > time.time() - 60 * 10:
            return open(cacheFile).read()
    except KeyboardInterrupt: raise
    except Exception, e:
        pass
    
    url = "http://revyu.com/sparql?query=%s" % urllib.quote(query, safe='')
    result = urllib.urlopen(url).read()
    f = open(cacheFile, "w")
    f.write(result)
    f.close()
    return result
    
def recentReviews():
    result = fetch("""
PREFIX rev: <http://purl.org/stuff/rev#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?thing ?name ?review ?createdOn ?rating
WHERE
{
  ?thing rdfs:label ?name ;
         rev:hasReview ?review .
  ?review rev:reviewer <people/drewp> ;
          rev:createdOn ?createdOn ;
          rev:rating ?rating .
} 
ORDER BY DESC(?createdOn)
LIMIT 10
""")

    et = fromstring(result)
    headers = [e.get('name') for e in et.find(SPARQL_RESULTS + 'head')]
    rows = []
    for result in et.find(SPARQL_RESULTS + 'results').getchildren():
        bindings = dict([(b.get('name').replace('?',''),
                          nodeElement(b.getchildren()))
                         for b in result.findall(SPARQL_RESULTS + 'binding')])
        rows.append(bindings)
        
    rows.sort(key=lambda row: row['createdOn'], reverse=True)
    return flat.ten.flatten(T.table(class_="recentReviews")[
        T.tr[T.th(class_="recentReviews title", colspan=3)[
             "Recent reviews on ", T.a(class_="recentReviews",
                                       href="http://revyu.com")["revyu.com"],
             #" (-tmp)"
               ]],
        T.tr[T.th["Date"], T.th["Review"], T.th["Rating"]],
        [T.tr[T.td(class_="date")[row['createdOn'].split('T')[0]],
              T.td(class_="subj")[T.a(href=row['review'])[row['name']]],
              T.td(class_="rate")[row['rating']]]
         for row in rows]
        ])

if __name__ == '__main__':
    print recentReviews()
