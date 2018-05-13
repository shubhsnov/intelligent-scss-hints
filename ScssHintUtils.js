define(function (require, exports, module) {
    "use strict";
    var _ = brackets.getModule("thirdparty/lodash");

    var DocumentManager = brackets.getModule("document/DocumentManager"),
        StringMatch = brackets.getModule("utils/StringMatch"),
        TokenUtils = brackets.getModule("utils/TokenUtils");

    var matcher = new StringMatch.StringMatcher({
        preferPrefixMatches: true
    });

    function getToken(editor, cursor) {
        var cm = editor._codeMirror,
            pos = cursor;
        return TokenUtils.getTokenAt(cm, pos, true);
    };

    function getPreviousToken(editor, cursor) {
        var cm = editor._codeMirror,
            pos = _.cloneDeep(cursor);
        var ctx = TokenUtils.getInitialContext(cm, pos);
        TokenUtils.moveSkippingWhitespace(TokenUtils.movePrevToken, ctx);
        return ctx.token;
    };

    function getRequestParams(req) {
        var filepath = req.filePath,
            doc = DocumentManager.getOpenDocumentForPath(filepath);

        //Always start from the start of the document
        var start = {
                line: 0,
                ch: 0
            },
            end = _.cloneDeep(req.pos);

        var token = req.token,
            context = token.state.context,
            nest = 0;

        while (context.type !== "top") {
            if (context.type === "block") {
                nest++;
            }

            context = context.prev;
        }

        var textFragment = doc.getRange(start, end);

        //Revisit this logic
        var closeScope;
        if (nest) {
            closeScope = Array(nest + 1).join("}");
        } else {
            closeScope = "{}";
        }
        textFragment = textFragment + "   " + closeScope;

        return {
            cursorPos: {
                line: req.pos.line + 1,
                column: req.pos.ch
            },
            textFragment: textFragment
        };
    }

    function _resolveQueryWithType(query) {
        var type = "default";

        switch (query.token.type) {
        case "qualifier":
            type = "class";
            break;
        case "builtin":
            type = "id";
            break;
        case "string":
            type = "string";
            break;
        case "variable-2":
            {
                if (query.token.state.state !== 'at') {
                    type = "variable";
                } else {
                    if (query.prevToken.string === ':') {
                        type = "variable";
                    }
                }
                break;
            }
        case "variable":
            type = "function";
            break;
        case "def":
            type = "atrule";
            break;
        }

        if (type === "default") {
            switch (query.token.type) {
            case null:
                {
                    var len = query.token.string.length;
                    switch (query.token.string[len - 1]) {
                    case "[":
                        type = "attribute";
                        break;
                    case "%":
                        type = "placeholder";
                        break;
                    }
                }
            case "tag":
                {
                    switch (query.prevToken.string) {
                    case "@include":
                        type = "mixin";
                        break;
                    case "@return":
                        type = "function";
                        break;
                    }
                    //Edge case
                    if (type === "default") {
                        var len = query.prevToken.string.length;
                        switch (query.prevToken.string[len - 1]) {
                        case "[":
                            type = "attribute";
                            break;
                        case "%":
                            type = "placeholder";
                            break;
                        }
                    }
                }
            }
        }

        if (type === "default") {
            if (query.prevKey === "." && query.token.state.state !== 'atBlock') {
                type = "class";
            }
        }

        return type;
    }

    function getTypeForRequest(req, prevKey) {
        prevKey = prevKey || _getPreviousKey(req);

        var token = req.token,
            previousToken = getPreviousToken(req.editor, req.pos);

        var query = {
            token: token,
            prevToken: previousToken,
            prevKey: prevKey
        };

        return _resolveQueryWithType(query);
    }

    function _getPreviousKey(req) {
        function getRangePos(pos) {
            return {
                start: {
                    line: pos.line,
                    ch: pos.ch - 1
                },
                end: pos
            };
        }

        if (!req.pos.ch) {
            return "\n";
        }
        var filepath = req.filePath,
            doc = DocumentManager.getOpenDocumentForPath(filepath);

        var range = getRangePos(req.pos);
        return doc.getRange(range.start, range.end);

    }

    function isHintableRequest(req) {
        var hintable = false;

        switch (req.type) {
        case "class":
        case "id":
        case "function":
        case "mixin":
        case "placeholder":
        case "attribute":
        case "variable":
        case "atrule":
            hintable = true;
            break;
        default:
            hintable = false;
        }

        return hintable;
    }

    //Revisit this : TODO
    function penalizeUnderscoreValueCompare(a, b) {
        var aName = a.value.toLowerCase(),
            bName = b.value.toLowerCase();

        if (aName[0] === "_" && bName[0] !== "_") {
            return 1;
        } else if (bName[0] === "_" && aName[0] !== "_") {
            return -1;
        }
        if (aName < bName) {
            return -1;
        } else if (aName > bName) {
            return 1;
        }
        return 0;
    }

    function getFilteredHints(req, hints) {

        function getUniqueHints(hints) {
            var hash = {};
            var uniqueHints = [];
            var len = hints.length;
            for(var i = len - 1; i >= 0; i--) {
                var item = hints[i];
                if(hash[item.value] !== 1) {
                    hash[item.value] = 1;
                    uniqueHints.unshift(item);
                }
            }
            return uniqueHints;
        }

        var query = req.query;

        if (query === undefined) {
            query = "";
        }

        var MAX_DISPLAYED_HINTS = 500,
            type = req.type,
            filteredHints;

        function filterWithQueryAndMatcher(hints, matcher) {
            var matchResults = $.map(hints, function (hint) {
                var searchResult = matcher.match(hint.value, query);
                if (searchResult) {
                    for (var key in hint) {
                        searchResult[key] = hint[key];
                    }
                }

                return searchResult;
            });

            return matchResults;
        }

        filteredHints = hints || [];
        filteredHints = filterWithQueryAndMatcher(filteredHints, matcher);
        StringMatch.multiFieldSort(filteredHints, ["matchGoodness", "blocklevel", penalizeUnderscoreValueCompare]);
        filteredHints = getUniqueHints(filteredHints);

        if (filteredHints.length > MAX_DISPLAYED_HINTS) {
            filteredHints = filteredHints.slice(0, MAX_DISPLAYED_HINTS);
        }

        return filteredHints;
    };

    exports.getToken = getToken;
    exports.getPreviousToken = getPreviousToken;
    exports.getTypeForRequest = getTypeForRequest;
    exports.createRequestForDomain = getTypeForRequest;
    exports.getFilteredHints = getFilteredHints;
    exports.getRequestParams = getRequestParams;
    exports.isHintableRequest = isHintableRequest;
});
