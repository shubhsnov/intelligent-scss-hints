"use strict";

var fs      = require("fs"),
    EventEmitter = require('events'),
    crypto  = require("crypto"),
    pathUtils = require("path");


class BracketsEventEmitter extends EventEmitter {};
var bracketsEvent = new BracketsEventEmitter();
var _domainManager;

var openFilesList = {};

function initializeOpenFilesList(filelist) {
    filelist.forEach(function (file) {
        openFilesList[file] = {
            isDirty : false
        };
    });
}

function updateOpenFilesList(filestatus) {
    openFilesList[filestatus.filepath] = {
        isDirty : filestatus.isDirty
    };
}

function syncOpenFilesList(files) {
    files.forEach(function (file) {
        openFilesList[file] = {
            isDirty : false
        };
    })
}

function registerDomainManager(domainManager) {
    _domainManager = domainManager;
}

function _getTextFromBrackets(filepath) {
    return new Promise(function (resolve, reject) {
        var filePathHash = crypto.createHash('md5').update(filepath).digest('hex');
        var requestObj = {
            filepath: filepath,
            requestKey: filePathHash
        }
        var responseEvent = "fileContentResponse." + filePathHash.toString()
        _domainManager.emitEvent("ScssHintsDomain", "requestFileContent", [requestObj]);

        bracketsEvent.once(responseEvent, function (err, content) {
            if (!err) {
                resolve(content);
            } else {
                reject(err);
            }
        });
    });
}

function _getTextFromFileSystem(filepath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filepath, {
            encoding: "utf8"
        }, function (err, content) {
            if (!err) {
                resolve(content);
            } else {
                reject(err);
            }
        });
    });
}

function getText(filepath) {
    if (openFilesList[filepath] && openFilesList[filepath].isDirty) {
        return _getTextFromBrackets(filepath);
    } else {
        return _getTextFromFileSystem(filepath);
    }
}

function receiveFileContent(response) {
    var event = "fileContentResponse." + response.requestKey;
    if (response.fileContent) {
        bracketsEvent.emit(event, false, response.fileContent);
    } else {
        bracketsEvent.emit(event, true);
    }
}

//TODO : congif.rb file, if defined, the paths need to be relative to that as well
function resolveImports(id, parentPath) {
    if (!id) {
        return "";
    }
    
    var replaceSingleQuotesReg = /'/g;
    id = id.replace(replaceSingleQuotesReg, "");

    var replaceReg = /\\/g;
    var resolvedPath = pathUtils.resolve(id).replace(replaceReg, '/');

    if (id !== resolvedPath) {
        resolvedPath = pathUtils.resolve(parentPath, id).replace(replaceReg, '/');
    }

    var base = pathUtils.basename(resolvedPath),
        dir = pathUtils.dirname(resolvedPath),
        files = [];

    if (base.endsWith(".scss")) {
        var filePath = pathUtils.resolve(dir, base).replace(replaceReg, '/');
        if (fs.existsSync(filePath)) {
            files.push(filePath);
        }

        if (!base.startsWith('_')) {
            filePath = pathUtils.resolve(dir, '_' + base).replace(replaceReg, '/');
            if (fs.existsSync(filePath)) {
                files.push(filePath);
            }
        }
    } else {
        var filePath = pathUtils.resolve(dir, base + ".scss").replace(replaceReg, '/');
        if (fs.existsSync(filePath)) {
            files.push(filePath);
        }

        if (!base.startsWith('_')) {
            filePath = pathUtils.resolve(dir, '_' + base + ".scss").replace(replaceReg, '/');
            if (fs.existsSync(filePath)) {
                files.push(filePath);
            }
        }
    }

    if (files.length === 1) {
        return files[0];
    } else {
        return "";
    }
}


function postProcessImports(imports, parentFilePath) {
    var parentDir = pathUtils.dirname(parentFilePath);

    imports = imports.map(function (importObj) {
        return resolveImports(importObj.value, parentDir);
    }).filter(function (importPath) {
        return importPath.length;
    });

    return imports;
}


exports.getText = getText;
exports.initializeOpenFilesList = initializeOpenFilesList;
exports.updateOpenFilesList = updateOpenFilesList;
exports.syncOpenFilesList = syncOpenFilesList;
exports.registerDomainManager = registerDomainManager;
exports.receiveFileContent = receiveFileContent;
exports.postProcessImports = postProcessImports;