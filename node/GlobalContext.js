"use strict";

var Analyzer = require("scss-analyzer").Analyzer,
    FileHandler = require("./FileHandler");

var globalContext = {},
    REQUEST_BUDGET = 10000; //Will not analyze more than these many files in one go.

function update(file, budget) {
    var createNewAnalyzer = false,
        shouldUpdateContext = false,
        budget = budget || 0;
    
    if (budget > REQUEST_BUDGET) {
        return;
    }

    if (!globalContext[file] || !globalContext[file].analyzer) {
        createNewAnalyzer = true;
        shouldUpdateContext = true;
    } else if (globalContext[file].needsAnalysis) {
        shouldUpdateContext = true;
    }

    if (shouldUpdateContext) {
        FileHandler.getText(file)
            .then(function (text) {
                if (createNewAnalyzer) {
                    globalContext[file] = {
                        analyzer: new Analyzer(file, text, 1000)
                    };
                } else {
                    globalContext[file].analyzer.reset(file, text);
                }

                var imports = globalContext[file].analyzer.getAllHints().import;
                globalContext[file].needsAnalysis = false;

                imports = FileHandler.postProcessImports(imports, file);
                imports.forEach(function (importedFile) {
                    update(importedFile, ++budget);
                });
            });
    }
}

function initialize(filelist) {
    filelist.forEach(function (file) {
        globalContext[file] = {
            needsAnalysis: true
        };
        update(file);
    });
}

function markFileForReanalysis(filepath) {
    if (!globalContext[filepath]) {
        globalContext[filepath] = {
            needsAnalysis: true
        };
    } else {
        globalContext[filepath].needsAnalysis = true;
    }
}

function sync(files) {
    files.forEach(function (file) {
        update(file);
    });
}


function requestHints(request, budget) {
    var files = request.import,
        type = request.type,
        budget = budget || 0;
    
    if (budget > REQUEST_BUDGET) {
        return;
    }

    var hints = [];

    files.forEach(function (file) {
        if (globalContext[file] && globalContext[file].analyzer) {
            var _allHints = globalContext[file].analyzer.getAllGlobalHints(),
                _fileHints = [].concat(_allHints[type]);
            
            var imports = FileHandler.postProcessImports(_allHints.import, file);
            imports.forEach(function (importedFile) {
                var _importHints = requestHints({
                    import : imports,
                    type : type
                }, ++budget);
                
                _fileHints = _fileHints.concat(_importHints);
            });
            
            hints = hints.concat(_fileHints);
        }
    });

    return hints;
}

exports.initialize = initialize;
exports.markFileForReanalysis = markFileForReanalysis;
exports.update = update;
exports.sync = sync;
exports.requestHints = requestHints;
