const gFMJetpackPackages = {};

gFMJetpackPackages.readDir = function (dir) {
  var entries = dir.directoryEntries;  
  var array = [];  
  while(entries.hasMoreElements())  
  {  
    var entry = entries.getNext();  
    entry.QueryInterface(Components.interfaces.nsIFile);  
    if (entry.leafName[0]==".") continue;
    array.push(entry);  
  }
  return array;
}

gFMJetpackPackages.findFile = function (dir, filename) {
  var entries = dir.directoryEntries;  
  var array = [];  
  while(entries.hasMoreElements())  
  {  
    var entry = entries.getNext();  
    entry.QueryInterface(Components.interfaces.nsIFile);
    //Components.utils.reportError(entry.leafName+"=="+filename);
    if (entry.leafName==filename) return entry;
  }
  return null;
}

gFMJetpackPackages.getFile = function (path) {
  var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(path);
  if (!file.exists())
    throw new Error(path+" doesn't exists");
  return file;
}
gFMJetpackPackages.getFileContent = function (file) {
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
  return fileContents;
}

gFMJetpackPackages.parseManifest = function (dir, json) {
  if (!json.name)
    json.name = dir.leafName;
  
  function apply_default_dir(name) {
    if (json[name]) return;
    var subdir = dir.clone();
    subdir.append(name);
    if (subdir.exists() && subdir.isDirectory())
      json[name] = [name];
  }
  for each(let name in ['lib', 'tests', 'data', 'packages']) apply_default_dir(name);
  
  function normalize(name) {
    if (typeof json[name]=="string")
      json[name] = [json[name]];
  }
  for each(let name in ['lib', 'tests', 'dependencies', 'packages']) normalize(name);
  
  json.root_dir = dir;
  
  return json;
}

gFMJetpackPackages.getPackages = function (rootPath) {
  var packages = {};
  
  function parseDir(dir) {
    var dirs = gFMJetpackPackages.readDir(dir);
    for(var i=0; i<dirs.length; i++) {
      var packageDir = dirs[i];
      var packageManifest = packageDir.clone();
      packageManifest.append("package.json");
      if (!packageManifest.exists()) continue;
      var json = JSON.parse(gFMJetpackPackages.getFileContent(packageManifest));
      var manifest = gFMJetpackPackages.parseManifest(packageDir,json);
      if (packages[manifest.name])
        throw new Error("Duplicate package '"+manifest.name+"' : \n - "+manifest.root_dir.path+" - "+packages[manifest.name].root_dir.path);
      packages[manifest.name] = manifest;
      if (manifest.packages) {
        for each (let packageDirName in manifest.packages) {
          var packageFile = manifest.root_dir.clone();
          packageFile.append(packageDirName);
          parseDir(packageFile);
        }
      }
    }
  }
  
  parseDir(gFMJetpackPackages.getFile(rootPath));
  
  return packages;
}


gFMJetpackPackages.getJetpackManifest = function (jpPath) {
  let jpDir = this.getFile(jpPath);
  jpDir.append("manifest.json");
  if (!jpDir)
    throw new Error("Unable to found jetpack's manifest.json file at : "+jpPath);
  var manifest = JSON.parse(gFMJetpackPackages.getFileContent(jpDir));
  return manifest;
}

gFMJetpackPackages.getRootPathsFor = function (availablePackages, jetpackManifest) {
  var usedPackages = {};
  function usePackage(name, loadPath) {
    if (usedPackages[name]) return;
    var packageManifest = availablePackages[name];
    if (!packageManifest)
      throw new Error("Unable to found package '"+name+"' (dependencies path:"+loadPath.join(', ')+")");
    usedPackages[name] = packageManifest;
    if (!packageManifest.dependencies) return;
    for each(let depName in packageManifest.dependencies) {
      usePackage(depName, loadPath.concat(["package:"+name]))
    }
  }
  function useCapabilities(name) {
    let moduleName = "jetpack-cap-factory-"+name+".js";
    for each(let packageManifest in availablePackages) {
      if (!packageManifest.lib || packageManifest.lib.length==0) continue;
      for each(let libdirName in packageManifest.lib) {
        let libdir = packageManifest.root_dir.clone();
        libdir.append(libdirName);
        //Components.utils.reportError("### "+libdir.path);
        var moduleFile = gFMJetpackPackages.findFile(libdir, moduleName);
        if (moduleFile) {
          usePackage(packageManifest.name, ["your-jetpack","capability:"+name]);
          return;
        }
      }
    }
    throw new Error("Unable to find module for your jetpack capability '"+name+"'");
  }
  for(let name in jetpackManifest.capabilities) {
    useCapabilities(name, ["your-jetpack"]);
  }
  return usedPackages;
}


gFMJetpackPackages.computeResourcesPaths = function (packages) {
  var paths = {};
  function includeDir(packageManifest, dirname) {
    var dir = packageManifest.root_dir.clone();
    dir.append(dirname);
    if (!dir.exists())
      throw new Error("Directory '"+dirname+"' doesn't exists. It's needed to load package: '"+packageManifest.name+"'");
    paths[packageManifest.name+"-"+dirname] = dir.path;
  }
  for each(let packageManifest in packages) {
    for each(let attribute in ['lib','data','tests']) {
      for each(let dirname in packageManifest[attribute]) {
        includeDir(packageManifest, dirname);
      }
    }
  }
  return paths;
}

gFMJetpackPackages.run = function () {
  var packagesPath = "C:\\cfx\\packages"
  var jetpackPath = "C:\\my-jetpack";
  var resourcesPaths = {};
  var jetpackManifest = {};
  var availablePackages = {};
  var usedPackages = {};
  try {
    jetpackManifest = gFMJetpackPackages.getJetpackManifest(jetpackPath);
    availablePackages = gFMJetpackPackages.getPackages(packagesPath);
    usedPackages = gFMJetpackPackages.getRootPathsFor(availablePackages, jetpackManifest);
    resourcesPaths = gFMJetpackPackages.computeResourcesPaths(usedPackages);
  } catch(e) {Components.utils.reportError(e+"\n"+e.stack);}
  inspect({
    jetpackManifest : jetpackManifest,
    availablePackages: availablePackages,
    usedPackages : usedPackages,
    resourcesPaths : resourcesPaths
  });
  function listener(a,b) {
    Components.utils.reportError(a+" : "+b);
  }
  FreemonkeysZoo.runJetpack(gFMPrefs.defaultApplicationPath, gFMPrefs.defaultProfilePath, gFMPrefs.settings.copyProfile, gFMPrefs.settings.defaultPrefs, resourcesPaths, jetpackPath, listener);
}


