const EXPORTED_SYMBOLS = ["FreemonkeysZoo"];

const hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
        .getService(Components.interfaces.nsIAppShellService)
	                .hiddenDOMWindow;


const Application = {}

Application.start = function (binary, profile, port) {
    
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(binary);
    if (!file.exists())
      throw "Unable to find application binary : "+file.path;
    
    dump("Start application at : "+file.path+"\n");
    
    // create an nsIProcess
    var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(file);
    
    // Run the process.
    var args = ["-no-remote","-jsconsole", "-console", "-profile", profile, "-fmport", port];
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

FreemonkeysZoo.writeToFile = function (file, data) {
  // file is nsIFile, data is a string
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
                           createInstance(Components.interfaces.nsIFileOutputStream);

  // use 0x02 | 0x10 to open file for appending.
  foStream.init(file, 0x02 | 0x08 | 0x20, 0777, 0); 
  // write, create, truncate
  // In a c file operation, we have no need to set file mode with or operation,
  // directly using "r" or "w" usually.

  // if you are sure there will never ever be any non-ascii text in data you can 
  // also call foStream.writeData directly
  var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
                            createInstance(Components.interfaces.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(data);
  converter.close(); // this closes foStream
}

FreemonkeysZoo.prepareProfile = function (profile, doACopy) {
  // Init profile, check if it's here and valid
  var profileFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  try {
    profileFile.initWithPath(profile);
  } catch(e) {
    throw new Error("Profile directory is not valid : "+e);
  }
  try {
    if (!profileFile.exists())
      profileFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  } catch(e) {
    throw new Error("Profile directory doesn't exist, nor are able to create it empty : "+e);
  }
  
  // Do a copy of the profile to keep it clean
  // and always have the same one for each test execution!
  if (doACopy) {
    var dstFile = Components.classes["@mozilla.org/file/directory_service;1"].  
                      getService(Components.interfaces.nsIProperties).  
                      get("TmpD", Components.interfaces.nsIFile);
    try {
      dstFile.append("profile-copy");  
      if (dstFile.exists())
        dstFile.remove(true);
      profileFile.copyTo(dstFile.parent(),"profile-copy");
      profileFile = dstFile;
    } catch(e) {
      throw new Error("Unable to create a temporary profile directory and copy source profile into it : "+e);
    }
    if (!profileFile.exists())
      throw new Error("Unable to copy profile to a temporary one!");
  }
  
  // Install all extensions from the $XULRUNNER_APP_DIR/remote-extensions/ into profile by write text link
  var extensionsSrcDir = Components.classes["@mozilla.org/file/directory_service;1"].  
                      getService(Components.interfaces.nsIProperties).  
                      get("resource:app", Components.interfaces.nsIFile);
  extensionsSrcDir.append("remote-extensions");
  
  var extensionsDstDir = profileFile.clone();
  extensionsDstDir.append("extensions");
  if (!extensionsDstDir.exists())
    extensionsDstDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  
  var entries = extensionsSrcDir.directoryEntries;  
  var array = [];  
  while(entries.hasMoreElements()) {  
    var srcExt = entries.getNext();  
    srcExt.QueryInterface(Components.interfaces.nsIFile);  
    var dstExt = extensionsDstDir.clone();
    dstExt.append( srcExt.leafName );
    if (dstExt.exists())
      dstExt.remove(false);
    FreemonkeysZoo.writeToFile(dstExt, srcExt.path);
  }
  
}



var gPortNumber = 9000;
FreemonkeysZoo.execute = function (application, profile, code, listener) {
  
  function getMonkey(onMonkeyAlive) {
    if (FreemonkeysZoo._pens[application] && FreemonkeysZoo._pens[application][profile])
      return onMonkeyAlive(FreemonkeysZoo._pens[application][profile]);
    
    listener("monkey",-1,"launch");
    var port = gPortNumber++;
    
    Application.start(application, profile, port);
    
    Application.connect("localhost", port, profile, 
      function (success, res) {
        if (success) {
          if (!FreemonkeysZoo._pens[application])
            FreemonkeysZoo._pens[application] = {};
          FreemonkeysZoo._pens[application][profile] = res;
          onMonkeyAlive(res);
        } else {
          error = res.msg;
          listener("internal-exception",-1,"Error during monkey creation : "+res.msg);
        }
      });
    
  }
  
  FreemonkeysZoo.prepareProfile(profile);
  getMonkey(function (monkey) {
    listener("monkey",-1,"ready");
    monkey.asyncMacro.execObjectFunction(
        "execute",
        [code, listener],
        function (res) {
          listener("monkey",-1,"return");
        }
      );
  });
}