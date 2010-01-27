const EXPORTED_SYMBOLS=["jetpackRunner"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const jetpackRunner = {};

function ensureIsDir(dir) {
  if (!(dir.exists() && dir.isDirectory))
    throw new Error("directory not found: " + dir.path);
}

function getDir(path) {
  var dir = Cc['@mozilla.org/file/local;1']
            .createInstance(Ci.nsILocalFile);
  dir.initWithPath(path);
  ensureIsDir(dir);
  return dir;
}

jetpackRunner.run = function (resourcesPaths, jetpackPath) {
  var componentsPaths = [];
  inspect([resourcesPaths,jetpackPath]);
  var rootPaths = [];
  
  // Register components (xpcom)
  var compMgr = Components.manager;
  compMgr = compMgr.QueryInterface(Ci.nsIComponentRegistrar);
  for each (let dirPath in componentsPaths) {
    let dir = getDir(dirPath);
    compMgr.autoRegister(dir);
  }

  // Register resources directories (cuddlefish libs and jetpack capabilities)
  var ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  var resProt = ioService.getProtocolHandler("resource")
                .QueryInterface(Ci.nsIResProtocolHandler);
  for (let name in resourcesPaths) {
    let path = resourcesPaths[name];
    let dir = getDir(path);
    let dirUri = ioService.newFileURI(dir);
    resProt.setSubstitution(name, dirUri);
    rootPaths.push("resource://"+name+"/");
  }
  
  var jp=getDir(jetpackPath);
  let dirUri = ioService.newFileURI(jp);
  resProt.setSubstitution("test-jetpack", dirUri);
  
  rootPaths.push("resource://cuddlefish-lib/");
  
  var jsm = {};
  Components.utils.import("resource://cuddlefish-lib/cuddlefish.js", jsm);
  var loader = new jsm.Loader({rootPaths: rootPaths,
                               globals: { }
                              });
  /*
  var options = {
    metadata : {
      "test-jetpack": {
        name: "Test jetpack",
        keyworkds: ["contains-a-jetpack"]
      }
    },
    packageData : {
      "test-jetpack": "resource://test-jetpack/"
    }
  };
  var program = loader.require("simple-jetpack-runner");
  program.main(options);
  */
  
  var jetpack = loader.require("jetpack");
  var jp = new jetpack.Jetpack("resource://test-jetpack/");
  jp.execute();
  
  var hiddenWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
         .getService(Components.interfaces.nsIAppShellService)
         .hiddenDOMWindow;

  hiddenWindow.setTimeout(function () {
    loader.unload();
  },5000);
}