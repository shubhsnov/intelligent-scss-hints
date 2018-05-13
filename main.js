define(function (require, exports, module) {
    "use strict";

    var EditorManager = brackets.getModule("editor/EditorManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        NodeDomain = brackets.getModule("utils/NodeDomain"),
        AppInit = brackets.getModule("utils/AppInit"),
        FileUtils = brackets.getModule("file/FileUtils"),
        CodeHintManager = brackets.getModule("editor/CodeHintManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        MainViewManager = brackets.getModule("view/MainViewManager"),
        RequestInterface = require("RequestInterface"),
        ScssHintUtils = require("ScssHintUtils"),
        HintRequestModule = require("HintRequestModule"),
        Request = HintRequestModule.Request;

    var _ = brackets.getModule("thirdparty/lodash");

    var analysisMessageHandler = null,
        fileToBeAnalyzed = null;

    var _domainPath = ExtensionUtils.getModulePath(module, "node/ScssHintsDomain");
    var scssHintsDomain = new NodeDomain("ScssHintsDomain", _domainPath);

    RequestInterface.registerDomain(scssHintsDomain);

    function SCSSHints() {

    }

    SCSSHints.prototype.hasHints = function (editor, prevKey) {
        var req = new Request(editor);
        req.inferType(prevKey);
        HintRequestModule.setCurrentRequest(req);

        return ScssHintUtils.isHintableRequest(req, prevKey);
    };



    SCSSHints.prototype.getHints = function (prevKey) {
        var hintPromise = $.Deferred(),
            req = HintRequestModule.getCurrentRequest(true);

        if (req && req.query.trim() === "") {
            return null;
        }

        if (this.needNewHints(req)) {
            HintRequestModule.resetCachedRequest();
            var requestParams = ScssHintUtils.getRequestParams(req);

            RequestInterface.getHintsForRequest(req, requestParams)
                .then(function (hints) {
                    req.cacheHints(hints);
                    HintRequestModule.setCachedRequest(req);

                    var filteredHints = ScssHintUtils.getFilteredHints(req, hints);
                    var formattedHints = formatHints(req, filteredHints);

                    hintPromise.resolveWith(null, [formattedHints]);
                });
            //TODO : fail
        } else {
            //TODO
            //Use existing hints and then filter using token
            var cachedReq = HintRequestModule.getCachedRequest(),
                hints = ScssHintUtils.getFilteredHints(req, cachedReq.hints); //Add null check for cachedReq.hints
            var formattedHints = formatHints(req, hints);

            hintPromise.resolveWith(null, [formattedHints]);
        }

        return hintPromise;
    };

    SCSSHints.prototype.insertHint = function (hintObj) {
        var hint = hintObj.data("hint"),
            completion = hint.value,
            req = HintRequestModule.getCurrentRequest(true),
            query = req.query,
            cursor = req.pos,
            start = {
                line: cursor.line,
                ch: cursor.ch - query.length
            },
            end = {
                line: cursor.line,
                ch: cursor.ch
            };

        req.editor._codeMirror.replaceRange(completion, start, end);
    };


    SCSSHints.prototype.needNewHints = function (newReq) {
        var cachedReq = HintRequestModule.getCachedRequest();

        return !cachedReq || !cachedReq.hints || !cachedReq.canProvideHintsFor(newReq);
    };

    function formatHints(req, hints) {
        var query,
            formattedHints;

        function formatTypeDataForToken($hintObj, hint) {
            // Add the label for the hint item
            if (hint.stringRanges) {
                hint.stringRanges.forEach(function (item) {
                    if (item.matched) {
                        $hintObj.append($("<span>")
                            .append(_.escape(item.text))
                            .addClass("matched-hint"));
                    } else {
                        $hintObj.append(_.escape(item.text));
                    }
                });
            } else {
                $hintObj.text(hint.value);
            }

            $hintObj.addClass('brackets-scss-hints-with-type-details');
            var source = FileUtils.getBaseName(hint.source);
            var type = hint.type;
            var definition = hint.definition;
            var description = hint.description;

            if (source) {
                $('<span>' + source + '</span>').appendTo($hintObj).addClass("brackets-scsshints-source-details");
            }

            if (type) {
                $('<span></span>').appendTo($hintObj).addClass("brackets-scsshints-type-details").text(type);
            }
            if (definition) {
                $('<span>' + definition + '</span>').appendTo($hintObj).addClass("scsshint-definition");
            }
            if (description) {
                $hintObj.attr('title', description);
                $('<span></span>').text(description.trim()).appendTo($hintObj).addClass("scsshint-description");
            }

            // Add the value which will be inserted when someone selects the hint
            $hintObj.data("hint", hint);

            return $hintObj;
        }

        function doFormatting(hints, query) {
            var results = hints.map(function (hint) {
                var $hintObj = $("<span>").addClass("brackets-scss-hints");
                $hintObj = formatTypeDataForToken($hintObj, hint);

                return $hintObj;
            });

            return results;
        }

        // trim leading and trailing string literal delimiters from the query
        query = req.query.trim();

        if (hints) {
            formattedHints = doFormatting(hints, query);
        } else {
            formattedHints = [];
        }

        return {
            hints: formattedHints,
            match: null,
            selectInitial: true,
            handleWideResults: false
        };
    }

    function addNamespaceToEvent(evt) {
        var namespace = "brackets-scss-hints";
        return evt + "." + namespace;
    }

    function resetCache() {
        HintRequestModule.resetCachedRequest();
    }

    function sendFileAnalysisMessage(document) {
        function _sendFileForAnalysis(file) {
            RequestInterface.updateGlobalContext(file);
            analysisMessageHandler = null;
            fileToBeAnalyzed = null;
        }

        if (analysisMessageHandler && fileToBeAnalyzed) {
            window.clearTimeout(analysisMessageHandler);
            window.setTimeout(_sendFileForAnalysis.bind(null, fileToBeAnalyzed), 2000);
        } else {
            fileToBeAnalyzed = document.file;
            window.setTimeout(_sendFileForAnalysis.bind(null, fileToBeAnalyzed), 2000);
        }
    }

    /*
     * Handle the activeEditorChange event fired by EditorManager.
     * Uninstalls the change listener on the previous editor
     * and installs a change listener on the new editor.
     *
     * @param {Event} event - editor change event (ignored)
     * @param {Editor} current - the new current editor context
     * @param {Editor} previous - the previous editor context
     */
    function handleActiveEditorChange(event, current, previous) {
        // Uninstall "languageChanged" event listeners on previous editor's document & put them on current editor's doc
        if (previous) {
            previous.document
                .off(addNamespaceToEvent("languageChanged"))
                .off(addNamespaceToEvent("documentChange"));

            sendFileAnalysisMessage(previous.document);
        }
        if (current) {
            current.document
                .on(addNamespaceToEvent("languageChanged"), function () {
                    resetCache();
                })
                .one(addNamespaceToEvent("change"), function () {
                    RequestInterface.markFileForReanalysis(current.document);
                });
        }

        resetCache();
    }

    function attachFileListeners() {
        DocumentManager.on(addNamespaceToEvent("dirtyFlagChange"), function (event, changedDoc) {
            RequestInterface.updateOpenFileList(changedDoc);
        });

        var fileEvent = addNamespaceToEvent("workingSetAdd") + " " + addNamespaceToEvent("workingSetRemove");
        MainViewManager.on(fileEvent, function (event, file) {
            RequestInterface.syncDomain([file]);
        });

        var fileListEvent = addNamespaceToEvent("workingSetAddList") + " " + addNamespaceToEvent("workingSetRemoveList");
        MainViewManager.on(fileListEvent, function (event, files) {
            RequestInterface.syncDomain(files);
        });

    }


    AppInit.appReady(function () {
        // uninstall/install change listener as the active editor changes
        EditorManager.on(addNamespaceToEvent("activeEditorChange"),
            handleActiveEditorChange);

        ExtensionUtils.loadStyleSheet(module, "styles/brackets-scss-hints.css");

        RequestInterface.initializeDomain()
            .done(function (complete) {
                if (complete) {
                    attachFileListeners();
                }
            });

        var scssHints = new SCSSHints();
        CodeHintManager.registerHintProvider(scssHints, ["scss"], 100);
    });

});
