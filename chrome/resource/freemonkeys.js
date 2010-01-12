const EXPORTED_SYMBOLS = ["FreemonkeysZoo"];

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
              asyncMacro : macro,
              syncMacro : puppet.blocking.getValue("macro")
            });
          });
      }
      
      hiddenWindow.setTimeout(waitForLockFile,200);  
    } catch(e) {
      callback(false,{msg:"got exception : "+e});
    }
    });
}

function MonkeyTab(gBrowser, tab) {
  var linkedBrowser = tab.linkedBrowser;
  this.open = function (url) {
    linkedBrowser.loadURI(url,null,null);
  }
  this.close = function () {
    gBrowser.removeTab(tab);
  }
  this.back = function () {
    linkedBrowser.webNavigation.goBack();
  }
  this.forward = function () {
    linkedBrowser.webNavigation.goForward();
  }
  this.getInternal = function () {
    return tab;
  }
}

function MonkeyWindow(win) {
  this.win = win;
  var gBrowser = win.gBrowser;
  
  this.tabs = {
    new : function (url, doNotSelect) {
      if (!url) url="about:blank";
      var tab = gBrowser.addTab(url);
      if (!doNotSelect)
        gBrowser.selectedTab = tab;
      return new MonkeyTab(gBrowser, tab);
    },
    get current() {
      return new MonkeyTab(gBrowser, gBrowser.selectedTab);
    }
  }
}

function Monkey(puppet, macro, listener) {
  this.puppet = puppet;
  this.macro = macro;
  var syncMacro = puppet.blocking.getValue("macro");
  this.syncMacro = syncMacro;
  
  this.windows = {
    get : function (id, name, title, order) {
      // Remote call
      var list = syncMacro.getWindows();
      
      // Sort the retrieved list
      if (!order || order == Monkey.WINDOWS_ORDER_BY_ZORDER) {
        list.sort(function (a,b) {return a.zindex<b.zindex;});
      }
      
      // Remove work info and return only windows references
      var result = [];
      for(var i=0; i<list.length; i++) {
        result.push(new MonkeyWindow(list[i].win));
      }
      
      return result;
      
    }
  }
}
Monkey.WINDOWS_ORDER_BY_ZORDER = 1;
Monkey.WINDOWS_ORDER_BY_CREATION_DATE = 2;


Monkey.prototype.free = function () {
  this.syncMacro.quit();
  this.puppet.close();
}


const FreemonkeysZoo = {};

FreemonkeysZoo._pens = {};

FreemonkeysZoo.getLivingMonkeys = function () {
  var l = [];
  for(var i in this._pens) {
    for(var j in this._pens[i]) {
      l.push(this._pens[i][j]);
    }
  }
  return l;
}

FreemonkeysZoo.freeThemAll = function () {
  for(var i in this._pens) {
    for(var j in this._pens[i]) {
      var m = this._pens[i][j];
      m.syncMacro.quit();
      m.puppet.close();
    }
  }
}

FreemonkeysZoo.free = function (application, profile) {
  var monkey = this._pens[application][profile];
  if (!monkey) return;
  monkey.syncMacro.quit();
  monkey.puppet.close();
  delete this._pens[application][profile];
}

FreemonkeysZoo.selectNode = function (application, profile, onClick) {
  var monkey = FreemonkeysZoo._pens[application][profile];
  if (!monkey) return;
  monkey.asyncMacro.execObjectFunction(
      "selectNode",
      [onClick],
      function (res) {}
    );
}

var gPortNumber = 9000;
FreemonkeysZoo.execute = function (application, profile, code, listener) {
  
  function getMonkey(onMonkeyAlive) {
    if (FreemonkeysZoo._pens[application] && FreemonkeysZoo._pens[application][profile])
      return onMonkeyAlive(FreemonkeysZoo._pens[application][profile]);
    
    listener("monkey",-1,"start a new one");
    
    Application.start(application, profile);
    
    Application.connect("localhost", gPortNumber, profile, 
      function (success, res) {
        if (success) {
          if (!FreemonkeysZoo._pens[application])
            FreemonkeysZoo._pens[application] = {};
          FreemonkeysZoo._pens[application][profile] = res;
          onMonkeyAlive(res);
        } else {
          error = res.msg;
          listener("error",-1,"Error during monkey creation : "+res.msg);
        }
      });
    
    // TODO: add timeout
    //listener("error",-1,"Monkey creation timeout !?");
  }
  
  getMonkey(function (monkey) {
    listener("monkey",-1,"ready");
    monkey.asyncMacro.execObjectFunction(
        "execute",
        [code, listener],
        function (res) {
          listener("debug",-1,"distant execute returned.");
        }
      );
  });
}