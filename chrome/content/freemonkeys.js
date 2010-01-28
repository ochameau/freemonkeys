
Components.utils.import("resource://freemonkeys/freemonkeys.js");

var gFreemonkeys = {
  
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



gFreemonkeys.cleanReport = function () {
  gFMReport.clean();
  gFMEditor.cleanLinesStates();
}

gFreemonkeys.addLineTooltip = function (line, classname, title, tooltip) {
  gFMEditor.setLineClass(line, classname);
  
  var content = "";
  var timestamp = '';
  timestamp += '<div style="position: absolute; top:0; right: 0;">';
  timestamp += (new Date().getTime()-gFreemonkeys._testStartTime)+' ms';
  timestamp += '</div>';
  //content += timestamp;
  content += '<strong class="title">'+title+'</strong><br/>'+tooltip;
  gFMEditor.addLineTooltip(line, content);
}

gFreemonkeys._testsListener = function testsListener(type, line, data) {
  try {
    if (type=="assert-pass" || type=="assert-fail") {
      var msg="line "+line+": ";
      msg += "assert."+data.name;
      if (data.args) {
        msg += "( "+data.args.replace("<","&lt;").replace(">","&gt;")+" )";
      }
      gFMReport.print(type=="assert-pass"?"pass":"fail",type=="assert-pass"?"PASS":"FAIL",msg);
      
      if (type=="assert-fail") {
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
        gFMEditor.setLineClass(line, "pass");
        gFreemonkeys._successCount++;
      }
    } else if (type=="exception") {
      gFMReport.print("fail","Exception","line "+line+": "+data);
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
      gFMReport.print("fail","Internal exception",data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Internal exception: "+data;
      }
    } else if (type=="error") {
      gFMReport.print("fail","Error",data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Error: "+data;
      }
    } else if (type=="debug") {
      gFMReport.print("debug","log",data);
      gFreemonkeys.addLineTooltip(line,"message",'Debug message at line '+line,'<pre class="message">'+data.replace("<","&lt;").replace(">","&gt;")+'</pre>');
    } else if (type=="screenshot") {
      gFreemonkeys.addLineTooltip(line,"screenshot",'Screenshot at line '+line,'<img class="screenshot" src="'+data+'" />');
    } else if (type=="inspect") {
      gFMReport.print("debug","Inspect",data);
      inspect(data);
    } else if (type=="start") {
      gFMReport.print("debug","Start","");
    } else if (type=="end") {
      gFMReport.print("debug","End","");
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys.reportLine.setAttribute("status","success");
        gFreemonkeys.reportLine.innerHTML = "Test succeeded with "+gFreemonkeys._successCount+" asserts";
      }
    } else if (type=="monkey") {
      // data = launch|start|return
    } else {
      var message = "Unknown message, type:"+type+" data:"+data;
      gFMReport.print("debug","Internal error",message);
      Components.utils.reportError(message);
    }
  } catch(e) {
    Components.utils.reportError(e);
  }
}

gFreemonkeys.execute = function () {
  this.cleanReport();
  if (gFMPrefs.settings.switchToReport)
    this.switchTo("report");
  var button = document.getElementById("panel-report-button");
  button.style.display="";
  
  this.reportLine.style.display="";
  this.onresize();
  this.reportLine.setAttribute("status","in-process");
  this.reportLine.innerHTML = "Executing test";
  
  this._gotErrors = false;
  this._successCount = 0;
  
  try {
    if (!gFMPrefs.defaultApplicationPath)
      return this._testsListener("error",-1,"Application binary is not set, please go to the settings panel!");
    if (!gFMPrefs.defaultProfilePath)
      return this._testsListener("error",-1,"Profile path is not set, please go to the settings panel!");
    
    this._testStartTime = new Date().getTime();
    FreemonkeysZoo.execute(gFMPrefs.defaultApplicationPath, gFMPrefs.defaultProfilePath, gFMEditor.content, this._testsListener);
  } catch(e) {
    this._testsListener("internal-exception",-1,e.toString());
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
        content += 'var top = windows.getRegistered("'+info.id+'", '+position+');\n';
        return "top";
      } else if (info.type=="top-unknown") {
        var position = '"topmost"';
        if (info.position.isFirst || info.position.index==-1)
          position = '"topmost"';
        else if (!info.position.isFirst && info.position.isLast)
          position = '"bottommost"';
        else if (!info.position.isFirst && !info.position.isLast && info.position.index>=0)
          position = info.position.index;
        
        content += 'var top = windows.getByZindex(';
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
        content += 'var win = windows.getRegistered("'+info.id+'");\n';
        return "win";
      } else if (info.type=="sub-unknown") {
        var varname = printWinCode(info.parent);
        content += 'var win = windows.sub('+varname+', "'+info.xpath+'");\n';
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
    
    gFMEditor.insertContent(content);
  }
  var alive = FreemonkeysZoo.selectNode(gFMPrefs.defaultApplicationPath, gFMPrefs.defaultProfilePath, onClick);
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
  FreemonkeysZoo.free(gFMPrefs.defaultApplicationPath, gFMPrefs.defaultProfilePath);
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


gFreemonkeys.onresize = function () {
  document.getElementById("panels").style.height=(window.innerHeight-30)+"px";
  var reportLine = this.reportLine.style.display=="none"?0:25;
  var titleLine = 30;
  document.getElementById("code-editor-container").style.height=(window.innerHeight-70-reportLine-titleLine)+"px";
}

gFreemonkeys.onload = function () {
  this.restoreWindowParams();
  
  window.focus();
  
  gFMEditor.onload();
}

gFreemonkeys.onunload = function () {
  this.saveWindowParams();
  
  gFMEditor.onunload();
  
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
  gFreemonkeys.onload();
},false);
window.addEventListener("unload",function () {
  gFreemonkeys.onunload();
},false);
window.addEventListener("resize",function () {
  gFreemonkeys.onresize();
},false);