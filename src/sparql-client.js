'use strict'

var utils = require('./utils.js');

var defaultQueries = {
  documentUri: 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object} ORDER BY ?property',
  document: 'SELECT DISTINCT * WHERE {<{URI}> ?property ?object}',
  bnode: 'SELECT DISTINCT *  WHERE {<{URI}> ?property ?object}',
  inverse: 'SELECT DISTINCT * WHERE {?object ?property <{URI}>.} LIMIT 100',
  inverseSameAs: 'SELECT DISTINCT * WHERE {{?object <http://www.w3.org/2002/07/owl#sameAs> <{URI}> } UNION { ?object <http://www.w3.org/2004/02/skos/core#exactMatch> <{URI}>}}'
};

// TODO: get from SparqlClient options
var extract = {
  types: [ 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' ],
  titles: [
    'http://purl.org/linked-data/api/vocab#label',
    'http://schema.org/name',
    'http://www.w3.org/2004/02/skos/core#notation',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#value',
    'http://www.geonames.org/ontology#name',
    'http://purl.org/dc/elements/1.1/title',
    'http://purl.org/dc/terms/title',
    'http://www.w3.org/2000/01/rdf-schema#label',
    'http://www.w3.org/2004/02/skos/core#prefLabel',
    'http://rdf.freebase.com/ns/type.object.name',
    'http://xmlns.com/foaf/0.1/firstName',
    'http://xmlns.com/foaf/0.1/lastName',
    'http://xmlns.com/foaf/0.1/surname',
    // 'http://xmlns.com/foaf/0.1/name',
    'http://purl.org/dc/terms/description',
    'http://www.geonames.org/ontology/officialName'
  ],
  images: [
    'http://www.w3.org/2006/vcard/ns#photo',
    'http://xmlns.com/foaf/0.1/depiction',
    'http://dbpedia.org/ontology/thumbnail',
    'http://dbpedia.org/property/logo',
    'http://linkedgeodata.org/ontology/schemaIcon'
  ],
  longitudes: [
    'http://www.w3.org/2003/01/geo/wgs84_pos#long'
  ],
  latitudes: [
    'http://www.w3.org/2003/01/geo/wgs84_pos#lat'
  ],
  points: [
    'http://www.georss.org/georss/point'
  ],
  weblinks: [
    'http://www.w3.org/ns/dcat#accessURL',
    'http://xmlns.com/foaf/0.1/mbox',
    'http://rdfs.org/sioc/ns#links_to',
    'http://it.dbpedia.org/property/url',
    'http://data.nytimes.com/elements/search_api_query',
    'http://www.w3.org/2000/01/rdf-schema#isDefinedBy',
    'http://xmlns.com/foaf/0.1/page',
    'http://xmlns.com/foaf/0.1/homepage',
    'http://purl.org/dc/terms/isReferencedBy',
    'http://purl.org/dc/elements/1.1/relation',
    'http://dbpedia.org/ontology/wikiPageExternalLink',
    'http://data.nytimes.com/elements/topicPage'
  ]
};

var excludedTypes = [
  'images',
  'longitudes',
  'latitudes',
  'points',
  'weblinks'
];

var excludedPredicates = Array.prototype.concat.apply([],
  excludedTypes.map(function(type) { return extract[type]; })
);

var lookup = utils.invert(extract);

function mergeRelated(input) {
  input = input.filter(function(uri) {
    return excludedPredicates.indexOf(uri.predicate) === -1;
  });

  return utils.mergeBy(
    utils.mergeBy(input, 'object', 'property'),
    'property',
    'object'
  );
}

function parseBindings(bindings) {
  var result = {
    extracted: {},
    grouped: [],
    values: [],
    related: [],
    bnodes: []
  };

  bindings.forEach(function(binding) {
    var property = binding.property.value;
    var object = binding.object.value;
    var type = binding.object.type;
    var extractType = lookup[property];
    var obj;

    if (type === 'bnode') {
      obj = { property: property, bnode: object };
      result.bnodes.push(obj);
    } else if (type === 'uri') {
      obj = { property: property, object: object };
      result.related.push(obj);
    } else {
      obj = { property: property, value: object };
      if (type === 'typed-literal') {
        obj.type = binding.object.datatype;
      }
      if (binding.object['xml:lang']) {
        obj.lang = binding.object['xml:lang'];
      }
      result.values.push(obj);
    }

    if (extractType) {
      utils.append(result.extracted, extractType, obj);
    }
  });

  return result;
}

function parseResults(bindings) {
  var info = { uris: [], bnodes: [], values: [] };

  $.each(bindings, function(key, value) {
    var newVal = {};
    newVal[value.property.value] = value.object.value;
    if (value.object.type === 'uri') {
      info.uris.push(newVal);
    } else if (value.object.type === 'bnode') {
      info.bnodes.push(newVal);
    } else {
      info.values.push(newVal);
    }
  });

  return info;
}

function SparqlClient(httpClientFactory, options) {
  if (!(this instanceof SparqlClient)) {
    return new SparqlClient(httpClientFactory, options);
  }

  this.httpClient = httpClientFactory.create(options.connection);

  this.getQueryTemplate = function(axis) {
    return options.queries && options.queries[axis] ?
           options.queries[axis] :
           defaultQueries[axis];
  };
}

SparqlClient.prototype.getQuery = function getQuery(axis, iri) {
  return this.getQueryTemplate(axis)
  .replace(/\{URI\}/ig, iri.replace(/^.*~~/, ''));
};

SparqlClient.prototype.document = function document(iri, callbacks) {
  var axis = 'document';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseBindings(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.bnode = function bnode(iri, callbacks) {
  var axis = 'bnode';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      callbacks.success( parseResults(json.results.bindings) );
    }
  });
};

SparqlClient.prototype.documentUri = function documentUri(iri, callbacks) {
  var axis = 'documentUri';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      var results = parseBindings(json.results.bindings);

      results.grouped = mergeRelated(results.related);

      callbacks.success(results);
    }
  });
};

SparqlClient.prototype.inverse = function inverse(iri, callbacks) {
  var axis = 'inverse';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      var results = parseBindings(json.results.bindings);

      results.grouped = mergeRelated(results.related);

      results.grouped.forEach(function(grouped) {
        grouped.inverse = true;
      });

      callbacks.success(results);
    }
  });
};

SparqlClient.prototype.inverseSameAs = function inverseSameAs(iri, callbacks) {
  var axis = 'inverseSameAs';
  var query = this.getQuery(axis, iri);

  return this.httpClient({ query: query }, {
    beforeSend: callbacks.beforeSend,
    error: callbacks.error,
    success : function(json) {
      if ( !(json && json.results && json.results.bindings) ) {
        console.error(json);
        return callbacks.error(new Error('malformed results'));
      }

      // ugh
      json.results.bindings.forEach(function(binding) {
        binding.property = binding.property || { value: 'http://www.w3.org/2002/07/owl#sameAs' };
      });

      var results = parseBindings(json.results.bindings);

      results.grouped = mergeRelated(results.related);

      results.grouped.forEach(function(grouped) {
        grouped.inverse = true;
      });

      callbacks.success(results);
    }
  });
};


var sparqlClientFactory = {
  create: function(httpClientFactory, options) {
    return new SparqlClient(httpClientFactory, options);
  }
};

module.exports = sparqlClientFactory;

// temporary, for testing
if (!window.sparqlClientFactory) {
  window.sparqlClientFactory = sparqlClientFactory;
}
