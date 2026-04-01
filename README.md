# IA-Low-code-Development
BLCU project

# 数据库与传感器管理接口 — 变更说明

本文档记录为「数据库接口扩展」与「简单传感器管理」所做的代码变更，便于查阅与交接。

---

## 涉及文件

| 文件                | 变更类型                     |
| ------------------- | ---------------------------- |
| `src/database.py`   | 新增方法、辅助函数           |
| `src/web_server.py` | 新增 REST 路由、修复统计接口 |

---

## 一、`src/database.py` 变更

### 新增依赖

- `datetime` 中增加 `timedelta`，用于「在线」时间窗口判断。

### 新增方法

| 方法                                                    | 说明                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `_row_ts_to_iso(value)`                                 | 将数据库中的时间值统一转为 ISO 字符串或 `str`，供 JSON 使用。 |
| `list_sensors(online_within_minutes=15)`                | 列出所有设备/传感器，含统计字段与工作状态推断。              |
| `_sensor_row_to_dict(...)`                              | 将查询行转为统一的传感器字典（内部复用）。                   |
| `get_sensor_by_id(device_id, online_within_minutes=15)` | 按 `device_id` 查询单条传感器，不存在则返回 `None`。         |
| `get_database_summary()`                                | 返回库路径、设备数、`sensor_data` 行数、首尾时间戳等概要。   |

### 传感器字典字段含义（列表与详情一致）

| 字段               | 含义                                                    |
| ------------------ | ------------------------------------------------------- |
| `device_id`        | 传感器/设备 ID（主键）                                  |
| `device_name`      | 名称                                                    |
| `device_type`      | 类型                                                    |
| `client_id`        | 客户端 ID                                               |
| `location`         | 位置                                                    |
| `created_at`       | 创建时间                                                |
| `is_active`        | 是否在系统中启用                                        |
| `last_seen`        | 最近一次上报/写入时间                                   |
| `latest_data_time` | 最新一条 `sensor_data` 的时间                           |
| `data_count`       | `sensor_data` 中该设备的记录条数                        |
| `online`           | 是否在 `online_within_minutes` 内有 `last_seen`（布尔） |
| `work_status`      | `正常` / `离线` / `停用`（见下节规则）                  |

### 工作状态 `work_status` 规则

1. `is_active` 为假 → **`停用`**
2. 否则，若 `last_seen` 落在「当前时间 − `online_within_minutes`」之内 → **`正常`**
3. 否则 → **`离线`**

> 说明：`online` / `work_status` 由 `last_seen` 与 `is_active` 推断，不依赖单独运维界面；若需更精确的在线状态，可在 MQTT 入库时同步写入 `device_status` 表并扩展接口。

---

## 二、`src/web_server.py` 变更

### 新增 HTTP 接口

| 方法  | 路径                       | 鉴权 | 说明                                                         |
| ----- | -------------------------- | ---- | ------------------------------------------------------------ |
| `GET` | `/api/db/summary`          | 无   | 返回 `get_database_summary()` 的 JSON。                      |
| `GET` | `/api/sensors`             | 无   | 传感器列表；响应含 `sensors`、`count`、`online_within_minutes`。 |
| `GET` | `/api/sensors/<device_id>` | 无   | 单传感器详情；不存在返回 `404`。                             |

### 查询参数

- **`/api/sensors`** 与 **`/api/sensors/<device_id>`**  
  - `online_within`：整数，分钟，默认 `15`，限制在 **1～1440**（超出则夹紧），用于与数据库层 `online_within_minutes` 一致。

### 修复：`GET /api/statistics/device/<device_id>`

- **问题**：`first_record`、`last_record` 等时间字段的格式化循环缩进错误，导致仅部分字段被处理；且响应曾返回未完全格式化的 `stats`。
- **修复**：在循环内对每个时间字段做 `isoformat` / `str` 处理，并 **`return jsonify(stats_dict)`**。

---

## 三、调用示例

假设 Web 服务监听 `http://<主机>:8080`：

```http
GET http://<主机>:8080/api/db/summary
GET http://<主机>:8080/api/sensors
GET http://<主机>:8080/api/sensors?online_within=30
GET http://<主机>:8080/api/sensors/SmartAgriculture_thermometer
```

使用 curl：

```bash
curl -s "http://127.0.0.1:8080/api/db/summary"
curl -s "http://127.0.0.1:8080/api/sensors"
curl -s "http://127.0.0.1:8080/api/sensors/SmartAgriculture_thermometer"
```

---

## 四、与原有接口的关系

- **`GET /api/devices`**：仍保留，需 Token（`Authorization: Bearer ...` 或 `api_key`），面向受控的设备列表查询。
- **`GET /api/data/latest`**、**`/api/data/history`** 等：未改行为，仍用于时序与图表数据。
- 新增的 **`/api/db/summary`**、**`/api/sensors`** 系列：便于脚本与调试快速读取传感器 ID 与工作状态，**当前未加鉴权**；若部署在公网，建议按需加上与 `/api/devices` 相同的 `@require_auth` 或网关层限制。

---

## 五、数据库文件位置（默认）

- SQLite 路径默认：`项目根目录/data/iot_sensor_data.db`（与 `SensorDatabase` 初始化逻辑一致）。

---

*文档版本：与实现「数据库接口 + 传感器管理 API」的改动



## 六、可视化ui处理

- 在 `templates/index.html` 新增了 3 个可视化区块：
  - 数据库概要（设备总数、数据总条数、最早/最新数据时间）
  - 传感器管理表格（设备ID、名称、位置、状态、数据量、最后在线）
  - 传感器详情（点击表格行后显示该设备详细信息）
- 在 `static/js/main.js` 新增并接入：
  - `loadDbSummaryData()` / `updateDbSummary()`
  - `loadSensorsData()` / `updateSensorsTable()`
  - `loadSensorDetail()` / `updateSensorDetail()`
  - `formatDateTime()`（统一时间展示）
  - 同时把这三块接入了页面初始化和 `refreshData()`，保证和原有 `system/status`、`data/latest`、`data/history` 一样会被刷新。
- 在 `static/css/style.css` 增加：
  - `.clickable-row { cursor: pointer; }`，让传感器表格行可点击更直观。

### 使用效果

- 进入监控台后，会自动加载数据库概要和传感器列表。
- 点击任意传感器行，会调用 `GET /api/sensors/<device_id>` 并更新“传感器详情”卡片。
- 点右下角“刷新数据”会连同这三块一起刷新。