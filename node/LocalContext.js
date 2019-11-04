"use strict";

var Analyzer = require("scss-analyzer").Analyzer,
    builtinHints =  require("./plugins/builtin.json"),
    FileHandler = require("./FileHandler");

function _getHintDataFromAnalyzer(hintsAnalyzer, file, cursorPos, type) {
    var hints = [],
        imports = [];
    
    switch (type) {
        case "atrule" : {
            hints = hints.concat(builtinHints.atrules);
            break;
        }
        case "variable" : {
            var typeObj = ["variable", "argument", "import"],
                _reqHints = hintsAnalyzer.getHintsForCursorPos(typeObj, cursorPos);
            
            hints = hints.concat(_reqHints.variable);
            hints = hints.concat(_reqHints.argument);
            imports = imports.concat(_reqHints.import);
            break;
        }
        default : {
            var _reqHints = hintsAnalyzer.getHintsForCursorPos([type, "import"], cursorPos);
            
            hints = hints.concat(_reqHints[type]);
            imports = imports.concat(_reqHints.import);
        }
    }
    
    if (type === "function") {
        hints = hints.concat(builtinHints.functions);
    }
    
    if (imports.length) {
        imports = FileHandler.postProcessImports(imports, file);
    }
    
    return {
        hints : hints,
        import : imports
    };
}

function requestHints(request) {
    var file = request.filePath,
        text = request.textFragment,
        type = request.type,
        cursorPos = request.cursorPos;
    
    var hintsAnalyzer = new Analyzer(file, text, 1000),
        result = _getHintDataFromAnalyzer(hintsAnalyzer, file, cursorPos, type);
    
    return result;
}

exports.requestHints = requestHints;