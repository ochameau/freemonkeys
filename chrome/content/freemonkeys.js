
Components.utils.import("resource://freemonkeys/freemonkeys.js");

var gFreemonkeys = {
  
  set titleBonus (v) {
    if (!this._titleBonus)
      this._titleBonus = document.getElementById("title-bonus");
    if (v)
      this._titleBonus.innerHTML = " - "+v;
    else
      this._titleBonus.innerHTML = "";
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

gFreemonkeys.getCurrentTestTime = function () {
  var time = new Date().getTime()-gFreemonkeys._testStartTime;
  if (time<1000) return time+" ms";
  else if (time<1000*60) return (time/1000)+" s";
  return (time/(1000*60))+" m";
}

gFreemonkeys.addLineTooltip = function (line, classname, title, tooltip) {
  gFMEditor.setLineClass(line, classname);
  
  var content = "";
  var timestamp = '';
  timestamp += '<div style="position: absolute; top:0; right: 0;">';
  timestamp += gFreemonkeys.getCurrentTestTime()+' ms';
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
      gFMReport.print(type=="assert-pass"?"pass":"fail",type=="assert-pass"?"PASS":"FAIL",gFreemonkeys.getCurrentTestTime(),msg);
      
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
      gFMReport.print("fail","Exception",gFreemonkeys.getCurrentTestTime(),"line "+line+": "+data);
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
      gFMReport.print("fail","Internal exception",gFreemonkeys.getCurrentTestTime(),data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Internal exception: "+data;
      }
    } else if (type=="error") {
      gFMReport.print("fail","Error",gFreemonkeys.getCurrentTestTime(),data);
      Components.utils.reportError(data);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys._gotErrors = true;
        gFreemonkeys.reportLine.setAttribute("status","failed");
        gFreemonkeys.reportLine.innerHTML = "Error: "+data;
      }
    } else if (type=="debug") {
      gFMReport.print("debug","log",gFreemonkeys.getCurrentTestTime(),data);
      gFreemonkeys.addLineTooltip(line,"message",'Debug message at line '+line,'<pre class="message">'+data.replace("<","&lt;").replace(">","&gt;")+'</pre>');
    } else if (type=="screenshot") {
      gFMReport.print("debug","screenshot",gFreemonkeys.getCurrentTestTime()," at ("+data.boxObject.x+", "+data.boxObject.y+") with size ("+data.boxObject.width+"x"+data.boxObject.height+")");
      gFreemonkeys.addLineTooltip(line,"screenshot",'Screenshot at line '+line,'<img class="screenshot" src="'+data.data+'" />');
    } else if (type=="inspect") {
      gFMReport.print("debug","Inspect",gFreemonkeys.getCurrentTestTime(),data);
      inspect(data);
    } else if (type=="start") {
      // Doesn't take firefox launch into test execution time:
      gFreemonkeys._testStartTime = new Date().getTime();
      gFMReport.print("debug","Start",gFreemonkeys.getCurrentTestTime(),"");
    } else if (type=="end") {
      var totalTime = gFreemonkeys.getCurrentTestTime();
      var msg = "Test succeeded with "+gFreemonkeys._successCount+" asserts in "+totalTime;
      gFMReport.print("debug","End",gFreemonkeys.getCurrentTestTime(),msg);
      if (!gFreemonkeys._gotErrors) {
        gFreemonkeys.reportLine.setAttribute("status","success");
        gFreemonkeys.reportLine.innerHTML = msg;
      }
    } else if (type=="monkey") {
      // data = launch|start|return
    } else {
      var message = "Unknown message, type:"+type+" data:"+data;
      gFMReport.print("debug","Internal error",gFreemonkeys.getCurrentTestTime(),message);
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
    if (!gFMPrefs.defaultProfilePath && !gFMPrefs.settings.useEmptyProfile)
      return this._testsListener("error",-1,"Profile path is not set, please go to the settings panel!");
    
    this._testStartTime = new Date().getTime();
    FreemonkeysZoo.execute(gFMPrefs.defaultApplicationPath, gFMPrefs.defaultProfilePath, gFMPrefs.settings.copyProfile, gFMPrefs.settings.defaultPrefs, gFMEditor.content, this._testsListener);
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
  var reportLine = this.reportLine.style.display=="none"?0:25;
  var titleLine = 32;
  document.getElementById("code-editor-container").style.height=(window.innerHeight-70-reportLine-titleLine)+"px";
  gFMReport.reportList.style.height=(window.innerHeight-120-titleLine)+"px";
}

gFreemonkeys.onload = function () {
  this.restoreWindowParams();
  
  window.focus();
  
  gFMEditor.onload();
}

gFreemonkeys.onunload = function () {
  this.saveWindowParams();
  
  gFMEditor.onunload();
  
  function shutdown() {
    // Ask to shutdown in order to close JSConsole automatically
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
        getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
  }
  
  try {
    FreemonkeysZoo.freeThemAll(shutdown);
  } catch(e) {
    Components.utils.reportError(e);
  }
  
  window.setTimeout(shutdown, 5000);
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