const gFMReport = {
  
  get reportList () {
    delete this.reportList;
    this.reportList = document.getElementById("report-list");
    return this.reportList;
  }
  
};

gFMReport.clean = function () {
  this.reportList.innerHTML = "";
}

gFMReport.print = function (classname, type, msg) {
  this.reportList.innerHTML += '<li class="'+classname+'">'+type+" : "+msg+"</li>";
}
