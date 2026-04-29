const STORAGE_KEY = 'ia.lowcode.projects.v1';
const MAX_RECENT_PROJECTS = 24;
const DEMO_WORKFLOW_PROJECT_ID = 'workflow-demo-smart-agriculture';
const DEMO_SCREEN_PROJECT_ID = 'screen-demo-smart-agriculture';
const DEMO_VERSION = 13;
const DEMO_SCREEN_WIDTH = 3840;
const DEMO_SCREEN_HEIGHT = 2160;

export const DEMO_PROJECT_IDS = Object.freeze({
    workflow: DEMO_WORKFLOW_PROJECT_ID,
    screen: DEMO_SCREEN_PROJECT_ID
});

function getNowIso() {
    return new Date().toISOString();
}

function buildEmptyStore() {
    return {
        projects: [],
        version: 1
    };
}

function normalizeProjectRecord(record) {
    if (!record || typeof record !== 'object') return null;

    return {
        id: String(record.id || ''),
        type: record.type === 'screen' ? 'screen' : 'workflow',
        name: String(record.name || '未命名项目'),
        data: record.data && typeof record.data === 'object' ? record.data : {},
        cloudProjectId: record.cloudProjectId == null || record.cloudProjectId === ''
            ? ''
            : String(record.cloudProjectId),
        cloudUpdatedAt: String(record.cloudUpdatedAt || ''),
        createdAt: String(record.createdAt || getNowIso()),
        updatedAt: String(record.updatedAt || record.createdAt || getNowIso()),
        lastOpenedAt: String(record.lastOpenedAt || record.updatedAt || record.createdAt || getNowIso())
    };
}

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return buildEmptyStore();

        const parsed = JSON.parse(raw);
        const projects = Array.isArray(parsed?.projects)
            ? parsed.projects.map(normalizeProjectRecord).filter(Boolean)
            : [];

        return {
            version: 1,
            projects
        };
    } catch (error) {
        return buildEmptyStore();
    }
}

function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        projects: Array.isArray(store?.projects) ? store.projects.slice(0, MAX_RECENT_PROJECTS * 8) : []
    }));
}

function upsertProjectRecord(nextRecord) {
    const store = loadStore();
    const normalized = normalizeProjectRecord(nextRecord);
    if (!normalized || !normalized.id) return null;

    const index = store.projects.findIndex(project => project.id === normalized.id);
    if (index >= 0) store.projects[index] = normalized;
    else store.projects.push(normalized);

    saveStore(store);
    return normalized;
}

function createProjectId(type) {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${type}-${Date.now()}-${randomPart}`;
}

function buildLegacyDemoNarrativeText() {
    return [
        '本演示将“数据采集、分析建模、低代码编排、大屏展示”四条主线串成一套完整闭环。',
        '工作流部分覆盖开始、打印、顺序、循环、分支、传感器读取、SQL 查询、农业环境建模、分析摘要、3D 建模和输出端口等核心节点。',
        '大屏部分同时展示文本、现场抓拍、柱状图、折线图、饼图、传感器卡、模型卡、气候卡、产量卡、决策卡与天气卡。',
        '即使没有真实设备在线，系统也能自动回退到内置演示数据，保证评审、答辩和汇报现场稳定演示。'
    ].join('\n');
}

function buildDemoCameraSnapshotUrl() {
    return '/api/agriculture/camera/snapshot';
}

function buildLegacyDemoLatestSensorCsv() {
    return [
        'sensor,current_value,unit,status',
        '温度,24.6,°C,正常',
        '空气湿度,68,%,正常',
        '光照强度,18500,Lux,正常',
        '土壤湿度,45,%,预警',
        'PM2.5,26,μg/m³,正常'
    ].join('\n');
}

function buildLegacyDemoHistoryTrendCsv() {
    return [
        'time,temperature,humidity,soil_humidity,light_lux',
        '06:00,21.8,74,51,6200',
        '08:00,23.2,71,49,12800',
        '10:00,24.6,68,46,18500',
        '12:00,25.4,66,44,21600',
        '14:00,26.1,63,42,23100',
        '16:00,25.3,65,43,20500',
        '18:00,24.0,69,45,13200'
    ].join('\n');
}

function buildLegacyDemoRiskDistributionCsv() {
    return [
        'level,count',
        '正常,14',
        '关注,6',
        '预警,3',
        '高风险,1'
    ].join('\n');
}

function buildDemoModelDefaultValue() {
    return JSON.stringify({
        status: 'ok',
        model_id: 'demo-agri-twin-default',
        contract: 'ia.workflow.environment_model.v1',
        model_name: '农业环境建模',
        screen_contract: {
            overview: {
                title: '农业环境建模',
                summary: '默认模型样例已就绪。运行工作流后，这里会切换为基于实时与历史传感器数据生成的农业环境建模结果。',
                sample_count: 192,
                updated_at: '2026-04-19 09:30:00',
                climate_archetype: '稳定适生型',
                risk_score: 68.5,
                confidence: 84.2,
                dominant_dimension: { label: '水分供给度', score: 82.4 },
                weakest_dimension: { label: '空气洁净度', score: 61.8 },
                latest_reading: {
                    temperature: 24.6,
                    humidity: 68.0,
                    soil_humidity: 46.3,
                    light_lux: 18600,
                    timestamp: '2026-04-19 09:30:00'
                },
                dimension_bars: [
                    { label: '温热稳定度', score: 78.4, state: 'high', level: '良好' },
                    { label: '水分供给度', score: 82.4, state: 'high', level: '优秀' },
                    { label: '光照活跃度', score: 75.8, state: 'high', level: '良好' },
                    { label: '空气洁净度', score: 61.8, state: 'medium', level: '中等' },
                    { label: '生长韧性', score: 73.5, state: 'medium', level: '良好' }
                ]
            },
            climate_forecast: {
                microclimate_state: '稳定适生型',
                weather_summary: '未来 6 小时棚内温度小幅上升，空气湿度总体平稳，土壤湿度略有回落。',
                confidence: 84.2,
                cards: [
                    { key: 'temperature', label: '未来6小时温度', value: 25.8, unit: '°C', trend: '上升' },
                    { key: 'humidity', label: '未来6小时湿度', value: 67.0, unit: '%', trend: '平稳' },
                    { key: 'soil_humidity', label: '未来6小时土壤湿度', value: 43.9, unit: '%', trend: '下降' },
                    { key: 'light_lux', label: '未来6小时光照', value: 20400, unit: 'Lux', trend: '上升' }
                ]
            },
            yield_forecast: {
                yield_index: 76.4,
                estimated_yield_kg_per_mu: 470.8,
                yield_grade: '稳产潜力',
                narrative: '当前环境条件总体适宜，若继续维持灌溉与通风协同策略，产量仍有提升空间。',
                factor_bars: [
                    { label: '热环境适配', score: 78.2, level: '良好' },
                    { label: '空气湿度适配', score: 74.1, level: '良好' },
                    { label: '土壤供水能力', score: 81.6, level: '优秀' },
                    { label: '光照活跃度', score: 72.5, level: '良好' }
                ]
            },
            decision_support: {
                risk_score: 68.5,
                yield_index: 76.4,
                decision_summary: '当前最优先动作为“择时补水”，以缓解土壤湿度未来 6 小时内持续下滑的风险。',
                top_decision: {
                    module: 'irrigation-controller',
                    action: '择时补水',
                    priority: 'P1',
                    score: 81.2,
                    reason: '预计未来 6 小时土壤湿度将降至 43.9%，需要提前干预。'
                },
                modules: [
                    {
                        module: 'irrigation-controller',
                        action: '择时补水',
                        priority: 'P1',
                        score: 81.2,
                        reason: '预计未来 6 小时土壤湿度将降至 43.9%，需要提前干预。'
                    },
                    {
                        module: 'ventilation-controller',
                        action: '保持低频通风',
                        priority: 'P2',
                        score: 54.6,
                        reason: '温度略有上行，但仍处于适生区间。'
                    },
                    {
                        module: 'disease-risk-evaluator',
                        action: '维持常规巡检',
                        priority: 'P2',
                        score: 42.8,
                        reason: '湿度较平稳，病害风险可控。'
                    }
                ]
            }
        }
    });
}

function buildLegacyDemoWorkflowProject() {
    const variableStoryId = 'demo-variable-story';
    const variableFeatureCountId = 'demo-variable-feature-count';
    const variableImageId = 'demo-variable-image';
    const variableLatestCsvId = 'demo-variable-latest-csv';
    const variableTrendCsvId = 'demo-variable-trend-csv';
    const variableRiskCsvId = 'demo-variable-risk-csv';
    const variableOverviewJsonId = 'demo-variable-overview-json';
    const variableAlertsJsonId = 'demo-variable-alerts-json';
    const variableRecommendationsJsonId = 'demo-variable-recommendations-json';
    const variableModelId = 'demo-variable-model';

    return {
        id: DEMO_WORKFLOW_PROJECT_ID,
        type: 'workflow',
        name: '智慧农业演示工程-工作流',
        data: {
            demoVersion: DEMO_VERSION,
            nodes: [
                {
                    id: 100,
                    type: 'start',
                    x: 80,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '开始',
                        nextNodeId: 101,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 101,
                    type: 'print',
                    x: 300,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示开场说明',
                        messageSource: 'manual',
                        message: '系统演示开始：将依次执行数据读取、SQL 查询、分析摘要、农业环境建模与端口输出。',
                        variableId: null,
                        nextNodeId: 102,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 102,
                    type: 'sequence',
                    x: 520,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示链路编排',
                        comment: '串联全部核心节点，保证展示路径清晰。',
                        nextNodeId: 103,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 103,
                    type: 'loop',
                    x: 760,
                    y: 80,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示预热循环',
                        loopConditionType: 'count',
                        loopCount: 2,
                        loopConditionExpr: '',
                        bodyNodeIds: [130, 131],
                        nextNodeId: 104,
                        portPositions: {},
                        breakpoint: false,
                        headerHeight: 54,
                        minWidth: 280,
                        minHeight: 210
                    }
                },
                {
                    id: 104,
                    type: 'branch',
                    x: 1100,
                    y: 80,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示路径分支',
                        branchCondition: true,
                        trueBranchId: null,
                        falseBranchId: null,
                        trueBodyNodeIds: [132],
                        falseBodyNodeIds: [133],
                        nextNodeId: 105,
                        portPositions: {},
                        breakpoint: false,
                        headerHeight: 54,
                        minWidth: 340,
                        minHeight: 220
                    }
                },
                {
                    id: 105,
                    type: 'get_sensor_info',
                    x: 1480,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '读取最新传感器数据',
                        source: 'latest_data',
                        deviceId: 'SmartAgriculture_thermometer',
                        limit: 8,
                        targetVariableId: variableLatestCsvId,
                        nextNodeId: 106,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 106,
                    type: 'db_query',
                    x: 1730,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '查询历史趋势数据',
                        sql: 'SELECT substr(timestamp, 12, 5) AS time, temperature, humidity, soil_humidity, light_lux FROM (SELECT timestamp, temperature, humidity, soil_humidity, light_lux FROM sensor_data WHERE device_id = "SmartAgriculture_thermometer" ORDER BY timestamp DESC LIMIT 12) ORDER BY timestamp ASC',
                        targetVariableId: variableTrendCsvId,
                        nextNodeId: 107,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 107,
                    type: 'analytics_summary',
                    x: 1980,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '总览分析摘要',
                        analysisType: 'overview',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        targetVariableId: variableOverviewJsonId,
                        nextNodeId: 108,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 108,
                    type: 'analytics_summary',
                    x: 2230,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '告警分析摘要',
                        analysisType: 'alerts',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        targetVariableId: variableAlertsJsonId,
                        nextNodeId: 109,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 109,
                    type: 'analytics_summary',
                    x: 2480,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '辅助决策摘要',
                        analysisType: 'recommendations',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        targetVariableId: variableRecommendationsJsonId,
                        nextNodeId: 110,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 110,
                    type: 'print',
                    x: 2730,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '打印总览结果',
                        messageSource: 'variable',
                        message: '',
                        variableId: variableOverviewJsonId,
                        nextNodeId: 111,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 111,
                    type: 'environment_model',
                    x: 2980,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '农业环境建模',
                        inputVariableId: variableLatestCsvId,
                        deviceId: 'SmartAgriculture_thermometer',
                        sampleLimit: 24,
                        method: 'weighted_index',
                        targetVariableId: variableModelId,
                        nextNodeId: 112,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 112,
                    type: 'output',
                    x: 2980,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出农业模型',
                        variableId: variableModelId,
                        nextNodeId: 113,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 113,
                    type: 'output',
                    x: 3220,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出项目亮点文案',
                        variableId: variableStoryId,
                        nextNodeId: 114,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 114,
                    type: 'output',
                    x: 3460,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出功能模块数量',
                        variableId: variableFeatureCountId,
                        nextNodeId: 115,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 115,
                    type: 'output',
                    x: 3700,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出现场抓拍地址',
                        variableId: variableImageId,
                        nextNodeId: 116,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 116,
                    type: 'output',
                    x: 3940,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出实时传感器CSV',
                        variableId: variableLatestCsvId,
                        nextNodeId: 117,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 117,
                    type: 'output',
                    x: 4180,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出历史趋势CSV',
                        variableId: variableTrendCsvId,
                        nextNodeId: 118,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 118,
                    type: 'output',
                    x: 4420,
                    y: 300,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '输出风险分布CSV',
                        variableId: variableRiskCsvId,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 130,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 103,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '循环-检查采集链路',
                        messageSource: 'manual',
                        message: '循环体：检查设备接入、演示数据与端口映射。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 131,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 103,
                    localX: 18,
                    localY: 118,
                    properties: {
                        name: '循环-确认可视化输出',
                        messageSource: 'manual',
                        message: '循环体：准备文本、图表、图片与建模结果的联动输出。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 132,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 104,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '真分支-进入全链路展示',
                        messageSource: 'manual',
                        message: '分支命中：执行完整的智慧农业全功能演示路径。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false,
                        branchSide: 'true'
                    }
                },
                {
                    id: 133,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 104,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '假分支-保底说明',
                        messageSource: 'manual',
                        message: '分支未命中时将回退到保底演示数据，保证汇报现场稳定。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false,
                        branchSide: 'false'
                    }
                }
            ],
            next_id: 4430,
            workflow_variables: [
                {
                    id: variableStoryId,
                    name: '项目亮点文案',
                    dataType: 'string',
                    defaultValue: buildDemoNarrativeText()
                },
                {
                    id: variableFeatureCountId,
                    name: '展示功能总数',
                    dataType: 'int',
                    defaultValue: 11
                },
                {
                    id: variableImageId,
                    name: '现场抓拍地址',
                    dataType: 'string',
                    defaultValue: buildDemoCameraSnapshotUrl()
                },
                {
                    id: variableLatestCsvId,
                    name: '实时传感器CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoLatestSensorCsv()
                },
                {
                    id: variableTrendCsvId,
                    name: '历史趋势CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoHistoryTrendCsv()
                },
                {
                    id: variableRiskCsvId,
                    name: '风险分布CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoRiskDistributionCsv()
                },
                {
                    id: variableOverviewJsonId,
                    name: '总览分析结果JSON',
                    dataType: 'string',
                    defaultValue: '{}'
                },
                {
                    id: variableAlertsJsonId,
                    name: '告警分析结果JSON',
                    dataType: 'string',
                    defaultValue: '[]'
                },
                {
                    id: variableRecommendationsJsonId,
                    name: '建议分析结果JSON',
                    dataType: 'string',
                    defaultValue: '[]'
                },
                {
                    id: variableModelId,
                    name: '农业环境建模 JSON',
                    dataType: 'string',
                    defaultValue: buildDemoModelDefaultValue()
                }
            ],
            workflow_ports: [
                {
                    id: 'demo-port-model',
                    name: 'environmentModelJson',
                    dataType: 'string',
                    nodeId: 112,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-story',
                    name: 'projectHighlights',
                    dataType: 'string',
                    nodeId: 113,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-feature-count',
                    name: 'featureCount',
                    dataType: 'int',
                    nodeId: 114,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-image',
                    name: 'cameraSnapshotUrl',
                    dataType: 'string',
                    nodeId: 115,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-sensor-csv',
                    name: 'sensorMetricsCsv',
                    dataType: 'csv',
                    nodeId: 116,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-trend-csv',
                    name: 'sensorTrendCsv',
                    dataType: 'csv',
                    nodeId: 117,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-risk-csv',
                    name: 'riskDistributionCsv',
                    dataType: 'csv',
                    nodeId: 118,
                    field: 'outputValue'
                }
            ]
        }
    };
}

function buildLegacyDemoScreenProject() {
    return {
        id: DEMO_SCREEN_PROJECT_ID,
        type: 'screen',
        name: '智慧农业演示工程-大屏',
        data: {
            demoVersion: DEMO_VERSION,
            page: {
                width: 1600,
                height: 1520,
                background: 'radial-gradient(circle at 18% 18%, rgba(59, 130, 246, 0.18), transparent 24%), radial-gradient(circle at 82% 12%, rgba(16, 185, 129, 0.20), transparent 26%), linear-gradient(145deg, #09131c 0%, #102436 42%, #153b34 100%)'
            },
            components: [
                {
                    id: 1,
                    type: 'text',
                    x: 52,
                    y: 42,
                    width: 760,
                    height: 86,
                    props: {
                        text: '智慧农业低代码全链路演示 Demo',
                        fontSize: 44,
                        color: '#f8fafc',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: { mode: 'manual', workflowProjectId: '', workflowPortId: '' }
                    }
                },
                {
                    id: 2,
                    type: 'text',
                    x: 56,
                    y: 126,
                    width: 930,
                    height: 132,
                    props: {
                        text: '本页面联动展示项目亮点、数据采集、历史趋势、风险分布、农业环境建模、气候预测、产量预测、辅助决策与天气模块。工作流运行后，图表和模型会同步刷新；未运行时也会使用演示默认值稳定展示。',
                        fontSize: 20,
                        color: '#cbd5e1',
                        fontWeight: '600',
                        textAlign: 'left',
                        backgroundColor: 'rgba(15, 23, 42, 0.34)',
                        source: { mode: 'manual', workflowProjectId: '', workflowPortId: '' }
                    }
                },
                {
                    id: 3,
                    type: 'text',
                    x: 1220,
                    y: 48,
                    width: 170,
                    height: 66,
                    props: {
                        text: '展示模块',
                        fontSize: 18,
                        color: '#93c5fd',
                        fontWeight: '700',
                        textAlign: 'center',
                        backgroundColor: 'rgba(15, 23, 42, 0.38)',
                        source: { mode: 'manual', workflowProjectId: '', workflowPortId: '' }
                    }
                },
                {
                    id: 4,
                    type: 'text',
                    x: 1220,
                    y: 116,
                    width: 170,
                    height: 112,
                    props: {
                        text: '11',
                        fontSize: 58,
                        color: '#f8fafc',
                        fontWeight: '700',
                        textAlign: 'center',
                        backgroundColor: 'rgba(14, 116, 144, 0.42)',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-feature-count'
                        }
                    }
                },
                {
                    id: 5,
                    type: 'text',
                    x: 56,
                    y: 276,
                    width: 694,
                    height: 146,
                    props: {
                        text: '项目亮点将在这里显示。',
                        fontSize: 18,
                        color: '#e2e8f0',
                        fontWeight: '600',
                        textAlign: 'left',
                        backgroundColor: 'rgba(15, 23, 42, 0.42)',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-story'
                        }
                    }
                },
                {
                    id: 6,
                    type: 'agri-sensor',
                    x: 56,
                    y: 452,
                    width: 300,
                    height: 286,
                    props: {
                        title: '实时传感器总览',
                        dataMode: 'api',
                        apiPath: '/api/agriculture/sensor',
                        refreshInterval: 30,
                        sensors: [
                            { name: '温度传感器', value: '24.6', unit: '°C', status: '正常' },
                            { name: '湿度传感器', value: '68', unit: '%', status: '正常' },
                            { name: '光照传感器', value: '18500', unit: 'Lux', status: '正常' },
                            { name: '土壤湿度', value: '45', unit: '%', status: '正常' }
                        ]
                    }
                },
                {
                    id: 7,
                    type: 'image',
                    x: 376,
                    y: 452,
                    width: 344,
                    height: 286,
                    props: {
                        src: buildDemoCameraSnapshotUrl(),
                        alt: '农业现场抓拍',
                        objectFit: 'cover',
                        borderRadius: 22,
                        autoRefresh: true,
                        refreshInterval: 8,
                        source: { mode: 'manual', workflowProjectId: '', workflowPortId: '' }
                    }
                },
                {
                    id: 8,
                    type: 'weather',
                    x: 740,
                    y: 452,
                    width: 340,
                    height: 286,
                    props: {
                        title: '现场天气',
                        subtitle: '武汉示范农田',
                        dataMode: 'api',
                        latitude: 30.5928,
                        longitude: 114.3055,
                        customApiUrl: '',
                        refreshInterval: 600,
                        conditionText: '晴',
                        tempC: '22',
                        humidity: '65',
                        windKmh: '12',
                        updatedAt: '实时刷新'
                    }
                },
                {
                    id: 9,
                    type: 'chart',
                    x: 1100,
                    y: 452,
                    width: 444,
                    height: 286,
                    props: {
                        title: '风险等级分布',
                        chartType: 'pie',
                        csvText: buildDemoRiskDistributionCsv(),
                        labelColumn: '',
                        valueColumn: '',
                        valueColumns: [],
                        seriesColumn: '',
                        seriesMode: 'single',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-risk-csv'
                        }
                    }
                },
                {
                    id: 10,
                    type: 'chart',
                    x: 56,
                    y: 768,
                    width: 460,
                    height: 320,
                    props: {
                        title: '实时指标对比',
                        chartType: 'bar',
                        csvText: buildDemoLatestSensorCsv(),
                        labelColumn: '',
                        valueColumn: '',
                        valueColumns: [],
                        seriesColumn: '',
                        seriesMode: 'multi',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-sensor-csv'
                        }
                    }
                },
                {
                    id: 11,
                    type: 'chart',
                    x: 536,
                    y: 768,
                    width: 500,
                    height: 320,
                    props: {
                        title: '历史趋势跟踪',
                        chartType: 'line',
                        csvText: buildDemoHistoryTrendCsv(),
                        labelColumn: '',
                        valueColumn: '',
                        valueColumns: [],
                        seriesColumn: '',
                        seriesMode: 'multi',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-trend-csv'
                        }
                    }
                },
                {
                    id: 12,
                    type: 'agri-model',
                    x: 1056,
                    y: 768,
                    width: 488,
                    height: 320,
                    props: {
                        title: '农业环境建模',
                        jsonText: '{"status":"waiting"}',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-model'
                        }
                    }
                },
                {
                    id: 13,
                    type: 'agri-climate',
                    x: 56,
                    y: 1110,
                    width: 480,
                    height: 360,
                    props: {
                        title: '气候趋势预测',
                        jsonText: '{"status":"waiting"}',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-model'
                        }
                    }
                },
                {
                    id: 14,
                    type: 'agri-yield',
                    x: 556,
                    y: 1110,
                    width: 420,
                    height: 360,
                    props: {
                        title: '产量预测',
                        jsonText: '{"status":"waiting"}',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-model'
                        }
                    }
                },
                {
                    id: 15,
                    type: 'agri-decision',
                    x: 996,
                    y: 1110,
                    width: 548,
                    height: 360,
                    props: {
                        title: '辅助决策',
                        jsonText: '{"status":"waiting"}',
                        source: {
                            mode: 'workflow-port',
                            workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
                            workflowPortId: 'demo-port-model'
                        }
                    }
                }
            ],
            next_id: 16
        }
    };
}

function buildDemoNarrativeText() {
    return [
        '演示工程把数据采集、分析建模、低代码编排、项目端口联动与大屏展示串成一条完整闭环。',
        '工作流会依次经过传感器读取、农业环境建模、SQL 查询、总览分析、风险告警、策略建议、气候预测、产量预测、辅助决策、报告摘要与影像三维场景建模。',
        '大屏同步展示文本、图片、柱状图、折线图、饼图、天气卡、传感器卡、分析摘要卡、农业环境建模卡、气候卡、产量卡、决策卡和 3D 场景，完整体现组件库与农业特色。',
        '即使现场没有真实设备在线，系统也会自动使用默认 demo 数据兜底，保证答辩、汇报和联调过程稳定可演示。'
    ].join('\n');
}

function buildDemoLatestSensorCsv() {
    return [
        'bucket,temperature,humidity,soil_humidity,pm25,light_lux',
        '2026-04-19T09:30,24.6,68,45,26,18500'
    ].join('\n');
}

function buildDemoHistoryTrendCsv() {
    return [
        'bucket,temperature,humidity,soil_humidity,pm25,light_lux',
        '2026-04-18T18:00,23.4,72,49,24,12500',
        '2026-04-18T20:00,22.9,73,48,23,8600',
        '2026-04-18T22:00,22.3,74,48,22,3200',
        '2026-04-19T00:00,21.9,75,47,22,900',
        '2026-04-19T02:00,21.6,75,47,21,300',
        '2026-04-19T04:00,21.8,74,46,22,450',
        '2026-04-19T06:00,22.4,72,46,23,6200',
        '2026-04-19T08:00,23.8,70,45,25,14800',
        '2026-04-19T10:00,24.6,68,45,26,18500'
    ].join('\n');
}

function buildDemoRiskDistributionCsv() {
    return [
        'level,count',
        '正常,16',
        '关注,6',
        '预警,3',
        '高风险,1'
    ].join('\n');
}

function buildDemoDecisionPriorityCsv() {
    return [
        'action,score',
        '择时补水,81.2',
        '低频通风,54.6',
        '继续巡检,42.8'
    ].join('\n');
}

function buildDemoYieldFactorCsv() {
    return [
        'factor,score',
        '热环境适配,78.2',
        '空气湿度适配,74.1',
        '土壤供水能力,81.6',
        '光照活跃度,72.5'
    ].join('\n');
}

function buildDemoOverviewSummaryPayload() {
    return {
        device_name: 'SmartAgriculture_thermometer',
        work_status: '在线演示',
        online: true,
        location: '武汉示范温室 A-03',
        risk_score: 68.5,
        alert_count: 2,
        total_records: 192,
        data_freshness_minutes: 6,
        observation: '近 24 小时棚内环境总体可控，但土壤湿度正在缓慢回落，当前更适合提前补水而不是被动等待告警扩大。',
        latest_reading: {
            temperature: 24.6,
            humidity: 68.0,
            soil_humidity: 45.0,
            pm25: 26.0,
            light_lux: 18500,
            timestamp: '2026-04-19 09:30:00'
        }
    };
}

function buildDemoAlertsSummaryPayload() {
    return [
        {
            level: 'high',
            metric: 'soil_humidity',
            value: 45.0,
            timestamp: '2026-04-19 09:30:00',
            message: '土壤湿度持续回落，已接近缺水预警区间。',
            suggestion: '建议在未来 2 小时内执行分区补水，并观察回升速度。'
        },
        {
            level: 'medium',
            metric: 'temperature',
            value: 24.6,
            timestamp: '2026-04-19 09:30:00',
            message: '温度有缓慢抬升趋势，午后热负荷可能继续增加。',
            suggestion: '建议保持低频通风，避免棚内热量持续堆积。'
        }
    ];
}

function buildDemoRecommendationsSummaryPayload() {
    return [
        {
            priority: 'P1',
            title: '择时补水',
            detail: '根据土壤湿度与未来 6 小时趋势，优先安排补水动作以降低根区水分波动。',
            expected_effect: '缓解根系水分压力，稳定植株生长节奏。'
        },
        {
            priority: 'P2',
            title: '低频通风',
            detail: '在午后温度继续上升前预留通风窗口，避免棚内闷热积累。',
            expected_effect: '维持温湿平衡，降低病害环境压力。'
        },
        {
            priority: 'P2',
            title: '继续巡检',
            detail: '维持对温湿光土等关键指标的常规巡检，确保告警闭环可追踪。',
            expected_effect: '为后续策略调整提供更稳定的数据依据。'
        }
    ];
}

function buildDemoForecastSummaryPayload() {
    return {
        microclimate_state: '稳定适生型',
        weather_summary: '未来 6 小时棚内温度小幅上升，空气湿度总体平稳，土壤湿度仍有继续回落的风险。',
        confidence: 84.2,
        sample_count: 192,
        predictions: {
            temperature: { next_6h: 25.8, next_24h: 26.6, trend: '上升' },
            humidity: { next_6h: 67.0, next_24h: 66.2, trend: '平稳' },
            soil_humidity: { next_6h: 43.9, next_24h: 41.8, trend: '下降' },
            light_lux: { next_6h: 20400, next_24h: 18800, trend: '波动上升' }
        }
    };
}

function buildDemoYieldSummaryPayload() {
    return {
        yield_index: 76.4,
        estimated_yield_kg_per_mu: 470.8,
        yield_grade: '稳产潜力',
        narrative: '当前环境总体适宜，只要继续维持补水与通风协同策略，产量仍有进一步抬升空间。',
        factor_bars: [
            { label: '热环境适配', score: 78.2, level: '良好' },
            { label: '空气湿度适配', score: 74.1, level: '良好' },
            { label: '土壤供水能力', score: 81.6, level: '优秀' },
            { label: '光照活跃度', score: 72.5, level: '良好' }
        ]
    };
}

function buildDemoDecisionSummaryPayload() {
    return {
        risk_score: 68.5,
        yield_index: 76.4,
        decision_summary: '当前最优先动作为“择时补水”，以缓解土壤湿度未来 6 小时内继续下滑的风险。',
        top_decision: {
            module: 'irrigation-controller',
            action: '择时补水',
            priority: 'P1',
            score: 81.2,
            reason: '预测未来 6 小时土壤湿度将下降至 43.9%，需要提前干预。'
        },
        modules: [
            {
                module: 'irrigation-controller',
                action: '择时补水',
                priority: 'P1',
                score: 81.2,
                reason: '预测未来 6 小时土壤湿度将下降至 43.9%，需要提前干预。'
            },
            {
                module: 'ventilation-controller',
                action: '保持低频通风',
                priority: 'P2',
                score: 54.6,
                reason: '温度有轻微上行，但仍处于适生区间。'
            },
            {
                module: 'disease-risk-evaluator',
                action: '维持常规巡检',
                priority: 'P2',
                score: 42.8,
                reason: '空气湿度相对平稳，病害风险总体可控。'
            }
        ]
    };
}

function buildDemoScene3dPayload() {
    const columns = 7;
    const rows = 5;
    const terrain = [];
    for (let z = 0; z < rows; z += 1) {
        for (let x = 0; x < columns; x += 1) {
            const elevation = Number((8 + Math.abs(x - 3) * 1.7 + Math.abs(z - 2) * 1.1 + ((x + z) % 3)).toFixed(2));
            const soil = Number(Math.max(24, Math.min(76, 48 + (2 - z) * 3.4 + (x - 3) * 1.6)).toFixed(2));
            const rainfall = Number(Math.max(0.2, 1.1 + z * 0.34 + (x % 3) * 0.2).toFixed(2));
            const rainForecast = Number(Math.max(0.3, rainfall * 1.24 + (6 - x) * 0.13).toFixed(2));
            terrain.push({
                x,
                z,
                elevation,
                soil_moisture: soil,
                rainfall,
                rain_forecast: rainForecast,
                colors: {
                    soil_moisture: soil < 35 ? '#b45309' : soil < 50 ? '#f59e0b' : soil < 64 ? '#22c55e' : '#0ea5e9',
                    rainfall: rainfall < 1 ? '#e0f2fe' : rainfall < 2.2 ? '#7dd3fc' : rainfall < 5 ? '#0284c7' : '#1e3a8a',
                    rain_forecast: rainForecast < 1 ? '#f8fafc' : rainForecast < 3 ? '#a7f3d0' : rainForecast < 5 ? '#10b981' : '#047857',
                    elevation: elevation < 10 ? '#bbf7d0' : elevation < 15 ? '#86efac' : elevation < 20 ? '#fde68a' : '#a16207'
                }
            });
        }
    }

    return JSON.stringify({
        status: 'ok',
        contract: 'ia.workflow.media_scene3d.v1',
        generatedAt: '2026-04-19T09:30:00',
        media: {
            kind: 'image',
            fileName: 'demo-greenhouse.jpg',
            embedded: false
        },
        analysisBinding: {
            environmentScore: 76.4,
            environmentLevel: '良好',
            riskType: '轻度干旱风险'
        },
        model: {
            type: 'procedural_agri_scene',
            grid: { columns, rows },
            dimensions: { width: columns * 12, depth: rows * 12, height: 28, unit: 'm' },
            camera: { projection: 'isometric', azimuth: 42, elevation: 34, zoom: 1 },
            terrain,
            objects: [
                { kind: 'sensor_tower', x: 1, z: 1, height: 24 },
                { kind: 'irrigation_line', x: 3, z: 0, length: 5 },
                { kind: 'rain_gauge', x: 5, z: 3, height: 16 }
            ]
        },
        layers: [
            { key: 'soil_moisture', label: '土壤湿度', unit: '%', min: 0, max: 100 },
            { key: 'rainfall', label: '降雨状况', unit: 'mm', min: 0, max: 8 },
            { key: 'rain_forecast', label: '降雨预测', unit: 'mm', min: 0, max: 8 },
            { key: 'elevation', label: '地形高程', unit: 'm', min: 0, max: 24 }
        ],
        visibleLayers: ['soil_moisture', 'rainfall', 'rain_forecast', 'elevation'],
        activeLayer: 'soil_moisture',
        layerStats: {
            soil_moisture: { min: 34.4, max: 61.4, avg: 47.9 },
            rainfall: { min: 1.1, max: 2.86, avg: 1.96 },
            rain_forecast: { min: 1.36, max: 3.23, avg: 2.41 },
            elevation: { min: 8, max: 15.3, avg: 11.8 }
        },
        hotspots: [
            { x: 0, z: 4, type: 'dry_soil', label: '偏干地块', metric: 'soil_moisture', value: 34.4, priority: 'P1' }
        ],
        screen_contract: {
            title: '影像三维环境场景',
            summary: '基于导入影像构建三维地块，并叠加湿度、降雨、预测图层。',
            defaultLayer: 'soil_moisture',
            layerStats: {
                soil_moisture: { min: 34.4, max: 61.4, avg: 47.9 },
                rainfall: { min: 1.1, max: 2.86, avg: 1.96 },
                rain_forecast: { min: 1.36, max: 3.23, avg: 2.41 },
                elevation: { min: 8, max: 15.3, avg: 11.8 }
            }
        },
        payload: {},
        meta: {
            source: 'media_scene_model',
            mediaInputMode: 'url',
            colorScheme: 'default'
        }
    }, null, 2);
}

function buildDemoReportSummaryPayload() {
    return {
        summary: '平台将环境感知、低代码编排、农业分析、模型建构与大屏展示串成完整业务闭环，适合答辩演示与后续项目扩展。',
        contest_fit: {
            scenario: '智慧农业环境监测与辅助决策',
            highlights: [
                '工作流节点可复用传感器采集、SQL 查询、分析摘要和建模结果。',
                '农业分析摘要可直接被摘要卡解析成适合大屏展示的中文结构化内容。',
                '系统在无真实设备时仍可使用 demo 数据稳定展示，不会出现空白页面。'
            ]
        },
        report_outline: [
            '数据来源：温湿光土与 PM2.5 等农业环境时序数据',
            '系统链路：采集、存储、分析、建模、决策与大屏展示',
            '核心价值：降低农业场景应用搭建门槛，提升展示与汇报效率'
        ],
        overview: buildDemoOverviewSummaryPayload(),
        alerts: buildDemoAlertsSummaryPayload(),
        recommendations: buildDemoRecommendationsSummaryPayload(),
        trend_summary: {
            timeline_points: 9,
            temperature_change_48h: 1.2,
            soil_humidity_change_48h: -4.0
        }
    };
}

function buildDemoWorkflowProject() {
    const variableStoryId = 'demo-variable-story';
    const variableFeatureCountId = 'demo-variable-feature-count';
    const variableImageId = 'demo-variable-image';
    const variableLatestCsvId = 'demo-variable-latest-csv';
    const variableTrendCsvId = 'demo-variable-trend-csv';
    const variableRiskCsvId = 'demo-variable-risk-csv';
    const variableOverviewJsonId = 'demo-variable-overview-json';
    const variableAlertsJsonId = 'demo-variable-alerts-json';
    const variableRecommendationsJsonId = 'demo-variable-recommendations-json';
    const variableForecastJsonId = 'demo-variable-forecast-json';
    const variableYieldJsonId = 'demo-variable-yield-json';
    const variableDecisionJsonId = 'demo-variable-decision-json';
    const variableReportJsonId = 'demo-variable-report-json';
    const variableEnvModelId = 'demo-variable-env-model';
    const variableSceneModelId = 'demo-variable-scene-model';

    const createOutputNode = (id, x, y, name, variableId, nextNodeId = null) => ({
        id,
        type: 'output',
        x,
        y,
        parentId: null,
        localX: 0,
        localY: 0,
        properties: {
            name,
            variableId,
            nextNodeId,
            portPositions: {},
            breakpoint: false
        }
    });

    return {
        id: DEMO_WORKFLOW_PROJECT_ID,
        type: 'workflow',
        name: '智慧农业演示工程-工作流',
        data: {
            demoVersion: DEMO_VERSION,
            nodes: (() => {
                const nodes = [
                {
                    id: 100,
                    type: 'start',
                    x: 80,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '开始',
                        nextNodeId: 101,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 101,
                    type: 'print',
                    x: 300,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示开场说明',
                        messageSource: 'manual',
                        message: '系统演示开始：将依次执行采集、查询、分析摘要、预测建模与端口输出。',
                        variableId: null,
                        nextNodeId: 102,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 102,
                    type: 'sequence',
                    x: 520,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '全功能演示链路',
                        comment: '覆盖核心节点类型、分析能力、项目端口与大屏联动。',
                        nextNodeId: 103,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 103,
                    type: 'loop',
                    x: 780,
                    y: 80,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示预热循环',
                        loopConditionType: 'count',
                        loopCount: 2,
                        loopConditionExpr: '',
                        bodyNodeIds: [150, 151],
                        nextNodeId: 104,
                        portPositions: {},
                        breakpoint: false,
                        headerHeight: 54,
                        minWidth: 280,
                        minHeight: 210
                    }
                },
                {
                    id: 104,
                    type: 'branch',
                    x: 1120,
                    y: 80,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '演示路径分支',
                        branchCondition: true,
                        trueBranchId: null,
                        falseBranchId: null,
                        trueBodyNodeIds: [152],
                        falseBodyNodeIds: [153],
                        nextNodeId: 105,
                        portPositions: {},
                        breakpoint: false,
                        headerHeight: 54,
                        minWidth: 340,
                        minHeight: 220
                    }
                },
                {
                    id: 105,
                    type: 'get_sensor_info',
                    x: 1500,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '读取最新环境采样',
                        source: 'latest_data',
                        deviceId: 'SmartAgriculture_thermometer',
                        limit: 1,
                        targetVariableId: variableLatestCsvId,
                        nextNodeId: 154,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 154,
                    type: 'environment_model',
                    x: 1750,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '环境建模基线',
                        method: 'weighted_index',
                        inputVariableId: variableLatestCsvId,
                        deviceId: 'SmartAgriculture_thermometer',
                        sampleLimit: 24,
                        targetVariableId: variableEnvModelId,
                        nextNodeId: 106,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 106,
                    type: 'db_query',
                    x: 2000,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '查询风险分布 SQL',
                        sql: `SELECT level, COUNT(*) AS count
FROM (
    SELECT CASE
        WHEN soil_humidity <= 35 OR temperature >= 30 THEN '高风险'
        WHEN soil_humidity <= 42 OR temperature >= 27 THEN '预警'
        WHEN soil_humidity <= 48 OR temperature >= 25 THEN '关注'
        ELSE '正常'
    END AS level
    FROM sensor_data
    WHERE device_id = 'SmartAgriculture_thermometer'
    ORDER BY timestamp DESC
    LIMIT 96
) grouped
GROUP BY level
ORDER BY CASE level
    WHEN '正常' THEN 1
    WHEN '关注' THEN 2
    WHEN '预警' THEN 3
    ELSE 4
END`,
                        targetVariableId: variableRiskCsvId,
                        nextNodeId: 107,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 107,
                    type: 'db_query',
                    x: 2250,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '趋势时序查询',
                        sql: `SELECT bucket, temperature, humidity, soil_humidity, pm25, light_lux
FROM (
    SELECT
        substr(timestamp, 1, 16) AS bucket,
        ROUND(AVG(temperature), 2) AS temperature,
        ROUND(AVG(humidity), 2) AS humidity,
        ROUND(AVG(soil_humidity), 2) AS soil_humidity,
        ROUND(AVG(pm25), 2) AS pm25,
        ROUND(AVG(light_lux), 2) AS light_lux
    FROM sensor_data
    WHERE device_id = 'SmartAgriculture_thermometer'
    GROUP BY substr(timestamp, 1, 16)
    ORDER BY bucket DESC
    LIMIT 12
) t
ORDER BY bucket ASC`,
                        targetVariableId: variableTrendCsvId,
                        nextNodeId: 108,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 108,
                    type: 'analytics_summary',
                    x: 2500,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '总览分析摘要',
                        analysisType: 'overview',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableOverviewJsonId,
                        nextNodeId: 109,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 109,
                    type: 'analytics_summary',
                    x: 2750,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '风险告警摘要',
                        analysisType: 'alerts',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableAlertsJsonId,
                        nextNodeId: 110,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 110,
                    type: 'analytics_summary',
                    x: 3000,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '策略建议摘要',
                        analysisType: 'recommendations',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableRecommendationsJsonId,
                        nextNodeId: 111,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 111,
                    type: 'analytics_summary',
                    x: 3250,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '气候预测摘要',
                        analysisType: 'forecast',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableForecastJsonId,
                        nextNodeId: 112,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 112,
                    type: 'analytics_summary',
                    x: 3500,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '产量预测摘要',
                        analysisType: 'yield',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 72,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableYieldJsonId,
                        nextNodeId: 113,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 113,
                    type: 'analytics_summary',
                    x: 3750,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '辅助决策摘要',
                        analysisType: 'decision',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableDecisionJsonId,
                        nextNodeId: 114,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 114,
                    type: 'analytics_summary',
                    x: 4000,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '报告摘要输出',
                        analysisType: 'report',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 48,
                        limit: 8,
                        inputVariableId: variableEnvModelId,
                        targetVariableId: variableReportJsonId,
                        nextNodeId: 115,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 115,
                    type: 'print',
                    x: 4000,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '打印报告摘要',
                        messageSource: 'variable',
                        message: '',
                        variableId: variableReportJsonId,
                        nextNodeId: 116,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 116,
                    type: 'print',
                    x: 3300,
                    y: 760,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '打印环境建模结果',
                        messageSource: 'variable',
                        message: '',
                        variableId: variableEnvModelId,
                        nextNodeId: 131,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 131,
                    type: 'media_scene_model',
                    x: 4480,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '影像三维场景建模',
                        mediaUrl: '/api/agriculture/camera/snapshot',
                        mediaDataUrl: '',
                        mediaFileName: 'demo-camera-snapshot.jpg',
                        mediaType: 'image',
                        inputVariableId: variableEnvModelId,
                        activeLayer: 'soil_moisture',
                        colorScheme: 'default',
                        soilDryThreshold: 35,
                        soilWetThreshold: 62,
                        rainLightThreshold: 1,
                        rainHeavyThreshold: 5,
                        showSoilLayer: true,
                        showRainfallLayer: true,
                        showForecastLayer: true,
                        showElevationLayer: true,
                        targetVariableId: variableSceneModelId,
                        nextNodeId: 132,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                createOutputNode(132, 4020, 320, '输出三维场景模型', variableSceneModelId, 117),
                createOutputNode(117, 760, 1010, '输出环境建模结果', variableEnvModelId, 118),
                createOutputNode(118, 4480, 320, '输出项目亮点文案', variableStoryId, 119),
                createOutputNode(119, 4710, 320, '输出核心能力数量', variableFeatureCountId, 120),
                createOutputNode(120, 4940, 320, '输出现场抓拍地址', variableImageId, 121),
                createOutputNode(121, 5170, 320, '输出最新环境 CSV', variableLatestCsvId, 122),
                createOutputNode(122, 5400, 320, '输出趋势时序 CSV', variableTrendCsvId, 123),
                createOutputNode(123, 5630, 320, '输出风险分布 CSV', variableRiskCsvId, 124),
                createOutputNode(124, 5860, 320, '输出总览摘要', variableOverviewJsonId, 125),
                createOutputNode(125, 6090, 320, '输出告警摘要', variableAlertsJsonId, 126),
                createOutputNode(126, 6320, 320, '输出建议摘要', variableRecommendationsJsonId, 127),
                createOutputNode(127, 6550, 320, '输出预测摘要', variableForecastJsonId, 128),
                createOutputNode(128, 6780, 320, '输出产量摘要', variableYieldJsonId, 129),
                createOutputNode(129, 7010, 320, '输出决策摘要', variableDecisionJsonId, 130),
                createOutputNode(130, 7240, 320, '输出报告摘要', variableReportJsonId, null),
                {
                    id: 150,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 103,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '循环-校验采集链路',
                        messageSource: 'manual',
                        message: '循环体：检查设备接入、演示数据与工作流变量映射。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 151,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 103,
                    localX: 18,
                    localY: 118,
                    properties: {
                        name: '循环-确认可视化输出',
                        messageSource: 'manual',
                        message: '循环体：准备文本、图表、摘要卡与建模结果的大屏联动输出。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false
                    }
                },
                {
                    id: 152,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 104,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '真分支-进入完整演示',
                        messageSource: 'manual',
                        message: '分支命中：执行完整的智慧农业全功能演示路径。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false,
                        branchSide: 'true'
                    }
                },
                {
                    id: 153,
                    type: 'print',
                    x: 0,
                    y: 0,
                    parentId: 104,
                    localX: 18,
                    localY: 18,
                    properties: {
                        name: '假分支-兜底说明',
                        messageSource: 'manual',
                        message: '分支未命中时将回退到保底 demo 数据，保证汇报现场稳定。',
                        variableId: null,
                        nextNodeId: null,
                        portPositions: {},
                        breakpoint: false,
                        branchSide: 'false'
                    }
                }

                ];
                const layoutOverrides = {
                    100: { x: 80, y: 80 },
                    101: { x: 360, y: 80 },
                    102: { x: 660, y: 80 },
                    103: { x: 980, y: 40 },
                    104: { x: 1360, y: 40 },
                    105: { x: 80, y: 360 },
                    154: { x: 420, y: 360 },
                    106: { x: 760, y: 360 },
                    107: { x: 1100, y: 360 },
                    108: { x: 80, y: 660 },
                    109: { x: 420, y: 660 },
                    110: { x: 760, y: 660 },
                    111: { x: 1100, y: 660 },
                    112: { x: 1440, y: 660 },
                    113: { x: 1780, y: 660 },
                    114: { x: 2120, y: 660 },
                    115: { x: 2500, y: 660 },
                    116: { x: 2880, y: 660 },
                    131: { x: 80, y: 1010 },
                    132: { x: 420, y: 1010 },
                    117: { x: 760, y: 1010 },
                    118: { x: 1100, y: 1010 },
                    119: { x: 1440, y: 1010 },
                    120: { x: 1780, y: 1010 },
                    121: { x: 2120, y: 1010 },
                    122: { x: 2460, y: 1010 },
                    123: { x: 2800, y: 1010 },
                    124: { x: 80, y: 1300 },
                    125: { x: 420, y: 1300 },
                    126: { x: 760, y: 1300 },
                    127: { x: 1100, y: 1300 },
                    128: { x: 1440, y: 1300 },
                    129: { x: 1780, y: 1300 },
                    130: { x: 2120, y: 1300 },
                    150: { x: 1020, y: 130 },
                    151: { x: 1020, y: 230 },
                    152: { x: 1400, y: 130 },
                    153: { x: 1400, y: 230 }
                };
                return nodes.map(node => layoutOverrides[node.id] ? { ...node, ...layoutOverrides[node.id] } : node);
            })(),
            next_id: 155,
            workflow_variables: [
                {
                    id: variableStoryId,
                    name: '项目亮点文案',
                    dataType: 'string',
                    defaultValue: buildDemoNarrativeText()
                },
                {
                    id: variableFeatureCountId,
                    name: '核心能力数量',
                    dataType: 'int',
                    defaultValue: 16
                },
                {
                    id: variableImageId,
                    name: '现场抓拍地址',
                    dataType: 'string',
                    defaultValue: buildDemoCameraSnapshotUrl()
                },
                {
                    id: variableLatestCsvId,
                    name: '最新环境 CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoLatestSensorCsv()
                },
                {
                    id: variableTrendCsvId,
                    name: '趋势时序 CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoHistoryTrendCsv()
                },
                {
                    id: variableRiskCsvId,
                    name: '风险分布 CSV',
                    dataType: 'csv',
                    defaultValue: buildDemoRiskDistributionCsv()
                },
                {
                    id: variableOverviewJsonId,
                    name: '总览分析结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoOverviewSummaryPayload(), null, 2)
                },
                {
                    id: variableAlertsJsonId,
                    name: '告警分析结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoAlertsSummaryPayload(), null, 2)
                },
                {
                    id: variableRecommendationsJsonId,
                    name: '建议分析结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoRecommendationsSummaryPayload(), null, 2)
                },
                {
                    id: variableForecastJsonId,
                    name: '气候预测结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoForecastSummaryPayload(), null, 2)
                },
                {
                    id: variableYieldJsonId,
                    name: '产量预测结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoYieldSummaryPayload(), null, 2)
                },
                {
                    id: variableDecisionJsonId,
                    name: '辅助决策结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoDecisionSummaryPayload(), null, 2)
                },
                {
                    id: variableReportJsonId,
                    name: '报告摘要结果 JSON',
                    dataType: 'string',
                    defaultValue: JSON.stringify(buildDemoReportSummaryPayload(), null, 2)
                },
                {
                    id: variableEnvModelId,
                    name: '环境建模结果 JSON',
                    dataType: 'string',
                    defaultValue: buildDemoModelDefaultValue()
                },
                {
                    id: variableSceneModelId,
                    name: '三维场景模型 JSON',
                    dataType: 'string',
                    defaultValue: buildDemoScene3dPayload()
                }
            ],
            workflow_ports: [
                {
                    id: 'demo-port-model',
                    name: 'environmentModelJson',
                    dataType: 'string',
                    nodeId: 117,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-story',
                    name: 'projectHighlights',
                    dataType: 'string',
                    nodeId: 118,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-feature-count',
                    name: 'featureCount',
                    dataType: 'int',
                    nodeId: 119,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-image',
                    name: 'cameraSnapshotUrl',
                    dataType: 'string',
                    nodeId: 120,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-sensor-csv',
                    name: 'latestEnvironmentCsv',
                    dataType: 'csv',
                    nodeId: 121,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-trend-csv',
                    name: 'timelineTrendCsv',
                    dataType: 'csv',
                    nodeId: 122,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-risk-csv',
                    name: 'riskDistributionCsv',
                    dataType: 'csv',
                    nodeId: 123,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-overview-summary',
                    name: 'overviewSummaryJson',
                    dataType: 'string',
                    nodeId: 124,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-alerts-summary',
                    name: 'alertsSummaryJson',
                    dataType: 'string',
                    nodeId: 125,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-recommendations-summary',
                    name: 'recommendationsSummaryJson',
                    dataType: 'string',
                    nodeId: 126,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-forecast-summary',
                    name: 'forecastSummaryJson',
                    dataType: 'string',
                    nodeId: 127,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-yield-summary',
                    name: 'yieldSummaryJson',
                    dataType: 'string',
                    nodeId: 128,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-decision-summary',
                    name: 'decisionSummaryJson',
                    dataType: 'string',
                    nodeId: 129,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-report-summary',
                    name: 'reportSummaryJson',
                    dataType: 'string',
                    nodeId: 130,
                    field: 'outputValue'
                },
                {
                    id: 'demo-port-scene3d',
                    name: 'scene3dModelJson',
                    dataType: 'string',
                    nodeId: 132,
                    field: 'outputValue'
                }
            ]
        }
    };
}

function buildDemoScreenProject() {
    const portSource = (workflowPortId) => ({
        mode: 'workflow-port',
        workflowProjectId: DEMO_WORKFLOW_PROJECT_ID,
        workflowPortId
    });

    const manualSource = () => ({
        mode: 'manual',
        workflowProjectId: '',
        workflowPortId: ''
    });

    const createSummaryComponent = (id, x, y, width, height, title, workflowPortId, fallbackPayload) => ({
        id,
        type: 'agri-summary',
        x,
        y,
        width,
        height,
        props: {
            title,
            jsonText: JSON.stringify(fallbackPayload, null, 2),
            source: portSource(workflowPortId)
        }
    });

    const createChartComponent = (id, x, y, width, height, title, chartType, csvText, source, overrides = {}) => ({
        id,
        type: 'chart',
        x,
        y,
        width,
        height,
        props: {
            title,
            chartType,
            csvText,
            labelColumn: '',
            valueColumn: '',
            valueColumns: [],
            seriesColumn: '',
            seriesMode: chartType === 'pie' ? 'single' : 'multi',
            selectedSeriesKeys: [],
            dataLayout: 'wide',
            enableAggregation: false,
            aggregationLimit: 60,
            source,
            ...overrides
        }
    });

    return {
        id: DEMO_SCREEN_PROJECT_ID,
        type: 'screen',
        name: '智慧农业演示工程-大屏',
        data: {
            demoVersion: DEMO_VERSION,
            page: {
                width: DEMO_SCREEN_WIDTH,
                height: DEMO_SCREEN_HEIGHT,
                background: 'radial-gradient(circle at 18% 18%, rgba(59, 130, 246, 0.18), transparent 24%), radial-gradient(circle at 82% 12%, rgba(16, 185, 129, 0.20), transparent 26%), linear-gradient(145deg, #09131c 0%, #102436 42%, #153b34 100%)'
            },
            components: (() => {
                const components = [
                {
                    id: 1,
                    type: 'text',
                    x: 56,
                    y: 38,
                    width: 1110,
                    height: 76,
                    props: {
                        text: '智慧农业低代码全功能演示工程',
                        fontSize: 44,
                        color: '#f8fafc',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: manualSource()
                    }
                },
                {
                    id: 2,
                    type: 'text',
                    x: 56,
                    y: 116,
                    width: 1110,
                    height: 104,
                    props: {
                        text: '同一张大屏内同时展示工作流摘要解析、农业建模结果、图表组件、图片抓拍、实时天气和传感器卡，完整体现系统的通用能力与农业场景特殊性。',
                        fontSize: 20,
                        color: '#cbd5e1',
                        fontWeight: '600',
                        textAlign: 'left',
                        backgroundColor: 'rgba(15, 23, 42, 0.34)',
                        source: manualSource()
                    }
                },
                {
                    id: 3,
                    type: 'text',
                    x: 1250,
                    y: 46,
                    width: 374,
                    height: 44,
                    props: {
                        text: '核心能力',
                        fontSize: 18,
                        color: '#93c5fd',
                        fontWeight: '700',
                        textAlign: 'center',
                        backgroundColor: 'rgba(15, 23, 42, 0.38)',
                        source: manualSource()
                    }
                },
                {
                    id: 4,
                    type: 'text',
                    x: 1250,
                    y: 100,
                    width: 374,
                    height: 120,
                    props: {
                        text: '16',
                        fontSize: 56,
                        color: '#f8fafc',
                        fontWeight: '700',
                        textAlign: 'center',
                        backgroundColor: 'rgba(14, 116, 144, 0.42)',
                        source: portSource('demo-port-feature-count')
                    }
                },
                {
                    id: 5,
                    type: 'text',
                    x: 56,
                    y: 244,
                    width: 1568,
                    height: 118,
                    props: {
                        text: buildDemoNarrativeText(),
                        fontSize: 17,
                        color: '#e2e8f0',
                        fontWeight: '600',
                        textAlign: 'left',
                        backgroundColor: 'rgba(15, 23, 42, 0.42)',
                        source: portSource('demo-port-story')
                    }
                },
                {
                    id: 6,
                    type: 'agri-sensor',
                    x: 56,
                    y: 390,
                    width: 374,
                    height: 300,
                    props: {
                        title: '实时传感器总览',
                        dataMode: 'api',
                        apiPath: '/api/agriculture/sensor',
                        refreshInterval: 30,
                        sensors: [
                            { name: '温度传感器', value: '24.6', unit: '°C', status: '正常' },
                            { name: '湿度传感器', value: '68', unit: '%', status: '正常' },
                            { name: '光照传感器', value: '18500', unit: 'Lux', status: '正常' },
                            { name: '土壤湿度', value: '45', unit: '%', status: '正常' }
                        ]
                    }
                },
                {
                    id: 7,
                    type: 'image',
                    x: 454,
                    y: 390,
                    width: 374,
                    height: 300,
                    props: {
                        src: buildDemoCameraSnapshotUrl(),
                        alt: '农业现场抓拍',
                        objectFit: 'cover',
                        borderRadius: 22,
                        autoRefresh: true,
                        refreshInterval: 8,
                        source: portSource('demo-port-image')
                    }
                },
                {
                    id: 8,
                    type: 'weather',
                    x: 852,
                    y: 390,
                    width: 374,
                    height: 300,
                    props: {
                        title: '现场天气',
                        subtitle: '武汉示范温室',
                        dataMode: 'api',
                        latitude: 30.5928,
                        longitude: 114.3055,
                        customApiUrl: '',
                        refreshInterval: 600,
                        conditionText: '晴',
                        tempC: '22',
                        humidity: '65',
                        windKmh: '12',
                        updatedAt: '实时刷新'
                    }
                },
                {
                    id: 9,
                    type: 'chart',
                    x: 1250,
                    y: 390,
                    width: 374,
                    height: 300,
                    props: {
                        title: '风险等级分布',
                        chartType: 'pie',
                        csvText: buildDemoRiskDistributionCsv(),
                        labelColumn: 'level',
                        valueColumn: 'count',
                        valueColumns: ['count'],
                        seriesColumn: '',
                        seriesMode: 'single',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: portSource('demo-port-risk-csv')
                    }
                },
                {
                    id: 10,
                    type: 'chart',
                    x: 56,
                    y: 714,
                    width: 374,
                    height: 320,
                    props: {
                        title: '温湿协同趋势',
                        chartType: 'line',
                        csvText: buildDemoHistoryTrendCsv(),
                        labelColumn: 'bucket',
                        valueColumn: 'temperature',
                        valueColumns: ['temperature', 'humidity'],
                        seriesColumn: '',
                        seriesMode: 'double',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: portSource('demo-port-trend-csv')
                    }
                },
                {
                    id: 11,
                    type: 'chart',
                    x: 454,
                    y: 714,
                    width: 374,
                    height: 320,
                    props: {
                        title: '土壤湿度趋势',
                        chartType: 'line',
                        csvText: buildDemoHistoryTrendCsv(),
                        labelColumn: 'bucket',
                        valueColumn: 'soil_humidity',
                        valueColumns: ['soil_humidity'],
                        seriesColumn: '',
                        seriesMode: 'single',
                        selectedSeriesKeys: [],
                        dataLayout: 'wide',
                        enableAggregation: false,
                        aggregationLimit: 60,
                        source: portSource('demo-port-trend-csv')
                    }
                },
                {
                    id: 12,
                    type: 'agri-model',
                    x: 56,
                    y: 1048,
                    width: 506,
                    height: 520,
                    props: {
                        title: '农业环境建模',
                        jsonText: buildDemoModelDefaultValue(),
                        source: portSource('demo-port-model')
                    }
                },
                createChartComponent(
                    23,
                    852,
                    714,
                    374,
                    320,
                    '光照活跃度趋势',
                    'line',
                    buildDemoHistoryTrendCsv(),
                    portSource('demo-port-trend-csv'),
                    {
                        labelColumn: 'bucket',
                        valueColumn: 'light_lux',
                        valueColumns: ['light_lux'],
                        seriesMode: 'single'
                    }
                ),
                createChartComponent(
                    24,
                    1250,
                    714,
                    374,
                    320,
                    '辅助决策优先级',
                    'bar',
                    buildDemoDecisionPriorityCsv(),
                    manualSource(),
                    {
                        labelColumn: 'action',
                        valueColumn: 'score',
                        valueColumns: ['score'],
                        seriesMode: 'single'
                    }
                ),
                {
                    id: 13,
                    type: 'agri-climate',
                    x: 586,
                    y: 1048,
                    width: 506,
                    height: 420,
                    props: {
                        title: '气候趋势预测',
                        jsonText: buildDemoModelDefaultValue(),
                        source: portSource('demo-port-forecast-summary')
                    }
                },
                {
                    id: 14,
                    type: 'agri-yield',
                    x: 56,
                    y: 2904,
                    width: 772,
                    height: 470,
                    props: {
                        title: '产量预测',
                        jsonText: buildDemoModelDefaultValue(),
                        source: portSource('demo-port-yield-summary')
                    }
                },
                createChartComponent(
                    25,
                    1116,
                    1048,
                    508,
                    420,
                    '产量影响因子',
                    'bar',
                    buildDemoYieldFactorCsv(),
                    manualSource(),
                    {
                        labelColumn: 'factor',
                        valueColumn: 'score',
                        valueColumns: ['score'],
                        seriesMode: 'single'
                    }
                ),
                {
                    id: 15,
                    type: 'agri-decision',
                    x: 852,
                    y: 2904,
                    width: 772,
                    height: 470,
                    props: {
                        title: '辅助决策',
                        jsonText: buildDemoModelDefaultValue(),
                        source: portSource('demo-port-decision-summary')
                    }
                },
                {
                    id: 26,
                    type: 'agri-scene3d',
                    x: 56,
                    y: 2360,
                    width: 1568,
                    height: 520,
                    props: {
                        title: '3D 环境场景联动演示',
                        activeLayer: 'soil_moisture',
                        jsonText: buildDemoScene3dPayload(),
                        source: portSource('demo-port-scene3d')
                    }
                },
                createSummaryComponent(16, 56, 1332, 360, 280, '总览摘要卡', 'demo-port-overview-summary', buildDemoOverviewSummaryPayload()),
                createSummaryComponent(17, 434, 1332, 360, 280, '告警摘要卡', 'demo-port-alerts-summary', buildDemoAlertsSummaryPayload()),
                createSummaryComponent(18, 812, 1332, 360, 280, '建议摘要卡', 'demo-port-recommendations-summary', buildDemoRecommendationsSummaryPayload()),
                createSummaryComponent(19, 1190, 1332, 354, 280, '报告摘要卡', 'demo-port-report-summary', buildDemoReportSummaryPayload()),
                createSummaryComponent(20, 56, 1636, 476, 280, '气候预测摘要卡', 'demo-port-forecast-summary', buildDemoForecastSummaryPayload()),
                createSummaryComponent(21, 548, 1636, 476, 280, '产量预测摘要卡', 'demo-port-yield-summary', buildDemoYieldSummaryPayload()),
                createSummaryComponent(22, 1040, 1636, 504, 280, '决策摘要卡', 'demo-port-decision-summary', buildDemoDecisionSummaryPayload())
                ,
                {
                    id: 27,
                    type: 'text',
                    x: 56,
                    y: 318,
                    width: 900,
                    height: 36,
                    props: {
                        text: '现场态势：传感器 / 天气 / 抓拍 / 风险',
                        fontSize: 22,
                        color: '#bfdbfe',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: manualSource()
                    }
                },
                {
                    id: 28,
                    type: 'text',
                    x: 56,
                    y: 718,
                    width: 900,
                    height: 36,
                    props: {
                        text: '趋势图表：温湿度 / 土壤 / 光照 / 产量因素',
                        fontSize: 22,
                        color: '#bbf7d0',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: manualSource()
                    }
                },
                {
                    id: 29,
                    type: 'text',
                    x: 56,
                    y: 1118,
                    width: 1180,
                    height: 36,
                    props: {
                        text: '模型预测：农业环境建模 / 气候 / 产量 / 辅助决策 / 三维场景',
                        fontSize: 22,
                        color: '#fde68a',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: manualSource()
                    }
                },
                {
                    id: 30,
                    type: 'text',
                    x: 56,
                    y: 1678,
                    width: 1280,
                    height: 36,
                    props: {
                        text: '分析摘要：总览 / 告警 / 建议 / 预测 / 产量 / 决策 / 报告',
                        fontSize: 22,
                        color: '#e9d5ff',
                        fontWeight: '700',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        source: manualSource()
                    }
                }
                ];
                const layoutOverrides = {
                    1: { x: 56, y: 36, width: 2700, height: 76, props: { ...components.find(item => item.id === 1).props, fontSize: 52 } },
                    2: { x: 56, y: 122, width: 2700, height: 76, props: { ...components.find(item => item.id === 2).props, fontSize: 22 } },
                    3: { x: 3064, y: 46, width: 720, height: 44 },
                    4: { x: 3064, y: 98, width: 720, height: 98 },
                    5: { x: 56, y: 220, width: 3728, height: 86, props: { ...components.find(item => item.id === 5).props, fontSize: 18 } },
                    6: { x: 56, y: 360, width: 728, height: 360 },
                    7: { x: 1558, y: 360, width: 728, height: 360 },
                    8: { x: 807, y: 360, width: 728, height: 360 },
                    9: { x: 2309, y: 360, width: 728, height: 360 },
                    10: { x: 56, y: 760, width: 728, height: 360 },
                    11: { x: 807, y: 760, width: 728, height: 360 },
                    12: { x: 56, y: 1160, width: 728, height: 520 },
                    13: { x: 807, y: 1160, width: 728, height: 520 },
                    14: { x: 1558, y: 1160, width: 728, height: 520 },
                    15: { x: 2309, y: 1160, width: 728, height: 520 },
                    16: { x: 56, y: 1720, width: 508, height: 420 },
                    17: { x: 588, y: 1720, width: 508, height: 420 },
                    18: { x: 1120, y: 1720, width: 508, height: 420 },
                    19: { x: 1652, y: 1720, width: 508, height: 420 },
                    20: { x: 2184, y: 1720, width: 508, height: 420 },
                    21: { x: 2716, y: 1720, width: 508, height: 420 },
                    22: { x: 3248, y: 1720, width: 508, height: 420 },
                    23: { x: 1558, y: 760, width: 728, height: 360 },
                    24: { x: 3060, y: 360, width: 724, height: 360 },
                    25: { x: 2309, y: 760, width: 728, height: 360 },
                    26: { x: 3060, y: 1160, width: 724, height: 520 }
                };

                return components.map(component => (
                    layoutOverrides[component.id]
                        ? { ...component, ...layoutOverrides[component.id] }
                        : component
                ));
            })(),
            next_id: 31
        }
    };
}

function getRecentSortValue(project) {
    return Math.max(
        Date.parse(project?.lastOpenedAt || '') || 0,
        Date.parse(project?.updatedAt || '') || 0,
        Date.parse(project?.createdAt || '') || 0
    );
}

export function createProjectRecord({ type = 'workflow', name = '未命名项目', data = {} } = {}) {
    const now = getNowIso();
    const cloudProjectId = arguments[0]?.cloudProjectId;
    const cloudUpdatedAt = arguments[0]?.cloudUpdatedAt;

    return upsertProjectRecord({
        id: createProjectId(type),
        type,
        name,
        data,
        cloudProjectId: cloudProjectId == null ? '' : String(cloudProjectId),
        cloudUpdatedAt: String(cloudUpdatedAt || ''),
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now
    });
}

export function getProjectById(projectId) {
    if (!projectId) return null;
    return loadStore().projects.find(project => project.id === String(projectId)) || null;
}

export function findProjectByCloudId(type, cloudProjectId) {
    const normalizedCloudId = cloudProjectId == null || cloudProjectId === ''
        ? ''
        : String(cloudProjectId);
    if (!normalizedCloudId) return null;

    return loadStore().projects.find(project => (
        project.type === (type === 'screen' ? 'screen' : 'workflow')
        && String(project.cloudProjectId || '') === normalizedCloudId
    )) || null;
}

export function saveProjectData(projectId, { name, data, touchOpen = true } = {}) {
    const existing = getProjectById(projectId);
    if (!existing) return null;

    const now = getNowIso();
    const cloudProjectId = arguments[1]?.cloudProjectId;
    const cloudUpdatedAt = arguments[1]?.cloudUpdatedAt;

    return upsertProjectRecord({
        ...existing,
        name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
        data: data && typeof data === 'object' ? data : existing.data,
        cloudProjectId: cloudProjectId === undefined
            ? existing.cloudProjectId
            : (cloudProjectId == null ? '' : String(cloudProjectId)),
        cloudUpdatedAt: cloudUpdatedAt === undefined
            ? existing.cloudUpdatedAt
            : String(cloudUpdatedAt || ''),
        updatedAt: now,
        lastOpenedAt: touchOpen ? now : existing.lastOpenedAt
    });
}

export function touchProject(projectId) {
    const existing = getProjectById(projectId);
    if (!existing) return null;

    return upsertProjectRecord({
        ...existing,
        lastOpenedAt: getNowIso()
    });
}

export function listProjectsByType(type) {
    return loadStore().projects
        .filter(project => project.type === type)
        .sort((a, b) => getRecentSortValue(b) - getRecentSortValue(a));
}

export function listRecentProjects(limit = 8) {
    return loadStore().projects
        .sort((a, b) => getRecentSortValue(b) - getRecentSortValue(a))
        .slice(0, Math.max(1, limit));
}

export function removeProject(projectId) {
    const store = loadStore();
    store.projects = store.projects.filter(project => project.id !== String(projectId));
    saveStore(store);
}

export function renameProject(projectId, nextName) {
    const existing = getProjectById(projectId);
    if (!existing) return null;

    return upsertProjectRecord({
        ...existing,
        name: String(nextName || existing.name).trim() || existing.name,
        updatedAt: getNowIso()
    });
}

export function ensureDemoProjects() {
    const workflowProject = getProjectById(DEMO_WORKFLOW_PROJECT_ID);
    if (!workflowProject || Number(workflowProject.data?.demoVersion || 0) < DEMO_VERSION) {
        upsertProjectRecord({
            ...buildDemoWorkflowProject(),
            createdAt: workflowProject?.createdAt || getNowIso(),
            updatedAt: getNowIso(),
            lastOpenedAt: workflowProject?.lastOpenedAt || getNowIso()
        });
    }

    const screenProject = getProjectById(DEMO_SCREEN_PROJECT_ID);
    const screenNeedsRefresh = !screenProject
        || Number(screenProject.data?.demoVersion || 0) < DEMO_VERSION
        || Number(screenProject.data?.page?.width) !== DEMO_SCREEN_WIDTH
        || Number(screenProject.data?.page?.height) !== DEMO_SCREEN_HEIGHT;
    if (screenNeedsRefresh) {
        upsertProjectRecord({
            ...buildDemoScreenProject(),
            createdAt: screenProject?.createdAt || getNowIso(),
            updatedAt: getNowIso(),
            lastOpenedAt: screenProject?.lastOpenedAt || getNowIso()
        });
    }
}
