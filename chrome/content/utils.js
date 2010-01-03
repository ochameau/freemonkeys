if (typeof toOpenWindowByType=="undefined") {
   // Venkman needs this but it is not part of the regular xulrunner environment
   function toOpenWindowByType(inType, uri)
   {
     window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
   }
}


function openJavaScriptConsole() {
   var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher);
   wwatch.openWindow(null, "chrome://global/content/console.xul", "_blank",
                    "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar", null);
}


// dump to the js console (xulrunner -jsconsole)
function jsdump(str)
{
  Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService)
            .logStringMessage(str);
}

function jserror(str)
{
    Components.utils.reportError(str);
}
