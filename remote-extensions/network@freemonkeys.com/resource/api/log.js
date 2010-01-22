var log = {};

log.debug = function (v) {
  ___listener("debug",Components.stack.caller.lineNumber+1,"("+typeof v+") "+v);
}

log.inspect = function (v) {
  //___listener("inspect",Components.stack.caller.lineNumber+1,v);
  inspect(v);
}
