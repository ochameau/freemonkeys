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
  },
  get report () {
    delete this.report;
    this.report = document.getElementById("report");
    return this.report;
  }
};

gFreemonkeys.switchTo = function (panel) {
  
}

gFreemonkeys.print = function (classname, type, msg) {
  this.report.innerHTML += '<li class="'+classname+'">'+type+" : "+msg+"</li>";
}
gFreemonkeys.cleanReport = function () {
  this.report.innerHTML = "";
}

gFreemonkeys.execute = function () {
  gFreemonkeys.cleanReport();
  gFreemonkeys.switchTo("report");
  function listener(type, res) {
    if (type=="assert-pass" || type=="assert-fail") {
      var msg="line "+res.line+": ";
      msg += res.name;
      if (res.args) {
        var l=[];
        for(var i in res.args)
          l.push("("+(typeof res.args[i])+") "+res.args[i]);
        msg += " ( "+l.join(", ")+" )";
      }
      gFreemonkeys.print(type=="assert-pass"?"pass":"fail",type=="assert-pass"?"PASS":"FAIL",msg);
    } else if (type=="exception") {
      gFreemonkeys.print("fail","Exception","line "+res.line+": "+res.message);
    } else if (typeof res=="object") {
      gFreemonkeys.print("debug",type,(res.line?res.line:"?")+" - "+res.toSource());
      inspect(res);
    } else {
      gFreemonkeys.print("debug",type,res?res:"");
    }
  }
  if (!this.monkey) {
    Components.utils.import("resource://freemonkeys/freemonkeys.js");
    var binary = "C:\\Program Files\\Mozilla Firefox 3 en\\firefox.exe";
    var profile = "C:\\Documents and Settings\\Administrateur\\Bureau\\freemonkeys\\profiles\\empty";
    gFreemonkeys.print("launch","firefox:"+binary+" with profile:"+profile);
    newMonkey(binary, profile, 
      function (monkey, error) {
        if (!monkey) {
          gFreemonkeys.print("error","Error while childbearing the monkey : "+error);
        } else {
          gFreemonkeys.monkey = monkey;
          gFreemonkeys.print("internal","A new monkey is born!");
          gFreemonkeys.monkey.execute(gFreemonkeys.editor.getContent(),listener);
        }
      });
  } else {
    this.monkey.execute(gFreemonkeys.editor.getContent(),listener);
  }
}

gFreemonkeys.freeMonkeys = function () {
  if (!this.monkey) return;
  this.monkey.free();
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
  this.freeMonkeys();
  
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