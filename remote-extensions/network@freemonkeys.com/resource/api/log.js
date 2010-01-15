var log = {};

log.print = function (v) {
  listener("print",Components.stack.caller.lineNumber+1,v);
}

log.debug = function (v) {
  listener("print",Components.stack.caller.lineNumber+1,v);
}

log.inspect = function (v) {
  //listener("inspect",Components.stack.caller.lineNumber+1,v);
  inspect(v);
}
