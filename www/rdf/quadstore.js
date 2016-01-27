// a more straightforward store than rdfstore.Store, which I haven't
// figured out yet wrt quads.
function QuadStore() {
    this.index = new Map();  // {graphNt: {subjNt: {predNt: {objNt: true}}}}
}
QuadStore.prototype.clear = function() {
    this.index.clear();
};
QuadStore.prototype.add = function(quad) {
    function setdefault(obj, k, default_) {
        var v = obj.get(k);
        if (v === undefined) {
            obj.set(k, default_);
            v = default_;
        }
        return v;
    }
    
    var m = setdefault(this.index, quad.graph.toNT(), new Map());
    m = setdefault(m, quad.subject.toNT(), new Map());
    m = setdefault(m, quad.predicate.toNT(), new Map());
    setdefault(m, quad.object.toNT(), true);
};
QuadStore.prototype.remove = function(quad) {

    function clean(parent, key, child) {
        if (child.size == 0) {
            parent.delete(key);
            return true;
        }
        return false;
    }

    var g = quad.graph.toNT();
    var s = quad.subject.toNT();
    var p = quad.predicate.toNT();
    
    var l1 = this.index.get(g);
    var l2 = l1.get(s);
    var l3 = l2.get(p);
    l3.delete(quad.object.toNT());
    if (clean(l2, p, l3)) {
        if (clean(l1, s, l2)) {
            clean(this.index, g, l1);
        }
    }
};
QuadStore.prototype.quads = function(onQuad) {
    // yield all quads. parse the NT? look it up in another mapping?
};
