// Support directly assign to exports in goog module.
// var PI = 3.14;
// exports = { PI };

const ModuleDependency = require('webpack/lib/dependencies/ModuleDependency');

class GoogleExportsDependency extends ModuleDependency {
  constructor(request, range) {
    super(request);
    this.start = range[0];
    this.end = range[1];
  }

  get type() {
    return 'google module exports style';
  }
}

GoogleExportsDependency.Template = class GoogleExportsDependencyTemplate {
  apply(dep, source) {
    source.replace(dep.start, dep.end - 1, 'module.exports');
  }
}

module.exports = GoogleExportsDependency;