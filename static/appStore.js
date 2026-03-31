export const state = {
    nodes: new Map(),
    nextId: 100,
    selectedNodeId: null,
    consoleMode: 'detail',
    activeConsoleTab: 'run',
    debugCurrentNodeId: null
};

if (typeof window !== 'undefined') {
    window.state = state;
}

export function setNodes(newNodes) {
    state.nodes = newNodes;
}

export function setNextId(id) {
    state.nextId = id;
}

export function setSelectedNodeId(id) {
    state.selectedNodeId = id;
}

export function setConsoleMode(mode) {
    if (mode === 'detail' || mode === 'result') {
        state.consoleMode = mode;
    }
}

export function setActiveConsoleTab(tab) {
    if (tab === 'run' || tab === 'debug') {
        state.activeConsoleTab = tab;
    }
}

export function setDebugCurrentNodeId(id) {
    state.debugCurrentNodeId = typeof id === 'number' ? id : null;
}
