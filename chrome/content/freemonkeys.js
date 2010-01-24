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
  
  get reportLine () {
    delete this.reportLine;
    this.reportLine = document.getElementById("report-line");
    return this.reportLine;
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

gFreemonkeys.getLineElementFor = function (line) {
  var lineElement = gFreemonkeys.linesContainer.childNodes[line-1];
  // Be aware of line wrapping!
  // Wrapped lines add empty line number div!
  //Components.utils.reportError(lineElement.textContent+" ?= "+line);
  while((lineElement.textContent!=line) && lineElement.nextSibling) {
    //Components.utils.reportError(lineElement.textContent+"!="+line);
    lineElement = lineElement.nextSibling;
  }
  return lineElement;
}
gFreemonkeys.addLineTooltip = function (line, classname, title, content) {
  var lineElement = this.getLineElementFor(line);
  lineElement.className=classname;
  var timestamp = '';
  /*
  timestamp += <div style="position: absolute; top:0; right: 0;">';
  timestamp += (new Date().getTime()-gFreemonkeys._testStartTime)+" ms";
  timestamp += '</div>';
  */
  lineElement.setAttribute("title",timestamp+'<strong class="title">'+title+'</strong><br/>'+content);
  $(lineElement).tooltip({
    tip : '#line-tooltip',
    position: "center right",
    offset: [-2, 10]
  });
}

gFreemonkeys._testsListener = function testsListener(type, line, data) {
  try {
    if (type=="assert-pass" || type=="assert-fail") {
      var msg="line "+line+": ";
      msg += data.name;
      if (data.args) {
        var l=[];
        for(var i in data.args)
          l.push("("+(typeof data.args[i])+") "+data.args[i]);
        msg += " ( "+l.join(', ')+" )";
      }
      gFreemonkeys.print(type=="assert-pass"?"pass":"fail",type=="assert-pass"?"PASS":"FAIL",msg);
      
      if (type=="assert-fail") {
        var classname = type=="assert-pass"?"pass":"fail";
        var message = '<pre class="message">';
        message += "assert."+data.name+"(";
        message += data.args.replace("<","&lt;").replace(">","&gt;");
        message += ')</pre>';
        gFreemonkeys.addLineTooltip(line,"fail",'Assert failed at line '+line,message);
        if (!gFreemonkeys._gotErrors) {
          gFreemonkeys._gotErrors = true;
          gFreemonkeys.reportLine.setAttribute("status","failed");
          gFreemonkeys.reportLine.innerHTML = "Assert failed at line "+line+": "+message;
        }
      } else {
        var lineElement = gFreemonkeys.getLineElementFor(line);
        lineElement.className = "pass";
        gFreemonkeys._successCount++;
      }
    } else if (type=="exception") {
      gFreemonkeys.print("fail","Exception","line "+line+": "+data);
      if (line>=0) {
        gFreemonkeys.addLineTooltip(line,"error",'Exception at line '+line,'<pre class="message">'+data.replace("<","&lt;").replace(">","&gt;")+'</pre>');
      } else {
        Components.utils.reportError(data.toString());
      }
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Exception at line "+line+": "+data;
      }
    } else if (type=="internal-exception") {
      gFreemonkeys.print("fail","Internal exception",data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Internal exception: "+data;
      }
    } else if (type=="error") {
      gFreemonkeys.print("fail","Error",data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Error: "+data;
      }
    } else if (type=="debug") {
      gFreemonkeys.print("debug","log",data);
      gFreemonkeys.addLineTooltip(line,"message",'Debug message at line '+line,'<pre class="message">'+data.replace("<","&lt;").replace(">","&gt;")+'</pre>');
    } else if (type=="screenshot") {
      gFreemonkeys.addLineTooltip(line,"screenshot",'Screenshot at line '+line,'<img class="screenshot" src="'+data+'" />');
    } else if (type=="inspect") {
      gFreemonkeys.print("debug","Inspect",data);
      inspect(data);
    } else if (type=="start") {
      gFreemonkeys.print("debug","Start");
    } else if (type=="end") {
      gFreemonkeys.print("debug","End");
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys.reportLine.setAttribute("status","success");
        gFreemonkeys.reportLine.innerHTML = "Test succeeded with "+gFreemonkeys._successCount+" asserts";
      }
    } else if (type=="monkey") {
      // data = launch|start|return
    } else {
      var message = "Unknown message, type:"+type+" data:"+data;
      gFreemonkeys.print("debug","Internal error",message);
      Components.utils.reportError(message);
    }
  } catch(e) {
    Components.utils.reportError(e);
  }
}

gFreemonkeys.execute = function () {
  gFreemonkeys.cleanReport();
  if (gFreemonkeys.settings.switchToReport)
    gFreemonkeys.switchTo("report");
  var button = document.getElementById("panel-report-button");
  button.style.display="";
  
  gFreemonkeys.reportLine.style.display="";
  gFreemonkeys.reportLine.setAttribute("status","in-process");
  gFreemonkeys.reportLine.innerHTML = "Executing test";
  gFreemonkeys._gotErrors = false;
  gFreemonkeys._successCount = 0;
  
  try {
    if (!gFreemonkeys.defaultApplicationPath)
      return gFreemonkeys._testsListener("error",-1,"Application binary is not set, please go to the settings panel!");
    if (!gFreemonkeys.defaultProfilePath)
      return listener("error",-1,"Profile path is not set, please go to the settings panel!");
    
    gFreemonkeys._testStartTime = new Date().getTime();
    FreemonkeysZoo.execute(gFreemonkeys.defaultApplicationPath, gFreemonkeys.defaultProfilePath, gFreemonkeys.editor.getCode(), gFreemonkeys._testsListener);
  } catch(e) {
    gFreemonkeys._testsListener("internal-exception",-1,e.toString());
  }
}

gFreemonkeys.selectNode = function () {
  function onClick(win, node) {
    
    window.restore();
    
    var content = "\n";
    function printWinCode(info) {
      if (info.type=="top-known") {
        var position = '"topmost"';
        if (info.position.isFirst || info.position.index==-1)
          position = '"topmost"';
        else if (!info.position.isFirst && info.position.isLast)
          position = '"bottommost"';
        else if (!info.position.isFirst && !info.position.isLast && info.position.index>=0)
          position = info.position.index;
        content += 'var top = monkey.windows.getRegistered("'+info.id+'", '+position+');\n';
        return "top";
      } else if (info.type=="top-unknown") {
        var position = '"topmost"';
        if (info.position.isFirst || info.position.index==-1)
          position = '"topmost"';
        else if (!info.position.isFirst && info.position.isLast)
          position = '"bottommost"';
        else if (!info.position.isFirst && !info.position.isLast && info.position.index>=0)
          position = info.position.index;
        
        content += 'var top = monkey.windows.getByZindex(';
        if (info.info.id)
          content += '"'+info.info.id+'"';
        else 
          content += 'null';
        content += ', ';
        if (info.info.type)
          content += '"'+info.info.type+'"';
        else 
          content += 'null';
        content += ', ';
        if (info.info.name)
          content += '"'+info.info.name+'"';
        else 
          content += 'null';
        content += ', ';
        if (info.info.location)
          content += '"'+info.info.location+'"';
        else 
          content += 'null';
        content += ', '+position+');\n';
        return "top";
      } else if (info.type=="sub-known") {
        content += 'var win = monkey.windows.getRegistered("'+info.id+'");\n';
        return "win";
      } else if (info.type=="sub-unknown") {
        var varname = printWinCode(info.parent);
        content += 'var win = monkey.windows.sub('+varname+', "'+info.xpath+'");\n';
        return "win";
      } else if (info.type=="tab") {
        var varname = printWinCode(info.top);
        content += 'var tab = '+varname+'.tabs.current;\n';
        return "tab";
      }
    }
    var winName = printWinCode(win);
    
    if (node.anonymous) {
      content += 'var element = elements.xblpath('+winName+', ["'+node.xpath.replace('"','\\"')+'", "'+node.anonymous.join('", "')+'"]';
    } else {
      content += 'var element = elements.xpath('+winName+', "'+node.xpath.replace('"','\\"')+'"';
    }
    content += ');\n';
    
    gFreemonkeys.editor.insertIntoLine(gFreemonkeys.editor.cursorPosition().line, "end", content);
    
    gFreemonkeys.focusEditor();
  }
  var alive = FreemonkeysZoo.selectNode(gFreemonkeys.defaultApplicationPath, gFreemonkeys.defaultProfilePath, onClick);
  if (!alive) return;
  /*
  // Nothing works to restore our window on top of all other applications :/
  
  var baseWin = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                        .getInterface(Components.interfaces.nsIWebNavigation)
                                        .QueryInterface(Components.interfaces.nsIDocShell)
                                        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                                        .treeOwner
                                        .QueryInterface(Components.interfaces.nsIBaseWindow);
  baseWin.enabled=false;
  baseWin.visibility=false;
  var xulwin = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
          .getInterface(Components.interfaces.nsIWebNavigation)
          .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
          .treeOwner
          .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
          .getInterface(Components.interfaces.nsIXULWindow);
  xulwin.zLevel = xulwin.highestZ;
  */
  
  window.minimize();
  
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
      gFreemonkeys.linesContainer = container.getElementsByClassName("CodeMirror-line-numbers")[0];
      
      window.focus();
      window.setTimeout(function(){
          //gFreemonkeys.editor.frame.contentWindow.document.body.focus();
          gFreemonkeys.editor.focus();
        },1000);
    }
  });
}

gFreemonkeys.focusEditor = function () {
  window.document.documentElement.focus();
  window.setTimeout(function(){
      gFreemonkeys.editor.focus();
    },0);
}

gFreemonkeys.load = function () {
  this.restoreWindowParams();
  
  window.focus();
  
  this.initEditor();
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