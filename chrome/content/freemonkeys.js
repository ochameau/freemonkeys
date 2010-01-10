function inspect(aObject,aModal) {
  if (aObject && typeof aObject.appendChild=="function") {
    window.openDialog("chrome://inspector/content/", "_blank",
              "chrome,all,dialog=no"+(aModal?",modal":""), aObject);
  } else {
    window.openDialog("chrome://inspector/content/object.xul", "_blank",
              "chrome,all,dialog=no"+(aModal?",modal":""), aObject);
  }
}

function executeDebug() {
  var content = gFreemonkeys.editor.getCode();
  window.eval(content);
}

function aboutConfig() {
  window.open('about:config', 'about_config', 'chrome,dependent,width=700,height=500');
}

Components.utils.import("resource://freemonkeys/freemonkeys.js");

var gFreemonkeys = {
  get prefs () {
    delete this.prefs;
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    this.prefs = prefs.getBranch("extensions.yoono.profiles-selector.");
    return this.prefs;
  },/*
  get editor () {
    delete this.editor;
    this.editor = document.getElementById("editor").bespin;
    return this.editor;
  },*/
  get report () {
    delete this.report;
    this.report = document.getElementById("panel-report");
    return this.report;
  }
};

gFreemonkeys.switchTo = function (panel) {
  
}

gFreemonkeys.print = function (classname, type, msg) {
  Components.utils.reportError(classname+","+type+" -- "+msg);
  this.report.innerHTML += '<li class="'+classname+'">'+type+" : "+msg+"</li>";
}
gFreemonkeys.cleanReport = function () {
  this.report.innerHTML = "";
  var c = gFreemonkeys.linesContainer;
  for(var i=0; i<c.childNodes.length; i++)
    c.childNodes[i].className="";
}


gFreemonkeys.execute = function () {
  gFreemonkeys.cleanReport();
  gFreemonkeys.switchTo("report");
  function listener(type, line, res) {
    if (type=="assert-pass" || type=="assert-fail") {
      var msg="line "+line+": ";
      msg += res.name;
      if (res.args) {
        var l=[];
        for(var i in res.args)
          l.push("("+(typeof res.args[i])+") "+res.args[i]);
        msg += " ( "+l.join(", ")+" )";
      }
      gFreemonkeys.print(type=="assert-pass"?"pass":"fail",type=="assert-pass"?"PASS":"FAIL",msg);
      gFreemonkeys.linesContainer.childNodes[line-1].className=type=="assert-pass"?"pass":"fail";
    } else if (type=="exception") {
      gFreemonkeys.print("fail","Exception","line "+line+": "+res.message);
      if (line>=0) {
        var lineElement = gFreemonkeys.linesContainer.childNodes[line-1];
        lineElement.className="error";
        lineElement.setAttribute("title","<strong>Exception at line "+line+" :</strong><br/> "+res.message);
        $(lineElement).tooltip({
          tip : '#error-tooltip',
          position: "center right",
          offset: [-2, 10]
        });
      } else {
        Components.utils.reportError(res.message);
      }
    } else if (type=="print") {
      gFreemonkeys.print("debug","log",res);
      var lineElement = gFreemonkeys.linesContainer.childNodes[line-1];
      lineElement.className="message";
      lineElement.setAttribute("title","<strong>Debug message :</strong><br/> "+res);
      $(lineElement).tooltip({
        tip : '#error-tooltip',
        position: "center right",
        offset: [-2, 10]
      });
    } else if (typeof res=="object") {
      gFreemonkeys.print("debug",type,(res.line?res.line:"?")+" - "+res.toSource());
      inspect(res);
    } else {
      gFreemonkeys.print("debug",type,res?res:"");
    }
  }
  
 
  
  this.monkey = FreemonkeysZoo.execute(env.application.default, env.profile.default, gFreemonkeys.editor.getCode(), listener);
}
var env = {
  application : {
    default : "C:\\Program Files\\Mozilla Firefox 3 en\\firefox.exe"
  },
  profile : {
    default : "C:\\Documents and Settings\\Administrateur\\Bureau\\freemonkeys\\profiles\\empty"
  }
};

gFreemonkeys.selectNode = function () {
  window.minimize();
  function onClick(win, frame, node) {
    window.restore();
    var xulwin = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIWebNavigation)
      .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
      .treeOwner
      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIXULWindow);
    xulwin.zLevel = xulwin.highestZ;
    window.focus();
    //inspect([win,frame,node]);
  }
  FreemonkeysZoo.selectNode(env.application.default, env.profile.default, onClick);
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
  var file = this.getLastSessionFile();
  if (!file.exists()) return;
  var content = this.readFile(file);
  this.editor.setCode(content);
}
gFreemonkeys.saveSession = function () {
  var content = this.editor.getCode();
  var file = this.getLastSessionFile();
  this.saveFile(file,content);
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

gFreemonkeys.initEditor = function () {
  var container = document.getElementById("code-editor-container");
  this.editor = new CodeMirror(container, {
    width: '100%',
    height: "350px",
    parserfile: ["tokenizejavascript.js", "parsejavascript.js"],
    stylesheet: "css/jscolors.css",
    path: "codemirror/",
    tabMode: 'shift',
    indentUnit: 2,
    lineNumbers: true,
    autoMatchParens: true,
    iframeClass: 'code-iframe',
    initCallback : function () {
      
      gFreemonkeys.restorePreviousSession();
      //gFreemonkeys.editor.focus();
      gFreemonkeys.linesContainer = container.getElementsByClassName("CodeMirror-line-numbers")[0];
      
    }
  });
}

gFreemonkeys.load = function () {
  this.restoreWindowParams();
  
  this.initEditor();
  
  window.focus();
}

gFreemonkeys.unload = function () {
  this.saveWindowParams();
  this.saveSession();
  try {
    FreemonkeysZoo.freeThemAll();
  } catch(e) {
    Components.utils.reportError(e);
  }
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