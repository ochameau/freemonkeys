// TODO: catch callbacks exceptions

var http = {};

http._httpd = {};
Components.utils.import("resource://fm-network/httpd.js", http._httpd);

http._server = new http._httpd.nsHttpServer();

http.start = function (port) {
  if (!port)
    port = 80;
  http._server.registerContentType("sjs", http._httpd.SJS_TYPE);
  http._server.identity.setPrimary("http", "localhost", port);
  http._server.start(port);
}

http.stop = function () {
  if (!http._server.isStopped())
    http._server.stop(function () {});
}

http.registerDirectory = function (serverPath, localPath) {
  
  var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath(localPath);
  if (file.exists())
    http._server.registerDirectory("/", file);
  
}

http.registerPathHandler = function (path, handler) {
  http._server.registerPathHandler(path, function (request, response) {
    handler(request, response);
    /*
    // request/response API example:
    if (request.hasHeader("Cookie"))
      var cookies = request.getHeader("Cookie");
    response.setHeader("Set-Cookie","var=value");
    response.write("<html>...</html>");
    */
  });
}

http.registerPathResponse = function (path, content, headers, notOneShot) {
  http._server.registerPathHandler(path, function (request, response) {
    if (headers) {
      for(var name in headers) {
        response.setHeader(name, headers[name]);
      }
    }
    response.write(content);
    
    if (!notOneShot) {
      // Unregister path handler
      http._server.registerFile(path,null);
    }
  });
}

http.assertGetRequest = function assertGetRequest(path, timeout) {
  var callee = Components.stack;
  
  var asyncTest = assert._asyncTest([path, timeout], Components.stack, timeout);
  
  http._server.registerPathHandler(path, function (request, response) {
    try {
      http._server.registerFile(path,null);
      response.write("http.assertGetRequest OK");
      asyncTest.pass();
    } catch(e) {
      ___api_callback_exception(e, callee);
    }
  });
  return asyncTest;
}

