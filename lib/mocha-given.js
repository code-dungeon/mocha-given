var Context, Mocha, MochaGivenSuite, Suite, Test, Waterfall, comparisonLookup, declareSpec, finalStatementFrom, getErrorDetails, invariantList, o, stringifyExpectation, utils, wasComparison, whenList,
  indexOf = [].indexOf;

Mocha = (typeof module !== "undefined" && module !== null ? module.parent : void 0) != null ? module.parent.require('mocha') : window.Mocha;

Suite = Mocha.Suite;

Test = Mocha.Test;

utils = Mocha.utils;

Context = Mocha.Context;

Waterfall = class Waterfall {
  constructor(context1, functions = [], finalCallback) {
    var func, j, len, ref;
    this.asyncTaskCompleted = this.asyncTaskCompleted.bind(this);
    this.invokeFinalCallbackIfNecessary = this.invokeFinalCallbackIfNecessary.bind(this);
    this.flow = this.flow.bind(this);
    this.context = context1;
    this.finalCallback = finalCallback;
    this.functions = functions.slice(0);
    this.asyncCount = 0;
    ref = this.functions;
    for (j = 0, len = ref.length; j < len; j++) {
      func = ref[j];
      if (func.length > 0) {
        this.asyncCount += 1;
      }
    }
  }

  asyncTaskCompleted() {
    this.asyncCount -= 1;
    return this.flow();
  }

  invokeFinalCallbackIfNecessary() {
    if (this.asyncCount === 0) {
      if (this.finalCallback != null) {
        this.finalCallback.apply(this.context);
      }
      return this.finalCallback = void 0;
    }
  }

  flow() {
    var func;
    if (this.functions.length === 0) {
      return this.invokeFinalCallbackIfNecessary();
    }
    func = this.functions.shift();
    if (func.length > 0) {
      return func.apply(this.context, [this.asyncTaskCompleted]);
    } else {
      func.apply(this.context);
      return this.flow();
    }
  }

};

comparisonLookup = {
  '===': 'to strictly equal',
  '!==': 'to strictly differ from',
  '==': 'to equal',
  '!=': 'to differ from',
  '>': 'to be bigger than',
  '>=': 'to be bigger or equal',
  '<': 'to be smaller than',
  '<=': 'to be smaller or equal'
};

whenList = [];

invariantList = [];

o = function(thing) {
  return {
    assert: function(context, args) {
      var e, exception, result;
      result = false;
      exception = void 0;
      try {
        result = thing.apply(context, args);
      } catch (error) {
        e = error;
        exception = e;
      }
      if (exception) {
        throw new Error(exception.message + '\n' + getErrorDetails(thing, context));
      }
      if (result === false) {
        throw new Error('return value is false\n' + getErrorDetails(thing, context));
      }
    },
    isFunction: function() {
      return Object.prototype.toString.call(thing) === '[object Function]';
    },
    isString: function() {
      return Object.prototype.toString.call(thing) === '[object String]';
    },
    isNumber: function() {
      return Object.prototype.toString.call(thing) === '[object Number]';
    },
    hasArguments: function() {
      return !thing.toString().replace(/\n/g, '').match(/^function\s?\(\)/i);
    },
    firstThat: function(test) {
      var i;
      i = 0;
      while (i < thing.length) {
        if (test(thing[i]) === true) {
          return thing[i];
        }
        i++;
      }
      return void 0;
    }
  };
};

stringifyExpectation = function(expectation) {
  var matches;
  matches = expectation.toString().replace(/\n/g, '').match(/function\s?\(.*\)\s?{\s*(return\s+)?(.*?)(;)?\s*}/i);
  if (matches && matches.length >= 3) {
    return matches[2].replace(/\s+/g, ' ').replace('void 0', 'undefined');
  } else {
    return "";
  }
};

getErrorDetails = function(fn, context) {
  var comparison, expectation, expectationString, left, right;
  expectationString = stringifyExpectation(fn);
  expectation = finalStatementFrom(expectationString);
  if (comparison = wasComparison(expectation)) {
    left = (function() {
      return eval(comparison.left);
    }).call(context); // eval is evil
    right = (function() {
      return eval(comparison.right);
    }).call(context); // eval is evil
    return `     Expected '${left}' ${comparisonLookup[comparison.comparator]} '${right}'\n     Comparison: ${expectationString}\n`;
  } else {
    return "";
  }
};

finalStatementFrom = function(expectationString) {
  var multiStatement;
  if (multiStatement = expectationString.match(/.*return (.*)/)) {
    return multiStatement[multiStatement.length - 1];
  } else {
    return expectationString;
  }
};

wasComparison = function(expectation) {
  var comparator, comparison, left, right, s;
  if (comparison = expectation.match(/(.*) (===|!==|==|!=|>|>=|<|<=) (.*)/)) {
    [s, left, comparator, right] = comparison;
    return {left, comparator, right};
  }
};

declareSpec = function(specArgs, itFunc) {
  var fn, label, time, timelabel;
  label = o(specArgs).firstThat(function(arg) {
    return o(arg).isString();
  });
  fn = o(specArgs).firstThat(function(arg) {
    return o(arg).isFunction();
  });
  time = o(specArgs).firstThat(function(arg) {
    return o(arg).isNumber();
  });
  timelabel = time !== void 0 ? `after ${time > 1e3 ? time / 1e3 : time} ms, ` : '';
  return itFunc(`then ${timelabel}${label != null ? label : stringifyExpectation(fn)}`, function(done) {
    var args, expectation;
    args = Array.prototype.slice.call(arguments);
    expectation = () => {
      o(fn).assert(this, args);
      if (!o(fn).hasArguments()) {
        return done();
      }
    };
    return new Waterfall(this, [].concat(whenList, invariantList), function() {
      if (time !== void 0) {
        return setTimeout(expectation, time);
      } else {
        return expectation();
      }
    }).flow();
  });
};

MochaGivenSuite = function(suite) {
  var suites;
  suites = [suite];
  return suite.on('pre-require', function(context, file, mocha) {
    var Given, Invariant, Then, When, mostRecentlyUsed;
    // reset context for watched tests
    suite.ctx = new Context();
    context.before = function(fn) {
      suites[0].beforeAll(fn);
    };
    context.after = function(fn) {
      suites[0].afterAll(fn);
    };
    context.beforeEach = function(fn) {
      suites[0].beforeEach(fn);
    };
    context.afterEach = function(fn) {
      suites[0].afterEach(fn);
    };
    context.describe = context.context = function(title, fn) {
      suite = Suite.create(suites[0], title);
      suites.unshift(suite);
      fn.call(suite);
      suites.shift();
      return suite;
    };
    context.xdescribe = context.xcontext = context.describe.skip = function(title, fn) {
      suite = Suite.create(suites[0], title);
      suite.pending = true;
      suites.unshift(suite);
      fn.call(suite);
      suites.shift();
    };
    context.describe.only = function(title, fn) {
      suite = context.describe(title, fn);
      mocha.grep(suite.fullTitle());
      return suite;
    };
    context.it = context.specify = function(title, fn) {
      var test;
      suite = suites[0];
      if (suite.pending) {
        fn = null;
      }
      test = new Test(title, fn);
      suite.addTest(test);
      return test;
    };
    context.it.only = function(title, fn) {
      var reString, test;
      test = context.it(title, fn);
      reString = '^' + utils.escapeRegexp(test.fullTitle()) + '$';
      mocha.grep(new RegExp(reString));
      return test;
    };
    context.xit = context.xspecify = context.it.skip = function(title) {
      context.it(title);
    };
    // mocha-given extension
    mostRecentlyUsed = null;
    // get all keys in the context
    context.beforeEach(function() {
      var i;
      return this.currentTest.ctxKeys = (function() {
        var results;
        results = [];
        for (i in this.currentTest.ctx) {
          results.push(i);
        }
        return results;
      }).call(this);
    });
    // remove added keys to clean up what mocha messes up with a shared context
    context.afterEach(function() {
      var i, results;
      results = [];
      for (i in this.currentTest.ctx) {
        if (indexOf.call(this.currentTest.ctxKeys, i) < 0) {
          results.push(delete this.currentTest.ctx[i]);
        }
      }
      return results;
    });
    Given = function() {
      var assignTo, fn;
      assignTo = o(arguments).firstThat(function(arg) {
        return o(arg).isString();
      });
      fn = o(arguments).firstThat(function(arg) {
        return o(arg).isFunction();
      });
      if (assignTo) {
        return context.beforeEach(function() {
          return this[assignTo] = fn.apply(this);
        });
      } else {
        return context.beforeEach.apply(this, Array.prototype.slice.call(arguments));
      }
    };
    When = function() {
      var assignTo, fn;
      assignTo = o(arguments).firstThat(function(arg) {
        return o(arg).isString();
      });
      fn = o(arguments).firstThat(function(arg) {
        return o(arg).isFunction();
      });
      if (assignTo) {
        context.beforeEach(function() {
          return whenList.push(function() {
            return this[assignTo] = fn.apply(this);
          });
        });
      } else {
        context.beforeEach(function() {
          return whenList.push(fn);
        });
      }
      return context.afterEach(function() {
        return whenList.pop();
      });
    };
    Invariant = function(fn) {
      context.beforeEach(function() {
        return invariantList.push(fn);
      });
      return context.afterEach(function() {
        return invariantList.pop();
      });
    };
    Then = function() {
      return declareSpec(arguments, context.it);
    };
    context.Given = function() {
      mostRecentlyUsed = Given;
      return Given.apply(this, Array.prototype.slice.call(arguments));
    };
    context.When = function() {
      mostRecentlyUsed = When;
      return When.apply(this, Array.prototype.slice.call(arguments));
    };
    context.Then = function() {
      mostRecentlyUsed = Then;
      return Then.apply(this, Array.prototype.slice.call(arguments));
    };
    context.Then.only = function() {
      return declareSpec(arguments, context.it.only);
    };
    context.Then.after = function() {
      mostRecentlyUsed = Then;
      return declareSpec(arguments, context.it);
    };
    context.Invariant = function() {
      mostRecentlyUsed = Invariant;
      return Invariant.apply(this, Array.prototype.slice.call(arguments));
    };
    return context.And = function() {
      return mostRecentlyUsed.apply(this, Array.prototype.slice.call(arguments));
    };
  });
};

if (typeof exports === 'object') {
  module.exports = MochaGivenSuite;
}

Mocha.interfaces['mocha-given'] = MochaGivenSuite;
