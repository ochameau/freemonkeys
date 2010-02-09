var wait = {};

// Internal API, used to wait, doesn't display error.
wait._forDefined = function(fun) {
  var start = new Date().getTime();
  
  var result;
  var exception = null;
  
  function wait() {
    try {
      result = fun();
    } catch(e) {
      exception = e;
    }
  }
  
  var timeoutInterval = setInterval(wait, 100);
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
  
  while((typeof result=="undefined" || result==null) && new Date().getTime()-start < 10000) {
    thread.processNextEvent(true);
  }
  
  clearInterval(timeoutInterval);
  
  if (typeof result!="undefined" && result!=null)
    return result;
  if (exception)
    throw new Error(exception.message?exception.message:exception);
  else
    throw new Error("waitForDefined");
}

wait._assert = function (fun, args) {
  var start = new Date().getTime();
  
  var result;
  var exception = null;
  var argsValues = [];
  
  function wait() {
    try {
      argsValues = [];
      for(var i=0; i<args.length; i++) {
        if (typeof args[i]=="function")
          argsValues[i] = args[i].apply(null,[]);
        else
          argsValues[i] = args[i];
      }
      result = fun.apply(null,argsValues);
    } catch(e) {
      exception = e;
    }
  }
  
  var timeoutInterval = setInterval(wait, 100);
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
  
  while((typeof result!="boolean" || result===false) && new Date().getTime()-start < 2000) {
    thread.processNextEvent(true);
  }
  
  clearInterval(timeoutInterval);
  
  if (exception)
    throw new Error(exception.message?exception.message:exception);
  
  var success = typeof result=="boolean" && result===true;
  
  var argsData = [];
  for(var i=0; i<argsValues.length; i++) 
    argsData.push("("+typeof argsValues[i]+") "+argsValues[i]);
  var data = {
    name: arguments.callee.caller.name,
    args : argsData.join(", ")
  };
  
  ___listener.execAsync([success?"assert-pass":"assert-fail",Components.stack.caller.caller.lineNumber+1,data]);
}

wait.setTimeout = function (f,t) {
  return hiddenWindow.setTimeout(f,t?t:2000);
}

wait.waitForSuccess = function waitForSuccess(fun) {
  
}

wait.during = function wait(ms) {
  var start = new Date().getTime();
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
  
  while((typeof result=="undefined" || result==null) && new Date().getTime()-start < ms) {
    thread.processNextEvent(true);
  }
}

wait.forTrue = function forTrue(v) {
  wait._assert(function (a) {
    return (typeof a=="boolean" && a);
  },[v]);
}

wait.forFalse = function forFalse(v) {
  
  wait._assert(function (a) {
    return (typeof v=="boolean" && !v)
  },[v]);
}

wait.forEquals = function forEquals(a,b) {
  wait._assert(function (a,b) {
    return a===b;
  },[a,b]);
}

wait.forDefined = function forDefined(v) {
  wait._assert(function (a) {
    return a!=null;
  },[v]);
}


