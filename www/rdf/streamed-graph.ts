/// <reference path="declarations.d.ts"/>

import * as async from "async";
import * as jsonld from "jsonld";
import * as QuadStore from "quadstore";
import * as rdfstore from "rdfstore";

type Node = any; // todo
type Quad = {
    subject: Node;
    predicate: Node;
    object: Node;
    graph: Node,
};

type Update = { type: string; data: string };

function eachJsonLdQuad(rdfEnv: any, jsonLdObj: object, onQuad: (Quad)=>void, done: ()=>void) {
    jsonld.expand(jsonLdObj, function onExpand(err, expanded) {
        if (err) { throw new Error(); }
        expanded.forEach(function(g) {
            var graph = g['@id'];
            var graphNode = rdfEnv.createNamedNode(graph);
            g['@graph'].forEach(function(subj) {
                for (var pred in subj) {
                    if (pred.match(/^[^@]/)) {
                        subj[pred].forEach(function(obj) {
                            var quad = {
                                subject: rdfEnv.createNamedNode(subj['@id']),
                                predicate: rdfEnv.createNamedNode(pred),
                                object: (obj['@id'] ? rdfEnv.createNamedNode(obj['@id']) :
                                         rdfEnv.createLiteral(
                                             obj['@value'], obj['@language'], obj['@type'])),
                                graph: graphNode,
                            };
                            onQuad(quad);
                        });
                    } else  {
                        if (pred === "@type") {
                            subj[pred].forEach((obj) => {
                                onQuad({
                                    subject: rdfEnv.createNamedNode(subj['@id']),
                                    predicate: rdfEnv.createNamedNode('rdf:type'),
                                    object: rdfEnv.createNamedNode(obj),
                                    graph: graphNode,
                                });
                            });
                        }
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
    store: rdfstore.Store;
    events: sse.IEventSourceStatic;
    updates: Array<Update>;
    constructor(eventsUrl: string, onGraphChanged: ()=>void, onStatus: (string)=>void, prefixes: Array<Record<string, string>>, staticGraphUrls: Array<string>) {
        console.log('new StreamedGraph', eventsUrl);
        // holds a rdfstore.js store, which is synced to a server-side
        // store that sends patches over SSE
        this.onStatus = onStatus;
        this.onGraphChanged = onGraphChanged;
        this.onStatus('startup...');
        this.quadStore = new QuadStore();
        
        this.store = null;
        this.updates = [];
        rdfstore.create((err, store) => {
            this.store = store; // barely used yet- data is really in quadStore
            Object.keys(prefixes).forEach((prefix) => {
                this.store.setPrefix(prefix, prefixes[prefix]);
            });
            this.flushUpdates();
            
            this.connect(eventsUrl);
            this.reconnectOnWake();
        });

        staticGraphUrls.forEach((url) => {
            fetch(url).then((response) => response.text())
                .then((body) => {
                    // parse with n3, add to output
                });
            });
        });
    }
    reconnectOnWake() {
        // it's not this, which fires on every mouse-in on a browser window, and doesn't seem to work for screen-turned-back-on
        //window.addEventListener('focus', function() { this.connect(eventsUrl); }.bind(this));

    }
    
    flushUpdates(done?: ()=>void) {
        async.retry(
            {times: 20, interval: 100},
            (cb) => {
                if (this.store === null) {
                    requestAnimationFrame(function() {
                        cb("store not ready");
                    });
                    return;
                }
                this.flushUpdatesWithStore(cb);
            },
            function (err) {
                if(done) done();
            });
    }

    flushUpdatesWithStore(done: ()=>void) {
        // This is flushUpdates, but we've waited for the initial store to
        // be ready.
        let test = () => { return this.updates.length > 0; };
        let go = (done: ()=>void) => {
            var update = this.updates.shift();
            if (!update) {
                return done();
            }
            this.flushOneUpdate(update, done);
        };
        // note that more updates might get added while this is running
        async.whilst(test, go, (err) => {done();});
    }

    flushOneUpdate(update: Update, done: ()=>void) {
        if (update.type == 'fullGraph') {
            this.onStatus('sync- full graph update');
            let onReplaced = () => {
                this.onStatus('synced');
                this.onGraphChanged();
                done();
            };
            this.replaceFullGraph(update.data, onReplaced);
        } else if (update.type == 'patch') {
            this.onStatus('sync- updating');
            let onPatched = () => {
                this.onStatus('synced');
                this.onGraphChanged();
                done();
            };
            this.patchGraph(update.data, onPatched);
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
    
    testEventUrl(eventsUrl: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.onStatus('testing connection');
            fetch(eventsUrl, {
                method: "HEAD",
                credentials: "include",
            }).then((value)=>{
                if (value.status == 403) {
                    reject();
                    return;
                }
                resolve();
            }).catch((err)=>{
                reject();
             
            });
            
        });
    }

    connect(eventsUrl: string) {
        // need to exit here if this obj has been replaced
        
        this.onStatus('start connect...');
        this.close();
        if (this.events && this.events.readyState != EventSource.CLOSED) {
            this.onStatus('zombie');
            throw new Error("zombie eventsource");
        }
        this.events = new EventSource(eventsUrl);
        
        this.events.addEventListener('error', (ev) => {
            // todo: this is piling up tons of retries and eventually multiple connections
            this.testEventUrl(eventsUrl);
            this.onStatus('connection lost- retrying');
            setTimeout(() => {
                requestAnimationFrame(() => {
                    this.connect(eventsUrl);
                });
            }, 3000);
        });
        
        this.events.addEventListener('fullGraph', (ev) => {
            this.updates.push({type: 'fullGraph', data: ev.data});
            this.flushUpdates();
        });
        
        this.events.addEventListener('patch', (ev) => {
            this.updates.push({type: 'patch', data: ev.data});
            this.flushUpdates();
        });
        this.onStatus('connecting...');
    }
    
    replaceFullGraph(jsonLdText: string, done: ()=>void) {
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
    
    patchGraph(patchJson: string, done: ()=>void) {
        var patch = JSON.parse(patchJson).patch;

        if (!this.store) {
            throw new Error('store ' + this.store);
        }
        
        async.series([
            (done) => {
                eachJsonLdQuad(this.store.rdf, patch.deletes,
                               this.quadStore.remove.bind(this.quadStore), done);
            },
            (done) => {
                eachJsonLdQuad(this.store.rdf, patch.adds,
                               this.quadStore.add.bind(this.quadStore), done);
            },
            /* seriesDone */ (done) => {
                done();
            }
        ], done);
    }

}
