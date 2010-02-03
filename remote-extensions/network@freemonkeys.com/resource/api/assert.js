var assert = {};

assert._asyncTest = function (args, callee, timeout1) {
  if (!timeout1) timeout1=2000;
  
  var success = false;
  
  var timer = hiddenWindow.setTimeout(function () {
    try {
      timer = null;
      if (!success)
        assert._assert(false, args, callee);
    } catch(e) {
      ___api_callback_exception(e, callee);
    }
  }, timeout1);
  
  return {
    pass : function () {
      hiddenWindow.clearTimeout(timer);
      timer = null;
      success = true;
      assert._assert(true, args, callee);
    },
    wait : function (timeout2) {
      if (!timeout2) timeout2=timeout1;
      
      var thread = Components.classes["@mozilla.org/thread-manager;1"]
            .getService()
            .currentThread;
      var start=new Date().getTime();
      while(!success && timer!=null && new Date().getTime()-start < timeout2) {
        thread.processNextEvent(true);
      }
      if (!success)
        assert._assert(false, args, Components.stack);
    }
  };
}

assert._assert = function (assert, args, callee) {
  if (!callee)
    callee=Components.stack.caller;
  var argsData = [];
  for(var i=0; i<args.length; i++) 
    argsData.push("("+typeof args[i]+") "+args[i]);
  var data = {
    name: callee.name,
    args : argsData.join(", ")
  };
  
  ___listener.execAsync([assert?"assert-pass":"assert-fail",callee.caller.lineNumber+1,data]);
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
