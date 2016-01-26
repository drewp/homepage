// a more straightforward store than rdfstore.Store, which I haven't
// figured out yet wrt quads.
function QuadStore() {
    this.index = {};  // {graphNt: {subjNt: {predNt: {objNt: true}}}}
}
QuadStore.prototype.clear = function() {
    this.index = {};
};
QuadStore.prototype.add = function(quad) {
    function setdefault(obj, k, def) {
        if (obj[k] === undefined) {
            obj[k] = def;
        }
        return obj[k];
    }
    
    var v = setdefault(this.index, quad.graph.toNT(), {});
    v = setdefault(v, quad.subject.toNT(), {});
    v = setdefault(v, quad.predicate.toNT(), {});
    setdefault(v, quad.object.toNT(), true);
};
QuadStore.prototype.remove = function(quad) {

    function clean(parent, key, child) {
        if (Object.keys(child).length == 0) {
            delete parent[key];
            return true;
        }
        return false;
    }

    var g = quad.graph.toNT();
    var s = quad.subject.toNT();
    var p = quad.predicate.toNT();
    
    var l1 = this.index[g];
    var l2 = l1[s];
    var l3 = l2[p];
    delete l3[quad.object.toNT()];
    if (clean(l2, p, l3)) {
        if (clean(l1, s, l2)) {
            clean(this.index, g, l1);
        }
    }
};
QuadStore.prototype.quads = function(onQuad) {
    // yield all quads. parse the NT? look it up in another mapping?
};
