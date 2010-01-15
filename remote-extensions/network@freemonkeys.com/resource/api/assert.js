var assert = {};

assert._assert = function (assert, args) {
  if (assert) {
    listener("assert-pass",Components.stack.caller.caller.lineNumber+1,{name:arguments.callee.caller.name});
  } else {
    listener("assert-fail",Components.stack.caller.caller.lineNumber+1,{name:arguments.callee.caller.name,args:args});
  }
}

assert.isTrue = function isTrue(v) {
  this._assert((typeof v=="boolean" && v),[v]);
}

assert.isFalse = function isFalse(v) {
  this._assert((typeof v=="boolean" && !v),[v]);
}

assert.isEquals = function isEquals(a,b) {
  this._assert(a===b,[a,b]);
}

assert.isDefined = function isDefined(v) {
  this._assert(v!=null,[v]);
}
