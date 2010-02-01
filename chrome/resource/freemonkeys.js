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
      if (m.temporaryProfile) {
        hiddenWindow.setTimeout(function () {
          m.temporaryProfile.remove(true);
        }, 3000);
      }
    }
  }
}

FreemonkeysZoo.free = function (application, profilePath, useEmptyProfile) {
  var profileKey = useEmptyProfile ? "empty" : profilePath;
  var monkey = this._pens[application][profileKey];
  if (!monkey) return;
  monkey.syncMacro.quit();
  monkey.puppet.close();
  delete this._pens[application][profileKey];
  if (monkey.temporaryProfile) {
    hiddenWindow.setTimeout(function () {
      monkey.temporaryProfile.remove(true);
    }, 3000);
  }
}

FreemonkeysZoo.selectNode = function (application, profile, onClick) {
  var monkey = FreemonkeysZoo._pens[application]?FreemonkeysZoo._pens[application][profile]:null;
  if (!monkey || !monkey.puppet.isAlive()) return false;
  monkey.asyncMacro.execObjectFunction(
      "selectNode",
      [onClick],
      function (res) {}
    );
  return true;
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

FreemonkeysZoo.prepareProfile = function (profile, doACopy, defaultPrefs) {
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
  
  // Synchronize moz-puppet component
  var fmNetworkDir = extensionsSrcDir.clone();
  fmNetworkDir.append("network@freemonkeys.com");
  var fmNetworkResourcesDir = fmNetworkDir.clone();
  fmNetworkResourcesDir.append("resource");
  var mozPuppet = Components.classes["@mozilla.org/file/directory_service;1"].  
                      getService(Components.interfaces.nsIProperties).  
                      get("resource:app", Components.interfaces.nsIFile);
  mozPuppet.append("chrome");
  mozPuppet.append("resource");
  mozPuppet.append("moz-puppet.js");
  var dstMozPuppet = fmNetworkResourcesDir.clone();
  dstMozPuppet.append("moz-puppet.js");
  if (dstMozPuppet.exists())
    dstMozPuppet.remove(false);
  mozPuppet.copyTo(fmNetworkResourcesDir,"moz-puppet.js");
  
  // Set default prefs 
  if (typeof defaultPrefs=="string" && defaultPrefs.length>0) {
    var prefsFile = fmNetworkDir.clone();
    prefsFile.append("defaults");
    if (!prefsFile.exists())
      prefsFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
    prefsFile.append("preferences");
    if (!prefsFile.exists())
      prefsFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
    prefsFile.append("remote-prefs.js");
    FreemonkeysZoo.writeToFile(prefsFile, defaultPrefs);
  }
}

var gPortNumber = 9000;
FreemonkeysZoo.getMonkey = function (application, profilePath, useEmptyProfile, copyProfile, defaultPrefs, listener, onMonkeyAlive) {
  var profileKey = useEmptyProfile ? "empty" : profilePath;
  if (FreemonkeysZoo._pens[application] && FreemonkeysZoo._pens[application][profileKey]) {
    if (FreemonkeysZoo._pens[application][profileKey].puppet.isAlive())
      return onMonkeyAlive(FreemonkeysZoo._pens[application][profileKey]);
    else
      delete FreemonkeysZoo._pens[application][profileKey];
  }
  
  listener("monkey",-1,"launch");
  var port = gPortNumber++;
  
  FreemonkeysZoo.prepareProfile(profilePath, copyProfile, defaultPrefs);
  Application.start(application, profilePath, port);
  
  Application.connect("localhost", port, profilePath, 
    function (success, res) {
      if (success) {
        if (!FreemonkeysZoo._pens[application])
          FreemonkeysZoo._pens[application] = {};
        FreemonkeysZoo._pens[application][profileKey] = res;
        onMonkeyAlive(res);
      } else {
        error = res.msg;
        listener("internal-exception",-1,"Error during monkey creation : "+res.msg);
      }
    });
  
}

FreemonkeysZoo.createEmptyProfile = function () {
  var file = Components.classes["@mozilla.org/file/directory_service;1"].
                       getService(Components.interfaces.nsIProperties).
                       get("TmpD", Components.interfaces.nsIFile);
  file.append("tmp-freemonkeys-profile");
  file.createUnique(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
  return file;
}

FreemonkeysZoo.runJetpack = function (application, profilePath, copyProfile, defaultPrefs, resourcesPaths, jetpackPath, listener) {
  var temporaryProfile = null;
  var useEmptyProfile = !profile;
  if (useEmptyProfile) {
    temporaryProfile = FreemonkeysZoo.createEmptyProfile();
    profile = temporaryProfile.path;
  }
  
  FreemonkeysZoo.getMonkey(application, profilePath, useEmptyProfile, copyProfile, defaultPrefs, listener, 
    function (monkey) {
      monkey.temporaryProfile = temporaryProfile;
      monkey.asyncMacro.execObjectFunction(
          "jetpackExecute",
          [resourcesPaths, jetpackPath, listener],
          function (res) {
            Components.utils.reportError("run jetpack ok");
          }
        );
    });
  
}

FreemonkeysZoo.execute = function (application, profilePath, copyProfile, defaultPrefs, code, listener) {
  var temporaryProfile = null;
  var useEmptyProfile = !profilePath;
  if (useEmptyProfile) {
    temporaryProfile = FreemonkeysZoo.createEmptyProfile();
    profilePath = temporaryProfile.path;
  }
  
  FreemonkeysZoo.getMonkey(application, profilePath, useEmptyProfile, copyProfile, defaultPrefs, listener, 
    function (monkey) {
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