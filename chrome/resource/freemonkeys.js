const EXPORTED_SYMBOLS = ["newMonkey"];

const hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
        .getService(Components.interfaces.nsIAppShellService)
	                .hiddenDOMWindow;


const Application = {}

Application.start = function (binary, profile) {
    
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(binary);
    if (!file.exists())
      throw "Unable to find application binary : "+file.path;
    
    dump("Start application at : "+file.path+"\n");
    
    // create an nsIProcess
    var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(file);
    
    // Run the process.
    var args = ["-no-remote","-jsconsole", "-console", "-profile", profile];
    process.run(false, args, args.length);
    
}

Application.connect = function (host, port, profile, callback) {
  
  // 1) Connect via a Puppet to the freshly launched mozilla application
  // This application need to have correctly installed the moz-puppet extension!
  Components.utils.import("resource://freemonkeys/moz-puppet.js");
  var puppet = new PuppetConnexion();
  puppet.connect(host,port,
    function(success,error) {
    try{
      
      if (!success) 
        return callback(false,{msg:error});
      
      dump("Connected!\n");
      
      var start=new Date().getTime();
      // 2) Wait for the lock file to be correctly set in the profile directory
      var profileFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      profileFile.initWithPath(profile);
      function waitForLockFile() {
        var lock=profileFile.clone();
        lock.append("parent.lock");
        if (!lock.exists()) {
          lock=profileFile.clone();
          lock.append("lock");
          if (lock.fileSizeOfLink<=0) {
            if (new Date().getTime()-start>20000) {
              hiddenWindow.clearInterval(interval);
              callback(false,{msg:"Unable to find session lock (symlink size : "+lock.fileSizeOfLink+")"});
            } else {
              hiddenWindow.setTimeout(waitForLockFile,200);
              return;
            }
          }
        }
        //if (!lock.exists())
        //	callback(false,{msg:"Unable to find session lock (ie parent.lock under win32) "+lock.path});
        dump("Ok wih the lock\n");
        nextStep();
      }
      
      // 3) Then use moz-puppet to retrieve a remote reference to the root library named "macro"
      function nextStep() {
        dump("try to get $macro\n");
        puppet.async.getValue(
          "macro",
          function (macro) {
            dump("got it\n");
            callback(true,{
              puppet : puppet, 
              macro : macro
            });
          });
      }
      
      hiddenWindow.setTimeout(waitForLockFile,200);  
    } catch(e) {
      callback(false,{msg:"got exception : "+e});
    }
    });
}


function Monkey(puppet, macro) {
  this.puppet = puppet;
  this.macro = macro;
  this.syncMacro = puppet.blocking.getValue("macro");
}

Monkey.prototype.execute = function (code, listener) {
  listener("execute","");
  var sandbox = Components.utils.Sandbox("http://localhost.localdomain.:0/");
  sandbox.fm = {
    getOneMonkey : function (firefox, profile) {
      if (firefox && firefox!="default") throw "Only handle one firefox, the default's one";
      if (profile && profile!="default") throw "Only handle one profile, the default's one";
      return ;
    }
  };
  sandbox.assert = {
    _assert : function (assert, args) {
      if (assert) {
        listener("assert-pass",{name:arguments.callee.caller.name,line:Components.stack.caller.caller.lineNumber+1});
      } else {
        listener("assert-fail",{name:arguments.callee.caller.name,line:Components.stack.caller.caller.lineNumber,args:args});
      }
    },
    isTrue : function isTrue(v) {
      this._assert((typeof v=="boolean" && v),[v]);
    },
    isFalse : function isFalse(v) {
      this._assert((typeof v=="boolean" && !v),[v]);
    },
    isEquals : function isEquals(a,b) {
      this._assert(a===b,[a,b]);
    },
    isDefined : function isDefined(v) {
      this._assert(v!=null,[v]);
    }
  };
  sandbox.log = {
    print : function (v) {
      listener("print",v);
    },
    debug : function (v) {
      listener("print",v);
    },
    inspect : function (v) {
      listener("inspect",v);
    }
  };
  try {
    var result = Components.utils.evalInSandbox(code, sandbox, "1.8", "your-test", 0);
    listener("all-ok",result);
  } catch(e) {
    listener("exception",{message:e.message,line:e.lineNumber,exception:e});
  }
}
Monkey.prototype.free = function () {
  this.syncMacro.quit();
  this.puppet.close();
}


var gPortNumber = 9000;

function newMonkey(binary, profile, callback) {
  this.port = gPortNumber++;
  Application.start(binary, profile);
  
  Application.connect("localhost", this.port, profile, 
    function (success, res) {
      if (success)
        callback(new Monkey(res.puppet, res.macro));
      else
        callback(null, res.msg);
    });
}