define(function (require, exports, module) {
    "use strict";


    var MainViewManager = brackets.getModule("view/MainViewManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        FileUtils = brackets.getModule("file/FileUtils");

    var _domain = null;

    function getFilePath(file) {
        return file.fullPath || file._path;
    }
    
    function isValidSCSSFile(filepath) {
        return FileUtils.getFileExtension(filepath) === "scss";
    }
    
    function sendFileContentToDomain(evt, request) {
        var doc = DocumentManager.getOpenDocumentForPath(request.filepath);
        if (doc) {
            request.fileContent = doc.getText();
        } else {
            request.err = true;
        }

        _domain.exec("fileContentResponse", request);
    }

    function registerDomain(domain) {
        function attachDomainHandlers(domain) {
            domain.on("requestFileContent", sendFileContentToDomain);
        }

        attachDomainHandlers(domain);
        _domain = domain;
    }

    function _getGlobalHintsLazily(req) {
        var request = extendRequest(req, {}, ["editor", "token", "hints"]);

        return _domain.exec("requestGlobalHints", request);
    }

    function getHintsForRequest(req, params) {
        var hints = $.Deferred(),
            request = extendRequest(req, params, ["editor", "token"]);
        
        var result = _domain.exec("requestHints", request);
        result.done(function (res) {
            hints.resolve(res.hints);

            //Lazy load the global hints if
            //exists on disc
            var doc = req.editor.document;
            if (!doc.isUntitled || request.type !== "atrule") {
                request.import = res.import;
                _getGlobalHintsLazily(request)
                        .done(function (hints) {
                            req.updateHints(hints);
                        });
            }
        }).fail(function () {
            hints.reject();
        });

        return hints.promise();
    }
    
     function _getValidScssFilesFromWorkingSet() {
          var filelist = MainViewManager.getAllOpenFiles();

        filelist = filelist.map(function (file) {
            return getFilePath(file);
        }).filter(function (filepath) {
            return isValidSCSSFile(filepath);
        });

        return filelist;
    }

    function markFileForReanalysis(document) {
        var filepath = getFilePath(document.file);
        
        if (isValidSCSSFile(filepath)) {
            _domain.exec("markFileForReanalysis", filepath);
        }
    }

    function initializeDomain() {
        var filelist = _getValidScssFilesFromWorkingSet();

        return _domain.exec("initializeDomain", filelist);
    }

    function updateOpenFileList(document) {
        var filepath = getFilePath(document.file);
        
        if (isValidSCSSFile(filepath)) {
            var filestatus = {
                filepath: filepath,
                isDirty: document.isDirty
            };

            _domain.exec("updateOpenFileList", filestatus);
        }
    }
    
    function syncDomain(files) {
        files = files.map(function (file) {
            return getFilePath(file);
        }).filter(function (filepath) {
            return isValidSCSSFile(filepath);
        });
        
        _domain.exec("syncDomain", files);
    }
    
    function updateGlobalContext(file) {
        var filepath = getFilePath(file);

        if (isValidSCSSFile(filepath)) {
            _domain.exec("updateGlobalContext", filepath);
        }
    }
    
    function extendRequest(req, defaultParams, filter) {
        var request = defaultParams;
        for (var key in req) {
            if (req.hasOwnProperty(key) && filter.indexOf(key) === -1) {
                request[key] = req[key];
            }
        }

        return request;
    }


    exports.updateOpenFileList      = updateOpenFileList;
    exports.initializeDomain        = initializeDomain;
    exports.registerDomain          = registerDomain;
    exports.getHintsForRequest      = getHintsForRequest;
    exports.extendRequest           = extendRequest;
    exports.markFileForReanalysis   = markFileForReanalysis;
    exports.updateGlobalContext     = updateGlobalContext;
    exports.syncDomain              = syncDomain;
});
