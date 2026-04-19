const STORAGE_KEY = 'ia.lowcode.projects.v1';
const MAX_RECENT_PROJECTS = 24;
const DEMO_WORKFLOW_PROJECT_ID = 'workflow-demo-smart-agriculture';
const DEMO_SCREEN_PROJECT_ID = 'screen-demo-smart-agriculture';
const DEMO_VERSION = 2;

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

function buildDemoNarrativeText() {
    return [
        '本演示将“数据采集、分析建模、低代码编排、大屏展示”四条主线串成一套完整闭环。',
        '工作流部分覆盖开始、打印、顺序、循环、分支、传感器读取、SQL 查询、分析摘要、抽象模型、输出端口等全部核心节点。',
        '大屏部分同时展示文本、现场抓拍、柱状图、折线图、饼图、传感器卡、模型卡、气候卡、产量卡、决策卡与天气卡。',
        '即使没有真实设备在线，系统也能自动回退到内置演示数据，保证评审、答辩和汇报现场稳定演示。'
    ].join('\n');
}

function buildDemoCameraSnapshotUrl() {
    return '/api/agriculture/camera/snapshot';
}

function buildDemoLatestSensorCsv() {
    return [
        'sensor,current_value,unit,status',
        '温度,24.6,°C,正常',
        '空气湿度,68,%,正常',
        '光照强度,18500,Lux,正常',
        '土壤湿度,45,%,预警',
        'PM2.5,26,μg/m³,正常'
    ].join('\n');
}

function buildDemoHistoryTrendCsv() {
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

function buildDemoRiskDistributionCsv() {
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
        model_name: '智慧农业抽象数据模型',
        screen_contract: {
            overview: {
                title: '智慧农业抽象数据模型',
                summary: '默认模型样例已就绪。运行工作流后，这里会切换为基于实时与历史传感器数据生成的农业环境抽象模型。',
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
                        message: '系统演示开始：将依次执行数据读取、SQL 查询、分析摘要、抽象建模与端口输出。',
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
                    type: 'abstract_data_model',
                    x: 2980,
                    y: 120,
                    parentId: null,
                    localX: 0,
                    localY: 0,
                    properties: {
                        name: '构建农业环境抽象模型',
                        deviceId: 'SmartAgriculture_thermometer',
                        hours: 168,
                        minPoints: 24,
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
                    name: '农业环境抽象模型JSON',
                    dataType: 'string',
                    defaultValue: buildDemoModelDefaultValue()
                }
            ],
            workflow_ports: [
                {
                    id: 'demo-port-model',
                    name: 'agriTwinModel',
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

function buildDemoScreenProject() {
    return {
        id: DEMO_SCREEN_PROJECT_ID,
        type: 'screen',
        name: '智慧农业演示工程-大屏',
        data: {
            demoVersion: DEMO_VERSION,
            page: {
                width: 1600,
                height: 1400,
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
                        text: '本页面联动展示项目亮点、数据采集、历史趋势、风险分布、农业环境抽象模型、气候预测、产量预测、辅助决策与天气模块。工作流运行后，图表和模型会同步刷新；未运行时也会使用演示默认值稳定展示。',
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
                        title: '农业环境抽象模型',
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
                    height: 260,
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
                    height: 260,
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
                    height: 260,
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
    if (!screenProject || Number(screenProject.data?.demoVersion || 0) < DEMO_VERSION) {
        upsertProjectRecord({
            ...buildDemoScreenProject(),
            createdAt: screenProject?.createdAt || getNowIso(),
            updatedAt: getNowIso(),
            lastOpenedAt: screenProject?.lastOpenedAt || getNowIso()
        });
    }
}
