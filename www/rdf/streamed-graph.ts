/// <reference path="declarations.d.ts"/>

import * as jsonld from "jsonld-module";
import * as async from "async-module";
import * as rdfstore from "rdfstore-module";
import { QuadStore } from "quadstore-module";

export var eachJsonLdQuad = function(rdfEnv, jsonLdObj, onQuad, done) {
   jsonld.expand(jsonLdObj, function onExpand(err, expanded) {
     if (err) { throw new Error(); }
     expanded.forEach(function(g) {
       var graph = g['@id'];
       g['@graph'].forEach(function(subj) {
         for (var pred in subj) {
           if (pred.match(/^[^@]/)) {
             subj[pred].forEach(function(obj) {
               var quad = {
                 subject: rdfEnv.createNamedNode(subj['@id']),
                 predicate: rdfEnv.createNamedNode(pred),
                 object: (obj['@id'] ? rdfEnv.createNamedNode(obj['@id']) :
                          rdfEnv.createLiteral(
                   obj['@value'], obj['@type'], obj['@language'])),
                 graph: rdfEnv.createNamedNode(graph),
               };
               onQuad(quad);
             });
           }
         }
        });
     });
     done();
   });
 };
 
export class StreamedGraph {
    onStatus: (msg: string)=>void;
    onGraphChanged: ()=>void;
    quadStore: QuadStore;
    updates: Array;
    constructor(eventsUrl, onGraphChanged, onStatus) {
        console.log('new StreamedGraph', eventsUrl);
        // holds a rdfstore.js store, which is synced to a server-side
        // store that sends patches over SSE
        this.onStatus = onStatus;
        this.onGraphChanged = onGraphChanged;
        this.onStatus('startup...');
        this.quadStore = new QuadStore();
        
        this.store = null;
        this.updates = [];
        new rdfstore.Store(function(err, store) {
            this.store = store; // barely used yet- data is really in quadStore
            this.flushUpdates();

            this.connect(eventsUrl);
            this.reconnectOnWake();
        }.bind(this));
    }
     reconnectOnWake() {
         // it's not this, which fires on every mouse-in on a browser window, and doesn't seem to work for screen-turned-back-on
         //window.addEventListener('focus', function() { this.connect(eventsUrl); }.bind(this));

     }
     
     flushUpdates(done) {
         async.retry(
             {times: 20, interval: 100},
             function (cb) {
                 if (this.store === null) {
                     requestAnimationFrame(function() {
                         cb("store not ready");
                     });
                     return;
                 }
                 this.flushUpdatesWithStore(cb);
             }.bind(this),
             function (err) {
                 if(done) done();
             });
     }

     flushUpdatesWithStore(done) {
         // This is flushUpdates, but we've waited for the initial store to
         // be ready.
         async.whilst(
             // note that more updates might get added while this is running
             function test() { return this.updates.length > 0; }.bind(this),
             function go(done) {
                 var update = this.updates.shift();
                 if (!update) {
                     return done();
                 }
                 this.flushOneUpdate(update, done);
             }.bind(this),
             function(err) {
                 done();
             });
     }

     flushOneUpdate(update, done) {
         if (update.type == 'fullGraph') {
             this.onStatus('sync- full graph update');
             this.replaceFullGraph(update.data, function onReplaced() {
                 this.onStatus('synced');
                 this.onGraphChanged();
                 done();
             }.bind(this));
         } else if (update.type == 'patch') {
             this.onStatus('sync- updating');
             this.patchGraph(update.data, function onPatched() {
                 this.onStatus('synced');
                 this.onGraphChanged();
                 done();
             }.bind(this));
         } else {
             this.onStatus('sync- unknown update');
             throw new Error(update.type);
         }
     }

     close() {
         if (this.events) {
             this.events.close();
         }
     }

     connect(eventsUrl) {
         this.onStatus('start connect...');
         this.close();
         if (this.events && this.events.readyState != EventSource.CLOSED) {
             this.onStatus('zombie');
             throw new Error("zombie eventsource");
         }
         this.events = new EventSource(eventsUrl);
         
         this.events.addEventListener('error', function(ev) {
             // todo: this is piling up tons of retries and eventually multiple connections
             this.onStatus('connection lost- retrying');
             setTimeout(function() {
                 requestAnimationFrame(function() {
                     this.connect(eventsUrl);
                 }.bind(this));
             }.bind(this), 3000);
         }.bind(this));
         
         this.events.addEventListener('fullGraph', function(ev) {
             this.updates.push({type: 'fullGraph', data: ev.data});
             this.flushUpdates();
         }.bind(this));
         
         this.events.addEventListener('patch', function(ev) {
             this.updates.push({type: 'patch', data: ev.data});
             this.flushUpdates();
         }.bind(this));
         this.onStatus('connecting...');
     }
     
     replaceFullGraph(jsonLdText, done) {
         this.quadStore.clear();
         eachJsonLdQuad(this.store.rdf, JSON.parse(jsonLdText),
                        this.quadStore.add.bind(this.quadStore), function() {
                            done();
                        });
         // or this.store.insert([quad], quad.graph, function() {});
     }

     /*
        attempt to parse into rdfstore.Store
        this.store.load('application/ld+json', jsonLd, function(err, num) {
        console.log('finished jsonld load: ', num, ' triples');

        attempt to dump contents of rdfstore.Store
        this.store.registeredGraphs(function (err, rg) {
        if (!err && !rg.length) {
        console.log('0 registered graphs in store');
        }
        
        this.store.graph(function(err, q) {
        q.triples.forEach(function(t) {
        console.log(q, t.toString());
        }.bind(this));
        }.bind(this));
        
        rg.forEach(function(g) {
        this.store.graph(g, function(a,b,c) {
        console.log('graph', g, a, b, c);
        }.bind(this));
        }.bind(this));
        }.bind(this));
        
        }.bind(this));
      */
     
     patchGraph(patchJson, done) {
         var patch = JSON.parse(patchJson).patch;

         if (!this.store) {
             throw new Error('store ' + this.store);
         }
         
         async.series([
             function(done) {
                 eachJsonLdQuad(this.store.rdf, patch.deletes,
                                this.quadStore.remove.bind(this.quadStore), done);
             }.bind(this),
             function(done) {
                 eachJsonLdQuad(this.store.rdf, patch.adds,
                                this.quadStore.add.bind(this.quadStore), done);
             }.bind(this),
             function seriesDone(done) {
                 done();
             }.bind(this)
         ], done);
     }

}
