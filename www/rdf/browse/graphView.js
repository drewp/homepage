import { html } from '/lib/lit-html/1.0.0/lit-html.js';

// from rdf-uri.html
window.BigastUri = {
  // not well defined for uri prefixes that are string prefixes of each other
  compactUri: function (uri) {
    if (uri === undefined) {
      return uri;
    }
    if (uri == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
      return "a";
    }
    for (var short of Object.keys(window.NS)) {
      var prefix = window.NS[short];
      if (uri.indexOf(prefix) == 0) {
        return short + ':' + uri.substr(prefix.length);
      }
    }
    return uri;
  },
  expandUri: function (s) {
    for (var short of Object.keys(window.NS)) {
      var prefix = window.NS[short];
      if (s.indexOf(short + ":") == 0) {
        return prefix + s.substr(short.length + 1);
      }
    }
    return s;
  },
};


const rdfNode = (n) => {
  if (n.interfaceName == "Literal") {
    let dtPart = "";
    if (n.datatype) {
      dtPart = html`
        ^^<span class="literalType">
          ${rdfNode({ interfaceName: "NamedNode", toString: () => { return n.datatype; } })}
        </span>`;
    }
    return html`<span class="literal">${n.nominalValue}${dtPart}</span>`;
  }
  if (n.interfaceName == "NamedNode") {
    return html`<a class="graphUri" href="${n.toString()}">${window.BigastUri.compactUri(n.toString())}</a>`;
  }

  return html`[${n.interfaceName} ${n.toNT()}]`;
}

const graphView = (graph) => {
  const objBlock = (obj) => {
    return html`
        <div class="object">
          ${rdfNode(obj)} <!-- indicate what source or graph said this stmt -->
        </div>
    `;
  };

  // always table-format the common preds?
  const predBlock = (subj, pred) => {
    const objsSet = new Set();
    graph.quadStore.quads({ subject: subj, predicate: pred }, (q) => {
      objsSet.add(q.object);
    });
    const objs = Array.from(objsSet.values());
    objs.sort();
    return html`
      <div class="predicate">${rdfNode(pred)}
        <div>
          ${objs.map(objBlock)}
        </div>
      </div>
    `;
  };

  const subjBlock = (subj) => {
    const predsSet = new Set();
    graph.quadStore.quads({ subject: subj }, (q) => {
      predsSet.add(q.predicate);
    });
    const preds = Array.from(predsSet.values());
    preds.sort();
    return html`
      <div class="subject">${rdfNode(subj)}
        <!-- todo: special section for uri/type-and-icon/label/comment -->
        <div>
          ${preds.map((p) => { return predBlock(subj, p); })}
        </div>
      </div>
    `;
  };

  const subjsSet = new Set();
  graph.quadStore.quads({}, (q) => {
    subjsSet.add(q.subject);
  });
  const subjs = Array.from(subjsSet.values());
  subjs.sort();
  //todo group by type
  return html`   
    <style>
      .spoGrid {
          display: flex;
          flex-direction: column;
      }
      .subject, .predicate {
          display: flex;
          align-items: baseline;
      }
    
      .predicate, .object {
          margin-left: 5px;
      }
      .subject { border-top: 1px solid gray; }
      .literal { 
          border: 1px solid gray;
          background: white;
          border-radius: 9px;
          padding: 4px;
          margin: 3px;
      }
      
      .subject > .node { border: 2px solid rgb(68, 141, 68); }
      .literalType {
          vertical-align: super;
          font-size: 80%;
      }
      .literal {
          display: inline-block;
          font-family: monospace;
          font-size: 115%;
      }
      .resource {
          display: inline-block;
          background: lightblue;
          border-radius: 6px;
          padding: 1px 6px;
          margin: 2px;
      }
      .comment { color: green; }
     </style>
    
    <section>
      <h2>
        Current statements (<a href="${graph.events.url}">${graph.events.url}</a>)
      </h2>
      <div>
        These statements are all in the
        <span data-bind="html: $root.createCurie(graphUri())">...</span> graph.
      </div>
      <div class="spoGrid">
        ${subjs.map(subjBlock)}
      </div>
    </section>

  `;
}
export { graphView }
