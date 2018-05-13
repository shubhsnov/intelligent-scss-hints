"use strict";

var GlobalContext = require("./GlobalContext"),
    LocalContext = require("./LocalContext");

//Timeout

var _domainManager,
    isAnalysisInProgress = false;

function startAnalysis() {
    isAnalysisInProgress = true;
}

function endAnalysis() {
    isAnalysisInProgress = false;
}

function canStartAnalysis() {
    return !isAnalysisInProgress;
}

function safeExecute(fn, args) {
    var retval = false;
    if (canStartAnalysis()) {
        startAnalysis();
        retval = fn.apply(null, args);
        endAnalysis();
    }

    return retval;
}

function initializeGlobalContext(filelist) {
    safeExecute(GlobalContext.initialize, arguments);
}

function markFileForReanalysis(filelist) {
    safeExecute(GlobalContext.markFileForReanalysis, arguments);
}

function registerDomainManager(domainManager) {
    _domainManager = domainManager;
}

function updateGlobalContext(filepath) {
    safeExecute(GlobalContext.update, arguments);
}

function syncGlobalContext(files) {
    safeExecute(GlobalContext.sync, arguments);
}

function requestGlobalHints(request) {
    return safeExecute(GlobalContext.requestHints, arguments);
}

function requestHints(request) {
    return LocalContext.requestHints(request);
}

exports.initializeGlobalContext = initializeGlobalContext;
exports.registerDomainManager = registerDomainManager;
exports.markFileForReanalysis = markFileForReanalysis;
exports.updateGlobalContext = updateGlobalContext;
exports.syncGlobalContext = syncGlobalContext;
exports.requestGlobalHints = requestGlobalHints;
exports.requestHints = requestHints;
