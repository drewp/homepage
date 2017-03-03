define(function(require, exports, module) {
    
// a more straightforward store than rdfstore.Store, which I haven't
// figured out yet wrt quads.
function QuadStore() {
    this.nodeLookup = new Map(); // ntstring: node
    this.index = new Map();  // {graphNt: {subjNt: {predNt: {objNt: true}}}}
}
exports.QuadStore = QuadStore;

QuadStore.prototype.clear = function() {
    this.index.clear();
};

QuadStore.prototype.ntKey = function(node) {
    var nt = node.toNT();
    this.nodeLookup.set(nt, node);
    return nt; // could return a small int, even
}

QuadStore.prototype.add = function(quad) {
    function setdefault(obj, k, default_) {
        var v = obj.get(k);
        if (v === undefined) {
            obj.set(k, default_);
            v = default_;
        }
        return v;
    }
    
    var m = setdefault(this.index, this.ntKey(quad.graph), new Map());
    m = setdefault(m, this.ntKey(quad.subject), new Map());
    m = setdefault(m, this.ntKey(quad.predicate), new Map());
    setdefault(m, this.ntKey(quad.object), true);
};

QuadStore.prototype.remove = function(quad) {
    // doesn't care if the quad was in the graph or not
    try {
        function clean(parent, key, child) {
            if (child.size == 0) {
                parent.delete(key);
                return true;
            }
            return false;
        }

        var g = this.ntKey(quad.graph);
        var s = this.ntKey(quad.subject);
        var p = this.ntKey(quad.predicate);
        
        var l1 = this.index.get(g);
        if (l1 === undefined) { return; }
        var l2 = l1.get(s);
        if (l2 === undefined) { return; }
        var l3 = l2.get(p);
        if (l3 === undefined) { return; }
        l3.delete(this.ntKey(quad.object));
        // (may leave garbage in this.nodeLookup)
        if (clean(l2, p, l3)) {
            if (clean(l1, s, l2)) {
                clean(this.index, g, l1);
            }
        }
    } catch(e) {
        console.log('while removing', quad, ':');
        throw e;
    }
};

QuadStore.prototype.quads = function(match, onQuad) {
    // match is {subject: null, predicate: null, object: null, graph: null}
    var matchNt = {s: (match && match.subject) ? match.subject.toNT() : null,
                   p: (match && match.predicate) ? match.predicate.toNT() : null,
                   o: (match && match.object) ? match.object.toNT() : null,
                   g: (match && match.graph) ? match.graph.toNT() : null};
    var node = this.nodeLookup;
    this.index.forEach(function(vs, graphNt) {
        if (matchNt.g === null || matchNt.g == graphNt) {
            vs.forEach(function(vp, subjNt) {
                if (matchNt.s === null || matchNt.s == subjNt) {
                    vp.forEach(function(vo, predNt) {
                        if (matchNt.p === null || matchNt.p == predNt) {
                            vo.forEach(function(_true, objNt) {
                                if (matchNt.o === null || matchNt.o == objNt) {
                                    onQuad({subject: node.get(subjNt),
                                            predicate: node.get(predNt),
                                            object: node.get(objNt),
                                            graph: node.get(graphNt)});
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};
});
