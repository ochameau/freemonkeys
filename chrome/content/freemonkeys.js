function inspect(aObject,aModal) {
  window.openDialog("chrome://inspector/content/object.xul", "_blank",
              "chrome,all,dialog=no"+(aModal?",modal":""), aObject);
}

var gFreemonkeys = {
  get prefs () {
    delete this.prefs;
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    this.prefs = prefs.getBranch("extensions.yoono.profiles-selector.");
    return this.prefs;
  },
  get editor () {
    delete this.editor;
    this.editor = document.getElementById("editor").bespin;
    return this.editor;
  }
};


var m = fm.getOneMonkey();
var w = m.getTopWindow();
fm.inspect(w);

gFreemonkeys.execute = function () {
  var sandbox = Components.utils.Sandbox("http://localhost.localdomain.:0/");
  sandbox.fm = {
    getOneMonkey : function (firefox, profile) {
      if (firefox && firefox!="default") throw "Only handle one firefox, the default's one";
      if (profile && profile!="default") throw "Only handle one profile, the default's one";
      return ;
    }
  };
  var code = this.editor.getContent();
  Components.utils.evalInSandbox(code, sandbox);
}

gFreemonkeys.getLastSessionFile = function () {
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
         .getService(Components.interfaces.nsIProperties)
         .get("ProfD", Components.interfaces.nsIFile);
  file.append("last-session.test.js");
  return file;
}

gFreemonkeys.readFile = function (file) {
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

gFreemonkeys.saveFile = function (file, str) {
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                 .createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
  foStream.write(str,str.length);
  foStream.close();
}

gFreemonkeys.restorePreviousSession = function () {
  var file = gFreemonkeys.getLastSessionFile();
  if (!file.exists()) return;
  var content = gFreemonkeys.readFile(file);
  gFreemonkeys.editor.setContent(content);
}
gFreemonkeys.saveSession = function () {
  var content = this.editor.getContent();
  var file = gFreemonkeys.getLastSessionFile();
  gFreemonkeys.saveFile(file,content);
}

gFreemonkeys.saveWindowParams = function () {
  this.prefs.setIntPref("window.x",window.screenX);
  this.prefs.setIntPref("window.y",window.screenY);
  this.prefs.setIntPref("window.width",window.outerWidth);
  this.prefs.setIntPref("window.height",window.outerHeight);
}

gFreemonkeys.restoreWindowParams = function () {
  window.screenX = this.prefs.getIntPref("window.x");
  window.screenY = this.prefs.getIntPref("window.y");
  window.outerWidth = this.prefs.getIntPref("window.width");
  window.outerHeight = this.prefs.getIntPref("window.height");
}


gFreemonkeys.load = function () {
  this.restoreWindowParams();
  this.restorePreviousSession();
  window.focus();
}

gFreemonkeys.unload = function () {
  this.saveWindowParams();
  this.saveSession();
  
  // Ask to shutdown in order to close JSConsole automatically
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
}


window.addEventListener("load",function () {
  window.removeEventListener("load",arguments.callee,false);
  gFreemonkeys.load();
},false);
window.addEventListener("unload",function () {
  gFreemonkeys.unload();
},false);