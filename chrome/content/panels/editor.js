const gFMEditor = {
  get content () {
    return this.editor.getCode();
  },
  set content (v) {
    this.editor.setCode(v);
    this.fixFocus();
    this.changesInProgress = false;
    return v;
  },
  get currentFile () {
    try {
      return gFreemonkeys.prefs.getComplexValue("current-file", Components.interfaces.nsILocalFile);
    } catch(e) {
      return null;
    }
  },
  set currentFile (v) {
    if (!v) {
      gFreemonkeys.titleBonus="new file";
      try {
        gFreemonkeys.prefs.clearUserPref("current-file");
      } catch(e) {}
      return v;
    }
    gFreemonkeys.titleBonus=v.leafName;
    gFreemonkeys.prefs.setComplexValue("current-file", Components.interfaces.nsILocalFile, v);
    return v;
  },
  get lastBufferFile () {
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
         .getService(Components.interfaces.nsIProperties)
         .get("ProfD", Components.interfaces.nsIFile);
    file.append("buffer.test.js");
    return file;
  },
  _changes : false,
  get changesInProgress () {
    return this._changes;
  },
  set changesInProgress (v) {
    if (v==this._changes) return;
    this._changes = v;
    var saveBtn = document.getElementById("save");
    if (v)
      saveBtn.setAttribute("changes","true");
    else if (saveBtn.hasAttribute("changes"))
      saveBtn.removeAttribute("changes");
  }
};


gFMEditor.insertContent = function (content) {
  this.editor.insertIntoLine(this.editor.cursorPosition().line, "end", content);
  this.fixFocus();
}

gFMEditor.fixFocus = function () {
  window.focus();
  //window.document.documentElement.focus();
  window.setTimeout(function(){
      gFMEditor.editor.focus();
      //gFMEditor.editor.frame.contentWindow.document.body.focus();
    },0);
}

gFMEditor.cleanLinesStates = function () {
  var c = this.linesContainer;
  // Remove lines class attribute and reset tooltip by recomputing html (dirty but working ...)
  c.innerHTML=""+c.innerHTML.replace(/class="[^"]+"/g,"");
  /*
  This doesn't work :(
  for(var i=0; i<c.childNodes.length; i++) {
    c.childNodes[i].className="";
    // Hack to disable tooltip
    $(c.childNodes[i]).unbind('mouseover');
    $(c.childNodes[i]).unbind('mouseout');
  }
  $.tools.tooltip.resetInstances();
  */
}

// Line start at 1
gFMEditor.setLineClass = function (line, classname) {
  var lineElement = this.getLineElementFor(line);
  lineElement.className=classname;
}

// Line start at 1
gFMEditor.addLineTooltip = function (line, content) {
  var lineElement = this.getLineElementFor(line);
  lineElement.setAttribute("title",content);
  $(lineElement).tooltip({
    tip : '#line-tooltip',
    position: "center right",
    offset: [0, 0],
    onShow: function () {
      lineElement.setAttribute("tooltip","true");
    },
    onHide: function () {
      if (lineElement.hasAttribute("tooltip"))
        lineElement.removeAttribute("tooltip");
    }
  });
}

gFMEditor.getLineElementFor = function (line) {
  var lineElement = this.linesContainer.childNodes[line-1];
  // Be aware of line wrapping!
  // Wrapped lines add empty line number div!
  //Components.utils.reportError((lineElement?lineElement.textContent:"null")+" ?= "+line);
  while((lineElement.textContent!=line) && lineElement.nextSibling) {
    //Components.utils.reportError(lineElement.textContent+"!="+line);
    lineElement = lineElement.nextSibling;
  }
  return lineElement;
}


gFMEditor.new = function () {
  this.currentFile = null;
  this.content = "\n\n\n";
}

gFMEditor.load = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Freemonkey test script", nsIFilePicker.modeOpen);
  fp.appendFilter("Freemonkey test scripts","*.js");
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    this.currentFile = fp.file;
    this.loadFromFile(this.currentFile);
  }
}

gFMEditor.save = function () {
  var current = this.currentFile;
  if (current) {
    this.saveToFile(current);
    return;
  }
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Profile folder", nsIFilePicker.modeSave);
  fp.appendFilter("Freemonkey test scripts","*.js");
  //fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    this.currentFile = fp.file;
    this.saveToFile(fp.file);
  }
}

gFMEditor.getFileContent = function (file) {
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

gFMEditor.saveContentToFile = function (file, str) {
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                 .createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);   // write, create, truncate
  foStream.write(str,str.length);
  foStream.close();
}

gFMEditor.loadFromFile = function (file) {
  if (!file.exists()) return;
  this.content = this.getFileContent(file);
}

gFMEditor.saveToFile = function (file) {
  this.saveContentToFile(file,this.content);
  this.changesInProgress = false;
}

gFMEditor.restorePreviousSession = function () {
  var current = this.currentFile;
  if (current) {
    this.currentFile = current;
    this.loadFromFile(current);
  } else {
    this.currentFile = null;
    this.loadFromFile(this.lastBufferFile);
  }
}

gFMEditor.onload = function () {
  var container = document.getElementById("code-editor-container");
  gFMEditor.editor = new CodeMirror(container, {
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
    saveFunction : function () {
      gFMEditor.save();
    },
    onChange : function () {
      gFMEditor.changesInProgress = true;
    },
    initCallback : function () {
      
      gFMEditor.linesContainer = container.getElementsByClassName("CodeMirror-line-numbers")[0];
      gFMEditor.restorePreviousSession();
      
    }
  });
  
}

gFMEditor.onunload = function () {
  var current = this.currentFile;
  if (!current) {
    this.saveToFile(this.lastBufferFile);
  } else if (this.changesInProgress) {
    var doSave = window.confirm("Save "+current.leafName+" ?");
    if (doSave)
      this.saveToFile(current);
  }
}

