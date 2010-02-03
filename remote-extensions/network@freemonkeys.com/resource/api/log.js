var log = {};

log.debug = function (v) {
  ___listener.execAsync(["debug",Components.stack.caller.lineNumber+1,"("+typeof v+") "+v]);
}

log.inspect = function (v) {
  //___listener.execAsync(["inspect",Components.stack.caller.lineNumber+1,v]);
  inspect(v);
}
