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

function restart() {
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit |
                  Components.interfaces.nsIAppStartup.eRestart);
}

Components.utils.import("resource://freemonkeys/freemonkeys.js");

var gFreemonkeys = {
  
  get report () {
    delete this.report;
    this.report = document.getElementById("panel-report");
    return this.report;
  },
  get reportList () {
    delete this.reportList;
    this.reportList = document.getElementById("report-list");
    return this.reportList;
  },
  
  get prefs () {
    delete this.prefs;
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    this.prefs = prefs.getBranch("freemonkeys.");
    return this.prefs;
  },
  get defaultProfilePath () {
    return this.prefs.getCharPref("paths.profile");
  },
  set defaultProfilePath (v) {
    this.prefs.setCharPref("paths.profile",v);
    return v;
  },
  get defaultApplicationPath () {
    return this.prefs.getCharPref("paths.application");
  },
  set defaultApplicationPath (v) {
    this.prefs.setCharPref("paths.application",v);
    return v;
  },
  settings : {
    get switchToReport () {
      return gFreemonkeys.prefs.getBoolPref("settings.auto-switch-to-report");
    },
    set switchToReport (v) {
      //Components.utils.reportError(v);
      gFreemonkeys.prefs.setBoolPref("settings.auto-switch-to-report",v);
      return v;
    }
  }
};

gFreemonkeys.switchTo = function (panelName) {
  var panels = document.getElementById("panels").getElementsByClassName("panel");
  for(var i=0; i<panels.length; i++) {
    panels[i].className = "panel";
  }
  var buttons = document.getElementById("panels-selection").childNodes;
  for(var i=0; i<buttons.length; i++) {
    buttons[i].className = "";
  }
  
  var panel = document.getElementById("panel-"+panelName);
  panel.className += " current";
  
  var button = document.getElementById("panel-"+panelName+"-button");
  button.className = "current";
  
  var onshow = panel.getAttribute("onshow");
  eval(onshow);
}

gFreemonkeys.print = function (classname, type, msg) {
  //Components.utils.reportError(classname+","+type+" -- "+msg);
  this.reportList.innerHTML += '<li class="'+classname+'">'+type+" : "+msg+"</li>";
}
gFreemonkeys.cleanReport = function () {
  this.reportList.innerHTML = "";
  var c = gFreemonkeys.linesContainer;
  c.innerHTML=""+c.innerHTML.replace(/class="[^"]+"/g,"");
  return;
  for(var i=0; i<c.childNodes.length; i++) {
    c.childNodes[i].className="";
    // Hack to disable tooltip
    $(c.childNodes[i]).unbind('mouseover');
    $(c.childNodes[i]).unbind('mouseout');
  }
  $.tools.tooltip.resetInstances();
}


gFreemonkeys.execute = function () {
  gFreemonkeys.cleanReport();
  if (gFreemonkeys.settings.switchToReport)
    gFreemonkeys.switchTo("report");
  var button = document.getElementById("panel-report-button");
  button.style.display="";
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
        lineElement.setAttribute("title",'<strong class="title">Exception at line '+line+'</strong><br/><pre class="message">'+res.message.replace("<","&lt;").replace(">","&gt;")+'</pre>');
        $(lineElement).tooltip({
          tip : '#line-tooltip',
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
      lineElement.setAttribute("title",'<strong class="title">Debug message</strong><br/><pre class="message">'+res.replace("<","&lt;").replace(">","&gt;")+'</pre>');
      $(lineElement).tooltip({
        tip : '#line-tooltip',
        position: "center right",
        offset: [-2, 10]
      });
    } else if (type=="screenshot") {
      var lineElement = gFreemonkeys.linesContainer.childNodes[line-1];
      lineElement.className="screenshot";
      lineElement.setAttribute("title",'<strong class="title">Screenshot</strong><br/><img class="screenshot" src="'+res+'" />');
      $(lineElement).tooltip({
        tip : '#line-tooltip',
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
  
  try {
    if (!gFreemonkeys.defaultApplicationPath)
      return listener("error",-1,"Application binary is not set, please go to the settings panel!");
    if (!gFreemonkeys.defaultProfilePath)
      return listener("error",-1,"Profile path is not set, please go to the settings panel!");
    
    FreemonkeysZoo.execute(gFreemonkeys.defaultApplicationPath, gFreemonkeys.defaultProfilePath, gFreemonkeys.editor.getCode(), listener);
  } catch(e) {
    listener("exception",-1,{message:"Internal error : "+e,e:e});
  }
}

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
    var content = "\n";
    content += 'var element = elements.xpath(win, "'+node.xpath.replace('"','\\"')+'"';
    if (node.binding)
      content += ', "'+node.binding.replace('"','\\"')+'"';
    content += ');\n';
    gFreemonkeys.editor.insertIntoLine(gFreemonkeys.editor.currentLine,0, content);
    //inspect([win,frame,node]);
  }
  FreemonkeysZoo.selectNode(gFreemonkeys.defaultApplicationPath, gFreemonkeys.defaultProfilePath, onClick);
}

gFreemonkeys.freeTheMonkey = function () {
  FreemonkeysZoo.free(gFreemonkeys.defaultApplicationPath, gFreemonkeys.defaultProfilePath);
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

gFreemonkeys.refreshSettings = function () {
  var application = document.getElementById("application-path");
  var profile = document.getElementById("profile-path");
  if (this.defaultApplicationPath)
    application.innerHTML = this.defaultApplicationPath;
  else
    application.innerHTML = "<strong>Need to be set!</strong>";
  if (this.defaultProfilePath)
    profile.innerHTML = this.defaultProfilePath;
  else
    profile.innerHTML = "<strong>Need to be set!</strong>";
  var switchToReport = document.getElementById("auto-switch-to-report");
  if (this.settings.switchToReport)
    switchToReport.setAttribute("checked","true");
  else if (switchToReport.hasAttribute("checked"))
    switchToReport.removeAttribute("checked");
}

gFreemonkeys.toggleSwitchToReport = function () {
  gFreemonkeys.settings.switchToReport = !gFreemonkeys.settings.switchToReport;
  this.refreshSettings();
}

gFreemonkeys.selectProfile = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Profile folder", nsIFilePicker.modeGetFolder);
  //fp.appendFilter("Freemonkey Test set Files","*.fmt");
  //fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    this.defaultProfilePath = file.path;
    this.refreshSettings();
  }
}

gFreemonkeys.selectApplication = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Application binary", nsIFilePicker.modeOpen);
  fp.appendFilter("Application binary","*.exe");
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    this.defaultApplicationPath = file.path;
    this.refreshSettings();
  }
}

window.addEventListener("resize",function () {
  document.getElementById("panels").style.height=(window.innerHeight-30)+"px";
  document.getElementById("code-editor-container").style.height=(window.innerHeight-70)+"px";
},false);

gFreemonkeys.initEditor = function () {
  var container = document.getElementById("code-editor-container");
  this.editor = new CodeMirror(container, {
    width: '100%',
    height: "auto",
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