
"use strict";

var _domainManager,
    FileHandler = require("./FileHandler"),
    ContextManager = require("./ContextManager");

function requestHints(request) {
    var retval = {
            hints : [],
            import : []
        },
        response = ContextManager.requestHints(request);
    
    if (response) {
        retval = response;
    }
    
    return retval;
}

function requestGlobalHints(request) {
    var hints = [],
        response = ContextManager.requestGlobalHints(request);
    
    if (response) {
        hints = response;
    }
    
    return hints;
}


//return something to show initialization
function initializeDomain(filelist) {
    FileHandler.initializeOpenFilesList(filelist);
    ContextManager.initializeGlobalContext(filelist);
    return true;
}

function markFileForReanalysis(filepath) {
    ContextManager.markFileForReanalysis(filepath);
}

function updateOpenFileList(filestatus) {
    FileHandler.updateOpenFilesList(filestatus);
}

function syncDomain(files) {
    FileHandler.syncOpenFilesList(files);
    ContextManager.syncGlobalContext(files);
}

function receiveFileContent(response) {
    FileHandler.receiveFileContent(response);
}

function updateGlobalContext(filepath) {
    ContextManager.updateGlobalContext(filepath);
}

function init(domainManager) {
    if (!domainManager.hasDomain("ScssHintsDomain")) {
        domainManager.registerDomain("ScssHintsDomain", {
            major: 0,
            minor: 1
        });
    }

    _domainManager = domainManager;

    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "requestHints", // command name
        requestHints, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );

    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "requestGlobalHints", // command name
        requestGlobalHints, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );
    
    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "markFileForReanalysis", // command name
        markFileForReanalysis, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );

    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "updateOpenFileList", // command name
        updateOpenFileList, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );
    
    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "syncDomain", // command name
        syncDomain, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );

     _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "updateGlobalContext", // command name
        updateGlobalContext, // command handler function
        false, // this command is asynchronous in Node
        "", []  //TODO
    );
    
    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "initializeDomain", // command name
        initializeDomain, // command handler function
        false, // this command is asynchronous in Node
        "", []  //TODO
    );

    _domainManager.registerCommand(
        "ScssHintsDomain", // domain name
        "fileContentResponse", // command name
        receiveFileContent, // command handler function
        false, // this command is asynchronous in Node
        "Invokes a hint request command on node", []
    );

    _domainManager.registerEvent(
        "ScssHintsDomain",
        "requestFileContent",
        []
    );

    ContextManager.registerDomainManager(_domainManager);
    FileHandler.registerDomainManager(_domainManager);
}

exports.init = init;
