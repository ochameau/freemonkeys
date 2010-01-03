
Array.prototype.remove=function(s){ for(var i=0;i<this .length;i++){ if(s==this[i]) {this.splice(i, 1);} } }

var firefoxSessions = {
  _list : [],
  getNextId : function () {
    var id=this._list.length+1;
    this._list.push(id);
    this._notify(this.EVENT_ADD,id);
    return id;
  },
  removeSession : function(id) {
    this._list.remove(id);
    this._notify(this.EVENT_REMOVE,id);
  },
  _obs : [],
  EVENT_ADD : "add-session",
  EVENT_REMOVE : "remove-session",
  addObserver : function (o) {
    for(var i=0;i<this._list.length;i++) {
      o.observe(this.EVENT_ADD,this._list[i]);
    }
    this._obs.push(o);
  },
  removeObserver : function (o) {
    this._obs.remove(o);
  },
  _notify : function(topic, id) {
    for(var i=0;i<this._obs.length;i++) {
      try {
        this._obs[i].observe(topic,id);
      } catch(e) {
        Components.utils.reportError(e);
      }
    }
  },
  _colors : ["FFC0C0","C0FFC0","C0C0FF","FFC0FF","C0FFFF","FFFFC0"],
  getColorFor : function (id) {
    return "#"+this._colors[id-1];
  },
  getProfileList : function () {
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                      .getService(Components.interfaces.nsIProperties)
                      .get("resource:app", Components.interfaces.nsIFile);
    file.append("profiles");
    var entries = file.directoryEntries;
    var profiles=[];
    while(entries.hasMoreElements())
    {
      var entry = entries.getNext();
      entry.QueryInterface(Components.interfaces.nsIFile);
      profiles.push(entry.leafName);
    }
    return profiles;
  }
};

