
Components.utils.import("resource://xul-macro/actions.js");

const nsIFilePicker = Components.interfaces.nsIFilePicker;

function load() {
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Test Set file", nsIFilePicker.modeOpen);
  fp.appendFilter("Freemonkey Test set Files","*.fmt");
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    var file = fp.file;
    try {
      
      loadActionsFrom(file);
      
    } catch(e) {
      dump("Load file error : "+e+"\n");
    }

  }

  
}

function save() {
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Test Set file", nsIFilePicker.modeOpen);
  fp.appendFilter("Freemonkey Test set Files","*.fmt");
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    var file = fp.file;
    saveActionsTo(file);
  }
}

function executeAll() {
try {
  var list=document.getElementById('command-list');
  
  // Reset previous results display
  for(var i=0; i<list.childNodes.length; i++) {
    list.childNodes[i].firstChild.reset();
  }
  
  var testStart=new Date().getTime();
  
  var results=[];
  var i = 0;
  function loop() {
    if (!list.childNodes[i]) {
      return end();
    }
    var action=list.childNodes[i++].firstChild;
    try {
      var obj = action.getActionObject();
      var actionStart=new Date().getTime();
      action.execute(function (success,result) {
        results.push({
          action : obj,
          success : success,
          time : new Date().getTime()-actionStart,
          result : Actions.getCachedCopy(result)
        });
        if (success)
          window.setTimeout(loop,0);
      });
    } catch(e) {
      results.push({
        action : obj,
        result : { result:"FAIL", exception:{msg:"Internal error : "+e.toString()} }
      });
      //loop();
    }
    
  }
  function end() {
    try {
      var test = {
        totalTime : new Date().getTime()-testStart,
        results : results
      };
      

      var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                   .createInstance(Components.interfaces.nsIJSON);
      
      var jsonString = nativeJSON.encode(test);
      
      var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                     .createInstance(Components.interfaces.nsIFileOutputStream);
      var file = Actions.getDesktopResultFile();
      foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
      foStream.write(jsonString,jsonString.length);
      foStream.close();
    } catch(e) {
      alert("Error while saving results file : "+e);
    }
    inspect(test);
  }
  loop();
} catch(e) {
  alert(e);
}
}

function addAction(type) {
  var list=document.getElementById('command-list');
  var ritem=document.createElement('richlistitem');
  var item=document.createElement('box');
  item.setAttribute("class","action");
  item.setAttribute("type",type);
  item.setAttribute("flex","1");
  ritem.appendChild(item);
  list.appendChild(ritem);
  list.scrollBoxObject.scrollToElement(ritem);
  return item;
}


function restoreOneAction(action) {
  var guiAction = addAction(action.type);
  window.setTimeout(function () {
    guiAction.restore(action);
  },500);
}

function loadActionsFrom(sourceFile) {
  var list = Actions.loadFile(sourceFile);
  
  var uiList=document.getElementById('command-list');
  while(uiList.firstChild)
    uiList.removeChild(uiList.firstChild);
  
  // Read this document to create relative actions
  for(var i=0;i<list.length;i++) {
    restoreOneAction(list[i]);
  }
}

function restoreActions() {
  var file = Actions.getLastSessionFile();
  if (!file.exists()) return;
  try {
    
    loadActionsFrom(file);
    
  } catch(e) {
    dump("Restore session error : "+e+"\n");
    file.remove(false);
  }
}

function saveActionsTo(destinationFile) {
  try {
    var list=document.getElementById('command-list');
    
    // Retrieve xml as string list
    var actionList=[];
    try {
      for(var i=0; i<list.childNodes.length; i++) {
        var action=list.childNodes[i].firstChild;
        actionList.push(action.getActionObject());
      }
    } catch(e) {
      alert("error while saving restore session : "+e+"\n");
    }
    
    var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

    var jsonString = nativeJSON.encode(actionList);
    
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Components.interfaces.nsIFileOutputStream);
    foStream.init(destinationFile, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
    foStream.write(jsonString,jsonString.length);
    foStream.close();
  } catch(e) {
    alert("Error while saving session file : "+e+"\n");
  }
}

window.addEventListener("unload",function () {
    
    var file = Actions.getLastSessionFile();
    saveActionsTo(file);
    
    Actions.quit();
    
    var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
    
},false);


window.addEventListener("load",function () {
  
    restoreActions();
  
},false);

function inspect(obj) {
  if (!inspectObject)
    return alert("You must install DOM Inspector!");
  inspectObject(obj);
}
