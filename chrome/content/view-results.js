
const nsIFilePicker = Components.interfaces.nsIFilePicker;
const nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);

const prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService).getBranch("app.xul-macro");
const prefLastResultsFile = "last-result-file";

var htmlFrame=null;
var htmlFrameWin=null;
function init() {
  htmlFrame=document.getElementById("html-frame");
  htmlFrameWin=htmlFrame.contentWindow;
  
  var lastResultFile = null;
  try {
    lastResultFile = prefs.getCharPref(prefLastResultsFile);
  } catch(e) {}
  if (lastResultFile) {
    file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(lastResultFile);
    loadResults(file);
  }
}

function searchResultsFile() {
  
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Test Results directory", nsIFilePicker.modeGetFolder);
  //fp.appendFilter("Freemonkey Results Directory","*.fmr");
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    loadResults(fp.file);
    prefs.setCharPref(prefLastResultsFile,fp.file.path);
  }

}

function clearSelection() {
  htmlFrameWin.clearSelection();
}

function loadResults(directory) {
  htmlFrameWin.loadResults(directory);
}


function inspect(obj) {
  if (!inspectObject)
    return alert("You must install DOM Inspector!");
  inspectObject(obj);
}