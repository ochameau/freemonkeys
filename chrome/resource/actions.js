const EXPORTED_SYMBOLS = ["Actions"];

Components.utils.import("resource://xul-macro/moz-puppet.js");

const hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
        .getService(Components.interfaces.nsIAppShellService)
	                .hiddenDOMWindow;

var Actions = {};

Actions.getLastSessionFile = function () {
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
         .getService(Components.interfaces.nsIProperties)
         .get("ProfD", Components.interfaces.nsIFile);
  file.append("lastSession.fmt");
  return file;
}
    
Actions.getDesktopResultFile = function () {
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
  .getService(Components.interfaces.nsIProperties)
  .get("Desk", Components.interfaces.nsIFile);
  file.append("results.fmr");
  return file;
}

Actions.loadFile = function (nsIFileOrFilePath) {
  
  var file = null;
  if (typeof nsIFileOrFilePath=="string") {
    file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(nsIFileOrFilePath);
  } else {
    file=nsIFileOrFilePath;
  }
    
  // Read session restore file
  var fileContents = "";
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
  createInstance(Components.interfaces.nsIFileInputStream);
  var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"].
  createInstance(Components.interfaces.nsIScriptableInputStream);
  fstream.init(file, -1, 0, 0);
  sstream.init(fstream); 
  var str = sstream.read(4096);
  while (str.length > 0) {
      fileContents += str;
      str = sstream.read(4096);
  }
  sstream.close();
  fstream.close();
  
  var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
  .createInstance(Components.interfaces.nsIJSON);
  return nativeJSON.decode(fileContents);
}
    
Actions.executeFile = function (testFile, resultFile, callback) {
  var list = Actions.loadFile(testFile);
	
  var testStart=new Date().getTime();
	
  var results=[];
  var i = 0;
  var finished = false;
  var failTimeout = null;
  function loop() {
    dump("loop : "+i+"\n");
    
    // Check recursion's end
    if (!list[i]) {
      dump("loop END\n");
      return end();
    } else if (finished) {
      return;
    }
    try {
      var testNumber = i++;
      var test = list[testNumber];
      
      // Prevent test blocked by buggy test with action timeout
      if (failTimeout) {
        hiddenWindow.clearTimeout(failTimeout);
        delete failTimeout;
      }
      hiddenWindow.setTimeout(function () {
            
            if (!results[testNumber])
            results[testNumber] = {
                action : test,
                result : { result:"FAIL", exception:{msg:"Internal error : "+e.toString()} }
              };
            end();
            
        },30000);
      
      // Launch test execution
      var actionStart=new Date().getTime();
      Actions.execute(test, 
		      function(success, result) {
            try {
              if (failTimeout) {
                hiddenWindow.clearTimeout(failTimeout);
                delete failTimeout;
              }
              if (!results[testNumber])
              results[testNumber] = {
                  action : test,
                  success : success,
                  time : new Date().getTime()-actionStart,
                  result : Actions.getCachedCopy(result)
                };
            } catch(e) {
              dump("execute one action error : "+e+"\n");
              if (!results[testNumber])
              results[testNumber] = {
                action : test,
                result : { result:"FAIL", exception:{msg:"Internal error : "+e.toString()} }
              };
              success = false;
            }
            if (success)
              hiddenWindow.setTimeout(loop,0);
            else
              end();
		      });
      
    } catch(e) {
      dump("execute one action error : "+e+"\n");
      if (!results[testNumber])
      results[testNumber] = {
        action : test,
            result : { result:"FAIL", exception:{msg:"Internal error : "+e.toString()} }
          };
      end();
    }
  }
  function end() {
    try {
      if (finished) return;
        finished = true;
      var test = {
        totalTime : new Date().getTime()-testStart,
        results : results
      };
      var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);  
      
      var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
      .createInstance(Components.interfaces.nsIJSON);
      
      var jsonString = nativeJSON.encode(test);
      dump("json generated\n");
      //dump(jsonString+"\n");
      
      foStream.init(resultFile, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
      foStream.write(jsonString,jsonString.length);
      foStream.close();
      callback();
      dump("json writed\n");
    } catch(e) {
      dump("Error while saving results file : "+e+"\n");
    }
  }
  loop();
}

Actions._browsers = {};

Actions.getCachedCopy = function (obj,maxDepth,depth,alreadyIn) {
  if (!depth) {depth=0;}
  if (!maxDepth) maxDepth=3;
  if (!alreadyIn) alreadyIn=[];
  if (alreadyIn.indexOf(obj)!=-1) {
      return null;
  }
  if (typeof obj=="object")
      alreadyIn.push(obj);
  if (obj && typeof obj=="object" && obj.splice && obj.pop && obj.push) {
    var o=[];
    for(var i=0; i<obj.length; i++)
      o.push(Actions.getCachedCopy(obj[i],maxDepth,depth+1));
    return o;
  } else if (typeof obj=="object") {
    var o={};
    for(var i in obj)
      o[i]=Actions.getCachedCopy(obj[i],maxDepth,depth+1);
    return o;
  }
  return obj;
}

Actions.selectNode = function (browserId, callback) {
  
  return Actions.getCachedCopy(Actions._browsers[browserId].macro.selectNode(callback));
  
}

Actions.getElementWithXPath = function (browserId,a,b) {
  
  return Actions.getCachedCopy(Actions._browsers[browserId].macro.getXPathElement(a,b));
  
}

Actions.quit = function (browserId) {
  
  for(var id in Actions._browsers) {
    Actions._browsers[id].macro.quit();
    Actions._browsers[id].puppet.close();
    delete Actions._browsers[id];
  }
  
}

Actions.closeSession = function (browserId) {
  
  Actions._browsers[browserId].macro.quit();
  Actions._browsers[browserId].puppet.close();
  delete Actions._browsers[browserId];
  
}

Actions.getFramesList = function (browserId, winInfo) {
  //return (Actions._browsers[browserId].macro.getFramesList());
    return Actions.getCachedCopy(Actions._browsers[browserId].macro.getFramesList(winInfo));
  
}

Actions.getWindowsList = function (browserId) {
  
  return Actions._browsers[browserId].macro.getWindowsList();
  
}

Actions.getActionDescription = function (action) {
  var str = action.type;
  var t=[];
  for(var i in action.content) {
    if (typeof action.content[i]=="object")
      t.push(action.content[i].toSource());
    else
      t.push(action.content[i]);
  }
  return str+"("+t.join(", ")+")";
}

Actions.execute = function (action, callback) {
  var id=action.sessionId;
  var type=action.type;
  if (type=="firefox-session") {
    var session = action.content;
    
    if (Actions._browsers[id])
      return callback(true,null);
    
    try {
    var profile = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("resource:app", Components.interfaces.nsIFile);
    profile.append("profiles");
    profile.append(session.profile);
    
    if (!profile.exists())
        return callback(false,{msg:"Unable to found this profile : "+profile.path});
    
    Firefox.start(session.binary,profile.path);
    
    var host = "localhost";
    var port = session.port;
    
    /*
    var background = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
    var main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
    
    var mainThread = function(threadID, result) {
      this.threadID = threadID;
      this.result = result;
    };

    mainThread.prototype = {
      run: function() {
        try {
          // This is where we react to the completion of the working thread.
          alert('Thread ' + this.threadID + ' finished with result: ' + this.result);
        } catch(err) {
          Components.utils.reportError(err);
        }
      },
      
      QueryInterface: function(iid) {
        if (iid.equals(Components.interfaces.nsIRunnable) ||
            iid.equals(Components.interfaces.nsISupports)) {
                return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
      }
    };
    
    var workingThread = function(threadID, number) {
      this.threadID = threadID;
      this.number = number;
      this.result = 0;
    };

    workingThread.prototype = {
      run: function() {
        try {
          // This is where the working thread does its processing work.
          
          for (var i = 0; i<= this.number; i++) {
            this.result += i;
          }
          
          // When it's done, call back to the main thread to let it know
          // we're finished.
          
          main.dispatch(new mainThread(this.threadID, this.result),
            background.DISPATCH_NORMAL);
        } catch(err) {
          Components.utils.reportError(err);
        }
      },
      
      QueryInterface: function(iid) {
        if (iid.equals(Components.interfaces.nsIRunnable) ||
            iid.equals(Components.interfaces.nsISupports)) {
                return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
      }
    };

    background.dispatch(new workingThread(1, 5000000), background.DISPATCH_NORMAL);
    */
    
    var puppet = new PuppetConnexion();
    puppet.connect(host,port,
		   function(success,error) {

		       try{
			   
		       if (!success) 
            return callback(false,{msg:error});
    
    dump("Connected!\n");
    
    
    var start=new Date().getTime();
    var interval = hiddenWindow.setInterval(function () {
      
      var lock=profile.clone();
      lock.append("parent.lock");
      if (!lock.exists()) {
        lock=profile.clone();
        lock.append("lock");
        if (lock.fileSizeOfLink<=0) {
          if (new Date().getTime()-start>20000) {
            hiddenWindow.clearInterval(interval);
            callback(false,{msg:"Unable to find session lock (symlink size : "+lock.fileSizeOfLink+")"});
          } else {
            return;
          }
        }
      }
      //if (!lock.exists())
      //	throw "Unable to find session lock (ie parent.lock under win32) "+lock.path;
      
      hiddenWindow.clearInterval(interval);
      
      puppet.async.getValue("macro",function (macro) {
          dump("Create browser "+id+" --> "+macro+"\n");
          Actions._browsers[id] = {
              puppet : puppet, 
              asyncmacro : macro, 
              macro : puppet.blocking.getValue("macro"),
              lock : lock.path
          };
          callback(true,null);
      });
      
    }, 200);
  
    
    /*
    var root = puppet.blocking.getValue("root");
    root.callback(function () {dump("OKKKKKKKKKKKKKKK\n");});
    
    return;

    asyncPuppet.getValue("root",
      function (root) {
        
        root.execFunction("c",
          [1,2,3],
          function (cReturn) {
            
            root.getAttribute("d",
              function (d) {
                
                d.execFunction("g",
                  [root],
                  function (gReturn1) {
                    d.execFunction("g",
                      [{a:"B"}],
                      function (gReturn2) {
                        //var gReturn2=null;
                      
                        inspect({c:cReturn, g1:gReturn1, g2:gReturn2});
                        
                      }
                    );
                  }
                );
              }
            );
            
            
            
          }
        );
        
      }
    );
    */
    
    /*
    inspect(macro.getFramesList());
    hiddenWindow.setTimeout(function () {
      inspect(macro.getFramesList());
    },3000);
    */
    
    
    //var root = blockingPuppet.getValue("root");
    
    //inspect(root);
    /*
    inspect({
      root : root,
      c : root.c(1,2,3),
      g1 : root.d.g(root),
      g2 : root.d.g({a:"B"})
    });
    */
		       } catch(e) {
              callback(false,{msg:e.toString()});
		       }

        });
    } catch(e) {
      return callback(false,{msg:e.toString()});
    }
    
  } else if (type=="close-session") {
    var start=new Date().getTime();
    var lockPath=Actions._browsers[id].lock;
    try {
      Actions.quit(id);
    } catch(e) {}
    var interval = hiddenWindow.setInterval(function () {
      try {
        if (new Date().getTime()-start>20000) {
          callback(false,{msg:"Close timeout"});
          hiddenWindow.clearInterval(interval);
          return;
        }
        var lock = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        lock.initWithPath(lockPath);
        // Linux case 'lock' symlink : 
        if (lock.isSymlink() && lock.fileSizeOfLink>0)
          return;
        // Windows case 'parent.lock' regular file : 
        if (!lock.isSymlink() && lock.exists())
          return;
        callback(true,null);
        hiddenWindow.clearInterval(interval);
      } catch(e) {
        dump("watch lock ex : "+e+"\n");
      }
    }, 100);
    
  } else {
    var content = action.content;
    var browser=Actions._browsers[id];
    if (!browser) {
      return callback(false, {msg:"Unable to found browser session ("+id+")"});
    }
    var called=false;
    try {
      var fun=type.replace(/-/g,"_");
      
      /*
      browser.asyncmacro.execObjectFunction(fun,
        [content,
          function (a,b) {
            dump("callback\n");
            if (!called) {
              called=true;
              callback(a,b);
            }
          }
        ],
        function () {
          dump("Ok\n");
        });
      */
      
      
      browser.macro[fun].apply(browser.macro,[content,
          function (a,b) {
            if (!called) {
              called=true;
              callback(a,b);
            }
          }
        ]);
      
    } catch(e) {
      dump("Get action exception for "+Actions.getActionDescription(action)+"\n"+e+"\n");
      if (!called) {
        called=true;
        return callback(false, {msg:e.toString()});
      }
    }
  }
}





var Firefox = {}

Firefox.start = function (binary, profile) {
    
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(binary);
    if (!file.exists())
      throw "Unable to find firefox binary : "+file.path;
    
    dump("Start firefox at : "+file.path+"\n");
    
    // create an nsIProcess
    var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(file);
    
    // Run the process.
    var args = ["-no-remote","-jsconsole", "-console", "-profile", profile];
    process.run(false, args, args.length);
    
}

