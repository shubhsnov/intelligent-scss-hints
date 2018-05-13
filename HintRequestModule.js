define(function (require, exports, module) {
    "use strict";


    var EditorManager = brackets.getModule("editor/EditorManager"),
        ScssHintUtils = require("ScssHintUtils");

    var cachedRequest = null,
        currentRequest = null;


    //Prototype functions
    function Request(editor) {
        var _editor = editor || EditorManager.getActiveEditor(),
            pos = _editor.getCursorPos(),
            file = _editor.getFile(),
            filePath = file.fullpath || file._path,
            token = ScssHintUtils.getToken(_editor, pos),
            query = token.string;

        this.pos = pos;
        this.filePath = filePath || null;
        this.token = token;
        this.query = query;
        this.editor = _editor;
        this.type = null;
    }

    Request.prototype.canProvideHintsFor = function (anotherReq) {
        if (!anotherReq) {
            return false;
        }

        return (this.pos.line === anotherReq.pos.line &&
            this.filePath === anotherReq.filePath &&
            //               this.token === anotherReq.token &&
            this.type === anotherReq.type);
    };

    Request.prototype.inferType = function (prevKey) {
        this.type = ScssHintUtils.getTypeForRequest(this, prevKey);
    };

    Request.prototype.refresh = function () {
        this.pos = this.editor.getCursorPos(),
            this.token = ScssHintUtils.getToken(this.editor, this.pos);

        this.query = this.token.string;

        if (this.token.end > this.pos.ch) {
            this.query = this.query.substr(0, this.pos.ch - this.token.start);
        }
    };

    Request.prototype.cacheHints = function (hints) {
        this.hints = hints;
    };

    Request.prototype.updateHints = function (hints) {
        this.hints = this.hints || [];
        this.hints = this.hints.concat(hints);
    };



    function getCachedRequest() {
        return cachedRequest;
    }

    function setCachedRequest(req) {
        cachedRequest = req;
    }

    function resetCachedRequest() {
        setCachedRequest(null);
    }

    function getCurrentRequest(refresh) {
        if (refresh) {
            currentRequest.refresh();
        }

        return currentRequest;
    }

    function setCurrentRequest(req) {
        currentRequest = req;
    }


    exports.Request = Request;
    exports.getCachedRequest = getCachedRequest;
    exports.setCachedRequest = setCachedRequest;
    exports.getCurrentRequest = getCurrentRequest;
    exports.getCurrentRequest = getCurrentRequest;
    exports.setCurrentRequest = setCurrentRequest;
    exports.resetCachedRequest = resetCachedRequest;
});
