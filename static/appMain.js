import { state, setActiveConsoleTab, setDebugCurrentNodeId } from './appStore.js';
import { addConsoleLog, clearConsole, displayLogs, showModal } from './appUtils.js';
import { createNode, renderCanvas, setSelectedNode, deleteNodeById } from './nodeManager.js';
import { initFileMenu } from './menuFile.js';
import { initProjectMenu } from './menuProject.js';
import { initSettingsMenu } from './menuSettings.js';
import { initWindowMenu } from './menuWindow.js';

let debugSessionId = null;

function prepareDebugToolbar() {
    const topRight = document.querySelector('.top-right');
    if (!topRight) return;

    topRight.innerHTML = `
        <button class="run-button" id="runWorkflowBtn" title="运行工作流">运行工作流</button>
        <button class="run-button debug-start-button" id="startDebugBtn" title="进入调试模式">开始调试</button>
        <div class="debug-actions" id="debugActionGroup" style="display:none;">
            <span class="debug-status-badge" id="debugStatusBadge">调试中</span>
            <button class="run-button debug-action-button" id="debugContinueBtn" title="继续运行到断点或结束" disabled>继续</button>
            <button class="run-button debug-action-button" id="debugStepBtn" title="执行下一步" disabled>单步执行</button>
            <button class="run-button debug-stop-button" id="debugStopBtn" title="停止调试" disabled>停止</button>
        </div>
    `;
}

function prepareConsolePanel() {
    const panel = document.querySelector('.console-panel');
    if (!panel) return;

    panel.innerHTML = `
        <div class="console-header">
            <div class="console-tabs">
                <button class="console-tab active" data-console-tab="run">运行控制台</button>
                <button class="console-tab" data-console-tab="debug">调试控制台</button>
            </div>
            <button class="clear-console" id="clearConsoleBtn" title="清空当前控制台输出">清空当前</button>
        </div>
        <div class="console-body">
            <div class="console-view active" id="runConsoleView">
                <div class="console-output" id="consoleOutput">
                    <div class="log-line console-placeholder">准备就绪，拖拽组件到画布并运行工作流查看结果。</div>
                </div>
            </div>
            <div class="console-view" id="debugConsoleView">
                <div class="debug-console-layout">
                    <div class="debug-overview">
                        <div class="debug-section">
                            <div class="debug-section-title">当前暂停节点</div>
                            <div class="debug-box" id="debugCurrentNodeBox">（未开始调试）</div>
                        </div>
                        <div class="debug-section">
                            <div class="debug-section-title">调用栈 / 上下文</div>
                            <div class="debug-box" id="debugStackBox">（未开始调试）</div>
                        </div>
                        <div class="debug-section">
                            <div class="debug-section-title">变量</div>
                            <div class="debug-box" id="debugVarsBox">（未开始调试）</div>
                        </div>
                    </div>
                    <div class="debug-log-panel">
                        <div class="debug-section-title">调试输出</div>
                        <div class="console-output debug-console-output" id="debugConsoleOutput">
                            <div class="log-line console-placeholder">进入调试模式后，这里会输出当前节点、断点命中和单步执行信息。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initDragDrop() {
    const comps = document.querySelectorAll('.comp-item');
    const canvasArea = document.getElementById('canvasArea');

    if (!canvasArea) {
        addConsoleLog('画布区域未找到，拖拽功能可能失效', 'error');
        return;
    }

    comps.forEach(comp => {
        comp.addEventListener('dragstart', (e) => {
            const type = comp.getAttribute('data-type');
            if (!type) return;
            e.dataTransfer.setData('text/plain', type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    canvasArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    canvasArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const type = e.dataTransfer.getData('text/plain');
        if (!type) return;

        const rect = canvasArea.getBoundingClientRect();
        let x = e.clientX - rect.left - 90;
        let y = e.clientY - rect.top - 40;
        x = Math.max(20, Math.min(x, rect.width - 200));
        y = Math.max(20, Math.min(y, rect.height - 100));

        const newNode = createNode(type, x, y);
        if (!newNode) {
            addConsoleLog(`创建节点失败：类型 ${type}`, 'error');
            return;
        }

        state.nodes.set(newNode.id, newNode);
        renderCanvas();
        setSelectedNode(newNode.id);
        addConsoleLog(`已添加 ${type} 节点，ID:${newNode.id}`, 'info');
    });
}

function setConsoleTab(tab) {
    setActiveConsoleTab(tab);

    document.querySelectorAll('[data-console-tab]').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-console-tab') === tab);
    });

    const runView = document.getElementById('runConsoleView');
    const debugView = document.getElementById('debugConsoleView');

    if (runView) runView.classList.toggle('active', tab === 'run');
    if (debugView) debugView.classList.toggle('active', tab === 'debug');
}

function setDebugUiRunning(running, statusText = '') {
    const startBtn = document.getElementById('startDebugBtn');
    const actionGroup = document.getElementById('debugActionGroup');
    const continueBtn = document.getElementById('debugContinueBtn');
    const stepBtn = document.getElementById('debugStepBtn');
    const stopBtn = document.getElementById('debugStopBtn');
    const statusBadge = document.getElementById('debugStatusBadge');

    if (startBtn) startBtn.style.display = running ? 'none' : '';
    if (actionGroup) actionGroup.style.display = running ? 'flex' : 'none';
    if (continueBtn) continueBtn.disabled = !running;
    if (stepBtn) stepBtn.disabled = !running;
    if (stopBtn) stopBtn.disabled = !running;
    if (statusBadge) statusBadge.textContent = statusText || (running ? '调试中' : '未调试');
}

function renderDebugState(debugState) {
    const currentNodeBox = document.getElementById('debugCurrentNodeBox');
    const stackBox = document.getElementById('debugStackBox');
    const varsBox = document.getElementById('debugVarsBox');

    if (currentNodeBox) currentNodeBox.textContent = debugState?.currentNodeText || '（未开始调试）';
    if (stackBox) stackBox.textContent = debugState?.stackText || '（未开始调试）';
    if (varsBox) varsBox.textContent = debugState?.varsText || '（未开始调试）';

    setDebugCurrentNodeId(debugState?.currentId ?? null);
    renderCanvas();
    setDebugUiRunning(Boolean(debugSessionId), debugState?.statusText || (debugSessionId ? '调试中' : '未调试'));
}

function appendDebugSnapshot(debugState, title) {
    if (!debugState) return;

    const lines = [];
    if (title) lines.push(title);

    if (debugState.currentNode) {
        const node = debugState.currentNode;
        lines.push(`暂停在节点: ${node.name} (#${node.id}, ${node.type})`);
    } else {
        lines.push('当前没有可执行节点，调试会话已结束。');
    }

    if (debugState.loopText) {
        lines.push(`循环上下文: ${debugState.loopText}`);
    }

    addConsoleLog(lines.join('\n'), 'debug', 'debug');
}

async function runWorkflow() {
    setConsoleTab('run');

    const data = { nodes: Array.from(state.nodes.values()) };
    try {
        const response = await fetch('/api/workflow/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.logs && result.logs.length) {
            displayLogs(result.logs);
        } else {
            clearConsole('run');
            addConsoleLog('执行完成，无输出日志', 'run', 'run');
        }
    } catch (e) {
        addConsoleLog(`执行时发生错误: ${e.message}`, 'error', 'run');
    }
}

async function debugStart() {
    setConsoleTab('debug');
    clearConsole('debug');

    const data = { nodes: Array.from(state.nodes.values()) };

    try {
        const resp = await fetch('/api/debug/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();

        if (!resp.ok) {
            addConsoleLog(`进入调试失败: ${result.error || resp.status}`, 'error', 'debug');
            return;
        }

        debugSessionId = result.session_id;
        renderDebugState(result.state);
        addConsoleLog('已进入调试模式，可以开始单步执行或继续运行。', 'info', 'debug');
        appendDebugSnapshot(result.state, '调试已就绪');
    } catch (e) {
        addConsoleLog(`进入调试失败: ${e.message}`, 'error', 'debug');
    }
}

async function runDebugAction(endpoint, failLabel, snapshotTitle) {
    if (!debugSessionId) return;

    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: debugSessionId })
        });
        const result = await resp.json();

        if (!resp.ok) {
            addConsoleLog(`${failLabel}: ${result.error || resp.status}`, 'error', 'debug');
            return;
        }

        setConsoleTab('debug');

        if (Array.isArray(result.logs)) {
            result.logs.forEach(line => addConsoleLog(line, 'run', 'debug'));
        }

        renderDebugState(result.state);
        appendDebugSnapshot(result.state, snapshotTitle);

        if (result.finished) {
            debugSessionId = null;
            renderDebugState(result.state);
            addConsoleLog('调试已结束。', 'info', 'debug');
        }
    } catch (e) {
        addConsoleLog(`${failLabel}: ${e.message}`, 'error', 'debug');
    }
}

async function debugStep() {
    await runDebugAction('/api/debug/step', '单步执行失败', '单步执行后暂停');
}

async function debugContinue() {
    await runDebugAction('/api/debug/continue', '继续执行失败', '继续执行后暂停');
}

async function debugStop() {
    if (!debugSessionId) return;

    try {
        await fetch('/api/debug/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: debugSessionId })
        });
    } catch (e) {
        addConsoleLog(`停止调试时发生错误: ${e.message}`, 'error', 'debug');
    }

    debugSessionId = null;
    renderDebugState(null);
    setConsoleTab('debug');
    addConsoleLog('调试已手动停止。', 'info', 'debug');
}

function initDemoFlow() {
    const start = createNode('start', 50, 80);
    const print1 = createNode('print', 280, 80);
    print1.properties.message = '开始执行农业监测任务';

    const loopNode = createNode('loop', 280, 220);
    loopNode.properties.loopCount = 2;

    const innerPrint = createNode('print', 500, 150);
    innerPrint.properties.message = '循环体内部：检查土壤湿度';

    const branchNode = createNode('branch', 500, 320);
    branchNode.properties.branchCondition = true;

    const truePrint = createNode('print', 740, 280);
    truePrint.properties.message = '条件满足：开启灌溉阀门';

    const falsePrint = createNode('print', 740, 400);
    falsePrint.properties.message = '条件不满足：保持待机';

    start.properties.nextNodeId = print1.id;
    print1.properties.nextNodeId = loopNode.id;

    loopNode.properties.bodyNodeIds = [innerPrint.id];
    innerPrint.parentId = loopNode.id;
    innerPrint.localX = 20;
    innerPrint.localY = 20;
    loopNode.properties.nextNodeId = branchNode.id;

    branchNode.properties.trueBodyNodeIds = [truePrint.id];
    branchNode.properties.falseBodyNodeIds = [falsePrint.id];

    truePrint.parentId = branchNode.id;
    truePrint.properties.branchSide = 'true';
    truePrint.localX = 20;
    truePrint.localY = 28;

    falsePrint.parentId = branchNode.id;
    falsePrint.properties.branchSide = 'false';
    falsePrint.localX = 20;
    falsePrint.localY = 28;

    [start, print1, loopNode, innerPrint, branchNode, truePrint, falsePrint].forEach(node => {
        state.nodes.set(node.id, node);
    });

    renderCanvas();
    addConsoleLog('已加载示例工作流，可直接运行或进入调试模式查看效果。', 'info', 'run');
}

function bindConsoleTabs() {
    document.querySelectorAll('[data-console-tab]').forEach(button => {
        button.onclick = () => {
            const tab = button.getAttribute('data-console-tab');
            if (tab) setConsoleTab(tab);
        };
    });
}

function bindGlobalButtons() {
    const runBtn = document.getElementById('runWorkflowBtn');
    const clearBtn = document.getElementById('clearConsoleBtn');
    const startDebugBtn = document.getElementById('startDebugBtn');
    const debugContinueBtn = document.getElementById('debugContinueBtn');
    const debugStepBtn = document.getElementById('debugStepBtn');
    const debugStopBtn = document.getElementById('debugStopBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const clearCanvasBtn = document.getElementById('clearCanvasBtn');

    if (runBtn) runBtn.onclick = runWorkflow;
    if (clearBtn) {
        clearBtn.onclick = () => clearConsole(state.activeConsoleTab);
    }
    if (startDebugBtn) startDebugBtn.onclick = debugStart;
    if (debugContinueBtn) debugContinueBtn.onclick = debugContinue;
    if (debugStepBtn) debugStepBtn.onclick = debugStep;
    if (debugStopBtn) debugStopBtn.onclick = debugStop;

    if (deleteSelectedBtn) {
        deleteSelectedBtn.onclick = () => {
            if (!state.selectedNodeId) return;
            deleteNodeById(state.selectedNodeId);
        };
    }

    if (clearCanvasBtn) {
        clearCanvasBtn.onclick = () => {
            showModal({
                title: '清空画布',
                bodyHtml: '<div>将删除所有节点与连线，且无法恢复，确认继续吗？</div>',
                okText: '确认清空',
                cancelText: '取消',
                onOk: () => {
                    state.nodes.clear();
                    state.nextId = 100;
                    setDebugCurrentNodeId(null);
                    renderCanvas();
                    setSelectedNode(null);
                    renderDebugState(null);
                }
            });
        };
    }
}

export function init() {
    prepareDebugToolbar();
    prepareConsolePanel();
    initDragDrop();
    initDemoFlow();
    initFileMenu();
    initProjectMenu();
    initSettingsMenu();
    initWindowMenu();
    bindConsoleTabs();
    bindGlobalButtons();
    setConsoleTab(state.activeConsoleTab);
    renderDebugState(null);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
