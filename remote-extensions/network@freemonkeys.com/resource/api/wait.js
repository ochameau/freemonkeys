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
  
  function executeOnce_ThrowAsserts() {
    exception = null;
    try {
      if (result) return;
      argsValues = [];
      for(var i=0; i<args.length; i++) {
        if (typeof args[i]=="function")
          argsValues[i] = args[i].apply(null,[]);
        else
          argsValues[i] = args[i];
      }
      result = fun.apply(null,argsValues);
      if (result) {
        clearInterval(timeoutInterval);
        timeoutInterval = null;
      }
    } catch(e) {
      exception = e;
    }
  }
  
  var timeoutInterval = setInterval(executeOnce_ThrowAsserts, 100);
  
  var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
  
  while((typeof result!="boolean" || result===false) && new Date().getTime()-start < 2000) {
    thread.processNextEvent(true);
  }
  
  if (timeoutInterval)
    clearInterval(timeoutInterval);
  
  if (exception)
    throw exception;
  
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

// Wait for an anonymous function passed in
// to correctly pass all asserts called within!
wait.forSuccess = function forSuccess(fun) {
  try {
    wait._assert(function (a) {
      return true;
    },[fun]);
    ___listener.execAsync(["assert-pass",Components.stack.caller.lineNumber+1,{name:"forSuccess",args:""}]);
  } catch(e) {
    if (e.assert) {
      ___listener.execAsync(["assert-fail",e.line,e.data]);
      ___listener.execAsync(["assert-fail",Components.stack.caller.lineNumber+1,{name:"forSuccess",args:""}]);
    } else {
      ___api_exception(e);
    }
  }
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
    return (typeof a=="boolean" && !a)
  },[v]);
}

wait.forEquals = function forEquals(a,b) {
  wait._assert(function (x,y) {
    return x===y;
  },[a,b]);
}

wait.forDefined = function forDefined(v) {
  wait._assert(function (a) {
    return a!=null;
  },[v]);
}


