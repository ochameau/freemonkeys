var assert = {};

assert._assert = function (assert, args) {
  var argsData = [];
  for(var i=0; i<args.length; i++) 
    argsData.push("("+typeof args[i]+") "+args[i]);
  var data = {
    name: arguments.callee.caller.name,
    args : argsData.join(", ")
  };
  
  ___listener(assert?"assert-pass":"assert-fail",Components.stack.caller.caller.lineNumber+1,data);
}

assert.isTrue = function isTrue(v) {
  assert._assert((typeof v=="boolean" && v),[v]);
}

assert.isFalse = function isFalse(v) {
  assert._assert((typeof v=="boolean" && !v),[v]);
}

assert.isEquals = function isEquals(a,b) {
  assert._assert(a===b,[a,b]);
}

assert.isDefined = function isDefined(v) {
  assert._assert(v!=null,[v]);
}
