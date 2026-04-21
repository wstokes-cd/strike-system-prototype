/******/ var __webpack_modules__ = ({

/***/ 410:
/***/ ((__unused_webpack_module, exports) => {

/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function (Hogan) {
  // Setup regex  assignments
  // remove whitespace according to Mustache spec
  var rIsWhitespace = /\S/,
      rQuot = /\"/g,
      rNewline =  /\n/g,
      rCr = /\r/g,
      rSlash = /\\/g,
      rLineSep = /\u2028/,
      rParagraphSep = /\u2029/;

  Hogan.tags = {
    '#': 1, '^': 2, '<': 3, '$': 4,
    '/': 5, '!': 6, '>': 7, '=': 8, '_v': 9,
    '{': 10, '&': 11, '_t': 12
  };

  Hogan.scan = function scan(text, delimiters) {
    var len = text.length,
        IN_TEXT = 0,
        IN_TAG_TYPE = 1,
        IN_TAG = 2,
        state = IN_TEXT,
        tagType = null,
        tag = null,
        buf = '',
        tokens = [],
        seenTag = false,
        i = 0,
        lineStart = 0,
        otag = '{{',
        ctag = '}}';

    function addBuf() {
      if (buf.length > 0) {
        tokens.push({tag: '_t', text: new String(buf)});
        buf = '';
      }
    }

    function lineIsWhitespace() {
      var isAllWhitespace = true;
      for (var j = lineStart; j < tokens.length; j++) {
        isAllWhitespace =
          (Hogan.tags[tokens[j].tag] < Hogan.tags['_v']) ||
          (tokens[j].tag == '_t' && tokens[j].text.match(rIsWhitespace) === null);
        if (!isAllWhitespace) {
          return false;
        }
      }

      return isAllWhitespace;
    }

    function filterLine(haveSeenTag, noNewLine) {
      addBuf();

      if (haveSeenTag && lineIsWhitespace()) {
        for (var j = lineStart, next; j < tokens.length; j++) {
          if (tokens[j].text) {
            if ((next = tokens[j+1]) && next.tag == '>') {
              // set indent to token value
              next.indent = tokens[j].text.toString()
            }
            tokens.splice(j, 1);
          }
        }
      } else if (!noNewLine) {
        tokens.push({tag:'\n'});
      }

      seenTag = false;
      lineStart = tokens.length;
    }

    function changeDelimiters(text, index) {
      var close = '=' + ctag,
          closeIndex = text.indexOf(close, index),
          delimiters = trim(
            text.substring(text.indexOf('=', index) + 1, closeIndex)
          ).split(' ');

      otag = delimiters[0];
      ctag = delimiters[delimiters.length - 1];

      return closeIndex + close.length - 1;
    }

    if (delimiters) {
      delimiters = delimiters.split(' ');
      otag = delimiters[0];
      ctag = delimiters[1];
    }

    for (i = 0; i < len; i++) {
      if (state == IN_TEXT) {
        if (tagChange(otag, text, i)) {
          --i;
          addBuf();
          state = IN_TAG_TYPE;
        } else {
          if (text.charAt(i) == '\n') {
            filterLine(seenTag);
          } else {
            buf += text.charAt(i);
          }
        }
      } else if (state == IN_TAG_TYPE) {
        i += otag.length - 1;
        tag = Hogan.tags[text.charAt(i + 1)];
        tagType = tag ? text.charAt(i + 1) : '_v';
        if (tagType == '=') {
          i = changeDelimiters(text, i);
          state = IN_TEXT;
        } else {
          if (tag) {
            i++;
          }
          state = IN_TAG;
        }
        seenTag = i;
      } else {
        if (tagChange(ctag, text, i)) {
          tokens.push({tag: tagType, n: trim(buf), otag: otag, ctag: ctag,
                       i: (tagType == '/') ? seenTag - otag.length : i + ctag.length});
          buf = '';
          i += ctag.length - 1;
          state = IN_TEXT;
          if (tagType == '{') {
            if (ctag == '}}') {
              i++;
            } else {
              cleanTripleStache(tokens[tokens.length - 1]);
            }
          }
        } else {
          buf += text.charAt(i);
        }
      }
    }

    filterLine(seenTag, true);

    return tokens;
  }

  function cleanTripleStache(token) {
    if (token.n.substr(token.n.length - 1) === '}') {
      token.n = token.n.substring(0, token.n.length - 1);
    }
  }

  function trim(s) {
    if (s.trim) {
      return s.trim();
    }

    return s.replace(/^\s*|\s*$/g, '');
  }

  function tagChange(tag, text, index) {
    if (text.charAt(index) != tag.charAt(0)) {
      return false;
    }

    for (var i = 1, l = tag.length; i < l; i++) {
      if (text.charAt(index + i) != tag.charAt(i)) {
        return false;
      }
    }

    return true;
  }

  // the tags allowed inside super templates
  var allowedInSuper = {'_t': true, '\n': true, '$': true, '/': true};

  function buildTree(tokens, kind, stack, customTags) {
    var instructions = [],
        opener = null,
        tail = null,
        token = null;

    tail = stack[stack.length - 1];

    while (tokens.length > 0) {
      token = tokens.shift();

      if (tail && tail.tag == '<' && !(token.tag in allowedInSuper)) {
        throw new Error('Illegal content in < super tag.');
      }

      if (Hogan.tags[token.tag] <= Hogan.tags['$'] || isOpener(token, customTags)) {
        stack.push(token);
        token.nodes = buildTree(tokens, token.tag, stack, customTags);
      } else if (token.tag == '/') {
        if (stack.length === 0) {
          throw new Error('Closing tag without opener: /' + token.n);
        }
        opener = stack.pop();
        if (token.n != opener.n && !isCloser(token.n, opener.n, customTags)) {
          throw new Error('Nesting error: ' + opener.n + ' vs. ' + token.n);
        }
        opener.end = token.i;
        return instructions;
      } else if (token.tag == '\n') {
        token.last = (tokens.length == 0) || (tokens[0].tag == '\n');
      }

      instructions.push(token);
    }

    if (stack.length > 0) {
      throw new Error('missing closing tag: ' + stack.pop().n);
    }

    return instructions;
  }

  function isOpener(token, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].o == token.n) {
        token.tag = '#';
        return true;
      }
    }
  }

  function isCloser(close, open, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].c == close && tags[i].o == open) {
        return true;
      }
    }
  }

  function stringifySubstitutions(obj) {
    var items = [];
    for (var key in obj) {
      items.push('"' + esc(key) + '": function(c,p,t,i) {' + obj[key] + '}');
    }
    return "{ " + items.join(",") + " }";
  }

  function stringifyPartials(codeObj) {
    var partials = [];
    for (var key in codeObj.partials) {
      partials.push('"' + esc(key) + '":{name:"' + esc(codeObj.partials[key].name) + '", ' + stringifyPartials(codeObj.partials[key]) + "}");
    }
    return "partials: {" + partials.join(",") + "}, subs: " + stringifySubstitutions(codeObj.subs);
  }

  Hogan.stringify = function(codeObj, text, options) {
    return "{code: function (c,p,i) { " + Hogan.wrapMain(codeObj.code) + " }," + stringifyPartials(codeObj) +  "}";
  }

  var serialNo = 0;
  Hogan.generate = function(tree, text, options) {
    serialNo = 0;
    var context = { code: '', subs: {}, partials: {} };
    Hogan.walk(tree, context);

    if (options.asString) {
      return this.stringify(context, text, options);
    }

    return this.makeTemplate(context, text, options);
  }

  Hogan.wrapMain = function(code) {
    return 'var t=this;t.b(i=i||"");' + code + 'return t.fl();';
  }

  Hogan.template = Hogan.Template;

  Hogan.makeTemplate = function(codeObj, text, options) {
    var template = this.makePartials(codeObj);
    template.code = new Function('c', 'p', 'i', this.wrapMain(codeObj.code));
    return new this.template(template, text, this, options);
  }

  Hogan.makePartials = function(codeObj) {
    var key, template = {subs: {}, partials: codeObj.partials, name: codeObj.name};
    for (key in template.partials) {
      template.partials[key] = this.makePartials(template.partials[key]);
    }
    for (key in codeObj.subs) {
      template.subs[key] = new Function('c', 'p', 't', 'i', codeObj.subs[key]);
    }
    return template;
  }

  function esc(s) {
    return s.replace(rSlash, '\\\\')
            .replace(rQuot, '\\\"')
            .replace(rNewline, '\\n')
            .replace(rCr, '\\r')
            .replace(rLineSep, '\\u2028')
            .replace(rParagraphSep, '\\u2029');
  }

  function chooseMethod(s) {
    return (~s.indexOf('.')) ? 'd' : 'f';
  }

  function createPartial(node, context) {
    var prefix = "<" + (context.prefix || "");
    var sym = prefix + node.n + serialNo++;
    context.partials[sym] = {name: node.n, partials: {}};
    context.code += 't.b(t.rp("' +  esc(sym) + '",c,p,"' + (node.indent || '') + '"));';
    return sym;
  }

  Hogan.codegen = {
    '#': function(node, context) {
      context.code += 'if(t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),' +
                      'c,p,0,' + node.i + ',' + node.end + ',"' + node.otag + " " + node.ctag + '")){' +
                      't.rs(c,p,' + 'function(c,p,t){';
      Hogan.walk(node.nodes, context);
      context.code += '});c.pop();}';
    },

    '^': function(node, context) {
      context.code += 'if(!t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),c,p,1,0,0,"")){';
      Hogan.walk(node.nodes, context);
      context.code += '};';
    },

    '>': createPartial,
    '<': function(node, context) {
      var ctx = {partials: {}, code: '', subs: {}, inPartial: true};
      Hogan.walk(node.nodes, ctx);
      var template = context.partials[createPartial(node, context)];
      template.subs = ctx.subs;
      template.partials = ctx.partials;
    },

    '$': function(node, context) {
      var ctx = {subs: {}, code: '', partials: context.partials, prefix: node.n};
      Hogan.walk(node.nodes, ctx);
      context.subs[node.n] = ctx.code;
      if (!context.inPartial) {
        context.code += 't.sub("' + esc(node.n) + '",c,p,i);';
      }
    },

    '\n': function(node, context) {
      context.code += write('"\\n"' + (node.last ? '' : ' + i'));
    },

    '_v': function(node, context) {
      context.code += 't.b(t.v(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
    },

    '_t': function(node, context) {
      context.code += write('"' + esc(node.text) + '"');
    },

    '{': tripleStache,

    '&': tripleStache
  }

  function tripleStache(node, context) {
    context.code += 't.b(t.t(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
  }

  function write(s) {
    return 't.b(' + s + ');';
  }

  Hogan.walk = function(nodelist, context) {
    var func;
    for (var i = 0, l = nodelist.length; i < l; i++) {
      func = Hogan.codegen[nodelist[i].tag];
      func && func(nodelist[i], context);
    }
    return context;
  }

  Hogan.parse = function(tokens, text, options) {
    options = options || {};
    return buildTree(tokens, '', [], options.sectionTags || []);
  }

  Hogan.cache = {};

  Hogan.cacheKey = function(text, options) {
    return [text, !!options.asString, !!options.disableLambda, options.delimiters, !!options.modelGet].join('||');
  }

  Hogan.compile = function(text, options) {
    options = options || {};
    var key = Hogan.cacheKey(text, options);
    var template = this.cache[key];

    if (template) {
      var partials = template.partials;
      for (var name in partials) {
        delete partials[name].instance;
      }
      return template;
    }

    template = this.generate(this.parse(this.scan(text, options.delimiters), text, options), text, options);
    return this.cache[key] = template;
  }
})( true ? exports : 0);


/***/ }),

/***/ 262:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This file is for use with Node.js. See dist/ for browser files.

var Hogan = __webpack_require__(410);
Hogan.Template = (__webpack_require__(625).Template);
Hogan.template = Hogan.Template;
module.exports = Hogan;


/***/ }),

/***/ 625:
/***/ ((__unused_webpack_module, exports) => {

/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Hogan = {};

(function (Hogan) {
  Hogan.Template = function (codeObj, text, compiler, options) {
    codeObj = codeObj || {};
    this.r = codeObj.code || this.r;
    this.c = compiler;
    this.options = options || {};
    this.text = text || '';
    this.partials = codeObj.partials || {};
    this.subs = codeObj.subs || {};
    this.buf = '';
  }

  Hogan.Template.prototype = {
    // render: replaced by generated code.
    r: function (context, partials, indent) { return ''; },

    // variable escaping
    v: hoganEscape,

    // triple stache
    t: coerceToString,

    render: function render(context, partials, indent) {
      return this.ri([context], partials || {}, indent);
    },

    // render internal -- a hook for overrides that catches partials too
    ri: function (context, partials, indent) {
      return this.r(context, partials, indent);
    },

    // ensurePartial
    ep: function(symbol, partials) {
      var partial = this.partials[symbol];

      // check to see that if we've instantiated this partial before
      var template = partials[partial.name];
      if (partial.instance && partial.base == template) {
        return partial.instance;
      }

      if (typeof template == 'string') {
        if (!this.c) {
          throw new Error("No compiler available.");
        }
        template = this.c.compile(template, this.options);
      }

      if (!template) {
        return null;
      }

      // We use this to check whether the partials dictionary has changed
      this.partials[symbol].base = template;

      if (partial.subs) {
        // Make sure we consider parent template now
        if (!partials.stackText) partials.stackText = {};
        for (key in partial.subs) {
          if (!partials.stackText[key]) {
            partials.stackText[key] = (this.activeSub !== undefined && partials.stackText[this.activeSub]) ? partials.stackText[this.activeSub] : this.text;
          }
        }
        template = createSpecializedPartial(template, partial.subs, partial.partials,
          this.stackSubs, this.stackPartials, partials.stackText);
      }
      this.partials[symbol].instance = template;

      return template;
    },

    // tries to find a partial in the current scope and render it
    rp: function(symbol, context, partials, indent) {
      var partial = this.ep(symbol, partials);
      if (!partial) {
        return '';
      }

      return partial.ri(context, partials, indent);
    },

    // render a section
    rs: function(context, partials, section) {
      var tail = context[context.length - 1];

      if (!isArray(tail)) {
        section(context, partials, this);
        return;
      }

      for (var i = 0; i < tail.length; i++) {
        context.push(tail[i]);
        section(context, partials, this);
        context.pop();
      }
    },

    // maybe start a section
    s: function(val, ctx, partials, inverted, start, end, tags) {
      var pass;

      if (isArray(val) && val.length === 0) {
        return false;
      }

      if (typeof val == 'function') {
        val = this.ms(val, ctx, partials, inverted, start, end, tags);
      }

      pass = !!val;

      if (!inverted && pass && ctx) {
        ctx.push((typeof val == 'object') ? val : ctx[ctx.length - 1]);
      }

      return pass;
    },

    // find values with dotted names
    d: function(key, ctx, partials, returnFound) {
      var found,
          names = key.split('.'),
          val = this.f(names[0], ctx, partials, returnFound),
          doModelGet = this.options.modelGet,
          cx = null;

      if (key === '.' && isArray(ctx[ctx.length - 2])) {
        val = ctx[ctx.length - 1];
      } else {
        for (var i = 1; i < names.length; i++) {
          found = findInScope(names[i], val, doModelGet);
          if (found !== undefined) {
            cx = val;
            val = found;
          } else {
            val = '';
          }
        }
      }

      if (returnFound && !val) {
        return false;
      }

      if (!returnFound && typeof val == 'function') {
        ctx.push(cx);
        val = this.mv(val, ctx, partials);
        ctx.pop();
      }

      return val;
    },

    // find values with normal names
    f: function(key, ctx, partials, returnFound) {
      var val = false,
          v = null,
          found = false,
          doModelGet = this.options.modelGet;

      for (var i = ctx.length - 1; i >= 0; i--) {
        v = ctx[i];
        val = findInScope(key, v, doModelGet);
        if (val !== undefined) {
          found = true;
          break;
        }
      }

      if (!found) {
        return (returnFound) ? false : "";
      }

      if (!returnFound && typeof val == 'function') {
        val = this.mv(val, ctx, partials);
      }

      return val;
    },

    // higher order templates
    ls: function(func, cx, partials, text, tags) {
      var oldTags = this.options.delimiters;

      this.options.delimiters = tags;
      this.b(this.ct(coerceToString(func.call(cx, text)), cx, partials));
      this.options.delimiters = oldTags;

      return false;
    },

    // compile text
    ct: function(text, cx, partials) {
      if (this.options.disableLambda) {
        throw new Error('Lambda features disabled.');
      }
      return this.c.compile(text, this.options).render(cx, partials);
    },

    // template result buffering
    b: function(s) { this.buf += s; },

    fl: function() { var r = this.buf; this.buf = ''; return r; },

    // method replace section
    ms: function(func, ctx, partials, inverted, start, end, tags) {
      var textSource,
          cx = ctx[ctx.length - 1],
          result = func.call(cx);

      if (typeof result == 'function') {
        if (inverted) {
          return true;
        } else {
          textSource = (this.activeSub && this.subsText && this.subsText[this.activeSub]) ? this.subsText[this.activeSub] : this.text;
          return this.ls(result, cx, partials, textSource.substring(start, end), tags);
        }
      }

      return result;
    },

    // method replace variable
    mv: function(func, ctx, partials) {
      var cx = ctx[ctx.length - 1];
      var result = func.call(cx);

      if (typeof result == 'function') {
        return this.ct(coerceToString(result.call(cx)), cx, partials);
      }

      return result;
    },

    sub: function(name, context, partials, indent) {
      var f = this.subs[name];
      if (f) {
        this.activeSub = name;
        f(context, partials, this, indent);
        this.activeSub = false;
      }
    }

  };

  //Find a key in an object
  function findInScope(key, scope, doModelGet) {
    var val;

    if (scope && typeof scope == 'object') {

      if (scope[key] !== undefined) {
        val = scope[key];

      // try lookup with get for backbone or similar model data
      } else if (doModelGet && scope.get && typeof scope.get == 'function') {
        val = scope.get(key);
      }
    }

    return val;
  }

  function createSpecializedPartial(instance, subs, partials, stackSubs, stackPartials, stackText) {
    function PartialTemplate() {};
    PartialTemplate.prototype = instance;
    function Substitutions() {};
    Substitutions.prototype = instance.subs;
    var key;
    var partial = new PartialTemplate();
    partial.subs = new Substitutions();
    partial.subsText = {};  //hehe. substext.
    partial.buf = '';

    stackSubs = stackSubs || {};
    partial.stackSubs = stackSubs;
    partial.subsText = stackText;
    for (key in subs) {
      if (!stackSubs[key]) stackSubs[key] = subs[key];
    }
    for (key in stackSubs) {
      partial.subs[key] = stackSubs[key];
    }

    stackPartials = stackPartials || {};
    partial.stackPartials = stackPartials;
    for (key in partials) {
      if (!stackPartials[key]) stackPartials[key] = partials[key];
    }
    for (key in stackPartials) {
      partial.partials[key] = stackPartials[key];
    }

    return partial;
  }

  var rAmp = /&/g,
      rLt = /</g,
      rGt = />/g,
      rApos = /\'/g,
      rQuot = /\"/g,
      hChars = /[&<>\"\']/;

  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function hoganEscape(str) {
    str = coerceToString(str);
    return hChars.test(str) ?
      str
        .replace(rAmp, '&amp;')
        .replace(rLt, '&lt;')
        .replace(rGt, '&gt;')
        .replace(rApos, '&#39;')
        .replace(rQuot, '&quot;') :
      str;
  }

  var isArray = Array.isArray || function(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
  };

})( true ? exports : 0);


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/compat get default export */
/******/ (() => {
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		var getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/global */
/******/ (() => {
/******/ 	__webpack_require__.g = (function() {
/******/ 		if (typeof globalThis === 'object') return globalThis;
/******/ 		try {
/******/ 			return this || new Function('return this')();
/******/ 		} catch (e) {
/******/ 			if (typeof window === 'object') return window;
/******/ 		}
/******/ 	})();
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

// NAMESPACE OBJECT: ./htdocs/assets/js/collage/web-components/utilities/toast.ts
var toast_namespaceObject = {};
__webpack_require__.r(toast_namespaceObject);
__webpack_require__.d(toast_namespaceObject, {
  toast: () => (toast)
});

;// ./htdocs/assets/js/common/etsy.context.ts
// Ensure namespace is defined;
// @ts-expect-error - we're ensuring that a read-only value is defined, so we have to write it unfortunately.
// Just to keep this file from being a wall of `// @ts-expect-error`s, we're casting
// this global value to the format that it's probably shaped like. Outside of this
// file, the Etsy global doesn't exist. Inside this file, we have to pretend like it
// does, because we have to initialize it for the parts of our code that still use
// it. One sweet, glorious day, we will get rid of all these globals and we can be
// done with stuff like this. That'll be the day all my hair grows back in.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const Etsy = window.Etsy = window.Etsy || {}; // eslint-disable-next-line no-restricted-syntax

Etsy.Context = Etsy.Context || {}; // eslint-disable-next-line no-restricted-syntax

const features = Etsy.Context.feature || {}; // eslint-disable-next-line no-restricted-syntax

const variant = Etsy.Context.variant || {}; // eslint-disable-next-line no-restricted-syntax

let data = Etsy.Context.data || {}; // eslint-disable-next-line no-restricted-syntax

const locale = Etsy.Context.locale || null; // adds featureIsEnabled function to test feature flags

function featureIsEnabled(flag) {
  let feature = features; // In Jest tests, we have the __setContext() helper that allows folks to set
  // Etsy.Context to whatever they'd like. In ES module world, it's impossible
  // to ever call __setContext() before this module is loaded. Because `features`
  // and `data` are wrapped in this closure, that means __setContext() would never
  // actually have the intended effect, since we'd be returning the initial Context
  // data, not the data set by the test user. So, in the test environment, don't check
  // the closure-d variables, check the (since mutated) global Etsy.Context object.

  if (true) {
    // eslint-disable-next-line no-restricted-syntax
    feature = Etsy.Context.feature || feature;
  }

  if (!Object.prototype.hasOwnProperty.call(feature, flag)) {
    return false;
  }

  return !!feature[flag];
}
/**
 * Given a string key, return data at that location in `window.Etsy.Context.data`.
 * The key can index into nested values in Context by separating nested
 * keys with a ".". For example, a key of "foo.bar.baz" will return the
 * value at `window.Etsy.Context.data.foo.bar.baz` assuming it exists.
 *
 * While this method _can_ be strongly typed, we have to rely on the engineer using it
 * to provide the type using T. If it's wrong, TypeScript will never know any better.
 * With methods like `getBoolean`, we know what the type has to be, so we can make
 * runtime assertions about it (this is one of those times where runtime assertions
 * actually make sense). We could either make getData take a third parameter that somehow
 * encodes the type we expect it to return, which would let us make runtime assertions
 * in an ugly, horrible way, or we could just make sure we have a good collection
 * of typed getters to eventually replace it. The latter seemed like the better option.
 * @deprecated
 */


function getData(key, defaultValue) {
  const keyArray = String(key).split(".");
  let context = data;
  const defaultProvided = arguments.length > 1; // In Jest tests, we have the __setContext() helper that allows folks to set
  // Etsy.Context to whatever they'd like. In ES module world, it's impossible
  // to ever call __setContext() before this module is loaded. Because `features`
  // and `data` are wrapped in this closure, that means __setContext() would never
  // actually have the intended effect, since we'd be returning the initial Context
  // data, not the data set by the test user. So, in the test environment, don't check
  // the closure-d variables, check the (since mutated) global Etsy.Context object.

  if (true) {
    // eslint-disable-next-line no-restricted-syntax
    context = Etsy.Context.data || context;
  }

  if (typeof key !== "string" || keyArray.length < 1) {
    throw new Error(`Etsy.Context.getData() called with an invalid key: ${key}`);
  }

  while (keyArray.length > 1 && keyArray[0] && Object.prototype.hasOwnProperty.call(context, keyArray[0])) {
    // We don't actually know what type nested values are, so we have to trust that
    // if we're given a nested key, then the values are all Records with strings
    // as keys the whole way down.
    // Also: we know that keyArray.shift() can't be undefined because it has a length > 1,
    // which is the condition of this loop. TypeScript-eslint isn't that smart about this,
    // as it turns out, so we have to hold its hand a little here. Without that if() check,
    // TypeScript doesn't know that nextKey is definitely not null or undefined.
    const nextKey = keyArray.shift();

    if (!nextKey) {
      continue;
    } // We have to trust that if there is a next value, it is something that we
    // can address into.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions


    context = context[nextKey];
  }

  if (keyArray.length > 1 || !keyArray[0] || !Object.prototype.hasOwnProperty.call(context, keyArray[0])) {
    if (defaultProvided) {
      return defaultValue;
    } else {
      throw new Error(`Etsy.Context.getData() called with an unspecified key, no default value provided: ${key}`);
    }
  } // We know that keyArray has a length of at least 1, so the non-null assertion is safe here.
  // eslint-disable-next-line


  return context[keyArray[0]];
}
/**
 * Like `getData`, but enforces a boolean return value. If the found value is
 * not a boolean, `defaultValue` is returned. If `defaultValue` is omitted,
 * null is returned instead (and the return type changes to account for this).
 */


function getBoolean(key, defaultValue = null) {
  const value = getData(key, defaultValue);
  return typeof value === "boolean" ? value : defaultValue;
}
/**
 * Like `getData`, but enforces a string return value. If the found value is
 * not a string, `defaultValue` is returned. If `defaultValue` is omitted,
 * null is returned instead (and the return type changes to account for this).
 */


function getString(key, defaultValue = null) {
  const value = getData(key, defaultValue);
  return typeof value === "string" ? value : defaultValue;
}
/**
 * Like `getData`, but enforces a numeric return value. If the found value is
 * not a number, `defaultValue` is returned. If `defaultValue` is omitted,
 * null is returned instead (and the return type changes to account for this).
 */


function getNumber(key, defaultValue = null) {
  const value = getData(key, defaultValue);
  return typeof value === "number" ? value : defaultValue;
}
/**
 * Like `getData`, but enforces an object return value. If the found value is
 * not an object, `defaultValue` is returned. If `defaultValue` is omitted,
 * null is returned instead (and the return type changes to account for this).
 */


function getObject(key, defaultValueOrGuard = null, guard) {
  const value = getData(key, null); // People can do really silly things with guard functions if they don't know
  // that `typeof [] === "object"`. We're going to do some extremely basic sanity
  // checking to prevent some common errors.

  const isNonNullNonArrayObject = value && typeof value === "object" && !Array.isArray(value);

  if (typeof defaultValueOrGuard === "function") {
    return isNonNullNonArrayObject && defaultValueOrGuard(value) ? value : null;
  } // If we didn't pass in a guard function, then as long as our thing
  // passes our basic sanity check, then we're willing to say it's T.
  // If it doesn't pass the sanity check, it'll be null.


  const guardFn = guard || (maybe => !!maybe);

  return isNonNullNonArrayObject && guardFn(value) ? value : defaultValueOrGuard;
}
/**
 * Like `getData`, but enforces an Array return value. If the found value is
 * not an array, `defaultValue` is returned. If `defaultValue` is omitted,
 * null is returned instead (and the return type changes to account for this).
 */


function getArray(key, defaultValueOrGuard = null, guard) {
  const value = getData(key, null);

  if (typeof defaultValueOrGuard === "function") {
    return Array.isArray(value) ? value.filter(defaultValueOrGuard) : null;
  }

  if (guard) {
    return Array.isArray(value) ? value.filter(guard) : defaultValueOrGuard;
  }

  return Array.isArray(value) ? value : defaultValueOrGuard;
}
/**
 * Convenience function for getting a subset of the Context data.
 * Similar to _.pluck()
 * Use case: Etsy.Context.pluck('shop_name', 'features.shop_name_suggester')
 *
 * @deprecated - While pluck makes getting a bunch of keys easier, it makes it a lot
 * more cumbersome to provide types for each of those keys.
 */


function pluck(...keys) {
  return keys.reduce((previous, key) => {
    return {
      [key]: getData(key, null),
      ...previous
    };
  }, {});
}
/**
 * Gets a value off of Context.variant. Please don't place things on Context.variant.
 * Use Context.feature or Context.data instead.
 * @deprecated
 */


function getVariant(key, defaultValue) {
  const value = variant[key];

  if (!value || typeof value !== "string") {
    return defaultValue;
  }

  return value;
}
/**
 * Gets the Context.locale object
 */


function getLocale() {
  if (!locale || !Object.prototype.hasOwnProperty.call(locale, "decimal_point") || !Object.prototype.hasOwnProperty.call(locale, "thousands_sep")) {
    return null;
  }

  return locale;
}
/**
// Because there's code in `apollo/modules/reimburse-actions.js` which relies on overwriting the value
// of Etsy.Context.data and there are race conditions introduced when this file is read before that file
// has overwritten Etsy.Context.data.
//
// Please, by all that is good and just and right in the world, don't ever call this function.
//
// Please forgive me for having written it.
// @deprecated
*/
// eslint-disable-next-line no-restricted-syntax


Etsy.Context.__FORCE_OVERRIDE_CONTEXT_DATA__PLEASE_DONT_USE_THIS_OH_GOD_WHY_GOD_WHY = function (overrideData) {
  // Data isn't supposed to be overwritten, but this method is a hack that does
  // exactly that. Please never do this anywhere else or I will feel it in my soul and cry deeply.
  // eslint-disable-next-line no-restricted-syntax
  Etsy.Context.data = overrideData;
  data = overrideData;
}; // eslint-disable-next-line no-restricted-syntax


Etsy.Context.__FORCE_MERGE_CONTEXT_DATA__YOU_ARE_MAKING_A_HUGE_MISTAKE_RIGHT_NOW = function (overrideData) {
  // Data isn't supposed to be overwritten, but this method is a hack that does
  // exactly that. Please never do this anywhere else or I will feel it in my soul and cry deeply.
  // eslint-disable-next-line no-restricted-syntax
  Object.assign(Etsy.Context.data, overrideData);
}; // eslint-disable-next-line no-restricted-syntax


Etsy.Context.featureIsEnabled = featureIsEnabled; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getData = getData; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getBoolean = getBoolean; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getString = getString; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getNumber = getNumber; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getObject = getObject; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getArray = getArray; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.pluck = pluck; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getVariant = getVariant; // eslint-disable-next-line no-restricted-syntax

Etsy.Context.getLocale = getLocale; // eslint-disable-next-line no-restricted-syntax

const etsy_context_Context = Etsy.Context;
/* harmony default export */ const etsy_context = (etsy_context_Context);
;// ./htdocs/assets/js/collage/web-components/internal/shadow-styles.ts


const mockFetch = () => Promise.resolve(new Response(".test {color: red;}", {
  status: 200
}));
/**
 * Utility to fetch and cache a Constructable Stylesheet for use in Shadow DOM.
 */


class ShadowStylesheet {
  /**
   * Class behavior should be different in jest tests, since we don't want to
   * include network requests in other teams' suites. ShadowStylesheet tests use it
   * so we can actually test behavior.
   * @internal
   */
  static getEnv = () =>  false ? 0 : "prod";

  static getDoesBrowserSupport() {
    return typeof CSSStyleSheet !== "undefined" && // current version of JSDOM notably has CSSStyleSheet
    // but not the 'replaceSync' method
    "replaceSync" in CSSStyleSheet.prototype;
  }

  static stylesheet = null;

  static getStylesheet() {
    if (this.stylesheet) {
      return this.stylesheet;
    }

    if (!this.getDoesBrowserSupport()) {
      return this.getLinkTagString();
    }

    if (this.fetchState === "complete") {
      return this.stylesheet;
    }

    return this.#fetch().then(() => this.stylesheet);
  }

  static fetchState = false;
  static cssUrl = null;

  static getCssUrl() {
    return this.cssUrl ??= etsy_context.getString("collage_shadow_dom_css_url");
  }
  /**
   * Cache the request, so that any components requesting while it's in-flight
   * can await the same promise.
   */


  static request = null;

  static async #fetch() {
    if (this.request) {
      await this.request;
      return;
    }

    const cssUrl = this.getCssUrl();

    if ( // We have URL..
    cssUrl && // ...we haven't tried to fetch yet...
    !this.fetchState && // ...and the browser supports Constructable Stylesheets
    // Note that our current version of Jest does not support 'replaceSync',
    // so this will always be false, unless mocked
    this.getDoesBrowserSupport()) {
      this.fetchState = "fetching";

      const fetchRequest = async () => {
        const fetcher = this.getEnv() === "test" ? mockFetch : fetch;
        const response = await fetcher(cssUrl, {
          mode: "cors"
        });
        const css = await response.text();
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        this.stylesheet = sheet;
      };

      try {
        this.request = fetchRequest();
        await this.request; // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {// TODO: log this error?
      } finally {
        this.fetchState = "complete";
        this.request = null;
      }
    }
  }

  static getLinkTagString() {
    const cssUrl = this.getCssUrl();
    return cssUrl ? `<link href="${cssUrl}" rel="stylesheet" type="text/css" />` : "";
  }

  static createLinkTag() {
    const link = document.createElement("link");
    link.href = this.getCssUrl() || "";
    link.rel = "stylesheet";
    link.type = "text/css";
    return link;
  }
  /** Just used for testing */


  static reset() {
    this.stylesheet = null;
    this.fetchState = false;
    this.cssUrl = null;
    this.request = null;
  }

}
;// ./node_modules/@lit/reactive-element/css-tag.js
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,css_tag_e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),o=new WeakMap;class n{constructor(t,e,o){if(this._$cssResult$=!0,o!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const s=this.t;if(css_tag_e&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=o.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&o.set(s,t))}return t}toString(){return this.cssText}}const css_tag_r=t=>new n("string"==typeof t?t:t+"",void 0,s),i=(t,...e)=>{const o=1===t.length?t[0]:e.reduce(((e,s,o)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[o+1]),t[0]);return new n(o,t,s)},S=(s,o)=>{if(css_tag_e)s.adoptedStyleSheets=o.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet));else for(const e of o){const o=document.createElement("style"),n=t.litNonce;void 0!==n&&o.setAttribute("nonce",n),o.textContent=e.cssText,s.appendChild(o)}},c=css_tag_e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return css_tag_r(e)})(t):t;
//# sourceMappingURL=css-tag.js.map

;// ./node_modules/@lit/reactive-element/reactive-element.js

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:reactive_element_i,defineProperty:reactive_element_e,getOwnPropertyDescriptor:h,getOwnPropertyNames:reactive_element_r,getOwnPropertySymbols:reactive_element_o,getPrototypeOf:reactive_element_n}=Object,a=globalThis,reactive_element_c=a.trustedTypes,l=reactive_element_c?reactive_element_c.emptyScript:"",p=a.reactiveElementPolyfillSupport,d=(t,s)=>t,u={toAttribute(t,s){switch(s){case Boolean:t=t?l:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,s){let i=t;switch(s){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},f=(t,s)=>!reactive_element_i(t,s),b={attribute:!0,type:String,converter:u,reflect:!1,useDefault:!1,hasChanged:f};Symbol.metadata??=Symbol("metadata"),a.litPropertyMetadata??=new WeakMap;class y extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,s=b){if(s.state&&(s.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((s=Object.create(s)).wrapped=!0),this.elementProperties.set(t,s),!s.noAccessor){const i=Symbol(),h=this.getPropertyDescriptor(t,i,s);void 0!==h&&reactive_element_e(this.prototype,t,h)}}static getPropertyDescriptor(t,s,i){const{get:e,set:r}=h(this.prototype,t)??{get(){return this[s]},set(t){this[s]=t}};return{get:e,set(s){const h=e?.call(this);r?.call(this,s),this.requestUpdate(t,h,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(d("elementProperties")))return;const t=reactive_element_n(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(d("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(d("properties"))){const t=this.properties,s=[...reactive_element_r(t),...reactive_element_o(t)];for(const i of s)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const s=litPropertyMetadata.get(t);if(void 0!==s)for(const[t,i]of s)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,s]of this.elementProperties){const i=this._$Eu(t,s);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(s){const i=[];if(Array.isArray(s)){const e=new Set(s.flat(1/0).reverse());for(const s of e)i.unshift(c(s))}else void 0!==s&&i.push(c(s));return i}static _$Eu(t,s){const i=s.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach((t=>t(this)))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,s=this.constructor.elementProperties;for(const i of s.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return S(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach((t=>t.hostConnected?.()))}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach((t=>t.hostDisconnected?.()))}attributeChangedCallback(t,s,i){this._$AK(t,i)}_$ET(t,s){const i=this.constructor.elementProperties.get(t),e=this.constructor._$Eu(t,i);if(void 0!==e&&!0===i.reflect){const h=(void 0!==i.converter?.toAttribute?i.converter:u).toAttribute(s,i.type);this._$Em=t,null==h?this.removeAttribute(e):this.setAttribute(e,h),this._$Em=null}}_$AK(t,s){const i=this.constructor,e=i._$Eh.get(t);if(void 0!==e&&this._$Em!==e){const t=i.getPropertyOptions(e),h="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:u;this._$Em=e;const r=h.fromAttribute(s,t.type);this[e]=r??this._$Ej?.get(e)??r,this._$Em=null}}requestUpdate(t,s,i){if(void 0!==t){const e=this.constructor,h=this[t];if(i??=e.getPropertyOptions(t),!((i.hasChanged??f)(h,s)||i.useDefault&&i.reflect&&h===this._$Ej?.get(t)&&!this.hasAttribute(e._$Eu(t,i))))return;this.C(t,s,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,s,{useDefault:i,reflect:e,wrapped:h},r){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??s??this[t]),!0!==h||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||i||(s=void 0),this._$AL.set(t,s)),!0===e&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,s]of this._$Ep)this[t]=s;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[s,i]of t){const{wrapped:t}=i,e=this[s];!0!==t||this._$AL.has(s)||void 0===e||this.C(s,void 0,i,e)}}let t=!1;const s=this._$AL;try{t=this.shouldUpdate(s),t?(this.willUpdate(s),this._$EO?.forEach((t=>t.hostUpdate?.())),this.update(s)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(s)}willUpdate(t){}_$AE(t){this._$EO?.forEach((t=>t.hostUpdated?.())),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach((t=>this._$ET(t,this[t]))),this._$EM()}updated(t){}firstUpdated(t){}}y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[d("elementProperties")]=new Map,y[d("finalized")]=new Map,p?.({ReactiveElement:y}),(a.reactiveElementVersions??=[]).push("2.1.1");
//# sourceMappingURL=reactive-element.js.map

;// ./htdocs/assets/js/collage/web-components/internal/event-intentions.ts
// Any string is valid, but we can provide auto-complete for built-in event.

/**
 * Given a DOM event this utility function finds the closest intention.
 * An intention is a DOM attribute that maps a DOM event to a semantically meaningful event.
 * The attribute takes the shape `${prefix}${event.type}${modifiers?}="${semantic event}"`.
 */
function findClosestIntention(event,
/** A function that adds a modifier to the intention. Useful for keyboard modifiers. */
modifier,
/**
 * By default intentions are prefixed with `x-on:`, use this to override that prefix.
 * Notes from testing options:
 * - "@" fails to be parsed by DOMDocument in Mustache filter
 * - "on:" throws errors by Preact, which check for any prop beginning with "on"
 */
prefix = "x-on:") {
  if (event.target instanceof HTMLElement || event.target instanceof SVGElement) {
    const attributeName = `${prefix}${event.type}${modifier?.(event) ?? ""}`;
    const target = event.target.closest(`[${CSS.escape(attributeName)}]`);

    if (target !== null) {
      const intention = target.getAttribute(attributeName);

      if (intention) {
        return {
          intention,
          target
        };
      }
    }
  }

  return {};
}
const systemKeys = (/* unused pure expression or super */ null && (["alt", "ctrl", "meta", "shift"]));
/**
 * A utility that adds modifiers from keyboard events to intentions.
 * @param event DOM event
 * @returns
 */

function keyboardModifiers(event) {
  if (event instanceof KeyboardEvent) {
    const systemModifiers = systemKeys // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    .filter(key => event[`${key}Key`]).join(".");
    return `${systemModifiers.length > 0 ? "." : ""}${systemModifiers}.${event.code.toLowerCase()}`;
  }

  return "";
}
;// ./htdocs/assets/js/common/a11y/A11yAnnouncer.ts
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * https://github.com/adobe/react-spectrum/blob/ee49fdbaf73473228578418bb34db9ded34b0669/packages/%40react-aria/live-announcer/src/LiveAnnouncer.tsx
 */

/* Inspired by https://github.com/AlmeroSteyn/react-aria-live */
const LIVEREGION_TIMEOUT_DELAY = 7000;
let a11yAnnouncer = null;

/**
 * This class provides a way to make visually hidden
 * screen reader announcements.
 *
 * These kinds of announcements can be helpful when there's a
 * change on screen that needs to be conveyed, but there's not
 * really any text on screen that makes sense to announce.
 *
 * For example, announcing that search results have updated after
 * dynamically setting a filter.
 *
 * All announcements in the product should be translated strings.
 *
 * Usage:
 * 1. While initializing your component(s), also initialize the announcer
 *    (e.g. `const myAnnouncer = new A11yAnnouncer()`)
 * 2. When you need to make an announcement, call the `announce` function
 *    with your message (e.g. `myAnnouncer.announce(myTranslatedAnnouncement)`)
 */
class A11yAnnouncer {
  liveRegion = null;
  assertiveLog = null;
  politeLog = null;

  constructor() {
    this.createLiveRegion();
  }

  isAttached() {
    return this.liveRegion?.isConnected;
  }

  createLiveRegion() {
    if (typeof document !== "undefined") {
      this.liveRegion = document.createElement("div");
      this.liveRegion.dataset.liveAnnouncer = "true";
      this.liveRegion.classList.add("wt-screen-reader-only");
      this.assertiveLog = this.createLog("assertive");
      this.liveRegion.appendChild(this.assertiveLog);
      this.politeLog = this.createLog("polite");
      this.liveRegion.appendChild(this.politeLog);
      document.body.appendChild(this.liveRegion);
    }
  }

  createLog(ariaLive) {
    const node = document.createElement("div");
    node.setAttribute("role", "log");
    node.setAttribute("aria-live", ariaLive);
    node.setAttribute("aria-relevant", "additions");
    return node;
  }

  destroy() {
    if (!this.liveRegion) {
      return;
    }

    document.body.removeChild(this.liveRegion);
    this.liveRegion = null;
  }

  announce(message, assertiveness = "assertive", timeout = LIVEREGION_TIMEOUT_DELAY) {
    if (!this.liveRegion || !this.isAttached()) {
      this.createLiveRegion();
    }

    const node = document.createElement("div");

    if (typeof message === "object") {
      // To read an aria-labelledby, the element must have an appropriate role, such as img.
      node.setAttribute("role", "img");
      node.setAttribute("aria-labelledby", message["aria-labelledby"]);
    } else {
      node.textContent = message;
    }

    if (assertiveness === "assertive") {
      this.assertiveLog?.appendChild(node);
    } else {
      this.politeLog?.appendChild(node);
    }

    if (message !== "") {
      setTimeout(() => {
        node.remove();
      }, timeout);
    }
  }

  clear(assertiveness) {
    if (!this.liveRegion) {
      return;
    }

    if ((!assertiveness || assertiveness === "assertive") && this.assertiveLog) {
      this.assertiveLog.innerHTML = "";
    }

    if ((!assertiveness || assertiveness === "polite") && this.politeLog) {
      this.politeLog.innerHTML = "";
    }
  }

}
/**
 * Announces the message using screen reader technology.
 */


function announce(message, assertiveness = "assertive", timeout = LIVEREGION_TIMEOUT_DELAY) {
  if (!a11yAnnouncer) {
    a11yAnnouncer = new A11yAnnouncer(); // wait for the live announcer regions to be added to the dom, then announce
    // otherwise Safari won't announce the message if it's added too quickly
    // found most times less than 100ms were not consistent when announcing with Safari

    if (true) {
      setTimeout(() => {
        if (a11yAnnouncer?.isAttached()) {
          a11yAnnouncer?.announce(message, assertiveness, timeout);
        }
      }, 100);
    } else {}
  } else {
    a11yAnnouncer.announce(message, assertiveness, timeout);
  }
}
/**
 * Stops all queued announcements.
 */

function clearAnnouncer(assertiveness) {
  if (a11yAnnouncer) {
    a11yAnnouncer.clear(assertiveness);
  }
}
/**
 * Removes the announcer from the DOM.
 */

function destroyAnnouncer() {
  if (a11yAnnouncer) {
    a11yAnnouncer.destroy();
    a11yAnnouncer = null;
  }
}
/* harmony default export */ const a11y_A11yAnnouncer = ((/* unused pure expression or super */ null && (A11yAnnouncer)));
;// ./htdocs/assets/js/collage/web-components/internal/missing-global-styles-warning.ts
/**
 * Dev/debug helper for Collage web components that shows a page-level banner
 * when the required global stylesheet (`collage/main.scss`) is missing.
 *
 * Default behavior:
 * - Enabled automatically in `true`
 * - Disabled outside dev unless explicitly turned on
 *
 * Manual enablement on any page:
 * - Query param: `?clgDebugStyles=1`
 * - Runtime flag: `window.__COLLAGE_DEBUG_GLOBAL_STYLES__ = true`
 *
 * Once the helper successfully detects the global stylesheet marker on the page,
 * future Collage elements stop checking for the remainder of the session.
 *
 * The warning renders as a single persistent overlay banner and will reuse an
 * existing banner node if one is already present in the DOM.
 */

const css = String.raw;
const DEBUG_FLAG = "__COLLAGE_DEBUG_GLOBAL_STYLES__";
const DEBUG_QUERY_PARAM = "clgDebugStyles";
const GLOBAL_STYLES_MARKER = "--clg-global-styles-loaded";
const OVERLAY_TAG_NAME = "collage-missing-styles-debug";
const OVERLAY_STYLES = css`
    .panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        padding: var(--clg-dimension-pal-grid-200);
        font: var(--clg-typography-sem-product-title-desktop-larger-composite);
        letter-spacing: var(--clg-typography-pal-family-sans-serif-letter-spacing);
        color: var(--clg-color-sem-text-on-surface-strong);
        background: var(--clg-color-sem-background-surface-critical-dark);
    }

    .header {
        display: flex;
        align-items: center;
        gap: var(--clg-dimension-pal-grid-150);
    }

    .title {
        flex: 1;
        text-align: left;
    }

    .dismiss {
        background: var(
            --clg-color-app-button-icon-transparent-on-surface-dark-background
        );
        border-radius: var(--clg-shape-sem-border-radius-full);
        padding: var(--clg-dimension-pal-grid-100);
        border: var(--clg-shape-app-button-icon-primary-border-width) solid
            var(--clg-color-app-button-icon-transparent-on-surface-dark-border);
        font: inherit;
        color: var(--clg-color-app-button-icon-transparent-on-surface-dark-icon);
        fill: currentColor;
        cursor: pointer;
        aspect-ratio: 1/1;
        height: 48px;
        width: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .dismiss:hover {
        background: var(
            --clg-color-app-button-icon-transparent-on-surface-dark-hovered-background
        );
        color: var(
            --clg-color-app-button-icon-transparent-on-surface-dark-hovered-icon
        );
    }
    .dismiss:active {
        background: var(
            --clg-color-app-button-icon-transparent-on-surface-dark-pressed-background
        );
        color: var(
            --clg-color-app-button-icon-transparent-on-surface-dark-pressed-icon
        );
    }
    .dismiss svg {
        height: var(--clg-dimension-sem-icon-core-base);
        width: var(--clg-dimension-sem-icon-core-base);
    }
`;
let hasConfirmedGlobalStyles = false;
const overlayState = {
  container: null,
  shadowRoot: null,
  stylesheet: null,
  dismissed: false
};

function getQueryParamMode() {
  const queryString = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;
  if (!queryString) return null;

  for (const pair of queryString.split("&")) {
    if (!pair) continue;
    const [rawKey = "", rawValue = ""] = pair.split("=");
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue).toLowerCase();
    if (key !== DEBUG_QUERY_PARAM) continue;

    if (value === "" || value === "0" || value === "false" || value === "off") {
      return false;
    }

    return true;
  }

  return null;
}

function getExplicitMode() {
  const flag = window[DEBUG_FLAG];

  if (flag) {
    return true;
  }

  const queryParamMode = getQueryParamMode();

  if (queryParamMode !== null) {
    return queryParamMode;
  }

  return null;
}

function getDebugMode() {
  const explicitMode = getExplicitMode();

  if (explicitMode !== null) {
    return explicitMode;
  }

  return true;
}

function hasGlobalStylesLoaded() {
  if (hasConfirmedGlobalStyles) return true;
  hasConfirmedGlobalStyles = getComputedStyle(document.documentElement).getPropertyValue(GLOBAL_STYLES_MARKER).trim().length > 0;
  return hasConfirmedGlobalStyles;
}

function ensureOverlay() {
  if (overlayState.dismissed) return null;

  if (overlayState.shadowRoot) {
    return overlayState.shadowRoot;
  }

  const existingContainer = document.querySelector(OVERLAY_TAG_NAME);
  const container = existingContainer ?? document.createElement(OVERLAY_TAG_NAME);

  if (!existingContainer) {
    document.body.appendChild(container);
  }

  overlayState.container = container;
  overlayState.shadowRoot = container.shadowRoot ?? container.attachShadow({
    mode: "open"
  });

  if (typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype) {
    overlayState.stylesheet ??= new CSSStyleSheet();
    overlayState.stylesheet.replaceSync(OVERLAY_STYLES);
    overlayState.shadowRoot.adoptedStyleSheets = [overlayState.stylesheet];
  }

  return overlayState.shadowRoot;
}

function renderOverlay() {
  const root = ensureOverlay();
  if (!root) return;
  root.innerHTML = `
        <div class="panel">
            <div class="header">
                <span class="title">Collage styles are missing from this page! Include \`<code>collage/main.scss</code>\`.</span>
                <button class="dismiss" type="button" data-action="dismiss" aria-label="Dismiss"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.793 5.207 10.586 12l-6.793 6.793 1.414 1.414L12 13.414l6.793 6.793 1.414-1.414L13.414 12l6.793-6.793-1.414-1.414L12 10.586 5.207 3.793z"></path></svg></button>
            </div>
        </div>
    `;
  announce("Collage styles are missing from this page! Include `collage/main.scss`.", "assertive");
  root.querySelector("[data-action='dismiss']")?.addEventListener("click", () => {
    overlayState.dismissed = true;
    overlayState.container?.remove();
    overlayState.container = null;
    overlayState.shadowRoot = null;
  });
}

function warnIfMissingGlobalStyles() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const debugMode = getDebugMode();
  if (!debugMode || hasGlobalStylesLoaded()) return;
  renderOverlay();
}
function resetMissingGlobalStylesWarningForTests() {
  hasConfirmedGlobalStyles = false;
  overlayState.container?.remove();
  overlayState.container = null;
  overlayState.shadowRoot = null;
  overlayState.stylesheet = null;
  overlayState.dismissed = false;
}
;// ./htdocs/assets/js/collage/web-components/mixins/PropertySlotValidationMixin.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any

/** Constant for the default/unnamed slot */
const DEFAULT_SLOT = "[default]";
/** Context passed to custom validators */

/** Default property validator - checks that value is not null, undefined, or empty string */
const required = function (value, context) {
  if (value === undefined || value === null || value === "") {
    return `${context.tagName}: Expected to have a \`${context.key}\` property.`;
  }

  return undefined;
};
/** Default slot validator - checks that the slot has content */

const hasContent = function (_slot, context) {
  if (!this.hasSlotContent(context.key)) {
    return `${context.tagName}: Expected to have content in the \`${context.key}\` slot.`;
  }

  return undefined;
};
/** Configuration for a single validator entry */

const PropertySlotValidationMixin = superClass => {
  class PropertySlotValidationMixinClass extends superClass {
    static validators = {};

    firstUpdated(changed) {
      super.firstUpdated(changed);
      this.#validate();
    }

    #validate() {
      if (false) {} // eslint-disable-next-line @typescript-eslint/consistent-type-assertions

      const ctor = this.constructor;
      const {
        validators
      } = ctor;
      if (!validators) return;

      const validateProperty = (key, validator) => {
        const keyStr = typeof key === "string" ? key : ""; // @ts-expect-error dynamic property access

        const value = this[keyStr];
        const context = {
          tagName: this.localName,
          key
        };
        return validator.call(this, value, context) ?? undefined;
      };

      const validateSlot = (key, validator) => {
        const context = {
          tagName: this.localName,
          key
        };
        const selector = key === DEFAULT_SLOT ? "slot:not([name])" : `slot[name=${key}]`;
        const slot = this.shadowRoot?.querySelector(selector) || null;
        return validator.call(this, slot, context) ?? undefined;
      };

      const normalizeConfig = config => {
        // Shorthand: `required` alone means property validation
        if (config === required) return {
          property: required
        }; // Shorthand: `hasContent` alone means slot validation

        if (config === hasContent) return {
          slot: hasContent
        }; // Already a full config object

        return { ...config
        };
      };

      Object.keys(validators).forEach(key => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const rawConfig = validators[key];
        if (!rawConfig) return;
        const {
          property,
          slot
        } = normalizeConfig(rawConfig);
        const propError = property ? validateProperty(key, property) : undefined;
        const slotError = slot ? validateSlot(key, slot) : undefined; // If both validators exist, only throw if both fail (throw property error)
        // If only one validator exists, throw if it fails

        if (property && slot) {
          if (propError && slotError) {
            throw new Error(propError);
          }

          return;
        } else if (propError) {
          throw new Error(propError);
        } else if (slotError) {
          throw new Error(slotError);
        }
      });
    }
    /** Determine whether the slot with the given name is occupied */


    hasSlotContent(slotName) {
      if (slotName === DEFAULT_SLOT) {
        return [...this.childNodes].some(node => {
          if (node.nodeType === Node.TEXT_NODE && // If it's a text node, it will have textContent
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          node.textContent.trim() !== "") {
            return true;
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            // If it's an element node, it's an HTMLElement
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const el = node; // If it doesn't have a slot attribute, it's part of the default slot

            if (!el.hasAttribute("slot")) {
              return true;
            }
          }

          return false;
        });
      }

      return this.querySelector(`[slot="${slotName}"]`) !== null;
    }

  } // eslint-disable-next-line @typescript-eslint/consistent-type-assertions


  return PropertySlotValidationMixinClass;
};
;// ./htdocs/assets/js/es6/utils/yield-to-main.ts
/**
 * Gives control back to the main thread, allowing the browser to handle
 * pending tasks such as style recalculation, rendering, user input...
 *
 * Useful to break up long tasks and keep the UI responsive
 *
 * Essentially a polyfill for the modern-ish `scheduler.yield()` API
 * Copied from npmjs.com/package/yieldtomain
 */
const yield_to_main_yieldToMain = () => {
  // @ts-expect-error scheduler is not yet in TypeScript's DOM types
  const scheduler = window.scheduler;

  if (scheduler && typeof scheduler.yield === "function") {
    return scheduler.yield();
  }

  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};
/**
 * Wraps a function execution with yields to the main thread before and after.
 * This helps break up long tasks to improve responsiveness and avoid blocking
 * the main thread.
 * Example use:
 *    // before
 *    new ContentToggle(); // potentially expensive blocking initialization
 *    // after, option 1, awaiting the result to ensure it completes before proceeding
 *    // use when the order of operations matters, e.g. code that follows expects
 *    // ContentToggle to be fully initialized
 *    await yieldWrap(() => new ContentToggle());
 *    // after, option 2, without awaiting the result
 *    // use when there's no code dependent on ContentToggle initialization
 *    yieldWrap(() => new ContentToggle());
 */


async function yieldWrap(fn) {
  await yield_to_main_yieldToMain();
  await fn();
  await yield_to_main_yieldToMain();
}


;// ./htdocs/assets/js/es6/utils/load-listeners.ts

 // This global variable is used to keep track of whether DCL has fired. We can't
// use `document.readyState` as a reliable gauge--it's still sometimes `interactive`
// even after DCL has fired. Also, there are sometimes duplicate versions of this
// file loaded on a page, for example with SSR React code, and some of those
// versions may execute after DCL has fired, in which case a locally scoped
// `hasDCLFired` variable will always be false. A global `hasDCLFired` should
// work as long as at least one version of this file executes before DCL fires.

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- this is the only way to scope a global to this file only
const w = window;
w.__hasDCLFired ||= false;

function windowExists() {
  return !!window;
}

function documentExists() {
  return !!document;
}

function windowAddEventListenerExists() {
  return windowExists() && typeof window.addEventListener === "function";
}

function documentAddEventListenerExists() {
  return documentExists() && typeof document.addEventListener === "function";
}

if (documentAddEventListenerExists()) {
  document.addEventListener("DOMContentLoaded", () => {
    w.__hasDCLFired = true;
  });
}

function onDOMReady(fn) {
  if (!documentExists()) return;

  if (w.__hasDCLFired) {
    fn();
  } else if (documentAddEventListenerExists()) {
    document.addEventListener("DOMContentLoaded", async () => {
      await yield_to_main_yieldToMain();
      fn();
    });
  }
}
function onDOMReadyPromise() {
  return new Promise(onDOMReady);
}
function onWindowLoaded(fn) {
  if (documentExists() && document.readyState === "complete") {
    setTimeout(fn, 0);
  } else if (windowAddEventListenerExists()) {
    if (Context.featureIsEnabled("web_performance.break_up_page_load_js_long_tasks")) {
      window.addEventListener("load", async () => {
        await yieldToMain();
        fn();
      });
    } else {
      window.addEventListener("load", fn);
    }
  }
}
function onWindowUnloaded(fn) {
  if (!windowAddEventListenerExists()) return; // Use the pagehide event when supported so we don't break the browser back/forward cache.

  const unloadEvt = "onpagehide" in window ? "pagehide" : "unload";
  window.addEventListener(unloadEvt, fn);
}
;// ./htdocs/assets/js/collage/web-components/internal/CollageElement.ts









if (typeof process !== "undefined" && typeof HTMLElement === "undefined") {
  // @ts-expect-error Types definitely will never match here, but these instances should never
  //     actually be instantiated server-side
  __webpack_require__.g.HTMLElement = class {};
}

/**
 * Reactive property converter that removes attributes when the
 * value is an empty string.
 */
const nonEmptyStringConverter = {
  fromAttribute(value) {
    return value || "";
  },

  toAttribute(value) {
    return value.length > 0 ? value : null;
  }

};
/**
 * Reactive property converter that removes attributes when the
 * value is the default value.
 */

const nonDefaultStringConverter = defaultValue => ({
  fromAttribute(value) {
    return value || "";
  },

  toAttribute(value) {
    return value === defaultValue ? null : value;
  }

});
/**
 * Base element class which manages element properties, attributes, and shadow DOM templates.
 */

class CollageElement extends PropertySlotValidationMixin(y) {
  /**
   * The mustache render function for the custom element.
   *
   * @example
   *
   * ```ts
   * import template from 'template!collage/clg-component';
   *
   * class ClgComponent extends CollageElement {
   *     protected static template = template;
   * }
   * ```
   */
  // A little bit of annoying 'any' to allow subclasses to narrow the type of 'data'
  // See bivariance and class methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static template = false;
  /**
   * Registers the custom element to the page's customElements' registry
   * @ignore
   */

  static define(tagName) {
    if (typeof customElements === "undefined") return;

    if (!customElements.get(tagName)) {
      // TypeScript thinks 'this' is an instance of CollageElement, when its really CollageElement itself (or a sub-class)
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
      customElements.define(tagName, this);
    }
  }

  findClosestIntention = findClosestIntention;
  /**
   * A list of event types to be delegated for the lifetime of the custom element.
   */

  static delegatedEvents;
  #resolveReady;
  #readyPromise = new Promise(resolve => {
    this.#resolveReady = () => {
      this.#hydrateBindings();
      resolve();
    };
  });
  /**
   * Overridden to await the shadow DOM template
   *
   * ---
   *
   * Schedules an element update. You can override this method to change the
   * timing of updates by returning a Promise. The update will await the
   * returned Promise, and you should resolve the Promise to allow the update
   * to proceed. If this method is overridden, `super.scheduleUpdate()`
   * must be called.
   *
   * For instance, to schedule updates to occur just before the next frame:
   *
   * ```ts
   * override protected async scheduleUpdate(): Promise<unknown> {
   *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
   *   super.scheduleUpdate();
   * }
   * ```
   * @ignore
   */

  async scheduleUpdate() {
    await this.#readyPromise;
    return super.scheduleUpdate();
  }
  /**
   * A flag to communicate between the constructor and the connectedCallback method
   * whether the element needs its shadow root to be initialized.
   * This will be true if the element is created without a declarative shadow DOM template
   * or if the template is not parsed by the browser as a shadow DOM template.
   */


  #needsToBeMustached = false;
  /**
   * Storage of template bindings and their effects
   */

  #bindings;
  #disconnectCallbacks = new Set();

  get #ctor() {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.constructor;
  }

  constructor() {
    super();

    if (!this.shadowRoot && this.#ctor.template) {
      // Needs to bootstrap mustache template
      // Must happen in connectedCallback to get access to element's attributes
      this.#needsToBeMustached = true;
      this.attachShadow(this.#ctor.shadowRootOptions);
    }

    this.#ctor.delegatedEvents?.forEach(event => {
      this.shadowRoot?.addEventListener(event, this);
    });
  }

  connectedCallback() {
    super.connectedCallback();
    warnIfMissingGlobalStyles(); // There's 2 ways that we source the template for the shadow root.
    //
    //     1. A nested template element that wasn't parsed by the browser
    //        as a declarative shadow root
    //     2. The mustache template via this.template
    //
    // connectedCallback is the earliest lifecycle method where we have access
    // to the element's children to check if there's a nested template. However,
    // there's no guarantee that the children have connected and would be returned
    // via a DOM query.
    //
    // The following logic accounts for these constraints while still trying to
    // initialize the shadow root as early in the lifecycle as possible.

    if (!this.#needsToBeMustached) {
      // Declarative shadow DOM is present
      this.#cleanupServerStyles();
      this.#resolveReady();
      return;
    } // We use setTimeout to move the execution of our initialization to the end
    // of the event loop, when we know that the browser has completed connecting
    // the element's children. Then we check for a nested template again, and if that
    // doesn't exist, we create the shadow root.


    const render = () => {
      if (this.#needsToBeMustached) {
        this.#copyChildTemplate();
      }

      if (!this.#needsToBeMustached) {
        // Copying child template worked
        this.#resolveReady();
        return;
      }

      this.#renderTemplate();
      this.#resolveReady();
    }; // In testing environments, the setTimeout isn't necessary, and its best to avoid
    // introducing time into tests.
    // @ts-expect-error Set in Storybook for supporting storybook-addon-pseudo-states


    const isStorybook = window.IS_STORYBOOK;

    if ( false || isStorybook) {
      render();
    } else {
      setTimeout(render);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    for (const cb of this.#disconnectCallbacks) {
      cb();
    }
  }

  update(changedProperties) {
    super.update(changedProperties);

    if (this.#bindings) {
      for (const [effectedProperty, bindings] of this.#bindings) {
        if (changedProperties.has(effectedProperty)) {
          bindings.forEach(cb => cb());
        }
      }
    }
  }

  #copyChildTemplate = () => {
    if (!this.shadowRoot || !this.#needsToBeMustached) return;
    const childTemplate = this.children[0];
    if (!(childTemplate instanceof HTMLTemplateElement)) return;

    if (childTemplate) {
      this.shadowRoot.appendChild(childTemplate.content.cloneNode(true));
      childTemplate.remove();
      this.#needsToBeMustached = false;
    }
  };
  #renderTemplate = () => {
    if (!this.shadowRoot || !this.#needsToBeMustached || !this.#ctor.template) return;
    const content = this.#ctor.template(this.getMustacheData());
    let stylesheets = "";

    const handleStyles = sheet => {
      if (!this.shadowRoot) return;

      if (sheet) {
        this.shadowRoot.adoptedStyleSheets = [sheet];
      } else {
        const linkTag = ShadowStylesheet.createLinkTag();
        this.shadowRoot.prepend(linkTag);
      }
    }; // getStylesheet() can return the CSSStyleSheet, a link tag string, or a promise that
    // resolves to either of those, depending on the state of the stylesheet fetch and
    // the browser's capabilities. We handle all 3 cases here.
    //
    // We want to by synchronous if possible to avoid a FOUC, but if we have to wait for
    // the stylesheet we can render the content immediately and then apply styles when
    // they arrive, since the content will be invisible until styles are applied.


    const result = ShadowStylesheet.getStylesheet();

    if (result instanceof Promise) {
      const styleId = "wait-for-styles"; // Make the component invisible until the styles resolve

      stylesheets = `<style id='${styleId}'>:host {visibility: hidden}</style>`;
      result.then(handleStyles).catch(() => {
        const linkTag = ShadowStylesheet.createLinkTag();
        this.shadowRoot?.prepend(linkTag);
      }).finally(() => {
        this.shadowRoot?.getElementById(styleId)?.remove();
      });
    } else if (typeof result === "string") {
      stylesheets = result;
    } else {
      handleStyles(result);
    }

    this.shadowRoot.innerHTML = `${stylesheets}${content}`;
    this.#needsToBeMustached = false;
  };
  /**
   * If we initialize with a declarative shadow DOM, it will come with a <link>
   * tag for styles. If later in the page's lifetime we fetch new markup from the server
   * with a declarative shadow DOM, we can benefit from using the CSSStylesheet instead
   * of awaiting for the browser to parse the <link> element, which can cause a brief FOUC.
   */

  #cleanupServerStyles() {
    const handleStyles = sheet => {
      if (sheet && this.shadowRoot) {
        this.shadowRoot.adoptedStyleSheets = [sheet]; // Clean up <link> since we don't need and it causes duplicate styles.
        // Defer since it's not critical.

        onDOMReady(() => {
          if ( // Being extra careful that the styles are still there
          this.shadowRoot && this.shadowRoot.adoptedStyleSheets?.includes(sheet)) {
            const linkEl = this.shadowRoot.firstElementChild;

            if (linkEl?.tagName.toLowerCase() === "link") {
              linkEl.remove();
            }
          }
        });
      }
    };

    const result = ShadowStylesheet.getStylesheet();

    if (result instanceof Promise) {
      result.then(handleStyles).catch(() => {// If error, don't do anything, keep <link>
      });
    } else if (typeof result !== "string") {
      handleStyles(result);
    }
  }
  /**
   * The element's attributes normalized into an object
   */


  getMustacheData() {
    const props = {};

    for (const [prop, options] of this.#ctor.elementProperties.entries()) {
      const attribute = typeof options.attribute === "string" ? options.attribute : prop; // @ts-expect-error sad

      props[attribute] = this[prop];
    }

    props.messages = etsy_context.getObject("collage_translations") || {};
    return props;
  }
  /**
   * Registers a callback to be invoked when the element disconnects from the DOM.
   * (via disconnectedCallback)
   *
   * Example:
   *
   * ```ts
   * class Elem extends CollageElement {
   *     override connectedCallback() {
   *         super.connectedCallback();
   *         const btn = this.renderRoot.querySelector('button');
   *         function handleClick() {
   *             alert('button clicked!');
   *         }
   *         btn.addEventListener('click', handleClick);
   *         this.onDisconnect(() => {
   *             btn.removeEventListener('click', handleClick);
   *         });
   *     }
   * }
   * ```
   */


  onDisconnect(callback) {
    this.#disconnectCallbacks.add(callback);
  }
  /**
   * This method is called any time an event is delegated.
   * It's a central handler to handle events for this custom element.
   * @internal
   */
  // @ts-expect-error we know
  // eslint-disable-next-line @typescript-eslint/no-empty-function


  handleEvent(event) {}
  /**
   * Subscribes annotations on elements in the shadow DOM to run DOM manipulations on updates
   *
   * "x-text" - Binds the element's text content to the provided property name
   * "x-show" - Binds the element's hidden property to the provided property name
   * ":[attribute]" - Binds the element's attribute to the provided property name
   *
   * x-text="propertyName"
   * x-show="propertyName"
   *
   * :attribute="propertyName"
   *       OR shorthand:
   * :attribute (attribute and property share the same word)
   */


  #hydrateBindings() {
    const root = this.shadowRoot;
    if (!root) return; // TEXT: x-text="signalName"

    const handleBoundText = el => {
      const path = el.getAttribute("x-text");
      if (!path) return;
      this.#bindings ??= new Map();
      const propertyEffects = this.#bindings.get(path) ?? [];
      propertyEffects.push(() => {
        // @ts-expect-error Expect property exists
        const v = this[path]; // eslint-disable-next-line no-param-reassign

        el.textContent = v?.toString() ?? "";
      });
      this.#bindings.set(path, propertyEffects);
    }; // VISIBILITY: x-show="signalName", x-hide="signalName"


    const handleBoundVisibility = (el, isShow) => {
      const path = el.getAttribute("x-show") || el.getAttribute("x-hide");
      if (!path) return;
      this.#bindings ??= new Map();
      const propertyEffects = this.#bindings.get(path) ?? [];
      propertyEffects.push(() => {
        // @ts-expect-error Expect property exists
        const value = this[path];
        const bool = value !== undefined && value !== null && value !== false; // eslint-disable-next-line no-param-reassign

        el.hidden = isShow ? !bool : bool;
      });
      this.#bindings.set(path, propertyEffects);
    }; // ATTRIBUTES:
    //     :attr="signalName"
    //     :attrAndSignalName
    // :placeholder="placeholder" ==== :placeholder


    const handleBoundAttr = (el, attr) => {
      const attrName = attr.slice(1);
      let propName = el.getAttribute(attr);

      if (!propName) {
        propName = attrName;
      }

      if (!propName) return;
      this.#bindings ??= new Map();
      const config = this.#ctor.elementProperties.get(propName);
      const converter = typeof config?.converter === "function" ? config.converter : typeof config?.converter?.toAttribute === "function" ? config.converter.toAttribute : // This definitely exists, the type is misleading
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      u.toAttribute;
      const propertyEffects = this.#bindings.get(propName) ?? [];
      propertyEffects.push(() => {
        // @ts-expect-error Expect property exists
        const v = this[propName];
        const out = converter(v, config?.type);

        if (out === null || out === undefined) {
          el.removeAttribute(attrName);
        } else if (typeof v !== "undefined") {
          el.setAttribute(attrName, out.toString());
        }
      });
      this.#bindings.set(propName, propertyEffects);
    };

    root.querySelectorAll("*").forEach(el => {
      const attrNames = el.getAttributeNames();

      if (attrNames.includes("x-text")) {
        handleBoundText(el);
      }

      if (attrNames.includes("x-show")) {
        handleBoundVisibility(el, true);
      }

      if (attrNames.includes("x-hide")) {
        handleBoundVisibility(el, false);
      }

      const boundAttrs = attrNames.filter(name => name.startsWith(":"));

      for (const attr of boundAttrs) {
        handleBoundAttr(el, attr);
      }
    });
  }

}
/* harmony default export */ const internal_CollageElement = (CollageElement);
;// ./htdocs/assets/js/collage/web-components/events/error.ts
class ClgErrorEvent extends Event {
  constructor() {
    super("clg-error", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
  }

}
;// ./htdocs/assets/js/collage/web-components/events/load.ts
class ClgLoadEvent extends Event {
  constructor() {
    super("clg-load", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
  }

}
;// ./htdocs/assets/js/collage/storybook-utils/constants.ts
/**
 * `<clg-icon>`, `<clg-brand-icon>`, etc get SVGs via client-side fetch.
 * In order for Storybook to pull from the local VM, and for
 * branches in Chromatic to use the SVGs aligned with the state of
 * a branch, we copy the htdocs/assets/type/etsy-icon/clg folder
 * as a static directory (this constant) for the storybook app.
 * The icon web components will then fetch from that static directory,
 * instead of from etsy.com or the VM.
 */
const STORYBOOK_COLLAGE_ICON_PATH = "/clg-icons";
;// ./htdocs/assets/js/collage/web-components/internal/base-icon.ts




const CACHEABLE_ERROR = Symbol();
const RETRYABLE_ERROR = Symbol();

/**
 * Cached results from network requests per icon name
 */
const iconCache = new Map();
/**
 * Stash of active requests. If an icon renders and there's already a
 * request in-flight for that resolved icon URL, we'll await the original request.
 */

const queuedRequests = new Map();
let parser;

const base_icon_mockFetch = () => Promise.resolve(new Response(`<svg>stubbed svg content</svg>`, {
  status: 200
}));
/**
 * @tagname clg-base-icon
 *
 * @event {ClgErrorEvent} clg-error - Emitted when the icon fails to load due to an error.
 * @event {ClgLoadEvent} clg-load - Emitted when the icon is loaded.
 *
 * @summary This is a primitive for handling frontend requests for
 * icon assets. It handles fetching, caching, and rendering SVG icons.
 * It's not intended for use as its own element.
 */


class ClgBaseIcon extends CollageElement {
  static properties = {
    name: {
      type: String,
      reflect: true
    },
    label: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    name: required
  };
  /**
   * Icon behavior should be different in jest tests, since we don't want to
   * include network requests in other teams' suites. ClgIcon tests use it
   * so we can actually test behavior.
   * @internal
   */

  static getEnv = () =>  false ? 0 : "prod";
  /** The name of the icon to draw. */

  #initialized = false;
  /**
   * Resolve the inflight request promise, which fulfills the response
   * for other icons of the same name.
   */

  #resolveQueue;

  get #ctor() {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.constructor;
  }
  /** Element in which the icon is rendered */


  get root() {
    throw new Error("This property must be defined.");
  }
  /** Resolves the root path for the icon assets */


  getBasePath(name) {
    const isStorybook = // @ts-expect-error This must be set in the Storybook app,
    // It's not a flag set by Storybook itself.
    window.IS_STORYBOOK === true;

    if (isStorybook) {
      return `${STORYBOOK_COLLAGE_ICON_PATH}/${name}`;
    }

    return `https://${window.location.hostname}/assets/type/etsy-icon/clg/${name}`;
  }
  /** Used together with `getBasePath` to resolve the full URL of the svg */


  getIconUrl(_name) {
    throw new Error("This method must be updated.");
  }

  update(changed) {
    super.update(changed);

    if (typeof this.label === "string" && this.label.length > 0) {
      this.setAttribute("role", "img");
      this.setAttribute("aria-label", this.label);
      this.removeAttribute("aria-hidden");
    } else {
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.setAttribute("aria-hidden", "true");
    }

    if (changed.has("name")) {
      this.#setIcon();
    }
  }
  /** Given a URL, this function returns the resulting SVG element string or an appropriate error symbol. */


  async #resolveIcon(url) {
    let fileData;

    try {
      if (queuedRequests.has(url)) {
        const tmpl = await queuedRequests.get(url);

        if (tmpl) {
          return tmpl;
        }
      }

      this.#queueIcon(url);
      const fetcher = this.#ctor.getEnv() === "test" ? base_icon_mockFetch : fetch;
      fileData = await fetcher(url, {
        mode: "cors"
      });

      if (!fileData.ok) {
        return fileData.status === 410 ? CACHEABLE_ERROR : RETRYABLE_ERROR;
      }
    } catch {
      return RETRYABLE_ERROR;
    }

    try {
      const div = document.createElement("div");
      div.innerHTML = await fileData.text();
      const svg = div.firstElementChild;

      if (svg?.tagName?.toLowerCase() !== "svg") {
        // Response didn't give back an svg
        return CACHEABLE_ERROR;
      }

      parser ??= new DOMParser();
      const doc = parser.parseFromString(svg.outerHTML, "text/html");
      const svgEl = doc.body.querySelector("svg");

      if (!svgEl) {
        // We're not able to actually query the svg, so something's wrong
        return CACHEABLE_ERROR;
      }

      const tmpl = document.createElement("template"); // Adopt into this document to avoid cross-doc issues

      tmpl.content.appendChild(document.importNode(svgEl, true));
      return tmpl;
    } catch {
      return CACHEABLE_ERROR;
    }
  }
  /** Injects the resolved SVG template into the rendered icon container. */


  #renderIcon(tmpl) {
    const root = this.root;

    if (root) {
      if (tmpl) {
        root.replaceChildren(tmpl.content.cloneNode(true));
      } else {
        root.innerHTML = "";
      }
    }
  }
  /** Orchestrates loading, caching, and rendering of the icon for the current name. */


  async #setIcon() {
    const url = this.getIconUrl(this.name);

    if (!this.#initialized) {
      // First, check if the shadow root already has an SVG
      const svg = this.shadowRoot?.querySelector("svg");

      if (svg) {
        // If there is an SVG, and we don't have an SVG of that name cached,
        // we create a new template element and stash it in case another icon
        // of the same name is rendered and needs the markup.
        if (!iconCache.has(url)) {
          parser ??= new DOMParser();
          const tmpl = document.createElement("template");
          tmpl.content.appendChild(svg.cloneNode(true));
          iconCache.set(url, tmpl);
        }

        this.#initialized = true;
        return;
      }
    }

    this.#initialized = true; // CACHED RESULT

    const tmpl = iconCache.get(url);

    if (tmpl instanceof HTMLTemplateElement) {
      this.#renderIcon(tmpl);
      this.dispatchEvent(new ClgLoadEvent());
      return;
    }

    if (tmpl === CACHEABLE_ERROR) {
      this.#renderIcon(null);
      this.dispatchEvent(new ClgErrorEvent());
      return;
    }

    let result;
    const name = this.name; // If we've already queued a request for an icon with the same name, wait for that request

    if (queuedRequests.has(url)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      result = await queuedRequests.get(url);
    } // If we didn't have a queued request, or the first request resulted in a retryable error
    // @ts-expect-error Unhappy that we're expecting result could be defined


    if (!result || result === RETRYABLE_ERROR) {
      result = await this.#resolveIcon(url);
      this.#resolveQueue?.(result);
    }

    if (name !== this.name) {
      // Name changed since original request, bail
      return;
    }

    if (result === CACHEABLE_ERROR || result instanceof HTMLTemplateElement) {
      iconCache.set(url, result);
    }

    switch (result) {
      case RETRYABLE_ERROR:
      case CACHEABLE_ERROR:
      case undefined:
        // Shouldn't ever be undefined, but just in case
        this.#renderIcon(null);
        this.dispatchEvent(new ClgErrorEvent());
        break;

      default:
        {
          this.#renderIcon(result);
          this.dispatchEvent(new ClgLoadEvent());
        }
    }
  }
  /** Stores a promise for an icon fetch so other instances can await the same request. */


  #queueIcon(cacheKey) {
    if (this.#ctor.getEnv() === "test") {
      return;
    }

    queuedRequests.set(cacheKey, new Promise(res => {
      this.#resolveQueue = res;
    }));
  }

}
// EXTERNAL MODULE: ./node_modules/hogan.js/lib/hogan.js
var hogan = __webpack_require__(262);
var hogan_default = /*#__PURE__*/__webpack_require__.n(hogan);
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-button.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");if(t.s(t.f("href",c,p,1),c,p,0,9,266,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("<a");t.b("\n" + i);t.b("class=\"clg-button\" data-button-root");t.b("\n" + i);if(!t.s(t.f("disabled",c,p,1),c,p,1,0,0,"")){t.b("href=\"");t.b(t.v(t.f("link",c,p,0)));t.b("\"");};t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,103,135,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("role=\"link\" aria-disabled=\"true\"");});c.pop();}t.b(" ");if(t.s(t.f("target",c,p,1),c,p,0,160,179,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("target=\"");t.b(t.v(t.f("target",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("rel",c,p,1),c,p,0,199,212,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rel=\"");t.b(t.v(t.f("rel",c,p,0)));t.b("\"");});c.pop();}t.b(" x-on:pointerup=\"RELEASE\" x-on:click=\"CLICK\"");t.b("\n" + i);t.b(">");});c.pop();}t.b("\n" + i);if(!t.s(t.f("href",c,p,1),c,p,1,0,0,"")){t.b("    <");if(t.s(t.f("with-submit",c,p,1),c,p,0,307,310,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("div");});c.pop();}if(!t.s(t.f("with-submit",c,p,1),c,p,1,0,0,"")){t.b("button");};t.b(" class=\"clg-button\" data-button-root type=\"");t.b(t.v(t.f("type",c,p,0)));if(!t.s(t.f("type",c,p,1),c,p,1,0,0,"")){t.b("button");};t.b("\" ");if(t.s(t.f("disabled",c,p,1),c,p,0,454,463,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled ");});c.pop();}t.b(" x-on:pointerup=\"RELEASE\" x-on:click=\"CLICK\">");t.b("\n" + i);};t.b("    <slot name=\"submit-input\"></slot>");t.b("\n" + i);t.b("    <span id=\"content\" class=\"clg-button__content\" ");if(t.s(t.f("with-submit",c,p,1),c,p,0,637,655,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-hidden=\"true\"");});c.pop();}t.b(">");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("    <span id=\"spinner-frame\" class=\"clg-button__spinner-frame\" ");if(!t.s(t.f("loading",c,p,1),c,p,1,0,0,"")){t.b("hidden");};t.b(" x-show=\"loading\">");t.b("\n" + i);t.b("        <span class=\"clg-button__spinner-frame__light-spinner\"><clg-loading-spinner background-type=\"dark\"></clg-loading-spinner></span>");t.b("\n" + i);t.b("        <span class=\"clg-button__spinner-frame__dark-spinner\"><clg-loading-spinner></clg-loading-spinner></span>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);if(t.s(t.f("href",c,p,1),c,p,0,1090,1094,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("</a>");});c.pop();}t.b("\n" + i);if(!t.s(t.f("href",c,p,1),c,p,1,0,0,"")){t.b("</");if(t.s(t.f("with-submit",c,p,1),c,p,0,1131,1134,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("div");});c.pop();}if(!t.s(t.f("with-submit",c,p,1),c,p,1,0,0,"")){t.b("button");};t.b(">");};t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
tmpl.name = "collage/clg-button.mustache";
(hogan_default()).partialsMap[tmpl.name] = tmpl;

const render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return tmpl.render.call(tmpl, data, (hogan_default()).partialsMap);
};
render.template = tmpl;
/* harmony default export */ const clg_button_mustache = (render);

;// ./htdocs/assets/js/collage/web-components/internal/getActiveElements.ts
/**
 * Collects all active elements in the DOM tree, traversing through open shadow DOM boundaries. The last
 * element returned is the "deepest" active element. To fetch the deepest active element, use
 * `activeElements.pop()`.
 */
function getActiveElements(activeElement = document.activeElement) {
  const elements = [];
  if (!activeElement) return elements;
  elements.push(activeElement);
  let el = activeElement;

  while (el && el?.shadowRoot !== null) {
    el = el.shadowRoot.activeElement;

    if (el) {
      elements.push(el);
    }
  }

  return elements;
}
;// ./htdocs/assets/js/collage/web-components/internal/html.ts

/**
 * Change the tag of an HTML element while preserving its attributes and child nodes.
 */

function changeHtmlTag(element, newTagName) {
  const hasFocus = getActiveElements().pop() === element;
  const replacement = document.createElement(newTagName); // Copy attributes

  for (const {
    name,
    value
  } of Array.from(element.attributes)) {
    replacement.setAttribute(name, value);
  } // move child nodes (preserves state of and  event listeners on child elements)


  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }

  element.replaceWith(replacement);

  if (hasFocus) {
    replacement.focus();
  }

  return replacement;
}
/**
 * Toggle a string attribute on an HTML element
 */

function toggleStringAttribute(element, attribute, value) {
  if (value) {
    element.setAttribute(attribute, value);
  } else {
    element.removeAttribute(attribute);
  }
}
/**
 * Get the `innerHTML` of a slot element
 */

function getSlotHtml(slot) {
  const nodes = slot.assignedNodes({
    flatten: true
  });
  let innerHtml = "";
  [...nodes].forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      innerHtml += node.outerHTML;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      innerHtml += node.textContent;
    }
  });
  return innerHtml;
}
;// ./htdocs/assets/js/collage/web-components/mixins/AnchorOrButtonMixin.ts
 // eslint-disable-next-line @typescript-eslint/no-explicit-any

/**
 * Adds properties and logic to switch between rendering an anchor or button element
 */
const AnchorOrButtonMixin = superClass => {
  class AnchorOrButtonMixinClass extends superClass {
    /** Whether or not the element is interactive */

    /** The button's `type` attribute */

    /** Where to display the linked URL */

    /** The relationship of the linked URL as space-separated link types. */

    /** The URL that the hyperlink points to. */
    static properties = {
      disabled: {
        type: Boolean,
        reflect: true
      },
      type: {
        type: String
      },
      target: {},
      href: {},
      rel: {}
    }; // Needed to satisfy TS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    constructor(..._args) {
      super();
      this.type = "button";
      this.disabled = false;
    }

    get _button() {
      throw new Error("This must be redefined to return the target element.");
    }

    update(changed) {
      super.update(changed);
      if (!this._button) return;

      if (this.href && this._button.tagName.toLowerCase() === "button") {
        changeHtmlTag(this._button, "a");
      }

      if (!this.href && this._button.tagName.toLowerCase() === "a") {
        changeHtmlTag(this._button, "button");
      }

      const btn = this._button;

      if (this.href) {
        // Remove button attrs
        btn.removeAttribute("type");
        btn.removeAttribute("disabled"); // Add anchor attrs

        toggleStringAttribute(btn, "target", this.target);
        toggleStringAttribute(btn, "rel", this.rel);

        if (this.disabled) {
          btn.removeAttribute("href");
          btn.setAttribute("role", "link");
          btn.setAttribute("aria-disabled", "true");
        } else {
          btn.setAttribute("href", this.href);
          btn.removeAttribute("role");
          btn.removeAttribute("aria-disabled");
        }
      } else {
        btn.removeAttribute("href");
        btn.removeAttribute("rel");
        btn.removeAttribute("target");
        btn.removeAttribute("role");
        btn.removeAttribute("aria-disabled");
        btn.setAttribute("type", this.type);
        btn.toggleAttribute("disabled", this.disabled);
      }
    }

  } // eslint-disable-next-line @typescript-eslint/consistent-type-assertions


  return AnchorOrButtonMixinClass;
};
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-loading-spinner.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_loading_spinner_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-loading-spinner\">");t.b("\n" + i);t.b("    <svg width=\"100%\" height=\"100%\" fill=\"none\" role=\"progressbar\" aria-valuemin=\"0\" aria-valuemax=\"100\" :aria-label=\"label\" aria-label=\"");t.b(t.v(t.f("label",c,p,0)));if(!t.s(t.f("label",c,p,1),c,p,1,0,0,"")){t.b(t.v(t.d("messages.loading",c,p,0)));};t.b("\">");t.b("\n" + i);t.b("        <circle cx=\"50%\" cy=\"50%\" class=\"clg-loading-spinner__track\"/>");t.b("\n" + i);t.b("        <circle cx=\"50%\" cy=\"50%\" class=\"clg-loading-spinner__fill\" pathLength=\"100\" stroke-dasharray=\"100 200\" stroke-linecap=\"round\" />");t.b("\n" + i);t.b("    </svg>");t.b("\n" + i);t.b("</span>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_loading_spinner_mustache_tmpl.name = "collage/clg-loading-spinner.mustache";
(hogan_default()).partialsMap[clg_loading_spinner_mustache_tmpl.name] = clg_loading_spinner_mustache_tmpl;

const clg_loading_spinner_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_loading_spinner_mustache_tmpl.render.call(clg_loading_spinner_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_loading_spinner_mustache_render.template = clg_loading_spinner_mustache_tmpl;
/* harmony default export */ const clg_loading_spinner_mustache = (clg_loading_spinner_mustache_render);

;// ./htdocs/assets/js/common/etsy.msg.js
/**
 * Note: This dependency should never be used directly.
 *
 * It is used as part of autogenerated code. Developers should use `phpmsg!` in order to
 * handle string translation on the client.
 */


const keyCache = {};

var EtsyMsg = {
    catalog: {},
    _hogan: {
        msgNotFoundErrorTemplate: "",
        keyNotFoundErrorTemplate: "",
        pluralErrorTemplate: "",
    },

    /**
     * @param className:String PHP Class name associated with JSON
     * @param arr:Array see Builda:lib/plugins/template/phpmsg.mustache
     * @param langCode:String
     */
    addObjToEtsyMsg(className, arr, langCode) {
        if (typeof EtsyMsg.catalog[className] === "undefined") {
            EtsyMsg.catalog[className] = {};
        }
        const messageCatalog = arr[1];
        if (langCode) {
            if (langCode !== "root-locale") {
                EtsyMsg.catalog[className][langCode] = messageCatalog;
            } else {
                EtsyMsg.catalog[className][
                    etsy_context.getData("locale_settings.language.code", "en-US")
                ] = messageCatalog;
            }
        } else {
            // if langCode is falsy, messageCatalog contains full
            // languages.
            EtsyMsg.catalog[className] = messageCatalog;
        }
    },

    /**
     * @param className:String
     * @param key:String
     * @param _langCode:String
     */
    get(className, key, _langCode) {
        let langCode, myCatalog;
        if (_langCode && _langCode !== "root-locale") {
            langCode = _langCode;
        } else {
            langCode = etsy_context.getData("locale_settings.language.code", "en-US");
        }
        myCatalog = EtsyMsg.catalog[className][langCode];
        if (myCatalog) {
            return myCatalog[key];
        } else {
            if (true) {
                throw new Error(
                    `The requested language is "${langCode}", but there is only: "${Object.keys(
                        EtsyMsg.catalog[className]
                    ).join(", ")}"`
                );
            }
            return "";
        }
    },

    /**
     * @param className:String
     * @param key:String
     * @param _langCode:String
     * @param variables:Object
     * @param pluralCount:Number (optional)
     */
    getWithVariables(className, key, _langCode, variables, pluralCount) {
        let langCode =
                _langCode ||
                etsy_context.getData("locale_settings.language.code", "en-US"),
            tmplStr = (window.tmplStr = EtsyMsg.get(className, key, langCode)),
            hoganKey = [className, key, langCode].join("::");
        if (
            undefined !== pluralCount &&
            "object" === typeof tmplStr &&
            tmplStr instanceof Array &&
            2 === tmplStr.length
        ) {
            // assuming tmplStr is really an Array (index 0 is plural case messages, index 1 are plural forms)
            // which is the case for plural messages dumped with Translation_Util_MessageCatalogExtractor (which ./bin/get_json_message_catalog uses).
            // EtsyMsg.pickPluralCase will validate that these assumptions are correct:
            tmplStr = EtsyMsg.pickPluralCase(tmplStr[0], tmplStr[1], pluralCount);
            hoganKey = [className, key, langCode, pluralCount].join("::");
        }
        if (true) {
            EtsyMsg.validateMsgExists(tmplStr, className, key, langCode);
            EtsyMsg.validateAllKeysInData(hoganKey, tmplStr, variables);
        }
        if (EtsyMsg._hogan[hoganKey] === undefined) {
            EtsyMsg._hogan[hoganKey] = hogan_default().compile(tmplStr);
        }
        return EtsyMsg._hogan[hoganKey].render(variables);
    },

    /**
     * @param content:Array e.g.: ["you have zero ({{count}}) items", "you have ({{count}}) item", "you have ({{count}}) items"]
     * @param parsedPluralForms:Array e.g.: [["is", [0]], ["is", [1]], ["else"]]
     * @param pluralCount:Number
     * @return String the entry on content that it was determined should be used based on parsedPluralForms and pluralCount
     */
    pickPluralCase(content, parsedPluralForms, pluralCount) {
        const CASE_IS = "is";
        const CASE_ENDS_IN = "ends_in";
        const CASE_ENDS_IN_EXCEPT = "ends_in_except";
        const CASE_ENDS_IN_EXCEPT_ENDS_IN = "ends_in_except_ends_in";
        const CASE_OR = "or";
        const CASE_ELSE = "else"; // everything else

        /**
         * JS implementation of equivalent function in
         * Translation_PluralForms
         *
         * Returns 0 based index for plural case that should be used for a plural
         * message based on `pluralCount`
         *
         * @param cases:Array e.g.: [["is", [0]], ["is", [1]], ["else"]]
         * @param pluralCount:Number
         * @return Number
         */
        const getCaseFormFor = function getCaseFormFor(cases, pluralCount) {
            for (let i = 0, len = cases.length; i < len; i++) {
                const pluralForm = cases[i];
                if (caseContains(pluralForm, pluralCount)) {
                    return i;
                }
            }
            throw new Error(
                `Missing the everything-else case in: ${JSON.stringify(cases)}`
            );
        };

        /**
         * JS implementation of equivalent function in
         * Translation_PluralForms
         *
         * @param pluralForm:Array e.g.: ["is", [0]]
         * @param pluralCount:Number
         * @return Boolean true if pluralCount meets condition pluralForm
         */
        var caseContains = function (pluralForm, pluralCount) {
            switch (pluralForm[0]) {
                case CASE_IS:
                    return integerSetContains(pluralForm[1], pluralCount);

                case CASE_ENDS_IN_EXCEPT:
                    // If the number is in the "except" part, say no
                    // "Except" part in this case containts just an integer set
                    if (integerSetContains(pluralForm[3], pluralCount)) {
                        return false;
                    }
                    return caseEndsIn(pluralCount, pluralForm[2], pluralForm[1]);

                case CASE_ENDS_IN_EXCEPT_ENDS_IN:
                    // If the number ends in the except rule, say no
                    // "Except" part in this case contains rules for modulo operation
                    if (
                        caseEndsIn(pluralCount, pluralForm[4], pluralForm[3]) &&
                        !integerSetContains(pluralForm[5], pluralCount)
                    ) {
                        return false;
                    }

                    return caseEndsIn(pluralCount, pluralForm[2], pluralForm[1]);

                case CASE_ENDS_IN:
                    return caseEndsIn(pluralCount, pluralForm[2], pluralForm[1]);

                case CASE_OR:
                    for (let i = 1, len = pluralForm.length; i < len; i++) {
                        if (caseContains(pluralForm[i], pluralCount)) {
                            return true;
                        }
                    }
                    return false;

                case CASE_ELSE:
                    return true;

                default:
                    throw new Error(`Invalid case type: ${pluralForm[0]}`);
            }
        };

        /**
         * JS implementation of equivalent function in
         * Translation_PluralForms
         *
         * @param integerSet Array e.g.: [1, 2, 3], or Number e.g.: 22
         * @param number:Number
         * @return Boolean true if integerSet is scalar and === number, or
         *         if number is one of the elements in integerSet (if it's an Array).
         */
        var integerSetContains = function (integerSet, number) {
            for (let i = 0, len = integerSet.length; i < len; i++) {
                const integerEntry = integerSet[i];
                if (integerEntry instanceof Array) {
                    if (integerEntry[0] <= number && number <= integerEntry[1]) {
                        return true;
                    }
                } else {
                    if (parseInt(number) === parseInt(integerEntry)) {
                        return true;
                    }
                }
            }
            return false;
        };

        /**
         * JS implementation of equivalent function "caseEndsIn" in
         * Translation_PluralForms
         *
         * @param pluralCount:Number
         * @param modulus
         * @param validRemainders Array
         * @returns {Boolean}
         */

        var caseEndsIn = function (pluralCount, modulus, validRemainders) {
            const remainder = pluralCount % modulus;
            return integerSetContains(validRemainders, remainder);
        };

        if (content.length !== parsedPluralForms.length) {
            throw new Error(
                EtsyMsg._hogan.pluralErrorTemplate.render({
                    message:
                        "'content' and 'parsedPluralForms' should have identical `.length`s.",
                    cases: content,
                    forms: parsedPluralForms,
                    count: pluralCount,
                })
            );
        }
        try {
            var pluralIndex = getCaseFormFor(parsedPluralForms, pluralCount);
        } catch (err) {
            throw new Error(
                EtsyMsg._hogan.pluralErrorTemplate.render({
                    message: err.message,
                    cases: content,
                    forms: parsedPluralForms,
                    count: pluralCount,
                })
            );
        }
        if (undefined === content[pluralIndex]) {
            throw new Error(
                EtsyMsg._hogan.pluralErrorTemplate.render({
                    message:
                        "there isn't an entry in 'content' for the plural index that should be used",
                    cases: content,
                    forms: parsedPluralForms,
                    count: pluralCount,
                })
            );
        }
        return content[pluralIndex];
    },

    // validators
    validateMsgExists(tmplStr, className, key, langCode) {
        if (!tmplStr) {
            throw new Error(
                EtsyMsg._hogan.msgNotFoundErrorTemplate.render({
                    msg: [className, key, langCode].join(" - "),
                    msgs: Object.keys(EtsyMsg.catalog[className][langCode]).join(),
                })
            );
        }
    },

    validateAllKeysInData(hoganKey, tmplStr, data) {
        let keys = keyCache[hoganKey];
        if (!keys) {
            keys = keyCache[hoganKey] = tmplStr
                .split(/{{{?|}}}?/g)
                .filter((_, i) => {
                    return i % 2 !== 0;
                })
                .map((str) => {
                    return str.trim();
                });
        }

        const missing = keys.filter((k) => {
            return !data.hasOwnProperty(k);
        });

        if (missing.length > 0) {
            throw new Error(
                EtsyMsg._hogan.keyNotFoundErrorTemplate.render({
                    key: missing.join(),
                })
            );
        }
    },
};

if (true) {
    EtsyMsg._hogan.msgNotFoundErrorTemplate = hogan_default().compile(
        "Message not found: {{msg}} - check your message catalog. All known messages: {{msgs}}"
    );
    EtsyMsg._hogan.keyNotFoundErrorTemplate = hogan_default().compile(
        "Missing data: {{key}}, required for interpolation"
    );
    EtsyMsg._hogan.pluralErrorTemplate = hogan_default().compile(
        'Plural message error ("{{message}}"): content/cases: {{cases}}, forms: {{forms}}, count: {{count}}'
    );
}

/* harmony default export */ const etsy_msg = ((/* unused pure expression or super */ null && (EtsyMsg)));

;// ./htdocs/assets/js/translator/mini-mustache/parse.ts
/** Shared pattern for a key within a string or function substitution. */
const KEY = "[\\w$-]+";
/** Tag for a pseudo-Mustache variable, eg. "{{name}}". */

const VARIABLE = new RegExp(`\\{\\{(${KEY})\\}\\}`);
/** Tag for a block, eg. "{{#link}}...{{/link}}". */

const BLOCK = new RegExp(`\\{\\{#(${KEY})\\}\\}`);
/**
 * Recursively parses variable tags, eg. "{{name}}", from the input.
 */

function parseVariable(input) {
  const match = VARIABLE.exec(input);

  if (match) {
    const [tag, key] = match;

    if (tag === undefined || key === undefined) {
      if (true) {
        throw new Error("Failed match of string tag");
      }

      return [input];
    }

    const index = match.index;

    if (isEscaped(input, match)) {
      const before = input.slice(0, index - 1);
      const after = input.slice(index + tag.length, input.length); // If we detected that this tag was preceded by a "\" then emit
      // this tag verbatim (sans the escaping "\") and continue parsing
      // everything after it.

      return strip([before, tag, ...parseVariable(after)]);
    }

    const before = input.slice(0, index);
    const after = input.slice(index + tag.length, input.length);
    return strip([before, {
      type: "variable",
      variable: key
    }, ...parseVariable(after)]);
  }

  return [input];
}
/**
 * Recursively parses block tags, eg. "{{#link}}contents{{/link}}", from the
 * input. It also parses variable tags occuring before, after, and within the
 * block.
 */


function parseBlock(input) {
  const match = BLOCK.exec(input);

  if (match) {
    const [openTag, key] = match; // These should always be present, but TypeScript isn't convinced.

    if (openTag === undefined || key === undefined) {
      if (true) {
        throw new Error("Failed match of function opening tag");
      }

      return parseVariable(input);
    }

    const openIndex = match.index;

    if (isEscaped(input, match)) {
      const before = input.slice(0, openIndex - 1);
      const after = input.slice(openIndex + openTag.length, input.length); // If we detected that this tag was preceded by a "\" then emit
      // this tag verbatim (sans the escaping "\") and continue parsing
      // everything after it.

      return strip([...parseVariable(before), openTag, ...parseBlock(after)]);
    }

    const before = input.slice(0, openIndex); // Construct a matching closing tag: an opening tag like "{{#link}}"
    // must be closed by a "{{/link}}" closing tag.

    const closeTag = `{{/${key}}}`;
    const closeIndex = input.indexOf(closeTag);

    if (closeIndex === -1) {
      if (true) {
        throw new Error(`Missing closing tag for opening tag: '${openTag}'`);
      } // Gracefully recover by omitting this unbalanced tag from the
      // output. We'll continue parsing everything before the tag for
      // variables and recursively parsing everything after the tag for
      // blocks and variables.


      const after = input.slice(openIndex + openTag.length, input.length);
      return strip([...parseVariable(before), ...parseBlock(after)]);
    }

    const inner = input.slice(openIndex + openTag.length, closeIndex);
    const after = input.slice(closeIndex + closeTag.length, input.length); // Parse everything before our block tag for variables, recursively
    // parse what's inside the block tag, and recursively parse everything
    // after the block tag.

    return strip([...parseVariable(before), {
      type: "block",
      variable: key,
      children: parseBlock(inner)
    }, ...parseBlock(after)]);
  } // If the input contained no block tags then parse it for variable tags.


  return parseVariable(input);
}
/** Helper for detecting if a tag is preceded by a "\". */


function isEscaped(input, match) {
  // Cannot be escaped if the tag starts at the beginning of the input.
  if (match.index === 0) {
    return false;
  }

  return input[match.index - 1] === "\\";
}
/**
 * Remove zero-length strings from children arrays to clean them up. This makes
 * writing tests cleaner and inspecting children trees easier.
 */


function strip(children) {
  return children.filter(child => {
    if (typeof child === "string") {
      return child.length > 0;
    }

    return true;
  });
}
/**
 * Entry point for pasring a string into a React node tree containing Variable
 * elements, Block elements, and strings of the content in between.
 */


function parse_parse(input) {
  // This is called from two places in Msg, so this lets us make those call
  // sites a bit cleaner.
  if (input === undefined) {
    return undefined;
  }

  return {
    type: "tree",
    version: 1,
    children: parseBlock(input)
  };
}

/* harmony default export */ const mini_mustache_parse = (parse_parse);
;// ./htdocs/assets/js/translator/mini-mustache/transform.ts
/**
 * Visitor for transforming a tree. The generics are:
 *   - T: The ultimate type of the transformed tree. This is what `transform()`
 *        will return.
 *   - B: What type block nodes will be transformed into.
 *   - V: What type variable nodes will be transformed into.
 *   - C: Shared context object that will be passed to all visit methods.
 *
 * Note that tree and block nodes can contain strings, variable nodes, and
 * other block nodes: therefore `visitTree()` and `visitBlock()` will be called
 * with `Array<B | V | string>`.
 */
function transformChildren(transformer, children, context) {
  return children.map(child => {
    if (typeof child === "string") {
      return child;
    }

    switch (child.type) {
      case "block":
        return transformer.visitBlock(child.variable, transformChildren(transformer, child.children, context), context);

      case "variable":
        return transformer.visitVariable(child.variable, context);

      default:
        // @ts-expect-error: Switch *should* be exhaustive.
        throw new Error(`Unknown node type: ${child.type}`);
    }
  });
}
/**
 * Bottom-up transformation using the visitor pattern. Visit methods of the
 * visitor will be called from the leaves of the tree up to the root.
 */


function transform(tree, transformer, context) {
  return transformer.visitTree(transformChildren(transformer, tree.children, context), context);
}
;// ./htdocs/assets/js/translator/preact/Block.tsx
/* eslint-disable react/jsx-filename-extension */

/**
 * A pseudo-Mustache block substitution. For example, given a translated
 * message like:
 *
 *     "Please {{#link}}click here{{/link}}"
 *
 * We parse that into a <Block tagKey="link" args={...} /> which, when
 * rendered, would return the value it receieved from calling
 * props.args["link"](["click here"]).
 *
 * The "link" argument is therefore a function conceptually similar to a
 * React render prop (see https://reactjs.org/docs/render-props.html).
 *
 * The "block" and "tag key" nomenclature is copied from Mustache for
 * naming consistency (see: https://mustache.github.io/mustache.5.html).
 */
function Block({
  tagKey,
  args,
  children
}) {
  if (children === undefined) {
    return null;
  }

  const render = args[tagKey];

  if (typeof render !== "function") {
    if (true) {
      // eslint-disable-next-line no-console
      console.warn(`Unexpected non-function value for arg: '${tagKey}'`);
    }

    return null;
  }

  return render(children);
}

/* harmony default export */ const preact_Block = (Block);
;// ./node_modules/preact/dist/preact.module.js
var preact_module_n,preact_module_l,preact_module_u,preact_module_t,preact_module_i,preact_module_r,preact_module_o,preact_module_e,preact_module_f,preact_module_c,preact_module_s,preact_module_a,preact_module_h,preact_module_p={},v=[],preact_module_y=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,preact_module_w=Array.isArray;function preact_module_d(n,l){for(var u in l)n[u]=l[u];return n}function g(n){n&&n.parentNode&&n.parentNode.removeChild(n)}function _(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?preact_module_n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps)void 0===e[o]&&(e[o]=l.defaultProps[o]);return m(l,e,i,r,null)}function m(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++preact_module_u:o,__i:-1,__u:0};return null==o&&null!=preact_module_l.vnode&&preact_module_l.vnode(e),e}function preact_module_b(){return{current:null}}function k(n){return n.children}function x(n,l){this.props=n,this.context=l}function preact_module_S(n,l){if(null==l)return n.__?preact_module_S(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return"function"==typeof n.type?preact_module_S(n):null}function C(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return C(n)}}function M(n){(!n.__d&&(n.__d=!0)&&preact_module_i.push(n)&&!$.__r++||preact_module_r!=preact_module_l.debounceRendering)&&((preact_module_r=preact_module_l.debounceRendering)||preact_module_o)($)}function $(){for(var n,u,t,r,o,f,c,s=1;preact_module_i.length;)preact_module_i.length>s&&preact_module_i.sort(preact_module_e),n=preact_module_i.shift(),s=preact_module_i.length,n.__d&&(t=void 0,r=void 0,o=(r=(u=n).__v).__e,f=[],c=[],u.__P&&((t=preact_module_d({},r)).__v=r.__v+1,preact_module_l.vnode&&preact_module_l.vnode(t),O(u.__P,t,r,u.__n,u.__P.namespaceURI,32&r.__u?[o]:null,f,null==o?preact_module_S(r):o,!!(32&r.__u),c),t.__v=r.__v,t.__.__k[t.__i]=t,N(f,t,c),r.__e=r.__=null,t.__e!=o&&C(t)));$.__r=0}function I(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,w,d,g,_,m=t&&t.__k||v,b=l.length;for(f=P(u,l,m,f,b),a=0;a<b;a++)null!=(y=u.__k[a])&&(h=-1==y.__i?preact_module_p:m[y.__i]||preact_module_p,y.__i=a,g=O(n,y,h,i,r,o,e,f,c,s),w=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&B(h.ref,null,y),s.push(y.ref,y.__c||w,y)),null==d&&null!=w&&(d=w),(_=!!(4&y.__u))||h.__k===y.__k?f=A(y,f,n,_):"function"==typeof y.type&&void 0!==g?f=g:w&&(f=w.nextSibling),y.__u&=-7);return u.__e=d,f}function P(n,l,u,t,i){var r,o,e,f,c,s=u.length,a=s,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?(f=r+h,(o=n.__k[r]="string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?m(null,o,null,null,null):preact_module_w(o)?m(k,{children:o},null,null,null):null==o.constructor&&o.__b>0?m(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):o).__=n,o.__b=n.__b+1,e=null,-1!=(c=o.__i=L(o,u,f,a))&&(a--,(e=u[c])&&(e.__u|=2)),null==e||null==e.__v?(-1==c&&(i>s?h--:i<s&&h++),"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(a)for(r=0;r<s;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=preact_module_S(e)),D(e,e));return t}function A(n,l,u,t){var i,r;if("function"==typeof n.type){for(i=n.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=n,l=A(i[r],l,u,t));return l}n.__e!=l&&(t&&(l&&n.type&&!l.parentNode&&(l=preact_module_S(n)),u.insertBefore(n.__e,l||null)),l=n.__e);do{l=l&&l.nextSibling}while(null!=l&&8==l.nodeType);return l}function H(n,l){return l=l||[],null==n||"boolean"==typeof n||(preact_module_w(n)?n.some(function(n){H(n,l)}):l.push(n)),l}function L(n,l,u,t){var i,r,o,e=n.key,f=n.type,c=l[u],s=null!=c&&0==(2&c.__u);if(null===c&&null==n.key||s&&e==c.key&&f==c.type)return u;if(t>(s?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;)if(null!=(c=l[o=i>=0?i--:r++])&&0==(2&c.__u)&&e==c.key&&f==c.type)return o;return-1}function T(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||preact_module_y.test(l)?u:u+"px"}function j(n,l,u,t,i){var r,o;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else{if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||T(n.style,l,"");if(u)for(l in u)t&&u[l]==t[l]||T(n.style,l,u[l])}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(preact_module_f,"$1")),o=l.toLowerCase(),l=o in n||"onFocusOut"==l||"onFocusIn"==l?o.slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=preact_module_c,n.addEventListener(l,r?preact_module_a:preact_module_s,r)):n.removeEventListener(l,r?preact_module_a:preact_module_s,r);else{if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u))}}function F(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=preact_module_c++;else if(u.t<t.u)return;return t(preact_module_l.event?preact_module_l.event(u):u)}}}function O(n,u,t,i,r,o,e,f,c,s){var a,h,p,v,y,_,m,b,S,C,M,$,P,A,H,L,T,j=u.type;if(null!=u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=preact_module_l.__b)&&a(u);n:if("function"==typeof j)try{if(b=u.props,S="prototype"in j&&j.prototype.render,C=(a=j.contextType)&&i[a.__c],M=a?C?C.props.value:a.__:i,t.__c?m=(h=u.__c=t.__c).__=h.__E:(S?u.__c=h=new j(b,M):(u.__c=h=new x(b,M),h.constructor=j,h.render=E),C&&C.sub(h),h.props=b,h.state||(h.state={}),h.context=M,h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),S&&null==h.__s&&(h.__s=h.state),S&&null!=j.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=preact_module_d({},h.__s)),preact_module_d(h.__s,j.getDerivedStateFromProps(b,h.__s))),v=h.props,y=h.state,h.__v=u,p)S&&null==j.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),S&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else{if(S&&null==j.getDerivedStateFromProps&&b!==v&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(b,M),!h.__e&&null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(b,h.__s,M)||u.__v==t.__v){for(u.__v!=t.__v&&(h.props=b,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u)}),$=0;$<h._sb.length;$++)h.__h.push(h._sb[$]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,M),S&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(v,y,_)})}if(h.context=M,h.props=b,h.__P=n,h.__e=!1,P=preact_module_l.__r,A=0,S){for(h.state=h.__s,h.__d=!1,P&&P(u),a=h.render(h.props,h.state,h.context),H=0;H<h._sb.length;H++)h.__h.push(h._sb[H]);h._sb=[]}else do{h.__d=!1,P&&P(u),a=h.render(h.props,h.state,h.context),h.state=h.__s}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=preact_module_d(preact_module_d({},i),h.getChildContext())),S&&!p&&null!=h.getSnapshotBeforeUpdate&&(_=h.getSnapshotBeforeUpdate(v,y)),L=a,null!=a&&a.type===k&&null==a.key&&(L=V(a.props.children)),f=I(n,preact_module_w(L)?L:[L],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),m&&(h.__E=h.__=null)}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f}else{for(T=o.length;T--;)g(o[T]);z(u)}else u.__e=t.__e,u.__k=t.__k,n.then||z(u);preact_module_l.__e(n,u,t)}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=q(t.__e,u,t,i,r,o,e,c,s);return(a=preact_module_l.diffed)&&a(u),128&u.__u?void 0:f}function z(n){n&&n.__c&&(n.__c.__e=!0),n&&n.__k&&n.__k.forEach(z)}function N(n,u,t){for(var i=0;i<t.length;i++)B(t[i],t[++i],t[++i]);preact_module_l.__c&&preact_module_l.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u)})}catch(n){preact_module_l.__e(n,u.__v)}})}function V(n){return"object"!=typeof n||null==n||n.__b&&n.__b>0?n:preact_module_w(n)?n.map(V):preact_module_d({},n)}function q(u,t,i,r,o,e,f,c,s){var a,h,v,y,d,_,m,b=i.props,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((d=e[a])&&"setAttribute"in d==!!x&&(x?d.localName==x:3==d.nodeType)){u=d,e[a]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(preact_module_l.__m&&preact_module_l.__m(t,e),c=!1),e=null}if(null==x)b===k||c&&u.data==k||(u.data=k);else{if(e=e&&preact_module_n.call(u.childNodes),b=i.props||preact_module_p,!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(d=u.attributes[a]).name]=d.value;for(a in b)if(d=b[a],"children"==a);else if("dangerouslySetInnerHTML"==a)v=d;else if(!(a in k)){if("value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k)continue;j(u,a,null,d,o)}for(a in k)d=k[a],"children"==a?y=d:"dangerouslySetInnerHTML"==a?h=d:"value"==a?_=d:"checked"==a?m=d:c&&"function"!=typeof d||b[a]===d||j(u,a,d,b[a],o);if(h)c||v&&(h.__html==v.__html||h.__html==u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),I("template"==t.type?u.content:u,preact_module_w(y)?y:[y],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&preact_module_S(i,0),c,s),null!=e)for(a=e.length;a--;)g(e[a]);c||(a="value","progress"==x&&null==_?u.removeAttribute("value"):null!=_&&(_!==u[a]||"progress"==x&&!_||"option"==x&&_!=b[a])&&j(u,a,_,b[a],o),a="checked",null!=m&&m!=u[a]&&j(u,a,m,b[a],o))}return u}function B(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u))}else n.current=u}catch(n){preact_module_l.__e(n,t)}}function D(n,u,t){var i,r;if(preact_module_l.unmount&&preact_module_l.unmount(n),(i=n.ref)&&(i.current&&i.current!=n.__e||B(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){preact_module_l.__e(n,u)}i.base=i.__P=null}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&D(i[r],u,t||"function"!=typeof n.type);t||g(n.__e),n.__c=n.__=n.__e=void 0}function E(n,l,u){return this.constructor(n,u)}function G(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),preact_module_l.__&&preact_module_l.__(u,t),o=(r="function"==typeof i)?null:i&&i.__k||t.__k,e=[],f=[],O(t,u=(!r&&i||t).__k=_(k,null,[u]),o||preact_module_p,preact_module_p,t.namespaceURI,!r&&i?[i]:o?null:t.firstChild?preact_module_n.call(t.childNodes):null,e,!r&&i?i:o?o.__e:t.firstChild,r,f),N(e,u,f)}function J(n,l){G(n,l,J)}function K(l,u,t){var i,r,o,e,f=preact_module_d({},l.props);for(o in l.type&&l.type.defaultProps&&(e=l.type.defaultProps),u)"key"==o?i=u[o]:"ref"==o?r=u[o]:f[o]=void 0===u[o]&&null!=e?e[o]:u[o];return arguments.length>2&&(f.children=arguments.length>3?preact_module_n.call(arguments,2):t),m(l.type,f,i||l.key,r||l.ref,null)}function Q(n){function l(n){var u,t;return this.getChildContext||(u=new Set,(t={})[l.__c]=this,this.getChildContext=function(){return t},this.componentWillUnmount=function(){u=null},this.shouldComponentUpdate=function(n){this.props.value!=n.value&&u.forEach(function(n){n.__e=!0,M(n)})},this.sub=function(n){u.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u&&u.delete(n),l&&l.call(n)}}),n.children}return l.__c="__cC"+preact_module_h++,l.__=n,l.Provider=l.__l=(l.Consumer=function(n,l){return n.children(l)}).contextType=l,l}preact_module_n=v.slice,preact_module_l={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l}throw n}},preact_module_u=0,preact_module_t=function(n){return null!=n&&null==n.constructor},x.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!=this.state?this.__s:this.__s=preact_module_d({},this.state),"function"==typeof n&&(n=n(preact_module_d({},u),this.props)),n&&preact_module_d(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),M(this))},x.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),M(this))},x.prototype.render=k,preact_module_i=[],preact_module_o="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,preact_module_e=function(n,l){return n.__v.__b-l.__v.__b},$.__r=0,preact_module_f=/(PointerCapture)$|Capture$/i,preact_module_c=0,preact_module_s=F(!1),preact_module_a=F(!0),preact_module_h=0;
//# sourceMappingURL=preact.module.js.map

;// ./node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var jsxRuntime_module_t=/["&<]/;function jsxRuntime_module_n(r){if(0===r.length||!1===jsxRuntime_module_t.test(r))return r;for(var e=0,n=0,o="",f="";n<r.length;n++){switch(r.charCodeAt(n)){case 34:f="&quot;";break;case 38:f="&amp;";break;case 60:f="&lt;";break;default:continue}n!==e&&(o+=r.slice(e,n)),o+=f,e=n+1}return n!==e&&(o+=r.slice(e,n)),o}var jsxRuntime_module_o=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,jsxRuntime_module_f=0,jsxRuntime_module_i=Array.isArray;function jsxRuntime_module_u(e,t,n,o,i,u){t||(t={});var a,c,p=t;if("ref"in p)for(c in p={},t)"ref"==c?a=t[c]:p[c]=t[c];var l={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--jsxRuntime_module_f,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a)void 0===p[c]&&(p[c]=a[c]);return preact_module_l.vnode&&preact_module_l.vnode(l),l}function jsxRuntime_module_a(r){var t=jsxRuntime_module_u(e,{tpl:r,exprs:[].slice.call(arguments,1)});return t.key=t.__v,t}var jsxRuntime_module_c={},jsxRuntime_module_p=/[A-Z]/g;function jsxRuntime_module_l(e,t){if(r.attr){var f=r.attr(e,t);if("string"==typeof f)return f}if(t=function(r){return null!==r&&"object"==typeof r&&"function"==typeof r.valueOf?r.valueOf():r}(t),"ref"===e||"key"===e)return"";if("style"===e&&"object"==typeof t){var i="";for(var u in t){var a=t[u];if(null!=a&&""!==a){var l="-"==u[0]?u:jsxRuntime_module_c[u]||(jsxRuntime_module_c[u]=u.replace(jsxRuntime_module_p,"-$&").toLowerCase()),s=";";"number"!=typeof a||l.startsWith("--")||jsxRuntime_module_o.test(l)||(s="px;"),i=i+l+":"+a+s}}return e+'="'+jsxRuntime_module_n(i)+'"'}return null==t||!1===t||"function"==typeof t||"object"==typeof t?"":!0===t?e:e+'="'+jsxRuntime_module_n(""+t)+'"'}function jsxRuntime_module_s(r){if(null==r||"boolean"==typeof r||"function"==typeof r)return null;if("object"==typeof r){if(void 0===r.constructor)return r;if(jsxRuntime_module_i(r)){for(var e=0;e<r.length;e++)r[e]=jsxRuntime_module_s(r[e]);return r}}return jsxRuntime_module_n(""+r)}
//# sourceMappingURL=jsxRuntime.module.js.map

;// ./htdocs/assets/js/translator/preact/Variable.tsx



/**
 * A simple pseudo-Mustache variable substitution. For example, given a
 * translated message like:
 *
 *     "Hello {{person}}"
 *
 * We'd parse that into a <Variable tagKey="person" args={...} /> which, when
 * rendered, would return the value of props.args["person"].
 *
 * Due to limitations of our current version of React/Preact, we must wrap the
 * value from the args in a <span>. Once we advance to a version that supports
 * fragments this will no longer be necessary.
 *
 * The "variable" and "tag key" nomenclature is copied from Mustache for
 * naming consistency (see: https://mustache.github.io/mustache.5.html).
 */
function Variable({
  tagKey,
  args
}) {
  const value = args[tagKey];

  if (value === undefined) {
    return null;
  }

  return jsxRuntime_module_u(k, {
    children: value
  });
}

/* harmony default export */ const preact_Variable = (Variable);
;// ./htdocs/assets/js/translator/mini-mustache/render/to-preact.tsx





const toElementTransformer = {
  visitTree: (children, _context) => jsxRuntime_module_u(k, {
    children: children
  }),
  visitBlock: (variable, children, context) => jsxRuntime_module_u(preact_Block, {
    tagKey: variable,
    args: context.args // eslint-disable-next-line react/no-children-prop
    ,
    children: children
  }, context.nextKey()),
  visitVariable: (variable, context) => jsxRuntime_module_u(preact_Variable, {
    tagKey: variable,
    args: context.args
  }, context.nextKey())
};
function to_preact_renderToPreact(tree, args) {
  let key = 1; // Transform from a parse tree into a Preact element tree, passing along the args to every
  // Block and Variable element via the transformer.

  return transform(tree, toElementTransformer, {
    args,
    nextKey: () => (key++).toString()
  });
}
;// ./htdocs/assets/js/translator/mini-mustache/render/to-string.ts

const toStringTransformer = {
  visitTree: (children, _data) => children.join(""),
  visitBlock: (variable, children, data) => data[variable] ? children.join("") : "",
  visitVariable: (variable, data) => {
    const value = data[variable];
    const truthy = value || value === 0;
    return truthy ? value.toString() : "";
  }
};
function to_string_renderToString(tree, data) {
  return transform(tree, toStringTransformer, data);
}
;// ./htdocs/assets/js/translator/native.tsx
/* eslint-disable react/jsx-filename-extension */





/**
 * Translate a string: returns the translated string. If you need to use
 * substitutions or interactive Preact elements then use `buildMsg()` instead.
 * Use `buildPluralMsg()` if you need pluralization.
 *
 *     const greeting = msg({
 *         content: "Hello world!",
 *         desc: "A greeting for our website",
 *     });
 *     greeting; // => "Hello world!"
 *
 */
function msg({
  content
}) {
  return content;
}

/**
 * Declare a translatable message. Returns a function that will return a string
 * of the translated content when called; an optional object of key-value pairs
 * can be passed to be formatted into the translation:
 *
 *     const greeting = buildMsg({
 *         content: "Hello, {{name}}!",
 *         desc: "A greeting for the user",
 *     });
 *     greeting(); // => "Hello, !"
 *     greeting({ name: "World" }); // => "Hello, World!"
 *
 * You can call `toComponent()` on the returned function to get a renderable
 * Preact component.
 *
 * Note that the `content` and `desc` combined identify the message, so
 * changing either will change the message's identity: this can cause it to be
 * rendered untranslated until new translations are completed.
 */
function buildMsg({
  content
}) {
  let tree = undefined; // Lazily parse and memoize the translation.

  const getTree = () => {
    if (tree === undefined) {
      tree = mini_mustache_parse(content);
    }

    return tree;
  };

  const translate = data => {
    return data === undefined ? content : to_string_renderToString(getTree(), data);
  };
  /**
   * Returns a Preact component to render the translation.
   *
   *     const Greeting = buildMsg({ ... }).toComponent();
   *     <span><Greeting args={{ name: "World" }} /></span>; // => <span>Hello, World!</span>
   *
   */


  translate.toComponent = () => function Msg({
    args
  }) {
    return to_preact_renderToPreact(getTree(), args ?? {});
  };

  return translate;
}

/**
 * Declare a plural translatable message. Returns a function that takes a
 * plural count as its first argument (and optional second argument of
 * key-value pairs for formatting); it will return the translated content in
 * the correct plural case for the current language.
 *
 * `toComponent` can be called on the returned function to get a Preact
 * component. That component requires a `pluralCount` prop in order to be able
 * to pick the correct plural translation.
 */
function buildPluralMsg(args) {
  // Users can only pass in BuildPluralMsgArgs themselves, but after Buildapack transformation
  // we can also receive translated contents which have a different shape.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const realArgs = args;
  const trees = new Map(); // Lazily parse and memoize translations.

  const getTree = content => {
    let tree = trees.get(content);

    if (tree === undefined) {
      tree = parse(content);
      trees.set(content, tree);
    }

    return tree;
  };

  const translate = (pluralCount, data) => {
    const translation = pickPluralCase(realArgs, pluralCount);
    return data === undefined ? translation : renderToString(getTree(translation), data);
  };
  /**
   * Returns a Preact component to render the translation.
   *
   *     const Greeting = buildPluralMsg({ ... }).toComponent();
   *     <Greeting pluralCount={2} args={{ count: 2 }} /> // => "2 widgets"
   *
   */


  translate.toComponent = () => {
    const Msg = ({
      pluralCount,
      args: msgArgs
    }) => {
      const translation = pickPluralCase(realArgs, pluralCount);
      return renderToPreact(getTree(translation), msgArgs ?? {});
    };

    Msg.displayName = "Msg";
    return Msg;
  };

  return translate;
}

function pickPluralCase(args, pluralCount) {
  if (isSourcePlural(args)) {
    return pluralCount === 1 ? args.content.one : args.content.many;
  }

  const [content, pluralForms] = args.content;
  return etsyMsg.pickPluralCase(content, pluralForms, pluralCount);
}
/** Detects whether or not we're getting the source content (rather than translations). */


function isSourcePlural(args) {
  return Object.prototype.hasOwnProperty.call(args.content, "one") && Object.prototype.hasOwnProperty.call(args.content, "many");
}
;// ./htdocs/assets/js/collage/web-components/internal/translations.ts
 // Used in CollageFormFieldElement, but git hooks throw an error about using
// private class fields. The translation git hooks run babel to lint files,
// and it uses a different babel config that hasn't been updated to match
// buildapack/buildavite babel config.

const characterCountMsg = buildMsg({
  content: "{{count}} of {{total}} characters.",
  desc: "Message shown next to an input for number of characters used and the number of maximum allowed characters",
  proj: "web toolkit"
});
const maxLengthExceededErrorMsg = buildMsg({
  content: "Character limit exceeded.",
  desc: "Error message shown next to an input when a form field's character count exceeds the max length allowed.",
  proj: "web toolkit"
});
const togglePasswordVisibilityMsg = buildMsg({
  content: "Toggle password visibility",
  desc: "Button text for action that toggles whether the password is visible in the input.",
  proj: "web toolkit"
});
const showInputPickerMsg = buildMsg({
  content: "Show picker",
  desc: "Button text for action that opens picker for the input.",
  proj: "web toolkit"
});
const emptyInputErrorMsg = msg({
  content: "This field is required.",
  desc: "Error message shown when a required form field is left empty.",
  proj: "web toolkit"
});
const chipRemovedAnnouncementMsg = buildMsg({
  content: "{{label}} removed",
  desc: "Message announced via A11y Announcer when a removeable chip is clicked and removed",
  proj: "web toolkit"
});
const removeAriaLabelMsg = buildMsg({
  content: "Remove {{label}}",
  desc: "aria label for a removable chip, with a dynamic label/text content, where the chip will be removed when clicked",
  proj: "web toolkit"
});
const loadingMsg = msg({
  content: "Loading",
  desc: "Provides a screen-reader description telling the user that there is a loading spinner",
  proj: "web toolkit"
});
;// ./htdocs/assets/js/collage/web-components/components/loading-spinner/clg-loading-spinner.ts



/**
 * @tagname clg-loading-spinner
 */

class ClgLoadingSpinner extends CollageElement {
  static template = clg_loading_spinner_mustache;
  /** Changes the presentation of the spinner to improve contrast against the specified background. */

  static properties = {
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    size: {
      type: String,
      reflect: true,
      converter: nonDefaultStringConverter("base")
    },
    label: {}
  };

  constructor() {
    super();
    this.backgroundType = "dynamic";
    this.size = "base";
    this.label = loadingMsg;
  }

  willUpdate(changed) {
    super.willUpdate(changed); // Ensure there's always a label, unless explicitly nullified

    this.label = this.label || loadingMsg;
  }

}
ClgLoadingSpinner.define("clg-loading-spinner");
;// ./htdocs/assets/js/collage/web-components/internal/forward-clicks-in-tests.ts
/**
 * Ensures that if the provided element is used with `userEvent.click()`
 * that the target is also clicked.
 * `userEvent.click()` trigger the shadow button click.
 *
 * If the target is in the composedPath, then it doesn't do anything.
 * If not, it clicks the element, then stops propagation so event listeners
 * don't fire repeatedly.
 */
function forwardClicksInTests(element, getTarget) {
  if (false) {}
}
;// ./htdocs/assets/js/collage/web-components/reactive-controllers/LoadingButtonController.ts


class LoadingButtonController {
  host;
  getTarget;
  #wasLoading = false;
  #isFocused = false;

  constructor(host, getTarget) {
    (this.host = host).addController(this);
    this.getTarget = getTarget;
  }

  async hostConnected() {
    try {
      await this.host.updateComplete;
      const target = this.getTarget();
      target?.addEventListener("focus", this.#handleFocus);
      target?.addEventListener("blur", this.#handleBlur);
      target?.addEventListener("click", this.#handleClick); // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {// If the host errors and we then try to await its `updateComplete`
      // it could throw again. We just want to quietly bail in that case.
    }
  }

  hostDisconnected() {
    const target = this.getTarget();
    target?.removeEventListener("focus", this.#handleFocus);
    target?.removeEventListener("blur", this.#handleBlur);
    target?.removeEventListener("click", this.#handleClick);
  }

  hostUpdated() {
    if (this.host.loading !== this.#wasLoading) {
      if (!this.#wasLoading && this.#isFocused && this.host.loading) {
        announce(loadingMsg, "assertive");
      }

      this.#wasLoading = Boolean(this.host.loading);
    }
  }

  #handleFocus = () => {
    this.#isFocused = true;
  };
  #handleBlur = () => {
    this.#isFocused = false;
  };
  #handleClick = e => {
    if (this.host.loading) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
}
;// ./htdocs/assets/js/collage/web-components/components/button/clg-button.ts







/**
 * @tagname clg-button
 *
 * @dependency clg-loading-spinner
 *
 * @slot - button content
 * @slot submit-input - An `input[type="submit"]` to support form submission without JS. Must be used with `withSubmit`.
 */

class ClgButton extends AnchorOrButtonMixin(CollageElement) {
  static template = clg_button_mustache;
  static validators = {
    variant: required
  };
  static formAssociated = true;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    name: {
      type: String
    },
    value: {
      type: String
    },
    size: {
      type: String,
      reflect: true
    },
    loading: {
      type: Boolean,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    withSubmit: {
      type: Boolean,
      reflect: true,
      attribute: "with-submit"
    },
    withrefresh: {
      type: Boolean,
      reflect: true
    },
    // All of these properties are reflecting real properties + attribute counterparts

    /* eslint-disable etsy-rules/lit-attribute-names */
    formAction: {
      attribute: "formaction"
    },
    formEnctype: {
      attribute: "formenctype"
    },
    formNoValidate: {
      attribute: "formnovalidate",
      type: Boolean
    },
    formTarget: {
      attribute: "formtarget"
    },
    formMethod: {
      attribute: "formmethod"
    }
    /* eslint-enable etsy-rules/lit-attribute-names */

  };
  /**
   * Visual look of the button
   * @required
   */

  #internals = this.attachInternals();
  static delegatedEvents = ["pointerup", "click"];

  constructor() {
    super();
    this.size = "base";
    this.loading = false;
    this.backgroundType = "dynamic";
    this.withrefresh = false;
    this.disabled = false;
    new LoadingButtonController(this, () => this.#button);
    forwardClicksInTests(this, () => this.#button);
  }

  get #button() {
    return this.shadowRoot?.querySelector("[data-button-root]");
  }

  get _button() {
    return this.#button;
  }

  connectedCallback() {
    super.connectedCallback(); // Dark mode (only for checkout and sign in flows)
    // If we are in dark mode, add attribute backgroundType="dark" for styling

    if (document.body.getAttribute("data-clg-mode") === "dark") {
      this.backgroundType = "dark";
      this.withrefresh = false;
    }
  }

  firstUpdated(changed) {
    super.firstUpdated(changed); // If using withSubmit and submit-input for form submission without JS,
    // revert to our regular <button> element.
    // IMPORTANT: without onDOMReady, this causes a flash of empty space
    // in Safari (as of iOS/MacOS 26.2)

    onDOMReady(() => {
      const oldRoot = this.#button;

      if (this.withSubmit && oldRoot && oldRoot.tagName.toLowerCase() !== "button") {
        const newRoot = document.createElement("button");

        for (const {
          name,
          value
        } of Array.from(oldRoot.attributes)) {
          newRoot.setAttribute(name, value);
        }

        while (oldRoot.firstChild) {
          newRoot.appendChild(oldRoot.firstChild);
        }

        oldRoot.replaceWith(newRoot);
        newRoot.querySelector("#content")?.removeAttribute("aria-hidden");
        this.querySelector('input[slot="submit-input"]')?.remove(); // Using in CSS to hide the slot, just in case

        this.setAttribute("hydrated", "");
      }
    });
  }
  /** @internal */


  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    if (intention === "RELEASE") {
      // A JS workaround to get a separate "release" animation from "unhover"
      this.#button?.toggleAttribute("data-released", true);
      setTimeout(() => {
        this.#button?.toggleAttribute("data-released", false);
      }, 200);
    }

    if (intention === "CLICK") {
      this.#handleClick(e);
    }
  }

  #handleClick = event => {
    // Prevent disabled and loading buttons from being clicked
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const form = this.#internals.form;
    if (!form || this.href) return;
    const button = document.createElement("button");

    for (const attribute of this.attributes) {
      if (attribute.name === "style") {
        // Skip style attributes as they *shouldn't* be necessary
        continue;
      }

      button.setAttribute(attribute.name, attribute.value);
    }

    button.type = this.type || "button";
    button.style.position = "absolute";
    button.style.width = "0";
    button.style.height = "0";
    button.style.clipPath = "inset(50%)";
    button.style.overflow = "hidden";
    button.style.whiteSpace = "nowrap";

    if (this.name) {
      button.name = this.name;
    }

    button.value = this.value || "";
    form.append(button);
    button.click();
    button.remove();
  };

  focus(opts) {
    if (this.#button) {
      this.#button.focus(opts);
    } else {
      this.updateComplete.then(() => {
        this.#button?.focus(opts);
      });
    }
  }

  blur() {
    if (this.#button) {
      this.#button.blur();
    } else {
      this.updateComplete.then(() => {
        this.#button?.blur();
      });
    }
  }

  click() {
    if (this.#button) {
      this.#button.click();
    } else {
      this.updateComplete.then(() => {
        this.#button?.click();
      });
    }
  }

}
ClgButton.define("clg-button");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-icon-button.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_icon_button_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<button class=\"clg-icon-button\" type=\"button\" ");if(t.s(t.f("disabled",c,p,1),c,p,0,59,67,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :disabled ");if(t.s(t.f("label",c,p,1),c,p,0,101,123,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-label=\"");t.b(t.v(t.f("label",c,p,0)));t.b("\"");});c.pop();}t.b(" :aria-label=\"label\">");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("</button>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_icon_button_mustache_tmpl.name = "collage/clg-icon-button.mustache";
(hogan_default()).partialsMap[clg_icon_button_mustache_tmpl.name] = clg_icon_button_mustache_tmpl;

const clg_icon_button_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_icon_button_mustache_tmpl.render.call(clg_icon_button_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_icon_button_mustache_render.template = clg_icon_button_mustache_tmpl;
/* harmony default export */ const clg_icon_button_mustache = (clg_icon_button_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/icon-button/clg-icon-button.ts



/**
 * @tagname clg-icon-button
 *
 * @slot - The icon to display in the button
 */

class ClgIconButton extends CollageElement {
  static template = clg_icon_button_mustache;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    variant: required
  };
  static properties = {
    label: {},
    variant: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    }
  };
  /** Label that describes the button's action */

  get #button() {
    return this.renderRoot.querySelector(".clg-icon-button");
  }

  constructor() {
    super();
    this.size = "base";
    this.disabled = false;
    this.backgroundType = "dynamic";
    forwardClicksInTests(this, () => this.#button);
  }

}
ClgIconButton.define("clg-icon-button");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-list.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_list_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-list\">");t.b("\n" + i);t.b("    <div class=\"clg-list__label\"><slot name=\"title\"></slot></div>");t.b("\n" + i);t.b("    <div class=\"clg-list__content\"><slot x-on:slotchange=\"SLOT_OCCUPIED\"></slot></div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_list_mustache_tmpl.name = "collage/clg-list.mustache";
(hogan_default()).partialsMap[clg_list_mustache_tmpl.name] = clg_list_mustache_tmpl;

const clg_list_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_list_mustache_tmpl.render.call(clg_list_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_list_mustache_render.template = clg_list_mustache_tmpl;
/* harmony default export */ const clg_list_mustache = (clg_list_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/list/clg-list.ts



/**
 * @tagname clg-list
 *
 * @slot title - list title
 * @slot - list content
 */

class ClgList extends CollageElement {
  static template = clg_list_mustache;
  static delegatedEvents = ["slotchange"];
  static validators = {
    [DEFAULT_SLOT]: {
      slot(slot) {
        const assignedElements = slot?.assignedElements() ?? [];

        if (assignedElements.some(el => el.localName !== "clg-list-item")) {
          return "clg-list only accepts clg-list-item elements as children";
        }

        return null;
      }

    }
  };
  static properties = {
    label: {
      type: String,
      reflect: true
    },
    noDivider: {
      type: Boolean,
      reflect: true,
      attribute: "no-divider"
    },
    size: {
      type: String,
      reflect: true
    }
  };
  /** Accessible label for the button group */

  constructor() {
    super();
    this.noDivider = false;
    this.size = "base";
  }

  #getItems() {
    return Array.from(this.querySelectorAll("clg-list-item"));
  }

  #syncItemDividers() {
    const items = this.#getItems();

    for (const item of items) {
      toggleStringAttribute(item, "no-divider", this.noDivider ? "true" : undefined);
    }
  }
  /** Validate the list items are only clg-list-item children */


  #validateListItems() {
    if (false) {}
    const invalidListItems = [...this.children].filter(el => {
      if (el.getAttribute("slot") === "title") return false;
      return el.tagName.toLowerCase() !== "clg-list-item";
    });

    if (invalidListItems.length > 0) {
      throw new TypeError(`clg-list only accepts clg-list-item children. Found: ${invalidListItems.length}`);
    }
  }

  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    if (intention === "SLOT_OCCUPIED") {
      this.#validateListItems();
      this.#syncItemDividers();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "list");
  }

  update(changed) {
    super.update(changed);

    if (changed.has("label")) {
      toggleStringAttribute(this, "aria-label", this.label);
    }

    if (changed.has("noDivider")) {
      this.#syncItemDividers();
    }
  }

}
ClgList.define("clg-list");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-list-item.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_list_item_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-list-item\">");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_list_item_mustache_tmpl.name = "collage/clg-list-item.mustache";
(hogan_default()).partialsMap[clg_list_item_mustache_tmpl.name] = clg_list_item_mustache_tmpl;

const clg_list_item_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_list_item_mustache_tmpl.render.call(clg_list_item_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_list_item_mustache_render.template = clg_list_item_mustache_tmpl;
/* harmony default export */ const clg_list_item_mustache = (clg_list_item_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/list/clg-list-item.ts


/**
 * @tagname clg-list-item
 *
 * @slot - list content
 */

class ClgListItem extends CollageElement {
  static template = clg_list_item_mustache;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "listitem");
  }

}
ClgListItem.define("clg-list-item");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-text-button.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_text_button_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<button class=\"clg-text-button\" ");if(t.s(t.f("type",c,p,1),c,p,0,41,56,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("type=\"");t.b(t.v(t.f("type",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,79,116,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled aria-disabled=\"");t.b(t.v(t.f("disabled",c,p,0)));t.b("\"");});c.pop();}t.b(" :type :disabled>");t.b("\n" + i);t.b("  <span id=\"content\" class=\"clg-text-button__content\">");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("  </span>");t.b("\n" + i);t.b("  <span id=\"spinner-frame\" class=\"clg-text-button__spinner-frame\" ");if(!t.s(t.f("loading",c,p,1),c,p,1,0,0,"")){t.b("hidden");};t.b(" x-show=\"loading\">");t.b("\n" + i);t.b("    <span class=\"clg-text-button__spinner-frame__light-spinner\"><clg-loading-spinner background-type=\"dark\"></clg-loading-spinner></span>");t.b("\n" + i);t.b("    <span class=\"clg-text-button__spinner-frame__dark-spinner\"><clg-loading-spinner></clg-loading-spinner></span>");t.b("\n" + i);t.b("  </span>");t.b("\n" + i);t.b("</button>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_text_button_mustache_tmpl.name = "collage/clg-text-button.mustache";
(hogan_default()).partialsMap[clg_text_button_mustache_tmpl.name] = clg_text_button_mustache_tmpl;

const clg_text_button_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_text_button_mustache_tmpl.render.call(clg_text_button_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_text_button_mustache_render.template = clg_text_button_mustache_tmpl;
/* harmony default export */ const clg_text_button_mustache = (clg_text_button_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/text-button/clg-text-button.ts





/**
 * @tagname clg-text-button
 *
 * @slot - Button content
 * @dependency clg-loading-spinner
 */

class ClgTextButton extends CollageElement {
  static template = clg_text_button_mustache;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    variant: required
  };
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    underline: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    loading: {
      type: Boolean,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    padding: {
      type: Boolean,
      reflect: true
    },
    flush: {
      type: String,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    type: {
      type: String,
      reflect: true
    },
    value: {
      type: String
    }
  };
  static delegatedEvents = ["click"];
  /**
   * Visual look of the text button
   * @required
   */

  get #button() {
    return this.renderRoot.querySelector(".clg-text-button");
  }

  click() {
    this.#button?.click();
  }

  focus(options) {
    this.#button?.focus(options);
  }

  blur() {
    this.#button?.blur();
  }

  constructor() {
    super();
    this.type = "button";
    this.underline = false;
    this.size = "base";
    this.padding = false;
    this.disabled = false;
    new LoadingButtonController(this, () => this.#button);
    forwardClicksInTests(this, () => this.#button);
  }

}
ClgTextButton.define("clg-text-button");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-favorite-button.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_favorite_button_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<button type=\"button\"");t.b("\n" + i);t.b(" class=\"clg-favorite-button\"");t.b("\n" + i);t.b(" aria-pressed=\"");if(t.s(t.f("selected",c,p,1),c,p,0,79,83,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("true");});c.pop();}if(!t.s(t.f("selected",c,p,1),c,p,1,0,0,"")){t.b("false");};t.b("\"");t.b("\n" + i);t.b(">");t.b("\n" + i);t.b("    <span class=\"clg-favorite-button__unselected-text clg-screen-reader-only\">");t.b(t.v(t.d("messages.add_to_favorites",c,p,0)));if(!t.s(t.d("messages.add_to_favorites",c,p,1),c,p,1,0,0,"")){t.b("Add to favorites");};t.b("</span>");t.b("\n" + i);t.b("    <span class=\"clg-favorite-button__selected-text clg-screen-reader-only\">");t.b(t.v(t.d("messages.remove_from_favorites",c,p,0)));if(!t.s(t.d("messages.remove_from_favorites",c,p,1),c,p,1,0,0,"")){t.b("Added to favorites. Remove?");};t.b("</span>");t.b("\n" + i);t.b("    <clg-icon name=\"");if(t.s(t.f("selected",c,p,1),c,p,0,570,580,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("heart_fill");});c.pop();}if(!t.s(t.f("selected",c,p,1),c,p,1,0,0,"")){t.b("heart");};t.b("\" aria-hidden=\"true\" ></clg-icon>");t.b("\n" + i);t.b("</button>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_favorite_button_mustache_tmpl.name = "collage/clg-favorite-button.mustache";
(hogan_default()).partialsMap[clg_favorite_button_mustache_tmpl.name] = clg_favorite_button_mustache_tmpl;

const clg_favorite_button_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_favorite_button_mustache_tmpl.render.call(clg_favorite_button_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_favorite_button_mustache_render.template = clg_favorite_button_mustache_tmpl;
/* harmony default export */ const clg_favorite_button_mustache = (clg_favorite_button_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-icon.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_icon_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b(t.v(t.f("svg",c,p,0)));t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_icon_mustache_tmpl.name = "collage/clg-icon.mustache";
(hogan_default()).partialsMap[clg_icon_mustache_tmpl.name] = clg_icon_mustache_tmpl;

const clg_icon_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_icon_mustache_tmpl.render.call(clg_icon_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_icon_mustache_render.template = clg_icon_mustache_tmpl;
/* harmony default export */ const clg_icon_mustache = (clg_icon_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/icon/clg-icon.ts




/**
 * @tagname clg-icon
 */
class ClgIcon extends ClgBaseIcon {
  static template = clg_icon_mustache;
  static properties = {
    size: {
      type: String,
      reflect: true,
      converter: nonDefaultStringConverter("base")
    }
  };
  /**
   * The name of the icon to draw.
   * @required
   */

  constructor() {
    super();
    this.size = "base";
  }

  getIconUrl(name) {
    return this.getBasePath(`core/${name}.svg`);
  }

  get root() {
    return this.shadowRoot;
  }

}
ClgIcon.define("clg-icon");
;// ./htdocs/assets/js/collage/web-components/components/favorite-button/clg-favorite-button.ts



/**
 * @tagname clg-favorite-button
 * @summary A button to favorite an item, represented by a heart icon.
 * @dependency clg-icon
 */

class ClgFavoriteButton extends CollageElement {
  static template = clg_favorite_button_mustache;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static properties = {
    selected: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    }
  };
  /** Visual look of the button on different surfaces */

  constructor() {
    super();
    this.backgroundType = "dynamic";
    this.selected = false;
    this.size = "base";
  }

  update(changed) {
    super.update(changed);
    const icon = this.shadowRoot?.querySelector("clg-icon");

    if (icon) {
      icon.name = this.selected ? "heart_fill" : "heart";
    }

    const btn = this.shadowRoot?.querySelector("button");

    if (btn) {
      btn.setAttribute("aria-pressed", String(this.selected));
    }
  }

}
ClgFavoriteButton.define("clg-favorite-button");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-logo-button.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_logo_button_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<button class=\"clg-logo-button\" data-logo-button-root ");if(t.s(t.f("disabled",c,p,1),c,p,0,67,76,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled ");});c.pop();}t.b("\n" + i);t.b("    :disabled :type x-on:click=\"CLICK\">");t.b("\n" + i);t.b("    <span id=\"content\" class=\"clg-logo-button__content\">");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("        <clg-logo name=\"applepay_v2\" class=\"clg-logo-button__apple-pay\"></clg-logo>");t.b("\n" + i);t.b("        <clg-logo name=\"googlepaycard_v2\" class=\"clg-logo-button__google-pay\"></clg-logo>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("    <span id=\"spinner-frame\" class=\"clg-logo-button__spinner-frame\" ");if(!t.s(t.f("loading",c,p,1),c,p,1,0,0,"")){t.b("hidden");};t.b(" x-show=\"loading\">");t.b("\n" + i);t.b("        <clg-loading-spinner class=\"clg-logo-button__spinner--default\"></clg-loading-spinner>");t.b("\n" + i);t.b("        <clg-loading-spinner background-type=\"dark\" class=\"clg-logo-button__spinner--light\"></clg-loading-spinner>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("</button>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_logo_button_mustache_tmpl.name = "collage/clg-logo-button.mustache";
(hogan_default()).partialsMap[clg_logo_button_mustache_tmpl.name] = clg_logo_button_mustache_tmpl;

const clg_logo_button_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_logo_button_mustache_tmpl.render.call(clg_logo_button_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_logo_button_mustache_render.template = clg_logo_button_mustache_tmpl;
/* harmony default export */ const clg_logo_button_mustache = (clg_logo_button_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-logo.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_logo_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b(t.v(t.f("svg",c,p,0)));t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_logo_mustache_tmpl.name = "collage/clg-logo.mustache";
(hogan_default()).partialsMap[clg_logo_mustache_tmpl.name] = clg_logo_mustache_tmpl;

const clg_logo_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_logo_mustache_tmpl.render.call(clg_logo_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_logo_mustache_render.template = clg_logo_mustache_tmpl;
/* harmony default export */ const clg_logo_mustache = (clg_logo_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/logo/clg-logo.ts



/**
 * @tagname clg-logo
 *
 * @cssproperty --clg-logo-svg-height - Sets the height of the svg.
 * @cssproperty --clg-logo-svg-width - Sets the width of the svg.
 */
class ClgLogo extends ClgBaseIcon {
  static template = clg_logo_mustache;
  /**
   * The name of the icon to draw.
   * @required
   */

  getIconUrl(name) {
    return this.getBasePath(`logo/${name}.svg`);
  }

  get root() {
    return this.shadowRoot;
  }

}
ClgLogo.define("clg-logo");
;// ./htdocs/assets/js/collage/web-components/components/logo-button/clg-logo-button.ts






/**
 * @tagname clg-logo-button
 * @summary A button with a logo icon, used for sign-in and payment options.
 *
 * @dependency clg-loading-spinner
 * @dependency clg-logo
 *
 * @slot - button content
 */

class ClgLogoButton extends CollageElement {
  static template = clg_logo_button_mustache;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    variant: required
  };
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    name: {
      type: String,
      reflect: true
    },
    value: {
      type: String,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    loading: {
      type: Boolean,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    type: {
      type: String,
      reflect: true
    }
  };
  /**
   * Visual look of the button
   * @required
   */

  static delegatedEvents = ["click"];

  constructor() {
    super();
    this.disabled = false;
    this.loading = false;
    this.backgroundType = "dynamic";
    this.type = "button";
    this.value = "";
    new LoadingButtonController(this, () => this.#button);
    forwardClicksInTests(this, () => this.#button);
  }

  get #button() {
    return this.shadowRoot?.querySelector("[data-logo-button-root]");
  }

  connectedCallback() {
    super.connectedCallback(); // Dark mode (only for checkout and sign in flows)
    // If we are in dark mode, add attribute backgroundType="dark" for styling

    if (document.body.getAttribute("data-clg-mode") === "dark") {
      this.setAttribute("background-type", "dark");
    }
  }

  focus(opts) {
    if (this.#button) {
      this.#button.focus(opts);
    } else {
      this.updateComplete.then(() => {
        this.#button?.focus(opts);
      });
    }
  }

  blur() {
    if (this.#button) {
      this.#button.blur();
    } else {
      this.updateComplete.then(() => {
        this.#button?.blur();
      });
    }
  }

  click() {
    if (this.#button) {
      this.#button.click();
    } else {
      this.updateComplete.then(() => {
        this.#button?.click();
      });
    }
  }

}
ClgLogoButton.define("clg-logo-button");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-button-group.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_button_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div role='group' class=\"clg-button-group\" ");if(t.s(t.f("orientation",c,p,1),c,p,0,59,89,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("orientation=\"");t.b(t.v(t.f("orientation",c,p,0)));t.b("\" ");});c.pop();}t.b(">");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_button_group_mustache_tmpl.name = "collage/clg-button-group.mustache";
(hogan_default()).partialsMap[clg_button_group_mustache_tmpl.name] = clg_button_group_mustache_tmpl;

const clg_button_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_button_group_mustache_tmpl.render.call(clg_button_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_button_group_mustache_render.template = clg_button_group_mustache_tmpl;
/* harmony default export */ const clg_button_group_mustache = (clg_button_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/button-group/clg-button-group.ts


/**
 * @tagname clg-button-group
 *
 * @slot - button group content
 */

class ClgButtonGroup extends CollageElement {
  static template = clg_button_group_mustache;
  static validators = {
    orientation: required
  };
  static properties = {
    label: {
      type: String,
      reflect: true
    },
    orientation: {
      type: String,
      reflect: true
    }
  };
  /**
   * Sets direction of button group
   * @required
   */

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "group");
  }

  update(changed) {
    super.update(changed);

    if (changed.has("orientation")) {
      this.setAttribute("aria-orientation", this.orientation);
    }

    if (changed.has("label")) {
      if (this.label) {
        this.setAttribute("aria-label", this.label);
      } else {
        this.removeAttribute("aria-label");
      }
    }
  }

}
ClgButtonGroup.define("clg-button-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-anchored-button-group.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_anchored_button_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div role='group' class=\"clg-anchored-button-group\" ");t.b("\n" + i);t.b("    ");if(t.s(t.f("orientation",c,p,1),c,p,0,73,107,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-orientation=\"");t.b(t.v(t.f("orientation",c,p,0)));t.b("\"");});c.pop();}t.b(" ");t.b("\n" + i);t.b("    :aria-orientation=\"orientation\"");t.b("\n" + i);t.b("    ");if(t.s(t.f("label",c,p,1),c,p,0,175,197,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-label=\"");t.b(t.v(t.f("label",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("    :aria-label=\"label\">");t.b("\n" + i);t.b("    <slot name=\"top\"></slot>");t.b("\n" + i);t.b("    <div class=\"clg-anchored-button-group__buttons\">");t.b("\n" + i);t.b("        <div class=\"clg-anchored-button-group__buttons__primary\">");t.b("\n" + i);t.b("            <slot name=\"primary\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-anchored-button-group__buttons__secondary\">");t.b("\n" + i);t.b("            <slot name=\"secondary\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-anchored-button-group__buttons__tertiary\">");t.b("\n" + i);t.b("            <slot name=\"tertiary\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <slot name=\"bottom\"></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_anchored_button_group_mustache_tmpl.name = "collage/clg-anchored-button-group.mustache";
(hogan_default()).partialsMap[clg_anchored_button_group_mustache_tmpl.name] = clg_anchored_button_group_mustache_tmpl;

const clg_anchored_button_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_anchored_button_group_mustache_tmpl.render.call(clg_anchored_button_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_anchored_button_group_mustache_render.template = clg_anchored_button_group_mustache_tmpl;
/* harmony default export */ const clg_anchored_button_group_mustache = (clg_anchored_button_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/button-group/clg-anchored-button-group.ts


/**
 * @tagname clg-anchored-button-group
 *
 * @description An anchored button group is a group of buttons that are anchored at the bottom of a container (usually a sheet or dialog).
 * @slot primary - Buttons placed in the primary actions area of the button group. These buttons are placed to the far right in horizontal orientation and at the top in vertical orientation.
 * @slot secondary - Buttons placed in the secondary actions area of the button group. These buttons are placed alongside the primary buttons in horizontal orientation and second from top in vertical orientation.
 * @slot tertiary - Buttons placed in the tertiary actions area of the button group. These buttons are placed to the far left in horizontal orientation and bottom in vertical orientation.
 * @slot top - Content placed at the top of the button group. This slot is optional.
 * @slot bottom - Content placed at the bottom of the button group. This slot is optional.
 *
 * @example
 * <clg-anchored-button-group orientation="horizontal">
 *     <clg-button slot="primary" style="width: 100%;" variant="primary">Primary</clg-button>
 *     <clg-button slot="secondary" style="width: 100%;" variant="secondary">Secondary</clg-button>
 *     <clg-text-button slot="tertiary" style="width: 100%;" variant="secondary">Tertiary</clg-text-button>
 * </clg-anchored-button-group>
 */

class ClgAnchoredButtonGroup extends CollageElement {
  static template = clg_anchored_button_group_mustache;
  static validators = {
    orientation: required
  };
  static properties = {
    label: {
      type: String,
      reflect: true
    },
    orientation: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    divider: {
      type: Boolean,
      reflect: true
    }
  };
  /**
   * Sets direction of anchored button group
   * @required
   */

  constructor() {
    super();
    this.size = "base";
    this.orientation = "vertical";
  }

  #getButtons() {
    return Array.from(this.querySelectorAll("clg-button, clg-text-button, clg-icon-button"));
  }

  #syncSize() {
    const buttons = this.#getButtons();
    if (buttons.length === 0) return;
    const size = this.size;
    if (!size) return;

    for (const button of buttons) {
      button.setAttribute("size", size);
    }
  }

  update(changed) {
    super.update(changed);
    this.#syncSize();
  }

}
ClgAnchoredButtonGroup.define("clg-anchored-button-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-brand-icon.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_brand_icon_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-brand-icon\">");t.b(t.v(t.f("svg",c,p,0)));t.b("</span>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_brand_icon_mustache_tmpl.name = "collage/clg-brand-icon.mustache";
(hogan_default()).partialsMap[clg_brand_icon_mustache_tmpl.name] = clg_brand_icon_mustache_tmpl;

const clg_brand_icon_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_brand_icon_mustache_tmpl.render.call(clg_brand_icon_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_brand_icon_mustache_render.template = clg_brand_icon_mustache_tmpl;
/* harmony default export */ const clg_brand_icon_mustache = (clg_brand_icon_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/icon/clg-brand-icon.ts




/**
 * @tagname clg-brand-icon
 */
class ClgBrandIcon extends ClgBaseIcon {
  static template = clg_brand_icon_mustache;
  static properties = {
    size: {
      type: String,
      reflect: true,
      converter: nonDefaultStringConverter("base")
    },
    variant: {
      type: String,
      reflect: true,
      converter: nonDefaultStringConverter("base")
    }
  };
  /**
   * Size of the icon
   */

  getIconUrl(name) {
    return this.getBasePath(`brand/${name}.svg`);
  }

  get root() {
    return this.shadowRoot?.querySelector(".clg-brand-icon");
  }

  constructor() {
    super();
    this.size = "base";
    this.variant = "base";
  }

}
ClgBrandIcon.define("clg-brand-icon");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-shape.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_shape_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b(t.v(t.f("svg",c,p,0)));return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_shape_mustache_tmpl.name = "collage/clg-shape.mustache";
(hogan_default()).partialsMap[clg_shape_mustache_tmpl.name] = clg_shape_mustache_tmpl;

const clg_shape_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_shape_mustache_tmpl.render.call(clg_shape_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_shape_mustache_render.template = clg_shape_mustache_tmpl;
/* harmony default export */ const clg_shape_mustache = (clg_shape_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/shape/clg-shape.ts



/**
 * @tagname clg-shape
 */
class ClgShape extends ClgBaseIcon {
  static template = clg_shape_mustache;
  static properties = {
    size: {
      type: String,
      reflect: true
    }
  };
  /**
   * The name of the shape to draw.
   * @required
   */

  constructor() {
    super();
    this.size = "base";
  }

  getIconUrl(name) {
    return this.getBasePath(`shapes/${name}.svg`);
  }

  get root() {
    return this.shadowRoot;
  }

  firstUpdated(changed) {
    super.firstUpdated(changed);
    this.shadowRoot?.querySelector("svg")?.setAttribute("aria-hidden", "true");
  }

}
ClgShape.define("clg-shape");
;// ./htdocs/assets/js/collage/web-components/internal/CollageFormElement.ts


class CollageFormElement extends CollageElement {
  static formAssociated = true;
  internals;
  /** Sets whether the control is usable and clickable */

  static properties = {
    disabled: {
      type: Boolean,
      reflect: true
    },
    error: {
      type: String
    },
    name: {
      type: String,
      reflect: true,
      converter: nonEmptyStringConverter
    },
    validationMessage: {
      type: String,
      state: true
    },
    invalid: {
      type: Boolean,
      reflect: true,
      attribute: "invalid"
    },
    label: {
      type: String
    },
    caption: {
      type: String
    },
    helperText: {
      type: String,
      attribute: "helper-text"
    },
    withCaption: {
      type: Boolean,
      reflect: true,
      attribute: "with-caption"
    },
    withHelperText: {
      type: Boolean,
      reflect: true,
      attribute: "with-helper-text"
    },
    hideLabel: {
      type: Boolean,
      attribute: "hide-label",
      reflect: true
    },
    hideHelperText: {
      type: Boolean,
      attribute: "hide-helper-text",
      reflect: true
    }
  };

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.helperText = "";
    this.caption = "";
    this.disabled = false;
    this.error = "";
    this.invalid = false;
    this.validationMessage = "";
    this.name = "";
    this.withCaption = false;
    this.withHelperText = false;
    this.hideLabel = false;
    this.hideHelperText = false;
  }
  /** Flag tracking whether the user has interacted with the form element */


  touched = false;
  /**
   * Flag to track whether `checkValidity()` is being called.
   * `checkValidity()` automatically fires the `invalid` event, which
   * can cause our custom error display to show, since the `invalid`
   * event also fires when a form submits. The purpose of `checkValidity()`
   * is to be able to "silently" check the validity state, so we use this flag
   * to make sure we don't show the error state when `checkValidity()` is called.
   */

  #checkingValidity = false;

  willUpdate(changed) {
    super.willUpdate(changed);

    if (this.error && this.error.length > 0) {
      this.invalid = true;
      this.validationMessage = this.error;
    }

    if (!this.hasSlotContent("helper-text")) {
      this.withHelperText = Boolean(this.helperText && this.helperText.length > 0);
    }

    if (!this.hasSlotContent("caption")) {
      this.withCaption = Boolean(this.caption && this.caption.length > 0);
    }
  }

  connectedCallback() {
    super.connectedCallback();

    const handleSlotChange = e => {
      const target = e.target;
      if (!(target instanceof HTMLSlotElement)) return;

      if (target.name === "helper-text") {
        this.withHelperText = this.hasSlotContent("helper-text");
      }

      if (target.name === "caption") {
        this.withCaption = this.hasSlotContent("caption");
      }
    };

    this.shadowRoot?.addEventListener("slotchange", handleSlotChange);

    const handleInvalidEvent = e => {
      if (!this.#checkingValidity) {
        this.invalid = true;
        this.touched = true;
      } // Use to prevent showing browser tooltip
      // Also prevents focusing the input, so we'll need to handle that too


      e.preventDefault();
      this.#checkingValidity = false;
    }; // eslint-disable-next-line wc/require-listener-teardown


    this.addEventListener("invalid", handleInvalidEvent);
    this.onDisconnect(() => {
      this.removeEventListener("invalid", handleInvalidEvent);
      this.shadowRoot?.removeEventListener("slotchange", handleSlotChange);
    });
  }
  /**
   * Syncs the form control's validity with the internal input's validity.
   * Subclasses MUST call this whenever the value property changes.
   *
   * @example
   * ```ts
   * updated(changed: PropertyValues) {
   *     if (changed.has('value')) {
   *         this.updateValidity()
   *     }
   * }
   * ```
   */


  validate() {
    const {
      flags,
      message,
      anchor
    } = this.getValidity();
    this.internals.setValidity(flags, message, anchor);
    return this.checkValidity();
  }
  /** The value set via `setCustomValidity`. */


  customValidityMessage = "";
  /** The current validity state of the control. */

  get validity() {
    return this.internals.validity;
  }
  /** Returns true if the control will be validated when its form is submitted. */


  get willValidate() {
    return this.internals.willValidate;
  }
  /**
   * Checks if the form control has any restraints and whether it satisfies
   * them. If invalid, `false` will be returned and the `invalid` event will
   * be dispatched. If valid, `true` will be returned.
   */


  checkValidity() {
    this.#checkingValidity = true;
    return this.internals.checkValidity();
  }
  /** Returns the form owner of this element */


  get form() {
    return this.internals.form;
  }
  /**
   * Sets a custom validation message for the form control. If this message
   * is not an empty string, then the form control is considered invalid and
   * the specified message will be displayed to the user when reporting
   * validity. Setting an empty string clears the custom validity state.
   */


  setCustomValidity(message) {
    this.customValidityMessage = message;
    this.internals.setValidity({
      customError: message !== ""
    }, message);
    this.getValidity();
  }
  /**
   * Returns the current custom validation message or an empty string if no
   * custom error is set.
   */


  getCustomValidity() {
    return this.internals.validity.customError ? this.internals.validationMessage : "";
  }
  /**
   * Checks if the form control has any restraints and whether it satisfies
   * them. If invalid, `false` will be returned and the `invalid` event will
   * be dispatched. In addition, the problem will be reported to the user.
   * If valid, `true` will be returned.
   */


  reportValidity() {
    return this.internals.reportValidity();
  }
  /** Called when the form is reset. */


  formResetCallback() {
    this.invalid = false;
    this.touched = false;
  }
  /** Called when a containing <fieldset> is disabled. */


  formDisabledCallback(isDisabled) {
    if (this.disabled !== isDisabled) {
      this.disabled = isDisabled;
    }
  }
  /** Called when the element is associated with a form. */


  formAssociatedCallback(_form) {// noop
  }
  /**
   * Called when the browser is trying to restore element’s state to state
   * in which case reason is “restore”, or when the browser is trying to
   * fulfill autofill on behalf of user in which case reason is “autocomplete”.
   * In the case of “restore”, state is a string, File, or FormData object
   * previously set as the second argument to `setFormValue`.
   * @internal
   */


  formStateRestoreCallback(
  /**
   * The value previously set as the second argument to `setFormValue`.
   */
  _state,
  /**
   * The cause for this callback being fired. It can be caused by:
   *
   * - **`restore`**: When the browser is trying to update the value on
   *   behalf of the user, like following a reload or page navigation.
   *
   * - **`autocomplete`**: When the browser is trying to autofill the value.
   */
  _reason) {// noop
  }

}
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-form-field-label.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_form_field_label_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-form-field__label\">");t.b("\n" + i);t.b("    <span class=\"clg-form-field__label__text\">");t.b("\n" + i);t.b("        <slot name=\"label\" x-text=\"label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</slot>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("    <span class=\"clg-form-field__label__required-star\" aria-hidden=\"true\">*</span>");t.b("\n" + i);t.b("    <span class=\"clg-screen-reader-only clg-form-field__label__required-text\">");t.b("\n" + i);t.b("        ");t.b(t.v(t.d("messages.required",c,p,0)));if(!t.s(t.d("messages.required",c,p,1),c,p,1,0,0,"")){t.b("Required");};t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("    <span class=\"clg-form-field__label__optional\">");t.b("\n" + i);t.b("        &nbsp;");t.b(t.v(t.d("messages.optional_parenthetical",c,p,0)));if(!t.s(t.d("messages.optional_parenthetical",c,p,1),c,p,1,0,0,"")){t.b("(optional)");};t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_form_field_label_mustache_tmpl.name = "collage/subcomponents/clg-form-field-label.mustache";
(hogan_default()).partialsMap[clg_form_field_label_mustache_tmpl.name] = clg_form_field_label_mustache_tmpl;

const clg_form_field_label_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_form_field_label_mustache_tmpl.render.call(clg_form_field_label_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_form_field_label_mustache_render.template = clg_form_field_label_mustache_tmpl;
/* harmony default export */ const clg_form_field_label_mustache = ((/* unused pure expression or super */ null && (clg_form_field_label_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-form-field-helper-text.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_form_field_helper_text_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div id=\"helper-text\" class=\"clg-form-field__helper-text\">");t.b("\n" + i);t.b("    <slot x-on:slotchange=\"HELPER_TEXT_SLOT_CHANGE\" name=\"helper-text\" x-text=\"helperText\">");t.b(t.v(t.f("helper-text",c,p,0)));t.b("</slot>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_form_field_helper_text_mustache_tmpl.name = "collage/subcomponents/clg-form-field-helper-text.mustache";
(hogan_default()).partialsMap[clg_form_field_helper_text_mustache_tmpl.name] = clg_form_field_helper_text_mustache_tmpl;

const clg_form_field_helper_text_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_form_field_helper_text_mustache_tmpl.render.call(clg_form_field_helper_text_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_form_field_helper_text_mustache_render.template = clg_form_field_helper_text_mustache_tmpl;
/* harmony default export */ const clg_form_field_helper_text_mustache = ((/* unused pure expression or super */ null && (clg_form_field_helper_text_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-text-field-before.mustache




(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_text_field_before_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-text-field__before\">");t.b("\n" + i);t.b("    <label for=\"input\" class=\"clg-text-field__label\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-label.mustache0",c,p,"        "));t.b("    </label>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-helper-text.mustache1",c,p,"    "));t.b("</div>");t.b("\n");return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-label.mustache0":{name:"collage/subcomponents/clg-form-field-label.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-helper-text.mustache1":{name:"collage/subcomponents/clg-form-field-helper-text.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_text_field_before_mustache_tmpl.name = "collage/subcomponents/clg-text-field-before.mustache";
(hogan_default()).partialsMap[clg_text_field_before_mustache_tmpl.name] = clg_text_field_before_mustache_tmpl;

const clg_text_field_before_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_text_field_before_mustache_tmpl.render.call(clg_text_field_before_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_text_field_before_mustache_render.template = clg_text_field_before_mustache_tmpl;
/* harmony default export */ const clg_text_field_before_mustache = ((/* unused pure expression or super */ null && (clg_text_field_before_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-form-field-caption.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_form_field_caption_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div id=\"caption\" class=\"clg-form-field__caption\">");t.b("\n" + i);t.b("    <slot name=\"caption\" x-text=\"caption\" x-on:slotchange=\"CAPTION_SLOT_CHANGE\">");t.b("\n" + i);t.b("        ");t.b(t.v(t.f("caption",c,p,0)));t.b("\n" + i);t.b("    </slot>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_form_field_caption_mustache_tmpl.name = "collage/subcomponents/clg-form-field-caption.mustache";
(hogan_default()).partialsMap[clg_form_field_caption_mustache_tmpl.name] = clg_form_field_caption_mustache_tmpl;

const clg_form_field_caption_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_form_field_caption_mustache_tmpl.render.call(clg_form_field_caption_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_form_field_caption_mustache_render.template = clg_form_field_caption_mustache_tmpl;
/* harmony default export */ const clg_form_field_caption_mustache = ((/* unused pure expression or super */ null && (clg_form_field_caption_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-form-field-error.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_form_field_error_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<p class=\"clg-form-field__error\" ");if(!t.s(t.f("invalid",c,p,1),c,p,1,0,0,"")){t.b("hidden");};t.b(" x-show=\"invalid\">");t.b("\n" + i);t.b("    <clg-icon class=\"clg-form-field__error__icon\" name=\"yield\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    <span id=\"error-message\" x-text=\"validationMessage\">");t.b(t.v(t.f("error",c,p,0)));t.b("</span>");t.b("\n" + i);t.b("</p>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_form_field_error_mustache_tmpl.name = "collage/subcomponents/clg-form-field-error.mustache";
(hogan_default()).partialsMap[clg_form_field_error_mustache_tmpl.name] = clg_form_field_error_mustache_tmpl;

const clg_form_field_error_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_form_field_error_mustache_tmpl.render.call(clg_form_field_error_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_form_field_error_mustache_render.template = clg_form_field_error_mustache_tmpl;
/* harmony default export */ const clg_form_field_error_mustache = ((/* unused pure expression or super */ null && (clg_form_field_error_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/subcomponents/clg-text-field-after.mustache




(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_text_field_after_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-text-field__after\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-caption.mustache0",c,p,"    "));t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-error.mustache1",c,p,"    "));t.b("\n" + i);t.b("    <div class=\"clg-text-field__character-count\" id=\"character-count\">");t.b("\n" + i);t.b("        <span aria-hidden=\"true\" id=\"character-count-visible\"></span>");t.b("\n" + i);t.b("        <p class=\"clg-screen-reader-only\" id=\"character-count-screen-reader\"></p>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-caption.mustache0":{name:"collage/subcomponents/clg-form-field-caption.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-error.mustache1":{name:"collage/subcomponents/clg-form-field-error.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_text_field_after_mustache_tmpl.name = "collage/subcomponents/clg-text-field-after.mustache";
(hogan_default()).partialsMap[clg_text_field_after_mustache_tmpl.name] = clg_text_field_after_mustache_tmpl;

const clg_text_field_after_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_text_field_after_mustache_tmpl.render.call(clg_text_field_after_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_text_field_after_mustache_render.template = clg_text_field_after_mustache_tmpl;
/* harmony default export */ const clg_text_field_after_mustache = ((/* unused pure expression or super */ null && (clg_text_field_after_mustache_render)));

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-text-input.mustache




(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_text_input_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-text-field\">");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-before.mustache0",c,p,"    "));t.b("\n" + i);t.b("    <div id=\"visual-box\" class=\"clg-text-field__visual-box\" x-on:pointerdown=\"BOX_CLICK\">");t.b("\n" + i);t.b("		<span class=\"clg-text-field__icon-affix\" x-show=\"withIconBefore\">");t.b("\n" + i);t.b("            <slot name=\"iconbefore\" x-on:slotchange=\"ICON_SLOT_CHANGE\"></slot>");t.b("\n" + i);t.b("        </span>");t.b("\n" + i);t.b("        <span class=\"clg-text-field__text-affix\" x-text=\"prefixText\" x-show=\"prefixText\">");t.b(t.v(t.f("prefix",c,p,0)));t.b("</span>");t.b("\n");t.b("\n" + i);t.b("        <input class=\"clg-text-field__control\" id=\"input\" type=\"");t.b(t.v(t.f("type",c,p,0)));if(!t.s(t.f("type",c,p,1),c,p,1,0,0,"")){t.b("text");};t.b("\" :type aria-describedby=\"");if(t.s(t.f("with-caption",c,p,1),c,p,0,593,600,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("caption");});c.pop();}t.b(" ");if(t.s(t.f("with-helper-text",c,p,1),c,p,0,639,650,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("helper-text");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,682,695,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("error-message");});c.pop();}t.b("\" ");if(t.s(t.f("value",c,p,1),c,p,0,717,734,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("value=\"");t.b(t.v(t.f("value",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,758,766,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :disabled ");if(t.s(t.f("required",c,p,1),c,p,0,803,811,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("required");});c.pop();}t.b(" :required ");if(t.s(t.f("invalid",c,p,1),c,p,0,847,866,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-invalid=\"true\"");});c.pop();}t.b(" :aria-invalid=\"invalid\" ");if(t.s(t.f("name",c,p,1),c,p,0,912,927,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("name=\"");t.b(t.v(t.f("name",c,p,0)));t.b("\"");});c.pop();}t.b(" :name ");if(t.s(t.f("placeholder",c,p,1),c,p,0,959,988,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("placeholder=\"");t.b(t.v(t.f("placeholder",c,p,0)));t.b("\"");});c.pop();}t.b(" :placeholder ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,1035,1066,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete ");if(t.s(t.f("min",c,p,1),c,p,0,1106,1119,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("min=\"");t.b(t.v(t.f("min",c,p,0)));t.b("\"");});c.pop();}t.b(" :min ");if(t.s(t.f("max",c,p,1),c,p,0,1141,1154,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("max=\"");t.b(t.v(t.f("max",c,p,0)));t.b("\"");});c.pop();}t.b(" :max ");if(t.s(t.f("minlength",c,p,1),c,p,0,1182,1207,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("minlength=\"");t.b(t.v(t.f("minlength",c,p,0)));t.b("\"");});c.pop();}t.b(" :minlength=\"minLength\" ");if(t.s(t.f("pattern",c,p,1),c,p,0,1257,1278,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("pattern=\"");t.b(t.v(t.f("pattern",c,p,0)));t.b("\"");});c.pop();}t.b(" :pattern ");if(t.s(t.f("inputmode",c,p,1),c,p,0,1314,1339,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("inputmode=\"");t.b(t.v(t.f("inputmode",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("enterkeyhint",c,p,1),c,p,0,1371,1402,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("enterkeyhint=\"");t.b(t.v(t.f("enterkeyhint",c,p,0)));t.b("\"");});c.pop();}t.b(" :enterkeyhint=\"enterKeyHint\" ");if(t.s(t.f("autocorrect",c,p,1),c,p,0,1465,1494,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocorrect=\"");t.b(t.v(t.f("autocorrect",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocorrect ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,1541,1572,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete ");if(t.s(t.f("autocapitalize",c,p,1),c,p,0,1623,1658,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocapitalize=\"");t.b(t.v(t.f("autocapitalize",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocapitalize ");if(t.s(t.f("step",c,p,1),c,p,0,1703,1718,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("step=\"");t.b(t.v(t.f("step",c,p,0)));t.b("\"");});c.pop();}t.b(" :step ");if(t.s(t.f("spellcheck",c,p,1),c,p,0,1749,1766,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("spellcheck=\"true\"");});c.pop();}t.b(" :spellcheck ");if(t.s(t.f("autofocus",c,p,1),c,p,0,1808,1817,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autofocus");});c.pop();}t.b(" :autofocus x-on:input=\"INPUT\" x-on:change=\"INPUT_CHANGE\"/>");t.b("\n");t.b("\n" + i);t.b("        <span class=\"clg-text-field__text-affix\" x-text=\"suffix\" x-show=\"suffix\">");t.b(t.v(t.f("suffix",c,p,0)));t.b("</span>");t.b("\n");t.b("\n" + i);t.b("		<span class=\"clg-text-field__icon-affix\" x-show=\"withIconAfter\">");t.b("\n" + i);t.b("			<slot name=\"iconafter\" x-on:slotchange=\"ICON_SLOT_CHANGE\">");t.b("\n" + i);t.b("                <button class=\"clg-text-field__action-btn\" id=\"action-button\" x-on:click=\"ACTION_CLICK\">");t.b("\n" + i);t.b("                    <span class=\"clg-text-field__action-btn__icon\"></span>");t.b("\n" + i);t.b("                </button>");t.b("\n" + i);t.b("            </slot>");t.b("\n" + i);t.b("		</span>");t.b("\n" + i);t.b("	</div>");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-after.mustache1",c,p,"    "));t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {"<collage/subcomponents/clg-text-field-before.mustache0":{name:"collage/subcomponents/clg-text-field-before.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-text-field-after.mustache1":{name:"collage/subcomponents/clg-text-field-after.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_text_input_mustache_tmpl.name = "collage/clg-text-input.mustache";
(hogan_default()).partialsMap[clg_text_input_mustache_tmpl.name] = clg_text_input_mustache_tmpl;

const clg_text_input_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_text_input_mustache_tmpl.render.call(clg_text_input_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_text_input_mustache_render.template = clg_text_input_mustache_tmpl;
/* harmony default export */ const clg_text_input_mustache = (clg_text_input_mustache_render);

;// ./htdocs/assets/js/util/size.js
const Size = function (val) {
    if (typeof val === "string") {
        const unicodeRegex = /\ud83c[\udffb-\udfff](?=\ud83c[\udffb-\udfff])|(?:[^\ud800-\udfff][\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]?|[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\ud800-\udfff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?)*/g;
        const match = val.match(unicodeRegex);
        return match === null ? 0 : match.length;
    }
    if (Array.isArray(val)) {
        return val.length;
    }
    if (typeof val === "object") {
        return Object.keys(val).length;
    }
    return 0;
};
/* harmony default export */ const size = (Size);

;// ./htdocs/assets/js/collage/web-components/internal/submit-on-enter.ts
/**
 * Copyright (c) 2025 Fonticons, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
// Fork of WebAwesome's submit-on-enter
// https://github.com/shoelace-style/webawesome/blob/next/packages/webawesome/src/internal/submit-on-enter.ts
function submitOnEnter(event, el) {
  const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey; // Pressing enter when focused on an input should submit the form like a native input, but we wait a tick before
  // submitting to allow users to cancel the keydown event if they need to

  if (event.key === "Enter" && !hasModifier) {
    // setTimeout in case the event is caught higher up in the tree and defaultPrevented
    setTimeout(() => {
      //
      // When using an Input Method Editor (IME), pressing enter will cause the form to submit unexpectedly. One way
      // to check for this is to look at event.isComposing, which will be true when the IME is open.
      //
      // See https://github.com/shoelace-style/shoelace/pull/988
      //
      if (!event.defaultPrevented && !event.isComposing) {
        submitForm(el);
      }
    });
  }
}
function submitForm(el) {
  let form = null;

  if ("form" in el) {
    form = el.form;
  }

  if (!form) {
    return;
  }

  const formElements = [...form.elements]; // If we're the only formElement, we submit like a native input.

  if (formElements.length === 1) {
    form.requestSubmit(null);
    return;
  } // eslint-disable-next-line @typescript-eslint/consistent-type-assertions


  const button = formElements.find(formControl => "type" in formControl && formControl.type === "submit" && !formControl.matches(":disabled")); // No button found, don't submit.

  if (!button) {
    return;
  }

  if (["input", "button"].includes(button.localName)) {
    form.requestSubmit(button);
  } else {
    // requestSubmit() wont work with `<clg-button>`, so trigger a manual click.
    button.click();
  }
}
;// ./htdocs/assets/js/collage/web-components/internal/CollageTextFieldElement.ts





const DESCRIBEDBY_IDS = {
  ERROR: "error-message",
  CHARACTER_COUNT: "character-count-screen-reader",
  CAPTION: "caption",
  HELPER: "helper-text"
};
/**
 * Base class for textbox elements (e.g., <input> and <textarea>)
 *
 * @tagname clg-input
 *
 * @slot label - Accessible label of the input
 * @slot iconbefore - Prepended icon in the text input
 * @slot iconafter - Appended icon in the text input
 * @slot helper-text - Additional instructions or context for the text field
 * @slot caption - Additional instructions or context for the text field
 *
 * @fires {Event} input - Fires when the user types into the input
 * @fires {Event} change - Fires when the input value changes
 * @fires {FocusEvent} focus - Fires when the input gains focus
 * @fires {FocusEvent} blur - Fires when the input loses focus
 *
 * @attr {string} defaultValue - Sets the initial value (only needed in Preact).
 */

class CollageTextFieldElement extends CollageFormElement {
  static template = clg_text_input_mustache;
  static shadowRootOptions = { ...CollageFormElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    label: {
      property: required,
      slot: hasContent
    }
  };
  /** Accessible label of the input */

  static properties = {
    autocapitalize: {
      type: String
    },
    autocomplete: {
      type: String,
      reflect: true
    },
    autocorrect: {
      type: String,
      reflect: true
    },
    autofocus: {
      type: Boolean,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    // matches global DOM attribute
    // eslint-disable-next-line etsy-rules/lit-attribute-names
    enterKeyHint: {
      type: String,
      attribute: "enterkeyhint"
    },
    label: {
      type: String
    },
    // matches <input> DOM attribute
    // eslint-disable-next-line etsy-rules/lit-attribute-names
    maxLength: {
      type: Number,
      reflect: true,
      attribute: "maxlength"
    },
    // matches <input> DOM attribute
    // eslint-disable-next-line etsy-rules/lit-attribute-names
    minLength: {
      type: Number,
      reflect: true,
      attribute: "minlength"
    },
    name: {
      type: String,
      reflect: true
    },
    optional: {
      type: Boolean,
      reflect: true
    },
    placeholder: {
      type: String,
      reflect: true
    },
    // "prefix" is already an Element property
    // eslint-disable-next-line etsy-rules/lit-attribute-names
    prefixText: {
      type: String,
      attribute: "prefix"
    },
    required: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    suffix: {
      type: String
    },
    value: {
      type: String
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    withIconBefore: {
      type: Boolean,
      reflect: true,
      attribute: "with-icon-before"
    },
    withIconAfter: {
      type: Boolean,
      reflect: true,
      attribute: "with-icon-after"
    },
    spellcheck: {
      type: Boolean,
      converter: {
        fromAttribute: value => !value || value === "false" ? false : true,
        toAttribute: value => value ? "true" : "false"
      }
    },
    showCharacterCount: {
      type: Boolean,
      reflect: true,
      attribute: "show-character-count"
    },
    validateOnChange: {
      type: Boolean,
      attribute: "validate-on-change"
    }
  };
  static delegatedEvents = ["change", "input", "click", "slotchange", "change", "pointerdown"];

  constructor() {
    super();
    this.disabled = false;
    this.showCharacterCount = false;
    this.optional = false;
    this.placeholder = "";
    this.prefixText = "";
    this.required = false;
    this.size = "base";
    this.suffix = "";
    this.value = "";
    this.withIconAfter = false;
    this.withIconBefore = false;
  }

  firstUpdated(changed) {
    super.firstUpdated(changed); // Fixes the typing of the event listeners
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions

    const textBox = this.textBox; // Focus and blur events don't bubble to the shadow root,
    // so adding them manually in lieu of delegatedEvents

    textBox.addEventListener("focus", this.#handleFocus);
    textBox.addEventListener("blur", this.#handleBlur);
    textBox.addEventListener("keydown", this.#handleKeyDown);
    this.onDisconnect(() => {
      textBox?.removeEventListener("focus", this.#handleFocus);
      textBox?.removeEventListener("blur", this.#handleBlur);
      textBox?.removeEventListener("keydown", this.#handleKeyDown);
    });
  }

  willUpdate(changed) {
    super.willUpdate(changed); // Only run on first update
    // Normally, we'd use the "value" attribute for the initial form value.
    // But Preact might strip out the value attribute and just set the property on the element.
    // So this workaround for supporting `defaultValue` is here for Preact.

    if (!this.hasUpdated && this.hasAttribute("defaultvalue") && !this.value) {
      this.value = this.getAttribute("defaultvalue") || "";
    } // We call validate in `willUpdate` and `updated`
    // If the textBox validity changes, we can only detect that after a render (in `updated`)
    // If not, all other factors into the validity should still be accurate here. It's
    // the difference of only this render running, or 1-2 more renders if we wait until `updated`.


    this.validate();
  }

  update(changed) {
    super.update(changed); // Value changes

    if (changed.has("value")) {
      this.internals.setFormValue(this.value); // eslint-disable-next-line @typescript-eslint/no-non-null-assertion

      const input = this.textBox;

      if (input.value !== this.value) {
        input.value = this.value;
      }
    }

    if (changed.has("showCharacterCount") || changed.has("value")) {
      this.#updateCharacterCount();
    }

    this.#updateDescribedByIds();
  }

  updated(changed) {
    super.updated(changed);
    this.updateComplete.then(() => this.validate());
  }

  formResetCallback() {
    super.formResetCallback();
    this.value = this.getAttribute("defaultValue") || this.getAttribute("value") || "";
  }

  formStateRestoreCallback(state) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.value = state;
  }

  getValidity() {
    const hasCustomValidity = this.customValidityMessage.length > 0;
    const exceedsMaxLength = this.maxLength > 0 && this.value.length > this.maxLength; // If `setCustomValidity` is used, the input will always be invalid
    // until they explicitly clear it with `setCustomValidity("")`. This
    // matches the behavior of `HTMLInputElement.setCustomValidity()`

    if (!exceedsMaxLength && !hasCustomValidity && this.textBox.validity.valid) {
      if (!this.error) {
        // Preserve invalid state if error property is used
        this.invalid = false;
        this.validationMessage = "";
      }

      return {
        flags: {}
      };
    }

    const validationMessage = hasCustomValidity ? this.getCustomValidity() : exceedsMaxLength ? maxLengthExceededErrorMsg({
      count: this.value.length,
      total: this.maxLength
    }) : this.textBox.validationMessage;
    const flags = {
      badInput: this.textBox.validity.badInput,
      customError: hasCustomValidity,
      patternMismatch: this.textBox.validity.patternMismatch,
      rangeOverflow: this.textBox.validity.rangeOverflow,
      rangeUnderflow: this.textBox.validity.rangeUnderflow,
      stepMismatch: this.textBox.validity.stepMismatch,
      tooLong: exceedsMaxLength,
      tooShort: this.textBox.validity.tooShort,
      typeMismatch: this.textBox.validity.typeMismatch,
      valueMissing: this.textBox.validity.valueMissing
    };

    if (!this.error) {
      // Preserve invalid state if error property is used
      // Don't show error state if not touched
      this.invalid = this.touched;
      this.validationMessage = validationMessage;
    }

    return {
      flags,
      message: validationMessage,
      anchor: this.textBox
    };
  }
  /** Sets focus to the text field. */


  focus(options) {
    if (!this.textBox || this.isUpdatePending) {
      this.updateComplete.then(() => {
        this.textBox.focus(options);
      });
    } else {
      this.textBox.focus(options);
    }
  }
  /** Removes focus from the text field. */


  blur() {
    this.textBox.blur();
  }
  /** Selects all text in the text field. */


  select() {
    this.textBox.select();
  }
  /** Sets the start and end positions of the current text selection in the text field. */


  setSelectionRange(start, end, direction = "none") {
    this.textBox.setSelectionRange(start, end, direction);
  }
  /** Replaces a range of text in the text field with a new string. */


  setRangeText(replacement, start, end, selectMode) {
    this.textBox.setRangeText(replacement, // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    start ?? this.textBox.selectionStart, // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    end ?? this.textBox.selectionEnd, selectMode);
    this.value = this.textBox.value;
  }
  /** The start position of the current text selection */


  get selectionStart() {
    return this.textBox?.selectionStart ?? null;
  }

  set selectionStart(value) {
    if (this.textBox) {
      this.textBox.selectionStart = value;
    }
  }
  /** The end position of the current text selection */


  get selectionEnd() {
    return this.textBox?.selectionEnd ?? null;
  }

  set selectionEnd(value) {
    if (this.textBox) {
      this.textBox.selectionEnd = value;
    }
  }

  #updateDescribedByIds() {
    const ids = [];

    if (this.invalid) {
      ids.push(DESCRIBEDBY_IDS.ERROR);
    }

    if (this.showCharacterCount) {
      ids.push(DESCRIBEDBY_IDS.CHARACTER_COUNT);
    }

    if (this.withCaption) {
      ids.push(DESCRIBEDBY_IDS.CAPTION);
    }

    if (this.withHelperText) {
      ids.push(DESCRIBEDBY_IDS.HELPER);
    }

    if (ids.length > 0) {
      this.textBox.setAttribute("aria-describedby", ids.join(" "));
    } else {
      this.textBox.removeAttribute("aria-describedby");
    }
  }

  #handleFocus = () => {
    this.dispatchEvent(new FocusEvent("focus", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
  #handleBlur = () => {
    if (this.validateOnChange && this.required && this.value.length === 0) {
      // Normally the required state doesn't trigger an error unless the user adds
      // some text to the field. To get validateOnChange to play with required,
      // we'll manually cause the field to validate.
      this.touched = true;
      this.requestUpdate();
    }

    this.dispatchEvent(new FocusEvent("blur", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
  #handleKeyDown = e => {
    submitOnEnter(e, this);
  };
  /** @internal */

  handleEvent(e) {
    const {
      intention,
      target
    } = this.findClosestIntention(e);

    switch (intention) {
      case "INPUT":
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;

        if (this.validateOnChange) {
          this.touched = true;
        }

        this.value = target.value;
        break;

      case "ICON_SLOT_CHANGE":
        this.withIconBefore = this.hasSlotContent("iconbefore");
        this.withIconAfter = this.hasSlotContent("iconafter");
        break;

      case "INPUT_CHANGE":
        this.dispatchEvent(new Event("change", {
          composed: true,
          bubbles: true,
          cancelable: false
        }));
        break;

      case "BOX_CLICK":
        this.#handleVisualBoxPointerDown(e);
        break;

      default:
    }
  }

  #handleVisualBoxPointerDown(event) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const target = event.target;
    const isBox = target?.id === "visual-box";
    const isSlot = target.hasAttribute("slot");

    if (isBox || isSlot) {
      event.preventDefault();
      this.textBox.focus();
    }
  }

  #updateCharacterCount() {
    const characterCountRoot = this.shadowRoot?.querySelector("#character-count");
    const visibleCharacterCount = characterCountRoot?.querySelector("#character-count-visible");
    const screenReaderCharacterCount = characterCountRoot?.querySelector("#character-count-screen-reader");

    if (!characterCountRoot || !visibleCharacterCount || !screenReaderCharacterCount) {
      return;
    }

    if (!this.showCharacterCount || !this.maxLength) {
      characterCountRoot.toggleAttribute("hidden", true);
      return;
    }

    const characterCount = `${size(this.value) || 0}`;
    visibleCharacterCount.textContent = `${characterCount}/${this.maxLength}`;
    screenReaderCharacterCount.textContent = characterCountMsg({
      count: characterCount,
      total: this.maxLength
    });
    characterCountRoot.removeAttribute("hidden");
  }

}
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-textarea.mustache




(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_textarea_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-text-field\">");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-before.mustache0",c,p,"    "));t.b("\n" + i);t.b("    <div id=\"visual-box\" class=\"clg-text-field__visual-box\" x-on:pointerdown=\"BOX_CLICK\">");t.b("\n" + i);t.b("		<span class=\"clg-text-field__icon-affix\" x-show=\"withIconBefore\">");t.b("\n" + i);t.b("            <slot name=\"iconbefore\" x-on:slotchange=\"ICON_SLOT_CHANGE\"></slot>");t.b("\n" + i);t.b("        </span>");t.b("\n" + i);t.b("        <span class=\"clg-text-field__text-affix\" x-text=\"prefixText\" x-show=\"prefixText\">");t.b(t.v(t.f("prefix",c,p,0)));t.b("</span>");t.b("\n" + i);t.b("        <div class=\"clg-text-field__textarea-sizer\" data-replicated-value=\"");t.b(t.v(t.f("value",c,p,0)));t.b("\" :data-replicated-value=\"value\">");t.b("\n" + i);t.b("            <textarea class=\"clg-text-field__control\" id=\"input\" aria-describedby=\"helper-text caption character-count-screen-reader\" ");if(t.s(t.f("value",c,p,1),c,p,0,717,735,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" value=\"");t.b(t.v(t.f("value",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,759,767,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :disabled ");if(t.s(t.f("required",c,p,1),c,p,0,804,812,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("required");});c.pop();}t.b(" :required ");if(t.s(t.f("invalid",c,p,1),c,p,0,848,867,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-invalid=\"true\"");});c.pop();}t.b(" :aria-invalid=\"invalid\" ");if(t.s(t.f("placeholder",c,p,1),c,p,0,920,949,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("placeholder=\"");t.b(t.v(t.f("placeholder",c,p,0)));t.b("\"");});c.pop();}t.b(" :placeholder ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,996,1027,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete ");if(t.s(t.f("minlength",c,p,1),c,p,0,1073,1098,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("minlength=\"");t.b(t.v(t.f("minlength",c,p,0)));t.b("\"");});c.pop();}t.b(" :minlength=\"minLength\" ");if(t.s(t.f("enterkeyhint",c,p,1),c,p,0,1153,1184,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("enterkeyhint=\"");t.b(t.v(t.f("enterkeyhint",c,p,0)));t.b("\"");});c.pop();}t.b(" :enterkeyhint=\"enterKeyHint\" ");if(t.s(t.f("autocorrect",c,p,1),c,p,0,1247,1276,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocorrect=\"");t.b(t.v(t.f("autocorrect",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocorrect ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,1323,1354,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete ");if(t.s(t.f("autocapitalize",c,p,1),c,p,0,1405,1440,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocapitalize=\"");t.b(t.v(t.f("autocapitalize",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocapitalize ");if(t.s(t.f("spellcheck",c,p,1),c,p,0,1491,1508,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("spellcheck=\"true\"");});c.pop();}t.b(" :spellcheck ");if(t.s(t.f("autofocus",c,p,1),c,p,0,1550,1559,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autofocus");});c.pop();}t.b(" :autofocus ");if(t.s(t.f("rows",c,p,1),c,p,0,1594,1609,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rows=\"");t.b(t.v(t.f("rows",c,p,0)));t.b("\"");});c.pop();}t.b(" :rows ");if(t.s(t.f("name",c,p,1),c,p,0,1634,1649,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("name=\"");t.b(t.v(t.f("name",c,p,0)));t.b("\"");});c.pop();}t.b(" :name x-on:input=\"INPUT\" x-on:change=\"INPUT_CHANGE\" ></textarea>");t.b("\n" + i);t.b("        </div>");t.b("\n");t.b("\n" + i);t.b("        <span class=\"clg-text-field__text-affix\" x-text=\"suffix\" x-show=\"suffix\">");t.b(t.v(t.f("suffix",c,p,0)));t.b("</span>");t.b("\n");t.b("\n" + i);t.b("		<span class=\"clg-text-field__icon-affix\" x-show=\"withIconAfter\">");t.b("\n" + i);t.b("			<slot name=\"iconafter\" x-on:slotchange=\"ICON_SLOT_CHANGE\"></slot>");t.b("\n" + i);t.b("		</span>");t.b("\n" + i);t.b("	</div>");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-after.mustache1",c,p,"    "));t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {"<collage/subcomponents/clg-text-field-before.mustache0":{name:"collage/subcomponents/clg-text-field-before.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-text-field-after.mustache1":{name:"collage/subcomponents/clg-text-field-after.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_textarea_mustache_tmpl.name = "collage/clg-textarea.mustache";
(hogan_default()).partialsMap[clg_textarea_mustache_tmpl.name] = clg_textarea_mustache_tmpl;

const clg_textarea_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_textarea_mustache_tmpl.render.call(clg_textarea_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_textarea_mustache_render.template = clg_textarea_mustache_tmpl;
/* harmony default export */ const clg_textarea_mustache = (clg_textarea_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/textarea/clg-textarea.ts



/**
 * @tagname clg-textarea
 */
class ClgTextarea extends CollageTextFieldElement {
  static template = clg_textarea_mustache;
  /**
   * The minimum number of visible rows of text. If the length of the text
   * exceeds this number, the textarea's height will grow to accommodate.
   */

  static properties = {
    rows: {
      type: Number
    },
    resize: {
      type: String,
      reflect: true
    }
  };

  constructor() {
    super();
    this.rows = 3;
    this.resize = "none";
  }

  get textBox() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const el = this.shadowRoot.querySelector("textarea");
    return el;
  }

}
ClgTextarea.define("clg-textarea");
;// ./htdocs/assets/js/collage/web-components/components/text-input/clg-text-input.ts



const DATETIME_INPUT_TYPES = ["date", "datetime-local", "time", "month", "week"];
/**
 * @tagname clg-text-input
 */

class ClgTextInput extends CollageTextFieldElement {
  static template = clg_text_input_mustache;
  static shadowRootOptions = { ...CollageTextFieldElement.shadowRootOptions,
    delegatesFocus: true
  };

  get #actionIconBtn() {
    return this.shadowRoot?.querySelector("#action-button");
  }
  /** Sets the type attribute on the input. */


  static properties = {
    max: {
      type: Number,
      reflect: true
    },
    min: {
      type: Number,
      reflect: true
    },
    pattern: {
      type: String,
      reflect: true
    },
    step: {
      type: Number,
      reflect: true
    },
    type: {
      type: String,
      reflect: true
    },
    inputMode: {
      type: String,
      reflect: true
    },
    // State
    isPasswordVisible: {
      type: Boolean,
      state: true
    }
  };

  constructor() {
    super();
    this.isPasswordVisible = false;
    this.type = "text";
  }

  willUpdate(changed) {
    super.willUpdate(changed);

    if (changed.has("type") && !["text", "password", "date", "number", "tel", "time", "datetime-local", "week", "email", "month", "search", "url"].includes(this.type)) {
      // Block any unsupported types
      this.type = "text";
    }

    if (!this.inputMode) {
      switch (this.type) {
        case "email":
          this.inputMode = "email";
          break;

        case "number":
          this.inputMode = "numeric";
          break;

        case "tel":
          this.inputMode = "tel";
          break;

        case "search":
          this.inputMode = "search";
          break;

        case "url":
          this.inputMode = "url";
          break;

        default:
      }
    }

    if (["password", ...DATETIME_INPUT_TYPES].includes(this.type)) {
      this.withIconAfter = true;
    }
  }

  update(changed) {
    super.update(changed);

    if (changed.has("isPasswordVisible") && this.type === "password") {
      const toggleButton = this.#actionIconBtn;

      if (toggleButton) {
        if (this.isPasswordVisible) {
          this.textBox.type = "text";
          toggleButton.setAttribute("aria-pressed", "true");
          toggleButton.classList.add("clg-text-field__action-btn--password-visible");
        } else {
          this.textBox.type = "password";
          toggleButton.setAttribute("aria-pressed", "false");
          toggleButton.classList.remove("clg-text-field__action-btn--password-visible");
        }
      }
    }

    if (changed.has("type")) {
      const btn = this.#actionIconBtn;

      if (btn) {
        if (this.type === "password") {
          btn.setAttribute("aria-label", togglePasswordVisibilityMsg());
        } else if (DATETIME_INPUT_TYPES.includes(this.type)) {
          btn.setAttribute("aria-label", showInputPickerMsg());
          btn.removeAttribute("aria-pressed");
        } else {
          btn.removeAttribute("aria-label");
        }
      }
    }

    if (changed.has("inputMode")) {
      // Not clear why the binding annotations didn't work, but this works
      this.textBox.inputMode = this.inputMode;
    }
  }

  get textBox() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const el = this.shadowRoot.querySelector("input");
    return el;
  }
  /** For types that support a picker, such as color and date selectors, this will cause the picker to show. */


  showPicker() {
    this.textBox.showPicker();
  }
  /**
   * When a supported `type` is used, this method will decrease the text field's value by `step`. This is a programmatic
   * change, so `input` and `change` events will not be emitted when this is called.
   */


  stepDown() {
    this.textBox.stepDown();
  }
  /**
   * When a supported `type` is used, this method will increase the text field's value by `step`. This is a programmatic
   * change, so `input` and `change` events will not be emitted when this is called.
   */


  stepUp() {
    this.textBox.stepUp();
  }

  #handlePasswordButtonClick = () => {
    this.isPasswordVisible = !this.isPasswordVisible;
    this.textBox.focus();
  };
  /** @internal */

  handleEvent(e) {
    super.handleEvent(e);
    const {
      intention
    } = this.findClosestIntention(e);

    switch (intention) {
      case "ACTION_CLICK":
        if (this.type === "password") {
          this.#handlePasswordButtonClick();
        } else {
          this.showPicker();
        }

        break;

      default:
    }
  }

}
ClgTextInput.define("clg-text-input");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-text-link.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_text_link_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<a class=\"clg-text-link\" ");if(!t.s(t.f("disabled",c,p,1),c,p,1,0,0,"")){t.b("href=\"");t.b(t.v(t.f("link",c,p,0)));t.b("\"");};t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,80,112,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("role=\"link\" aria-disabled=\"true\"");});c.pop();}t.b(" ");if(t.s(t.f("target",c,p,1),c,p,0,137,156,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("target=\"");t.b(t.v(t.f("target",c,p,0)));t.b("\"");});c.pop();}t.b(" :target ");if(t.s(t.f("rel",c,p,1),c,p,0,184,197,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rel=\"");t.b(t.v(t.f("rel",c,p,0)));t.b("\"");});c.pop();}t.b(" :rel x-on:click=\"CLICK\">");t.b("\n" + i);t.b("    <slot name=\"icon\" x-on:slotchange=\"ICON_CHANGE\"></slot>");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("    <span class=\"clg-screen-reader-only clg-text-link__new-tab-text\">");t.b(t.v(t.d("messages.new_tab",c,p,0)));if(!t.s(t.d("messages.new_tab",c,p,1),c,p,1,0,0,"")){t.b("Opens a new tab");};t.b("</span>");t.b("\n" + i);t.b("</a>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_text_link_mustache_tmpl.name = "collage/clg-text-link.mustache";
(hogan_default()).partialsMap[clg_text_link_mustache_tmpl.name] = clg_text_link_mustache_tmpl;

const clg_text_link_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_text_link_mustache_tmpl.render.call(clg_text_link_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_text_link_mustache_render.template = clg_text_link_mustache_tmpl;
/* harmony default export */ const clg_text_link_mustache = (clg_text_link_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/text-link/clg-text-link.ts



/**
 * @tagname clg-text-link
 *
 * @slot - The link's text content.
 * @slot icon - The icon placed next to the text.
 */

class ClgTextLink extends internal_CollageElement {
  static template = clg_text_link_mustache;
  static shadowRootOptions = { ...internal_CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    href: required
  };
  /** Where to display the linked URL */

  static properties = {
    target: {},
    href: {},
    rel: {},
    disabled: {
      type: Boolean,
      reflect: true
    },
    noUnderline: {
      type: Boolean,
      reflect: true,
      attribute: "no-underline"
    },
    icon: {
      type: String,
      reflect: true,
      converter: {
        toAttribute(value) {
          // Don't add attribute if `false`
          return value ? value : null;
        },

        fromAttribute(value) {
          return value === "false" ? false : value;
        }

      }
    }
  };
  static delegatedEvents = ["click", "slotchange"];

  constructor() {
    super();
    this.disabled = false;
    this.noUnderline = false;
    this.icon = false;
    forwardClicksInTests(this, () => this.#anchor);
  }

  get #anchor() {
    return this.renderRoot.querySelector("a");
  }

  willUpdate(changed) {
    super.willUpdate(changed);

    if (this.hasSlotContent("icon") && !this.icon) {
      this.icon = "start";
    }

    if (!this.hasSlotContent("icon") && this.icon) {
      this.icon = false;
    }
  }

  update(changed) {
    super.update(changed);
    const anchor = this.#anchor;
    if (!anchor) return;

    if (this.disabled) {
      anchor.removeAttribute("href");
      anchor.setAttribute("role", "link");
      anchor.setAttribute("aria-disabled", "true");
    } else {
      anchor.setAttribute("href", this.href);
      anchor.removeAttribute("role");
      anchor.removeAttribute("aria-disabled");
    }
  }

  handleEvent(event) {
    const {
      intention
    } = this.findClosestIntention(event);

    if (intention === "ICON_CHANGE") {
      if (this.hasSlotContent("icon")) {
        this.icon = this.icon || "start";
      } else {
        this.icon = false;
      }
    }

    if (intention === "CLICK" && this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

}
ClgTextLink.define("clg-text-link");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-signal.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_signal_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-signal\">");t.b("\n" + i);t.b("  <slot name=\"icon\"></slot>");t.b("\n" + i);t.b("  <slot></slot>");t.b("\n" + i);t.b("</span>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_signal_mustache_tmpl.name = "collage/clg-signal.mustache";
(hogan_default()).partialsMap[clg_signal_mustache_tmpl.name] = clg_signal_mustache_tmpl;

const clg_signal_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_signal_mustache_tmpl.render.call(clg_signal_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_signal_mustache_render.template = clg_signal_mustache_tmpl;
/* harmony default export */ const clg_signal_mustache = (clg_signal_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/signal/clg-signal.ts


/**
 * @element clg-signal
 *
 * @slot - The signal's text content
 * @slot icon - Icon displayed before the text
 */

class ClgSignal extends CollageElement {
  static template = clg_signal_mustache;
  /** How strongly the signal should appear */

  static properties = {
    variant: {
      type: String,
      reflect: true,
      converter: nonDefaultStringConverter("default")
    },
    size: {
      type: String,
      reflect: true
    },
    color: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    variant: required,
    color: required
  };

  constructor() {
    super();
    this.size = "base";
    this.variant = "default";
  }

}
ClgSignal.define("clg-signal");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-ad-signal.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_ad_signal_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-ad-signal\">");t.b("\n" + i);t.b("    <span class=\"clg-ad-signal__strong\">");t.b("\n" + i);t.b("        ");t.b(t.v(t.d("messages.ad",c,p,0)));if(!t.s(t.d("messages.ad",c,p,1),c,p,1,0,0,"")){t.b("Ad");};t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("    <span class=\"clg-ad-signal__subtle\">");t.b("\n" + i);t.b("        ");t.b(t.v(t.d("messages.ad_by_etsy_seller",c,p,0)));if(!t.s(t.d("messages.ad_by_etsy_seller",c,p,1),c,p,1,0,0,"")){t.b("Ad by Etsy Seller");};t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_ad_signal_mustache_tmpl.name = "collage/clg-ad-signal.mustache";
(hogan_default()).partialsMap[clg_ad_signal_mustache_tmpl.name] = clg_ad_signal_mustache_tmpl;

const clg_ad_signal_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_ad_signal_mustache_tmpl.render.call(clg_ad_signal_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_ad_signal_mustache_render.template = clg_ad_signal_mustache_tmpl;
/* harmony default export */ const clg_ad_signal_mustache = (clg_ad_signal_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/signal/clg-ad-signal.ts


/**
 * @tagname clg-ad-signal
 *
 */

class ClgAdSignal extends CollageElement {
  static template = clg_ad_signal_mustache;
  /**
   * How strongly the signal should appear
   * @required
   */

  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    variant: required
  };

  constructor() {
    super();
    this.size = "base";
  }

}
ClgAdSignal.define("clg-ad-signal");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-star-seller-signal.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_star_seller_signal_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-star-seller-signal\">");t.b("\n" + i);t.b("    <clg-icon name=\"starseller\" size=\"smallest\"></clg-icon>");t.b("\n" + i);t.b("    ");t.b(t.v(t.d("messages.star_seller",c,p,0)));if(!t.s(t.d("messages.star_seller",c,p,1),c,p,1,0,0,"")){t.b("Star Seller");};t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_star_seller_signal_mustache_tmpl.name = "collage/clg-star-seller-signal.mustache";
(hogan_default()).partialsMap[clg_star_seller_signal_mustache_tmpl.name] = clg_star_seller_signal_mustache_tmpl;

const clg_star_seller_signal_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_star_seller_signal_mustache_tmpl.render.call(clg_star_seller_signal_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_star_seller_signal_mustache_render.template = clg_star_seller_signal_mustache_tmpl;
/* harmony default export */ const clg_star_seller_signal_mustache = (clg_star_seller_signal_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/signal/clg-star-seller-signal.ts



/**
 * @tagname clg-star-seller-signal
 *
 * @dependency clg-icon
 */

class ClgStarSellerSignal extends CollageElement {
  static template = clg_star_seller_signal_mustache;
  /** How strongly the signal should appear */

  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    }
  };

  constructor() {
    super();
    this.size = "base";
    this.variant = "default";
  }

}
ClgStarSellerSignal.define("clg-star-seller-signal");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-selectable-list.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_selectable_list_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-selectable-list\">");t.b("\n" + i);t.b("    <slot class=\"clg-selectable-list__title\" name=\"title\"></slot>");t.b("\n" + i);t.b("    <slot class=\"clg-selectable-list__content\" x-on:slotchange=\"SLOT_OCCUPIED\"></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_selectable_list_mustache_tmpl.name = "collage/clg-selectable-list.mustache";
(hogan_default()).partialsMap[clg_selectable_list_mustache_tmpl.name] = clg_selectable_list_mustache_tmpl;

const clg_selectable_list_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_selectable_list_mustache_tmpl.render.call(clg_selectable_list_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_selectable_list_mustache_render.template = clg_selectable_list_mustache_tmpl;
/* harmony default export */ const clg_selectable_list_mustache = (clg_selectable_list_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-selectable-list-item.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_selectable_list_item_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-selectable-list-item\">");t.b("\n" + i);t.b("    <div class=\"clg-selectable-list-item__header\">");t.b("\n" + i);t.b("        <div class=\"clg-selectable-list-item__header__graphic\">");t.b("\n" + i);t.b("            <slot name=\"graphic\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-selectable-list-item__header__text\">");t.b("\n" + i);t.b("            <slot class=\"clg-selectable-list-item__header__text__title\" name=\"title\"></slot>");t.b("\n" + i);t.b("            <slot class=\"clg-selectable-list-item__header__text__subtitle\" name=\"subtitle\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-selectable-list-item__selected-icon__wrapper\">");t.b("\n" + i);t.b("        <span class=\"clg-selectable-list-item__selected-icon__wrapper__icon\">");t.b("\n" + i);t.b("            <clg-icon name=\"check\" />");t.b("\n" + i);t.b("        </span>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_selectable_list_item_mustache_tmpl.name = "collage/clg-selectable-list-item.mustache";
(hogan_default()).partialsMap[clg_selectable_list_item_mustache_tmpl.name] = clg_selectable_list_item_mustache_tmpl;

const clg_selectable_list_item_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_selectable_list_item_mustache_tmpl.render.call(clg_selectable_list_item_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_selectable_list_item_mustache_render.template = clg_selectable_list_item_mustache_tmpl;
/* harmony default export */ const clg_selectable_list_item_mustache = (clg_selectable_list_item_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/selectable-list/clg-selectable-list-item.ts



/**
 * @tagname clg-selectable-list-item
 *
 * @dependency clg-icon
 *
 * @slot - list content
 * @slot graphic - graphic content
 * @slot icon - icon content
 * @slot title - title content
 * @slot subtitle - subtitle content
 */

class ClgSelectableListItem extends CollageElement {
  static template = clg_selectable_list_item_mustache;
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    value: {
      type: String,
      reflect: true
    },
    selected: {
      type: Boolean,
      reflect: true
    }
  };
  /**
   * Visual style variant
   * @default "subtle"
   */

  constructor() {
    super();
    this.variant = "subtle";
    this.value = "";
    this.selected = false;
  }

  get titleSlot() {
    const root = this.shadowRoot;
    if (!root) return null;
    return root.querySelector('slot[name="title"]');
  }

  #syncAriaLabelFromTitleSlot() {
    if (!this.titleSlot) return;
    const assigned = this.titleSlot.assignedElements({
      flatten: true
    });
    if (assigned.length === 0) return;
    const textContent = assigned[0]?.textContent?.trim() ?? "";
    if (textContent.length === 0) return;
    this.setAttribute("aria-label", textContent);
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "option");
  }

  update(changed) {
    super.update(changed);

    if (changed.has("selected")) {
      this.setAttribute("aria-selected", this.selected ? "true" : "false");
    } // We'll wait until slots are occupied to sync the aria-label which is why this is here and not in connectedCallback


    this.#syncAriaLabelFromTitleSlot();
  }

}
ClgSelectableListItem.define("clg-selectable-list-item");
;// ./htdocs/assets/js/collage/web-components/reactive-controllers/FocusGroupController.ts
/**
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
class FocusGroupController {
  cachedElements;
  #mutationObserver;

  get currentIndex() {
    if (this.#currentIndex === -1) {
      this.#currentIndex = this.focusInIndex;
    }

    return this.#currentIndex - this.offset;
  }

  set currentIndex(currentIndex) {
    this.#currentIndex = currentIndex + this.offset;
  }

  #currentIndex = -1;
  #prevIndex = -1;

  get direction() {
    return this.#direction();
  }

  #direction = () => "both";
  directionLength = 5;
  hostDelegatesFocus = false;
  elementEnterAction = _el => {
    return;
  };

  get elements() {
    if (!this.cachedElements) {
      this.cachedElements = this.#elements();
    }

    return this.cachedElements ?? [];
  }

  #elements;

  set focused(focused) {
    /* c8 ignore next 1 */
    if (focused === this.focused) return;
    this.#focused = focused;
  }

  get focused() {
    return this.#focused;
  }

  #focused = false;

  get focusInElement() {
    return this.elements[this.focusInIndex];
  }

  get focusInIndex() {
    return this.#focusInIndex(this.elements);
  }

  #focusInIndex = _elements => 0;
  host;
  isFocusableElement = _el => true;

  isEventWithinListenerScope(event) {
    if (this._listenerScope() === this.host) return true;
    return event.composedPath().includes(this._listenerScope());
  }

  _listenerScope = () => this.host; // When elements are virtualized, the delta between the first element
  // and the first rendered element.

  offset = 0;
  recentlyConnected = false;

  constructor(host, {
    hostDelegatesFocus,
    direction,
    elementEnterAction,
    elements,
    focusInIndex,
    isFocusableElement,
    listenerScope
  } = {
    elements: () => []
  }) {
    this.#mutationObserver = new MutationObserver(() => {
      this.handleItemMutation();
    });
    this.hostDelegatesFocus = hostDelegatesFocus || false;
    this.host = host;
    this.host.addController(this);
    this.#elements = elements;
    this.isFocusableElement = isFocusableElement || this.isFocusableElement;
    {
      const defaultDirection = this.#direction;

      if (typeof direction === "function") {
        this.#direction = direction;
      } else if (typeof direction === "string") {
        this.#direction = () => direction;
      } else {
        this.#direction = defaultDirection;
      }
    }
    this.elementEnterAction = elementEnterAction || this.elementEnterAction;
    {
      const defaultFocusInIndex = this.#focusInIndex;

      if (typeof focusInIndex === "function") {
        this.#focusInIndex = focusInIndex;
      } else if (typeof focusInIndex === "number") {
        this.#focusInIndex = () => focusInIndex;
      } else {
        this.#focusInIndex = defaultFocusInIndex;
      }
    }
    {
      const defaultListenerScope = this._listenerScope;

      if (typeof listenerScope === "function") {
        this._listenerScope = listenerScope;
      } else if (typeof listenerScope === "object" && listenerScope instanceof HTMLElement) {
        this._listenerScope = () => listenerScope;
      } else {
        this._listenerScope = defaultListenerScope;
      }
    }
  }
  /*  In  handleItemMutation() method the first if condition is checking if the element is not focused or if the element's children's length is not decreasing then it means no element has been deleted and we must return.
      Then we are checking if the deleted element was the focused one before the deletion if so then we need to proceed else we casn return;
  */


  handleItemMutation() {
    if (this.#currentIndex === -1 || this.elements.length <= this.#elements().length) return;
    const focusedElement = this.elements[this.currentIndex];
    this.clearElementCache();
    if (!focusedElement || this.elements.includes(focusedElement)) return;
    const moveToNextElement = this.currentIndex !== this.elements.length;
    const diff = moveToNextElement ? 1 : -1;

    if (moveToNextElement) {
      this.setCurrentIndexCircularly(-1);
    }

    this.setCurrentIndexCircularly(diff);
    this.focus();
  }

  update({
    elements
  } = {
    elements: () => []
  }) {
    this.unmanage();
    this.#elements = elements;
    this.clearElementCache();
    this.manage();
  }
  /**
   * resets the focusedItem to initial item
   */


  reset() {
    const elements = this.elements;
    if (!elements.length) return;
    this.setCurrentIndexCircularly(this.focusInIndex - this.currentIndex);
    let focusElement = elements[this.currentIndex];

    if (this.currentIndex < 0) {
      return;
    }

    if (!focusElement || !this.isFocusableElement(focusElement)) {
      this.setCurrentIndexCircularly(1);
      focusElement = elements[this.currentIndex];
    }

    if (focusElement && this.isFocusableElement(focusElement)) {
      elements[this.#prevIndex]?.setAttribute("tabindex", "-1");
      focusElement.setAttribute("tabindex", "0");
    }
  }

  focusOnItem(item, options) {
    const elements = this.elements || [];
    const newIndex = !item || !this.isFocusableElement(item) ? -1 : elements.indexOf(item);

    if (newIndex > -1) {
      this.currentIndex = newIndex;
      elements[this.#prevIndex]?.setAttribute("tabindex", "-1");
    }

    this.focus(options);
  }

  focus(options) {
    const elements = this.elements;
    if (!elements.length) return;
    let focusElement = elements[this.currentIndex];

    if (!focusElement || !this.isFocusableElement(focusElement)) {
      this.setCurrentIndexCircularly(1);
      focusElement = elements[this.currentIndex];
    }

    if (focusElement && this.isFocusableElement(focusElement)) {
      if (!this.hostDelegatesFocus || elements[this.#prevIndex] !== focusElement) {
        elements[this.#prevIndex]?.setAttribute("tabindex", "-1");
      }

      focusElement.tabIndex = 0;
      focusElement.focus(options);

      if (this.hostDelegatesFocus && !this.focused) {
        this.hostContainsFocus();
      }
    }
  }

  clearElementCache(offset = 0) {
    this.#mutationObserver.disconnect();
    delete this.cachedElements;
    this.offset = offset;
    requestAnimationFrame(() => {
      this.elements.forEach(element => {
        this.#mutationObserver.observe(element, {
          attributes: true
        });
      });
    });
  }

  setCurrentIndexCircularly(diff) {
    const total = this.elements.length;
    let steps = total;
    this.#prevIndex = this.currentIndex; // start at a possibly not 0 index

    let nextIndex = (total + this.currentIndex + diff) % total;

    while (steps) {
      const el = this.elements[nextIndex];
      if (!el) break;

      if (!this.isFocusableElement(el)) {
        nextIndex = (total + nextIndex + diff) % total;
        steps -= 1;
        continue;
      }

      break;
    }

    this.currentIndex = nextIndex;
  }

  hostContainsFocus() {
    this.host.addEventListener("focusout", this.handleFocusout);
    this.host.addEventListener("keydown", this.handleKeydown);
    this.focused = true;
  }

  hostNoLongerContainsFocus() {
    this.host.addEventListener("focusin", this.handleFocusin);
    this.host.removeEventListener("focusout", this.handleFocusout);
    this.host.removeEventListener("keydown", this.handleKeydown);
    this.focused = false;
  }

  isRelatedTargetOrContainAnElement(event) {
    const relatedTarget = event.relatedTarget;
    const isRelatedTargetAnElement = this.elements.some(el => el === relatedTarget);
    const isRelatedTargetContainedWithinElements = relatedTarget instanceof Node ? this.elements.some(el => el.contains(relatedTarget)) : false;
    return !(isRelatedTargetAnElement || isRelatedTargetContainedWithinElements);
  }

  handleFocusin = event => {
    if (!this.isEventWithinListenerScope(event)) return;
    const path = event.composedPath();
    const targetIndex = this.elements.findIndex(el => path.includes(el));
    this.#prevIndex = this.currentIndex;
    this.currentIndex = targetIndex > -1 ? targetIndex : this.currentIndex;

    if (this.isRelatedTargetOrContainAnElement(event)) {
      this.hostContainsFocus();
    }
  };
  /**
   * handleClick - Finds the element that was clicked and sets the tabindex to 0
   * @returns void
   */

  handleClick = () => {
    // Manually set the tabindex to 0 for the current element on receiving focus (from keyboard or mouse)
    const elements = this.elements;
    if (!elements.length) return;
    let focusElement = elements[this.currentIndex];

    if (this.currentIndex < 0) {
      return;
    }

    if (!focusElement || !this.isFocusableElement(focusElement)) {
      this.setCurrentIndexCircularly(1);
      focusElement = elements[this.currentIndex];
    }

    if (focusElement && this.isFocusableElement(focusElement)) {
      elements[this.#prevIndex]?.setAttribute("tabindex", "-1");
      focusElement.setAttribute("tabindex", "0");
    }
  };
  handleFocusout = event => {
    if (this.isRelatedTargetOrContainAnElement(event)) {
      this.hostNoLongerContainsFocus();
    }
  };

  acceptsEventKey(key) {
    if (key === "End" || key === "Home") {
      return true;
    }

    switch (this.direction) {
      case "horizontal":
        return key === "ArrowLeft" || key === "ArrowRight";

      case "vertical":
        return key === "ArrowUp" || key === "ArrowDown";

      case "both":
      case "grid":
        return key.startsWith("Arrow");

      default:
        return false;
    }
  }

  handleKeydown = event => {
    if (!this.acceptsEventKey(event.key) || event.defaultPrevented) {
      return;
    }

    let diff = 0;
    this.#prevIndex = this.currentIndex;

    switch (event.key) {
      case "ArrowRight":
        diff += 1;
        break;

      case "ArrowDown":
        diff += this.direction === "grid" ? this.directionLength : 1;
        break;

      case "ArrowLeft":
        diff -= 1;
        break;

      case "ArrowUp":
        diff -= this.direction === "grid" ? this.directionLength : 1;
        break;

      case "End":
        this.currentIndex = 0;
        diff -= 1;
        break;

      case "Home":
        this.currentIndex = this.elements.length - 1;
        diff += 1;
        break;

      default:
        break;
    }

    event.preventDefault();

    if (this.direction === "grid" && this.currentIndex + diff < 0) {
      this.currentIndex = 0;
    } else if (this.direction === "grid" && this.currentIndex + diff > this.elements.length - 1) {
      this.currentIndex = this.elements.length - 1;
    } else {
      this.setCurrentIndexCircularly(diff);
    } // To allow the `focusInIndex` to be calculated with the "after" state of the keyboard interaction
    // do `elementEnterAction` _before_ focusing the next element.


    const enterEl = this.elements[this.currentIndex];

    if (enterEl) {
      this.elementEnterAction(enterEl);
    }

    this.focus();
  };

  manage() {
    this.addEventListeners();
  }

  unmanage() {
    this.removeEventListeners();
  }

  addEventListeners() {
    this.host.addEventListener("focusin", this.handleFocusin);
    this.host.addEventListener("click", this.handleClick);
  }

  removeEventListeners() {
    this.host.removeEventListener("focusin", this.handleFocusin);
    this.host.removeEventListener("focusout", this.handleFocusout);
    this.host.removeEventListener("keydown", this.handleKeydown);
    this.host.removeEventListener("click", this.handleClick);
  }

  hostConnected() {
    this.recentlyConnected = true;
    this.addEventListeners();
  }

  hostDisconnected() {
    this.#mutationObserver.disconnect();
    this.removeEventListeners();
  }

  hostUpdated() {
    if (this.recentlyConnected) {
      this.recentlyConnected = false;
      this.elements.forEach(element => {
        this.#mutationObserver.observe(element, {
          attributes: true
        });
      });
    }
  }

}
;// ./htdocs/assets/js/collage/web-components/reactive-controllers/RovingTabindexController.ts
/**
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */


/**
 * RovingTabindexController
 *
 * Implements the "roving tabindex" a11y pattern for a focusable collection of
 * items. At any time, only a single item in the collection has `tabIndex = 0`
 * (the "active" item) and all other items have `tabIndex = -1`. This:
 *  - Ensures a single Tab stop for the entire collection
 *  - Enables arrow-key navigation inside the collection to move the active item
 *  - Restores default tabbing behavior when unmanaged
 *
 * This controller builds on FocusGroupController to:
 *  - Track the current active item (via currentIndex/focusInElement)
 *  - React to focus entering/leaving the host
 *  - Recompute tabindexes when the item list changes
 *
 * Host integration notes:
 *  - When the group is considered "focused" and the host does not delegate focus
 *    to its children (`hostDelegatesFocus === false`), all items get `tabIndex=-1`
 *    so Tab does not cycle within the group. Arrow keys should move focus between
 *    items programmatically.
 *  - Otherwise, the currently focused/active item is set to `tabIndex=0` and
 *    the rest to `tabIndex=-1`, giving a single Tab stop at the active item.
 *  - Calling `unmanage()` restores `tabIndex=0` to all items to opt-out.
 */
class RovingTabindexController extends FocusGroupController {
  /**
   * When the focus state toggles, ensure tabindexes reflect the new state.
   */
  set focused(focused) {
    if (focused === this.focused) return;
    super.focused = focused;
    this.manageTabindexes();
  }

  get focused() {
    return super.focused;
  }

  #managed = true;
  #manageIndexesAnimationFrame = 0;
  /**
   * When our element cache changes (items added/removed/reordered), schedule
   * a re-calculation of tabindexes on the next animation frame.
   */

  clearElementCache(offset = 0) {
    cancelAnimationFrame(this.#manageIndexesAnimationFrame);
    super.clearElementCache(offset);
    if (!this.#managed) return;
    this.#manageIndexesAnimationFrame = requestAnimationFrame(() => this.manageTabindexes());
  }
  /**
   * Compute and apply the correct tabindex for each item based on:
   *  - Whether the group is focused
   *  - Whether the host delegates focus to its children
   *  - Which item is currently considered focused/active
   */


  manageTabindexes() {
    const focusInEl = this.focusInElement;

    if (this.focused && !this.hostDelegatesFocus) {
      // While focused and not delegating focus, keep all items non-tabbable;
      // keyboard navigation should move focus programmatically.
      this.updateTabindexes(() => ({
        tabIndex: -1
      }));
    } else {
      this.updateTabindexes(el => {
        return {
          // If a child inside an item has focus, avoid overriding
          // its DOM-managed tabIndex by asking the item to re-render
          // and drop its own tabindex attribute.
          removeTabIndex: !!focusInEl && el.contains(focusInEl) && el !== focusInEl,
          tabIndex: el === focusInEl ? 0 : -1
        };
      });
    }
  }
  /**
   * Apply tabindex updates to each element. If `removeTabIndex` is requested,
   * we nudge Lit-based children (if any) to re-render so they can remove their
   * own `tabindex` attribute rather than forcing a value here.
   */


  updateTabindexes(getTabIndex) {
    for (let i = 0; i < this.elements.length; i++) {
      const element = this.elements[i];
      if (!element) continue;
      const {
        tabIndex,
        removeTabIndex
      } = getTabIndex(element);

      if (!removeTabIndex) {
        if (this.focused) {
          if (element !== this.elements[this.currentIndex]) {
            element.tabIndex = tabIndex;
          }
        } else {
          element.tabIndex = tabIndex;
        }

        continue;
      }

      const requestUpdate = Reflect.get(element, "requestUpdate");

      if (typeof requestUpdate === "function") {
        requestUpdate.call(element);
      }
    }
  }
  /**
   * Begin managing tabindexes. Sets internal flag and immediately syncs.
   */


  manage() {
    this.#managed = true;
    this.manageTabindexes();
    super.manage();
  }
  /**
   * Stop managing tabindexes. Restore default tabbability so every item is
   * reachable by Tab (sets all to `tabIndex=0`), then delegate to super.
   */


  unmanage() {
    this.#managed = false;
    this.updateTabindexes(() => ({
      tabIndex: 0
    }));
    super.unmanage();
  }
  /**
   * Ensure an initial tabindex sync the first time the host updates so the
   * DOM reflects the computed active item immediately.
   */


  hostUpdated() {
    super.hostUpdated();
    this.manageTabindexes();
  }

}
;// ./htdocs/assets/js/collage/web-components/components/selectable-list/clg-selectable-list.ts




/**
 * @tagname clg-selectable-list
 *
 * @slot title - list title
 * @slot - list content
 */

class ClgSelectableList extends CollageElement {
  static template = clg_selectable_list_mustache;
  static properties = {
    multiple: {
      type: Boolean,
      reflect: true
    },
    variant: {
      type: String,
      reflect: true
    },
    noDivider: {
      type: Boolean,
      reflect: true,
      attribute: "no-divider"
    }
  };
  /** Whether the list allows multiple selection */

  /** Selected values for multi-select mode */
  #values = new Set();
  #roving;
  static delegatedEvents = ["slotchange"];

  get titleSlot() {
    const root = this.shadowRoot;
    if (!root) return null;
    return root.querySelector('slot[name="title"]');
  }
  /** Read-only selected values for multi-select mode */


  get values() {
    return Array.from(this.#values);
  }
  /**
   * Give consumers a way to set multi-select values
   * const list = document.querySelector('clg-selectable-list[multiple]');
   * list.values = ['red', 'green']; // syncs items
   */


  set values(next) {
    this.#values = new Set(next ?? []);
    this.#syncItemsToState();
  }
  /** Get all list items */


  #getItems() {
    return Array.from(this.querySelectorAll("clg-selectable-list-item"));
  }

  constructor() {
    super();
    this.multiple = false;
    this.variant = "subtle";
    this.noDivider = false;
  }

  #syncItemsToState() {
    const items = this.#getItems();

    if (this.multiple) {
      for (const item of items) {
        const val = item.value ?? "";
        item.selected = this.#values.has(val);
      }
    } else {
      for (const item of items) {
        item.selected = (item.value ?? null) === (this.value ?? null);
      }
    }
  }
  /** Emit selection events per selection mode (this is to mirror how it works natively) */


  #emitSelectionEvents(changed) {
    if (!changed) return; // Always emit input if something changed

    this.dispatchEvent(new Event("input", {
      bubbles: true,
      composed: true
    })); // In multiple mode, also emit change

    if (this.multiple) {
      this.dispatchEvent(new Event("change", {
        bubbles: true,
        composed: true
      }));
    }
  }
  /**
   * Sync selectable list variant prop with items variants
   * We need the items to always reflect the list variant if set
   */


  #syncItemVariants() {
    // Only propagate when the list explicitly has a variant set
    const listVariant = this.variant;
    if (!listVariant) return;
    const items = this.#getItems();

    for (const item of items) {
      item.variant = listVariant;

      if (this.noDivider) {
        item.setAttribute("no-divider", "");
      } else {
        item.removeAttribute("no-divider");
      }
    }
  }

  #syncAriaLabelFromTitleSlot() {
    if (!this.titleSlot) return;
    const assigned = this.titleSlot.assignedElements({
      flatten: true
    });
    if (assigned.length === 0) return;
    const textContent = assigned[0]?.textContent?.trim() ?? "";
    if (textContent.length === 0) return;
    this.setAttribute("aria-label", textContent);
  }
  /** Handle a list item click/activation */


  #handleListItemClick(item) {
    const clickedValue = item.value ?? "";

    if (this.multiple) {
      const currentSelectedValuesSize = this.#values.size;
      const wasSelected = this.#values.has(clickedValue);

      if (wasSelected) {
        this.#values.delete(clickedValue);
      } else {
        this.#values.add(clickedValue);
      }

      this.#syncItemsToState();
      const hasMultiSelectionChanged = this.#values.size !== currentSelectedValuesSize;
      this.#emitSelectionEvents(hasMultiSelectionChanged);
    } else {
      const hasSingleSelectionChanged = this.value !== clickedValue;

      if (hasSingleSelectionChanged) {
        this.value = clickedValue;
      }

      this.#syncItemsToState();
      this.#emitSelectionEvents(hasSingleSelectionChanged);
    }
  }
  /**
   * Convenience method for consumers to select all items (multiple only)
   */


  selectAll() {
    if (!this.multiple) return;
    const items = this.#getItems();
    const next = new Set();

    for (const item of items) {
      const val = item.value ?? "";
      next.add(val);
    }

    const hasMultiSelectionChanged = next.size !== this.#values.size || Array.from(next).some(v => !this.#values.has(v));
    this.#values = next;
    this.#syncItemsToState();
    this.#emitSelectionEvents(hasMultiSelectionChanged);
  }
  /**
   * Convenience method for consumers to deselect all items
   */


  deselectAll() {
    if (this.multiple) {
      const hasMultiSelectionChanged = this.#values.size > 0;
      this.#values.clear();
      this.#syncItemsToState();
      this.#emitSelectionEvents(hasMultiSelectionChanged);
    } else {
      const hasSingleSelectionChanged = this.value !== null;
      this.value = null;
      this.#syncItemsToState();
      this.#emitSelectionEvents(hasSingleSelectionChanged);
    }
  }

  #onKeydown = e => {
    if (!this.multiple) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const indexOfFocusedElement = this.#roving?.currentIndex ?? -1; // if no focused element, return

      if (indexOfFocusedElement < 0) return;
      const focusedElement = this.#roving?.elements?.[indexOfFocusedElement];
      if (!focusedElement || !(focusedElement instanceof ClgSelectableListItem) || focusedElement.hasAttribute("disabled")) return;
      this.#handleListItemClick(focusedElement);
    }
  };
  #onClick = ev => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const el = target.closest("clg-selectable-list-item");
    if (!(el instanceof ClgSelectableListItem) || !this.contains(el)) return;
    this.#handleListItemClick(el);
  };
  /** Validate the list items are only clg-selectable-list-item children */

  #validateListItems() {
    if (false) {}
    const invalidListItems = [...this.children].filter(el => {
      if (el.getAttribute("slot") === "title") return false;
      return el.tagName.toLowerCase() !== "clg-selectable-list-item";
    });

    if (invalidListItems.length > 0) {
      throw new TypeError(`clg-selectable-list only accepts clg-selectable-list-item children. Found: ${invalidListItems.length}`);
    }
  }

  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    if (intention === "SLOT_OCCUPIED") {
      this.#handleSlotChange(); // refresh roving controller elements when slot content changes

      this.#roving?.update({
        elements: () => this.#getItems()
      });
    }
  }

  #handleSlotChange = () => {
    this.#validateListItems();
    this.#syncItemsToState();
    this.#syncItemVariants();
  };

  connectedCallback() {
    super.connectedCallback();
    this.#roving = new RovingTabindexController(this, {
      direction: "vertical",
      elements: () => this.#getItems(),
      isFocusableElement: el => !el.hasAttribute("disabled"),
      elementEnterAction: el => {
        if (this.multiple) return;
        if (!(el instanceof ClgSelectableListItem)) return;
        this.#handleListItemClick(el);
      }
    });
    this.#roving.manage();
    this.setAttribute("role", "listbox");
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeydown);
  }

  update(changed) {
    super.update(changed);

    if (changed.has("multiple")) {
      this.setAttribute("aria-multiselectable", this.multiple ? "true" : "false");
    } // We'll wait until slots are occupied to sync the aria-label which is why this is here and not in connectedCallback


    this.#syncAriaLabelFromTitleSlot();
    this.#syncItemsToState();
    this.#syncItemVariants();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeydown);
    this.#roving?.unmanage();
  }

}
ClgSelectableList.define("clg-selectable-list");
;// ./htdocs/assets/js/collage/web-components/events/open-close.ts
/** Emitted after the element is opened and applicable animations have completed. */
class ClgOpenEvent extends Event {
  constructor() {
    super("clg-open", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
  }

}

/**
 * Emitted when the element is closed and applicable animations have completed.
 * Event is only cancellable when triggered by a user-action. See event.details.origin
 * to check.
 */
class ClgCloseEvent extends Event {
  detail;

  constructor(detail, options = {}) {
    super("clg-close", {
      bubbles: true,
      cancelable: false,
      composed: true,
      ...options
    });
    this.detail = detail;
  }

}
;// ./htdocs/assets/js/collage/web-components/events/content.ts
/** Emitted when the content of the target node has mutated. */
class ClgContentChangedEvent extends Event {
  detail;

  constructor(detail) {
    super("clg-content-changed", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
    this.detail = detail;
  }

}
;// ./htdocs/assets/js/collage/web-components/events/transition.ts
/** Emitted when a custom transition finishes. */
class ClgTransitionEndEvent extends Event {
  constructor() {
    super("clg-transition-end", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
  }

}
;// ./htdocs/assets/js/collage/web-components/reactive-controllers/AnimationController.ts
// Inspired by the <quiet-transition-group>
// https://github.com/quietui/quiet/blob/73d9f4ce70e2b48cc1deacb8a7a0459b7b0bf3a2/src/components/transition-group/transition-group.ts
//
// This ports the Lit-based custom element into the ReactiveController pattern. This makes
// it a bit more flexible to use in different contexts since it's not tied to its own element,
// and can be given the element it's meant to monitor



/**
 * Adds subtle animations as items are added, removed, and reordered in the group.
 *
 * It uses a MutationObserver and the Animation API to orchestrate the movement
 * of items within its host. It's not a full-blown animation API, with hooks for each
 * state of the animation lifecycle. It's really best for adding animation to related
 * items within groups/stacks.
 */
class AnimationController {
  #cachedContainerPosition;
  #cachedElementPositions = new WeakMap();
  #cachedScrollPosition = {
    x: window.scrollX,
    y: window.scrollY
  };
  #currentTransition = Promise.resolve();
  #isObserving = false;
  #mutationObserver;
  #resizeObserver;
  host;
  /** Determines if the transition group is currently animating. (Property only) */

  isTransitioning = false;
  /**
   * A custom animation to use for enter/exit transitions.
   */

  transitionAnimation;
  /**
   * Disables transition animations. However, the `clg-content-changed` and `clg-transition-end` events will still
   * be dispatched.
   */

  disableTransitions = false;
  /**
   * By default, no animation will occur when the user indicates a preference for reduced motion. Use this attribute to
   * override this behavior when necessary.
   */

  ignoreReducedMotion = false;
  /**
   * By default, the controller observes and animates its host's children. In some cases, you may want it to control
   * another element's children. This is useful in cases where you can't directly wrap child elements with the
   * host element.
   *
   * For example, if you embeda component's shadow root but need it to control slotted (light
   * DOM) elements, you can't simply wrap the slot because the mutation observer can't see projected (slotted) elements.
   * In this case, point this property to the target element and observe the
   * target container's children instead.
   */

  transitionContainer;
  /**
   * The duration of the animation of the elements moving within the transitionContainer
   */

  duration = 250;

  constructor(host, options = {}) {
    this.host = host;
    this.transitionContainer = options.transitionContainer || this.host;
    this.duration = options.duration ?? this.duration;
    this.ignoreReducedMotion = options.ignoreReducedMotion ?? this.ignoreReducedMotion;
    this.disableTransitions = options.disableTransitions ?? this.disableTransitions;
    this.transitionAnimation = options.transitionAnimation;
    host.addController(this);
  }

  hostConnected() {
    this.#startObservers(); // Cache the initial coordinates

    this.updateElementPositions();
  }

  hostDisconnected() {
    this.#stopObservers();
  }
  /**
   * Gets a custom animation based on the users preference. If a custom animation isn't found, the default is returned.
   */


  #getAnimation() {
    // Return a custom animation
    if (this.transitionAnimation) {
      return this.transitionAnimation;
    } // Return the default fade animation


    return {
      enter: {
        keyframes: [{
          opacity: 0,
          scale: 0.98
        }, {
          opacity: 1,
          scale: 1
        }],
        easing: "cubic-bezier(0.76, 0, 0.24, 1)"
      },
      exit: {
        keyframes: [{
          opacity: 1,
          scale: 1
        }, {
          opacity: 0,
          scale: 0.98
        }],
        easing: "cubic-bezier(0.6, 0, 0.735, 0)"
      }
    };
  }

  #handleMutations = async mutations => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches && !this.ignoreReducedMotion;
    const addedElements = new Map();
    const removedElements = new Map();
    const movedElements = new Map();
    const containerAnimations = [];
    const addAnimations = [];
    const removeAnimations = [];
    const moveAnimations = [];
    const {
      enter,
      exit
    } = this.#getAnimation();
    const duration = this.duration; // If we're already transitioning, skip this one

    if (this.isTransitioning) {
      return;
    } // Turn off the observers while we work with the DOM


    this.#stopObservers(); // Dispatch the clg-content-changed event

    this.host.dispatchEvent(new ClgContentChangedEvent({
      mutations
    })); // Stop here if transitions are disabled

    if ( false || prefersReducedMotion || this.disableTransitions) {
      this.isTransitioning = false; // We dispatch this even when no transition occurs so users can hook into it reliably

      this.host.dispatchEvent(new ClgTransitionEndEvent());
      this.updateElementPositions();
      this.#startObservers();
      return;
    }

    await this.host.updateComplete;
    this.isTransitioning = true; // Start a new promise so we can resolve it when the transition ends

    this.#currentTransition = (async () => {
      // Find elements that were added and removed in this mutation
      mutations.forEach(mutation => {
        // Added
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const el = node;
            addedElements.set(el, {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              parent: mutation.target,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              nextSibling: mutation.nextSibling
            });
          }
        }); // Removed

        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const el = node;
            removedElements.set(el, {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              parent: mutation.target,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              nextSibling: mutation.nextSibling
            });
          }
        });
      }); // Determine which elements were moved

      addedElements.forEach((info, el) => {
        const removedElementInfo = removedElements.get(el);

        if (removedElementInfo && info.parent === removedElementInfo.parent) {
          movedElements.set(el, info);
          addedElements.delete(el);
          removedElements.delete(el);
        }
      }); // Hide added elements while we remove
      // eslint-disable-next-line no-param-reassign

      addedElements.forEach((_opts, el) => el.hidden = true); // Animate removed elements

      removedElements.forEach((opts, el) => {
        if (opts.nextSibling) {
          opts.nextSibling.before(el);
        } else {
          this.transitionContainer.append(el);
        }

        removeAnimations.push(el.animate(exit.keyframes, {
          duration: exit.duration || duration,
          easing: exit.easing
        }).finished.then(animation => {
          el.remove();
          return animation;
        }));
      }); // Run remove animations

      await Promise.allSettled(removeAnimations); // Add back added elements but keep them invisible for now

      addedElements.forEach((_opts, el) => {
        // eslint-disable-next-line no-param-reassign
        el.hidden = false; // eslint-disable-next-line no-param-reassign

        el.style.opacity = "0";
      }); // Resize the container

      const newContainerPosition = this.transitionContainer.getBoundingClientRect();

      if (newContainerPosition.width !== this.#cachedContainerPosition.width || newContainerPosition.height !== this.#cachedContainerPosition.height) {
        containerAnimations.push(this.transitionContainer.animate([{
          width: `${this.#cachedContainerPosition.width}px`,
          height: `${this.#cachedContainerPosition.height}px`
        }, {
          width: `${newContainerPosition.width}px`,
          height: `${newContainerPosition.height}px`
        }], {
          duration,
          easing: "ease"
        }).finished);
      }

      const children = [...this.transitionContainer.children]; // Animate moved elements
      // @ts-expect-error sadge

      children.forEach(el => {
        const oldPosition = this.#cachedElementPositions.get(el);
        const newPosition = el.getBoundingClientRect(); // Don't animate elements that haven't moved or were just now added/removed

        if (!oldPosition || !hasDomRectMoved(oldPosition, newPosition) || addedElements.has(el) || removedElements.has(el)) {
          return;
        }

        const translateX = oldPosition.left - newPosition.left - (window.scrollX - this.#cachedScrollPosition.x);
        const translateY = oldPosition.top - newPosition.top - (window.scrollY - this.#cachedScrollPosition.y);
        moveAnimations.push(el.animate([{
          translate: `${translateX}px ${translateY}px`
        }, {
          translate: `0 0`
        }], {
          duration,
          easing: "cubic-bezier(0.45, 0, 0.55, 1)"
        }).finished);
      }); // Run move animations

      await Promise.allSettled(moveAnimations); // Animate added elements

      addedElements.forEach((_opts, el) => {
        el.style.removeProperty("opacity");
        addAnimations.push(el.animate(enter.keyframes, {
          easing: enter.easing,
          duration: enter.duration || duration
        }).finished);
      }); // Run add and container animations concurrently

      await Promise.allSettled([...addAnimations, ...containerAnimations]); // Cache new positions

      this.updateElementPositions();
      this.isTransitioning = false; // Restart the mutation observer now that we're done

      this.#startObservers(); // Dispatch the clg-transition-end event

      this.transitionContainer.dispatchEvent(new ClgTransitionEndEvent());
    })();
  };
  #handleResizes = () => {
    this.updateElementPositions();
  };
  #handleVisibilityChange = () => {
    this.updateElementPositions();
  };

  #startObservers() {
    if (this.#isObserving) return;
    this.#isObserving = true;

    if (!this.#mutationObserver) {
      this.#mutationObserver = new MutationObserver(this.#handleMutations);
    }

    if (!this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(this.#handleResizes);
    } // Start observing mutations


    this.#mutationObserver.observe(this.transitionContainer, {
      childList: true,
      characterData: false
    }); // Start observing resizes

    this.#resizeObserver.observe(document.documentElement);
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
  }

  #stopObservers() {
    this.#isObserving = false;
    this.#mutationObserver?.disconnect();
    this.#resizeObserver?.disconnect();
    document.removeEventListener("visibilitychange", this.#handleVisibilityChange);
  }
  /**
   * Returns a promise that resolves when the current transition ends. If no transition is running, it resolves
   * immediately  This is a great way to ensure transitions have stopped before doing something else, such as adding or
   * removing new elements to the transition group.
   */


  async transitionComplete() {
    // Wait a cycle to make sure we don't have mutations since the mutation observer callback is async. If an animation
    // has starts, a new promise will be set in `this.currentTransition`. Otherwise, we can return the old resolved one.
    if (true) {
      await new Promise(requestAnimationFrame);
    } // Wait for the current transition to finish


    await this.#currentTransition;
  }
  /**
   * Updates the cached coordinates of all child elements in the transition group. In most cases, you shouldn't have to
   * call this method. However, if you're resizing or animating elements imperatively, you may need to call this
   * immediately before appending or removing elements to ensure a smooth transition.
   */


  updateElementPositions() {
    this.#cachedContainerPosition = this.transitionContainer.getBoundingClientRect();
    this.#cachedScrollPosition = {
      x: window.scrollX,
      y: window.scrollY
    }; // @ts-expect-error We're assuming that the children will be a normal DOM element

    const children = [...this.transitionContainer.children];
    children.forEach(el => {
      this.#cachedElementPositions.set(el, el.getBoundingClientRect());
    });
  }

}
/** Determines if two DOMRect objects have different positions. */

function hasDomRectMoved(oldPosition, newPosition) {
  if (!oldPosition) return true;
  return oldPosition.top !== newPosition.top || oldPosition.left !== newPosition.left || oldPosition.width !== newPosition.width || oldPosition.height !== newPosition.height;
}
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-toast-group.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_toast_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<section class=\"clg-toast-group\"><slot></slot></section>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_toast_group_mustache_tmpl.name = "collage/clg-toast-group.mustache";
(hogan_default()).partialsMap[clg_toast_group_mustache_tmpl.name] = clg_toast_group_mustache_tmpl;

const clg_toast_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_toast_group_mustache_tmpl.render.call(clg_toast_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_toast_group_mustache_render.template = clg_toast_group_mustache_tmpl;
/* harmony default export */ const clg_toast_group_mustache = (clg_toast_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/toast/clg-toast-group.ts




/**
 * @tagname clg-toast-group
 *
 * @slot - clg-toast elements
 */
class ClgToastGroup extends CollageElement {
  static template = clg_toast_group_mustache;
  static instance = null;
  static transitionAnimation;
  #animationController;

  connectedCallback() {
    super.connectedCallback();

    if (!ClgToastGroup.transitionAnimation) {
      const computedStyle = window.getComputedStyle(this);
      const easingIn = computedStyle.getPropertyValue("--clg-effect-pal-curve-long-in");
      const easingOut = computedStyle.getPropertyValue("--clg-effect-pal-curve-long-out");
      const durationIn = parseInt(computedStyle.getPropertyValue("--clg-effect-pal-duration-300"), 10);
      const durationOut = parseInt(computedStyle.getPropertyValue("--clg-effect-pal-duration-200"), 10);
      ClgToastGroup.transitionAnimation = {
        enter: {
          keyframes: [{
            translate: "0 100%"
          }, {
            translate: "0 0"
          }],
          //  clg.effect.pal.curve.longIn
          easing: easingIn,
          // clg.effect.pal.duration.300
          duration: durationIn
        },
        exit: {
          keyframes: [{
            translate: "0 0"
          }, {
            opacity: 0.5,
            offset: 0.3
          }, {
            translate: "0 100%",
            opacity: 0
          }],
          //  clg.effect.pal.curve.longOut
          easing: easingOut,
          // clg.effect.pal.duration.200
          duration: durationOut
        }
      };
    }

    this.#animationController = new AnimationController(this, {
      transitionAnimation: ClgToastGroup.transitionAnimation
    });
    this.addEventListener("clg-transition-end", this.#handleTransitionEnd); // eslint-disable-next-line @typescript-eslint/consistent-type-assertions

    const ctor = this.constructor;
    ctor.instance = this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("clg-transition-end", this.#handleTransitionEnd); // eslint-disable-next-line @typescript-eslint/consistent-type-assertions

    const ctor = this.constructor;
    ctor.instance = null;
  }

  transitionComplete() {
    return this.#animationController.transitionComplete();
  }

  #handleTransitionEnd(event) {
    if (event.target === this && this.children.length === 0) {
      this.remove();
    }
  }
  /**
   * Queues a toast for display in the group, ensuring all animations are uninterrupted.
   */


  async queue(toast) {
    await this.updateComplete;
    await this.#animationController.transitionComplete(); // Rendering the toast first in a temporary div so that
    // its own shadow DOM can be created BEFORE insertion into the
    // toast group. This is done so that the Toast has its shadow DOM contents,
    // and therefore its dimensions, settled, which makes the entrance
    // transitions smooth. Otherwise the math run to create the transitions
    // isn't accurate and there's a bit of jumping as the elements sort
    // themselves out.

    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    tempDiv.append(toast);
    document.body.append(tempDiv);
    await toast.updateComplete;
    this.prepend(toast);
    tempDiv.remove();
  }
  /** Removes all elements from the toast stack and turns when the remove transition finishes. */


  async empty() {
    await this.transitionComplete();
    this.innerHTML = "";
    await this.transitionComplete();
  }

}
ClgToastGroup.define("clg-toast-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-toast.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_toast_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-toast\">");t.b("\n" + i);t.b("    <div class=\"clg-toast__icon-frame\">");t.b("\n" + i);t.b("        <slot name=\"icon\" x-on:slotchange=\"ICON_SLOTTED\">");t.b("\n" + i);t.b("            ");if(t.s(t.f("icon",c,p,1),c,p,0,143,184,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("<clg-icon name=\"");t.b(t.v(t.f("icon",c,p,0)));t.b("\" size=\"smaller\">");});c.pop();}t.b("\n" + i);t.b("        </slot>");t.b("\n" + i);t.b("        <clg-icon class=\"clg-toast__critical-icon\" name=\"exclamation\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-toast__content\">");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-toast__actions\">");t.b("\n" + i);t.b("        <slot name=\"action\"></slot>");t.b("\n" + i);t.b("        <clg-icon-button size=\"small\" variant=\"transparent\" x-on:click=\"DISMISS\" id=\"dismiss\">");t.b("\n" + i);t.b("            <span class=\"clg-screen-reader-only\">");t.b("\n" + i);t.b("                ");t.b(t.v(t.d("messages.dismiss",c,p,0)));if(!t.s(t.d("messages.dismiss",c,p,1),c,p,1,0,0,"")){t.b("Dismiss");};t.b("\n" + i);t.b("            </span>");t.b("\n" + i);t.b("            <clg-icon name=\"close\"></clg-icon>");t.b("\n" + i);t.b("        </clg-icon-button>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_toast_mustache_tmpl.name = "collage/clg-toast.mustache";
(hogan_default()).partialsMap[clg_toast_mustache_tmpl.name] = clg_toast_mustache_tmpl;

const clg_toast_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_toast_mustache_tmpl.render.call(clg_toast_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_toast_mustache_render.template = clg_toast_mustache_tmpl;
/* harmony default export */ const clg_toast_mustache = (clg_toast_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/toast/clg-toast.ts






// Accessibility notes:
// - Each toast has a role of "status" or "alert", depending on the variant, and
//   aria-live, so the screen-reader will read its content without being focused.
// - The toast will stay open by default for 5s + 50ms for each character within it.
// - If the toast is hovered over by a mouse, the timer will pause, then restart when
//   the mouse is moved away or focus shifts away.
// - We do not draw focus to any interactive element within the toast automatically,
//   as that would be inconsistent with the status and alert roles. If an action
//   is rendered within the toast, we strongly recommend providing the user alternative
//   means to complete that action, such as with a keyboard shortcut.
const DEFAULT_ACTUAL_DURATION = 5000;
const DEFAULT_DURATION = -1;
/**
 * @tagname clg-toast
 *
 * @dependency clg-icon-button
 * @dependency clg-icon
 *
 * @slot - Text content
 * @slot icon - icon slot
 * @slot action - text button slot
 *
 * @fires {ClgCloseEvent} clg-close - Fired when the toast is dismissed, either by user interaction or by the timer.
 */

class ClgToast extends CollageElement {
  static template = clg_toast_mustache;
  static validators = {
    action: {
      slot(slot) {
        const assignedNodes = slot?.assignedElements({
          flatten: true
        });

        for (const node of assignedNodes ?? []) {
          if (node.localName !== "clg-text-button" && !node.querySelector("clg-text-button")) {
            return "clg-toast: action slot must contain a <clg-text-button>";
          }
        }

        return null;
      }

    }
  };

  get #iconSlot() {
    return this.renderRoot.querySelector('slot[name="icon"]');
  }

  #animationFrame = null;
  #isPaused = false;
  #startTime = null;
  #observer = null;
  /** Actual duration while open, derived from duration property. */

  #duration = DEFAULT_ACTUAL_DURATION;
  /**
   * Color variants based on the purpose of the message.
   * @required
   */

  static properties = {
    color: {
      type: String,
      reflect: true
    },
    duration: {
      type: Number
    },
    withIcon: {
      type: Boolean,
      reflect: true,
      attribute: "with-icon"
    },
    icon: {}
  };
  static delegatedEvents = ["click", "slotchange"];

  constructor() {
    super();
    this.duration = DEFAULT_DURATION;
    this.withIcon = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("pointerenter", this.#handleInteractionIn);
    this.addEventListener("pointerleave", this.#handleInteractionOut);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopTimer();
    this.removeEventListener("pointerenter", this.#handleInteractionIn);
    this.removeEventListener("pointerleave", this.#handleInteractionOut);
  }

  willUpdate(changed) {
    super.willUpdate(changed);
    this.withIcon = Boolean(this.icon || this.hasSlotContent("icon"));
  }

  firstUpdated(changed) {
    super.firstUpdated(changed);
    requestAnimationFrame(() => {
      this.#startTimer();
    });
  }

  update(changed) {
    super.update(changed);

    if (changed.has("icon") && this.#iconSlot) {
      this.#iconSlot.innerHTML = this.icon ? `<clg-icon name="${this.icon}" size="smaller"></clg-icon>` : "";
    }

    if (changed.has("color")) {
      const dismissBtn = this.shadowRoot?.querySelector("#dismiss"); // eslint-disable-next-line @typescript-eslint/consistent-type-assertions

      const actionBtn = this.shadowRoot?.querySelector('slot[name="action"]')?.assignedElements({
        flatten: true
      }).find(el => el.tagName.toLowerCase() === "clg-text-button");

      if (this.color === "critical") {
        // https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions#roles_with_implicit_live_region_attributes
        // aria-live="assertive" and role="alert" can cause double-speak on iOS
        this.setAttribute("role", "alert");
        this.removeAttribute("aria-live");

        if (dismissBtn) {
          dismissBtn.backgroundType = "dark";
        }

        if (actionBtn) {
          actionBtn.backgroundType = "dark";
        }
      } else {
        this.setAttribute("role", "status");
        this.setAttribute("aria-live", "polite");

        if (dismissBtn) {
          dismissBtn.backgroundType = "dynamic";
        }

        if (actionBtn) {
          actionBtn.backgroundType = "dynamic";
        }
      }
    }
  }

  #calcActualDuration() {
    if (this.duration !== DEFAULT_DURATION) return this.duration;
    const slot = this.shadowRoot?.querySelector("slot:not([name])");
    if (!slot) return DEFAULT_ACTUAL_DURATION;
    const textLength = slot.assignedNodes({
      flatten: true
    }).reduce((acc, node) => acc + (node.textContent?.length ?? 0), 0); // Add 50ms for each character, with a minimum of 5 seconds

    return DEFAULT_ACTUAL_DURATION + (textLength ?? 0) * 50;
  }
  /**
   * Closes the toast and removes it from the document.
   */


  dismiss() {
    return this.#dismiss("programmatic");
  }

  async #dismiss(source) {
    const handleDismiss = async () => {
      await this.#waitForGroupTransition();
      this.remove();
    };

    if (source === "user") {
      const defaultPrevented = !this.dispatchEvent(new ClgCloseEvent({
        origin: "user"
      }, {
        cancelable: true
      }));

      if (!defaultPrevented) {
        return handleDismiss();
      }
    } else {
      this.dispatchEvent(new ClgCloseEvent({
        origin: "internal"
      }));
      return handleDismiss();
    }
  }
  /**
   * Starts the auto-dismiss timer.
   */


  #startTimer() {
    this.#duration = this.#calcActualDuration();

    if (this.#duration > 0 && Number.isFinite(this.#duration)) {
      if (!this.#observer) {
        this.#observer = new MutationObserver(() => {
          this.#stopTimer();
          requestAnimationFrame(() => {
            this.#startTimer();
          });
        });
        this.#observer.observe(this, {
          subtree: true,
          characterData: true
        });
      }

      this.#startTime = performance.now();
      this.#tick();
    }
  }
  /**
   * Stops the auto-dismiss timer.
   */


  #stopTimer() {
    if (this.#animationFrame !== null) {
      cancelAnimationFrame(this.#animationFrame);
      this.#animationFrame = null;
      this.#startTime = null;
    }

    this.#observer?.disconnect();
    this.#observer = null;
  }

  #tick = async () => {
    if (typeof this.#startTime !== "number" || this.#isPaused) {
      return;
    }

    const elapsed = performance.now() - this.#startTime;
    const progress = Math.min(elapsed / this.#duration, 1);

    if (progress < 1) {
      this.#animationFrame = requestAnimationFrame(this.#tick);
    } else {
      await this.#dismiss("timer");
    }
  };
  #handleInteractionIn = event => {
    // Don't pause for touch, since that will pause the timer indefinitely
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      this.#isPaused = true;
      this.#stopTimer();
    }
  };
  #handleInteractionOut = () => {
    this.#isPaused = false;
    this.#startTimer();
  };
  /** Waits for the toast group to finish transitioning and then resolves. */

  async #waitForGroupTransition() {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const root = this.getRootNode();
    const host = root.host;

    if (host instanceof ClgToastGroup) {
      await host.transitionComplete();
    }
  }
  /** @internal */


  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    switch (intention) {
      case "DISMISS":
        this.#dismiss("user");
        break;

      case "ICON_SLOTTED":
        if (!this.icon) {
          this.withIcon = Boolean(this.hasSlotContent("icon"));
        }

        break;

      default:
    }
  }

}
ClgToast.define("clg-toast");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-global-alert-banner.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_global_alert_banner_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<clg-banner-base class=\"clg-alert-banner\" :color=\"color\" :buttons=\"buttons\" :open=\"open\" color=\"");t.b(t.v(t.f("color",c,p,0)));t.b("\" buttons=\"");t.b(t.v(t.f("buttons",c,p,0)));t.b("\" variant=\"strong\" ");if(t.s(t.f("open",c,p,1),c,p,0,155,159,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("open");});c.pop();}t.b(">");t.b("\n" + i);t.b("    <div class=\"clg-alert-banner__icon clg-alert-banner__bell\" slot=\"icon\">");t.b("\n" + i);t.b("        <clg-icon name=\"bell\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-alert-banner__icon clg-alert-banner__exclamation\" slot=\"icon\">");t.b("\n" + i);t.b("        <clg-icon name=\"exclamation\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n");t.b("\n" + i);t.b("    <slot slot=\"title\" name=\"title\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"subtitle\" name=\"subtitle\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"button-group\" name=\"button-group\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"inline-button\" name=\"inline-button\"></slot>");t.b("\n" + i);t.b("</clg-banner-base>");t.b("\n");t.b("\n");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_global_alert_banner_mustache_tmpl.name = "collage/clg-global-alert-banner.mustache";
(hogan_default()).partialsMap[clg_global_alert_banner_mustache_tmpl.name] = clg_global_alert_banner_mustache_tmpl;

const clg_global_alert_banner_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_global_alert_banner_mustache_tmpl.render.call(clg_global_alert_banner_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_global_alert_banner_mustache_render.template = clg_global_alert_banner_mustache_tmpl;
/* harmony default export */ const clg_global_alert_banner_mustache = (clg_global_alert_banner_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-banner-base.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_banner_base_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-banner-base\">");t.b("\n" + i);t.b("    <div class=\"clg-banner-base__container\">");t.b("\n" + i);t.b("        <div class=\"clg-banner-base__alert-content\">");t.b("\n" + i);t.b("            <slot name=\"icon\" class=\"clg-banner-base__icon\"></slot>");t.b("\n" + i);t.b("            <div class=\"clg-banner-base__text-content\" role=\"alert\">");t.b("\n" + i);t.b("                <div class=\"clg-banner-base__title\">");t.b("\n" + i);t.b("                    <slot name=\"title\"></slot>");t.b("\n" + i);t.b("                </div>");t.b("\n" + i);t.b("                <slot name=\"subtitle\" x-on:slotchange=\"SLOT_OCCUPIED\"></slot>");t.b("\n" + i);t.b("            </div>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-banner-base__button-group\" orientation=\"horizontal\">");t.b("\n" + i);t.b("            <slot name=\"button-group\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-banner-base__inline-button\">");t.b("\n" + i);t.b("            <slot name=\"inline-button\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <clg-icon-button variant=\"transparent\" class=\"clg-banner-base__dismiss-button\" styletype=\"transparent\" size=\"small\"");t.b("\n" + i);t.b("        x-on:click=\"DISMISS\">");t.b("\n" + i);t.b("        <span class=\"clg-screen-reader-only\">");t.b("\n" + i);t.b("            ");t.b(t.v(t.d("messages.dismiss",c,p,0)));t.b("\n" + i);t.b("        </span>");t.b("\n" + i);t.b("        <clg-icon name=\"close\"></clg-icon>");t.b("\n" + i);t.b("    </clg-icon-button>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_banner_base_mustache_tmpl.name = "collage/clg-banner-base.mustache";
(hogan_default()).partialsMap[clg_banner_base_mustache_tmpl.name] = clg_banner_base_mustache_tmpl;

const clg_banner_base_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_banner_base_mustache_tmpl.render.call(clg_banner_base_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_banner_base_mustache_render.template = clg_banner_base_mustache_tmpl;
/* harmony default export */ const clg_banner_base_mustache = (clg_banner_base_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/banner/clg-banner-base.ts





/**
 * @tagname clg-banner-base
 *
 * @dependency clg-icon-button
 * @dependency clg-icon
 *
 * @slot - banner message
 * @slot icon - icon
 * @slot title - banner title
 *
 * @fires {ClgCloseEvent} clg-close - Event fired when the close button is clicked.
 */

class ClgBannerBase extends CollageElement {
  static template = clg_banner_base_mustache;
  /**
   * Buttons variants for different call to action use cases.
   */

  static properties = {
    buttons: {
      type: String,
      reflect: true
    },
    open: {
      type: Boolean,
      reflect: true
    },
    subtitle: {
      type: Boolean,
      reflect: true
    }
  };
  static delegatedEvents = ["click", "slotchange"];

  constructor() {
    super();
    this.buttons = "none";
    this.open = false;
    this.subtitle = false;
  }

  #dismiss() {
    const defaultPrevented = !this.dispatchEvent(new ClgCloseEvent({
      origin: "user"
    }, {
      cancelable: true
    }));

    if (!defaultPrevented) {
      this.open = false;
    }
  }

  handleEvent(e) {
    const {
      intention,
      target
    } = this.findClosestIntention(e);

    if (intention === "DISMISS") {
      this.#dismiss();
    } else if (intention === "SLOT_OCCUPIED") {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const slot = target; // Check if there is content in the child subtitle slot (subtitle slot of outer banner)

      const slotOccupied = slot.assignedNodes({
        flatten: true
      }).length > 0;
      this.subtitle = slotOccupied;
    }
  }

}
ClgBannerBase.define("clg-banner-base");
;// ./htdocs/assets/js/collage/web-components/components/banner/clg-global-alert-banner.ts




/**
 * @tagname clg-global-alert-banner
 *
 * @dependency clg-banner-base
 * @dependency clg-icon
 *
 * @slot - banner message
 * @slot icon - icon
 * @slot title - banner title
 *
 * @fires {ClgCloseEvent} clg-close - Event fired when the close button is clicked.
 */

class ClgGlobalAlertBanner extends CollageElement {
  static template = clg_global_alert_banner_mustache;
  /**
   * Color variants based on the purpose of the message.
   * @required
   */

  static properties = {
    color: {
      type: String,
      reflect: true
    },
    buttons: {
      type: String,
      reflect: true
    },
    open: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    color: {
      property(value, context) {
        if (value !== "warning" && value !== "critical") {
          return `${context.tagName}: color must be 'warning' or 'critical'`;
        }

        return null;
      }

    }
  };

  constructor() {
    super();
    this.buttons = "none";
    this.open = false;
  }

}
ClgGlobalAlertBanner.define("clg-global-alert-banner");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-section-alert-banner.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_section_alert_banner_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<clg-banner-base class=\"clg-alert-banner\" :color=\"color\" :buttons=\"buttons\" :open=\"open\" buttons=\"");t.b(t.v(t.f("buttons",c,p,0)));t.b("\" variant=\"");t.b(t.v(t.f("variant",c,p,0)));t.b("\"");if(t.s(t.f("open",c,p,1),c,p,0,141,145,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("open");});c.pop();}t.b(">");t.b("\n" + i);t.b("    <div class=\"clg-alert-banner__icon clg-alert-banner__bell\" slot=\"icon\">");t.b("\n" + i);t.b("        <clg-icon name=\"bell\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-alert-banner__icon clg-alert-banner__exclamation\" slot=\"icon\">");t.b("\n" + i);t.b("        <clg-icon name=\"exclamation\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-alert-banner__icon clg-alert-banner__check\" slot=\"icon\">");t.b("\n" + i);t.b("        <clg-icon name=\"check\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </div>");t.b("\n");t.b("\n" + i);t.b("    <slot slot=\"title\" name=\"title\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"subtitle\" name=\"subtitle\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"button-group\" name=\"button-group\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"inline-button\" name=\"inline-button\"></slot>");t.b("\n" + i);t.b("</clg-banner-base>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_section_alert_banner_mustache_tmpl.name = "collage/clg-section-alert-banner.mustache";
(hogan_default()).partialsMap[clg_section_alert_banner_mustache_tmpl.name] = clg_section_alert_banner_mustache_tmpl;

const clg_section_alert_banner_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_section_alert_banner_mustache_tmpl.render.call(clg_section_alert_banner_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_section_alert_banner_mustache_render.template = clg_section_alert_banner_mustache_tmpl;
/* harmony default export */ const clg_section_alert_banner_mustache = (clg_section_alert_banner_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/banner/clg-section-alert-banner.ts




/**
 * @tagname clg-section-alert-banner
 *
 * @dependency clg-banner-base
 * @dependency clg-icon
 *
 * @slot - banner message
 * @slot icon - icon
 * @slot title - banner title
 *
 * @fires {ClgCloseEvent} clg-close - Event fired when the close button is clicked.
 */

class ClgSectionAlertBanner extends CollageElement {
  static template = clg_section_alert_banner_mustache;
  /**
   * Variant to define urgency of the message (subtle outline style or strong full bleed background)
   * @required
   */

  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    color: {
      type: String,
      reflect: true
    },
    buttons: {
      type: String,
      reflect: true
    },
    open: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    variant: required,
    color: {
      property(value, context) {
        if (!value) {
          return required.call(this, value, context);
        }

        if (value !== "warning" && value !== "critical" && value !== "success") {
          return `${context.tagName}: color must be 'warning', 'critical', or 'success'`;
        }

        return null;
      }

    }
  };
  static delegatedEvents = ["click"];

  constructor() {
    super();
    this.buttons = "none";
    this.open = false;
  }

}
ClgSectionAlertBanner.define("clg-section-alert-banner");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-signal-banner.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_signal_banner_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<clg-banner-base class=\"clg-signal-banner\" :color=\"color\" :buttons=\"buttons\" :open=\"open\" color=\"");t.b(t.v(t.f("color",c,p,0)));t.b("\" buttons=\"");t.b(t.v(t.f("buttons",c,p,0)));t.b("\" variant=\"");t.b(t.v(t.f("variant",c,p,0)));t.b("\"");if(t.s(t.f("open",c,p,1),c,p,0,160,164,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("open");});c.pop();}t.b(">");t.b("\n" + i);t.b("    <div class=\"clg-signal-banner__icon\" slot=\"icon\">");t.b("\n" + i);t.b("        <slot name=\"icon\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n");t.b("\n" + i);t.b("    <slot slot=\"title\" name=\"title\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"subtitle\" name=\"subtitle\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"button-group\" name=\"button-group\"></slot>");t.b("\n" + i);t.b("    <slot slot=\"inline-button\" name=\"inline-button\"></slot>");t.b("\n" + i);t.b("</clg-banner-base>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_signal_banner_mustache_tmpl.name = "collage/clg-signal-banner.mustache";
(hogan_default()).partialsMap[clg_signal_banner_mustache_tmpl.name] = clg_signal_banner_mustache_tmpl;

const clg_signal_banner_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_signal_banner_mustache_tmpl.render.call(clg_signal_banner_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_signal_banner_mustache_render.template = clg_signal_banner_mustache_tmpl;
/* harmony default export */ const clg_signal_banner_mustache = (clg_signal_banner_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/banner/clg-signal-banner.ts



/**
 * @tagname clg-signal-banner
 *
 * @dependency clg-banner-base
 *
 * @slot - banner message
 * @slot icon - icon
 * @slot title - banner title
 *
 * @fires {ClgCloseEvent} clg-close - Event fired when the close button is clicked.
 */

class ClgSignalBanner extends CollageElement {
  static template = clg_signal_banner_mustache;
  /**
   * Variant to define urgency of the message (subtle outline style or strong full bleed background)
   * @required
   */

  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    color: {
      type: String,
      reflect: true
    },
    buttons: {
      type: String,
      reflect: true
    },
    open: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    variant: required,
    color: {
      property(value, context) {
        if (value !== "neutral" && value !== "highlight") {
          return `${context.tagName}: color must be 'neutral' or 'highlight'`;
        }

        return null;
      }

    }
  };

  constructor() {
    super();
    this.buttons = "none";
    this.open = false;
  }

}
ClgSignalBanner.define("clg-signal-banner");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-dot-indicator.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_dot_indicator_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-dot-indicator\"></span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_dot_indicator_mustache_tmpl.name = "collage/clg-dot-indicator.mustache";
(hogan_default()).partialsMap[clg_dot_indicator_mustache_tmpl.name] = clg_dot_indicator_mustache_tmpl;

const clg_dot_indicator_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_dot_indicator_mustache_tmpl.render.call(clg_dot_indicator_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_dot_indicator_mustache_render.template = clg_dot_indicator_mustache_tmpl;
/* harmony default export */ const clg_dot_indicator_mustache = (clg_dot_indicator_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/indicator/clg-dot-indicator.ts


/**
 * @tagname clg-dot-indicator
 *
 */

class ClgDotIndicator extends CollageElement {
  static template = clg_dot_indicator_mustache;
  /**
   * Priority of the element marked by the color
   * @required
   */

  static properties = {
    color: {
      type: String,
      reflect: true
    },
    border: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    color: required
  };

  constructor() {
    super();
    this.border = false;
  }

}
ClgDotIndicator.define("clg-dot-indicator");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-status-indicator.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_status_indicator_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-status-indicator\">");t.b("\n" + i);t.b("  <slot name=\"icon\"></slot>");t.b("\n" + i);t.b("  <slot></slot>");t.b("\n" + i);t.b("</span>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_status_indicator_mustache_tmpl.name = "collage/clg-status-indicator.mustache";
(hogan_default()).partialsMap[clg_status_indicator_mustache_tmpl.name] = clg_status_indicator_mustache_tmpl;

const clg_status_indicator_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_status_indicator_mustache_tmpl.render.call(clg_status_indicator_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_status_indicator_mustache_render.template = clg_status_indicator_mustache_tmpl;
/* harmony default export */ const clg_status_indicator_mustache = (clg_status_indicator_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/indicator/clg-status-indicator.ts


/**
 * @element clg-status-indicator
 *
 *  @slot - The status indicator's text content
 *  @slot icon - Icon displayed before the text
 *
 */

class ClgStatusIndicator extends CollageElement {
  static template = clg_status_indicator_mustache;
  /**
   * The status signified by the color of the badge
   * @required
   */

  static properties = {
    color: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    color: required
  };

  constructor() {
    super();
    this.size = "base";
  }

}
ClgStatusIndicator.define("clg-status-indicator");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-counter-indicator.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_counter_indicator_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-counter-indicator\">");t.b("\n" + i);t.b("    <span class=\"clg-counter-indicator__value\" x-text=\"displayValue\">");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("</span>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_counter_indicator_mustache_tmpl.name = "collage/clg-counter-indicator.mustache";
(hogan_default()).partialsMap[clg_counter_indicator_mustache_tmpl.name] = clg_counter_indicator_mustache_tmpl;

const clg_counter_indicator_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_counter_indicator_mustache_tmpl.render.call(clg_counter_indicator_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_counter_indicator_mustache_render.template = clg_counter_indicator_mustache_tmpl;
/* harmony default export */ const clg_counter_indicator_mustache = (clg_counter_indicator_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/indicator/clg-counter-indicator.ts


/**
 * @tagname clg-counter-indicator
 *
 * A numeric badge used to show counts (e.g. unread, items in cart).
 * Values above 99 are truncated to "99+".
 *
 * @slot - The initial display value, which can be formatted on the server.
 */

class ClgCounterIndicator extends CollageElement {
  static template = clg_counter_indicator_mustache;
  /**
   * Priority of the indicator, which controls its color styling.
   * @required
   */

  static properties = {
    priority: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    border: {
      type: Boolean,
      reflect: true
    },
    value: {
      type: Number
    },
    displayValue: {
      state: true
    }
  };
  static validators = {
    priority: required,
    value: {
      property(value, context) {
        if (!value) {
          return required.call(this, value, context);
        }

        if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
          return `${context.tagName}: \`value\` must be a non-negative integer.`;
        }

        return null;
      }

    }
  };

  constructor() {
    super();
    this.size = "small";
    this.border = false; // value is required; leave it unset until the user sets it.

    this.displayValue = "";
  }

  willUpdate(changed) {
    super.willUpdate(changed);

    if (changed.has("value") && typeof this.value === "number") {
      this.displayValue = this.#formatValue(this.value);
    }
  }

  #formatValue(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("clg-counter-indicator: `value` must be a non-negative integer.");
    }

    return value > 99 ? "99+" : String(value);
  }

}
ClgCounterIndicator.define("clg-counter-indicator");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-navigational-list.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_navigational_list_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-navigational-list\">");t.b("\n" + i);t.b("    <slot class=\"clg-navigational-list__label\" name=\"title\"></slot>");t.b("\n" + i);t.b("    <slot class=\"clg-navigational-list__content\" x-on:slotchange=\"SLOT_OCCUPIED\"></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_navigational_list_mustache_tmpl.name = "collage/clg-navigational-list.mustache";
(hogan_default()).partialsMap[clg_navigational_list_mustache_tmpl.name] = clg_navigational_list_mustache_tmpl;

const clg_navigational_list_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_navigational_list_mustache_tmpl.render.call(clg_navigational_list_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_navigational_list_mustache_render.template = clg_navigational_list_mustache_tmpl;
/* harmony default export */ const clg_navigational_list_mustache = (clg_navigational_list_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/navigational-list/clg-navigational-list.ts



/**
 * @tagname clg-navigational-list
 *
 * @slot title - list title
 * @slot - list content
 */
class ClgNavigationalList extends CollageElement {
  static template = clg_navigational_list_mustache;
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    noDivider: {
      type: Boolean,
      reflect: true,
      attribute: "no-divider"
    }
  };
  /** Visual style variant, default is subtle */

  static delegatedEvents = ["slotchange"];

  constructor() {
    super();
    this.variant = "subtle";
    this.noDivider = false;
  }
  /** Get all list items */


  #getItems() {
    return Array.from(this.querySelectorAll("clg-navigational-list-item"));
  }
  /**
   * Sync navigational list variant prop with item variants
   * We need the items to always reflect the list variant if set
   */


  #syncItemVariants() {
    const listVariant = this.variant;
    if (!listVariant) return;
    const items = this.#getItems();

    for (const item of items) {
      item.variant = listVariant; // Divider handled by parent: toggle 'no-divider' on items

      if (this.noDivider) {
        item.setAttribute("no-divider", "");
      } else {
        item.removeAttribute("no-divider");
      }
    }
  }
  /** Validate the list items are only clg-navigational-list-item children */


  #validateListItems() {
    if (false) {}
    const invalidListItems = [...this.children].filter(el => {
      if (el.getAttribute("slot") === "title") return false;
      return el.tagName.toLowerCase() !== "clg-navigational-list-item";
    });

    if (invalidListItems.length > 0) {
      throw new TypeError(`clg-navigational-list only accepts clg-navigational-list-item children. Found: ${invalidListItems.length}`);
    }
  }

  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    if (intention === "SLOT_OCCUPIED") {
      this.#handleSlotChange();
    }
  }

  #handleSlotChange = () => {
    this.#validateListItems();
    this.requestUpdate();
  };

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "list");
  }

  update(changed) {
    super.update(changed);
    this.#syncItemVariants();
  }

}
ClgNavigationalList.define("clg-navigational-list");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-navigational-list-item.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_navigational_list_item_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<a class=\"clg-navigational-list-item\" href=\"");t.b(t.v(t.f("href",c,p,0)));t.b("\" :href ");if(t.s(t.f("rel",c,p,1),c,p,0,68,81,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rel=\"");t.b(t.v(t.f("rel",c,p,0)));t.b("\"");});c.pop();}t.b(" :rel ");if(t.s(t.f("target",c,p,1),c,p,0,106,125,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("target=\"");t.b(t.v(t.f("target",c,p,0)));t.b("\"");});c.pop();}t.b(" :target>");t.b("\n" + i);t.b("    <div class=\"clg-navigational-list-item__header\">");t.b("\n" + i);t.b("        <div class=\"clg-navigational-list-item__header__graphic\">");t.b("\n" + i);t.b("            <slot name=\"graphic\"></slot>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-navigational-list-item__header__text\">");t.b("\n" + i);t.b("            <div class=\"clg-navigational-list-item__header__text__title\"><slot name=\"title\"></slot></div>");t.b("\n" + i);t.b("            <div class=\"clg-navigational-list-item__header__text__subtitle\"><slot name=\"subtitle\"></slot></div>");t.b("\n" + i);t.b("        </div>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-navigational-list-item__content\">");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("        <clg-icon name=\"navigateright\" />");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</a>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_navigational_list_item_mustache_tmpl.name = "collage/clg-navigational-list-item.mustache";
(hogan_default()).partialsMap[clg_navigational_list_item_mustache_tmpl.name] = clg_navigational_list_item_mustache_tmpl;

const clg_navigational_list_item_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_navigational_list_item_mustache_tmpl.render.call(clg_navigational_list_item_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_navigational_list_item_mustache_render.template = clg_navigational_list_item_mustache_tmpl;
/* harmony default export */ const clg_navigational_list_item_mustache = (clg_navigational_list_item_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/navigational-list/clg-navigational-list-item.ts



/**
 * @tagname clg-navigational-list-item
 *
 * @dependency clg-icon
 *
 * @slot - link content
 */

class ClgNavigationalListItem extends CollageElement {
  static template = clg_navigational_list_item_mustache;
  static shadowRootOptions = { ...CollageElement.shadowRootOptions,
    delegatesFocus: true
  };
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    href: {
      type: String,
      reflect: true
    },
    target: {
      type: String,
      reflect: true
    },
    rel: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    href: required
  };
  /**
   * Visual style variant - inherits from clg-navigational-list
   * @default "subtle"
   */

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "link");
  }

}
ClgNavigationalListItem.define("clg-navigational-list-item");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-radio.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_radio_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-radio\">");t.b("\n" + i);t.b("	<div class=\"clg-radio__label\">");t.b("\n" + i);t.b("		<span class=\"clg-radio__label__circle\">");t.b("\n" + i);t.b("			<clg-radio-circle ");if(t.s(t.f("checked",c,p,1),c,p,0,131,138,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("checked");});c.pop();}t.b(" ");if(t.s(t.f("background-type",c,p,1),c,p,0,171,208,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("background-type=\"");t.b(t.v(t.f("background-type",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("size",c,p,1),c,p,0,238,253,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("size=\"");t.b(t.v(t.f("size",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,273,280,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("invalid");});c.pop();}t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,304,312,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :checked :background-type :size :invalid :disabled></clg-radio-circle>");t.b("\n" + i);t.b("		</span>");t.b("\n" + i);t.b("		<div>");t.b("\n" + i);t.b("            <slot class=\"clg-radio__label-text\" x-text=\"label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</slot>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-helper-text.mustache0",c,p,"			"));t.b("		</div>");t.b("\n" + i);t.b("	</div>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-helper-text.mustache0":{name:"collage/subcomponents/clg-form-field-helper-text.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_radio_mustache_tmpl.name = "collage/clg-radio.mustache";
(hogan_default()).partialsMap[clg_radio_mustache_tmpl.name] = clg_radio_mustache_tmpl;

const clg_radio_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_radio_mustache_tmpl.render.call(clg_radio_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_radio_mustache_render.template = clg_radio_mustache_tmpl;
/* harmony default export */ const clg_radio_mustache = (clg_radio_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-radio-circle.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_radio_circle_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-radio-circle\" aria-hidden=\"true\">");t.b("\n" + i);t.b("	<span class=\"clg-radio-circle__dot\"></span>");t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_radio_circle_mustache_tmpl.name = "collage/clg-radio-circle.mustache";
(hogan_default()).partialsMap[clg_radio_circle_mustache_tmpl.name] = clg_radio_circle_mustache_tmpl;

const clg_radio_circle_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_radio_circle_mustache_tmpl.render.call(clg_radio_circle_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_radio_circle_mustache_render.template = clg_radio_circle_mustache_tmpl;
/* harmony default export */ const clg_radio_circle_mustache = (clg_radio_circle_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/radio/clg-radio-circle.ts


/**
 * @tagname clg-radio-circle
 *
 * A radio circle display element.
 */

class ClgRadioCircle extends CollageElement {
  static template = clg_radio_circle_mustache;
  static properties = {
    checked: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    },
    invalid: {
      type: Boolean,
      reflect: true
    }
  };
  /** Whether the radio is selected */

  constructor() {
    super();
    this.backgroundType = "dynamic";
    this.size = "base";
    this.checked = false;
    this.invalid = false;
  }

}
ClgRadioCircle.define("clg-radio-circle");
;// ./htdocs/assets/js/collage/web-components/components/radio/clg-radio.ts



/**
 * @tagname clg-radio
 *
 * @summary A form-associated radio control.
 *
 * @dependency clg-radio-circle
 *
 * @slot helper-text - The helper text for the radio
 * @slot - The label text, can be used instead of the `label` property.
 */

class ClgRadio extends CollageElement {
  static template = clg_radio_mustache;
  static properties = {
    label: {
      type: String,
      reflect: true
    },
    variant: {
      type: String,
      reflect: true
    },
    name: {
      type: String,
      reflect: true
    },
    value: {
      type: String,
      reflect: true
    },
    checked: {
      type: Boolean,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    invalid: {
      type: Boolean,
      reflect: true
    },
    helperText: {
      type: String,
      reflect: true,
      attribute: "helper-text"
    },
    withHelperText: {
      type: Boolean,
      reflect: true,
      attribute: "with-helper-text"
    },
    size: {
      type: String,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    }
  };
  static validators = {
    label: {
      property(value, context) {
        if (!this.shadowRoot) return;
        const slot = this.shadowRoot.querySelector("slot:not([name])");
        const missingSlot = hasContent.call(this, slot, {
          tagName: "clg-radio",
          key: "[default]"
        });
        if (!missingSlot) return;
        return required.call(this, value, context);
      }

    },
    "[default]": {
      slot(slot, context) {
        const missingLabel = required.call(this, this.label, {
          tagName: "clg-radio",
          key: "label"
        });
        if (!missingLabel) return;
        return hasContent.call(this, slot, context);
      }

    },
    value: required
  };
  static delegatedEvents = ["slotchange"];
  /** Accessible label for the radio */

  constructor() {
    super();
    this.checked = false;
    this.backgroundType = "dynamic";
    this.size = "base";
    this.invalid = false;
    this.disabled = false;
    this.withHelperText = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "radio");
  }

  willUpdate(changed) {
    super.willUpdate(changed);

    if (!this.hasSlotContent("helper-text")) {
      this.withHelperText = Boolean(this.helperText && this.helperText.length > 0);
    }
  }

  update(changed) {
    super.update(changed);

    if (changed.has("checked")) {
      this.setAttribute("aria-checked", String(this.checked));
    }

    if (changed.has("disabled")) {
      this.setAttribute("aria-disabled", String(this.disabled));
    }

    if (changed.has("invalid")) {
      this.setAttribute("aria-invalid", String(this.invalid));
    }
  }

  handleEvent(event) {
    const {
      intention,
      target
    } = this.findClosestIntention(event);

    if (intention === "HELPER_TEXT_SLOT_CHANGE") {
      if (!(target instanceof HTMLSlotElement)) return;

      if (target.name === "helper-text") {
        this.withHelperText = this.hasSlotContent("helper-text");
      }
    }
  }

}
ClgRadio.define("clg-radio");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-radio-group.mustache






(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_radio_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-radio-group\" role=\"radiogroup\" aria-labelledby=\"label\"");t.b("\n" + i);t.b("	");if(t.s(t.f("orientation",c,p,1),c,p,0,88,123,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" aria-orientation=\"");t.b(t.v(t.f("orientation",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("	:aria-orientation=\"orientation\"");t.b("\n" + i);t.b("	");if(t.s(t.f("required",c,p,1),c,p,0,187,216,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" aria-required=\"");t.b(t.v(t.f("required",c,p,0)));t.b("\"");});c.pop();}t.b("  ");t.b("\n" + i);t.b("    :aria-required=\"required\"");t.b("\n" + i);t.b("	");if(t.s(t.f("disabled",c,p,1),c,p,0,276,297,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" aria-disabled=\"true\"");});c.pop();}t.b(" ");t.b("\n" + i);t.b("    ");if(t.s(t.f("error",c,p,1),c,p,0,326,347,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" aria-invalid=\"false\"");});c.pop();}t.b("\n" + i);t.b("    :aria-invalid=\"invalid\"");t.b("\n" + i);t.b(">");t.b("\n" + i);t.b("    <div class=\"clg-radio-group__label\" id=\"label\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-label.mustache0",c,p,"        "));t.b("    </div>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-helper-text.mustache1",c,p,"	"));t.b("	<div class=\"clg-radio-group__content\"><slot></slot></div>");t.b("\n" + i);t.b("</div>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-error.mustache2",c,p,""));t.b(t.rp("<collage/subcomponents/clg-form-field-caption.mustache3",c,p,""));return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-label.mustache0":{name:"collage/subcomponents/clg-form-field-label.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-helper-text.mustache1":{name:"collage/subcomponents/clg-form-field-helper-text.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-error.mustache2":{name:"collage/subcomponents/clg-form-field-error.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-caption.mustache3":{name:"collage/subcomponents/clg-form-field-caption.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_radio_group_mustache_tmpl.name = "collage/clg-radio-group.mustache";
(hogan_default()).partialsMap[clg_radio_group_mustache_tmpl.name] = clg_radio_group_mustache_tmpl;

const clg_radio_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_radio_group_mustache_tmpl.render.call(clg_radio_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_radio_group_mustache_render.template = clg_radio_group_mustache_tmpl;
/* harmony default export */ const clg_radio_group_mustache = (clg_radio_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/radio/clg-radio-group.ts





const clg_radio_group_DESCRIBEDBY_IDS = {
  ERROR: "error-message",
  CAPTION: "caption",
  HELPER: "helper-text"
};
/**
 * @tagname clg-radio-group
 *
 * A container for `clg-radio` elements that manages selection and shared attributes.
 *
 * @slot - clg-radio elements
 * @slot label - The label for the radio group
 * @slot helper-text - The helper text for the radio group
 * @slot caption - The caption for the radio group
 */

class ClgRadioGroup extends CollageFormElement {
  static template = clg_radio_group_mustache;
  static validators = {
    label: {
      property: required,
      slot: hasContent
    }
  };
  static properties = {
    variant: {
      type: String,
      reflect: true
    },
    value: {
      type: String
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    orientation: {
      type: String,
      reflect: true
    },
    required: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    backgroundType: {
      type: String,
      reflect: true,
      attribute: "background-type"
    }
  };
  /** Visual style variant, default is subtle */

  /** The roving tabindex controller for the radio group */
  #roving;

  get #radios() {
    return Array.from(this.querySelectorAll("clg-radio"));
  }

  get #radioGroup() {
    return this.renderRoot.querySelector('[role="radiogroup"]');
  }

  constructor() {
    super();
    this.variant = "strong";
    this.value = this.getAttribute("value") ?? "";
    this.disabled = false;
    this.backgroundType = "dynamic";
    this.size = "base";
    this.orientation = "vertical";
  }

  willUpdate(changed) {
    super.willUpdate(changed);

    if (!this.hasUpdated) {
      const checkedRadio = this.querySelector("clg-radio[checked]") || this.#radios.find(radio => radio.checked) || null;
      const checkedRadioValue = checkedRadio ? checkedRadio.value : ""; // Defer to checked item over the this element's value

      this.value = checkedRadioValue || this.value; // Make sure that the radio is actually checked

      if (this.value && this.value !== checkedRadioValue) {
        const toBeSelectedRadio = this.querySelector(`clg-radio[value="${this.value}"]`) || this.#radios.find(radio => radio.value === this.value);

        if (toBeSelectedRadio) {
          toBeSelectedRadio.checked = true;
        }
      }
    }

    this.validate();
  }

  update(changed) {
    super.update(changed);

    if (changed.has("value")) {
      this.internals.setFormValue(this.value);
    }

    this.#syncRadios();
    this.#updateDescribedByIds();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
  }

  firstUpdated(changed) {
    super.firstUpdated(changed);
    const observer = new MutationObserver(() => this.#handleChildrenChanged());
    observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true
    });
    this.onDisconnect(() => {
      observer?.disconnect();
    });
    this.#roving = new RovingTabindexController(this, {
      focusInIndex: elements => {
        return elements.findIndex(el => {
          return this.value ? !el.disabled && el.value === this.value : !el.disabled;
        });
      },
      direction: () => this.orientation,
      elements: () => this.#radios,
      isFocusableElement: el => !el.hasAttribute("disabled"),
      // When roving to a new radio, update the selected value to the newly focused radio
      elementEnterAction: el => {
        if (!(el instanceof ClgRadio)) return;
        this.#handleRadioClick(el);
      }
    });
    this.#roving.manage();
  }

  getValidity() {
    const hasCustomValidity = this.customValidityMessage.length > 0;
    const isMissing = this.required && this.value === "";

    if (!hasCustomValidity && !isMissing) {
      if (!this.error) {
        // Preserve invalid state if error property is used
        this.invalid = false;
        this.validationMessage = "";
      }

      return {
        flags: {}
      };
    }

    const validationMessage = hasCustomValidity ? this.getCustomValidity() : isMissing ? emptyInputErrorMsg : "";
    const flags = {
      customError: hasCustomValidity,
      valueMissing: isMissing
    };

    if (!this.error) {
      // Preserve invalid state if error property is used
      // Don't show error state if not touched
      this.invalid = this.touched;
      this.validationMessage = validationMessage;
    }

    return {
      flags,
      message: validationMessage
    };
  }

  #syncRadios() {
    for (const radio of this.#radios) {
      radio.variant = this.variant;
      radio.backgroundType = this.backgroundType;
      radio.invalid = this.invalid ?? false;
      radio.size = this.size;
      radio.disabled = this.disabled;
      const shouldBeChecked = radio.value === this.value && this.value !== "";
      radio.checked = shouldBeChecked;
    }
  }

  #updateDescribedByIds() {
    const ids = [];

    if (this.invalid) {
      ids.push(clg_radio_group_DESCRIBEDBY_IDS.ERROR);
    }

    if (this.withCaption) {
      ids.push(clg_radio_group_DESCRIBEDBY_IDS.CAPTION);
    }

    if (this.withHelperText) {
      ids.push(clg_radio_group_DESCRIBEDBY_IDS.HELPER);
    }

    if (ids.length > 0) {
      this.#radioGroup?.setAttribute("aria-describedby", ids.join(" "));
    } else {
      this.#radioGroup?.removeAttribute("aria-describedby");
    }
  }

  #handleInput = () => {
    return !this.dispatchEvent(new Event("input", {
      bubbles: true,
      composed: true,
      cancelable: true
    }));
  };
  #handleChange = () => {
    return !this.dispatchEvent(new Event("change", {
      bubbles: true,
      composed: true,
      cancelable: true
    }));
  };
  /** Handle a list item click/activation */

  #handleRadioClick(item) {
    // If the radio group or radio is disabled, don't allow the click
    if (this.disabled || item.disabled) return;
    const clickedValue = item.value ?? "";

    if (this.value !== clickedValue) {
      const oldValue = this.value;
      this.value = clickedValue;
      const inputPrevented = this.#handleInput();
      const changePrevented = this.#handleChange();

      if (inputPrevented || changePrevented) {
        this.value = oldValue;
      } else {
        for (const radioItem of this.#radios) {
          radioItem.checked = radioItem.value === clickedValue;
        }
      }
    }
  }

  #onClick = ev => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const el = target.closest("clg-radio");
    if (!el || !this.contains(el)) return;
    this.#handleRadioClick(el);
  };
  #handleChildrenChanged = () => {
    this.#roving?.clearElementCache();
    this.#syncRadios();
  };

  formResetCallback() {
    super.formResetCallback(); // Restore initial/default value on reset

    this.value = this.getAttribute("value") ?? "";
  }

  formStateRestoreCallback(state) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.value = state;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
    this.#roving?.unmanage();
  }

  focus() {
    this.#roving?.focus();
  }

}
ClgRadioGroup.define("clg-radio-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-checkbox.mustache





(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_checkbox_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-checkbox\">");t.b("\n" + i);t.b("	<label class=\"clg-checkbox__with-label\">");t.b("\n" + i);t.b("        <clg-checkbox-square ");if(t.s(t.f("size",c,p,1),c,p,0,107,122,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("size=\"");t.b(t.v(t.f("size",c,p,0)));t.b("\"");});c.pop();}t.b(" ");if(t.s(t.f("checked",c,p,1),c,p,0,144,151,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("checked");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,174,181,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("invalid");});c.pop();}t.b(" ");if(t.s(t.f("disabled",c,p,1),c,p,0,205,214,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" disabled");});c.pop();}t.b(" :invalid :size :disabled :checked :focused></clg-checkbox-square>");t.b("\n" + i);t.b("		<input x-on:change=\"CHANGE\" type=\"checkbox\" id=\"checkbox\" class=\"clg-checkbox__input\"");t.b("\n" + i);t.b("			");if(t.s(t.f("checked",c,p,1),c,p,0,397,406,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" checked ");});c.pop();}t.b("\n" + i);t.b("			");if(t.s(t.f("required",c,p,1),c,p,0,435,445,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" required ");});c.pop();}t.b("\n" + i);t.b("			");if(t.s(t.f("value",c,p,1),c,p,0,472,490,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" value=\"");t.b(t.v(t.f("value",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("			");if(t.s(t.f("disabled",c,p,1),c,p,0,517,525,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b("\n" + i);t.b("			");if(t.s(t.f("name",c,p,1),c,p,0,551,567,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" name=\"");t.b(t.v(t.f("name",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("			");if(t.s(t.f("error",c,p,1),c,p,0,590,610,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(" aria-invalid=\"true\"");});c.pop();}t.b("\n" + i);t.b("			aria-describedby=\"");if(t.s(t.f("with-caption",c,p,1),c,p,0,659,666,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("caption");});c.pop();}t.b(" ");if(t.s(t.f("with-helper-text",c,p,1),c,p,0,705,716,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("helper-text");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,748,761,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("error-message");});c.pop();}t.b("\"");t.b("\n" + i);t.b("			:disabled");t.b("\n" + i);t.b("			:required");t.b("\n" + i);t.b("			:aria-invalid=\"invalid\"");t.b("\n" + i);t.b("			:name");t.b("\n" + i);t.b("			:checked");t.b("\n" + i);t.b("		>");t.b("\n" + i);t.b("		<div>");t.b("\n" + i);t.b("			<div class=\"clg-checkbox__label-text\">");t.b("\n" + i);t.b("				<slot class=\"clg-checkbox__label\" x-text=\"label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</slot>");t.b("\n" + i);t.b("			</div>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-helper-text.mustache0",c,p,"			"));t.b("		</div>");t.b("\n" + i);t.b("	</label>");t.b("\n" + i);t.b("    <div class=\"clg-checkbox__after\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-caption.mustache1",c,p,"        "));t.b("        <div ");if(t.s(t.f("hide-error-text",c,p,1),c,p,0,1206,1212,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("hidden");});c.pop();}t.b(" x-hide=\"hideErrorText\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-error.mustache2",c,p,"            "));t.b("        </div>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-helper-text.mustache0":{name:"collage/subcomponents/clg-form-field-helper-text.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-caption.mustache1":{name:"collage/subcomponents/clg-form-field-caption.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-error.mustache2":{name:"collage/subcomponents/clg-form-field-error.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_checkbox_mustache_tmpl.name = "collage/clg-checkbox.mustache";
(hogan_default()).partialsMap[clg_checkbox_mustache_tmpl.name] = clg_checkbox_mustache_tmpl;

const clg_checkbox_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_checkbox_mustache_tmpl.render.call(clg_checkbox_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_checkbox_mustache_render.template = clg_checkbox_mustache_tmpl;
/* harmony default export */ const clg_checkbox_mustache = (clg_checkbox_mustache_render);

;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-checkbox-square.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_checkbox_square_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-checkbox-square\">");t.b("\n" + i);t.b("	<clg-icon class=\"clg-checkbox-square__check\" name=\"check\"></clg-icon>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_checkbox_square_mustache_tmpl.name = "collage/clg-checkbox-square.mustache";
(hogan_default()).partialsMap[clg_checkbox_square_mustache_tmpl.name] = clg_checkbox_square_mustache_tmpl;

const clg_checkbox_square_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_checkbox_square_mustache_tmpl.render.call(clg_checkbox_square_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_checkbox_square_mustache_render.template = clg_checkbox_square_mustache_tmpl;
/* harmony default export */ const clg_checkbox_square_mustache = (clg_checkbox_square_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/checkbox/clg-checkbox-square.ts



/**
 * @tagname clg-checkbox-square
 *
 * @dependency clg-icon
 *
 * @summary A checkbox square display element.
 */

class ClgCheckboxSquare extends CollageElement {
  static template = clg_checkbox_square_mustache;
  static properties = {
    checked: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    invalid: {
      type: Boolean,
      reflect: true
    },
    focused: {
      type: Boolean,
      reflect: true
    }
  };
  /** Whether the radio is selected */

  constructor() {
    super();
    this.checked = false;
    this.size = "base";
    this.invalid = false;
    this.disabled = false;
    this.focused = false;
  }

  update(changed) {
    super.update(changed);

    if (changed.has("checked") && changed.get("checked") !== undefined) {
      // Only add the `animation` CSS property if the checked value changes
      // after the first render (the changed value is always undefined on first render)
      this.toggleAttribute("rendered", true);
    }
  }

}
ClgCheckboxSquare.define("clg-checkbox-square");
;// ./htdocs/assets/js/collage/web-components/components/checkbox/clg-checkbox.ts



const clg_checkbox_DESCRIBEDBY_IDS = {
  ERROR: "error-message",
  CAPTION: "caption",
  HELPER: "helper-text"
};
/**
 * @tagname clg-checkbox
 *
 * @dependency clg-checkbox-square
 *
 * @slot - Label for the checkbox
 * @slot helper-text - Additional instructions or context for the checkbox
 * @slot caption - Additional instructions or context for the checkbox
 *
 * @fires {Event} change - Fires when the input value changes
 * @fires {FocusEvent} focus - Fires when the input gains focus
 * @fires {FocusEvent} blur - Fires when the input loses focus
 */

class ClgCheckbox extends CollageFormElement {
  static template = clg_checkbox_mustache;
  static shadowRootOptions = { ...CollageFormElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    label: {
      property(value, context) {
        if (!this.shadowRoot) return;
        const slot = this.shadowRoot.querySelector("slot:not([name])");
        const missingSlot = hasContent.call(this, slot, {
          tagName: "clg-checkbox",
          key: "[default]"
        });
        if (!missingSlot) return;
        return required.call(this, value, context);
      }

    },
    "[default]": {
      slot(slot, context) {
        const missingLabel = required.call(this, this.label, {
          tagName: "clg-checkbox",
          key: "label"
        });
        if (!missingLabel) return;
        return hasContent.call(this, slot, context);
      }

    },
    value: required
  };
  static delegatedEvents = ["change", "input"];
  /**
   * Necessary for Formik support
   * @internal
   */

  type = "checkbox";
  /** Whether the checkbox is checked */

  static properties = {
    checked: {
      type: Boolean,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    required: {
      type: Boolean,
      reflect: true
    },
    optional: {
      type: Boolean,
      reflect: true
    },
    value: {
      type: String
    },
    hideErrorText: {
      type: Boolean,
      reflect: true,
      attribute: "hide-error-text"
    },
    focused: {
      type: Boolean
    }
  };

  constructor() {
    super();
    this.disabled = false;
    this.checked = false;
    this.size = "base";
    this.required = false;
    this.optional = false;
    this.value = "on";
    this.caption = "";
    this.helperText = "";
    this.hideErrorText = false;
    this.focused = false;
  }

  get input() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.shadowRoot.querySelector("input");
  }
  /** @internal */


  #initialCheckedState = false;

  connectedCallback() {
    super.connectedCallback();

    if (this.input) {
      this.#initialCheckedState = this.checked;
    }
  }

  firstUpdated(changed) {
    super.firstUpdated(changed); // Focus and blur events don't bubble to the shadow root,
    // so adding them manually in lieu of delegatedEvents

    this.input.addEventListener("focus", this.#handleFocus);
    this.input.addEventListener("blur", this.#handleBlur);
    this.onDisconnect(() => {
      this.input?.removeEventListener("focus", this.#handleFocus);
      this.input?.removeEventListener("blur", this.#handleBlur);
    });
  }

  willUpdate(changed) {
    super.willUpdate(changed); // Only run on first update
    // Normally, we'd use the "checked" attribute for the initial form state.
    // But Preact might strip out the checked attribute and just set the property on the element.
    // So this workaround for supporting `defaultChecked` is here for Preact.

    if (!this.hasUpdated && this.hasAttribute("defaultchecked") && !this.checked) {
      this.checked = this.getAttribute("defaultchecked") === "true";
    } // We call updateValidity in `willUpdate` and `updated`
    // If the checkbox validity changes, we can only detect that after a render (in `updated`)
    // If not, all other factors into the validity should still be accurate here. It's
    // the difference of only this render running, or 1-2 more renders if we wait until `updated`.


    this.validate();
  }

  update(changed) {
    super.update(changed);

    if (changed.has("checked")) {
      this.internals.setFormValue(this.checked ? this.value : null);

      if (this.checked !== this.input.checked) {
        // Programmatically updating the input value can break HTML Constraint Validation.
        // So only update when the values are different.
        this.input.checked = this.checked;
      }
    }

    this.#updateDescribedByIds(); // We call validate in `willUpdate` and `updated`
    // If the input validity changes, we can only detect that after a render (in `updated`)
    // If not, all other factors into the validity should still be accurate here. It's
    // the difference of only this render running, or 1-2 more renders if we wait until `updated`.

    this.validate();
  }

  updated(changed) {
    super.updated(changed);
    this.updateComplete.then(() => this.validate());
  }

  formResetCallback() {
    super.formResetCallback();
    this.checked = this.getAttribute("defaultchecked") === "true" || this.#initialCheckedState;
  }

  formStateRestoreCallback(state) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.checked = state === this.value;
  }

  getValidity() {
    const hasCustomValidity = this.customValidityMessage.length > 0;

    if (!hasCustomValidity && this.input.validity.valid) {
      if (!this.error) {
        // Preserve invalid state if error property is used
        this.invalid = false;
        this.validationMessage = "";
      }

      return {
        flags: {}
      };
    }

    const validationMessage = hasCustomValidity ? this.getCustomValidity() : this.input.validationMessage;
    const flags = {
      customError: hasCustomValidity,
      valueMissing: this.input.validity.valueMissing
    };

    if (!this.error) {
      // Preserve invalid state if error property is used
      // Don't show error state if not touched
      this.invalid = this.touched;
      this.validationMessage = validationMessage;
    }

    return {
      flags,
      message: validationMessage
    };
  }
  /** Sets focus to the checkbox. */


  focus(options) {
    if (!this.input || this.isUpdatePending) {
      this.updateComplete.then(() => {
        this.input.focus(options);
      });
    } else {
      this.input.focus(options);
    }
  }
  /** Removes focus from the checkbox. */


  blur() {
    this.input.blur();
  }

  click() {
    this.input.click();
  }

  handleEvent(e) {
    const {
      intention,
      target
    } = this.findClosestIntention(e);

    switch (intention) {
      case "INPUT":
        if (target instanceof HTMLInputElement) {
          this.value = target.value;
        }

        break;

      case "CHANGE":
        if (target instanceof HTMLInputElement) {
          this.checked = target.checked;
          this.dispatchEvent(new Event("change", {
            bubbles: true,
            composed: true
          }));
        }

        break;

      default:
    }
  }

  #updateDescribedByIds() {
    const ids = [];

    if (this.invalid) {
      ids.push(clg_checkbox_DESCRIBEDBY_IDS.ERROR);
    }

    if (this.withCaption) {
      ids.push(clg_checkbox_DESCRIBEDBY_IDS.CAPTION);
    }

    if (this.withHelperText) {
      ids.push(clg_checkbox_DESCRIBEDBY_IDS.HELPER);
    }

    if (ids.length > 0) {
      this.input.setAttribute("aria-describedby", ids.join(" "));
    } else {
      this.input.removeAttribute("aria-describedby");
    }
  }

  #handleFocus = () => {
    try {
      this.focused = this.input.matches(":focus-visible"); // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // The above will error in browsers/engines that don't recognize :focus-visible,
      // so here we'll fallback to :focus
      this.focused = this.input.matches(":focus");
    }

    this.dispatchEvent(new FocusEvent("focus", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
  #handleBlur = () => {
    this.focused = false;
    this.dispatchEvent(new FocusEvent("blur", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
}
ClgCheckbox.define("clg-checkbox");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-checkbox-group.mustache






(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_checkbox_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<fieldset class=\"clg-checkbox-group\" ");t.b("\n" + i);t.b("        aria-describedby=\"");if(t.s(t.f("with-caption",c,p,1),c,p,0,81,88,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("caption");});c.pop();}t.b(" ");if(t.s(t.f("with-helper-text",c,p,1),c,p,0,127,138,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("helper-text");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,170,183,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("error-message");});c.pop();}t.b("\"");t.b("\n" + i);t.b("        ");if(t.s(t.f("orientation",c,p,1),c,p,0,219,253,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-orientation=\"");t.b(t.v(t.f("orientation",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("        ");if(t.s(t.f("required",c,p,1),c,p,0,291,319,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-required=\"");t.b(t.v(t.f("required",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("        :aria-invalid=\"invalid\"");t.b("\n" + i);t.b("        :disabled");t.b("\n" + i);t.b("        :aria-required=\"required\"");t.b("\n" + i);t.b("        :aria-orientation=\"orientation\"");t.b("\n" + i);t.b("    >");t.b("\n" + i);t.b("        <div class=\"clg-checkbox-group__before\" id=\"label\">");t.b("\n" + i);t.b("            <legend class=\"clg-checkbox-group__legend\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-label.mustache0",c,p,"                "));t.b("            </legend>");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-helper-text.mustache1",c,p,"            "));t.b("        </div>");t.b("\n" + i);t.b("        <div class=\"clg-checkbox-group__content\"><slot></slot></div>");t.b("\n" + i);t.b("        <div class=\"clg-checkbox-group__after\">");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-form-field-caption.mustache2",c,p,"            "));t.b(t.rp("<collage/subcomponents/clg-form-field-error.mustache3",c,p,"            "));t.b("        </div>");t.b("\n" + i);t.b("</fieldset>");return t.fl(); },partials: {"<collage/subcomponents/clg-form-field-label.mustache0":{name:"collage/subcomponents/clg-form-field-label.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-helper-text.mustache1":{name:"collage/subcomponents/clg-form-field-helper-text.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-caption.mustache2":{name:"collage/subcomponents/clg-form-field-caption.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-form-field-error.mustache3":{name:"collage/subcomponents/clg-form-field-error.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_checkbox_group_mustache_tmpl.name = "collage/clg-checkbox-group.mustache";
(hogan_default()).partialsMap[clg_checkbox_group_mustache_tmpl.name] = clg_checkbox_group_mustache_tmpl;

const clg_checkbox_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_checkbox_group_mustache_tmpl.render.call(clg_checkbox_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_checkbox_group_mustache_render.template = clg_checkbox_group_mustache_tmpl;
/* harmony default export */ const clg_checkbox_group_mustache = (clg_checkbox_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/checkbox/clg-checkbox-group.ts



/**
 * @tagname clg-checkbox-group
 *
 * @dependency clg-icon
 *
 * @slot - clg-checkbox elements
 * @slot label - The label for the checkbox group
 * @slot helper-text - Additional instructions or context for the text field
 * @slot caption - Additional instructions or context for the text field
 */

class ClgCheckboxGroup extends CollageFormElement {
  static template = clg_checkbox_group_mustache;
  static validators = {
    label: {
      property: required,
      slot: hasContent
    }
  };
  /** Size of the checkbox group */

  static properties = {
    size: {
      type: String,
      reflect: true
    },
    required: {
      type: Boolean,
      reflect: true
    },
    optional: {
      type: Boolean,
      reflect: true
    },
    orientation: {
      type: String,
      reflect: true
    }
  }; // Get the checkboxes within the group

  #getCheckboxes() {
    return Array.from(this.querySelectorAll("clg-checkbox"));
  }

  constructor() {
    super();
    this.size = "base";
    this.required = false;
    this.optional = false;
    this.orientation = "vertical";
    this.helperText = "";
    this.caption = "";
  }

  willUpdate(changed) {
    super.willUpdate(changed);
    this.validate();
  }

  update(changed) {
    super.update(changed);

    if (changed.has("invalid")) {
      this.#syncInvalid();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("change", this.#onChange);
  } // If one of the child checkboxes changes, re-check validity


  #onChange = e => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    this.validate();
  };

  getValidity() {
    const hasCustomValidity = this.customValidityMessage.length > 0;
    const isMissing = this.required && !this.#hasSelection();

    if (!hasCustomValidity && !isMissing) {
      if (!this.error) {
        // Preserve invalid state if error property is used
        this.invalid = false;
        this.validationMessage = "";
      }

      return {
        flags: {}
      };
    }

    const validationMessage = hasCustomValidity ? this.getCustomValidity() : isMissing ? "Please fill out this field." : "";
    const flags = {
      customError: hasCustomValidity,
      valueMissing: isMissing
    };

    if (!this.error) {
      // Preserve invalid state if error property is used
      // Don't show error state if not touched
      this.invalid = this.touched;
      this.validationMessage = validationMessage;
    }

    return {
      flags,
      message: validationMessage
    };
  } // Check if any of the child checkboxes are checked


  #hasSelection() {
    for (const checkBox of this.#getCheckboxes()) {
      if (checkBox.checked) {
        return true;
      }
    }

    return false;
  }

  #syncInvalid() {
    for (const checkBox of this.#getCheckboxes()) {
      checkBox.error = this.invalid ? this.validationMessage : "";
    }
  }

  formResetCallback() {
    super.formResetCallback();
    this.updateComplete.then(() => {
      this.validate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("change", this.#onChange);
  }

}
ClgCheckboxGroup.define("clg-checkbox-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-on-image.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_on_image_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-on-image\">");t.b("\n" + i);t.b("    <div class=\"clg-on-image-top-start\">");t.b("\n" + i);t.b("        <slot name=\"top-start\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-on-image-top-end\">");t.b("\n" + i);t.b("        <slot name=\"top-end\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-on-image-bottom-start\">");t.b("\n" + i);t.b("        <slot name=\"bottom-start\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-on-image-bottom-end\">");t.b("\n" + i);t.b("        <slot name=\"bottom-end\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_on_image_mustache_tmpl.name = "collage/clg-on-image.mustache";
(hogan_default()).partialsMap[clg_on_image_mustache_tmpl.name] = clg_on_image_mustache_tmpl;

const clg_on_image_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_on_image_mustache_tmpl.render.call(clg_on_image_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_on_image_mustache_render.template = clg_on_image_mustache_tmpl;
/* harmony default export */ const clg_on_image_mustache = (clg_on_image_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/on-image/clg-on-image.ts


/**
 * @tagname clg-on-image
 * @slot top-start - Content placed in the top left corner of the image.
 * @slot top-end - Content placed in the top right corner of the image.
 * @slot bottom-start - Content placed in the bottom left corner of the image.
 * @slot bottom-end - Content placed in the bottom right corner of the image.
 * @slot - holds the image
 *
 * @description
 * The clg-on-image component is used to display content on top of an image.
 * It is a sub-component to be used inside the clg-image-tile component.
 */

class ClgOnImage extends CollageElement {
  static template = clg_on_image_mustache;
}
ClgOnImage.define("clg-on-image");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-removable-chip.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_removable_chip_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<button type=\"button\" class=\"clg-removable-chip\" ");if(t.s(t.f("disabled",c,p,1),c,p,0,62,70,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :disabled>");t.b("\n" + i);t.b("    <span class=\"clg-removable-chip__container\">");t.b("\n" + i);t.b("        <slot name=\"icon\"></slot>");t.b("\n" + i);t.b("        <span class=\"clg-removable-chip__text-container\" x-text=\"label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</span>");t.b("\n" + i);t.b("        <clg-icon name=\"close\" size=\"smaller\"></clg-icon>");t.b("\n" + i);t.b("    </span>");t.b("\n" + i);t.b("</button>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_removable_chip_mustache_tmpl.name = "collage/clg-removable-chip.mustache";
(hogan_default()).partialsMap[clg_removable_chip_mustache_tmpl.name] = clg_removable_chip_mustache_tmpl;

const clg_removable_chip_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_removable_chip_mustache_tmpl.render.call(clg_removable_chip_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_removable_chip_mustache_render.template = clg_removable_chip_mustache_tmpl;
/* harmony default export */ const clg_removable_chip_mustache = (clg_removable_chip_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/chip/clg-removable-chip.ts




/**
 * @tagname clg-removable-chip
 *
 * @dependency clg-icon
 *
 * @slot icon - optionally appears before the label
 */

class ClgRemovableChip extends CollageElement {
  static template = clg_removable_chip_mustache;
  static properties = {
    label: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    label: required
  };
  /**
   * The text content of the removable chip
   * @required
   */

  get #button() {
    return this.shadowRoot?.querySelector("button.clg-removable-chip");
  }

  update(changed) {
    super.update(changed);

    if (changed.has("label")) {
      this.#button?.setAttribute("aria-label", removeAriaLabelMsg({
        label: this.label
      }));
    }
  }

  constructor() {
    super();
    this.size = "base";
    this.disabled = false;
  }

}
ClgRemovableChip.define("clg-removable-chip");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-removable-chip-group.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_removable_chip_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-removable-chip-group\" role=\"group\" aria-labelledby=\"screen-reader-label\">");t.b("\n" + i);t.b("  <span class=\"clg-screen-reader-only\" id=\"screen-reader-label\" x-text=\"label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</span>");t.b("\n" + i);t.b("  <slot></slot>");t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_removable_chip_group_mustache_tmpl.name = "collage/clg-removable-chip-group.mustache";
(hogan_default()).partialsMap[clg_removable_chip_group_mustache_tmpl.name] = clg_removable_chip_group_mustache_tmpl;

const clg_removable_chip_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_removable_chip_group_mustache_tmpl.render.call(clg_removable_chip_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_removable_chip_group_mustache_render.template = clg_removable_chip_group_mustache_tmpl;
/* harmony default export */ const clg_removable_chip_group_mustache = (clg_removable_chip_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/events/chip-remove.ts
class ClgChipRemoveEvent extends Event {
  detail;

  constructor(detail) {
    super("clg-chip-remove", {
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.detail = detail;
  }

}
;// ./htdocs/assets/js/collage/web-components/components/chip/clg-removable-chip-group.ts





/**
 * @tagname clg-removable-chip-group
 * @slot - one or more clg-removable-chip

 * @fires {ClgChipRemoveEvent} clg-chip-remove - Event fired when a chip in the group is clicked
 *
 */

class ClgRemovableChipGroup extends CollageElement {
  static template = clg_removable_chip_group_mustache;
  static properties = {
    label: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    label: required
  };
  /**
   * The (screen reader only) aria label of the removable chip group
   * @required
   */

  static delegatedEvents = ["click"];
  /** @internal */

  handleEvent(event) {
    if (event.type === "click") {
      const eventTarget = event.target;

      if (!(eventTarget instanceof HTMLElement)) {
        return;
      }

      const chip = eventTarget.closest("clg-removable-chip");

      if (!chip || chip.disabled) {
        return;
      }

      const defaultPrevented = !this.dispatchEvent(new ClgChipRemoveEvent({
        chip
      }));

      if (defaultPrevented) {
        return;
      }

      this.removeChip(chip);
    }
  }

  removeChip(chip) {
    this.announceChipRemoval(chip);
    chip.remove();
  }

  announceChipRemoval(removableChipEl) {
    const label = removableChipEl.getAttribute("label");

    if (label) {
      announce(chipRemovedAnnouncementMsg({
        label
      }), "polite");
    }
  }

}
ClgRemovableChipGroup.define("clg-removable-chip-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-card.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_card_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<article class=\"clg-card\" aria-labelledby=\"card-title\">");t.b("\n" + i);t.b("	<div class=\"clg-card__image\">");t.b("\n" + i);t.b("		<slot name=\"image\"></slot>");t.b("\n" + i);t.b("	</div>");t.b("\n" + i);t.b("	<div class=\"clg-card__content\">");t.b("\n" + i);t.b("		<a href=\"");t.b(t.v(t.f("href",c,p,0)));t.b("\" :href");t.b("\n" + i);t.b("			class=\"clg-card__link\"");t.b("\n" + i);t.b("			");if(t.s(t.f("target",c,p,1),c,p,0,224,243,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("target=\"");t.b(t.v(t.f("target",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("			:target");t.b("\n" + i);t.b("			");if(t.s(t.f("rel",c,p,1),c,p,0,277,290,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rel=\"");t.b(t.v(t.f("rel",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("			:rel");t.b("\n" + i);t.b("			id=\"card-title\"");t.b("\n" + i);t.b("		><slot name=\"title\"></slot></a>");t.b("\n" + i);t.b("		<slot></slot>");t.b("\n" + i);t.b("	</div>");t.b("\n" + i);t.b("</article>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_card_mustache_tmpl.name = "collage/clg-card.mustache";
(hogan_default()).partialsMap[clg_card_mustache_tmpl.name] = clg_card_mustache_tmpl;

const clg_card_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_card_mustache_tmpl.render.call(clg_card_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_card_mustache_render.template = clg_card_mustache_tmpl;
/* harmony default export */ const clg_card_mustache = (clg_card_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/card/clg-card.ts


/**
 * @tagname clg-card
 * @summary A card component that displays content in a card-like format.
 * When href is set, only the title (slot="title") is wrapped in the link so that
 * screen reader users hear only the card title when navigating by link; the whole
 * card remains clickable via CSS (stretched link pseudo-element).
 *
 * @slot image - A slot for image content or a clg-image-tile element.
 * @slot title - Content wrapped by the link (e.g. card title). Use when href is set.
 * @slot - A slot for content like a description, metadata, etc.
 *
 * @example
 * ```html
 * <clg-card href="/listing/123">
 *    <img slot="image" src="https://via.placeholder.com/150" alt="Placeholder image" />
 *    <h3 slot="title">Card title</h3>
 *    <p>Card description</p>
 * </clg-card>
 * ```
 */

class ClgCard extends CollageElement {
  static template = clg_card_mustache;
  static validators = {
    href: required
  };
  static properties = {
    imageLayout: {
      type: String,
      reflect: true,
      attribute: "image-layout"
    },
    container: {
      type: String,
      reflect: true
    },
    href: {
      type: String,
      reflect: true
    },
    target: {
      type: String,
      reflect: true
    },
    rel: {
      type: String,
      reflect: true
    }
  };
  /** Position of the image in the card */

  constructor() {
    super();
    this.imageLayout = "top";
    this.addEventListener("click", this.#onClick);
  }

  #onClick = event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("clg-card") !== this) return;
    this.#getStretchedLink()?.click();
  };

  #getStretchedLink() {
    return this.shadowRoot?.querySelector(".clg-card__link") ?? null;
  }

}
ClgCard.define("clg-card");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-profile-avatar.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_profile_avatar_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-profile-avatar\">");t.b("\n" + i);t.b("    <clg-shape class=\"clg-profile-avatar__shape\" name=\"special_shape_0");t.b(t.v(t.f("shape",c,p,0)));t.b("\" ");if(t.s(t.f("size",c,p,1),c,p,0,124,139,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("size=\"");t.b(t.v(t.f("size",c,p,0)));t.b("\"");});c.pop();}t.b(" :size=\"size\" ");if(t.s(t.f("border",c,p,1),c,p,0,173,179,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("border");});c.pop();}t.b(" :border=\"border\"></clg-shape>");t.b("\n" + i);t.b("    <span class=\"clg-profile-avatar__circle\"></span>");t.b("\n" + i);t.b("    <div class=\"clg-profile-avatar__content\">");t.b("\n" + i);t.b("        <slot x-on:slotchange=\"SLOT_OCCUPIED\">");t.b("\n" + i);t.b("            <div class=\"clg-profile-avatar__initial\">");t.b(t.v(t.f("initial",c,p,0)));t.b("</div>");t.b("\n" + i);t.b("        </slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-profile-avatar__dot-indicator\">");t.b("\n" + i);t.b("        <slot name=\"dot-indicator\"></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"clg-profile-avatar__badge\">");t.b("\n" + i);t.b("        <slot name=\"badge\">");t.b("\n" + i);t.b("            <clg-logo");t.b("\n" + i);t.b("                name=\"etsyapp_fillcolor\"");t.b("\n" + i);t.b("                class=\"clg-profile-avatar__badge-admin\"");t.b("\n" + i);t.b("            ></clg-logo>");t.b("\n" + i);t.b("            <div");t.b("\n" + i);t.b("                class=\"clg-profile-avatar__badge-star-seller\"");t.b("\n" + i);t.b("            >");t.b("\n" + i);t.b("                <clg-icon");t.b("\n" + i);t.b("                    name=\"starseller\"");t.b("\n" + i);t.b("                    class=\"clg-profile-avatar__badge-star-seller-icon\"");t.b("\n" + i);t.b("                ></clg-icon>");t.b("\n" + i);t.b("            </div>");t.b("\n" + i);t.b("        </slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_profile_avatar_mustache_tmpl.name = "collage/clg-profile-avatar.mustache";
(hogan_default()).partialsMap[clg_profile_avatar_mustache_tmpl.name] = clg_profile_avatar_mustache_tmpl;

const clg_profile_avatar_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_profile_avatar_mustache_tmpl.render.call(clg_profile_avatar_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_profile_avatar_mustache_render.template = clg_profile_avatar_mustache_tmpl;
/* harmony default export */ const clg_profile_avatar_mustache = (clg_profile_avatar_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/avatar/clg-profile-avatar.ts





/**
 * @tagname clg-profile-avatar
 *
 * @dependency clg-shape
 * @dependency clg-icon
 * @dependency clg-logo
 *
 * @slot - avatar content (image or initials)
 * @slot badge - the badge appearing on bottom right corner (e.g., etsy admin or star seller)
 */

class ClgProfileAvatar extends CollageElement {
  static template = clg_profile_avatar_mustache;
  /**
   * Color variant for the profile avatar.
   * @required
   */

  static properties = {
    color: {
      type: String,
      reflect: true
    },
    shape: {
      type: String,
      reflect: true
    },
    initial: {
      type: String,
      reflect: true
    },
    size: {
      type: String,
      reflect: true
    },
    badge: {
      type: String,
      reflect: true
    },
    border: {
      type: Boolean,
      reflect: true
    },
    withImage: {
      type: Boolean,
      reflect: true,
      attribute: "with-image"
    }
  };
  static validators = {
    color: required,
    shape: required,
    initial: required
  };
  static delegatedEvents = ["slotchange"];

  constructor() {
    super();
    this.size = "base";
    this.badge = false;
    this.border = false;
    this.withImage = false;
  }

  get #shape() {
    return this.shadowRoot?.querySelector("clg-shape");
  }

  update(changed) {
    super.update(changed);

    if (changed.has("shape")) {
      this.#shape?.setAttribute("name", `special_shape_0${this.shape}`);
    }
  }
  /** @internal */


  handleEvent(e) {
    const {
      intention
    } = this.findClosestIntention(e);

    if (intention === "SLOT_OCCUPIED") {
      this.withImage = this.hasSlotContent("[default]");
    }
  }

}
ClgProfileAvatar.define("clg-profile-avatar");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-shop-avatar.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_shop_avatar_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<span class=\"clg-shop-avatar\">");t.b("\n" + i);t.b("    <slot>");t.b("\n" + i);t.b("        <clg-icon name=\"shop\" ");if(t.s(t.f("size",c,p,1),c,p,0,81,96,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("size=\"");t.b(t.v(t.f("size",c,p,0)));t.b("\"");});c.pop();}t.b(" :size=\"size\"></clg-icon>");t.b("\n" + i);t.b("    </slot>");t.b("\n" + i);t.b("</span>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_shop_avatar_mustache_tmpl.name = "collage/clg-shop-avatar.mustache";
(hogan_default()).partialsMap[clg_shop_avatar_mustache_tmpl.name] = clg_shop_avatar_mustache_tmpl;

const clg_shop_avatar_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_shop_avatar_mustache_tmpl.render.call(clg_shop_avatar_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_shop_avatar_mustache_render.template = clg_shop_avatar_mustache_tmpl;
/* harmony default export */ const clg_shop_avatar_mustache = (clg_shop_avatar_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/avatar/clg-shop-avatar.ts



/**
 * @tagname clg-shop-avatar
 *
 * @dependency clg-icon
 *
 * @slot - The shop image. If none is provided, a fallback icon will be shown.
 */

class ClgShopAvatar extends CollageElement {
  static template = clg_shop_avatar_mustache;
  /**
   * Size variant for the shop avatar.
   */

  static properties = {
    size: {
      type: String,
      reflect: true
    },
    border: {
      type: Boolean,
      reflect: true
    }
  };

  constructor() {
    super();
    this.size = "base";
    this.border = false;
  }

}
ClgShopAvatar.define("clg-shop-avatar");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-avatar-group.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_avatar_group_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-avatar-group\">");t.b("\n" + i);t.b("    <slot name=\"shop\"></slot>");t.b("\n" + i);t.b("    <span class=\"clg-avatar-group__profile-avatar\"><slot name=\"profile\"></slot></span>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_avatar_group_mustache_tmpl.name = "collage/clg-avatar-group.mustache";
(hogan_default()).partialsMap[clg_avatar_group_mustache_tmpl.name] = clg_avatar_group_mustache_tmpl;

const clg_avatar_group_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_avatar_group_mustache_tmpl.render.call(clg_avatar_group_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_avatar_group_mustache_render.template = clg_avatar_group_mustache_tmpl;
/* harmony default export */ const clg_avatar_group_mustache = (clg_avatar_group_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/avatar/clg-avatar-group.ts


/**
 * @tagname clg-avatar-group
 *
 * @slot shop - The `<clg-shop-avatar>` that shows the shop's image.
 * @slot profile - The `<clg-profile-avatar>` that shows the person associated with the shop.
 *
 */

class ClgAvatarGroup extends CollageElement {
  static template = clg_avatar_group_mustache;
  /**
   * Size variant for the shop avatar.
   * @required
   */

  static properties = {
    size: {
      type: String,
      reflect: true
    }
  };
  static validators = {
    size: required
  };
}
ClgAvatarGroup.define("clg-avatar-group");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-slot-card.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_slot_card_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<article class=\"clg-slot-card\">");t.b("\n" + i);t.b("    <a href=\"");t.b(t.v(t.f("href",c,p,0)));t.b("\" :href");t.b("\n" + i);t.b("        class=\"clg-slot-card__link\"");t.b("\n" + i);t.b("        ");if(t.s(t.f("target",c,p,1),c,p,0,116,135,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("target=\"");t.b(t.v(t.f("target",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("        :target");t.b("\n" + i);t.b("        ");if(t.s(t.f("rel",c,p,1),c,p,0,179,192,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("rel=\"");t.b(t.v(t.f("rel",c,p,0)));t.b("\"");});c.pop();}t.b("\n" + i);t.b("        :rel");t.b("\n" + i);t.b("        x-on:pointerup=\"RELEASE\"");t.b("\n" + i);t.b("        x-on:click=\"CLICK\"");t.b("\n" + i);t.b("    ><slot name=\"title\"></slot></a>");t.b("\n" + i);t.b("    <slot></slot>");t.b("\n" + i);t.b("</article>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_slot_card_mustache_tmpl.name = "collage/clg-slot-card.mustache";
(hogan_default()).partialsMap[clg_slot_card_mustache_tmpl.name] = clg_slot_card_mustache_tmpl;

const clg_slot_card_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_slot_card_mustache_tmpl.render.call(clg_slot_card_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_slot_card_mustache_render.template = clg_slot_card_mustache_tmpl;
/* harmony default export */ const clg_slot_card_mustache = (clg_slot_card_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/slot-card/clg-slot-card.ts


/**
 * @tagname clg-slot-card
 * @description A card component that can be used to display content in a card-like format.
 * When href is set, only the title (slot="title") is wrapped in the link for better screen-reader
 * experience; the whole card remains clickable via CSS (stretched link pseudo-element).
 * The link's accessible name comes from the title slot content.
 *
 * @slot title - Content wrapped by the link (e.g. card title). Use when href is set.
 * @slot - Other card content (description, image, buttons, etc.)
 *
 * @example
 * ```html
 * <clg-slot-card href="/listing/123">
 *     <h3 slot="title">Product title</h3>
 *     <p>Price and description</p>
 * </clg-slot-card>
 * ```
 */

class ClgSlotCard extends CollageElement {
  static template = clg_slot_card_mustache;
  static validators = {
    href: required
  };
  static properties = {
    border: {
      type: Boolean,
      reflect: true
    },
    target: {
      type: String,
      reflect: true
    },
    href: {
      type: String,
      reflect: true
    },
    rel: {
      type: String,
      reflect: true
    }
  };
  /** Whether the card has a border */

  constructor() {
    super();
    this.addEventListener("click", this.#onClick);
  }

  #onClick = event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("clg-slot-card") !== this) return;
    this.#getLink()?.click();
  };
  #getLink = () => {
    return this.shadowRoot?.querySelector(".clg-slot-card__link");
  };
}
ClgSlotCard.define("clg-slot-card");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-image-tile.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_image_tile_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-image-tile\">");t.b("\n" + i);t.b("	<slot></slot>");t.b("\n" + i);t.b("	<div class=\"clg-image-tile__placeholder\"></div>");t.b("\n" + i);t.b("	<div class=\"clg-image-tile__placeholder\"></div>");t.b("\n" + i);t.b("	<div class=\"clg-image-tile__placeholder\"></div>");t.b("\n" + i);t.b("</div>");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_image_tile_mustache_tmpl.name = "collage/clg-image-tile.mustache";
(hogan_default()).partialsMap[clg_image_tile_mustache_tmpl.name] = clg_image_tile_mustache_tmpl;

const clg_image_tile_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_image_tile_mustache_tmpl.render.call(clg_image_tile_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_image_tile_mustache_render.template = clg_image_tile_mustache_tmpl;
/* harmony default export */ const clg_image_tile_mustache = (clg_image_tile_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/image-tile/clg-image-tile.ts


/**
 * @tagname clg-image-tile
 *
 * @summary A component that displays a one or more images in a specific layout (row, grid, mosaic).
 * @slot - This holds clg-on-image components, WtImage components, or plain img elements. These are used to display content on top of the image.
 * @example
 * <clg-image-tile layout="one-one">
 *     <clg-on-image>
 *         <clg-signal color="trust" variant="strong" size="base">Etsy's Pick</clg-signal>
 *         <img src="https://placehold.co/300x300/png" alt="Fallback Image" style="width: 100%; height: 100%; object-fit: cover;" />
 *     </clg-on-image>
 * </clg-image-tile>
 * @example
 * <clg-image-tile layout="one-one-row">
 *     <clg-on-image>
 *         <clg-signal color="trust" variant="strong" size="base">Etsy's Pick</clg-signal>
 *         <img src="https://placehold.co/300x300/png" alt="Fallback Image" />
 *     </clg-on-image>
 *     <clg-on-image>
 *         <clg-signal color="trust" variant="strong" size="base">Etsy's Pick</clg-signal>
 *         <img src="https://placehold.co/300x300/png" alt="Fallback Image" />
 *     </clg-on-image>
 * </clg-image-tile>
 *
 */

class ClgImageTile extends CollageElement {
  static template = clg_image_tile_mustache;
  static properties = {
    layout: {
      type: String,
      reflect: true
    },
    rounded: {
      type: Boolean,
      reflect: true
    },
    placeholders: {
      type: Number,
      reflect: true
    }
  };
  /** Layout of the image tile */

  #observer = null;

  willUpdate(changed) {
    super.willUpdate(changed);

    if (changed.has("layout")) {
      this.#checkForPlaceholder();
      this.#setupObserver();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#cleanupObserver();
  }

  #setupObserver() {
    if (!this.layout.includes("grid")) {
      this.#cleanupObserver();
      return;
    }

    if (this.#observer) return;
    this.#observer = new MutationObserver(() => {
      this.updateComplete.then(() => this.#checkForPlaceholder());
    });
    this.#observer.observe(this, {
      childList: true
    });
  }

  #cleanupObserver() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #checkForPlaceholder() {
    if (!this.layout.includes("grid")) return;
    this.placeholders = 4 - this.children.length;
  }

  constructor() {
    super();
    this.layout = "one-one";
    this.rounded = false;
    this.placeholders = 0;
  }

}
ClgImageTile.define("clg-image-tile");
;// ./htdocs/assets/js/collage/web-components/components/select/clg-select-optgroup.ts

/**
 * @tagname clg-select-optgroup
 */

class ClgSelectOptGroup extends CollageElement {
  /**
   * The name of the group of options.
   * @required
   */

  /** If true, none of the items in this option group is selectable */
  static properties = {
    label: {
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    }
  };
  static validators = {
    label: required
  };

  constructor() {
    super();
    this.disabled = false;
  }

}
ClgSelectOptGroup.define("clg-select-optgroup");
;// ./htdocs/assets/js/collage/web-components/components/select/clg-select-option.ts

/**
 * @tagname clg-select-option
 */

class ClgSelectOption extends CollageElement {
  /** Whether this option is selected */

  /** Whether this option can be selected */

  /** The value of this option. If not set, the text content will be used as the value. */
  static properties = {
    selected: {
      type: Boolean,
      reflect: true
    },
    disabled: {
      type: Boolean,
      reflect: true
    },
    value: {
      reflect: true
    }
  };

  willUpdate(changed) {
    super.willUpdate(changed);

    if (typeof this.value === "undefined") {
      this.value = this.textContent?.trim() || "";
    }
  }

  constructor() {
    super();
    this.selected = false;
    this.disabled = false;
  }

}
ClgSelectOption.define("clg-select-option");
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-select.mustache




(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_select_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-select\">");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-before.mustache0",c,p,"    "));t.b("\n" + i);t.b("    <div id=\"visual-box\" class=\"clg-select__visual-box\">");t.b("\n" + i);t.b("        <label for=\"input\" id=\"horizontal-label\" class=\"clg-select__inline-label\">");t.b(t.v(t.f("label",c,p,0)));t.b("</label>");t.b("\n");t.b("\n" + i);t.b("        <select class=\"clg-select__control\" id=\"input\" aria-describedby=\"");if(t.s(t.f("with-caption",c,p,1),c,p,0,339,346,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("caption");});c.pop();}t.b(" ");if(t.s(t.f("with-helper-text",c,p,1),c,p,0,385,396,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("helper-text");});c.pop();}t.b(" ");if(t.s(t.f("error",c,p,1),c,p,0,428,441,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("error-message");});c.pop();}t.b("\" ");if(t.s(t.f("disabled",c,p,1),c,p,0,466,474,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("disabled");});c.pop();}t.b(" :disabled ");if(t.s(t.f("required",c,p,1),c,p,0,511,519,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("required");});c.pop();}t.b(" :required ");if(t.s(t.f("invalid",c,p,1),c,p,0,555,574,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("aria-invalid=\"true\"");});c.pop();}t.b(" :aria-invalid=\"invalid\" ");if(t.s(t.f("name",c,p,1),c,p,0,620,635,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("name=\"");t.b(t.v(t.f("name",c,p,0)));t.b("\"");});c.pop();}t.b(" :name ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,668,699,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete  ");if(t.s(t.f("autocomplete",c,p,1),c,p,0,749,780,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autocomplete=\"");t.b(t.v(t.f("autocomplete",c,p,0)));t.b("\"");});c.pop();}t.b(" :autocomplete ");if(t.s(t.f("autofocus",c,p,1),c,p,0,826,835,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("autofocus");});c.pop();}t.b(" :autofocus x-on:input=\"INPUT\" x-on:change=\"CHANGE\">");t.b("\n" + i);t.b("            ");if(t.s(t.f("ssr-value",c,p,1),c,p,0,928,976,"{{ }}")){t.rs(c,p,function(c,p,t){t.b("<option disabled selected>");t.b(t.v(t.f("ssr-value",c,p,0)));t.b("</option>");});c.pop();}t.b("\n" + i);t.b("        </select>");t.b("\n");t.b("\n" + i);t.b("        <clg-icon name=\"directdown\" class=\"clg-select__icon\"></clg-icon>");t.b("\n" + i);t.b("	</div>");t.b("\n");t.b("\n" + i);t.b(t.rp("<collage/subcomponents/clg-text-field-after.mustache1",c,p,"    "));t.b("\n" + i);t.b("    <slot hidden></slot>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {"<collage/subcomponents/clg-text-field-before.mustache0":{name:"collage/subcomponents/clg-text-field-before.mustache", partials: {}, subs: {  }},"<collage/subcomponents/clg-text-field-after.mustache1":{name:"collage/subcomponents/clg-text-field-after.mustache", partials: {}, subs: {  }}}, subs: {  }}, "", (hogan_default()));
clg_select_mustache_tmpl.name = "collage/clg-select.mustache";
(hogan_default()).partialsMap[clg_select_mustache_tmpl.name] = clg_select_mustache_tmpl;

const clg_select_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_select_mustache_tmpl.render.call(clg_select_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_select_mustache_render.template = clg_select_mustache_tmpl;
/* harmony default export */ const clg_select_mustache = (clg_select_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/select/clg-select.ts








const clg_select_DESCRIBEDBY_IDS = {
  ERROR: "error-message",
  CAPTION: "caption",
  HELPER: "helper-text"
};
const PLACEHOLDER_CLASS = "clg-select__control--placeholder";
/**
 * @tagname clg-select
 *
 * @dependency clg-icon
 * @dependency clg-select-option
 * @dependency clg-select-optgroup
 *
 * @slot - The menu option and option groups.
 * @slot label - Accessible label of the input.
 * @slot helper-text - Additional instructions or context for the text field.
 * @slot caption - Additional instructions or context for the text field.
 *
 * @fires {Event} input - Fires when the user selects an option
 * @fires {Event} change - Fires when the selected option changes
 * @fires {FocusEvent} focus - Fires when the input gains focus
 * @fires {FocusEvent} blur - Fires when the input loses focus
 *
 * @attr {string} defaultValue - Sets the initial value (only needed in Preact).
 */

class ClgSelect extends CollageFormElement {
  static template = clg_select_mustache;
  static shadowRootOptions = { ...CollageFormElement.shadowRootOptions,
    delegatesFocus: true
  };
  static validators = {
    label: {
      property: required,
      slot: hasContent
    }
  };

  get #select() {
    return this.shadowRoot?.querySelector("select");
  }

  get #defaultSlot() {
    return this.shadowRoot?.querySelector("slot:not([name])");
  }

  get #horizontalLabel() {
    return this.shadowRoot?.querySelector("#horizontal-label");
  }
  /** Used for resetting on formResetCallback */


  #initialValue = "";
  /** Observes the label size to adjust the select padding in horizontal orientation. */

  #labelSizeObserver = null;
  /** The value of the form field. */

  static delegatedEvents = ["change", "input"];
  static properties = {
    value: {},
    optional: {
      type: Boolean,
      reflect: true
    },
    required: {
      type: Boolean,
      reflect: true
    },
    validateOnChange: {
      type: Boolean,
      attribute: "validate-on-change"
    },
    ssrValue: {
      attribute: "ssr-value"
    },
    orientation: {
      reflect: true
    },
    autocomplete: {},
    autofocus: {},
    size: {
      reflect: true
    }
  };

  constructor() {
    super();
    this.size = "base";
    this.orientation = "vertical";
    this.required = false;
    this.optional = false;
    this.validateOnChange = false;
  }

  firstUpdated(changed) {
    super.firstUpdated(changed); // Re-sync when options change

    const observer = new MutationObserver(() => this.#syncOptions());
    observer.observe(this, {
      subtree: true,
      childList: true,
      attributes: true
    });
    this.onDisconnect(() => {
      observer?.disconnect();
    });
    this.#select?.classList.add(PLACEHOLDER_CLASS); // Initial sync

    this.#syncOptions();

    if (this.orientation === "horizontal") {
      this.#calculateHorizontalLabelWidth();
    }

    this.#initialValue = this.getAttribute("defaultvalue") || this.value || "";
    this.#select?.addEventListener("focus", this.#handleFocus);
    this.#select?.addEventListener("blur", this.#handleBlur);
    this.#select?.addEventListener("keydown", this.#handleKeyDown);
    this.onDisconnect(() => {
      this.#select?.removeEventListener("focus", this.#handleFocus);
      this.#select?.removeEventListener("blur", this.#handleBlur);
      this.#select?.removeEventListener("keydown", this.#handleKeyDown);
    });
  }

  willUpdate(changed) {
    super.willUpdate(changed); // Only run on first update
    // Normally, we'd use the "value" attribute for the initial form value.
    // But Preact might strip out the value attribute and just set the property on the element.
    // So this workaround for supporting `defaultValue` is here for Preact.

    if (!this.hasUpdated && this.hasAttribute("defaultvalue") && !this.value) {
      this.value = this.getAttribute("defaultvalue") || "";
    }

    this.validate();
  }

  update(changed) {
    super.update(changed);

    if (changed.has("value")) {
      this.internals.setFormValue(this.value);

      if (this.#select && this.value !== this.#select.value) {
        this.#select.value = this.value;
      }
    }

    this.#updateDescribedByIds();
  }

  updated(changed) {
    super.updated(changed);

    if (changed.has("orientation")) {
      if (this.orientation === "horizontal" && this.#horizontalLabel) {
        this.#labelSizeObserver = new ResizeObserver(() => this.#calculateHorizontalLabelWidth());
        this.#labelSizeObserver.observe(this.#horizontalLabel, {
          box: "border-box"
        });
      } else {
        this.#labelSizeObserver?.disconnect();
        this.#labelSizeObserver = null;
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#labelSizeObserver?.disconnect();
  }
  /** @internal Called when the form is reset. */


  formResetCallback() {
    super.formResetCallback();
    this.value = this.#initialValue;
    this.#select?.classList.add(PLACEHOLDER_CLASS);
  }

  formStateRestoreCallback(state) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.value = state;
  }

  getValidity() {
    const hasCustomValidity = this.customValidityMessage.length > 0;
    const isMissing = this.required && !this.value; // If `setCustomValidity` is used, the input will always be invalid
    // until they explicitly clear it with `setCustomValidity("")`. This
    // matches the behavior of `HTMLInputElement.setCustomValidity()`

    if (!hasCustomValidity && !isMissing) {
      if (!this.error) {
        // Preserve invalid state if error property is used
        this.invalid = false;
        this.validationMessage = "";
      }

      return {
        flags: {}
      };
    }

    const validationMessage = hasCustomValidity ? this.getCustomValidity() : isMissing ? emptyInputErrorMsg : "";
    const flags = {
      customError: hasCustomValidity,
      valueMissing: isMissing
    };

    if (!this.error) {
      // Preserve invalid state if error property is used
      // Don't show error state if not touched
      this.invalid = this.touched;
      this.validationMessage = validationMessage;
    }

    return {
      flags,
      message: validationMessage
    };
  }
  /**
   * Uses the light DOM clg-select-option and clg-select-optgroup elements
   * to populate the shadow select's option and optgroup elements. A MutationObserver
   * watches for when any attributes on the children change, then re-runs this to
   * synchronize the options.
   *
   * Browser <option> and <optgroup> elements do not reflect their
   * selected/disabled/value/label properties, so we use custom elements which do.
   */


  async #syncOptions() {
    if (!this.#select || !this.#defaultSlot) return;
    await this.updateComplete; // The API for <clg-select-option> and <clg-select-optgroup> is
    // designed to mirror the API of <option> and <optgroup>, so we
    // can just copy over the innerHTML and replace the tags.

    const html = getSlotHtml(this.#defaultSlot).replaceAll(/(<|<\/)clg-select-/g, "$1");
    this.#select.innerHTML = html;
    const lightDomOptions = Array.from(this.querySelectorAll("clg-select-option"));
    const selectedValue = lightDomOptions // In case of multiple selected options, the last one takes precedence,
    // which is the same behavior as a native select element
    .reverse().find(opt => opt.selected)?.value;

    if (selectedValue) {
      // If option is selected, it takes precedence over <clg-select> value
      this.value = selectedValue;
      return;
    }

    if (this.value) {
      const shadowDomOptions = Array.from(this.#select.querySelectorAll("option")); // If there's no selected option, but <clg-select> has a value,
      // select the option with that value if it's there

      const optionWithCurrentValue = shadowDomOptions.find(option => option.value === this.value);

      if (optionWithCurrentValue) {
        optionWithCurrentValue.selected = true;
        return;
      }
    } // Default to select's value (which is usually first option)


    this.value = this.#select.value;
  }

  #updateDescribedByIds() {
    const ids = [];

    if (this.invalid) {
      ids.push(clg_select_DESCRIBEDBY_IDS.ERROR);
    }

    if (this.withCaption) {
      ids.push(clg_select_DESCRIBEDBY_IDS.CAPTION);
    }

    if (this.withHelperText) {
      ids.push(clg_select_DESCRIBEDBY_IDS.HELPER);
    }

    if (ids.length > 0) {
      this.#select?.setAttribute("aria-describedby", ids.join(" "));
    } else {
      this.#select?.removeAttribute("aria-describedby");
    }
  }

  handleEvent(event) {
    const {
      intention
    } = this.findClosestIntention(event);

    switch (intention) {
      case "INPUT":
        if (!this.#select) return;
        this.value = this.#select.value;
        break;

      case "CHANGE":
        if (!this.#select) return;
        this.#select.classList.remove(PLACEHOLDER_CLASS);
        this.updateComplete.then(() => {
          this.dispatchEvent(new Event("change", {
            bubbles: true,
            composed: true,
            cancelable: false
          }));
        });
        break;

      default:
    }
  }

  #handleFocus = () => {
    this.dispatchEvent(new FocusEvent("focus", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
  #handleBlur = () => {
    if (this.validateOnChange && this.required) {
      // Normally the required state doesn't trigger an error unless the user adds
      // some text to the field. To get validateOnChange to play with required,
      // we'll manually cause the field to validate.
      this.touched = true;
      this.requestUpdate();
    }

    this.dispatchEvent(new FocusEvent("blur", {
      bubbles: true,
      cancelable: false,
      composed: true
    }));
  };
  #handleKeyDown = e => {
    submitOnEnter(e, this);
  };
  /**
   * To prevent collision between the select value and label, we use its
   * width to calculate the padding, and use it to calculate the select's padding.
   */

  #calculateHorizontalLabelWidth() {
    const label = this.#horizontalLabel;
    const select = this.#select;
    if (!label || !select) return;
    const {
      width
    } = label.getBoundingClientRect();
    select.style.setProperty("--clg-select-label-width", `${width}px`);
  }
  /** Sets focus to the select. */


  focus() {
    this.#select?.focus();
  }
  /** Removes focus from the select. */


  blur() {
    this.#select?.blur();
  }
  /** Shows the picker in supported browsers. */


  showPicker() {
    if (this.#select && "showPicker" in this.#select) {
      this.#select.showPicker();
    }
  }

}
ClgSelect.define("clg-select");
;// ./node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
/**
 * Custom positioning reference element.
 * @see https://floating-ui.com/docs/virtual-elements
 */

const floating_ui_utils_sides = (/* unused pure expression or super */ null && (['top', 'right', 'bottom', 'left']));
const alignments = (/* unused pure expression or super */ null && (['start', 'end']));
const floating_ui_utils_placements = /*#__PURE__*/(/* unused pure expression or super */ null && (floating_ui_utils_sides.reduce((acc, side) => acc.concat(side, side + "-" + alignments[0], side + "-" + alignments[1]), [])));
const floating_ui_utils_min = Math.min;
const floating_ui_utils_max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = v => ({
  x: v,
  y: v
});
const oppositeSideMap = {
  left: 'right',
  right: 'left',
  bottom: 'top',
  top: 'bottom'
};
const oppositeAlignmentMap = {
  start: 'end',
  end: 'start'
};
function floating_ui_utils_clamp(start, value, end) {
  return floating_ui_utils_max(start, floating_ui_utils_min(value, end));
}
function floating_ui_utils_evaluate(value, param) {
  return typeof value === 'function' ? value(param) : value;
}
function floating_ui_utils_getSide(placement) {
  return placement.split('-')[0];
}
function floating_ui_utils_getAlignment(placement) {
  return placement.split('-')[1];
}
function floating_ui_utils_getOppositeAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}
function floating_ui_utils_getAxisLength(axis) {
  return axis === 'y' ? 'height' : 'width';
}
function floating_ui_utils_getSideAxis(placement) {
  return ['top', 'bottom'].includes(floating_ui_utils_getSide(placement)) ? 'y' : 'x';
}
function floating_ui_utils_getAlignmentAxis(placement) {
  return floating_ui_utils_getOppositeAxis(floating_ui_utils_getSideAxis(placement));
}
function floating_ui_utils_getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = floating_ui_utils_getAlignment(placement);
  const alignmentAxis = floating_ui_utils_getAlignmentAxis(placement);
  const length = floating_ui_utils_getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === 'x' ? alignment === (rtl ? 'end' : 'start') ? 'right' : 'left' : alignment === 'start' ? 'bottom' : 'top';
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [floating_ui_utils_getOppositeAlignmentPlacement(placement), oppositePlacement, floating_ui_utils_getOppositeAlignmentPlacement(oppositePlacement)];
}
function floating_ui_utils_getOppositeAlignmentPlacement(placement) {
  return placement.replace(/start|end/g, alignment => oppositeAlignmentMap[alignment]);
}
function getSideList(side, isStart, rtl) {
  const lr = ['left', 'right'];
  const rl = ['right', 'left'];
  const tb = ['top', 'bottom'];
  const bt = ['bottom', 'top'];
  switch (side) {
    case 'top':
    case 'bottom':
      if (rtl) return isStart ? rl : lr;
      return isStart ? lr : rl;
    case 'left':
    case 'right':
      return isStart ? tb : bt;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = floating_ui_utils_getAlignment(placement);
  let list = getSideList(floating_ui_utils_getSide(placement), direction === 'start', rtl);
  if (alignment) {
    list = list.map(side => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(floating_ui_utils_getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, side => oppositeSideMap[side]);
}
function expandPaddingObject(padding) {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    ...padding
  };
}
function floating_ui_utils_getPaddingObject(padding) {
  return typeof padding !== 'number' ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function floating_ui_utils_rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}



;// ./node_modules/@floating-ui/core/dist/floating-ui.core.mjs



function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = floating_ui_utils_getSideAxis(placement);
  const alignmentAxis = floating_ui_utils_getAlignmentAxis(placement);
  const alignLength = floating_ui_utils_getAxisLength(alignmentAxis);
  const side = floating_ui_utils_getSide(placement);
  const isVertical = sideAxis === 'y';
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case 'top':
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case 'bottom':
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case 'right':
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case 'left':
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  switch (floating_ui_utils_getAlignment(placement)) {
    case 'start':
      coords[alignmentAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    case 'end':
      coords[alignmentAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
      break;
  }
  return coords;
}

/**
 * Computes the `x` and `y` coordinates that will place the floating element
 * next to a given reference element.
 *
 * This export does not have any `platform` interface logic. You will need to
 * write one for the platform you are using Floating UI with.
 */
const computePosition = async (reference, floating, config) => {
  const {
    placement = 'bottom',
    strategy = 'absolute',
    middleware = [],
    platform
  } = config;
  const validMiddleware = middleware.filter(Boolean);
  const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(floating));
  let rects = await platform.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let middlewareData = {};
  let resetCount = 0;
  for (let i = 0; i < validMiddleware.length; i++) {
    const {
      name,
      fn
    } = validMiddleware[i];
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform,
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData = {
      ...middlewareData,
      [name]: {
        ...middlewareData[name],
        ...data
      }
    };
    if (reset && resetCount <= 50) {
      resetCount++;
      if (typeof reset === 'object') {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};

/**
 * Resolves with an object of overflow side offsets that determine how much the
 * element is overflowing a given clipping boundary on each side.
 * - positive = overflowing the boundary by that number of pixels
 * - negative = how many pixels left before it will overflow
 * - 0 = lies flush with the boundary
 * @see https://floating-ui.com/docs/detectOverflow
 */
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = 'clippingAncestors',
    rootBoundary = 'viewport',
    elementContext = 'floating',
    altBoundary = false,
    padding = 0
  } = floating_ui_utils_evaluate(options, state);
  const paddingObject = floating_ui_utils_getPaddingObject(padding);
  const altContext = elementContext === 'floating' ? 'reference' : 'floating';
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = floating_ui_utils_rectToClientRect(await platform.getClippingRect({
    element: ((_await$platform$isEle = await (platform.isElement == null ? void 0 : platform.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || (await (platform.getDocumentElement == null ? void 0 : platform.getDocumentElement(elements.floating))),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === 'floating' ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(elements.floating));
  const offsetScale = (await (platform.isElement == null ? void 0 : platform.isElement(offsetParent))) ? (await (platform.getScale == null ? void 0 : platform.getScale(offsetParent))) || {
    x: 1,
    y: 1
  } : {
    x: 1,
    y: 1
  };
  const elementClientRect = floating_ui_utils_rectToClientRect(platform.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}

/**
 * Provides data to position an inner element of the floating element so that it
 * appears centered to the reference element.
 * @see https://floating-ui.com/docs/arrow
 */
const arrow = options => ({
  name: 'arrow',
  options,
  async fn(state) {
    const {
      x,
      y,
      placement,
      rects,
      platform,
      elements,
      middlewareData
    } = state;
    // Since `element` is required, we don't Partial<> the type.
    const {
      element,
      padding = 0
    } = evaluate(options, state) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x,
      y
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform.getDimensions(element);
    const isYAxis = axis === 'y';
    const minProp = isYAxis ? 'top' : 'left';
    const maxProp = isYAxis ? 'bottom' : 'right';
    const clientProp = isYAxis ? 'clientHeight' : 'clientWidth';
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(element));
    let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;

    // DOM platform can return `window` as the `offsetParent`.
    if (!clientSize || !(await (platform.isElement == null ? void 0 : platform.isElement(arrowOffsetParent)))) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;

    // If the padding is large enough that it causes the arrow to no longer be
    // centered, modify the padding so that it is centered.
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);

    // Make sure the arrow doesn't overflow the floating element if the center
    // point is outside the floating element's bounds.
    const min$1 = minPadding;
    const max = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset = clamp(min$1, center, max);

    // If the reference is small enough that the arrow's padding causes it to
    // to point to nothing for an aligned placement, adjust the offset of the
    // floating element itself. To ensure `shift()` continues to take action,
    // a single reset is performed when this is true.
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset && rects.reference[length] / 2 - (center < min$1 ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < min$1 ? center - min$1 : center - max : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: {
        [axis]: offset,
        centerOffset: center - offset - alignmentOffset,
        ...(shouldAddOffset && {
          alignmentOffset
        })
      },
      reset: shouldAddOffset
    };
  }
});

function getPlacementList(alignment, autoAlignment, allowedPlacements) {
  const allowedPlacementsSortedByAlignment = alignment ? [...allowedPlacements.filter(placement => getAlignment(placement) === alignment), ...allowedPlacements.filter(placement => getAlignment(placement) !== alignment)] : allowedPlacements.filter(placement => getSide(placement) === placement);
  return allowedPlacementsSortedByAlignment.filter(placement => {
    if (alignment) {
      return getAlignment(placement) === alignment || (autoAlignment ? getOppositeAlignmentPlacement(placement) !== placement : false);
    }
    return true;
  });
}
/**
 * Optimizes the visibility of the floating element by choosing the placement
 * that has the most space available automatically, without needing to specify a
 * preferred placement. Alternative to `flip`.
 * @see https://floating-ui.com/docs/autoPlacement
 */
const autoPlacement = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'autoPlacement',
    options,
    async fn(state) {
      var _middlewareData$autoP, _middlewareData$autoP2, _placementsThatFitOnE;
      const {
        rects,
        middlewareData,
        placement,
        platform,
        elements
      } = state;
      const {
        crossAxis = false,
        alignment,
        allowedPlacements = placements,
        autoAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state);
      const placements$1 = alignment !== undefined || allowedPlacements === placements ? getPlacementList(alignment || null, autoAlignment, allowedPlacements) : allowedPlacements;
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const currentIndex = ((_middlewareData$autoP = middlewareData.autoPlacement) == null ? void 0 : _middlewareData$autoP.index) || 0;
      const currentPlacement = placements$1[currentIndex];
      if (currentPlacement == null) {
        return {};
      }
      const alignmentSides = getAlignmentSides(currentPlacement, rects, await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating)));

      // Make `computeCoords` start from the right place.
      if (placement !== currentPlacement) {
        return {
          reset: {
            placement: placements$1[0]
          }
        };
      }
      const currentOverflows = [overflow[getSide(currentPlacement)], overflow[alignmentSides[0]], overflow[alignmentSides[1]]];
      const allOverflows = [...(((_middlewareData$autoP2 = middlewareData.autoPlacement) == null ? void 0 : _middlewareData$autoP2.overflows) || []), {
        placement: currentPlacement,
        overflows: currentOverflows
      }];
      const nextPlacement = placements$1[currentIndex + 1];

      // There are more placements to check.
      if (nextPlacement) {
        return {
          data: {
            index: currentIndex + 1,
            overflows: allOverflows
          },
          reset: {
            placement: nextPlacement
          }
        };
      }
      const placementsSortedByMostSpace = allOverflows.map(d => {
        const alignment = getAlignment(d.placement);
        return [d.placement, alignment && crossAxis ?
        // Check along the mainAxis and main crossAxis side.
        d.overflows.slice(0, 2).reduce((acc, v) => acc + v, 0) :
        // Check only the mainAxis.
        d.overflows[0], d.overflows];
      }).sort((a, b) => a[1] - b[1]);
      const placementsThatFitOnEachSide = placementsSortedByMostSpace.filter(d => d[2].slice(0,
      // Aligned placements should not check their opposite crossAxis
      // side.
      getAlignment(d[0]) ? 2 : 3).every(v => v <= 0));
      const resetPlacement = ((_placementsThatFitOnE = placementsThatFitOnEachSide[0]) == null ? void 0 : _placementsThatFitOnE[0]) || placementsSortedByMostSpace[0][0];
      if (resetPlacement !== placement) {
        return {
          data: {
            index: currentIndex + 1,
            overflows: allOverflows
          },
          reset: {
            placement: resetPlacement
          }
        };
      }
      return {};
    }
  };
};

/**
 * Optimizes the visibility of the floating element by flipping the `placement`
 * in order to keep it in view when the preferred placement(s) will overflow the
 * clipping boundary. Alternative to `autoPlacement`.
 * @see https://floating-ui.com/docs/flip
 */
const flip = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'flip',
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform,
        elements
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = 'bestFit',
        fallbackAxisSideDirection = 'none',
        flipAlignment = true,
        ...detectOverflowOptions
      } = floating_ui_utils_evaluate(options, state);

      // If a reset by the arrow was caused due to an alignment offset being
      // added, we should skip any logic now since `flip()` has already done its
      // work.
      // https://github.com/floating-ui/floating-ui/issues/2549#issuecomment-1719601643
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = floating_ui_utils_getSide(placement);
      const initialSideAxis = floating_ui_utils_getSideAxis(initialPlacement);
      const isBasePlacement = floating_ui_utils_getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== 'none';
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements = [initialPlacement, ...fallbackPlacements];
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides = floating_ui_utils_getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides[0]], overflow[sides[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];

      // One or more sides is overflowing.
      if (!overflows.every(side => side <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements[nextIndex];
        if (nextPlacement) {
          // Try next placement and re-run the lifecycle.
          return {
            data: {
              index: nextIndex,
              overflows: overflowsData
            },
            reset: {
              placement: nextPlacement
            }
          };
        }

        // First, find the candidates that fit on the mainAxis side of overflow,
        // then find the placement that fits the best on the main crossAxis side.
        let resetPlacement = (_overflowsData$filter = overflowsData.filter(d => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;

        // Otherwise fallback.
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case 'bestFit':
              {
                var _overflowsData$filter2;
                const placement = (_overflowsData$filter2 = overflowsData.filter(d => {
                  if (hasFallbackAxisSideDirection) {
                    const currentSideAxis = floating_ui_utils_getSideAxis(d.placement);
                    return currentSideAxis === initialSideAxis ||
                    // Create a bias to the `y` side axis due to horizontal
                    // reading directions favoring greater width.
                    currentSideAxis === 'y';
                  }
                  return true;
                }).map(d => [d.placement, d.overflows.filter(overflow => overflow > 0).reduce((acc, overflow) => acc + overflow, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
                if (placement) {
                  resetPlacement = placement;
                }
                break;
              }
            case 'initialPlacement':
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};

function getSideOffsets(overflow, rect) {
  return {
    top: overflow.top - rect.height,
    right: overflow.right - rect.width,
    bottom: overflow.bottom - rect.height,
    left: overflow.left - rect.width
  };
}
function isAnySideFullyClipped(overflow) {
  return sides.some(side => overflow[side] >= 0);
}
/**
 * Provides data to hide the floating element in applicable situations, such as
 * when it is not in the same clipping context as the reference element.
 * @see https://floating-ui.com/docs/hide
 */
const hide = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'hide',
    options,
    async fn(state) {
      const {
        rects
      } = state;
      const {
        strategy = 'referenceHidden',
        ...detectOverflowOptions
      } = evaluate(options, state);
      switch (strategy) {
        case 'referenceHidden':
          {
            const overflow = await detectOverflow(state, {
              ...detectOverflowOptions,
              elementContext: 'reference'
            });
            const offsets = getSideOffsets(overflow, rects.reference);
            return {
              data: {
                referenceHiddenOffsets: offsets,
                referenceHidden: isAnySideFullyClipped(offsets)
              }
            };
          }
        case 'escaped':
          {
            const overflow = await detectOverflow(state, {
              ...detectOverflowOptions,
              altBoundary: true
            });
            const offsets = getSideOffsets(overflow, rects.floating);
            return {
              data: {
                escapedOffsets: offsets,
                escaped: isAnySideFullyClipped(offsets)
              }
            };
          }
        default:
          {
            return {};
          }
      }
    }
  };
};

function getBoundingRect(rects) {
  const minX = min(...rects.map(rect => rect.left));
  const minY = min(...rects.map(rect => rect.top));
  const maxX = max(...rects.map(rect => rect.right));
  const maxY = max(...rects.map(rect => rect.bottom));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
function getRectsByLine(rects) {
  const sortedRects = rects.slice().sort((a, b) => a.y - b.y);
  const groups = [];
  let prevRect = null;
  for (let i = 0; i < sortedRects.length; i++) {
    const rect = sortedRects[i];
    if (!prevRect || rect.y - prevRect.y > prevRect.height / 2) {
      groups.push([rect]);
    } else {
      groups[groups.length - 1].push(rect);
    }
    prevRect = rect;
  }
  return groups.map(rect => rectToClientRect(getBoundingRect(rect)));
}
/**
 * Provides improved positioning for inline reference elements that can span
 * over multiple lines, such as hyperlinks or range selections.
 * @see https://floating-ui.com/docs/inline
 */
const inline = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'inline',
    options,
    async fn(state) {
      const {
        placement,
        elements,
        rects,
        platform,
        strategy
      } = state;
      // A MouseEvent's client{X,Y} coords can be up to 2 pixels off a
      // ClientRect's bounds, despite the event listener being triggered. A
      // padding of 2 seems to handle this issue.
      const {
        padding = 2,
        x,
        y
      } = evaluate(options, state);
      const nativeClientRects = Array.from((await (platform.getClientRects == null ? void 0 : platform.getClientRects(elements.reference))) || []);
      const clientRects = getRectsByLine(nativeClientRects);
      const fallback = rectToClientRect(getBoundingRect(nativeClientRects));
      const paddingObject = getPaddingObject(padding);
      function getBoundingClientRect() {
        // There are two rects and they are disjoined.
        if (clientRects.length === 2 && clientRects[0].left > clientRects[1].right && x != null && y != null) {
          // Find the first rect in which the point is fully inside.
          return clientRects.find(rect => x > rect.left - paddingObject.left && x < rect.right + paddingObject.right && y > rect.top - paddingObject.top && y < rect.bottom + paddingObject.bottom) || fallback;
        }

        // There are 2 or more connected rects.
        if (clientRects.length >= 2) {
          if (getSideAxis(placement) === 'y') {
            const firstRect = clientRects[0];
            const lastRect = clientRects[clientRects.length - 1];
            const isTop = getSide(placement) === 'top';
            const top = firstRect.top;
            const bottom = lastRect.bottom;
            const left = isTop ? firstRect.left : lastRect.left;
            const right = isTop ? firstRect.right : lastRect.right;
            const width = right - left;
            const height = bottom - top;
            return {
              top,
              bottom,
              left,
              right,
              width,
              height,
              x: left,
              y: top
            };
          }
          const isLeftSide = getSide(placement) === 'left';
          const maxRight = max(...clientRects.map(rect => rect.right));
          const minLeft = min(...clientRects.map(rect => rect.left));
          const measureRects = clientRects.filter(rect => isLeftSide ? rect.left === minLeft : rect.right === maxRight);
          const top = measureRects[0].top;
          const bottom = measureRects[measureRects.length - 1].bottom;
          const left = minLeft;
          const right = maxRight;
          const width = right - left;
          const height = bottom - top;
          return {
            top,
            bottom,
            left,
            right,
            width,
            height,
            x: left,
            y: top
          };
        }
        return fallback;
      }
      const resetRects = await platform.getElementRects({
        reference: {
          getBoundingClientRect
        },
        floating: elements.floating,
        strategy
      });
      if (rects.reference.x !== resetRects.reference.x || rects.reference.y !== resetRects.reference.y || rects.reference.width !== resetRects.reference.width || rects.reference.height !== resetRects.reference.height) {
        return {
          reset: {
            rects: resetRects
          }
        };
      }
      return {};
    }
  };
};

// For type backwards-compatibility, the `OffsetOptions` type was also
// Derivable.

async function convertValueToCoords(state, options) {
  const {
    placement,
    platform,
    elements
  } = state;
  const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
  const side = floating_ui_utils_getSide(placement);
  const alignment = floating_ui_utils_getAlignment(placement);
  const isVertical = floating_ui_utils_getSideAxis(placement) === 'y';
  const mainAxisMulti = ['left', 'top'].includes(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = floating_ui_utils_evaluate(options, state);

  // eslint-disable-next-line prefer-const
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === 'number' ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === 'number') {
    crossAxis = alignment === 'end' ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}

/**
 * Modifies the placement by translating the floating element along the
 * specified axes.
 * A number (shorthand for `mainAxis` or distance), or an axes configuration
 * object may be passed.
 * @see https://floating-ui.com/docs/offset
 */
const offset = function (options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: 'offset',
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x,
        y,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);

      // If the placement is the same and the arrow caused an alignment offset
      // then we don't need to change the positioning coordinates.
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x + diffCoords.x,
        y: y + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};

/**
 * Optimizes the visibility of the floating element by shifting it in order to
 * keep it in view when it will overflow the clipping boundary.
 * @see https://floating-ui.com/docs/shift
 */
const shift = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'shift',
    options,
    async fn(state) {
      const {
        x,
        y,
        placement
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: _ref => {
            let {
              x,
              y
            } = _ref;
            return {
              x,
              y
            };
          }
        },
        ...detectOverflowOptions
      } = floating_ui_utils_evaluate(options, state);
      const coords = {
        x,
        y
      };
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const crossAxis = floating_ui_utils_getSideAxis(floating_ui_utils_getSide(placement));
      const mainAxis = floating_ui_utils_getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      if (checkMainAxis) {
        const minSide = mainAxis === 'y' ? 'top' : 'left';
        const maxSide = mainAxis === 'y' ? 'bottom' : 'right';
        const min = mainAxisCoord + overflow[minSide];
        const max = mainAxisCoord - overflow[maxSide];
        mainAxisCoord = floating_ui_utils_clamp(min, mainAxisCoord, max);
      }
      if (checkCrossAxis) {
        const minSide = crossAxis === 'y' ? 'top' : 'left';
        const maxSide = crossAxis === 'y' ? 'bottom' : 'right';
        const min = crossAxisCoord + overflow[minSide];
        const max = crossAxisCoord - overflow[maxSide];
        crossAxisCoord = floating_ui_utils_clamp(min, crossAxisCoord, max);
      }
      const limitedCoords = limiter.fn({
        ...state,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x,
          y: limitedCoords.y - y,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};
/**
 * Built-in `limiter` that will stop `shift()` at a certain point.
 */
const limitShift = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    options,
    fn(state) {
      const {
        x,
        y,
        placement,
        rects,
        middlewareData
      } = state;
      const {
        offset = 0,
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const rawOffset = evaluate(offset, state);
      const computedOffset = typeof rawOffset === 'number' ? {
        mainAxis: rawOffset,
        crossAxis: 0
      } : {
        mainAxis: 0,
        crossAxis: 0,
        ...rawOffset
      };
      if (checkMainAxis) {
        const len = mainAxis === 'y' ? 'height' : 'width';
        const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
        const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
        if (mainAxisCoord < limitMin) {
          mainAxisCoord = limitMin;
        } else if (mainAxisCoord > limitMax) {
          mainAxisCoord = limitMax;
        }
      }
      if (checkCrossAxis) {
        var _middlewareData$offse, _middlewareData$offse2;
        const len = mainAxis === 'y' ? 'width' : 'height';
        const isOriginSide = ['top', 'left'].includes(getSide(placement));
        const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
        const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
        if (crossAxisCoord < limitMin) {
          crossAxisCoord = limitMin;
        } else if (crossAxisCoord > limitMax) {
          crossAxisCoord = limitMax;
        }
      }
      return {
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      };
    }
  };
};

/**
 * Provides data that allows you to change the size of the floating element —
 * for instance, prevent it from overflowing the clipping boundary or match the
 * width of the reference element.
 * @see https://floating-ui.com/docs/size
 */
const floating_ui_core_size = function (options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'size',
    options,
    async fn(state) {
      var _state$middlewareData, _state$middlewareData2;
      const {
        placement,
        rects,
        platform,
        elements
      } = state;
      const {
        apply = () => {},
        ...detectOverflowOptions
      } = floating_ui_utils_evaluate(options, state);
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const side = floating_ui_utils_getSide(placement);
      const alignment = floating_ui_utils_getAlignment(placement);
      const isYAxis = floating_ui_utils_getSideAxis(placement) === 'y';
      const {
        width,
        height
      } = rects.floating;
      let heightSide;
      let widthSide;
      if (side === 'top' || side === 'bottom') {
        heightSide = side;
        widthSide = alignment === ((await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating))) ? 'start' : 'end') ? 'left' : 'right';
      } else {
        widthSide = side;
        heightSide = alignment === 'end' ? 'top' : 'bottom';
      }
      const maximumClippingHeight = height - overflow.top - overflow.bottom;
      const maximumClippingWidth = width - overflow.left - overflow.right;
      const overflowAvailableHeight = floating_ui_utils_min(height - overflow[heightSide], maximumClippingHeight);
      const overflowAvailableWidth = floating_ui_utils_min(width - overflow[widthSide], maximumClippingWidth);
      const noShift = !state.middlewareData.shift;
      let availableHeight = overflowAvailableHeight;
      let availableWidth = overflowAvailableWidth;
      if ((_state$middlewareData = state.middlewareData.shift) != null && _state$middlewareData.enabled.x) {
        availableWidth = maximumClippingWidth;
      }
      if ((_state$middlewareData2 = state.middlewareData.shift) != null && _state$middlewareData2.enabled.y) {
        availableHeight = maximumClippingHeight;
      }
      if (noShift && !alignment) {
        const xMin = floating_ui_utils_max(overflow.left, 0);
        const xMax = floating_ui_utils_max(overflow.right, 0);
        const yMin = floating_ui_utils_max(overflow.top, 0);
        const yMax = floating_ui_utils_max(overflow.bottom, 0);
        if (isYAxis) {
          availableWidth = width - 2 * (xMin !== 0 || xMax !== 0 ? xMin + xMax : floating_ui_utils_max(overflow.left, overflow.right));
        } else {
          availableHeight = height - 2 * (yMin !== 0 || yMax !== 0 ? yMin + yMax : floating_ui_utils_max(overflow.top, overflow.bottom));
        }
      }
      await apply({
        ...state,
        availableWidth,
        availableHeight
      });
      const nextDimensions = await platform.getDimensions(elements.floating);
      if (width !== nextDimensions.width || height !== nextDimensions.height) {
        return {
          reset: {
            rects: true
          }
        };
      }
      return {};
    }
  };
};



;// ./node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
  return typeof window !== 'undefined';
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || '').toLowerCase();
  }
  // Mocked nodes in testing environments may not be instances of Node. By
  // returning `#document` an infinite loop won't occur.
  // https://github.com/floating-ui/floating-ui/issues/2317
  return '#document';
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === 'undefined') {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = floating_ui_utils_dom_getComputedStyle(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && !['inline', 'contents'].includes(display);
}
function isTableElement(element) {
  return ['table', 'td', 'th'].includes(getNodeName(element));
}
function isTopLayer(element) {
  return [':popover-open', ':modal'].some(selector => {
    try {
      return element.matches(selector);
    } catch (e) {
      return false;
    }
  });
}
function isContainingBlock(elementOrCss) {
  const webkit = isWebKit();
  const css = isElement(elementOrCss) ? floating_ui_utils_dom_getComputedStyle(elementOrCss) : elementOrCss;

  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  // https://drafts.csswg.org/css-transforms-2/#individual-transforms
  return ['transform', 'translate', 'scale', 'rotate', 'perspective'].some(value => css[value] ? css[value] !== 'none' : false) || (css.containerType ? css.containerType !== 'normal' : false) || !webkit && (css.backdropFilter ? css.backdropFilter !== 'none' : false) || !webkit && (css.filter ? css.filter !== 'none' : false) || ['transform', 'translate', 'scale', 'rotate', 'perspective', 'filter'].some(value => (css.willChange || '').includes(value)) || ['paint', 'layout', 'strict', 'content'].some(value => (css.contain || '').includes(value));
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  return CSS.supports('-webkit-backdrop-filter', 'none');
}
function isLastTraversableNode(node) {
  return ['html', 'body', '#document'].includes(getNodeName(node));
}
function floating_ui_utils_dom_getComputedStyle(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === 'html') {
    return node;
  }
  const result =
  // Step into the shadow DOM of the parent of a slotted node.
  node.assignedSlot ||
  // DOM Element detected.
  node.parentNode ||
  // ShadowRoot detected.
  isShadowRoot(node) && node.host ||
  // Fallback.
  getDocumentElement(node);
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return node.ownerDocument ? node.ownerDocument.body : node.body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  }
  return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}



;// ./node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs





function getCssDimensions(element) {
  const css = floating_ui_utils_dom_getComputedStyle(element);
  // In testing environments, the `width` and `height` properties are empty
  // strings for SVG elements, returning NaN. Fallback to `0` in this case.
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}

function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}

function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $
  } = getCssDimensions(domElement);
  let x = ($ ? round(rect.width) : rect.width) / width;
  let y = ($ ? round(rect.height) : rect.height) / height;

  // 0, NaN, or Infinity should always fallback to 1.

  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}

const noOffsets = /*#__PURE__*/createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  if (!floatingOffsetParent || isFixed && floatingOffsetParent !== getWindow(element)) {
    return false;
  }
  return isFixed;
}

function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement) {
    const win = getWindow(domElement);
    const offsetWin = offsetParent && isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetParent && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = floating_ui_utils_dom_getComputedStyle(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return floating_ui_utils_rectToClientRect({
    width,
    height,
    x,
    y
  });
}

// If <html> has a CSS width greater than the viewport, then this will be
// incorrect for RTL.
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}

function getHTMLOffset(documentElement, scroll, ignoreScrollbarX) {
  if (ignoreScrollbarX === void 0) {
    ignoreScrollbarX = false;
  }
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - (ignoreScrollbarX ? 0 :
  // RTL <body> scrollbar.
  getWindowScrollBarX(documentElement, htmlRect));
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}

function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === 'fixed';
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll, true) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}

function getClientRects(element) {
  return Array.from(element.getClientRects());
}

// Gets the entire size of the scrollable document area, even extending outside
// of the `<html>` and `<body>` rect bounds if horizontally scrollable.
function getDocumentRect(element) {
  const html = getDocumentElement(element);
  const scroll = getNodeScroll(element);
  const body = element.ownerDocument.body;
  const width = floating_ui_utils_max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = floating_ui_utils_max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(element);
  const y = -scroll.scrollTop;
  if (floating_ui_utils_dom_getComputedStyle(body).direction === 'rtl') {
    x += floating_ui_utils_max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}

function getViewportRect(element, strategy) {
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    const visualViewportBased = isWebKit();
    if (!visualViewportBased || visualViewportBased && strategy === 'fixed') {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x,
    y
  };
}

// Returns the inner client rect, subtracting scrollbars if present.
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === 'fixed');
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = isHTMLElement(element) ? getScale(element) : createCoords(1);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === 'viewport') {
    rect = getViewportRect(element, strategy);
  } else if (clippingAncestor === 'document') {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return floating_ui_utils_rectToClientRect(rect);
}
function hasFixedPositionAncestor(element, stopNode) {
  const parentNode = getParentNode(element);
  if (parentNode === stopNode || !isElement(parentNode) || isLastTraversableNode(parentNode)) {
    return false;
  }
  return floating_ui_utils_dom_getComputedStyle(parentNode).position === 'fixed' || hasFixedPositionAncestor(parentNode, stopNode);
}

// A "clipping ancestor" is an `overflow` element with the characteristic of
// clipping (or hiding) child elements. This returns all clipping ancestors
// of the given element up the tree.
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter(el => isElement(el) && getNodeName(el) !== 'body');
  let currentContainingBlockComputedStyle = null;
  const elementIsFixed = floating_ui_utils_dom_getComputedStyle(element).position === 'fixed';
  let currentNode = elementIsFixed ? getParentNode(element) : element;

  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = floating_ui_utils_dom_getComputedStyle(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    if (!currentNodeIsContaining && computedStyle.position === 'fixed') {
      currentContainingBlockComputedStyle = null;
    }
    const shouldDropCurrentNode = elementIsFixed ? !currentNodeIsContaining && !currentContainingBlockComputedStyle : !currentNodeIsContaining && computedStyle.position === 'static' && !!currentContainingBlockComputedStyle && ['absolute', 'fixed'].includes(currentContainingBlockComputedStyle.position) || isOverflowElement(currentNode) && !currentNodeIsContaining && hasFixedPositionAncestor(element, currentNode);
    if (shouldDropCurrentNode) {
      // Drop non-containing blocks.
      result = result.filter(ancestor => ancestor !== currentNode);
    } else {
      // Record last containing block for next iteration.
      currentContainingBlockComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}

// Gets the maximum area that the element is visible in due to any number of
// clipping ancestors.
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === 'clippingAncestors' ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstClippingAncestor = clippingAncestors[0];
  const clippingRect = clippingAncestors.reduce((accRect, clippingAncestor) => {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestor, strategy);
    accRect.top = floating_ui_utils_max(rect.top, accRect.top);
    accRect.right = floating_ui_utils_min(rect.right, accRect.right);
    accRect.bottom = floating_ui_utils_min(rect.bottom, accRect.bottom);
    accRect.left = floating_ui_utils_max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromClippingAncestor(element, firstClippingAncestor, strategy));
  return {
    width: clippingRect.right - clippingRect.left,
    height: clippingRect.bottom - clippingRect.top,
    x: clippingRect.left,
    y: clippingRect.top
  };
}

function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}

function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === 'fixed';
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    } else if (documentElement) {
      // If the <body> scrollbar appears on the left (e.g. RTL systems). Use
      // Firefox with layout.scrollbar.side = 3 in about:config to test this.
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}

function isStaticPositioned(element) {
  return floating_ui_utils_dom_getComputedStyle(element).position === 'static';
}

function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || floating_ui_utils_dom_getComputedStyle(element).position === 'fixed') {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;

  // Firefox returns the <html> element as the offsetParent if it's non-static,
  // while Chrome and Safari return the <body> element. The <body> element must
  // be used to perform the correct calculations even if the <html> element is
  // non-static.
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}

// Gets the closest ancestor positioned element. Handles some edge cases,
// such as table ancestors and cross browser bugs.
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}

const getElementRects = async function (data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};

function isRTL(element) {
  return floating_ui_utils_dom_getComputedStyle(element).direction === 'rtl';
}

const platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement: getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement: isElement,
  isRTL
};

function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// https://samthor.au/2021/observing-dom/
function observeMove(element, onMove) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: floating_ui_utils_max(0, floating_ui_utils_min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          // If the reference is clipped, the ratio is 0. Throttle the refresh
          // to prevent an infinite loop of updates.
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1000);
        } else {
          refresh(false, ratio);
        }
      }
      if (ratio === 1 && !rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        // It's possible that even though the ratio is reported as 1, the
        // element is not actually fully within the IntersectionObserver's root
        // area anymore. This can happen under performance constraints. This may
        // be a bug in the browser's IntersectionObserver implementation. To
        // work around this, we compare the element's bounding rect now with
        // what it was at the time we created the IntersectionObserver. If they
        // are not equal then the element moved, so we refresh.
        refresh();
      }
      isFirstUpdate = false;
    }

    // Older browsers don't support a `document` as the root and will throw an
    // error.
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root.ownerDocument
      });
    } catch (e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  refresh(true);
  return cleanup;
}

/**
 * Automatically updates the position of the floating element when necessary.
 * Should only be called when the floating element is mounted on the DOM or
 * visible on the screen.
 * @returns cleanup function that should be invoked when the floating element is
 * removed from the DOM or hidden from the screen.
 * @see https://floating-ui.com/docs/autoUpdate
 */
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === 'function',
    layoutShift = typeof IntersectionObserver === 'function',
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...(referenceEl ? getOverflowAncestors(referenceEl) : []), ...getOverflowAncestors(floating)] : [];
  ancestors.forEach(ancestor => {
    ancestorScroll && ancestor.addEventListener('scroll', update, {
      passive: true
    });
    ancestorResize && ancestor.addEventListener('resize', update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver(_ref => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver) {
        // Prevent update loops when using the `size` middleware.
        // https://github.com/floating-ui/floating-ui/issues/1740
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    resizeObserver.observe(floating);
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach(ancestor => {
      ancestorScroll && ancestor.removeEventListener('scroll', update);
      ancestorResize && ancestor.removeEventListener('resize', update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}

/**
 * Resolves with an object of overflow side offsets that determine how much the
 * element is overflowing a given clipping boundary on each side.
 * - positive = overflowing the boundary by that number of pixels
 * - negative = how many pixels left before it will overflow
 * - 0 = lies flush with the boundary
 * @see https://floating-ui.com/docs/detectOverflow
 */
const floating_ui_dom_detectOverflow = (/* unused pure expression or super */ null && (detectOverflow$1));

/**
 * Modifies the placement by translating the floating element along the
 * specified axes.
 * A number (shorthand for `mainAxis` or distance), or an axes configuration
 * object may be passed.
 * @see https://floating-ui.com/docs/offset
 */
const floating_ui_dom_offset = offset;

/**
 * Optimizes the visibility of the floating element by choosing the placement
 * that has the most space available automatically, without needing to specify a
 * preferred placement. Alternative to `flip`.
 * @see https://floating-ui.com/docs/autoPlacement
 */
const floating_ui_dom_autoPlacement = (/* unused pure expression or super */ null && (autoPlacement$1));

/**
 * Optimizes the visibility of the floating element by shifting it in order to
 * keep it in view when it will overflow the clipping boundary.
 * @see https://floating-ui.com/docs/shift
 */
const floating_ui_dom_shift = shift;

/**
 * Optimizes the visibility of the floating element by flipping the `placement`
 * in order to keep it in view when the preferred placement(s) will overflow the
 * clipping boundary. Alternative to `autoPlacement`.
 * @see https://floating-ui.com/docs/flip
 */
const floating_ui_dom_flip = flip;

/**
 * Provides data that allows you to change the size of the floating element —
 * for instance, prevent it from overflowing the clipping boundary or match the
 * width of the reference element.
 * @see https://floating-ui.com/docs/size
 */
const floating_ui_dom_size = floating_ui_core_size;

/**
 * Provides data to hide the floating element in applicable situations, such as
 * when it is not in the same clipping context as the reference element.
 * @see https://floating-ui.com/docs/hide
 */
const floating_ui_dom_hide = (/* unused pure expression or super */ null && (hide$1));

/**
 * Provides data to position an inner element of the floating element so that it
 * appears centered to the reference element.
 * @see https://floating-ui.com/docs/arrow
 */
const floating_ui_dom_arrow = (/* unused pure expression or super */ null && (arrow$1));

/**
 * Provides improved positioning for inline reference elements that can span
 * over multiple lines, such as hyperlinks or range selections.
 * @see https://floating-ui.com/docs/inline
 */
const floating_ui_dom_inline = (/* unused pure expression or super */ null && (inline$1));

/**
 * Built-in `limiter` that will stop `shift()` at a certain point.
 */
const floating_ui_dom_limitShift = (/* unused pure expression or super */ null && (limitShift$1));

/**
 * Computes the `x` and `y` coordinates that will place the floating element
 * next to a given reference element.
 */
const floating_ui_dom_computePosition = (reference, floating, options) => {
  // This caches the expensive `getClippingElementAncestors` function so that
  // multiple lifecycle resets re-use the same result. It only lives for a
  // single call. If other functions become expensive, we can add them as well.
  const cache = new Map();
  const mergedOptions = {
    platform,
    ...options
  };
  const platformWithCache = {
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};



;// ./htdocs/assets/js/collage/web-components/internal/composed-offset-parent.ts
/**
 * Composed-tree offset parent resolution for Floating UI, adapted from the
 * `composed-offset-position` package (MIT), without adding an npm dependency.
 *
 * @see https://www.npmjs.com/package/composed-offset-position
 */

/** Walk flat tree (slots + shadow) toward document. */
function flatTreeParent(node) {
  if (!node) {
    return null;
  }

  if (node instanceof Element && node.assignedSlot) {
    return node.assignedSlot;
  }

  if (node.parentNode instanceof ShadowRoot) {
    return node.parentNode.host;
  }

  return node.parentNode;
}
/**
 * Whether computed style establishes a containing block for absolute descendants
 * (subset of CSS containing block rules; aligned with Floating UI utils).
 */


function composed_offset_parent_isContainingBlock(style) {
  const willChangeTokens = style.willChange.split(",").map(t => t.trim());
  const backdrop = style.backdropFilter !== "none" && style.backdropFilter !== undefined && style.backdropFilter.length > 0;
  const webkitBackdrop = style.getPropertyValue("-webkit-backdrop-filter");
  const webkitBackdropActive = webkitBackdrop !== "" && webkitBackdrop !== "none" && webkitBackdrop.length > 0;
  return style.transform !== "none" || style.perspective !== "none" || style.filter !== "none" && style.filter !== undefined && style.filter.length > 0 || backdrop || webkitBackdropActive || style.contain === "paint" || willChangeTokens.includes("transform") || willChangeTokens.includes("perspective") || willChangeTokens.includes("filter") || willChangeTokens.includes("backdrop-filter");
}
/**
 * Polyfill for `offsetParent` that follows the composed tree (shadow + slots).
 * Use as the second argument to Floating UI's `platform.getOffsetParent`.
 * This is a npm dependency that we are not importing, so we are including it here.
 * @see https://www.npmjs.com/package/composed-offset-position
 */


function composedOffsetParentPolyfill(element) {
  for (let ancestor = element; ancestor; ancestor = flatTreeParent(ancestor)) {
    if (!(ancestor instanceof Element)) {
      continue;
    }

    if (getComputedStyle(ancestor).display === "none") {
      return null;
    }
  }

  for (let ancestor = flatTreeParent(element); ancestor; ancestor = flatTreeParent(ancestor)) {
    if (!(ancestor instanceof Element)) {
      continue;
    }

    const style = getComputedStyle(ancestor);

    if (style.display === "contents") {
      continue;
    }

    if (style.position !== "static" || composed_offset_parent_isContainingBlock(style)) {
      return ancestor;
    }

    if (ancestor.tagName === "BODY") {
      return ancestor;
    }
  }

  return null;
}
;// ./htdocs/assets/js/collage/web-components/events/reposition.ts
/** Emitted after the floating panel position is recomputed. */
class ClgRepositionEvent extends Event {
  detail;

  constructor(detail) {
    super("clg-reposition", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
    this.detail = detail;
  }

}
;// ./node_modules/@etsy/buildapack/dist/webpack/storybook/mustache-template-loader.js!./templates/collage/clg-floating-element.mustache



(hogan_default()).partialsMap = (hogan_default()).partialsMap || {};

const clg_floating_element_mustache_tmpl = new (hogan_default()).Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"clg-floating-element\">");t.b("\n" + i);t.b("    <slot name=\"anchor\"></slot>");t.b("\n" + i);t.b("    <div");t.b("\n" + i);t.b("        class=\"clg-floating-element__popup\"");t.b("\n" + i);t.b("        part=\"popup\"");t.b("\n" + i);t.b("        popover=\"manual\"");t.b("\n" + i);t.b("        aria-hidden=\"true\"");t.b("\n" + i);t.b("        hidden");t.b("\n" + i);t.b("    >");t.b("\n" + i);t.b("        <slot></slot>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "", (hogan_default()));
clg_floating_element_mustache_tmpl.name = "collage/clg-floating-element.mustache";
(hogan_default()).partialsMap[clg_floating_element_mustache_tmpl.name] = clg_floating_element_mustache_tmpl;

const clg_floating_element_mustache_render = function(data) {
    data = data || {};
    data._messages = window.Etsy.message_catalog;
    return clg_floating_element_mustache_tmpl.render.call(clg_floating_element_mustache_tmpl, data, (hogan_default()).partialsMap);
};
clg_floating_element_mustache_render.template = clg_floating_element_mustache_tmpl;
/* harmony default export */ const clg_floating_element_mustache = (clg_floating_element_mustache_render);

;// ./htdocs/assets/js/collage/web-components/components/floating-element/clg-floating-element.ts





/** @public Virtual anchor (e.g. selection rect) for Floating UI. */

function isVirtualAnchor(value) {
  if (value === null || typeof value !== "object" || value instanceof Element) {
    return false;
  }

  if (!("getBoundingClientRect" in value)) {
    return false;
  }

  return typeof value.getBoundingClientRect === "function";
}

const SUPPORTS_POPOVER = typeof HTMLElement !== "undefined" && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover");

/**
 * @tagname clg-floating-element
 * @summary Anchors a floating element to another element using Floating UI.
 *   When `active` is true the panel is positioned and shown; when false it is hidden.
 *   With Popover API support the panel is promoted to the top layer and positioned
 *   absolutely using a composed offset parent polyfill. Without Popover API,
 *   `position: fixed` is used to escape stacking contexts.
 *
 * @slot anchor - The element to anchor the panel to. If not used, set the `anchor` property to an id string or element reference.
 * @slot - The floating element content.
 *
 * @fires {ClgRepositionEvent} clg-reposition - Fired after the panel position is recomputed (may fire often; debounce heavy work).
 *
 * @example
 * ```html
 * <clg-floating-element id="tip" anchor="trigger-btn" active placement="bottom">
 *   <span>Tooltip content</span>
 * </clg-floating-element>
 * ```
 */
class ClgFloatingElement extends CollageElement {
  static template = clg_floating_element_mustache;
  static properties = {
    active: {
      type: Boolean,
      reflect: true
    },
    placement: {
      type: String,
      reflect: true
    },
    anchor: {
      type: Object,
      converter: {
        fromAttribute: value => value ?? undefined,
        toAttribute: value => typeof value === "string" ? value : undefined
      }
    },
    distance: {
      type: Number,
      reflect: true
    },
    skidding: {
      type: Number,
      reflect: true
    },
    flip: {
      type: Boolean,
      reflect: true
    },
    flipPadding: {
      type: Number,
      reflect: true,
      attribute: "flip-padding"
    },
    shift: {
      type: Boolean,
      reflect: true
    },
    shiftPadding: {
      type: Number,
      reflect: true,
      attribute: "shift-padding"
    },
    boundary: {
      type: String,
      reflect: true
    },
    matchAnchorWidth: {
      type: Boolean,
      reflect: true,
      attribute: "match-anchor-width"
    },
    autoSize: {
      type: String,
      reflect: true,
      attribute: "auto-size"
    },
    popupRole: {
      type: String,
      reflect: true,
      attribute: "popup-role"
    }
  };
  /** When true, the panel is positioned and visible; when false, it is hidden. */

  #cleanup;
  #referenceEl = null;
  #onAnchorSlotChange = () => {
    if (this.anchor === undefined || this.anchor === null) {
      this.#handleAnchorChange();
    }
  };

  constructor() {
    super();
    this.active = false;
    this.placement = "bottom";
    this.distance = 8;
    this.skidding = 0;
    this.flip = true;
    this.flipPadding = 5;
    this.shift = true;
    this.shiftPadding = 5;
    this.boundary = "viewport";
    this.matchAnchorWidth = false;
  }

  get #popupEl() {
    return this.shadowRoot?.querySelector(".clg-floating-element__popup") ?? null;
  }

  #resolveReference() {
    if (this.anchor === undefined || this.anchor === null) {
      const slot = this.shadowRoot?.querySelector('slot[name="anchor"]');

      if (!slot) {
        return null;
      }

      let node = slot.assignedElements({
        flatten: true
      })[0];

      if (node instanceof HTMLSlotElement) {
        node = node.assignedElements({
          flatten: true
        })[0];
      }

      return node instanceof HTMLElement ? node : null;
    }

    if (typeof this.anchor === "string") {
      const root = this.getRootNode();

      if (!("getElementById" in root && typeof root.getElementById === "function")) {
        return null;
      }

      const el = root.getElementById(this.anchor);
      return el instanceof HTMLElement ? el : null;
    }

    if (this.anchor instanceof HTMLElement) {
      return this.anchor;
    }

    if (isVirtualAnchor(this.anchor)) {
      return this.anchor;
    }

    return null;
  }

  #getPlatform() {
    const getOffsetParent = SUPPORTS_POPOVER ? element => platform.getOffsetParent(element, composedOffsetParentPolyfill) : platform.getOffsetParent;
    return { ...platform,
      getOffsetParent
    };
  }
  /**
   * Repositions the floating element.
   * This is the main function that is called when the anchor or viewport changes.
   * It is responsible for positioning the floating element and ensuring that it is visible.
   * It is also responsible for ensuring that the floating element is within the viewport and not clipped by the anchor.
   * https://github.com/shoelace-style/webawesome/blob/67bdccc4c39b22d2203021a6e9c4c00f662119e6/packages/webawesome/src/components/popup/popup.ts#L320
   */


  #reposition = () => {
    const referenceEl = this.#referenceEl;
    const popup = this.#popupEl;
    if (!referenceEl || !popup || !this.active) return;
    const middleware = [floating_ui_dom_offset({
      mainAxis: this.distance,
      crossAxis: this.skidding
    })];

    if (this.matchAnchorWidth) {
      middleware.push(floating_ui_dom_size({
        apply: ({
          rects
        }) => {
          Object.assign(popup.style, {
            width: `${rects.reference.width}px`
          });
        }
      }));
    } else {
      popup.style.width = "";
    }

    let defaultBoundary;

    if (SUPPORTS_POPOVER && this.boundary === "scroll" && referenceEl instanceof Element) {
      defaultBoundary = getOverflowAncestors(referenceEl).filter(node => node instanceof Element);
    }

    if (this.flip) {
      middleware.push(floating_ui_dom_flip({
        boundary: defaultBoundary,
        padding: this.flipPadding
      }));
    }

    if (this.shift) {
      middleware.push(floating_ui_dom_shift({
        boundary: defaultBoundary,
        padding: this.shiftPadding
      }));
    }

    const autoSize = this.autoSize;

    if (autoSize === "horizontal" || autoSize === "vertical" || autoSize === "both") {
      middleware.push(floating_ui_dom_size({
        boundary: defaultBoundary,
        apply: ({
          availableWidth,
          availableHeight
        }) => {
          if (autoSize === "vertical" || autoSize === "both") {
            this.style.setProperty("--clg-floating-auto-size-available-height", `${availableHeight}px`);
          } else {
            this.style.removeProperty("--clg-floating-auto-size-available-height");
          }

          if (autoSize === "horizontal" || autoSize === "both") {
            this.style.setProperty("--clg-floating-auto-size-available-width", `${availableWidth}px`);
          } else {
            this.style.removeProperty("--clg-floating-auto-size-available-width");
          }
        }
      }));
    } else {
      this.style.removeProperty("--clg-floating-auto-size-available-width");
      this.style.removeProperty("--clg-floating-auto-size-available-height");
    }

    const strategy = SUPPORTS_POPOVER ? "absolute" : "fixed";
    floating_ui_dom_computePosition(referenceEl, popup, {
      placement: this.placement,
      middleware,
      strategy,
      platform: this.#getPlatform()
    }).then(({
      x,
      y,
      placement
    }) => {
      this.setAttribute("data-current-placement", placement);
      Object.assign(popup.style, {
        left: `${x}px`,
        top: `${y}px`
      });
      this.dispatchEvent(new ClgRepositionEvent({
        placement
      }));
    });
  };

  #syncPopupLayoutClass(popup) {
    popup.classList.toggle("clg-floating-element__popup--fixed", !SUPPORTS_POPOVER);
  }

  #syncPopupRole(popup) {
    const role = this.popupRole;

    if (role && role.length > 0) {
      popup.setAttribute("role", role);
    } else {
      popup.removeAttribute("role");
    }
  }

  #showPopupLayer() {
    const layer = this.#popupEl;

    if (!layer) {
      return;
    }

    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");

    if (SUPPORTS_POPOVER) {
      try {
        layer.showPopover?.();
      } catch {// Invalid state (e.g. already open) — continue with positioning
      }
    }
  }

  #hidePopupLayer() {
    const layer = this.#popupEl;

    if (!layer) {
      return;
    }

    if (SUPPORTS_POPOVER) {
      try {
        layer.hidePopover?.();
      } catch {// Already hidden
      }
    }

    layer.hidden = true;
    layer.setAttribute("aria-hidden", "true");
  }

  #start() {
    const referenceEl = this.#resolveReference();
    const popup = this.#popupEl;
    if (!referenceEl || !popup || !this.active || !this.isConnected) return;
    this.#referenceEl = referenceEl;
    this.#syncPopupLayoutClass(popup);
    this.#syncPopupRole(popup);
    this.#showPopupLayer();
    this.#cleanup = autoUpdate(referenceEl, popup, this.#reposition);
  }

  #stop() {
    if (this.#cleanup) {
      this.#cleanup();
      this.#cleanup = undefined;
    }

    this.#referenceEl = null;
    this.removeAttribute("data-current-placement");
    this.style.removeProperty("--clg-floating-auto-size-available-width");
    this.style.removeProperty("--clg-floating-auto-size-available-height");
    const popup = this.#popupEl;

    if (popup) {
      this.#hidePopupLayer();
      popup.style.width = "";
    }
  }
  /** Stop, then start if active (resolves anchor and runs positioner). */


  #handleAnchorChange() {
    this.#stop();

    if (this.active) {
      this.#start();
    }
  }

  #attachAnchorSlotListener() {
    const slot = this.shadowRoot?.querySelector('slot[name="anchor"]');
    slot?.addEventListener("slotchange", this.#onAnchorSlotChange);
  }

  #detachAnchorSlotListener() {
    const slot = this.shadowRoot?.querySelector('slot[name="anchor"]');
    slot?.removeEventListener("slotchange", this.#onAnchorSlotChange);
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateComplete.then(() => {
      this.#attachAnchorSlotListener();
      const popup = this.#popupEl;

      if (popup) {
        this.#syncPopupLayoutClass(popup);
        this.#syncPopupRole(popup);
      }

      if (this.active) {
        this.#handleAnchorChange();
      }
    });
  }

  disconnectedCallback() {
    this.#detachAnchorSlotListener();
    this.#stop();
    super.disconnectedCallback();
  }

  update(changed) {
    super.update(changed);
    const popup = this.#popupEl;

    if (popup && changed.has("popupRole")) {
      this.#syncPopupRole(popup);
    }

    if (changed.has("active")) {
      if (this.active) {
        this.#handleAnchorChange();
      } else {
        this.#stop();
      }

      return;
    }

    if (changed.has("anchor")) {
      this.#handleAnchorChange();
      return;
    }

    if (this.active && (changed.has("placement") || changed.has("distance") || changed.has("skidding") || changed.has("flip") || changed.has("flipPadding") || changed.has("shift") || changed.has("shiftPadding") || changed.has("boundary") || changed.has("matchAnchorWidth") || changed.has("autoSize"))) {
      this.#reposition();
    }
  }
  /** Recalculates and repositions the panel. Call when anchor or viewport changes. */


  reposition() {
    this.#reposition();
  }

}
ClgFloatingElement.define("clg-floating-element");
;// ./htdocs/assets/js/collage/web-components/index.ts




















































;// ./htdocs/assets/js/collage/web-components/utilities/toast.ts
// Define/register the elements



function createTransitionGroupIfNone() {
  let transitionGroup = document.querySelector("#clg-toast-transition-group");

  if (!transitionGroup) {
    transitionGroup = document.createElement("clg-toast-group");
    transitionGroup.id = "clg-toast-transition-group";
    document.body.appendChild(transitionGroup);
  }

  return transitionGroup;
}

/**
 * Utilities for queuing a toast notification, centrally managed by Collage.
 */
const toast = {
  /** Queues a toast notification. Returns a reference to the created toast. */
  async create(text, {
    onClose,
    ...options
  }) {
    const group = createTransitionGroupIfNone();
    const item = document.createElement("clg-toast");
    Object.assign(item, options);
    item.textContent = text;

    if (onClose) {
      item.addEventListener("clg-close", onClose);
    }

    await group.queue(item);
    return item;
  },

  /**
   * Creates a toast notification using an existing `<clg-toast>` element. Useful if you want to create your own
   * toast items declaratively. Returns a reference to the cloned toast item.
   */
  async createFromTemplate(toastTemplate, options) {
    if (toastTemplate.localName !== "template") {
      throw new Error("not a template");
    } // eslint-disable-next-line @typescript-eslint/consistent-type-assertions


    const clone = toastTemplate.content.cloneNode(true);
    const toastEl = clone.querySelector("clg-toast");

    if (!toastEl) {
      throw new Error("wrong element");
    }

    if (options?.onClose) {
      toastEl.addEventListener("clg-close", options.onClose);
    }

    const group = createTransitionGroupIfNone();
    await group.queue(toastEl);
    return toastEl;
  }

};
;// ./htdocs/assets/js/collage/tmp/export-build/_entry.js



// Pre-populate shadow DOM styles so components never call Etsy.getString()
const sheet = new CSSStyleSheet();
sheet.replaceSync("@charset \"UTF-8\";\n/**\n * Do not edit directly\n * Generated on Tue, 10 Feb 2026 22:22:44 GMT\n */\n/**\n * Do not edit directly\n * Generated on Tue, 10 Feb 2026 22:22:44 GMT\n */\n/* stylelint-disable etsy-rules/enforce-collage-tokens-using-calc */\n/* stylelint-enable etsy-rules/enforce-collage-tokens-using-calc */\nclg-profile-avatar {\n  display: inline-block;\n  height: var(--clg-avatar-host-size, var(--clg-dimension-app-avatar-base-size, 48px));\n  width: var(--clg-avatar-host-size, var(--clg-dimension-app-avatar-base-size, 48px));\n}\nclg-profile-avatar[size=smallest] {\n  --clg-avatar-host-size: var(--clg-dimension-app-avatar-smallest-size, 24px);\n}\nclg-profile-avatar[size=smaller] {\n  --clg-avatar-host-size: var(--clg-dimension-app-avatar-smaller-size, 32px);\n}\nclg-profile-avatar[size=larger] {\n  --clg-avatar-host-size: var(--clg-dimension-app-avatar-larger-size, 64px);\n}\nclg-profile-avatar[size=largest] {\n  --clg-avatar-host-size: var(--clg-dimension-app-avatar-largest-size, 96px);\n}\n\nclg-shop-avatar {\n  --clg-shop-avatar-size: var(--clg-dimension-app-avatar-base-size, 48px);\n  display: inline-flex;\n  width: var(--clg-shop-avatar-size);\n  height: var(--clg-shop-avatar-size);\n  justify-content: center;\n  align-items: center;\n  aspect-ratio: 1 / 1;\n}\nclg-shop-avatar[size=smaller] {\n  --clg-shop-avatar-size: var(--clg-dimension-app-avatar-smaller-size, 32px);\n}\nclg-shop-avatar[size=larger] {\n  --clg-shop-avatar-size: var(--clg-dimension-app-avatar-larger-size, 64px);\n}\nclg-shop-avatar[size=largest] {\n  --clg-shop-avatar-size: var(--clg-dimension-app-avatar-largest-size, 96px);\n}\n\nclg-icon {\n  height: var(--clg-icon-size, var(--clg-dimension-sem-icon-core-base, 24px));\n  width: var(--clg-icon-size, var(--clg-dimension-sem-icon-core-base, 24px));\n  display: inline-flex;\n  justify-content: center;\n  align-items: center;\n  vertical-align: middle;\n  aspect-ratio: 1/1;\n}\nclg-icon[size=smallest] {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-smallest, 12px);\n}\nclg-icon[size=smaller] {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\nclg-icon[size=larger] {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-larger, 36px);\n}\nclg-icon[size=largest] {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-largest, 48px);\n}\n\nclg-brand-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  height: var(--clg-icon-size, var(--clg-dimension-sem-icon-brand-base, 96px));\n  width: var(--clg-icon-size, var(--clg-dimension-sem-icon-brand-base, 96px));\n}\nclg-brand-icon[size=smallest] {\n  --clg-icon-container-size: var(--clg-dimension-sem-icon-brand-container-smallest, 96px);\n  --clg-icon-size: var(--clg-dimension-sem-icon-brand-smallest, 60px);\n}\nclg-brand-icon[size=smaller] {\n  --clg-icon-container-size: var(--clg-dimension-sem-icon-brand-container-smaller, 120px);\n  --clg-icon-size: var(--clg-dimension-sem-icon-brand-smaller, 84px);\n}\nclg-brand-icon[size=larger] {\n  --clg-icon-container-size: var(--clg-dimension-sem-icon-brand-container-larger, 168px);\n  --clg-icon-size: var(--clg-dimension-sem-icon-brand-larger, 108px);\n}\nclg-brand-icon[size=largest] {\n  --clg-icon-container-size: var(--clg-dimension-sem-icon-brand-container-largest, 192px);\n  --clg-icon-size: var(--clg-dimension-sem-icon-brand-largest, 120px);\n}\nclg-brand-icon[variant=empty], clg-brand-icon[variant=success01], clg-brand-icon[variant=success02], clg-brand-icon[variant=error01], clg-brand-icon[variant=error02], clg-brand-icon[variant=marketing01], clg-brand-icon[variant=marketing02], clg-brand-icon[variant=marketing03] {\n  height: var(--clg-icon-container-size, var(--clg-dimension-sem-icon-brand-container-base, 144px));\n  width: var(--clg-icon-container-size, var(--clg-dimension-sem-icon-brand-container-base, 144px));\n}\n\nclg-logo {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  height: var(--clg-dimension-sem-icon-core-base, 24px);\n  width: auto;\n}\n\nclg-shape {\n  position: relative;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  height: var(--clg-shape-size, var(--clg-dimension-app-avatar-base-size, 48px));\n  width: var(--clg-shape-size, var(--clg-dimension-app-avatar-base-size, 48px));\n}\nclg-shape[size=larger] {\n  --clg-shape-size: var(--clg-dimension-app-avatar-larger-size, 64px);\n}\nclg-shape[size=largest] {\n  --clg-shape-size: var(--clg-dimension-app-avatar-largest-size, 96px);\n}\n\n:root {\n  --clg-global-styles-loaded: 1;\n}\n\n@keyframes hideBriefly {\n  0%, 100% {\n    visibility: hidden;\n  }\n}\n:not(:defined) {\n  animation: hideBriefly 2s;\n}\n\n/**\n * Do not edit directly\n * Generated on Tue, 10 Feb 2026 22:22:44 GMT\n */\n.clg-avatar-group {\n  display: inline-flex;\n  align-items: flex-start;\n}\n:host(clg-avatar-group[size=larger]) .clg-avatar-group__profile-avatar {\n  margin-left: var(--clg-dimension-app-avatar-larger-group-gap, -12px);\n}\n:host(clg-avatar-group[size=largest]) .clg-avatar-group__profile-avatar {\n  margin-left: var(--clg-dimension-app-avatar-largest-group-gap, -12px);\n}\n\n.clg-profile-avatar {\n  --clg-avatar-bg-color: unset;\n  --clg-avatar-border-width: unset;\n  --clg-avatar-border-color: var(--clg-color-app-avatar-border, #FFFFFF);\n  --clg-avatar-size: unset;\n  position: relative;\n  display: inline-block;\n  fill: var(--clg-avatar-bg-color);\n}\n:host(clg-profile-avatar[size=smallest]) .clg-profile-avatar {\n  --clg-avatar-size: var(--clg-dimension-app-avatar-smallest-image-size, 24px);\n}\n:host(clg-profile-avatar[border][size=smallest]) .clg-profile-avatar {\n  --clg-avatar-border-width: var(--clg-shape-app-avatar-smallest-border-width, 1px);\n}\n:host(clg-profile-avatar[size=smaller]) .clg-profile-avatar {\n  --clg-avatar-size: var(--clg-dimension-app-avatar-smaller-image-size, 32px);\n}\n:host(clg-profile-avatar[border][size=smaller]) .clg-profile-avatar {\n  --clg-avatar-border-width: var(--clg-shape-app-avatar-smaller-border-width, 1px);\n}\n:host(clg-profile-avatar[size=base]) .clg-profile-avatar {\n  --clg-avatar-size: var(--clg-dimension-app-avatar-base-image-size, 32px);\n}\n:host(clg-profile-avatar[border][size=base]) .clg-profile-avatar {\n  --clg-avatar-border-width: var(--clg-shape-app-avatar-base-border-width, 2px);\n}\n:host(clg-profile-avatar[size=larger]) .clg-profile-avatar {\n  --clg-avatar-size: var(--clg-dimension-app-avatar-larger-image-size, 40px);\n}\n:host(clg-profile-avatar[border][size=larger]) .clg-profile-avatar {\n  --clg-avatar-border-width: var(--clg-shape-app-avatar-larger-border-width, 4px);\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar {\n  --clg-avatar-size: var(--clg-dimension-app-avatar-largest-image-size, 64px);\n}\n:host(clg-profile-avatar[border][size=largest]) .clg-profile-avatar {\n  --clg-avatar-border-width: var(--clg-shape-app-avatar-largest-border-width, 4px);\n}\n:host(clg-profile-avatar[color=red][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-red-light, #F7D5DA);\n}\n:host(clg-profile-avatar[color=red]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-red-dark, #93150E);\n}\n:host(clg-profile-avatar[color=yellow][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-yellow-light, #F19D27);\n}\n:host(clg-profile-avatar[color=yellow]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-yellow-dark, #814C1D);\n}\n:host(clg-profile-avatar[color=blue][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-blue-light, #CCEBFF);\n}\n:host(clg-profile-avatar[color=blue]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-blue-dark, #2638C0);\n}\n:host(clg-profile-avatar[color=green][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-green-light, #4BC46D);\n}\n:host(clg-profile-avatar[color=green]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-green-dark, #095E31);\n}\n:host(clg-profile-avatar[color=purple][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-purple-light, #A09BF3);\n}\n:host(clg-profile-avatar[color=purple]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-purple-dark, #6F62C6);\n}\n:host(clg-profile-avatar[color=teal][with-image]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-teal-light, #CADADE);\n}\n:host(clg-profile-avatar[color=teal]) .clg-profile-avatar {\n  --clg-avatar-bg-color: var(--clg-color-sem-background-surface-expressive-teal-dark, #789AA2);\n}\n.clg-profile-avatar__circle {\n  display: none;\n  border-radius: var(--clg-shape-app-avatar-profile-border-radius, 999999px);\n  background-color: var(--clg-avatar-bg-color);\n}\n:host(clg-profile-avatar[size=smallest]) .clg-profile-avatar__circle {\n  display: block;\n  width: var(--clg-dimension-app-avatar-smallest-size, 24px);\n  height: var(--clg-dimension-app-avatar-smallest-size, 24px);\n}\n:host(clg-profile-avatar[size=smaller]) .clg-profile-avatar__circle {\n  display: block;\n  width: var(--clg-dimension-app-avatar-smaller-size, 32px);\n  height: var(--clg-dimension-app-avatar-smaller-size, 32px);\n}\n:host(clg-profile-avatar[size=smaller]) .clg-profile-avatar__shape, :host(clg-profile-avatar[size=smallest]) .clg-profile-avatar__shape {\n  display: none;\n}\n:host(clg-profile-avatar[border]) .clg-profile-avatar__shape {\n  stroke: var(--clg-avatar-border-color);\n  stroke-width: var(--clg-avatar-border-width);\n}\n.clg-profile-avatar__initial, .clg-profile-avatar__content {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  border-radius: var(--clg-shape-app-avatar-profile-border-radius, 999999px);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.clg-profile-avatar__content {\n  height: var(--clg-avatar-size);\n  width: var(--clg-avatar-size);\n  overflow: hidden;\n}\n:host(clg-profile-avatar[border][size=smallest]) .clg-profile-avatar__content, :host(clg-profile-avatar[border][size=smaller]) .clg-profile-avatar__content {\n  border-radius: var(--clg-shape-app-avatar-profile-border-radius, 999999px);\n  border: var(--clg-avatar-border-width) solid var(--clg-avatar-border-color);\n}\n.clg-profile-avatar__content ::slotted(img) {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n.clg-profile-avatar__initial {\n  color: var(--clg-color-app-avatar-text, #FFFFFF);\n  text-align: center;\n}\n:host(clg-profile-avatar[size=smallest]) .clg-profile-avatar__initial {\n  font-family: var(--clg-typography-sem-product-heading-mobile-small-font-family, \"Guardian-EgypTT\", \"Charter\", \"Charter Bitstream\", \"Cambria\", \"Noto Serif Light\", \"Droid Serif\", \"Georgia\", \"serif\");\n  font-weight: var(--clg-typography-sem-product-heading-mobile-small-font-weight, 300);\n  font-size: var(--clg-typography-sem-product-heading-mobile-small-font-size, 19.01px);\n  line-height: var(--clg-typography-sem-product-heading-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-heading-mobile-small-letter-spacing, 0.23763px);\n  font-size: var(--clg-dimension-app-avatar-smallest-text-size, 12px);\n}\n:host(clg-profile-avatar[size=smaller]) .clg-profile-avatar__initial {\n  font-family: var(--clg-typography-sem-product-heading-mobile-small-font-family, \"Guardian-EgypTT\", \"Charter\", \"Charter Bitstream\", \"Cambria\", \"Noto Serif Light\", \"Droid Serif\", \"Georgia\", \"serif\");\n  font-weight: var(--clg-typography-sem-product-heading-mobile-small-font-weight, 300);\n  font-size: var(--clg-typography-sem-product-heading-mobile-small-font-size, 19.01px);\n  line-height: var(--clg-typography-sem-product-heading-mobile-small-line-height, 1.6);\n  letter-spacing: var(--clg-typography-sem-product-heading-mobile-small-letter-spacing, 0.23763px);\n  font-size: var(--clg-dimension-app-avatar-smaller-text-size, 16px);\n}\n:host(clg-profile-avatar[size=base]) .clg-profile-avatar__initial {\n  font-family: var(--clg-typography-sem-product-heading-mobile-base-font-family, \"Guardian-EgypTT\", \"Charter\", \"Charter Bitstream\", \"Cambria\", \"Noto Serif Light\", \"Droid Serif\", \"Georgia\", \"serif\");\n  font-weight: var(--clg-typography-sem-product-heading-mobile-base-font-weight, 300);\n  font-size: var(--clg-typography-sem-product-heading-mobile-base-font-size, 24px);\n  line-height: var(--clg-typography-sem-product-heading-mobile-base-line-height, 1.15);\n  letter-spacing: var(--clg-typography-sem-product-heading-mobile-base-letter-spacing, 0.48px);\n  font-size: var(--clg-dimension-app-avatar-base-text-size, 24px);\n}\n:host(clg-profile-avatar[size=larger]) .clg-profile-avatar__initial {\n  font-family: var(--clg-typography-sem-product-heading-mobile-large-font-family, \"Guardian-EgypTT\", \"Charter\", \"Charter Bitstream\", \"Cambria\", \"Noto Serif Light\", \"Droid Serif\", \"Georgia\", \"serif\");\n  font-weight: var(--clg-typography-sem-product-heading-mobile-large-font-weight, 300);\n  font-size: var(--clg-typography-sem-product-heading-mobile-large-font-size, 31.01px);\n  line-height: var(--clg-typography-sem-product-heading-mobile-large-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-heading-mobile-large-letter-spacing, 0px);\n  font-size: var(--clg-dimension-app-avatar-larger-text-size, 32px);\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar__initial {\n  font-family: var(--clg-typography-sem-product-heading-mobile-large-font-family, \"Guardian-EgypTT\", \"Charter\", \"Charter Bitstream\", \"Cambria\", \"Noto Serif Light\", \"Droid Serif\", \"Georgia\", \"serif\");\n  font-weight: var(--clg-typography-sem-product-heading-mobile-large-font-weight, 300);\n  font-size: var(--clg-typography-sem-product-heading-mobile-large-font-size, 31.01px);\n  line-height: var(--clg-typography-sem-product-heading-mobile-large-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-heading-mobile-large-letter-spacing, 0px);\n  font-size: var(--clg-dimension-app-avatar-largest-text-size, 40px);\n}\n.clg-profile-avatar__dot-indicator {\n  position: absolute;\n}\n:host(clg-profile-avatar[size=smallest]) .clg-profile-avatar__dot-indicator {\n  top: calc(-1 * var(--clg-dimension-pal-grid-100, 8px));\n  right: calc(-1 * var(--clg-dimension-pal-grid-050, 4px));\n}\n:host(clg-profile-avatar[size=smaller]) .clg-profile-avatar__dot-indicator {\n  top: calc(-1 * var(--clg-dimension-pal-grid-100, 8px));\n  right: calc(-1 * var(--clg-dimension-pal-grid-050, 4px));\n}\n:host(clg-profile-avatar[size=base]) .clg-profile-avatar__dot-indicator {\n  top: 0;\n  right: 0;\n}\n:host(clg-profile-avatar[size=larger]) .clg-profile-avatar__dot-indicator {\n  top: var(--clg-dimension-pal-grid-025, 2px);\n  right: var(--clg-dimension-pal-grid-025, 2px);\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar__dot-indicator {\n  top: var(--clg-dimension-pal-grid-050, 4px);\n  right: var(--clg-dimension-pal-grid-050, 4px);\n}\n.clg-profile-avatar__badge {\n  position: absolute;\n  bottom: calc(-1 * var(--clg-dimension-pal-grid-025, 2px));\n  right: calc(-1 * var(--clg-dimension-pal-grid-025, 2px));\n}\n.clg-profile-avatar__badge-admin {\n  display: none;\n  height: var(--clg-dimension-sem-icon-core-smaller, 18px);\n  width: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n:host(clg-profile-avatar[badge=etsy-admin]) .clg-profile-avatar__badge-admin {\n  display: block;\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar__badge-admin {\n  height: var(--clg-dimension-sem-icon-core-base, 24px);\n  width: var(--clg-dimension-sem-icon-core-base, 24px);\n}\n.clg-profile-avatar__badge-star-seller {\n  display: none;\n  background-color: var(--clg-color-app-avatar-border, #FFFFFF);\n  border-radius: var(--clg-shape-app-avatar-profile-border-radius, 999999px);\n  width: var(--clg-dimension-app-avatar-larger-badge-size, 16px);\n  height: var(--clg-dimension-app-avatar-larger-badge-size, 16px);\n}\n:host(clg-profile-avatar[badge=star-seller]) .clg-profile-avatar__badge-star-seller {\n  display: flex;\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar__badge-star-seller {\n  width: var(--clg-dimension-app-avatar-largest-badge-size, 24px);\n  height: var(--clg-dimension-app-avatar-largest-badge-size, 24px);\n}\n.clg-profile-avatar__badge-star-seller-icon {\n  color: var(--clg-color-sem-text-star-seller);\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n:host(clg-profile-avatar[size=largest]) .clg-profile-avatar__badge-star-seller-icon {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-base, 24px);\n}\n\n.clg-shop-avatar {\n  --clg-shop-avatar-border-width: var(--clg-shape-app-avatar-base-border-width, 2px);\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  border-radius: var(--clg-shape-app-avatar-shop-border-radius, 4px);\n  background-color: var(--clg-color-app-avatar-background, #0E0E0E17);\n  height: 100%;\n  width: 100%;\n}\n:host(clg-shop-avatar[border]) .clg-shop-avatar {\n  border: var(--clg-shop-avatar-border-width) solid var(--clg-color-app-avatar-border, #FFFFFF);\n}\n:host(clg-shop-avatar[size=larger]) .clg-shop-avatar {\n  --clg-shop-avatar-border-width: var(--clg-shape-app-avatar-larger-border-width, 4px);\n}\n:host(clg-shop-avatar[size=largest]) .clg-shop-avatar {\n  --clg-shop-avatar-border-width: var(--clg-shape-app-avatar-largest-border-width, 4px);\n}\n.clg-shop-avatar ::slotted(img) {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n  border-radius: var(--clg-shape-app-avatar-shop-border-radius, 4px);\n}\n\n:host(clg-global-alert-banner),\n:host(clg-section-alert-banner) {\n  display: block;\n}\n\n.clg-alert-banner {\n  --clg-banner-color: var(--clg-color-sem-text-on-surface-light);\n  --clg-banner-icon-color: var(--clg-color-sem-text-on-surface-light);\n  --clg-banner-icon-bg: var(--clg-color-pal-greyscale-000);\n  --clg-banner-bg: unset;\n  color: var(--clg-banner-color);\n  background-color: var(--clg-banner-bg);\n  border-radius: var(--clg-banner-border-radius);\n}\n.clg-alert-banner__icon {\n  background: var(--clg-color-app-alert-banner-strong-icon-background, #FFFFFF);\n  color: var(--clg-banner-icon-color);\n  background-color: var(--clg-banner-icon-bg);\n  width: var(--clg-dimension-pal-grid-400, 32px);\n  height: var(--clg-dimension-pal-grid-400, 32px);\n  justify-content: center;\n  align-items: center;\n}\n.clg-alert-banner__bell, .clg-alert-banner__exclamation, .clg-alert-banner__check {\n  display: none;\n}\n:host(clg-section-alert-banner) .clg-alert-banner {\n  --clg-banner-border-radius: var(--clg-shape-app-alert-border-radius);\n}\n:host(clg-section-alert-banner[color=warning]) .clg-alert-banner__bell {\n  display: flex;\n}\n:host(clg-section-alert-banner[color=critical]) .clg-alert-banner__exclamation {\n  display: flex;\n}\n:host(clg-global-alert-banner[color=warning]) .clg-alert-banner__bell {\n  display: flex;\n}\n:host(clg-global-alert-banner[color=critical]) .clg-alert-banner__exclamation {\n  display: flex;\n}\n:host(clg-section-alert-banner[color=success]) .clg-alert-banner__check {\n  display: flex;\n}\n:host(clg-section-alert-banner[color=warning][variant=subtle]) .clg-alert-banner {\n  --clg-banner-icon-bg: var(\n      --clg-color-app-alert-banner-subtle-warning-icon-background\n  );\n  --clg-banner-icon-color: var(\n      --clg-color-app-alert-banner-subtle-warning-icon-foreground\n  );\n}\n:host(clg-section-alert-banner[color=warning][variant=strong]) .clg-alert-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-warning-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-warning-text);\n}\n:host(clg-global-alert-banner[color=warning]) .clg-alert-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-warning-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-warning-text);\n}\n:host(clg-section-alert-banner[color=critical][variant=subtle]) .clg-alert-banner {\n  --clg-banner-icon-bg: var(\n      --clg-color-app-alert-banner-subtle-critical-icon-background\n  );\n  --clg-banner-icon-color: var(\n      --clg-color-app-alert-banner-subtle-critical-icon-foreground\n  );\n}\n:host(clg-section-alert-banner[color=critical][variant=strong]) .clg-alert-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-critical-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-critical-text);\n}\n:host(clg-global-alert-banner[color=critical]) .clg-alert-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-critical-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-critical-text);\n}\n:host(clg-section-alert-banner[color=success][variant=subtle]) .clg-alert-banner {\n  --clg-banner-icon-bg: var(\n      --clg-color-app-alert-banner-subtle-success-icon-background\n  );\n  --clg-banner-icon-color: var(\n      --clg-color-app-alert-banner-subtle-success-icon-foreground\n  );\n}\n:host(clg-section-alert-banner[color=success][variant=strong]) .clg-alert-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-success-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-success-text);\n}\n\n:host(clg-banner-base) {\n  display: block;\n}\n\n.clg-banner-base {\n  padding: var(--clg-dimension-app-alert-banner-padding-vertical, 12px);\n  position: relative;\n  display: flex;\n  text-align: left;\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n  color: var(--clg-banner-color);\n  background-color: var(--clg-banner-bg);\n  border-radius: var(--clg-banner-border-radius);\n}\n:host(clg-banner-base:not([open])) .clg-banner-base {\n  display: none;\n}\n@media only screen and (min-width: 640px) {\n  .clg-banner-base {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n:host(clg-banner-base[variant=subtle]) .clg-banner-base {\n  border: var(--clg-shape-app-alert-border-width, 1.5px) solid var(--clg-color-app-alert-banner-subtle-border, #0E0E0E2E);\n}\n.clg-banner-base__container {\n  display: flex;\n  width: 100%;\n  justify-content: space-between;\n  align-items: flex-start;\n}\n@media only screen and (min-width: 0) and (max-width: 899px) {\n  :host(clg-banner-base[buttons=buttonGroup]) .clg-banner-base__container {\n    flex-direction: column;\n    gap: var(--clg-dimension-app-alert-banner-button-group-margin, 8px);\n  }\n}\n.clg-banner-base__alert-content {\n  display: flex;\n}\n:host(clg-banner-base:not([subtitle])) .clg-banner-base__alert-content {\n  align-items: center;\n}\n.clg-banner-base__text-content {\n  display: flex;\n  flex-direction: column;\n  gap: var(--clg-dimension-pal-grid-050, 4px);\n  flex: 1;\n}\n.clg-banner-base__title a, .clg-banner-base__body a {\n  color: inherit;\n}\n.clg-banner-base__title {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n  display: flex;\n  align-items: center;\n}\n@media only screen and (min-width: 640px) {\n  .clg-banner-base__title {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n.clg-banner-base__title ::slotted([slot=title]) {\n  font: inherit;\n  margin: 0;\n}\n.clg-banner-base__icon {\n  display: flex;\n  width: var(--clg-dimension-pal-grid-400, 32px);\n  height: var(--clg-dimension-pal-grid-400, 32px);\n  justify-content: center;\n  align-items: center;\n  border-radius: var(--clg-shape-sem-border-radius-full, 999999px);\n  overflow: hidden;\n  flex: 0 0 auto;\n  margin-right: var(--clg-dimension-pal-spacing-300, 18px);\n}\n.clg-banner-base__button-group, .clg-banner-base__inline-button, .clg-banner-base__dismiss-button {\n  display: none;\n}\n:host(clg-banner-base[buttons=dismissOnly]) .clg-banner-base__dismiss-button {\n  display: block;\n}\n:host(clg-banner-base[buttons=inlineButton]) .clg-banner-base__inline-button {\n  display: block;\n}\n:host(clg-banner-base[buttons=buttonGroup]) .clg-banner-base__button-group {\n  display: block;\n}\n@media only screen and (min-width: 0) and (max-width: 899px) {\n  :host(clg-banner-base[buttons=buttonGroup]) .clg-banner-base__button-group {\n    margin-left: calc(var(--clg-dimension-pal-grid-400, 32px) + var(--clg-dimension-pal-spacing-300, 18px));\n  }\n}\n\n:host(clg-signal-banner) {\n  display: block;\n}\n\n.clg-signal-banner {\n  --clg-banner-color: unset;\n  --clg-banner-icon-color: var(--clg-color-app-alert-banner-strong-icon-foreground);\n  --clg-banner-icon-bg: var(--clg-color-app-alert-banner-strong-icon-background);\n  --clg-banner-bg: unset;\n  --clg-banner-border-radius: var(--clg-shape-app-alert-border-radius);\n  color: var(--clg-banner-color);\n  background-color: var(--clg-banner-bg);\n  border-radius: var(--clg-banner-border-radius);\n}\n.clg-signal-banner__icon {\n  background: var(--clg-color-app-alert-banner-strong-icon-background, #FFFFFF);\n  color: var(--clg-banner-icon-color);\n  background-color: var(--clg-banner-icon-bg);\n  display: flex;\n  width: var(--clg-dimension-pal-grid-400, 32px);\n  height: var(--clg-dimension-pal-grid-400, 32px);\n  justify-content: center;\n  align-items: center;\n}\n:host(clg-signal-banner[color=neutral][variant=subtle]) .clg-signal-banner {\n  --clg-banner-icon-bg: var(\n      --clg-color-app-alert-banner-subtle-neutral-icon-background\n  );\n  --clg-banner-icon-color: var(\n      --clg-color-app-alert-banner-subtle-neutral-icon-foreground\n  );\n}\n:host(clg-signal-banner[color=neutral][variant=strong]) .clg-signal-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-neutral-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-neutral-text);\n}\n:host(clg-signal-banner[color=highlight][variant=subtle]) .clg-signal-banner {\n  --clg-banner-icon-bg: var(\n      --clg-color-app-alert-banner-subtle-highlight-icon-background\n  );\n  --clg-banner-icon-color: var(\n      --clg-color-app-alert-banner-subtle-highlight-icon-foreground\n  );\n}\n:host(clg-signal-banner[color=highlight][variant=strong]) .clg-signal-banner {\n  --clg-banner-bg: var(\n      --clg-color-app-alert-banner-strong-highlight-background\n  );\n  --clg-banner-color: var(--clg-color-app-alert-banner-strong-highlight-text);\n}\n\n/* stylelint-disable indentation */\n:host(clg-button) {\n  display: inline-block;\n}\n\n.clg-button {\n  --clg-button-bg-color: unset;\n  --clg-button-text-color: unset;\n  --clg-button-border-color: unset;\n  --clg-button-border-width: unset;\n  --clg-button-font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n  --clg-button-font-line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n  --clg-button-height: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  --clg-button-width: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-button-padding-vertical: var(--clg-dimension-app-button-padding-vertical, 12px);\n  --clg-button-padding-horizontal: var(--clg-dimension-app-button-padding-horizontal, 18px);\n  /* Display properties */\n  display: inline-block;\n  position: relative;\n  vertical-align: middle;\n  /* Box model */\n  width: 100%;\n  min-height: var(--clg-button-height);\n  min-width: var(--clg-button-width);\n  padding: var(--clg-button-padding-vertical) var(--clg-button-padding-horizontal);\n  /* Typography */\n  font: inherit;\n  font-size: var(--clg-button-font-size);\n  font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n  line-height: var(--clg-button-font-line-height);\n  text-align: center;\n  text-decoration: none;\n  /* Appearance */\n  background: none;\n  outline: none;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  background-color: var(--clg-button-bg-color);\n  border: var(--clg-button-border-color) solid var(--clg-button-border-width);\n  color: var(--clg-button-text-color);\n  /* Interaction */\n  cursor: pointer;\n  /* Fixes a visual bug related to iOS button taps */\n  -webkit-tap-highlight-color: transparent;\n  /* Remove default gradient on mobile Safari buttons */\n  -webkit-appearance: none;\n  appearance: none;\n  transition: scale var(--clg-effect-app-button-on-hover-scale-curve, cubic-bezier(0.3, 0, 0, 1)) var(--clg-effect-app-button-on-hover-scale-duration, 75ms), background-color var(--clg-effect-app-button-on-hover-fade-curve, cubic-bezier(0, 0, 1, 1)) var(--clg-effect-app-button-on-hover-fade-duration, 25ms);\n  --clg-focus-ring-color: var(--clg-color-app-button-focused-border, #3B67D9);\n}\n:host(clg-button:not([disabled]):not([loading])) .clg-button:hover {\n  box-shadow: var(--clg-effect-sem-shadow-elevation-3, 0px 1px 3px 0px #0000004D, 0px 4px 8px 3px #00000026);\n  scale: var(--clg-effect-app-button-on-hover-scale-to, 1.01);\n}\n:host(clg-button:not([disabled]):not([loading])) .clg-button:hover {\n  color: var(--clg-button-text-color-hovered);\n  background-color: var(--clg-button-bg-color-hovered);\n  border-color: var(--clg-button-border-color-hovered);\n}\n:host(clg-button:not([disabled]):not([loading])) .clg-button:active {\n  color: var(--clg-button-text-color-pressed);\n  background-color: var(--clg-button-bg-color-pressed);\n  border-color: var(--clg-button-border-color-pressed);\n  scale: var(--clg-effect-app-button-on-press-scale-to, 0.985);\n  transition: scale var(--clg-effect-app-button-on-press-scale-curve, cubic-bezier(0.3, 0, 0, 1)) var(--clg-effect-app-button-on-press-scale-duration, 75ms), background-color var(--clg-effect-app-button-on-press-fade-curve, cubic-bezier(0, 0, 1, 1)) var(--clg-effect-app-button-on-press-fade-duration, 25ms);\n}\n:host(clg-button:not([disabled]):not([loading])) .clg-button[data-released] {\n  transition: scale var(--clg-effect-app-button-on-release-scale-curve, cubic-bezier(0.3, 0, 0, 1)) var(--clg-effect-app-button-on-release-scale-duration, 150ms), background-color var(--clg-effect-app-button-on-release-fade-curve, cubic-bezier(0.3, 0, 0, 1)) var(--clg-effect-app-button-on-release-fade-duration, 150ms);\n}\n\n:host(clg-button[background-type=light]) .clg-button {\n  --clg-focus-ring-color: var(--clg-color-app-button-focused-on-surface-light-border, #3B67D9);\n}\n\n:host(clg-button[background-type=dark]) .clg-button {\n  --clg-focus-ring-color: var(--clg-color-app-button-focused-on-surface-dark-border, #8DB2EE);\n}\n\n:host([pseudo-focus]) :host(clg-button:not([disabled])) .clg-button, :host(clg-button:not([disabled])) .clg-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host(clg-button:not([disabled])) .clg-button:focus-within, :host(clg-button:not([disabled])) .clg-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-button:not([disabled])) .clg-button:not(:focus-visible), :host(clg-button:not([disabled])) .clg-button:focus:not(:focus-visible) {\n  outline: none;\n}\n:host(clg-button[loading]) .clg-button,\n:host(clg-button[disabled]) .clg-button {\n  color: var(--clg-button-text-color-disabled);\n  background-color: var(--clg-button-bg-color-disabled);\n  border-color: var(--clg-button-border-color-disabled);\n}\n\n:host(clg-button[disabled]) .clg-button {\n  cursor: not-allowed;\n}\n\n:host(clg-button[disabled][loading]) .clg-button, :host(clg-button[loading]) .clg-button {\n  cursor: progress;\n}\n\n:host(clg-button[loading]) .clg-button__content {\n  visibility: hidden !important;\n}\n\n:host(clg-button[size=small]) .clg-button {\n  --clg-button-font-line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n  --clg-button-font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n  --clg-button-height: var(--clg-dimension-sem-interaction-small, 36px);\n  --clg-button-width: var(--clg-dimension-sem-interaction-small, 36px);\n  --clg-button-padding-vertical: var(--clg-dimension-app-button-small-padding-vertical, 9px);\n  --clg-button-padding-horizontal: var(--clg-dimension-app-button-small-padding-horizontal, 15px);\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n\n.clg-button__content {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: var(--clg-dimension-app-button-gap, 6px);\n}\n.clg-button__spinner-frame {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n/**\n * Loading spinner type visibility by button variant\n */\n:host(clg-button) .clg-button__spinner-frame__light-spinner,\n:host(clg-button) .clg-button__spinner-frame__dark-spinner {\n  display: none;\n}\n\n:host(clg-button[variant=primary][background-type=dynamic]) .clg-button__spinner-frame__light-spinner,\n:host(clg-button[variant=primary][background-type=light]) .clg-button__spinner-frame__light-spinner,\n:host(clg-button[variant=secondary][background-type=dark]) .clg-button__spinner-frame__light-spinner,\n:host(clg-button[variant=tertiary][background-type=dark]) .clg-button__spinner-frame__light-spinner {\n  display: block;\n}\n\n:host(clg-button[variant=primary][background-type=dark]) .clg-button__spinner-frame__dark-spinner,\n:host(clg-button[variant=secondary][background-type=dynamic]) .clg-button__spinner-frame__dark-spinner,\n:host(clg-button[variant=secondary][background-type=light]) .clg-button__spinner-frame__dark-spinner,\n:host(clg-button[variant=tertiary][background-type=dynamic]) .clg-button__spinner-frame__dark-spinner,\n:host(clg-button[variant=tertiary][background-type=light]) .clg-button__spinner-frame__dark-spinner {\n  display: block;\n}\n\n/* prettier-ignore */\n:host(clg-button[variant=primary]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-background, #222222);\n  --clg-button-text-color: var(--clg-color-app-button-primary-text, #FFFFFF);\n  --clg-button-border-color: var(--clg-color-app-button-primary-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-primary-hovered-background, #2f2f2f);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-primary-hovered-text, #FFFFFF);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-primary-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-primary-pressed-background, #595959);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-primary-pressed-text, #FFFFFF);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-primary-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-primary-disabled-background, #757575);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-primary-disabled-text, #FFFFFF);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-primary-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=primary][background-type=light]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-on-surface-light-background, #222222);\n  --clg-button-text-color: var(--clg-color-app-button-primary-on-surface-light-text, #FFFFFF);\n  --clg-button-border-color: var(--clg-color-app-button-primary-on-surface-light-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-primary-on-surface-light-hovered-background, #3E3E3E);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-primary-on-surface-light-hovered-text, #FFFFFF);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-primary-on-surface-light-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-primary-on-surface-light-pressed-background, #595959);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-primary-on-surface-light-pressed-text, #FFFFFF);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-primary-on-surface-light-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-primary-on-surface-light-disabled-background, #757575);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-primary-on-surface-light-disabled-text, #FFFFFF);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-primary-on-surface-light-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=primary][background-type=dark]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-background, #FFFFFF);\n  --clg-button-text-color: var(--clg-color-app-button-primary-on-surface-dark-text, #222222);\n  --clg-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-primary-on-surface-dark-hovered-background, #EAEAEA);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-primary-on-surface-dark-hovered-text, #222222);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-primary-on-surface-dark-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-primary-on-surface-dark-pressed-background, #D3D3D3);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-primary-on-surface-dark-pressed-text, #222222);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-primary-on-surface-dark-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-primary-on-surface-dark-disabled-background, #757575);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-primary-on-surface-dark-disabled-text, #222222);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-primary-on-surface-dark-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=secondary]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-secondary-background, #00000000);\n  --clg-button-text-color: var(--clg-color-app-button-secondary-text, #222222);\n  --clg-button-border-color: var(--clg-color-app-button-secondary-border, #222222);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-secondary-hovered-background, #00000000);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-secondary-hovered-text, #222222);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-secondary-hovered-border, #222222);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-secondary-pressed-background, #0E0E0E2E);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-secondary-pressed-text, #222222);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-secondary-pressed-border, #222222);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-secondary-disabled-background, #00000000);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-secondary-disabled-text, #757575);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-secondary-disabled-border, #757575);\n}\n\n:host(clg-button[variant=secondary][background-type=light]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-secondary-on-surface-light-background, #00000000);\n  --clg-button-text-color: var(--clg-color-app-button-secondary-on-surface-light-text, #222222);\n  --clg-button-border-color: var(--clg-color-app-button-secondary-on-surface-light-border, #222222);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-secondary-on-surface-light-hovered-background, #00000000);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-secondary-on-surface-light-hovered-text, #222222);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-secondary-on-surface-light-hovered-border, #222222);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-secondary-on-surface-light-pressed-background, #0E0E0E2E);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-secondary-on-surface-light-pressed-text, #222222);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-secondary-on-surface-light-pressed-border, #222222);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-secondary-on-surface-light-disabled-background, #00000000);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-secondary-on-surface-light-disabled-text, #757575);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-secondary-on-surface-light-disabled-border, #757575);\n}\n\n:host(clg-button[variant=secondary][background-type=dark]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-secondary-on-surface-dark-background, #00000000);\n  --clg-button-text-color: var(--clg-color-app-button-secondary-on-surface-dark-text, #FFFFFF);\n  --clg-button-border-color: var(--clg-color-app-button-secondary-on-surface-dark-border, #FFFFFF);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-secondary-on-surface-dark-hovered-background, #00000000);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-secondary-on-surface-dark-hovered-text, #FFFFFF);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-secondary-on-surface-dark-hovered-border, #FFFFFF);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-secondary-on-surface-dark-pressed-background, #FFFFFF3D);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-secondary-on-surface-dark-pressed-text, #FFFFFF);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-secondary-on-surface-dark-pressed-border, #FFFFFF);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-secondary-on-surface-dark-disabled-background, #00000000);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-secondary-on-surface-dark-disabled-text, #757575);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-secondary-on-surface-dark-disabled-border, #757575);\n}\n\n:host(clg-button[variant=tertiary]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-background, #0E0E0E17);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-text, #222222);\n  --clg-button-border-color: var(--clg-color-app-button-tertiary-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-tertiary-hovered-background, #0E0E0E2E);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-tertiary-hovered-text, #222222);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-tertiary-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-tertiary-pressed-background, #0E0E0E45);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-tertiary-pressed-text, #222222);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-tertiary-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-tertiary-disabled-background, #0E0E0E17);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-tertiary-disabled-text, #9E9E9E);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-tertiary-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=tertiary][background-type=light]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-on-surface-light-background, #0E0E0E17);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-on-surface-light-text, #222222);\n  --clg-button-border-color: var(--clg-color-app-button-tertiary-on-surface-light-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-tertiary-on-surface-light-hovered-background, #0E0E0E2E);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-tertiary-on-surface-light-hovered-text, #222222);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-tertiary-on-surface-light-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-tertiary-on-surface-light-pressed-background, #0E0E0E45);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-tertiary-on-surface-light-pressed-text, #222222);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-tertiary-on-surface-light-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-tertiary-on-surface-light-disabled-background, #0E0E0E17);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-tertiary-on-surface-light-disabled-text, #9E9E9E);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-tertiary-on-surface-light-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=tertiary][background-type=dark]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-on-surface-dark-background, #FFFFFF21);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-on-surface-dark-text, #FFFFFF);\n  --clg-button-border-color: var(--clg-color-app-button-tertiary-on-surface-dark-border, #00000000);\n  --clg-button-bg-color-hovered: var(--clg-color-app-button-tertiary-on-surface-dark-hovered-background, #FFFFFF3D);\n  --clg-button-text-color-hovered: var(--clg-color-app-button-tertiary-on-surface-dark-hovered-text, #FFFFFF);\n  --clg-button-border-color-hovered: var(--clg-color-app-button-tertiary-on-surface-dark-hovered-border, #00000000);\n  --clg-button-bg-color-pressed: var(--clg-color-app-button-tertiary-on-surface-dark-pressed-background, #FFFFFF45);\n  --clg-button-text-color-pressed: var(--clg-color-app-button-tertiary-on-surface-dark-pressed-text, #FFFFFF);\n  --clg-button-border-color-pressed: var(--clg-color-app-button-tertiary-on-surface-dark-pressed-border, #00000000);\n  --clg-button-bg-color-disabled: var(--clg-color-app-button-tertiary-on-surface-dark-disabled-background, #FFFFFF21);\n  --clg-button-text-color-disabled: var(--clg-color-app-button-tertiary-on-surface-dark-disabled-text, #9E9E9E);\n  --clg-button-border-color-disabled: var(--clg-color-app-button-tertiary-on-surface-dark-disabled-border, #00000000);\n}\n\n:host(clg-button[variant=primary]) .clg-button {\n  --clg-button-border-width: var(--clg-shape-app-button-primary-border-width, 0px);\n}\n\n:host(clg-button[variant=secondary]) .clg-button {\n  --clg-button-border-width: var(--clg-shape-app-button-secondary-border-width, 1.5px);\n}\n\n:host(clg-button[variant=tertiary]) .clg-button {\n  --clg-button-border-width: var(--clg-shape-app-button-tertiary-border-width, 0px);\n}\n\n:host(clg-button[variant=tertiary]:not([disabled]):not([loading])) .clg-button:hover, :host(clg-button[variant=tertiary]:not([disabled]):not([loading])) .clg-button:focus-within, :host(clg-button[variant=tertiary]:not([disabled]):not([loading])) .clg-button:focus-visible {\n  box-shadow: none;\n  transform: none;\n  transition: none;\n}\n\n:host(clg-button) ::slotted(input[type=submit]) {\n  position: absolute;\n  opacity: 0;\n  inset: 0;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  cursor: inherit;\n}\n\n:host(clg-button[hydrated]) ::slotted(input[type=submit]) {\n  display: none;\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-button-group {\n  --clg-button-group-direction: unset;\n  display: flex;\n  position: relative;\n  flex-wrap: wrap;\n  gap: var(--clg-dimension-app-button-gap, 6px);\n  flex-direction: var(--clg-button-group-direction);\n}\n\n:host(clg-button-group) {\n  display: inline-block;\n}\n\n:host(clg-button-group[orientation=horizontal]) .clg-button-group {\n  --clg-button-group-direction: row;\n}\n\n:host(clg-button-group[orientation=vertical]) .clg-button-group {\n  --clg-button-group-direction: column;\n}\n\n::slotted(clg-text-button) {\n  align-self: center;\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-anchored-button-group) {\n  display: block;\n  width: 100%;\n}\n\n.clg-anchored-button-group {\n  display: flex;\n  flex-direction: column;\n  gap: var(--clg-dimension-pal-grid-150, 12px);\n  padding: var(--clg-dimension-pal-grid-150, 12px) var(--clg-dimension-pal-grid-200, 16px);\n}\n\n.clg-anchored-button-group__buttons {\n  --clg-anchored-button-group-direction: column;\n  --clg-anchored-button-group-align-items: stretch;\n  --clg-anchored-button-group-gap: var(--clg-dimension-pal-grid-150, 12px);\n  display: flex;\n  width: 100%;\n  gap: var(--clg-anchored-button-group-gap);\n  flex-direction: var(--clg-anchored-button-group-direction);\n  align-items: var(--clg-anchored-button-group-align-items);\n}\n\n:host(clg-anchored-button-group[divider]) .clg-anchored-button-group {\n  border-top: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-color-sem-border-divider, #0E0E0E2E);\n}\n\n:host(clg-anchored-button-group[orientation=vertical]) .clg-anchored-button-group__buttons {\n  --clg-anchored-button-group-direction: column;\n  --clg-anchored-button-group-align-items: stretch;\n  --clg-anchored-button-group-gap: var(--clg-dimension-pal-grid-150, 12px);\n}\n\n:host(clg-anchored-button-group[orientation=horizontal]) .clg-anchored-button-group__buttons {\n  --clg-anchored-button-group-direction: row;\n  --clg-anchored-button-group-align-items: center;\n  --clg-anchored-button-group-gap: var(--clg-dimension-app-button-gap, 6px);\n  justify-content: flex-end;\n}\n:host(clg-anchored-button-group[orientation=horizontal]) .clg-anchored-button-group__buttons__primary {\n  order: 2;\n}\n:host(clg-anchored-button-group[orientation=horizontal]) .clg-anchored-button-group__buttons__secondary {\n  order: 1;\n}\n:host(clg-anchored-button-group[orientation=horizontal]) .clg-anchored-button-group__buttons__tertiary {\n  order: 0;\n  margin-right: auto;\n}\n\n/* This is a temporary file which will allow us to add the new refresh style overrides to the \nclg-button for the sign in flow experiment*/\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-button[variant=primary][withrefresh]),\n:host(clg-button[variant=primary][withrefresh]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-on-surface-light-background);\n  --clg-button-text-color: var(--clg-color-app-button-primary-on-surface-light-text);\n}\n\n:host(clg-button[variant=primary][withrefresh]:not([disabled])):hover, :host(clg-button[variant=primary][withrefresh]:not([disabled])):focus-within, :host(clg-button[variant=primary][withrefresh]:not([disabled])):focus-visible,\n:host(clg-button[variant=primary][withrefresh]:not([disabled])) .clg-button:hover,\n:host(clg-button[variant=primary][withrefresh]:not([disabled])) .clg-button:focus-within,\n:host(clg-button[variant=primary][withrefresh]:not([disabled])) .clg-button:focus-visible {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-on-surface-light-background);\n  --clg-button-text-color: var(--clg-color-app-button-primary-on-surface-light-text);\n}\n:host(clg-button[variant=primary][withrefresh]:not([disabled])):active,\n:host(clg-button[variant=primary][withrefresh]:not([disabled])) .clg-button:active {\n  --clg-button-bg-color: var(--clg-color-app-button-primary-pressed-background);\n}\n\n:host(clg-button[variant=tertiary][withrefresh]),\n:host(clg-button[variant=tertiary][withrefresh]) .clg-button {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-on-surface-light-background);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-on-surfaec-light-text);\n}\n\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])):hover, :host(clg-button[variant=tertiary][withrefresh]:not([disabled])):focus-within, :host(clg-button[variant=tertiary][withrefresh]:not([disabled])):focus-visible,\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])) .clg-button:hover,\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])) .clg-button:focus-within,\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])) .clg-button:focus-visible {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-on-surface-light-background);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-on-surface-light-text);\n}\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])):active,\n:host(clg-button[variant=tertiary][withrefresh]:not([disabled])) .clg-button:active {\n  --clg-button-bg-color: var(--clg-color-app-button-tertiary-pressed-background);\n  --clg-button-text-color: var(--clg-color-app-button-tertiary-pressed-text);\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-favorite-button {\n  --clg-favorite-button-bg-color: unset;\n  --clg-favorite-button-icon-color: unset;\n  --clg-favorite-button-border-color: unset;\n  --clg-favorite-button-border-width: unset;\n  --clg-icon-fill-color: var(--clg-favorite-button-icon-color);\n  --clg-favorite-button-height: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-favorite-button-width: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-favorite-button-padding-vertical: var(--clg-dimension-app-button-favorite-padding-vertical, 4px);\n  --clg-favorite-button-padding-horizontal: var(--clg-dimension-app-button-favorite-padding-horizontal, 4px);\n  --clg-favorite-button-scale: scaleX(1) scaleY(1) perspective(1px);\n  --clg-favorite-button-scale-hover: scaleX(1.015) scaleY(1.035) perspective(1px);\n  --clg-favorite-button-scale-pressed: scale(0.99);\n  --clg-favorite-button-icon-size: var(--clg-dimension-sem-icon-core-base, 24px);\n  /* Display properties */\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n  /* Box model */\n  min-height: var(--clg-favorite-button-height);\n  min-width: var(--clg-favorite-button-width);\n  /* Appearance */\n  background: none;\n  outline: none;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  background-color: var(--clg-favorite-button-bg-color);\n  border: var(--clg-favorite-button-border-color) solid var(--clg-favorite-button-border-width);\n  /* Interaction */\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n  /* Fixes a visual bug related to iOS button taps */\n  -webkit-appearance: none;\n  /* Remove default gradient on mobile Safari buttons */\n}\n:host(clg-favorite-button:not([disabled])) .clg-favorite-button:hover {\n  box-shadow: var(--clg-effect-sem-shadow-elevation-3, 0px 1px 3px 0px #0000004D, 0px 4px 8px 3px #00000026);\n  transform: var(--clg-favorite-button-scale-hover);\n  transition: transform var(--clg-effect-pal-duration-200, 200ms) cubic-bezier(0.345, 0.115, 0.135, 1.42), opacity var(--clg-effect-pal-duration-200, 200ms) ease-out;\n}\n:host(clg-favorite-button:not([disabled])) .clg-favorite-button:active {\n  transform: var(--clg-favorite-button-scale-pressed);\n}\n\n:host([pseudo-focus]) .clg-favorite-button, .clg-favorite-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-favorite-button, .clg-favorite-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-favorite-button:not(:focus-visible), .clg-favorite-button:focus:not(:focus-visible) {\n  outline: none;\n}\n:host(clg-favorite-button[selected]) .clg-favorite-button__unselected-text {\n  display: none;\n}\n:host(clg-favorite-button:not([selected])) .clg-favorite-button__selected-text {\n  display: none;\n}\n\n:host(clg-favorite-button) {\n  display: inline-block;\n}\n\n:host(clg-favorite-button) .clg-favorite-button {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-background, #FFFFFF);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-border, #0E0E0E2E);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-icon, #222222);\n  --clg-favorite-button-border-width: var(--clg-shape-app-button-secondary-border-width, 1.5px);\n}\n:host(clg-favorite-button) .clg-favorite-button:not(:disabled):active {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-pressed-background, #D3D3D3);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-pressed-border, #949494);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-pressed-icon, #222222);\n}\n\n:host(clg-favorite-button[selected]) .clg-favorite-button {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-selected-background, #FFFFFF);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-selected-border, #0E0E0E2E);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-selected-icon, #B50330);\n}\n:host(clg-favorite-button[selected]) .clg-favorite-button:not(:disabled):active {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-selected-pressed-background, #D3D3D3);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-selected-pressed-border, #949494);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-selected-pressed-icon, #B50330);\n}\n\n:host(clg-favorite-button[background-type=dark]) .clg-favorite-button {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-on-surface-dark-background, #0E0E0E);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-on-surface-dark-border, #FFFFFF3D);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-on-surface-dark-icon, #FFFFFF);\n}\n:host(clg-favorite-button[background-type=dark]) .clg-favorite-button:not(:disabled):active {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-on-surface-dark-pressed-background, #595959);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-on-surface-dark-pressed-border, #949494);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-on-surface-dark-pressed-icon, #FFFFFF);\n}\n\n:host(clg-favorite-button[selected][background-type=dark]) .clg-favorite-button {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-background, #0E0E0E);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-border, #FFFFFF3D);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-icon, #FF7B9C);\n}\n:host(clg-favorite-button[selected][background-type=dark]) .clg-favorite-button:not(:disabled):active {\n  --clg-favorite-button-bg-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-pressed-background, #595959);\n  --clg-favorite-button-border-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-pressed-border, #949494);\n  --clg-favorite-button-icon-color: var(--clg-color-app-button-favorite-on-surface-dark-selected-pressed-icon, #FF7B9C);\n}\n\n/*\n* Sizing styles\n*/\n:host(clg-favorite-button[size=small]) .clg-favorite-button {\n  --clg-favorite-button-height: var(--clg-dimension-app-button-icon-small-size, 36px);\n  --clg-favorite-button-width: var(--clg-dimension-app-button-icon-small-size, 36px);\n  --clg-favorite-button-padding-vertical: var(--clg-dimension-app-button-icon-padding-vertical, 4px);\n  --clg-favorite-button-padding-horizontal: var(--clg-dimension-app-button-icon-padding-horizontal, 4px);\n  --clg-dimension-sem-icon-core-base: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-icon-button {\n  --clg-icon-button-bg-color: unset;\n  --clg-icon-button-icon-color: unset;\n  --clg-icon-button-border-color: unset;\n  --clg-icon-button-border-width: unset;\n  --clg-icon-button-font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n  --clg-icon-button-font-line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n  --clg-icon-button-height: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-icon-button-width: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-icon-button-padding-vertical: var(--clg-dimension-app-button-icon-padding-vertical, 4px);\n  --clg-icon-button-padding-horizontal: var(--clg-dimension-app-button-icon-padding-horizontal, 4px);\n  --clg-icon-button-scale: scaleX(1) scaleY(1) perspective(1px);\n  --clg-icon-button-scale-hover: scaleX(1.015) scaleY(1.035) perspective(1px);\n  --clg-icon-button-scale-pressed: scale(0.99);\n  --clg-dimension-sem-icon-core-base: var(--clg-dimension-sem-icon-core-base, 24px);\n  /* Display properties */\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  vertical-align: middle;\n  /* Box model */\n  min-height: var(--clg-icon-button-height);\n  min-width: var(--clg-icon-button-width);\n  padding: var(--clg-icon-button-padding-vertical) var(--clg-icon-button-padding-horizontal);\n  /* Typography */\n  font: inherit;\n  font-size: var(--clg-icon-button-font-size);\n  font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n  line-height: var(--clg-icon-button-font-line-height);\n  text-align: center;\n  text-decoration: none;\n  /* Appearance */\n  background: none;\n  outline: none;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  background-color: var(--clg-icon-button-bg-color);\n  border: var(--clg-icon-button-border-color) solid var(--clg-icon-button-border-width);\n  color: var(--clg-icon-button-icon-color);\n  /* Interaction */\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n  /* Fixes a visual bug related to iOS button taps */\n  -webkit-appearance: none;\n  /* Remove default gradient on mobile Safari buttons */\n}\n:host(clg-icon-button:not([disabled])) .clg-icon-button:hover {\n  box-shadow: var(--clg-effect-sem-shadow-elevation-3, 0px 1px 3px 0px #0000004D, 0px 4px 8px 3px #00000026);\n  transform: var(--clg-icon-button-scale-hover);\n  transition: transform var(--clg-effect-pal-duration-200, 200ms) cubic-bezier(0.345, 0.115, 0.135, 1.42), opacity var(--clg-effect-pal-duration-200, 200ms) ease-out;\n}\n:host(clg-icon-button:not([disabled])) .clg-icon-button:active {\n  transform: var(--clg-icon-button-scale-pressed);\n}\n\n:host([pseudo-focus]) .clg-icon-button, .clg-icon-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-icon-button, .clg-icon-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-icon-button:not(:focus-visible), .clg-icon-button:focus:not(:focus-visible) {\n  outline: none;\n}\n\n:host(clg-icon-button) {\n  display: inline-block;\n}\n\n/*\n* Primary\n*/\n:host(clg-icon-button[variant=primary]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-background, #222222);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-text, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=primary]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=primary]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-hovered-background, #2f2f2f);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-hovered-text, #FFFFFF);\n}\n:host(clg-icon-button[variant=primary]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-pressed-background, #595959);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-pressed-text, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=primary][background-type=light]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-primary-on-surface-light-background, #222222);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-primary-on-surface-light-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-primary-on-surface-light-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=primary][background-type=light]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=primary][background-type=light]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-primary-on-surface-light-hovered-background, #3E3E3E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-primary-on-surface-light-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-primary-on-surface-light-hovered-icon, #FFFFFF);\n}\n:host(clg-icon-button[variant=primary][background-type=light]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-primary-on-surface-light-pressed-background, #595959);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-primary-on-surface-light-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-primary-on-surface-light-pressed-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=primary][background-type=dark]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-primary-on-surface-dark-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-primary-on-surface-dark-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-primary-on-surface-dark-icon, #222222);\n}\n\n:host(clg-icon-button[variant=primary][background-type=dark]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=primary][background-type=dark]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-hovered-background, #EAEAEA);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-on-surface-dark-hovered-text, #222222);\n}\n:host(clg-icon-button[variant=primary][background-type=dark]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-pressed-background, #D3D3D3);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-on-surface-dark-pressed-text, #222222);\n}\n\n/*\n* Secondary-strong variant styles\n*/\n:host(clg-icon-button[variant=secondary-strong]) .clg-icon-button {\n  --clg-icon-button-padding-vertical: calc(var(--clg-dimension-app-button-padding-vertical, 12px) - var(--clg-shape-app-button-secondary-border-width, 1.5px));\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-icon, #222222);\n  --clg-icon-button-border-width: var(--clg-shape-app-button-secondary-border-width, 1.5px);\n}\n\n:host(clg-icon-button[variant=secondary-strong]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-strong]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-hovered-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-hovered-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=secondary-strong]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-pressed-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-strong][background-type=light]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-strong][background-type=light]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-strong][background-type=light]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-hovered-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-hovered-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=secondary-strong][background-type=light]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-pressed-border, #222222);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-light-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-strong][background-type=dark]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-border, #FFFFFF);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=secondary-strong][background-type=dark]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-strong][background-type=dark]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-hovered-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-hovered-border, #FFFFFF);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-hovered-icon, #FFFFFF);\n}\n:host(clg-icon-button[variant=secondary-strong][background-type=dark]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-pressed-background, #FFFFFF3D);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-pressed-border, #FFFFFF);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-pressed-icon, #FFFFFF);\n}\n\n/*\n* Secondary-subtle variant styles\n*/\n:host(clg-icon-button[variant=secondary-subtle]) .clg-icon-button {\n  --clg-icon-button-padding-vertical: calc(var(--clg-dimension-app-button-padding-vertical, 12px) - var(--clg-shape-app-button-secondary-border-width, 1.5px));\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-icon, #222222);\n  --clg-icon-button-border-width: var(--clg-shape-app-button-secondary-border-width, 1.5px);\n}\n\n:host(clg-icon-button[variant=secondary-subtle]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-subtle]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-hovered-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-hovered-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=secondary-subtle]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-pressed-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][background-type=light]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][background-type=light]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-subtle][background-type=light]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-hovered-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-hovered-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=secondary-subtle][background-type=light]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-pressed-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-light-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][background-type=dark]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-background, #0E0E0E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][background-type=dark]:not([disabled])) .clg-icon-button:hover, :host(clg-icon-button[variant=secondary-subtle][background-type=dark]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-hovered-background, #0E0E0E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-hovered-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-hovered-icon, #FFFFFF);\n}\n:host(clg-icon-button[variant=secondary-subtle][background-type=dark]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-pressed-background, #FFFFFF3D);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-pressed-border, #949494);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-pressed-icon, #FFFFFF);\n}\n\n/*\n* Tertiary variant styles\n*/\n:host(clg-icon-button[variant=tertiary]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-background, #0E0E0E17);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-icon, #222222);\n}\n\n:host(clg-icon-button[variant=tertiary]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-hovered-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=tertiary]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-pressed-background, #0E0E0E45);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=tertiary][background-type=light]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-background, #0E0E0E17);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-icon, #222222);\n}\n\n:host(clg-icon-button[variant=tertiary][background-type=light]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-hovered-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=tertiary][background-type=light]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-pressed-background, #0E0E0E45);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-light-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=tertiary][background-type=dark]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-background, #FFFFFF21);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=tertiary][background-type=dark]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-hovered-background, #FFFFFF3D);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-hovered-icon, #FFFFFF);\n}\n:host(clg-icon-button[variant=tertiary][background-type=dark]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-pressed-background, #FFFFFF45);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-pressed-icon, #FFFFFF);\n}\n\n/*\n* Transparent variant styles\n*/\n:host(clg-icon-button[variant=transparent]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-icon, #222222);\n}\n\n:host(clg-icon-button[variant=transparent]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-hovered-background, #0E0E0E08);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=transparent]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=transparent][background-type=light]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-light-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-light-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-light-icon, #222222);\n}\n\n:host(clg-icon-button[variant=transparent][background-type=light]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-light-hovered-background, #0E0E0E17);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-light-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-light-hovered-icon, #222222);\n}\n:host(clg-icon-button[variant=transparent][background-type=light]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-light-pressed-background, #0E0E0E2E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-light-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-light-pressed-icon, #222222);\n}\n\n:host(clg-icon-button[variant=transparent][background-type=dark]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-icon, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=transparent][background-type=dark]:not([disabled])) .clg-icon-button:focus-visible {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-hovered-background, #FFFFFF21);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-hovered-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-hovered-icon, #FFFFFF);\n}\n:host(clg-icon-button[variant=transparent][background-type=dark]:not([disabled])) .clg-icon-button:active {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-pressed-background, #FFFFFF3D);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-pressed-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-pressed-icon, #FFFFFF);\n}\n\n/*\n* Disabled state styles\n*/\n:host(clg-icon-button[variant=primary][disabled]) .clg-icon-button,\n:host(clg-icon-button[variant=secondary-strong][disabled]) .clg-icon-button,\n:host(clg-icon-button[variant=secondary-subtle][disabled]) .clg-icon-button,\n:host(clg-icon-button[variant=tertiary][disabled]) .clg-icon-button,\n:host(clg-icon-button[variant=transparent][disabled]) .clg-icon-button {\n  cursor: not-allowed;\n}\n\n:host(clg-icon-button[variant=primary][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-primary-disabled-background, #757575);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-primary-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-disabled-text, #FFFFFF);\n}\n\n:host(clg-icon-button[variant=primary][background-type=dark][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-background, #757575);\n  --clg-icon-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-text, #222222);\n}\n\n:host(clg-icon-button[variant=secondary-strong][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-disabled-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-disabled-border, #757575);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-disabled-icon, #757575);\n}\n\n:host(clg-icon-button[variant=secondary-strong][background-type=dark][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-disabled-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-disabled-border, #757575);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-strong-on-surface-dark-disabled-icon, #757575);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-disabled-background, #FFFFFF);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-disabled-border, #757575);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-disabled-icon, #757575);\n}\n\n:host(clg-icon-button[variant=secondary-subtle][background-type=dark][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-disabled-background, #0E0E0E);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-disabled-border, #757575);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-secondary-subtle-on-surface-dark-disabled-icon, #757575);\n}\n\n:host(clg-icon-button[variant=tertiary][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-disabled-background, #0E0E0E17);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-disabled-icon, #9E9E9E);\n}\n\n:host(clg-icon-button[variant=tertiary][background-type=dark][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-disabled-background, #FFFFFF21);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-tertiary-on-surface-dark-disabled-icon, #9E9E9E);\n}\n\n:host(clg-icon-button[variant=transparent][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-disabled-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-disabled-icon, #757575);\n}\n\n:host(clg-icon-button[variant=transparent][background-type=dark][disabled]) .clg-icon-button {\n  --clg-icon-button-bg-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-disabled-background, #00000000);\n  --clg-icon-button-border-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-disabled-border, #00000000);\n  --clg-icon-button-icon-color: var(--clg-color-app-button-icon-transparent-on-surface-dark-disabled-icon, #757575);\n}\n\n/*\n* Sizing styles\n*/\n:host(clg-icon-button[size=small]) .clg-icon-button {\n  --clg-icon-button-font-line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n  --clg-icon-button-font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n  --clg-icon-button-height: var(--clg-dimension-app-button-icon-small-size, 36px);\n  --clg-icon-button-width: var(--clg-dimension-app-button-icon-small-size, 36px);\n  --clg-icon-button-padding-vertical: var(--clg-dimension-app-button-icon-padding-vertical, 4px);\n  --clg-icon-button-padding-horizontal: var(--clg-dimension-app-button-icon-padding-horizontal, 4px);\n  --clg-dimension-sem-icon-core-base: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n\n:host(clg-icon-button[size=smallest]) .clg-icon-button {\n  --clg-icon-button-font-line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n  --clg-icon-button-font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n  --clg-icon-button-height: var(--clg-dimension-app-button-icon-smallest-size, 24px);\n  --clg-icon-button-width: var(--clg-dimension-app-button-icon-smallest-size, 24px);\n  --clg-icon-button-padding-vertical: var(--clg-dimension-app-button-icon-smallest-vertical, 2px);\n  --clg-icon-button-padding-horizontal: var(--clg-dimension-app-button-icon-smallest-horizontal, 2px);\n  --clg-dimension-sem-icon-core-base: var(--clg-dimension-sem-icon-core-smallest, 12px);\n}\n\n:host(clg-icon-button[variant=transparent]:not([disabled])) .clg-icon-button:hover,\n:host(clg-icon-button[variant=tertiary]:not([disabled])) .clg-icon-button:hover {\n  box-shadow: none;\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-logo-button {\n  --clg-logo-button-bg-color: unset;\n  --clg-logo-button-text-color: unset;\n  --clg-logo-button-border-color: unset;\n  --clg-logo-button-border-width: unset;\n  --clg-logo-button-font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n  --clg-logo-button-font-line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n  --clg-logo-button-height: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  --clg-logo-button-width: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-logo-button-padding-vertical: var(--clg-dimension-app-button-padding-vertical, 12px);\n  --clg-logo-button-padding-horizontal: var(--clg-dimension-app-button-padding-horizontal, 18px);\n  --clg-logo-button-scale: scaleX(1) scaleY(1) perspective(1px);\n  --clg-logo-button-scale-hover: scaleX(1.015) scaleY(1.035) perspective(1px);\n  --clg-logo-button-scale-pressed: scale(0.99);\n  /* Display properties */\n  display: inline-block;\n  position: relative;\n  vertical-align: middle;\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n  /* Box model */\n  min-height: var(--clg-logo-button-height);\n  min-width: var(--clg-logo-button-width);\n  padding: var(--clg-logo-button-padding-vertical) var(--clg-logo-button-padding-horizontal);\n  /* Typography */\n  font: inherit;\n  font-size: var(--clg-logo-button-font-size);\n  font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n  line-height: var(--clg-logo-button-font-line-height);\n  text-align: center;\n  text-decoration: none;\n  /* Appearance */\n  background: none;\n  outline: none;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  background-color: var(--clg-logo-button-bg-color);\n  border: var(--clg-logo-button-border-color) solid var(--clg-logo-button-border-width);\n  color: var(--clg-logo-button-text-color);\n  /* Interaction */\n  cursor: pointer;\n  appearance: none;\n  -webkit-tap-highlight-color: transparent;\n  /* Fixes a visual bug related to iOS button taps */\n  -webkit-appearance: none;\n  /* Remove default gradient on mobile Safari buttons */\n}\n.clg-logo-button__content {\n  display: flex;\n  gap: var(--clg-dimension-pal-grid-050, 4px);\n  justify-content: center;\n  align-items: center;\n}\n:host(clg-logo-button:not([disabled])) .clg-logo-button:hover {\n  box-shadow: var(--clg-effect-sem-shadow-elevation-3, 0px 1px 3px 0px #0000004D, 0px 4px 8px 3px #00000026);\n  transform: var(--clg-logo-button-scale-hover);\n  transition: transform var(--clg-effect-pal-duration-200, 200ms) cubic-bezier(0.345, 0.115, 0.135, 1.42), opacity var(--clg-effect-pal-duration-200, 200ms) ease-out;\n}\n:host(clg-logo-button:not([disabled])) .clg-logo-button:active {\n  transform: var(--clg-logo-button-scale-pressed);\n}\n\n:host([pseudo-focus]) .clg-logo-button, .clg-logo-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-logo-button, .clg-logo-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-logo-button:not(:focus-visible), .clg-logo-button:focus:not(:focus-visible) {\n  outline: none;\n}\n.clg-logo-button__spinner-frame {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n.clg-logo-button__spinner-frame .clg-logo-button__spinner--default,\n.clg-logo-button__spinner-frame .clg-logo-button__spinner--light {\n  display: none;\n}\n\n:host(clg-logo-button) {\n  display: inline-block;\n}\n\n:host(clg-logo-button) .clg-logo-button {\n  --clg-logo-button-padding-vertical: calc(\n      var(--clg-dimension-pal-grid-100, 8px) - var(--clg-shape-app-button-secondary-border-width, 1.5px)\n  );\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-border, #222222);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-text, #222222);\n  --clg-logo-button-border-width: var(--clg-shape-app-button-secondary-border-width, 1.5px);\n}\n\n:host(clg-logo-button[loading]) .clg-logo-button {\n  cursor: progress;\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-disabled-border, #757575);\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-disabled-background, #00000000);\n}\n:host(clg-logo-button[loading]) .clg-logo-button__content {\n  visibility: hidden;\n}\n\n:host(clg-logo-button:not([disabled])) .clg-logo-button:hover, :host(clg-logo-button:not([disabled])) .clg-logo-button:focus-within, :host(clg-logo-button:not([disabled])) .clg-logo-button:focus-visible {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-hovered-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-hovered-border, #222222);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-hovered-text, #222222);\n}\n:host(clg-logo-button:not([disabled])) .clg-logo-button:active {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-pressed-background, #0E0E0E2E);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-pressed-border, #222222);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-pressed-text, #222222);\n}\n\n:host(clg-logo-button[background-type=dark]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-on-surface-dark-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-on-surface-dark-border, #FFFFFF);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-on-surface-dark-text, #FFFFFF);\n}\n\n/* Spinner visibility by variant */\n:host(clg-logo-button[variant=apple-pay]) .clg-logo-button__spinner--light,\n:host(clg-logo-button[variant=google-pay]) .clg-logo-button__spinner--light {\n  display: inline-flex;\n}\n\n:host(clg-logo-button:not([variant])) .clg-logo-button__spinner--default,\n:host(clg-logo-button[variant=payment]) .clg-logo-button__spinner--default,\n:host(clg-logo-button[variant=signin]) .clg-logo-button__spinner--default {\n  display: inline-flex;\n}\n\n:host(clg-logo-button[background-type=dark]:not([disabled])) .clg-logo-button:hover, :host(clg-logo-button[background-type=dark]:not([disabled])) .clg-logo-button:focus-within, :host(clg-logo-button[background-type=dark]:not([disabled])) .clg-logo-button:focus-visible {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-on-surface-dark-hovered-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-on-surface-dark-hovered-border, #FFFFFF);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-on-surface-dark-hovered-text, #FFFFFF);\n}\n:host(clg-logo-button[background-type=dark]:not([disabled])) .clg-logo-button:active {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-on-surface-dark-pressed-background, #FFFFFF3D);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-on-surface-dark-pressed-border, #FFFFFF);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-on-surface-dark-pressed-text, #FFFFFF);\n}\n\n:host(clg-logo-button[disabled]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-disabled-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-disabled-border, #757575);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-disabled-text, #757575);\n}\n\n:host(clg-logo-button[background-type=dark][disabled]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-secondary-on-surface-dark-disabled-background, #00000000);\n  --clg-logo-button-border-color: var(--clg-color-app-button-secondary-on-surface-dark-disabled-border, #757575);\n  --clg-logo-button-text-color: var(--clg-color-app-button-secondary-on-surface-dark-disabled-text, #757575);\n}\n\n/** Hide variant icons by default, show one based on the variant attribute */\n:host(clg-logo-button) .clg-logo-button__apple-pay, :host(clg-logo-button) .clg-logo-button__google-pay {\n  display: none;\n}\n\n:host(clg-logo-button[variant=apple-pay]) .clg-logo-button {\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-text, #FFFFFF);\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-background, #222222);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-border, #00000000);\n}\n:host(clg-logo-button[variant=apple-pay]) .clg-logo-button__apple-pay {\n  display: inline-flex;\n  /** Apple Pay icon is not a square and is sized basically with magic numbers */\n  --clg-logo-svg-width: auto;\n  --clg-logo-svg-height: auto;\n  width: 48px;\n}\n\n:host(clg-logo-button[variant=google-pay]) .clg-logo-button {\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-text, #FFFFFF);\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-background, #222222);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-border, #00000000);\n}\n:host(clg-logo-button[variant=google-pay]) .clg-logo-button__google-pay {\n  display: inline-flex;\n  /** Google Pay icon is not a square and is sized basically with magic numbers */\n  --clg-logo-svg-width: auto;\n  --clg-logo-svg-height: auto;\n  width: 58px;\n}\n\n:host(clg-logo-button[variant=apple-pay][background-type=dark]) .clg-logo-button,\n:host(clg-logo-button[variant=google-pay][background-type=dark]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-background, #FFFFFF);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-border, #00000000);\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-on-surface-dark-text, #222222);\n}\n\n/** Disabled state for logo buttons for Apple Pay and Google Pay */\n:host(clg-logo-button[variant=apple-pay][disabled]) .clg-logo-button,\n:host(clg-logo-button[variant=google-pay][disabled]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-disabled-background, #757575);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-disabled-border, #00000000);\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-disabled-text, #FFFFFF);\n}\n\n/** Disabled state for Dark background for logo buttons for Apple Pay and Google Pay */\n:host(clg-logo-button[variant=apple-pay][background-type=dark][disabled]) .clg-logo-button,\n:host(clg-logo-button[variant=google-pay][background-type=dark][disabled]) .clg-logo-button {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-background, #757575);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-border, #00000000);\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-on-surface-dark-disabled-text, #222222);\n}\n\n/** Hover and Active states for logo buttons for Apple Pay and Google Pay */\n:host(clg-logo-button[variant=apple-pay]:not([disabled])) .clg-logo-button:hover, :host(clg-logo-button[variant=apple-pay]:not([disabled])) .clg-logo-button:focus-within, :host(clg-logo-button[variant=apple-pay]:not([disabled])) .clg-logo-button:focus-visible,\n:host(clg-logo-button[variant=google-pay]:not([disabled])) .clg-logo-button:hover,\n:host(clg-logo-button[variant=google-pay]:not([disabled])) .clg-logo-button:focus-within,\n:host(clg-logo-button[variant=google-pay]:not([disabled])) .clg-logo-button:focus-visible {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-hovered-background, #2f2f2f);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-hovered-border, #00000000);\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-hovered-text, #FFFFFF);\n}\n:host(clg-logo-button[variant=apple-pay]:not([disabled])) .clg-logo-button:active,\n:host(clg-logo-button[variant=google-pay]:not([disabled])) .clg-logo-button:active {\n  --clg-logo-button-bg-color: var(--clg-color-app-button-primary-pressed-background, #595959);\n  --clg-logo-button-border-color: var(--clg-color-app-button-primary-pressed-border, #00000000);\n  --clg-logo-button-text-color: var(--clg-color-app-button-primary-pressed-text, #FFFFFF);\n}\n\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-text-button) {\n  display: inline-block;\n  --clg-text-button-height: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-text-button-width: var(--clg-dimension-sem-interaction-base, 48px);\n  --clg-text-button-padding-horizontal: 0px;\n}\n\n.clg-text-button {\n  --clg-text-button-bg-color: unset;\n  --clg-text-button-text-color: unset;\n  --clg-text-button-border-color: var(--clg-color-app-button-transparent-on-surface-light-border, #00000000);\n  --clg-text-button-border-width: var(--clg-shape-app-button-transparent-border-width, 0px);\n  --clg-text-button-font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n  --clg-text-button-font-line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n  --clg-text-button-scale: scaleX(0.7) scaleY(0.7) perspective(1px)\n      rotate(0.0001deg);\n  --clg-text-button-scale-hover: scaleX(1.015) scaleY(1.035) perspective(1px)\n      rotate(0.0001deg);\n  --clg-text-button-scale-pressed: scale(0.99);\n  /* Display properties */\n  display: inline-flex;\n  align-items: center;\n  position: relative;\n  vertical-align: middle;\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n  /* Box model */\n  width: 100%;\n  min-height: var(--clg-text-button-height);\n  min-width: var(--clg-text-button-width);\n  padding-left: var(--clg-text-button-padding-horizontal);\n  padding-right: var(--clg-text-button-padding-horizontal);\n  /* Typography */\n  font: inherit;\n  font-size: var(--clg-text-button-font-size);\n  font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n  line-height: var(--clg-text-button-font-line-height);\n  text-align: center;\n  text-decoration: none;\n  /* Appearance */\n  background: none;\n  outline: none;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  border: 0;\n  background-color: transparent;\n  color: var(--clg-text-button-text-color);\n  /* Interaction */\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n  -webkit-appearance: none;\n  appearance: none;\n}\n.clg-text-button:after {\n  content: \"\";\n  border-radius: inherit;\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  z-index: -1;\n  transform: var(--clg-text-button-scale);\n  -webkit-backface-visibility: hidden;\n  backface-visibility: hidden;\n  background-color: var(--clg-text-button-bg-color);\n  transition: transform var(--clg-effect-pal-duration-200, 200ms) cubic-bezier(0.345, 0.115, 0.135, 1.42), background 150ms ease-out, box-shadow var(--clg-effect-pal-duration-200, 200ms) ease-out;\n}\n.clg-text-button:not(:disabled):hover:after, .clg-text-button:not(:disabled):focus-visible:after {\n  transform: var(--clg-text-button-scale-hover);\n  text-decoration: none;\n  opacity: 1;\n}\n:host([pseudo-focus]) .clg-text-button, .clg-text-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-text-button, .clg-text-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-text-button:not(:focus-visible), .clg-text-button:focus:not(:focus-visible) {\n  outline: none;\n}\n.clg-text-button__content {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: var(--clg-dimension-app-button-gap, 6px);\n  width: 100%;\n}\n.clg-text-button__spinner-frame {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n:host(clg-text-button[loading]) .clg-text-button {\n  cursor: progress;\n}\n:host(clg-text-button[loading]) .clg-text-button__content {\n  visibility: hidden;\n}\n\n/**\n * Spinner type visibility by button variant\n */\n:host(clg-text-button) .clg-text-button__spinner-frame__light-spinner,\n:host(clg-text-button) .clg-text-button__spinner-frame__dark-spinner {\n  display: none;\n}\n\n:host(clg-text-button:not([background-type=dark])[loading]) .clg-text-button__spinner-frame__dark-spinner {\n  display: block;\n}\n\n:host(clg-text-button[background-type=dark][loading]) .clg-text-button__spinner-frame__light-spinner {\n  display: block;\n}\n\n/***\n * Primary text button styles\n */\n:host(clg-text-button[variant=primary]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-text, #3B67D9);\n  --clg-text-button-bg-color: var(--clg-color-app-button-transparent-on-surface-light-background, #00000000);\n  --clg-text-button-border-color: var(--clg-color-app-button-transparent-on-surface-light-border, #00000000);\n}\n:host(clg-text-button[variant=primary]) .clg-text-button:focus-visible {\n  box-shadow: none;\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-hovered-text, #3B67D9);\n  --clg-text-button-border-color: var(--clg-color-app-button-focused-border, #3B67D9);\n}\n:host(clg-text-button[variant=primary]) .clg-text-button:active {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-pressed-text, #3B67D9);\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=primary]) .clg-text-button, :host(clg-text-button[variant=primary]) .clg-text-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) :host(clg-text-button[variant=primary]) .clg-text-button, :host(clg-text-button[variant=primary]) .clg-text-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=primary]) .clg-text-button:not(:focus-visible), :host(clg-text-button[variant=primary]) .clg-text-button:focus:not(:focus-visible) {\n  outline: none;\n}\n\n:host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-on-surface-dark-text, #A2C5F4);\n  --clg-text-button-bg-color: var(--clg-color-app-button-transparent-on-surface-dark-background, #00000000);\n  --clg-text-button-border-color: var(--clg-color-app-button-transparent-on-surface-dark-border, #00000000);\n}\n:host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:focus-visible {\n  box-shadow: none;\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-on-surface-dark-hovered-text, #A2C5F4);\n  --clg-text-button-border-color: var(--clg-color-app-button-focused-border, #3B67D9);\n}\n:host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:active {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-on-surface-dark-pressed-text, #A2C5F4);\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button, :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button, :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:not(:focus-visible), :host(clg-text-button[variant=primary][background-type=dark]) .clg-text-button:focus:not(:focus-visible) {\n  outline: none;\n}\n\n/***\n * Secondary button styles\n */\n:host(clg-text-button[variant=secondary]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-text, #222222);\n  --clg-text-button-bg-color: var(--clg-color-app-button-transparent-on-surface-light-background, #00000000);\n  --clg-text-button-border-color: var(--clg-color-app-button-transparent-on-surface-light-border, #00000000);\n}\n:host(clg-text-button[variant=secondary]) .clg-text-button:focus-visible {\n  box-shadow: none;\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-hovered-text, #222222);\n  --clg-text-button-border-color: var(--clg-color-app-button-focused-border, #3B67D9);\n}\n:host(clg-text-button[variant=secondary]) .clg-text-button:active {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-pressed-text, #222222);\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=secondary]) .clg-text-button, :host(clg-text-button[variant=secondary]) .clg-text-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) :host(clg-text-button[variant=secondary]) .clg-text-button, :host(clg-text-button[variant=secondary]) .clg-text-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=secondary]) .clg-text-button:not(:focus-visible), :host(clg-text-button[variant=secondary]) .clg-text-button:focus:not(:focus-visible) {\n  outline: none;\n}\n\n:host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-on-surface-dark-text, #FFFFFF);\n  --clg-text-button-bg-color: var(--clg-color-app-button-transparent-on-surface-dark-background, #00000000);\n  --clg-text-button-border-color: var(--clg-color-app-button-transparent-on-surface-dark-border, #00000000);\n}\n:host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:focus-visible {\n  box-shadow: none;\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-on-surface-dark-hovered-text, #FFFFFF);\n  --clg-text-button-border-color: var(--clg-color-app-button-focused-border, #3B67D9);\n}\n:host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:active {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-on-surface-dark-pressed-text, #FFFFFF);\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button, :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button, :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:not(:focus-visible), :host(clg-text-button[variant=secondary][background-type=dark]) .clg-text-button:focus:not(:focus-visible) {\n  outline: none;\n}\n\n:host(clg-text-button[variant=primary][disabled]) .clg-text-button,\n:host(clg-text-button[variant=secondary][disabled]) .clg-text-button {\n  cursor: not-allowed;\n}\n:host(clg-text-button[variant=primary][disabled]) .clg-text-button ::slotted(.wt-icon),\n:host(clg-text-button[variant=secondary][disabled]) .clg-text-button ::slotted(.wt-icon) {\n  opacity: 0.5;\n}\n\n:host(clg-text-button[variant=primary][disabled]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-primary-disabled-text, #757575);\n}\n\n:host(clg-text-button[variant=secondary][disabled]) .clg-text-button {\n  --clg-text-button-text-color: var(--clg-color-app-button-text-secondary-disabled-text, #757575);\n}\n\n:host(clg-text-button[fillwidth]),\n:host(clg-text-button[fillwidth]) .clg-text-button {\n  width: 100%;\n}\n\n:host(clg-text-button[size=small]) .clg-text-button {\n  --clg-text-button-font-line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n  --clg-text-button-font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n  --clg-text-button-height: var(--clg-dimension-sem-interaction-small, 36px);\n  --clg-text-button-width: var(--clg-dimension-sem-interaction-small, 36px);\n}\n\n:host(clg-text-button[underline]) .clg-text-button {\n  text-decoration: underline;\n}\n\n:host(clg-text-button[flush~=top]) .clg-text-button {\n  align-items: flex-start;\n}\n\n:host(clg-text-button[flush~=bottom]) .clg-text-button {\n  align-items: flex-end;\n}\n\n:host(clg-text-button[flush~=left]) .clg-text-button__content {\n  justify-content: flex-start;\n}\n\n:host(clg-text-button[flush~=right]) .clg-text-button__content {\n  justify-content: flex-end;\n}\n\n:host(clg-text-button[padding][flush~=left]) .clg-text-button {\n  padding-left: 0;\n}\n\n:host(clg-text-button[padding][flush~=right]) .clg-text-button {\n  padding-right: 0;\n}\n\n:host(clg-text-button:not([underline]):not([disabled])) .clg-text-button:hover, :host(clg-text-button:not([underline]):not([disabled])) .clg-text-button:focus-visible {\n  text-decoration: underline;\n}\n\n:host(clg-text-button[padding]) {\n  --clg-text-button-padding-horizontal: var(--clg-dimension-pal-grid-100, 8px);\n}\n\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-card) {\n  display: block;\n  --clg-card-background-color: transparent;\n  --clg-card-orientation: unset;\n  --clg-card-gap: unset;\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: 0;\n}\n\n.clg-card {\n  position: relative;\n  display: flex;\n  flex-direction: var(--clg-card-orientation);\n  gap: var(--clg-card-gap);\n  background-color: var(--clg-card-background-color);\n  border: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-card-border-color);\n  border-radius: var(--clg-shape-sem-border-radius-card, 12px);\n  background-clip: padding-box;\n  overflow: hidden;\n}\n.clg-card:has(.clg-card__link[href]):hover {\n  cursor: pointer;\n}\n.clg-card:has(.clg-card__link:focus-visible) {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n.clg-card__image {\n  padding: var(--clg-card-image-padding);\n}\n.clg-card__image ::slotted(*) {\n  display: block;\n}\n.clg-card__content {\n  padding: var(--clg-card-content-padding);\n}\n\n.clg-card__link {\n  text-decoration: none;\n  color: inherit;\n  outline: none;\n}\n.clg-card__link::after {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  z-index: 0;\n}\n\n.clg-card ::slotted(*) {\n  position: relative;\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n}\n\n:host(clg-card[image-layout=top]) .clg-card {\n  --clg-card-orientation: column;\n  --clg-card-gap: var(--clg-dimension-app-card-vertical-gap, 4px);\n  align-items: center;\n}\n\n:host(clg-card[image-layout=start]) .clg-card,\n:host(clg-card[image-layout=end]) .clg-card {\n  --clg-card-orientation: row;\n  --clg-card-gap: var(--clg-dimension-app-card-horizontal-gap, 12px);\n  align-items: flex-start;\n}\n\n:host(clg-card[image-layout=end]) .clg-card {\n  --clg-card-orientation: row-reverse;\n  justify-content: space-between;\n}\n\n:host(clg-card[container=elevated][image-layout=start]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n}\n\n:host(clg-card[container=elevated][image-layout=end]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated][image-layout=top]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-padded][image-layout=start]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n}\n\n:host(clg-card[container=elevated-padded][image-layout=end]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-padded][image-layout=top]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px);\n  --clg-card-content-padding: 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-no-border][image-layout=start]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n}\n\n:host(clg-card[container=elevated-no-border][image-layout=end]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-no-border][image-layout=top]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: 0;\n  --clg-card-content-padding: 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-padded-no-border][image-layout=start]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n}\n\n:host(clg-card[container=elevated-padded-no-border][image-layout=end]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0;\n  --clg-card-content-padding: var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n:host(clg-card[container=elevated-padded-no-border][image-layout=top]) {\n  --clg-card-background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  --clg-card-border-color: transparent;\n  --clg-card-image-padding: var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) 0 var(--clg-dimension-app-card-padding, 12px);\n  --clg-card-content-padding: 0 var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px) var(--clg-dimension-app-card-padding, 12px);\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-slot-card) {\n  display: block;\n}\n\n.clg-slot-card {\n  position: relative;\n  display: block;\n  padding: var(--clg-dimension-app-card-padding, 12px);\n  min-height: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  min-width: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  background-color: var(--clg-color-sem-background-elevation-1, #FFFFFF);\n  border-radius: var(--clg-shape-sem-border-radius-card, 12px);\n  border: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-color-sem-background-elevation-1, #FFFFFF);\n}\n.clg-slot-card:has(.clg-slot-card__link[href]):hover {\n  cursor: pointer;\n}\n.clg-slot-card:has(.clg-slot-card__link:focus-visible) {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host(clg-slot-card[border]) .clg-slot-card {\n  border-color: var(--clg-color-sem-border-divider, #0E0E0E2E);\n}\n.clg-slot-card[aria-disabled] {\n  color: var(--clg-color-sem-text-disabled, #757575);\n  cursor: not-allowed;\n}\n\n.clg-slot-card__link {\n  text-decoration: none;\n  color: inherit;\n  outline: none;\n}\n.clg-slot-card__link::after {\n  content: \"\";\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  z-index: 0;\n}\n\n.clg-slot-card ::slotted(*) {\n  position: relative;\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n}\n\n:host(clg-checkbox) {\n  --clg-checkbox-height: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  display: flex;\n  align-items: center;\n  min-height: var(--clg-checkbox-height);\n}\n\n:host(clg-checkbox[size=small]) {\n  --clg-checkbox-height: calc(var(--clg-dimension-sem-minimum-tap-target, 48px) * 0.5);\n}\n\n.clg-checkbox {\n  /* Disabled state */\n}\n.clg-checkbox__with-label {\n  display: flex;\n  align-items: center;\n  gap: var(--clg-dimension-pal-grid-100, 8px);\n  cursor: pointer;\n}\n:host(clg-checkbox[with-helper-text]:not([hide-helper-text])) .clg-checkbox__with-label {\n  align-items: flex-start;\n}\n\n.clg-checkbox__label {\n  color: var(--clg-color-sem-text-primary, #222222);\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-line-height, 1.7);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-checkbox__label {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-line-height, 1.7);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n:host(clg-checkbox[size=small]) .clg-checkbox__label {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-checkbox[size=small]) .clg-checkbox__label {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-checkbox[with-helper-text]:not([hide-helper-text])) .clg-checkbox__label {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-checkbox[with-helper-text]:not([hide-helper-text])) .clg-checkbox__label {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n\n:host(clg-checkbox[size=small][with-helper-text]:not([hide-helper-text])) .clg-checkbox__label {\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-checkbox[size=small][with-helper-text]:not([hide-helper-text])) .clg-checkbox__label {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host([hide-label]) .clg-checkbox__label-text {\n  border: 0 !important;\n  clip: rect(0 0 0 0) !important;\n  height: 1px !important;\n  margin: -1px !important;\n  overflow: hidden !important;\n  padding: 0 !important;\n  position: absolute !important;\n  width: 1px !important;\n}\n.clg-checkbox__input {\n  position: absolute;\n  opacity: 0;\n  pointer-events: none;\n}\n.clg-checkbox__input:focus, .clg-checkbox__input:focus-visible {\n  outline: 0;\n}\n:host(clg-checkbox[disabled]) .clg-checkbox__with-label {\n  cursor: not-allowed;\n}\n:host(clg-checkbox[disabled]) .clg-checkbox__label {\n  color: var(--clg-color-app-input-disabled-text, #595959);\n}\n:host(clg-checkbox[with-caption]) .clg-checkbox__after, :host(clg-checkbox[caption]) .clg-checkbox__after, :host(clg-checkbox[invalid]) .clg-checkbox__after {\n  margin-top: var(--clg-dimension-pal-grid-050, 4px);\n}\n\nclg-checkbox-square {\n  width: var(--clg-dimension-app-input-selectable-size, 32px);\n  height: var(--clg-dimension-app-input-selectable-size, 32px);\n}\nclg-checkbox-square[size=small] {\n  width: var(--clg-dimension-app-input-selectable-small-size, 20px);\n  height: var(--clg-dimension-app-input-selectable-small-size, 20px);\n}\n\n:host(clg-checkbox-group) {\n  display: block;\n  --clg-checkbox-group-gap: 0;\n}\n\n.clg-checkbox-group {\n  --clg-checkbox-group-direction: column;\n  margin: 0;\n  padding: 0;\n  border: none;\n}\n:host(clg-checkbox-group:not([hide-label])) .clg-checkbox-group__before {\n  margin-bottom: var(--clg-dimension-pal-grid-100, 8px);\n}\n:host(clg-checkbox-group[with-caption]) .clg-checkbox-group__after, :host(clg-checkbox-group[caption]) .clg-checkbox-group__after, :host(clg-checkbox-group[invalid]) .clg-checkbox-group__after {\n  margin-top: var(--clg-dimension-pal-grid-200, 16px);\n}\n.clg-checkbox-group__content {\n  display: flex;\n  flex-direction: var(--clg-checkbox-group-direction);\n  align-items: flex-start;\n  gap: var(--clg-checkbox-group-gap);\n}\n.clg-checkbox-group__legend {\n  display: contents;\n}\n:host(clg-checkbox-group[size=small]) .clg-checkbox-group {\n  --clg-checkbox-group-gap: var(--clg-dimension-pal-grid-100, 8px);\n}\n\n:host(clg-checkbox-group[orientation=horizontal]) .clg-checkbox-group__content {\n  --clg-checkbox-group-direction: row;\n  --clg-checkbox-group-gap: var(--clg-dimension-pal-grid-200, 16px);\n}\n\n/* stylelint-disable indentation */\n.clg-checkbox-square {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  appearance: none;\n  width: var(--clg-dimension-app-input-selectable-size, 32px);\n  height: var(--clg-dimension-app-input-selectable-size, 32px);\n  background: var(--clg-color-app-input-selectable-background, #00000000);\n  border-radius: var(--clg-shape-app-input-checkbox-border-radius, 2px);\n  border: var(--clg-shape-app-input-border-width, 1.5px) solid var(--clg-color-app-input-border, #949494);\n  transition: background var(--clg-effect-app-checkbox-selected-fade-duration, 25ms) var(--clg-effect-app-checkbox-selected-fade-curve, cubic-bezier(0, 0, 1, 1));\n  /* Checked state */\n  /* Disabled state */\n  /* Invalid state */\n  /* Small size */\n}\n.clg-checkbox-square__check {\n  position: absolute;\n  color: var(--clg-color-app-input-selectable-selected-text, #FFFFFF);\n  scale: 0;\n  --clg-icon-size: var(--clg-dimension-app-input-selectable-checkbox-indicator-size, 24px);\n}\n:host(clg-checkbox-square[rendered]) .clg-checkbox-square__check {\n  animation: clg-checkbox-uncheck-scale var(--clg-effect-app-checkbox-unselected-scale-duration, 75ms) var(--clg-effect-app-checkbox-unselected-scale-curve, cubic-bezier(0, 0, 0, 1));\n}\n:host(clg-checkbox-square[rendered][checked]) .clg-checkbox-square__check {\n  animation: clg-checkbox-check-scale-beat1 var(--clg-effect-app-checkbox-selected-scale-1-duration, 150ms) var(--clg-effect-app-checkbox-selected-scale-1-curve, cubic-bezier(0, 0, 0.5, 1)), clg-checkbox-check-scale-beat2 var(--clg-effect-app-checkbox-selected-scale-2-duration, 200ms) var(--clg-effect-app-checkbox-selected-scale-2-curve, cubic-bezier(0.5, 0, 0.5, 1)) var(--clg-effect-app-checkbox-selected-scale-1-duration, 150ms);\n}\n:host(clg-checkbox-square[focused]) .clg-checkbox-square {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, 0);\n  border-color: transparent;\n}\n:host(clg-checkbox-square[checked]) .clg-checkbox-square {\n  background: var(--clg-color-app-input-selectable-selected-background, #222222);\n  border-color: var(--clg-color-app-input-selectable-selected-border, #222222);\n  transition: background var(--clg-effect-app-checkbox-selected-fade-duration, 25ms) var(--clg-effect-app-checkbox-selected-fade-curve, cubic-bezier(0, 0, 1, 1));\n}\n:host(clg-checkbox-square[checked]) .clg-checkbox-square__check {\n  scale: var(--clg-effect-app-checkbox-selected-scale-2-to, 1);\n}\n:host(clg-checkbox-square[checked][focused]) .clg-checkbox-square {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host(clg-checkbox-square[disabled]) .clg-checkbox-square {\n  cursor: not-allowed;\n  background: var(--clg-color-app-input-disabled-background, #EAEAEA);\n  border-color: var(--clg-color-app-input-disabled-border, #949494);\n}\n:host(clg-checkbox-square[invalid]) .clg-checkbox-square {\n  background: var(--clg-color-app-input-error-background, #FFEAF0);\n  border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n}\n:host(clg-checkbox-square[invalid][focused]) .clg-checkbox-square {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-app-input-selectable-error-selected-border, #9A0027));\n  outline-offset: var(--clg-focus-ring-offset, 0);\n  border-color: transparent;\n}\n:host(clg-checkbox-square[invalid][checked]) .clg-checkbox-square {\n  background: var(--clg-color-app-input-selectable-error-selected-background, #9A0027);\n  border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n}\n:host(clg-checkbox-square[invalid][focused][checked]) .clg-checkbox-square {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-app-input-selectable-error-selected-border, #9A0027));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host(clg-checkbox-square[size=small]) .clg-checkbox-square {\n  width: var(--clg-dimension-app-input-selectable-small-size, 20px);\n  height: var(--clg-dimension-app-input-selectable-small-size, 20px);\n}\n:host(clg-checkbox-square[size=small]) .clg-checkbox-square__check {\n  --clg-icon-size: var(--clg-dimension-app-input-selectable-checkbox-small-indicator-size, 12px);\n}\n\n@keyframes clg-checkbox-check-scale-beat1 {\n  from {\n    scale: var(--clg-effect-app-checkbox-selected-scale-1-from, 0.6);\n  }\n  to {\n    scale: var(--clg-effect-app-checkbox-selected-scale-1-to, 1.1);\n  }\n}\n@keyframes clg-checkbox-check-scale-beat2 {\n  from {\n    scale: var(--clg-effect-app-checkbox-selected-scale-2-from, 1.1);\n  }\n  to {\n    scale: var(--clg-effect-app-checkbox-selected-scale-2-to, 1);\n  }\n}\n@keyframes clg-checkbox-uncheck-scale {\n  from {\n    scale: var(--clg-effect-app-checkbox-unselected-scale-from, 1);\n  }\n  to {\n    scale: var(--clg-effect-app-checkbox-unselected-scale-to, 0.7);\n  }\n}\n:host(clg-floating-element) {\n  display: contents;\n}\n\n.clg-floating-element {\n  display: contents;\n}\n\n/* Web Awesome–style popup layer: absolute + top layer when Popover API applies */\n.clg-floating-element__popup {\n  z-index: var(--clg-effect-pal-z-index-100, 10);\n  position: absolute;\n  isolation: isolate;\n  max-width: var(--clg-floating-auto-size-available-width, none);\n  max-height: var(--clg-floating-auto-size-available-height, none);\n  /* Clear UA styles for [popover] (see Web Awesome popup.styles) */\n  /* Fallback when Popover API is unavailable: fixed positioning via Floating UI */\n}\n.clg-floating-element__popup:where([popover]) {\n  inset: unset;\n  padding: unset;\n  margin: unset;\n  width: unset;\n  height: unset;\n  color: unset;\n  background: unset;\n  border: unset;\n  overflow: unset;\n}\n.clg-floating-element__popup--fixed {\n  position: fixed;\n}\n.clg-floating-element__popup:not([hidden]) {\n  display: block;\n}\n.clg-floating-element__popup[hidden] {\n  display: none;\n}\n\n.clg-form-field__label {\n  display: flex;\n  align-items: center;\n  padding: 0;\n}\n:host([background-type=light]) .clg-form-field__label {\n  color: var(--clg-color-sem-text-on-surface-light, #222222);\n}\n:host([background-type=dark]) .clg-form-field__label {\n  color: var(--clg-color-sem-text-on-surface-dark, #FFFFFF);\n}\n.clg-form-field__label__text {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-form-field__label__text {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n:host([variant=subtle]) .clg-form-field__label__text {\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-line-height, 1.7);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  :host([variant=subtle]) .clg-form-field__label__text {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-line-height, 1.7);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n:host([disabled]) .clg-form-field__label__text {\n  color: var(--clg-color-sem-text-disabled, #757575);\n}\n\n:host([size=small]) .clg-form-field__label__text {\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host([size=small]) .clg-form-field__label__text {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n.clg-form-field__label__optional, .clg-form-field__label__required-star {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-form-field__label__optional, .clg-form-field__label__required-star {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n.clg-form-field__label__optional {\n  display: none;\n}\n:host([optional]:not([required])) .clg-form-field__label__optional {\n  display: inline;\n}\n\n.clg-form-field__label__required-star, .clg-form-field__label__required-text {\n  display: none;\n}\n:host([required]) .clg-form-field__label__required-star, :host([required]) .clg-form-field__label__required-text {\n  display: inline;\n}\n\n.clg-form-field__label__required-star {\n  color: var(--clg-color-sem-text-critical, #9A0027);\n  align-self: flex-start;\n}\n:host([hide-label]) .clg-form-field__label {\n  border: 0 !important;\n  clip: rect(0 0 0 0) !important;\n  height: 1px !important;\n  margin: -1px !important;\n  overflow: hidden !important;\n  padding: 0 !important;\n  position: absolute !important;\n  width: 1px !important;\n}\n.clg-form-field__helper-text {\n  margin-top: var(--clg-dimension-pal-grid-025, 2px);\n}\n:host([hide-helper-text]) .clg-form-field__helper-text {\n  border: 0 !important;\n  clip: rect(0 0 0 0) !important;\n  height: 1px !important;\n  margin: -1px !important;\n  overflow: hidden !important;\n  padding: 0 !important;\n  position: absolute !important;\n  width: 1px !important;\n}\n.clg-form-field__error {\n  color: var(--clg-color-app-input-error-text, #9A0027);\n  transition: opacity var(--clg-effect-pal-duration-200, 200ms) ease-in;\n  margin: 0;\n}\n.clg-form-field__error__icon {\n  position: relative;\n  bottom: 2px;\n}\n.clg-form-field__helper-text, .clg-form-field__caption, .clg-form-field__error {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-form-field__helper-text, .clg-form-field__caption, .clg-form-field__error {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n.clg-form-field__helper-text, .clg-form-field__caption {\n  color: var(--clg-color-sem-text-secondary, #595959);\n}\n:host(:not([with-helper-text]):not([helper-text])) .clg-form-field__helper-text, :host(:not([with-caption]):not([caption])) .clg-form-field__caption, :host([invalid]) .clg-form-field__caption {\n  display: none;\n}\n\n.clg-brand-icon {\n  border-radius: var(--clg-shape-sem-border-radius-full, 999999px);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  width: 100%;\n}\n.clg-brand-icon svg {\n  display: block;\n  fill: var(--clg-icon-fill-color, currentColor);\n  height: var(--clg-icon-size, var(--clg-dimension-sem-icon-brand-base, 96px));\n  width: var(--clg-icon-size, var(--clg-dimension-sem-icon-brand-base, 96px));\n  aspect-ratio: 1/1;\n}\n:host(clg-brand-icon[variant=empty]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-empty-background, #00000000);\n  color: var(--clg-color-app-brand-icon-empty-foreground, #222222);\n}\n:host(clg-brand-icon[variant=success01]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-success-01-background, #CCEBFF);\n  color: var(--clg-color-app-brand-icon-success-01-foreground, #222222);\n}\n:host(clg-brand-icon[variant=success02]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-success-02-background, #FFFFFF);\n  color: var(--clg-color-app-brand-icon-success-02-foreground, #222222);\n}\n:host(clg-brand-icon[variant=error01]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-error-01-background, #FDD95C);\n  color: var(--clg-color-app-brand-icon-error-01-foreground, #222222);\n}\n:host(clg-brand-icon[variant=error02]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-error-02-background, #9A0027);\n  color: var(--clg-color-app-brand-icon-error-02-foreground, #FFFFFF);\n}\n:host(clg-brand-icon[variant=marketing01]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-marketing-01-background, #00000000);\n  color: var(--clg-color-app-brand-icon-marketing-01-foreground, #F1641E);\n}\n:host(clg-brand-icon[variant=marketing02]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-marketing-02-background, #F8EBE6);\n  color: var(--clg-color-app-brand-icon-marketing-02-foreground, #F1641E);\n}\n:host(clg-brand-icon[variant=marketing03]) .clg-brand-icon {\n  background-color: var(--clg-color-app-brand-icon-marketing-03-background, #FFFFFF);\n  color: var(--clg-color-app-brand-icon-marketing-03-foreground, #F1641E);\n}\n\n:host(clg-icon) svg {\n  display: block;\n  fill: var(--clg-icon-fill-color, currentColor);\n  height: var(--clg-icon-size, var(--clg-dimension-sem-icon-core-base, 24px));\n  width: var(--clg-icon-size, var(--clg-dimension-sem-icon-core-base, 24px));\n  aspect-ratio: 1/1;\n}\n\n:host(clg-dot-indicator) {\n  display: inline-block;\n}\n\n.clg-dot-indicator {\n  --clg-dot-indicator-background-color: unset;\n  display: inline-block;\n  border-radius: var(--clg-shape-app-button-border-radius, 24px);\n  height: var(--clg-dimension-app-indicator-dot-size, 10px);\n  width: var(--clg-dimension-app-indicator-dot-size, 10px);\n  background-color: var(--clg-dot-indicator-background-color);\n}\n:host(clg-dot-indicator[color=important]) .clg-dot-indicator {\n  --clg-dot-indicator-background-color: var(--clg-color-app-indicator-important-background);\n}\n:host(clg-dot-indicator[color=highlight]) .clg-dot-indicator {\n  --clg-dot-indicator-background-color: var(--clg-color-app-indicator-highlight-background);\n}\n:host(clg-dot-indicator[border]) .clg-dot-indicator {\n  border: var(--clg-shape-app-indicator-border-width, 1px) solid var(--clg-color-app-indicator-border, #FFFFFF);\n}\n\n:host(clg-status-indicator) {\n  display: inline-block;\n}\n\n.clg-status-indicator {\n  --clg-status-indicator-bg-color: unset;\n  --clg-status-indicator-text-color: unset;\n  --clg-status-indicator-min-width: var(--clg-dimension-app-indicator-minimum-width);\n  --clg-status-indicator-padding-vertical: var(--clg-dimension-app-indicator-padding-vertical);\n  --clg-status-indicator-padding-horizontal: var(--clg-dimension-app-indicator-padding-horizontal);\n  display: inline-flex;\n  min-height: var(--clg-dimension-app-indicator-minimum-height, 20px);\n  padding: var(--clg-status-indicator-padding-vertical) var(--clg-status-indicator-padding-horizontal);\n  justify-content: center;\n  align-items: center;\n  gap: var(--clg-dimension-app-indicator-gap, 3px);\n  border-radius: var(--clg-shape-app-indicator-border-radius, 12px);\n  background-color: var(--clg-status-indicator-bg-color);\n  color: var(--clg-status-indicator-text-color);\n  font-family: var(--clg-typography-sem-product-title-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-smallest-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-title-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-status-indicator {\n    font-family: var(--clg-typography-sem-product-title-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-smallest-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-title-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-smallest-letter-spacing, 0px);\n  }\n}\n:host(clg-status-indicator[color=success]) .clg-status-indicator {\n  --clg-status-indicator-bg-color: var(--clg-color-app-indicator-success-background);\n  --clg-status-indicator-text-color: var(--clg-color-app-indicator-success-text);\n}\n:host(clg-status-indicator[color=warning]) .clg-status-indicator {\n  --clg-status-indicator-bg-color: var(--clg-color-app-indicator-warning-background);\n  --clg-status-indicator-text-color: var(--clg-color-app-indicator-warning-text);\n}\n:host(clg-status-indicator[color=critical]) .clg-status-indicator {\n  --clg-status-indicator-bg-color: var(--clg-color-app-indicator-critical-background);\n  --clg-status-indicator-text-color: var(--clg-color-app-indicator-critical-text);\n}\n:host(clg-status-indicator[size=large]) .clg-status-indicator {\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n  --clg-status-indicator-min-width: var(--clg-dimension-app-indicator-large-minimum-width);\n  --clg-status-indicator-padding-vertical: var(--clg-dimension-app-indicator-large-padding-vertical);\n  --clg-status-indicator-padding-horizontal: var(--clg-dimension-app-indicator-large-padding-horizontal);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-status-indicator[size=large]) .clg-status-indicator {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-counter-indicator) {\n  display: inline-block;\n}\n\n.clg-counter-indicator {\n  --clg-counter-indicator-bg-color: var(--clg-color-app-indicator-background, #EAEAEA);\n  --clg-counter-indicator-text-color: var(--clg-color-app-indicator-text, #222222);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: var(--clg-dimension-app-indicator-minimum-height, 20px);\n  min-width: var(--clg-dimension-app-indicator-minimum-width, 20px);\n  padding: var(--clg-dimension-app-indicator-padding-vertical, 3px) var(--clg-dimension-app-indicator-padding-horizontal, 6px);\n  border-radius: var(--clg-shape-app-indicator-border-radius, 12px);\n  background-color: var(--clg-counter-indicator-bg-color);\n  color: var(--clg-counter-indicator-text-color);\n  font-family: var(--clg-typography-sem-product-body-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-smallest-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-body-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-counter-indicator {\n    font-family: var(--clg-typography-sem-product-body-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-smallest-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-body-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-smallest-letter-spacing, 0px);\n  }\n}\n:host(clg-counter-indicator[priority=neutral]) .clg-counter-indicator {\n  --clg-counter-indicator-bg-color: var(--clg-color-app-indicator-background, #EAEAEA);\n  --clg-counter-indicator-text-color: var(--clg-color-app-indicator-text, #222222);\n}\n:host(clg-counter-indicator[priority=highlight]) .clg-counter-indicator {\n  --clg-counter-indicator-bg-color: var(--clg-color-app-indicator-highlight-background, #3B67D9);\n  --clg-counter-indicator-text-color: var(--clg-color-app-indicator-highlight-text, #FFFFFF);\n}\n:host(clg-counter-indicator[priority=important]) .clg-counter-indicator {\n  --clg-counter-indicator-bg-color: var(--clg-color-app-indicator-important-background, #CF4018);\n  --clg-counter-indicator-text-color: var(--clg-color-app-indicator-important-text, #FFFFFF);\n}\n:host(clg-counter-indicator[size=large]) .clg-counter-indicator {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n  min-height: var(--clg-dimension-app-indicator-large-minimum-height, 28px);\n  min-width: var(--clg-dimension-app-indicator-large-minimum-width, 28px);\n  padding: var(--clg-dimension-app-indicator-large-padding-vertical, 4px) var(--clg-dimension-app-indicator-large-padding-horizontal, 8px);\n  border-radius: var(--clg-shape-app-indicator-large-border-radius, 16px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-counter-indicator[size=large]) .clg-counter-indicator {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n:host(clg-counter-indicator[border]) .clg-counter-indicator {\n  border: var(--clg-shape-app-indicator-border-width, 1px) solid var(--clg-color-app-indicator-border, #FFFFFF);\n}\n.clg-counter-indicator__value {\n  display: inline-block;\n}\n\n:host(clg-list) {\n  display: block;\n  --clg-list-gap: calc(var(--clg-dimension-app-list-padding-vertical, 8px) * 2);\n}\n\n.clg-list {\n  --clg-list-direction: column;\n}\n.clg-list__content {\n  display: flex;\n  flex-direction: var(--clg-list-direction);\n  gap: var(--clg-list-gap);\n  padding-bottom: calc(var(--clg-list-gap) / 2);\n}\n.clg-list__label {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-list__label {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n.clg-list__label ::slotted([slot=title]) {\n  font: inherit;\n  margin: 0;\n}\n\n:host(clg-list[size=small]) {\n  --clg-list-gap: calc(var(--clg-dimension-app-list-padding-vertical, 8px) / 2);\n}\n\n:host(clg-list[size=large]) {\n  --clg-list-gap: calc(var(--clg-dimension-app-list-padding-vertical, 8px) * 4);\n}\n\n.clg-list-item {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.clg-list-item::after {\n  content: \"\";\n  position: absolute;\n  bottom: calc(var(--clg-list-gap, 0px) / -2);\n  left: 0;\n  right: 0;\n  border-bottom: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-color-sem-border-divider, #0E0E0E2E);\n}\n\n:host(clg-list-item[no-divider]) .clg-list-item::after {\n  display: none;\n}\n\n:host(clg-logo) svg {\n  display: block;\n  width: var(--clg-logo-svg-width, 100%);\n  height: var(--clg-logo-svg-height, 100%);\n  fill: currentColor;\n}\n\n:host(clg-navigational-list) {\n  display: block;\n}\n\n.clg-navigational-list {\n  width: 100%;\n}\n.clg-navigational-list__label {\n  font-family: var(--clg-typography-sem-product-title-mobile-large-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-large-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-large-font-size, 18px);\n  line-height: var(--clg-typography-sem-product-title-mobile-large-line-height, 1.35);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-large-letter-spacing, 0.09px);\n}\n.clg-navigational-list__label ::slotted([slot=title]) {\n  font: inherit;\n  margin: 0;\n}\n.clg-navigational-list__content {\n  display: flex;\n  flex-direction: column;\n  gap: var(--clg-dimension-app-list-gap, 4px);\n}\n\n:host(clg-navigational-list-item) a {\n  text-decoration: none;\n  color: inherit;\n}\n:host(clg-navigational-list-item) a:hover .clg-navigational-list-item__header__text__title, :host(clg-navigational-list-item) a:focus .clg-navigational-list-item__header__text__title, :host(clg-navigational-list-item) a:active .clg-navigational-list-item__header__text__title {\n  text-decoration: underline;\n}\n\n.clg-navigational-list-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  min-height: var(--clg-dimension-sem-interaction-base, 48px);\n  width: 100%;\n  padding: var(--clg-dimension-app-list-padding-vertical, 8px) var(--clg-dimension-app-list-padding-vertical, 8px);\n  border-bottom: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-color-sem-border-divider, #0E0E0E2E);\n  cursor: pointer;\n}\n.clg-navigational-list-item:active {\n  background-color: var(--clg-color-sem-background-surface-selected-subtle, #0E0E0E0D);\n}\n.clg-navigational-list-item__header {\n  display: flex;\n  gap: var(--clg-dimension-app-list-graphic-margin, 8px);\n}\n.clg-navigational-list-item__header__graphic {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n.clg-navigational-list-item__header__text {\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  align-items: start;\n  gap: var(--clg-dimension-app-list-text-margin, 4px);\n  flex-grow: 1;\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-tight-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-navigational-list-item__header__text {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n.clg-navigational-list-item__content {\n  display: flex;\n  gap: var(--clg-dimension-app-list-graphic-margin, 8px);\n  align-items: center;\n  color: var(--clg-color-sem-text-secondary, #595959);\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n  text-decoration: none;\n}\n@media only screen and (min-width: 640px) {\n  .clg-navigational-list-item__content {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-navigational-list-item[no-divider]) .clg-navigational-list-item {\n  border-bottom: none;\n}\n\n:host(clg-navigational-list-item[variant=subtle]) .clg-navigational-list-item__header__text__title {\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-tight-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-navigational-list-item[variant=subtle]) .clg-navigational-list-item__header__text__title {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n:host(clg-navigational-list-item[variant=subtle]) .clg-navigational-list-item__header__text__subtitle {\n  display: none;\n}\n\n:host(clg-navigational-list-item[variant=strong]) .clg-navigational-list-item__header__text__title {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-navigational-list-item[variant=strong]) .clg-navigational-list-item__header__text__title {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n:host(clg-navigational-list-item[variant=strong]) .clg-navigational-list-item__header__text__subtitle {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-navigational-list-item[variant=strong]) .clg-navigational-list-item__header__text__subtitle {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-radio) {\n  --clg-radio-focus-ring-offset: 0;\n  --clg-radio-height: var(--clg-dimension-sem-minimum-tap-target, 48px);\n  --clg-radio-padding: var(--clg-dimension-pal-grid-100, 8px);\n  display: flex;\n  align-items: center;\n  min-height: var(--clg-radio-height);\n}\n\n.clg-radio {\n  display: block;\n}\n\n:host(clg-radio) .clg-radio {\n  display: flex;\n  flex-direction: column;\n  padding-top: var(--clg-radio-padding);\n  padding-bottom: var(--clg-radio-padding);\n}\n:host(clg-radio) .clg-radio__control {\n  display: inline-flex;\n  flex-direction: row;\n}\n:host(clg-radio) .clg-radio__label {\n  display: flex;\n  flex-direction: row;\n  gap: var(--clg-dimension-pal-grid-100, 8px);\n  align-items: center;\n  color: var(--clg-color-sem-text-primary, #222222);\n  cursor: pointer;\n}\n:host(clg-radio) .clg-radio__label-text {\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-line-height, 1.7);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-radio) .clg-radio__label-text {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-line-height, 1.7);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n\n:host(:focus-visible) {\n  outline: none;\n}\n\n:host(clg-radio[checked]:focus-visible),\n:host(clg-radio[checked][data-storybook-focus-visible]) {\n  --clg-radio-focus-ring-offset: calc(var(--clg-shape-sem-border-width-focused, 2px));\n}\n\n:host(:focus-visible) .clg-radio__label__circle,\n:host(clg-radio[data-storybook-focus-visible]) .clg-radio__label__circle {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-radio-focus-ring-offset));\n  display: inline-flex;\n  border-radius: 50%;\n}\n\n:host(clg-radio[invalid]:focus-visible) .clg-radio__label__circle,\n:host(clg-radio[invalid][data-storybook-focus-visible]) .clg-radio__label__circle {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-critical, #9A0027));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-radio-focus-ring-offset));\n}\n\n:host(clg-radio[background-type=light]) .clg-radio__label {\n  color: var(--clg-color-sem-text-on-surface-light, #222222);\n}\n\n:host(clg-radio[background-type=dark]) .clg-radio__label {\n  color: var(--clg-color-sem-text-on-surface-dark, #FFFFFF);\n}\n\n:host(clg-radio[disabled]) .clg-radio__label {\n  color: var(--clg-color-sem-text-disabled, #757575);\n  cursor: not-allowed;\n}\n\n:host(clg-radio[size=small]) {\n  --clg-radio-height: calc(var(--clg-dimension-sem-minimum-tap-target, 48px) * 0.5);\n  --clg-radio-padding: calc(\n      var(--clg-dimension-pal-grid-050, 4px) + var(--clg-dimension-pal-grid-025, 2px)\n  );\n}\n:host(clg-radio[size=small]) .clg-radio__label-text {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-radio[size=small]) .clg-radio__label-text {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n.clg-radio-circle {\n  position: relative;\n}\n\n:host(clg-radio-circle) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-background, #00000000);\n  --clg-radio-circle-dot-color: var(--clg-color-app-input-selectable-selected-text, #FFFFFF);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-selectable-border, #949494);\n  width: var(--clg-radio-circle-size, var(--clg-dimension-app-input-selectable-size, 32px));\n  height: var(--clg-radio-circle-size, var(--clg-dimension-app-input-selectable-size, 32px));\n  background-color: var(--clg-radio-circle-background-color);\n  border-radius: 50%;\n  border: var(--clg-shape-pal-border-width-150, 1.5px) solid var(--clg-radio-circle-border-color);\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n}\n:host(clg-radio-circle) .clg-radio-circle__dot {\n  width: var(--clg-radio-circle-dot-size, var(--clg-dimension-app-input-selectable-radio-indicator-size, 16px));\n  height: var(--clg-radio-circle-dot-size, var(--clg-dimension-app-input-selectable-radio-indicator-size, 16px));\n  border-radius: 16px;\n  background-color: var(--clg-radio-circle-dot-color);\n  display: none;\n}\n\n:host(clg-radio-circle[checked]) .clg-radio-circle__dot {\n  display: inline-block;\n}\n\n:host(clg-radio-circle[checked]) .clg-radio-circle,\n:host(clg-radio-circle[checked]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-selected-background, #222222);\n  --clg-radio-circle-dot-color: var(--clg-color-app-input-selectable-selected-text, #FFFFFF);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-selectable-selected-border, #222222);\n}\n\n:host(clg-radio-circle[background-type=dark]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-selected-background, #222222);\n  --clg-radio-circle-dot-color: var(--clg-color-app-input-selectable-selected-background, #222222);\n}\n\n:host(clg-radio-circle[checked][background-type=dark]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-selected-text, #FFFFFF);\n  --clg-radio-circle-dot-color: var(--clg-color-app-input-selectable-selected-background, #222222);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-selectable-selected-border, #222222);\n}\n\n/* Small size */\n:host(clg-radio-circle[size=small]) {\n  --clg-radio-circle-size: var(--clg-dimension-app-input-selectable-small-size, 20px);\n  --clg-radio-circle-dot-size: var(--clg-dimension-app-input-selectable-radio-small-indicator-size, 8px);\n}\n\n/* Invalid state */\n:host(clg-radio-circle[invalid]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-error-background, #FFEAF0);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n}\n\n:host(clg-radio-circle[invalid][background-type=dark]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-error-background, #FFEAF0);\n}\n\n:host(clg-radio-circle[invalid][checked]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-selectable-error-selected-background, #9A0027);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n}\n\n:host(clg-radio-circle[disabled]) .clg-radio-circle {\n  --clg-radio-circle-background-color: var(--clg-color-app-input-disabled-background, #EAEAEA);\n  --clg-radio-circle-border-color: var(--clg-color-app-input-disabled-border, #949494);\n  --clg-radio-circle-dot-color: var(--clg-color-app-input-disabled-text, #595959);\n}\n\n:host(clg-radio-group) {\n  display: block;\n  --clg-radio-group-direction: column;\n  --clg-radio-group-gap: 0;\n}\n\n:host([orientation=horizontal]) {\n  --clg-radio-group-direction: row;\n  --clg-radio-group-gap: var(--clg-dimension-pal-grid-200, 16px);\n}\n\n.clg-radio-group {\n  display: block;\n  border: none;\n  padding: 0;\n  margin: 0;\n}\n:host(clg-radio-group:not([hide-label])) .clg-radio-group__label {\n  padding-bottom: var(--clg-dimension-pal-grid-100, 8px);\n}\n.clg-radio-group__content {\n  display: flex;\n  flex-direction: var(--clg-radio-group-direction);\n  gap: var(--clg-radio-group-gap);\n}\n\n:host(clg-selectable-list) {\n  display: block;\n}\n\n.clg-selectable-list {\n  width: 100%;\n}\n.clg-selectable-list__title {\n  font-family: var(--clg-typography-sem-product-title-mobile-large-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-large-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-large-font-size, 18px);\n  line-height: var(--clg-typography-sem-product-title-mobile-large-line-height, 1.35);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-large-letter-spacing, 0.09px);\n}\n.clg-selectable-list__title ::slotted([slot=title]) {\n  font: inherit;\n  margin: 0;\n}\n.clg-selectable-list__content {\n  display: flex;\n  flex-direction: column;\n  gap: var(--clg-dimension-app-list-gap, 4px);\n}\n\n:host(clg-selectable-list-item) {\n  display: block;\n}\n\n.clg-selectable-list-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  min-height: var(--clg-dimension-sem-interaction-base, 48px);\n  width: 100%;\n  padding: var(--clg-dimension-app-list-padding-vertical, 8px) var(--clg-dimension-app-list-padding-vertical, 8px);\n  border-bottom: var(--clg-shape-sem-border-width-thin, 1px) solid var(--clg-color-sem-border-divider, #0E0E0E2E);\n  cursor: pointer;\n}\n.clg-selectable-list-item:active {\n  background-color: var(--clg-color-sem-background-surface-selected-subtle, #0E0E0E0D);\n}\n.clg-selectable-list-item__header {\n  display: flex;\n  gap: var(--clg-dimension-app-list-graphic-margin, 8px);\n}\n.clg-selectable-list-item__header__graphic {\n  display: flex;\n  justify-content: center;\n  /* Centers horizontally */\n  align-items: center;\n  /* Centers vertically */\n}\n.clg-selectable-list-item__header__text {\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  align-items: start;\n  gap: var(--clg-dimension-app-list-text-margin, 4px);\n  flex-grow: 1;\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-tight-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n.clg-selectable-list-item__selected-icon__wrapper__icon {\n  display: none;\n}\n:host(clg-selectable-list-item[selected]) .clg-selectable-list-item__selected-icon__wrapper__icon {\n  display: block;\n}\n\n:host(clg-selectable-list-item[no-divider]) .clg-selectable-list-item {\n  border-bottom: none;\n}\n\n:host(clg-selectable-list-item[variant=subtle]) .clg-selectable-list-item__header__text__title {\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-tight-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n:host(clg-selectable-list-item[variant=subtle]) .clg-selectable-list-item__header__text__subtitle {\n  display: none;\n}\n\n:host(clg-selectable-list-item[variant=strong]) .clg-selectable-list-item__header__text__title {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n:host(clg-selectable-list-item[variant=strong]) .clg-selectable-list-item__header__text__subtitle {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n\n:host(clg-shape) svg {\n  display: block;\n  height: 100%;\n  width: 100%;\n  aspect-ratio: 1/1;\n  transform-origin: center;\n  transform: scale(var(--clg-avatar-svg-scale));\n}\n:host(clg-shape) path {\n  vector-effect: non-scaling-stroke;\n}\n\n:host(clg-shape[border][size=larger]) svg {\n  --clg-avatar-svg-scale: calc(var(--clg-dimension-app-avatar-larger-image-size, 40px) / var(--clg-dimension-app-avatar-base-image-size, 32px) / 100 + 1);\n}\n\n:host(clg-shape[border][size=largest]) svg {\n  --clg-avatar-svg-scale: calc(var(--clg-dimension-app-avatar-largest-image-size, 64px) / var(--clg-dimension-app-avatar-base-image-size, 32px) / 100 + 1);\n}\n\n:host(clg-ad-signal) {\n  display: inline-block;\n}\n\n.clg-ad-signal {\n  --clg-ad-signal-color: unset;\n  --clg-ad-signal-background: unset;\n  --clg-ad-signal-min-height: unset;\n  --clg-ad-signal-padding-vertical: unset;\n  --clg-ad-signal-padding-horizontal: unset;\n  display: inline-flex;\n  justify-content: center;\n  align-items: center;\n  padding: var(--clg-ad-signal-padding-vertical) var(--clg-ad-signal-padding-horizontal);\n  min-height: var(--clg-ad-signal-min-height);\n  color: var(--clg-ad-signal-color);\n  background: var(--clg-ad-signal-background);\n}\n.clg-ad-signal__strong, .clg-ad-signal__subtle {\n  display: none;\n}\n\n:host(clg-ad-signal[variant=strong]) .clg-ad-signal {\n  border-radius: var(--clg-shape-app-signal-large-border-radius, 16px);\n  --clg-ad-signal-min-height: var(--clg-dimension-app-signal-minimum-height);\n  --clg-ad-signal-padding-vertical: var(--clg-dimension-app-signal-padding-vertical);\n  --clg-ad-signal-padding-horizontal: var(--clg-dimension-app-signal-padding-horizontal);\n  --clg-ad-signal-background: var(--clg-color-app-signal-ad-background);\n  --clg-ad-signal-color: var(--clg-color-app-signal-ad-text);\n  font-family: var(--clg-typography-sem-product-title-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-smallest-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-title-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-ad-signal[variant=strong]) .clg-ad-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-smallest-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-title-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-smallest-letter-spacing, 0px);\n  }\n}\n:host(clg-ad-signal[variant=strong]) .clg-ad-signal__strong {\n  display: block;\n}\n\n:host(clg-ad-signal[variant=subtle]) .clg-ad-signal {\n  --clg-ad-signal-min-height: var(--clg-dimension-app-signal-subtle-minimum-height);\n  --clg-ad-signal-padding-vertical: var(--clg-dimension-app-signal-subtle-padding-vertical);\n  --clg-ad-signal-padding-horizontal: var(--clg-dimension-app-signal-subtle-padding-horizontal);\n  --clg-ad-signal-color: var(--clg-color-app-signal-ad-subtle-text);\n  font-family: var(--clg-typography-sem-product-body-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-smallest-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-body-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-ad-signal[variant=subtle]) .clg-ad-signal {\n    font-family: var(--clg-typography-sem-product-body-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-smallest-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-body-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-smallest-letter-spacing, 0px);\n  }\n}\n:host(clg-ad-signal[variant=subtle]) .clg-ad-signal__subtle {\n  display: block;\n}\n\n:host(clg-ad-signal[variant=strong][size=large]) .clg-ad-signal {\n  --clg-ad-signal-min-height: var(--clg-dimension-app-signal-large-minimum-height);\n  --clg-ad-signal-padding-vertical: var(--clg-dimension-app-signal-large-padding-vertical);\n  --clg-ad-signal-padding-horizontal: var(--clg-dimension-app-signal-large-padding-horizontal);\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-ad-signal[variant=strong][size=large]) .clg-ad-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-ad-signal[variant=subtle][size=large]) .clg-ad-signal {\n  --clg-ad-signal-min-height: var(--clg-dimension-app-signal-large-subtle-minimum-height);\n  --clg-ad-signal-padding-vertical: var(--clg-dimension-app-signal-large-subtle-padding-vertical);\n  --clg-ad-signal-padding-horizontal: var(--clg-dimension-app-signal-large-subtle-padding-horizontal);\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-ad-signal[variant=subtle][size=large]) .clg-ad-signal {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-signal {\n  --clg-signal-bg-color: unset;\n  --clg-signal-text-color: unset;\n  --clg-signal-border-radius: var(--clg-shape-app-signal-border-radius);\n  --clg-signal-min-height: var(--clg-dimension-app-signal-minimum-height);\n  --clg-signal-min-width: var(--clg-dimension-app-signal-minimum-width);\n  --clg-signal-padding-vertical: var(--clg-dimension-app-signal-padding-vertical);\n  --clg-signal-padding-horizontal: var(\n      --clg-dimension-app-signal-padding-horizontal\n  );\n  display: flex;\n  gap: var(--clg-dimension-app-signal-gap, 3px);\n  align-items: center;\n  max-width: max-content;\n  background-color: var(--clg-signal-bg-color, var(--clg-color-app-signal-background, #FFFFFF));\n  color: var(--clg-signal-text-color, var(--clg-color-app-signal-text, #222222));\n  border-radius: var(--clg-signal-border-radius);\n  min-height: var(--clg-signal-min-height);\n  min-width: var(--clg-signal-min-width);\n  padding: var(--clg-signal-padding-vertical) var(--clg-signal-padding-horizontal);\n  font-family: var(--clg-typography-sem-product-title-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-smallest-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-title-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-smallest-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-title-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-smallest-letter-spacing, 0px);\n  }\n}\n\n:host(clg-signal[size=large]) .clg-signal {\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n  --clg-signal-border-radius: var(--clg-shape-app-signal-large-border-radius, 16px);\n  --clg-signal-min-height: var(--clg-dimension-app-signal-large-minimum-height, 28px);\n  --clg-signal-min-width: var(--clg-dimension-app-signal-large-minimum-height, 28px);\n  --clg-signal-padding-vertical: var(--clg-dimension-app-signal-large-padding-vertical, 4px);\n  --clg-signal-padding-horizontal: var(--clg-dimension-app-signal-large-padding-horizontal, 8px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-signal[size=large]) .clg-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-signal[size=large][variant=subtle]) .clg-signal {\n  --clg-signal-min-height: var(--clg-dimension-app-signal-large-subtle-minimum-height, 18px);\n  --clg-signal-min-width: var(--clg-dimension-app-signal-large-subtle-minimum-height, 18px);\n  --clg-signal-padding-vertical: var(--clg-dimension-app-signal-large-subtle-padding-vertical, 2px);\n  --clg-signal-padding-horizontal: 0;\n}\n\n:host(clg-signal[variant=subtle]) .clg-signal {\n  --clg-signal-min-height: var(--clg-dimension-app-signal-subtle-minimum-height, 16px);\n  --clg-signal-min-width: var(--clg-dimension-app-signal-subtle-minimum-height, 16px);\n  --clg-signal-padding-vertical: var(--clg-dimension-app-signal-subtle-padding-vertical, 2px);\n  --clg-signal-padding-horizontal: 0;\n}\n\n:host(clg-signal:not([variant=subtle])) .clg-signal {\n  border: var(--clg-shape-app-signal-border-width, 1px) solid var(--clg-signal-border-color, var(--clg-color-app-signal-border, #0E0E0E2E));\n}\n\n:host(clg-signal[color=neutral][variant=strong]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-strong-border, #00000000);\n  --clg-signal-bg-color: var(--clg-color-app-signal-strong-background, #EAEAEA);\n  --clg-signal-color: var(--clg-color-app-signal-strong-text, #222222);\n  --clg-signal-text-color: var(--clg-color-sem-text-primary, #222222);\n}\n\n:host(clg-signal[color=neutral][variant=subtle]) .clg-signal {\n  --clg-signal-text-color: var(--clg-color-app-signal-subtle-text, #222222);\n  --clg-signal-bg-color: transparent;\n}\n\n:host(clg-signal[color=highlight]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-highlight-border, #0E0E0E2E);\n  --clg-signal-bg-color: var(--clg-color-app-signal-highlight-background, #FFFFFF);\n  --clg-signal-text-color: var(--clg-color-app-signal-highlight-text, #3B67D9);\n}\n\n:host(clg-signal[color=highlight][variant=strong]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-highlight-strong-border, #00000000);\n  --clg-signal-bg-color: var(--clg-color-app-signal-highlight-strong-background, #3B67D9);\n  --clg-signal-text-color: var(--clg-color-app-signal-highlight-strong-text, #FFFFFF);\n}\n\n:host(clg-signal[color=highlight][variant=subtle]) .clg-signal {\n  --clg-signal-text-color: var(--clg-color-app-signal-highlight-subtle-text, #3B67D9);\n  --clg-signal-bg-color: transparent;\n}\n\n:host(clg-signal[color=promote]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-promote-border, #0E0E0E2E);\n  --clg-signal-bg-color: var(--clg-color-app-signal-promote-background, #FFFFFF);\n  --clg-signal-text-color: var(--clg-color-app-signal-promote-text, #0F743B);\n}\n\n:host(clg-signal[color=promote][variant=strong]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-promote-strong-border, #00000000);\n  --clg-signal-bg-color: var(--clg-color-app-signal-promote-strong-background, #A0E193);\n  --clg-signal-text-color: var(--clg-color-app-signal-promote-strong-text, #222222);\n}\n\n:host(clg-signal[color=promote][variant=subtle]) .clg-signal {\n  --clg-signal-text-color: var(--clg-color-app-signal-promote-subtle-text, #0F743B);\n  --clg-signal-bg-color: transparent;\n}\n\n:host(clg-signal[color=urgency]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-urgency-border, #0E0E0E2E);\n  --clg-signal-bg-color: var(--clg-color-app-signal-urgency-background, #FFFFFF);\n  --clg-signal-text-color: var(--clg-color-app-signal-urgency-text, #9A0027);\n}\n\n:host(clg-signal[color=urgency][variant=strong]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-urgency-strong-border, #00000000);\n  --clg-signal-bg-color: var(--clg-color-app-signal-urgency-strong-background, #FFC4D3);\n  --clg-signal-text-color: var(--clg-color-app-signal-urgency-strong-text, #222222);\n}\n\n:host(clg-signal[color=urgency][variant=subtle]) .clg-signal {\n  --clg-signal-text-color: var(--clg-color-app-signal-urgency-subtle-text, #9A0027);\n  --clg-signal-bg-color: transparent;\n}\n\n:host(clg-signal[color=trust]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-trust-border, #0E0E0E2E);\n  --clg-signal-bg-color: var(--clg-color-app-signal-trust-background, #FFFFFF);\n  --clg-signal-text-color: var(--clg-color-app-signal-trust-text, #222222);\n}\n\n:host(clg-signal[color=trust][variant=strong]) .clg-signal {\n  --clg-signal-border-color: var(--clg-color-app-signal-trust-strong-border, #00000000);\n  --clg-signal-bg-color: var(--clg-color-app-signal-trust-strong-background, #FCC7A2);\n  --clg-signal-text-color: var(--clg-color-app-signal-trust-strong-text, #222222);\n}\n\n:host(clg-signal[color=trust][variant=subtle]) .clg-signal {\n  --clg-signal-text-color: var(--clg-color-app-signal-trust-subtle-text, #222222);\n  --clg-signal-bg-color: transparent;\n}\n\n:host(clg-star-seller-signal) {\n  display: inline-block;\n}\n\n.clg-star-seller-signal {\n  --clg-star-seller-signal-padding-vertical: unset;\n  --clg-star-seller-signal-padding-horizontal: unset;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: var(--clg-dimension-app-signal-gap, 3px);\n  border-radius: var(--clg-shape-app-signal-large-border-radius, 16px);\n  min-height: var(--clg-dimension-app-signal-minimum-height, 20px);\n  border: var(--clg-shape-app-signal-border-width, 1px) solid var(--clg-color-app-signal-border, #0E0E0E2E);\n  background: var(--clg-color-app-signal-background, #FFFFFF);\n  color: var(--clg-color-sem-text-star-seller, #9560B8);\n  padding: var(--clg-star-seller-signal-padding-vertical) var(--clg-star-seller-signal-padding-horizontal);\n  font-family: var(--clg-typography-sem-product-title-mobile-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-smallest-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-smallest-font-size, 11px);\n  line-height: var(--clg-typography-sem-product-title-mobile-smallest-line-height, 1.1);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-smallest-letter-spacing, 0px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-star-seller-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-smallest-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-smallest-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-smallest-font-size, 11px);\n    line-height: var(--clg-typography-sem-product-title-desktop-smallest-line-height, 1.1);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-smallest-letter-spacing, 0px);\n  }\n}\n\n:host(clg-star-seller-signal[variant=strong]) .clg-star-seller-signal {\n  border: var(--clg-shape-app-signal-border-width, 1px) solid var(--clg-color-app-signal-strong-border, #00000000);\n  background: var(--clg-color-sem-background-surface-star-seller-dark, #9560B8);\n  color: var(--clg-color-sem-text-on-surface-dark, #FFFFFF);\n}\n\n:host(clg-star-seller-signal[variant=subtle]) .clg-star-seller-signal {\n  border: none;\n  background: none;\n  --clg-star-seller-signal-padding-vertical: var(--clg-dimension-app-signal-large-subtle-padding-vertical);\n  --clg-star-seller-signal-padding-horizontal: var(--clg-dimension-app-signal-large-subtle-padding-horizontal);\n}\n\n:host(clg-star-seller-signal[size=large]) .clg-star-seller-signal {\n  min-height: var(--clg-dimension-app-signal-large-minimum-height, 28px);\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-star-seller-signal[size=large]) .clg-star-seller-signal {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n\n:host(clg-star-seller-signal[size=base]:not([variant=subtle])) .clg-star-seller-signal {\n  --clg-star-seller-signal-padding-vertical: var(--clg-dimension-app-signal-padding-vertical);\n  --clg-star-seller-signal-padding-horizontal: var(--clg-dimension-app-signal-padding-horizontal);\n}\n\n:host(clg-star-seller-signal[size=large]:not([variant=subtle])) .clg-star-seller-signal {\n  --clg-star-seller-signal-padding-vertical: var(--clg-dimension-app-signal-large-padding-vertical);\n  --clg-star-seller-signal-padding-horizontal: var(--clg-dimension-app-signal-large-padding-horizontal);\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-loading-spinner {\n  --clg-spinner-stroke-color: var(--clg-color-app-spinner-foreground);\n  --clg-spinner-border-color: var(--clg-color-app-spinner-background);\n  --clg-spinner-size: var(--clg-dimension-app-spinner-size);\n  display: block;\n  position: relative;\n  height: var(--clg-spinner-size);\n  width: var(--clg-spinner-size);\n  aspect-ratio: 1 / 1;\n  stroke-width: var(--clg-shape-sem-border-width-medium, 4px);\n}\n:host([background-type=light]) .clg-loading-spinner {\n  --clg-spinner-stroke-color: var(\n      --clg-color-app-spinner-on-surface-light-foreground\n  );\n  --clg-spinner-border-color: var(\n      --clg-color-app-spinner-on-surface-light-background\n  );\n}\n:host([background-type=dark]) .clg-loading-spinner {\n  --clg-spinner-stroke-color: var(\n      --clg-color-app-spinner-on-surface-dark-foreground\n  );\n  --clg-spinner-border-color: var(\n      --clg-color-app-spinner-on-surface-dark-background\n  );\n}\n:host([size=large]) .clg-loading-spinner {\n  --clg-spinner-size: var(--clg-dimension-app-spinner-large-size);\n}\n.clg-loading-spinner circle {\n  r: calc(50% - (var(--clg-shape-sem-border-width-medium, 4px) / 2));\n}\n.clg-loading-spinner__track {\n  stroke: var(--clg-spinner-border-color);\n}\n.clg-loading-spinner__fill {\n  transform: rotate(-90deg);\n  transform-origin: 50%;\n  stroke: var(--clg-spinner-stroke-color);\n  stroke-dashoffset: 60;\n  animation-name: clg-spinner-keyframe;\n  animation-duration: 1.2s;\n  animation-timing-function: linear;\n  animation-iteration-count: infinite;\n}\n@keyframes clg-spinner-keyframe {\n  0% {\n    stroke-dashoffset: 95;\n    transform: rotate(-90deg);\n  }\n  50% {\n    stroke-dashoffset: 50;\n    transform: rotate(0deg);\n  }\n  100% {\n    stroke-dashoffset: 95;\n    transform: rotate(270deg);\n  }\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n.clg-image-tile {\n  display: flex;\n  max-width: 100%;\n}\n\n.clg-image-tile__placeholder {\n  display: none;\n  background: var(--clg-color-sem-background-surface-placeholder-subtle, #0E0E0E17);\n}\n\n:host(clg-image-tile[layout$=grid][placeholders=\"1\"]) .clg-image-tile__placeholder:first-of-type {\n  display: block;\n}\n\n:host(clg-image-tile[layout$=grid][placeholders=\"2\"]) .clg-image-tile__placeholder:nth-of-type(n + 2) {\n  display: block;\n}\n\n:host(clg-image-tile[layout$=grid][placeholders=\"3\"]) .clg-image-tile__placeholder {\n  display: block;\n}\n\n:host(clg-image-tile) {\n  display: flex;\n  min-height: 0;\n  max-width: 100%;\n  width: 100%;\n}\n:host(clg-image-tile) ::slotted(*) {\n  height: auto;\n  min-width: 0;\n  max-width: 100%;\n  object-fit: cover;\n}\n\n:host(clg-image-tile[layout=one-one]) ::slotted(*) {\n  aspect-ratio: 1/1;\n}\n\n:host(clg-image-tile[layout=four-five]) {\n  aspect-ratio: 4/5;\n}\n\n:host(clg-image-tile[layout=five-four]) {\n  aspect-ratio: 5/4;\n}\n\n:host(clg-image-tile[layout=one-one-row]) .clg-image-tile {\n  display: flex;\n  flex-direction: row;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n}\n:host(clg-image-tile[layout=one-one-row]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 1/1;\n}\n\n:host(clg-image-tile[layout=four-five-row]) .clg-image-tile {\n  display: flex;\n  flex-direction: row;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n}\n:host(clg-image-tile[layout=four-five-row]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 4/5;\n}\n\n:host(clg-image-tile[layout=five-four-row]) .clg-image-tile {\n  display: flex;\n  flex-direction: row;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n}\n:host(clg-image-tile[layout=five-four-row]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 5/4;\n}\n\n:host(clg-image-tile[layout=one-one-grid]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n:host(clg-image-tile[layout=one-one-grid]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=one-one-grid]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 1/1;\n}\n\n:host(clg-image-tile[layout=four-five-grid]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n:host(clg-image-tile[layout=four-five-grid]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=four-five-grid]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 4/5;\n}\n\n:host(clg-image-tile[layout=five-four-grid]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n:host(clg-image-tile[layout=five-four-grid]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=five-four-grid]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 5/4;\n}\n\n:host(clg-image-tile[layout=one-one-mosaic-vertical]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: 1fr 1fr;\n}\n:host(clg-image-tile[layout=one-one-mosaic-vertical]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=one-one-mosaic-vertical]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 1/1;\n}\n:host(clg-image-tile[layout=one-one-mosaic-vertical]) .clg-image-tile ::slotted(*:first-child) {\n  grid-column: span 2;\n}\n\n:host(clg-image-tile[layout=one-one-mosaic-horizontal]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: calc(100% / 3 * 2) calc( 100% / 3 - (var(--clg-dimension-app-image-tile-gap, 2px) / 2) );\n}\n:host(clg-image-tile[layout=one-one-mosaic-horizontal]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=one-one-mosaic-horizontal]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 1/1;\n}\n:host(clg-image-tile[layout=one-one-mosaic-horizontal]) .clg-image-tile ::slotted(*:first-child) {\n  grid-row: span 2;\n}\n\n:host(clg-image-tile[layout=four-five-mosaic-horizontal]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: calc(100% / 3 * 2) calc( 100% / 3 - (var(--clg-dimension-app-image-tile-gap, 2px) / 2) );\n}\n:host(clg-image-tile[layout=four-five-mosaic-horizontal]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=four-five-mosaic-horizontal]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 4/5;\n}\n:host(clg-image-tile[layout=four-five-mosaic-horizontal]) .clg-image-tile ::slotted(*:first-child) {\n  grid-row: span 2;\n}\n\n:host(clg-image-tile[layout=five-four-mosaic-vertical]) .clg-image-tile {\n  display: grid;\n  gap: var(--clg-dimension-app-image-tile-gap, 2px);\n  grid-template-columns: 1fr 1fr;\n}\n:host(clg-image-tile[layout=five-four-mosaic-vertical]) .clg-image-tile__placeholder,\n:host(clg-image-tile[layout=five-four-mosaic-vertical]) .clg-image-tile ::slotted(*) {\n  aspect-ratio: 5/4;\n}\n:host(clg-image-tile[layout=five-four-mosaic-vertical]) .clg-image-tile ::slotted(*:first-child) {\n  grid-column: span 2;\n}\n\n:host(clg-image-tile[rounded]) .clg-image-tile {\n  border-radius: var(--clg-shape-sem-border-radius-card, 12px);\n  overflow: hidden;\n}\n\n/* stylelint-disable indentation */\n:host(clg-text-input),\n:host(clg-textarea) {\n  display: block !important;\n}\n\n.clg-text-field__before {\n  margin-bottom: var(--clg-dimension-pal-grid-050, 4px);\n}\n:host([hide-label][hide-helper-text]) .clg-text-field__before, :host([hide-label]:not([with-helper-text])) .clg-text-field__before {\n  margin-bottom: 0;\n}\n\n.clg-text-field__label {\n  display: contents;\n}\n.clg-text-field__visual-box {\n  border-radius: var(--clg-shape-app-input-border-radius, 8px);\n  color: var(--clg-color-app-input-text, #222222);\n  display: flex;\n  min-height: var(--clg-dimension-app-input-minimum-height, 48px);\n  gap: var(--clg-dimension-app-input-gap, 4px);\n  border: var(--clg-shape-app-input-border-width, 1.5px) solid var(--clg-color-app-input-border, #949494);\n  outline-offset: -1px;\n}\n.clg-text-field__visual-box:has(input) {\n  padding: 0 var(--clg-dimension-app-input-padding-horizontal, 12px);\n}\n.clg-text-field__visual-box:has(textarea) {\n  padding: var(--clg-dimension-app-input-padding-vertical, 8px) var(--clg-dimension-app-input-padding-horizontal, 12px);\n}\n:host([size=small]) .clg-text-field__visual-box {\n  min-height: var(--clg-dimension-app-input-small-minimum-height, 36px);\n}\n:host([size=small]) .clg-text-field__visual-box:has(textarea) {\n  padding: var(--clg-dimension-app-input-small-padding-vertical, 4px) var(--clg-dimension-app-input-padding-horizontal, 12px);\n}\n.clg-text-field__visual-box:has(:is(input:focus-visible, textarea:focus-visible)) {\n  border-color: transparent;\n  outline: var(--clg-shape-app-input-border-focused-width, 2px) solid var(--clg-color-app-input-focused-border, #3B67D9);\n}\n:host([invalid]) .clg-text-field__visual-box {\n  background-color: var(--clg-color-app-input-error-background, #FFEAF0);\n  border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n  color: var(--clg-color-app-input-error-text, #9A0027);\n}\n\n:host([invalid]) .clg-text-field__visual-box:has(:is(input:focus-visible, textarea:focus-visible)) {\n  color: var(--clg-color-app-input-text, #222222);\n}\n\n:host([disabled]) .clg-text-field__visual-box {\n  background-color: var(--clg-color-app-input-disabled-background, #EAEAEA);\n  border-color: var(--clg-color-app-input-disabled-border, #949494);\n  color: var(--clg-color-app-input-disabled-text, #595959);\n}\n\n.clg-text-field__visual-box:has(input) {\n  align-items: center;\n}\n.clg-text-field__control {\n  padding: 0;\n  -webkit-appearance: none;\n  appearance: none;\n  background: inherit;\n  color: inherit;\n  border: 0;\n  outline: 0;\n  display: block;\n  width: 100%;\n  resize: none;\n  caret-color: currentColor;\n}\n.clg-text-field__control :focus {\n  outline: 0;\n}\n.clg-text-field__control[type=date]::-webkit-inner-spin-button, .clg-text-field__control[type=date]::-webkit-calendar-picker-indicator, .clg-text-field__control[type=datetime-local]::-webkit-inner-spin-button, .clg-text-field__control[type=datetime-local]::-webkit-calendar-picker-indicator, .clg-text-field__control[type=month]::-webkit-inner-spin-button, .clg-text-field__control[type=month]::-webkit-calendar-picker-indicator, .clg-text-field__control[type=week]::-webkit-inner-spin-button, .clg-text-field__control[type=week]::-webkit-calendar-picker-indicator, .clg-text-field__control[type=time]::-webkit-inner-spin-button, .clg-text-field__control[type=time]::-webkit-calendar-picker-indicator {\n  display: none;\n}\n:host([resize=vertical]) .clg-text-field__control {\n  resize: vertical;\n  min-height: 1lh;\n}\n\n.clg-text-field__control::placeholder {\n  color: var(--clg-color-sem-text-placeholder, #757575);\n}\ninput.clg-text-field__control {\n  overflow: hidden !important;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  align-self: stretch;\n}\n\n.clg-text-field__control, .clg-text-field__visual-box {\n  cursor: text;\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-tight-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-text-field__control, .clg-text-field__visual-box {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-tight-line-height, 1.5);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n:host([size=small]) .clg-text-field__control, :host([size=small]) .clg-text-field__visual-box {\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  :host([size=small]) .clg-text-field__control, :host([size=small]) .clg-text-field__visual-box {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n:host([disabled]) .clg-text-field__control, :host([disabled]) .clg-text-field__visual-box {\n  cursor: not-allowed;\n}\n.clg-text-field__textarea-sizer {\n  display: grid;\n  width: 100%;\n}\n:host([resize=auto]) .clg-text-field__textarea-sizer::after {\n  content: attr(data-replicated-value) \" \";\n  white-space: pre-wrap;\n  visibility: hidden;\n  border-color: transparent;\n  font: inherit;\n}\n\n:host([resize=auto]) .clg-text-field__textarea-sizer > textarea, :host([resize=auto]) .clg-text-field__textarea-sizer::after {\n  grid-area: 1/1/2/2;\n  max-width: 100%;\n  overflow: hidden;\n  word-break: break-word;\n}\n\n.clg-text-field__icon-affix {\n  color: inherit;\n  display: flex;\n}\n.clg-text-field__text-affix:empty {\n  display: none;\n}\n.clg-text-field__action-btn {\n  display: none;\n  appearance: none;\n  border: none;\n  background: none;\n  padding: 0;\n  cursor: pointer;\n}\n.clg-text-field__action-btn__icon {\n  display: block;\n  height: var(--clg-dimension-sem-icon-core-base, 24px);\n  width: var(--clg-dimension-sem-icon-core-base, 24px);\n  background-color: currentColor;\n  background-repeat: no-repeat;\n  background-size: contain;\n  -webkit-mask-image: var(--clg-affix-icon);\n  mask-image: var(--clg-affix-icon);\n}\n:host([size=small]) .clg-text-field__action-btn__icon {\n  height: var(--clg-dimension-sem-icon-core-smaller, 18px);\n  width: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n:host([pseudo-focus]) .clg-text-field__action-btn, .clg-text-field__action-btn:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-text-field__action-btn, .clg-text-field__action-btn:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-text-field__action-btn:not(:focus-visible), .clg-text-field__action-btn:focus:not(:focus-visible) {\n  outline: none;\n}\n:host([type=date]) .clg-text-field__action-btn, :host([type=datetime-local]) .clg-text-field__action-btn, :host([type=week]) .clg-text-field__action-btn, :host([type=month]) .clg-text-field__action-btn, :host([type=time]) .clg-text-field__action-btn, :host([type=password]) .clg-text-field__action-btn {\n  display: block;\n}\n:host([type=date]) .clg-text-field__action-btn, :host([type=datetime-local]) .clg-text-field__action-btn, :host([type=week]) .clg-text-field__action-btn, :host([type=month]) .clg-text-field__action-btn {\n  --clg-affix-icon: url(\"data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 24 24%22%3E%3Cpath d%3D%22M17.5 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0%22%2F%3E%3Cpath fill-rule%3D%22evenodd%22 clip-rule%3D%22evenodd%22 d%3D%22M6.5 5H3v16h18V5h-3.5V3h-2v2h-7V3h-2zm0 2v1h2V7h7v1h2V7H19v3H5V7zM5 12v7h14v-7z%22%2F%3E%3C%2Fsvg%3E\");\n}\n:host([type=time]) .clg-text-field__action-btn {\n  --clg-affix-icon: url(\"data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 24 24%22%3E%3Cpath d%3D%22M12 22a10 10 0 1 1 10-10 10.01 10.01 0 0 1-10 10m0-18a8 8 0 1 0 8 8 8.01 8.01 0 0 0-8-8%22%2F%3E%3Cpath d%3D%22M15 15a1 1 0 0 1-.426-.1L11 13.217V7a1 1 0 0 1 2 0v4.949l2.427 1.151A1 1 0 0 1 15 15%22%2F%3E%3C%2Fsvg%3E\");\n}\n:host([type=password]) .clg-text-field__action-btn {\n  --clg-affix-icon: url(\"data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 24 24%22%3E%3Cpath d%3D%22M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0%22%2F%3E%3Cpath fill-rule%3D%22evenodd%22 clip-rule%3D%22evenodd%22 d%3D%22M12 4c4.867 0 9.264 3.077 10.939 7.656a1 1 0 0 1 0 .688C21.264 16.923 16.868 20 11.999 20c-4.867 0-9.263-3.077-10.938-7.656a1 1 0 0 1 0-.688C2.736 7.077 7.133 4 12 4m-8.928 8c1.478 3.604 5.02 6 8.928 6s7.45-2.397 8.928-6C19.45 8.396 15.908 6 12 6s-7.45 2.396-8.928 6%22%2F%3E%3C%2Fsvg%3E\");\n}\n:host([type=password]) .clg-text-field__action-btn--password-visible {\n  --clg-affix-icon: url(\"data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 viewBox%3D%220 0 24 24%22%3E%3Cpath d%3D%22M10.89 6.074A9 9 0 0 1 12 6c3.909 0 7.45 2.396 8.929 6a9.3 9.3 0 0 1-1.28 2.186.99.99 0 0 0 .088 1.307l.009.01c.43.43 1.14.381 1.51-.1a11.5 11.5 0 0 0 1.684-3.058c.08-.22.08-.469 0-.689C21.264 7.077 16.868 4 12 4q-.693.002-1.37.084c-.831.103-1.186 1.116-.594 1.708.224.224.54.321.854.282m11.818 15.22-3.678-3.679-1.434-1.435h-.001L14.7 13.285 10.717 9.3h-.001L8.218 6.803 6.707 5.29h-.001L2.708 1.293a.999.999 0 1 0-1.414 1.414l3.678 3.678a11.64 11.64 0 0 0-3.911 5.271 1 1 0 0 0 0 .688C2.737 16.924 7.133 20 12 20c1.879 0 3.683-.467 5.29-1.296l4.003 4.002a.997.997 0 0 0 1.414.001 1 1 0 0 0 0-1.414M12 18c-3.908 0-7.45-2.396-8.928-6a9.6 9.6 0 0 1 3.34-4.174l2.885 2.885A3 3 0 0 0 9 12.001c0 1.653 1.346 3 3 3 .463 0 .899-.109 1.289-.298l2.498 2.498a9.5 9.5 0 0 1-3.787.8%22%2F%3E%3C%2Fsvg%3E\");\n}\n.clg-text-field__after {\n  display: flex;\n  flex-wrap: nowrap;\n  align-items: flex-start;\n  gap: var(--clg-dimension-app-input-gap, 4px);\n}\n:host([with-caption]) .clg-text-field__after, :host([caption]) .clg-text-field__after, :host([invalid]) .clg-text-field__after, :host([show-character-count]) .clg-text-field__after {\n  margin-top: var(--clg-dimension-pal-grid-050, 4px);\n}\n.clg-text-field__character-count {\n  flex-shrink: 1;\n  text-align: right;\n  margin-left: auto;\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n}\n@media only screen and (min-width: 640px) {\n  .clg-text-field__character-count {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n:host([invalid]) .clg-text-field__character-count {\n  color: var(--clg-color-app-input-error-text, #9A0027);\n}\n\n:host(clg-text-link) {\n  display: inline-block;\n}\n\n.clg-text-link {\n  cursor: pointer;\n  color: currentColor;\n  font: inherit;\n  letter-spacing: inherit;\n  text-decoration: underline;\n  display: inline-flex;\n  align-items: center;\n  gap: var(--clg-dimension-app-text-link-gap, 4px);\n  border-radius: var(--clg-shape-sem-border-radius-smallest, 2px);\n}\n:host([pseudo-focus]) .clg-text-link, .clg-text-link:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) .clg-text-link, .clg-text-link:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) .clg-text-link:not(:focus-visible), .clg-text-link:focus:not(:focus-visible) {\n  outline: none;\n}\n.clg-text-link[aria-disabled] {\n  color: var(--clg-color-sem-text-disabled, #757575);\n  cursor: not-allowed;\n}\n:host(clg-text-link[icon]) .clg-text-link, :host(clg-text-link[no-underline]:not(:hover)) .clg-text-link {\n  text-decoration: none;\n}\n\n:host(clg-text-link[icon=end]) .clg-text-link {\n  flex-direction: row-reverse;\n}\n\n:host(clg-text-link:not([target=_blank])) .clg-text-link__new-tab-text {\n  display: none;\n}\n\n/* stylelint-disable indentation */\n/* stylelint-disable selector-type-no-unknown */\n:host(clg-toast) {\n  display: block;\n}\n\n.clg-toast {\n  padding: var(--clg-dimension-app-alert-toast-padding-vertical, 8px) var(--clg-dimension-app-alert-toast-padding-horizontal-end, 8px) var(--clg-dimension-app-alert-toast-padding-vertical, 8px) var(--clg-dimension-app-alert-toast-padding-horizontal-start, 12px);\n  border-radius: var(--clg-shape-sem-border-radius-small, 8px);\n  box-shadow: var(--clg-effect-sem-shadow-elevation-3, 0px 1px 3px 0px #0000004D, 0px 4px 8px 3px #00000026);\n  min-height: 52px;\n  pointer-events: all;\n  display: flex;\n  align-items: center;\n  gap: var(--clg-dimension-app-alert-toast-gap, 12px);\n}\n:host(clg-toast[color=neutral]) .clg-toast {\n  background-color: var(--clg-color-app-alert-toast-neutral-background, #FFFFFF);\n  color: var(--clg-color-app-alert-toast-neutral-text, #222222);\n}\n.clg-toast__critical-icon {\n  display: none;\n}\n:host(clg-toast[color=critical]) .clg-toast {\n  background-color: var(--clg-color-app-alert-toast-critical-background, #9A0027);\n  color: var(--clg-color-app-alert-toast-critical-text, #FFFFFF);\n}\n:host(clg-toast[color=critical]) .clg-toast__critical-icon {\n  display: block;\n}\n:host(clg-toast[color=critical]) .clg-toast slot[name=icon] {\n  display: none;\n}\n.clg-toast__icon-frame {\n  display: none;\n  background-color: var(--clg-color-app-alert-toast-neutral-icon-background, #EAEAEA);\n  color: var(--clg-color-app-alert-toast-neutral-icon-foreground, #222222);\n  border-radius: var(--clg-shape-sem-border-radius-full, 999999px);\n  min-height: var(--clg-dimension-pal-grid-400, 32px);\n  min-width: var(--clg-dimension-pal-grid-400, 32px);\n  max-height: var(--clg-dimension-pal-grid-400, 32px);\n  max-width: var(--clg-dimension-pal-grid-400, 32px);\n  align-items: center;\n  justify-content: center;\n}\n:host(clg-toast[color=critical]) .clg-toast__icon-frame, :host(clg-toast[with-icon]) .clg-toast__icon-frame {\n  display: flex;\n}\n\n.clg-toast__content {\n  flex-grow: 1;\n}\n.clg-toast__actions {\n  display: flex;\n  align-items: center;\n  gap: var(--clg-dimension-app-button-gap, 6px);\n}\n\n.clg-toast-group {\n  display: flex;\n  flex-direction: column-reverse;\n  gap: var(--clg-dimension-sem-spacing-card, 18px);\n  z-index: var(--clg-effect-pal-z-index-800, 80);\n  padding: var(--clg-dimension-sem-spacing-page-margin, 32px);\n  overflow-y: auto;\n  pointer-events: none;\n  position: fixed;\n  bottom: env(save-area-inset-bottom, 0px);\n  right: env(save-area-inset-right, 0px);\n  top: env(save-area-inset-top, 0px);\n  left: env(save-area-inset-left, 0px);\n  height: 100vh;\n  max-height: 100vh;\n  height: 100dvh;\n  max-height: 100dvh;\n  width: min(calc(var(--clg-dimension-app-alert-toast-max-width, 616px) + (var(--clg-dimension-sem-spacing-page-margin, 32px) * 2)), 100%);\n}\n@media only screen and (min-width: 480px) {\n  .clg-toast-group {\n    top: auto;\n    left: auto;\n  }\n}\n\n:host(clg-on-image) {\n  display: block;\n  width: 100%;\n  height: 100%;\n}\n\n.clg-on-image {\n  width: 100%;\n  height: 100%;\n  position: relative;\n}\n\n:host(clg-on-image) slot:not([name])::slotted(*) {\n  display: block;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n}\n\n:host(clg-on-image) .clg-on-image-top-start {\n  position: absolute;\n  padding-inline-start: var(--clg-dimension-pal-grid-100, 8px);\n  padding-top: var(--clg-dimension-pal-grid-100, 8px);\n  inset-block-start: 0;\n  inset-inline-start: 0;\n}\n\n:host(clg-on-image) .clg-on-image-top-end {\n  position: absolute;\n  padding-inline-end: var(--clg-dimension-pal-grid-100, 8px);\n  padding-top: var(--clg-dimension-pal-grid-100, 8px);\n  inset-block-start: 0;\n  inset-inline-end: 0;\n}\n\n:host(clg-on-image) .clg-on-image-bottom-start {\n  position: absolute;\n  padding-inline-start: var(--clg-dimension-pal-grid-100, 8px);\n  padding-bottom: var(--clg-dimension-pal-grid-100, 8px);\n  inset-block-end: 0;\n  inset-inline-start: 0;\n}\n\n:host(clg-on-image) .clg-on-image-bottom-end {\n  position: absolute;\n  padding-inline-end: var(--clg-dimension-pal-grid-100, 8px);\n  padding-bottom: var(--clg-dimension-pal-grid-100, 8px);\n  inset-block-end: 0;\n  inset-inline-end: 0;\n}\n\n:host(clg-removable-chip) {\n  display: inline-block;\n}\n\n.clg-removable-chip {\n  --clg-removable-chip-padding-vertical: var(--clg-dimension-app-chip-padding-vertical, 4px);\n  --clg-removable-chip-padding-horizontal: var(--clg-dimension-app-chip-padding-horizontal, 12px);\n  display: inline-block;\n  min-width: var(--clg-dimension-sem-interaction-base, 48px);\n  min-height: var(--clg-dimension-app-chip-small-minimum-height, 36px);\n  background-color: var(--clg-color-app-chip-removable-background, #222222);\n  border: var(--clg-color-app-chip-removable-border, #00000000);\n  border-width: var(--clg-shape-app-chip-removable-border-width, 0px);\n  border-radius: var(--clg-shape-app-chip-border-radius, 8px);\n  padding: var(--clg-removable-chip-padding-vertical) var(--clg-removable-chip-padding-horizontal);\n  color: var(--clg-color-app-chip-removable-text, #FFFFFF);\n  overflow: hidden;\n  text-align: center;\n  text-overflow: ellipsis;\n  font-family: var(--clg-typography-sem-product-title-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-small-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-title-mobile-small-line-height, 1.4);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-small-letter-spacing, 0.1299px);\n  /* Interaction (webkit properties copied from clg-button) */\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n  /* Fixes a visual bug related to iOS button taps */\n  -webkit-appearance: none;\n  /* Remove default gradient on mobile Safari buttons */\n}\n@media only screen and (min-width: 640px) {\n  .clg-removable-chip {\n    font-family: var(--clg-typography-sem-product-title-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-small-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-title-desktop-small-line-height, 1.4);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n.clg-removable-chip .clg-removable-chip__container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: var(--clg-dimension-app-chip-gap, 4px);\n}\n:host(clg-removable-chip[size=large]) .clg-removable-chip {\n  --clg-removable-chip-padding-vertical: var(--clg-dimension-app-chip-large-padding-vertical);\n  --clg-removable-chip-padding-horizontal: var(--clg-dimension-app-chip-large-padding-horizontal);\n  min-height: var(--clg-dimension-sem-interaction-base, 48px);\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-removable-chip[size=large]) .clg-removable-chip {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n:host(clg-removable-chip:not([disabled])) .clg-removable-chip:hover {\n  box-shadow: var(--clg-effect-sem-shadow-elevation-1, 0px 1px 2px 0px #0000004D, 0px 1px 3px 1px #00000026);\n}\n:host(clg-removable-chip:not([disabled])) .clg-removable-chip:active {\n  color: var(--clg-color-app-chip-removable-pressed-text, #FFFFFF);\n  border: var(--clg-color-app-chip-removable-pressed-border, #595959);\n  background-color: var(--clg-color-app-chip-removable-pressed-background, #616161);\n}\n:host([pseudo-focus]) :host(clg-removable-chip:not([disabled])) .clg-removable-chip, :host(clg-removable-chip:not([disabled])) .clg-removable-chip:focus {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus-visible]) :host(clg-removable-chip:not([disabled])) .clg-removable-chip, :host(clg-removable-chip:not([disabled])) .clg-removable-chip:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, var(--clg-shape-sem-border-width-focused, 2px));\n}\n:host([pseudo-focus]) :host(clg-removable-chip:not([disabled])) .clg-removable-chip:not(:focus-visible), :host(clg-removable-chip:not([disabled])) .clg-removable-chip:focus:not(:focus-visible) {\n  outline: none;\n}\n:host(clg-removable-chip[disabled]) .clg-removable-chip {\n  cursor: not-allowed;\n  color: var(--clg-color-app-chip-removable-disabled-text, #FFFFFF);\n  border: var(--clg-color-app-chip-removable-disabled-border, #00000000);\n  background-color: var(--clg-color-app-chip-removable-disabled-background, #757575);\n}\n\n:host(clg-removable-chip-group) {\n  display: inline-block;\n}\n\n:host(clg-removable-chip-group) .clg-removable-chip-group {\n  display: flex;\n  align-items: center;\n  gap: var(--clg-dimension-sem-spacing-chip, 8px);\n  flex-wrap: wrap;\n}\n\n/* stylelint-disable scss/operator-no-newline-after */\n/* stylelint-disable indentation */\n:host(clg-select) {\n  display: block !important;\n  width: 100%;\n}\n\n.clg-select {\n  width: 100%;\n}\n.clg-select__before {\n  margin-bottom: var(--clg-dimension-pal-grid-050, 4px);\n}\n.clg-select__visual-box {\n  position: relative;\n  width: 100%;\n}\n.clg-select__control {\n  -webkit-appearance: none;\n  appearance: none;\n  cursor: pointer;\n  background: var(--clg-color-app-input-background, #00000000);\n  color: var(--clg-color-app-input-text, #222222);\n  display: block;\n  width: 100%;\n  font-family: var(--clg-typography-sem-product-body-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-base-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-body-mobile-base-line-height, 1.7);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-base-letter-spacing, 0.16px);\n  line-height: 1;\n  border: var(--clg-shape-app-input-border-width, 1.5px) solid var(--clg-color-app-input-border, #949494);\n  border-radius: var(--clg-shape-app-input-border-radius, 8px);\n  color: var(--clg-color-app-input-text, #222222);\n  min-height: var(--clg-dimension-app-input-minimum-height, 48px);\n  gap: var(--clg-dimension-app-input-gap, 4px);\n  text-overflow: ellipsis;\n  padding-left: var(--clg-dimension-app-input-padding-horizontal, 12px);\n  padding-right: calc( var(--clg-dimension-app-input-padding-horizontal, 12px) + var(--clg-dimension-sem-icon-core-base, 24px) + var(--clg-dimension-pal-grid-050, 4px) );\n}\n@media only screen and (min-width: 640px) {\n  .clg-select__control {\n    font-family: var(--clg-typography-sem-product-body-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-base-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-body-desktop-base-line-height, 1.7);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-base-letter-spacing, 0.16px);\n  }\n}\n:host(clg-select[size=small]) .clg-select__control {\n  min-height: var(--clg-dimension-app-input-small-minimum-height, 36px);\n  font-family: var(--clg-typography-sem-product-body-mobile-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-body-mobile-small-font-weight, 400);\n  font-size: var(--clg-typography-sem-product-body-mobile-small-font-size, 12.99px);\n  line-height: var(--clg-typography-sem-product-body-mobile-small-tight-line-height, 1.2);\n  letter-spacing: var(--clg-typography-sem-product-body-mobile-small-letter-spacing, 0.1299px);\n  line-height: 1;\n}\n@media only screen and (min-width: 640px) {\n  :host(clg-select[size=small]) .clg-select__control {\n    font-family: var(--clg-typography-sem-product-body-desktop-small-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-body-desktop-small-font-weight, 400);\n    font-size: var(--clg-typography-sem-product-body-desktop-small-font-size, 12.99px);\n    line-height: var(--clg-typography-sem-product-body-desktop-small-tight-line-height, 1.2);\n    letter-spacing: var(--clg-typography-sem-product-body-desktop-small-letter-spacing, 0.1299px);\n  }\n}\n.clg-select__control:focus {\n  outline: 0;\n}\n.clg-select__control:focus-visible {\n  outline: var(--clg-focus-ring-width, var(--clg-shape-sem-border-width-focused, 2px)) solid var(--clg-focus-ring-color, var(--clg-color-sem-border-focused, #3B67D9));\n  outline-offset: var(--clg-focus-ring-offset, 0);\n  border-color: transparent;\n}\n:host([invalid]) .clg-select__control {\n  background-color: var(--clg-color-app-input-error-background, #FFEAF0);\n  border-color: var(--clg-color-app-input-selectable-error-selected-border, #9A0027);\n  color: var(--clg-color-app-input-error-text, #9A0027);\n}\n\n:host([disabled]) .clg-select__control {\n  cursor: not-allowed;\n  background-color: var(--clg-color-app-input-disabled-background, #EAEAEA);\n  border-color: var(--clg-color-app-input-disabled-border, #949494);\n  color: var(--clg-color-app-input-disabled-text, #595959);\n}\n\n.clg-select__control:has(input) {\n  align-items: center;\n}\n:host(clg-select[orientation=horizontal]:not([size=small])) .clg-select__control {\n  text-align: right;\n  text-align-last: right;\n  padding-left: calc( var(--clg-dimension-app-input-padding-horizontal, 12px) + var( --clg-select-label-width, 0px ) + var(--clg-dimension-pal-grid-200, 16px) );\n}\n\n.clg-select__control--placeholder:has(option:first-child[selected][disabled]) {\n  color: var(--clg-color-sem-text-placeholder, #757575);\n}\n.clg-select__inline-label {\n  font-family: var(--clg-typography-sem-product-title-mobile-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n  font-weight: var(--clg-typography-sem-product-title-mobile-base-font-weight, 500);\n  font-size: var(--clg-typography-sem-product-title-mobile-base-font-size, 16px);\n  line-height: var(--clg-typography-sem-product-title-mobile-base-line-height, 1.25);\n  letter-spacing: var(--clg-typography-sem-product-title-mobile-base-letter-spacing, 0.08px);\n  position: absolute;\n  top: 50%;\n  translate: 0 -50%;\n  pointer-events: none;\n  left: var(--clg-dimension-app-input-padding-horizontal, 12px);\n  display: none;\n}\n@media only screen and (min-width: 640px) {\n  .clg-select__inline-label {\n    font-family: var(--clg-typography-sem-product-title-desktop-base-font-family, \"Graphik Webfont\", \"-apple-system\", \"Helvetica Neue\", \"Droid Sans\", \"Arial\", \"sans-serif\");\n    font-weight: var(--clg-typography-sem-product-title-desktop-base-font-weight, 500);\n    font-size: var(--clg-typography-sem-product-title-desktop-base-font-size, 16px);\n    line-height: var(--clg-typography-sem-product-title-desktop-base-line-height, 1.25);\n    letter-spacing: var(--clg-typography-sem-product-title-desktop-base-letter-spacing, 0.08px);\n  }\n}\n:host(clg-select[orientation=horizontal]:not([size=small])) .clg-select__inline-label {\n  display: block;\n}\n\n.clg-select__icon {\n  display: block;\n  position: absolute;\n  right: var(--clg-dimension-app-input-padding-horizontal, 12px);\n  top: 50%;\n  translate: 0 -50%;\n  pointer-events: none;\n}\n:host(clg-select[size=small]) .clg-select__icon {\n  --clg-icon-size: var(--clg-dimension-sem-icon-core-smaller, 18px);\n}\n\n:host(clg-select[orientation=horizontal]:not([size=small])) .clg-text-field__before {\n  display: none;\n}\n\n:host(:not(:defined)) {\n  visibility: visible !important;\n}\n\n*,\n*::before,\n*::after {\n  box-sizing: inherit;\n}\n\n[hidden]:not([hidden=until-found]) {\n  display: none !important;\n}\n\n.clg-screen-reader-only {\n  border: 0 !important;\n  clip: rect(0 0 0 0) !important;\n  height: 1px !important;\n  margin: -1px !important;\n  overflow: hidden !important;\n  padding: 0 !important;\n  position: absolute !important;\n  width: 1px !important;\n}\n.clg-screen-reader-only.focusable:active, .clg-screen-reader-only.focusable:focus, .clg-screen-reader-only.wt-focusable:active, .clg-screen-reader-only.wt-focusable:focus {\n  position: static !important;\n  width: auto !important;\n  height: auto !important;\n  clip: auto !important;\n  overflow: visible !important;\n  border: initial !important;\n  margin: auto !important;\n  padding: initial !important;\n}");
ShadowStylesheet.stylesheet = sheet;

// Override icon base path to use same origin instead of hardcoded etsy.com
ClgBaseIcon.prototype.getBasePath = function(name) {
    return window.location.origin + "/assets/type/etsy-icon/clg/" + name;
};

// Now register all web components


// Import utilities and expose on window.Collage for plain HTML pages

window.Collage = window.Collage || {};
window.Collage.toast = toast || toast_namespaceObject["default"] || toast_namespaceObject;


//# sourceMappingURL=collage-web-components.js.map